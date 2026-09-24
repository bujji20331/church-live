-- Phase 5A Migration: Multi-Church Foundation
-- Creates churches table and adds church_id to all tenant-scoped tables
-- Does NOT modify docs/supabase-schema.sql (as instructed)

BEGIN;

-- 1. Create churches table
CREATE TABLE IF NOT EXISTS churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Church Live',
    logo_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    contact_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add nullable church_id to all tenant-scoped tables
ALTER TABLE profiles ADD COLUMN church_id UUID;
ALTER TABLE events ADD COLUMN church_id UUID;
ALTER TABLE church_settings ADD COLUMN church_id UUID;
ALTER TABLE system_logs ADD COLUMN church_id UUID;

-- 3. Create the first church with a deterministic UUID for reviewability
INSERT INTO churches (id, name, logo_url, timezone, contact_email)
VALUES (
    '03ccf8d9-e378-4d30-bed4-a7cf8b24ff60',
    'Church Live',
    null,
    'UTC',
    null
)
RETURNING id;

-- 4. Assign the existing SUPER_ADMIN to the first church
WITH first_church AS (
    SELECT id FROM churches WHERE id = '03ccf8d9-e378-4d30-bed4-a7cf8b24ff60'
)
UPDATE profiles
SET church_id = first_church.id,
    updated_at = NOW()
FROM first_church
WHERE profiles.id = '03ccf8d9-e378-4d30-bed4-a7cf8b24ff57'
  AND is_active = true;

-- 5. Backfill events with existing data (assign to the SUPER_ADMIN's church)
UPDATE events
SET church_id = (
    SELECT church_id FROM profiles
    WHERE id = '03ccf8d9-e378-4d30-bed4-a7cf8b24ff57'
    AND is_active = true
)
WHERE church_id IS NULL;

-- 6. Backfill church_settings with existing data (assign to the SUPER_ADMIN's church)
UPDATE church_settings
SET church_id = (
    SELECT church_id FROM profiles
    WHERE id = '03ccf8d9-e378-4d30-bed4-a7cf8b24ff57'
    AND is_active = true
)
WHERE church_id IS NULL;

-- 7. Backfill system_logs with existing data (assign to the SUPER_ADMIN's church)
UPDATE system_logs
SET church_id = (
    SELECT church_id FROM profiles
    WHERE id = '03ccf8d9-e378-4d30-bed4-a7cf8b24ff57'
    AND is_active = true
)
WHERE church_id IS NULL;

-- 8. Verify there are no NULL church_id values
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM profiles WHERE church_id IS NULL) THEN
        RAISE EXCEPTION 'Profiles still have NULL church_id values after backfill';
    END IF;
    IF EXISTS (SELECT 1 FROM events WHERE church_id IS NULL) THEN
        RAISE EXCEPTION 'Events still have NULL church_id values after backfill';
    END IF;
    IF EXISTS (SELECT 1 FROM church_settings WHERE church_id IS NULL) THEN
        RAISE EXCEPTION 'Church_settings still have NULL church_id values after backfill';
    END IF;
    IF EXISTS (SELECT 1 FROM system_logs WHERE church_id IS NULL) THEN
        RAISE EXCEPTION 'System_logs still have NULL church_id values after backfill';
    END IF;
END $$;

-- 9. Add foreign keys
ALTER TABLE profiles
ADD CONSTRAINT fk_profiles_church
FOREIGN KEY (church_id) REFERENCES churches(id) ON UPDATE CASCADE;

ALTER TABLE events
ADD CONSTRAINT fk_events_church
FOREIGN KEY (church_id) REFERENCES churches(id) ON UPDATE CASCADE;

ALTER TABLE church_settings
ADD CONSTRAINT fk_church_settings_church
FOREIGN KEY (church_id) REFERENCES churches(id) ON UPDATE CASCADE;

ALTER TABLE system_logs
ADD CONSTRAINT fk_system_logs_church
FOREIGN KEY (church_id) REFERENCES churches(id) ON UPDATE CASCADE;

-- 10. Add NOT NULL constraints
ALTER TABLE profiles
ALTER COLUMN church_id SET NOT NULL;

ALTER TABLE events
ALTER COLUMN church_id SET NOT NULL;

ALTER TABLE church_settings
ALTER COLUMN church_id SET NOT NULL;

ALTER TABLE system_logs
ALTER COLUMN church_id SET NOT NULL;

-- 11. Add UNIQUE(church_settings.church_id)
ALTER TABLE church_settings
ADD CONSTRAINT uq_church_settings_church_id UNIQUE (church_id);

-- 12. Create get_current_user_church_id() helper function
-- SECURITY DEFINER pattern matching get_current_user_role()
CREATE OR REPLACE FUNCTION get_current_user_church_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
SELECT church_id
FROM profiles
WHERE id = auth.uid()
AND is_active = true
LIMIT 1
$$;
-- 13. Replace/create the tenant-scoped RLS policies

-- Enable RLS on churches
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;

-- churches RLS policies
-- Users can only SELECT their own church
CREATE POLICY "churches_select_own_church"
ON churches
FOR SELECT
TO authenticated
USING (
    id = get_current_user_church_id()
);

-- ADMIN can UPDATE their own church
CREATE POLICY "churches_update_admin_only"
ON churches
FOR UPDATE
TO authenticated
USING (
    get_current_user_role() = 'ADMIN'
    AND id = get_current_user_church_id()
)
WITH CHECK (
    get_current_user_role() = 'ADMIN'
    AND id = get_current_user_church_id()
);

-- Do NOT create DELETE policy for churches (not part of Phase 5A)

-- profiles RLS policies
-- Replace existing policies to maintain the same permission model
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_super_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_super_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_super_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_super_admin" ON profiles;

-- Keep existing permission model:
--   - Any authenticated user can read ONLY their own row
--   - SUPER_ADMIN can read all rows
--   - SUPER_ADMIN can INSERT, UPDATE, DELETE profiles
-- ADMIN does NOT gain user-management capabilities
CREATE POLICY "profiles_select_own"
ON profiles
FOR SELECT
TO authenticated
USING (profiles.id = auth.uid());

CREATE POLICY "profiles_select_super_admin"
ON profiles
FOR SELECT
TO authenticated
USING (get_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "profiles_insert_super_admin"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "profiles_update_super_admin"
ON profiles
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'SUPER_ADMIN')
WITH CHECK (get_current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "profiles_delete_super_admin"
ON profiles
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'SUPER_ADMIN');

-- events RLS policies
-- Preserve existing role behavior and add tenant isolation
DROP POLICY IF EXISTS "events_select_active" ON events;
DROP POLICY IF EXISTS "events_insert_active" ON events;
DROP POLICY IF EXISTS "events_update_active" ON events;
DROP POLICY IF EXISTS "events_delete_super_admin" ON events;

CREATE POLICY "events_select_active"
ON events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
);

CREATE POLICY "events_insert_active"
ON events
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
);

CREATE POLICY "events_update_active"
ON events
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
);

CREATE POLICY "events_delete_super_admin"
ON events
FOR DELETE
TO authenticated
USING (
    get_current_user_role() = 'SUPER_ADMIN'
    AND church_id = get_current_user_church_id()
);

-- church_settings RLS policies
-- Enforce UNIQUE(church_id) and preserve existing permission model
DROP POLICY IF EXISTS "church_settings_select_active" ON church_settings;
DROP POLICY IF EXISTS "church_settings_update_active" ON church_settings;

CREATE POLICY "church_settings_select_active"
ON church_settings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
);

CREATE POLICY "church_settings_update_active"
ON church_settings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
);

-- system_logs RLS policies
-- Keep existing restriction (SUPER_ADMIN only) and add tenant scoping
DROP POLICY IF EXISTS "system_logs_select_super_admin" ON system_logs;
DROP POLICY IF EXISTS "system_logs_insert_super_admin" ON system_logs;

CREATE POLICY "system_logs_select_super_admin"
ON system_logs
FOR SELECT
TO authenticated
USING (
    get_current_user_role() = 'SUPER_ADMIN'
    AND church_id = get_current_user_church_id()
);

CREATE POLICY "system_logs_insert_super_admin"
ON system_logs
FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() = 'SUPER_ADMIN'
    AND church_id = get_current_user_church_id()
);
COMMIT;