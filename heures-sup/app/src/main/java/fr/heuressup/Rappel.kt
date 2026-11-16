package fr.heuressup

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/** Rappel le 14 de chaque mois à 9 h : la feuille doit partir avant le 15. */
object Rappel {
    const val CANAL = "rappel"

    private fun intention(c: Context): PendingIntent =
        PendingIntent.getBroadcast(c, 14, Intent(c, RecepteurRappel::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun programmer(c: Context) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val actif = c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getBoolean("rappel", true)
        if (!actif) { am.cancel(intention(c)); return }
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 14); cal.set(Calendar.HOUR_OF_DAY, 9); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= System.currentTimeMillis()) { cal.add(Calendar.MONTH, 1); cal.set(Calendar.DAY_OF_MONTH, 14) }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, intention(c))
    }

    fun notifier(c: Context) {
        val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CANAL, "Rappel d'envoi", NotificationManager.IMPORTANCE_DEFAULT))
        val ouvrir = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val b = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(c, CANAL) else @Suppress("DEPRECATION") android.app.Notification.Builder(c)
        b.setSmallIcon(R.drawable.ic_avant).setContentTitle("Heures supplémentaires")
            .setContentText("Avant demain soir (le 15) : envoie ta feuille à ton patron.")
            .setContentIntent(ouvrir).setAutoCancel(true)
        try { nm.notify(14, b.build()) } catch (e: SecurityException) { }
    }
}

class RecepteurRappel : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Rappel.notifier(c); Rappel.programmer(c) }
}

class RecepteurDemarrage : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Rappel.programmer(c) }
}
