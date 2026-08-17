package com.yonatan.tapconnect

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * Optional 1x1 home-screen widget. Same behaviour as the app icon — it just looks like a button
 * and can carry a label next to it.
 */
class ConnectWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val tap = PendingIntent.getActivity(
            context,
            0,
            Intent(context, ConnectActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val label = Prefs.savedName(context) ?: context.getString(R.string.default_device_label)

        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_connect).apply {
                setTextViewText(R.id.widget_label, label)
                setOnClickPendingIntent(R.id.widget_root, tap)
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
