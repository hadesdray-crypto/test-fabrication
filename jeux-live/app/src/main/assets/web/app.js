/* Jeux Live — écrans de l'application (accueil, mode d'emploi, horaires, état, mise à jour, essai). */
var App = (function () {
  var N = window.Natif || null; // pont vers Android (absent dans un simple navigateur)
  function natif(nom) {
    var args = Array.prototype.slice.call(arguments, 1);
    try { if (N && N[nom]) return N[nom].apply(N, args); } catch (e) { console.log("JLERR natif " + nom + " " + e); }
    return null;
  }
  function $(id) { return document.getElementById(id); }
  function stock(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; }

  var LISTE = [
    { id: "montee", nom: "La Montée", desc: "Un grimpeur monte tout seul. Les spectateurs le font tomber ou l'aident à grimper." },
    { id: "colline", nom: "Le Roi de la Colline", desc: "Le roi tient le sommet. Les canons des spectateurs veulent le faire tomber." },
    { id: "course", nom: "La Course des Équipes", desc: "Équipe rouge contre équipe bleue : chaque cadeau fait avancer son équipe." },
    { id: "tour", nom: "La Tour", desc: "Les uns construisent une tour, les autres la démolissent à la catapulte." }
  ];
  var jeuChoisi = stock("jeu") || "montee";
  var solo = stock("solo") === "1";
  function mode(s) { solo = !!s; stock("solo", solo ? "1" : "0"); dessinerMode(); }
  function dessinerMode() {
    $("modeEquipes").className = "interrupteur" + (solo ? "" : " oui");
    $("modeSolo").className = "interrupteur" + (solo ? " oui" : "");
    $("infoMode").textContent = solo ? "Pas d'équipes : les cadeaux jouent contre toi, les likes t'aident." : "Les spectateurs écrivent BLEU (ils t'aident) ou ROUGE (ils te font perdre).";
  }
  var dansLeJeu = false, modeEssai = false;
  var journal = [];

  function ecran(nom) {
    var e = document.querySelectorAll(".ecran");
    for (var i = 0; i < e.length; i++) e[i].className = "ecran";
    $("e-" + nom).className = "ecran actif";
    $("e-" + nom).scrollTop = 0;
    if (nom === "horaires") afficherHoraires();
    if (nom === "maj") $("majVersion").textContent = "Version installée : " + (natif("version") || "essai");
    if (nom === "accueil") { majInfoHoraire(); majConnexion(); }
    if (nom === "etat") majConnexion();
  }

  function dessinerListe() {
    var h = "";
    for (var i = 0; i < LISTE.length; i++) {
      var j = LISTE[i];
      h += '<div class="choix' + (j.id === jeuChoisi ? " oui" : "") + '" onclick="App.choisir(\'' + j.id + '\')"><b>' + (j.id === jeuChoisi ? "Choisi : " : "") + j.nom + '</b><span>' + j.desc + '</span></div>';
    }
    $("listeJeux").innerHTML = h;
  }
  function choisir(id) { jeuChoisi = id; stock("jeu", id); dessinerListe(); }

  function pseudo() { return ($("pseudo").value || "").replace(/^@/, "").replace(/\s+/g, "").toLowerCase(); }
  function memoriserPseudo() { stock("pseudo", pseudo()); }

  function dialogue(titre, texte, boutons) {
    $("dTitre").textContent = titre; $("dTexte").textContent = texte;
    var b = $("dBoutons"); b.innerHTML = "";
    (boutons || [["D'accord", null, "vert"]]).forEach(function (x) {
      var el = document.createElement("button"); el.className = "bouton " + (x[2] || "gris"); el.textContent = x[0];
      el.onclick = function () { $("dialogue").style.display = "none"; if (x[1]) x[1](); };
      b.appendChild(el);
    });
    $("dialogue").style.display = "flex";
  }

  // ---------- Lancement du jeu ----------
  function demarrerJeu(essai) {
    modeEssai = !!essai;
    var ecr = document.querySelectorAll(".ecran"); for (var i = 0; i < ecr.length; i++) ecr[i].className = "ecran";
    $("signaler").style.display = "none";
    $("scene").style.display = "block";
    dansLeJeu = true;
    natif("pleinEcran", true);
    JL.lancer(JEUX[jeuChoisi], { essai: modeEssai, solo: solo });
    if (modeEssai) barreEssai(); else $("essaiBarre").style.display = "none";
  }
  function estConnecte() { var r = natif("estConnecte"); return r === true || r === "true"; }
  function majConnexion() {
    var ok = estConnecte(), dispo = !!N;
    var el = $("infoConnexion");
    if (!dispo) { el.className = "petit"; el.textContent = "Disponible dans l'application installée."; }
    else if (ok) { el.className = "etat-ok"; el.textContent = "Lecture connectée à TikTok."; }
    else { el.className = "petit"; el.textContent = "Non connectée (normal, pas besoin pour commencer)."; }
    $("etatConnexion").textContent = dispo ? (ok ? "Lecture connectée à TikTok : oui" : "Lecture connectée à TikTok : non") : "";
  }
  function connecter() { natif("connexionTikTok"); }
  function preparerLive(forcer) {
    var p = pseudo();
    if (false && N && !estConnecte() && forcer !== true) {
      dialogue("Lecture pas connectée", "Pour que les cadeaux fassent quelque chose dans le jeu, connecte d'abord la lecture à TikTok (une seule fois).", [["Connecter maintenant", connecter, "bleu"], ["Lancer quand même", function () { preparerLive(true); }, "gris"]]);
      return;
    }
    if (!p) { dialogue("Il manque ton nom TikTok", "Écris ton nom TikTok tout en haut (ce qui est après le @ sur ton profil), puis recommence.", [["Compris", function () { $("pseudo").focus(); }, "vert"]]); return; }
    stock("pseudo", p);
    natif("demarrerLecture", p);
    demarrerJeu(false);
    $("voile").style.display = "block";
  }
  function afficherJeu() { $("voile").style.display = "none"; }
  function ouvrirTikTok() {
    var ok = natif("ouvrirTikTok");
    if (ok === false || ok === "non") dialogue("TikTok introuvable", "Ouvre TikTok toi-même, démarre le live avec « Jeu mobile », puis reviens ici.");
  }
  function quitterJeu() {
    $("voile").style.display = "none"; $("essaiBarre").style.display = "none";
    JL.arreter(); dansLeJeu = false;
    $("scene").style.display = "none"; $("signaler").style.display = "block";
    natif("pleinEcran", false);
    if (!modeEssai) natif("arreterLecture");
    modeEssai = false;
    ecran("accueil");
  }
  function lancerEssai() { demarrerJeu(true); }

  // ---------- Mode essai : faux cadeaux (jamais envoyés sur TikTok) ----------
  var fauxNoms = ["Léa", "Tom", "Inès", "Hugo", "Sarah", "Nolan", "Jade", "Yanis"];
  function faux(type, camp, valeur, nombre, texte) {
    var n = fauxNoms[Math.floor(Math.random() * fauxNoms.length)] + (camp ? " (" + camp + ")" : "");
    var u = { nom: n, pseudo: n, id: n };
    if (camp) JL.recevoir({ type: "commentaire", texte: camp, utilisateur: u });
    if (type === "cadeau") JL.recevoir({ type: "cadeau", nom: valeur >= 1000 ? "Lion" : (valeur >= 100 ? "Univers" : (valeur >= 10 ? "Chapeau" : "Rose")), valeur: valeur, nombre: nombre || 1, utilisateur: u });
    else if (type === "like") JL.recevoir({ type: "like", nombre: nombre, utilisateur: u });
    else if (type === "commentaire") JL.recevoir({ type: "commentaire", texte: texte, utilisateur: u });
    else JL.recevoir({ type: type, utilisateur: u });
  }
  function barreEssai() {
    var enSolo = solo && jeuChoisi !== "course";
    function lab(x, c) { return c ? x + " (" + c + ")" : x; }
    var b = [];
    var camps = enSolo ? [""] : ["ROUGE", "BLEU"];
    camps.forEach(function (cp) {
      b.push([lab("Rose", cp), function () { faux("cadeau", cp, 1, 1); }]);
      b.push([lab("Rose ×10", cp), function () { faux("cadeau", cp, 1, 10); }]);
      b.push([lab("Moyen", cp), function () { faux("cadeau", cp, 30, 1); }]);
      b.push([lab("Gros", cp), function () { faux("cadeau", cp, 500, 1); }]);
      b.push([lab("Énorme", cp), function () { faux("cadeau", cp, 1500, 1); }]);
    });
    b.push(["50 likes", function () { faux("like", enSolo ? "" : (Math.random() < 0.5 ? "BLEU" : "ROUGE"), 0, 50); }]);
    b.push(["Abonnement", function () { faux("abonnement"); }]);
    b.push(["Quitter l'essai", quitterJeu]);
    var c = $("essaiBarre"); c.innerHTML = "";
    b.forEach(function (x) { var el = document.createElement("button"); el.textContent = x[0]; el.onclick = x[1]; if (x[0] === "Quitter l'essai") el.style.background = "#b91c1c"; c.appendChild(el); });
    c.style.display = "flex";
  }

  // ---------- Événements venant du live ----------
  function evenement(json) {
    var ev; try { ev = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { return; }
    if (dansLeJeu && !modeEssai) JL.recevoir(ev);
    var u = ev.utilisateur ? ev.utilisateur.nom : "";
    var t = ev.type === "cadeau" ? "Cadeau : " + u + " — " + ev.nom + " ×" + ev.nombre + " (" + ev.valeur + " pièce" + (ev.valeur > 1 ? "s" : "") + ")"
      : ev.type === "like" ? "Likes : " + u + " +" + ev.nombre
      : ev.type === "commentaire" ? "Commentaire : " + u + " : " + ev.texte
      : ev.type === "abonnement" ? "Abonnement : " + u
      : ev.type === "partage" ? "Partage : " + u
      : ev.type === "arrivee" ? "Arrivée : " + u : ev.type;
    journal.unshift(t); if (journal.length > 40) journal.pop();
    var h = ""; for (var i = 0; i < Math.min(25, journal.length); i++) h += "<div>" + echapper(journal[i]) + "</div>";
    $("journal").innerHTML = h;
  }
  function echapper(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function etatLecture(json) {
    var e; try { e = typeof json === "string" ? JSON.parse(json) : json; } catch (x) { return; }
    var el = $("etatLecture");
    if (e.niveau === "ok") { el.className = "etat-ok"; el.textContent = "ça marche, les messages du live arrivent"; }
    else if (e.niveau === "ko") { el.className = "etat-ko"; el.textContent = e.titre || "problème"; }
    else { el.className = "etat-att"; el.textContent = e.titre || "en attente"; }
    $("etatDetail").textContent = e.detail || "";
  }
  function relancerLecture() {
    var p = pseudo() || stock("pseudo");
    if (!p) { dialogue("Il manque ton nom TikTok", "Écris ton nom TikTok sur la page d'accueil."); return; }
    natif("demarrerLecture", p);
    etatLecture({ niveau: "att", titre: "relancée, patiente quelques secondes" });
  }

  // ---------- Horaires ----------
  var JOURS = ["L", "M", "M", "J", "V", "S", "D"];
  function lireHoraires() {
    var h = null; try { h = JSON.parse(natif("lireHoraires") || stock("horaires") || "null"); } catch (e) { }
    if (!h || !h.length) h = [{ actif: false, debut: "18:00", fin: "20:00", jours: [1, 1, 1, 1, 1, 1, 1] }, { actif: false, debut: "12:00", fin: "13:00", jours: [0, 0, 0, 0, 0, 1, 1] }, { actif: false, debut: "21:00", fin: "22:00", jours: [0, 0, 0, 0, 0, 1, 0] }];
    return h;
  }
  var horaires = null;
  function afficherHoraires() {
    horaires = lireHoraires();
    var h = "";
    for (var i = 0; i < horaires.length; i++) {
      var c = horaires[i];
      h += '<div class="carte"><div class="ligne"><b style="font-size:20px">Créneau ' + (i + 1) + '</b><div class="interrupteur' + (c.actif ? " oui" : "") + '" onclick="App.basculer(' + i + ')">' + (c.actif ? "Activé" : "Désactivé") + '</div></div>'
        + '<div class="ligne" style="margin-top:10px"><div><span class="petit">Début</span><input type="time" value="' + c.debut + '" onchange="App.heure(' + i + ',\'debut\',this.value)"></div><div><span class="petit">Fin</span><input type="time" value="' + c.fin + '" onchange="App.heure(' + i + ',\'fin\',this.value)"></div></div>'
        + '<div class="jours">';
      for (var d = 0; d < 7; d++) h += '<div class="jour' + (c.jours[d] ? " oui" : "") + '" onclick="App.jour(' + i + ',' + d + ')">' + JOURS[d] + '</div>';
      h += '</div></div>';
    }
    $("creneaux").innerHTML = h;
  }
  function basculer(i) { horaires[i].actif = !horaires[i].actif; afficherHoraires2(); }
  function heure(i, k, v) { if (/^\d\d:\d\d$/.test(v)) horaires[i][k] = v; }
  function jour(i, d) { horaires[i].jours[d] = horaires[i].jours[d] ? 0 : 1; afficherHoraires2(); }
  function afficherHoraires2() { var tmp = horaires; stock("horaires", JSON.stringify(tmp)); afficherHoraires(); horaires = tmp; }
  function enregistrerHoraires() {
    for (var i = 0; i < horaires.length; i++) {
      if (horaires[i].actif && horaires[i].debut === horaires[i].fin) { $("horairesMsg").textContent = "Créneau " + (i + 1) + " : le début et la fin sont à la même heure."; return; }
      if (horaires[i].actif && !horaires[i].jours.some(function (x) { return x; })) { $("horairesMsg").textContent = "Créneau " + (i + 1) + " : choisis au moins un jour."; return; }
    }
    var json = JSON.stringify(horaires);
    stock("horaires", json);
    var r = natif("horaires", json);
    $("horairesMsg").textContent = r || "Horaires enregistrés.";
    majInfoHoraire();
  }
  function majInfoHoraire() { var r = natif("prochainHoraire"); $("infoHoraire").textContent = r ? r : ""; }

  // ---------- Mise à jour ----------
  function chercherMaj() { $("majEtat").textContent = "Recherche en cours…"; $("majListe").innerHTML = ""; if (!natif("chercherMaj")) $("majEtat").textContent = "Disponible seulement dans l'application installée."; }
  function resultatMaj(json) {
    var r; try { r = JSON.parse(json); } catch (e) { r = { erreur: "Réponse illisible." }; }
    if (r.erreur) { $("majEtat").textContent = r.erreur; return; }
    if (!r.nouvelle) { $("majEtat").textContent = "Tu as déjà la dernière version (" + r.nom + ")."; return; }
    $("majEtat").textContent = "Nouvelle version disponible : " + r.nom;
    var h = '<div class="carte"><b>Ce qui change :</b>';
    (r.changes || []).forEach(function (c) { h += "<p>• " + echapper(c) + "</p>"; });
    h += '</div><button class="bouton orange" onclick="App.installerMaj()">Mettre à jour maintenant</button>';
    $("majListe").innerHTML = h;
  }
  function installerMaj() { $("majBarre").style.display = "block"; natif("installerMaj"); }
  function progresMaj(p) { $("majProgres").style.width = p + "%"; $("majEtat").textContent = "Chargement… " + p + " %"; }
  function messageMaj(t) { $("majEtat").textContent = t; }

  // ---------- Retour Android, horaires ----------
  function retour() {
    if ($("dialogue").style.display === "flex") { $("dialogue").style.display = "none"; return true; }
    if (dansLeJeu) {
      dialogue("Quitter le jeu ?", modeEssai ? "Tu reviens à l'accueil." : "Pense aussi à couper ton live dans TikTok.", [["Oui, quitter", quitterJeu, "orange"], ["Non, continuer", null, "gris"]]);
      return true;
    }
    var actif = document.querySelector(".ecran.actif");
    if (actif && actif.id !== "e-accueil") { ecran("accueil"); return true; }
    return false; // Android ferme l'application
  }
  function ouvertParHoraire() {
    if (dansLeJeu) return;
    var p = stock("pseudo");
    if (p) { $("pseudo").value = p; preparerLive(); }
    else ecran("accueil");
  }
  function finHoraire() {
    if (dansLeJeu && !modeEssai) {
      JL.recevoir({ type: "_fin" });
      JL.api.annoncer("Merci d'avoir joué ! Fin du live.", "#ffd34d", 30, true);
      dialogue("C'est l'heure de fin", "Coupe ton live dans TikTok, puis touche « Quitter le jeu ».", [["Quitter le jeu", quitterJeu, "orange"], ["Continuer encore", null, "gris"]]);
    }
  }

  function signaler() {
    var r = natif("signaler", "Accueil");
    if (!r) dialogue("Signaler une erreur", "L'adresse de signalement n'est pas encore définie. Elle sera ajoutée par une mise à jour.");
  }

  function demarrage() {
    $("pseudo").value = stock("pseudo") || "";
    dessinerListe();
    dessinerMode();
    var v = natif("version"); $("version").textContent = v ? "Version " + v : "";
    majInfoHoraire();
    majConnexion();
  }
  document.addEventListener("DOMContentLoaded", demarrage);
  if (document.readyState !== "loading") setTimeout(demarrage, 0);

  return {
    ecran: ecran, choisir: choisir, memoriserPseudo: memoriserPseudo, preparerLive: preparerLive, afficherJeu: afficherJeu,
    ouvrirTikTok: ouvrirTikTok, quitterJeu: quitterJeu, lancerEssai: lancerEssai, evenement: evenement, etatLecture: etatLecture,
    relancerLecture: relancerLecture, basculer: basculer, heure: heure, jour: jour, enregistrerHoraires: enregistrerHoraires,
    chercherMaj: chercherMaj, resultatMaj: resultatMaj, installerMaj: installerMaj, progresMaj: progresMaj, messageMaj: messageMaj,
    connecter: connecter, majConnexion: majConnexion, mode: mode,
    retour: retour, ouvertParHoraire: ouvertParHoraire, finHoraire: finHoraire, signaler: signaler,
    // pour les tests automatiques
    _jeux: function () { return LISTE.map(function (j) { return j.id; }); }, _demarrerJeu: function (id, essai) { jeuChoisi = id; demarrerJeu(essai); }
  };
})();
