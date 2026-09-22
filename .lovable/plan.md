# Fix native OAuth return into Android app

## Changes
- Register the Capacitor deep-link listener before other native startup work can delay it.
- Handle both resumed-app links and cold-launch links from `App.getLaunchUrl()`.
- Accept only the `ashapurasamrat://google-auth` callback for native Google sign-in, close the Custom Tab, restore the session from tokens or exchange the authorization code, then open `/app`.
- Keep website sign-in, recovery links, and HTTPS email-confirmation links working as they do now.
- Keep the existing Android URL declaration and application identity unchanged.

## Validation
- Confirm the callback handler covers token and authorization-code responses without processing one link twice.
- Check TypeScript, tests, production build, and the Android deep-link declaration.

## Technical details
- Access and refresh tokens use `auth.setSession`; PKCE authorization codes use `auth.exchangeCodeForSession` because a code is not itself a session token.
