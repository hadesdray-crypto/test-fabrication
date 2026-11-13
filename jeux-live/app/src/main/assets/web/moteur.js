/* Jeux Live — moteur commun : affichage, événements du live, camps, classement, annonces, sons. */
var JL = (function () {
  var L = 720, H = 1280; // surface logique (format portrait du live)
  var canvas, ctx, echelle = 1, decX = 0, decY = 0, haut = 0;
  var jeu = null, enMarche = false, dernier = 0, temps = 0;
  var essai = false, solo = false;

  // ---------- Paliers de cadeaux (valeur en pièces TikTok) ----------
  function palier(valeur) {
    if (valeur >= 1000) return 4;
    if (valeur >= 100) return 3;
    if (valeur >= 10) return 2;
    return 1;
  }

  // ---------- Joueurs, camps et classement ----------
  var joueurs = {}; // cle -> {nom, camp, pieces, likes}
  function cleDe(u) { return u ? (u.id || u.pseudo || u.nom) : "?"; }
  function joueur(u) {
    var k = cleDe(u);
    if (!joueurs[k]) joueurs[k] = { nom: (u && u.nom) || "Quelqu'un", camp: null, pieces: 0, likes: 0 };
    else if (u && u.nom) joueurs[k].nom = u.nom;
    return joueurs[k];
  }
  function classement(n) {
    var t = [];
    for (var k in joueurs) if (joueurs[k].pieces > 0) t.push(joueurs[k]);
    t.sort(function (a, b) { return b.pieces - a.pieces; });
    return t.slice(0, n || 3);
  }
  function remiseAZeroManche() { for (var k in joueurs) { joueurs[k].pieces = 0; } }

  // ---------- Annonces à l'écran ----------
  var annonces = [];
  function annoncer(texte, couleur, duree, grand) {
    annonces.push({ texte: String(texte).slice(0, 60), couleur: couleur || "#ffffff", fin: temps + (duree || 2.6), debut: temps, grand: !!grand });
    if (annonces.length > 5) annonces.shift();
  }

  // ---------- Particules ----------
  var particules = [];
  function eclat(x, y, couleur, n, force) {
    n = Math.min(n || 12, 60);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (force || 300) * (0.3 + Math.random());
      particules.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, vie: 0.6 + Math.random() * 0.6, c: couleur || "#ffd34d", t: 3 + Math.random() * 6 });
    }
    if (particules.length > 600) particules.splice(0, particules.length - 600);
  }
  function majParticules(dt) {
    for (var i = particules.length - 1; i >= 0; i--) {
      var p = particules[i];
      p.vie -= dt; if (p.vie <= 0) { particules.splice(i, 1); continue; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function dessinerParticules(c, decalY) {
    for (var i = 0; i < particules.length; i++) {
      var p = particules[i];
      c.globalAlpha = Math.max(0, Math.min(1, p.vie * 1.5));
      c.fillStyle = p.c; c.fillRect(p.x - p.t / 2, p.y - p.t / 2 + (decalY || 0), p.t, p.t);
    }
    c.globalAlpha = 1;
  }

  // ---------- Explosions (image d'explosion si disponible) ----------
  var boums = [];
  function boum(x, y, taille) { boums.push({ x: x, y: y, t: temps, taille: taille || 120 }); if (boums.length > 20) boums.shift(); }
  function dessinerBoums(c) {
    for (var i = boums.length - 1; i >= 0; i--) {
      var b = boums[i], age = temps - b.t;
      if (age > 0.45) { boums.splice(i, 1); continue; }
      var k = 0.5 + age / 0.45 * 0.8, a = 1 - age / 0.45;
      if (!dessinerImage(c, "explosion.png", b.x, b.y, b.taille * k, { centre: true, alpha: a })) {
        var g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.taille * k / 2);
        g.addColorStop(0, "rgba(255,255,200," + a + ")"); g.addColorStop(0.4, "rgba(255,170,40," + a + ")"); g.addColorStop(1, "rgba(255,80,0,0)");
        c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.taille * k / 2, 0, 7); c.fill();
      }
    }
  }

  // ---------- Secousse de l'écran ----------
  var secousse = 0;
  function secouer(f) { secousse = Math.max(secousse, f); }

  // ---------- Sons (synthétisés, pas de musique ni de voix) ----------
  var audio = null, sonActif = true;
  function son(type) {
    if (!sonActif) return;
    try {
      if (!audio) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audio = new AC(); }
      if (audio.state === "suspended") audio.resume();
      var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      var r = { choc: [120, 60, "square", 0.25], bonus: [520, 1040, "triangle", 0.3], gros: [80, 30, "sawtooth", 0.6], victoire: [440, 1320, "triangle", 0.9], petit: [700, 900, "sine", 0.08] }[type] || [400, 400, "sine", 0.1];
      o.type = r[2]; o.frequency.setValueAtTime(r[0], t); o.frequency.exponentialRampToValueAtTime(r[1], t + r[3]);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + r[3]);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + r[3] + 0.02);
    } catch (e) { }
  }

  // ---------- File d'effets (évite de tout lancer d'un coup lors d'une grosse série) ----------
  var file = [], cadence = 0;
  function enFile(f) { if (file.length < 200) file.push(f); }
  function videFile(dt) {
    cadence -= dt;
    while (file.length && cadence <= 0) { var f = file.shift(); try { f(); } catch (e) { erreur(e); } cadence += file.length > 30 ? 0.05 : 0.18; }
    if (cadence < 0) cadence = 0;
  }

  // ---------- Réception des événements du live ----------
  var stats = { cadeaux: 0, pieces: 0, likes: 0, commentaires: 0, abonnements: 0, partages: 0 };
  var likesEnAttente = {};
  var ptsEquipe = [0, 0], acteurs = [{}, {}];
  var MOTS_AIDE = /c(œ|oe)ur|heart|love|amour|aime|bisou|kiss/i;
  function cadeauAide(ev) { return MOTS_AIDE.test(String(ev.nom || "")); }
  function recevoir(ev) {
    if (typeof ev === "string") { try { ev = JSON.parse(ev); } catch (e) { return; } }
    if (!ev || !ev.type || !jeu) return;
    var j = joueur(ev.utilisateur);
    if (ev.type === "commentaire") {
      stats.commentaires++;
      if (jeu.surCommentaire) jeu.surCommentaire(j, String(ev.texte || ""));
    } else if (ev.type === "cadeau") {
      var nb = Math.max(1, Math.min(ev.nombre || 1, 999)), val = Math.max(1, ev.valeur || 1);
      stats.cadeaux += nb; stats.pieces += nb * val; j.pieces += nb * val;
      // Personne ne choisit d'équipe : c'est le cadeau lui-même qui décide (cœur = aide, le reste = fait tomber)
      var aide = !solo && cadeauAide(ev);
      j.camp = jeu.equipes ? (aide ? jeu.equipes[0].cle : jeu.equipes[1].cle) : "bloque";
      if (jeu.equipes) { var cote = aide ? 0 : 1; ptsEquipe[cote] += nb * val; acteurs[cote][cleDe(ev.utilisateur)] = 1; }
      var p = palier(val);
      annoncer(j.nom + " : " + (ev.nom || "cadeau") + (nb > 1 ? " ×" + nb : "") + (jeu.equipes ? (aide ? " → aide" : " → attaque") : ""), jeu.equipes ? couleurCamp(j.camp) : ["#fff", "#ffe27a", "#ff9f43", "#ff5e7e", "#c084fc"][p], 2.4 + p * 0.4, p >= 3);
      var fois = p >= 3 ? Math.min(nb, 5) : Math.min(nb, 12);
      var campAction = j.camp;
      for (var i = 0; i < fois; i++) (function (jj, pp, vv, cc) { enFile(function () { var avant = jj.camp; jj.camp = cc; jeu.surCadeau(jj, pp, vv); jj.camp = avant; }); })(j, p, val, campAction);
    } else if (ev.type === "like") {
      var n = Math.max(1, Math.min(ev.nombre || 1, 500));
      stats.likes += n; j.likes += n;
      var k = "aide"; // les likes aident toujours
      if (jeu.equipes) { ptsEquipe[0] += n * 0.05; acteurs[0][cleDe(ev.utilisateur)] = 1; }
      likesEnAttente[k] = (likesEnAttente[k] || 0) + n;
    } else if (ev.type === "abonnement") {
      stats.abonnements++; annoncer("Merci " + j.nom + " pour l'abonnement !", "#7dd3fc", 2.5);
      if (jeu.surAbonnement) enFile(function () { jeu.surAbonnement(j); });
    } else if (ev.type === "partage") {
      stats.partages++; annoncer(j.nom + " a partagé le live !", "#86efac", 2.2);
      if (jeu.surPartage) enFile(function () { jeu.surPartage(j); });
    } else if (ev.type === "arrivee") {
      if (jeu.surArrivee) jeu.surArrivee(j);
    }
  }
  function distribuerLikes(dt) {
    for (var k in likesEnAttente) {
      var n = likesEnAttente[k];
      if (n > 0 && jeu.surLikes) { jeu.surLikes(k, n); }
      likesEnAttente[k] = 0;
    }
  }

  // ---------- Toucher du propriétaire (invisible pour les spectateurs : aucun bouton affiché) ----------
  var dernierToucher = -99;
  function versLogique(e) {
    var r = canvas.getBoundingClientRect();
    var px = (e.clientX - r.left) * (canvas.width / r.width), py = (e.clientY - r.top) * (canvas.height / r.height);
    return { x: (px - decX) / echelle, y: (py - decY) / echelle };
  }
  function proprietaireActif() { return temps - dernierToucher < 4; }

  // ---------- Dessin commun ----------
  function texteContour(c, t, x, y, taille, couleur, align) {
    c.font = "bold " + taille + "px sans-serif"; c.textAlign = align || "center"; c.textBaseline = "middle";
    c.lineJoin = "round"; c.lineWidth = Math.max(3, taille / 6); c.strokeStyle = "rgba(0,0,0,0.85)"; c.strokeText(t, x, y);
    c.fillStyle = couleur || "#fff"; c.fillText(t, x, y);
  }
  function cadreArrondi(c, x, y, w, h, r, fond) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath(); c.fillStyle = fond; c.fill();
  }
  function couleurCamp(camp) {
    if (jeu && jeu.equipes) for (var i = 0; i < jeu.equipes.length; i++) if (jeu.equipes[i].cle === camp) return jeu.equipes[i].couleur;
    return "#fff";
  }
  function dessinerEquipes(c) {
    if (!jeu.equipes) return;
    var e = jeu.equipes, pts = ptsEquipe, nb = [Object.keys(acteurs[0]).length, Object.keys(acteurs[1]).length];
    var total = pts[0] + pts[1], part = total > 0 ? pts[0] / total : 0.5;
    var x = 14, y = 142, w = L - 28, h = 50;
    cadreArrondi(c, x, y, w, h, 16, "rgba(0,0,0,0.55)");
    c.save(); c.beginPath(); c.rect(x + 6, y + 6, w - 12, h - 12); c.clip();
    c.fillStyle = e[0].couleur; c.fillRect(x + 6, y + 6, (w - 12) * part, h - 12);
    c.fillStyle = e[1].couleur; c.fillRect(x + 6 + (w - 12) * part, y + 6, (w - 12) * (1 - part), h - 12);
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x + 6, y + 6, w - 12, 10);
    c.restore();
    c.fillStyle = "#fff"; c.fillRect(x + 6 + (w - 12) * part - 2, y + 2, 4, h - 4);
    texteContour(c, e[0].nom + " " + Math.round(pts[0]) + " pts", x + 16, y + h / 2, 22, "#fff", "left");
    texteContour(c, Math.round(pts[1]) + " pts " + e[1].nom, x + w - 16, y + h / 2, 22, "#fff", "right");
  }
  function dessinerInterface(c) {
    dessinerEquipes(c);
    // Classement (le nom a la couleur de son équipe)
    var top = classement(3);
    if (top.length) {
      cadreArrondi(c, L - 250, 204, 236, 34 + top.length * 34, 14, "rgba(0,0,0,0.5)");
      texteContour(c, "Meilleurs soutiens", L - 132, 222, 20, "#ffe27a");
      for (var i = 0; i < top.length; i++) {
        var nom = top[i].nom.length > 13 ? top[i].nom.slice(0, 12) + "…" : top[i].nom;
        texteContour(c, (i + 1) + ". " + nom, L - 238, 256 + i * 34, 21, couleurCamp(top[i].camp), "left");
      }
    }
    // Annonces
    var y = 470;
    for (var a = annonces.length - 1; a >= 0; a--) {
      var an = annonces[a];
      if (an.fin < temps) { annonces.splice(a, 1); continue; }
      var age = temps - an.debut, alpha = Math.min(1, age * 5, (an.fin - temps) * 2);
      c.globalAlpha = Math.max(0, alpha);
      var taille = an.grand ? 40 : 30;
      texteContour(c, an.texte, L / 2, y, taille, an.couleur);
      y += taille + 14;
    }
    c.globalAlpha = 1;
    // Légende
    if (jeu.legende) {
      var lg = jeu.legende, h = 30 + lg.length * 30;
      cadreArrondi(c, 14, H - h - 14, L - 28, h, 16, "rgba(0,0,0,0.5)");
      for (var l = 0; l < lg.length; l++) texteContour(c, lg[l][0], L / 2, H - h + 2 + l * 30, 22, lg[l][1] || "#fff");
    }
    if (essai) { c.save(); c.translate(L / 2, H / 2); c.rotate(-0.5); c.globalAlpha = 0.18; texteContour(c, "MODE ESSAI", 0, 0, 110, "#fff"); c.restore(); c.globalAlpha = 1; }
  }

  // ---------- Boucle ----------
  var erreurs = 0, images = 0;
  function erreur(e) { erreurs++; try { console.log("JLERR " + (e && e.stack ? e.stack : e)); } catch (x) { } }
  var derniereImage = 0;
  function boucle(t) {
    if (!enMarche) return;
    requestAnimationFrame(boucle);
    image(t);
  }
  // Secours : si l'affichage du téléphone ne rythme pas les images, on avance quand même le jeu.
  setInterval(function () {
    if (!enMarche) return;
    var n = (window.performance && performance.now) ? performance.now() : Date.now();
    if (n - derniereImage > 250) image(n);
  }, 100);
  function image(t) {
    derniereImage = t;
    if (canvas && window.innerWidth && Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)) !== canvas.width) ajuster();
    if (!(echelle > 0) || !isFinite(haut)) ajuster();
    if (dernier && t < dernier) dernier = t;
    var dt = dernier ? Math.min(0.05, (t - dernier) / 1000) : 0.016;
    dernier = t; temps += dt; images++;
    try {
      videFile(dt);
      distribuerLikes(dt);
      jeu.maj(dt, temps);
      majParticules(dt);
      if (secousse > 0) secousse = Math.max(0, secousse - dt * 30);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = jeu.couleurFond || "#101828"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      var sx = secousse ? (Math.random() - 0.5) * secousse : 0, sy = secousse ? (Math.random() - 0.5) * secousse : 0;
      ctx.setTransform(echelle, 0, 0, echelle, decX + sx * echelle, decY + sy * echelle);
      ctx.save(); ctx.beginPath(); ctx.rect(0, -haut, L, H + haut); ctx.clip();
      jeu.dessiner(ctx, temps);
      dessinerBoums(ctx);
      dessinerInterface(ctx);
      ctx.restore();
    } catch (e) { erreur(e); }
  }
  function ajuster() {
    if (!canvas) return;
    var r = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) { echelle = 1; decX = 0; decY = 0; haut = 0; return; } // écran pas encore prêt : on réessaie à l'image suivante
    r = Math.min(r, 2);
    canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    echelle = Math.min(canvas.width / L, canvas.height / H);
    decX = (canvas.width - L * echelle) / 2; decY = canvas.height - H * echelle; // collé en bas : le décor du jeu remplit le haut de l'écran
    haut = decY / echelle;
  }

  function lancer(j, options) {
    options = options || {};
    canvas = document.getElementById("scene");
    ctx = canvas.getContext("2d");
    essai = !!options.essai;
    solo = !!options.solo && !j.toujoursEquipes;
    if (solo) { j.legendeEquipes = j.legendeEquipes || j.legende; j.equipesSauvees = j.equipesSauvees || j.equipes; j.legende = j.legendeSolo || j.legende; j.equipes = null; }
    else { if (j.legendeEquipes) j.legende = j.legendeEquipes; if (j.equipesSauvees) j.equipes = j.equipesSauvees; }
    sonActif = options.son !== false;
    jeu = j; joueurs = {}; annonces = []; particules = []; boums = []; ptsEquipe = [0, 0]; acteurs = [{}, {}]; file = []; temps = 0; dernier = 0; secousse = 0;
    stats = { cadeaux: 0, pieces: 0, likes: 0, commentaires: 0, abonnements: 0, partages: 0 };
    ajuster();
    jeu.init(api);
    if (!enMarche) { enMarche = true; requestAnimationFrame(boucle); }
  }
  function arreter() { enMarche = false; jeu = null; }

  // ---------- Images (personnages, objets, décors) ----------
  var IMG = {};
  function charger(noms) {
    noms.forEach(function (n) {
      if (IMG[n] !== undefined) return;
      IMG[n] = null;
      var im = new Image();
      im.onload = function () { IMG[n] = im; };
      im.onerror = function () { IMG[n] = false; };
      im.src = "img/" + n;
    });
  }
  function img(n) { return IMG[n] || null; }
  /** Dessine une image : ancre en bas au centre (ou au centre), hauteur voulue, miroir et rotation possibles. */
  function dessinerImage(c, n, x, y, h, o) {
    var im = IMG[n]; if (!im) return false;
    o = o || {};
    var w = h * im.width / im.height;
    c.save(); c.translate(x, y);
    if (o.rot) { c.translate(0, o.centre ? 0 : -h / 2); c.rotate(o.rot); c.translate(0, o.centre ? 0 : h / 2); }
    if (o.miroir) c.scale(-1, 1);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.drawImage(im, -w / 2, o.centre ? -h / 2 : -h, w, h);
    c.restore();
    return true;
  }
  /** Décor plein écran (recadré pour remplir) ; renvoie le rectangle où il est dessiné. */
  var caches = {};
  function fond(c, n) {
    var im = IMG[n]; if (!im) return null;
    var hz = H + haut, ech = Math.max(L / im.width, hz / im.height);
    var w = im.width * ech, h = im.height * ech, x = (L - w) / 2, y = -haut + (hz - h) / 2;
    // Décor redimensionné une seule fois à la taille de l'écran (bien plus rapide à chaque image)
    var px = Math.max(1, Math.round(w * echelle)), py = Math.max(1, Math.round(h * echelle));
    var k = caches[n];
    if (!k || k.w !== px || k.h !== py) {
      try {
        var cv = document.createElement("canvas"); cv.width = px; cv.height = py;
        cv.getContext("2d").drawImage(im, 0, 0, px, py);
        k = caches[n] = { w: px, h: py, cv: cv };
      } catch (e) { k = null; }
    }
    c.drawImage(k ? k.cv : im, x, y, w, h);
    return { x: x, y: y, w: w, h: h };
  }

  var api = {
    L: L, H: H, annoncer: annoncer, eclat: eclat, secouer: secouer, son: son, palier: palier,
    texte: function (t, x, y, taille, couleur, align) { texteContour(ctx, t, x, y, taille, couleur, align); }, cadre: cadreArrondi, classement: classement, joueurs: function () { return joueurs; },
    proprietaireActif: proprietaireActif, particules: dessinerParticules, remiseAZeroManche: function () { remiseAZeroManche(); ptsEquipe = [0, 0]; acteurs = [{}, {}]; },
    temps: function () { return temps; }, haut: function () { return haut; },
    charger: charger, img: img, image: dessinerImage, fond: fond, boum: boum
  };

  window.addEventListener("resize", ajuster);
  document.addEventListener("pointerdown", function (e) {
    if (!enMarche || !jeu || !canvas || e.target !== canvas) return;
    dernierToucher = temps;
    var p = versLogique(e);
    if (jeu.surToucher) try { jeu.surToucher(p.x, p.y); } catch (er) { erreur(er); }
  });

  return {
    lancer: lancer, arreter: arreter, recevoir: recevoir, api: api,
    stats: function () { return { stats: stats, erreurs: erreurs, images: images, temps: temps, jeu: jeu ? jeu.nom : null }; },
    enMarche: function () { return enMarche; }
  };
})();
