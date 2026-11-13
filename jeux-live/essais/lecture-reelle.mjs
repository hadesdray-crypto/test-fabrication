// Essai réel : ouvre des lives TikTok publics dans un navigateur, avec l'écoute de l'appli, et compte ce qui est lu.
import { chromium } from "playwright";
import fs from "fs";
const dir = "jeux-live/app/src/main/assets/lecteur/";
const script = ["inflate.js", "decodeur.js", "crochets.js"].map(f => fs.readFileSync(dir + f, "utf8")).join("\n;\n");
const cibles = (process.env.CIBLES || "https://www.tiktok.com/live").split(" ");
const duree = parseInt(process.env.DUREE || "90", 10) * 1000;
const navigateur = await chromium.launch();
let total = { evenements: 0, types: {}, sources: {} };
for (const url of cibles) {
  const ctx = await navigateur.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await ctx.route(/\.(flv|m3u8|ts|mp4)(\?|$)|pull-.*\.(flv|m3u8)/, r => r.abort());
  await ctx.addInitScript(script);
  const page = await ctx.newPage();
  const ws = [];
  page.on("websocket", w => ws.push(w.url().slice(0, 90)));
  let evs = 0, dernierEtat = "";
  page.on("console", m => {
    const t = m.text();
    if (t.startsWith("JLEV")) { evs++; const e = JSON.parse(t.slice(4)); total.types[e.type] = (total.types[e.type] || 0) + 1; total.sources[e.source] = (total.sources[e.source] || 0) + 1; if (evs <= 12) console.log("  EV", e.type, e.nom || "", e.nombre || "", e.texte ? e.texte.slice(0, 30) : "", "|", e.utilisateur && e.utilisateur.nom); }
    else if (t.startsWith("JLSTAT")) dernierEtat = t.slice(6);
  });
  console.log("=== " + url);
  try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); } catch (e) { console.log("  chargement:", e.message.slice(0, 100)); }
  await page.waitForTimeout(duree);
  console.log("  adresse finale:", page.url().slice(0, 100));
  console.log("  titre:", (await page.title()).slice(0, 80));
  console.log("  connexions ouvertes:", JSON.stringify(ws));
  console.log("  dernier état:", dernierEtat);
  console.log("  événements lus:", evs);
  await page.screenshot({ path: "capture-" + cibles.indexOf(url) + ".png" });
  total.evenements += evs;
  await ctx.close();
}
await navigateur.close();
console.log("RESULTAT_LECTURE " + JSON.stringify(total));
