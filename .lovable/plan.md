# Fix Android SDK setup in release CI

## Changes
- Update only the Android SDK setup step in the release workflow.
- Install supported packages explicitly: `platform-tools`, `platforms;android-36`, and `build-tools;36.0.0`, matching the project’s `compileSdkVersion = 36`.
- Do not request the deprecated `tools` package.
- Leave Node, Java 21, Capacitor sync, signing, Gradle flags, and artifact uploads unchanged.

## Verification
- Validate the workflow YAML and confirm the SDK package versions match the Android Gradle configuration.
