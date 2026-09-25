package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
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
 * "Upcoming" widget: a real scrollable agenda of the next WINDOW_DAYS_AHEAD
 * days' events and Todo deadlines, grouped by day, backed by
 * UpcomingWidgetService/RemoteViewsFactory. Reuses the exact same
 * mindos_calendar_widget_&lt;month&gt; cache CalendarWidgetSyncWorker already
 * fetches for the Calendar widget; no new backend endpoint, no new sync
 * token, no new WorkManager job -- see CalendarWidgetSyncWorker's own doc
 * comment for why sharing that worker across both widgets needs the
 * anyCalendarWidgetPlaced() check on both providers' onDisabled.
 *
 * A prior fixed, non-adapter version of this widget shipped after the
 * Calendar month grid's own RemoteViewsService attempt broke on a real
 * device -- but that failure traced to a bare &lt;View&gt; in the per-cell
 * layout getting rejected by RemoteViews' class allowlist, not to the
 * adapter mechanism itself. This list's row layouts use only
 * ImageView/TextView/LinearLayout, so the same failure class doesn't apply,
 * and a real ListView adapter is what actually gives Android widgets
 * scrolling (RemoteViews has no other way to scroll content).
 */
public class UpcomingWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_UPCOMING = "com.mindos.app.ACTION_UPDATE_UPCOMING";

    private static final String PREFS_NAME = "CapacitorStorage";
    static final int WINDOW_DAYS_AHEAD = 7;

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_UPCOMING.equals(action)
                || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
                || RPGStatsWidgetProvider.ACTION_UPDATE_WIDGET.equals(action)) {
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

    /** Repaints the static chrome (title/empty-state) on every instance, then tells
     * each list adapter its underlying data may have changed -- updateAppWidget()
     * alone does NOT re-run the RemoteViewsFactory; only notifyAppWidgetViewDataChanged
     * does, which is why a plain refresh after sync needs both calls. */
    public static void refreshAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, UpcomingWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.upcoming_list);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.upcoming_widget);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

            // Adapter data source: one instance per appWidgetId via the intent extra
            // (RemoteViewsService keys its factories off the whole intent, and a
            // shared intent across instances would make them share one factory).
            Intent serviceIntent = new Intent(context, UpcomingWidgetService.class);
            serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            serviceIntent.setData(Uri.parse("mindos://upcoming/adapter/" + appWidgetId));
            views.setRemoteAdapter(R.id.upcoming_list, serviceIntent);
            views.setEmptyView(R.id.upcoming_list, R.id.upcoming_empty_text);

            // Per-row taps: template carries the destination, each row's fill-in
            // intent (set in UpcomingWidgetService's factory) supplies the date via
            // a unique data Uri -- the documented way to make RemoteViews list rows
            // distinguishable, since fill-in intents don't get their own requestCode.
            Intent templateIntent = new Intent(context, MainActivity.class);
            templateIntent.putExtra("action", "open_calendar_date");
            PendingIntent templatePendingIntent = PendingIntent.getActivity(context, 900 + appWidgetId, templateIntent, flags);
            views.setPendingIntentTemplate(R.id.upcoming_list, templatePendingIntent);

            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.putExtra("action", "open_calendar");
            openIntent.setData(Uri.parse("mindos://upcoming/open/" + appWidgetId));
            PendingIntent openPendingIntent = PendingIntent.getActivity(context, 950 + appWidgetId, openIntent, flags);
            views.setOnClickPendingIntent(R.id.upcoming_title, openPendingIntent);

            boolean noDataYet = !anyMonthCached(context);
            views.setTextViewText(R.id.upcoming_empty_text, noDataYet
                    ? context.getString(R.string.widget_calendar_no_sync)
                    : context.getString(R.string.widget_upcoming_empty));

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static boolean anyMonthCached(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Calendar today = Calendar.getInstance();
        String currentMonthKey = String.format(Locale.US, "%04d-%02d", today.get(Calendar.YEAR), today.get(Calendar.MONTH) + 1);
        return prefs.getString("mindos_calendar_widget_" + currentMonthKey, null) != null;
    }

    /** One agenda row: either a real deadline/event (title non-null) sourced from
     * buildUpcomingItems, grouped under dayGroupLabel by UpcomingWidgetService's
     * factory into header + item rows for the list. */
    static final class Row {
        final long sortKey;
        final String dayGroupLabel;
        final String dateStr;
        final String timeLabel;
        final String title;
        final String colorHex;

        Row(long sortKey, String dayGroupLabel, String dateStr, String timeLabel, String title, String colorHex) {
            this.sortKey = sortKey;
            this.dayGroupLabel = dayGroupLabel;
            this.dateStr = dateStr;
            this.timeLabel = timeLabel;
            this.title = title;
            this.colorHex = colorHex;
        }
    }

    /** Deadlines sort before timed events on the same day (matches the Calendar
     * widget's agenda view); a plain day-offset*10000 + minutes key keeps every
     * day's entries in their own numeric band, so days never interleave
     * regardless of how many items a day has. Package-private: also called from
     * UpcomingWidgetService's RemoteViewsFactory, which needs the identical data. */
    static List<Row> buildUpcomingItems(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Map<String, JSONObject> monthCache = new HashMap<>();
        List<Row> entries = new ArrayList<>();

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

            String dayGroupLabel = dayGroupLabelFor(context, d, day);

            JSONArray deadlines = dayInfo.optJSONArray("deadlines");
            if (deadlines != null) {
                for (int i = 0; i < deadlines.length(); i++) {
                    JSONObject dl = deadlines.optJSONObject(i);
                    if (dl == null || dl.optBoolean("done", false)) continue;
                    long sortKey = (long) d * 10000L;
                    entries.add(new Row(sortKey, dayGroupLabel, dateStr, "!", dl.optString("title", ""), "#EF4444"));
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
                    String timeLabel = allDay ? "•" : startTime;
                    entries.add(new Row(sortKey, dayGroupLabel, dateStr, timeLabel, title, color));
                }
            }
        }

        Collections.sort(entries, new Comparator<Row>() {
            @Override
            public int compare(Row a, Row b) {
                return Long.compare(a.sortKey, b.sortKey);
            }
        });
        return entries;
    }

    private static String dayGroupLabelFor(Context context, int dayOffset, Calendar day) {
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
