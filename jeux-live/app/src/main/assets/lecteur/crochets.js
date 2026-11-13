/* Jeux Live — écoute des messages du live, injectée dans la page TikTok ouverte en arrière-plan.
   Lecture seule : rien n'est envoyé à TikTok, aucun compte n'est utilisé. */
(function () {
  if (window.__JL_ACTIF) return;
  window.__JL_ACTIF = true;

  var vus = {}, nbVus = 0, series = {}, dernierBinaire = 0, compteurs = { trames: 0, evenements: 0, erreurs: 0 };

  function envoyer(canal, obj) {
    var t = JSON.stringify(obj);
    try {
      if (window.JeuxLiveNatif && window.JeuxLiveNatif[canal]) { window.JeuxLiveNatif[canal](t); return; }
    } catch (e) { }
    try { console.log((canal === "evenement" ? "JLEV" : "JLSTAT") + t); } catch (e2) { }
  }
  function etat(msg) { envoyer("etat", { msg: msg, trames: compteurs.trames, evenements: compteurs.evenements, erreurs: compteurs.erreurs }); }

  function personne(u) { return u ? { nom: u.nom || "Quelqu'un", pseudo: u.pseudo || "", id: u.id || "" } : { nom: "Quelqu'un", pseudo: "", id: "" }; }

  function traiter(ev, source) {
    if (ev.idMessage) {
      if (vus[ev.idMessage]) return;
      vus[ev.idMessage] = 1; nbVus++;
      if (nbVus > 3000) { vus = {}; nbVus = 0; }
    }
    var sortie = null;
    if (ev.type === "cadeau") {
      var c = ev.cadeau || { nom: "", valeur: 0, type: 0, id: "" };
      var nombre;
      if (c.type === 1) { // cadeau en série : on compte au fur et à mesure
        var cle = (ev.utilisateur ? ev.utilisateur.id : "") + "|" + ev.idCadeau + "|" + ev.groupe;
        var avant = series[cle] || 0, rep = ev.repetition || 1;
        nombre = rep > avant ? rep - avant : 0;
        series[cle] = Math.max(avant, rep);
        if (ev.finSerie) delete series[cle];
      } else {
        nombre = Math.max(1, ev.repetition || 1);
      }
      if (nombre > 0) sortie = { type: "cadeau", nom: c.nom || "Cadeau", valeur: Math.max(1, c.valeur || 1), nombre: nombre, idCadeau: ev.idCadeau, utilisateur: personne(ev.utilisateur) };
    } else if (ev.type === "like") {
      sortie = { type: "like", nombre: Math.max(1, ev.nombre || 1), utilisateur: personne(ev.utilisateur) };
    } else if (ev.type === "commentaire") {
      sortie = { type: "commentaire", texte: ev.texte || "", utilisateur: personne(ev.utilisateur) };
    } else if (ev.type === "abonnement" || ev.type === "partage" || ev.type === "arrivee") {
      sortie = { type: ev.type, utilisateur: personne(ev.utilisateur) };
    }
    if (sortie) { sortie.source = source; compteurs.evenements++; envoyer("evenement", sortie); }
  }

  function octetsDe(donnee, suite) {
    try {
      if (donnee instanceof ArrayBuffer) return suite(new Uint8Array(donnee));
      if (typeof Blob !== "undefined" && donnee instanceof Blob) {
        var fr = new FileReader();
        fr.onload = function () { suite(new Uint8Array(fr.result)); };
        fr.readAsArrayBuffer(donnee);
        return;
      }
      if (donnee && donnee.buffer instanceof ArrayBuffer) return suite(new Uint8Array(donnee.buffer, donnee.byteOffset, donnee.byteLength));
    } catch (e) { compteurs.erreurs++; }
  }

  function surTrame(octets) {
    compteurs.trames++;
    dernierBinaire = Date.now();
    try {
      var r = JL_dec.trame(octets);
      for (var i = 0; i < r.evenements.length; i++) traiter(r.evenements[i], "connexion");
    } catch (e) { compteurs.erreurs++; }
  }
  function surLot(octets) {
    compteurs.trames++;
    dernierBinaire = Date.now();
    try {
      var evs = JL_dec.lot(JL_dec.degzip(octets));
      for (var i = 0; i < evs.length; i++) traiter(evs[i], "recuperation");
    } catch (e) { compteurs.erreurs++; }
  }

  // 1) Connexion permanente (celle que la page TikTok ouvre elle-même)
  var WSOrigine = window.WebSocket;
  if (WSOrigine) {
    var WSEcoute = function (url, protocoles) {
      var ws = protocoles === undefined ? new WSOrigine(url) : new WSOrigine(url, protocoles);
      try {
        if (String(url).indexOf("webcast") !== -1 || String(url).indexOf("im/push") !== -1) {
          etat("connexion aux messages ouverte");
          ws.addEventListener("message", function (e) { if (typeof e.data !== "string") octetsDe(e.data, surTrame); });
          ws.addEventListener("close", function () { etat("connexion aux messages fermée"); });
        }
      } catch (e) { compteurs.erreurs++; }
      return ws;
    };
    WSEcoute.prototype = WSOrigine.prototype;
    WSEcoute.CONNECTING = 0; WSEcoute.OPEN = 1; WSEcoute.CLOSING = 2; WSEcoute.CLOSED = 3;
    window.WebSocket = WSEcoute;
  }

  // 2) Récupérations régulières (quand la page interroge au lieu de garder une connexion)
  function estUrlMessages(u) { u = String(u || ""); return u.indexOf("/webcast/im/fetch") !== -1; }
  if (window.fetch) {
    var fetchOrigine = window.fetch;
    window.fetch = function (entree, init) {
      var p = fetchOrigine.apply(this, arguments);
      try {
        var url = (entree && entree.url) ? entree.url : entree;
        if (estUrlMessages(url)) {
          p.then(function (rep) {
            try { rep.clone().arrayBuffer().then(function (b) { surLot(new Uint8Array(b)); }, function () { }); } catch (e) { }
          }, function () { });
        }
      } catch (e) { }
      return p;
    };
  }
  if (window.XMLHttpRequest) {
    var ouvrir = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, url) {
      try {
        if (estUrlMessages(url)) {
          this.addEventListener("load", function () {
            try { if (this.response instanceof ArrayBuffer) surLot(new Uint8Array(this.response)); } catch (e) { }
          });
        }
      } catch (e) { }
      return ouvrir.apply(this, arguments);
    };
  }

  // 3) Secours : lecture du texte affiché dans la discussion du live (seulement si rien n'arrive autrement)
  var motifCadeau = /^(.{1,40}?)\s*(?:a envoyé|sent|a offert)\s+(?:un |une |le |la |a |an )?(.{1,30}?)\s*(?:[x×]\s*(\d{1,4}))?\s*$/i;
  var vusTexte = {};
  function lireTexte(noeud) {
    if (Date.now() - dernierBinaire < 45000) return;
    var t = (noeud.innerText || noeud.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 90 || vusTexte[t]) return;
    var m = motifCadeau.exec(t);
    if (m) {
      vusTexte[t] = 1;
      compteurs.evenements++;
      envoyer("evenement", { type: "cadeau", nom: m[2], valeur: 1, nombre: m[3] ? parseInt(m[3], 10) : 1, utilisateur: { nom: m[1], pseudo: "", id: "" }, source: "texte" });
    }
  }
  function demarrerObservation() {
    if (!document.body || !window.MutationObserver) { setTimeout(demarrerObservation, 1000); return; }
    new MutationObserver(function (liste) {
      for (var i = 0; i < liste.length; i++) {
        var aj = liste[i].addedNodes;
        for (var j = 0; j < aj.length; j++) if (aj[j].nodeType === 1) lireTexte(aj[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  demarrerObservation();

  setInterval(function () { etat(dernierBinaire ? "messages reçus" : "en attente des messages du live"); }, 5000);
  etat("écoute installée");
})();
