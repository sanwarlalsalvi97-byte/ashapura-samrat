# Project Architecture Rules

- Store new account-owned operational records in Lovable Cloud with per-user row access rules, so data persists across devices and reinstalls.
- Route editable text fields through the shared Input component, which normalizes non-special fields to the full multilingual text keyboard while preserving secure and picker controls.
- Run Android subscriptions through the app's native PlayBilling Capacitor bridge and verify every purchase token server-side before enabling premium access.