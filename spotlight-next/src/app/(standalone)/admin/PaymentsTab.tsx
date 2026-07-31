"use client";

// ===============================================================
// src/app/(standalone)/admin/PaymentsTab.tsx
//
// Pending Payments — finance roles (super_admin, admin, finance_admin).
// Faithful port of the "LOAD PAYMENTS" / approvePayment / rejectPayment
// sections of admin-payments.js.
//
// Approve: confirms the transfer, activates the vendor's subscription
// (sets plan/billing/expiry, generates a SPOT ID for first-time paid
// vendors), and emails them via EmailTemplates.paymentApproved.
// Reject: prompts for a reason, marks the vendor's subscription as
// failed, and emails them via EmailTemplates.paymentRejected.
//
// Receipts live in the private "payment-receipts" bucket — viewed via
// a short-lived (60 min) signed URL rather than a public link.
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, getAdminSession, type AdminRole } from "@/lib/adminSupabase";
import { EmailTemplates } from "@/lib/emailTemplates";
import { viewSignedUrl } from "@/lib/adminSignedUrl";

type PaymentRow = {
  id: string;
  vendor_id: string;
  plan: string | null;
  billing_type: string | null;
  status: string | null;
  transfer_proof_url: string | null;
  vendors: { id: string; name: string | null; email: string | null } | null;
};

export default function PaymentsTab({ currentRole }: { currentRole: AdminRole }) {
  void currentRole;

  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    const { data, error } = await adminSupabase
      .from("vendor_payments")
      .select("id, vendor_id, plan, billing_type, status, transfer_proof_url, vendors ( id, name, email )")
      .eq("payment_method", "bank")
      .eq("status", "pending")
      .returns<PaymentRow[]>();

    if (error) {
      setLoadError(error.message);
      setPayments([]);
      return;
    }
    setPayments(data || []);
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  async function approvePayment(paymentId: string) {
    if (!confirm("Approve this payment?")) return;
    setProcessingId(paymentId);

    const { data: payment, error } = await adminSupabase
      .from("vendor_payments")
      .select("id, vendor_id, plan, billing_type, status, vendors ( id, name, email )")
      .eq("id", paymentId)
      .single()
      .returns<PaymentRow>();

    if (error || !payment) {
      alert("Payment not found.");
      setProcessingId(null);
      return;
    }

    if (payment.status !== "pending") {
      alert("This payment is already processed.");
      setProcessingId(null);
      return;
    }

    const session = getAdminSession();
    const now = new Date().toISOString();

    // 1. Update the payment record
    const { error: updateError } = await adminSupabase
      .from("vendor_payments")
      .update({
        status: "confirmed",
        reviewed_at: now,
        approved_at: now,
        rejected_at: null,
        rejection_reason: null,
        reviewed_by: session?.user_id || null,
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("VendorPayment update failed:", updateError);
      alert("Failed to update payment record.");
      setProcessingId(null);
      return;
    }

    // 2. Activate the vendor's subscription
    const expiry =
      payment.billing_type === "monthly"
        ? new Date(new Date(now).setMonth(new Date(now).getMonth() + 1))
        : new Date(new Date(now).setFullYear(new Date(now).getFullYear() + 1));

    // Generate a SPOT ID for paid vendors (P = Paid vendor type).
    // Non-fatal if it fails — activation still proceeds.
    let spotId: string | null = null;
    try {
      const { data: generatedSpotId } = await adminSupabase.rpc("generate_spot_id", { vendor_type: "P" });
      spotId = generatedSpotId as string | null;
    } catch (err) {
      console.error("SPOT ID generation failed:", err);
    }

    const vendorUpdate: Record<string, unknown> = {
      subscription_status: "active",
      plan_tier: payment.plan,
      billing_cycle: payment.billing_type,
      is_premium: true,
      paid_at: now,
      expires_at: expiry.toISOString(),
    };
    if (spotId) vendorUpdate.spot_id = spotId;

    await adminSupabase.from("vendors").update(vendorUpdate).eq("id", payment.vendor_id);

    // Fetch the confirmed SPOT ID from the vendor record after update
    const { data: updatedVendor } = await adminSupabase
      .from("vendors")
      .select("spot_id, name")
      .eq("id", payment.vendor_id)
      .single()
      .returns<{ spot_id: string | null; name: string | null }>();

    const confirmedSpotId = updatedVendor?.spot_id || spotId || "";
    const confirmedVendorName = updatedVendor?.name || payment.vendors?.name || "";

    // 3. Notify the vendor — non-fatal if it fails
    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payment.vendors?.email,
          subject: "Payment Approved — Your Spotlight Listing is Active",
          html: EmailTemplates.paymentApproved({
            vendorName: confirmedVendorName,
            plan: payment.plan || "",
            billingType: payment.billing_type || "",
            spotId: confirmedSpotId,
            expiresAt: expiry.toISOString(),
            loginUrl: `${window.location.origin}/login`,
          }),
        }),
      });
    } catch (err) {
      console.error("Payment approval email failed:", err);
    }

    await adminSupabase.from("vendor_payments").update({ notification_sent: true }).eq("id", paymentId);

    alert("Payment approved");
    setProcessingId(null);
    loadPayments();
  }

  async function rejectPayment(paymentId: string) {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;

    setProcessingId(paymentId);

    const { data: payment, error } = await adminSupabase
      .from("vendor_payments")
      .select("id, vendor_id, status, vendors ( id, name, email )")
      .eq("id", paymentId)
      .single()
      .returns<PaymentRow>();

    if (error || !payment) {
      alert("Payment not found.");
      setProcessingId(null);
      return;
    }

    if (payment.status !== "pending") {
      alert("This payment is already processed.");
      setProcessingId(null);
      return;
    }

    const session = getAdminSession();
    const now = new Date().toISOString();

    const { error: updateError } = await adminSupabase
      .from("vendor_payments")
      .update({
        status: "rejected",
        reviewed_at: now,
        approved_at: null,
        rejected_at: now,
        rejection_reason: reason,
        reviewed_by: session?.user_id || null,
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("VendorPayment update failed:", updateError);
      alert("Failed to update payment record.");
      setProcessingId(null);
      return;
    }

    await adminSupabase.from("vendors").update({ subscription_status: "failed" }).eq("id", payment.vendor_id);

    try {
      await fetch("https://gyvzmktavyrevfxnwsay.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payment.vendors?.email,
          subject: "Payment Could Not Be Verified",
          html: EmailTemplates.paymentRejected({
            vendorName: payment.vendors?.name || "",
            reason,
            paymentUrl: `${window.location.origin}/payment`,
          }),
        }),
      });
    } catch (err) {
      console.error("Payment rejection email failed:", err);
    }

    await adminSupabase.from("vendor_payments").update({ notification_sent: true }).eq("id", paymentId);

    alert("Payment rejected");
    setProcessingId(null);
    loadPayments();
  }

  return (
    <div>
      <h1 className="adm-section-heading">Pending Payments</h1>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Vendor</th><th>Plan</th><th>Billing</th><th>Receipt</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {payments === null && <tr><td colSpan={6} className="adm-empty-cell">Loading…</td></tr>}
            {payments !== null && loadError && (
              <tr><td colSpan={6} className="adm-empty-cell">{loadError}</td></tr>
            )}
            {payments !== null && !loadError && payments.length === 0 && (
              <tr><td colSpan={6} className="adm-empty-cell">✓ All caught up — no pending payments.</td></tr>
            )}
            {payments?.map((p) => (
              <tr key={p.id}>
                <td>{p.vendors?.name || "—"}</td>
                <td>{p.plan || "—"}</td>
                <td>{p.billing_type || "—"}</td>
                <td>
                  {p.transfer_proof_url ? (
                    <button
                      type="button"
                      className="adm-btn"
                      style={{ background: "transparent", color: "#2563eb", textDecoration: "underline", padding: 0 }}
                      onClick={() => viewSignedUrl("payment-receipts", p.transfer_proof_url)}
                    >
                      View
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{p.status || "—"}</td>
                <td>
                  <button
                    className="adm-btn adm-approve-btn"
                    disabled={processingId === p.id}
                    onClick={() => approvePayment(p.id)}
                  >
                    {processingId === p.id ? "Processing..." : "Approve"}
                  </button>{" "}
                  <button
                    className="adm-btn adm-reject-btn"
                    disabled={processingId === p.id}
                    onClick={() => rejectPayment(p.id)}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
