package com.ashapura.samrat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.btrautmann.capacitor.sociallogin.SocialLoginPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // प्लगइन्स को super.onCreate से पहले रजिस्टर करना अनिवार्य है
        registerPlugin(AdPrivacyPlugin.class);
        registerPlugin(NativePermissionsPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(SocialLoginPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
