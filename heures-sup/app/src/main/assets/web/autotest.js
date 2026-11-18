(function () {
  try {
    var T = App._test, ok = true, log = function (m) { console.log("AUTOTEST " + m); };
    var r = T.analyser("aujourd'hui de 17h30 à 18h15 pour audience", new Date(2026, 10, 16));
    if (r.pds !== "17:30" || r.fds !== "18:15" || r.per !== "a" || r.obs !== "Audience" || r.date !== "2026-11-16") { ok = false; log("ECHEC analyse " + JSON.stringify(r)); }
    var cv = document.createElement("canvas"); T.dessiner(cv, 2026, 10);
    var p = T.pdf(cv); if (p.length < 20000) { ok = false; log("ECHEC pdf"); }
    ["b-feuille", "b-reglages", "b-main", "b-planning"].forEach(function (id) { document.getElementById(id).click(); App.retour(); });
    if (!Array.isArray(T.rappels(new Date(), 3))) { ok = false; log("ECHEC rappels"); }
    if (T.alarmeActive(6, 600) !== true || T.alarmeActive(3, 600) !== false || T.alarmeActive(3, 1330) !== true) { ok = false; log("ECHEC regle alarme"); }
    // Bouton d'import de la feuille papier présent sur la page « Ma feuille »
    if (!document.getElementById("pa-b") || document.getElementById("ph-in").getAttribute("accept")) { ok = false; log("ECHEC boutons import"); }
    log("CAPTURE accueil");
    // Lecture réelle d'une feuille : on dessine une feuille remplie, on la fait lire par le téléphone, on compare.
    var D = T.D(), sauve = D.jours;
    D.jours = { "2026-10-03": { poste: "ADS", m: { pds: "08H45", fds: "13H15", obs: "Audience JAF" } }, "2026-10-14": { poste: "SIAP", a: { pds: "13H30", fds: "19H00", obs: "Alarme en cours" } }, "2026-10-22": { poste: "ADS", a: { pds: "13H30", fds: "18H45", obs: "Audience" } } };
    var c2 = document.createElement("canvas"); T.dessiner(c2, 2026, 9); D.jours = sauve;
    var fini = false, fin = function (m) { if (fini) return; fini = true; if (m) { ok = false; log(m); } console.log("AUTOTEST FIN " + (ok ? "OK" : "ECHEC")); };
    App._ocr = function (o) {
      if (o.erreur) { fin("ECHEC lecture " + o.erreur); return; }
      var a = T.analyserPapier(o), j = a.jours || {};
      log("papier " + JSON.stringify(a));
      var bon = j[3] && j[3].m && j[3].m.pds === "08:45" && j[3].m.fds === "13:15" && j[14] && j[14].a && j[14].a.fds === "19:00" && j[14].poste === "SIAP" && j[22] && j[22].a && j[22].a.pds === "13:30" && a.mois === 9;
      fin(bon ? "" : "ECHEC analyse papier");
    };
    if (!window.Natif || !Natif.lireFeuille) { fin(""); return; }
    Natif.lireFeuille(c2.toDataURL("image/jpeg", 0.9));
    setTimeout(function () { fin("ECHEC lecture trop longue"); }, 60000);
  } catch (e) { console.log("AUTOTEST ECHEC " + e); console.log("AUTOTEST FIN ECHEC"); }
})();
