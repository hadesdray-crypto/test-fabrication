"use strict";
(function () {
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var MOIS_COURT = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  var DEFAUT = { nom: "", mail: "", poste: "ADS", obsm: "JAF", mpds: "08:45", mfds: "12:45", apds: "13:30", afds: "17:15", rappel: "1", vibr: "1", avance: "10" };
  var $ = function (id) { return document.getElementById(id); };
  var N = window.Natif || null;

  // ---------- Données (restent sur le téléphone) ----------
  var D = { reglages: {}, jours: {}, envois: {}, planning: { sem: {}, dates: {} } };
  function charger() {
    try { var t = localStorage.getItem("hs_v1"); if (t) D = JSON.parse(t); } catch (e) { }
    D.reglages = Object.assign({}, DEFAUT, D.reglages || {}); D.jours = D.jours || {}; D.envois = D.envois || {}; D.planning = D.planning || {}; D.planning.sem = D.planning.sem || {}; D.planning.dates = D.planning.dates || {};
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


  // ---------- Planning, alarme APJ, rappels ----------
  var JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  var ORDRE = [1, 2, 3, 4, 5, 6, 0];
  function aMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  // Planning prévu pour un jour : date précise d'abord, sinon semaine type. null = repos ou rien de prévu.
  function planDe(cle) {
    var P = D.planning, p = P.dates[cle];
    if (!p) { var d = new Date(+cle.slice(0, 4), +cle.slice(5, 7) - 1, +cle.slice(8)); p = P.sem[d.getDay()]; }
    if (!p || p.off) return null;
    var ok = (p.m && p.m[0] && p.m[1]) || (p.a && p.a[0] && p.a[1]);
    return ok ? p : null;
  }
  // L'alarme APJ est active : week-end 24h/24 ; du lundi au vendredi de 22h à 4h50.
  function alarmeActive(jour, min) { return jour === 0 || jour === 6 || min >= 22 * 60 || min < 4 * 60 + 50; }
  function rappelsAVenir(depuis, nbJ) {
    var R = D.reglages, out = [], av = +R.avance || 10;
    if (R.vibr !== "1") return out;
    for (var i = 0; i < (nbJ || 14); i++) {
      var d = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + i), cle = cleJour(d), p = planDe(cle);
      if (!p) continue;
      var debuts = [], fins = [];
      [p.m, p.a].forEach(function (c) { if (c && c[0] && c[1]) { debuts.push(aMin(c[0])); fins.push(aMin(c[1])); } });
      var pds = Math.min.apply(null, debuts), fds = Math.max.apply(null, fins), j = d.getDay();
      var ajoute = function (min, titre, texte) { var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min).getTime(); if (t > depuis.getTime()) out.push({ t: t, titre: titre, texte: texte, jour: cle, heure: p2(Math.floor(min / 60)) + "h" + p2(min % 60) }); };
      if (alarmeActive(j, pds)) ajoute(pds - av, "Arrivée sur site", "L'alarme est active : entre ton code personnel puis appuie sur MA.");
      if (j >= 1 && j <= 5 && fds > 21 * 60 + 45) ajoute(21 * 60 + 45, "Alarme à 22h", "L'alarme s'active automatiquement à 22h. Pense à la procédure avant.");
      if (alarmeActive(j, fds)) ajoute(fds - av, "Départ du site", "Entre ton code personnel puis appuie sur MS.");
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  function syncAlarmes() {
    var l = rappelsAVenir(new Date(), 14);
    if (N && N.alarmes) { try { N.alarmes(JSON.stringify(l.map(function (r) { return { t: r.t, titre: r.titre, texte: r.texte }; }))); } catch (e) { } }
    return l;
  }
  function texteJour(p) {
    var s = [];
    if (p.m && p.m[0] && p.m[1]) s.push("matin " + enH(p.m[0]) + " – " + enH(p.m[1]));
    if (p.a && p.a[0] && p.a[1]) s.push("après-midi " + enH(p.a[0]) + " – " + enH(p.a[1]));
    return (p.poste || D.reglages.poste) + " : " + s.join(" ; ");
  }
  function carteJour() {
    var n = new Date(), cle = cleJour(n), p = planDe(cle), e = $("c-jour"), h = "<b>Aujourd'hui</b><div class=\"aide\" style=\"font-size:16px;color:#0f172a\">";
    h += p ? esc(texteJour(p)) : "Repos, ou pas de planning pour ce jour (touche « Mon planning et l'alarme »).";
    var r = syncAlarmes()[0];
    h += "</div>";
    h += r ? "<div class=\"aide\" style=\"margin-top:8px;font-size:15px\">Prochain rappel (vibration) : <b>" + esc(r.titre) + "</b>, le " + r.jour.split("-").reverse().join("/") + " à " + r.heure + "</div>" : "<div class=\"aide\" style=\"margin-top:8px\">Aucun rappel d'alarme prévu.</div>";
    e.innerHTML = h;
  }
  function dessinerGrille() {
    var h = "";
    ORDRE.forEach(function (j) {
      var p = D.planning.sem[j] || {}, m = p.m || ["", ""], a = p.a || ["", ""];
      h += '<div class="carte" style="background:#f8fafc;box-shadow:none;border:1px solid #e2e8f0;padding:10px"><div class="duo" style="align-items:center"><b style="flex:1.2">' + JOURS[j] + '</b>' +
        '<select data-j="' + j + '" data-c="off"><option value="0"' + (p.off ? "" : " selected") + '>Travaillé</option><option value="1"' + (p.off ? " selected" : "") + '>Repos</option></select>' +
        '<select data-j="' + j + '" data-c="poste"><option' + ((p.poste || D.reglages.poste) === "ADS" ? " selected" : "") + '>ADS</option><option' + ((p.poste || D.reglages.poste) === "SIAP" ? " selected" : "") + '>SIAP</option></select></div>' +
        '<div class="aide" style="margin:8px 0 2px">Matin : prise et fin</div><div class="duo"><input type="time" data-j="' + j + '" data-c="m0" value="' + m[0] + '"><input type="time" data-j="' + j + '" data-c="m1" value="' + m[1] + '"></div>' +
        '<div class="aide" style="margin:8px 0 2px">Après-midi : prise et fin</div><div class="duo"><input type="time" data-j="' + j + '" data-c="a0" value="' + a[0] + '"><input type="time" data-j="' + j + '" data-c="a1" value="' + a[1] + '"></div></div>';
    });
    $("pl-grille").innerHTML = h;
  }
  function lireGrille() {
    var sem = {};
    document.querySelectorAll("#pl-grille [data-j]").forEach(function (e) {
      var j = e.getAttribute("data-j"), c = e.getAttribute("data-c"); sem[j] = sem[j] || { m: ["", ""], a: ["", ""], off: false, poste: D.reglages.poste };
      if (c === "off") sem[j].off = e.value === "1"; else if (c === "poste") sem[j].poste = e.value;
      else if (c === "m0") sem[j].m[0] = e.value; else if (c === "m1") sem[j].m[1] = e.value; else if (c === "a0") sem[j].a[0] = e.value; else sem[j].a[1] = e.value;
    });
    return sem;
  }
  function majRappels() {
    var l = syncAlarmes(), h = "";
    if (!l.length) h = '<div class="aide">Aucun rappel : remplis ton planning ci-dessus (ou vérifie que la vibration est sur « Oui »).</div>';
    l.slice(0, 10).forEach(function (r) { h += '<div class="ligne"><div class="t"><b>' + esc(r.titre) + '</b><small>' + r.jour.split("-").reverse().join("/") + ' à ' + r.heure + ' — ' + esc(r.texte) + '</small></div></div>'; });
    $("pl-rappels").innerHTML = h;
    var p = planDe(cleJour(new Date())); $("pl-etat").textContent = Object.keys(D.planning.sem).length || Object.keys(D.planning.dates).length ? "Planning enregistré. Il remplit tes heures et déclenche les rappels." : "Aucun planning pour l'instant : remplis la semaine type ou importe le code.";
  }
  function ouvrirPlanning() {
    dessinerGrille(); $("al-vibr").value = D.reglages.vibr; $("al-av").value = D.reglages.avance; $("pl-msg").textContent = ""; $("pl-mois-msg").textContent = "";
    majRappels(); chargerPhoto(); aller("planning");
  }
  function sauverPlanning() {
    D.planning.sem = lireGrille(); D.reglages.vibr = $("al-vibr").value; D.reglages.avance = $("al-av").value; sauver(); majRappels();
    $("pl-msg").textContent = "Planning enregistré.";
  }
  function importerPlanning() {
    var t = $("pl-code").value.trim(); if (!t) { $("pl-msg").textContent = "Colle d'abord le code."; return; }
    try {
      var o = JSON.parse(t), n = 0;
      if (o.sem) { Object.keys(o.sem).forEach(function (k) { D.planning.sem[k] = o.sem[k]; n++; }); }
      if (o.jours) { Object.keys(o.jours).forEach(function (k) { var j = o.jours[k]; D.planning.dates[k] = { poste: j.poste || D.reglages.poste, off: !!j.off, m: j.m || ["", ""], a: j.a || ["", ""] }; n++; }); }
      if (!n) throw new Error("vide");
      sauver(); dessinerGrille(); majRappels(); $("pl-code").value = ""; $("pl-msg").textContent = n + " jour(s) importé(s).";
    } catch (e) { $("pl-msg").textContent = "Code illisible. Copie-le en entier depuis le message de Claude."; }
  }
  function remplirMois() {
    var a = vue.a, m = vue.m, n = 0, N = nbJours(a, m);
    for (var d = 1; d <= N; d++) {
      var cle = a + "-" + p2(m + 1) + "-" + p2(d), p = planDe(cle); if (!p || D.jours[cle]) continue;
      var j = { poste: p.poste || D.reglages.poste };
      if (p.m && p.m[0] && p.m[1]) j.m = { pds: enH(p.m[0]), fds: enH(p.m[1]), obs: "" };
      if (p.a && p.a[0] && p.a[1]) j.a = { pds: enH(p.a[0]), fds: enH(p.a[1]), obs: "" };
      D.jours[cle] = j; n++;
    }
    sauver(); $("pl-mois-msg").textContent = n ? n + " jour(s) ajoutés à " + MOIS[m] + " " + a + " depuis ton planning (les jours déjà saisis n'ont pas changé)." : "Rien à ajouter pour " + MOIS[m] + " " + a + " : planning vide ou jours déjà saisis.";
  }
  // photo du planning : réduite puis gardée sur le téléphone
  function idb(mode, val) {
    return new Promise(function (ok) {
      try {
        var r = indexedDB.open("hs-photos", 1); r.onupgradeneeded = function () { r.result.createObjectStore("p"); };
        r.onerror = function () { ok(null); };
        r.onsuccess = function () {
          var tx = r.result.transaction("p", mode === "get" ? "readonly" : "readwrite"), st = tx.objectStore("p"), q = mode === "get" ? st.get("planning") : mode === "put" ? st.put(val, "planning") : st.delete("planning");
          q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); };
        };
      } catch (e) { ok(null); }
    });
  }
  function chargerPhoto() { idb("get").then(function (u) { $("ph-img").style.display = u ? "block" : "none"; $("ph-sup").style.display = u ? "inline-block" : "none"; if (u) $("ph-img").src = u; }); }
  function photoChoisie(f) {
    if (!f) return; var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, 1800 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        idb("put", c.toDataURL("image/jpeg", 0.85)).then(function () { chargerPhoto(); $("pl-msg").textContent = "Photo enregistrée sur le téléphone. Envoie-la à Claude pour obtenir le code."; });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  }

  // ---------- Pages ----------
  var pile = ["accueil"], mois = { a: 0, m: 0 }, vue = { a: 0, m: 0 };
  var TITRES = { accueil: "Heures sup", saisie: "Saisir mes heures", feuille: "Ma feuille", reglages: "Réglages", planning: "Planning et alarme" };
  function aller(p, empiler) {
    document.querySelectorAll(".page").forEach(function (e) { e.classList.remove("on"); });
    $("p-" + p).classList.add("on"); $("titre").textContent = TITRES[p];
    if (empiler !== false) pile.push(p); else pile[pile.length - 1] = p;
    document.querySelector("main").scrollTop = 0;
    if (p === "accueil") { rafraichir(); carteJour(); } if (p === "feuille") dessinerApercu();
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
    var n = new Date(), a = vue.a, m = vue.m;
    $("t-mois").textContent = MOIS[m] + " " + a;
    var ks = infoMois(a, m), h = "";
    if (!ks.length) h = '<div class="aide" style="text-align:center">Rien d\'enregistré ce mois-là.</div>';
    ks.forEach(function (k) {
      var d = +k.slice(8);
      h += '<div class="ligne"><div class="t"><b>' + d + " " + MOIS_COURT[m] + "</b><small>" + esc(resume(k)) + '</small></div><button class="petit" data-mod="' + k + '">Modifier</button><button class="petit rouge" data-sup="' + k + '">Supprimer</button></div>';
    });
    $("liste-mois").innerHTML = h;
    // échéance : avant le 15
    a = n.getFullYear(); m = n.getMonth();
    var j = n.getDate(), e = $("echeance"), txt;
    var mp = m === 0 ? 11 : m - 1;
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
    var nn = new Date(), cur = vue.a === nn.getFullYear() && vue.m === nn.getMonth();
    $("f-date").value = v.date || (cur ? cleJour(nn) : cleJour(new Date(vue.a, vue.m, nbJours(vue.a, vue.m))));
    choisirPer(v.per || "a");
    setPoste("f-poste", v.poste || R.poste);
    $("f-pds").value = v.pds || ""; $("f-fds").value = v.fds || ""; $("f-obs").value = v.obs || "";
    if (!v.pds && !v.fds) remplirAuto();
    $("msg-saisie").textContent = msg || "";
    aller("saisie");
  }
  function setPoste(id, val) { var sel = $(id), ok = false; for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === val) ok = true; if (!ok && val) { var o = document.createElement("option"); o.textContent = val; sel.appendChild(o); } sel.value = val; }
  var perCourante = "a";
  function horairesPrevus(date, per) {
    var p = planDe(date), c = p && (per === "m" ? p.m : p.a);
    if (c && c[0] && c[1]) return { pds: c[0], fds: c[1], poste: p.poste };
    var R = D.reglages; return per === "m" ? { pds: R.mpds, fds: R.mfds, poste: p && p.poste } : { pds: R.apds, fds: R.afds, poste: p && p.poste };
  }
  function remplirAuto() {
    var h = horairesPrevus($("f-date").value, perCourante);
    if (!$("f-pds").value || $("f-pds").getAttribute("data-auto")) { $("f-pds").value = h.pds; $("f-pds").setAttribute("data-auto", "1"); }
    if (!$("f-fds").value || $("f-fds").getAttribute("data-auto")) { $("f-fds").value = h.fds; $("f-fds").setAttribute("data-auto", "1"); }
    if (h.poste) setPoste("f-poste", h.poste);
  }
  function choisirPer(p) { perCourante = p; $("f-m").classList.toggle("on", p === "m"); $("f-a").classList.toggle("on", p === "a"); if ($("p-saisie").classList.contains("on")) remplirAuto(); }
  function depuisPhrase(txt) {
    var r = analyser(txt, new Date()), R = D.reglages, note = "";
    if (!r.pds && r.duree) {
      var hp = horairesPrevus(r.date, r.per);
      r.pds = hp.pds; r.fds = plus(hp.fds, r.duree);
      note = "Durée comprise : " + r.duree + " min en plus de ta fin de service prévue. Vérifie les heures puis touche « Enregistrer ».";
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
    vue.a = +date.slice(0, 4); vue.m = +date.slice(5, 7) - 1;
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
  function ouvrirReglages() { for (var k in CH) { if (k === "poste") setPoste(CH[k], D.reglages[k]); else $(CH[k]).value = D.reglages[k]; } $("t-version").textContent = "Version " + (N ? N.version() : "essai"); aller("reglages"); }
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
    var n = new Date(); mois.a = vue.a = n.getFullYear(); mois.m = vue.m = n.getMonth();
    $("b-dicter").onclick = function () { if (N) N.dicter(); else alert2("La dictée marche dans l'application. Écris la phrase dans la case ci-dessous."); };
    $("b-analyser").onclick = function () { var t = $("phrase").value.trim(); if (t) depuisPhrase(t); else alert2("Écris d'abord une phrase dans la case."); };
    $("b-main").onclick = function () { ouvrirSaisie(); };
    $("b-feuille").onclick = function () { mois.a = vue.a; mois.m = vue.m; aller("feuille"); };
    $("l-prec").onclick = function () { vue.m--; if (vue.m < 0) { vue.m = 11; vue.a--; } rafraichir(); };
    $("l-suiv").onclick = function () { vue.m++; if (vue.m > 11) { vue.m = 0; vue.a++; } rafraichir(); };
    $("b-reglages").onclick = ouvrirReglages;
    ["f-pds", "f-fds"].forEach(function (id) { $(id).oninput = function () { $(id).removeAttribute("data-auto"); }; });
    $("f-date").onchange = function () { remplirAuto(); };
    $("b-planning").onclick = ouvrirPlanning; $("pl-ok").onclick = sauverPlanning; $("pl-imp").onclick = importerPlanning; $("pl-mois").onclick = function () { var bt = $("pl-mois"); if (bt.getAttribute("data-sur")) { bt.removeAttribute("data-sur"); bt.textContent = "Remplir le mois avec mon planning"; sauverPlanning(); remplirMois(); } else { bt.setAttribute("data-sur", "1"); bt.textContent = "Confirmer : remplir " + MOIS[vue.m] + " " + vue.a + " ?"; } }; $("pl-retour").onclick = retour;
    $("al-vibr").onchange = $("al-av").onchange = function () { D.reglages.vibr = $("al-vibr").value; D.reglages.avance = $("al-av").value; sauver(); majRappels(); };
    $("ph-b").onclick = function () { $("ph-in").click(); }; $("ph-in").onchange = function () { photoChoisie($("ph-in").files[0]); $("ph-in").value = ""; };
    $("ph-sup").onclick = function () { idb("del").then(chargerPhoto); };
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
    rafraichir(); carteJour();
    if (N) setTimeout(function () { chercherMaj(true); }, 1500);
  }
  App._test = { planDe: planDe, rappels: rappelsAVenir, alarmeActive: alarmeActive, importer: function (o) { D.planning.sem = o.sem || D.planning.sem; Object.assign(D.planning.dates, o.jours || {}); }, analyser: analyser, dessiner: dessiner, pdf: pdf, charger: charger, D: function () { return D; }, sauver: sauver, enH: enH };
  document.addEventListener("DOMContentLoaded", init);
})();
