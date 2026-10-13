# Google Login, Play Billing and UPI verification

## Identity
- Existing Gradle applicationId, namespace, Java launcher package and Firebase Android client use `com.ashapura.samrat`. Keep this installed application ID unchanged; Capacitor appId and the Android package_name resource now match it.
- Existing custom URL schemes are preserved for callback compatibility.
- Existing Web OAuth client ID is unchanged and matches native initialization, Capacitor config, Android resources and google-services.json. That file contains a Web client, not proof of an Android OAuth client registration.
- Actual Play Console package cannot be inspected here. Confirm it matches `com.ashapura.samrat` before uploading. If it differs, reconcile against Play Console, not by creating a new client or changing the release app ID blindly.
- CI documents SHA-1 `D0:3E:73:A7:06:C5:C8:51:F6:E4:60:44:A5:FA:D6:E1:BB:A4:ED:78` as the **upload key**. This is not proof of the **Play App Signing key** used on Play-installed apps. Register the relevant package + signing certificate in the existing Google project for both installed release APK and Play App Signing builds.
- Trace `[28444]` on the real installed build with Logcat filters `GoogleProvider` / `CapgoSocialLogin`. Compare logged package, signingSha1 and Web client against existing Google configuration. Do not log identity tokens.

## Play subscriptions
### Account ownership security (source changes only; not deployed)
- Purchase launch now sets a SHA-256 obfuscated app-account identifier through native `setObfuscatedAccountId`; both client and verifier use the same shared derivation.
- Server reads `purchases.subscriptionsv2.get` and compares only Google's `externalAccountIdentifiers.obfuscatedExternalAccountId` with the authenticated app user before any entitlement write. Missing identifiers and another account are rejected with 403. Client-supplied owner claims are not accepted.
- Legacy purchases made before binding cannot safely prove app-account ownership; restore fails closed for those tokens. No token-claim fallback, account reassignment or database schema/RLS change was added.
- ACTIVE, IN_GRACE_PERIOD and CANCELED retain access only for the matching product until Google's expiry; PENDING, PENDING_PURCHASE_CANCELED, PAUSED, ON_HOLD and EXPIRED cannot grant access. Cancellation of auto-renewal is not immediate loss of paid access.
- Purchase/restore deduplication is account scoped, and account switches during purchase or verification cannot activate local Premium or proceed to acknowledgement.
- Old non-entitled tokens cannot erase a subscription with a later recorded expiry. No real Google response, native build or production purchase was verified in this audit.

Existing product / base-plan pairs are retained:

| Product | Monthly base plan | Yearly base plan |
| --- | --- | --- |
| basic_plan | basic-plan | basic-yearly |
| standard_plan | standard-monthly | standard-yearly |
| pro_plan | pro-monthly | pro-yearly |

- Native product lookup requires the requested base plan and chooses its base offer rather than an arbitrary promotional offer. Confirm these exact plans are active and available to the test account/region in Play Console.
- Purchase and both restore screens share server verification, then acknowledgement. Native acknowledgement re-queries the purchase and skips already acknowledged purchases. Only PURCHASED purchases are returned for restoration.
- After authenticated app launch, foreground return or a purchase update, the app queries existing subscriptions. Google Play retains purchases if a callback is lost or verification fails; the next query retries them. No payment-success assumption is made for PENDING purchases.
- Verification endpoint rejects subscription entitlement without a finite future Google expiry.
- Current secret-name inspection did **not** list `PLAY_PACKAGE_NAME` or `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: both MISSING. No secret values were read. Add the verified Play package name and provider-issued service-account JSON through Lovable Project Settings → Secrets; never put credentials in source or chat.
- MANUAL VERIFICATION REQUIRED: Google Cloud Android Publisher API enabled, correct service account, and Play Console Users and permissions granting the service account access to this app and subscription/order management. No accessible Google Cloud/Play Console connector was found; Search Console access is not Play Console access.
- No schema, RLS, auth-provider setting, worker limit, attendance, payroll or backup changes.

## Verification limitations
- Automated billing tests cover owner match/mismatch/missing binding, Google V2 states/product/expiry, account switches, PURCHASED/PENDING, acknowledgement ordering/skipping/retry and restore deduplication. These use fixtures/mocks, not live Google Play verification.
- Automatic preview validation passed. The full test suite passed before the additional cross-account concurrent-token regression (90 tests); final counts are reported in chat. No manual app build, Android compilation, live token verification or deployed-function check was performed.
- Preview build/type validation is managed by the preview harness.
- Android Gradle invocation cannot start here: Java/JAVA_HOME and Android SDK are absent. No compiled APK/AAB or signing certificate is available to validate locally.
- Real account picker, `[28444]` reproduction, active products/base plans, test purchase, pending-to-purchased recovery, reinstall recovery, Play signing certificate and UPI bank settlement require Android/Google Play testing.

## Android follow-up
Pull the updated project, install dependencies, build web assets, run `npx cap sync android`, then build/install the full native APK or use the existing release CI. Native Java changes do not reach an old installed APK through website updates.
- Release remains blocked until secrets and external permissions are configured, the source-only server changes are explicitly approved for deployment, a matching native build is installed, and real two-account purchase/restore/replay tests pass. No publish/deploy was performed.