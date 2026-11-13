/* Jeux Live — les 4 jeux. Tous tournent seuls ; le propriétaire peut toucher l'écran pour agir (rien de visible en plus pour les spectateurs). */
var JEUX = {};

function campAB(texte) {
  var t = texte.trim().toLowerCase();
  if (/^(a|aide|aider|j'aide|je t'aide|team a)\b/.test(t) || t === "a") return "aide";
  if (/^(b|bloque|bloquer|je bloque|je te bloque|team b)\b/.test(t) || t === "b") return "bloque";
  return null;
}
function hasard(a, b) { return a + Math.random() * (b - a); }
function borne(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* ============================================================
   1) LA MONTÉE — le grimpeur monte tout seul ; les bloqueurs font tomber des pierres, les aideurs le propulsent.
   ============================================================ */
JEUX.montee = (function () {
  var J, plates, heros, camera, objets, record, sommet, drapeau, bouclier, departManche, mancheFinie, jaugeAide, vent;
  var ESPACE = 130, NB_SOMMET = 120; // 120 étages ≈ 1000 m

  function etageVersY(i) { return -i * ESPACE; }
  function creerPlates() {
    plates = [];
    var x = 360;
    for (var i = 0; i <= NB_SOMMET; i++) {
      if (i > 0) x = borne(x + hasard(-230, 230), 110, 610);
      plates.push({ i: i, x: i === 0 ? 360 : x, y: etageVersY(i), l: i === 0 ? 700 : hasard(130, 190), cassee: 0 });
    }
  }
  function etageDuHeros() { return Math.max(0, Math.round(-heros.y / ESPACE)); }
  function metres() { return Math.max(0, Math.round(-heros.y / ESPACE * 8.3)); }

  function nouvelleManche() {
    creerPlates();
    heros = { x: 360, y: 0, vx: 0, vy: 0, sol: true, plate: 0, regard: 1, etourdi: 0, attente: 0.6, propulsion: 0 };
    camera = 0; objets = []; drapeau = 0; bouclier = 0; jaugeAide = 0; vent = 0;
    departManche = J.temps(); mancheFinie = false;
  }

  function sauterVers(cible) {
    var dx = cible.x - heros.x, dy = cible.y - heros.y; // dy négatif (vers le haut)
    var vy = -Math.sqrt(2 * 2200 * Math.max(60, -dy + 70));
    var tVol = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * 2200 * dy))) / 2200;
    heros.vx = dx / Math.max(0.3, tVol); heros.vy = vy; heros.sol = false; heros.regard = dx >= 0 ? 1 : -1;
  }
  function frapper(force, texte) {
    if (bouclier > 0) { bouclier = Math.max(0, bouclier - 2.5); J.eclat(heros.x, heros.y - 40 - camera, "#7dd3fc", 14, 260); J.son("petit"); return; }
    heros.sol = false; heros.plate = -1; heros.vy = -300; heros.vx = (Math.random() < 0.5 ? -1 : 1) * hasard(200, 380) * force;
    heros.etourdi = 1.2 * force; heros.chute = force; J.secouer(8 * force); J.son("choc");
    J.eclat(heros.x, heros.y - 40 - camera, "#cbd5e1", 18, 320);
  }
  function lacherPierre(gros) {
    objets.push({ type: "pierre", x: borne(heros.x + hasard(-120, 120), 40, 680), y: heros.y - 900, vy: hasard(200, 400), r: gros ? 46 : 26, gros: gros });
  }

  var jeu = {
    nom: "La Montée", couleurFond: "#0b1530", campParDefaut: "bloque",
    legende: [
      ["Commente A pour m'aider · B pour me bloquer", "#ffe27a"],
      ["Petit cadeau : pierre · Moyen : bombe · Gros : séisme", "#ffb4b4"],
      ["Aideurs : bouclier · propulsion · drapeau · fusée", "#b4f5c6"],
      ["Likes : les aideurs remplissent la jauge de saut", "#cbd5e1"]
    ],
    campDepuisTexte: campAB,
    init: function (api) { J = api; record = 0; nouvelleManche(); },
    surCamp: function (j, camp) { J.annoncer(j.nom + (camp === "aide" ? " m'aide !" : " veut me bloquer !"), camp === "aide" ? "#86efac" : "#fca5a5", 2); },
    surCadeau: function (j, p, v) {
      var aide = j.camp === "aide";
      if (aide) {
        if (p === 1) { bouclier = Math.min(12, bouclier + 4); J.son("bonus"); J.eclat(heros.x, heros.y - 40 - camera, "#7dd3fc", 12, 200); }
        else if (p === 2) { heros.propulsion += 3; J.son("bonus"); }
        else if (p === 3) { drapeau = Math.max(drapeau, etageDuHeros()); heros.propulsion += 6; J.annoncer("Drapeau planté : plus de chute en dessous !", "#86efac", 2.5); J.son("bonus"); }
        else { heros.propulsion += 25; bouclier = 15; J.annoncer("FUSÉE !", "#c084fc", 3, true); J.son("victoire"); }
      } else {
        if (p === 1) lacherPierre(false);
        else if (p === 2) { objets.push({ type: "bombe", x: borne(heros.x + hasard(-60, 60), 40, 680), y: heros.y - 900, vy: 300, r: 30 }); }
        else if (p === 3) { J.annoncer("SÉISME !", "#ff9f43", 2.5, true); frapper(1.8); for (var k = 0; k < 4; k++) lacherPierre(true); }
        else { J.annoncer("AVALANCHE !", "#ff5e7e", 3, true); drapeau = 0; for (var a = 0; a < 10; a++) lacherPierre(true); frapper(3); }
      }
    },
    surLikes: function (camp, n) {
      if (camp === "aide") { jaugeAide += n; if (jaugeAide >= 60) { jaugeAide -= 60; heros.propulsion += 2; J.annoncer("Les likes me font sauter plus haut !", "#86efac", 1.8); } }
      else { vent = Math.min(1, vent + n / 120); if (Math.random() < n / 40) objets.push({ type: "caillou", x: borne(heros.x + hasard(-200, 200), 30, 690), y: heros.y - 900, vy: 250, r: 12 }); }
    },
    surAbonnement: function () { bouclier = Math.min(12, bouclier + 3); },
    surPartage: function () { heros.propulsion += 1; },
    surToucher: function (x, y) {
      // Le propriétaire : toucher à gauche/droite = sauter dans cette direction
      if (heros.sol && heros.etourdi <= 0) {
        var dir = x < 360 ? -1 : 1, cible = null;
        for (var i = 0; i < plates.length; i++) {
          var p = plates[i];
          if (p.i === heros.plate + 1 || p.i === heros.plate + 2) { if (!cible || (dir < 0 ? p.x < cible.x : p.x > cible.x)) cible = p; }
        }
        if (cible) sauterVers(cible); else { heros.vy = -900; heros.vx = dir * 300; heros.sol = false; }
      }
    },
    maj: function (dt, t) {
      if (mancheFinie) { if (t - mancheFinie > 7) nouvelleManche(); return; }
      if (bouclier > 0) bouclier = Math.max(0, bouclier - dt);
      vent = Math.max(0, vent - dt * 0.2);
      if (heros.etourdi > 0) heros.etourdi -= dt;
      // Propulsion (aide)
      if (heros.propulsion > 0) {
        heros.sol = false; heros.plate = -1; heros.vy = -1300; heros.vx = (360 - heros.x) * 0.8;
        heros.propulsion -= dt * 6; if (Math.random() < 0.6) J.eclat(heros.x, heros.y - camera + 10, "#ffb347", 2, 120);
        if (heros.propulsion <= 0) heros.propulsion = 0;
      }
      // Pilote automatique (sauf si le propriétaire vient de toucher)
      if (heros.sol && heros.etourdi <= 0 && !J.proprietaireActif()) {
        heros.attente -= dt;
        if (heros.attente <= 0) {
          var suiv = plates[Math.min(NB_SOMMET, heros.plate + 1)];
          if (suiv && suiv.i !== heros.plate) sauterVers(suiv);
          heros.attente = hasard(0.35, 0.9);
        }
      }
      // Physique
      if (!heros.sol) {
        var ancienY = heros.y;
        heros.vy += 2200 * dt; heros.x += (heros.vx + vent * 60 * Math.sin(t * 2)) * dt; heros.y += heros.vy * dt;
        if (heros.x < 30) { heros.x = 30; heros.vx = Math.abs(heros.vx) * 0.5; }
        if (heros.x > 690) { heros.x = 690; heros.vx = -Math.abs(heros.vx) * 0.5; }
        if (heros.vy > 0) {
          for (var i = 0; i < plates.length; i++) {
            var p = plates[i];
            if (p.cassee > 0) continue;
            if (heros.chute && p.i > drapeau && p.i > etageDuHeros() - 3 && p.i !== 0 && heros.chute > 1.2) continue; // gros choc : traverse quelques étages
            if (ancienY <= p.y && heros.y >= p.y && Math.abs(heros.x - p.x) <= p.l / 2 + 10) {
              heros.y = p.y; heros.vy = 0; heros.vx = 0; heros.sol = true; heros.plate = p.i; heros.attente = 0.4; heros.chute = 0; break;
            }
          }
          if (!heros.sol && drapeau > 0 && heros.y > etageVersY(drapeau)) { var pd = plates[drapeau]; heros.x = pd.x; heros.y = pd.y; heros.vy = 0; heros.sol = true; heros.plate = drapeau; heros.chute = 0; }
          if (heros.y > 0) { heros.y = 0; heros.vy = 0; heros.sol = true; heros.plate = 0; heros.chute = 0; }
        }
        if (heros.chute && heros.vy > 600) heros.chute = Math.max(0, heros.chute - dt);
      }
      // Objets qui tombent
      for (var o = objets.length - 1; o >= 0; o--) {
        var ob = objets[o];
        ob.vy += 900 * dt; ob.y += ob.vy * dt;
        var dx = ob.x - heros.x, dy = ob.y - (heros.y - 40);
        if (dx * dx + dy * dy < (ob.r + 30) * (ob.r + 30)) {
          if (ob.type === "bombe") { J.eclat(ob.x, ob.y - camera, "#ff9f43", 30, 420); J.son("gros"); frapper(1.4); }
          else frapper(ob.type === "caillou" ? 0.6 : (ob.gros ? 1.4 : 1));
          objets.splice(o, 1); continue;
        }
        if (ob.y > heros.y + 900) objets.splice(o, 1);
      }
      // Caméra
      var cible = heros.y - 820;
      camera += (cible - camera) * Math.min(1, dt * 4);
      var m = metres(); if (m > record) record = m;
      if (heros.plate === NB_SOMMET && heros.sol) {
        mancheFinie = t;
        var duree = Math.round(t - departManche);
        J.annoncer("SOMMET ATTEINT en " + Math.floor(duree / 60) + " min " + (duree % 60) + " s !", "#ffd34d", 6, true);
        J.annoncer("Les aideurs gagnent cette manche !", "#86efac", 6);
        J.son("victoire"); for (var f = 0; f < 6; f++) J.eclat(hasard(100, 620), hasard(300, 700), ["#ffd34d", "#86efac", "#7dd3fc"][f % 3], 30, 500);
      }
    },
    dessiner: function (c, t) {
      // Ciel qui change avec l'altitude
      var prog = borne(-heros.y / (NB_SOMMET * ESPACE), 0, 1);
      var g = c.createLinearGradient(0, -J.haut(), 0, J.H);
      g.addColorStop(0, prog > 0.6 ? "#0b1030" : "#1e3a8a"); g.addColorStop(1, prog > 0.6 ? "#3b2a6b" : "#60a5fa");
      c.fillStyle = g; c.fillRect(0, -J.haut(), J.L, J.H + J.haut());
      // Montagnes au loin
      c.fillStyle = "rgba(15,23,42,0.5)";
      c.beginPath(); c.moveTo(0, J.H); for (var mx = 0; mx <= J.L; mx += 90) c.lineTo(mx, 900 + Math.sin(mx * 0.02 + 1) * 120 - (camera * 0.05 % 200)); c.lineTo(J.L, J.H); c.fill();
      c.save(); c.translate(0, -camera);
      // Plateformes (rochers)
      for (var i = 0; i < plates.length; i++) {
        var p = plates[i];
        if (p.y - camera < -60 || p.y - camera > J.H + 60) continue;
        c.fillStyle = p.i === NB_SOMMET ? "#ffd34d" : (p.i === 0 ? "#3f6212" : "#78716c");
        c.beginPath(); c.moveTo(p.x - p.l / 2, p.y); c.lineTo(p.x + p.l / 2, p.y); c.lineTo(p.x + p.l / 2 - 18, p.y + 34); c.lineTo(p.x - p.l / 2 + 18, p.y + 34); c.closePath(); c.fill();
        c.fillStyle = p.i === 0 ? "#65a30d" : "#a8a29e"; c.fillRect(p.x - p.l / 2, p.y - 6, p.l, 8);
        if (p.i === drapeau && drapeau > 0) { c.fillStyle = "#fff"; c.fillRect(p.x + 20, p.y - 70, 5, 70); c.fillStyle = "#22c55e"; c.beginPath(); c.moveTo(p.x + 25, p.y - 70); c.lineTo(p.x + 70, p.y - 58); c.lineTo(p.x + 25, p.y - 46); c.fill(); }
        if (p.i % 12 === 0 && p.i > 0) J.texte(Math.round(p.i * 8.3) + " m", 40, p.y - 20, 20, "#e2e8f0", "left");
      }
      // Objets
      for (var o = 0; o < objets.length; o++) {
        var ob = objets[o];
        if (ob.type === "bombe") { c.fillStyle = "#111827"; c.beginPath(); c.arc(ob.x, ob.y, ob.r, 0, 7); c.fill(); c.fillStyle = (t * 8 % 2 < 1) ? "#f97316" : "#fde047"; c.fillRect(ob.x - 3, ob.y - ob.r - 14, 6, 14); }
        else { c.fillStyle = ob.type === "caillou" ? "#a8a29e" : "#57534e"; c.beginPath(); c.arc(ob.x, ob.y, ob.r, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.15)"; c.beginPath(); c.arc(ob.x - ob.r / 3, ob.y - ob.r / 3, ob.r / 3, 0, 7); c.fill(); }
      }
      // Grimpeur
      var hx = heros.x, hy = heros.y;
      if (bouclier > 0) { c.strokeStyle = "rgba(125,211,252," + (0.5 + 0.3 * Math.sin(t * 8)) + ")"; c.lineWidth = 6; c.beginPath(); c.arc(hx, hy - 42, 52, 0, 7); c.stroke(); }
      c.save(); c.translate(hx, hy); if (heros.etourdi > 0 && !heros.sol) c.rotate(t * 10);
      c.fillStyle = "#ef4444"; c.fillRect(-18, -62, 36, 40); // corps
      c.fillStyle = "#fcd34d"; c.beginPath(); c.arc(0, -76, 17, 0, 7); c.fill(); // tête
      c.fillStyle = "#1f2937"; c.fillRect(heros.regard > 0 ? 4 : -10, -80, 6, 6);
      c.fillStyle = "#1e3a8a"; var jb = heros.sol ? 0 : 8; c.fillRect(-16, -22, 12, 22 - jb); c.fillRect(4, -22, 12, 22 + jb - 8);
      c.fillStyle = "#a16207"; c.fillRect(-26, -60, 10, 30); // sac
      c.restore();
      if (heros.etourdi > 0) J.texte("★ ★", hx, hy - 110, 24, "#ffe27a");
      c.restore();
      J.particules(c, 0);
      // Barre du haut
      J.cadre(c, 14, 14, J.L - 28, 118, 18, "rgba(0,0,0,0.5)");
      J.texte("LA MONTÉE", 34, 46, 30, "#ffe27a", "left");
      J.texte(metres() + " m / 1000 m", J.L - 34, 46, 32, "#fff", "right");
      c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(34, 76, J.L - 68, 18);
      c.fillStyle = "#22c55e"; c.fillRect(34, 76, (J.L - 68) * borne(metres() / 1000, 0, 1), 18);
      J.texte("Record : " + record + " m", 34, 114, 22, "#cbd5e1", "left");
      J.texte(bouclier > 0 ? "Bouclier " + Math.ceil(bouclier) + " s" : "", J.L - 34, 114, 22, "#7dd3fc", "right");
    }
  };
  return jeu;
})();

/* ============================================================
   2) LE ROI DE LA COLLINE — le roi tient le sommet ; les canons des bloqueurs tirent des boulets.
   ============================================================ */
JEUX.colline = (function () {
  var J, roi, boulets, equilibre, mur, statue, bouclier, record, depuis, tombe, canons;
  var SOMMET_Y = 560;
  function reinit() {
    roi = { x: 360, y: SOMMET_Y, etat: "sommet", vy: 0, vx: 0, saut: 0, retour: 0 };
    boulets = []; equilibre = 100; mur = { g: 0, d: 0 }; statue = 0; bouclier = 0; depuis = J.temps(); tombe = 0;
    canons = [{ x: 60, y: 1010, cote: -1, recul: 0 }, { x: 660, y: 1010, cote: 1, recul: 0 }];
  }
  function sol(x) { // profil de la colline
    var d = Math.abs(x - 360);
    return d < 70 ? SOMMET_Y : Math.min(1040, SOMMET_Y + (d - 70) * 1.35);
  }
  function tirer(cote, gros) {
    var cn = canons[cote < 0 ? 0 : 1]; cn.recul = 1;
    var tx = roi.x, ty = roi.y - 40, dx = tx - cn.x, temps = gros ? 1.25 : 1.05;
    var vx = dx / temps, vy = (ty - (cn.y - 40) - 0.5 * 900 * temps * temps) / temps;
    boulets.push({ x: cn.x + cn.cote * -30, y: cn.y - 40, vx: vx, vy: vy, r: gros ? 28 : 17, force: gros ? 34 : 14, cote: cote });
    J.son("choc"); J.eclat(cn.x, cn.y - 40, "#d6d3d1", 8, 160);
  }
  function choc(force, cote) {
    if (statue > 0) { J.eclat(roi.x, roi.y - 40, "#ffd34d", 10, 200); return; }
    if (bouclier > 0) { bouclier = Math.max(0, bouclier - 3); J.eclat(roi.x, roi.y - 40, "#7dd3fc", 10, 200); return; }
    if (roi.saut > 0) return; // esquivé
    equilibre -= force; J.secouer(force / 3); J.eclat(roi.x, roi.y - 40, "#fde68a", 12, 260);
    if (equilibre <= 0 && roi.etat === "sommet") {
      roi.etat = "chute"; roi.vx = -cote * 420; roi.vy = -500; tombe++;
      var tenu = Math.round(J.temps() - depuis); if (tenu > record) record = tenu;
      J.annoncer("LE ROI EST TOMBÉ ! (" + tenu + " s au sommet)", "#ff5e7e", 3.5, true); J.son("gros");
    }
  }
  var jeu = {
    nom: "Le Roi de la Colline", couleurFond: "#14213d", campParDefaut: "bloque",
    legende: [
      ["Commente A pour protéger le roi · B pour le faire tomber", "#ffe27a"],
      ["Bloqueurs : boulet · gros boulet · salve · bombardement", "#ffb4b4"],
      ["Aideurs : soin · bouclier · mur · statue d'or", "#b4f5c6"],
      ["Likes : petits boulets ou soins selon ton camp", "#cbd5e1"]
    ],
    campDepuisTexte: campAB,
    init: function (api) { J = api; record = 0; reinit(); },
    surCamp: function (j, camp) { J.annoncer(j.nom + (camp === "aide" ? " protège le roi !" : " attaque le roi !"), camp === "aide" ? "#86efac" : "#fca5a5", 2); },
    surCadeau: function (j, p) {
      if (j.camp === "aide") {
        if (p === 1) { equilibre = Math.min(100, equilibre + 12); J.son("bonus"); }
        else if (p === 2) { bouclier = Math.min(20, bouclier + 8); J.son("bonus"); }
        else if (p === 3) { mur.g = 25; mur.d = 25; equilibre = 100; J.annoncer("Murs de protection !", "#86efac", 2.5); J.son("bonus"); }
        else { statue = 40; equilibre = 100; J.annoncer("STATUE D'OR : le roi est intouchable !", "#ffd34d", 3.5, true); J.son("victoire"); }
      } else {
        var cote = Math.random() < 0.5 ? -1 : 1;
        if (p === 1) tirer(cote, false);
        else if (p === 2) tirer(cote, true);
        else if (p === 3) { J.annoncer("SALVE DE CANONS !", "#ff9f43", 2.5, true); for (var i = 0; i < 4; i++) (function (k) { setTimeout(function () { tirer(k % 2 ? 1 : -1, true); }, k * 250); })(i); }
        else { J.annoncer("BOMBARDEMENT !", "#ff5e7e", 3, true); statue = 0; bouclier = 0; mur.g = mur.d = 0; for (var b = 0; b < 8; b++) (function (k) { setTimeout(function () { tirer(k % 2 ? 1 : -1, true); }, k * 200); })(b); }
      }
    },
    surLikes: function (camp, n) {
      if (camp === "aide") equilibre = Math.min(100, equilibre + n * 0.4);
      else if (Math.random() < n / 25) tirer(Math.random() < 0.5 ? -1 : 1, false);
    },
    surAbonnement: function () { equilibre = Math.min(100, equilibre + 8); },
    surToucher: function () { if (roi.etat === "sommet" && roi.saut <= 0) { roi.saut = 0.7; J.son("petit"); } },
    maj: function (dt, t) {
      if (statue > 0) statue -= dt; if (bouclier > 0) bouclier -= dt;
      if (mur.g > 0) mur.g -= dt; if (mur.d > 0) mur.d -= dt;
      for (var c = 0; c < 2; c++) canons[c].recul = Math.max(0, canons[c].recul - dt * 3);
      if (roi.saut > 0) roi.saut -= dt;
      // Le roi esquive tout seul de temps en temps (pilote automatique)
      if (!J.proprietaireActif() && roi.etat === "sommet" && roi.saut <= 0) {
        for (var a = 0; a < boulets.length; a++) { var bb = boulets[a]; if (Math.abs(bb.x - roi.x) < 130 && bb.vy > -100 && Math.random() < 0.012) { roi.saut = 0.7; break; } }
      }
      if (roi.etat === "sommet") { equilibre = Math.min(100, equilibre + dt * 1.5); roi.x = 360 + Math.sin(t * 1.3) * 25; roi.y = SOMMET_Y; }
      else if (roi.etat === "chute") {
        roi.vy += 1400 * dt; roi.x += roi.vx * dt; roi.y += roi.vy * dt;
        if (roi.y >= sol(roi.x)) { roi.y = sol(roi.x); roi.vx *= 0.6; roi.vy = -Math.abs(roi.vy) * 0.3; if (Math.abs(roi.vy) < 80 || roi.y >= 1030) { roi.etat = "retour"; roi.retour = 0; } }
        roi.x = borne(roi.x, 30, 690);
      } else if (roi.etat === "retour") {
        var dir = roi.x < 360 ? 1 : -1; roi.x += dir * 70 * dt; roi.y = sol(roi.x);
        if (Math.abs(roi.x - 360) < 30) { roi.etat = "sommet"; equilibre = 70; depuis = t; J.annoncer("Le roi reprend le sommet !", "#86efac", 2.5); J.son("bonus"); }
      }
      for (var i = boulets.length - 1; i >= 0; i--) {
        var b = boulets[i];
        b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if ((b.cote < 0 && mur.g > 0 && b.x > 220 && b.x < 250 && b.y > 520) || (b.cote > 0 && mur.d > 0 && b.x < 500 && b.x > 470 && b.y > 520)) { J.eclat(b.x, b.y, "#a8a29e", 10, 200); boulets.splice(i, 1); continue; }
        var dx = b.x - roi.x, dy = b.y - (roi.y - 50);
        if (roi.etat === "sommet" && dx * dx + dy * dy < (b.r + 38) * (b.r + 38)) { choc(b.force, b.cote); boulets.splice(i, 1); continue; }
        if (b.y > sol(b.x) || b.y > 1300) { J.eclat(b.x, Math.min(b.y, 1040), "#78716c", 6, 140); boulets.splice(i, 1); }
      }
    },
    dessiner: function (c, t) {
      var g = c.createLinearGradient(0, -J.haut(), 0, J.H); g.addColorStop(0, "#fb923c"); g.addColorStop(0.5, "#7c3aed"); g.addColorStop(1, "#1e1b4b");
      c.fillStyle = g; c.fillRect(0, -J.haut(), J.L, J.H + J.haut());
      // Colline
      c.fillStyle = "#3f6212"; c.beginPath(); c.moveTo(0, J.H); for (var x = 0; x <= J.L; x += 10) c.lineTo(x, sol(x)); c.lineTo(J.L, J.H); c.fill();
      c.fillStyle = "#65a30d"; c.fillRect(290, SOMMET_Y - 4, 140, 8);
      // Murs
      if (mur.g > 0) { c.fillStyle = "#a8a29e"; c.fillRect(220, 520, 30, 150); }
      if (mur.d > 0) { c.fillStyle = "#a8a29e"; c.fillRect(470, 520, 30, 150); }
      // Canons
      for (var k = 0; k < 2; k++) {
        var cn = canons[k]; c.save(); c.translate(cn.x, cn.y); c.fillStyle = "#292524"; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill();
        c.rotate(cn.cote < 0 ? -0.8 : -2.34); c.fillStyle = "#44403c"; c.fillRect(-10 - cn.recul * 10, -14, 70, 28); c.restore();
      }
      // Boulets
      for (var i = 0; i < boulets.length; i++) { var b = boulets[i]; c.fillStyle = "#1c1917"; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.2)"; c.beginPath(); c.arc(b.x - b.r / 3, b.y - b.r / 3, b.r / 3, 0, 7); c.fill(); }
      // Roi
      var rx = roi.x, ry = roi.y - (roi.saut > 0 ? Math.sin((0.7 - roi.saut) / 0.7 * Math.PI) * 110 : 0);
      c.save(); c.translate(rx, ry); if (roi.etat === "chute") c.rotate(t * 9); else c.rotate((100 - equilibre) / 100 * 0.35 * Math.sin(t * 6));
      c.fillStyle = statue > 0 ? "#facc15" : "#7c3aed"; c.fillRect(-22, -70, 44, 50);
      c.fillStyle = statue > 0 ? "#fde047" : "#fcd34d"; c.beginPath(); c.arc(0, -86, 19, 0, 7); c.fill();
      c.fillStyle = "#facc15"; c.beginPath(); c.moveTo(-18, -100); c.lineTo(-18, -118); c.lineTo(-8, -106); c.lineTo(0, -122); c.lineTo(8, -106); c.lineTo(18, -118); c.lineTo(18, -100); c.fill();
      c.fillStyle = "#1e3a8a"; c.fillRect(-18, -20, 14, 20); c.fillRect(4, -20, 14, 20);
      c.restore();
      if (bouclier > 0) { c.strokeStyle = "rgba(125,211,252,0.7)"; c.lineWidth = 6; c.beginPath(); c.arc(rx, ry - 55, 60, 0, 7); c.stroke(); }
      J.particules(c, 0);
      // Barre du haut
      J.cadre(c, 14, 14, J.L - 28, 118, 18, "rgba(0,0,0,0.5)");
      J.texte("ROI DE LA COLLINE", 34, 46, 28, "#ffe27a", "left");
      var tenu = roi.etat === "sommet" ? Math.round(t - depuis) : 0;
      J.texte(tenu + " s au sommet", J.L - 34, 46, 28, "#fff", "right");
      c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(34, 76, J.L - 68, 18);
      c.fillStyle = equilibre > 50 ? "#22c55e" : (equilibre > 25 ? "#f59e0b" : "#ef4444"); c.fillRect(34, 76, (J.L - 68) * borne(equilibre / 100, 0, 1), 18);
      J.texte("Record : " + record + " s · Chutes : " + tombe, 34, 114, 22, "#cbd5e1", "left");
      J.texte(statue > 0 ? "Statue " + Math.ceil(statue) + " s" : (bouclier > 0 ? "Bouclier" : "Équilibre"), J.L - 34, 114, 22, "#7dd3fc", "right");
    }
  };
  return jeu;
})();

/* ============================================================
   3) LA COURSE DES ÉQUIPES — Équipe 1 (rouge) contre Équipe 2 (bleue). Chaque soutien fait avancer son équipe.
   ============================================================ */
JEUX.course = (function () {
  var J, eq, debut, fin, obstacles, manche, ARRIVEE = 1000, DUREE = 240;
  function campEquipe(texte) {
    var t = texte.trim().toLowerCase();
    if (/^(1|un|rouge|team 1|équipe 1|equipe 1)\b/.test(t)) return "rouge";
    if (/^(2|deux|bleu|bleue|team 2|équipe 2|equipe 2)\b/.test(t)) return "bleu";
    return null;
  }
  function reinit() {
    eq = { rouge: { pos: 0, membres: 0, frein: 0, turbo: 0, couleur: "#ef4444", nom: "ROUGE" }, bleu: { pos: 0, membres: 0, frein: 0, turbo: 0, couleur: "#3b82f6", nom: "BLEUE" } };
    var js = J.joueurs(); for (var k in js) if (js[k].camp === "rouge" || js[k].camp === "bleu") eq[js[k].camp].membres++;
    debut = J.temps(); fin = 0; obstacles = []; manche = (manche || 0) + 1; J.remiseAZeroManche();
  }
  function equipeDe(j) { if (j.camp !== "rouge" && j.camp !== "bleu") { j.camp = eq.rouge.membres <= eq.bleu.membres ? "rouge" : "bleu"; eq[j.camp].membres++; } return j.camp; }
  function autre(e) { return e === "rouge" ? "bleu" : "rouge"; }
  var jeu = {
    nom: "La Course des Équipes", couleurFond: "#052e16",
    legende: [
      ["Commente 1 pour l'équipe ROUGE · 2 pour la BLEUE", "#ffe27a"],
      ["Chaque cadeau fait avancer ton équipe", "#fff"],
      ["Moyen : turbo · Gros : turbo + flaque pour l'autre équipe", "#ffb4b4"],
      ["Likes : petits pas pour ton équipe", "#cbd5e1"]
    ],
    campDepuisTexte: campEquipe,
    init: function (api) { J = api; manche = 0; reinit(); },
    surCamp: function (j, camp) { eq.rouge.membres = 0; eq.bleu.membres = 0; var js = J.joueurs(); for (var k in js) if (eq[js[k].camp]) eq[js[k].camp].membres++; J.annoncer(j.nom + " rejoint l'équipe " + eq[camp].nom, eq[camp].couleur, 2); },
    surCadeau: function (j, p, v) {
      if (fin) return;
      var e = equipeDe(j), E = eq[e];
      E.pos += 6 + Math.min(120, v * 2.2);
      if (p >= 2) E.turbo = Math.min(6, E.turbo + p);
      if (p >= 3) { eq[autre(e)].frein = Math.min(6, eq[autre(e)].frein + p - 1); J.annoncer("Flaque sur la piste de l'équipe " + eq[autre(e)].nom + " !", "#fde68a", 2.2); }
      J.son(p >= 3 ? "gros" : "bonus");
    },
    surLikes: function (camp, n) { if (fin) return; if (eq[camp]) eq[camp].pos += n * 0.35; else { eq.rouge.pos += n * 0.15; eq.bleu.pos += n * 0.15; } },
    surAbonnement: function (j) { if (!fin) eq[equipeDe(j)].pos += 15; },
    surPartage: function (j) { if (!fin) eq[equipeDe(j)].pos += 15; },
    surToucher: function (x) { // le propriétaire pose un obstacle surprise devant l'équipe en tête
      if (fin) return;
      var tete = eq.rouge.pos >= eq.bleu.pos ? "rouge" : "bleu"; eq[tete].frein = Math.min(6, eq[tete].frein + 2); J.annoncer("Peau de banane sur l'équipe " + eq[tete].nom + " !", "#fde047", 2); J.son("choc");
    },
    maj: function (dt, t) {
      if (fin) { if (t - fin > 8) reinit(); return; }
      for (var k in eq) {
        var E = eq[k], v = 4; // trot de base : la course ne s'arrête jamais
        if (E.turbo > 0) { v += 45; E.turbo -= dt; if (Math.random() < 0.5) J.eclat(k === "rouge" ? 230 : 490, 1010 - borne(E.pos / ARRIVEE, 0, 1) * 770 + 10, "#fb923c", 2, 100); }
        if (E.frein > 0) { v *= 0.2; E.frein -= dt; }
        E.pos += v * dt;
      }
      var reste = DUREE - (t - debut);
      var gagnant = eq.rouge.pos >= ARRIVEE ? "rouge" : (eq.bleu.pos >= ARRIVEE ? "bleu" : null);
      if (!gagnant && reste <= 0) gagnant = eq.rouge.pos >= eq.bleu.pos ? "rouge" : "bleu";
      if (gagnant) {
        fin = t; var top = J.classement(1);
        J.annoncer("L'ÉQUIPE " + eq[gagnant].nom + " GAGNE !", eq[gagnant].couleur, 7, true);
        if (top.length) J.annoncer("Champion de la manche : " + top[0].nom, "#ffd34d", 7);
        J.son("victoire"); for (var f = 0; f < 8; f++) J.eclat(hasard(100, 620), hasard(250, 650), eq[gagnant].couleur, 30, 500);
      }
    },
    dessiner: function (c, t) {
      c.fillStyle = "#14532d"; c.fillRect(0, -J.haut(), J.L, J.H + J.haut());
      // Pistes
      var couloirs = [["rouge", 230], ["bleu", 490]];
      for (var i = 0; i < 2; i++) {
        var x = couloirs[i][1]; c.fillStyle = "#b45309"; c.fillRect(x - 100, 200, 200, 830);
        c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 3; for (var y = 280; y < 1030; y += 80) { c.beginPath(); c.moveTo(x - 100, y); c.lineTo(x + 100, y); c.stroke(); }
      }
      // Ligne d'arrivée en damier
      for (var d = 0; d < 26; d++) { c.fillStyle = d % 2 ? "#fff" : "#111"; c.fillRect(130 + d * 18, 220, 18, 18); c.fillStyle = d % 2 ? "#111" : "#fff"; c.fillRect(130 + d * 18, 238, 18, 18); }
      for (var j = 0; j < 2; j++) {
        var k = couloirs[j][0], E = eq[k], cx = couloirs[j][1], cy = 1010 - borne(E.pos / ARRIVEE, 0, 1) * 770;
        if (E.frein > 0) { c.fillStyle = "rgba(96,165,250,0.6)"; c.beginPath(); c.ellipse(cx, cy + 10, 70, 18, 0, 0, 7); c.fill(); }
        var pas = Math.sin(t * (E.turbo > 0 ? 25 : 9)) * 10;
        c.fillStyle = E.couleur; c.fillRect(cx - 20, cy - 70, 40, 46);
        c.fillStyle = "#fcd34d"; c.beginPath(); c.arc(cx, cy - 86, 18, 0, 7); c.fill();
        c.fillStyle = "#1f2937"; c.fillRect(cx - 16, cy - 24, 12, 24 + pas); c.fillRect(cx + 4, cy - 24, 12, 24 - pas);
        J.texte(Math.min(100, Math.round(E.pos / ARRIVEE * 100)) + " %", cx, cy - 130, 26, "#fff");
        J.texte("Équipe " + E.nom + " : " + E.membres, cx, 1058, 24, E.couleur);
      }
      J.particules(c, 0);
      J.cadre(c, 14, 14, J.L - 28, 118, 18, "rgba(0,0,0,0.5)");
      J.texte("COURSE DES ÉQUIPES", 34, 46, 28, "#ffe27a", "left");
      var reste = fin ? 0 : Math.max(0, Math.round(DUREE - (t - debut)));
      J.texte(Math.floor(reste / 60) + ":" + ("0" + reste % 60).slice(-2), J.L - 34, 46, 32, "#fff", "right");
      J.texte("Manche " + manche + " · premier à l'arrivée ou en tête à la fin", 34, 100, 22, "#cbd5e1", "left");
    }
  };
  return jeu;
})();

/* ============================================================
   4) LA TOUR — les aideurs empilent des blocs, la catapulte des bloqueurs lance des pierres.
   ============================================================ */
JEUX.tour = (function () {
  var J, blocs, chute, pierres, record, objectif, ouvrier, termine, BASE_Y = 1060, HB = 34;
  function reinit() { blocs = []; chute = []; pierres = []; objectif = 60; ouvrier = { x: 360, dir: 1, attente: 2 }; termine = 0; }
  function sommetX() { return blocs.length ? blocs[blocs.length - 1].x : 360; }
  function lacherBloc(x, couleur) {
    chute.push({ x: x, y: -40, vy: 0, l: 120, c: couleur || ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"][Math.floor(Math.random() * 5)] });
  }
  function hauteurEcran() { return Math.max(0, blocs.length * HB - 650); }
  function lancerPierre(gros) {
    var cibleRang = Math.max(0, blocs.length - 1 - Math.floor(Math.random() * Math.min(6, blocs.length)));
    pierres.push({ x: -30, y: 900, cible: cibleRang, t: 0, gros: gros, r: gros ? 30 : 18 });
    J.son("choc");
  }
  function casser(rang, nb) {
    var parti = blocs.splice(Math.max(0, rang), nb);
    for (var i = 0; i < parti.length; i++) J.eclat(parti[i].x, BASE_Y - (rang + i) * HB + hauteurEcran(), parti[i].c, 10, 300);
    J.secouer(6 + nb);
  }
  var jeu = {
    nom: "La Tour", couleurFond: "#1c1917", campParDefaut: "bloque",
    legende: [
      ["Commente A pour construire · B pour démolir", "#ffe27a"],
      ["Aideurs : 1, 3, 6 ou 15 blocs selon le cadeau", "#b4f5c6"],
      ["Bloqueurs : pierre · grosse pierre · tir groupé · séisme", "#ffb4b4"],
      ["Likes : les aideurs ajoutent des blocs, les bloqueurs secouent", "#cbd5e1"]
    ],
    campDepuisTexte: campAB,
    init: function (api) { J = api; record = 0; reinit(); },
    surCamp: function (j, camp) { J.annoncer(j.nom + (camp === "aide" ? " construit !" : " démolit !"), camp === "aide" ? "#86efac" : "#fca5a5", 2); },
    surCadeau: function (j, p) {
      if (j.camp === "aide") { var n = [0, 1, 3, 6, 15][p]; for (var i = 0; i < n; i++) lacherBloc(sommetX() + hasard(-25, 25)); J.son("bonus"); }
      else {
        if (p === 1) lancerPierre(false);
        else if (p === 2) lancerPierre(true);
        else if (p === 3) { J.annoncer("TIR GROUPÉ !", "#ff9f43", 2.5, true); for (var k = 0; k < 4; k++) lancerPierre(true); }
        else { J.annoncer("SÉISME : la tour tremble !", "#ff5e7e", 3, true); casser(Math.floor(blocs.length * 0.5), blocs.length); J.son("gros"); }
      }
    },
    surLikes: function (camp, n) {
      if (camp === "aide") { if (Math.random() < n / 30) lacherBloc(sommetX() + hasard(-20, 20)); }
      else { J.secouer(Math.min(6, n / 5)); if (Math.random() < n / 60) lancerPierre(false); }
    },
    surAbonnement: function () { lacherBloc(sommetX()); },
    surToucher: function (x) { lacherBloc(borne(x, 80, 640)); }, // le propriétaire pose un bloc où il touche
    maj: function (dt, t) {
      if (termine) { if (t - termine > 7) reinit(); return; }
      // L'ouvrier pose un bloc tout seul de temps en temps (rythme lent)
      if (!J.proprietaireActif()) { ouvrier.attente -= dt; if (ouvrier.attente <= 0) { lacherBloc(sommetX() + hasard(-30, 30), "#94a3b8"); ouvrier.attente = hasard(5, 8); } }
      var decal = hauteurEcran();
      for (var i = chute.length - 1; i >= 0; i--) {
        var b = chute[i]; b.vy += 1500 * dt; b.y += b.vy * dt;
        var haut = BASE_Y - blocs.length * HB + decal; // y écran du dessus de la tour
        if (b.y + HB >= haut) {
          var dessous = blocs.length ? blocs[blocs.length - 1] : { x: 360, l: 600 };
          if (Math.abs(b.x - dessous.x) > (dessous.l / 2 + b.l / 2) * 0.75) { J.eclat(b.x, haut, b.c, 8, 200); } // tombe à côté
          else { blocs.push({ x: b.x, l: b.l, c: b.c }); J.son("petit"); }
          chute.splice(i, 1);
        }
      }
      for (var p = pierres.length - 1; p >= 0; p--) {
        var s = pierres[p]; s.t += dt * 1.1;
        var cy = BASE_Y - s.cible * HB + decal - HB / 2, cx = blocs[s.cible] ? blocs[s.cible].x : 360;
        s.x = -30 + (cx + 30) * s.t; s.y = 900 + (cy - 900) * s.t - Math.sin(s.t * Math.PI) * 300;
        if (s.t >= 1) { if (blocs.length) casser(Math.min(s.cible, blocs.length - 1), s.gros ? 4 : 2); J.son("choc"); pierres.splice(p, 1); }
      }
      if (blocs.length > record) record = blocs.length;
      if (blocs.length >= objectif) {
        termine = t; J.annoncer("TOUR TERMINÉE : " + objectif + " étages !", "#ffd34d", 6, true); J.annoncer("Les bâtisseurs gagnent la manche !", "#86efac", 6); J.son("victoire");
        for (var f = 0; f < 6; f++) J.eclat(hasard(100, 620), hasard(250, 650), "#ffd34d", 30, 500);
      }
    },
    dessiner: function (c, t) {
      var decal = hauteurEcran();
      var g = c.createLinearGradient(0, -J.haut(), 0, J.H); g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#334155"); c.fillStyle = g; c.fillRect(0, -J.haut(), J.L, J.H + J.haut());
      c.fillStyle = "#3f3f46"; c.fillRect(0, BASE_Y + decal, J.L, 300);
      // Catapulte (côté gauche, au sol) — c'est elle qui lance les pierres
      c.fillStyle = "#78350f"; c.fillRect(20, 1000, 90, 22); c.save(); c.translate(65, 1000); c.rotate(-0.9 + (pierres.length ? 0.5 : 0)); c.fillRect(-6, -90, 12, 90); c.restore();
      for (var i = 0; i < blocs.length; i++) {
        var b = blocs[i], y = BASE_Y - (i + 1) * HB + decal;
        if (y < -HB || y > J.H) continue;
        c.fillStyle = b.c; c.fillRect(b.x - b.l / 2, y, b.l, HB - 2); c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(b.x - b.l / 2, y, b.l, 6);
      }
      for (var k = 0; k < chute.length; k++) { var ch = chute[k]; c.fillStyle = ch.c; c.fillRect(ch.x - ch.l / 2, ch.y, ch.l, HB - 2); }
      for (var p = 0; p < pierres.length; p++) { var s = pierres[p]; c.fillStyle = "#57534e"; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); }
      J.particules(c, 0);
      J.cadre(c, 14, 14, J.L - 28, 118, 18, "rgba(0,0,0,0.5)");
      J.texte("LA TOUR", 34, 46, 30, "#ffe27a", "left");
      J.texte(blocs.length + " / " + objectif + " étages", J.L - 34, 46, 30, "#fff", "right");
      c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(34, 76, J.L - 68, 18);
      c.fillStyle = "#f59e0b"; c.fillRect(34, 76, (J.L - 68) * borne(blocs.length / objectif, 0, 1), 18);
      J.texte("Record : " + record + " étages", 34, 114, 22, "#cbd5e1", "left");
    }
  };
  return jeu;
})();
