# Ashapura Samrat — Release Build Guide (AAB + APK)

This project ships two release artifacts:

| File              | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `app-release.aab` | Upload to Google Play Console (production / internal testing) |
| `app-release.apk` | Side-load onto a device for QA / share via Drive / WhatsApp   |

**Lovable cannot produce these binaries** — building an Android release
requires the Android SDK, JDK 17, Gradle, and your private signing key,
which never leaves your machine or your GitHub Actions secrets. Pick one of
the three paths below.

---

## Path A — GitHub Actions (recommended, zero local setup)

The workflow at `.github/workflows/android-release.yml` builds a **signed AAB
and signed APK** on every version tag.

### One-time setup

1. **Create a keystore** (do this once, keep it forever):
   ```bash
   keytool -genkey -v -keystore ashapura-release.keystore \
     -alias ashapura -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Base64-encode it** for the GitHub secret:
   ```bash
   base64 -w0 ashapura-release.keystore > keystore.b64
   ```
3. In your GitHub repo → **Settings → Secrets and variables → Actions**, add:
   | Secret name                  | Value                          |
   | ---------------------------- | ------------------------------ |
   | `ANDROID_KEYSTORE_BASE64`    | contents of `keystore.b64`     |
   | `ANDROID_KEYSTORE_PASSWORD`  | store password from `keytool`  |
   | `ANDROID_KEY_ALIAS`          | `ashapura`                     |
   | `ANDROID_KEY_PASSWORD`       | key password from `keytool`    |

### Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow:

1. Builds the web bundle (`npm run build`)
2. Runs `npx cap add android` (if `android/` missing) + `npx cap sync`
3. Injects the release `signingConfig` into `android/app/build.gradle`
4. Ensures the UPI `<queries>` block is in `AndroidManifest.xml`
5. Runs `./gradlew bundleRelease assembleRelease`
6. Uploads `app-release.aab` and `app-release.apk` as workflow artifacts,
   and attaches them to the GitHub Release for the tag.

Download from the run's **Artifacts** section or the tag's Release page.

---

## Path B — Android Studio (GUI, one-time or occasional)

1. Locally, once:
   ```bash
   git pull
   npm install
   npm run build
   npx cap add android
   npx cap sync android
   ```
2. Open the `android/` folder in **Android Studio** (File → Open).
3. **Build → Generate Signed Bundle / APK**
   - Choose **Android App Bundle** for Play Store, or **APK** for side-load.
   - Point at `ashapura-release.keystore`, enter the passwords.
   - Build variant: `release`. Signature versions: check **V1 and V2**.
4. Output paths:
   - AAB → `android/app/build/outputs/bundle/release/app-release.aab`
   - APK → `android/app/build/outputs/apk/release/app-release.apk`

For repeat builds, follow §6 in `ANDROID_BUILD.md` (wire `keystore.properties`
+ `signingConfigs.release` into `android/app/build.gradle`, then just run
`./gradlew bundleRelease assembleRelease`).

---

## Path C — Command line (fastest for repeat releases)

Prereqs on your machine: JDK 17, Android SDK (build-tools 34+), Node 20+.

```bash
git pull
npm install
npm run build
npx cap sync android            # first run: npx cap add android

# One-time: create android/keystore.properties and patch app/build.gradle
# per §6 of ANDROID_BUILD.md.

cd android
./gradlew bundleRelease         # → app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease       # → app/build/outputs/apk/release/app-release.apk
```

Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`
**before every Play upload** — Play rejects duplicates.

---

## Release smoke test (10 minutes on a real device)

Install the APK on an Android phone (Play Store install, or `adb install
app-release.apk`) and confirm:

### Startup & shell
- [ ] Green splash shows for ~1.5 s, then hides
- [ ] Status bar is green with light icons
- [ ] Back button pops screens instead of exiting immediately
- [ ] App icon and name show as **Ashapura Samrat**

### Capacitor plugins (release build only — debug can hide bugs)
- [ ] Local Notifications: attendance reminder fires (Settings → toggle test)
- [ ] Share: "Share backup" opens the Android share sheet
- [ ] Filesystem: "Backup now" writes `.json` to Documents and offers Share
- [ ] Keyboard: doesn't cover the input on Attendance / Advance forms
- [ ] Offline: enable airplane mode → mark attendance → re-enable → syncs

### UPI device checklist (Pay Salary)
Run each row on the same phone. **Any browser page = fail.**

| # | Installed UPI apps                     | Tap "UPI ऐप खोलें" → expected                                                    |
| - | -------------------------------------- | --------------------------------------------------------------------------------- |
| 1 | Google Pay only                        | Google Pay opens directly on the pay screen with amount, name, note pre-filled    |
| 2 | PhonePe only                           | PhonePe opens directly on the pay screen with the same pre-fill                   |
| 3 | Paytm only                             | Paytm opens directly on the pay screen                                            |
| 4 | BHIM only                              | BHIM opens directly on the pay screen                                             |
| 5 | GPay + PhonePe + Paytm (2 or more)     | Android's UPI **app chooser** appears; picking any app opens its pay screen       |
| 6 | **None installed**                     | In-app amber warning "कोई UPI ऐप नहीं मिला" with QR + "UPI ID कॉपी" — no browser  |
| 7 | Invalid VPA (`abc` in worker profile)  | Dialog shows "इस व्यक्ति की UPI ID नहीं है" — pay button hidden                   |
| 8 | Amount empty or 0                      | Toast "राशि डालें" — no launch attempt                                            |

**If a browser page appears in rows 1-5:** the `<queries>` block is missing
from `AndroidManifest.xml`. Rebuild after confirming `com.phonepe.app` is
present in `android/app/src/main/AndroidManifest.xml` (the GitHub Actions
workflow injects it automatically).

**If row 6 shows a Play Store page instead of the amber fallback:** you're
running a debug build against the Lovable sandbox URL. Build the release
variant (`assembleRelease`) — the fallback branch only runs when
`AppLauncher.canOpenUrl` returns `false`.

### Finance sanity (5 min)
- [ ] Dashboard **Cashbook Balance** = manual income − (manual expense + worker expense)
- [ ] Dashboard **Outstanding Salary** matches Reports → Pending Payments total
- [ ] Marking attendance updates the ledger in Reports immediately
- [ ] Pay Salary → entry appears in `payment_history`, **not** in Cashbook

---

## Play Console upload checklist

- [ ] `versionCode` incremented, `versionName` updated
- [ ] `app-release.aab` uploaded to Production or Internal Testing
- [ ] Privacy policy URL set (required for apps handling personal data)
- [ ] Data safety form filled (Supabase auth email, attendance records)
- [ ] Feature graphic 1024×500, phone + 7" tablet screenshots
- [ ] Content rating questionnaire completed
- [ ] Target audience: 18+ (financial data)

Once uploaded, Play performs its own signing (Play App Signing) — your
upload key stays the source of truth for future releases. Don't lose
`ashapura-release.keystore`.
