# Church Live — Active Context

## Project Goal

Church Live is a reusable, browser-based livestream management application for churches.

The application is intended for non-technical church volunteers and should eventually allow a church to manage livestream preparation, camera/microphone hardware, services, YouTube livestream information, and future streaming workflows through a simple web interface.

The project should prioritize:

* Simple volunteer-friendly UI
* Free or very low-cost infrastructure where practical
* Multi-church architecture
* Secure authentication and authorization
* Church-level tenant isolation
* Browser-based operation
* Reusable architecture rather than church-specific hardcoding

---

## Current Project

Local project:
`/Users/vijaykumar/interview-prescreen-mvp/church-live`

GitHub repository:
`bujji20331/church-live`

GitHub Pages:
`https://bujji20331.github.io/church-live/`

Supabase project URL:
`https://dwvbjfgviidcdogkdxku.supabase.co`

Main branch:
`main`

---

## Technology

Frontend:

* HTML
* CSS
* JavaScript

Hosting:

* GitHub Pages

Backend:

* Supabase
* Supabase Authentication
* Supabase PostgreSQL
* Supabase Row Level Security (RLS)

The project does NOT use React.

---

## Completed Phases

### Phase 1–4 — COMPLETE

Completed:

* Frontend shell
* GitHub Pages deployment
* Supabase email/password authentication
* Login/session handling
* Logout
* Password recovery
* Unauthenticated route gating

### Phase 5A — COMPLETE AND COMMITTED

Implemented multi-church tenant architecture.

Includes:

* `churches` table
* `church_id` on relevant tables
* Church-level tenant isolation
* `SUPER_ADMIN` role
* `ADMIN` role
* `get_current_user_church_id()`
* `get_current_user_role()`
* SECURITY DEFINER helper functions with restricted search_path
* RLS policies for tenant isolation
* SUPER_ADMIN is church-scoped
* ADMIN is operational only
* Additional admins cannot remove/delete the primary/super admin or alter admin membership outside the intended hierarchy

The committed Phase 5A HEAD is:

`a0dd631eece20b0f5c099d40847bb6f1e5a32caa`

Do not assume newer changes are committed unless verified with Git.

---

## Phase 5B — CURRENT DEVELOPMENT PHASE

Phase 5B includes the operational dashboard.

Implemented locally:

* Church header
* Today's service
* Service CRUD
* Livestream status
* Not Started
* Preparing
* Live
* Ended
* YouTube information fields
* Manual YouTube tracking
* Recent services
* SUPER_ADMIN-only church settings
* Role-aware UI

Phase 5B changes are currently being reviewed locally and must NOT be assumed to be committed or deployed.

---

## Media Device Integration

`js/media-devices.js` provides a browser-standard media device abstraction.

It uses standard browser APIs and does not contain manufacturer-specific assumptions.

Available functionality includes:

* `enumerateVideoDevices`
* `enumerateAudioDevices`
* `enumerateMediaDevices`
* `requestMediaPermissions`
* `hasMediaPermissions`
* `getDefaultVideoDevice`
* `getDefaultAudioDevice`
* `getDeviceById`
* `getDeviceLabel`
* `isMediaDevicesSupported`
* `initializeMediaDevices`
* `onDeviceChange`
* `createMediaStream`

The module is exposed through:

`window.churchLiveMediaDevices`

The module itself should not be unnecessarily rewritten.

The Phase 5B dashboard now integrates this module for real camera/microphone detection.

The dashboard should NOT use fake or simulated camera/microphone connection states.

---

## Current Media Permission Flow

The dashboard has a:

"Grant Camera & Microphone Access"

button.

The expected flow is:

1. User clicks the permission button.
2. Browser requests camera and microphone permissions.
3. If permission is granted, devices are enumerated.
4. Camera and microphone status reflect actual hardware availability.
5. Device changes should be detected through the media-device change listener.
6. Unsupported browsers should report NOT SUPPORTED.
7. Denied permissions should produce an appropriate NOT CONNECTED state.

Do not implement actual YouTube streaming as part of this media-device verification work.

---

## Important Git Safety Rules

DO NOT commit or push automatically.

Before every commit:

1. Run `git status --short`.
2. Review `git diff`.
3. Identify exactly which files belong to the current task.
4. Exclude unrelated changes.
5. Never commit files merely because they appear as modified.

### Critical file

`docs/supabase-schema.sql`

This file contains a pre-existing unrelated modification.

It must NOT be:

* modified
* reverted
* regenerated
* overwritten
* staged
* committed
* pushed

unless the user explicitly asks for that work.

---

## Supabase File Transition

The project is transitioning from:

`js/supabase.js`

to:

`js/supabase-v2.js`

Before committing this transition, verify:

* `supabase-v2.js` is intentionally replacing the old file
* no application code still depends on the deleted old file
* `index.html` loads the intended Supabase implementation
* authentication still works
* database queries still work
* no functionality was accidentally lost

Do not blindly restore the old `supabase.js`.

---

## Local Testing

The local application can be served with:

```bash
cd /Users/vijaykumar/interview-prescreen-mvp/church-live
python3 -m http.server 8000
```

Then open:

`http://localhost:8000`

GitHub Pages is the deployed committed version and may NOT contain the latest local changes.

Always distinguish between:

LOCAL:
`http://localhost:8000`

DEPLOYED:
`https://bujji20331.github.io/church-live/`

Do not assume a GitHub Pages behavior represents the latest local code.

---

## Browser Testing

The application should be tested in an actual browser when functionality depends on:

* camera
* microphone
* browser permissions
* MediaDevices API
* MediaStream
* authentication UI
* browser-specific behavior

Do not claim browser functionality has been verified merely because JavaScript syntax checks pass.

---

## Required JavaScript Verification

For relevant JavaScript changes, run:

```bash
node --check js/app.js
node --check js/media-devices.js
node --check js/config.js
```

If other JavaScript files are modified, check those as appropriate.

---

## Development Rules

Before modifying code:

1. Read the relevant existing files.
2. Read `.clinedocs/activeContext.md`.
3. Understand the current implementation.
4. Do not rewrite working functionality unnecessarily.
5. Make the smallest appropriate change.
6. Preserve existing authentication and RLS behavior.
7. Preserve multi-church tenant isolation.
8. Do not introduce anonymous access to protected functionality.
9. Do not weaken authorization to make testing easier.
10. Do not start future phases unless explicitly requested.

---

## Authentication / Authorization Rules

Protected Church Live functionality must require authenticated Supabase access.

Sharing the public GitHub Pages URL must NOT automatically grant access to protected functionality.

The primary SUPER_ADMIN controls the church's administrative membership.

Additional ADMIN users must not be able to:

* remove the primary SUPER_ADMIN
* delete the primary SUPER_ADMIN
* add unauthorized administrators
* modify administrative membership outside the intended hierarchy

Preserve these rules when changing frontend or backend code.

---

## Multi-Church Rules

Church data must remain isolated by `church_id`.

Never create a frontend shortcut that bypasses Supabase RLS.

Never assume one church is the only church.

Do not hardcode the current church as the permanent architecture.

---

## Current Development Status

The current implementation has reached Phase 5B.

Media-device integration has been implemented locally.

Current priority:

FINAL REVIEW → LOCAL TESTING → GIT DIFF REVIEW → COMMIT → PUSH → VERIFY GITHUB PAGES

Do not skip directly to future phases.

---

## Future YouTube / Streaming Work

Do not assume that adding YouTube API integration automatically provides browser-to-YouTube video transport.

Future streaming architecture must separately determine:

* how browser MediaStream reaches the streaming service
* whether a streaming/ingestion server is required
* whether WebRTC, RTMP, WHIP, or another protocol is appropriate
* hosting requirements
* bandwidth requirements
* browser limitations
* YouTube ingestion requirements
* whether the proposed solution can realistically remain free

Do not implement Phase 6 streaming architecture without first evaluating these constraints.

---

## Cline Working Rules

Before starting a task:

1. Read this file.
2. Read the relevant project files.
3. Check Git status.
4. Continue from the existing implementation.
5. Do not restart completed work.

Before finishing a major task:

1. Run relevant validation.
2. Report exact files changed.
3. Report any untracked/deleted files.
4. Report test results.
5. Update this memory bank when the project state materially changes.
6. Do NOT commit or push unless explicitly instructed.

When a task is blocked by a tool error:

* Do not restart the project.
* Use the tools that are actually available.
* Continue from the current state.
* Report the error clearly.

---

## Current Safe Continuation Point

The next immediate task is to review the completed Phase 5B media-device integration.

Do not:

* redo Phase 5B
* rewrite `js/media-devices.js`
* modify `docs/supabase-schema.sql`
* commit automatically
* push automatically
* begin Phase 6

The next action should be a read-only Git/diff/validation review followed by local browser testing.
