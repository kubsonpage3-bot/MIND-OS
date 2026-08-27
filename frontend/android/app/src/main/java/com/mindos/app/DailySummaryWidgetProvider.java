package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class DailySummaryWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_SUMMARY = "com.mindos.app.ACTION_UPDATE_SUMMARY";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_SUMMARY.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action) || DailiesWidgetProvider.ACTION_UPDATE_DAILIES.equals(action)) {
            refreshAllWidgets(context);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateSummaryWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void refreshAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, DailySummaryWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateSummaryWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateSummaryWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.daily_summary_widget);

        // Click to open Dailies in app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.putExtra("action", "open_dailies");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent rootPendingIntent = PendingIntent.getActivity(context, 200, openAppIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_summary_root, rootPendingIntent);

        try {
            android.content.SharedPreferences sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String profileJson = sharedPrefs.getString("mindos_profile", null);
            String dailiesJson = sharedPrefs.getString("mindos_dailies", null);

            int streak = 0;
            if (profileJson != null) {
                JSONObject profile = new JSONObject(profileJson);
                streak = profile.optInt("streak", 0);
            }

            int doneCount = 0;
            int totalCount = 0;
            if (dailiesJson != null) {
                JSONArray array = new JSONArray(dailiesJson);
                totalCount = array.length();
                for (int i = 0; i < array.length(); i++) {
                    JSONObject task = array.getJSONObject(i);
                    if (task.optBoolean("completed", false)) {
                        doneCount++;
                    }
                }
            }

            int leftCount = Math.max(0, totalCount - doneCount);
            int percent = totalCount > 0 ? Math.round((doneCount * 100f) / totalCount) : 0;

            views.setTextViewText(R.id.summary_streak_text, streak > 0 ? (streak + " Day Streak") : "No Streak");
            views.setTextViewText(R.id.summary_done_count, String.valueOf(doneCount));
            views.setTextViewText(R.id.summary_total_count, "/" + totalCount);
            views.setTextViewText(R.id.summary_percent_badge, percent + "%");
            views.setProgressBar(R.id.summary_progress_bar, Math.max(1, totalCount), doneCount, false);

            if (totalCount > 0 && doneCount == totalCount) {
                views.setTextViewText(R.id.summary_done_label, "✦ Daily Quests Cleared! ✦");
                views.setTextViewText(R.id.summary_left_text, "All Complete");
            } else {
                views.setTextViewText(R.id.summary_done_label, "Dailies Completed");
                views.setTextViewText(R.id.summary_left_text, leftCount + " left to do");
            }

            views.setTextViewText(R.id.summary_reset_text, " • Reset 00:00");

        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
