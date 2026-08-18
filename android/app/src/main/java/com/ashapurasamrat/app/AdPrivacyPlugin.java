package com.ashapurasamrat.app;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Runtime smoke test for the Advertising ID / AdServices policy.
 *
 * Reads the MERGED manifest of the installed build (not the source file) so a
 * release APK/AAB can be verified on-device: declared permissions plus the
 * Firebase Analytics ad-reporting meta-data flags.
 */
@CapacitorPlugin(name = "AdPrivacy")
public class AdPrivacyPlugin extends Plugin {

    private static final String[] FORBIDDEN = new String[] {
        "com.google.android.gms.permission.AD_ID",
        "android.permission.ACCESS_ADSERVICES_AD_ID",
        "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
        "android.permission.ACCESS_ADSERVICES_TOPICS",
        "android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE"
    };

    private static final String[] META_FLAGS = new String[] {
        "google_analytics_adid_collection_enabled",
        "google_analytics_ssaid_collection_enabled",
        "google_analytics_default_allow_ad_personalization_signals",
        "google_analytics_default_allow_ad_storage",
        "google_analytics_default_allow_ad_user_data"
    };

    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        JSArray declared = new JSArray();
        JSArray violations = new JSArray();
        JSObject meta = new JSObject();
        boolean ok = true;

        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();

            PackageInfo pi = pm.getPackageInfo(pkg, PackageManager.GET_PERMISSIONS);
            if (pi.requestedPermissions != null) {
                for (String perm : pi.requestedPermissions) {
                    declared.put(perm);
                    for (String bad : FORBIDDEN) {
                        if (bad.equals(perm)) {
                            violations.put(perm);
                            ok = false;
                        }
                    }
                }
            }

            ApplicationInfo ai = pm.getApplicationInfo(pkg, PackageManager.GET_META_DATA);
            Bundle b = ai.metaData;
            for (String key : META_FLAGS) {
                boolean value = b != null && b.getBoolean(key, true);
                meta.put(key, value);
                if (value) ok = false; // every ad-related flag must be false
            }

            result.put("versionName", pi.versionName);
            result.put("versionCode", pi.versionCode);
            result.put("packageName", pkg);
        } catch (Exception e) {
            call.reject("AdPrivacy check failed: " + e.getMessage());
            return;
        }

        result.put("ok", ok);
        result.put("violations", violations);
        result.put("declaredPermissions", declared);
        result.put("analyticsFlags", meta);
        call.resolve(result);
    }
}
