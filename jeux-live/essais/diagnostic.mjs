// Diagnostic : quelles connexions et quelles requêtes la page d'un live TikTok utilise réellement.
import { chromium } from "playwright";
import fs from "fs";
const dir = "jeux-live/app/src/main/assets/lecteur/";
const lib = ["inflate.js", "decodeur.js"].map(f => fs.readFileSync(dir + f, "utf8")).join("\n;\n");
const diag = `
(function(){
  var W = window.WebSocket;
  window.WebSocket = function(u,p){ var ws = p===undefined? new W(u): new W(u,p);
    console.log("DIAG_WS_OUVERT " + String(u).slice(0,160));
    var n=0;
    ws.addEventListener("message", function(e){ n++; if(n>40) return;
      var d=e.data;
      function f(b){ var o=new Uint8Array(b); var h=""; for(var i=0;i<Math.min(24,o.length);i++) h+=(o[i]<16?"0":"")+o[i].toString(16);
        var info=""; try{ var r=JL_dec.trame(o); info=" type="+r.typeCharge+" ev="+r.evenements.length+" "+r.evenements.map(function(x){return x.methode}).slice(0,6).join(","); }catch(er){ info=" err="+er.message; }
        console.log("DIAG_WS_MSG "+String(u).slice(0,40)+" taille="+o.length+" debut="+h+info); }
      if (typeof d==="string") console.log("DIAG_WS_TXT "+d.slice(0,120));
      else if (d instanceof ArrayBuffer) f(d); else if (d && d.arrayBuffer) d.arrayBuffer().then(f);
    }); return ws; };
  window.WebSocket.prototype = W.prototype;
})();`;
const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", locale: "fr-FR", viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(lib + "\n;" + diag);
const page = await ctx.newPage();
page.on("console", m => { const t = m.text(); if (t.startsWith("DIAG")) console.log(t); });
page.on("request", r => { const u = r.url(); if (/webcast|im\/fetch|room|live\/.*api|api\/live/.test(u) && !/\.(js|css|png|jpe?g|webp|woff2?)(\?|$)/.test(u)) console.log("DIAG_REQ " + r.method() + " " + u.slice(0, 150)); });
page.on("response", async r => { const u = r.url(); if (/im\/fetch/.test(u)) { try { const b = await r.body(); console.log("DIAG_FETCH_REP taille=" + b.length + " statut=" + r.status()); } catch (e) {} } });
page.on("worker", w => console.log("DIAG_WORKER " + w.url().slice(0, 120)));
async function visite(url, ms) {
  console.log("=== " + url);
  try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); } catch (e) { console.log("chargement: " + e.message.slice(0, 80)); }
  await page.waitForTimeout(ms);
  console.log("adresse finale: " + page.url() + " | titre: " + (await page.title()).slice(0, 70));
}
await visite("https://www.tiktok.com/live", 25000);
const liens = await page.$$eval("a[href*='/live']", as => as.map(a => a.href).filter(h => /\/@[^/]+\/live/.test(h)));
console.log("DIAG_LIENS " + JSON.stringify([...new Set(liens)].slice(0, 5)));
const cible = liens.find(h => /\/@[^/]+\/live/.test(h));
if (cible) { await visite(cible.split("?")[0], 45000); await page.screenshot({ path: "capture-live.png" }); }
const txt = await page.evaluate(() => document.body.innerText.slice(0, 600).replace(/\s+/g, " "));
console.log("DIAG_TEXTE " + txt);
await navigateur.close();
