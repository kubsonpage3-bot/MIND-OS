package com.mindos.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * Populates the Calendar widget's 42-cell month grid one cell at a time via
 * the RemoteViewsFactory adapter pattern (see setRemoteAdapter +
 * setPendingIntentTemplate in CalendarWidgetProvider#buildMonthGridViews),
 * instead of one RemoteViews update carrying 42 hand-built FrameLayouts each
 * with their own getActivity() PendingIntent. That earlier approach could
 * push a single update over the ~1MB Binder transaction limit -- the
 * launcher's own answer to that is to silently drop the update and show
 * "Problem loading widget", not throw anything this app would ever see. The
 * adapter pattern requests each cell separately (small individual payloads)
 * and shares ONE PendingIntent template across every cell.
 */
public class CalendarWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new DayCellFactory(getApplicationContext(), intent);
    }

    private static class DayCellFactory implements RemoteViewsFactory {
        private static final String PREFS_NAME = "CapacitorStorage";
        private static final int CELL_COUNT = 42; // 6 weeks x 7 days

        private final Context context;
        private final int offset;

        private JSONObject days;
        private String todayStr;
        private int monthIdx0;
        private Calendar gridStart;

        DayCellFactory(Context context, Intent intent) {
            this.context = context;
            this.offset = intent.getIntExtra("offset", 0);
        }

        @Override
        public void onCreate() {
            onDataSetChanged();
        }

        @Override
        public void onDataSetChanged() {
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.MONTH, offset);
            int year = cal.get(Calendar.YEAR);
            monthIdx0 = cal.get(Calendar.MONTH);
            String monthKey = String.format(Locale.US, "%04d-%02d", year, monthIdx0 + 1);

            JSONObject monthData = null;
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String raw = prefs.getString("mindos_calendar_widget_" + monthKey, null);
                if (raw != null) monthData = new JSONObject(raw);
            } catch (Exception ignored) {
            }
            days = monthData != null ? monthData.optJSONObject("days") : null;
            todayStr = monthData != null ? monthData.optString("today", null) : null;
            if (todayStr == null) {
                Calendar now = Calendar.getInstance();
                todayStr = String.format(Locale.US, "%04d-%02d-%02d",
                        now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
            }

            // Monday-first grid start, matching the web app's month view and
            // CalendarWidgetProvider's now-removed hand-built version.
            Calendar grid = (Calendar) cal.clone();
            grid.set(Calendar.DAY_OF_MONTH, 1);
            int jsDow = grid.get(Calendar.DAY_OF_WEEK); // Sunday=1 .. Saturday=7
            int mondayFirstDow = (jsDow + 5) % 7; // Monday=0 .. Sunday=6
            grid.add(Calendar.DAY_OF_MONTH, -mondayFirstDow);
            gridStart = grid;
        }

        @Override
        public void onDestroy() {
        }

        @Override
        public int getCount() {
            return CELL_COUNT;
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.calendar_widget_day_cell);
            try {
                Calendar cell = (Calendar) gridStart.clone();
                cell.add(Calendar.DAY_OF_MONTH, position);
                int cellYear = cell.get(Calendar.YEAR);
                int cellMonth0 = cell.get(Calendar.MONTH);
                int dayNum = cell.get(Calendar.DAY_OF_MONTH);
                String cellDateStr = String.format(Locale.US, "%04d-%02d-%02d", cellYear, cellMonth0 + 1, dayNum);
                boolean inCurrentMonth = cellMonth0 == monthIdx0;
                boolean isToday = cellDateStr.equals(todayStr);

                views.setTextViewText(R.id.day_num, String.valueOf(dayNum));
                views.setTextColor(R.id.day_num, inCurrentMonth ? Color.parseColor("#E2E8F0") : Color.parseColor("#4B4863"));
                views.setInt(R.id.day_cell_root, "setBackgroundResource",
                        isToday ? R.drawable.widget_cal_cell_today : R.drawable.widget_cal_cell_bg);

                JSONObject dayInfo = (days != null && inCurrentMonth) ? days.optJSONObject(cellDateStr) : null;
                List<Integer> dotColors = CalendarWidgetProvider.dotColorsForDay(dayInfo);
                if (!dotColors.isEmpty() && inCurrentMonth) {
                    views.setViewVisibility(R.id.day_dots, View.VISIBLE);
                    views.setViewVisibility(R.id.day_dot_a, View.VISIBLE);
                    views.setInt(R.id.day_dot_a, "setBackgroundColor", dotColors.get(0));
                    if (dotColors.size() > 1) {
                        views.setViewVisibility(R.id.day_dot_b, View.VISIBLE);
                        views.setInt(R.id.day_dot_b, "setBackgroundColor", dotColors.get(1));
                    } else {
                        views.setViewVisibility(R.id.day_dot_b, View.GONE);
                    }
                } else {
                    views.setViewVisibility(R.id.day_dots, View.GONE);
                }

                // Merged into CalendarWidgetProvider's PendingIntent template
                // at click time (Intent.fillIn() -- extras always merge in,
                // regardless of the template's own action/data), so tapping
                // this cell opens the app on this exact date without this
                // cell needing its own PendingIntent.
                Intent fillIn = new Intent();
                fillIn.putExtra("date", cellDateStr);
                views.setOnClickFillInIntent(R.id.day_cell_root, fillIn);
            } catch (Exception e) {
                // Leave this one cell at its inflated defaults rather than
                // let a single bad entry take the whole grid down.
            }
            return views;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return true;
        }
    }
}
