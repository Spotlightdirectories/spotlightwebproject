-- ===============================================================
-- Migration: lock_storage_buckets_service_role_only
-- Block 4, item 15b — close the storage-bucket bypass gap
--
-- Removes every permissive client-facing INSERT/UPDATE policy on the
-- four buckets that go through validate-upload, so the ONLY way to
-- write to them is via the service role (used internally by
-- validate-upload). No replacement policy is needed: the service
-- role bypasses RLS entirely regardless of what policies exist, and
-- removing these means regular authenticated/anon requests are
-- correctly denied by RLS's default-deny behaviour.
--
-- SELECT (read) and DELETE (owner cleanup) policies are UNCHANGED —
-- vendors still need to view their own files and delete their own
-- images when replacing them; only the "write new content" path is
-- being locked down.
--
-- vendor-videos is deliberately NOT touched here. Video upload was
-- never routed through validate-upload (a documented, deliberate
-- Block 4 decision), so its existing direct-write policies must stay
-- as-is or the working video upload flow would break.
-- ===============================================================

BEGIN;

-- vendor-gallery (product/service images)
DROP POLICY IF EXISTS "Allow authenticated upload to vendor gallery" ON storage.objects;

-- vendor-branding (cover, logo, gallery photos)
DROP POLICY IF EXISTS "Allow authenticated upload tvxqzk_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow vendor cover insert tvxqzk_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow vendor cover update tvxqzk_0" ON storage.objects;

-- vendor-verifications (ID, CAC, MEMART, utility bill, etc.)
DROP POLICY IF EXISTS "Allow Upload (Insert) 1d41qsz_0" ON storage.objects;
DROP POLICY IF EXISTS "allow_vendor_verification_insert 1d41qsz_0" ON storage.objects;

-- payment-receipts (bank transfer proof)
DROP POLICY IF EXISTS "vendors can upload receipts" ON storage.objects;

COMMIT;
