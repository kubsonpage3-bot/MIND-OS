package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

public class RPGStatsWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.mindos.app.ACTION_UPDATE_WIDGET";

    // Fast compile-time drawable resource lookup cache
    private static final Map<String, Integer> AVATAR_MAP = new HashMap<>();
    static {
        AVATAR_MAP.put("avatar_default", R.drawable.avatar_default);
        AVATAR_MAP.put("avatar_wanderer", R.drawable.avatar_default);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_UPDATE_WIDGET.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            // Security: limit custom ACTION_UPDATE_WIDGET broadcast processing to intents explicitly package-targeted
            if (ACTION_UPDATE_WIDGET.equals(action) && !context.getPackageName().equals(intent.getPackage())) {
                return;
            }
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, RPGStatsWidgetProvider.class);
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
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.rpg_stats_widget);

        // Set PendingIntent to launch the app on widget click
        Intent configIntent = new Intent(context, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, configIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        try {
            // Read Capacitor SharedPreferences file safely
            android.content.SharedPreferences sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String profileJson = sharedPrefs.getString("mindos_profile", null);

            if (profileJson != null) {
                JSONObject json = new JSONObject(profileJson);
                int hp = json.optInt("hp", 0);
                int maxHp = Math.max(1, json.optInt("max_hp", 100));
                int mp = json.optInt("mp", 0);
                int maxMp = Math.max(1, json.optInt("max_mp", 100));
                int xp = json.optInt("xp", 0);
                int maxXp = Math.max(1, json.optInt("max_xp", 100));
                String avatarResName = json.optString("avatar_res_name", "avatar_default");

                // Bind Text Labels
                views.setTextViewText(R.id.widget_hp_label, "HP: " + hp + "/" + maxHp);
                views.setTextViewText(R.id.widget_mp_label, "MP: " + mp + "/" + maxMp);
                views.setTextViewText(R.id.widget_xp_label, "XP: " + xp + "/" + maxXp);

                // Bind ProgressBars with sanitization
                views.setProgressBar(R.id.widget_hp_progress, maxHp, Math.max(0, hp), false);
                views.setProgressBar(R.id.widget_mp_progress, maxMp, Math.max(0, mp), false);
                views.setProgressBar(R.id.widget_xp_progress, maxXp, Math.max(0, xp), false);

                // Resolve avatar drawable with fast cache lookup or reflection fallback
                Integer resIdObj = AVATAR_MAP.get(avatarResName);
                int resId = resIdObj != null ? resIdObj : 0;
                if (resId == 0) {
                    resId = context.getResources().getIdentifier(avatarResName, "drawable", context.getPackageName());
                }

                if (resId != 0) {
                    views.setImageViewResource(R.id.widget_avatar, resId);
                } else {
                    views.setImageViewResource(R.id.widget_avatar, R.drawable.avatar_default);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
