import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const ALLOWED_ORIGINS = ["http://localhost:8000", "https://bujji20331.github.io"];

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  return {};
}

interface AdminAuth {
  userId: string;
  churchId: string;
}

async function authenticateAdminUser(req: Request): Promise<AdminAuth | null> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, church_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  if (profile.role !== "SUPER_ADMIN" && profile.role !== "ADMIN") return null;
  if (!profile.church_id) return null;

  return { userId: user.id, churchId: profile.church_id };
}



async function getEventForChurch(eventId: string, churchId: string) {
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, description, scheduled_at, church_id, youtube_broadcast_id, youtube_stream_id, streaming_mode")
    .eq("id", eventId)
    .eq("church_id", churchId)
    .maybeSingle();
  if (error || !event) return null;
  return event;
}

async function getYouTubeConnection(churchId: string) {
  const { data, error } = await supabase
    .from("youtube_connections")
    .select("id, church_id, channel_id, channel_title, refresh_token, connected_at")
    .eq("church_id", churchId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function getGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const postBody = new URLSearchParams({
    client_id: Deno.env.get("YOUTUBE_CLIENT_ID")!,
    client_secret: Deno.env.get("YOUTUBE_CLIENT_SECRET")!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokenResp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: postBody,
  });
  const tokenData = await tokenResp.json();
  if (tokenData.error || !tokenData.access_token) return null;
  return tokenData.access_token;
}

async function getYouTubeStreamConfig(accessToken: string, streamId: string) {
  const url = `https://www.googleapis.com/youtube/v3/liveStreams?part=cdn&id=${streamId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (data.error || !data.items || data.items.length === 0) return null;
  const stream = data.items[0];
  const cdn = stream.cdn;
  if (!cdn || !cdn.ingestionInfo) return null;
  return cdn.ingestionInfo;
}
serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(
      JSON.stringify({}),
      { headers: getCorsHeaders(origin), status: 200 }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const auth = await authenticateAdminUser(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: SUPER_ADMIN or ADMIN authentication required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const body = await req.json();
    const eventId = body.eventId;
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "eventId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get event and verify it belongs to this church
    const event = await getEventForChurch(eventId, auth.churchId);
    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event not found or access denied" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Verify event has streaming_mode = 'PHONE_RTMP'
    if (event.streaming_mode !== 'PHONE_RTMP') {
      return new Response(
        JSON.stringify({ error: "Event is not configured for PHONE_RTMP streaming" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify event has a YouTube stream ID
    if (!event.youtube_stream_id) {
      return new Response(
        JSON.stringify({ error: "Event does not have a YouTube stream ID. Prepare the broadcast first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get YouTube connection for this church
    const ytConnection = await getYouTubeConnection(auth.churchId);
    if (!ytConnection || !ytConnection.refresh_token) {
      return new Response(
        JSON.stringify({ error: "YouTube not connected for this church" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get Google access token using refresh token (server-side only)
    const accessToken = await getGoogleAccessToken(ytConnection.refresh_token);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to obtain YouTube access token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Get YouTube stream configuration (ingestion info)
    const ingestionInfo = await getYouTubeStreamConfig(accessToken, event.youtube_stream_id);
    if (!ingestionInfo) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve YouTube stream ingestion configuration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Return ONLY the minimum phone encoder configuration needed.
    // Prefer YouTube's RTMPS ingestion address when available.
    const serverUrl = ingestionInfo.rtmpsIngestionAddress || ingestionInfo.ingestionAddress;
    const streamKey = ingestionInfo.streamName;

    return new Response(
      JSON.stringify({
        success: true,
        streamConfig: {
          serverUrl: serverUrl,
          streamKey: streamKey,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[youtube-phone-rtmp-config] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});