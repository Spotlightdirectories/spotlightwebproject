"use client";

// ===============================================================
// src/app/(standalone)/admin/page.tsx
//
// Admin Dashboard — MODULE 1: shell + role-based nav + logout.
//
// Restructured from production's admin-payments.html (one long page,
// all sections stacked and shown/hidden via a data-roles attribute)
// into a tabbed dashboard shell, per Cyril's explicit request
// (2026-07-31): "a proper dashboard shell with a side nav and
// separate tabs per section". Same 11 sections, same role gating,
// same underlying data model — just organized as tabs instead of
// one long scroll.
//
// Auth guard: reads admin_session from localStorage, exactly like
// production's admin-payments.js (set at /admin-login). Every
// section is present here as a stub — they get built out one at a
// time in follow-up work, same pattern used for the vendor dashboard.
// ===============================================================

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminSupabase, getAdminSession, clearAdminSession, type AdminRole, type AdminSession } from "@/lib/adminSupabase";

import StaffTab from "./StaffTab";
import SecurityLogTab from "./SecurityLogTab";
import PaymentsTab from "./PaymentsTab";
import SponsorshipsTab from "./SponsorshipsTab";
import VerificationsTab from "./VerificationsTab";
import ListingsModerationTab from "./ListingsModerationTab";
import PartnerApprovalsTab from "./PartnerApprovalsTab";
import PartnerHistoryTab from "./PartnerHistoryTab";
import CommissionsTab from "./CommissionsTab";
import PaymentHistoryTab from "./PaymentHistoryTab";
import SponsorshipHistoryTab from "./SponsorshipHistoryTab";
import VerificationHistoryTab from "./VerificationHistoryTab";

type TabKey =
  | "staff"
  | "securityLog"
  | "payments"
  | "sponsorships"
  | "verifications"
  | "listingsModeration"
  | "partnerApprovals"
  | "partnerHistory"
  | "commissions"
  | "paymentHistory"
  | "sponsorshipHistory"
  | "verificationHistory";

type TabDef = {
  key: TabKey;
  label: string;
  icon: string;
  roles: AdminRole[];
  Component: (props: { currentRole: AdminRole }) => React.ReactElement;
};

// Order + role gating ported 1:1 from admin-payments.html's
// data-roles attributes.
const TABS: TabDef[] = [
  { key: "staff", label: "Staff Management", icon: "fa-solid fa-shield-halved", roles: ["super_admin"], Component: StaffTab },
  { key: "securityLog", label: "Security Log", icon: "fa-solid fa-shield-halved", roles: ["super_admin"], Component: SecurityLogTab },
  { key: "payments", label: "Pending Payments", icon: "fa-solid fa-money-check-dollar", roles: ["super_admin", "admin", "finance_admin"], Component: PaymentsTab },
  { key: "sponsorships", label: "Pending Sponsorships", icon: "fa-solid fa-bullhorn", roles: ["super_admin", "admin", "finance_admin"], Component: SponsorshipsTab },
  { key: "verifications", label: "Pending Verifications", icon: "fa-solid fa-certificate", roles: ["super_admin", "admin", "verification_admin"], Component: VerificationsTab },
  { key: "listingsModeration", label: "Pending Listings", icon: "fa-solid fa-flag", roles: ["super_admin", "admin"], Component: ListingsModerationTab },
  { key: "partnerApprovals", label: "Pending Partner Approvals", icon: "fa-solid fa-handshake", roles: ["super_admin", "admin"], Component: PartnerApprovalsTab },
  { key: "partnerHistory", label: "Partner History", icon: "fa-solid fa-clock-rotate-left", roles: ["super_admin", "admin"], Component: PartnerHistoryTab },
  { key: "commissions", label: "Commissions", icon: "fa-solid fa-sack-dollar", roles: ["super_admin", "admin", "finance_admin"], Component: CommissionsTab },
  { key: "paymentHistory", label: "Payment History", icon: "fa-solid fa-clock-rotate-left", roles: ["super_admin", "admin", "finance_admin"], Component: PaymentHistoryTab },
  { key: "sponsorshipHistory", label: "Sponsorship History", icon: "fa-solid fa-clock-rotate-left", roles: ["super_admin", "admin", "finance_admin"], Component: SponsorshipHistoryTab },
  { key: "verificationHistory", label: "Verification History", icon: "fa-solid fa-clock-rotate-left", roles: ["super_admin", "admin", "verification_admin"], Component: VerificationHistoryTab },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance_admin: "Finance Admin",
  verification_admin: "Verification Admin",
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [session, setSession] = useState<AdminSession | null>(null);
  const [checked, setChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ---------------------------------------------------------------
  // AUTH GUARD — same as production: no valid admin_session in
  // localStorage means straight back to /admin-login.
  // ---------------------------------------------------------------
  useEffect(() => {
    const s = getAdminSession();
    if (!s) {
      router.replace("/admin-login");
      return;
    }
    setSession(s);
    setChecked(true);
  }, [router]);

  const visibleTabs = useMemo(() => {
    if (!session) return [];
    return TABS.filter((t) => t.roles.includes(session.role));
  }, [session]);

  // Default to the first section this role is actually allowed to see.
  useEffect(() => {
    if (visibleTabs.length > 0 && !activeTab) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  async function handleLogout() {
    await adminSupabase.auth.signOut();
    clearAdminSession();
    router.replace("/admin-login");
  }

  if (!checked || !session) {
    return null;
  }

  const ActiveComponent = visibleTabs.find((t) => t.key === activeTab)?.Component;

  return (
    <div className="adm-shell" style={{ flexDirection: "column" }}>
      {/* HEADER */}
      <div className="adm-header-bar">
        <div className="adm-header-left">
          <img src="/images/spotlightlogo-512.png" className="adm-logo" alt="Spotlight" />
          <span className="adm-title">Admin Dashboard</span>
        </div>
        <div className="adm-header-right">
          <span className={`adm-role-badge role-${session.role}`}>{ROLE_LABELS[session.role]}</span>
          <span className="adm-name-label">{session.email}</span>
          <button className="adm-logout-btn" onClick={handleLogout}>Logout</button>
          {/* Was in adm-header-left, ahead of the logo/title, so on
              mobile it sat awkwardly at the far left overlapping the
              brand — every other mobile menu on the site (public
              Navbar, vendor dashboard) puts the hamburger at the far
              right instead (Cyril, 2026-08). Moved to the end of
              adm-header-right to match. */}
          <button
            className="adm-mobile-menu-btn"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>

      <div className="adm-body">
        {/* SIDEBAR */}
        <aside className={`adm-sidebar${mobileSidebarOpen ? " active" : ""}`}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={`adm-nav-item${activeTab === tab.key ? " active" : ""}`}
              onClick={() => {
                setActiveTab(tab.key);
                setMobileSidebarOpen(false);
              }}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </aside>

        {mobileSidebarOpen && (
          <div
            className="adm-mobile-overlay active"
            onClick={() => setMobileSidebarOpen(false)}
          ></div>
        )}

        {/* CONTENT */}
        <main className="adm-content">
          {ActiveComponent && <ActiveComponent currentRole={session.role} />}
        </main>
      </div>
    </div>
  );
}
