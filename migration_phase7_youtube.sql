-- Phase 7: YouTube OAuth Connection
-- Adds secure YouTube OAuth connection with refresh token storage
-- The refresh token is never exposed to the frontend via RLS
-- OAuth state records are NOT accessible to browser clients

BEGIN;

-- Create table to store YouTube connection data
CREATE TABLE IF NOT EXISTS youtube_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE UNIQUE,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_token TEXT NOT NULL
);

-- Create a safe view that excludes the refresh_token for frontend access
-- and enforces tenant isolation using the existing Church Live architecture
CREATE OR REPLACE VIEW youtube_connections_safe AS
  SELECT id, church_id, channel_id, channel_title, connected_at
  FROM youtube_connections
  WHERE church_id = get_current_user_church_id();

-- Create OAuth state table for secure state management
-- States are cryptographically random, server-generated, tied to user/church,
-- short-lived (10 minutes), single-use, and validated server-side
CREATE TABLE IF NOT EXISTS youtube_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- Enable Row Level Security on the table (we restrict direct access)
ALTER TABLE youtube_connections ENABLE ROW LEVEL SECURITY;

-- Enable RLS on OAuth state table (service_role bypasses RLS)
ALTER TABLE youtube_oauth_states ENABLE ROW LEVEL SECURITY;

-- By default, no policies = no access via anon/authenticated roles (service_role bypasses RLS)
-- The youtube_connections_safe view SELECT was granted separately in prior phases

-- NO policies on youtube_oauth_states = no browser access (service_role only)
-- NO policies on youtube_connections = no browser direct access (service_role only)

-- Grant SELECT on the safe view to the frontend via publishable key
GRANT SELECT ON youtube_connections_safe TO anon, authenticated;

COMMIT;
