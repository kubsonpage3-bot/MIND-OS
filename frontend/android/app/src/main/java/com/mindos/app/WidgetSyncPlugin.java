package com.mindos.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
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

        // 1. Trigger RPG Stats Widget
        Intent statsIntent = new Intent(ctx, RPGStatsWidgetProvider.class);
        statsIntent.setAction(RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET);
        statsIntent.setPackage(ctx.getPackageName());
        ctx.sendBroadcast(statsIntent);

        // 2. Trigger Dailies Widget
        Intent dailiesIntent = new Intent(ctx, DailiesWidgetProvider.class);
        dailiesIntent.setAction(DailiesWidgetProvider.ACTION_UPDATE_DAILIES);
        dailiesIntent.setPackage(ctx.getPackageName());
        ctx.sendBroadcast(dailiesIntent);

        // 3. Trigger Daily Summary Widget
        Intent summaryIntent = new Intent(ctx, DailySummaryWidgetProvider.class);
        summaryIntent.setAction(DailySummaryWidgetProvider.ACTION_UPDATE_SUMMARY);
        summaryIntent.setPackage(ctx.getPackageName());
        ctx.sendBroadcast(summaryIntent);

        // 4. Trigger Quick Actions Widget
        Intent quickIntent = new Intent(ctx, QuickActionsWidgetProvider.class);
        quickIntent.setAction(QuickActionsWidgetProvider.ACTION_UPDATE_QUICK);
        quickIntent.setPackage(ctx.getPackageName());
        ctx.sendBroadcast(quickIntent);

        call.resolve();
    }

    @PluginMethod
    public void getInitialAction(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null && activity.getIntent() != null) {
            String action = activity.getIntent().getStringExtra("action");
            if (action != null && !action.isEmpty()) {
                activity.getIntent().removeExtra("action");
                JSObject ret = new JSObject();
                ret.put("action", action);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("action", (String) null);
        call.resolve(ret);
    }
}
