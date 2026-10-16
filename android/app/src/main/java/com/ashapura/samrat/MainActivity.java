package com.ashapura.samrat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// कैपगो सोशल लॉगिन के लिए आवश्यक इम्पोर्ट्स
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;
import android.content.Intent;
import android.util.Log;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // अन्य आवश्यक प्लगइन्स रजिस्टर करें
        registerPlugin(AdPrivacyPlugin.class);
        registerPlugin(NativePermissionsPlugin.class);
        registerPlugin(PlayBillingPlugin.class);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) {
                Log.i("Google Activity Result", "SocialLogin login handle is null");
                return;
            }
            Plugin plugin = pluginHandle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
                return;
            }
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
