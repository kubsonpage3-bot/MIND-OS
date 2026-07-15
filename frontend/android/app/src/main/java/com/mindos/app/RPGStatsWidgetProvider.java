package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class RPGStatsWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.mindos.app.ACTION_UPDATE_WIDGET";

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

    private static String getAvatarFilename(String classId, String rankId) {
        // Enforce lowercase and trim to ensure matching of case-sensitive asset paths
        String normClass = classId != null ? classId.toLowerCase().trim() : "wanderer";
        String normRank = rankId != null ? rankId.toLowerCase().trim() : "f";

        if ("wanderer".equals(normClass) || "default".equals(normClass) || "".equals(normClass)) {
            // Use general rank sprites
            if ("c".equals(normRank)) {
                return "82c35d837_generated_image.webp";
            } else if ("b".equals(normRank)) {
                return "032923fd3_generated_image.webp";
            } else if ("a".equals(normRank)) {
                return "c1bdfbb0c_generated_image.webp";
            } else if ("s".equals(normRank) || "ss".equals(normRank)) {
                return "f6d9c9d1e_generated_image.webp";
            } else if ("sss".equals(normRank)) {
                return "c5c7fecf4_generated_image.webp";
            } else {
                return "993830219_generated_image.webp"; // F or D
            }
        } else {
            // Use class sprite filename: [class]_[rank].webp (e.g., warlord_f.webp)
            return normClass + "_" + normRank + ".webp";
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
            // Read SharedPreferences safely
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
                String classId = json.optString("class", "wanderer");
                String rankId = json.optString("rank", "F");

                // Bind Text Labels
                views.setTextViewText(R.id.widget_hp_label, "HP: " + hp + "/" + maxHp);
                views.setTextViewText(R.id.widget_mp_label, "MP: " + mp + "/" + maxMp);
                views.setTextViewText(R.id.widget_xp_label, "XP: " + xp + "/" + maxXp);

                // Bind ProgressBars with sanitization
                views.setProgressBar(R.id.widget_hp_progress, maxHp, Math.max(0, hp), false);
                views.setProgressBar(R.id.widget_mp_progress, maxMp, Math.max(0, mp), false);
                views.setProgressBar(R.id.widget_xp_progress, maxXp, Math.max(0, xp), false);

                // Safe decoding of bundled WebP assets directly into RemoteViews Bitmap
                Bitmap avatarBitmap = null;
                try {
                    String filename = getAvatarFilename(classId, rankId);
                    InputStream is = context.getAssets().open("public/images/webp/" + filename);
                    avatarBitmap = BitmapFactory.decodeStream(is);
                    is.close();
                } catch (Exception e) {
                    // Graceful fallback: do not crash on missing/unresolved assets
                    e.printStackTrace();
                }

                if (avatarBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_avatar, avatarBitmap);
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
