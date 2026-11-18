package fr.heuressup

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Base64
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

/** Feuille papier et PDF : conversion en image et lecture du texte, entièrement sur le téléphone. */
object Papier {

    fun pdfEnImage(a: MainActivity, base64: String): String {
        return try {
            val f = File(a.cacheDir, "import.pdf")
            f.writeBytes(Base64.decode(base64.substringAfter(","), Base64.DEFAULT))
            val pfd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY)
            val r = PdfRenderer(pfd)
            val n = minOf(r.pageCount, 3)
            val largeur = 1800
            val pages = ArrayList<Bitmap>()
            for (i in 0 until n) {
                val pg = r.openPage(i)
                val h = (pg.height.toFloat() * largeur / pg.width).toInt().coerceAtLeast(1)
                val b = Bitmap.createBitmap(largeur, h, Bitmap.Config.ARGB_8888)
                b.eraseColor(Color.WHITE)
                pg.render(b, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                pg.close(); pages.add(b)
            }
            r.close(); pfd.close(); f.delete()
            if (pages.isEmpty()) return ""
            val total = Bitmap.createBitmap(largeur, pages.sumOf { it.height }, Bitmap.Config.ARGB_8888)
            val c = Canvas(total); c.drawColor(Color.WHITE)
            var y = 0f
            for (b in pages) { c.drawBitmap(b, 0f, y, null); y += b.height; b.recycle() }
            val sortie = ByteArrayOutputStream()
            total.compress(Bitmap.CompressFormat.JPEG, 88, sortie); total.recycle()
            "data:image/jpeg;base64," + Base64.encodeToString(sortie.toByteArray(), Base64.NO_WRAP)
        } catch (e: Throwable) { "" }
    }

    private fun lecture(b: Bitmap): Text? = try {
        val rec = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val t = Tasks.await(rec.process(InputImage.fromBitmap(b, 0)))
        rec.close(); t
    } catch (e: Throwable) { null }

    private fun score(t: Text?): Int {
        if (t == null) return -1
        var n = 0
        for (bl in t.textBlocks) for (l in bl.lines) for (e in l.elements) if (e.text.any { it.isDigit() }) n++
        return n
    }

    private fun tourner(b: Bitmap, deg: Float): Bitmap = Bitmap.createBitmap(b, 0, 0, b.width, b.height, Matrix().apply { postRotate(deg) }, true)

    fun lire(a: MainActivity, dataUrl: String) {
        Thread {
            val r = JSONObject()
            try {
                val octets = Base64.decode(dataUrl.substringAfter(","), Base64.DEFAULT)
                val b0 = BitmapFactory.decodeByteArray(octets, 0, octets.size) ?: throw Exception("image illisible")
                // Lecture droite ; si peu de chiffres trouvés, on essaie la photo tournée (cascade).
                var meilleur = b0; var texte = lecture(b0); var s = score(texte)
                if (s < 15) {
                    for (deg in floatArrayOf(90f, 270f, 180f)) {
                        val bt = tourner(b0, deg); val tt = lecture(bt); val st = score(tt)
                        if (st > s) { meilleur = bt; texte = tt; s = st } else bt.recycle()
                        if (s >= 15) break
                    }
                }
                if (texte == null) throw Exception("lecture impossible")
                val el = JSONArray()
                for (bl in texte.textBlocks) for (l in bl.lines) for (e in l.elements) {
                    val q = e.boundingBox ?: continue
                    el.put(JSONObject().put("t", e.text).put("x", q.left).put("y", q.top).put("w", q.width()).put("h", q.height()))
                }
                r.put("w", meilleur.width).put("h", meilleur.height).put("el", el).put("texte", texte.text)
            } catch (e: Throwable) { r.put("erreur", e.message ?: "erreur") }
            a.appelerJs("App.feuilleLue(" + JSONObject.quote(r.toString()) + ")")
        }.start()
    }
}
