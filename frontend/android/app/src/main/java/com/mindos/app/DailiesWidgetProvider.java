package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Paint;
import android.os.Build;
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

    // Category icons (emoji) mapped by category string
    private static String getCategoryIcon(String category) {
        if (category == null) return "◆";
        switch (category.toLowerCase()) {
            case "sciences":
            case "stem": return "🔬";
            case "humanities": return "📚";
            case "languages": return "🌐";
            case "body":
            case "health": return "💪";
            case "spirit":
            case "mindfulness": return "✨";
            case "work": return "💼";
            case "social": return "👥";
            default: return "◆";
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_DAILIES.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
                || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action)) {
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

                // Build sorted list: incomplete first, then completed
                List<JSONObject> tasks = new ArrayList<>();
                for (int i = 0; i < array.length(); i++) {
                    tasks.add(array.getJSONObject(i));
                    if (array.getJSONObject(i).optBoolean("completed", false)) doneCount++;
                }
                Collections.sort(tasks, new Comparator<JSONObject>() {
                    @Override
                    public int compare(JSONObject a, JSONObject b) {
                        boolean aComp = a.optBoolean("completed", false);
                        boolean bComp = b.optBoolean("completed", false);
                        // Incomplete (false) sorts before complete (true)
                        return Boolean.compare(aComp, bComp);
                    }
                });

                int displayIndex = 0;
                int maxDisplay = 4;

                for (int i = 0; i < tasks.size() && displayIndex < maxDisplay; i++) {
                    JSONObject task = tasks.get(i);
                    boolean completed = task.optBoolean("completed", false);
                    String title = task.optString("title", context.getString(R.string.widget_dailies_title));
                    String category = task.optString("category", "misc");
                    String categoryIcon = getCategoryIcon(category);

                    // Show slot
                    views.setViewVisibility(itemLayoutIds[displayIndex], View.VISIBLE);

                    // Category icon prefix + title
                    String displayTitle = categoryIcon + " " + title;
                    views.setTextViewText(textIds[displayIndex], displayTitle);

                    // Strikethrough for completed tasks
                    if (completed) {
                        views.setInt(textIds[displayIndex], "setPaintFlags",
                                Paint.STRIKE_THRU_TEXT_FLAG | Paint.ANTI_ALIAS_FLAG);
                        views.setTextColor(textIds[displayIndex], 0xFF6B7280); // dimmed gray
                    } else {
                        views.setInt(textIds[displayIndex], "setPaintFlags", Paint.ANTI_ALIAS_FLAG);
                        views.setTextColor(textIds[displayIndex], 0xFFE2E8F0); // normal white
                    }

                    // Checkbox icon
                    views.setImageViewResource(checkIds[displayIndex],
                            completed ? R.drawable.widget_checkbox_checked : R.drawable.widget_checkbox_bg);

                    views.setOnClickPendingIntent(itemLayoutIds[displayIndex], rootPendingIntent);
                    displayIndex++;
                }

                // "+N more" badge in count if more tasks exist beyond maxDisplay
                int remaining = tasks.size() - maxDisplay;
                String countBadge;
                if (doneCount == totalCount && totalCount > 0) {
                    countBadge = context.getString(R.string.widget_dailies_all_done);
                } else if (remaining > 0) {
                    countBadge = doneCount + "/" + totalCount + " • +" + remaining + " more";
                } else {
                    countBadge = doneCount + "/" + totalCount;
                }
                views.setTextViewText(R.id.dailies_count_badge, countBadge);
            } else {
                views.setTextViewText(R.id.dailies_count_badge, "0/0");
            }

            if (totalCount > 0) {
                views.setViewVisibility(R.id.dailies_empty_text, View.GONE);
            } else {
                views.setViewVisibility(R.id.dailies_empty_text, View.VISIBLE);
                views.setTextViewText(R.id.dailies_empty_text, context.getString(R.string.widget_dailies_empty));
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
