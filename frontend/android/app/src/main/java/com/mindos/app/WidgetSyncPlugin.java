package com.mindos.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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

        // 5. Trigger Calendar Widget (repaint from cache; background sync is
        // WorkManager's job, kicked separately by syncCalendarToken below)
        Intent calendarIntent = new Intent(ctx, CalendarWidgetProvider.class);
        calendarIntent.setAction(CalendarWidgetProvider.ACTION_UPDATE_CALENDAR);
        calendarIntent.setPackage(ctx.getPackageName());
        ctx.sendBroadcast(calendarIntent);

        call.resolve();
    }

    /**
     * Mirrors the calendar_feed_token (and resolved API base URL) from the
     * app's own storage into the SharedPreferences the native Calendar widget
     * reads. Native code cannot see the app's JWT -- it lives in the WebView's
     * localStorage -- so this token is the widget's only way to authenticate
     * its own background sync. Call this whenever the app loads or rotates
     * the token (see CalendarSyncPanel.jsx); an empty/missing token clears
     * the mirrored value so a stale widget stops fetching with a dead token.
     */
    @PluginMethod
    public void syncCalendarToken(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Android context is not initialized");
            return;
        }

        SharedPreferences prefs = ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            editor.remove("mindos_calendar_feed_token");
        } else {
            editor.putString("mindos_calendar_feed_token", token);
        }

        String apiBase = call.getString("apiBase");
        if (apiBase != null && !apiBase.isEmpty()) {
            editor.putString("mindos_api_base", apiBase);
        }
        editor.apply();

        if (token != null && !token.isEmpty()) {
            CalendarWidgetSyncWorker.enqueuePeriodic(ctx);
            CalendarWidgetSyncWorker.enqueueNow(ctx);
        }

        call.resolve();
    }

    /**
     * Mirrors widget_sync_token (and resolved API base URL) into the
     * SharedPreferences WidgetSyncWorker reads -- the same reasoning as
     * syncCalendarToken above, but for the RPG Stats / Dailies / Daily
     * Summary / Quick Actions widgets rather than Calendar. Unlike that one,
     * this isn't a Premium feature, so call it for every logged-in user, not
     * just from a settings panel the user has to visit.
     */
    @PluginMethod
    public void syncWidgetToken(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Android context is not initialized");
            return;
        }

        SharedPreferences prefs = ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        String token = call.getString("token");
        if (token == null || token.isEmpty()) {
            editor.remove("mindos_widget_sync_token");
        } else {
            editor.putString("mindos_widget_sync_token", token);
        }

        String apiBase = call.getString("apiBase");
        if (apiBase != null && !apiBase.isEmpty()) {
            editor.putString("mindos_api_base", apiBase);
        }
        editor.apply();

        if (token != null && !token.isEmpty()) {
            WidgetSyncWorker.enqueuePeriodic(ctx);
            WidgetSyncWorker.enqueueNow(ctx);
        }

        call.resolve();
    }

    @PluginMethod
    public void getInitialAction(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null && activity.getIntent() != null) {
            String action = activity.getIntent().getStringExtra("action");
            if (action != null && !action.isEmpty()) {
                String date = activity.getIntent().getStringExtra("date");
                activity.getIntent().removeExtra("action");
                activity.getIntent().removeExtra("date");
                JSObject ret = new JSObject();
                ret.put("action", action);
                ret.put("date", date);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("action", (String) null);
        call.resolve(ret);
    }
}
