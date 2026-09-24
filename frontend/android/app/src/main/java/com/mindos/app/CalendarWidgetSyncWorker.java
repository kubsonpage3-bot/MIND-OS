package com.mindos.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.WorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.Constraints;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Fetches the current month's calendar summary from the backend and caches it
 * for CalendarWidgetProvider -- this is what makes the Calendar widget actually
 * "synced" instead of just repainting whatever the app last wrote. The other 4
 * widgets never do this: their updatePeriodMillis only re-renders the SAME
 * cached SharedPreferences snapshot, so they go stale for as long as the app
 * stays closed.
 *
 * Auth: the widget-feed endpoint is gated by the same long-lived, revocable
 * `calendar_feed_token` the ICS subscription URL uses (see
 * api/views_calendar.py::CalendarWidgetFeedView) -- NOT the app's short-lived
 * JWT, which lives in the WebView's own localStorage and isn't reachable from
 * native code. If no token has been mirrored yet (user hasn't opened the
 * Calendar tab since installing), this worker simply has nothing to do.
 */
public class CalendarWidgetSyncWorker extends Worker {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_TOKEN = "mindos_calendar_feed_token";
    private static final String KEY_API_BASE = "mindos_api_base";
    private static final String KEY_CACHE_PREFIX = "mindos_calendar_widget_";
    private static final String DEFAULT_API_BASE = "https://mind-os-d5sk.onrender.com";
    private static final String UNIQUE_PERIODIC_NAME = "calendar_widget_periodic_sync";
    private static final String UNIQUE_ONE_TIME_NAME = "calendar_widget_one_time_sync";

    public static final String KEY_MONTH_OFFSET = "month_offset";

    public CalendarWidgetSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void enqueuePeriodic(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        // 30 minutes matches the other widgets' updatePeriodMillis; WorkManager
        // itself enforces a 15-minute floor for periodic work.
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                CalendarWidgetSyncWorker.class, 30, java.util.concurrent.TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancelPeriodic(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_NAME);
    }

    /** True if either widget fed by this worker (Calendar or Upcoming) is
     * still placed -- checked before cancelling the shared periodic job
     * from either provider's onDisabled(), since that fires per-provider
     * whenever just THAT widget type's last instance is removed, not when
     * both widgets sharing this data are gone. */
    public static boolean anyCalendarWidgetPlaced(Context context) {
        android.appwidget.AppWidgetManager mgr = android.appwidget.AppWidgetManager.getInstance(context);
        Class<?>[] providers = {CalendarWidgetProvider.class, UpcomingWidgetProvider.class};
        for (Class<?> p : providers) {
            int[] ids = mgr.getAppWidgetIds(new android.content.ComponentName(context, p));
            if (ids.length > 0) return true;
        }
        return false;
    }

    /** Immediate one-shot refresh of the CURRENT month -- called right after the
     * app writes a fresh token, and whenever WidgetSyncPlugin.updateWidget() fires,
     * so the widget doesn't wait up to 30 minutes to catch up. */
    public static void enqueueNow(Context context) {
        enqueueMonthOffset(context, 0, true);
    }

    /** Fetches a specific month (0 = current, -1 = previous, +1 = next) for the
     * widget's month-navigation buttons. Not deduped against the periodic job
     * (different offsets are independent), but a re-tap of the same offset
     * replaces any still-running fetch for it. */
    public static void enqueueMonthOffset(Context context, int offset) {
        enqueueMonthOffset(context, offset, false);
    }

    private static void enqueueMonthOffset(Context context, int offset, boolean expedited) {
        Data input = new Data.Builder().putInt(KEY_MONTH_OFFSET, offset).build();
        OneTimeWorkRequest.Builder builder = new OneTimeWorkRequest.Builder(CalendarWidgetSyncWorker.class)
                .setInputData(input)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build());
        if (expedited && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            builder.setExpedited(androidx.work.OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
        }
        WorkRequest request = builder.build();
        WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_ONE_TIME_NAME + "_" + offset, ExistingWorkPolicy.REPLACE, (OneTimeWorkRequest) request);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        if (token == null || token.isEmpty()) {
            // Nothing to sync yet -- not a failure, just nothing to do until the
            // app has opened the Calendar tab once and mirrored a token.
            return Result.success();
        }
        String apiBase = prefs.getString(KEY_API_BASE, DEFAULT_API_BASE);
        int offset = getInputData().getInt(KEY_MONTH_OFFSET, 0);
        String monthParam = monthForOffset(offset);

        String url = apiBase + "/api/calendar/feed/" + token + "/widget.json?month=" + monthParam;
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            int code = conn.getResponseCode();
            if (code == 404) {
                // Token was rotated/revoked or Premium lapsed -- stop hammering it.
                prefs.edit().remove(KEY_TOKEN).apply();
                return Result.success();
            }
            if (code != 200) {
                return Result.retry();
            }

            InputStream is = conn.getInputStream();
            String body = readAll(is);
            is.close();

            prefs.edit().putString(KEY_CACHE_PREFIX + monthParam, body).apply();
            CalendarWidgetProvider.refreshAllWidgets(ctx);
            UpcomingWidgetProvider.refreshAllWidgets(ctx);
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String readAll(InputStream is) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }
        return sb.toString();
    }

    static String monthForOffset(int offset) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.add(java.util.Calendar.MONTH, offset);
        int year = cal.get(java.util.Calendar.YEAR);
        int month = cal.get(java.util.Calendar.MONTH) + 1;
        return String.format(java.util.Locale.US, "%04d-%02d", year, month);
    }

    static String cacheKeyForOffset(int offset) {
        return KEY_CACHE_PREFIX + monthForOffset(offset);
    }
}
