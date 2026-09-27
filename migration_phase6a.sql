-- Phase 6A: Add DELETE RLS policy for DRAFT events
-- Allows SUPER_ADMIN and ADMIN to delete DRAFT events belonging to their church

BEGIN;

-- Drop the old super-admin only delete policy
DROP POLICY IF EXISTS "events_delete_super_admin" ON events;

-- Create new policy: allow SUPER_ADMIN and ADMIN to delete DRAFT events
CREATE POLICY "events_delete_draft_admin"
ON events
FOR DELETE
TO authenticated
USING (
    get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    AND church_id = get_current_user_church_id()
    AND status = 'DRAFT'
);

COMMIT;