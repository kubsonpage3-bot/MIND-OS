# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ─── MIND OS Widget Providers ───────────────────────────────────────────────
# AppWidgetProvider subclasses are instantiated by the Android launcher via
# the manifest <receiver> entries, NOT by any direct Java reference inside the
# app. R8/ProGuard therefore marks them as dead code and strips them in a
# release build, making the widgets disappear from the launcher widget picker.
# Every provider + every WorkManager Worker that is registered only by class
# name must be kept explicitly.
-keep public class com.mindos.app.RPGStatsWidgetProvider { *; }
-keep public class com.mindos.app.DailiesWidgetProvider { *; }
-keep public class com.mindos.app.DailySummaryWidgetProvider { *; }
-keep public class com.mindos.app.QuickActionsWidgetProvider { *; }
-keep public class com.mindos.app.CalendarWidgetProvider { *; }
-keep public class com.mindos.app.UpcomingWidgetProvider { *; }

# WorkManager workers are also instantiated reflectively by WorkManager itself.
-keep public class com.mindos.app.WidgetSyncWorker { *; }
-keep public class com.mindos.app.CalendarWidgetSyncWorker { *; }

# Capacitor plugin registered by annotation scan — keep to avoid breaking
# the JS bridge that syncs widget data from the web layer.
-keep public class com.mindos.app.WidgetSyncPlugin { *; }

# Keep all AppWidgetProvider subclasses generically (safety net).
-keep public class * extends android.appwidget.AppWidgetProvider { *; }

# Keep WorkManager Worker subclasses generically (safety net).
-keep public class * extends androidx.work.Worker { *; }

# RemoteViewsService backing the Upcoming widget's list is instantiated by the
# system via the manifest <service> entry only.
-keep public class com.mindos.app.UpcomingWidgetService { *; }
-keep public class com.mindos.app.UpcomingWidgetService$Factory { *; }
-keep public class com.mindos.app.UpcomingWidgetProvider$Row { *; }
-keep public class * extends android.widget.RemoteViewsService { *; }
