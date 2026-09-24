package com.ashapurasamrat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth; // 1. GoogleAuth Import जोड़ा गया

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 2. सभी Plugins रजिस्टर किए गए
        registerPlugin(AdPrivacyPlugin.class);
        registerPlugin(NativePermissionsPlugin.class);
        registerPlugin(GoogleAuth.class); // GoogleAuth Plugin यहाँ जोड़ा गया
    }
}
