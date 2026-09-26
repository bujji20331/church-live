# Church Live Project Rule

Before starting any task, read `.clinedocs/activeContext.md` and the relevant existing project files.

Treat `.clinedocs/activeContext.md` as the project's current context and continuation point.

## Development Rules

* Continue from the existing implementation. Do not restart completed work.
* Do not unnecessarily rewrite working code.
* Preserve existing Supabase authentication.
* Preserve Supabase RLS and multi-church tenant isolation.
* Never introduce anonymous access to protected functionality.
* Preserve the SUPER_ADMIN and ADMIN authorization hierarchy.
* Do not modify `docs/supabase-schema.sql` unless the user explicitly instructs you to do so.
* Do not commit or push Git changes unless the user explicitly instructs you to do so.
* Before any proposed commit, inspect `git status --short` and the relevant `git diff`.
* Distinguish local code from the GitHub Pages deployed version.
* For browser-dependent functionality, do not claim browser testing has been completed based only on syntax checks.
* Use the existing `window.churchLiveMediaDevices` abstraction for camera and microphone functionality.
* Do not create manufacturer-specific hardware assumptions.
* Do not begin a future phase unless the user explicitly asks for it.
* When a task is complete, report the exact files changed, validation performed, and remaining limitations.

## Memory Bank

When beginning a substantial task:

1. Read `.clinedocs/activeContext.md`.
2. Read the relevant source files.
3. Check the current Git status.
4. Continue from the current implementation.

When a substantial task materially changes the project:

1. Update `.clinedocs/activeContext.md` with the new project state.
2. Record important implementation decisions.
3. Record remaining issues or next steps.

Never delete or replace useful existing context merely to shorten the file.

## Safety

If a tool error occurs:

* Do not restart the project.
* Do not redo completed work.
* Use the tools currently available.
* Continue from the current state.
* Report the error clearly.

If a requested change could affect authentication, authorization, RLS, database schema, or tenant isolation, stop and explain the potential impact before making a destructive or irreversible change.
