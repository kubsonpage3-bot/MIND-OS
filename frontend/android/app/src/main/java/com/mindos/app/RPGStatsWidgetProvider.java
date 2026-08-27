package com.mindos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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

    /**
     * FIX: Now handles ALL classes (warlord, scholar, monk, shadow, wanderer) with correct file names.
     * Wanderer uses hash-based filenames; all other classes use class_rank.webp format.
     */
    private static String getAvatarFilename(String classId, String rankId) {
        String normClass = classId != null ? classId.toLowerCase().trim() : "wanderer";
        String normRank = normalizeRank(rankId);

        if ("wanderer".equals(normClass) || "default".equals(normClass) || normClass.isEmpty()) {
            // Wanderer uses generated hash filenames keyed by rank
            switch (normRank) {
                case "c": return "82c35d837_generated_image.webp";
                case "b": return "032923fd3_generated_image.webp";
                case "a": return "c1bdfbb0c_generated_image.webp";
                case "s":
                case "ss": return "f6d9c9d1e_generated_image.webp";
                case "sss": return "c5c7fecf4_generated_image.webp";
                default:  return "993830219_generated_image.webp"; // F / D
            }
        }

        // All other classes: class_rank.webp — but only certain ranks exist per class
        // Normalize rank: if exact file doesn't exist, fall back to nearest lower rank
        String[] ranksDesc = {"sss", "ss", "s", "a", "b", "c", "d", "f"};
        for (String r : ranksDesc) {
            if (normRank.equals(r) || isRankAtLeast(normRank, r)) {
                String filename = normClass + "_" + r + ".webp";
                // We'll try this; RPGStatsWidgetProvider already has a fallback chain
                return filename;
            }
        }
        return normClass + "_f.webp";
    }

    private static boolean isRankAtLeast(String current, String target) {
        String[] order = {"f", "d", "c", "b", "a", "s", "ss", "sss"};
        int ci = indexOf(order, current);
        int ti = indexOf(order, target);
        return ci >= ti;
    }

    private static int indexOf(String[] arr, String val) {
        for (int i = 0; i < arr.length; i++) {
            if (arr[i].equals(val)) return i;
        }
        return 0;
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
                return null; // solid_dark uses programmatic background
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

    /**
     * Converts a float metric value (e.g. gf=102.3, ceiling=105) to a 0-100 int progress
     * anchored from the floor (80.0).
     */
    private static int metricToProgress(double value, double ceiling) {
        double floor = 80.0;
        double range = ceiling - floor;
        if (range <= 0) return 100;
        double pct = (value - floor) / range * 100.0;
        return (int) Math.max(0, Math.min(100, pct));
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

            int hp = 100, maxHp = 100;
            int mp = 50, maxMp = 100;
            int xp = 28, maxXp = 200;
            int gold = 0, sp = 0, streak = 0, level = 1;
            String classId = "wanderer", rankId = "F", themeId = "solid_dark", username = "";
            double gf = 100.0, gc = 100.0, ps = 100.0, vm = 100.0;
            double gfCeiling = 105.0, gcCeiling = 105.0, psCeiling = 105.0, vmCeiling = 105.0;

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
                username = json.optString("username", "");
                gf = json.optDouble("gf", 100.0);
                gc = json.optDouble("gc", 100.0);
                ps = json.optDouble("ps", 100.0);
                vm = json.optDouble("vm", 100.0);
                gfCeiling = json.optDouble("gf_ceiling", 105.0);
                gcCeiling = json.optDouble("gc_ceiling", 105.0);
                psCeiling = json.optDouble("ps_ceiling", 105.0);
                vmCeiling = json.optDouble("vm_ceiling", 105.0);
            }

            // Bind HP / MP / EXP Labels
            views.setTextViewText(R.id.widget_hp_label, hp + " / " + maxHp);
            views.setTextViewText(R.id.widget_mp_label, mp + " / " + maxMp);
            views.setTextViewText(R.id.widget_xp_label, xp + " / " + maxXp);

            // Bind Progress Bars
            views.setProgressBar(R.id.widget_hp_progress, maxHp, Math.max(0, hp), false);
            views.setProgressBar(R.id.widget_mp_progress, maxMp, Math.max(0, mp), false);
            views.setProgressBar(R.id.widget_xp_progress, maxXp, Math.max(0, xp), false);

            // Bind IQ Mini-Bars (Gf/Gc/Ps/Vm — each 0→100 from floor 80 to ceiling)
            views.setProgressBar(R.id.widget_gf_progress, 100, metricToProgress(gf, gfCeiling), false);
            views.setProgressBar(R.id.widget_gc_progress, 100, metricToProgress(gc, gcCeiling), false);
            views.setProgressBar(R.id.widget_ps_progress, 100, metricToProgress(ps, psCeiling), false);
            views.setProgressBar(R.id.widget_vm_progress, 100, metricToProgress(vm, vmCeiling), false);

            // Bind Level / Rank / Class Badge
            String classNameDisplay = classId.substring(0, 1).toUpperCase() + (classId.length() > 1 ? classId.substring(1).toLowerCase() : "");
            views.setTextViewText(R.id.widget_level_badge, context.getString(R.string.widget_rank_prefix) + " " + rankId.toUpperCase() + " • " + classNameDisplay);

            // Bind Username
            if (!username.isEmpty()) {
                views.setTextViewText(R.id.widget_username_label, username);
            } else {
                views.setTextViewText(R.id.widget_username_label, classNameDisplay + " Lv." + level);
            }

            // Bind Currency & Streak Chips
            views.setTextViewText(R.id.widget_gold_label, gold + " " + context.getString(R.string.widget_gold_suffix));
            views.setTextViewText(R.id.widget_sp_label, sp + " " + context.getString(R.string.widget_sp_suffix));
            views.setTextViewText(R.id.widget_streak_label, streak + " " + context.getString(R.string.widget_streak_suffix));

            // 1. FIX: Theme Wallpaper Background — solid_dark uses programmatic color
            String themeWallpaper = getThemeWallpaperFilename(themeId);
            if (themeWallpaper != null) {
                Bitmap wallpaperBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + themeWallpaper, 450, 275);
                if (wallpaperBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_background_image, wallpaperBitmap);
                } else {
                    views.setImageViewResource(R.id.widget_background_image, 0);
                }
            } else {
                // FIX: solid_dark — clear the image view so the background drawable shows through
                views.setImageViewResource(R.id.widget_background_image, 0);
            }

            // 2. Rank Avatar Background Scene
            String rankBgFile = getRankBgFilename(rankId);
            Bitmap rankBgBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + rankBgFile, 160, 160);
            if (rankBgBitmap != null) {
                views.setImageViewBitmap(R.id.widget_avatar_bg, rankBgBitmap);
            } else {
                views.setImageViewResource(R.id.widget_avatar_bg, 0);
            }

            // 3. FIX: Avatar with correct class/rank lookup + full fallback chain
            String avatarFilename = getAvatarFilename(classId, rankId);
            Bitmap avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + avatarFilename, 160, 160);

            // Fallback 1: try lower rank for same class (c→d→f)
            if (avatarBitmap == null && !"f".equals(normalizeRank(rankId))) {
                String[] fallbackRanks = {"d", "f"};
                for (String fr : fallbackRanks) {
                    String normClass = classId.toLowerCase().trim();
                    avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + normClass + "_" + fr + ".webp", 160, 160);
                    if (avatarBitmap != null) break;
                }
            }

            // Fallback 2: wanderer sprite for same rank
            if (avatarBitmap == null) {
                avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/" + getAvatarFilename("wanderer", rankId), 160, 160);
            }

            // Fallback 3: default wanderer F rank
            if (avatarBitmap == null) {
                avatarBitmap = decodeSampledBitmapFromAsset(context, "public/images/webp/993830219_generated_image.webp", 160, 160);
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
