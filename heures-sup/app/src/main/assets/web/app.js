"use strict";
(function () {
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var MOIS_COURT = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  var DEFAUT = { nom: "", mail: "", poste: "ADS", obsm: "JAF", mpds: "08:45", mfds: "12:45", apds: "13:30", afds: "17:15", rappel: "1" };
  var $ = function (id) { return document.getElementById(id); };
  var N = window.Natif || null;

  // ---------- Données (restent sur le téléphone) ----------
  var D = { reglages: {}, jours: {}, envois: {} };
  function charger() {
    try { var t = localStorage.getItem("hs_v1"); if (t) D = JSON.parse(t); } catch (e) { }
    D.reglages = Object.assign({}, DEFAUT, D.reglages || {}); D.jours = D.jours || {}; D.envois = D.envois || {};
  }
  function sauver() { try { localStorage.setItem("hs_v1", JSON.stringify(D)); } catch (e) { } }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function cleJour(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function cleMois(a, m) { return a + "-" + p2(m + 1); }
  function nbJours(a, m) { return new Date(a, m + 1, 0).getDate(); }
  // "17:30" -> "17H30"
  function enH(t) { if (!t) return ""; var m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? p2(+m[1]) + "H" + m[2] : t; }

  // ---------- Dictée : comprendre la phrase ----------
  function analyser(texte, maintenant) {
    var t = " " + String(texte || "").toLowerCase().replace(/’/g, "'") + " ";
    var r = { date: null, per: null, pds: "", fds: "", obs: "", duree: 0 };
    var d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (/avant[- ]hier/.test(t)) d.setDate(d.getDate() - 2);
    else if (/\bhier\b/.test(t)) d.setDate(d.getDate() - 1);
    else {
      var mj = /\ble\s+(\d{1,2}|1er|premier)(?:\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre))?/.exec(t);
      if (mj) {
        var j = /^(1er|premier)$/.test(mj[1]) ? 1 : +mj[1];
        if (mj[2]) { var nom = mj[2].replace("fevrier", "février").replace("aout", "août").replace("decembre", "décembre"); d.setMonth(MOIS.indexOf(nom)); }
        d.setDate(j);
      }
    }
    r.date = cleJour(d);
    if (/matin/.test(t)) r.per = "m"; else if (/apr[eè]s[- ]?midi|soir/.test(t)) r.per = "a";
    // heures
    var re = /(\d{1,2})\s*(?:heures?|h|:)\s*(\d{2})?/g, m, hs = [];
    var sans = t.replace(/(\d+)\s*(?:minutes?|min)\b/g, " ");
    while ((m = re.exec(sans))) { var h = +m[1]; if (h <= 24) hs.push(p2(h) + ":" + (m[2] || "00")); }
    if (hs.length >= 2) { r.pds = hs[0]; r.fds = hs[1]; }
    else {
      var dur = 0, a = /(\d+)\s*(?:minutes?|min)\b/.exec(t), b = /(\d+)\s*heures?(?:\s*et\s*(demie|demi|quart|\d+))?/.exec(t);
      if (/une\s+heure/.test(t)) dur += 60;
      if (b) { dur += 60 * (+b[1]); if (b[2]) dur += /demi/.test(b[2]) ? 30 : b[2] === "quart" ? 15 : +b[2]; }
      if (a) dur += +a[1];
      if (/une\s+demi[- ]heure/.test(t)) dur += 30;
      if (/un\s+quart\s+d'heure/.test(t)) dur += 15;
      r.duree = dur;
    }
    if (!r.per) r.per = r.pds ? (parseInt(r.pds, 10) < 13 ? "m" : "a") : "a";
    // observation
    var o = /(?:pour|motif|observations?|cause|à cause de|a cause de|parce que|à cause d')\s+(.+?)\s*$/.exec(t);
    var obs = o ? o[1] : "";
    if (!obs) { var k = /(audience|alarme en cours|alarme|intervention|relève|relevé)/.exec(t); if (k) obs = k[1]; }
    obs = obs.replace(/^(une |un |la |le |l'|les )/, "").trim();
    r.obs = obs ? obs.charAt(0).toUpperCase() + obs.slice(1) : "";
    return r;
  }
  function plus(hhmm, minutes) { var p = hhmm.split(":"); var tot = (+p[0]) * 60 + (+p[1]) + minutes; return p2(Math.floor(tot / 60) % 24) + ":" + p2(tot % 60); }

  // ---------- Pages ----------
  var pile = ["accueil"], mois = { a: 0, m: 0 }, edition = null;
  var TITRES = { accueil: "Heures sup", saisie: "Saisir mes heures", feuille: "Ma feuille", reglages: "Réglages" };
  function aller(p, empiler) {
    document.querySelectorAll(".page").forEach(function (e) { e.classList.remove("on"); });
    $("p-" + p).classList.add("on"); $("titre").textContent = TITRES[p];
    if (empiler !== false) pile.push(p); else pile[pile.length - 1] = p;
    document.querySelector("main").scrollTop = 0;
    if (p === "accueil") rafraichir(); if (p === "feuille") dessinerApercu();
  }
  function retour() { if ($("fond").classList.contains("on")) { fermerMaj(); return true; } if (pile.length > 1) { pile.pop(); var p = pile[pile.length - 1]; pile.pop(); aller(p); return true; } return false; }

  function infoMois(a, m) {
    var ks = Object.keys(D.jours).filter(function (k) { return k.indexOf(cleMois(a, m)) === 0; }).sort();
    return ks;
  }
  function resume(k) {
    var j = D.jours[k], s = [];
    ["m", "a"].forEach(function (c) { if (j[c] && (j[c].pds || j[c].fds)) s.push((c === "m" ? "Matin " : "Après-midi ") + enH(j[c].pds) + " – " + enH(j[c].fds) + (j[c].obs ? " (" + j[c].obs + ")" : "")); });
    return s.join(" ; ") || "—";
  }
  function rafraichir() {
    var n = new Date(), a = n.getFullYear(), m = n.getMonth();
    $("t-mois").textContent = "Heures de " + MOIS[m] + " " + a;
    var ks = infoMois(a, m), h = "";
    if (!ks.length) h = '<div class="aide">Rien d\'enregistré ce mois-ci.</div>';
    ks.forEach(function (k) {
      var d = +k.slice(8);
      h += '<div class="ligne"><div class="t"><b>' + d + " " + MOIS_COURT[m] + "</b><small>" + esc(resume(k)) + '</small></div><button class="petit" data-mod="' + k + '">Modifier</button><button class="petit rouge" data-sup="' + k + '">Supprimer</button></div>';
    });
    $("liste-mois").innerHTML = h;
    // échéance : avant le 15
    var j = n.getDate(), e = $("echeance"), txt;
    var mp = m === 0 ? 11 : m - 1, ap = m === 0 ? a - 1 : a;
    if (j <= 15) txt = "À envoyer avant le 15 : la feuille de " + MOIS[mp] + " (complète) et celle de " + MOIS[m] + " (à jour au 15).";
    else txt = "Prochain envoi avant le 15 " + MOIS[(m + 1) % 12] + " : la feuille de " + MOIS[m] + " (complète).";
    var dernier = D.envois[cleMois(a, m)];
    txt += dernier ? " Dernier envoi de " + MOIS[m] + " : " + dernier + "." : "";
    e.textContent = txt;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- Saisie ----------
  function ouvrirSaisie(v, msg) {
    var R = D.reglages;
    v = v || {};
    $("f-date").value = v.date || cleJour(new Date());
    choisirPer(v.per || "a");
    $("f-poste").value = v.poste || R.poste;
    $("f-pds").value = v.pds || ""; $("f-fds").value = v.fds || ""; $("f-obs").value = v.obs || "";
    $("msg-saisie").textContent = msg || "";
    aller("saisie");
  }
  var perCourante = "a";
  function choisirPer(p) { perCourante = p; $("f-m").classList.toggle("on", p === "m"); $("f-a").classList.toggle("on", p === "a"); }
  function depuisPhrase(txt) {
    var r = analyser(txt, new Date()), R = D.reglages, note = "";
    if (!r.pds && r.duree) {
      var pd = r.per === "m" ? R.mpds : R.apds, fd = r.per === "m" ? R.mfds : R.afds;
      r.pds = pd; r.fds = plus(fd, r.duree);
      note = "Durée comprise : " + r.duree + " min en plus de ta fin de service habituelle. Vérifie les heures puis touche « Enregistrer ».";
    } else if (!r.pds) note = "Je n'ai pas compris les heures. Remplis-les puis touche « Enregistrer ».";
    else note = "Vérifie puis touche « Enregistrer ».";
    ouvrirSaisie(r, note);
  }
  function enregistrer() {
    var date = $("f-date").value, pds = $("f-pds").value, fds = $("f-fds").value;
    if (!date) { $("msg-saisie").textContent = "Choisis le jour."; return; }
    if (!pds || !fds) { $("msg-saisie").textContent = "Remplis la prise et la fin de service."; return; }
    var j = D.jours[date] || {};
    j.poste = $("f-poste").value.trim() || D.reglages.poste;
    j[perCourante] = { pds: enH(pds), fds: enH(fds), obs: $("f-obs").value.trim() };
    D.jours[date] = j; sauver();
    pile = ["accueil"]; aller("accueil", false);
  }

  // ---------- Feuille ----------
  function contenuJour(a, m, d) {
    var j = D.jours[a + "-" + p2(m + 1) + "-" + p2(d)];
    if (!j) return null;
    var R = D.reglages, mm = j.m || {}, aa = j.a || {};
    return {
      poste: j.poste || R.poste,
      m: [mm.pds || "//", mm.fds || "//", mm.obs || R.obsm || "//"],
      a: [aa.pds || "//", aa.fds || "//", aa.obs || "//"]
    };
  }
  function dessiner(cv, a, m) {
    var W = 1654, H = 2339; cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    var serif = "bold 33px Georgia, 'Times New Roman', serif";
    g.fillStyle = "#111"; g.textBaseline = "alphabetic";
    g.font = serif; g.fillText("Nom de l’agent :", 117, 78);
    var nom = D.reglages.nom || "";
    g.font = "42px 'Comic Sans MS','Segoe Print',cursive, sans-serif"; if (nom) g.fillText(nom.toUpperCase(), 420, 82);
    g.font = serif; g.fillText("HEURES SUPPLÉMENTAIRES", 117, 155);
    var w1 = g.measureText("HEURES SUPPLÉMENTAIRES ").width; g.font = "bold 33px Georgia, serif"; g.fillText("du mois de :", 117 + w1, 155);
    var w2 = g.measureText("du mois de : ").width; g.font = "44px 'Comic Sans MS','Segoe Print',cursive, sans-serif"; g.fillText(MOIS[m], 117 + w1 + w2, 160);
    // logo
    g.fillStyle = "#111"; g.fillRect(1387, 33, 226, 95);
    g.strokeStyle = "#b8b8b8"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(1405, 62); g.lineTo(1405, 50); g.lineTo(1480, 50); g.moveTo(1595, 62); g.lineTo(1595, 50); g.lineTo(1520, 50);
    g.moveTo(1405, 100); g.lineTo(1405, 112); g.lineTo(1480, 112); g.moveTo(1595, 100); g.lineTo(1595, 112); g.lineTo(1520, 112); g.stroke();
    g.fillStyle = "#e5e5e5"; g.font = "bold 34px Arial, sans-serif"; g.textAlign = "center"; g.fillText("PROTEC", 1500, 91);
    g.font = "bold 9px Arial, sans-serif"; g.fillText("SÉCURITÉ", 1500, 106); g.textAlign = "left";
    // tableau
    var X = 109, Y = 202, TW = 1454, TH = 1845, HH = 99, RH = (TH - HH) / 31;
    var fr = [0.067, 0.179, 0.088, 0.081, 0.202, 0.065, 0.069, 0.25], cx = [X];
    fr.forEach(function (f, i) { cx.push(cx[i] + f * TW); });
    // en-têtes
    g.fillStyle = "#bdbdbd"; g.fillRect(X, Y, cx[2] - X, HH);
    g.fillStyle = "#7a7a7a"; g.fillRect(cx[2], Y, X + TW - cx[2], 37);
    g.fillStyle = "#dcdcdc"; g.fillRect(cx[2], Y + 37, X + TW - cx[2], HH - 37);
    g.fillStyle = "#fff"; g.font = "bold 26px Arial, sans-serif"; g.textAlign = "center";
    g.fillText("MATIN", (cx[2] + cx[5]) / 2, Y + 29); g.fillText("APRES-MIDI", (cx[5] + cx[8]) / 2, Y + 29);
    g.fillStyle = "#111"; g.font = "bold 26px Arial, sans-serif";
    var ent = ["PdS", "FdS", "Observation", "PdS", "FdS", "Observation"];
    ent.forEach(function (t, i) { g.fillText(t, (cx[i + 2] + cx[i + 3]) / 2, Y + 77); });
    // lignes
    var N = nbJours(a, m);
    for (var d = 1; d <= 31; d++) {
      var y = Y + HH + (d - 1) * RH;
      g.fillStyle = d % 2 === 0 ? "#d9d9d9" : "#fff"; g.fillRect(X, y, TW, RH);
      g.fillStyle = "#111"; g.font = "bold 25px Arial, sans-serif"; g.textAlign = "left";
      g.fillText(d === 1 ? "1" : String(d), X + 36, y + RH / 2 + 9);
      if (d === 1) { g.font = "bold 14px Arial, sans-serif"; g.fillText("er", X + 49, y + RH / 2 - 2); }
      if (d > N) { g.fillStyle = "#fff"; g.fillRect(cx[1], y, X + TW - cx[1], RH); g.fillStyle = "#f3f3f3"; continue; }
      var c = contenuJour(a, m, d);
      if (!c) continue;
      g.fillStyle = "#111"; g.textAlign = "center";
      texte(g, c.poste, (cx[1] + cx[2]) / 2, y + RH / 2 + 10, cx[2] - cx[1] - 12);
      for (var i = 0; i < 3; i++) texte(g, c.m[i], (cx[2 + i] + cx[3 + i]) / 2, y + RH / 2 + 10, cx[3 + i] - cx[2 + i] - 12);
      for (i = 0; i < 3; i++) texte(g, c.a[i], (cx[5 + i] + cx[6 + i]) / 2, y + RH / 2 + 10, cx[6 + i] - cx[5 + i] - 12);
    }
    // traits
    g.strokeStyle = "#222"; g.lineWidth = 2; g.textAlign = "left";
    g.strokeRect(X, Y, TW, TH);
    for (d = 0; d <= 31; d++) { var yy = Y + HH + d * RH; g.beginPath(); g.moveTo(X, yy); g.lineTo(X + TW, yy); g.stroke(); }
    for (var k = 1; k < 8; k++) { g.beginPath(); g.moveTo(cx[k], k >= 2 && k !== 2 && k !== 5 ? Y + 37 : Y); g.lineTo(cx[k], Y + TH); g.stroke(); }
    g.beginPath(); g.moveTo(cx[2], Y + 37); g.lineTo(X + TW, Y + 37); g.stroke();
    // pied de page
    g.fillStyle = "#111"; g.font = "26px Arial, sans-serif";
    g.fillText("Merci de remplir dans les cases « observations » la cause de la prolongation de vacation (prolongation d’audience,", 109, 2108);
    g.fillText("alarme en cours etc…)", 109, 2152);
    g.textAlign = "center"; g.fillText("Merci de remplir uniquement les heures de prolongation", 840, 2196);
    g.textAlign = "left";
  }
  function texte(g, t, x, y, max) {
    var s = 25; g.font = s + "px Arial, sans-serif";
    while (g.measureText(t).width > max && s > 12) { s -= 1; g.font = s + "px Arial, sans-serif"; }
    g.fillText(t, x, y);
  }
  function dessinerApercu() {
    var a = mois.a, m = mois.m; $("m-nom").textContent = MOIS[m] + " " + a;
    dessiner($("apercu"), a, m);
  }

  // ---------- PDF (feuille A4 = une image dans un fichier PDF) ----------
  function pdf(cv) {
    var b64 = cv.toDataURL("image/jpeg", 0.92).split(",")[1], bin = atob(b64), jpg = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
    var enc = new TextEncoder(), parts = [], len = 0, offs = [];
    function add(x) { var u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); len += u.length; }
    var cont = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    add("%PDF-1.4\n");
    offs[1] = len; add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offs[2] = len; add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    offs[3] = len; add("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
    offs[4] = len; add("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + cv.width + " /Height " + cv.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n"); add(jpg); add("\nendstream\nendobj\n");
    offs[5] = len; add("5 0 obj\n<< /Length " + cont.length + " >>\nstream\n" + cont + "\nendstream\nendobj\n");
    var xr = len; var x = "xref\n0 6\n0000000000 65535 f \n";
    for (i = 1; i <= 5; i++) x += ("0000000000" + offs[i]).slice(-10) + " 00000 n \n";
    add(x + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF\n");
    var out = new Uint8Array(len), p = 0; parts.forEach(function (u) { out.set(u, p); p += u.length; });
    return out;
  }
  function base64(u8) { var s = "", n = 0x8000; for (var i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); }
  function envoyer() {
    var cv = document.createElement("canvas"); dessiner(cv, mois.a, mois.m);
    var b = base64(pdf(cv)), nom = "Heures-supplementaires-" + MOIS[mois.m] + "-" + mois.a + ".pdf";
    var sujet = "Heures supplémentaires de " + MOIS[mois.m] + " " + mois.a;
    var corps = "Bonjour, voici ma feuille d'heures supplémentaires de " + MOIS[mois.m] + " " + mois.a + " (à jour au " + cleJour(new Date()).split("-").reverse().join("/") + ").";
    if (!N) { $("msg-feuille").textContent = "Envoi disponible dans l'application."; return b.length; }
    var r = N.partager(b, nom, sujet, corps, D.reglages.mail || "");
    if (r === "ok") { D.envois[cleMois(mois.a, mois.m)] = new Date().toLocaleDateString("fr-FR"); sauver(); $("msg-feuille").textContent = "Messagerie ouverte : valide l'envoi."; }
    else $("msg-feuille").textContent = r;
  }

  // ---------- Réglages ----------
  var CH = { nom: "r-nom", mail: "r-mail", poste: "r-poste", obsm: "r-obsm", mpds: "r-mpds", mfds: "r-mfds", apds: "r-apds", afds: "r-afds", rappel: "r-rappel" };
  function ouvrirReglages() { for (var k in CH) $(CH[k]).value = D.reglages[k]; $("t-version").textContent = "Version " + (N ? N.version() : "essai"); aller("reglages"); }
  function sauverReglages() {
    for (var k in CH) D.reglages[k] = $(CH[k]).value.trim ? $(CH[k]).value.trim() : $(CH[k]).value;
    sauver(); if (N) N.rappel(D.reglages.rappel === "1");
    pile = ["accueil"]; aller("accueil", false);
  }

  // ---------- Mise à jour dans l'appli ----------
  var autoMaj = false;
  function ouvrirMaj() { $("fond").classList.add("on"); }
  function fermerMaj() { $("fond").classList.remove("on"); }
  function chercherMaj(auto) {
    autoMaj = !!auto;
    if (!N) return;
    if (!auto) { $("maj-titre").textContent = "Mise à jour"; $("maj-texte").textContent = "Recherche en cours…"; $("maj-msg").textContent = ""; $("maj-go").style.display = "none"; $("barre").style.display = "none"; ouvrirMaj(); }
    N.chercherMaj();
  }
  var App = window.App = {
    retour: retour,
    dictee: function (t) { $("phrase").value = t; depuisPhrase(t); },
    dicteeErreur: function (m) { aller("accueil", false); alert2(m); },
    resultatMaj: function (js) {
      var r = JSON.parse(js);
      if (autoMaj && !r.nouvelle) return;
      $("maj-titre").textContent = r.erreur ? "Mise à jour" : r.nouvelle ? "Nouvelle version " + r.nom : "À jour";
      var h = "";
      if (r.erreur) h = esc(r.erreur);
      else if (r.nouvelle) { h = "<b>Ce qui change :</b><ul>"; (r.changes || []).forEach(function (c) { h += "<li>" + esc(c) + "</li>"; }); h += "</ul>"; }
      else h = "Tu as la dernière version (" + esc(r.nom) + ").";
      $("maj-texte").innerHTML = h; $("maj-go").style.display = r.nouvelle ? "block" : "none"; $("maj-msg").textContent = ""; ouvrirMaj();
    },
    messageMaj: function (m) { $("maj-msg").textContent = m; },
    progresMaj: function (p) { $("barre").style.display = "block"; $("barre").firstChild.style.width = p + "%"; $("maj-msg").textContent = "Chargement " + p + " %"; }
  };
  function alert2(m) { $("msg-feuille").textContent = ""; var e = $("echeance"); e.className = "carte alerte"; e.textContent = m; }

  // ---------- Branchements ----------
  function init() {
    charger();
    var n = new Date(); mois.a = n.getFullYear(); mois.m = n.getMonth();
    $("b-dicter").onclick = function () { if (N) N.dicter(); else alert2("La dictée marche dans l'application. Écris la phrase dans la case ci-dessous."); };
    $("b-analyser").onclick = function () { var t = $("phrase").value.trim(); if (t) depuisPhrase(t); else alert2("Écris d'abord une phrase dans la case."); };
    $("b-main").onclick = function () { ouvrirSaisie(); };
    $("b-feuille").onclick = function () { aller("feuille"); };
    $("b-reglages").onclick = ouvrirReglages;
    $("f-m").onclick = function () { choisirPer("m"); }; $("f-a").onclick = function () { choisirPer("a"); };
    $("b-enreg").onclick = enregistrer; $("b-annuler").onclick = retour;
    $("m-prec").onclick = function () { mois.m--; if (mois.m < 0) { mois.m = 11; mois.a--; } dessinerApercu(); };
    $("m-suiv").onclick = function () { mois.m++; if (mois.m > 11) { mois.m = 0; mois.a++; } dessinerApercu(); };
    $("b-envoyer").onclick = envoyer; $("b-retour1").onclick = retour;
    $("r-ok").onclick = sauverReglages; $("b-maj").onclick = function () { chercherMaj(false); };
    $("maj-go").onclick = function () { $("maj-msg").textContent = "Démarrage…"; N && N.installerMaj(); };
    $("maj-fermer").onclick = fermerMaj;
    $("bpt").onclick = function () { var ok = N && N.signaler(pile[pile.length - 1]); if (!ok) alert2("Signalement : l'adresse d'envoi des erreurs est à compléter."); };
    $("liste-mois").onclick = function (e) {
      var b = e.target, k = b.getAttribute("data-mod");
      if (k) { var j = D.jours[k], c = j.a && (j.a.pds || j.a.fds) ? "a" : "m", x = j[c] || {}; ouvrirSaisie({ date: k, per: c, poste: j.poste, pds: x.pds ? x.pds.replace("H", ":") : "", fds: x.fds ? x.fds.replace("H", ":") : "", obs: x.obs }, "Modification du " + k.split("-").reverse().join("/")); return; }
      k = b.getAttribute("data-sup");
      if (k) { if (b.getAttribute("data-sur")) { delete D.jours[k]; sauver(); rafraichir(); } else { b.setAttribute("data-sur", "1"); b.textContent = "Sûr ?"; } }
    };
    rafraichir();
    if (N) setTimeout(function () { chercherMaj(true); }, 1500);
  }
  App._test = { analyser: analyser, dessiner: dessiner, pdf: pdf, charger: charger, D: function () { return D; }, sauver: sauver, enH: enH };
  document.addEventListener("DOMContentLoaded", init);
})();
