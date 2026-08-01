// Shared types for the Partner Dashboard shell + its tab components.

export type PartnerRow = {
  id: string;
  name: string | null;
  email: string | null;
  referral_code: string | null;
  account_status: string | null;
  scheduled_deletion_at: string | null;
  created_at: string;
};

export type CommissionRow = {
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

export type DownlinePartner = { id: string; name: string | null };
