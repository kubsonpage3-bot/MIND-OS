package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class DailiesWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_DAILIES = "com.mindos.app.ACTION_UPDATE_DAILIES";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_DAILIES.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, DailiesWidgetProvider.class);
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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.dailies_widget);

        // Click root to open Dailies in app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.putExtra("action", "open_dailies");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent rootPendingIntent = PendingIntent.getActivity(context, 100, openAppIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_dailies_root, rootPendingIntent);

        // Click '+' button to create daily
        Intent addDailyIntent = new Intent(context, MainActivity.class);
        addDailyIntent.putExtra("action", "create_daily");
        PendingIntent addDailyPendingIntent = PendingIntent.getActivity(context, 101, addDailyIntent, flags);
        views.setOnClickPendingIntent(R.id.dailies_btn_add, addDailyPendingIntent);

        try {
            android.content.SharedPreferences sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String dailiesJson = sharedPrefs.getString("mindos_dailies", null);

            int doneCount = 0;
            int totalCount = 0;

            int[] itemLayoutIds = { R.id.daily_item_1, R.id.daily_item_2, R.id.daily_item_3, R.id.daily_item_4 };
            int[] checkIds = { R.id.daily_check_1, R.id.daily_check_2, R.id.daily_check_3, R.id.daily_check_4 };
            int[] textIds = { R.id.daily_text_1, R.id.daily_text_2, R.id.daily_text_3, R.id.daily_text_4 };

            // Hide all slots by default
            for (int id : itemLayoutIds) {
                views.setViewVisibility(id, View.GONE);
            }

            if (dailiesJson != null) {
                JSONArray array = new JSONArray(dailiesJson);
                totalCount = array.length();
                int displayIndex = 0;

                for (int i = 0; i < array.length(); i++) {
                    JSONObject task = array.getJSONObject(i);
                    boolean completed = task.optBoolean("completed", false);
                    if (completed) doneCount++;

                    if (displayIndex < 4) {
                        String title = task.optString("title", "Daily Task");
                        views.setViewVisibility(itemLayoutIds[displayIndex], View.VISIBLE);
                        views.setTextViewText(textIds[displayIndex], title);
                        views.setImageViewResource(checkIds[displayIndex], completed ? R.drawable.widget_checkbox_checked : R.drawable.widget_checkbox_bg);
                        views.setOnClickPendingIntent(itemLayoutIds[displayIndex], rootPendingIntent);
                        displayIndex++;
                    }
                }
            }

            views.setTextViewText(R.id.dailies_count_badge, doneCount + "/" + totalCount);

            if (totalCount > 0) {
                views.setViewVisibility(R.id.dailies_empty_text, View.GONE);
            } else {
                views.setViewVisibility(R.id.dailies_empty_text, View.VISIBLE);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
