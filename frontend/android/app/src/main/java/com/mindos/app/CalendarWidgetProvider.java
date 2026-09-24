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
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * MIND OS Calendar widget: a resizable home-screen widget in the spirit of
 * Google Calendar's own widget -- small sizes show a short agenda for today,
 * larger sizes show the full month grid with per-day indicator dots for
 * events / scheduled Dailies / Todo deadlines. Synced in the background by
 * CalendarWidgetSyncWorker (WorkManager), not just repainted from whatever the
 * app last wrote (unlike the other 4 widgets).
 */
public class CalendarWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_CALENDAR = "com.mindos.app.ACTION_UPDATE_CALENDAR";
    public static final String ACTION_CAL_NAV = "com.mindos.app.ACTION_CAL_NAV";
    public static final String EXTRA_DIRECTION = "direction";
    public static final String EXTRA_APPWIDGET_ID = "appWidgetId";

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String OFFSET_KEY_PREFIX = "mindos_cal_offset_";
    // Below this width the full 7-column grid is illegible, so we fall back to
    // a short agenda list instead -- the same size-driven layout switch
    // Google's own Calendar widget makes.
    private static final int MIN_GRID_WIDTH_DP = 210;
    // 160dp: a standard 3×3 widget is ~146dp tall on most launchers.
    // The original 180dp threshold prevented the grid from ever showing
    // on reasonably-sized widgets (Google Calendar uses ~160dp).
    private static final int MIN_GRID_HEIGHT_DP = 160;

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null) return;
        String action = intent.getAction();

        if (ACTION_CAL_NAV.equals(action)) {
            int appWidgetId = intent.getIntExtra(EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            int direction = intent.getIntExtra(EXTRA_DIRECTION, 0);
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID && direction != 0) {
                navigateMonth(context, appWidgetId, direction);
            }
            return;
        }

        if (ACTION_UPDATE_CALENDAR.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
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
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }

    @Override
    public void onEnabled(Context context) {
        CalendarWidgetSyncWorker.enqueuePeriodic(context);
    }

    @Override
    public void onDisabled(Context context) {
        // Fires once THIS provider's last instance is removed -- but
        // UpcomingWidgetProvider shares the same periodic sync job, so only
        // stop it once neither widget is placed anymore.
        if (!CalendarWidgetSyncWorker.anyCalendarWidgetPlaced(context)) {
            CalendarWidgetSyncWorker.cancelPeriodic(context);
        }
    }

    public static void refreshAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, CalendarWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void navigateMonth(Context context, int appWidgetId, int direction) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int current = prefs.getInt(OFFSET_KEY_PREFIX + appWidgetId, 0);
        int next = current + direction;
        // A widget only ever caches "current month" plus whatever's been
        // browsed to -- clamp to a sane range so a stuck finger can't queue
        // years of fetches.
        if (next < -12) next = -12;
        if (next > 12) next = 12;
        prefs.edit().putInt(OFFSET_KEY_PREFIX + appWidgetId, next).apply();

        CalendarWidgetSyncWorker.enqueueMonthOffset(context, next);
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        updateAppWidget(context, mgr, appWidgetId);
    }

    private static int getOffset(Context context, int appWidgetId) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getInt(OFFSET_KEY_PREFIX + appWidgetId, 0);
    }

    // ── Sizing: decide agenda vs full month grid ────────────────────────────

    private static boolean shouldShowGrid(AppWidgetManager appWidgetManager, int appWidgetId) {
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        if (options == null) return false;
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        return minWidth >= MIN_GRID_WIDTH_DP && minHeight >= MIN_GRID_HEIGHT_DP;
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            boolean showGrid = shouldShowGrid(appWidgetManager, appWidgetId);
            int offset = getOffset(context, appWidgetId);

            RemoteViews views = showGrid
                    ? buildMonthGridViews(context, appWidgetId, offset)
                    : buildAgendaViews(context, appWidgetId);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            // A bad cache entry or transient failure shouldn't crash the
            // widget host -- next sync/resize gets another chance.
            e.printStackTrace();
        }
    }

    /**
     * `tag` must be unique per call site (not just per requestCode): none of
     * these intents call setAction(), so Android's filterEquals() sees every
     * "open MainActivity" intent as equal, ignoring extras entirely. Without
     * a distinguishing data Uri, two calls whose requestCode formulas happen
     * to produce the same int (e.g. a different widget instance's agenda-tap
     * vs. another's day-cell-tap) would collapse into one PendingIntent and
     * silently open whichever date was rendered last.
     */
    private static PendingIntent openAppPendingIntent(Context context, int requestCode, String tag, String date) {
        Intent i = new Intent(context, MainActivity.class);
        i.putExtra("action", "open_calendar_date");
        if (date != null) i.putExtra("date", date);
        i.setData(android.net.Uri.parse("mindos://cal/open/" + tag));
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, requestCode, i, flags);
    }

    private static JSONObject loadMonthData(Context context, String monthKey) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString("mindos_calendar_widget_" + monthKey, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    // ---- Month grid layout ----

    private static RemoteViews buildMonthGridViews(Context context, int appWidgetId, int offset) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget_month);

        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.MONTH, offset);
        int year = cal.get(Calendar.YEAR);
        int monthIdx0 = cal.get(Calendar.MONTH); // 0-based
        String monthKey = String.format(Locale.US, "%04d-%02d", year, monthIdx0 + 1);

        String[] monthNames = context.getResources().getStringArray(R.array.widget_calendar_months);
        views.setTextViewText(R.id.cal_month_label, monthNames[monthIdx0] + " " + year);

        String[] weekdayNames = context.getResources().getStringArray(R.array.widget_calendar_weekdays_short);
        for (int w = 0; w < 7 && w < weekdayNames.length; w++) {
            views.setTextViewText(weekdayHeaderId(w), weekdayNames[w]);
        }

        // Show the sync-hint label only when there's no cached data yet;
        // once data is loaded it disappears so it doesn't take up grid space.
        views.setViewVisibility(R.id.cal_sync_label, monthData == null ? View.VISIBLE : View.GONE);

        int navFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) navFlags |= PendingIntent.FLAG_IMMUTABLE;
        views.setOnClickPendingIntent(R.id.cal_btn_prev, navPendingIntent(context, appWidgetId, -1, navFlags));
        views.setOnClickPendingIntent(R.id.cal_btn_next, navPendingIntent(context, appWidgetId, 1, navFlags));

        // Tapping anywhere in the grid opens the app (not a specific date --
        // see calendar_widget_month.xml for why there's no per-cell tap
        // target). One PendingIntent for the whole grid, not 42.
        views.setOnClickPendingIntent(R.id.cal_grid,
                openAppPendingIntent(context, 800 + appWidgetId, appWidgetId + "/grid", null));

        JSONObject monthData = loadMonthData(context, monthKey);
        JSONObject days = monthData != null ? monthData.optJSONObject("days") : null;
        String todayStr = monthData != null ? monthData.optString("today", null) : null;
        if (todayStr == null) {
            Calendar now = Calendar.getInstance();
            todayStr = String.format(Locale.US, "%04d-%02d-%02d",
                    now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
        }

        // Monday-first grid start, matching the web app's month view.
        Calendar gridCal = (Calendar) cal.clone();
        gridCal.set(Calendar.DAY_OF_MONTH, 1);
        int jsDow = gridCal.get(Calendar.DAY_OF_WEEK); // Sunday=1 .. Saturday=7
        int mondayFirstDow = (jsDow + 5) % 7; // Monday=0 .. Sunday=6
        gridCal.add(Calendar.DAY_OF_MONTH, -mondayFirstDow);

        for (int i = 0; i < 42; i++) {
            int cellId = idFor(context, "day_cell_" + i);
            int numId = idFor(context, "day_num_" + i);
            int dotsId = idFor(context, "day_dots_" + i);
            int dotAId = idFor(context, "day_dot_" + i + "_a");
            int dotBId = idFor(context, "day_dot_" + i + "_b");

            int cellYear = gridCal.get(Calendar.YEAR);
            int cellMonth0 = gridCal.get(Calendar.MONTH);
            int dayNum = gridCal.get(Calendar.DAY_OF_MONTH);
            String cellDateStr = String.format(Locale.US, "%04d-%02d-%02d", cellYear, cellMonth0 + 1, dayNum);
            boolean inCurrentMonth = cellMonth0 == monthIdx0;
            boolean isToday = cellDateStr.equals(todayStr);

            views.setTextViewText(numId, String.valueOf(dayNum));
            views.setInt(cellId, "setBackgroundResource", R.drawable.widget_cal_cell_bg);
            if (isToday) {
                // Google Calendar-style: a filled circle around just the
                // number, not a tint over the whole cell.
                views.setTextColor(numId, Color.WHITE);
                views.setInt(numId, "setBackgroundResource", R.drawable.widget_cal_today_circle);
            } else {
                views.setTextColor(numId, inCurrentMonth ? Color.parseColor("#E2E8F0") : Color.parseColor("#4B4863"));
                views.setInt(numId, "setBackgroundResource", 0);
            }

            JSONObject dayInfo = (days != null && inCurrentMonth) ? days.optJSONObject(cellDateStr) : null;
            List<Integer> dotColors = dotColorsForDay(dayInfo);
            if (!dotColors.isEmpty() && inCurrentMonth) {
                views.setViewVisibility(dotsId, View.VISIBLE);
                views.setViewVisibility(dotAId, View.VISIBLE);
                views.setInt(dotAId, "setBackgroundColor", dotColors.get(0));
                if (dotColors.size() > 1) {
                    views.setViewVisibility(dotBId, View.VISIBLE);
                    views.setInt(dotBId, "setBackgroundColor", dotColors.get(1));
                } else {
                    views.setViewVisibility(dotBId, View.GONE);
                }
            } else {
                views.setViewVisibility(dotsId, View.GONE);
            }

            gridCal.add(Calendar.DAY_OF_MONTH, 1);
        }

        return views;
    }

    private static final java.util.Map<String, Integer> ID_CACHE = new java.util.concurrent.ConcurrentHashMap<>();

    private static int idFor(Context context, String name) {
        Integer cached = ID_CACHE.get(name);
        if (cached != null) return cached;
        int id = context.getResources().getIdentifier(name, "id", context.getPackageName());
        ID_CACHE.put(name, id);
        return id;
    }

    private static int weekdayHeaderId(int index) {
        switch (index) {
            case 0: return R.id.weekday_hdr_0;
            case 1: return R.id.weekday_hdr_1;
            case 2: return R.id.weekday_hdr_2;
            case 3: return R.id.weekday_hdr_3;
            case 4: return R.id.weekday_hdr_4;
            case 5: return R.id.weekday_hdr_5;
            default: return R.id.weekday_hdr_6;
        }
    }

    private static PendingIntent navPendingIntent(Context context, int appWidgetId, int direction, int flags) {
        Intent intent = new Intent(context, CalendarWidgetProvider.class);
        intent.setAction(ACTION_CAL_NAV);
        intent.setPackage(context.getPackageName());
        intent.putExtra(EXTRA_APPWIDGET_ID, appWidgetId);
        intent.putExtra(EXTRA_DIRECTION, direction);
        intent.setData(android.net.Uri.parse("mindos://cal/nav/" + appWidgetId + "/" + direction));
        int requestCode = (direction > 0 ? 500 : 600) + appWidgetId;
        return PendingIntent.getBroadcast(context, requestCode, intent, flags);
    }

    /** Priority: a deadline due that day outranks a plain event, which outranks
     * a merely-scheduled Daily -- matches what a student most needs to notice.
     * Package-private: also called from CalendarWidgetService's per-cell
     * factory, which needs the identical rule and shouldn't duplicate it. */
    static List<Integer> dotColorsForDay(JSONObject dayInfo) {
        List<Integer> colors = new ArrayList<>();
        if (dayInfo == null) return colors;

        JSONArray deadlines = dayInfo.optJSONArray("deadlines");
        if (deadlines != null && deadlines.length() > 0) {
            colors.add(Color.parseColor("#EF4444"));
        }

        JSONArray events = dayInfo.optJSONArray("events");
        if (events != null && events.length() > 0) {
            String hex = "#3B82F6";
            try {
                String c = events.getJSONObject(0).optString("color", hex);
                if (c != null && c.startsWith("#")) hex = c;
            } catch (Exception ignored) {
            }
            try {
                colors.add(Color.parseColor(hex));
            } catch (Exception ignored) {
            }
        }

        if (colors.size() < 2 && dayInfo.optInt("dailies_total", 0) > 0) {
            colors.add(Color.parseColor("#A855F7"));
        }

        while (colors.size() > 2) colors.remove(colors.size() - 1);
        return colors;
    }

    // ---- Agenda (compact) layout ----

    private static RemoteViews buildAgendaViews(Context context, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget_agenda);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        views.setOnClickPendingIntent(R.id.cal_agenda_root,
                openAppPendingIntent(context, 700 + appWidgetId, appWidgetId + "/agenda", null));

        Calendar now = Calendar.getInstance();
        String monthKey = String.format(Locale.US, "%04d-%02d", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1);
        String todayStr = String.format(Locale.US, "%04d-%02d-%02d",
                now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));

        String[] monthAbbr = context.getResources().getStringArray(R.array.widget_calendar_months_short);
        views.setTextViewText(R.id.agenda_date_badge,
                now.get(Calendar.DAY_OF_MONTH) + " " + monthAbbr[now.get(Calendar.MONTH)]);

        JSONObject monthData = loadMonthData(context, monthKey);
        JSONObject days = monthData != null ? monthData.optJSONObject("days") : null;
        JSONObject today = days != null ? days.optJSONObject(todayStr) : null;

        List<String[]> rows = new ArrayList<>(); // {time, text, colorHex}
        if (today != null) {
            JSONArray deadlines = today.optJSONArray("deadlines");
            if (deadlines != null) {
                for (int i = 0; i < deadlines.length(); i++) {
                    JSONObject d = deadlines.optJSONObject(i);
                    if (d == null || d.optBoolean("done", false)) continue;
                    String dueText = context.getString(R.string.widget_calendar_due_prefix, d.optString("title", ""));
                    rows.add(new String[]{"⏰", dueText, "#EF4444"});
                }
            }
            JSONArray events = today.optJSONArray("events");
            if (events != null) {
                for (int i = 0; i < events.length(); i++) {
                    JSONObject e = events.optJSONObject(i);
                    if (e == null) continue;
                    boolean allDay = e.optBoolean("all_day", false);
                    String time = allDay ? "•" : e.optString("start_time", "");
                    rows.add(new String[]{time, e.optString("title", ""), e.optString("color", "#3B82F6")});
                }
            }
            int dailiesTotal = today.optInt("dailies_total", 0);
            int dailiesDone = today.optInt("dailies_done", 0);
            if (dailiesTotal > 0) {
                String label = context.getString(R.string.widget_calendar_dailies_done, dailiesDone, dailiesTotal);
                rows.add(new String[]{"✓", label, dailiesDone == dailiesTotal ? "#22C55E" : "#A855F7"});
            }
        }

        int[] itemIds = {R.id.agenda_item_1, R.id.agenda_item_2, R.id.agenda_item_3, R.id.agenda_item_4};
        int[] timeIds = {R.id.agenda_time_1, R.id.agenda_time_2, R.id.agenda_time_3, R.id.agenda_time_4};
        int[] textIds = {R.id.agenda_text_1, R.id.agenda_text_2, R.id.agenda_text_3, R.id.agenda_text_4};
        int[] dotIds = {R.id.agenda_dot_1, R.id.agenda_dot_2, R.id.agenda_dot_3, R.id.agenda_dot_4};

        for (int id : itemIds) views.setViewVisibility(id, View.GONE);

        int shown = Math.min(rows.size(), itemIds.length);
        for (int i = 0; i < shown; i++) {
            String[] row = rows.get(i);
            views.setViewVisibility(itemIds[i], View.VISIBLE);
            views.setTextViewText(timeIds[i], row[0]);
            views.setTextViewText(textIds[i], row[1]);
            try {
                views.setInt(dotIds[i], "setBackgroundColor", Color.parseColor(row[2]));
            } catch (Exception ignored) {
            }
        }

        views.setViewVisibility(R.id.agenda_empty_text, rows.isEmpty() ? View.VISIBLE : View.GONE);

        return views;
    }
}
