package fr.heuressup

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognizerIntent
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {
    lateinit var vue: WebView
    private val principal = Handler(Looper.getMainLooper())
    private var pageChargee = false
    private val enAttente = ArrayList<String>()
    private var choixFichier: android.webkit.ValueCallback<Array<Uri>>? = null
    private var photoUri: Uri? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vue = WebView(this)
        vue.settings.javaScriptEnabled = true
        vue.settings.domStorageEnabled = true
        vue.setBackgroundColor(0xFFFFFFFF.toInt())
        vue.addJavascriptInterface(Pont(), "Natif")
        vue.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView, cb: android.webkit.ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                choixFichier?.onReceiveValue(null); choixFichier = cb
                // Tous les fichiers sont proposés (images, PDF, textes…) ; l'appareil photo en plus.
                val galerie = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                val choix = Intent.createChooser(galerie, "Choisir un fichier ou prendre une photo")
                photoUri = null
                try {
                    val dossier = File(cacheDir, "photos"); dossier.mkdirs()
                    val f = File(dossier, "photo.jpg"); if (f.exists()) f.delete()
                    photoUri = FileProvider.getUriForFile(this@MainActivity, "fr.heuressup.fichiers", f)
                    val cam = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).putExtra(android.provider.MediaStore.EXTRA_OUTPUT, photoUri).addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    choix.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cam))
                } catch (e: Exception) { photoUri = null }
                try { @Suppress("DEPRECATION") startActivityForResult(choix, CODE_PHOTO) }
                catch (e: Exception) {
                    // Secours : sélecteur de documents d'Android
                    try { @Suppress("DEPRECATION") startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), CODE_PHOTO) }
                    catch (e2: Exception) { choixFichier = null; cb.onReceiveValue(null); return false }
                }
                return true
            }
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                val t = m.message() ?: ""
                if (t.startsWith("AUTOTEST") || m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.i(ETIQUETTE, "page: $t (${m.sourceId()}:${m.lineNumber()})")
                return true
            }
        }
        val chargeur = androidx.webkit.WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(this)).build()
        vue.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, req: android.webkit.WebResourceRequest): android.webkit.WebResourceResponse? =
                chargeur.shouldInterceptRequest(req.url)
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean { recreate(); return true }
            override fun onPageFinished(view: WebView, url: String) {
                pageChargee = true
                for (s in enAttente) vue.evaluateJavascript(s, null)
                enAttente.clear()
            }
        }
        setContentView(vue)
        vue.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        demanderNotifications()
        Rappel.programmer(this)
        traiterIntention(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        traiterIntention(intent)
    }

    private fun traiterIntention(i: Intent?) {
        if (i?.getBooleanExtra("autotest", false) == true) {
            i.removeExtra("autotest")
            val script = assets.open("web/autotest.js").bufferedReader().use { it.readText() }
            appelerJs(script)
        }
    }

    fun appelerJs(script: String) {
        principal.post { if (pageChargee) vue.evaluateJavascript(script, null) else enAttente.add(script) }
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

    @Deprecated("Retour Android : revient en arrière dans l'appli")
    override fun onBackPressed() {
        vue.evaluateJavascript("App.retour()") { r ->
            if (r != "true") {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    @Deprecated("Résultat de la dictée")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == CODE_PHOTO) {
            val photo = File(File(cacheDir, "photos"), "photo.jpg")
            val u: Uri? = if (resultCode != RESULT_OK) null else (data?.data ?: if (photo.exists() && photo.length() > 0) photoUri else null)
            choixFichier?.onReceiveValue(if (u != null) arrayOf(u) else null); choixFichier = null; return
        }
        if (requestCode != CODE_DICTEE) return
        val liste = if (resultCode == RESULT_OK) data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) else null
        if (liste.isNullOrEmpty()) appelerJs("App.dicteeErreur('Rien entendu. Touche « Dicter » et parle plus près du téléphone.')")
        else appelerJs("App.dictee(${JSONObject.quote(liste[0])})")
    }

    inner class Pont {
        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface fun dicter() {
            principal.post {
                val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR")
                    .putExtra(RecognizerIntent.EXTRA_PROMPT, "Dis tes heures")
                try { @Suppress("DEPRECATION") startActivityForResult(i, CODE_DICTEE) }
                catch (e: ActivityNotFoundException) { appelerJs("App.dicteeErreur('La dictée n\\'est pas disponible sur ce téléphone. Écris la phrase dans la case, ou utilise le micro du clavier.')") }
            }
        }

        /** Enregistre la feuille en fichier PDF puis ouvre la messagerie avec la feuille en pièce jointe. Rien ne part sans ta validation. */
        @JavascriptInterface fun partager(base64: String, nom: String, sujet: String, texte: String, adresse: String): String {
            return try {
                val dossier = File(cacheDir, "feuilles"); dossier.mkdirs()
                val f = File(dossier, nom.replace(Regex("[^A-Za-z0-9_.-]"), "_"))
                f.writeBytes(Base64.decode(base64, Base64.DEFAULT))
                val uri = FileProvider.getUriForFile(this@MainActivity, "fr.heuressup.fichiers", f)
                val i = Intent(Intent.ACTION_SEND).setType("application/pdf")
                    .putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_SUBJECT, sujet).putExtra(Intent.EXTRA_TEXT, texte)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (adresse.isNotBlank()) i.putExtra(Intent.EXTRA_EMAIL, arrayOf(adresse))
                principal.post { startActivity(Intent.createChooser(i, "Envoyer la feuille").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) }
                "ok"
            } catch (e: Exception) { "Envoi impossible : ${e.message}" }
        }

        @JavascriptInterface fun alarmes(json: String) { Alarmes.enregistrer(this@MainActivity, json) }
        @JavascriptInterface fun rappel(actif: Boolean) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("rappel", actif).apply()
            Rappel.programmer(this@MainActivity)
        }
        @JavascriptInterface fun chercherMaj(): Boolean { Maj.chercher(this@MainActivity); return true }
        @JavascriptInterface fun installerMaj() { Maj.installer(this@MainActivity) }
        @JavascriptInterface fun signaler(page: String): Boolean {
            if (ADRESSE_SIGNALEMENT.isBlank()) return false
            principal.post {
                try {
                    startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$ADRESSE_SIGNALEMENT")).putExtra(Intent.EXTRA_SUBJECT, "Heures sup ${BuildConfig.VERSION_NAME} : erreur sur $page"))
                } catch (e: Exception) { }
            }
            return true
        }
        @JavascriptInterface fun rapport(texte: String) { Log.i(ETIQUETTE, texte) }

        /** PDF (base64) -> image JPEG des 3 premières pages, l'une sous l'autre. Vide si impossible. */
        @JavascriptInterface fun pdfEnImage(base64: String): String = Papier.pdfEnImage(this@MainActivity, base64)

        /** Lit le texte d'une photo de feuille (sur le téléphone, sans Internet). Réponse : App.feuilleLue(json). */
        @JavascriptInterface fun lireFeuille(dataUrl: String) { Papier.lire(this@MainActivity, dataUrl) }
    }

    companion object {
        const val ETIQUETTE = "HEURESSUP"
        const val PREFS = "heuressup"
        const val CODE_DICTEE = 42
        const val CODE_PHOTO = 43
        /** Adresse de signalement des erreurs : à compléter plus tard. */
        const val ADRESSE_SIGNALEMENT = ""
    }
}
