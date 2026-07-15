package com.mindos.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class RPGStatsWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.mindos.app.ACTION_UPDATE_WIDGET"
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_UPDATE_WIDGET || intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
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

        try {
            // Read Capacitor SharedPreferences file
            val sharedPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
            val profileJson = sharedPrefs.getString("mindos_profile", null)

            if (profileJson != null) {
                val json = JSONObject(profileJson)
                val hp = json.optInt("hp", 0)
                val maxHp = json.optInt("max_hp", 100)
                val mp = json.optInt("mp", 0)
                val maxMp = json.optInt("max_mp", 100)
                val xp = json.optInt("xp", 0)
                val maxXp = json.optInt("max_xp", 100)
                val avatarResName = json.optString("avatar_res_name", "avatar_default")

                // Bind Text Labels
                views.setTextViewText(R.id.widget_hp_label, "HP: $hp/$maxHp")
                views.setTextViewText(R.id.widget_mp_label, "MP: $mp/$maxMp")
                views.setTextViewText(R.id.widget_xp_label, "XP: $xp/$maxXp")

                // Bind ProgressBars
                views.setProgressBar(R.id.widget_hp_progress, maxHp, hp, false)
                views.setProgressBar(R.id.widget_mp_progress, maxMp, mp, false)
                views.setProgressBar(R.id.widget_xp_progress, maxXp, xp, false)

                // Dynamically resolve and bind the avatar drawable from res/drawable/
                val resId = context.resources.getIdentifier(avatarResName, "drawable", context.packageName)
                if (resId != 0) {
                    views.setImageViewResource(R.id.widget_avatar, resId)
                } else {
                    // Fallback to default avatar image
                    val fallbackId = context.resources.getIdentifier("avatar_default", "drawable", context.packageName)
                    if (fallbackId != 0) {
                        views.setImageViewResource(R.id.widget_avatar, fallbackId)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
