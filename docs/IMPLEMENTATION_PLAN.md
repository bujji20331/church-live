# Church Live — Implementation Plan

This roadmap outlines the systematic development of Church Live. It is structured into sequential phases to guarantee a simple, thoroughly tested, and modular application that perfectly suits non-technical church volunteers.

---

## COMPLETED

### Phase 1: Project Foundation & Dashboard ✅
* **Goal**: Establish core file structure, design a clean responsive dashboard, create initial configuration templates, and outline the technical architecture.
* **Deliverables**:
  - `index.html`: Responsive layout designed for desktop, tablet, and mobile.
  - `css/style.css`: Clean, standard layout with clear system statuses (🟢/🔴).
  - `js/app.js`: Local simulated state handling, form validation, and interactive preparation events.
  - `docs/ARCHITECTURE.md`: Technical and physical flow definitions.
  - `docs/IMPLEMENTATION_PLAN.md`: Phased expansion schedule.
  - `.env.example` and `.gitignore` file foundations.

---

## CURRENT

### Phase 2: Supabase-Ready Foundation ✅
* **Goal**: Prepare the application for future Supabase integration and the future local Church Laptop helper, while keeping the application fully functional as a static demo.
* **Deliverables**:
  - `js/config.js`: Central configuration and state management module.
  - `js/supabase.js`: Supabase integration module (foundation only, no real connection yet).
  - `docs/supabase-schema.sql`: SQL schema for future Supabase tables (`church_settings`, `services`, `system_logs`).
  - Updated `.env.example`: Documented Supabase, YouTube, OBS, and local helper configuration with security warnings.
  - Updated `docs/ARCHITECTURE.md`: Documented physical hardware architecture, future local helper endpoints, and security considerations.
  - **Demo-first approach**: The application continues to work as a static demo without Supabase configuration.

---

## COMPLETED — Phase 2.5: Event/Livestream Architecture Revision ✅

### Phase 2.5: Event/Livestream Schema & Documentation Revision
* **Goal**: Generalize the database schema from fixed "services" to a flexible **EVENT/LIVESTREAM** model that supports multiple church event types and future streaming scenarios, WITHOUT implementing any integrations.
* **What changed**:
  - `docs/supabase-schema.sql`: Reorganized into a clean, Phase 3-ready initial schema centered on `events` rather than fixed services. Added structured enums for event types, streaming modes, video sources, and audio sources. Ensured all logs, settings, and future YouTube fields are in place. No Supabase connection, no RLS policies (future), no data in the database.
  - `docs/ARCHITECTURE.md`: Added Section 5 describing the revised event/livestream architecture, supported event types, streaming modes, video/audio sources, control-layer design principle (NOT a custom video CDN), and explicit note that remote Bible-study streaming is a future capability.
  - `docs/IMPLEMENTATION_PLAN.md`: Updated phase numbering to reflect this revision as Phase 2.5.
  - `README.md`: Updated to clarify multiple event types and livestream scenarios are intended, with future capabilities clearly marked as NOT IMPLEMENTED.
* **NOT implemented in this phase** (explicitly out of scope):
  * YouTube API integration / YouTube OAuth / YouTube live streaming
  * Phone camera streaming / Remote participation
  * Zoom integration / WebRTC
  * OBS integration / control
  * Local Python helper / hardware monitoring
  * Supabase connection, authentication, RLS policies
  * Any video transcoding, streaming infrastructure, or paid services
* **Demo-first approach**: The application continues to work as a fully functional static demo (Phase 1/2 dashboard) with no Supabase or YouTube connection.

---

## FUTURE

### Phase 3: Supabase Connection & Authentication
* **Goal**: Connect the application to Supabase and enable volunteer user log-ins.
* **Deliverables**:
  - Create and configure Supabase project (Free tier).
  - Apply `docs/supabase-schema.sql` to create tables.
  - Configure Row Level Security (RLS) policies.
  - Integrate Supabase JS client via CDN.
  - Add login form on Dashboard, storing public credentials safely on the static site.
  - Synchronize `church_settings`, `events`, and `system_logs` with Supabase.

### Phase 4: Event / Service Management
* **Goal**: Provide real CRUD operations for church events via Supabase, supporting all event types (Sunday Service, Bible Study, Prayer Meeting, Special Event, Other).
* **Deliverables**:
  - Event creation form with title, description, event type, scheduled time, streaming mode, and source selections.
  - Event list/management interface.
  - Status transitions (DRAFT → READY → LIVE → ENDED) persisted to Supabase.
  - Event lifecycle entries written to `system_logs` table.
  - Keep the existing simulated dashboard as a fallback when Supabase is not connected.

### Phase 5: YouTube Integration
* **Goal**: Automatically schedule broadcasts and acquire stream keys using the official YouTube API and OAuth.
* **Deliverables**:
  - Setup Google Cloud Console Project and configure YouTube Live Streaming API.
  - Add Google OAuth login flow (restricted to Church Administrators).
  - Web dashboard reads scheduling information, calls YouTube Live API to create a "Broadcast" and "Stream", and retrieves the RTMP Stream Key.
  - Automatically update the OBS profile with the new stream key via the Python Local Helper.
  - Future functionality: create broadcast, schedule broadcast, start broadcast, stop broadcast, retrieve YouTube video URL, monitor broadcast state.
  - **Security**: YouTube OAuth secrets must NEVER be stored in frontend JavaScript.

### Phase 6: Local OBS / Encoder Integration
* **Goal**: Control OBS Studio starting, stopping, and recording via the web dashboard.
* **Deliverables**:
  - Configure `obs-websocket` plugin in OBS Studio on the laptop.
  - Extend Python Local Helper to connect to OBS via WebSocket.
  - Implement commands in Local Helper: `start_stream()`, `stop_stream()`, `get_stream_status()`.
  - Bridge Web Dashboard actions to Local Helper commands.


### Phase 6.5: Universal Hardware Support (Universal Hardware Foundation)
* **Goal**: Make Church Live work with any standard video/audio device the user's
  Mac or Windows computer and browser can expose. No manufacturer-specific
  assumptions in the core architecture.
* **Deliverables**:
  - `js/media-devices.js`: Reusable browser device-detection module with
    `enumerateVideoDevices()`, `enumerateAudioDevices()`,
    `enumerateMediaDevices()`, `requestMediaPermissions()`,
    `getDeviceLabel()`, `getDefaultVideoDevice()`,
    `getDefaultAudioDevice()`.
  - Generic device abstraction in the UI: video/audio device selection
    dropdowns populated from the browser, not from a hard-coded manufacturer list.
  - Correct permission handling: request permission when necessary, re-enumerate
    after permission, handle denial gracefully, handle no devices gracefully,
    listen for `devicechange` events.
  - Update `docs/ARCHITECTURE.md` with the "Universal Hardware Support" section
    explaining the abstraction chain from physical equipment to Church Live.
  - Update `docs/IMPLEMENTATION_PLAN.md` with this phase.
  - Preserve backward compatibility: existing `video_source` and `audio_source`
    values (e.g., `CHURCH_CAMERA`, `YAMAHA_MIXER`) remain valid in the database.
    No destructive migration.
* **NOT implemented in this phase**:
  - No actual YouTube streaming.
  - No OBS integration.
  - No full dashboard redesign.
  - No paid services, cloud video storage, or proprietary hardware SDKs.

### Phase 7: Remote Phone / Computer Livestream Capability
* **Goal**: Support remote Bible studies and guest livestreams where a pastor/leader participates via phone or computer camera and microphone.
* **Deliverables**:
  - Define and store remote participant event configurations (streaming_mode = PHONE_REMOTE or COMPUTER_REMOTE).
  - Support selection of PHONE_CAMERA/COMPUTER_CAMERA video sources and PHONE_MIC/COMPUTER_MIC audio sources in event setup.
  - (Detailed streaming implementation TBD in a future approval cycle.)

### Phase 8: Monitoring, Reliability and Recovery
* **Goal**: Detect and report actual hardware connection states (camera, audio, internet, encoder, YouTube).
* **Deliverables**:
  - **Hardware-agnostic connection detection**: Use `js/media-devices.js` to detect that the **browser's video/audio device is connected and functioning** (no specific manufacturer/model knowledge needed).
  - Church internet connection monitoring.
  - OBS status monitoring.
  - Church laptop health monitoring.
  - YouTube Live connection status monitoring.
  - Replace all DEMO / NOT CONNECTED labels with real status values.
  - Automatic status recovery and retry logic for dropped connections.

### Phase 9: Scheduling and Recurring Events
* **Goal**: Add scheduling and automation features for church events.
* **Deliverables**:
  - Calendar-based event scheduling.
  - Automated reminders and notifications.
  - Recurring event templates (e.g., weekly Sunday services).
  - Automated status transitions (DRAFT → READY → LIVE → ENDED).

### Phase 10: Advanced Features
* **Goal**: Add optional advanced features for enhanced engagement and professional presentation.
* **Deliverables**:
  - Church branding overlays, lower thirds, automated transition scenes, stream title cards.
  - Automated sermon transcription, AI-generated summaries, stream analytics, congregation engagement insights.

---

## IMPORTANT NOTES

* **Do not start future phases automatically.** Each phase will be implemented separately with its own approval.
* **Phase 2 is a foundation only.** No real Supabase connection, local helper, OBS control, or YouTube API integration is implemented yet.
* **The application must remain a fully functional static demo** until real integrations are ready and securely configured.
* **No API keys or secrets** are hard-coded in frontend JavaScript. Service-role keys and OAuth secrets must never be placed in the frontend.
