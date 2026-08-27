package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.text.Html;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class DailiesWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_DAILIES = "com.mindos.app.ACTION_UPDATE_DAILIES";
    public static final String ACTION_TOGGLE_DAILY = "com.mindos.app.ACTION_TOGGLE_DAILY";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_TOGGLE_DAILY.equals(action)) {
            String taskId = intent.getStringExtra("task_id");
            if (taskId != null && !taskId.isEmpty()) {
                toggleDailyTask(context, taskId);
            }
            return;
        }

        if (ACTION_UPDATE_DAILIES.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action)) {
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
        ComponentName componentName = new ComponentName(context, DailiesWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void toggleDailyTask(Context context, String taskIdStr) {
        try {
            android.content.SharedPreferences sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String dailiesJson = sharedPrefs.getString("mindos_dailies", null);
            if (dailiesJson == null) return;

            JSONArray array = new JSONArray(dailiesJson);
            boolean newStatus = false;
            boolean found = false;

            for (int i = 0; i < array.length(); i++) {
                JSONObject task = array.getJSONObject(i);
                String id = String.valueOf(task.opt("id"));
                if (id.equals(taskIdStr)) {
                    boolean completed = task.optBoolean("completed", false);
                    newStatus = !completed;
                    task.put("completed", newStatus);
                    found = true;
                    break;
                }
            }

            if (found) {
                // 1. Save updated dailies
                sharedPrefs.edit().putString("mindos_dailies", array.toString()).apply();

                // 2. Enqueue action for web app synchronization
                String pendingJson = sharedPrefs.getString("mindos_pending_widget_actions", "[]");
                JSONArray pendingArray;
                try {
                    pendingArray = new JSONArray(pendingJson);
                } catch (Exception ex) {
                    pendingArray = new JSONArray();
                }

                JSONObject pendingAction = new JSONObject();
                pendingAction.put("action", "toggle_daily");
                pendingAction.put("taskId", taskIdStr);
                pendingAction.put("isCompleted", newStatus);
                pendingAction.put("timestamp", System.currentTimeMillis());
                pendingArray.put(pendingAction);

                sharedPrefs.edit().putString("mindos_pending_widget_actions", pendingArray.toString()).apply();

                // 3. Immediately redraw Dailies widgets (instant feedback)
                refreshAllWidgets(context);

                // 4. Also refresh Daily Summary and Quick Action widgets
                DailySummaryWidgetProvider.refreshAllWidgets(context);
                QuickActionsWidgetProvider.refreshAllWidgets(context);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.dailies_widget);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Click root or header to open Dailies in app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.putExtra("action", "open_dailies");
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
            int[] streakIds = { R.id.daily_streak_1, R.id.daily_streak_2, R.id.daily_streak_3, R.id.daily_streak_4 };

            // Hide all slots by default
            for (int id : itemLayoutIds) {
                views.setViewVisibility(id, View.GONE);
            }
            views.setViewVisibility(R.id.dailies_more_text, View.GONE);

            if (dailiesJson != null) {
                JSONArray array = new JSONArray(dailiesJson);
                totalCount = array.length();

                List<JSONObject> taskList = new ArrayList<>();
                for (int i = 0; i < array.length(); i++) {
                    JSONObject task = array.getJSONObject(i);
                    if (task.optBoolean("completed", false)) {
                        doneCount++;
                    }
                    taskList.add(task);
                }

                // Smart sort: active (uncompleted) first, completed last
                Collections.sort(taskList, new Comparator<JSONObject>() {
                    @Override
                    public int compare(JSONObject a, JSONObject b) {
                        boolean compA = a.optBoolean("completed", false);
                        boolean compB = b.optBoolean("completed", false);
                        if (compA != compB) {
                            return compA ? 1 : -1;
                        }
                        return 0;
                    }
                });

                int displayLimit = Math.min(4, taskList.size());
                for (int i = 0; i < displayLimit; i++) {
                    JSONObject task = taskList.get(i);
                    String taskId = String.valueOf(task.opt("id"));
                    String title = task.optString("title", "Daily Task");
                    boolean completed = task.optBoolean("completed", false);
                    int streak = task.optInt("streak", 0);

                    views.setViewVisibility(itemLayoutIds[i], View.VISIBLE);

                    // Formatted text with strikethrough if completed
                    String htmlText;
                    if (completed) {
                        htmlText = "<s><font color='#64748B'>" + title + "</font></s>";
                    } else {
                        htmlText = "<font color='#F1F5F9'><b>" + title + "</b></font>";
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        views.setTextViewText(textIds[i], Html.fromHtml(htmlText, Html.FROM_HTML_MODE_LEGACY));
                    } else {
                        views.setTextViewText(textIds[i], Html.fromHtml(htmlText));
                    }

                    // Checkbox icon
                    views.setImageViewResource(checkIds[i], completed ? R.drawable.widget_checkbox_checked : R.drawable.widget_checkbox_bg);

                    // Click checkbox to toggle
                    Intent checkIntent = new Intent(context, DailiesWidgetProvider.class);
                    checkIntent.setAction(ACTION_TOGGLE_DAILY);
                    checkIntent.putExtra("task_id", taskId);
                    checkIntent.setPackage(context.getPackageName());

                    int requestCode = 1000 + i + (appWidgetId * 10);
                    PendingIntent checkPendingIntent = PendingIntent.getBroadcast(context, requestCode, checkIntent, flags);
                    views.setOnClickPendingIntent(checkIds[i], checkPendingIntent);

                    // Click text/row to open in app
                    views.setOnClickPendingIntent(textIds[i], rootPendingIntent);

                    // Streak flame badge
                    if (streak > 0) {
                        views.setViewVisibility(streakIds[i], View.VISIBLE);
                        views.setTextViewText(streakIds[i], "🔥" + streak);
                    } else {
                        views.setViewVisibility(streakIds[i], View.GONE);
                    }
                }

                // Show overflow text if > 4 tasks
                if (totalCount > 4) {
                    int remaining = totalCount - 4;
                    views.setViewVisibility(R.id.dailies_more_text, View.VISIBLE);
                    views.setTextViewText(R.id.dailies_more_text, "+" + remaining + " more in app ➔");
                    views.setOnClickPendingIntent(R.id.dailies_more_text, rootPendingIntent);
                }
            }

            views.setTextViewText(R.id.dailies_count_badge, doneCount + "/" + totalCount);

            if (totalCount == 0) {
                views.setViewVisibility(R.id.dailies_empty_text, View.VISIBLE);
                views.setTextViewText(R.id.dailies_empty_text, "✦ No Dailies Scheduled ✦");
            } else if (doneCount == totalCount) {
                views.setViewVisibility(R.id.dailies_empty_text, View.VISIBLE);
                views.setTextViewText(R.id.dailies_empty_text, "✦ All Dailies Cleared! ✦");
            } else {
                views.setViewVisibility(R.id.dailies_empty_text, View.GONE);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
