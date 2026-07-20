-- ===============================================================
-- Migration: fix_audit_log_actor_fk_and_revoke_cleanup
--
-- Fixes a foreign key gap found while extending "clean revoke"
-- behaviour to active admins (not just pending invitations): if an
-- admin's own account is later deleted, but their audit log entries
-- still reference them as actor_id, the delete would fail outright
-- (the FK defaults to blocking, not cascading). Since actor_email is
-- already stored as a separate text snapshot for exactly this
-- reason, it's safe to let actor_id become NULL when the account
-- goes away — the log entry stays fully readable either way.
-- ===============================================================

BEGIN;

ALTER TABLE public.admin_audit_log
DROP CONSTRAINT admin_audit_log_actor_id_fkey,
ADD CONSTRAINT admin_audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
