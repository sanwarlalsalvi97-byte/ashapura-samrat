# Project Architecture Rules

- Store new account-owned operational records in Lovable Cloud with per-user row access rules, so data persists across devices and reinstalls.
- Route editable text fields through the shared Input component, which normalizes non-special fields to the full multilingual text keyboard while preserving secure and picker controls.
- Keep Android input capture disabled so WebView's native InputConnection handles multilingual IME composition and voice text commits.
- Run Android subscriptions through the app's native PlayBilling Capacitor bridge and verify every purchase token server-side before enabling premium access.
- Share purchase verification and acknowledgement through subscription-billing for purchase buttons, both restore screens and authenticated launch/resume recovery, so retries use one entitlement path.
- Preserve fractional balances at UPI entry points, parse dialog amounts with the shared currency helper into integer paise, and pass the same parameters to QR and launch so displayed dues and payment amounts agree.
- Await the shared retryable native Google initialization promise before opening the account picker, so startup and sign-in cannot race.
- Validate Google Play V2 product/state/expiry and require Google-returned obfuscated account ownership before every entitlement write; fail closed for unbound legacy tokens so tokens cannot be reassigned between app accounts without a database workaround.
- Derive the Play obfuscated account identifier with the shared SHA-256 helper from the authenticated user, and scope billing work to that account so purchase/restore retries cannot reuse another account's verification result.