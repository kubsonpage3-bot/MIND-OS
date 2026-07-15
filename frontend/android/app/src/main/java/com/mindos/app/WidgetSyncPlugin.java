package com.mindos.app;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {
    @PluginMethod
    public void updateWidget(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Android context is not initialized");
            return;
        }
        Intent intent = new Intent(ctx, RPGStatsWidgetProvider.class);
        intent.setAction(RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET);
        intent.setPackage(ctx.getPackageName()); // Secure explicit package targeting
        ctx.sendBroadcast(intent);
        call.resolve();
    }
}
