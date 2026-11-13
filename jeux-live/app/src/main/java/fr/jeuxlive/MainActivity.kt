package fr.jeuxlive

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import org.json.JSONObject

class MainActivity : Activity() {
    lateinit var jeu: WebView
    lateinit var lecteur: Lecteur
    private val principal = Handler(Looper.getMainLooper())
    private var pageChargee = false
    private val enAttente = ArrayList<String>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val cadre = FrameLayout(this)
        lecteur = Lecteur(this) { fonction, json -> appelerJs("App.$fonction(${JSONObject.quote(json)})") }
        // Le lecteur est une petite vue invisible derrière le jeu : il lit le live sans rien afficher.
        cadre.addView(lecteur.vue, FrameLayout.LayoutParams(2, 2))
        jeu = WebView(this)
        jeu.settings.javaScriptEnabled = true
        jeu.settings.domStorageEnabled = true
        jeu.settings.mediaPlaybackRequiresUserGesture = false
        jeu.settings.allowFileAccess = true
        jeu.setBackgroundColor(0xFF0B1020.toInt())
        jeu.addJavascriptInterface(Pont(), "Natif")
        jeu.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                val t = m.message() ?: ""
                if (t.startsWith("JLERR") || t.startsWith("AUTOTEST") || m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.i(ETIQUETTE, "jeu: $t (${m.sourceId()}:${m.lineNumber()})")
                return true
            }
        }
        jeu.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                pageChargee = true
                for (s in enAttente) jeu.evaluateJavascript(s, null)
                enAttente.clear()
            }
        }
        cadre.addView(jeu, FrameLayout.LayoutParams(-1, -1))
        setContentView(cadre)
        jeu.loadUrl("file:///android_asset/web/index.html")
        demanderNotifications()
        Horaires.programmer(this)
        traiterIntention(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        traiterIntention(intent)
    }

    private fun traiterIntention(i: Intent?) {
        when (i?.getStringExtra(Horaires.EXTRA)) {
            "debut" -> appelerJs("App.ouvertParHoraire()")
            "fin" -> appelerJs("App.finHoraire()")
        }
        i?.removeExtra(Horaires.EXTRA)
        if (i?.getBooleanExtra("autotest", false) == true) {
            i.removeExtra("autotest")
            val script = assets.open("web/autotest.js").bufferedReader().use { it.readText() }
            appelerJs(script)
            val compte = i.getStringExtra("compte_test")
            if (!compte.isNullOrBlank()) lecteur.demarrer(compte)
        }
    }

    fun appelerJs(script: String) {
        principal.post {
            if (pageChargee) jeu.evaluateJavascript(script, null) else enAttente.add(script)
        }
    }

    private fun demanderNotifications() {
        if (Build.VERSION.SDK_INT >= 33) {
            val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
            if (!prefs.getBoolean("notif_demandee", false) && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                prefs.edit().putBoolean("notif_demandee", true).apply()
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            }
        }
    }

    @Deprecated("Gestion simple du bouton retour")
    override fun onBackPressed() {
        jeu.evaluateJavascript("App.retour()") { r ->
            if (r != "true") {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    private fun pleinEcran(oui: Boolean) {
        if (oui) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    override fun onDestroy() {
        lecteur.arreter()
        super.onDestroy()
    }

    /** Fonctions appelées depuis les écrans de l'application. */
    inner class Pont {
        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
        @JavascriptInterface fun demarrerLecture(pseudo: String) { principal.post { lecteur.demarrer(pseudo) } }
        @JavascriptInterface fun arreterLecture() { principal.post { lecteur.arreter() } }
        @JavascriptInterface fun pleinEcran(oui: Boolean) { principal.post { this@MainActivity.pleinEcran(oui) } }
        @JavascriptInterface fun ouvrirTikTok(): String {
            for (p in listOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill")) {
                val i = packageManager.getLaunchIntentForPackage(p)
                if (i != null) { principal.post { startActivity(i) }; return "oui" }
            }
            return "non"
        }
        @JavascriptInterface fun horaires(json: String): String = Horaires.enregistrer(this@MainActivity, json)
        @JavascriptInterface fun lireHoraires(): String = Horaires.lire(this@MainActivity)
        @JavascriptInterface fun prochainHoraire(): String = Horaires.texteProchain(this@MainActivity)
        @JavascriptInterface fun chercherMaj(): Boolean { Maj.chercher(this@MainActivity); return true }
        @JavascriptInterface fun installerMaj() { Maj.installer(this@MainActivity) }
        @JavascriptInterface fun signaler(page: String): Boolean {
            if (ADRESSE_SIGNALEMENT.isBlank()) return false
            principal.post {
                try {
                    startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$ADRESSE_SIGNALEMENT")).putExtra(Intent.EXTRA_SUBJECT, "Jeux Live ${BuildConfig.VERSION_NAME} : erreur sur $page"))
                } catch (e: Exception) { }
            }
            return true
        }
        @JavascriptInterface fun rapport(texte: String) { Log.i(ETIQUETTE, texte) }
    }

    companion object {
        const val ETIQUETTE = "JEUXLIVE"
        const val PREFS = "jeuxlive"
        /** Adresse de signalement des erreurs : à compléter plus tard. */
        const val ADRESSE_SIGNALEMENT = ""
    }
}
