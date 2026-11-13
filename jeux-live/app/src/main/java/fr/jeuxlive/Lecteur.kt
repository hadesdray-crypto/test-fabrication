package fr.jeuxlive

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.ByteArrayInputStream

/**
 * Lit les messages du live (cadeaux, likes, commentaires) en ouvrant la page publique du live TikTok
 * dans une vue cachée, comme un simple spectateur non connecté. Rien n'est envoyé à TikTok.
 * La vidéo du live est bloquée pour ne pas consommer de données inutilement.
 */
@SuppressLint("SetJavaScriptEnabled")
class Lecteur(private val activite: Activity, private val sortie: (String, String) -> Unit) {
    val vue = WebView(activite)
    private val principal = Handler(Looper.getMainLooper())
    private val script: String = listOf("inflate.js", "decodeur.js", "crochets.js").joinToString("\n;\n") {
        activite.assets.open("lecteur/$it").bufferedReader().use { r -> r.readText() }
    }
    private var pseudo = ""
    private var actif = false
    private var chargeA = 0L
    private var derniereTrame = 0L
    private var derniersEvenements = 0
    private var injectionAuDebut = false
    private var erreurReseau = false

    init {
        val s = vue.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = true
        s.blockNetworkImage = true
        s.userAgentString = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        s.useWideViewPort = true
        s.loadWithOverviewMode = true
        vue.addJavascriptInterface(Recepteur(), "JeuxLiveNatif")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(vue, script, setOf("https://www.tiktok.com", "https://*.tiktok.com"))
                injectionAuDebut = true
            } catch (e: Exception) { Log.w(MainActivity.ETIQUETTE, "injection au début impossible : $e") }
        }
        vue.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean = true
        }
        vue.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                val u = req.url.toString()
                if (Regex("""\.(flv|m3u8|ts|mp4|m4s|webm)(\?|$)""").containsMatchIn(u) || u.contains("pull-") && (u.contains(".flv") || u.contains(".m3u8"))) {
                    return WebResourceResponse("text/plain", "utf-8", 204, "Bloqué", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                return null
            }
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (!injectionAuDebut) view.evaluateJavascript(script, null)
            }
            override fun onPageFinished(view: WebView, url: String) {
                if (!injectionAuDebut) view.evaluateJavascript(script, null)
            }
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) {
                    erreurReseau = true
                    etat("ko", "pas de connexion à TikTok", "Vérifie Internet (Wi-Fi ou données). La lecture réessaie toute seule.")
                }
            }
        }
    }

    fun demarrer(nom: String) {
        pseudo = nom.trim().removePrefix("@")
        if (pseudo.isEmpty()) return
        actif = true
        derniereTrame = 0
        derniersEvenements = 0
        charger()
        principal.removeCallbacks(surveillance)
        principal.postDelayed(surveillance, 20_000)
    }

    fun arreter() {
        actif = false
        principal.removeCallbacks(surveillance)
        vue.loadUrl("about:blank")
        etat("att", "arrêtée", "")
    }

    private fun charger() {
        erreurReseau = false
        chargeA = System.currentTimeMillis()
        etat("att", "connexion à ton live…", "Page lue : @$pseudo")
        vue.loadUrl("https://www.tiktok.com/@$pseudo/live")
    }

    /** Toutes les 20 s : si rien n'arrive depuis un moment, on recharge la page (le live a peut-être démarré entre-temps). */
    private val surveillance = object : Runnable {
        override fun run() {
            if (!actif) return
            val maintenant = System.currentTimeMillis()
            val depuisChargement = maintenant - chargeA
            val silence = if (derniereTrame == 0L) depuisChargement else maintenant - derniereTrame
            if ((derniereTrame == 0L && depuisChargement > 45_000) || silence > 90_000 || (erreurReseau && depuisChargement > 15_000)) {
                charger()
            }
            principal.postDelayed(this, 20_000)
        }
    }

    private fun etat(niveau: String, titre: String, detail: String) {
        val o = JSONObject().put("niveau", niveau).put("titre", titre).put("detail", detail)
        sortie("etatLecture", o.toString())
    }

    inner class Recepteur {
        @JavascriptInterface fun evenement(json: String) {
            derniereTrame = System.currentTimeMillis()
            sortie("evenement", json)
        }
        @JavascriptInterface fun etat(json: String) {
            try {
                val o = JSONObject(json)
                val trames = o.optInt("trames"); val evs = o.optInt("evenements")
                if (trames > 0) derniereTrame = maxOf(derniereTrame, System.currentTimeMillis() - 1000)
                when {
                    evs > 0 -> { derniersEvenements = evs; this@Lecteur.etat("ok", "ok", "$evs messages lus depuis le début (cadeaux, likes, commentaires, arrivées).") }
                    trames > 0 -> this@Lecteur.etat("ok", "ok", "Connecté à ton live. En attente des premiers cadeaux ou commentaires.")
                    else -> this@Lecteur.etat("att", "en attente de ton live", "Si ton live n'est pas encore démarré, c'est normal. Sinon vérifie ton nom TikTok (@$pseudo).")
                }
            } catch (e: Exception) { }
        }
    }
}
