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

interface AuthContext {
  userId: string;
  churchId: string;
  role: string;
}

async function authenticateUser(req: Request): Promise<AuthContext | null> {
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

  return { userId: user.id, churchId: profile.church_id, role: profile.role };
}

async function getEventForUser(eventId: string, churchId: string) {
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, description, scheduled_at, church_id, youtube_broadcast_id, youtube_stream_id")
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

async function createYouTubeBroadcast(accessToken: string, title: string, description: string, scheduledStartTime: string): Promise<string | null> {
  const url = "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status";
  const body = { snippet: { title, description, scheduledStartTime }, status: { privacyStatus: "private" } };
  const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await resp.json();
  if (!resp.ok || !data.id) return null;
  return data.id;
}

async function createYouTubeStream(accessToken: string, title: string): Promise<string | null> {
  const url = "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn";
  const body = { snippet: { title: `${title} Stream` }, cdn: { frameRate: "30fps", ingestionType: "rtmp", resolution: "1080p" } };
  const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await resp.json();
  if (!resp.ok || !data.id) return null;
  return data.id;
}

async function bindStreamToBroadcast(accessToken: string, broadcastId: string, streamId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=id,snippet,contentDetails,status`;
  const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.ok;
}

async function verifyBroadcastExists(accessToken: string, broadcastId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${broadcastId}&part=id,snippet,status,contentDetails`;
  const resp = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return false;
  const data = await resp.json();
  return !!(data.items && data.items.length > 0);
}

async function deleteYouTubeBroadcast(accessToken: string, broadcastId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${broadcastId}`;
  const resp = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.ok;
}

async function deleteYouTubeStream(accessToken: string, streamId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/youtube/v3/liveStreams?id=${streamId}`;
  const resp = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.ok;
}

async function verifyStreamExists(accessToken: string, streamId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/youtube/v3/liveStreams?id=${streamId}&part=id,snippet,status,cdn`;
  const resp = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return false;
  const data = await resp.json();
  return !!(data.items && data.items.length > 0);
}

async function verifyBroadcastBoundToStream(accessToken: string, broadcastId: string, streamId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${broadcastId}&part=id,snippet,status,contentDetails`;
  const resp = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return false;
  const data = await resp.json();
  if (!data.items || data.items.length === 0) return false;
  const boundStreamId = data.items[0].contentDetails?.boundStreamId;
  return boundStreamId === streamId;
}

async function updateEventWithYouTubeIds(eventId: string, churchId: string, broadcastId: string, streamId: string): Promise<boolean> {
  const { error } = await supabase
    .from("events")
    .update({ youtube_broadcast_id: broadcastId, youtube_stream_id: streamId, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("church_id", churchId);
  if (error) { console.error("[YT-BROADCAST] db-update-failed", error.message); return false; }
  return true;
}

serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle OPTIONS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({}), { headers: getCorsHeaders(origin), status: 200 });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 });
  }

  // Parse request body
  let eventId: string | null = null;
  try {
    const body = await req.json();
    eventId = body.eventId || null;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }

  if (!eventId) {
    return new Response(JSON.stringify({ error: "Missing eventId" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }

  // 1. Authenticate the caller
  const auth = await authenticateUser(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
  }

  // 2. Verify event belongs to the authenticated user's church
  const event = await getEventForUser(eventId, auth.churchId);
  if (!event) {
    return new Response(JSON.stringify({ error: "Event not found or access denied" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
  }

  // 3. Verify church has a YouTube connection
  const ytConnection = await getYouTubeConnection(auth.churchId);
  if (!ytConnection) {
    return new Response(JSON.stringify({ error: "YouTube not connected for this church" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }

  // 4. Get Google access token using church's refresh token
  const accessToken = await getGoogleAccessToken(ytConnection.refresh_token);
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Failed to obtain Google access token." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }

  // 5. Idempotency check: verify broadcast, stream, AND binding are all valid
  if (event.youtube_broadcast_id && event.youtube_stream_id) {
    const [broadcastValid, streamValid, boundValid] = await Promise.all([
      verifyBroadcastExists(accessToken, event.youtube_broadcast_id),
      verifyStreamExists(accessToken, event.youtube_stream_id),
      verifyBroadcastBoundToStream(accessToken, event.youtube_broadcast_id, event.youtube_stream_id)
    ]);

    if (broadcastValid && streamValid && boundValid) {
      return new Response(
        JSON.stringify({ success: true, broadcastId: event.youtube_broadcast_id, streamId: event.youtube_stream_id, message: "Broadcast already prepared" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    // If incomplete/stale, do NOT auto-delete valid YouTube resources.
    // Proceed to create new resources below; old resources remain until
    // recovered via a new successful preparation.
  }

  // 6. Validate scheduled_at exists, is a valid date, and is in the future
  if (!event.scheduled_at) {
    return new Response(
      JSON.stringify({ error: "Event scheduled_at is missing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  const scheduledDate = new Date(event.scheduled_at);
  if (isNaN(scheduledDate.getTime())) {
    return new Response(
      JSON.stringify({ error: "Event scheduled_at is not a valid date" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  if (scheduledDate <= new Date()) {
    return new Response(
      JSON.stringify({ error: "Event scheduled_at must be in the future" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  const scheduledStartTime = scheduledDate.toISOString();

  // 7. Prepare server-side canonical values from the event record
  const broadcastTitle = event.title || "Livestream";
  const broadcastDescription = event.description || "";

  // 8. Create YouTube broadcast
  const broadcastId = await createYouTubeBroadcast(accessToken, broadcastTitle, broadcastDescription, scheduledStartTime);
  if (!broadcastId) {
    return new Response(JSON.stringify({ error: "Failed to create YouTube broadcast" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }

  // 8. Create YouTube stream
  const streamId = await createYouTubeStream(accessToken, broadcastTitle);
  if (!streamId) {
    await deleteYouTubeBroadcast(accessToken, broadcastId);
    return new Response(JSON.stringify({ error: "Failed to create YouTube stream. Broadcast was cleaned up." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }

  // 9. Bind stream to broadcast
  const bindOk = await bindStreamToBroadcast(accessToken, broadcastId, streamId);
  if (!bindOk) {
    await deleteYouTubeStream(accessToken, streamId);
    await deleteYouTubeBroadcast(accessToken, broadcastId);
    return new Response(JSON.stringify({ error: "Failed to bind stream to broadcast. YouTube resources were cleaned up." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }

  // 10. Update event with YouTube IDs (scoped by church_id)
  const dbOk = await updateEventWithYouTubeIds(eventId, auth.churchId, broadcastId, streamId);
  if (!dbOk) {
    await deleteYouTubeStream(accessToken, streamId);
    await deleteYouTubeBroadcast(accessToken, broadcastId);
    return new Response(JSON.stringify({ error: "Failed to update event record. YouTube resources were cleaned up." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }

  // 11. Success — return minimal safe data
  return new Response(
    JSON.stringify({ success: true, broadcastId, streamId, message: "YouTube broadcast prepared successfully" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});