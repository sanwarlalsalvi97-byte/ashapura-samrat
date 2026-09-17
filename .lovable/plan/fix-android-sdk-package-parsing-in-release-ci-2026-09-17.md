# Fix Android SDK package parsing in release CI

## Change
- Replace the multiline Android SDK package value with the requested comma-separated list.
- Keep Android 36 packages and every later Node, Capacitor, signing, Gradle, and artifact step unchanged.

## Verification
- Parse the workflow as YAML and confirm no deprecated `tools` package is requested.
