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
    log("CAPTURE accueil");
    setTimeout(function () { console.log("AUTOTEST FIN " + (ok ? "OK" : "ECHEC")); }, 3000);
  } catch (e) { console.log("AUTOTEST ECHEC " + e); console.log("AUTOTEST FIN ECHEC"); }
})();
