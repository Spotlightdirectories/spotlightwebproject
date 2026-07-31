"use client";

// ===============================================================
// src/app/(standalone)/partner-dashboard/page.tsx
//
// Partner Dashboard — faithful port of production's
// admin/partner-dashboard.html + partner-dashboard.js (one long
// stacked page — production never had tabs here, unlike the admin
// dashboard), with the following deliberate deviations, each tied to
// something confirmed during the getlisted/admin audits or this
// build's own RLS check:
//
// 1. NO client-side call to unlock_commissions() on load. An hourly
//    pg_cron job (unlock-commissions-job, confirmed via cron.job)
//    already flips pending -> available globally; a per-visit RPC
//    call here was pure redundant load, not a real requirement.
//
// 2. "Free Vendor" commission type dropped everywhere (summary card,
//    breakdown, type filter) per Cyril's confirmed decision — nothing
//    in the schema ever writes type='free_vendor', so production's
//    display of it was always a dead field.
//
// 3. Downline table: production ran one commissions query PER
//    downline partner in a loop (N+1), and that query only worked
//    because of a since-closed RLS gap ("Partner can view own
//    commissions" was replaced during the admin audit with a
//    correctly-scoped "Partners can view their commissions" policy
//    limited to partner_id IN (own partner ids)). That means a plain
//    partner can no longer read ANOTHER partner's commissions rows at
//    all — which is the correct, secure behavior, not a bug to route
//    around. So "Their Earnings" (a downline partner's own total) is
//    dropped entirely; instead this page computes "Your Override
//    Earnings" per downline partner directly from the CURRENT
//    partner's own already-fetched commissions (type='override',
//    grouped by source_partner_id) — which is both correct under RLS
//    and a single extra query instead of N.
//
// 4. Close/Restore account go through the close_partner_account() /
//    restore_partner_account() SECURITY DEFINER RPCs (built earlier
//    this session) instead of raw client .update() calls — the
//    `partners` table has no UPDATE policy for a plain authenticated
//    user at all, so production's direct update was always silently
//    failing under RLS before these RPCs existed.
//
// 5. Known, deliberately deferred gap (per Cyril: "note those gaps to
//    be fixed at the end"): close_partner_account() does NOT detach
//    the closing partner's referred vendors/downline partners, because
//    the pre-existing prevent_referral_update trigger blocks any
//    change to referred_by_partner_id/referred_by once set. Production
//    attempted this detachment directly and would have hit the same
//    trigger error. This page's confirm-close dialog is worded
//    honestly around that (does NOT claim vendors/partners get
//    detached), rather than porting production's inaccurate promise.
//    Same root cause blocks hard, forced closure once
//    scheduled_deletion_at has passed — this page detects that case
//    read-only and shows a "closed" screen + signs the partner out,
//    rather than attempting a write with no RPC to support it.
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { partnerSupabase, getPartnerSession, setPartnerSession, clearPartnerSession } from "@/lib/partnerSupabase";

type PartnerRow = {
  id: string;
  name: string | null;
  email: string | null;
  referral_code: string | null;
  account_status: string | null;
  scheduled_deletion_at: string | null;
  created_at: string;
};

type CommissionRow = {
  id: string;
  amount: number;
  status: "pending" | "available" | "paid" | string;
  type: "vendor" | "override" | "bonus" | string;
  created_at: string;
  available_at: string | null;
  source_partner_id: string | null;
  vendor_id: string | null;
  vendors: { name: string | null; plan_tier: string | null } | null;
  vendor_payments: { plan: string | null; billing_type: string | null } | null;
};

type DownlinePartner = { id: string; name: string | null };

const COMMISSION_PAGE_SIZE = 10;

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

  // Reward history filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);

  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

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
    // exists for it yet — see the note above), so it signs the
    // partner out and shows a clear message instead of pretending
    // the dashboard still works.
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

  function copyReferralLink() {
    if (!partner?.referral_code || typeof window === "undefined") return;
    const link = `${window.location.origin}/getlisted?ref=${partner.referral_code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    });
  }

  // ---------------------------------------------------------------
  // DERIVED TOTALS
  // ---------------------------------------------------------------
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

  const referredPartnersCount = downline.length;

  const accountStatus = (() => {
    if (partner?.scheduled_deletion_at) return "Closing";
    if (partner?.account_status === "closed") return "Closed";
    return isActive ? "Active" : "Inactive";
  })();

  const daysRemaining = partner?.scheduled_deletion_at
    ? Math.max(0, Math.ceil((new Date(partner.scheduled_deletion_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const filteredCommissions = commissions.filter((c) => {
    const nameMatch = (c.vendors?.name || "").toLowerCase().includes(search.toLowerCase().trim());
    const typeMatch = typeFilter === "all" || c.type === typeFilter;
    const statusMatch = statusFilter === "all" || c.status === statusFilter;
    return nameMatch && typeMatch && statusMatch;
  });
  const visibleCommissions = expanded ? filteredCommissions : filteredCommissions.slice(0, COMMISSION_PAGE_SIZE);
  const remainingCount = filteredCommissions.length - COMMISSION_PAGE_SIZE;

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
          <img src="/images/spotlightlogo-512.png" className="pd-logo" alt="Spotlight" />
          <span className="pd-title">Partner Dashboard</span>
        </div>
        <div className="pd-header-right">
          <span className="pd-name-label">{partner.name || partner.email}</span>
          <button className="pd-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="pd-content">
        {partner.scheduled_deletion_at && (
          <div className="pd-closing-notice">
            <p style={{ margin: 0 }}>Your account is scheduled for deletion in {daysRemaining} day(s).</p>
            <button className="pd-restore-btn" onClick={handleRestore}>Restore Account</button>
          </div>
        )}

        {loadError && (
          <div className="pd-closing-notice">
            <p style={{ margin: 0 }}>Some data couldn&apos;t be loaded: {loadError}</p>
          </div>
        )}

        {/* REFERRAL LINK */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Your Referral Link</h2>
          <p className="pd-section-note">Share this link — any vendor or partner who signs up through it is automatically credited to your account.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <code style={{ background: "var(--color-surface-alt)", padding: "8px 12px", borderRadius: 6 }}>
              {typeof window !== "undefined" ? window.location.origin : ""}/getlisted?ref={partner.referral_code}
            </code>
            <button className="pd-btn" onClick={copyReferralLink}>{copyState === "copied" ? "Copied!" : "Copy Link"}</button>
          </div>
        </div>

        {/* EARNINGS SUMMARY */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Earnings Summary</h2>
          <div className="pd-summary-grid">
            <div className="pd-summary-card">
              <div className="pd-summary-label">Pending</div>
              <div className="pd-summary-value">₦{pending.toLocaleString()}</div>
            </div>
            <div className="pd-summary-card">
              <div className="pd-summary-label">Available</div>
              <div className="pd-summary-value">₦{available.toLocaleString()}</div>
            </div>
            <div className="pd-summary-card">
              <div className="pd-summary-label">Paid</div>
              <div className="pd-summary-value">₦{paid.toLocaleString()}</div>
            </div>
            <div className="pd-summary-card">
              <div className="pd-summary-label">Total Earnings</div>
              <div className="pd-summary-value">₦{total.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* PERFORMANCE */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Performance</h2>
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Paid Vendors</th>
                  <th>Referred Partners</th>
                  <th>This Month (Yearly)</th>
                  <th>Bonus Progress</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{paidVendorIds.size}</td>
                  <td>{referredPartnersCount}</td>
                  <td>{monthlyQualified}</td>
                  <td>{bonusProgress} / 50</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* MONTHLY BONUS */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Monthly Bonus</h2>
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr><th>Target</th><th>Current</th><th>Reward</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>50 Yearly Vendors</td>
                  <td>{monthlyQualified}</td>
                  <td>₦30,000</td>
                  <td>{monthlyBonusEarned > 0 ? `₦${monthlyBonusEarned.toLocaleString()} Earned` : "Not Achieved"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="pd-progress-track">
            <div className="pd-progress-fill" style={{ width: `${Math.min(100, (bonusProgress / 50) * 100)}%` }} />
          </div>
        </div>

        {/* EARNINGS BREAKDOWN */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Earnings Breakdown</h2>
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead><tr><th>Type</th><th>Amount</th></tr></thead>
              <tbody>
                <tr><td>Vendor Commissions</td><td>₦{vendorTotal.toLocaleString()}</td></tr>
                <tr><td>Override Earnings (5%)</td><td>₦{overrideTotal.toLocaleString()}</td></tr>
                <tr><td>Monthly Bonuses</td><td>₦{bonusTotal.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* REWARD & BONUS HISTORY */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Reward &amp; Bonus History</h2>
          <button className="pd-btn" style={{ marginBottom: 14 }} onClick={downloadCSV}>Download Statement (CSV)</button>

          <div className="pd-controls-row">
            <input
              type="text"
              className="pd-search"
              placeholder="Search by vendor name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setExpanded(false); }}
            />
            <select className="pd-filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setExpanded(false); }}>
              <option value="all">All Types</option>
              <option value="vendor">Paid Vendor</option>
              <option value="override">Override</option>
              <option value="bonus">Bonus</option>
            </select>
            <select className="pd-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setExpanded(false); }}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="available">Available</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr><th>Vendor</th><th>Plan</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {visibleCommissions.length === 0 ? (
                  <tr><td colSpan={6} className="pd-empty-cell">{commissions.length === 0 ? "No rewards yet." : "No results found."}</td></tr>
                ) : (
                  visibleCommissions.map((c) => {
                    const amount = Number(c.amount) / 100;
                    const typeLabel = c.type === "vendor" ? "Paid Vendor" : c.type === "override" ? "Override" : c.type === "bonus" ? "Bonus" : "—";
                    return (
                      <tr key={c.id}>
                        <td>{c.vendors?.name || "—"}</td>
                        <td>{c.vendors?.plan_tier || "—"}</td>
                        <td>{typeLabel}</td>
                        <td>₦{amount.toLocaleString()}</td>
                        <td><span className={`pd-status-badge pd-status-${c.status}`}>{c.status}</span></td>
                        <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {remainingCount > 0 && (
            <button className="pd-see-more-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "See less" : `See more (${remainingCount} older)`}
            </button>
          )}
        </div>

        {/* DOWNLINE */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Referred Partners (Downline)</h2>
          <p className="pd-section-note">
            Vendor counts and your 5% override earnings from each partner you&apos;ve referred. A downline partner&apos;s own
            total earnings aren&apos;t shown here — that&apos;s private to their account.
          </p>
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr><th>Partner Name</th><th>Vendors Referred</th><th>Your Override Earnings</th></tr>
              </thead>
              <tbody>
                {downline.length === 0 ? (
                  <tr><td colSpan={3} className="pd-empty-cell">No referred partners.</td></tr>
                ) : (
                  downline.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name || "—"}</td>
                      <td>{downlineVendorCounts[d.id] || 0}</td>
                      <td>₦{(overrideByDownline[d.id] || 0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="pd-section">
          <h2 className="pd-section-heading">Account</h2>
          <div className="pd-account-row"><span>Partner Since</span><span>{new Date(partner.created_at).toLocaleDateString()}</span></div>
          <div className="pd-account-row">
            <span>Account Status</span>
            <span className={`pd-status-badge pd-status-${accountStatus.toLowerCase()}`}>{accountStatus}</span>
          </div>
          {!partner.scheduled_deletion_at && (
            <div className="pd-account-actions">
              <button className="pd-danger-btn" onClick={handleClose}>Close Account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
