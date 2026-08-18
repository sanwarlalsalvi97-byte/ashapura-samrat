#!/usr/bin/env bash
# Fails the build if AD_ID / AdServices permissions end up in the release manifest or APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORBIDDEN='com.google.android.gms.permission.AD_ID|android.permission.ACCESS_ADSERVICES_AD_ID|android.permission.ACCESS_ADSERVICES_ATTRIBUTION|android.permission.ACCESS_ADSERVICES_TOPICS'

fail=0
checked=0

echo "==> Scanning release manifests for advertising permissions"

while IFS= read -r manifest; do
  checked=$((checked + 1))
  if grep -Eq "$FORBIDDEN" "$manifest"; then
    echo "::error::Forbidden advertising permission found in $manifest"
    grep -E "$FORBIDDEN" "$manifest" | sed 's/^/    /'
    fail=1
  else
    echo "  OK: $manifest"
  fi
done < <(find "$ROOT/android/app/build/intermediates" -path '*release*' -name 'AndroidManifest.xml' 2>/dev/null || true)

# Also scan built APKs when aapt2 / apkanalyzer is available
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK" ]; then
  AAPT2="$(command -v aapt2 || find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -name aapt2 2>/dev/null | sort -r | head -1 || true)"
  if [ -n "${AAPT2:-}" ] && [ -x "${AAPT2:-}" ]; then
    checked=$((checked + 1))
    if "$AAPT2" dump permissions "$APK" | grep -Eq "$FORBIDDEN"; then
      echo "::error::Forbidden advertising permission found in app-release.apk"
      "$AAPT2" dump permissions "$APK" | grep -E "$FORBIDDEN" | sed 's/^/    /'
      fail=1
    else
      echo "  OK: app-release.apk"
    fi
  fi
fi

if [ "$checked" -eq 0 ]; then
  echo "::error::No release manifest found to scan — run this after the release build."
  exit 1
fi

if [ "$fail" -ne 0 ]; then
  echo "AD_ID / AdServices permissions must stay removed (tools:node=\"remove\" in AndroidManifest.xml)."
  exit 1
fi

echo "==> Clean: no AD_ID / AdServices permissions in the release build."
