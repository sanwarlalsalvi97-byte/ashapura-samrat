# Roadmap

- [ ] Remove whole-rupee rounding from the two audited UPI entry paths, match displayed balances, and run exact-paise regression tests.

- [x] Correct Google initialization and reconcile configuration with the existing Android application ID.
- [x] Unify verified Play Billing purchase processing, acknowledgement, manual restore and launch/resume recovery.
- [x] Use one exact paise-based amount for UPI QR and payment intents.
- [x] Validate targeted tests, preview and Android configuration; report device/Play Console verification blockers.
- [ ] Confirm actual Play Console package, app-signing SHA-1 and active product/base plans — blocked by unavailable Play Console/Google configuration access.
- [ ] Configure and verify required Play purchase-verification credentials — required secret names were not present in the accessible list.
- [ ] Compile/sync and test latest APK on Android/Play — blocked by absent Java, Android SDK and connected device.

- [x] Replace native browser Google OAuth with the Android account picker and ID-token sign-in.
- [x] Request camera and location permissions when attendance, face scan, and GPS features are opened.
- [x] Confirm Android camera and fine/coarse location declarations.
- [x] Set Android versionCode 9 and versionName 1.0.8.
- [x] Build and sync Android assets/plugins.
- [x] Replace the native Google Sign-In placeholder with the configured web client ID.
- [x] Add clear Hindi email-confirmation guidance and a throttled resend action.
- [x] Add OTP resend with a 30-second cooldown and clear status messages.
- [x] Add database-backed Material Entry / Stock Management with summaries and filters.
- [x] Add Material Entry access from Dashboard navigation.
- [x] Verify Material Entry save, readback, filters, and responsive layout.
- [x] Standardize editable fields on the full multilingual text keyboard while preserving secure and picker controls.
