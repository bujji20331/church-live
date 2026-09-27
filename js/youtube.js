/**
 * CHURCH LIVE - YOUTUBE INTEGRATION MODULE
 * Handles YouTube OAuth connection via Supabase Edge Function.
 */

let _youtubeConnectionStatus = { connected: false, channelId: null, channelTitle: null, connectedAt: null };

async function initYouTube() {
  await checkConnectionStatus();
  updateYouTubeUI();
}

async function checkConnectionStatus() {
  if (!window.churchLiveSupabase?.isReady()) return;
  try {
    const churchId = await getCurrentChurchId();
    if (!churchId) return;
    const { data, error } = await window.churchLiveSupabase.getClient()
      .from("youtube_connections_safe")
      .select("channel_id, channel_title, connected_at")
      .eq("church_id", churchId)
      .maybeSingle();
    if (error) { _youtubeConnectionStatus = { connected: false, channelId: null, channelTitle: null, connectedAt: null }; return; }
    if (data) { _youtubeConnectionStatus = { connected: true, channelId: data.channel_id, channelTitle: data.channel_title, connectedAt: data.connected_at }; }
    else { _youtubeConnectionStatus = { connected: false, channelId: null, channelTitle: null, connectedAt: null }; }
  } catch (e) { _youtubeConnectionStatus = { connected: false, channelId: null, channelTitle: null, connectedAt: null }; }
}

async function connectYouTube() {
  const supabase = window.churchLiveSupabase.getClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return;
  const { success, data: roleData } = await window.churchLiveSupabase.roles.getCurrentUserRole();
  const profileResult = await window.churchLiveSupabase.auth.getCurrentProfile();
  const isActive = profileResult?.data?.is_active === true;
  const isSuperAdmin = success && roleData?.role === "SUPER_ADMIN";
  if (!isSuperAdmin || !isActive) { alert("Only active SUPER_ADMIN users can connect YouTube."); return; }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) { alert("Session expired. Please log in again."); return; }
  try {
    const edgeUrl = window.churchLiveConfig.config.supabase.url + "/functions/v1/youtube-oauth/authUrl";
    const response = await fetch(edgeUrl, { method: "GET", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" } });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (data.authUrl) window.location.href = data.authUrl;
  } catch (error) { alert("Failed to start YouTube connection: " + error.message); }
}

async function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code"); const state = urlParams.get("state"); const error = urlParams.get("error");
  if (error) { alert("YouTube connection failed: " + error); return false; }
  if (!code || !state) return false;
  try {
    const edgeUrl = window.churchLiveConfig.config.supabase.url + "/functions/v1/youtube-oauth/callback?code=" + encodeURIComponent(code) + "&state=" + encodeURIComponent(state);
    const response = await fetch(edgeUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    await checkConnectionStatus(); updateYouTubeUI();
    alert("YouTube connected successfully!");
  } catch (error) { alert("Failed to complete YouTube connection: " + error.message); }
}

function getConnectionStatus() { return Object.assign({}, _youtubeConnectionStatus); }

function updateYouTubeUI() {
  const status = _youtubeConnectionStatus;
  const statusEl = document.getElementById("status-youtube");
  const detailEl = document.getElementById("youtube-detail");
  const connectBtn = document.getElementById("btn-connect-youtube");
  const settingsInput = document.getElementById("youtube-channel-id");
  if (statusEl) { statusEl.classList.toggle("status-on", status.connected); statusEl.classList.toggle("status-off", !status.connected); const dot = statusEl.querySelector(".status-dot"); if (dot) dot.classList.toggle("connected", status.connected); const text = statusEl.querySelector(".status-text"); if (text) text.textContent = status.connected ? "Connected" : "Not Connected"; }
  if (detailEl) { detailEl.textContent = status.connected ? "YouTube connected: " + (status.channelTitle || status.channelId) + " (" + new Date(status.connectedAt).toLocaleDateString() + ")" : "YouTube not connected"; }
  if (connectBtn) { if (status.connected) { connectBtn.textContent = "Reconnect YouTube"; connectBtn.disabled = false; connectBtn.classList.add("btn-success"); connectBtn.classList.remove("btn-primary"); } else { connectBtn.textContent = "Connect YouTube"; connectBtn.disabled = false; connectBtn.classList.add("btn-primary"); connectBtn.classList.remove("btn-success"); } }
  if (settingsInput && status.connected && status.channelId) { settingsInput.value = status.channelId; settingsInput.readOnly = true; }
  const stepYtReady = document.getElementById("step-yt-ready"); if (stepYtReady) stepYtReady.classList.toggle("checked", status.connected);
}

async function getCurrentChurchId() {
  if (!window.churchLiveSupabase?.isReady()) return null;
  try { const { data, error } = await window.churchLiveSupabase.getClient().rpc("get_current_user_church_id"); if (error) return null; return data; } catch (e) { return null; }
}

window.churchLiveYouTube = { init: initYouTube, connect: connectYouTube, handleOAuthCallback: handleOAuthCallback, getConnectionStatus: getConnectionStatus, updateYouTubeUI: updateYouTubeUI };
console.log("[Church Live] YouTube module loaded");