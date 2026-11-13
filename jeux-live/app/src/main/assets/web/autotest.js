/* Jeux Live — test automatique lancé seulement par la fabrication (jamais par l'utilisateur). */
(function () {
  function r(t) { try { Natif.rapport("AUTOTEST " + t); } catch (e) { console.log("AUTOTEST " + t); } }
  var jeux = App._jeux(), i = 0, echecs = [], total = 0;
  var lus = 0;
  var origine = App.evenement;
  // Compte les vrais messages reçus du lecteur (test de lecture sur un live public)
  App.evenement = function (j) { if (String(j).indexOf('"source"') !== -1) lus++; return origine(j); };
  r("DEBUT jeux=" + jeux.join(","));
  ["aide", "horaires", "etat", "maj", "accueil"].forEach(function (e) { try { App.ecran(e); } catch (x) { echecs.push("ecran " + e + " : " + x); } });
  function suivant() {
    if (i >= jeux.length) return fin();
    var id = jeux[i++], avant;
    try { App._demarrerJeu(id, false); } catch (x) { echecs.push(id + " lancement : " + x); return suivant(); }
    avant = JL.stats();
    r("CAPTURE " + id);
    var n = 0, camps = id === "course" ? ["1", "2"] : ["A", "B"];
    var minuterie = setInterval(function () {
      n++;
      var c = camps[n % 2], u = { nom: "Test" + (n % 6) + " " + c, id: "t" + (n % 6) };
      if (n % 6 < 2) App.evenement(JSON.stringify({ type: "commentaire", texte: c, utilisateur: u }));
      var v = [1, 1, 1, 5, 30, 99, 500, 1500][n % 8];
      App.evenement(JSON.stringify({ type: "cadeau", nom: "Cadeau" + v, valeur: v, nombre: 1 + (n % 5), utilisateur: u }));
      App.evenement(JSON.stringify({ type: "like", nombre: 12, utilisateur: u }));
      if (n % 10 === 0) App.evenement(JSON.stringify({ type: "abonnement", utilisateur: u }));
      if (n % 13 === 0) App.evenement(JSON.stringify({ type: "partage", utilisateur: u }));
    }, 80);
    setTimeout(function () {
      clearInterval(minuterie);
      var s = JL.stats(), img = s.images - avant.images;
      var sc = document.getElementById("scene"), visible = sc.style.display === "block" && sc.getBoundingClientRect().height > 100;
      var couleurs = {};
      try { var c2 = sc.getContext("2d"), w = sc.width, h = sc.height; for (var px = 0; px < 20; px++) { var d = c2.getImageData(Math.floor(w * (px % 5 + 0.5) / 5), Math.floor(h * (Math.floor(px / 5) + 0.5) / 4), 1, 1).data; couleurs[d[0] + "," + d[1] + "," + d[2]] = 1; } } catch (e) { }
      var nbCouleurs = Object.keys(couleurs).length;
      r("AFFICHAGE " + id + " visible=" + visible + " couleurs=" + nbCouleurs + " ecran=" + window.innerWidth + "x" + window.innerHeight);
      if (!visible) echecs.push(id + " : jeu pas affiché");
      if (nbCouleurs < 3) echecs.push(id + " : image vide");
      total += img;
      r("JEU " + id + " images=" + img + " erreurs=" + s.erreurs + " cadeaux=" + s.stats.cadeaux);
      if (s.erreurs > 0) echecs.push(id + " : " + s.erreurs + " erreurs");
      if (img < 40) echecs.push(id + " : animation bloquée (" + img + " images en 12 s)");
      App.quitterJeu();
      setTimeout(suivant, 800);
    }, 12000);
  }
  function fin() {
    r("JEUX " + (echecs.length ? "ECHEC " + echecs.join(" | ") : "OK"));
    // On laisse le lecteur travailler encore un peu puis on donne le résultat de la lecture
    if (window.__compteTest) { try { Natif.demarrerLecture(window.__compteTest); } catch (e) { } }
    setTimeout(function () {
      var etat = document.getElementById("etatLecture").textContent + " / " + document.getElementById("etatDetail").textContent;
      r("LECTURE messages=" + lus + " etat=" + etat);
      r("FIN " + (echecs.length ? "ECHEC" : "OK"));
    }, 50000);
  }
  setTimeout(suivant, 1500);
})();
