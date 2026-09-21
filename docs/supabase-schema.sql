-- =============================================================================
-- CHURCH LIVE — SUPABASE DATABASE SCHEMA
-- Phase 2.5: Event/Livestream Architecture Revision
-- 
-- This file defines the database structure for Church Live.
-- It is prepared for Phase 3, when the application will connect to Supabase.
-- 
-- IMPORTANT:
-- - Do not run this against a production database without review.
-- - Row Level Security (RLS) should be enabled on all tables.
-- - Service-role keys must NEVER be used in frontend code.
-- - This schema is designed for a static frontend on GitHub Pages.
-- - No YouTube OAuth secrets, tokens, or API keys are stored in this schema.
-- =============================================================================

-- =============================================================================
-- 1. CHURCH SETTINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS church_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name TEXT NOT NULL DEFAULT 'Church Live',
  default_event_title TEXT NOT NULL DEFAULT 'Sunday Worship Service',
  default_event_description TEXT,
  youtube_channel_id TEXT,
  youtube_connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE church_settings IS
  'Core configuration settings for the Church Live application, including default event values and YouTube connection status.';

COMMENT ON COLUMN church_settings.church_name IS
  'Display name of the church.';

COMMENT ON COLUMN church_settings.default_event_title IS
  'Default title used when creating a new event.';

COMMENT ON COLUMN church_settings.default_event_description IS
  'Default description used when creating a new event.';

COMMENT ON COLUMN church_settings.youtube_channel_id IS
  'YouTube channel ID used for livestreaming.';

COMMENT ON COLUMN church_settings.youtube_connected IS
  'Whether the church YouTube channel is connected and authorized.';

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER church_settings_updated_at
BEFORE UPDATE ON church_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. EVENTS
-- =============================================================================

-- Event types supported by Church Live
CREATE TYPE event_type_enum AS ENUM (
  'SUNDAY_SERVICE',
  'BIBLE_STUDY',
  'PRAYER_MEETING',
  'SPECIAL_EVENT',
  'OTHER'
);

-- Streaming modes supported by Church Live
CREATE TYPE streaming_mode_enum AS ENUM (
  'CHURCH_EQUIPMENT',
  'PHONE_REMOTE',
  'COMPUTER_REMOTE',
  'OBS',
  'OTHER'
);

-- Video source options for future events
CREATE TYPE video_source_enum AS ENUM (
  'CHURCH_CAMERA',
  'PHONE_CAMERA',
  'COMPUTER_CAMERA',
  'OBS',
  'OTHER'
);

-- Audio source options for future events
CREATE TYPE audio_source_enum AS ENUM (
  'YAMAHA_MIXER',
  'PHONE_MIC',
  'COMPUTER_MIC',
  'USB_AUDIO',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type event_type_enum NOT NULL DEFAULT 'SUNDAY_SERVICE',
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'LIVE', 'ENDED')),
  streaming_mode streaming_mode_enum NOT NULL DEFAULT 'CHURCH_EQUIPMENT',
  video_source video_source_enum,
  audio_source audio_source_enum,
  youtube_broadcast_id TEXT,
  youtube_video_id TEXT,
  youtube_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events IS
  'Church event/livestream records. This is the central concept for all types of church gatherings that may be streamed, including Sunday services, Bible studies, prayer meetings, and special events.';

COMMENT ON COLUMN events.title IS
  'Title of the church event.';

COMMENT ON COLUMN events.description IS
  'Description of the church event.';

COMMENT ON COLUMN events.event_type IS
  'The type of church event: Sunday Service, Bible Study, Prayer Meeting, Special Event, or Other.';

COMMENT ON COLUMN events.scheduled_at IS
  'Scheduled start time of the event.';

COMMENT ON COLUMN events.started_at IS
  'Actual start time of the event.';

COMMENT ON COLUMN events.ended_at IS
  'Actual end time of the event.';

COMMENT ON COLUMN events.status IS
  'Lifecycle status of the event: DRAFT, READY, LIVE, or ENDED.';

COMMENT ON COLUMN events.streaming_mode IS
  'How the event will be streamed: Church equipment, phone remote, computer remote, OBS, or other.';

COMMENT ON COLUMN events.video_source IS
  'The video source for the event: church camera, phone camera, computer camera, OBS, or other.';

COMMENT ON COLUMN events.audio_source IS
  'The audio source for the event: Yamaha mixer, phone mic, computer mic, USB audio, or other.';

COMMENT ON COLUMN events.youtube_broadcast_id IS
  'YouTube broadcast ID for the livestream.';

COMMENT ON COLUMN events.youtube_video_id IS
  'YouTube video ID for the archived livestream.';

-- =============================================================================
-- 3. SYSTEM LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system_logs IS
  'System event logs for troubleshooting and auditing Church Live operations. Records events such as event creation, preparation, encoder start/stop, YouTube connection changes, livestream start/end, and errors.';

COMMENT ON COLUMN system_logs.event_id IS
  'The event associated with this log entry, if any.';

COMMENT ON COLUMN system_logs.event_type IS
  'Type of system event (e.g., event_created, event_prepared, encoder_started, encoder_stopped, youtube_connected, youtube_disconnected, livestream_started, livestream_ended, error).';

COMMENT ON COLUMN system_logs.message IS
  'Human-readable description of the event.';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_system_logs_event_id ON system_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================
--
-- Phase 3 RLS Configuration
-- ----------------------------
-- IMPORTANT: Anonymous access to `events` table is TEMPORARY for the Phase 3 demo.
-- In a future phase (when authentication is implemented), these policies MUST be
-- replaced with authenticated user policies that restrict access to authorized
-- church volunteers only. The publishable key alone does not provide security;
-- RLS policies enforce it.
--
-- Enable RLS on all tables.
ALTER TABLE church_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- church_settings
-- -----------------------------------------------------------------------------
-- Minimum anonymous access: read-only (SELECT) for frontend to load defaults.
-- No INSERT/UPDATE policies created — frontend does not modify settings in Phase 3.
-- -----------------------------------------------------------------------------

-- Allow anonymous read access to church_settings
CREATE POLICY "Allow anonymous read access to church_settings"
ON church_settings
FOR SELECT
TO anon
USING (true);

-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
-- Anonymous access allowed for Phase 3 demo: SELECT, INSERT, UPDATE.
-- DELETE is NOT allowed for anonymous users.
-- TEMPORARY: These policies use 'anon' role. Replace with authenticated policies
-- when volunteer authentication is implemented (future phase).
-- -----------------------------------------------------------------------------

-- Allow anonymous read access to events
CREATE POLICY "Allow anonymous read access to events"
ON events
FOR SELECT
TO anon
USING (true);

-- Allow anonymous insert access to events
CREATE POLICY "Allow anonymous insert access to events"
ON events
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous update access to events
CREATE POLICY "Allow anonymous update access to events"
ON events
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- system_logs
-- -----------------------------------------------------------------------------
-- No anonymous access policies created.
-- Frontend does not read or create logs in Phase 3 (logs are for internal
-- troubleshooting/auditing). Access will be restricted to authenticated
-- administrators in future phases.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 5. FUTURE EXTENSIONS (NOT IMPLEMENTED IN PHASE 2.5)
-- =============================================================================

-- The following tables may be added in future phases:
-- - users / user_profiles
-- - event_schedules
-- - hardware_devices
-- - stream_events
-- - analytics
-- - remote_participants


COMMENT ON COLUMN events.youtube_url IS
  'YouTube URL for the livestream or archive.';

COMMENT ON COLUMN events.created_by IS
  'User who created the event record.';

CREATE TRIGGER events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_scheduled_at ON events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

