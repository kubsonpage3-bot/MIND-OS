package com.mindos.app;

import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Backs the Upcoming widget's ListView with a real, scrollable adapter --
 * see UpcomingWidgetProvider's class doc for why an adapter is safe here
 * even though one broke the Calendar month grid before (different root
 * cause, doesn't apply to this widget's plain TextView/ImageView rows).
 */
public class UpcomingWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        return new Factory(getApplicationContext(), appWidgetId);
    }

    private static final class Factory implements RemoteViewsFactory {
        private final android.content.Context context;
        private final int appWidgetId;
        // Each entry is either a String (day-group header label) or an
        // UpcomingWidgetProvider.Row (a real deadline/event).
        private final List<Object> rows = new ArrayList<>();

        Factory(android.content.Context context, int appWidgetId) {
            this.context = context;
            this.appWidgetId = appWidgetId;
        }

        @Override
        public void onCreate() {
            onDataSetChanged();
        }

        @Override
        public void onDataSetChanged() {
            rows.clear();
            List<UpcomingWidgetProvider.Row> items = UpcomingWidgetProvider.buildUpcomingItems(context);
            String lastGroup = null;
            for (UpcomingWidgetProvider.Row item : items) {
                if (!item.dayGroupLabel.equals(lastGroup)) {
                    rows.add(item.dayGroupLabel);
                    lastGroup = item.dayGroupLabel;
                }
                rows.add(item);
            }
        }

        @Override
        public void onDestroy() {
            rows.clear();
        }

        @Override
        public int getCount() {
            return rows.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            Object row = rows.get(position);
            if (row instanceof String) {
                RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.upcoming_list_header);
                views.setTextViewText(R.id.header_label, ((String) row).toUpperCase(Locale.getDefault()));
                return views;
            }

            UpcomingWidgetProvider.Row item = (UpcomingWidgetProvider.Row) row;
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.upcoming_list_item);
            views.setTextViewText(R.id.item_title, item.title);
            views.setTextViewText(R.id.item_time, item.timeLabel);
            try {
                views.setInt(R.id.item_accent, "setBackgroundColor", Color.parseColor(item.colorHex));
            } catch (Exception ignored) {
            }

            // Fill-in intent: merges into the ListView's PendingIntentTemplate at
            // click time. A unique data Uri per row is what makes Android treat
            // each row's launch as distinct (extras alone aren't enough here).
            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("date", item.dateStr);
            fillInIntent.setData(Uri.parse("mindos://upcoming/" + appWidgetId + "/item/" + position));
            views.setOnClickFillInIntent(R.id.item_title, fillInIntent);

            return views;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 2;
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
