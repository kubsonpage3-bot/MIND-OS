package com.mindos.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject

class RPGStatsWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.mindos.app.ACTION_UPDATE_WIDGET"

        // Cache/Fast-lookup map for common avatars to prevent slow reflection lookup via getIdentifier
        private val AVATAR_MAP = mapOf(
            "avatar_default" to R.drawable.avatar_default,
            "avatar_wanderer" to R.drawable.avatar_default,
            // Add additional mappings here if defined in resources
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_UPDATE_WIDGET || action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            // Security: limit custom ACTION_UPDATE_WIDGET broadcast processing to intents explicitly package-targeted
            if (action == ACTION_UPDATE_WIDGET && intent.getPackage() != context.packageName) {
                return
            }
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, RPGStatsWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.rpg_stats_widget)

        // Set PendingIntent to launch the app on widget click
        val configIntent = Intent(context, MainActivity::class.java)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(context, 0, configIntent, flags)
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        try {
            // Read Capacitor SharedPreferences file
            val sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            val profileJson = sharedPrefs.getString("mindos_profile", null)

            if (profileJson != null) {
                val json = JSONObject(profileJson)
                val hp = json.optInt("hp", 0)
                val maxHp = Math.max(1, json.optInt("max_hp", 100))
                val mp = json.optInt("mp", 0)
                val maxMp = Math.max(1, json.optInt("max_mp", 100))
                val xp = json.optInt("xp", 0)
                val maxXp = Math.max(1, json.optInt("max_xp", 100))
                val avatarResName = json.optString("avatar_res_name", "avatar_default")

                // Bind Text Labels
                views.setTextViewText(R.id.widget_hp_label, "HP: $hp/$maxHp")
                views.setTextViewText(R.id.widget_mp_label, "MP: $mp/$maxMp")
                views.setTextViewText(R.id.widget_xp_label, "XP: $xp/$maxXp")

                // Bind ProgressBars
                views.setProgressBar(R.id.widget_hp_progress, maxHp, Math.max(0, hp), false)
                views.setProgressBar(R.id.widget_mp_progress, maxMp, Math.max(0, mp), false)
                views.setProgressBar(R.id.widget_xp_progress, maxXp, Math.max(0, xp), false)

                // Resolve avatar drawable with fast cache lookup or reflection fallback
                var resId = AVATAR_MAP[avatarResName] ?: 0
                if (resId == 0) {
                    resId = context.resources.getIdentifier(avatarResName, "drawable", context.packageName)
                }

                if (resId != 0) {
                    views.setImageViewResource(R.id.widget_avatar, resId)
                } else {
                    views.setImageViewResource(R.id.widget_avatar, R.drawable.avatar_default)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
