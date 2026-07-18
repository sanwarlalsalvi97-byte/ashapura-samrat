# Ashapura Samrat — Android (Capacitor) Build Guide

This project ships as a Capacitor-wrapped Android app. The web app (PWA) remains
100% functional — the native shell only adds splash screen, status bar,
back-button, notifications, native share/save, and reliable UPI intents.

## 1. First-time local setup

Native platforms are **not** committed. Run these on your machine (macOS/Linux/Windows):

```bash
git pull
npm install
npm run build
npx cap add android          # only once, ever
npx cap sync android
```

For subsequent updates:

```bash
git pull
npm install
npm run build
npx cap sync android         # copies dist/ + plugin changes into android/
```

## 2. Live-reload against Lovable sandbox (dev only)

```bash
CAP_LIVE_RELOAD=1 npx cap sync android
npx cap run android
```

Without `CAP_LIVE_RELOAD=1`, Capacitor loads the built `dist/` — required for
Play Store release.

## 3. App identity

| Field       | Value                                             |
| ----------- | ------------------------------------------------- |
| App ID      | `app.lovable.346ff4aba1fe4e49a9bbd6312b10ff9f`    |
| Display     | Ashapura Samrat                                   |
| Theme color | `#0E7A3A`                                         |

Change `appId` / `appName` in `capacitor.config.ts` **before** running
`npx cap add android` if you want a different package name.

## 4. App icon & splash screen

After `npx cap add android`, generate icons/splash from a single source PNG
(1024×1024, transparent) using [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):

```bash
npm i -D @capacitor/assets
mkdir -p assets
# place assets/icon.png (1024x1024) and assets/splash.png (2732x2732)
npx capacitor-assets generate --android
```

The splash background color is already wired to `#0E7A3A` in
`capacitor.config.ts`.

## 5. Permissions

Only add what you use. Open `android/app/src/main/AndroidManifest.xml` and
ensure these are present inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

For UPI intent resolution on Android 11+ (**required** — without this
`@capacitor/app-launcher` cannot see installed UPI apps) add inside
`<manifest>`, as a sibling of `<application>`:

```xml
<queries>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <data android:scheme="upi" />
  </intent>

  <!-- Explicit packages so canOpenUrl/openUrl resolves even when the
       intent filter above is not enough on some OEMs. -->
  <package android:name="com.google.android.apps.nbu.paisa.user" /> <!-- Google Pay -->
  <package android:name="com.phonepe.app" />                        <!-- PhonePe -->
  <package android:name="net.one97.paytm" />                        <!-- Paytm -->
  <package android:name="in.org.npci.upiapp" />                     <!-- BHIM -->
</queries>
```

## 6. Signed release AAB for Google Play

### 6.1 Create a keystore (once, keep it safe forever)

```bash
keytool -genkey -v -keystore ashapura-release.keystore \
  -alias ashapura -keyalg RSA -keysize 2048 -validity 10000
```

Store `ashapura-release.keystore` and the passwords in a password manager.
Losing this key means you can never update the app on Play.

### 6.2 Wire signing into Gradle

Create `android/keystore.properties` (git-ignored):

```
storeFile=../../ashapura-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=ashapura
keyPassword=YOUR_KEY_PASSWORD
```

Edit `android/app/build.gradle`, add above `android { … }`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android { … }`:

```gradle
signingConfigs {
    release {
        if (keystoreProperties['storeFile']) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 6.3 Bump versions before every release

In `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "app.lovable.346ff4aba1fe4e49a9bbd6312b10ff9f"
    minSdkVersion 23
    targetSdkVersion 35
    versionCode 1        // increment for every Play upload
    versionName "1.0.0"
}
```

### 6.4 Build the AAB

```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` — upload
this file to Play Console → Release → Production → Create new release.

## 7. Play Console checklist

- Privacy policy URL (required)
- Data safety form: Supabase auth (email), attendance/cashbook stored server-side
- Target audience: 18+
- Content rating questionnaire
- Screenshots (phone + 7" tablet minimum)
- Feature graphic 1024×500
- Signed AAB uploaded

## 8. Preserved PWA

The public site continues to serve the PWA manifest, service-worker-free
installable experience, and offline-capable local queues. The Capacitor
Android app reuses the same React build (`dist/`) — no behavioural drift.
