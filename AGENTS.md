# Project Architecture Rules

- Store new account-owned operational records in Lovable Cloud with per-user row access rules, so data persists across devices and reinstalls.
- Route editable text fields through the shared Input component, which normalizes non-special fields to the full multilingual text keyboard while preserving secure and picker controls.
- Run Android subscriptions through the app's native PlayBilling Capacitor bridge and verify every purchase token server-side before enabling premium access.
- Share purchase verification and acknowledgement through subscription-billing for purchase buttons, both restore screens and authenticated launch/resume recovery, so retries use one entitlement path.
- Parse UPI dialog amounts into integer paise and pass one parameter object to QR and payment launch, so both preserve exact decimal currency.
- Await the shared retryable native Google initialization promise before opening the account picker, so startup and sign-in cannot race.
- Keep Google Play subscription expiry validation in a shared pure server helper tested alongside billing recovery, so missing expiry cannot grant lifetime subscription access.