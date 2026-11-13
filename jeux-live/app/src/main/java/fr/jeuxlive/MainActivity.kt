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
    private lateinit var cadre: FrameLayout
    private var panneau: android.widget.LinearLayout? = null
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
        this.cadre = cadre
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
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                Log.w(ETIQUETTE, "jeu : moteur de page arrêté, redémarrage de l'appli")
                recreate()
                return true
            }
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
            val compte = i.getStringExtra("compte_test") ?: ""
            appelerJs("window.__compteTest=${JSONObject.quote(compte)};\n$script")
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

    /** Affiche la page de connexion TikTok en plein écran, avec un bouton pour revenir. */
    private fun montrerConnexion() {
        if (panneau != null) return
        val p = android.widget.LinearLayout(this)
        p.orientation = android.widget.LinearLayout.VERTICAL
        p.setBackgroundColor(0xFF0B1020.toInt())
        val texte = android.widget.TextView(this)
        texte.text = "Connecte-toi à TikTok ci-dessous (ton compte ou un deuxième compte). Tape toi-même ton mot de passe : l'appli ne le lit pas. Ensuite touche le bouton vert."
        texte.setTextColor(0xFFFFFFFF.toInt()); texte.textSize = 15f; texte.setPadding(24, 24, 24, 12)
        val bouton = android.widget.Button(this)
        bouton.text = "J'ai fini, revenir à l'appli"
        bouton.setBackgroundColor(0xFF16A34A.toInt()); bouton.setTextColor(0xFFFFFFFF.toInt()); bouton.textSize = 18f
        bouton.setOnClickListener { cacherConnexion() }
        p.addView(texte); p.addView(bouton, android.widget.LinearLayout.LayoutParams(-1, -2))
        cadre.removeView(lecteur.vue)
        p.addView(lecteur.vue, android.widget.LinearLayout.LayoutParams(-1, 0, 1f))
        cadre.addView(p, FrameLayout.LayoutParams(-1, -1))
        panneau = p
        lecteur.ouvrirConnexion()
    }
    private fun cacherConnexion() {
        val p = panneau ?: return
        p.removeView(lecteur.vue)
        cadre.removeView(p)
        cadre.addView(lecteur.vue, 0, FrameLayout.LayoutParams(2, 2))
        panneau = null
        lecteur.fermerConnexion()
        appelerJs("App.majConnexion()")
    }

    @Deprecated("Gestion simple du bouton retour")
    override fun onBackPressed() {
        if (panneau != null) { if (lecteur.vue.canGoBack()) lecteur.vue.goBack() else cacherConnexion(); return }
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
            // On cache seulement la barre du haut (heure, batterie) : pas de fenêtre « plein écran » d'Android sur le live,
            // et les boutons du téléphone (dont « retour ») restent utilisables.
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
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
        @JavascriptInterface fun connexionTikTok() { principal.post { montrerConnexion() } }
        @JavascriptInterface fun estConnecte(): Boolean = lecteur.estConnecte()
        @JavascriptInterface fun deconnecterTikTok() { principal.post { lecteur.deconnecter() } }
    }

    companion object {
        const val ETIQUETTE = "JEUXLIVE"
        const val PREFS = "jeuxlive"
        /** Adresse de signalement des erreurs : à compléter plus tard. */
        const val ADRESSE_SIGNALEMENT = ""
    }
}
