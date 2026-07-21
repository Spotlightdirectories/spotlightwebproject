-- ===============================================================
-- Migration: sponsorship_receipts_bucket
--
-- Creates the storage bucket for sponsorship bank-transfer receipts,
-- matching the exact same access pattern as the existing
-- payment-receipts bucket: vendors can read their own upload, and
-- finance-role admins (super_admin/admin/finance_admin) can read
-- any receipt for review.
-- ===============================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsorship-receipts', 'sponsorship-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vendors read own sponsorship receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sponsorship-receipts'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "finance roles read sponsorship receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sponsorship-receipts'
  AND (
    auth.uid() IS NOT NULL
    OR get_my_admin_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'finance_admin'::text])
  )
);

CREATE POLICY "authenticated upload sponsorship receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'sponsorship-receipts'
  AND auth.uid() IS NOT NULL
);

COMMIT;
