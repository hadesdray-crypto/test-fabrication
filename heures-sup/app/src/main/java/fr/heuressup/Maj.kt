package fr.heuressup

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Mise à jour directement dans l'application : liste des changements, validation, chargement visible. */
object Maj {
    const val ADRESSE_VERSION = "https://raw.githubusercontent.com/hadesdray-crypto/test-fabrication/main/heures-sup/version.json"
    private var info: JSONObject? = null
    @Volatile private var occupe = false

    private fun js(a: MainActivity, f: String, arg: String) = a.appelerJs("App.$f(${JSONObject.quote(arg)})")

    fun chercher(a: MainActivity) {
        Thread {
            val texte = lireTexte(ADRESSE_VERSION + "?t=" + System.currentTimeMillis())
            val r = JSONObject()
            if (texte == null) r.put("erreur", "Impossible de joindre le serveur. Vérifie Internet puis réessaie.")
            else try {
                val o = JSONObject(texte)
                info = o
                r.put("nom", if (o.optInt("code") > BuildConfig.VERSION_CODE) o.optString("nom") else BuildConfig.VERSION_NAME)
                r.put("nouvelle", o.optInt("code") > BuildConfig.VERSION_CODE)
                r.put("changes", o.optJSONArray("changes") ?: JSONArray())
            } catch (e: Exception) { r.put("erreur", "Le fichier de version est illisible. Réessaie plus tard.") }
            js(a, "resultatMaj", r.toString())
        }.start()
    }

    fun installer(a: MainActivity) {
        val i = info ?: return
        if (occupe) return
        if (Build.VERSION.SDK_INT >= 26 && !a.packageManager.canRequestPackageInstalls()) {
            js(a, "messageMaj", "Android demande ton accord : autorise « Heures sup » dans la page qui s'ouvre, reviens, puis touche encore « Mettre à jour maintenant ».")
            a.runOnUiThread { try { a.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.packageName))) } catch (e: Exception) { } }
            return
        }
        occupe = true
        Thread {
            val dossier = File(a.filesDir, "maj")
            val partiel = File(dossier, "nouvelle.apk.part")
            val err = telecharger(i.optString("apk"), partiel) { p -> a.appelerJs("App.progresMaj($p)") }
            if (err != null) { occupe = false; js(a, "messageMaj", err); return@Thread }
            val attendu = i.optString("sha256", "").lowercase()
            if (attendu.isNotEmpty() && sha256(partiel) != attendu) {
                partiel.delete(); occupe = false
                js(a, "messageMaj", "Le fichier reçu est abîmé. Touche « Mettre à jour maintenant » pour recommencer.")
                return@Thread
            }
            val final = File(dossier, "nouvelle.apk"); final.delete(); partiel.renameTo(final)
            val r = installerApk(a, final)
            occupe = false
            js(a, "messageMaj", r ?: "Valide l'installation dans la fenêtre d'Android.")
        }.start()
    }

    private fun lireTexte(url: String): String? = try {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 10_000; c.readTimeout = 15_000
        val t = if (c.responseCode in 200..299) c.inputStream.bufferedReader().use { it.readText() } else null
        c.disconnect(); t
    } catch (e: Exception) { null }

    private fun telecharger(url: String, partiel: File, progres: (Int) -> Unit): String? = try {
        partiel.parentFile?.mkdirs()
        var deja = if (partiel.exists()) partiel.length() else 0L
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000; c.readTimeout = 30_000; c.instanceFollowRedirects = true
        if (deja > 0) c.setRequestProperty("Range", "bytes=$deja-")
        val code = c.responseCode
        if (code != 200 && code != 206) { c.disconnect(); "Le serveur a répondu $code. Réessaie plus tard." }
        else {
            if (code == 200) deja = 0L
            val total = c.contentLengthLong.let { if (it > 0) it + deja else -1L }
            var dernier = -1
            FileOutputStream(partiel, code == 206).use { out ->
                c.inputStream.use { ins ->
                    val tampon = ByteArray(64 * 1024); var fait = deja; var n = ins.read(tampon)
                    while (n > 0) {
                        out.write(tampon, 0, n); fait += n
                        if (total > 0) { val p = (100 * fait / total).toInt(); if (p != dernier) { dernier = p; progres(p) } }
                        n = ins.read(tampon)
                    }
                }
            }
            c.disconnect(); null
        }
    } catch (e: Exception) { "Connexion interrompue. Touche « Mettre à jour maintenant » : le chargement reprendra où il s'était arrêté." }

    private fun sha256(f: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { s -> val t = ByteArray(64 * 1024); var n = s.read(t); while (n > 0) { md.update(t, 0, n); n = s.read(t) } }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private fun installerApk(c: Context, apk: File): String? = try {
        val pi = c.packageManager.packageInstaller
        val id = pi.createSession(PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL))
        pi.openSession(id).use { s ->
            apk.inputStream().use { ins -> s.openWrite("heuressup.apk", 0, apk.length()).use { out -> ins.copyTo(out); s.fsync(out) } }
            val drapeau = if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
            val pend = PendingIntent.getBroadcast(c, id, Intent(c, RecepteurInstall::class.java).setPackage(c.packageName), drapeau or PendingIntent.FLAG_UPDATE_CURRENT)
            s.commit(pend.intentSender)
        }
        null
    } catch (e: Exception) { "Installation impossible : ${e.message}" }
}

/** Reçoit la réponse de l'installateur Android et ouvre sa fenêtre de validation. */
class RecepteurInstall : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.getIntExtra(PackageInstaller.EXTRA_STATUS, -1) == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION")
            val conf = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else i.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            if (conf != null) { conf.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(conf) }
        }
    }
}
