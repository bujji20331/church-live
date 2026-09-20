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

*Architecture Version 2.5 (Phase 2.5)*
*General purpose event/livestream management system supporting multiple church event types.*
