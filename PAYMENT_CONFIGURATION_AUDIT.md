# Google Login, Play Billing and UPI verification

## Identity
- Existing Gradle applicationId, namespace, Java launcher package and Firebase Android client use `com.ashapura.samrat`. Keep this installed application ID unchanged; Capacitor appId and the Android package_name resource now match it.
- Existing custom URL schemes are preserved for callback compatibility.
- Existing Web OAuth client ID is unchanged and matches native initialization, Capacitor config, Android resources and google-services.json. That file contains a Web client, not proof of an Android OAuth client registration.
- Actual Play Console package cannot be inspected here. Confirm it matches `com.ashapura.samrat` before uploading. If it differs, reconcile against Play Console, not by creating a new client or changing the release app ID blindly.
- CI documents SHA-1 `D0:3E:73:A7:06:C5:C8:51:F6:E4:60:44:A5:FA:D6:E1:BB:A4:ED:78` as the **upload key**. This is not proof of the **Play App Signing key** used on Play-installed apps. Register the relevant package + signing certificate in the existing Google project for both installed release APK and Play App Signing builds.
- Trace `[28444]` on the real installed build with Logcat filters `GoogleProvider` / `CapgoSocialLogin`. Compare logged package, signingSha1 and Web client against existing Google configuration. Do not log identity tokens.

## Play subscriptions
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
- Secret-name inspection did **not** list `PLAY_PACKAGE_NAME` or `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. The verification function requires both. Their values/permissions cannot be validated here; provider credentials must be configured securely before end-to-end purchase verification can succeed.
- No schema, RLS, auth-provider setting, worker limit, attendance, payroll or backup changes.

## Verification limitations
- Targeted automated tests cover initialization ordering/retry, PURCHASED/PENDING, acknowledgement ordering/skipping, recovery and exact 25075-paise QR/payment parameters.
- Preview build/type validation is managed by the preview harness.
- Android Gradle invocation cannot start here: Java/JAVA_HOME and Android SDK are absent. No compiled APK/AAB or signing certificate is available to validate locally.
- Real account picker, `[28444]` reproduction, active products/base plans, test purchase, pending-to-purchased recovery, reinstall recovery, Play signing certificate and UPI bank settlement require Android/Google Play testing.

## Android follow-up
Pull the updated project, install dependencies, build web assets, run `npx cap sync android`, then build/install the full native APK or use the existing release CI. Native Java changes do not reach an old installed APK through website updates.