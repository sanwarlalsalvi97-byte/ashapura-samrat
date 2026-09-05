# Release obfuscation / shrinking rules (R8).
# Keep everything the Capacitor bridge, plugins and Firebase reach reflectively.

# Preserve line numbers for readable crash reports, hide source file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, Exceptions

# --- Capacitor core & plugins (loaded by reflection from plugin annotations) ---
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# App's own Capacitor plugins
-keep class com.ashapurasamrat.app.** { *; }

# Cordova plugins bridged through Capacitor
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin

# --- WebView JavaScript interfaces ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Firebase / Crashlytics ---
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# --- Google Play Billing ---
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# --- AndroidX / Kotlin housekeeping ---
-dontwarn kotlin.**
-dontwarn kotlinx.**
-dontwarn javax.annotation.**

# JSON model classes serialized through Gson/org.json reflection
-keepclassmembers class * {
    public <init>(org.json.JSONObject);
}
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
