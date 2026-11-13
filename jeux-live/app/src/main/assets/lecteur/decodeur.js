/* Jeux Live — décodeur des messages du live TikTok.
   Écrit sans dépendance (lecture brute du format binaire), compatible avec les vieux navigateurs Android.
   Numéros de champs relevés sur la description publique du format (messages Webcast). */
var JL_dec = (function () {
  function Lecteur(octets) { this.b = octets; this.p = 0; this.fin = octets.length; }
  Lecteur.prototype.varint = function () {
    // Renvoie un nombre (exact jusqu'à 2^53) et garde la forme brute pour les identifiants.
    var res = 0, mul = 1, o, debut = this.p;
    do {
      if (this.p >= this.fin) throw new Error("varint tronqué");
      o = this.b[this.p++];
      res += (o & 0x7f) * mul;
      mul *= 128;
    } while (o & 0x80);
    this.brut = debut;
    return res;
  };
  Lecteur.prototype.varintTexte = function () {
    var debut = this.p; this.varint();
    var s = ""; for (var i = debut; i < this.p; i++) s += (this.b[i] < 16 ? "0" : "") + this.b[i].toString(16);
    return s;
  };
  Lecteur.prototype.octets = function () {
    var n = this.varint();
    if (this.p + n > this.fin) throw new Error("longueur hors limites");
    var r = this.b.subarray(this.p, this.p + n); this.p += n; return r;
  };
  Lecteur.prototype.sauter = function (type) {
    if (type === 0) this.varint();
    else if (type === 1) this.p += 8;
    else if (type === 2) { var n = this.varint(); this.p += n; }
    else if (type === 5) this.p += 4;
    else throw new Error("type inconnu " + type);
  };

  // Parcourt un message : appelle f(numeroDeChamp, type, lecteur) ; f doit lire la valeur ou renvoyer false pour la sauter.
  function parcourir(octets, f) {
    var L = new Lecteur(octets);
    while (L.p < L.fin) {
      var cle = L.varint(), champ = Math.floor(cle / 8), type = cle & 7;
      if (f(champ, type, L) !== true) L.sauter(type);
    }
  }

  function texte(o) {
    try {
      if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(o);
    } catch (e) {}
    var s = ""; for (var i = 0; i < o.length; i++) s += "%" + (o[i] < 16 ? "0" : "") + o[i].toString(16);
    try { return decodeURIComponent(s); } catch (e2) { return ""; }
  }

  function degzip(o) {
    if (!(o.length > 18 && o[0] === 0x1f && o[1] === 0x8b && o[2] === 8)) return o;
    var drapeaux = o[3], p = 10;
    if (drapeaux & 4) { p += 2 + (o[p] | (o[p + 1] << 8)); }
    if (drapeaux & 8) { while (p < o.length && o[p] !== 0) p++; p++; }
    if (drapeaux & 16) { while (p < o.length && o[p] !== 0) p++; p++; }
    if (drapeaux & 2) p += 2;
    var n = o.length;
    var taille = (o[n - 4] | (o[n - 3] << 8) | (o[n - 2] << 16) | (o[n - 1] << 24)) >>> 0;
    var sortie = new Uint8Array(taille);
    JL_inflate(o.subarray(p, n - 8), sortie);
    return sortie;
  }

  function utilisateur(o) {
    var u = { id: "", nom: "", pseudo: "" };
    parcourir(o, function (c, t, L) {
      if (c === 1 && t === 0) { u.id = L.varintTexte(); return true; }
      if (c === 3 && t === 2) { u.nom = texte(L.octets()); return true; }
      if (c === 38 && t === 2) { u.pseudo = texte(L.octets()); return true; }
    });
    if (!u.nom) u.nom = u.pseudo || "Quelqu'un";
    return u;
  }

  function cadeauInfos(o) {
    var g = { nom: "", valeur: 0, type: 0, id: "" };
    parcourir(o, function (c, t, L) {
      if (c === 5 && t === 0) { g.id = String(L.varint()); return true; }
      if (c === 11 && t === 0) { g.type = L.varint(); return true; }
      if (c === 12 && t === 0) { g.valeur = L.varint(); return true; }
      if (c === 16 && t === 2) { g.nom = texte(L.octets()); return true; }
    });
    return g;
  }

  function messageCadeau(o) {
    var m = { type: "cadeau", idCadeau: "", repetition: 0, finSerie: 0, groupe: "", utilisateur: null, cadeau: null };
    parcourir(o, function (c, t, L) {
      if (c === 2 && t === 0) { m.idCadeau = String(L.varint()); return true; }
      if (c === 5 && t === 0) { m.repetition = L.varint(); return true; }
      if (c === 7 && t === 2) { m.utilisateur = utilisateur(L.octets()); return true; }
      if (c === 9 && t === 0) { m.finSerie = L.varint(); return true; }
      if (c === 11 && t === 0) { m.groupe = L.varintTexte(); return true; }
      if (c === 15 && t === 2) { m.cadeau = cadeauInfos(L.octets()); return true; }
    });
    return m;
  }
  function messageLike(o) {
    var m = { type: "like", nombre: 0, total: 0, utilisateur: null };
    parcourir(o, function (c, t, L) {
      if (c === 2 && t === 0) { m.nombre = L.varint(); return true; }
      if (c === 3 && t === 0) { m.total = L.varint(); return true; }
      if (c === 5 && t === 2) { m.utilisateur = utilisateur(L.octets()); return true; }
    });
    return m;
  }
  function messageCommentaire(o) {
    var m = { type: "commentaire", texte: "", utilisateur: null };
    parcourir(o, function (c, t, L) {
      if (c === 2 && t === 2) { m.utilisateur = utilisateur(L.octets()); return true; }
      if (c === 3 && t === 2) { m.texte = texte(L.octets()); return true; }
    });
    return m;
  }
  function messageSocial(o) {
    var m = { type: "social", action: 0, partage: 0, abonnes: 0, nbPartages: 0, utilisateur: null };
    parcourir(o, function (c, t, L) {
      if (c === 2 && t === 2) { m.utilisateur = utilisateur(L.octets()); return true; }
      if (c === 3 && t === 0) { m.partage = L.varint(); return true; }
      if (c === 4 && t === 0) { m.action = L.varint(); return true; }
      if (c === 6 && t === 0) { m.abonnes = L.varint(); return true; }
      if (c === 8 && t === 0) { m.nbPartages = L.varint(); return true; }
    });
    // action 1 = abonnement ; action 3 (ou un partage renseigné) = partage
    m.type = (m.action === 1) ? "abonnement" : ((m.action >= 2 || m.partage || m.nbPartages) ? "partage" : "social");
    return m;
  }
  function messageArrivee(o) {
    var m = { type: "arrivee", utilisateur: null };
    parcourir(o, function (c, t, L) {
      if (c === 2 && t === 2) { m.utilisateur = utilisateur(L.octets()); return true; }
    });
    return m;
  }

  var decodeurs = {
    WebcastGiftMessage: messageCadeau,
    WebcastLikeMessage: messageLike,
    WebcastChatMessage: messageCommentaire,
    WebcastSocialMessage: messageSocial,
    WebcastMemberMessage: messageArrivee
  };

  // Résultat d'une récupération (liste de messages)
  function lot(o) {
    var res = [];
    parcourir(o, function (c, t, L) {
      if (c === 1 && t === 2) {
        var msg = { methode: "", charge: null, id: "" };
        parcourir(L.octets(), function (c2, t2, L2) {
          if (c2 === 1 && t2 === 2) { msg.methode = texte(L2.octets()); return true; }
          if (c2 === 2 && t2 === 2) { msg.charge = L2.octets(); return true; }
          if (c2 === 3 && t2 === 0) { msg.id = L2.varintTexte(); return true; }
        });
        var d = decodeurs[msg.methode];
        if (d && msg.charge) {
          try { var ev = d(msg.charge); ev.idMessage = msg.id; ev.methode = msg.methode; res.push(ev); } catch (e) { }
        }
        return true;
      }
    });
    return res;
  }

  // Trame reçue par la connexion permanente
  function trame(o) {
    var f = { typeCharge: "", charge: null };
    parcourir(o, function (c, t, L) {
      if (c === 7 && t === 2) { f.typeCharge = texte(L.octets()); return true; }
      if (c === 8 && t === 2) { f.charge = L.octets(); return true; }
    });
    if (f.typeCharge !== "msg" || !f.charge) return { typeCharge: f.typeCharge, evenements: [] };
    return { typeCharge: "msg", evenements: lot(degzip(f.charge)) };
  }

  return { trame: trame, lot: lot, degzip: degzip, utilisateur: utilisateur };
})();
if (typeof module !== "undefined") module.exports = JL_dec;
