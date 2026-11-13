package fr.jeuxlive

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import org.json.JSONArray
import java.util.Calendar

/** Horaires de live choisis dans l'appli : le téléphone sonne au début et à la fin de chaque créneau. */
object Horaires {
    const val EXTRA = "horaire"
    private const val CANAL = "horaires_live"

    fun lire(c: Context): String = c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).getString("horaires", "") ?: ""

    fun enregistrer(c: Context, json: String): String {
        try { JSONArray(json) } catch (e: Exception) { return "Horaires illisibles, rien n'a été enregistré." }
        c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).edit().putString("horaires", json).apply()
        val exact = programmer(c)
        val prochain = texteProchain(c)
        if (prochain.isEmpty()) return "Horaires enregistrés. Aucun créneau activé."
        if (!exact) {
            // Android demande une autorisation pour sonner à l'heure exacte : on ouvre le bon réglage.
            if (Build.VERSION.SDK_INT >= 31) try {
                c.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(android.net.Uri.parse("package:" + c.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e: Exception) { }
            return "$prochain\nPour sonner à l'heure exacte, autorise « Alarmes et rappels » pour Jeux Live dans la page qui s'ouvre, puis reviens et enregistre encore une fois."
        }
        return "Horaires enregistrés. $prochain"
    }

    /** Prochain moment (début ou fin) parmi tous les créneaux actifs. */
    private fun prochain(c: Context): Pair<Long, String>? {
        val tab = try { JSONArray(lire(c)) } catch (e: Exception) { return null }
        var meilleur: Pair<Long, String>? = null
        val maintenant = System.currentTimeMillis()
        for (i in 0 until tab.length()) {
            val o = tab.optJSONObject(i) ?: continue
            if (!o.optBoolean("actif")) continue
            val jours = o.optJSONArray("jours") ?: continue
            for ((cle, type) in listOf("debut" to "debut", "fin" to "fin")) {
                val hm = o.optString(cle, "").split(":")
                if (hm.size != 2) continue
                val h = hm[0].toIntOrNull() ?: continue
                val m = hm[1].toIntOrNull() ?: continue
                for (d in 0..7) {
                    val cal = Calendar.getInstance()
                    cal.add(Calendar.DAY_OF_YEAR, d)
                    cal.set(Calendar.HOUR_OF_DAY, h); cal.set(Calendar.MINUTE, m); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
                    // Calendar : dimanche = 1 … samedi = 7 ; nos jours : lundi = 0 … dimanche = 6
                    var jour = cal.get(Calendar.DAY_OF_WEEK) - 2
                    if (jour < 0) jour = 6
                    // Un créneau qui finit après minuit se rattache au jour de son début
                    var jourCreneau = jour
                    if (type == "fin") {
                        val debut = o.optString("debut", "00:00")
                        if (o.optString("fin") < debut) jourCreneau = if (jour == 0) 6 else jour - 1
                    }
                    if (jours.optInt(jourCreneau) != 1) continue
                    if (cal.timeInMillis <= maintenant + 5_000) continue
                    if (meilleur == null || cal.timeInMillis < meilleur.first) meilleur = cal.timeInMillis to type
                    break
                }
            }
        }
        return meilleur
    }

    fun texteProchain(c: Context): String {
        val p = prochain(c) ?: return ""
        val cal = Calendar.getInstance().apply { timeInMillis = p.first }
        val jours = arrayOf("dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi")
        val quand = "%s à %02dh%02d".format(jours[cal.get(Calendar.DAY_OF_WEEK) - 1], cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
        return if (p.second == "debut") "Prochain live : $quand." else "Fin du créneau en cours : $quand."
    }

    /** Programme la prochaine sonnerie. Renvoie false si l'heure exacte n'est pas autorisée. */
    fun programmer(c: Context): Boolean {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(c, 7, Intent(c, RecepteurHoraire::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        am.cancel(pi)
        val p = prochain(c) ?: return true
        val intention = Intent(c, RecepteurHoraire::class.java).putExtra(EXTRA, p.second)
        val pi2 = PendingIntent.getBroadcast(c, 7, intention, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        try {
            if (exact) {
                val ouvrir = PendingIntent.getActivity(c, 8, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
                am.setAlarmClock(AlarmManager.AlarmClockInfo(p.first, ouvrir), pi2)
            } else if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, p.first, pi2)
            else am.set(AlarmManager.RTC_WAKEUP, p.first, pi2)
        } catch (e: SecurityException) {
            am.set(AlarmManager.RTC_WAKEUP, p.first, pi2)
            return false
        }
        return exact
    }

    fun notifier(c: Context, type: String) {
        val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val canal = NotificationChannel(CANAL, "Horaires de live", NotificationManager.IMPORTANCE_HIGH)
            canal.description = "Te prévient au début et à la fin de tes créneaux de live"
            nm.createNotificationChannel(canal)
        }
        val ouvrir = Intent(c, MainActivity::class.java).putExtra(EXTRA, type).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(c, if (type == "debut") 1 else 2, ouvrir, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val titre = if (type == "debut") "C'est l'heure de ton live !" else "Fin de ton créneau de live"
        val texte = if (type == "debut") "Touche ici : le jeu s'ouvre, puis démarre ton live dans TikTok." else "Pense à couper ton live dans TikTok."
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(c, CANAL) else android.app.Notification.Builder(c).setPriority(android.app.Notification.PRIORITY_HIGH).setDefaults(android.app.Notification.DEFAULT_ALL)
        val n = b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(titre).setContentText(texte)
            .setStyle(android.app.Notification.BigTextStyle().bigText(texte)).setContentIntent(pi).setAutoCancel(true).build()
        try { nm.notify(if (type == "debut") 1 else 2, n) } catch (e: SecurityException) { }
    }
}

class RecepteurHoraire : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val type = i.getStringExtra(Horaires.EXTRA) ?: "debut"
        Horaires.notifier(c, type)
        Horaires.programmer(c)
    }
}

class RecepteurDemarrage : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) { Horaires.programmer(c) }
}
