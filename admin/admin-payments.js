console.log("admin-payments.js BUILD-CHECK-2026-07-14-C loaded");

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  // Declared here (not further down) so they exist before
  // loadStaffAuditLog() can possibly need them — previously these
  // sat near the end of the file, which raced against this function's
  // own database call and intermittently crashed with a
  // "Cannot access before initialization" error.
  let allStaffAuditEntries = [];
  const auditActionLabels = {
    invited: "Invited",
    assigned_role: "Assigned Role",
    claimed_invitation: "Claimed Invitation",
    revoked_role: "Revoked Role",
    revoked_invitation: "Revoked Invitation"
  };
  const STAFF_AUDIT_PAGE_SIZE = 5;
  let staffAuditRenderEntries = [];
  let staffAuditExpanded = false;

  const SECURITY_LOG_PAGE_SIZE = 5;
  let securityLogAllEntries = [];
  let securityLogRenderEntries = [];
  let securityLogExpanded = false;

  const table = document.getElementById("paymentsTable");
  const verificationTable = document.getElementById("verificationsTable");
  const partnersTable = document.getElementById("partnersTable");
  const commissionsTable = document.getElementById("commissionsTable");
  const summaryTable = document.getElementById("commissionSummaryTable");

  // -----------------------------
  // ADMIN SESSION GUARD
  // Now supports all admin role types.
  // -----------------------------
  const adminSession = JSON.parse(localStorage.getItem("admin_session"));

  const ADMIN_ROLES = [
    "super_admin",
    "admin",
    "finance_admin",
    "verification_admin"
  ];

  if (!adminSession || !ADMIN_ROLES.includes(adminSession.role)) {
    alert("Admin access only");
    window.location.href = "admin-login";
    return;
  }

  const currentRole = adminSession.role;

  // -----------------------------
  // ADMIN HEADER
  // Show name, role badge, logout button
  // -----------------------------
  const roleBadge = document.getElementById("adminRoleBadge");
  const nameLabel = document.getElementById("adminNameLabel");
  const logoutBtn = document.getElementById("adminLogoutBtn");

  const roleLabels = {
    super_admin:       "Super Admin",
    admin:             "Admin",
    finance_admin:     "Finance Admin",
    verification_admin:"Verification Admin"
  };

  if (roleBadge) {
    roleBadge.textContent = roleLabels[currentRole] || currentRole;
    roleBadge.classList.add(`role-${currentRole}`);
  }

  if (nameLabel) {
    nameLabel.textContent = adminSession.email || "";
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("admin_session");
      window.location.href = "admin-login";
    });
  }

  // -----------------------------
  // ROLE-BASED SECTION VISIBILITY
  // Each section declares which roles can see it
  // via data-roles="role1,role2" attribute.
  // This runs once on load and controls what each
  // admin personnel can see on their screen.
  // -----------------------------
  function applyRoleVisibility() {
    document.querySelectorAll(".admin-section").forEach(section => {
      const allowedRoles = (section.dataset.roles || "")
        .split(",")
        .map(r => r.trim());

      if (allowedRoles.includes(currentRole)) {
        section.classList.add("role-visible");
      } else {
        section.classList.remove("role-visible");
        section.style.display = "none";
      }
    });
  }

  applyRoleVisibility();

  // -----------------------------
  // ADMIN STAFF MANAGEMENT
  // Only visible to super_admin.
  // Assign, change, or revoke admin roles.
  // -----------------------------
  if (currentRole === "super_admin") {

    // Load current admin staff list
    async function loadAdminStaff() {
      const staffTable = document.getElementById("adminStaffTable");
      if (!staffTable) return;

      const { data: roles, error } = await supabase.rpc("get_admin_staff_list");

      if (error || !roles || !roles.length) {
        staffTable.innerHTML = `<tr><td colspan="4">No admin staff assigned yet.</td></tr>`;
        return;
      }

      staffTable.innerHTML = "";

      roles.forEach(r => {
        const tr = document.createElement("tr");
        const assignedDate = r.created_at
          ? new Date(r.created_at).toLocaleDateString()
          : "—";

        const roleDisplay = roleLabels[r.role] || r.role;

        tr.innerHTML = `
          <td>${sanitize(r.email)}</td>
          <td><span class="admin-role-badge role-${r.role}" style="display:inline-block;">${roleDisplay}</span></td>
          <td>${assignedDate}</td>
          <td>
            <button
              class="reject-btn"
              onclick="revokeAdminRole('${r.user_id}', '${sanitize(r.email)}', '${r.role}')">
              Revoke
            </button>
          </td>
        `;
        staffTable.appendChild(tr);
      });
    }

    loadAdminStaff();
    loadPendingInvitations();
    loadStaffAuditLog();
    loadSecurityLog();

    const staffAuditSeeMoreBtn = document.getElementById("staffAuditSeeMoreBtn");
    if (staffAuditSeeMoreBtn) {
      staffAuditSeeMoreBtn.addEventListener("click", () => {
        staffAuditExpanded = !staffAuditExpanded;
        renderStaffAuditRows();
      });
    }

    const securityLogSeeMoreBtn = document.getElementById("securityLogSeeMoreBtn");
    if (securityLogSeeMoreBtn) {
      securityLogSeeMoreBtn.addEventListener("click", () => {
        securityLogExpanded = !securityLogExpanded;
        renderSecurityLogRows();
      });
    }

    // Load the tamper-proof, database-level security log (audit_log
    // table, populated automatically by DB triggers — separate from
    // the app-level admin_audit_log above).
    async function loadSecurityLog() {
      const logTable = document.getElementById("securityLogTable");
      if (!logTable) return;

      let entries, error;
      try {
        const result = await supabase
          .from("audit_log")
          .select("id, table_name, action, row_id, actor_email, old_data, new_data, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        entries = result.data;
        error = result.error;
      } catch (thrownErr) {
        console.error("Security log threw:", thrownErr);
        logTable.innerHTML = `<tr><td colspan="5">Error: ${sanitize(thrownErr.message || String(thrownErr))}</td></tr>`;
        return;
      }

      if (error) {
        console.error("Security log query error:", error);
        logTable.innerHTML = `<tr><td colspan="5">Failed to load security log: ${sanitize(error.message)}</td></tr>`;
        return;
      }

      if (!entries || !entries.length) {
        logTable.innerHTML = `<tr><td colspan="5">No activity recorded yet.</td></tr>`;
        return;
      }

      securityLogAllEntries = entries;
      renderSecurityLog(entries);

      const searchInput = document.getElementById("securityLogSearch");
      const tableFilter = document.getElementById("securityLogTableFilter");
      const actionFilter = document.getElementById("securityLogActionFilter");

      function applyFilters() {
        const searchTerm = (searchInput?.value || "").toLowerCase().trim();
        const tableValue = tableFilter?.value || "all";
        const actionValue = actionFilter?.value || "all";

        const filtered = securityLogAllEntries.filter(e => {
          const emailMatch = (e.actor_email || "").toLowerCase().includes(searchTerm);
          const tableMatch = tableValue === "all" || e.table_name === tableValue;
          const actionMatch = actionValue === "all" || e.action === actionValue;
          return emailMatch && tableMatch && actionMatch;
        });

        renderSecurityLog(filtered);
      }

      if (searchInput) searchInput.addEventListener("input", applyFilters);
      if (tableFilter) tableFilter.addEventListener("change", applyFilters);
      if (actionFilter) actionFilter.addEventListener("change", applyFilters);
    }

    // Load pending invitations (people invited but not yet logged in)
    async function loadPendingInvitations() {
      const invitesTable = document.getElementById("pendingInvitationsTable");
      if (!invitesTable) return;

      const { data: invitations, error } = await supabase
        .from("admin_invitations")
        .select("id, email, role, created_at")
        .eq("used", false)
        .order("created_at", { ascending: false });

      if (error || !invitations || !invitations.length) {
        invitesTable.innerHTML = `<tr><td colspan="4">No pending invitations.</td></tr>`;
        return;
      }

      invitesTable.innerHTML = "";

      invitations.forEach(inv => {
        const tr = document.createElement("tr");
        const invitedDate = inv.created_at
          ? new Date(inv.created_at).toLocaleDateString()
          : "—";

        const roleDisplay = roleLabels[inv.role] || inv.role;

        tr.innerHTML = `
          <td>${sanitize(inv.email)}</td>
          <td><span class="admin-role-badge role-${sanitize(inv.role)}" style="display:inline-block;">${roleDisplay}</span></td>
          <td>${invitedDate}</td>
          <td>
            <button
              class="reject-btn"
              onclick="revokeInvitation('${inv.id}')">
              Revoke
            </button>
          </td>
        `;
        invitesTable.appendChild(tr);
      });
    }

    // Load the permanent staff activity audit log
    async function loadStaffAuditLog() {
      const auditTable = document.getElementById("staffAuditLogTable");
      if (!auditTable) return;

      let entries, error;
      try {
        const result = await supabase
          .from("admin_audit_log")
          .select("id, actor_email, action, target_email, role, details, created_at")
          .order("created_at", { ascending: false });
        entries = result.data;
        error = result.error;
      } catch (thrownErr) {
        // Surfaces the exact JS error on the page itself, so this never
        // hangs on "Loading…" again without telling us why.
        console.error("Staff audit log threw:", thrownErr);
        auditTable.innerHTML = `<tr><td colspan="6">Error: ${sanitize(thrownErr.message || String(thrownErr))}</td></tr>`;
        return;
      }

      if (error) {
        console.error("Staff audit log query error:", error);
        auditTable.innerHTML = `<tr><td colspan="6">Failed to load audit log: ${sanitize(error.message)}</td></tr>`;
        return;
      }

      if (!entries || !entries.length) {
        auditTable.innerHTML = `<tr><td colspan="6">No staff activity recorded yet.</td></tr>`;
        return;
      }

      allStaffAuditEntries = entries;
      renderStaffAuditLog(entries);

      const searchInput = document.getElementById("staffAuditSearch");
      const actionFilter = document.getElementById("staffAuditFilter");

      function applyFilters() {
        const searchTerm = (searchInput?.value || "").toLowerCase().trim();
        const actionValue = actionFilter?.value || "all";

        const filtered = allStaffAuditEntries.filter(e => {
          const emailMatch =
            (e.target_email || "").toLowerCase().includes(searchTerm) ||
            (e.actor_email || "").toLowerCase().includes(searchTerm);
          const actionMatch = actionValue === "all" || e.action === actionValue;
          return emailMatch && actionMatch;
        });

        renderStaffAuditLog(filtered);
      }

      if (searchInput) searchInput.addEventListener("input", applyFilters);
      if (actionFilter) actionFilter.addEventListener("change", applyFilters);
    }

    // Assign a role to a user by email
    const assignBtn = document.getElementById("assignAdminBtn");
    if (assignBtn) {
      assignBtn.addEventListener("click", async () => {
        const email = document.getElementById("assignAdminEmail").value.trim();
        const role  = document.getElementById("assignAdminRole").value;

        if (!email || !role) {
          alert("Please enter an email address and select a role.");
          return;
        }

        assignBtn.disabled = true;
        assignBtn.textContent = "Assigning...";

        // Look up the user by email in auth
        // We use the admin API via the edge function pattern.
        // Since we cannot query auth.users directly from the browser,
        // we check if the user exists by trying to find them in vendors
        // or user_roles first.
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("role", "vendor")
          .limit(100);

        // Find user by checking vendors table for the email
        const { data: vendorMatch } = await supabase
          .from("vendors")
          .select("auth_user_id, email")
          .eq("email", email)
          .maybeSingle();

        if (!vendorMatch?.auth_user_id) {

          // Not a vendor. Check whether this email already belongs to
          // an ACTIVE admin — if so, update their role directly rather
          // than creating an invitation they'll never see (an existing
          // admin's login never re-checks invitations, since they
          // already have a real role on file).
          const { data: existingStaff } = await supabase.rpc("get_admin_staff_list");

          const matchedStaff = existingStaff?.find(
            s => s.email?.toLowerCase() === email.toLowerCase()
          );

          if (matchedStaff) {

            const { error: updateRoleError } = await supabase
              .from("user_roles")
              .update({ role: role })
              .eq("user_id", matchedStaff.user_id);

            if (updateRoleError) {
              alert("Failed to update role: " + updateRoleError.message);
              assignBtn.disabled = false;
              assignBtn.textContent = "Assign Role";
              return;
            }

            await logAdminAudit("assigned_role", email, role, "Role changed directly (was already an active admin).");

            alert(`\u2713 Role updated!\n\n${email} is now a ${roleLabels[role]}.\n\nThis takes effect immediately — no need to log out or back in.`);

            document.getElementById("assignAdminEmail").value = "";
            document.getElementById("assignAdminRole").value = "";
            assignBtn.disabled = false;
            assignBtn.textContent = "Assign Role";

            loadAdminStaff();
            loadStaffAuditLog();

            return;
          }

          // No existing account found. Instead of failing, create an
          // invitation — the person signs up at admin-signup.html and
          // their role is applied automatically the first time they log in.
          const { error: inviteError } = await supabase
            .from("admin_invitations")
            .upsert({
              email: email,
              role: role,
              invited_by: adminSession.user_id,
              used: false,
              used_at: null
            }, { onConflict: "email" });

          if (inviteError) {
            alert("Failed to create invitation: " + inviteError.message);
            assignBtn.disabled = false;
            assignBtn.textContent = "Assign Role";
            return;
          }

          try {
            await sendEmail({
              to: email,
              subject: "You've Been Invited to Spotlight Admin",
              html: EmailTemplates.adminInvitation({
                role: role,
                signupLink: "https://spotlightdirectories.com/admin/admin-signup.html"
              })
            });
          } catch (emailErr) {
            console.error("Admin invitation email failed:", emailErr);
          }

          await logAdminAudit("invited", email, role);

          alert(`\u2713 Invitation created and email sent!\n\n${email} has been invited as a ${roleLabels[role]} and notified by email with a signup link.\n\nTheir role is applied automatically the first time they log in \u2014 no further action needed from you.`);

          document.getElementById("assignAdminEmail").value = "";
          document.getElementById("assignAdminRole").value = "";
          assignBtn.disabled = false;
          assignBtn.textContent = "Assign Role";

          loadPendingInvitations();
          loadStaffAuditLog();

          return;
        }

        const targetUserId = vendorMatch.auth_user_id;

        // Upsert the role
        const { error: upsertError } = await supabase
          .from("user_roles")
          .upsert({
            user_id: targetUserId,
            role: role,
            assigned_by: adminSession.user_id,
            created_at: new Date().toISOString()
          }, { onConflict: "user_id" });

        if (upsertError) {
          alert("Failed to assign role: " + upsertError.message);
          assignBtn.disabled = false;
          assignBtn.textContent = "Assign Role";
          return;
        }

        await logAdminAudit("assigned_role", email, role);

        alert(`✓ Role assigned successfully!\n\n${email} is now a ${roleLabels[role]}.\n\nThey can log in at the admin login page with their existing account credentials.`);

        document.getElementById("assignAdminEmail").value = "";
        document.getElementById("assignAdminRole").value = "";
        assignBtn.disabled = false;
        assignBtn.textContent = "Assign Role";

        loadAdminStaff();
        loadStaffAuditLog();
      });
    }
  }

// -----------------------------
// LOAD PAYMENTS
// -----------------------------
const { data: payments, error } = await supabase
  .from("vendor_payments")
  .select(`
    id,
    plan,
    billing_type,
    status,
    transfer_proof_url,
    vendors ( id, name, email )
  `)
  .eq("payment_method", "bank")
  .eq("status", "pending");

if (error) {
  table.innerHTML = `<tr><td colspan="6" class="empty-state-cell">${error.message}</td></tr>`;
} else if (!payments.length) {
  table.innerHTML = `<tr><td colspan="6" class="empty-state-cell">✓ All caught up — no pending payments.</td></tr>`;
} else {
  table.innerHTML = "";

  payments.forEach(p => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${sanitize(p.vendors?.name)}</td>
      <td>${sanitize(p.plan)}</td>
      <td>${sanitize(p.billing_type)}</td>
      <td>
        ${
          p.transfer_proof_url
            ? `<a href="#" onclick="viewSignedUrl('payment-receipts','${sanitize(p.transfer_proof_url)}');return false;">View</a>`
            : "—"
        }
      </td>
      <td>${sanitize(p.status)}</td>
      <td>
        <button class="approve-btn" data-approve="${sanitize(p.id)}">Approve</button>
        <button class="reject-btn" data-reject="${sanitize(p.id)}">Reject</button>
      </td>
    `;

    table.appendChild(tr);
  });
}
// -----------------------------
// LOAD PENDING SPONSORSHIPS
// -----------------------------
const sponsorshipsTable = document.getElementById("sponsorshipsTable");

if (sponsorshipsTable) {

  const { data: sponsorships, error: sponsorshipsError } = await supabase
    .from("vendor_sponsorships")
    .select(`
      id,
      batch_id,
      sponsorship_type,
      tier,
      billing_cycle,
      amount_paid,
      receipt_url,
      payment_status,
      vendors ( id, name, email )
    `)
    .eq("payment_method", "bank_transfer")
    .eq("payment_status", "pending");

  if (sponsorshipsError) {
    sponsorshipsTable.innerHTML = `<tr><td colspan="7" class="empty-state-cell">${sponsorshipsError.message}</td></tr>`;
  } else if (!sponsorships.length) {
    sponsorshipsTable.innerHTML = `<tr><td colspan="7" class="empty-state-cell">✓ All caught up — no pending sponsorships.</td></tr>`;
  } else {
    sponsorshipsTable.innerHTML = "";

    sponsorships.forEach(s => {

      const tr = document.createElement("tr");
      if (s.batch_id) tr.dataset.batchId = s.batch_id;

      tr.innerHTML = `
        <td>${sanitize(s.vendors?.name)}</td>
        <td>${sanitize(s.sponsorship_type)}</td>
        <td>${sanitize(s.tier)}</td>
        <td>${sanitize(s.billing_cycle)}</td>
        <td>₦${Number(s.amount_paid).toLocaleString()}</td>
        <td>
          ${
            s.receipt_url
              ? `<a href="#" onclick="viewSignedUrl('sponsorship-receipts','${sanitize(s.receipt_url)}');return false;">View</a>`
              : "—"
          }
        </td>
        <td>
          <button class="approve-btn" data-sponsor-approve="${sanitize(s.id)}">Approve</button>
          <button class="reject-btn" data-sponsor-reject="${sanitize(s.id)}">Reject</button>
          <button class="reject-btn" style="background:#64748b;" data-sponsor-delete="${sanitize(s.id)}">Delete</button>
        </td>
      `;

      sponsorshipsTable.appendChild(tr);
    });
  }

}

  // -----------------------------
// LOAD BADGE VERIFICATIONS
// -----------------------------
const { data: verifications, error: verificationError } = await window.supabaseClient
  .from("vendor_verifications")
  .select(`
    id,
    badge_type,
    status,
    created_at,
    id_url,
    passport_photo_url,
    cac_url,
    utility_url,
    memart_url,
    status_report_url,
    vendor:vendors ( name )  
  `)
  
    .eq("status", "pending");

if (verificationError) {
  verificationTable.innerHTML = `<tr><td colspan="6" class="empty-state-cell">${verificationError.message}</td></tr>`;
} else if (!verifications.length) {
  verificationTable.innerHTML = `<tr><td colspan="6" class="empty-state-cell">✓ All caught up — no pending verifications.</td></tr>`;
} else {
  verificationTable.innerHTML = "";

  verifications.forEach(v => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${sanitize(v.vendor?.name)}</td>
      <td>${sanitize(v.badge_type)}</td>
      <td>${new Date(v.created_at).toLocaleDateString()}</td>
      <td>
        <a href="#" onclick="viewSignedUrl('vendor-verifications','${v.id_url}');return false;">ID</a> |
        ${v.passport_photo_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.passport_photo_url}');return false;">Passport</a> |` : ""}
        ${v.cac_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.cac_url}');return false;">CAC</a> |` : ""}
        ${v.utility_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.utility_url}');return false;">Utility</a> |` : ""}
        ${v.memart_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.memart_url}');return false;">MEMART</a> |` : ""}
        ${v.status_report_url ? `<a href="#" onclick="viewSignedUrl('vendor-verifications','${v.status_report_url}');return false;">Status Report</a>` : ""}
      </td>
      <td>${sanitize(v.status)}</td>
      <td>
        <button class="approve-btn" data-verify-approve="${sanitize(v.id)}">Approve</button>
        <button class="reject-btn" data-verify-reject="${sanitize(v.id)}">Reject</button>
        <button class="reject-btn" style="background:#64748b;" data-verify-delete="${sanitize(v.id)}">Delete</button>
      </td>
    `;

    verificationTable.appendChild(tr);
  });
}

// -----------------------------
// LOAD PENDING PARTNERS
// -----------------------------
const { data: partners, error: partnersError } = await supabase
  .from("partners")
  .select("id, name, phone, state, local_government, status")
  .eq("status", "pending");

if (partnersError) {
  partnersTable.innerHTML = `<tr><td colspan="6" class="empty-state-cell">${partnersError.message}</td></tr>`;
} else if (!partners.length) {
  partnersTable.innerHTML = `<tr><td colspan="6" class="empty-state-cell">✓ All caught up — no pending partner applications.</td></tr>`;
} else {
  partnersTable.innerHTML = "";

  partners.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${sanitize(p.name)}</td>
      <td>${sanitize(p.phone)}</td>
      <td>${sanitize(p.state)}</td>
      <td>${sanitize(p.local_government)}</td>
      <td>${sanitize(p.status)}</td>
      <td>
        <button class="approve-btn" data-partner-approve="${sanitize(p.id)}">Approve</button>
        <button class="reject-btn" data-partner-reject="${sanitize(p.id)}">Reject</button>
      </td>
    `;

    partnersTable.appendChild(tr);
  });
}

// -----------------------------
// LOAD ALL COMMISSIONS
// -----------------------------
const { data: commissions, error: commissionsError } = await supabase
  .from("commissions")
  .select(`
  amount,
  status,
  created_at,
  partners ( id, name, referral_code, status ),
  vendors ( name ),
  vendor_payments ( plan )
`)
  .order("created_at", { ascending: false });

if (commissionsError) {
  commissionsTable.innerHTML = `<tr><td colspan="8">${commissionsError.message}</td></tr>`;
} else if (!commissions.length) {
  commissionsTable.innerHTML = `<tr><td colspan="8" class="empty-state-cell">✓ No commissions recorded yet. They will appear automatically when referred vendors make payments.</td></tr>`;
  summaryTable.innerHTML = `<tr><td colspan="6" class="empty-state-cell">✓ No commission summary yet.</td></tr>`;
} else {
  commissionsTable.innerHTML = "";

  commissions.forEach(c => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${sanitize(c.partners?.name)}</td>
      <td>${sanitize(c.partners?.referral_code)}</td>
      <td>${sanitize(c.vendors?.name)}</td>
      <td>${sanitize(c.vendor_payments?.plan)}</td>
      <td>₦${(Number(c.amount) / 100).toLocaleString()}</td>
      <td><span class="status-badge status-${sanitize(c.status)}">${sanitize(c.status)}</span></td>
      <td>${sanitize(c.partners?.status)}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
    `;

    commissionsTable.appendChild(tr);
  });

// ==============================
// COMMISSION SUMMARY (PER PARTNER)
// ==============================
const summaryMap = {};

commissions.forEach(c => {
  const partnerId = c.partners?.id || "unknown";

  if (!summaryMap[partnerId]) {
    summaryMap[partnerId] = {
      id: c.partners?.id,
      name: c.partners?.name || "—",
      code: c.partners?.referral_code || "—",
      pending: 0,
      available: 0,
      paid: 0
    };
  }

  const amount = Number(c.amount) / 100;

  if (c.status === "pending") summaryMap[partnerId].pending += amount;
  if (c.status === "available") summaryMap[partnerId].available += amount;
  if (c.status === "paid") summaryMap[partnerId].paid += amount;
});

if (!summaryTable) {
  console.error("Summary table not found");
  return;
}
summaryTable.innerHTML = "";

Object.values(summaryMap).forEach(p => {
  const tr = document.createElement("tr");

  tr.innerHTML = `
  <td>${sanitize(p.name)}</td>
  <td>${sanitize(p.code)}</td>
  <td>₦${Math.round(p.pending).toLocaleString()}</td>
  <td>₦${Math.round(p.available).toLocaleString()}</td>
  <td>₦${Math.round(p.paid).toLocaleString()}</td>
  <td>
    ${
      p.available > 0
        ? `<button class="approve-btn" data-pay="${sanitize(p.id)}">Pay</button>`
        : "-"
    }
  </td>
`;

  summaryTable.appendChild(tr);
});

// Wire up commission search and filter
initCommissionSearch(commissions);

}

  document.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");

  if (e.target.matches("[data-approve]")) {
    await approvePayment(e.target.dataset.approve, row);
  }

  if (e.target.matches("[data-reject]")) {
    await rejectPayment(e.target.dataset.reject, row);
  }

  if (e.target.matches("[data-sponsor-approve]")) {
    await approveSponsorship(e.target.dataset.sponsorApprove, row);
  }

  if (e.target.matches("[data-sponsor-reject]")) {
    await rejectSponsorship(e.target.dataset.sponsorReject, row);
  }

  if (e.target.matches("[data-sponsor-delete]")) {
    await deleteSponsorship(e.target.dataset.sponsorDelete, row);
  }

  if (e.target.matches("[data-revoke]")) {
    await revokeVerification(e.target.dataset.revoke, e.target.closest("tr"));
  }

  if (e.target.matches("[data-verify-approve]")) {
    await approveVerification(e.target.dataset.verifyApprove, row);
  }

  if (e.target.matches("[data-verify-reject]")) {
    await rejectVerification(e.target.dataset.verifyReject, row);
  }

  if (e.target.matches("[data-verify-delete]")) {
    await deleteVerification(e.target.dataset.verifyDelete, row);
  }

  if (e.target.matches("[data-partner-approve]")) {
    await approvePartner(e.target.dataset.partnerApprove, row);
  }

  if (e.target.matches("[data-partner-reject]")) {
    await rejectPartner(e.target.dataset.partnerReject, row);
  }

  if (e.target.matches("[data-pay]")) {
    await payPartner(e.target.dataset.pay);
  }

  });

  // -----------------------------
// APPROVE SPONSORSHIP (bank transfer)
// Acts on the WHOLE batch (every row from the same checkout), not
// just the row clicked — so a single payment covering several items
// is approved or rejected as one atomic decision, never left partly
// approved and partly pending.
// -----------------------------
async function approveSponsorship(sponsorshipId, row) {

  if (!confirm("Approve this sponsorship? If it was part of a bundle purchase, every item in that same purchase will be approved together.")) return;

  const approveBtn = document.querySelector(`[data-sponsor-approve="${sponsorshipId}"]`);
  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.textContent = "Processing...";
  }

  const { data: sponsorship, error } = await supabase
    .from("vendor_sponsorships")
    .select(`
      id, vendor_id, batch_id, sponsorship_type, tier, billing_cycle, payment_status,
      vendors ( email, name )
    `)
    .eq("id", sponsorshipId)
    .single();

  if (error || !sponsorship) {
    alert("Sponsorship not found.");
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.textContent = "Approve";
    }
    return;
  }

  if (sponsorship.payment_status !== "pending") {
    alert("This sponsorship is already processed.");
    return;
  }

  const now = new Date();

  const expiry =
    sponsorship.billing_cycle === "monthly"
      ? new Date(new Date(now).setDate(now.getDate() + 30))
      : new Date(new Date(now).setDate(now.getDate() + 365));

  // Find every sibling row from the same purchase (same batch_id) so
  // the whole bundle moves together. Legacy rows with no batch_id
  // (created before this existed) just act on themselves.
  const batchQuery = supabase
    .from("vendor_sponsorships")
    .update({
      payment_status: "active",
      starts_at: now.toISOString(),
      expires_at: expiry.toISOString()
    })
    .eq("payment_status", "pending");

  const { error: updateError } = sponsorship.batch_id
    ? await batchQuery.eq("batch_id", sponsorship.batch_id)
    : await batchQuery.eq("id", sponsorshipId);

  if (updateError) {
    console.error("Sponsorship update failed:", updateError);
    alert("Failed to update sponsorship record.");
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.textContent = "Approve";
    }
    return;
  }

  const typeLabel =
    sponsorship.sponsorship_type === "business" ? "your business"
    : sponsorship.sponsorship_type === "product" ? "your product(s)"
    : "your service(s)";

  try {
    await sendEmail({
      to: sponsorship.vendors.email,
      subject: "Sponsorship Approved 🎉",
      html: `<p>Hi ${sanitize(sponsorship.vendors?.name) || ""},</p>
             <p>Your <strong>${sanitize(sponsorship.tier)}</strong> sponsorship for ${typeLabel} has been approved and is now active.</p>
             <p>It will run until ${expiry.toDateString()}.</p>`
    });
  } catch (err) {
    console.error("Sponsorship approval email failed:", err);
  }

  alert("Sponsorship approved");

  // Remove every row from this batch from the visible table, not just
  // the one clicked, since they're all now approved together.
  if (sponsorship.batch_id) {
    document.querySelectorAll(`[data-sponsor-approve]`).forEach(btn => {
      const btnRow = btn.closest("tr");
      if (btnRow && btnRow.dataset.batchId === sponsorship.batch_id) btnRow.remove();
    });
  }
  if (row) row.remove();
}

// -----------------------------
// REJECT SPONSORSHIP (bank transfer)
// Same batch-wide behavior as approval, above.
// -----------------------------
async function rejectSponsorship(sponsorshipId, row) {

  const reason = prompt("Reason for rejection? If this was part of a bundle purchase, every item in that same purchase will be rejected together.");
  if (!reason) return;

  const rejectBtn = document.querySelector(`[data-sponsor-reject="${sponsorshipId}"]`);
  if (rejectBtn) {
    rejectBtn.disabled = true;
    rejectBtn.textContent = "Processing...";
  }

  const { data: sponsorship, error } = await supabase
    .from("vendor_sponsorships")
    .select(`
      id, vendor_id, batch_id, sponsorship_type, tier, payment_status,
      vendors ( email, name )
    `)
    .eq("id", sponsorshipId)
    .single();

  if (error || !sponsorship) {
    alert("Sponsorship not found.");
    if (rejectBtn) {
      rejectBtn.disabled = false;
      rejectBtn.textContent = "Reject";
    }
    return;
  }

  if (sponsorship.payment_status !== "pending") {
    alert("This sponsorship is already processed.");
    return;
  }

  const batchQuery = supabase
    .from("vendor_sponsorships")
    .update({ payment_status: "rejected" })
    .eq("payment_status", "pending");

  const { error: updateError } = sponsorship.batch_id
    ? await batchQuery.eq("batch_id", sponsorship.batch_id)
    : await batchQuery.eq("id", sponsorshipId);

  if (updateError) {
    console.error("Sponsorship rejection failed:", updateError);
    alert("Failed to update sponsorship record.");
    if (rejectBtn) {
      rejectBtn.disabled = false;
      rejectBtn.textContent = "Reject";
    }
    return;
  }

  try {
    await sendEmail({
      to: sponsorship.vendors.email,
      subject: "Sponsorship Payment Could Not Be Verified",
      html: `<p>Hi ${sanitize(sponsorship.vendors?.name) || ""},</p>
             <p>We were unable to verify your sponsorship payment.</p>
             <p><strong>Reason:</strong> ${sanitize(reason)}</p>`
    });
  } catch (err) {
    console.error("Sponsorship rejection email failed:", err);
  }

  alert("Sponsorship rejected");

  if (sponsorship.batch_id) {
    document.querySelectorAll(`[data-sponsor-reject]`).forEach(btn => {
      const btnRow = btn.closest("tr");
      if (btnRow && btnRow.dataset.batchId === sponsorship.batch_id) btnRow.remove();
    });
  }
  if (row) row.remove();
}

// -----------------------------
// DELETE SPONSORSHIP (admin cleanup — e.g. test/orphan rows)
// Only removes the ONE row clicked, not the whole batch — deletion
// is meant for cleaning up individual stray test data, not for
// undoing a real bundle purchase (use Reject for that).
// -----------------------------
async function deleteSponsorship(sponsorshipId, row) {

  if (!confirm("Delete this sponsorship record? This cannot be undone. Only this one row will be removed, not any related items from the same purchase.")) return;

  const deleteBtn = document.querySelector(`[data-sponsor-delete="${sponsorshipId}"]`);
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
  }

  const { error } = await supabase
    .from("vendor_sponsorships")
    .delete()
    .eq("id", sponsorshipId);

  if (error) {
    alert("Failed to delete: " + error.message);
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
    }
    return;
  }

  alert("Sponsorship record deleted");
  if (row) row.remove();
}

// -----------------------------
// APPROVE
// -----------------------------
    async function approvePayment(paymentId, row) {

     if (!confirm("Approve this payment?")) return;

     const approveBtn = document.querySelector(`[data-approve="${paymentId}"]`);
     if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.textContent = "Processing...";
    }

  const { data: payment, error } = await supabase
    .from("vendor_payments")
    .select(`
      id,
      vendor_id,
      plan,
      billing_type,
      status,
      vendors ( id, email )
    `)
    .eq("id", paymentId)
    .single();

    if (error || !payment) {
      alert("Payment not found.");
      if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.textContent = "Approve";
     }
     return;
  }

  if (payment.status !== "pending") {
  alert("This payment is already processed.");
  return;
 }

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  const { error: updateError } = await supabase
  .from("vendor_payments")
  .update({
    status: "confirmed",
    reviewed_at: now,
    approved_at: now,
    rejected_at: null,
    rejection_reason: null,
    reviewed_by: adminSession.user_id
  })
  .eq("id", paymentId);

if (updateError) {
  console.error("VendorPayment update failed:", updateError);
  alert("Failed to update payment record.");
  return;
}

  // 2️⃣ Activate vendor
  const expiry =
    payment.billing_type === "monthly"
      ? new Date(new Date(now).setMonth(new Date(now).getMonth() + 1))
      : new Date(new Date(now).setFullYear(new Date(now).getFullYear() + 1));

  // Generate a SPOT ID for paid vendors (carried over from verify-payments.js)
  // P = Paid vendor type
  let spotId = null;
  try {
    const { data: generatedSpotId } = await supabase.rpc(
      "generate_spot_id",
      { vendor_type: "P" }
    );
    spotId = generatedSpotId;
  } catch (err) {
    console.error("SPOT ID generation failed:", err);
    // Non-fatal — proceed with activation even if SPOT ID fails
  }

  const vendorUpdate = {
    subscription_status: "active",
    plan_tier: payment.plan,
    billing_cycle: payment.billing_type,
    is_premium: true,
    paid_at: now,
    expires_at: expiry.toISOString()
  };

  // Only set spot_id if one was generated
  if (spotId) vendorUpdate.spot_id = spotId;

  await supabase
    .from("vendors")
    .update(vendorUpdate)
    .eq("id", payment.vendor_id);

  // Fetch confirmed SPOT ID from vendor record after update
  const { data: updatedVendor } = await supabase
    .from("vendors")
    .select("spot_id, name")
    .eq("id", payment.vendor_id)
    .single();

  const confirmedSpotId = updatedVendor?.spot_id || spotId || "";
  const confirmedVendorName = updatedVendor?.name || payment.vendors?.name || "";

  // 3️⃣ Send email — after vendor update so SPOT ID is confirmed
  try {
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Approved — Your Spotlight Listing is Active",
    html: EmailTemplates.paymentApproved({
      vendorName: confirmedVendorName,
      plan: payment.plan || "",
      billingType: payment.billing_type || "",
      spotId: confirmedSpotId,
      expiresAt: expiry.toISOString()
    })
  });
} catch (err) {
  console.error("Email failed:", err);
}

  await supabase
  .from("vendor_payments")
  .update({ notification_sent: true })
  .eq("id", paymentId);

  alert("Payment approved");

   if (row) row.remove();
  }

  // -----------------------------
  // REJECT
  // -----------------------------
  async function rejectPayment(paymentId, row) {
    const reason = prompt("Reason for rejection?");
  
    if (!reason) return;

  const rejectBtn = document.querySelector(`[data-reject="${paymentId}"]`);
   if (rejectBtn) {
     rejectBtn.disabled = true;
     rejectBtn.textContent = "Processing...";
   }

  const { data: payment, error } = await supabase
    .from("vendor_payments")
    .select(`
      id,
      vendor_id,
      status,
      vendors ( email, name )
    `)
    .eq("id", paymentId)
    .single();

    if (error || !payment) {
      alert("Payment not found.");
      if (rejectBtn) {
        rejectBtn.disabled = false;
        rejectBtn.textContent = "Reject";
     }
     return;
   }

  if (payment.status !== "pending") {
  alert("This payment is rejected.");
  return;
}

  const now = new Date().toISOString();

  // 1️⃣ Update vendorpayment
  const { data: updatedRow, error: updateError } = await supabase
  .from("vendor_payments")
  .update({
  status: "rejected",
  reviewed_at: now,
  approved_at: null,
  rejected_at: now,
  rejection_reason: reason,
  reviewed_by: adminSession.user_id
})
.eq("id", paymentId);

if (updateError) {
  console.error("VendorPayment update failed:", updateError);
  alert("Failed to update payment record.");
  if (rejectBtn) {
    rejectBtn.disabled = false;
    rejectBtn.textContent = "Reject";
  }
  return;
}

  // 2️⃣ Update vendor
  await supabase
    .from("vendors")
    .update({
      subscription_status: "failed"
    })
    .eq("id", payment.vendor_id);

  // 3️⃣ Send email
  await sendEmail({
    to: payment.vendors.email,
    subject: "Payment Could Not Be Verified",
    html: EmailTemplates.paymentRejected({
      vendorName: payment.vendors?.name || "",
      reason: reason
    })
  });

  await supabase
  .from("vendor_payments")
  .update({ notification_sent: true })
  .eq("id", paymentId);

  alert("Payment rejected");

  if (row) row.remove();
  
}

// -----------------------------
// APPROVE BADGE VERIFICATION
// -----------------------------
async function approveVerification(verificationId, row) {

  if (!confirm("Approve this badge verification?")) return;

  const approveBtn = document.querySelector(`[data-verify-approve="${verificationId}"]`);
  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.textContent = "Processing...";
  }

  const now = new Date().toISOString();

  const { data: verification } = await supabase
    .from("vendor_verifications")
    .select("vendor_id, badge_type, status")
    .eq("id", verificationId)
    .single();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("email, name")
    .eq("id", verification.vendor_id)
    .single();

   if (!verification) {
     alert("Verification not found.");
      return;
  }

   if (verification.status === "rejected") {
     alert("This verification is already rejected.");
     if (row) row.remove();
     return;
  }

   if (verification.status === "approved") {
     alert("This verification is already approved.");
     if (row) row.remove();
     return;
  }

  const { error: verUpdateError } = await supabase
    .from("vendor_verifications")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewed_by: adminSession.user_id
    })
    .eq("id", verificationId);

  if (verUpdateError) {
    console.error("Verification update failed:", verUpdateError);
    alert("Failed to update verification: " + verUpdateError.message);
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.textContent = "Approve";
    }
    return;
  }

  await supabase
    .from("vendors")
    .update({
      verification_status: verification.badge_type
    })
    .eq("id", verification.vendor_id);

    try {
      await sendEmail({
        to: vendor.email,
        subject: "Verification Approved — Your Badge is Live",
        html: EmailTemplates.badgeApproved({
          vendorName: vendor?.name || "",
          badgeType: verification.badge_type || ""
        })
     });
   } catch (err) {
     console.error("Verification email failed:", err);
   }

   alert("Verification approved");

  if (row) row.remove();
}

// -----------------------------
// REJECT BADGE VERIFICATION
// -----------------------------
async function rejectVerification(verificationId, row) {

  const reason = prompt("Reason for rejection?");
  if (!reason) return;

  const rejectBtn = document.querySelector(`[data-verify-reject="${verificationId}"]`);
  if (rejectBtn) {
    rejectBtn.disabled = true;
    rejectBtn.textContent = "Processing...";
  }

  const { data: verification } = await supabase
    .from("vendor_verifications")
    .select("vendor_id, badge_type, status")
    .eq("id", verificationId)
    .single();

  if (!verification) {
    alert("Verification not found.");
    return;
  }

  if (verification.status === "rejected") {
    alert("This verification is already rejected.");
    if (row) row.remove();
    return;
  }

  if (verification.status === "approved") {
    alert("This verification is already approved.");
    if (row) row.remove();
    return;
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("email, name")
    .eq("id", verification.vendor_id)
    .single();

  const now = new Date().toISOString();

  await supabase
    .from("vendor_verifications")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: adminSession.user_id
    })
    .eq("id", verificationId);

  try {
    await sendEmail({
      to: vendor.email,
      subject: "Verification Not Approved",
      html: EmailTemplates.badgeRejected({
        vendorName: vendor?.name || "",
        badgeType: verification.badge_type || "",
        reason: reason
      })
    });
  } catch (err) {
    console.error("Verification rejection email failed:", err);
  }

  alert("Verification rejected");

  if (row) row.remove();
}

// -----------------------------
// DELETE BADGE VERIFICATION (Admin cleanup)
// -----------------------------
async function deleteVerification(verificationId, row) {

  if (!confirm("Delete this verification submission? This cannot be undone.")) return;

  const deleteBtn = document.querySelector(`[data-verify-delete="${verificationId}"]`);
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
  }

  const { error } = await supabase
    .from("vendor_verifications")
    .delete()
    .eq("id", verificationId);

  if (error) {
    alert("Failed to delete: " + error.message);
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
    }
    return;
  }

  alert("Verification deleted");
  if (row) row.remove();
}

// -----------------------------
// REVOKE BADGE (super_admin only)
// -----------------------------
async function revokeVerification(verificationId, row) {

  if (currentRole !== "super_admin") {
    alert("Only Super Admin can revoke badges.");
    return;
  }

  const reason = prompt("Reason for revoking this badge? This will be sent to the vendor.");
  if (!reason) return;

  const revokeBtn = document.querySelector(`[data-revoke="${verificationId}"]`);
  if (revokeBtn) {
    revokeBtn.disabled = true;
    revokeBtn.textContent = "Revoking...";
  }

  // Get verification details
  const { data: verification, error: fetchError } = await supabase
    .from("vendor_verifications")
    .select("vendor_id, badge_type")
    .eq("id", verificationId)
    .single();

  if (fetchError || !verification) {
    alert("Verification not found.");
    if (revokeBtn) {
      revokeBtn.disabled = false;
      revokeBtn.textContent = "Revoke";
    }
    return;
  }

  // Get vendor details
  const { data: vendor } = await supabase
    .from("vendors")
    .select("email, name")
    .eq("id", verification.vendor_id)
    .single();

  const now = new Date().toISOString();

  // Update verification record to revoked
  const { error: verError } = await supabase
    .from("vendor_verifications")
    .update({
      status: "revoked",
      reviewed_at: now,
      reviewed_by: adminSession.user_id,
      rejection_reason: reason
    })
    .eq("id", verificationId);

  if (verError) {
    alert("Failed to revoke verification: " + verError.message);
    if (revokeBtn) {
      revokeBtn.disabled = false;
      revokeBtn.textContent = "Revoke";
    }
    return;
  }

  // Remove badge from vendor profile
  const { error: vendorError } = await supabase
    .from("vendors")
    .update({ verification_status: null })
    .eq("id", verification.vendor_id);

  if (vendorError) {
    alert("Badge removed from verification but vendor profile update failed: " + vendorError.message);
    return;
  }

  // Send revocation email
  try {
    await sendEmail({
      to: vendor.email,
      subject: "Your Spotlight Verification Badge Has Been Revoked",
      html: EmailTemplates.badgeRevoked({
        vendorName: vendor?.name || "",
        badgeType: verification.badge_type || "",
        reason: reason
      })
    });
  } catch (err) {
    console.error("Revocation email failed:", err);
  }

  alert("Badge revoked and vendor notified");
  if (row) row.remove();
}

// -----------------------------
// APPROVE PARTNER
// -----------------------------
async function approvePartner(partnerId, row) {

  if (!confirm("Approve this partner?")) return;

  const approveBtn = document.querySelector(`[data-partner-approve="${partnerId}"]`);
  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.textContent = "Processing...";
  }

  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, name, email, status")
    .eq("id", partnerId)
    .single();

  if (error || !partner) {
    alert("Partner not found.");
    return;
  }

  if (partner.status === "approved") {
    alert("This partner is already approved.");
    return;
  }

  // 1️⃣ Generate referral code
  const referralCode =
    "SPOT" +
    Math.random().toString(36).substring(2, 8).toUpperCase();

// 2️⃣ Update partner
const { data: updateData, error: updateError } = await supabase
  .from("partners")
  .update({
    status: "approved",
    referral_code: referralCode,
  })
  .eq("id", partnerId)
  .select();

if (updateError) {
  alert("Failed to approve partner: " + updateError.message);
  return;
}

  // 3️⃣ Send email
  const vendorReferralLink = `https://spotlightdirectories.com/getlisted.html?ref=${referralCode}`;
  const partnerReferralLink = `https://spotlightdirectories.com/partner-program.html?ref=${referralCode}`;

  if (!partner.email) {
  alert("Partner has no email. Cannot send approval email.");
  return;
}

await sendEmail({
  to: partner.email,
  subject: "You're Approved — Welcome to the Spotlight Partner Programme",
  html: EmailTemplates.partnerApproved({
    partnerName: partner.name || "",
    referralCode: referralCode,
    vendorReferralLink: vendorReferralLink,
    partnerReferralLink: partnerReferralLink,
    inductionLink: "https://spotlightdirectories.com/partner-legal.html#assets",
    createAccountLink: `https://spotlightdirectories.com/partner-create-account.html?partner_id=${partner.id}`
  })
});

  // 4️⃣ Mark notification sent
  await supabase
    .from("partners")
    .update({ notification_sent: true })
    .eq("id", partnerId);

  alert("Partner approved and email sent");

  if (row) row.remove();
}

// -----------------------------
// REJECT PARTNER
// -----------------------------
async function rejectPartner(partnerId, row) {

  const reason = prompt("Reason for rejection?");
  if (!reason) return;

  const rejectBtn = document.querySelector(`[data-partner-reject="${partnerId}"]`);
  if (rejectBtn) {
    rejectBtn.disabled = true;
    rejectBtn.textContent = "Processing...";
  }

  const { data: partner, error } = await supabase
    .from("partners")
    .select("id, name, email, status")
    .eq("id", partnerId)
    .single();

  if (error || !partner) {
    alert("Partner not found.");
    return;
  }

  if (partner.status === "rejected") {
    alert("This partner is already rejected.");
    return;
  }

  // 1️⃣ Update status
  const { error: updateError } = await supabase
    .from("partners")
    .update({
      status: "rejected"
    })
    .eq("id", partnerId);

  if (updateError) {
    alert("Failed to reject partner.");
    return;
  }

  // 2️⃣ Send email
  await sendEmail({
    to: partner.email,
    subject: "Update on Your Partner Application",
    html: EmailTemplates.partnerRejected({
      partnerName: partner.name || "",
      reason: reason
    })
  });

  // 3️⃣ Mark notification sent
  await supabase
    .from("partners")
    .update({ notification_sent: true })
    .eq("id", partnerId);

  alert("Partner rejected and email sent");

  if (row) row.remove();
}

// -----------------------------
// PAY PARTNER (MARK COMMISSIONS AS PAID)
// -----------------------------
async function payPartner(partnerId) {

  if (!confirm("Mark all available commissions as paid for this partner?")) return;

  const payBtn = document.querySelector(`[data-pay="${partnerId}"]`);
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = "Processing...";
  }

  const now = new Date().toISOString();

  // 1️⃣ Update commissions
  const { error } = await supabase
    .from("commissions")
    .update({
      status: "paid",
      paid_at: now
    })
    .eq("partner_id", partnerId)
    .eq("status", "available");

  if (error) {
    console.error("Payment update failed:", error);
    alert("Failed to mark commissions as paid.");
    return;
  }

  alert("Partner commissions marked as paid");

  // 2️⃣ Refresh page (simple & safe)
  location.reload();
}
  // -----------------------------
  // EMAIL (RESEND EDGE)
  // -----------------------------
   async function sendEmail(payload) {
     await fetch(
       "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email",
      {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "apikey": window.SUPABASE_ANON_KEY
       },
       body: JSON.stringify(payload)
    }
   );
 }

// -----------------------------
// STAFF ACTIVITY AUDIT LOG
// Permanent record of admin invite/assign/revoke actions.
// Never altered or deleted, even after the underlying invitation
// or account is cleaned up — this is history, not a working record.
// (Variable declarations for this section now live at the top of
// the DOMContentLoaded callback — see note there.)
// -----------------------------

function renderStaffAuditLog(entries) {
  staffAuditRenderEntries = entries;
  staffAuditExpanded = false;
  renderStaffAuditRows();
}

function renderStaffAuditRows() {
  const auditTable = document.getElementById("staffAuditLogTable");
  const seeMoreBtn = document.getElementById("staffAuditSeeMoreBtn");
  if (!auditTable) return;

  const entries = staffAuditRenderEntries;

  if (!entries.length) {
    auditTable.innerHTML = `<tr><td colspan="6">No results found.</td></tr>`;
    if (seeMoreBtn) seeMoreBtn.style.display = "none";
    return;
  }

  const visibleEntries = staffAuditExpanded ? entries : entries.slice(0, STAFF_AUDIT_PAGE_SIZE);

  auditTable.innerHTML = "";

  visibleEntries.forEach(e => {
    const tr = document.createElement("tr");
    const when = e.created_at
      ? new Date(e.created_at).toLocaleString()
      : "—";

    const actionDisplay = auditActionLabels[e.action] || e.action;

    tr.innerHTML = `
      <td>${when}</td>
      <td>${sanitize(actionDisplay)}</td>
      <td>${sanitize(e.target_email)}</td>
      <td>${sanitize(e.role)}</td>
      <td>${sanitize(e.actor_email)}</td>
      <td>${sanitize(e.details)}</td>
    `;
    auditTable.appendChild(tr);
  });

  if (seeMoreBtn) {
    const remaining = entries.length - STAFF_AUDIT_PAGE_SIZE;
    if (remaining > 0) {
      seeMoreBtn.style.display = "inline-block";
      seeMoreBtn.textContent = staffAuditExpanded
        ? "See less"
        : `See more (${remaining} older)`;
    } else {
      seeMoreBtn.style.display = "none";
    }
  }
}

// -----------------------------
// SECURITY LOG
// Renders the tamper-proof, database-trigger-driven audit_log table.
// Same collapse pattern as Staff Activity History above.
// -----------------------------
const securityLogTableLabels = {
  user_roles: "User Roles",
  admin_invitations: "Admin Invitations",
  vendor_payments: "Vendor Payments",
  vendor_sponsorships: "Vendor Sponsorships",
  commissions: "Commissions",
  vendors: "Vendors",
  "auth.users": "Accounts"
};

function renderSecurityLog(entries) {
  securityLogRenderEntries = entries;
  securityLogExpanded = false;
  renderSecurityLogRows();
}

function renderSecurityLogRows() {
  const logTable = document.getElementById("securityLogTable");
  const seeMoreBtn = document.getElementById("securityLogSeeMoreBtn");
  if (!logTable) return;

  const entries = securityLogRenderEntries;

  if (!entries.length) {
    logTable.innerHTML = `<tr><td colspan="5">No results found.</td></tr>`;
    if (seeMoreBtn) seeMoreBtn.style.display = "none";
    return;
  }

  const visibleEntries = securityLogExpanded ? entries : entries.slice(0, SECURITY_LOG_PAGE_SIZE);

  logTable.innerHTML = "";

  visibleEntries.forEach(e => {
    const tr = document.createElement("tr");
    const when = e.created_at ? new Date(e.created_at).toLocaleString() : "—";
    const tableDisplay = securityLogTableLabels[e.table_name] || e.table_name;
    const actorDisplay = e.actor_email || "System (no admin session)";

    securityLogEntriesById[e.id] = e;

    tr.innerHTML = `
      <td>${when}</td>
      <td>${sanitize(tableDisplay)}</td>
      <td>${sanitize(e.action)}</td>
      <td>${sanitize(actorDisplay)}</td>
      <td><button class="reject-btn" style="background:#64748b;padding:4px 10px;" onclick="viewAuditDetails('${e.id}')">View</button></td>
    `;
    logTable.appendChild(tr);
  });

  if (seeMoreBtn) {
    const remaining = entries.length - SECURITY_LOG_PAGE_SIZE;
    if (remaining > 0) {
      seeMoreBtn.style.display = "inline-block";
      seeMoreBtn.textContent = securityLogExpanded ? "See less" : `See more (${remaining} older)`;
    } else {
      seeMoreBtn.style.display = "none";
    }
  }
}

// -----------------------------
// PARTNER HISTORY
// Shows all approved and rejected partner applications.
// Searchable and filterable — no data lost after actioning.
// -----------------------------

let allReviewedPartners = [];

async function loadPartnerHistory() {
  const historyTable = document.getElementById("partnerHistoryTable");
  if (!historyTable) return;

  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, name, email, state, referral_code, status, created_at")
    .in("status", ["approved", "rejected"])
    .order("created_at", { ascending: false });

  if (error) {
    historyTable.innerHTML = `<tr><td colspan="6">Failed to load partner history.</td></tr>`;
    return;
  }

  if (!partners || !partners.length) {
    historyTable.innerHTML = `<tr><td colspan="6">No reviewed partner applications yet.</td></tr>`;
    return;
  }

  allReviewedPartners = partners;
  renderPartnerHistory(partners);

  const searchInput = document.getElementById("partnerHistorySearch");
  const statusFilter = document.getElementById("partnerHistoryFilter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusValue = statusFilter.value;
    const filtered = allReviewedPartners.filter(p => {
      const nameMatch = (p.name || "").toLowerCase().includes(searchTerm)
        || (p.referral_code || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || p.status === statusValue;
      return nameMatch && statusMatch;
    });
    renderPartnerHistory(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderPartnerHistory(partners) {
  const historyTable = document.getElementById("partnerHistoryTable");
  if (!historyTable) return;

  if (!partners.length) {
    historyTable.innerHTML = `<tr><td colspan="6">No results found.</td></tr>`;
    return;
  }

  historyTable.innerHTML = "";

  partners.forEach(p => {
    const tr = document.createElement("tr");
    const appliedDate = p.created_at
      ? new Date(p.created_at).toLocaleDateString()
      : "—";
    const statusClass = p.status === "approved"
      ? "status-approved"
      : "status-rejected";

    tr.innerHTML = `
      <td>${sanitize(p.name)}</td>
      <td>${sanitize(p.email)}</td>
      <td>${sanitize(p.state)}</td>
      <td>${p.referral_code
        ? `<strong>${sanitize(p.referral_code)}</strong>`
        : "—"}</td>
      <td>${appliedDate}</td>
      <td><span class="status-badge ${statusClass}">${sanitize(p.status)}</span></td>
    `;
    historyTable.appendChild(tr);
  });
}

loadPartnerHistory();

// -----------------------------
// COMMISSION SEARCH & FILTER
// Wires up the search and filter controls
// on the All Commissions table.
// -----------------------------

let allCommissionsData = [];

function initCommissionSearch(commissions) {
  allCommissionsData = commissions;

  const searchInput = document.getElementById("commissionsSearch");
  const statusFilter = document.getElementById("commissionsFilter");

  function applyFilters() {
    const searchTerm = (searchInput?.value || "").toLowerCase().trim();
    const statusValue = statusFilter?.value || "all";

    const filtered = allCommissionsData.filter(c => {
      const nameMatch =
        (c.partners?.name || "").toLowerCase().includes(searchTerm) ||
        (c.vendors?.name || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || c.status === statusValue;
      return nameMatch && statusMatch;
    });

    renderFilteredCommissions(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderFilteredCommissions(commissions) {
  const commissionsTable = document.getElementById("commissionsTable");
  if (!commissionsTable) return;

  if (!commissions.length) {
    commissionsTable.innerHTML = `<tr><td colspan="8">No results found.</td></tr>`;
    return;
  }

  commissionsTable.innerHTML = "";
  commissions.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sanitize(c.partners?.name)}</td>
      <td>${sanitize(c.partners?.referral_code)}</td>
      <td>${sanitize(c.vendors?.name)}</td>
      <td>${sanitize(c.vendor_payments?.plan)}</td>
      <td>₦${(Number(c.amount) / 100).toLocaleString()}</td>
      <td><span class="status-badge status-${sanitize(c.status)}">${sanitize(c.status)}</span></td>
      <td>${sanitize(c.partners?.status)}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
    `;
    commissionsTable.appendChild(tr);
  });
}

// -----------------------------
// PAYMENT HISTORY
// Shows all confirmed and rejected bank transfer payments.
// Admins can view receipts via signed URLs —
// no Supabase dashboard needed.
// -----------------------------

let allReviewedPayments = [];

async function loadPaymentHistory() {
  const historyTable = document.getElementById("paymentHistoryTable");
  if (!historyTable) return;

  const { data: payments, error } = await supabase
    .from("vendor_payments")
    .select(`
      id,
      plan,
      billing_type,
      amount,
      status,
      transfer_proof_url,
      reviewed_at,
      rejection_reason,
      vendors ( name )
    `)
    .eq("payment_method", "bank")
    .in("status", ["confirmed", "rejected"])
    .order("reviewed_at", { ascending: false });

  if (error) {
    historyTable.innerHTML = `<tr><td colspan="7">Failed to load payment history.</td></tr>`;
    return;
  }

  if (!payments || !payments.length) {
    historyTable.innerHTML = `<tr><td colspan="7">No reviewed payments yet.</td></tr>`;
    return;
  }

  allReviewedPayments = payments;
  renderPaymentHistory(payments);

  // Wire up search and filter
  const searchInput = document.getElementById("paymentHistorySearch");
  const statusFilter = document.getElementById("paymentHistoryFilter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusValue = statusFilter.value;
    const filtered = allReviewedPayments.filter(p => {
      const nameMatch = (p.vendors?.name || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || p.status === statusValue;
      return nameMatch && statusMatch;
    });
    renderPaymentHistory(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderPaymentHistory(payments) {
  const historyTable = document.getElementById("paymentHistoryTable");
  if (!historyTable) return;

  if (!payments.length) {
    historyTable.innerHTML = `<tr><td colspan="7">No results found.</td></tr>`;
    return;
  }

  historyTable.innerHTML = "";

  payments.forEach(p => {
    const tr = document.createElement("tr");

    const reviewedDate = p.reviewed_at
      ? new Date(p.reviewed_at).toLocaleDateString()
      : "—";

    // Format amount from kobo to naira where possible
    const amountDisplay = p.amount
      ? `₦${Number(p.amount).toLocaleString()}`
      : "—";

    const statusClass = p.status === "confirmed"
      ? "status-approved"
      : "status-rejected";

    const receiptLink = p.transfer_proof_url
      ? `<a href="#"
           onclick="viewSignedUrl('payment-receipts','${p.transfer_proof_url}');return false;"
           style="color:#2563eb;text-decoration:underline;cursor:pointer;">View Receipt</a>`
      : "—";

    tr.innerHTML = `
      <td>${sanitize(p.vendors?.name)}</td>
      <td>${sanitize(p.plan)}</td>
      <td>${sanitize(p.billing_type)}</td>
      <td>${amountDisplay}</td>
      <td>${reviewedDate}</td>
      <td><span class="status-badge ${statusClass}">${sanitize(p.status)}</span></td>
      <td>${receiptLink}</td>
    `;

    historyTable.appendChild(tr);
  });
}

loadPaymentHistory();

// -----------------------------
// SPONSORSHIP HISTORY
// Shows all active and rejected sponsorships.
// -----------------------------

let allReviewedSponsorships = [];

async function loadSponsorshipHistory() {
  const historyTable = document.getElementById("sponsorshipHistoryTable");
  if (!historyTable) return;

  const { data: sponsorships, error } = await supabase
    .from("vendor_sponsorships")
    .select(`
      id,
      sponsorship_type,
      tier,
      billing_cycle,
      amount_paid,
      expires_at,
      payment_status,
      receipt_url,
      vendors ( name )
    `)
    .eq("payment_method", "bank_transfer")
    .in("payment_status", ["active", "rejected", "expired"])
    .order("expires_at", { ascending: false });

  if (error) {
    historyTable.innerHTML = `<tr><td colspan="8">Failed to load sponsorship history.</td></tr>`;
    return;
  }

  if (!sponsorships || !sponsorships.length) {
    historyTable.innerHTML = `<tr><td colspan="8">No reviewed sponsorships yet.</td></tr>`;
    return;
  }

  allReviewedSponsorships = sponsorships;
  renderSponsorshipHistory(sponsorships);

  const searchInput = document.getElementById("sponsorshipHistorySearch");
  const statusFilter = document.getElementById("sponsorshipHistoryFilter");

  function applyFilters() {
    const searchTerm = (searchInput?.value || "").toLowerCase().trim();
    const statusValue = statusFilter?.value || "all";
    const filtered = allReviewedSponsorships.filter(s => {
      const nameMatch = (s.vendors?.name || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || s.payment_status === statusValue;
      return nameMatch && statusMatch;
    });
    renderSponsorshipHistory(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderSponsorshipHistory(sponsorships) {
  const historyTable = document.getElementById("sponsorshipHistoryTable");
  if (!historyTable) return;

  if (!sponsorships.length) {
    historyTable.innerHTML = `<tr><td colspan="8">No results found.</td></tr>`;
    return;
  }

  historyTable.innerHTML = "";

  sponsorships.forEach(s => {
    const tr = document.createElement("tr");

    const expiresDisplay = s.expires_at
      ? new Date(s.expires_at).toLocaleDateString()
      : "—";

    const statusClass = s.payment_status === "active"
      ? "status-approved"
      : s.payment_status === "expired"
        ? "status-revoked"
        : "status-rejected";

    const receiptLink = s.receipt_url
      ? `<a href="#"
           onclick="viewSignedUrl('sponsorship-receipts','${s.receipt_url}');return false;"
           style="color:#2563eb;text-decoration:underline;cursor:pointer;">View Receipt</a>`
      : "—";

    tr.innerHTML = `
      <td>${sanitize(s.vendors?.name)}</td>
      <td>${sanitize(s.sponsorship_type)}</td>
      <td>${sanitize(s.tier)}</td>
      <td>${sanitize(s.billing_cycle)}</td>
      <td>₦${Number(s.amount_paid).toLocaleString()}</td>
      <td>${expiresDisplay}</td>
      <td><span class="status-badge ${statusClass}">${sanitize(s.payment_status)}</span></td>
      <td>${receiptLink}</td>
    `;

    historyTable.appendChild(tr);
  });
}

loadSponsorshipHistory();

// -----------------------------
// VERIFICATION HISTORY
// Shows all approved and rejected verifications.
// Admins can view documents via signed URLs directly
// from the UI — no Supabase dashboard needed.
// -----------------------------

let allReviewedVerifications = [];

async function loadVerificationHistory() {
  const historyTable = document.getElementById("verificationHistoryTable");
  if (!historyTable) return;

  const { data: reviewed, error } = await supabase
    .from("vendor_verifications")
    .select(`
      id,
      badge_type,
      status,
      created_at,
      reviewed_at,
      id_url,
      passport_photo_url,
      cac_url,
      utility_url,
      memart_url,
      status_report_url,
      vendor:vendors ( name )
    `)
    .in("status", ["approved", "rejected", "revoked"])
    .order("reviewed_at", { ascending: false });

  if (error) {
    historyTable.innerHTML = `<tr><td colspan="7">Failed to load history.</td></tr>`;
    return;
  }

  if (!reviewed || !reviewed.length) {
    historyTable.innerHTML = `<tr><td colspan="7">No reviewed verifications yet.</td></tr>`;
    return;
  }

  allReviewedVerifications = reviewed;
  renderVerificationHistory(reviewed);

  // Wire up search and filter
  const searchInput = document.getElementById("verificationSearch");
  const statusFilter = document.getElementById("verificationStatusFilter");

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusValue = statusFilter.value;
    const filtered = allReviewedVerifications.filter(v => {
      const nameMatch = (v.vendor?.name || "").toLowerCase().includes(searchTerm);
      const statusMatch = statusValue === "all" || v.status === statusValue;
      return nameMatch && statusMatch;
    });
    renderVerificationHistory(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function renderVerificationHistory(verifications) {
  const historyTable = document.getElementById("verificationHistoryTable");
  if (!historyTable) return;

  if (!verifications.length) {
    historyTable.innerHTML = `<tr><td colspan="7">No results found.</td></tr>`;
    return;
  }

  historyTable.innerHTML = "";

  verifications.forEach(v => {
    const tr = document.createElement("tr");
    const submittedDate = v.created_at ? new Date(v.created_at).toLocaleDateString() : "—";
    const reviewedDate  = v.reviewed_at ? new Date(v.reviewed_at).toLocaleDateString() : "Not recorded";
    const statusClass   = v.status === "approved" ? "status-approved"
                        : v.status === "revoked"  ? "status-revoked"
                        : "status-rejected";

    const docLinks = [
      { label: "ID",            url: v.id_url },
      { label: "Passport",      url: v.passport_photo_url },
      { label: "CAC",           url: v.cac_url },
      { label: "Utility",       url: v.utility_url },
      { label: "MEMART",        url: v.memart_url },
      { label: "Status Report", url: v.status_report_url }
    ]
    .filter(doc => doc.url)
    .map(doc =>
      `<a href="#"
         onclick="viewSignedUrl('vendor-verifications','${doc.url}');return false;"
         style="margin-right:6px;color:#2563eb;text-decoration:underline;cursor:pointer;">${doc.label}</a>`
    )
    .join("");

    const revokeBtn = currentRole === "super_admin" && v.status === "approved"
      ? `<button class="reject-btn" style="margin-top:4px;background:#dc2626;"
           data-revoke="${sanitize(v.id)}">Revoke</button>`
      : "";

    tr.innerHTML = `
      <td>${sanitize(v.vendor?.name)}</td>
      <td>${sanitize(v.badge_type)}</td>
      <td>${submittedDate}</td>
      <td>${reviewedDate}</td>
      <td><span class="status-badge ${statusClass}">${sanitize(v.status)}</span></td>
      <td>${docLinks || "—"}</td>
      <td>${revokeBtn}</td>
    `;

    historyTable.appendChild(tr);
  });
}

loadVerificationHistory();

});

// -----------------------------
// VIEW SECURITY LOG DETAILS
// Defined OUTSIDE DOMContentLoaded so it is globally accessible from
// the onclick in the Security Log table. Looks up the full entry
// (including old/new row data) from the map built while rendering.
// -----------------------------
const securityLogEntriesById = {};

function viewAuditDetails(entryId) {
  const entry = securityLogEntriesById[entryId];
  if (!entry) {
    alert("Details not found — try refreshing the Security Log.");
    return;
  }

  const lines = [
    `Table: ${entry.table_name}`,
    `Action: ${entry.action}`,
    `When: ${entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"}`,
    `Actor: ${entry.actor_email || "System (no admin session)"}`,
    `Row ID: ${entry.row_id || "—"}`
  ];

  if (entry.old_data) {
    lines.push("", "Before:", JSON.stringify(entry.old_data, null, 2));
  }
  if (entry.new_data) {
    lines.push("", "After:", JSON.stringify(entry.new_data, null, 2));
  }

  alert(lines.join("\n"));
}

// -----------------------------
// SANITIZE — XSS PROTECTION
// Converts vendor-supplied text to safe plain text
// before inserting into the admin page HTML.
// Prevents any injected scripts from executing.
// -----------------------------
function sanitize(str) {
  if (str === null || str === undefined) return "—";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// -----------------------------
// LOG ADMIN AUDIT ENTRY
// A permanent, append-only record of staff actions. Never blocks
// or interferes with anything — it only remembers. Defined OUTSIDE
// DOMContentLoaded so it's accessible from revokeAdminRole too.
// -----------------------------
async function logAdminAudit(action, targetEmail, role, details) {
  const supabase = window.supabaseClient;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("admin_audit_log").insert({
    actor_id: user.id,
    actor_email: user.email,
    action: action,
    target_email: targetEmail || null,
    role: role || null,
    details: details || null
  });
}

// -----------------------------
// REVOKE ADMIN ROLE
// Defined OUTSIDE DOMContentLoaded so it is globally
// accessible from onclick in the staff table.
// Only super_admin can call this (enforced at DB level too).
// -----------------------------
async function revokeAdminRole(userId, email, role) {
  if (!confirm("Revoke this person's admin access? If they have no separate vendor profile, their account will be fully removed rather than just downgraded.")) return;

  const supabase = window.supabaseClient;

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    alert("Your session has expired. Please log in again.");
    return;
  }

  try {

    const response = await fetch(
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/admin-revoke-role",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ targetUserId: userId, email, role })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert("Failed to revoke role: " + (result.error || "Unknown error"));
      return;
    }

    alert(`✓ Admin access revoked.\n\n${result.cleanupNote}`);

    // Refresh the staff table
    const staffTable = document.getElementById("adminStaffTable");
    if (staffTable) staffTable.innerHTML = `<tr><td colspan="4">Refreshing…</td></tr>`;
    location.reload();

  } catch (err) {
    alert("Failed to revoke role: " + err.message);
  }
}

// -----------------------------
// REVOKE PENDING INVITATION
// Defined OUTSIDE DOMContentLoaded so it is globally
// accessible from onclick in the pending invitations table.
// Enforced at the DB level too (super_admin_delete_invitations policy).
// -----------------------------
async function revokeInvitation(invitationId) {
  if (!confirm("Revoke this invitation? If the person created a signup account that was never activated, it will be fully removed too — re-inviting this email later will start completely fresh.")) return;

  const supabase = window.supabaseClient;

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    alert("Your session has expired. Please log in again.");
    return;
  }

  try {

    const response = await fetch(
      "https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/admin-revoke-invitation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ invitationId })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert("Failed to revoke invitation: " + (result.error || "Unknown error"));
      return;
    }

    alert(`✓ Invitation revoked.\n\n${result.cleanupNote}`);
    location.reload();

  } catch (err) {
    alert("Failed to revoke invitation: " + err.message);
  }
}

// -----------------------------
// VIEW SIGNED URL (Private Buckets)
// Defined OUTSIDE DOMContentLoaded so it is globally
// accessible from onclick attributes in the HTML.
// Handles both full URLs (legacy) and file paths (new).
// Link expires after 60 minutes automatically.
// -----------------------------
async function viewSignedUrl(bucket, pathOrUrl) {
  if (!pathOrUrl) return;

  // If a full URL was stored (legacy documents before this fix),
  // extract just the file path from it.
  let filePath = pathOrUrl;
  const marker = `/object/public/${bucket}/`;
  if (pathOrUrl.includes(marker)) {
    filePath = pathOrUrl.split(marker)[1];
  }

  const supabase = window.supabaseClient;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600);

  if (error || !data?.signedUrl) {
    alert("Could not generate document link. Please try again.");
    return;
  }

  window.open(data.signedUrl, "_blank");
}
