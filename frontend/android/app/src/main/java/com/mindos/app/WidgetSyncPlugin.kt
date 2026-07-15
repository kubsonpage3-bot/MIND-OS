package com.mindos.app

import android.content.Context
import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetSync")
class WidgetSyncPlugin : Plugin() {
    @PluginMethod
    fun updateWidget(call: PluginCall) {
        val context = context
        val intent = Intent(context, RPGStatsWidgetProvider::class.java)
        intent.action = RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET
        context.sendBroadcast(intent)
        call.resolve()
    }
}
