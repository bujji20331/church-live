-- Phase 6B: Add LOCAL_HELPER to profiles.role CHECK constraint
-- and create local_helper_commands table with RLS and SECURITY DEFINER functions

BEGIN;

-- =============================================================================
-- 1. MODIFY profiles.role CHECK CONSTRAINT TO INCLUDE LOCAL_HELPER
-- =============================================================================

-- Drop the existing auto-generated CHECK constraint (if it exists)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the new named CHECK constraint with LOCAL_HELPER included
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN (
    'SUPER_ADMIN',
    'ADMIN',
    'LOCAL_HELPER'
));

-- =============================================================================
-- 2. CREATE local_helper_commands TABLE
-- =============================================================================

CREATE TABLE local_helper_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id),
    command_type TEXT NOT NULL CHECK (command_type IN ('START_STREAM', 'STOP_STREAM')),
    event_id UUID NOT NULL REFERENCES events(id),
    requested_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    helper_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    idempotency_key UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    obs_result JSONB,
    error_message TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_local_helper_commands_church_id
    ON local_helper_commands(church_id);
CREATE INDEX IF NOT EXISTS idx_local_helper_commands_helper_id
    ON local_helper_commands(helper_id);
CREATE INDEX IF NOT EXISTS idx_local_helper_commands_status
    ON local_helper_commands(status);
CREATE INDEX IF NOT EXISTS idx_local_helper_commands_command_type
    ON local_helper_commands(command_type);
CREATE INDEX IF NOT EXISTS idx_local_helper_commands_event_id
    ON local_helper_commands(event_id);
CREATE INDEX IF NOT EXISTS idx_local_helper_commands_idempotency_key
    ON local_helper_commands(idempotency_key);

-- =============================================================================
-- 3. ADD updated_at TRIGGER (uses existing update_updated_at_column())
-- =============================================================================

CREATE TRIGGER local_helper_commands_updated_at
BEFORE UPDATE ON local_helper_commands
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE local_helper_commands ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS POLICIES
-- =============================================================================

-- SELECT: Active authenticated users within their own church
CREATE POLICY local_helper_commands_select_active
ON local_helper_commands
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

-- INSERT: Only active SUPER_ADMIN and ADMIN can create commands
-- Browser INSERT must have: requested_by = auth.uid(), helper_id IS NULL, status = PENDING
CREATE POLICY local_helper_commands_insert_admin
ON local_helper_commands
FOR INSERT
TO authenticated
WITH CHECK (
    get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
    AND church_id = get_current_user_church_id()
    AND requested_by = auth.uid()
    AND helper_id IS NULL
    AND status = 'PENDING'
    AND EXISTS (
        SELECT 1
        FROM events
        WHERE events.id = event_id
        AND events.church_id = get_current_user_church_id()
    )
);

-- No UPDATE policy for helpers (explicitly omitted)
-- No DELETE policy (explicitly omitted)

-- =============================================================================
-- 6. SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- 6a. create_local_helper_command(...)
-- Only creates a command row. Only callable by SUPER_ADMIN/ADMIN.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_local_helper_command(
    p_church_id UUID,
    p_command_type TEXT,
    p_event_id UUID,
    p_idempotency_key UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_role TEXT;
    v_is_active BOOLEAN;
    v_church_id UUID;
    v_command_id UUID;
BEGIN
    -- Verify authenticated user is active SUPER_ADMIN or ADMIN
    SELECT role, is_active, church_id INTO v_role, v_is_active, v_church_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF auth.uid() IS NULL
        OR v_is_active IS DISTINCT FROM TRUE
        OR v_role NOT IN ('SUPER_ADMIN', 'ADMIN')
        OR v_church_id IS NULL THEN
        RAISE EXCEPTION 'Only active SUPER_ADMIN or ADMIN can create commands';
    END IF;

    IF p_church_id <> v_church_id THEN
        RAISE EXCEPTION 'Cannot create command for a different church';
    END IF;

    IF p_command_type NOT IN ('START_STREAM', 'STOP_STREAM') THEN
        RAISE EXCEPTION 'Invalid command_type: must be START_STREAM or STOP_STREAM';
    END IF;

    -- Event/church isolation: event must belong to the same church
    IF NOT EXISTS (
        SELECT 1
        FROM events
        WHERE id = p_event_id
          AND church_id = v_church_id
    ) THEN
        RAISE EXCEPTION 'Event not found in current church';
    END IF;

    INSERT INTO local_helper_commands (
        church_id,
        command_type,
        event_id,
        requested_by,
        helper_id,
        status,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES (
        p_church_id,
        p_command_type,
        p_event_id,
        auth.uid(),
        NULL,
        'PENDING',
        p_idempotency_key,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_command_id;

    RETURN v_command_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_local_helper_command(UUID, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_local_helper_command(UUID, TEXT, UUID, UUID) TO authenticated;

-- 6b. claim_local_helper_command(p_command_id UUID)
-- Atomically transitions PENDING -> CLAIMED, setting helper_id and claimed_at.
-- Verifies: authenticated user, active profile, LOCAL_HELPER role, same church,
--           helper_id IS NULL, command is PENDING, command is not expired.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_local_helper_command(
    p_command_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_helper_id UUID;
    v_church_id UUID;
    v_role TEXT;
    v_is_active BOOLEAN;
    v_current_status TEXT;
    v_current_helper_id UUID;
    v_current_church_id UUID;
    v_current_expires_at TIMESTAMPTZ;
BEGIN
    v_helper_id := auth.uid();

    -- Verify authenticated user profile exists, is active, and has LOCAL_HELPER role
    SELECT church_id, role, is_active INTO v_church_id, v_role, v_is_active
    FROM profiles
    WHERE id = v_helper_id
    LIMIT 1;

    IF auth.uid() IS NULL
        OR v_is_active IS DISTINCT FROM TRUE
        OR v_church_id IS NULL THEN
        RAISE EXCEPTION 'Helper not found or inactive';
    END IF;

    IF v_role <> 'LOCAL_HELPER' THEN
        RAISE EXCEPTION 'Only LOCAL_HELPER role can claim commands';
    END IF;

    -- Lock and read the command row
    SELECT status, helper_id, church_id, expires_at
    INTO v_current_status, v_current_helper_id, v_current_church_id, v_current_expires_at
    FROM local_helper_commands
    WHERE id = p_command_id
    FOR UPDATE;

    -- Check command exists
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Command not found';
    END IF;

    -- Church isolation
    IF v_current_church_id <> v_church_id THEN
        RAISE EXCEPTION 'Command not in helper''s church';
    END IF;

    -- Must be PENDING
    IF v_current_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Command is not PENDING';
    END IF;

    -- Must not be claimed by another helper
    IF v_current_helper_id IS NOT NULL THEN
        RAISE EXCEPTION 'Command already claimed by another helper';
    END IF;

    -- Must not be expired
    IF v_current_expires_at IS NOT NULL AND v_current_expires_at < NOW() THEN
        RAISE EXCEPTION 'Command has expired';
    END IF;

    -- Atomically transition: PENDING -> CLAIMED
    UPDATE local_helper_commands
    SET helper_id = v_helper_id,
        status = 'CLAIMED',
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_command_id;

    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_local_helper_command(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_local_helper_command(UUID) TO authenticated;

-- 6c. transition_local_helper_command_status(p_command_id UUID, p_new_status TEXT, p_obs_result JSONB DEFAULT NULL, p_error_message TEXT DEFAULT NULL)
-- Enforces: CLAIMED -> RUNNING, and RUNNING -> SUCCEEDED / FAILED.
-- Verifies authenticated LOCAL_HELPER owns the command and belongs to same church.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION transition_local_helper_command_status(
    p_command_id UUID,
    p_new_status TEXT,
    p_obs_result JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_helper_id UUID;
    v_church_id UUID;
    v_role TEXT;
    v_is_active BOOLEAN;
    v_current_status TEXT;
    v_current_helper_id UUID;
    v_current_church_id UUID;
BEGIN
    -- Validate target status
    IF p_new_status NOT IN ('RUNNING', 'SUCCEEDED', 'FAILED') THEN
        RAISE EXCEPTION 'Invalid target status: must be RUNNING, SUCCEEDED, or FAILED';
    END IF;

    v_helper_id := auth.uid();

    -- Verify authenticated user profile
    SELECT church_id, role, is_active INTO v_church_id, v_role, v_is_active
    FROM profiles
    WHERE id = v_helper_id
    LIMIT 1;

    IF auth.uid() IS NULL
        OR v_is_active IS DISTINCT FROM TRUE
        OR v_church_id IS NULL THEN
        RAISE EXCEPTION 'Helper not found or inactive';
    END IF;

    IF v_role <> 'LOCAL_HELPER' THEN
        RAISE EXCEPTION 'Only LOCAL_HELPER role can transition command status';
    END IF;

    -- Lock the command row
    SELECT status, helper_id, church_id
    INTO v_current_status, v_current_helper_id, v_current_church_id
    FROM local_helper_commands
    WHERE id = p_command_id
    FOR UPDATE;

    -- Check command exists
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Command not found';
    END IF;

    -- Strict church isolation
    IF v_current_church_id <> v_church_id THEN
        RAISE EXCEPTION 'Command not in helper''s church';
    END IF;

    -- Ownership check
    IF v_current_helper_id <> v_helper_id THEN
        RAISE EXCEPTION 'Command not owned by this helper';
    END IF;

    -- Handle allowed transitions
    IF p_new_status = 'RUNNING' THEN
        -- CLAIMED -> RUNNING
        IF v_current_status <> 'CLAIMED' THEN
            RAISE EXCEPTION 'Command must be in CLAIMED state to transition to RUNNING';
        END IF;

        UPDATE local_helper_commands
        SET status = 'RUNNING',
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = p_command_id;

    ELSIF p_new_status = 'SUCCEEDED' THEN
        -- RUNNING -> SUCCEEDED
        IF v_current_status <> 'RUNNING' THEN
            RAISE EXCEPTION 'Command must be in RUNNING state to transition to SUCCEEDED';
        END IF;

        UPDATE local_helper_commands
        SET status = 'SUCCEEDED',
            completed_at = NOW(),
            updated_at = NOW(),
            obs_result = p_obs_result,
            error_message = p_error_message
        WHERE id = p_command_id;

    ELSIF p_new_status = 'FAILED' THEN
        -- RUNNING -> FAILED
        IF v_current_status <> 'RUNNING' THEN
            RAISE EXCEPTION 'Command must be in RUNNING state to transition to FAILED';
        END IF;

        UPDATE local_helper_commands
        SET status = 'FAILED',
            completed_at = NOW(),
            updated_at = NOW(),
            obs_result = p_obs_result,
            error_message = p_error_message
        WHERE id = p_command_id;
    END IF;

    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION transition_local_helper_command_status(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_local_helper_command_status(UUID, TEXT, JSONB, TEXT) TO authenticated;

-- No create_local_helper(...) function. Auth-user provisioning not implemented.

-- =============================================================================
-- COMMIT
-- =============================================================================

COMMIT;
