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

public class RPGStatsWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_UPDATE_WIDGET = "com.mindos.app.ACTION_UPDATE_WIDGET";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_UPDATE_WIDGET.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
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

    private static String normalizeRank(String rankId) {
        if (rankId == null || rankId.trim().isEmpty()) return "f";
        String r = rankId.toLowerCase().trim();
        if ("e".equals(r)) return "f";
        return r;
    }

    private static String getAvatarFilename(String classId, String rankId) {
        String normClass = classId != null ? classId.toLowerCase().trim() : "wanderer";
        String normRank = normalizeRank(rankId);

        if ("wanderer".equals(normClass) || "default".equals(normClass) || normClass.isEmpty()) {
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
                return "993830219_generated_image.webp"; // F or E or D
            }
        } else {
            return normClass + "_" + normRank + ".webp";
        }
    }

    private static String getRankBgFilename(String rankId) {
        String normRank = rankId != null ? rankId.toUpperCase().trim() : "F";
        switch (normRank) {
            case "D": return "e40b7b940_generated_image.webp";
            case "C": return "d7eeb708b_generated_image.webp";
            case "B": return "21c3691e5_generated_image.webp";
            case "A": return "a1200a724_generated_image.webp";
            case "S": return "3c9b18011_generated_image.webp";
            case "SS": return "f72c50f73_generated_image.webp";
            case "SSS": return "788bddb7a_generated_image.webp";
            case "E":
            case "F":
            default:
                return "0fafb424e_generated_image.webp";
        }
    }

    private static String getThemeWallpaperFilename(String themeId) {
        String normTheme = themeId != null ? themeId.toLowerCase().trim() : "solid_dark";
        switch (normTheme) {
            case "dark": return "theme_dark.webp";
            case "anime": return "theme_anime.webp";
            case "steampunk": return "theme_steampunk.webp";
            case "dark_fantasy": return "theme_dark_fantasy.webp";
            case "christian": return "theme_christian.webp";
            default:
                return null;
        }
    }

    private static Bitmap decodeSampledBitmapFromAsset(Context context, String assetPath, int reqWidth, int reqHeight) {
        try {
            final BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            InputStream is = context.getAssets().open(assetPath);
            BitmapFactory.decodeStream(is, null, options);
            is.close();

            options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight);
            options.inJustDecodeBounds = false;
            options.inPreferredConfig = Bitmap.Config.ARGB_8888;

            is = context.getAssets().open(assetPath);
            Bitmap decoded = BitmapFactory.decodeStream(is, null, options);
            is.close();

            if (decoded != null) {
                Bitmap scaled = Bitmap.createScaledBitmap(decoded, reqWidth, reqHeight, true);
                if (scaled != decoded) {
                    decoded.recycle();
                }
                return scaled;
            }
        } catch (Exception e) {
            // Asset load failed - will try fallback
        }
        return null;
    }

    private static int calculateInSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight) {
        final int height = options.outHeight;
        final int width = options.outWidth;
        int inSampleSize = 1;

        if (height > reqHeight || width > reqWidth) {
            final int halfHeight = height / 2;
            final int halfWidth = width / 2;

            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.rpg_stats_widget);

        // Click on widget launches the MindOS app
        Intent configIntent = new Intent(context, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, configIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        try {
            android.content.SharedPreferences sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String profileJson = sharedPrefs.getString("mindos_profile", null);

            int hp = 100;
            int maxHp = 100;
            int mp = 50;
            int maxMp = 100;
            int xp = 28;
            int maxXp = 200;
            int gold = 0;
            int sp = 0;
            int streak = 0;
            int level = 1;
            String classId = "wanderer";
            String rankId = "F";
            String themeId = "solid_dark";

            if (profileJson != null) {
                JSONObject json = new JSONObject(profileJson);
                hp = json.optInt("hp", 100);
                maxHp = Math.max(1, json.optInt("max_hp", 100));
                mp = json.optInt("mp", 50);
                maxMp = Math.max(1, json.optInt("max_mp", 100));
                xp = json.optInt("xp", 0);
                maxXp = Math.max(1, json.optInt("max_xp", 100));
                gold = json.optInt("gold", 0);
                sp = json.optInt("sp", 0);
                streak = json.optInt("streak", 0);
                level = Math.max(1, json.optInt("level", 1));
                classId = json.optString("class", "wanderer");
                rankId = json.optString("rank", "F");
                themeId = json.optString("theme", "solid_dark");
            }

            // Bind HP / MP / EXP Labels
            views.setTextViewText(R.id.widget_hp_label, hp + " / " + maxHp);
            views.setTextViewText(R.id.widget_mp_label, mp + " / " + maxMp);
            views.setTextViewText(R.id.widget_xp_label, xp + " / " + maxXp);

            // Bind Progress Bars
            views.setProgressBar(R.id.widget_hp_progress, maxHp, Math.max(0, hp), false);
            views.setProgressBar(R.id.widget_mp_progress, maxMp, Math.max(0, mp), false);
            views.setProgressBar(R.id.widget_xp_progress, maxXp, Math.max(0, xp), false);

            // Bind Level / Rank / Class Badge
            String classNameDisplay = classId.substring(0, 1).toUpperCase() + (classId.length() > 1 ? classId.substring(1).toLowerCase() : "");
            views.setTextViewText(R.id.widget_level_badge, "Rank " + rankId.toUpperCase() + " • " + classNameDisplay);

            // Bind Currency & Streak Chips
            views.setTextViewText(R.id.widget_gold_label, gold + " G");
            views.setTextViewText(R.id.widget_sp_label, sp + " SP");
            views.setTextViewText(R.id.widget_streak_label, streak + " d");

            // 1. Theme Wallpaper Background
            String themeWallpaper = getThemeWallpaperFilename(themeId);
            if (themeWallpaper != null) {
                Bitmap wallpaperBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + themeWallpaper, 450, 275);
                if (wallpaperBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_background_image, wallpaperBitmap);
                } else {
                    views.setImageViewResource(R.id.widget_background_image, 0);
                }
            } else {
                views.setImageViewResource(R.id.widget_background_image, 0);
            }

            // 2. Rank Avatar Background Scene
            String rankBgFile = getRankBgFilename(rankId);
            Bitmap rankBgBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + rankBgFile, 140, 140);
            if (rankBgBitmap != null) {
                views.setImageViewBitmap(R.id.widget_avatar_bg, rankBgBitmap);
            } else {
                views.setImageViewResource(R.id.widget_avatar_bg, 0);
            }

            // 3. Avatar Character Sprite with Guaranteed Fallback
            String avatarFilename = getAvatarFilename(classId, rankId);
            Bitmap avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + avatarFilename, 140, 140);
            if (avatarBitmap == null) {
                // Secondary Fallback: Try general wanderer sprite
                avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/993830219_generated_image.webp", 140, 140);
            }
            if (avatarBitmap == null) {
                // Tertiary Fallback: Try warlord_f.webp
                avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/warlord_f.webp", 140, 140);
            }

            if (avatarBitmap != null) {
                views.setImageViewBitmap(R.id.widget_avatar, avatarBitmap);
            } else {
                views.setImageViewResource(R.id.widget_avatar, 0);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
