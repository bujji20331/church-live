/**
 * CHURCH LIVE — FRONTEND APP
 * High-quality, interactive Phase 1 prototype of the church volunteer livestream dashboard.
 */

document.addEventListener('DOMContentLoaded', () => {
  
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
    historyCount: document.getElementById('history-count')
  };

  // ==========================================================================
  // 3. INITIALIZATION
  // ==========================================================================
  initDefaults();
  updateStatusUI();

  // ==========================================================================
  // 4. FUNCTION DEFINITIONS
  // ==========================================================================

  /**
   * Set smart default values for the scheduling date/time (the upcoming Sunday at 09:30 AM)
   */
  function initDefaults() {
    const now = new Date();
    const nextSunday = new Date();
    
    // Calculate days until next Sunday (0 is Sunday)
    const daysUntilSunday = (7 - now.getDay()) % 7;
    nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
    nextSunday.setHours(9, 30, 0, 0);

    // Format to datetime-local expected string 'YYYY-MM-DDThh:mm'
    const pad = (num) => String(num).padStart(2, '0');
    const formattedDate = `${nextSunday.getFullYear()}-${pad(nextSunday.getMonth() + 1)}-${pad(nextSunday.getDate())}T${pad(nextSunday.getHours())}:${pad(nextSunday.getMinutes())}`;
    
    elements.serviceTime.value = formattedDate;
  }

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
  elements.serviceForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Validation
    const titleVal = elements.serviceTitle.value.trim();
    const descVal = elements.serviceDescription.value.trim();
    const timeVal = elements.serviceTime.value;

    if (!titleVal || !descVal || !timeVal) {
      alert('⚠️ Please fill out all service fields before preparing.');
      return;
    }

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
});
