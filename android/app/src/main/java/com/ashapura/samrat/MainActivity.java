package com.ashapura.samrat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        registerPlugin(AdPrivacyPlugin.class);
        registerPlugin(NativePermissionsPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
    }
}
