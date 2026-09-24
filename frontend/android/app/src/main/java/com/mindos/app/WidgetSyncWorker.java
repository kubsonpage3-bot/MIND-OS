package com.mindos.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.TimeUnit;

/**
 * Fetches profile stats + today's Dailies from the backend and caches them
 * under the SAME mindos_profile / mindos_dailies keys the app itself writes
 * on open (see widget.js::syncWidgetStats) -- this is what lets
 * RPGStatsWidgetProvider, DailiesWidgetProvider, DailySummaryWidgetProvider
 * and QuickActionsWidgetProvider go stale for as long as the app stays
 * closed today, mirroring how CalendarWidgetSyncWorker already does this for
 * the Calendar widget.
 *
 * Auth: widget_sync_token (api/views_widget_sync.py), NOT the app's JWT --
 * native code can't read the WebView's own localStorage -- and NOT
 * calendar_feed_token either, since none of these 4 widgets are a Premium
 * feature.
 *
 * mindos_profile also carries theme / avatar_res_name, which this endpoint
 * has no server-side source for (theme lives only in the app's
 * localStorage). A full overwrite would silently reset both to their
 * defaults on every background sync, so the fetched fields are merged over
 * whatever's already cached instead of replacing it outright.
 */
public class WidgetSyncWorker extends Worker {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String KEY_TOKEN = "mindos_widget_sync_token";
    private static final String KEY_API_BASE = "mindos_api_base";
    private static final String KEY_PROFILE = "mindos_profile";
    private static final String KEY_DAILIES = "mindos_dailies";
    private static final String DEFAULT_API_BASE = "https://mind-os-d5sk.onrender.com";
    private static final String UNIQUE_PERIODIC_NAME = "widget_stats_periodic_sync";
    private static final String UNIQUE_ONE_TIME_NAME = "widget_stats_one_time_sync";

    public WidgetSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void enqueuePeriodic(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                WidgetSyncWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancelPeriodic(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_NAME);
    }

    public static void enqueueNow(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        OneTimeWorkRequest.Builder builder = new OneTimeWorkRequest.Builder(WidgetSyncWorker.class)
                .setConstraints(constraints);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            builder.setExpedited(androidx.work.OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
        }
        WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, builder.build());
    }

    /** True if at least one of the 4 widgets this worker feeds is still on a
     * home screen -- checked before cancelling the periodic job from any
     * single provider's onDisabled(), since that only fires when THAT
     * provider's own last instance is removed, not when every widget
     * sharing this data is gone. */
    public static boolean anySyncedWidgetPlaced(Context context) {
        android.appwidget.AppWidgetManager mgr = android.appwidget.AppWidgetManager.getInstance(context);
        Class<?>[] providers = {
                RPGStatsWidgetProvider.class, DailiesWidgetProvider.class,
                DailySummaryWidgetProvider.class, QuickActionsWidgetProvider.class,
        };
        for (Class<?> p : providers) {
            int[] ids = mgr.getAppWidgetIds(new android.content.ComponentName(context, p));
            if (ids.length > 0) return true;
        }
        return false;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String token = prefs.getString(KEY_TOKEN, null);
        if (token == null || token.isEmpty()) {
            // Nothing to sync until the app has opened at least once and
            // mirrored a token (see WidgetSyncPlugin.syncWidgetToken).
            return Result.success();
        }
        String apiBase = prefs.getString(KEY_API_BASE, DEFAULT_API_BASE);

        String url = apiBase + "/api/widget/sync/" + token + "/";
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            int code = conn.getResponseCode();
            if (code == 404) {
                prefs.edit().remove(KEY_TOKEN).apply();
                return Result.success();
            }
            if (code != 200) {
                return Result.retry();
            }

            InputStream is = conn.getInputStream();
            String body = readAll(is);
            is.close();

            JSONObject data = new JSONObject(body);
            JSONObject fetchedProfile = data.optJSONObject("profile");
            JSONArray dailies = data.optJSONArray("dailies");

            if (fetchedProfile != null) {
                JSONObject merged = mergeProfile(prefs, fetchedProfile);
                prefs.edit().putString(KEY_PROFILE, merged.toString()).apply();
            }
            if (dailies != null) {
                prefs.edit().putString(KEY_DAILIES, dailies.toString()).apply();
            }

            RPGStatsWidgetProvider.refreshAllWidgets(ctx);
            DailiesWidgetProvider.refreshAllWidgets(ctx);
            DailySummaryWidgetProvider.refreshAllWidgets(ctx);
            QuickActionsWidgetProvider.refreshAllWidgets(ctx);

            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static JSONObject mergeProfile(SharedPreferences prefs, JSONObject fetched) {
        JSONObject existing;
        try {
            String cached = prefs.getString(KEY_PROFILE, null);
            existing = cached != null ? new JSONObject(cached) : new JSONObject();
        } catch (Exception e) {
            existing = new JSONObject();
        }
        try {
            Iterator<String> keys = fetched.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                existing.put(key, fetched.get(key));
            }
        } catch (Exception ignored) {
        }
        return existing;
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
}
