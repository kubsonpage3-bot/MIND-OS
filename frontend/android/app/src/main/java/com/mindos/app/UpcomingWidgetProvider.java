package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * "Upcoming" widget: the next dated events and Todo deadlines over the
 * coming few days, flattened into one chronological list. Reuses the exact
 * same mindos_calendar_widget_&lt;month&gt; cache CalendarWidgetSyncWorker
 * already fetches for the Calendar widget; no new backend endpoint, no new
 * sync token, no new WorkManager job -- see CalendarWidgetSyncWorker's own
 * doc comment for why sharing that worker across both widgets needs the
 * anyCalendarWidgetPlaced() check on both providers' onDisabled.
 *
 * A fixed list of WINDOW_DAYS_AHEAD, not a true scrollable list: real
 * scrolling in a RemoteViews widget only comes from a ListView/GridView
 * backed by a RemoteViewsService adapter, and that exact mechanism just
 * broke the Calendar widget's month grid on a real device in a way no
 * build check here could catch. Shipping a second, brand-new adapter-based
 * widget in the same breath as fixing the first one was too much
 * unverified risk to take on at once.
 */
public class UpcomingWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_UPCOMING = "com.mindos.app.ACTION_UPDATE_UPCOMING";

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final int WINDOW_DAYS_AHEAD = 3; // today + next 2 days
    private static final int MAX_ITEMS = 6;

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_UPCOMING.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            refreshAllWidgets(context);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        CalendarWidgetSyncWorker.enqueuePeriodic(context);
        CalendarWidgetSyncWorker.enqueueNow(context);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onEnabled(Context context) {
        CalendarWidgetSyncWorker.enqueuePeriodic(context);
    }

    @Override
    public void onDisabled(Context context) {
        if (!CalendarWidgetSyncWorker.anyCalendarWidgetPlaced(context)) {
            CalendarWidgetSyncWorker.cancelPeriodic(context);
        }
    }

    public static void refreshAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, UpcomingWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.upcoming_widget);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.putExtra("action", "open_calendar");
            PendingIntent openPendingIntent = PendingIntent.getActivity(context, 900 + appWidgetId, openIntent, flags);
            views.setOnClickPendingIntent(R.id.upcoming_root, openPendingIntent);

            List<String[]> rows = buildUpcomingRows(context); // {unused, when, text, colorHex}

            int[] itemIds = {R.id.upcoming_item_1, R.id.upcoming_item_2, R.id.upcoming_item_3,
                    R.id.upcoming_item_4, R.id.upcoming_item_5, R.id.upcoming_item_6};
            int[] whenIds = {R.id.upcoming_when_1, R.id.upcoming_when_2, R.id.upcoming_when_3,
                    R.id.upcoming_when_4, R.id.upcoming_when_5, R.id.upcoming_when_6};
            int[] textIds = {R.id.upcoming_text_1, R.id.upcoming_text_2, R.id.upcoming_text_3,
                    R.id.upcoming_text_4, R.id.upcoming_text_5, R.id.upcoming_text_6};
            int[] dotIds = {R.id.upcoming_dot_1, R.id.upcoming_dot_2, R.id.upcoming_dot_3,
                    R.id.upcoming_dot_4, R.id.upcoming_dot_5, R.id.upcoming_dot_6};

            for (int id : itemIds) views.setViewVisibility(id, View.GONE);

            int shown = Math.min(rows.size(), itemIds.length);
            for (int i = 0; i < shown; i++) {
                String[] row = rows.get(i);
                views.setViewVisibility(itemIds[i], View.VISIBLE);
                views.setTextViewText(whenIds[i], row[1]);
                views.setTextViewText(textIds[i], row[2]);
                try {
                    views.setInt(dotIds[i], "setBackgroundColor", Color.parseColor(row[3]));
                } catch (Exception ignored) {
                }
            }

            views.setViewVisibility(R.id.upcoming_empty_text, rows.isEmpty() ? View.VISIBLE : View.GONE);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /** Deadlines sort before timed events on the same day (matches the
     * Calendar widget's agenda view); a plain day-offset*10000 + minutes
     * key keeps every day's entries in their own numeric band, so days
     * never interleave regardless of how many items a day has. */
    private static List<String[]> buildUpcomingRows(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Map<String, JSONObject> monthCache = new HashMap<>();
        List<Object[]> entries = new ArrayList<>(); // {sortKey(Long), when(String), text(String), color(String)}

        Calendar today = Calendar.getInstance();

        for (int d = 0; d < WINDOW_DAYS_AHEAD; d++) {
            Calendar day = (Calendar) today.clone();
            day.add(Calendar.DAY_OF_MONTH, d);
            int year = day.get(Calendar.YEAR);
            int month0 = day.get(Calendar.MONTH);
            int dayNum = day.get(Calendar.DAY_OF_MONTH);
            String monthKey = String.format(Locale.US, "%04d-%02d", year, month0 + 1);
            String dateStr = String.format(Locale.US, "%04d-%02d-%02d", year, month0 + 1, dayNum);

            JSONObject monthData;
            if (monthCache.containsKey(monthKey)) {
                monthData = monthCache.get(monthKey);
            } else {
                monthData = null;
                String raw = prefs.getString("mindos_calendar_widget_" + monthKey, null);
                if (raw != null) {
                    try {
                        monthData = new JSONObject(raw);
                    } catch (Exception ignored) {
                    }
                }
                monthCache.put(monthKey, monthData);
            }
            if (monthData == null) continue;
            JSONObject days = monthData.optJSONObject("days");
            if (days == null) continue;
            JSONObject dayInfo = days.optJSONObject(dateStr);
            if (dayInfo == null) continue;

            String whenLabel = whenLabelFor(context, d, day);

            JSONArray deadlines = dayInfo.optJSONArray("deadlines");
            if (deadlines != null) {
                for (int i = 0; i < deadlines.length(); i++) {
                    JSONObject dl = deadlines.optJSONObject(i);
                    if (dl == null || dl.optBoolean("done", false)) continue;
                    String text = context.getString(R.string.widget_calendar_due_prefix, dl.optString("title", ""));
                    entries.add(new Object[]{(long) d * 10000L, whenLabel, text, "#EF4444"});
                }
            }

            JSONArray events = dayInfo.optJSONArray("events");
            if (events != null) {
                for (int i = 0; i < events.length(); i++) {
                    JSONObject e = events.optJSONObject(i);
                    if (e == null) continue;
                    boolean allDay = e.optBoolean("all_day", false);
                    String startTime = e.optString("start_time", "");
                    String color = e.optString("color", "#3B82F6");
                    String title = e.optString("title", "");
                    long minuteKey = allDay ? 0 : minutesSinceMidnight(startTime);
                    long sortKey = (long) d * 10000L + 1 + minuteKey;
                    String label = allDay ? whenLabel : (whenLabel + " " + startTime);
                    entries.add(new Object[]{sortKey, label, title, color});
                }
            }
        }

        Collections.sort(entries, new Comparator<Object[]>() {
            @Override
            public int compare(Object[] a, Object[] b) {
                return Long.compare((Long) a[0], (Long) b[0]);
            }
        });

        List<String[]> rows = new ArrayList<>();
        for (Object[] e : entries) {
            rows.add(new String[]{"", (String) e[1], (String) e[2], (String) e[3]});
            if (rows.size() >= MAX_ITEMS) break;
        }
        return rows;
    }

    private static String whenLabelFor(Context context, int dayOffset, Calendar day) {
        if (dayOffset == 0) return context.getString(R.string.widget_upcoming_today);
        if (dayOffset == 1) return context.getString(R.string.widget_upcoming_tomorrow);
        String[] weekdayNames = context.getResources().getStringArray(R.array.widget_calendar_weekdays_short);
        int jsDow = day.get(Calendar.DAY_OF_WEEK); // Sunday=1..Saturday=7
        int mondayFirst = (jsDow + 5) % 7; // Monday=0..Sunday=6
        return weekdayNames[mondayFirst] + " " + day.get(Calendar.DAY_OF_MONTH);
    }

    private static long minutesSinceMidnight(String hhmm) {
        try {
            String[] parts = hhmm.split(":");
            return Integer.parseInt(parts[0]) * 60L + Integer.parseInt(parts[1]);
        } catch (Exception e) {
            return 0;
        }
    }
}
