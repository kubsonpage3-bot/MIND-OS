package com.mindos.app

import android.os.Bundle
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(WidgetSyncPlugin::class.java)
        WindowCompat.setDecorFitsSystemWindows(window, false)
    }
}
