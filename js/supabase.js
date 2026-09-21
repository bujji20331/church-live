/**
 * CHURCH LIVE — SUPABASE INTEGRATION MODULE (Phase 3)
 * 
 * Connects the Church Live frontend to Supabase using the new API key system.
 * 
 * IMPORTANT:
 * - Use the Supabase Publishable Key (sb_publishable_...) for browser-side access
 * - NEVER use a service-role or secret key in frontend code
 * - Security comes from Row Level Security (RLS), not from hiding the publishable key
 * - The publishable key is expected to be visible to the browser on GitHub Pages
 */

/**
 * Supabase configuration (new API key system)
 * The publishable key is supplied at runtime from config.js or a local override.
 */
const supabaseConfig = {
  url: 'https://dwvbjfgviidcdogkdxku.supabase.co',
  publishableKey: '', // Set via config.js or local runtime override
  initialized: false,
  connectionError: null
};

/**
 * Supabase client instance.
 * Created lazily when the Supabase client library is available.
 */
let supabaseClient = null;

/**
 * Initialize Supabase client.
 * 
 * The Supabase JS client is loaded from CDN in index.html. The publishable
 * key is safe for browser use and is expected to be visible on GitHub Pages.
 * 
 * @param {Object} config - Configuration object with url and publishableKey
 * @returns {Object|null} The Supabase client or null if initialization fails
 */
function initSupabase(config) {
  const configToUse = config || window.churchLiveConfig?.config?.supabase || {};
  const url = configToUse.url || supabaseConfig.url;
  const publishableKey = configToUse.publishableKey || supabaseConfig.publishableKey;

  if (!url || !publishableKey) {
    const message = 'Supabase is not configured. Please provide the Supabase Publishable Key.';
    supabaseConfig.connectionError = message;
    console.error('[Church Live]', message);
    return null;
  }

  // Supabase JS client is loaded from CDN in index.html.
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    const message = 'Supabase client library is not available. Check the CDN script in index.html.';
    supabaseConfig.connectionError = message;
    console.error('[Church Live]', message);
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    supabaseConfig.url = url;
    supabaseConfig.publishableKey = publishableKey;
    supabaseConfig.initialized = true;
    supabaseConfig.connectionError = null;

    console.log('[Church Live] Supabase client initialized with Publishable Key (Phase 3).');
    return supabaseClient;
  } catch (error) {
    const message = 'Unable to initialize Supabase client.';
    supabaseConfig.connectionError = message;
    console.error('[Church Live]', message, error);
    return null;
  }
}

/**
 * Get the Supabase client instance.
 * @returns {Object|null} The Supabase client or null if not initialized
 */
function getSupabaseClient() {
  return supabaseClient;
}

/**
 * Check if Supabase is connected and ready.
 * @returns {boolean}
 */
function isSupabaseReady() {
  return supabaseConfig.initialized && supabaseClient !== null;
}

/**
 * Get the current Supabase connection error, if any.
 * @returns {string|null}
 */
function getSupabaseConnectionError() {
  return supabaseConfig.connectionError;
}

/**
 * Normalize a Supabase result into a consistent response object.
 * @param {Object} data
 * @param {Object|null} error
 * @returns {Object}
 */
function normalizeResult(data, error) {
  return {
    success: !error,
    data: data || null,
    error: error || null
  };
}

/**
 * Convert a Supabase datetime-local value to an ISO string.
 * @param {string} value
 * @returns {string|null}
 */
function toIsoDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Convert a database event row to the shape used by the dashboard.
 * @param {Object} event
 * @returns {Object}
 */
function normalizeEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    title: event.title || '',
    description: event.description || '',
    eventType: event.event_type || 'OTHER',
    scheduledAt: event.scheduled_at || null,
    startedAt: event.started_at || null,
    endedAt: event.ended_at || null,
    status: event.status || 'DRAFT',
    streamingMode: event.streaming_mode || 'CHURCH_EQUIPMENT',
    videoSource: event.video_source || 'CHURCH_CAMERA',
    audioSource: event.audio_source || 'YAMAHA_MIXER',
    youtubeBroadcastId: event.youtube_broadcast_id || null,
    youtubeVideoId: event.youtube_video_id || null,
    youtubeUrl: event.youtube_url || null,
    createdBy: event.created_by || null,
    createdAt: event.created_at || null,
    updatedAt: event.updated_at || null
  };
}

/**
 * Convert dashboard event data to database column names.
 * @param {Object} eventData
 * @returns {Object}
 */
function toEventColumns(eventData) {
  return {
    title: eventData.title || '',
    description: eventData.description || null,
    event_type: eventData.eventType || eventData.event_type || 'OTHER',
    scheduled_at: toIsoDateTime(eventData.scheduledAt || eventData.scheduled_at),
    started_at: toIsoDateTime(eventData.startedAt || eventData.started_at),
    ended_at: toIsoDateTime(eventData.endedAt || eventData.ended_at),
    status: eventData.status || 'DRAFT',
    streaming_mode: eventData.streamingMode || eventData.streaming_mode || 'CHURCH_EQUIPMENT',
    video_source: eventData.videoSource || eventData.video_source || 'CHURCH_CAMERA',
    audio_source: eventData.audioSource || eventData.audio_source || 'YAMAHA_MIXER',
    youtube_broadcast_id: eventData.youtubeBroadcastId || eventData.youtube_broadcast_id || null,
    youtube_video_id: eventData.youtubeVideoId || eventData.youtube_video_id || null,
    youtube_url: eventData.youtubeUrl || eventData.youtube_url || null
  };
}

/**
 * Convert database settings row to the shape used by the dashboard.
 * @param {Object} settings
 * @returns {Object}
 */
function normalizeSettings(settings) {
  if (!settings) return null;
  return {
    id: settings.id,
    churchName: settings.church_name || 'Church Live',
    defaultEventTitle: settings.default_event_title || 'Sunday Worship Service',
    defaultEventDescription: settings.default_event_description || '',
    youtubeChannelId: settings.youtube_channel_id || null,
    youtubeConnected: settings.youtube_connected || false,
    createdAt: settings.created_at || null,
    updatedAt: settings.updated_at || null
  };
}

// =============================================================================
// Church Settings
// =============================================================================

/**
 * Get church settings from Supabase.
 * @returns {Promise<Object>}
 */
async function getChurchSettings() {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: null,
      error: { message: 'Supabase is not connected.' }
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('church_settings')
      .select('*')
      .single();

    if (error) throw error;
    return normalizeResult(data ? normalizeSettings(data) : null, null);
  } catch (error) {
    console.error('[Church Live] Failed to load church settings:', error);
    return normalizeResult(null, error);
  }
}

/**
 * Update church settings in Supabase.
 * @param {Object} settings
 * @returns {Promise<Object>}
 */
async function updateChurchSettings(settings) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: null,
      error: { message: 'Supabase is not connected.' }
    };
  }

  const updateData = {
    church_name: settings.churchName || settings.church_name,
    default_event_title: settings.defaultEventTitle || settings.default_event_title,
    default_event_description: settings.defaultEventDescription || settings.default_event_description || null,
    youtube_channel_id: settings.youtubeChannelId || settings.youtube_channel_id || null,
    youtube_connected: settings.youtubeConnected !== undefined
      ? settings.youtubeConnected
      : settings.youtube_connected || false
  };

  try {
    const { data, error } = await supabaseClient
      .from('church_settings')
      .upsert(updateData)
      .select('*')
      .single();

    if (error) throw error;
    return normalizeResult(data ? normalizeSettings(data) : null, null);
  } catch (error) {
    console.error('[Church Live] Failed to update church settings:', error);
    return normalizeResult(null, error);
  }
}

// =============================================================================
// Events
// =============================================================================

/**
 * Get events from Supabase.
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function getEvents(options = {}) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: [],
      error: { message: 'Supabase is not connected.' }
    };
  }

  let query = supabaseClient
    .from('events')
    .select('*');

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.orderBy === 'scheduled_at') {
    query = query.order('scheduled_at', { ascending: options.ascending !== false });
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    return normalizeResult((data || []).map(normalizeEvent), null);
  } catch (error) {
    console.error('[Church Live] Failed to load events:', error);
    return normalizeResult([], error);
  }
}

/**
 * Get a single event by ID.
 * @param {string} eventId
 * @returns {Promise<Object>}
 */
async function getEvent(eventId) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: null,
      error: { message: 'Supabase is not connected.' }
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) throw error;
    return normalizeResult(data ? normalizeEvent(data) : null, null);
  } catch (error) {
    console.error('[Church Live] Failed to load event:', error);
    return normalizeResult(null, error);
  }
}

/**
 * Create a new event in Supabase.
 * @param {Object} eventData
 * @returns {Promise<Object>}
 */
async function createEvent(eventData) {
  if (!isSupabaseReady()) {
    console.error('[Church Live] createEvent: Supabase is not connected.');
    return {
      success: false,
      data: null,
      error: { message: 'Supabase is not connected.' }
    };
  }

  try {
    const eventColumns = toEventColumns(eventData);
    console.log('[Church Live] createEvent: mapping to database columns:', eventColumns);

    const { data, error } = await supabaseClient
      .from('events')
      .insert(eventColumns)
      .select('*')
      .single();

    console.log('[Church Live] createEvent: Supabase response:', { data, error });

    if (error) throw error;
    return normalizeResult(data ? normalizeEvent(data) : null, null);
  } catch (error) {
    console.error('[Church Live] Failed to create event:', error);
    return normalizeResult(null, error);
  }
}

/**
 * Update an existing event in Supabase.
 * @param {string} eventId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateEvent(eventId, updates) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: null,
      error: { message: 'Supabase is not connected.' }
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('events')
      .update(toEventColumns(updates))
      .eq('id', eventId)
      .select('*')
      .single();

    if (error) throw error;
    return normalizeResult(data ? normalizeEvent(data) : null, null);
  } catch (error) {
    console.error('[Church Live] Failed to update event:', error);
    return normalizeResult(null, error);
  }
}

/**
 * Delete an event from Supabase.
 * @param {string} eventId
 * @returns {Promise<Object>}
 */
async function deleteEvent(eventId) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      error: { message: 'Supabase is not connected.' }
    };
  }

  try {
    const { error } = await supabaseClient
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
    return { success: true, data: null, error: null };
  } catch (error) {
    console.error('[Church Live] Failed to delete event:', error);
    return normalizeResult(null, error);
  }
}

// =============================================================================
// System Logs
// =============================================================================

/**
 * Get system logs from Supabase.
 * @param {string|null} eventId
 * @returns {Promise<Object>}
 */
async function getSystemLogs(eventId = null) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: [],
      error: { message: 'Supabase is not connected.' }
    };
  }

  let query = supabaseClient
    .from('system_logs')
    .select('*');

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  try {
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return normalizeResult(data || [], null);
  } catch (error) {
    console.error('[Church Live] Failed to load system logs:', error);
    return normalizeResult([], error);
  }
}

/**
 * Add a system log entry to Supabase.
 * @param {Object} logData
 * @returns {Promise<Object>}
 */
async function addSystemLog(logData) {
  if (!isSupabaseReady()) {
    return {
      success: false,
      data: null,
      error: { message: 'Supabase is not connected.' }
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('system_logs')
      .insert({
        event_id: logData.eventId || logData.event_id || null,
        event_type: logData.eventType || logData.event_type || 'error',
        message: logData.message || ''
      })
      .select('*')
      .single();

    if (error) throw error;
    return normalizeResult(data || null, null);
  } catch (error) {
    console.error('[Church Live] Failed to add system log:', error);
    return normalizeResult(null, error);
  }
}

/**
 * Export the Supabase module
 */
window.churchLiveSupabase = {
  config: supabaseConfig,
  init: initSupabase,
  getClient: getSupabaseClient,
  isReady: isSupabaseReady,
  getError: getSupabaseConnectionError,

  // Data access (Phase 3)
  churchSettings: {
    get: getChurchSettings,
    update: updateChurchSettings
  },
  events: {
    get: getEvents,
    getOne: getEvent,
    create: createEvent,
    update: updateEvent,
    delete: deleteEvent
  },
  logs: {
    get: getSystemLogs,
    add: addSystemLog
  }
};