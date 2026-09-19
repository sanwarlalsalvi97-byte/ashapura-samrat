# Fix native Google OAuth redirect

## Changes
- Generate the native Google OAuth URL through the existing authentication client.
- Pass `ashapurasamrat://google-auth` as the native `redirectTo` value and prevent WebView navigation.
- Continue opening Google in the Android system browser and exchange the callback code when the deep link returns.
- Leave browser sign-in and all unrelated app behavior unchanged.

## Validation
- Check TypeScript and the production build.
- Confirm the Android deep-link declaration still matches the redirect URI.
