/**
 * CHURCH LIVE — CONFIGURATION MODULE
 * Central configuration and state management for the Church Live application.
 * This module prepares the frontend for Supabase integration.
 * 
 * IMPORTANT:
 * - Supabase Project ID: dwvbjfgviidcdogkdxku
 * - Use the Supabase Publishable Key for browser-side access (new API key system)
 * - NEVER use a service-role or secret key in frontend code
 * - Security comes from Row Level Security (RLS), not from hiding the publishable key
 */

// Application configuration
const config = {
  // App version and metadata
  version: '1.0.0',
  phase: 3,
  // Supabase configuration (new API key system)
  supabase: {
    projectId: 'dwvbjfgviidcdogkdxku',
    url: 'https://dwvbjfgviidcdogkdxku.supabase.co',
    publishableKey: 'sb_publishable_gnQsG3BTiVJOYbG9hfoW8w_UC8zUYnf', // Set your sb_publishable_... key in a local config file or deployment environment
    // The publishable key is intentionally not hard-coded in this repository.
    // It is safe for browser use, but must be supplied at runtime.
  },
  
  // Feature flags for phased rollout
  features: {
    supabaseReady: true,            // Supabase-ready structure (Phase 2)
    supabaseConnected: true,        // Connected to Supabase (Phase 3)
    localHelper: false,             // Will be true when local helper is available (Phase 4+)
    obsIntegration: false,          // Will be true when OBS is integrated (Phase 5+)
    youtubeIntegration: false,      // Will be true when YouTube API is integrated (Phase 6+)
    hardwareMonitoring: false       // Will be true when real hardware monitoring is active (Phase 7+)
  },
  
  // Default values for event workflow
  eventWorkflow: {
    states: ['DRAFT', 'READY', 'LIVE', 'ENDED'],
    initialState: 'DRAFT'
  },
  
  // Demo mode messages
  demoMessages: {
    status: 'Demo status — hardware and YouTube integration will be connected in a future phase.',
    serviceState: 'This is a demo state. Actual service lifecycle control will be implemented in future phases.'
  }
};

/**
 * Application state management
 * In Phase 2, this is managed locally in the browser.
 * In future phases, this may be synchronized with Supabase.
 */
const state = {
  // System status (will eventually come from local helper/Supabase)
  system: {
    camera: false,    // Generic camera input device
    audio: false,     // Generic audio input device
    internet: false,  // Church internet connection
    encoder: false,   // OBS/Encoder status
    youtube: false    // YouTube Live connection
  },
  
  // Service information
  service: {
    id: null,
    title: '',
    description: '',
    scheduledAt: null,
    status: 'DRAFT', // DRAFT, READY, LIVE, ENDED
    youtubeBroadcastId: null,
    youtubeVideoId: null,
    youtubeUrl: null
  },
  
  // UI state
  ui: {
    isPrepared: false,
    isLive: false,
    timerInterval: null,
    secondsElapsed: 0
  }
};

/**
 * Getters and setters for state (to be used by other modules)
 */
const getState = () => ({ ...state }); // Return a copy to prevent direct mutation
const setState = (updates) => {
  Object.assign(state, updates);
  // In future phases, this would also sync with Supabase
};

/**
 * Reset state to initial values (useful for testing)
 */
const resetState = () => {
  state.system = {
    camera: false,
    audio: false,
    internet: false,
    encoder: false,
    youtube: false
  };
  
  state.service = {
    id: null,
    title: '',
    description: '',
    scheduledAt: null,
    status: 'DRAFT',
    youtubeBroadcastId: null,
    youtubeVideoId: null,
    youtubeUrl: null
  };
  
  state.ui = {
    isPrepared: false,
    isLive: false,
    timerInterval: null,
    secondsElapsed: 0
  };
};

// Export for use in other modules
window.churchLiveConfig = {
  config,
  state: {
    get: getState,
    set: setState,
    reset: resetState
  }
};