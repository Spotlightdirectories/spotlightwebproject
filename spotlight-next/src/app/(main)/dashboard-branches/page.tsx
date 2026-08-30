"use client";

// ===============================================================
// src/app/(main)/dashboard-branches/page.tsx
//
// Faithful port of production dashboard-branches.html +
// dashboard-branches.js — reached from the vendor dashboard's
// Subscription tab "Manage Branches" button (enterprise/elite/
// custom plans only). Lets a multi-location vendor add, edit and
// delete branch locations.
//
// Placed under the (main) route group (like getlisted, aboutUs,
// etc.) rather than (standalone) because production's version uses
// the same site-wide navbar as every public content page — unlike
// vendordashboard (own sidebar) or insight (its own back-button
// header). The (main) layout already provides that Navbar + top
// padding for free.
//
// Styling is the same brand system (CSS variables, dark mode) used
// across every other ported page rather than production's raw
// hardcoded blue-on-white styling — that's the standing, already-
// agreed requirement for this whole migration (Stage 6: dark/light
// mode on every page), not a one-off improvement.
//
// FIXED (2026-07-31, confirmed with Cyril): production's "Edit" fills
// the branch-name field with the FULL stored value — e.g. "Acme Ltd -
// Isolo" — not just the identifier ("Isolo"). Since the name is
// stored with the vendor's business name prefixed on every save, and
// the submit handler rejects any input that already contains the
// business name or a " - " separator, saving an edit without first
// manually deleting the prefix text would always hit one of those two
// alerts — Edit was effectively unusable as-is. Fixed here by
// stripping the "<business name> - " prefix back off before it goes
// into the field, so the edit form shows just "Isolo" again, matching
// what the Add form expects.
// ===============================================================

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { nigeriaData } from "@/lib/nigeria-data";
import UpgradePlanModal, { BRANCH_UPGRADE_MESSAGE } from "@/components/UpgradePlanModal";
import styles from "./dashboard-branches.module.css";

type Branch = {
  id: number;
  branch_name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  state: string | null;
  lga: string | null;
  open_time: string | null;
  close_time: string | null;
  business_days: string | null;
  latitude: number | null;
  longitude: number | null;
};

type VendorRow = {
  id: string;
  name: string | null;
  plan_tier: string | null;
};

// Matches production's BRANCH_LIMITS exactly.
const BRANCH_LIMITS: Record<string, number> = {
  free: 0,
  standard: 0,
  enterprise: 10,
  elite: 30,
  custom: Infinity,
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary matching so a short business name like "AB" doesn't
// false-positive on unrelated words like "Cabin" — same reasoning as
// production's comment.
function containsBusinessName(text: string, businessName: string | null | undefined) {
  if (!businessName) return false;
  const pattern = new RegExp(`\\b${escapeRegex(businessName)}\\b`, "i");
  return pattern.test(text);
}

// Reverses the "<business name> - <identifier>" prefix applied on
// save, so the edit form shows just the identifier again. Falls back
// to the raw stored value if it doesn't start with the current
// business name (e.g. the vendor renamed their business since this
// branch was created) — safer than silently chopping off text that
// isn't actually the prefix.
function stripBusinessNamePrefix(branchName: string, businessName: string | null | undefined) {
  if (!businessName) return branchName;
  const prefix = `${businessName} - `;
  return branchName.startsWith(prefix) ? branchName.slice(prefix.length) : branchName;
}

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  whatsapp: "+234",
  state: "",
  lga: "",
  openTime: "",
  closeTime: "",
  days: [] as string[],
  latitude: "",
  longitude: "",
};

export default function DashboardBranchesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ ...emptyForm });

  // Step 4, 2026-08 per Cyril: replaces the plain alert() that used
  // to fire on submit when hitting the plan's branch limit (0 for
  // free/standard). Also used to show the upgrade prompt IN PLACE OF
  // the form entirely when already at the limit -- same reasoning as
  // the Products/Services fix: this form has even more fields (name,
  // address, phone, WhatsApp, state, LGA, hours, days, coordinates),
  // so letting someone fill all of that in only to be blocked at
  // submit would be worse here, not better.
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: v } = await supabase
        .from("vendors")
        .select("id, name, plan_tier")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!v) {
        router.replace("/login");
        return;
      }

      setVendor(v as VendorRow);
      await loadBranches(v.id);
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function loadBranches(vendorId: string) {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: true });
    setBranches((data as Branch[]) || []);
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  function handleWhatsappChange(raw: string) {
    let digits = raw.replace("+234", "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    setForm((f) => ({ ...f, whatsapp: "+234" + digits }));
  }

  function handleStateChange(next: string) {
    setForm((f) => ({ ...f, state: next, lga: "" }));
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
    }));
  }

  function handleEditClick(branch: Branch) {
    setEditingId(branch.id);
    setForm({
      name: stripBusinessNamePrefix(branch.branch_name || "", vendor?.name),
      address: branch.address || "",
      phone: branch.phone || "",
      whatsapp: branch.whatsapp || "+234",
      state: branch.state || "",
      lga: branch.lga || "",
      openTime: branch.open_time || "",
      closeTime: branch.close_time || "",
      days: (branch.business_days || "").split(",").filter(Boolean),
      latitude: branch.latitude != null ? String(branch.latitude) : "",
      longitude: branch.longitude != null ? String(branch.longitude) : "",
    });
  }

  async function handleDeleteClick(branch: Branch) {
    if (!confirm("Delete this branch?")) return;

    const { error } = await supabase.from("branches").delete().eq("id", branch.id);
    if (error) {
      console.error("Delete error:", error.message);
      alert("Could not delete branch.");
      return;
    }

    setBranches((prev) => prev.filter((b) => b.id !== branch.id));
    if (editingId === branch.id) resetForm();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vendor) return;

    const branchInput = form.name.trim();
    if (!branchInput) {
      alert("Branch name and address are required.");
      return;
    }

    if (containsBusinessName(branchInput, vendor.name)) {
      alert("Do not include your business name. Enter only the branch identifier (e.g. 'Isolo').");
      return;
    }

    if (branchInput.includes(" - ")) {
      alert("Enter only branch identifier without '-' formatting.");
      return;
    }

    const name = `${vendor.name} - ${branchInput}`;
    const address = form.address.trim();

    if (!address) {
      alert("Branch name and address are required.");
      return;
    }
    if (!form.state || !form.lga) {
      alert("Please select the branch's state and LGA.");
      return;
    }

    // Plan limit — only applies when creating a NEW branch, never
    // when editing one you already have.
    if (!editingId) {
      const limit = BRANCH_LIMITS[vendor.plan_tier || "free"] ?? 0;
      if (branches.length >= limit) {
        setUpgradeModalOpen(true);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        branch_name: name,
        address,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        state: form.state,
        lga: form.lga,
        open_time: form.openTime || null,
        close_time: form.closeTime || null,
        business_days: form.days.join(",") || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      };

      const { error } = editingId
        ? await supabase.from("branches").update(payload).eq("id", editingId)
        : await supabase.from("branches").insert({ vendor_id: vendor.id, ...payload });

      if (error) {
        console.error("Branch save error:", error.message);
        alert("Could not create branch.");
        return;
      }

      await loadBranches(vendor.id);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  const lgaOptions: string[] = form.state ? nigeriaData[form.state as keyof typeof nigeriaData] || [] : [];

  const branchLimit = BRANCH_LIMITS[vendor?.plan_tier || "free"] ?? 0;
  const atLimit = !editingId && branches.length >= branchLimit;

  if (loading) {
    return (
      <main className={styles.page}>
        <p style={{ color: "var(--color-text-muted)" }}>Loading branches...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1>Branches</h1>
      <p className={styles.note}>Add and manage your business locations.</p>

      {/* ADD / EDIT BRANCH */}
      <section className={styles.card}>
        <h2>{editingId ? "Edit Branch" : "Add Branch"}</h2>

        {atLimit ? (
          // Shown INSTEAD of the form when already at the branch
          // limit -- see upgradeModalOpen comment above for why.
          <div>
            <p className={styles.note}>{BRANCH_UPGRADE_MESSAGE}</p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setUpgradeModalOpen(true)}
            >
              Upgrade Plan
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.input}
            placeholder="Branch name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <p className={styles.fieldHint}>
            Enter only the location name (e.g. &quot;Isolo&quot; or &quot;Isolo Branch&quot;) — not your business
            name, which is added automatically.
          </p>

          <input
            type="text"
            className={styles.input}
            placeholder="Branch address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            required
          />

          <input
            type="text"
            className={styles.input}
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />

          <label className={styles.fieldLabel} htmlFor="branchWhatsapp">WhatsApp number</label>
          <input
            id="branchWhatsapp"
            type="text"
            className={styles.input}
            placeholder="WhatsApp number"
            value={form.whatsapp}
            onChange={(e) => handleWhatsappChange(e.target.value)}
          />

          <div className={styles.regionRow}>
            <select className={styles.select} value={form.state} onChange={(e) => handleStateChange(e.target.value)}>
              <option value="">Select State</option>
              {Object.keys(nigeriaData).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select className={styles.select} value={form.lga} onChange={(e) => setForm((f) => ({ ...f, lga: e.target.value }))}>
              <option value="">Select LGA</option>
              {lgaOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className={styles.hoursRow}>
            <label className={styles.hoursLabel}>
              Opening Time
              <input type="time" className={styles.input} value={form.openTime} onChange={(e) => setForm((f) => ({ ...f, openTime: e.target.value }))} />
            </label>
            <label className={styles.hoursLabel}>
              Closing Time
              <input type="time" className={styles.input} value={form.closeTime} onChange={(e) => setForm((f) => ({ ...f, closeTime: e.target.value }))} />
            </label>
          </div>

          <div className={styles.daysRow}>
            {DAYS.map((day) => (
              <label key={day}>
                <input type="checkbox" checked={form.days.includes(day)} onChange={() => toggleDay(day)} /> {day}
              </label>
            ))}
          </div>

          <p className={styles.mapHelper}>
            To obtain the correct coordinates for this branch:<br />
            Visit <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">maps.google.com</a>,
            paste the branch address in the search bar, right-click the exact location on the map and copy the
            latitude and longitude shown. Paste them into the fields below.
          </p>

          <input
            type="text"
            className={styles.input}
            placeholder="Latitude"
            value={form.latitude}
            onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
          />

          <input
            type="text"
            className={styles.input}
            placeholder="Longitude"
            value={form.longitude}
            onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
          />

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn} disabled={saving}>
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Branch" : "Add Branch"}
            </button>
            {editingId && (
              <button type="button" className={styles.cancelBtn} onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
        )}
      </section>

      {/* BRANCH LIST */}
      <section className={styles.card}>
        <h2>Your Branches</h2>

        {branches.length === 0 ? (
          <p className={styles.empty}>No branches created yet.</p>
        ) : (
          branches.map((branch) => (
            <div className={styles.branchRow} key={branch.id}>
              <div className={styles.branchName}>{branch.branch_name}</div>
              <div className={styles.branchAddress}>{branch.address}</div>
              <div className={styles.branchRegion}>
                {branch.state || branch.lga ? `${branch.lga || "—"}, ${branch.state || "—"}` : "—"}
              </div>
              <div className={styles.branchActions}>
                <button type="button" className={styles.editBtn} onClick={() => handleEditClick(branch)}>Edit</button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(branch)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </section>

      <UpgradePlanModal
        open={upgradeModalOpen}
        message={BRANCH_UPGRADE_MESSAGE}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </main>
  );
}
