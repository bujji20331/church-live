-- Phase 8A: YouTube Broadcast Preparation
-- Adds youtube_stream_id to events table for storing YouTube stream ID
-- The youtube_broadcast_id already exists in the base schema (docs/supabase-schema.sql)

BEGIN;

-- Add youtube_stream_id column to events table
-- This stores the YouTube stream ID for Local Helper/OBS integration
-- It is separate from youtube_broadcast_id which is the broadcast ID
ALTER TABLE events ADD COLUMN IF NOT EXISTS youtube_stream_id TEXT;

COMMENT ON COLUMN events.youtube_stream_id IS
  'YouTube stream ID for the livestream (used by Local Helper/OBS for RTMP ingestion).';

COMMIT;