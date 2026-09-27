import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// Allowed origins for CORS
const ALLOWED_ORIGINS = ["http://localhost:8000", "https://bujji20331.github.io"];

// Helper to build CORS headers for allowed origins
function getCorsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };
  }
  return {};
}

async function authenticateUser(req: Request): Promise<{ userId: string; churchId: string } | null> {
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

  if (!profile || !profile.is_active || profile.role !== "SUPER_ADMIN") return null;
  if (!profile.church_id) return null;

  return { userId: user.id, churchId: profile.church_id };
}

serve(async (req) => {
  const url = new URL(req.url);
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle OPTIONS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(
      JSON.stringify({}),
      {
        headers: getCorsHeaders(origin),
        status: 200,
      }
    );
  }

  if (req.method === "GET" && url.pathname === "/youtube-oauth/authUrl") {
    const auth = await authenticateUser(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { userId, churchId } = auth;

    const stateToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: stateError } = await supabase
      .from("youtube_oauth_states")
      .insert({
        state_token: stateToken,
        user_id: userId,
        church_id: churchId,
        expires_at: expiresAt.toISOString(),
      });

    if (stateError) {
      return new Response(
        JSON.stringify({ error: "Failed to create OAuth state" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const clientId = Deno.env.get("YOUTUBE_CLIENT_ID")!;
    const redirectUri = Deno.env.get("SUPABASE_URL") + "/functions/v1/youtube-oauth/callback";

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.force-ssl",
      access_type: "offline",
      state: stateToken,
      prompt: "consent"
    });

    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + authParams;

    return new Response(
      JSON.stringify({ authUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }

  if (req.method === "GET" && url.pathname === "/youtube-oauth/callback") {
    const code = url.searchParams.get("code");
    const stateToken = url.searchParams.get("state");

    if (!code || !stateToken) {
      return new Response(
        JSON.stringify({ error: "Missing code or state" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: stateRow, error: stateError } = await supabase
      .from("youtube_oauth_states")
      .select("*")
      .eq("state_token", stateToken)
      .maybeSingle();

    if (stateError || !stateRow) {
      return new Response(
        JSON.stringify({ error: "Invalid state token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (new Date(stateRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "State token expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (stateRow.used_at) {
      return new Response(
        JSON.stringify({ error: "State token already used" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { error: markError } = await supabase
      .from("youtube_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state_token", stateToken)
      .is("used_at", null);

    if (markError) {
      return new Response(
        JSON.stringify({ error: "Failed to mark state as used" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const churchId = stateRow.church_id;

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const postBody = new URLSearchParams({
      client_id: Deno.env.get("YOUTUBE_CLIENT_ID")!,
      client_secret: Deno.env.get("YOUTUBE_CLIENT_SECRET")!,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: Deno.env.get("SUPABASE_URL") + "/functions/v1/youtube-oauth/callback"
    });

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postBody
    });

    const tokenData = await tokenResp.json();

    if (tokenData.error) {
      return new Response(
        JSON.stringify({ error: "Token exchange failed: " + tokenData.error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const { refresh_token } = tokenData;

    // Retrieve the authenticated YouTube channel using the access token
    let channelId = "";
    let channelTitle = "";
    const channelsResp = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    if (!channelsResp.ok) {
      const errBody = await channelsResp.text();
      console.error("YouTube channels lookup failed:", channelsResp.status, errBody);
      return new Response(
        JSON.stringify({ error: "YouTube channel lookup failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const channelsData = await channelsResp.json();
    if (!channelsData.items || channelsData.items.length === 0 || !channelsData.items[0].id) {
      console.error("YouTube channels lookup returned no valid channel");
      return new Response(
        JSON.stringify({ error: "No YouTube channel found for this account" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    channelId = channelsData.items[0].id;
    channelTitle = channelsData.items[0].snippet?.title || "";

    const { error } = await supabase
      .from("youtube_connections")
      .upsert(
        {
          church_id: churchId,
          channel_id: channelId,
          channel_title: channelTitle,
          connected_at: new Date().toISOString(),
          refresh_token: refresh_token
        },
        { onConflict: "church_id" }
      );

    if (error) {
      console.error("Supabase upsert error:", error);
      return new Response(
        JSON.stringify({ error: "Database error: " + error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:8000";
    return new Response(null, {
      headers: { Location: frontendUrl },
      status: 302
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 404
  });
});