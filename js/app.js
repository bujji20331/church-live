/**
 * CHURCH LIVE — FRONTEND APP
 * Phase 3: Connected to Supabase for real event persistence.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Church Live] DOMContentLoaded: starting initialization');

  // Hide dashboard immediately; login screen is the default view until auth is validated
  showLoginSection();


  // ==========================================================================
  // 1. STATE VARIABLES
  // ==========================================================================
  const state = {
    camera: true,
    audio: true,
    internet: true,
    encoder: false,
    youtube: false,
    isPrepared: false,
    isLive: false,
    service: {
      id: null,
      title: '',
      description: ''
    },
    timerInterval: null,
    secondsElapsed: 0
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

    // Service Setup Form
    serviceForm: document.getElementById('service-form'),
    serviceTitle: document.getElementById('service-title'),
    serviceDescription: document.getElementById('service-description'),
    serviceTime: document.getElementById('service-time'),
    btnLoadTemplate: document.getElementById('btn-load-template'),

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
    continueSignInButton: document.getElementById('continue-sign-in-button')
  };

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
     initDefaults();

   // ==========================================================================
   // 4. AUTHENTICATION GATING
   // ==========================================================================
   let isAuthenticatedAndActive = false;

   async function checkAuthenticationAndLoad() {
     const session = await getSession();
     if (!session) {
       // No authenticated session - skip private data loading
       console.log('[Church Live] No authenticated session - showing login');
       showLoginSection();
       return;
     }

     // Authenticated session - verify profile
     const profile = await getCurrentProfile();
     if (!profile || !profile.success || profile.data?.is_active !== true ||
         (profile.data?.role !== 'SUPER_ADMIN' && profile.data?.role !== 'ADMIN')) {
       console.log('[Church Live] Insufficient permissions - showing login');
       showLoginSection();
       return;
     }

     console.log('[Church Live] Authenticated user with valid role - loading private data');
     isAuthenticatedAndActive = true;
     showDashboardSection();
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
    elements.historyCount.textContent = `${events.length} archived`;
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
        <span class="service-status-pill ${event.status === 'LIVE' ? 'status-live' : 'status-completed'}">
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
    `;
    
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
  // 5. EVENT LISTENERS
  // ==========================================================================

  /**
   * Synchronize the Javascript state variables with the HTML DOM indicator circles and text
   */
  function updateStatusUI() {
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

    syncItem(elements.statusCamera, state.camera, 'CONNECTED', 'OFFLINE');
    syncItem(elements.statusAudio, state.audio, 'CONNECTED', 'OFFLINE');
    syncItem(elements.statusInternet, state.internet, 'STABLE', 'DISCONNECTED');
    syncItem(elements.statusEncoder, state.encoder, 'READY', 'OFFLINE');
    syncItem(elements.statusYoutube, state.youtube, 'PREPARED', 'UNPREPARED');

    // Recalculate Overall Health Check badge
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

    // Determine if we can reveal the final "START LIVESTREAM NOW" button
    if (isObsReady && isYtReady) {
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

  // ==========================================================================
  // 5. EVENT LISTENERS
  // ==========================================================================

  // A. Click to Toggle/Simulate Device Statuses (Extremely engaging for client walkthrough!)
  elements.statusCamera.addEventListener('click', () => {
    state.camera = !state.camera;
    updateStatusUI();
  });

  elements.statusAudio.addEventListener('click', () => {
    state.audio = !state.audio;
    updateStatusUI();
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

  // B. Load Default Template
  elements.btnLoadTemplate.addEventListener('click', (e) => {
    e.preventDefault();
    elements.serviceTitle.value = DEFAULT_TEMPLATE.title;
    elements.serviceDescription.value = DEFAULT_TEMPLATE.description;
  });

  // C. Form Submission / Prepare Workspace
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
  elements.btnStartStream.addEventListener('click', () => {
    if (!state.camera || !state.audio || !state.internet || !state.encoder || !state.youtube) {
      alert('⚠️ Cannot start livestream. All system statuses must be green and fully online first!');
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
    const confirmation = confirm('Are you sure you want to END the Church Livestream broadcast now?');
    if (!confirmation) return;

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

    // Clear form title/description to make ready for next one or leave as is
    state.isPrepared = false;
    state.encoder = false;
    state.youtube = false;
    updateStatusUI();

    alert('🎉 Awesome! The livestream session has ended. Today\'s service record has been saved successfully in local history.');
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
