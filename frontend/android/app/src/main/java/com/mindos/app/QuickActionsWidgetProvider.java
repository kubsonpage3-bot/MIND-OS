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

public class QuickActionsWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_QUICK = "com.mindos.app.ACTION_UPDATE_QUICK";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_QUICK.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action) || DailiesWidgetProvider.ACTION_UPDATE_DAILIES.equals(action)) {
            refreshAllWidgets(context);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void refreshAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, QuickActionsWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.quick_actions_widget);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // 1. Create Habit Action
        Intent habitIntent = new Intent(context, MainActivity.class);
        habitIntent.setAction("com.mindos.app.ACTION_CREATE_HABIT");
        habitIntent.setData(android.net.Uri.parse("mindos://quick/habit/" + appWidgetId));
        habitIntent.putExtra("action", "create_habit");
        PendingIntent habitPendingIntent = PendingIntent.getActivity(context, 301, habitIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_habit, habitPendingIntent);

        // 2. Create Daily Action
        Intent dailyIntent = new Intent(context, MainActivity.class);
        dailyIntent.setAction("com.mindos.app.ACTION_CREATE_DAILY");
        dailyIntent.setData(android.net.Uri.parse("mindos://quick/daily/" + appWidgetId));
        dailyIntent.putExtra("action", "create_daily");
        PendingIntent dailyPendingIntent = PendingIntent.getActivity(context, 302, dailyIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_daily, dailyPendingIntent);

        // 3. Create To-Do Action
        Intent todoIntent = new Intent(context, MainActivity.class);
        todoIntent.setAction("com.mindos.app.ACTION_CREATE_TODO");
        todoIntent.setData(android.net.Uri.parse("mindos://quick/todo/" + appWidgetId));
        todoIntent.putExtra("action", "create_todo");
        PendingIntent todoPendingIntent = PendingIntent.getActivity(context, 303, todoIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_todo, todoPendingIntent);

        // 4. Open Chest / Relics Action
        Intent chestIntent = new Intent(context, MainActivity.class);
        chestIntent.setAction("com.mindos.app.ACTION_OPEN_CHEST");
        chestIntent.setData(android.net.Uri.parse("mindos://quick/chest/" + appWidgetId));
        chestIntent.putExtra("action", "open_chest");
        PendingIntent chestPendingIntent = PendingIntent.getActivity(context, 304, chestIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_chest, chestPendingIntent);

        // Badge: Display remaining pending dailies
        try {
            android.content.SharedPreferences sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String dailiesJson = sharedPrefs.getString("mindos_dailies", null);
            int pendingCount = 0;
            if (dailiesJson != null) {
                JSONArray array = new JSONArray(dailiesJson);
                for (int i = 0; i < array.length(); i++) {
                    JSONObject task = array.getJSONObject(i);
                    if (!task.optBoolean("completed", false)) {
                        pendingCount++;
                    }
                }
            }

            if (pendingCount > 0) {
                views.setViewVisibility(R.id.quick_daily_badge, View.VISIBLE);
                views.setTextViewText(R.id.quick_daily_badge, String.valueOf(pendingCount));
            } else {
                views.setViewVisibility(R.id.quick_daily_badge, View.GONE);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
