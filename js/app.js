/**
 * CHURCH LIVE — FRONTEND APP
 * Phase 3: Connected to Supabase for real event persistence.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Church Live] DOMContentLoaded: starting initialization');

  // ==========================================================================
  // 1. STATE VARIABLES
  // ==========================================================================
  const state = {
    camera: false,        // True only after camera permissions are granted
    audio: false,         // True only after microphone permissions are granted
    currentCameraDeviceId: null,
    internet: true,
    encoder: false,
    youtube: false,
    hasCameraPermission: false,
    hasAudioPermission: false,
    isPrepared: false,
    isLive: false,
    service: {
      id: null,
      title: '',
      description: ''
    },
    timerInterval: null,
    secondsElapsed: 0,
    churchSettings: { data: null, isLoaded: false }
  };

  

  // Default Template Data
  const DEFAULT_TEMPLATE = {
    title: 'Sunday Worship Service',
    description: 'Welcome to our Sunday service livestream! Join us as we sing praises, listen to the Word, and fellowship together.'
  };

  // ==========================================================================
  // 2. DOM ELEMENT SELECTORS
  // ==========================================================================
  const elements = {
    // Status items
    statusCamera: document.getElementById('status-camera'),
    statusAudio: document.getElementById('status-audio'),
    statusInternet: document.getElementById('status-internet'),
    statusEncoder: document.getElementById('status-encoder'),
    statusYoutube: document.getElementById('status-youtube'),
    overallStatus: document.getElementById('overall-status'),
    cameraDetail: document.getElementById('camera-detail'),
    audioDetail: document.getElementById('audio-detail'),
    btnRequestPermissions: document.getElementById('btn-request-permissions'),
    cameraPreview: document.getElementById('camera-preview'),
    cameraPreviewContainer: document.getElementById('camera-preview-container'),
    cameraSourceSelect: document.getElementById('camera-source-select'),
    cameraSourceContainer: document.getElementById('camera-source-container'),

    // Service Setup Form
    serviceForm: document.getElementById('service-form'),
    serviceTitle: document.getElementById('service-title'),
    serviceDescription: document.getElementById('service-description'),
    serviceTime: document.getElementById('service-time'),
    btnLoadTemplate: document.getElementById('btn-load-template'),
    serviceTemplate: document.getElementById('service-template'),

    // Live Manager Section
    prepConsole: document.getElementById('prep-console'),
    prepBadge: document.getElementById('prep-badge'),
    consolePlaceholder: document.getElementById('console-placeholder'),
    consoleFlow: document.getElementById('console-flow'),
    flowTitle: document.getElementById('flow-title'),
    flowTime: document.getElementById('flow-time'),
    
    // Checklist Guides
    stepFormValid: document.getElementById('step-form-valid'),
    stepEncoderLink: document.getElementById('step-encoder-link'),
    stepYtReady: document.getElementById('step-yt-ready'),

    // Action Buttons
    btnSimulateConnect: document.getElementById('btn-simulate-yt-link'),
    btnStartStream: document.getElementById('btn-start-stream'),
    btnStopStream: document.getElementById('btn-stop-stream'),
    
    // Services Table & Count
    recentServicesTable: document.getElementById('recent-services-table').querySelector('tbody'),
    historyCount: document.getElementById('history-count'),

    // Login UI
    loginSection: document.getElementById('login-section'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginButton: document.getElementById('login-button'),
    loginError: document.getElementById('login-error'),
    logoutButton: document.getElementById('logout-button'),
    mainDashboard: document.getElementById('main-dashboard'),

    // Church name display element
    churchNameDisplay: document.getElementById('church-name-display'),
    churchNameText: document.querySelector('.church-name-text'),

    // Password Recovery UI
    forgotPasswordButton: document.getElementById('forgot-password-button'),
    resetPasswordForm: document.getElementById('reset-password-form'),
    resetEmail: document.getElementById('reset-email'),
    resetError: document.getElementById('reset-error'),
    resetSuccess: document.getElementById('reset-success'),
    resetPasswordButton: document.getElementById('reset-password-button'),
    resetCancelButton: document.getElementById('reset-cancel-button'),
    newPasswordForm: document.getElementById('new-password-form'),
    newPassword: document.getElementById('new-password'),
    confirmPassword: document.getElementById('confirm-password'),
    newPasswordError: document.getElementById('new-password-error'),
    newPasswordButton: document.getElementById('new-password-button'),
    passwordUpdatedSection: document.getElementById('password-updated-section'),
    passwordUpdatedMessage: document.getElementById('password-updated-message'),
    continueSignInButton: document.getElementById('continue-sign-in-button'),

    // Church Settings (Phase 5B)
    badgeRole: document.getElementById('badge-role'),
    settingsCard: document.getElementById('settings-card'),
    churchNameInput: document.getElementById('church-name'),
    churchLogoInput: document.getElementById('church-logo'),
    churchTimezoneInput: document.getElementById('church-timezone'),
    churchEmailInput: document.getElementById('church-email'),
    defaultEventTitleInput: document.getElementById('default-event-title'),
    defaultEventDescriptionInput: document.getElementById('default-event-description'),
    youtubeChannelIdInput: document.getElementById('youtube-channel-id'),
    settingsSaveMessage: document.getElementById('settings-save-message'),
    btnSaveSettings: document.getElementById('btn-save-settings')
  };
initDefaults();

  // ==========================================================================
  // 3. INITIALIZATION
  // ==========================================================================
  /**
   * Initialize default form values and set up initial state.
   * Calculates the next Sunday's date and sets the default service time.
   */
  function initDefaults() {
    // Set default service title
    state.service.title = 'Sunday Worship Service';
    // Set default service description
    state.service.description = 'Welcome to our Sunday service livestream! Join us as we sing praises, listen to the Word, and fellowship together.';
    // Set default service time (next Sunday at 9:30 AM)
    const now = new Date();
    const nextSunday = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7;
    nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
    nextSunday.setHours(9, 30, 0, 0);
    const pad = (num) => String(num).padStart(2, '0');
    const formattedDate = `${nextSunday.getFullYear()}-${pad(nextSunday.getMonth() + 1)}-${pad(nextSunday.getDate())}T${pad(nextSunday.getHours())}:${pad(nextSunday.getMinutes())}`;
    elements.serviceTime.value = formattedDate;
  }

  /**
   * Load and display the current church name in the header (read-only).
   * Uses the church_settings table, which is tenant-isolated via RLS.
   */
  async function loadChurchName() {
    if (!elements.churchNameText) {
      return;
    }

    try {
      const result = await window.churchLiveSupabase.church.getName();
      if (result.success && result.data) {
        elements.churchNameText.textContent = result.data?.churchName || result.data;
        if (elements.churchNameDisplay) {
          elements.churchNameDisplay.style.opacity = '1';
        }
      } else {
        elements.churchNameText.textContent = 'Church not available';
      }
    } catch (error) {
      console.error('[Church Live] Failed to load church name:', error);
      elements.churchNameText.textContent = 'Church not available';
    }
  }

   // ==========================================================================
   // 4. AUTHENTICATION GATING
   // ==========================================================================
   let isAuthenticatedAndActive = false;

      async function checkAuthenticationAndLoad() {
     const profile = await getCurrentProfile();

     if (profile.success && profile.data) {
       showDashboardSection();
     } else {
       showLoginSection();
     }
   }

   updateStatusUI();

   // Only load private data after successful authentication and profile validation
   initSupabaseAndLoadEvents();
   checkAuthenticationAndLoad();

  // ==========================================================================
  // 5. AUTH STATE LISTENER
  // ==========================================================================
  // Register the Supabase auth state change listener to handle login/logout/session changes
  const unsubscribe = onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      console.log('[Church Live] User logged in');
      await validateSessionAndShowDashboard();
    } else if (event === 'SIGNED_OUT') {
      console.log('[Church Live] User logged out');
      isAuthenticatedAndActive = false;
      showLoginSection();
    } else if (event === 'PASSWORD_RECOVERY') {
      console.log('[Church Live] Password recovery session detected');
      // Show the "Set New Password" form
      if (elements.loginSection) elements.loginSection.style.display = '';
      if (elements.mainDashboard) elements.mainDashboard.style.display = 'none';
      if (elements.logoutButton) elements.logoutButton.style.display = 'none';
      if (elements.loginForm) elements.loginForm.style.display = 'none';
      if (elements.forgotPasswordButton) elements.forgotPasswordButton.style.display = 'none';
      if (elements.resetPasswordForm) elements.resetPasswordForm.style.display = 'none';
      if (elements.newPasswordForm) elements.newPasswordForm.style.display = '';
      if (elements.passwordUpdatedSection) elements.passwordUpdatedSection.style.display = 'none';
      if (elements.newPasswordError) elements.newPasswordError.textContent = '';
      if (elements.newPassword) elements.newPassword.value = '';
      if (elements.confirmPassword) elements.confirmPassword.value = '';
    } else if (session) {
      console.log('[Church Live] Auth state changed - updating UI');
    }
  });

  // Attach save settings button listener for SUPER_ADMIN users
  if (elements.btnSaveSettings) {
    elements.btnSaveSettings.addEventListener('click', async (e) => {
      await saveChurchSettings();
    });
  }

  let authenticationCheckPromise = null;

  async function validateSessionAndShowDashboard() {
    if (authenticationCheckPromise) {
      return authenticationCheckPromise;
    }

    authenticationCheckPromise = (async () => {
      const profile = await getCurrentProfile();
      const hasActiveAdminProfile = profile && profile.success &&
        profile.data?.is_active === true &&
        (profile.data?.role === 'SUPER_ADMIN' || profile.data?.role === 'ADMIN');

      if (!hasActiveAdminProfile) {
        isAuthenticatedAndActive = false;
        elements.loginError.textContent = '⚠️ Your account is not active or does not have permission to access the dashboard.';
        showLoginSection();
        return false;
      }

      isAuthenticatedAndActive = true;
      showDashboardSection();
      await initRoleAwareUI();
      await loadChurchSettings();
      await updateRoleBadge();
      loadEventsFromSupabase();
      return true;
    })();

    try {
      return await authenticationCheckPromise;
    } finally {
      authenticationCheckPromise = null;
    }
  }

  /**
    * Show the login section and hide the dashboard.
    */
    function showLoginSection() {
    if (elements.loginSection) {
      elements.loginSection.style.display = '';
    }
    if (elements.mainDashboard) {
      elements.mainDashboard.style.display = 'none';
    }
    if (elements.logoutButton) {
      elements.logoutButton.style.display = 'none';
    }
    // Reset all password recovery sub-forms to show only the login form
    if (elements.loginForm) elements.loginForm.style.display = '';
    if (elements.resetPasswordForm) elements.resetPasswordForm.style.display = 'none';
    if (elements.newPasswordForm) elements.newPasswordForm.style.display = 'none';
    if (elements.passwordUpdatedSection) elements.passwordUpdatedSection.style.display = 'none';
    if (elements.loginError) elements.loginError.textContent = '';
  }

  /**
   * Show the dashboard and hide the login section.
   */
  function showDashboardSection() {
    if (elements.loginSection) {
      elements.loginSection.style.display = 'none';
    }
    if (elements.mainDashboard) {
      elements.mainDashboard.style.display = '';
    }
    if (elements.logoutButton) {
      elements.logoutButton.style.display = 'inline-block';
    }
    loadChurchName();
  }

  // ==========================================================================
  // 4. FUNCTION DEFINITIONS
  // ==========================================================================

  /** Initialize Supabase client and load events on page load. */
  function initSupabaseAndLoadEvents() {
    console.log('[Church Live] Initializing Supabase and loading events');
    // Initialize Supabase with config from churchLiveConfig
    const supabase = window.churchLiveSupabase.init(window.churchLiveConfig.config.supabase);
    
    if (!supabase) {
      showSupabaseError('Failed to connect to Supabase. Events will not be saved.');
      console.error('[Church Live] Supabase initialization failed');
      return;
    }

    console.log('[Church Live] Supabase initialized successfully');
    // Events loaded only after successful auth validation (validateSessionAndShowDashboard)
  }

  /**
   * Load events from Supabase and display them.
   */
  async function loadEventsFromSupabase() {
    console.log('[Church Live] loadEventsFromSupabase: fetching events');
    try {
      const result = await window.churchLiveSupabase.events.get({ limit: 50 });
      console.log('[Church Live] loadEventsFromSupabase: Supabase get result:', result);
      if (result.success) {
        displayEvents(result.data || []);
        // Restore Livestream Manager only if this browser session has a prepared event ID
        const preparedEventId = sessionStorage.getItem('preparedEventId');
        if (preparedEventId) {
          const events = result.data || [];
          const sessionDraftEvent = events.find(e => e.id === preparedEventId && e.status === 'DRAFT');
          if (sessionDraftEvent) {
            state.isPrepared = true;
            state.service.id = sessionDraftEvent.id;
            state.service.title = sessionDraftEvent.title;
            state.service.description = sessionDraftEvent.description;
            elements.flowTitle.textContent = sessionDraftEvent.title;
            const schedDate = new Date(sessionDraftEvent.scheduledAt);
            elements.flowTime.textContent = `Scheduled for: ${schedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${schedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
            elements.prepConsole.classList.remove('disabled');
            elements.prepConsole.classList.add('active-preview');
            elements.prepBadge.textContent = 'Prepared';
            elements.prepBadge.className = 'badge prep-badge-ready';
            elements.consolePlaceholder.classList.add('hidden');
            elements.consoleFlow.classList.remove('hidden');
            const feedSim = document.querySelector('.preview-feed-sim');
            if (feedSim) feedSim.classList.add('sim-on');
            updateStatusUI();
          }
        }
      } else {
        showSupabaseError(`Failed to load events: ${result.error?.message}`);
      }
    } catch (error) {
      showSupabaseError(`Error loading events: ${error.message}`);
    }
  }
  
  /**
   * Display events in the recent services table.
   * @param {Array} events - Array of event objects
   */
  function displayEvents(events) {
    // Clear existing rows
    elements.recentServicesTable.innerHTML = '';
    
    // Add each event
    events.forEach(event => {
      const row = createEventRow(event);
      elements.recentServicesTable.appendChild(row);
    });
    
    // Update history count
    const completedCount = events.filter(e => e.status === 'COMPLETED').length;
    elements.historyCount.textContent = `${completedCount} archived`;
  }
  
  /**
   * Create a table row for an event.
   * @param {Object} event - The event object
   * @returns {HTMLTableRowElement}
   */
  function createEventRow(event) {
    const row = document.createElement('tr');
    
    // Format date and time
    const date = event.scheduledAt ? new Date(event.scheduledAt) : new Date();
    const dateFormatted = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Format duration if applicable
    let durationText = '';
    if (event.startedAt && event.endedAt) {
      const start = new Date(event.startedAt);
      const end = new Date(event.endedAt);
      const durationMs = end - start;
      const minutes = Math.floor(durationMs / 60000);
      durationText = ` — ${minutes}m`;
    }

    // Build the row HTML with a delete button for DRAFT events
    let deleteCellHtml = '';
    if (event.status === 'DRAFT') {
      deleteCellHtml = `
        <td class="cell-actions">
          <button class="btn-delete-draft" data-event-id="${event.id}" title="Delete this draft service">
            <span class="delete-icon">🗑</span>
          </button>
        </td>`;
    } else {
      deleteCellHtml = `<td class="cell-actions"></td>`;
    }

        row.innerHTML = `
      <td class="cell-date">
        <div class="primary-text">${dateFormatted}</div>
        <div class="secondary-text">${timeFormatted}</div>
      </td>
      <td class="cell-service">
        <div class="primary-text">${event.title || ''}</div>
        <div class="secondary-text">${event.description || ''}${durationText}</div>
      </td>
      <td>
        <span class="service-status-pill ${event.status === 'LIVE' ? 'status-live' : event.status === 'DRAFT' ? 'status-draft' : 'status-completed'}">
          ${event.status === 'LIVE' ? 'Live' : event.status.charAt(0).toUpperCase() + event.status.slice(1).toLowerCase()}
        </span>
      </td>
      <td class="cell-yt">
        ${event.youtubeUrl ? `
          <a href="${event.youtubeUrl}" target="_blank" class="yt-link">
            <span class="yt-icon">▶</span> watch archive
          </a>
        ` : `
          <span class="yt-link disabled">No archive</span>
        `}
      </td>
      ${deleteCellHtml}
    `;

    // Attach delete handler for DRAFT events
    if (event.status === 'DRAFT') {
      const deleteBtn = row.querySelector('.btn-delete-draft');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteDraftEvent(event.id, event.title);
        });
      }
    }

    return row;
  }
  
  /**
   * Show a Supabase connection error in the UI.
   * @param {string} message
   */
  function showSupabaseError(message) {
    // Add error banner if it doesn't exist
    if (!document.getElementById('supabase-error-banner')) {
      const banner = document.createElement('div');
      banner.id = 'supabase-error-banner';
      banner.className = 'alert alert-error';
      banner.innerHTML = `
        <div class="alert-content">
          <span class="alert-icon">⚠️</span>
          <span class="alert-message">${message}</span>
        </div>
      `;
      document.querySelector('.dashboard-container').prepend(banner);
    }
  }
  
  /**
   * Hide the Supabase error banner.
   */
  function hideSupabaseError() {
    const banner = document.getElementById('supabase-error-banner');
    if (banner) {
      banner.remove();
    }
  }

  // ==========================================================================
  // 5. PHASE 5B: CHURCH SETTINGS
  // ==========================================================================

  /**
   * Handle deletion of a DRAFT event from Recent Services.
   * @param {string} eventId - The UUID of the event to delete
   * @param {string} eventTitle - The title of the event (for confirmation dialog)
   */
  async function handleDeleteDraftEvent(eventId, eventTitle) {
    const confirmed = confirm(
      `Are you sure you want to delete the draft service "${eventTitle}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const result = await window.churchLiveSupabase.events.delete(eventId);
      if (!result.success) {
        console.error('[Church Live] Failed to delete draft event:', result.error);
        alert('Failed to delete the draft service. Please try again.');
        return;
      }

      // Check if the deleted event was the currently prepared event
      const preparedEventId = sessionStorage.getItem('preparedEventId');
      if (eventId === preparedEventId) {
        state.isPrepared = false;
        state.isLive = false;
        sessionStorage.removeItem('preparedEventId');
        // Reset the existing Livestream Manager UI to Inactive / Waiting for Preparation
        resetLivestreamManagerUI();
      }

      // Refresh the existing Recent Services list using the existing event-loading mechanism
      await loadEventsFromSupabase();

      // Update the archived count using the existing COMPLETED-only logic
      // loadEventsFromSupabase already calls displayEvents which updates historyCount
    } catch (error) {
      console.error('[Church Live] Error deleting draft event:', error);
      alert('An error occurred while deleting the draft service.');
    }
  }

  /**
   * Reset the Livestream Manager UI to Inactive / Waiting for Preparation state.
   */
  function resetLivestreamManagerUI() {
    // Reset state flags
    state.isPrepared = false;
    state.isLive = false;
    state.secondsElapsed = 0;

    // Clear timer
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    // Reset UI elements to Inactive state
    elements.prepConsole.classList.remove('live-mode', 'active-preview');
    elements.prepConsole.classList.add('disabled');
    elements.prepBadge.textContent = 'Inactive';
    elements.prepBadge.className = 'badge prep-badge-inactive';
    elements.consolePlaceholder.classList.remove('hidden');
    elements.consoleFlow.classList.add('hidden');
    elements.flowTime.textContent = 'Waiting for Preparation';

    // Reset feed simulation
    const feedSim = document.querySelector('.preview-feed-sim');
    if (feedSim) {
      feedSim.classList.remove('sim-on', 'live-broadcast');
      feedSim.querySelector('.feed-sim-text').innerHTML = '🛑 Idle';
    }

    // Hide both action buttons
    elements.btnStartStream.classList.add('hidden');
    elements.btnStopStream.classList.add('hidden');

    // Reset simulated connect button
    elements.btnSimulateConnect.textContent = '🔗 Simulate API Connect (Prepare OBS & YT)';
    elements.btnSimulateConnect.disabled = false;

    updateStatusUI();
  }

  // ==========================================================================
  // 5. PHASE 5B: CHURCH SETTINGS

  /**
   * Load church settings from Supabase and populate the form fields.
   * @returns {Promise<void>}
   */
  async function loadChurchSettings() {
    try {
      const result = await window.churchLiveSupabase.churchSettings.get();
      if (!result.success) {
        console.error('[Church Live] Failed to load church settings:', result.error);
        return;
      }

      const settings = result.data;
      if (!settings) {
        console.warn('No church settings found in Supabase');
        return;
      }

      // Populate form fields (normalizeSettings returns camelCase)
      elements.churchNameInput.value = settings.churchName || settings.church_name || '';
      elements.churchLogoInput.value = settings.churchLogo || settings.church_logo || '';
      elements.churchTimezoneInput.value = settings.churchTimezone || settings.church_timezone || '';
      elements.churchEmailInput.value = settings.churchEmail || settings.church_email || '';
      elements.defaultEventTitleInput.value = settings.defaultEventTitle || settings.default_event_title || '';
      elements.defaultEventDescriptionInput.value = settings.defaultEventDescription || settings.default_event_description || '';
      elements.youtubeChannelIdInput.value = settings.youtubeChannelId || settings.youtube_channel_id || '';

      // Update the church_settings state object
      state.churchSettings = {
        data: settings,
        isLoaded: true
      };

      // Update role badge based on user role
      await updateRoleBadge();
    } catch (error) {
      console.error('[Church Live] Failed to load church settings:', error);
    }
  }

  /**
   * Save church settings to Supabase.
   * @returns {Promise<void>}
   */
  async function saveChurchSettings() {
    try {
      const settings = {
        churchName: elements.churchNameInput.value,
        churchLogo: elements.churchLogoInput.value,
        churchTimezone: elements.churchTimezoneInput.value,
        churchEmail: elements.churchEmailInput.value,
        defaultEventTitle: elements.defaultEventTitleInput.value,
        defaultEventDescription: elements.defaultEventDescriptionInput.value,
        youtubeChannelId: elements.youtubeChannelIdInput.value,
        youtubeConnected: elements.youtubeChannelIdInput.value ? true : false,
      };

      const result = await window.churchLiveSupabase.churchSettings.update(settings);
      if (!result.success) {
        console.error('[Church Live] Failed to save church settings:', result.error);
        if (elements.settingsSaveMessage) {
          elements.settingsSaveMessage.textContent = '❌ Failed to save settings.';
          elements.settingsSaveMessage.style.color = 'var(--color-danger)';
        }
        return;
      }

      console.log('[Church Live] Church settings saved successfully');
      if (elements.settingsSaveMessage) {
        elements.settingsSaveMessage.textContent = '✅ Settings saved successfully!';
        elements.settingsSaveMessage.style.color = 'var(--color-success)';
        setTimeout(() => {
          if (elements.settingsSaveMessage) {
            elements.settingsSaveMessage.textContent = '';
          }
        }, 3000);
      }
    } catch (error) {
      console.error('[Church Live] Error saving church settings:', error);
      if (elements.settingsSaveMessage) {
        elements.settingsSaveMessage.textContent = '❌ Error saving settings.';
        elements.settingsSaveMessage.style.color = 'var(--color-danger)';
      }
    }
  }

    /**
   * Initialize role-aware UI for church settings.
   * Shows/hides the settings card based on user role.
   * SUPER_ADMIN-only visibility for Church Settings; ADMIN and non-admins are hidden.
   * @returns {Promise<void>}
   */
  async function initRoleAwareUI() {
    try {
      const isSuperAdmin = await window.churchLiveSupabase.roles.isSuperAdmin();

      // Only SUPER_ADMIN can access the Church Settings panel
      if (isSuperAdmin && elements.settingsCard) {
        elements.settingsCard.classList.remove('hidden');
      } else if (elements.settingsCard) {
        elements.settingsCard.classList.add('hidden');
      }
    } catch (error) {
      console.error('[Church Live] Failed to initialize role-aware UI:', error);
      if (elements.settingsCard) {
        elements.settingsCard.classList.add('hidden');
      }
    }
  }

  /**
   * Update the role badge based on the current user's role.
   * @returns {Promise<void>}
   */
  async function updateRoleBadge() {
    try {
      const role = await window.churchLiveSupabase.roles.getCurrentUserRole();
      if (role?.success && role?.data?.role) {
        elements.badgeRole.textContent = role.data.role;
        elements.badgeRole.className = `badge ${role.data.role}`;
      } else {
        elements.badgeRole.textContent = 'ROLE_UNKNOWN';
        elements.badgeRole.className = 'badge';
      }
    } catch (error) {
      console.error('[Church Live] Failed to update role badge:', error);
      elements.badgeRole.textContent = 'ROLE_UNKNOWN';
      elements.badgeRole.className = 'badge';
    }
  }

  // ==========================================================================
  // 5. EVENT LISTENERS
  // ==========================================================================

  /**
   * Synchronize the Javascript state variables with the HTML DOM indicator circles and text
   */
  
  // ==========================================================================
  // 5. EVENT LISTENERS
  // ==========================================================================

  /**
   * Synchronize the Javascript state variables with the HTML DOM indicator circles and text
   */
  function updateStatusUI() {
    // Check if media devices are supported in this browser
    const mediaSupported = window.churchLiveMediaDevices?.isMediaDevicesSupported() ?? false;

    const syncItem = (itemEl, isConnected, connectedText, disconnectedText) => {
      const dot = itemEl.querySelector('.status-dot');
      const label = itemEl.querySelector('.status-text');
      
      itemEl.setAttribute('data-checked', isConnected ? 'true' : 'false');
      
      if (isConnected) {
        dot.className = 'status-dot green-dot';
        label.textContent = connectedText;
      } else {
        dot.className = 'status-dot red-dot';
        label.textContent = disconnectedText;
      }
    };

    // Camera status: show different states based on support/permissions/detection
    if (!mediaSupported) {
      // Browser doesn't support media devices
      syncItem(elements.statusCamera, false, 'NOT SUPPORTED', 'NOT SUPPORTED');
      elements.statusCamera.querySelector('.status-text').textContent = 'NOT SUPPORTED';
      elements.statusCamera.querySelector('.status-dot').className = 'status-dot red-dot';
      elements.statusCamera.setAttribute('data-checked', 'false');
    } else if (!state.hasCameraPermission) {
      // Permission not yet granted
      syncItem(elements.statusCamera, false, 'CONNECTED', 'NOT CONNECTED');
      elements.statusCamera.querySelector('.status-text').textContent = 'NOT CONNECTED';
      elements.statusCamera.querySelector('.status-dot').className = 'status-dot red-dot';
      elements.statusCamera.setAttribute('data-checked', 'false');
    } else if (state.camera) {
      // Permission granted AND devices detected
      syncItem(elements.statusCamera, true, 'CONNECTED', 'OFFLINE');
    } else {
      // Permission granted but no devices found
      syncItem(elements.statusCamera, false, 'CONNECTED', 'NO DEVICE');
      elements.statusCamera.querySelector('.status-text').textContent = 'NO DEVICE';
      elements.statusCamera.querySelector('.status-dot').className = 'status-dot red-dot';
      elements.statusCamera.setAttribute('data-checked', 'false');
    }

    // Audio status: same logic
    if (!mediaSupported) {
      syncItem(elements.statusAudio, false, 'NOT SUPPORTED', 'NOT SUPPORTED');
      elements.statusAudio.querySelector('.status-text').textContent = 'NOT SUPPORTED';
      elements.statusAudio.querySelector('.status-dot').className = 'status-dot red-dot';
      elements.statusAudio.setAttribute('data-checked', 'false');
    } else if (!state.hasAudioPermission) {
      syncItem(elements.statusAudio, false, 'CONNECTED', 'NOT CONNECTED');
      elements.statusAudio.querySelector('.status-text').textContent = 'NOT CONNECTED';
      elements.statusAudio.querySelector('.status-dot').className = 'status-dot red-dot';
      elements.statusAudio.setAttribute('data-checked', 'false');
    } else if (state.audio) {
      syncItem(elements.statusAudio, true, 'CONNECTED', 'OFFLINE');
    } else {
      syncItem(elements.statusAudio, false, 'CONNECTED', 'NO DEVICE');
      elements.statusAudio.querySelector('.status-text').textContent = 'NO DEVICE';
      elements.statusAudio.querySelector('.status-dot').className = 'status-dot red-dot';
      elements.statusAudio.setAttribute('data-checked', 'false');
    }

    // Other status items remain as before (simulated for now)
    syncItem(elements.statusInternet, state.internet, 'STABLE', 'DISCONNECTED');
    syncItem(elements.statusEncoder, state.encoder, 'READY', 'OFFLINE');
    syncItem(elements.statusYoutube, state.youtube, 'PREPARED', 'UNPREPARED');

    // Recalculate Overall Health Check badge
    // Camera and Audio only count as "ready" if devices are actually detected
    const totalChecks = [state.camera, state.audio, state.internet, state.encoder, state.youtube];
    const passedCount = totalChecks.filter(v => v).length;

    if (passedCount === 5) {
      elements.overallStatus.textContent = 'ALL SYSTEMS READY';
      elements.overallStatus.className = 'status-badge all-green';
    } else if (passedCount >= 3) {
      elements.overallStatus.textContent = `CHECKS: ${passedCount}/5 READY`;
      elements.overallStatus.className = 'status-badge';
      elements.overallStatus.style.backgroundColor = 'var(--color-warning-light)';
      elements.overallStatus.style.color = '#b45309';
    } else {
      elements.overallStatus.textContent = 'HARDWARE ATTENTION NEEDED';
      elements.overallStatus.className = 'status-badge';
      elements.overallStatus.style.backgroundColor = 'var(--color-danger-light)';
      elements.overallStatus.style.color = 'var(--color-danger)';
    }

    // Live update checklist rules in the Workspace
    updateWorkspacePrereqs();
  }

  /**
   * Syncs the console checklists when simulated items turn green
   */
  function updateWorkspacePrereqs() {
    if (!state.isPrepared) return;

    // OBS Link ready depends on hardware camera, audio and encoder status
    const isObsReady = state.camera && state.audio && state.encoder;
    toggleChecklistStep(elements.stepEncoderLink, isObsReady);

    // YouTube Broadcast scheduled depends on internet and youtube status
    const isYtReady = state.internet && state.youtube;
    toggleChecklistStep(elements.stepYtReady, isYtReady);

    // END/LIVESTREAM button shown when LIVE or PREPARED (not when merely Inactive)
    // Show button and set appropriate text based on current state
    if (state.isLive || state.isPrepared) {
      elements.btnStopStream.classList.remove('hidden');
      // Set button text based on state: "STOP PRESENTATION" for prepared, "END LIVESTREAM" for live
      if (state.isPrepared) {
        elements.btnStopStream.textContent = 'STOP PRESENTATION';
      } else {
        elements.btnStopStream.textContent = 'END LIVESTREAM';
      }
    } else {
      elements.btnStopStream.classList.add('hidden');
    }

    // Determine if we can reveal the final "START LIVESTREAM NOW" button
    if (state.isPrepared && !state.isLive) {
      elements.btnSimulateConnect.classList.add('hidden');
      if (!state.isLive) {
        elements.btnStartStream.classList.remove('hidden');
      }
    } else {
      if (!state.isLive) {
        elements.btnSimulateConnect.classList.remove('hidden');
        elements.btnStartStream.classList.add('hidden');
      }
    }
  }

  function toggleChecklistStep(stepEl, isCompleted) {
    if (isCompleted) {
      stepEl.classList.add('checked');
    } else {
      stepEl.classList.remove('checked');
    }
  }

  /**
   * Update the status detail text for camera or audio.
   * @param {HTMLElement} detailEl - The detail element to update.
   * @param {string} text - The text to display.
   */
  function showStatusDetail(detailEl, text) {
    if (detailEl) {
      detailEl.textContent = text;
    }
  }

  // ==========================================================================
  // 5. EVENT LISTENERS
  // ==========================================================================

    // A. Check Media Permissions (Real Device Detection)
  async function checkMediaPermissions() {
    if (!window.churchLiveMediaDevices?.isMediaDevicesSupported()) {
      showStatusDetail(elements.cameraDetail, 'Media devices not supported in this browser');
      showStatusDetail(elements.audioDetail, 'Media devices not supported in this browser');
      return;
    }

    try {
      // Request both camera and microphone permissions
      const result = await window.churchLiveMediaDevices.requestMediaPermissions({ video: true, audio: true });

      if (result.success) {
        // Permissions granted - enumerate devices
        const deviceResult = await window.churchLiveMediaDevices.initializeMediaDevices({ video: true, audio: true });

        // Update state based on actual device detection
        state.camera = deviceResult.videoDevices.length > 0;
        state.audio = deviceResult.audioDevices.length > 0;
        state.hasCameraPermission = true;
        state.hasAudioPermission = true;

        // Display camera preview using the existing MediaStream
        if (result.stream && elements.cameraPreview) {
          elements.cameraPreview.srcObject = result.stream;
          // Track the current camera device (use default if available)
          if (deviceResult.videoDevices.length > 0) {
            state.currentCameraDeviceId = deviceResult.videoDevices[0].id;
          }
        }
        if (elements.cameraPreviewContainer) {
          elements.cameraPreviewContainer.style.display = '';
        }

        // Populate camera source dropdown for HDMI/USB capture device support
        if (elements.cameraSourceSelect) {
          populateCameraSources();
        }

        // Update status details with device information
        if (deviceResult.videoDevices.length > 0) {
          showStatusDetail(elements.cameraDetail, `Camera permission granted - ${deviceResult.videoDevices.length} video device(s) detected`);
        } else {
          showStatusDetail(elements.cameraDetail, 'Camera permission granted - no video devices detected');
        }

        if (deviceResult.audioDevices.length > 0) {
          showStatusDetail(elements.audioDetail, `Microphone permission granted - ${deviceResult.audioDevices.length} audio device(s) detected`);
        } else {
          showStatusDetail(elements.audioDetail, 'Microphone permission granted - no audio devices detected');
        }

        // Set up device change listeners for hot-plug/unplug
        if (window.churchLiveMediaDevices?.onDeviceChange) {
          window.churchLiveMediaDevices.onDeviceChange(async (devices) => {
            const videoDevices = devices.filter(d => d.isVideo);
            const audioDevices = devices.filter(d => d.isAudio);
            state.camera = videoDevices.length > 0;
            state.audio = audioDevices.length > 0;
            // Refresh camera source dropdown if devices changed
            if (elements.cameraSourceSelect) {
              await populateCameraSources();
            }
            updateStatusUI();
          });
        }
      } else {
        // Permissions denied or error
        const errorMsg = result.error ? result.error.message : 'Permission request cancelled';
        showStatusDetail(elements.cameraDetail, `Camera permission denied: ${errorMsg}`);
        showStatusDetail(elements.audioDetail, `Microphone permission denied: ${errorMsg}`);
        if (elements.cameraPreviewContainer) {
          elements.cameraPreviewContainer.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('[Church Live] Error checking media permissions:', error);
      showStatusDetail(elements.cameraDetail, 'Error checking camera permissions');
      showStatusDetail(elements.audioDetail, 'Error checking microphone permissions');
      if (elements.cameraPreviewContainer) {
        elements.cameraPreviewContainer.style.display = 'none';
      }
    }

    updateStatusUI();
  }

  // --- Camera Source Management ---
  async function populateCameraSources() {
    // Enumerate video devices
    const devices = await window.churchLiveMediaDevices.enumerateVideoDevices();
    
    // Clear dropdown and reset
    elements.cameraSourceSelect.innerHTML = '';
    
    if (devices.length === 0) {
      elements.cameraSourceSelect.innerHTML = '<option value="">No cameras found</option>';
      elements.cameraSourceContainer.style.display = 'none';
      return;
    }
    
    // Populate dropdown with each camera device
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.label || 'Unnamed Camera';
      elements.cameraSourceSelect.appendChild(option);
    });
    
    // Select the currently active camera (or default to first)
    if (state.currentCameraDeviceId && devices.some(d => d.id === state.currentCameraDeviceId)) {
      elements.cameraSourceSelect.value = state.currentCameraDeviceId;
    } else {
      elements.cameraSourceSelect.selectedIndex = 0;
      state.currentCameraDeviceId = devices[0].id;
    }
    
    elements.cameraSourceContainer.style.display = 'block';
  }

  async function switchCamera(deviceId) {
    if (!deviceId) return;

    // Stop the current stream tracks
    if (elements.cameraPreview && elements.cameraPreview.srcObject) {
      const tracks = elements.cameraPreview.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      elements.cameraPreview.srcObject = null;
    }

    // Create a new stream for the selected camera
    const result = await window.churchLiveMediaDevices.createMediaStream({
      videoDeviceId: deviceId
    });

    if (result.success && result.stream) {
      elements.cameraPreview.srcObject = result.stream;
      elements.cameraPreviewContainer.style.display = '';
      state.currentCameraDeviceId = deviceId;
      updateStatusUI();
    } else {
      console.warn(`Failed to create stream for camera ${deviceId}`, result.error);
    }
  }

  // --- Event Listeners ---
  elements.btnRequestPermissions.addEventListener('click', () => {
    // Show loading state
    elements.btnRequestPermissions.disabled = true;
    elements.btnRequestPermissions.textContent = 'Checking permissions...';
    checkMediaPermissions().finally(() => {
      elements.btnRequestPermissions.disabled = false;
      elements.btnRequestPermissions.textContent = 'Grant Camera & Microphone Access';
    });
  });

  // Add event listener for camera source selection
  elements.cameraSourceSelect?.addEventListener('change', () => {
    if (elements.cameraSourceSelect.value) {
      switchCamera(elements.cameraSourceSelect.value);
    }
  });

  elements.statusInternet.addEventListener('click', () => {
    state.internet = !state.internet;
    updateStatusUI();
  });

  elements.statusEncoder.addEventListener('click', () => {
    state.encoder = !state.encoder;
    updateStatusUI();
  });

  elements.statusYoutube.addEventListener('click', () => {
    state.youtube = !state.youtube;
    updateStatusUI();
  });

  // C. Service Template Dropdown
  const SERVICE_TEMPLATES = [
    {
      value: 'sunday-worship',
      label: 'Sunday Service — Worship + Message',
      title: 'Sunday Worship Service',
      description: 'Welcome to our Sunday service livestream! Join us as we worship, hear God\'s Word, and fellowship together.'
    },
    {
      value: 'sunday-worship-bible',
      label: 'Sunday Service — Worship + Bible Study',
      title: 'Sunday Worship & Bible Study',
      description: 'Join us for worship followed by Bible study and discussion.'
    },
    {
      value: 'bible-study',
      label: 'Bible Study',
      title: 'Bible Study',
      description: 'Focused study session on biblical texts and teachings.'
    },
    {
      value: 'youth-meeting',
      label: 'Youth Meeting',
      title: 'Youth Meeting',
      description: 'Weekly youth group gathering and activities.'
    },
    {
      value: 'prayer-meeting',
      label: 'Prayer Meeting',
      title: 'Prayer Meeting',
      description: 'Guided prayer and reflection session.'
    },
    {
      value: 'special-service',
      label: 'Special Service',
      title: 'Special Church Service',
      description: 'Special events and celebrations.'
    },
    {
      value: 'custom',
      label: 'Custom',
      title: '',
      description: ''
    }
  ];

  elements.serviceTemplate.addEventListener('change', (e) => {
    const selectedTemplate = SERVICE_TEMPLATES.find(t => t.value === e.target.value);
    if (selectedTemplate) {
      elements.serviceTitle.value = selectedTemplate.title;
      elements.serviceDescription.value = selectedTemplate.description;
    } else {
      elements.serviceTitle.value = '';
      elements.serviceDescription.value = '';
    }
  });

  // D. Form Submission / Prepare Workspace
  elements.serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validation
    const titleVal = elements.serviceTitle.value.trim();
    const descVal = elements.serviceDescription.value.trim();
    const timeVal = elements.serviceTime.value;

    if (!titleVal || !descVal || !timeVal) {
      alert('⚠️ Please fill out all service fields before preparing.');
      return;
    }

    // Persist to Supabase
    console.log('[Church Live] Form submit: creating event with:', {
      title: titleVal,
      description: descVal,
      scheduledAt: timeVal,
      status: 'DRAFT'
    });
    if (state.isPrepared) {
      showSupabaseError('A livestream is already prepared. Please select an existing service to continue.');
      return;
    }
    const createResult = await window.churchLiveSupabase.events.create({
      title: titleVal,
      description: descVal,
      scheduledAt: timeVal,
      status: 'DRAFT'
    });
    console.log('[Church Live] createEvent result:', createResult);

    if (!createResult.success) {
      showSupabaseError(`Failed to save service: ${createResult.error?.message}`);
      return;
    }

    // Refresh the events table from Supabase
    await loadEventsFromSupabase();

    // Change Workspace state to Prepared
    state.isPrepared = true;
    // Store the prepared event ID in sessionStorage so it persists across page refreshes
    // but not across browser sessions/logins
    if (createResult.success && createResult.data && createResult.data.id) {
      sessionStorage.setItem('preparedEventId', createResult.data.id);
    }

    // Update Console Elements
    elements.flowTitle.textContent = titleVal;
    
    // Format nicely for displaying
    const schedDate = new Date(timeVal);
    elements.flowTime.textContent = `Scheduled for: ${schedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${schedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    // Show Workspace Card, Hide Placeholder
    elements.prepConsole.classList.remove('disabled');
    elements.prepConsole.classList.add('active-preview');
    elements.prepBadge.textContent = 'Prepared';
    elements.prepBadge.className = 'badge prep-badge-ready';
    elements.consolePlaceholder.classList.add('hidden');
    elements.consoleFlow.classList.remove('hidden');

    // Make feed simulate online state
    const feedSim = document.querySelector('.preview-feed-sim');
    feedSim.classList.add('sim-on');

    updateStatusUI();
    
    // Smooth scroll console into focus if mobile screen
    elements.prepConsole.scrollIntoView({ behavior: 'smooth' });
  });

  // D. Simulating API Connections (Bringing OBS + Youtube Online dynamically)
  elements.btnSimulateConnect.addEventListener('click', () => {
    elements.btnSimulateConnect.textContent = 'Connecting via APIs... 📡';
    elements.btnSimulateConnect.disabled = true;

    setTimeout(() => {
      state.encoder = true;
      state.youtube = true;
      updateStatusUI();
      
      elements.btnSimulateConnect.textContent = '🔗 Simulate API Connect (Prepare OBS & YT)';
      elements.btnSimulateConnect.disabled = false;
    }, 1200);
  });

  // E. GO LIVE Sequence
  elements.btnStartStream.addEventListener('click', async () => {
    if (!state.camera || !state.audio || !state.internet || !state.encoder || !state.youtube) {
      alert('⚠️ Cannot start livestream. All system statuses must be green and fully online first!');
      return;
    }

    // Get current church ID
    const churchId = await getCurrentChurchId();
    if (!churchId) {
      alert('Could not retrieve church ID. Cannot start stream.');
      return;
    }

    // Get the prepared event ID (the event being started)
    const preparedEventId = sessionStorage.getItem('preparedEventId');
    if (!preparedEventId) {
      alert('No prepared event found. Please prepare an event first.');
      return;
    }

    // Generate a new idempotency key for this command
    const idempotencyKey = crypto.randomUUID();

    // Create the START_STREAM local helper command in Supabase
    const createResult = await window.churchLiveSupabase.localHelperCommands.create(
      churchId,
      'START_STREAM',
      preparedEventId,
      idempotencyKey
    );

    if (!createResult.success) {
      showSupabaseError(`Failed to create START_STREAM command: ${createResult.error?.message}`);
      return;
    }

    state.isLive = true;

    // Change layout styling to Live Red State
    elements.prepConsole.classList.remove('active-preview');
    elements.prepConsole.classList.add('live-mode');
    
    elements.prepBadge.textContent = '🔴 LIVE';
    elements.prepBadge.className = 'badge prep-badge-live';

    const feedSim = document.querySelector('.preview-feed-sim');
    feedSim.classList.add('live-broadcast');
    feedSim.querySelector('.feed-sim-text').innerHTML = '🔴 BROADCASTING LIVE NOW';

    // Toggle CTA Actions
    elements.btnStartStream.classList.add('hidden');
    elements.btnStopStream.classList.remove('hidden');
    elements.btnStopStream.textContent = 'END LIVESTREAM';

    // Start timer counter
    state.secondsElapsed = 0;
    elements.flowTime.textContent = `🔴 Streaming Live — 00:00:00`;
    state.timerInterval = setInterval(() => {
      state.secondsElapsed++;
      const hrs = String(Math.floor(state.secondsElapsed / 3600)).padStart(2, '0');
      const mins = String(Math.floor((state.secondsElapsed % 3600) / 60)).padStart(2, '0');
      const secs = String(state.secondsElapsed % 60).padStart(2, '0');
      elements.flowTime.textContent = `🔴 Streaming Live — ${hrs}:${mins}:${secs}`;
    }, 1000);
  });

  // F. STOP STREAM Sequence
  elements.btnStopStream.addEventListener('click', () => {
    const confirmation = confirm(
      state.isLive
        ? 'Are you sure you want to END the Church Livestream broadcast now?'
        : 'Are you sure you want to cancel the prepared livestream?'
    );
    if (!confirmation) return;

    // Differentiate between LIVE and PREPARED states
    if (state.isLive) {
      // LIVE → END LIVESTREAM (existing behavior)
      
      // Reset Live states
      state.isLive = false;
      clearInterval(state.timerInterval);

      const titleVal = elements.serviceTitle.value.trim();
      const schedTime = new Date(elements.serviceTime.value);

      // Format current completed time
      const serviceDateFormatted = schedTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const serviceTimeFormatted = schedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      // Append newly completed row to History Logs Table dynamically!
      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td class="cell-date">
          <div class="primary-text">${serviceDateFormatted}</div>
          <div class="secondary-text">${serviceTimeFormatted}</div>
        </td>
        <td class="cell-service">
          <div class="primary-text">${titleVal}</div>
          <div class="secondary-text">Broadcasted Live — Duration: ${String(Math.floor(state.secondsElapsed / 60)).padStart(2, '0')}m</div>
        </td>
        <td>
          <span class="service-status-pill status-completed">Completed</span>
        </td>
        <td class="cell-yt">
          <a href="https://youtube.com/watch?v=new_broadcast_sim" target="_blank" class="yt-link">
            <span class="yt-icon">▶</span> watch archive
          </a>
        </td>
      `;

      // Insert at top of the table logs
      elements.recentServicesTable.insertBefore(newRow, elements.recentServicesTable.firstChild);

      // Update history count indicator
      const currentRowsCount = elements.recentServicesTable.children.length;
      elements.historyCount.textContent = `${currentRowsCount} archived`;

      // Reset Workspace UI completely
      elements.prepConsole.className = 'card preparation-console disabled';
      elements.prepBadge.className = 'badge';
      elements.prepBadge.textContent = 'Inactive';
      
      elements.consolePlaceholder.classList.remove('hidden');
      elements.consoleFlow.classList.add('hidden');
      
      elements.btnStopStream.classList.add('hidden');
      
      const feedSim = document.querySelector('.preview-feed-sim');
      feedSim.className = 'preview-feed-sim';
      feedSim.querySelector('.feed-sim-text').textContent = 'READY TO BROADCAST';

      // Clear form title/description to make ready for next one
      elements.serviceTitle.value = '';
      elements.serviceDescription.value = '';
      elements.serviceTime.value = '';

      state.encoder = false;
      state.youtube = false;
      updateStatusUI();

      alert('🎉 Awesome! The livestream session has ended. Today\'s service record has been saved successfully in local history.');
    } else if (state.isPrepared) {
      // PREPARED → CANCEL PREPARATION (new behavior)
      
      // Clear prepared event ID from sessionStorage
      sessionStorage.removeItem('preparedEventId');

      // Reset local prepared state
      state.isPrepared = false;

      // Reset Workspace UI to inactive/waiting state
      elements.prepConsole.className = 'card preparation-console disabled';
      elements.prepBadge.className = 'badge';
      elements.prepBadge.textContent = 'Inactive';
      
      elements.consolePlaceholder.classList.remove('hidden');
      elements.consoleFlow.classList.add('hidden');
      
      elements.btnStopStream.classList.add('hidden');
      
      const feedSim = document.querySelector('.preview-feed-sim');
      feedSim.className = 'preview-feed-sim';
      feedSim.querySelector('.feed-sim-text').textContent = 'READY TO BROADCAST';

      // Clear form title/description to make ready for next one
      elements.serviceTitle.value = '';
      elements.serviceDescription.value = '';
      elements.serviceTime.value = '';

      state.encoder = false;
      state.youtube = false;
      updateStatusUI();
    }
  });

  // G. LOGIN Form Submission
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value;

    elements.loginError.textContent = '';

    if (!email || !password) {
      elements.loginError.textContent = '⚠️ Please enter your email and password.';
      return;
    }

    elements.loginButton.disabled = true;
    elements.loginButton.textContent = 'Signing In...';

    const result = await window.churchLiveSupabase.auth.login(email, password);

    if (!result.success) {
      elements.loginError.textContent = `❌ ${result.error?.message || 'Login failed. Please try again.'}`;
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = 'Sign In';
      return;
    }

    const profileValidated = await validateSessionAndShowDashboard();

    if (!profileValidated) {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = 'Sign In';
      return;
    }

    elements.loginButton.disabled = false;
    elements.loginButton.textContent = 'Sign In';
    elements.loginEmail.value = '';
    elements.loginPassword.value = '';
  });

  // H. LOGOUT Button
  elements.logoutButton.addEventListener('click', async () => {
    const result = await window.churchLiveSupabase.auth.logout();

        if (!result.success) {
      elements.loginError.textContent = `❌ ${result.error?.message || 'Logout failed. Please try again.'}`;
      return;
    }

    // Clear prepared event ID from sessionStorage on logout
    sessionStorage.removeItem('preparedEventId');

    // Clear camera preview stream on logout
    if (elements.cameraPreview && elements.cameraPreview.srcObject) {
      const tracks = elements.cameraPreview.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      elements.cameraPreview.srcObject = null;
    }
    if (elements.cameraPreviewContainer) {
      elements.cameraPreviewContainer.style.display = 'none';
    }
    if (elements.cameraSourceContainer) {
      elements.cameraSourceContainer.style.display = 'none';
    }

    isAuthenticatedAndActive = false;
    showLoginSection();
  });

  // I. FORGOT PASSWORD Button
  if (elements.forgotPasswordButton) {
    elements.forgotPasswordButton.addEventListener('click', () => {
      if (elements.loginForm) elements.loginForm.style.display = 'none';
      if (elements.forgotPasswordButton) elements.forgotPasswordButton.style.display = 'none';
      if (elements.resetPasswordForm) elements.resetPasswordForm.style.display = '';
      if (elements.resetError) elements.resetError.textContent = '';
      if (elements.resetSuccess) elements.resetSuccess.textContent = '';
    });
  }

  // J. RESET PASSWORD Form Submission
  if (elements.resetPasswordForm) {
    elements.resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = elements.resetEmail.value.trim();

      if (!email) {
        elements.resetError.textContent = '⚠️ Please enter your email address.';
        return;
      }

      elements.resetPasswordButton.disabled = true;
      elements.resetPasswordButton.textContent = 'Sending...';

      const result = await window.churchLiveSupabase.auth.resetPasswordForEmail(email);

      if (!result.success) {
        elements.resetError.textContent = `❌ ${result.error?.message || 'Failed to send reset link. Please try again.'}`;
        elements.resetPasswordButton.disabled = false;
        elements.resetPasswordButton.textContent = 'Send Reset Link';
        return;
      }

      elements.resetSuccess.textContent = '✅ Reset link sent! Check your email to set a new password.';
      elements.resetError.textContent = '';
      elements.resetPasswordButton.disabled = false;
      elements.resetPasswordButton.textContent = 'Send Reset Link';
    });
  }

  // K. RESET CANCEL Button (back to login)
  if (elements.resetCancelButton) {
    elements.resetCancelButton.addEventListener('click', () => {
      showLoginSection();
    });
  }

  // L. NEW PASSWORD Form Submission
  if (elements.newPasswordForm) {
    elements.newPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newPassword = elements.newPassword.value;
      const confirmPassword = elements.confirmPassword.value;

      // Validation
      if (!newPassword || !confirmPassword) {
        elements.newPasswordError.textContent = '⚠️ Please enter and confirm your new password.';
        return;
      }

      if (newPassword.length < 8) {
        elements.newPasswordError.textContent = '⚠️ Password must be at least 8 characters long.';
        return;
      }

      if (newPassword !== confirmPassword) {
        elements.newPasswordError.textContent = '❌ Passwords do not match. Please try again.';
        return;
      }

      elements.newPasswordButton.disabled = true;
      elements.newPasswordButton.textContent = 'Updating...';

      const result = await window.churchLiveSupabase.auth.updatePassword(newPassword);

      if (!result.success) {
        elements.newPasswordError.textContent = `❌ ${result.error?.message || 'Failed to update password. Please try again.'}`;
        elements.newPasswordButton.disabled = false;
        elements.newPasswordButton.textContent = 'Update Password';
        return;
      }

      // Show success state
      if (elements.newPasswordForm) elements.newPasswordForm.style.display = 'none';
      if (elements.passwordUpdatedSection) {
        elements.passwordUpdatedSection.style.display = '';
        if (elements.passwordUpdatedMessage) {
          elements.passwordUpdatedMessage.textContent = 'Password updated successfully. You can now sign in with your new password.';
        }
      }
      if (elements.newPasswordError) elements.newPasswordError.textContent = '';

      elements.newPasswordButton.disabled = false;
      elements.newPasswordButton.textContent = 'Update Password';
    });
  }

  // M. CONTINUE TO SIGN IN Button
  if (elements.continueSignInButton) {
    elements.continueSignInButton.addEventListener('click', () => {
      showLoginSection();
    });
  }
});
