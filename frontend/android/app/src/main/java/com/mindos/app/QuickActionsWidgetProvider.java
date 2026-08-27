package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

public class QuickActionsWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.quick_actions_widget);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // 1. Create Habit Action
        Intent habitIntent = new Intent(context, MainActivity.class);
        habitIntent.putExtra("action", "create_habit");
        PendingIntent habitPendingIntent = PendingIntent.getActivity(context, 301, habitIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_habit, habitPendingIntent);

        // 2. Create Daily Action
        Intent dailyIntent = new Intent(context, MainActivity.class);
        dailyIntent.putExtra("action", "create_daily");
        PendingIntent dailyPendingIntent = PendingIntent.getActivity(context, 302, dailyIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_daily, dailyPendingIntent);

        // 3. Create To-Do Action
        Intent todoIntent = new Intent(context, MainActivity.class);
        todoIntent.putExtra("action", "create_todo");
        PendingIntent todoPendingIntent = PendingIntent.getActivity(context, 303, todoIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_todo, todoPendingIntent);

        // 4. Open Chest / Relics Action
        Intent chestIntent = new Intent(context, MainActivity.class);
        chestIntent.putExtra("action", "open_chest");
        PendingIntent chestPendingIntent = PendingIntent.getActivity(context, 304, chestIntent, flags);
        views.setOnClickPendingIntent(R.id.quick_btn_chest, chestPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
