package com.mindos.app

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetSync")
class WidgetSyncPlugin : Plugin() {
    @PluginMethod
    fun updateWidget(call: PluginCall) {
        val ctx = context
        if (ctx == null) {
            call.reject("Android context is not initialized")
            return
        }
        val intent = Intent(ctx, RPGStatsWidgetProvider::class.java)
        intent.action = RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET
        intent.setPackage(ctx.packageName) // Explicitly package-restrict intent for security
        ctx.sendBroadcast(intent)
        call.resolve()
    }
}
