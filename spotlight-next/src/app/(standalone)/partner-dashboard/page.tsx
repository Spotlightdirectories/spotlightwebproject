"use client";

// ===============================================================
// src/app/(standalone)/partner-dashboard/page.tsx
//
// Partner Dashboard — shell + auth guard + data loading, restructured
// (2026-08) as a sidebar + tab-per-section layout matching the admin
// dashboard exactly, per Cyril's explicit request. Production's
// actual admin/partner-dashboard.html has never had tabs — it's one
// long stacked page — and an earlier pass ported that literally, but
// Cyril specifically wanted the admin-style structure applied here
// too, so this shell now mirrors admin/page.tsx's pattern (TABS array,
// sidebar nav, one section visible at a time), with the same 8
// sections regrouped into 4 tabs: Overview (referral link + earnings
// summary + performance + monthly bonus), Earnings (breakdown +
// reward/bonus history), Downline, and Account.
//
// All the underlying data logic is unchanged from the original build:
//
// 1. NO client-side call to unlock_commissions() on load. An hourly
//    pg_cron job (unlock-commissions-job, confirmed via cron.job)
//    already flips pending -> available globally; a per-visit RPC
//    call here was pure redundant load, not a real requirement.
//
// 2. "Free Vendor" commission type dropped everywhere per Cyril's
//    confirmed decision — nothing in the schema ever writes
//    type='free_vendor', so production's display of it was always a
//    dead field.
//
// 3. Downline table: production ran one commissions query PER
//    downline partner in a loop (N+1), and that query only worked
//    because of a since-closed RLS gap. "Their Earnings" (a downline
//    partner's own total) is dropped entirely; "Your Override
//    Earnings" is computed from the CURRENT partner's own
//    already-fetched commissions (type='override', grouped by
//    source_partner_id) — correct under RLS and one query instead
//    of N.
//
// 4. Close/Restore account go through the close_partner_account() /
//    restore_partner_account() SECURITY DEFINER RPCs instead of raw
//    client .update() calls — `partners` has no UPDATE policy for a
//    plain authenticated user at all.
//
// 5. Known, deliberately deferred gap (per Cyril: "note those gaps to
//    be fixed at the end"): close_partner_account() does NOT detach
//    the closing partner's referred vendors/downline partners, because
//    the pre-existing prevent_referral_update trigger blocks any
//    change to referred_by_partner_id/referred_by once set. Same root
//    cause blocks hard, forced closure once scheduled_deletion_at has
//    passed — this page detects that case read-only and shows a
//    "closed" screen + signs the partner out.
// ===============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { partnerSupabase, getPartnerSession, setPartnerSession, clearPartnerSession } from "@/lib/partnerSupabase";
import type { PartnerRow, CommissionRow, DownlinePartner } from "./types";
import OverviewTab from "./OverviewTab";
import EarningsTab from "./EarningsTab";
import DownlineTab from "./DownlineTab";
import AccountTab from "./AccountTab";

type TabKey = "overview" | "earnings" | "downline" | "account";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "fa-solid fa-gauge" },
  { key: "earnings", label: "Earnings", icon: "fa-solid fa-sack-dollar" },
  { key: "downline", label: "Downline", icon: "fa-solid fa-users" },
  { key: "account", label: "Account", icon: "fa-solid fa-user-gear" },
];

export default function PartnerDashboardPage() {
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [partner, setPartner] = useState<PartnerRow | null>(null);
  const [closedOut, setClosedOut] = useState(false);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [downline, setDownline] = useState<DownlinePartner[]>([]);
  const [downlineVendorCounts, setDownlineVendorCounts] = useState<Record<string, number>>({});
  const [isActive, setIsActive] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Reward history filters (owned here so they persist across tab switches)
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);

  // ---------------------------------------------------------------
  // LOAD
  // ---------------------------------------------------------------
  const load = useCallback(async () => {
    const cached = getPartnerSession();
    if (!cached) {
      router.replace("/partner-program#login");
      return;
    }

    const { data: { user }, error: authError } = await partnerSupabase.auth.getUser();
    if (authError || !user) {
      clearPartnerSession();
      router.replace("/partner-program#login");
      return;
    }

    const { data: p, error: partnerError } = await partnerSupabase
      .from("partners")
      .select("id, name, email, referral_code, account_status, scheduled_deletion_at, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (partnerError || !p) {
      await partnerSupabase.auth.signOut();
      clearPartnerSession();
      router.replace("/partner-program#login");
      return;
    }

    // Hard-expiration check — read-only. If the 14-day window has
    // passed, this page cannot itself finalize the closure (no RPC
    // exists for it yet), so it signs the partner out and shows a
    // clear message instead of pretending the dashboard still works.
    if (p.scheduled_deletion_at && new Date() >= new Date(p.scheduled_deletion_at)) {
      await partnerSupabase.auth.signOut();
      clearPartnerSession();
      setClosedOut(true);
      setChecked(true);
      return;
    }

    setPartner(p as PartnerRow);
    setPartnerSession({
      user_id: user.id,
      partner_id: p.id,
      name: p.name || "",
      email: p.email || "",
      referral_code: p.referral_code,
    });

    const { data: commissionData, error: commissionError } = await partnerSupabase
      .from("commissions")
      .select("id, amount, status, type, created_at, available_at, source_partner_id, vendor_id, vendors(name, plan_tier), vendor_payments(plan, billing_type)")
      .eq("partner_id", p.id)
      .order("created_at", { ascending: false });

    if (commissionError) {
      setLoadError(commissionError.message);
    } else {
      setCommissions((commissionData || []) as unknown as CommissionRow[]);
    }

    const { data: downlineData } = await partnerSupabase
      .from("partners")
      .select("id, name")
      .eq("referred_by", p.id);

    const downlineList = (downlineData || []) as DownlinePartner[];
    setDownline(downlineList);

    const relevantIds = [p.id, ...downlineList.map((d) => d.id)];
    const { data: vendorRows } = await partnerSupabase
      .from("vendors")
      .select("id, referred_by_partner_id, created_at")
      .in("referred_by_partner_id", relevantIds);

    const counts: Record<string, number> = {};
    let ownActive = false;
    const now = new Date();
    (vendorRows || []).forEach((v: { referred_by_partner_id: string | null; created_at: string }) => {
      if (!v.referred_by_partner_id) return;
      counts[v.referred_by_partner_id] = (counts[v.referred_by_partner_id] || 0) + 1;
      if (v.referred_by_partner_id === p.id) {
        const days = (now.getTime() - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days <= 30) ownActive = true;
      }
    });
    setDownlineVendorCounts(counts);
    setIsActive(ownActive);

    setChecked(true);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLogout() {
    await partnerSupabase.auth.signOut();
    clearPartnerSession();
    router.replace("/partner-program#login");
  }

  async function handleClose() {
    const ok = confirm(
      "Are you sure you want to close your account?\n\n" +
        "Your account will be scheduled for permanent deletion in 14 days — you can restore it any time before then.\n\n" +
        "Closing does not cancel or refund any active vendor subscriptions, and does not affect commissions you've already earned (available or paid). Vendors and partners already linked to your account remain linked during this period."
    );
    if (!ok) return;

    const { error } = await partnerSupabase.rpc("close_partner_account");
    if (error) {
      alert(`Failed to close account: ${error.message}`);
      return;
    }
    alert("Your account has been scheduled for closure. You have 14 days to restore it.");
    load();
  }

  async function handleRestore() {
    const ok = confirm("Do you want to restore your account?");
    if (!ok) return;

    const { error } = await partnerSupabase.rpc("restore_partner_account");
    if (error) {
      alert(`Failed to restore account: ${error.message}`);
      return;
    }
    alert("Your account has been restored.");
    load();
  }

  // ---------------------------------------------------------------
  // DERIVED TOTALS — computed once here, passed down to whichever
  // tab needs them.
  // ---------------------------------------------------------------
  const derived = useMemo(() => {
    let pending = 0, available = 0, paid = 0, total = 0;
    let vendorTotal = 0, overrideTotal = 0, bonusTotal = 0;
    const paidVendorIds = new Set<string>();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let monthlyQualified = 0;
    let monthlyBonusEarned = 0;
    const overrideByDownline: Record<string, number> = {};

    commissions.forEach((c) => {
      const amount = Number(c.amount) / 100;
      total += amount;
      if (c.status === "pending") pending += amount;
      if (c.status === "available") available += amount;
      if (c.status === "paid") paid += amount;

      if (c.type === "vendor") vendorTotal += amount;
      if (c.type === "override") overrideTotal += amount;
      if (c.type === "bonus") bonusTotal += amount;

      if (c.type === "vendor" && c.vendor_id) paidVendorIds.add(c.vendor_id);

      const created = new Date(c.created_at);
      const isCurrentMonth = created.getMonth() === currentMonth && created.getFullYear() === currentYear;
      if (isCurrentMonth) {
        const isYearly = c.vendor_payments?.billing_type === "yearly";
        if (c.type === "vendor" && isYearly) monthlyQualified++;
        if (c.type === "bonus") monthlyBonusEarned += amount;
      }

      if (c.type === "override" && c.source_partner_id) {
        overrideByDownline[c.source_partner_id] = (overrideByDownline[c.source_partner_id] || 0) + amount;
      }
    });

    const bonusProgress = monthlyQualified % 50;

    return {
      pending, available, paid, total,
      vendorTotal, overrideTotal, bonusTotal,
      paidVendorCount: paidVendorIds.size,
      monthlyQualified, monthlyBonusEarned, bonusProgress,
      overrideByDownline,
    };
  }, [commissions]);

  const referredPartnersCount = downline.length;

  const accountStatus = (() => {
    if (partner?.scheduled_deletion_at) return "Closing";
    if (partner?.account_status === "closed") return "Closed";
    return isActive ? "Active" : "Inactive";
  })();

  const daysRemaining = partner?.scheduled_deletion_at
    ? Math.max(0, Math.ceil((new Date(partner.scheduled_deletion_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  function downloadCSV() {
    const filtered = commissions.filter((c) => c.status !== "pending");
    if (filtered.length === 0) {
      alert("No available or paid records to export.");
      return;
    }
    const sorted = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let balance = 0;
    const rows = sorted.map((c) => {
      const amount = Number(c.amount) / 100;
      let credit = 0, debit = 0, description = "";
      if (c.status === "available") {
        credit = amount;
        balance += amount;
        description = c.type === "bonus" ? "Monthly Bonus" : `${c.type} earning`;
      }
      if (c.status === "paid") {
        debit = amount;
        balance -= amount;
        description = "Payout";
      }
      return {
        Date: new Date(c.created_at).toLocaleDateString(),
        Description: description,
        Credit: credit ? credit.toFixed(2) : "",
        Debit: debit ? debit.toFixed(2) : "",
        Balance: balance.toFixed(2),
      };
    });

    const csvContent = [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statement.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!checked) return null;

  if (closedOut) {
    return (
      <div className="pd-shell">
        <div className="pd-content">
          <div className="pd-section" style={{ textAlign: "center" }}>
            <h2 className="pd-section-heading">Account Closed</h2>
            <p>Your partner account has reached the end of its 14-day closure window and has been closed.</p>
            <p>Contact support@spotlightdirectories.com if you believe this is a mistake.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="pd-shell">
      <div className="pd-header-bar">
        <div className="pd-header-left">
          <button className="pd-mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
            <i className="fa-solid fa-bars"></i>
          </button>
          <img src="/images/spotlightlogo-512.png" className="pd-logo" alt="Spotlight" />
          <span className="pd-title">Partner Dashboard</span>
        </div>
        <div className="pd-header-right">
          <span className="pd-name-label">{partner.name || partner.email}</span>
          <button className="pd-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {partner.scheduled_deletion_at && (
        <div className="pd-closing-notice" style={{ margin: "16px 24px 0" }}>
          <p style={{ margin: 0 }}>Your account is scheduled for deletion in {daysRemaining} day(s).</p>
          <button className="pd-restore-btn" onClick={handleRestore}>Restore Account</button>
        </div>
      )}

      {loadError && (
        <div className="pd-closing-notice" style={{ margin: "16px 24px 0" }}>
          <p style={{ margin: 0 }}>Some data couldn&apos;t be loaded: {loadError}</p>
        </div>
      )}

      <div className="pd-body">
        <aside className={`pd-sidebar${mobileSidebarOpen ? " active" : ""}`}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`pd-nav-item${activeTab === t.key ? " active" : ""}`}
              onClick={() => { setActiveTab(t.key); setMobileSidebarOpen(false); }}
            >
              <i className={t.icon}></i>
              {t.label}
            </button>
          ))}
        </aside>

        {mobileSidebarOpen && (
          <div className="pd-mobile-overlay active" onClick={() => setMobileSidebarOpen(false)}></div>
        )}

        <main className="pd-content">
          {activeTab === "overview" && (
            <OverviewTab
              referralCode={partner.referral_code}
              pending={derived.pending}
              available={derived.available}
              paid={derived.paid}
              total={derived.total}
              paidVendorCount={derived.paidVendorCount}
              referredPartnersCount={referredPartnersCount}
              monthlyQualified={derived.monthlyQualified}
              bonusProgress={derived.bonusProgress}
              monthlyBonusEarned={derived.monthlyBonusEarned}
            />
          )}

          {activeTab === "earnings" && (
            <EarningsTab
              vendorTotal={derived.vendorTotal}
              overrideTotal={derived.overrideTotal}
              bonusTotal={derived.bonusTotal}
              commissions={commissions}
              search={search}
              setSearch={setSearch}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              expanded={expanded}
              setExpanded={setExpanded}
              onDownloadCSV={downloadCSV}
            />
          )}

          {activeTab === "downline" && (
            <DownlineTab
              downline={downline}
              downlineVendorCounts={downlineVendorCounts}
              overrideByDownline={derived.overrideByDownline}
            />
          )}

          {activeTab === "account" && (
            <AccountTab partner={partner} accountStatus={accountStatus} onClose={handleClose} />
          )}
        </main>
      </div>
    </div>
  );
}
