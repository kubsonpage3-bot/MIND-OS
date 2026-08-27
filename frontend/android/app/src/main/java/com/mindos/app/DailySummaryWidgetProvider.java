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
        if (ACTION_UPDATE_SUMMARY.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
                || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, DailySummaryWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
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

            // FIX: Use string resources instead of hardcoded English strings
            views.setTextViewText(R.id.summary_streak_text,
                    String.format(context.getString(R.string.widget_summary_streak), streak));
            views.setTextViewText(R.id.summary_done_count, String.valueOf(doneCount));
            views.setTextViewText(R.id.summary_done_label,
                    context.getString(R.string.widget_summary_done_label));
            views.setProgressBar(R.id.summary_progress_bar, Math.max(1, totalCount), doneCount, false);

            if (leftCount == 0 && totalCount > 0) {
                views.setTextViewText(R.id.summary_left_text,
                        context.getString(R.string.widget_summary_all_clear));
            } else {
                views.setTextViewText(R.id.summary_left_text,
                        String.format(context.getString(R.string.widget_summary_left), leftCount));
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
