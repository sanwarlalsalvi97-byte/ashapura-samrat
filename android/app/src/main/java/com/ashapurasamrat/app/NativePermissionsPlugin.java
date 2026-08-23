package com.ashapurasamrat.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * Generic runtime-permission bridge so the web layer can request the
 * dangerous permissions declared in AndroidManifest.xml (camera, mic,
 * location, media/storage, contacts/accounts, notifications) and have them
 * show up under Android App Settings → Permissions.
 */
@CapacitorPlugin(
    name = "NativePermissions",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        ),
        @Permission(
            alias = "contacts",
            strings = {
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.WRITE_CONTACTS,
                Manifest.permission.GET_ACCOUNTS
            }
        )
    }
)
public class NativePermissionsPlugin extends Plugin {

    private String[] permissionsForGroup(String group) {
        switch (group) {
            case "camera":
                return new String[] { Manifest.permission.CAMERA };
            case "microphone":
                return new String[] { Manifest.permission.RECORD_AUDIO };
            case "location":
                return new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                };
            case "contacts":
                return new String[] {
                    Manifest.permission.READ_CONTACTS,
                    Manifest.permission.WRITE_CONTACTS,
                    Manifest.permission.GET_ACCOUNTS
                };
            case "notifications":
                if (Build.VERSION.SDK_INT >= 33) {
                    return new String[] { Manifest.permission.POST_NOTIFICATIONS };
                }
                return new String[] {};
            case "photos":
            case "storage":
                if (Build.VERSION.SDK_INT >= 33) {
                    return new String[] { Manifest.permission.READ_MEDIA_IMAGES };
                }
                if (Build.VERSION.SDK_INT >= 29) {
                    return new String[] { Manifest.permission.READ_EXTERNAL_STORAGE };
                }
                return new String[] {
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                };
            default:
                return null;
        }
    }

    private boolean allGranted(String[] perms) {
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(getContext(), p) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    @PluginMethod
    public void check(PluginCall call) {
        String group = call.getString("group", "");
        String[] perms = permissionsForGroup(group);
        if (perms == null) {
            call.reject("Unknown permission group: " + group);
            return;
        }
        JSObject ret = new JSObject();
        ret.put("group", group);
        ret.put("granted", allGranted(perms));
        call.resolve(ret);
    }

    @PluginMethod
    public void request(PluginCall call) {
        String group = call.getString("group", "");
        String[] perms = permissionsForGroup(group);
        if (perms == null) {
            call.reject("Unknown permission group: " + group);
            return;
        }
        if (perms.length == 0 || allGranted(perms)) {
            JSObject ret = new JSObject();
            ret.put("group", group);
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        List<String> missing = new ArrayList<>();
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(getContext(), p) != PackageManager.PERMISSION_GRANTED) {
                missing.add(p);
            }
        }
        bridge.saveCall(call);
        pluginRequestPermissions(missing.toArray(new String[0]), 9731);
    }

    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);
        PluginCall call = getSavedCall();
        if (call == null) return;
        boolean granted = grantResults.length > 0;
        for (int r : grantResults) {
            if (r != PackageManager.PERMISSION_GRANTED) granted = false;
        }
        JSObject ret = new JSObject();
        ret.put("group", call.getString("group", ""));
        ret.put("granted", granted);
        call.resolve(ret);
        bridge.releaseCall(call);
    }

    /** Open the OS App Info → Permissions screen for this app. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** Snapshot of every group — useful for a settings/diagnostics screen. */
    @PluginMethod
    public void checkAll(PluginCall call) {
        String[] groups = { "camera", "microphone", "location", "photos", "storage", "contacts", "notifications" };
        JSObject ret = new JSObject();
        JSArray denied = new JSArray();
        for (String g : groups) {
            String[] perms = permissionsForGroup(g);
            boolean ok = perms.length == 0 || allGranted(perms);
            ret.put(g, ok);
            if (!ok) denied.put(g);
        }
        ret.put("denied", denied);
        call.resolve(ret);
    }
}
