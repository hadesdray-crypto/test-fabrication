/* ============================================================
   5) L'ASCENSION — 1000 niveaux : l'océan, le ciel, les nuages, l'espace, puis le trou noir.
   Le personnage monte tout seul. Cadeau avec un cœur = aide (BLEUS), autres cadeaux = le font tomber (ROUGES), likes = aide.
   La progression est gardée d'un live à l'autre ; chaque monde atteint sert de point de sauvegarde.
   ============================================================ */
A.charger(["asc-poisson.png", "asc-pieuvre.png", "asc-algues.png", "asc-tortue.png",
  "asc-mouette.png", "asc-montgolfiere.png", "asc-cerf-volant.png", "asc-avion.png",
  "asc-nuage.png", "asc-nuage-or.png", "asc-dirigeable.png", "asc-aigle.png",
  "asc-asteroide.png", "asc-satellite.png", "asc-planete.png", "asc-soucoupe.png",
  "asc-ancre.png", "asc-meduse.png", "asc-rocher-algues.png", "asc-bulle.png",
  "asc-grelon.png", "asc-eclair.png", "asc-orage.png", "asc-arc-en-ciel.png",
  "asc-meteorite.png", "asc-caillou.png", "asc-debris.png", "asc-comete.png",
  "asc-trou-noir.png", "asc-etoile.png", "asc-jetpack.png", "asc-balise.png"]);

JEUX.ascension = (function () {
  var J, plates, heros, camera, objets, record, plancher, bouclier, jaugeAide, aspiration, victoires, departManche, sauvegardeA;
  var ESPACE = 130, NIVEAUX = 1000;
  var MONDES = [
    { nom: "LA NAPPE PHRÉATIQUE", debut: 0, plates: ["asc-poisson.png", "asc-pieuvre.png", "asc-algues.png", "asc-tortue.png"], bouge: [1, 0, 0, 1], couleur: "#38bdf8",
      chute: ["asc-ancre.png", "asc-meduse.png"], gros: "COURANT GLACÉ !", enorme: "TEMPÊTE SOUTERRAINE !" },
    { nom: "LE CONDUIT DU VOLCAN", debut: 200, plates: ["basalte"], bouge: [0], couleur: "#fb923c",
      chute: ["asc-meteorite.png", "asc-meteorite.png"], gros: "JET DE LAVE !", enorme: "COULÉE DE LAVE !" },
    { nom: "LA MONTAGNE", debut: 260, plates: ["rebord.png"], bouge: [0], couleur: "#86efac",
      chute: ["pierre.png", "gros-rocher.png"], gros: "ÉBOULEMENT !", enorme: "AVALANCHE !" },
    { nom: "LE CIEL", debut: 500, plates: ["asc-mouette.png", "asc-montgolfiere.png", "asc-cerf-volant.png", "asc-avion.png", "asc-nuage.png", "asc-nuage-or.png", "asc-dirigeable.png", "asc-aigle.png"], bouge: [1, 1, 1, 1, 0, 0, 1, 1], couleur: "#7dd3fc",
      chute: ["asc-grelon.png", "asc-eclair.png"], gros: "ORAGE !", enorme: "TORNADE !" },
    { nom: "L'ESPACE", debut: 750, plates: ["asc-asteroide.png", "asc-satellite.png", "asc-planete.png", "asc-soucoupe.png"], bouge: [0, 1, 0, 1], couleur: "#c4b5fd",
      chute: ["asc-meteorite.png", "asc-debris.png"], gros: "PLUIE DE MÉTÉORITES !", enorme: "SUPERNOVA !" }
  ];
  function mondeDe(n) { return n >= 750 ? 4 : (n >= 500 ? 3 : (n >= 260 ? 2 : (n >= 200 ? 1 : 0))); }
  var zoomDebut = -99, alertes = {};

  // Tirage pseudo-aléatoire fixe : le parcours est toujours le même, d'un live à l'autre.
  var graine = 1;
  function alea() { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; }

  function creerPlates() {
    plates = []; graine = 20261113;
    var x = 360;
    for (var i = 0; i <= NIVEAUX; i++) {
      if (i > 0) x = borne(x + (alea() * 2 - 1) * 220, 120, 600);
      var mi = mondeDe(i), m = MONDES[i >= 185 && i < 200 ? 1 : mi], k = Math.floor(alea() * m.plates.length);
      plates.push({ i: i, bx: i === 0 ? 360 : x, x: x, y: -i * ESPACE, l: i === 0 ? 700 : 150 + alea() * 50,
        img: m.plates[k], bouge: i > 0 && m.bouge[k] ? (20 + alea() * 50) : 0, phase: alea() * 6.28, vitesse: 0.4 + alea() * 0.6 });
    }
  }
  function charger() {
    try { var s = JSON.parse(localStorage.getItem("ascension") || "null"); if (s) return s; } catch (e) { }
    return { plancher: 0, record: 0, victoires: 0 };
  }
  function sauver() {
    try { localStorage.setItem("ascension", JSON.stringify({ plancher: plancher, record: record, victoires: victoires })); } catch (e) { }
  }
  function niveauHeros() { return Math.max(0, Math.round(-heros.y / ESPACE)); }

  function placerSur(i) {
    var p = plates[i];
    heros = { x: p.x, y: p.y, vx: 0, vy: 0, sol: true, plate: i, regard: 1, etourdi: 0, attente: 1, propulsion: 0, chute: 0 };
    camera = heros.y - 820;
  }
  function nouvelleAventure() {
    alertes = {}; plancher = 0; objets = []; bouclier = 0; jaugeAide = 0; aspiration = 0;
    placerSur(0); departManche = J.temps(); sauver();
  }

  function sauterVers(cible) {
    var dx = cible.x - heros.x, dy = cible.y - heros.y;
    var vy = -Math.sqrt(2 * 2200 * Math.max(60, -dy + 70));
    var tVol = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * 2200 * dy))) / 2200;
    heros.vx = dx / Math.max(0.3, tVol); heros.vy = vy; heros.sol = false; heros.plate = -1; heros.regard = dx >= 0 ? 1 : -1;
  }
  function frapper(force) {
    if (bouclier > 0) { bouclier = Math.max(0, bouclier - 2.5); J.eclat(heros.x, heros.y - 60 - camera, "#7dd3fc", 14, 260); J.son("petit"); return; }
    heros.sol = false; heros.plate = -1; heros.vy = -300; heros.vx = (Math.random() < 0.5 ? -1 : 1) * hasard(200, 380) * force;
    heros.etourdi = 1.2 * force; heros.chute = force; J.secouer(8 * force); J.son("choc");
    J.eclat(heros.x, heros.y - 60 - camera, "#e2e8f0", 18, 320);
  }
  function lacher(gros) {
    var m = MONDES[mondeDe(niveauHeros())];
    var img = m.chute[gros ? 1 : 0];
    objets.push({ img: img, x: borne(heros.x + hasard(-110, 110), 40, 680), y: heros.y - 950, vy: gros ? 380 : hasard(220, 380), r: gros ? 40 : 26, rot: hasard(0, 6) });
  }

  // Couleur du fond selon l'altitude
  var TEINTES = [[0, [4, 20, 40], [6, 40, 70]], [150, [6, 50, 90], [10, 70, 110]], [168, [80, 30, 45], [120, 40, 40]], [185, [120, 30, 10], [200, 70, 10]],
    [200, [50, 8, 4], [150, 35, 0]], [259, [90, 20, 5], [210, 80, 10]], [263, [251, 146, 60], [254, 215, 170]], [320, [59, 130, 246], [186, 230, 253]],
    [499, [70, 150, 240], [190, 225, 250]], [700, [40, 50, 130], [90, 80, 170]], [780, [8, 6, 30], [25, 15, 60]], [1000, [2, 2, 12], [20, 5, 40]]];
  function teinte(niv, haut) {
    for (var i = 0; i < TEINTES.length - 1; i++) {
      var a = TEINTES[i], b = TEINTES[i + 1];
      if (niv <= b[0]) { var k = borne((niv - a[0]) / (b[0] - a[0]), 0, 1), ca = haut ? a[1] : a[2], cb = haut ? b[1] : b[2];
        return "rgb(" + Math.round(ca[0] + (cb[0] - ca[0]) * k) + "," + Math.round(ca[1] + (cb[1] - ca[1]) * k) + "," + Math.round(ca[2] + (cb[2] - ca[2]) * k) + ")"; }
    }
    return "rgb(2,2,12)";
  }
  var deco = [];
  for (var d = 0; d < 60; d++) deco.push({ x: Math.random() * 720, y: Math.random() * 1600, v: 0.2 + Math.random() * 0.8, t: 2 + Math.random() * 6 });

  function largeurParoi(y) { return 60 + 30 * Math.sin(y / 170) + 18 * Math.sin(y / 53); }
  function dessinerParois(c, t, yHaut, yBas) {
    var fin = -260 * ESPACE;
    var y0 = Math.max(yHaut, fin), y1 = Math.min(yBas, 300);
    if (y0 >= y1) return;
    for (var cote = 0; cote < 2; cote++) {
      c.beginPath();
      var x0 = cote ? J.L : 0; c.moveTo(x0, y0);
      for (var y = y0; y <= y1; y += 30) { var w = largeurParoi(y + cote * 400), x = cote ? J.L - w : w; c.lineTo(x, y); }
      c.lineTo(x0, y1); c.closePath();
      var niv = -((y0 + y1) / 2) / ESPACE, chaud = borne((niv - 150) / 60, 0, 1);
      c.fillStyle = chaud > 0.5 ? "#1c1210" : "#1e293b"; c.fill();
      c.lineWidth = 6; c.strokeStyle = chaud > 0.3 ? "rgba(251,113,40," + (0.5 + 0.4 * Math.sin(t * 2)) + ")" : "#0f172a"; c.stroke();
    }
    // Bord du cratère au niveau 260
    if (fin > yHaut && fin < yBas) {
      c.fillStyle = "#292524";
      c.beginPath(); c.moveTo(0, fin + 40); c.lineTo(110, fin - 30); c.lineTo(170, fin + 10); c.lineTo(170, fin + 60); c.lineTo(0, fin + 120); c.fill();
      c.beginPath(); c.moveTo(J.L, fin + 40); c.lineTo(J.L - 110, fin - 30); c.lineTo(J.L - 170, fin + 10); c.lineTo(J.L - 170, fin + 60); c.lineTo(J.L, fin + 120); c.fill();
    }
  }
  function dessinerPlate(c, p, t) {
    if (p.img === "basalte") {
      var l = p.l, g = c.createRadialGradient(p.x, p.y + 30, 10, p.x, p.y + 30, l * 0.7);
      g.addColorStop(0, "rgba(255,120,20,0.45)"); g.addColorStop(1, "rgba(255,80,0,0)");
      c.fillStyle = g; c.fillRect(p.x - l, p.y - 20, l * 2, 100);
      c.fillStyle = "#292524"; c.beginPath(); c.moveTo(p.x - l / 2, p.y - 4); c.lineTo(p.x + l / 2, p.y - 4); c.lineTo(p.x + l / 2 - 16, p.y + 26); c.lineTo(p.x + l * 0.1, p.y + 44); c.lineTo(p.x - l / 2 + 12, p.y + 24); c.closePath(); c.fill();
      c.lineWidth = 4; c.strokeStyle = "#0c0a09"; c.stroke();
      c.strokeStyle = "rgba(251,146,60," + (0.6 + 0.4 * Math.sin(t * 3 + p.i)) + ")"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(p.x - l * 0.3, p.y + 6); c.lineTo(p.x - l * 0.1, p.y + 20); c.lineTo(p.x + l * 0.05, p.y + 10); c.lineTo(p.x + l * 0.25, p.y + 24); c.stroke();
      c.fillStyle = "#57534e"; c.fillRect(p.x - l / 2 + 2, p.y - 6, l - 4, 5);
      return;
    }
    if (p.img === "rebord.png") { rebord(c, p.x, p.y, p.l, false, false); return; }
    var im = A.img(p.img);
    if (im) {
      var w = p.l * 0.95, h = w * im.height / im.width;
      if (h > 115) { w = w * 115 / h; h = 115; }
      c.drawImage(im, p.x - w / 2, p.y - h * 0.22, w, h);
      return;
    }
    var m = mondeDe(p.i), l = p.l;
    if (m === 4) m = 3; else if (m === 3) m = 2;
    if (m === 0) { c.fillStyle = "#fb923c"; c.beginPath(); c.ellipse(p.x, p.y + 14, l / 2, 18, 0, 0, 7); c.fill(); c.strokeStyle = "#7c2d12"; c.lineWidth = 3; c.stroke(); }
    else if (m === 3) { boule(c, p.x, p.y + 16, l / 2.6, "#a8a29e", "#44403c"); }
    else { c.fillStyle = "#f8fafc"; for (var k = -2; k <= 2; k++) { c.beginPath(); c.arc(p.x + k * l / 6, p.y + 12, l / 6 + (k === 0 ? 8 : 0), 0, 7); c.fill(); } }
  }

  var jeu = {
    nom: "L'Ascension", couleurFond: "#04101f", campParDefaut: "bloque", equipes: EQUIPES_AB,
    legende: [
      ["Cadeau avec un cœur : m'aide à monter (BLEUS)", "#93c5fd"],
      ["Autres cadeaux : me font tomber (ROUGES)", "#fca5a5"],
      ["Nappe · volcan · montagne · ciel · espace · trou noir", "#e2e8f0"],
      ["Les likes m'aident à sauter plus haut", "#cbd5e1"]
    ],
    legendeSolo: [["Chacun pour soi : tout le monde contre moi !", "#ffe27a"], ["Cadeaux : ancres, lave, rochers, éclairs, météorites…", "#fca5a5"], ["Vos likes me font monter", "#93c5fd"], ["Objectif : le trou noir au niveau 1000", "#cbd5e1"]],
    init: function (api) {
      J = api; creerPlates();
      var s = charger(); record = s.record || 0; victoires = s.victoires || 0; plancher = borne(s.plancher || 0, 0, NIVEAUX - 1);
      objets = []; bouclier = 0; jaugeAide = 0; aspiration = 0; departManche = J.temps(); sauvegardeA = 0;
      alertes = {}; zoomDebut = -99; [150, 168, 185].forEach(function (n) { if (plancher > n) alertes[n] = 1; }); if (plancher >= 260) alertes.eruption = 1;
      placerSur(plancher);
      if (plancher > 0) J.annoncer("On reprend au niveau " + plancher + " !", "#ffe27a", 4, true);
    },
    surCadeau: function (j, p) {
      if (aspiration) return;
      if (j.camp === "aide") {
        if (p === 1) { bouclier = Math.min(12, bouclier + 4); J.son("bonus"); }
        else if (p === 2) { heros.propulsion += 3; J.son("bonus"); }
        else if (p === 3) { plancher = Math.max(plancher, niveauHeros()); heros.propulsion += 6; sauver(); J.annoncer("Balise posée au niveau " + plancher + " : plus de chute en dessous !", "#93c5fd", 3); J.son("bonus"); }
        else { heros.propulsion += 25; bouclier = 15; J.annoncer("FUSÉE ! +25 niveaux", "#c084fc", 3, true); J.son("victoire"); }
      } else {
        var m = MONDES[mondeDe(niveauHeros())];
        if (p === 1) lacher(false);
        else if (p === 2) lacher(true);
        else if (p === 3) { J.annoncer(m.gros, "#ff9f43", 2.5, true); frapper(1.8); for (var k = 0; k < 4; k++) lacher(true); }
        else { J.annoncer(m.enorme, "#ff5e7e", 3, true); for (var a = 0; a < 10; a++) lacher(true); frapper(3); }
      }
    },
    surLikes: function (camp, n) { jaugeAide += n; if (jaugeAide >= 60) { jaugeAide -= 60; heros.propulsion += 2; J.annoncer("Les likes me font monter !", "#93c5fd", 1.8); } },
    surAbonnement: function () { bouclier = Math.min(12, bouclier + 3); },
    surPartage: function () { heros.propulsion += 1; },
    surToucher: function (x) {
      if (!heros.sol || heros.etourdi > 0 || aspiration) return;
      var dir = x < 360 ? -1 : 1, cible = null;
      for (var i = Math.max(0, heros.plate + 1); i <= Math.min(NIVEAUX, heros.plate + 2); i++) { var p = plates[i]; if (!cible || (dir < 0 ? p.x < cible.x : p.x > cible.x)) cible = p; }
      if (cible) sauterVers(cible);
    },
    maj: function (dt, t) {
      // Plateformes vivantes : poissons, oiseaux, avions… se déplacent ; le personnage dessus bouge avec.
      var bas = niveauHeros() - 12, hautN = niveauHeros() + 14;
      for (var i = Math.max(1, bas); i <= Math.min(NIVEAUX, hautN); i++) {
        var p = plates[i]; if (!p.bouge) continue;
        var nx = borne(p.bx + Math.sin(t * p.vitesse + p.phase) * p.bouge, 90, 630);
        if (heros.sol && heros.plate === i) heros.x += nx - p.x;
        p.x = nx;
      }
      if (aspiration) {
        // Le trou noir aspire le personnage en spirale
        aspiration += dt;
        var cx = 360, cy = plates[NIVEAUX].y - 360, ang = aspiration * 6, rayon = Math.max(0, 260 - aspiration * 70);
        heros.x = cx + Math.cos(ang) * rayon; heros.y = cy + Math.sin(ang) * rayon * 0.4;
        camera += (cy - 640 - camera) * Math.min(1, dt * 3);
        if (aspiration > 4.5) { victoires++; nouvelleAventure(); J.annoncer("Nouvelle aventure ! Retour à la nappe phréatique", "#38bdf8", 4, true); }
        return;
      }
      if (bouclier > 0) bouclier = Math.max(0, bouclier - dt);
      if (heros.etourdi > 0) heros.etourdi -= dt;
      if (heros.propulsion > 0) {
        heros.sol = false; heros.plate = -1; heros.vy = -1300; heros.vx = (360 - heros.x) * 0.8;
        heros.propulsion = Math.max(0, heros.propulsion - dt * 6);
        if (Math.random() < 0.6) J.eclat(heros.x, heros.y - camera + 10, mondeDe(niveauHeros()) === 0 ? "#bae6fd" : "#ffb347", 2, 120);
      }
      if (heros.sol && heros.etourdi <= 0 && !J.proprietaireActif()) {
        heros.attente -= dt;
        if (heros.attente <= 0) { var suiv = plates[Math.min(NIVEAUX, heros.plate + 1)]; if (suiv.i !== heros.plate) sauterVers(suiv); heros.attente = hasard(0.5, 1.2); }
      }
      if (!heros.sol) {
        var ancienY = heros.y;
        heros.vy += 2200 * dt; heros.x += heros.vx * dt; heros.y += heros.vy * dt;
        if (heros.x < 30) { heros.x = 30; heros.vx = Math.abs(heros.vx) * 0.5; }
        if (heros.x > 690) { heros.x = 690; heros.vx = -Math.abs(heros.vx) * 0.5; }
        if (heros.vy > 0) {
          var nh = niveauHeros();
          for (var k = Math.max(0, nh - 3); k <= Math.min(NIVEAUX, nh + 3); k++) {
            var q = plates[k];
            if (heros.chute > 1.2 && q.i > plancher && q.i > nh - 3) continue;
            if (ancienY <= q.y && heros.y >= q.y && Math.abs(heros.x - q.x) <= q.l / 2 + 10) {
              heros.y = q.y; heros.vy = 0; heros.vx = 0; heros.sol = true; heros.plate = q.i; heros.attente = 0.5; heros.chute = 0; break;
            }
          }
          var pl = plates[plancher];
          if (!heros.sol && heros.y > pl.y) { heros.x = pl.x; heros.y = pl.y; heros.vy = 0; heros.sol = true; heros.plate = plancher; heros.chute = 0; }
        }
        if (heros.chute && heros.vy > 600) heros.chute = Math.max(0, heros.chute - dt);
      }
      for (var o = objets.length - 1; o >= 0; o--) {
        var ob = objets[o]; ob.vy += 700 * dt; ob.y += ob.vy * dt; ob.rot += dt * 2;
        var dx = ob.x - heros.x, dy = ob.y - (heros.y - 60);
        if (dx * dx + dy * dy < (ob.r + 34) * (ob.r + 34)) { J.boum(ob.x, ob.y - camera, 150); frapper(ob.r > 30 ? 1.4 : 1); objets.splice(o, 1); continue; }
        if (ob.y > heros.y + 900) objets.splice(o, 1);
      }
      camera += (heros.y - 820 - camera) * Math.min(1, dt * 4);
      var niv = niveauHeros();
      if (niv > record) record = niv;
      // Nouveau monde atteint : point de sauvegarde
      var m = mondeDe(niv);
      if (heros.sol && MONDES[m].debut > plancher) {
        plancher = MONDES[m].debut; sauver(); zoomDebut = t;
        J.annoncer("STADE " + (m + 1) + " : " + MONDES[m].nom, MONDES[m].couleur, 5, true); J.son("victoire"); J.secouer(m === 1 ? 24 : 10);
        if (m === 1) J.annoncer("Le volcan se réveille…", "#fdba74", 5);
      }
      // L'eau de la nappe se réchauffe à l'approche du volcan
      [[150, "L'eau commence à bouillir…", "#bae6fd"], [168, "L'eau devient rouge !", "#fca5a5"], [185, "De la LAVE ! Le volcan est tout près !", "#fb923c"]].forEach(function (a) {
        if (niv >= a[0] && !alertes[a[0]]) { alertes[a[0]] = 1; J.annoncer(a[1], a[2], 4, true); J.secouer(10); zoomDebut = t; }
      });
      // Dans le conduit, le sol tremble régulièrement
      if (m === 1 && Math.random() < dt * 0.4) J.secouer(6);
      // En haut du conduit : ÉRUPTION, le personnage est projeté sur la montagne
      if (heros.sol && heros.plate === 259 && !alertes.eruption) {
        alertes.eruption = 1; heros.propulsion += 5; zoomDebut = t;
        J.annoncer("ÉRUPTION !", "#f97316", 4, true); J.secouer(30); J.son("gros");
        for (var e = 0; e < 6; e++) J.eclat(hasard(150, 570), heros.y - camera, ["#f97316", "#facc15", "#ef4444"][e % 3], 30, 600);
        J.boum(360, heros.y - camera - 60, 400);
      }
      if (t - sauvegardeA > 5) { sauvegardeA = t; sauver(); }
      if (heros.sol && heros.plate === NIVEAUX) {
        aspiration = 0.001; heros.etourdi = 0;
        J.annoncer("LE TROU NOIR M'ASPIRE !", "#c084fc", 5, true); J.annoncer("Victoire de tout le live !", "#ffd34d", 5); J.son("victoire");
      }
    },
    dessiner: function (c, t) {
      var nivCam = borne(-(camera + 640) / ESPACE, 0, NIVEAUX);
      var g = c.createLinearGradient(0, -J.haut(), 0, J.H);
      g.addColorStop(0, teinte(nivCam + 5, true)); g.addColorStop(1, teinte(nivCam, false));
      c.fillStyle = g; c.fillRect(0, -J.haut(), J.L, J.H + J.haut());
      // Décor qui défile : bulles (qui bouillent près du volcan), montagnes, nuages, étoiles
      for (var i = 0; i < deco.length; i++) {
        var dd = deco[i], y = ((dd.y - camera * dd.v * 0.3) % 1600 + 1600) % 1600 - J.haut() - 100;
        if (nivCam < 200) {
          var bout = borne((nivCam - 145) / 40, 0, 1);
          c.strokeStyle = bout > 0.5 ? "rgba(254,202,202,0.55)" : "rgba(186,230,253,0.45)"; c.lineWidth = 2;
          c.beginPath(); c.arc(dd.x + Math.sin(t * (1 + bout * 6) + i) * (6 + bout * 10), y - (t * 40 * dd.v * (1 + bout * 4)) % 1600, dd.t * (1 + bout), 0, 7); c.stroke();
        } else if (nivCam < 260) {
          if (i % 2) { c.fillStyle = "rgba(255," + (120 + i % 80) + ",0," + (0.4 + 0.4 * Math.sin(t * 5 + i)) + ")"; c.fillRect(dd.x, y - (t * 120 * dd.v) % 1600, 4, 4); }
        } else if (nivCam < 500) {
          if (i < 3) { c.fillStyle = "rgba(30,41,59," + (0.35 - i * 0.08) + ")"; c.beginPath(); c.moveTo(0, J.H); for (var mx = 0; mx <= J.L; mx += 60) c.lineTo(mx, 560 + i * 140 + Math.sin(mx * 0.013 + i * 2) * 120 + Math.sin(mx * 0.05) * 30); c.lineTo(J.L, J.H); c.fill(); }
        } else if (nivCam < 740) {
          if (i % 4 === 0) { c.fillStyle = "rgba(255,255,255," + (0.25 + 0.2 * dd.v) + ")"; for (var k = -1; k <= 1; k++) { c.beginPath(); c.arc(dd.x + k * 26 * dd.v * 2, y, 22 * dd.v * 2, 0, 7); c.fill(); } }
        }
        if (nivCam > 700) { c.fillStyle = "rgba(255,255,255," + borne((nivCam - 700) / 80, 0, 1) * (0.4 + 0.6 * Math.abs(Math.sin(t * dd.v + i))) + ")"; c.fillRect(dd.x, y, 2 + dd.t / 3, 2 + dd.t / 3); }
      }
      // Zoom arrière lors d'un nouveau stade : on voit d'où vient le personnage et où il va
      var age = t - zoomDebut, z = 1;
      if (age >= 0 && age < 6) z = age < 1 ? 1 - 0.62 * age : (age < 5 ? 0.38 : 0.38 + 0.62 * (age - 5));
      var hy = heros.y - camera;
      c.save(); c.translate(360, hy); c.scale(z, z); c.translate(-360, -hy);
      c.save(); c.translate(0, -camera);
      dessinerParois(c, t, camera - 3000, camera + J.H + 3000);
      // Trou noir au-dessus du niveau 1000
      var yTrou = plates[NIVEAUX].y - 360;
      if (yTrou - camera > -J.haut() - 500 && yTrou - camera < J.H + 300) {
        if (!A.image(c, "asc-trou-noir.png", 360, yTrou, 520, { centre: true, rot: t * 0.4 })) {
          for (var r = 7; r >= 1; r--) { c.fillStyle = "rgba(" + (200 - r * 15) + "," + (80 + r * 10) + ",255," + (0.12 + 0.05 * (7 - r)) + ")"; c.beginPath(); c.ellipse(360, yTrou, 70 + r * 32, 26 + r * 10, Math.sin(t) * 0.1, 0, 7); c.fill(); }
          c.fillStyle = "#000"; c.beginPath(); c.arc(360, yTrou, 70, 0, 7); c.fill();
        }
      }
      // Plateformes
      var nh = niveauHeros();
      var portee = z < 1 ? 26 : 12;
      for (var j = Math.max(0, nh - portee); j <= Math.min(NIVEAUX, nh + portee); j++) {
        var p = plates[j];
        if (j === 0) { c.fillStyle = "#1e293b"; c.fillRect(0, p.y, J.L, 300); c.fillStyle = "#334155"; c.fillRect(0, p.y, J.L, 10); continue; }
        dessinerPlate(c, p, t);
        if (p.i === plancher && plancher > 0 && !A.image(c, "asc-balise.png", p.x + 40, p.y + 4, 80)) drapeauVert(c, p.x + 40, p.y - 4);
        if (p.i % 50 === 0) J.texte("Niveau " + p.i, 40, p.y - 24, 22, "#fef3c7", "left");
      }
      for (var o = 0; o < objets.length; o++) {
        var ob = objets[o];
        var tourne = /grelon|caillou|debris/.test(ob.img);
        if (!A.image(c, ob.img, ob.x, ob.y, ob.r * 2.6, { centre: true, rot: tourne ? ob.rot : Math.sin(ob.rot * 2) * 0.12 })) rocher(c, ob.x, ob.y, ob.r, ob.rot, ob.r > 30);
      }
      // Personnage
      var nomImg = aspiration ? "grimpeur-chute.png" : (heros.etourdi > 0 && !heros.sol ? "grimpeur-chute.png" : (heros.sol ? "grimpeur-debout.png" : "grimpeur-saut.png"));
      var taille = aspiration ? Math.max(20, 150 - aspiration * 30) : 140;
      if (heros.propulsion > 0) A.image(c, "asc-jetpack.png", heros.x - 26, heros.y - 50, 90, { centre: true });
      if (!A.image(c, nomImg, heros.x, heros.y + 6, taille, { miroir: heros.regard < 0 && nomImg !== "grimpeur-debout.png", rot: aspiration ? aspiration * 8 : (nomImg === "grimpeur-chute.png" ? Math.sin(t * 8) * 0.6 : 0) })) {
        c.fillStyle = "#ef4444"; c.fillRect(heros.x - 18, heros.y - 62, 36, 40); c.fillStyle = "#fcd34d"; c.beginPath(); c.arc(heros.x, heros.y - 76, 17, 0, 7); c.fill();
      }
      if (bouclier > 0) { if (!A.image(c, "asc-bulle.png", heros.x, heros.y - 66, 190, { centre: true, alpha: 0.6 })) bulle(c, heros.x, heros.y - 66, 85, t); }
      if (nivCam < 245 && Math.random() < 0.08) J.eclat(heros.x + 10, heros.y - 120 - camera, "#bae6fd", 1, 40);
      c.restore();
      c.restore();
      J.particules(c, 0);
      // Barre du haut
      var niv = Math.min(NIVEAUX, niveauHeros()), mm = MONDES[mondeDe(niv)];
      J.cadre(c, 14, 14, J.L - 28, 118, 18, "rgba(0,0,0,0.55)");
      J.texte(mm.nom, 34, 46, 26, mm.couleur, "left");
      J.texte("Niveau " + niv + " / " + NIVEAUX, J.L - 34, 46, 30, "#fff", "right");
      var bx = 34, bw = J.L - 68, cols = ["#0ea5e9", "#f97316", "#22c55e", "#7dd3fc", "#a78bfa"], bornes = [0, 200, 260, 500, 750, 1000];
      for (var s = 0; s < 5; s++) { var x1 = bx + bw * bornes[s] / 1000, x2 = bx + bw * bornes[s + 1] / 1000; c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(x1 + 1, 76, x2 - x1 - 2, 18); c.fillStyle = cols[s]; c.fillRect(x1 + 1, 76, (x2 - x1 - 2) * borne((niv - bornes[s]) / (bornes[s + 1] - bornes[s]), 0, 1), 18); }
      J.texte("Record : " + record + " · Sauvegarde : " + plancher + (victoires ? " · Trous noirs : " + victoires : ""), 34, 114, 21, "#cbd5e1", "left");
      J.texte(bouclier > 0 ? "Bouclier " + Math.ceil(bouclier) + " s" : "", J.L - 34, 114, 21, "#7dd3fc", "right");
    }
  };
  return jeu;
})();
