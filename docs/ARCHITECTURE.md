# Church Live — Architecture Document

This document outlines the system and software architecture of the **Church Live** web application. Designed for simplicity, cost efficiency, and ease of use, Church Live targets non-technical church volunteers to manage and monitor Sunday livestreaming.

---

## 1. Overall System Architecture

The ecosystem consists of two key environments:
1. **The Church (Physical Environment)**: Where the physical media capture and local encoding occur.
2. **The Cloud (Control and Delivery)**: Where the volunteer-facing dashboard runs, database records are stored, and stream delivery occurs.

```
+--------------------------------------------------------------------------------+
|                             THE CHURCH (PHYSICAL)                              |
|                                                                                |
|  [ Panasonic HC-MD12M ]                                                        |
|           |                                                                    |
|           | HDMI                                                               |
|           v                                                                    |
|  [ HDMI-to-USB Capture ]                                                       |
|           |                                                                    |
|           | USB                                                                |
|           v                                                                    |
|  [ Church Laptop ] <======== USB ========> [ Yamaha MG16XU Audio Mixer ]       |
|  [ (OBS Studio)  ]                                                             |
|           |                                                                    |
|           +-----------------+                                                  |
|                             | (Local control loop)                             |
|                             v                                                  |
|                      [ Local Helper ] (Python)                                 |
+-----------------------------|--------------------------------------------------+
                              |
                              | Internet
                              v
+--------------------------------------------------------------------------------+
|                              THE CLOUD (CONTROL)                               |
|                                                                                |
|      +---------------------+                                                   |
|      |  GitHub Pages       | <==== Realtime Status, Config, and Logs ====+     |
|      |  (Church Live Web)  |                                             |     |
|      +---------------------+                                             |     |
|                 |                                                        |     |
|                 | Auth & Records                                         v     |
|                 v                                                  [ YouTube ] |
|      +---------------------+                                       [  Live   ] |
|      |      Supabase       |                                                   |
|      | (Database & Auth)   |                                                   |
|      +---------------------+                                                   |
+--------------------------------------------------------------------------------+
```

---

## 2. Component Details

### A. Camera (Panasonic HC-MD12M)
* **Role**: Primary video source capturing high-quality video of the church service.
* **Output**: Real-time video fed via an HDMI out port.
* **Connection**: Plugs into an HDMI-to-USB capture device.

### B. Audio Mixer (Yamaha MG16XU)
* **Role**: Primary audio source combining church microphones (pulpit, choir, instruments).
* **Output**: Studio-grade stereo mix via built-in USB interface.
* **Connection**: Connected via standard USB to the Church Laptop. This preserves the existing physical PA system (Ahuja TZA-4000DPM amplifier remains in place for in-house sound amplification).
* **Recommendation**: The livestream should preferably use the Yamaha MG16XU USB audio feed directly into the church laptop rather than attempting to capture the amplified speaker output. This provides a cleaner audio signal for the broadcast.

### C. Video & Audio Digitization (HDMI-to-USB Capture)
* **Role**: Converts physical HDMI camera signal to standard USB video class (UVC) signal.
* **Connection**: Plugged directly into the USB port of the Church Laptop.

### D. Local Encoder & Software (OBS Studio)
* **Role**: Integrates the digitized video (UVC capture card) and audio (Yamaha USB input), applies layouts/overlays, encodes the stream (H.264/AAC), and broadcasts to YouTube Live.
* **Status**: Configured with YouTube RTMP Stream Key. Will eventually be automated via OBS WebSockets.

### E. Frontend Dashboard (Church Live Web App)
* **Role**: Centralized command center for the church volunteers.
* **Technology**: Vanilla HTML5, CSS3, and modern ES6 JavaScript.
* **Deployment**: Hosted completely free on **GitHub Pages** as a static website. No complex build frameworks are needed.

### F. Backend & Database (Supabase)
* **Role**: Stores church configuration, historical logs, service metadata, and authenticates volunteers.
* **Technology**: PostgreSQL Database, GoTrue Auth, and Row-Level Security (RLS) policies.
* **Pricing**: Free tier.

### G. Local Helper (Future Python Service)
* **Role**: A tiny, background script running on the Church Laptop.
* **Responsibility**: Listens for commands from the web app, monitors laptop system metrics (CPU, Internet speed, audio output), and controls OBS Studio via OBS WebSockets (starting/stopping the stream).
* **Important**: This local helper must NOT be exposed directly to the public internet. It should only be reachable from the local network or via a secure tunnel, and the Church Live Web App should communicate with it through a secure bridge (e.g., a local network connection or a secure tunnel) when the church laptop is on the same network.
* **Future Endpoints** (to be implemented in Phase 4, not yet built):
  * `GET  /health` - Check if the local helper service is running and healthy
  * `GET  /status` - Get the overall health status of the church laptop
  * `GET  /devices` - List connected devices (camera, audio interface, encoder)
  * `GET  /stream/status` - Get the current state of the livestream (not started, streaming, stopped)
  * `POST /stream/start` - Start the livestream (via OBS)
  * `POST /stream/stop` - Stop the livestream (via OBS)
  * `POST /stream/restart` - Restart the livestream (via OBS)
* **Purpose**: This local helper will eventually allow the Church Live dashboard to know whether the camera, audio, encoder and livestream are actually ready — not just simulated.

---

## 3. Data Flow

### 1. Pre-Service Setup
1. Volunteer opens the **Church Live** dashboard.
2. The web page reads current hardware/status variables from the database/local checks.
3. Volunteer enters the service Title and Description and schedules/prepares the stream.

### 2. Stream Initiation Sequence
1. Volunteer clicks **Prepare Livestream**.
2. Web App instructs Supabase to insert a new service record and triggers YouTube stream readiness.
3. Once active, the Web App (or future Local Helper) initiates stream transmission from OBS to YouTube.
4. UI transitions to **🔴 LIVE** and showcases current stream health metrics.

### 3. Post-Service Sequence
1. Volunteer clicks **End Livestream**.
2. OBS stops transmitting. YouTube begins archiving the live video.
3. The database updates the service status to "Archived" and stores the video URL.

---

## 4. Security Principles
* **Row-Level Security (RLS)**: Enforced on Supabase to ensure only authorized church users can write to settings, logs, or services.
* **Static Credentials Separation**: Private variables (e.g., YouTube Client Secrets, OBS Passwords) are kept out of frontend codebase. Static Pages use public Supabase Keys and standard Google OAuth flows.
* **No paid dependencies**: Fully utilizes free tiers of GitHub, Supabase, and Google.

---

## 5. Event/Livestream Architecture (Phase 2.5 Revision)

The application is designed around a general **EVENT/LIVESTREAM** concept rather than assuming every event uses fixed church hardware. This enables multiple streaming scenarios:

### Supported Event Types
- **SUNDAY_SERVICE**: Traditional Sunday worship services using church equipment
- **BIBLE_STUDY**: Remote Bible studies with pastor participation via phones/computers
- **PRAYER_MEETING**: Prayer groups and small group gatherings
- **SPECIAL_EVENT**: Christmas services, weddings, baptisms, etc.
- **OTHER**: Any additional church event types

### Streaming Modes (Database Schema)
The `streaming_mode` field supports:
- **CHURCH_EQUIPMENT**: Camera + mixer + OBS (traditional Sunday service)
- **PHONE_REMOTE**: Remote participation via phone camera
- **COMPUTER_REMOTE**: Computer-based remote streaming
- **OBS**: Direct OBS control (future integration)
- **OTHER**: Generic streaming modes

### Video Sources & Audio Sources
- **Video**: CHURCH_CAMERA, PHONE_CAMERA, COMPUTER_CAMERA, OBS, OTHER
- **Audio**: YAMAHA_MIXER, PHONE_MIC, COMPUTER_MIC, USB_AUDIO, OTHER

### Control Layer Design
Church Live is a **control/management layer** and should NOT become a custom video streaming CDN. It coordinates between:
- Local Church Encoder/OBS (future Phase 6)
- YouTube as the video distribution and archive platform (future Phase 5)
- Remote phone/computer participants (future Phase 7)

### Remote Bible-Study Streaming (Future)
Remote Bible-study streaming is a **future capability** and is not implemented in this phase. The database schema is prepared to store:
- Event metadata (title, description, type, schedule, status)
- YouTube references (broadcast ID, video ID, archive URL)
- System logs (event lifecycle, errors, connection changes)

---

## 6. Universal Hardware Support

Church Live is designed to be **hardware-agnostic** (universal). The application
does NOT depend on any specific manufacturer, brand, model number, or connection
type (USB-A, USB-C, Thunderbolt, HDMI, 3.5mm, etc.).

### 6.1 Device Abstraction Chain

```
Physical equipment (camera, mixer, microphone, etc.)
            ↓
Connection / adapter / capture device / audio interface
            ↓
Mac or Windows (operating system)
            ↓
Operating system device
            ↓
Browser MediaDevices API (navigator.mediaDevices)
            ↓
Church Live (js/media-devices.js)
```

### 6.2 Core Principle

Church Live cares only about the **video/audio device presented by the
operating system and browser**, not the manufacturer of the physical equipment.

Supported video sources (any browser-compatible device):
- USB webcam / USB camera
- HDMI camera through an HDMI-to-USB capture device
- DSLR/mirrorless camera through a compatible capture device
- OBS virtual camera
- Any other `videoinput` device

Supported audio sources (any browser-compatible device):
- USB microphone
- 3.5mm computer audio input
- USB audio interface
- Mixer connected through USB
- Mixer connected through an audio adapter
- Computer microphone
- Any other `audioinput` device

### 6.3 Implementation

The `js/media-devices.js` module provides a reusable abstraction over the
browser's standard MediaDevices API:

- `navigator.mediaDevices.enumerateDevices()` — list all video/audio inputs
- `navigator.mediaDevices.getUserMedia()` — request permission and test a device
- `deviceId` — identify a specific video/audio input
- `kind: 'videoinput` — identify a specific video/audio input

The UI never hard-codes any manufacturer-specific device names or connection types.

### 6.4 Backward Compatibility

Existing database fields and source-type values are preserved for now:
- `events.video_source` — may still contain legacy values such as `CHURCH_CAMERA`
- `events.audio_source` — may still contain legacy values such as `YAMAHA_MIXER`

No destructive database migration is performed. These values are treated as
legacy metadata and do not affect device selection logic. Future migrations may
map them to generic values.

### 6.5 Browser Permissions

Device labels may be blank before permission is granted. The media-devices module
requestMediaPermissions() first, then re-enumerate() after permission.
- Handle permission denial gracefully (show "no permission" state).
- Handle no camera/microphone gracefully (show "no device" state).
- Listen for `devicechange` events to handle unplug/replug where practical.
- Never continuously request permission.

### 6.6 Current Church Equipment

The current church setup (Panasonic HC-MD12M camera, Yamaha MG16XU mixer,
HDMI-to-USB capture device, AUX connection to the laptop) continues to work
because the browser exposes the resulting video and audio input devices. The
application does not need to know these specific models.

---

*Architecture Version 2.5 (Phase 2.5)*
*General purpose event/livestream management system supporting multiple church event types.*
