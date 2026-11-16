package fr.heuressup

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import org.json.JSONArray
import org.json.JSONObject

/** Rappels de l'alarme APJ avec vibration, calculés par l'appli d'après le planning. Un seul réveil est programmé à la fois : le prochain. */
object Alarmes {
    const val CANAL = "alarme_apj"
    private const val CLE = "alarmes"

    private fun intention(c: Context): PendingIntent =
        PendingIntent.getBroadcast(c, 22, Intent(c, RecepteurAlarme::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun enregistrer(c: Context, json: String) {
        val liste = try { JSONArray(json) } catch (e: Exception) { JSONArray() }
        c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).edit().putString(CLE, liste.toString()).apply()
        programmer(c)
    }

    private fun liste(c: Context): JSONArray =
        try { JSONArray(c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getString(CLE, "[]")) } catch (e: Exception) { JSONArray() }

    /** Programme le prochain rappel futur de la liste (ou annule s'il n'y en a plus). */
    fun programmer(c: Context) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val l = liste(c); val maintenant = System.currentTimeMillis(); var prochain = Long.MAX_VALUE
        for (i in 0 until l.length()) { val t = l.getJSONObject(i).optLong("t"); if (t > maintenant && t < prochain) prochain = t }
        if (prochain == Long.MAX_VALUE) { am.cancel(intention(c)); return }
        try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, prochain, intention(c)) }
        catch (e: SecurityException) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, prochain, intention(c)) }
    }

    /** Prévient pour tous les rappels arrivés à l'heure (à 2 minutes près), puis programme le suivant. */
    fun declencher(c: Context) {
        val l = liste(c); val maintenant = System.currentTimeMillis(); var n = 0
        for (i in 0 until l.length()) {
            val o: JSONObject = l.getJSONObject(i); val t = o.optLong("t")
            if (t <= maintenant + 60_000 && t > maintenant - 5 * 60_000) { notifier(c, 100 + n, o.optString("titre"), o.optString("texte")); n++ }
        }
        if (n > 0) vibrer(c)
        programmer(c)
    }

    private fun notifier(c: Context, id: Int, titre: String, texte: String) {
        val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CANAL, "Alarme APJ", NotificationManager.IMPORTANCE_HIGH)
            ch.enableVibration(true); ch.vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 800)
            nm.createNotificationChannel(ch)
        }
        val ouvrir = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, CANAL) else @Suppress("DEPRECATION") Notification.Builder(c)
        b.setSmallIcon(R.drawable.ic_avant).setContentTitle(titre).setContentText(texte)
            .setStyle(Notification.BigTextStyle().bigText(texte)).setContentIntent(ouvrir).setAutoCancel(true)
        try { nm.notify(id, b.build()) } catch (e: SecurityException) { }
    }

    @Suppress("DEPRECATION")
    private fun vibrer(c: Context) {
        try {
            val v = c.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val motif = longArrayOf(0, 500, 250, 500, 250, 800)
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(motif, -1)) else v.vibrate(motif, -1)
        } catch (e: Exception) { }
    }
}

class RecepteurAlarme : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Alarmes.declencher(c) }
}
