# Notification Settings screen

## Build
- Add a dedicated bilingual Notification Settings page with four reminder rows, toggles, descriptions, and time selectors.
- Add the device timezone card and the requested local-notification helper note.
- Persist reminder choices on the device and schedule/cancel repeating daily reminders with Capacitor Local Notifications.
- Request notification permission when a reminder is enabled and show clear Hindi feedback if permission is unavailable.
- Add an entry from Settings and protect the new page consistently with the signed-in app.

## Verify
- Run TypeScript and production build checks.
- Open the Settings entry and new page in the preview to verify layout and controls.
