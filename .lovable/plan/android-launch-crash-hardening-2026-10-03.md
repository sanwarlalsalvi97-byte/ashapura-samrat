# Android launch crash hardening

## Scope
- Add a top-level React error boundary with a clean mobile retry screen so rendering failures no longer leave a blank or terminated-looking app.
- Replace eager route/page loading with guarded lazy loading and a lightweight loading fallback.
- Consolidate duplicate native deep-link startup handling and guard Capacitor calls so missing or unavailable plugins cannot abort launch.
- Make Firebase/Auth and Crashlytics initialization non-blocking and failure-safe; preserve current login and reporting behavior when services are available.
- Add focused tests for the error boundary and startup-safe behavior, then verify the web build and Android asset sync.

## Technical details
- Keep the current routes, styling, features, app ID, authentication configuration, and Android permissions unchanged.
- Use React `lazy`/`Suspense`, optional environment checks for browser globals, and plugin availability checks before native calls.
- Record only the startup architecture decision in `AGENTS.md`; no database changes are needed.
