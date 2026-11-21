/* ==========================================================================
   Maubeuge Cover Rock Festival 2027 — script commun aux 4 pages
   1. Préférences d'accessibilité (contraste, taille, animations)
   2. Navigation : page courante
   3. Programmation : filtres par créneau + fiches techniques
   4. Billetterie : quantités par tarif et validation de la pré-réservation
   ========================================================================== */
(function () {
  "use strict";

  var html = document.documentElement;
  var STORAGE_KEY = "lw-a11y";

  /* ---------------------------------------------------------------------
     1. Préférences d'accessibilité (mémorisées dans le navigateur)
     ------------------------------------------------------------------ */
  function lirePreferences() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (erreur) {
      return {};
    }
  }

  var prefs = { hc: false, size: 0, freeze: false };
  var sauvegardees = lirePreferences();
  if (typeof sauvegardees.hc === "boolean") prefs.hc = sauvegardees.hc;
  if (typeof sauvegardees.size === "number") prefs.size = sauvegardees.size;
  if (typeof sauvegardees.freeze === "boolean") prefs.freeze = sauvegardees.freeze;

  function appliquerPreferences() {
    html.classList.toggle("hc", prefs.hc);
    html.classList.toggle("freeze", prefs.freeze);
    html.classList.remove("fs-1", "fs-2");
    if (prefs.size > 0) html.classList.add("fs-" + prefs.size);

    var contraste = document.getElementById("toggle-contrast");
    if (contraste) contraste.setAttribute("aria-pressed", String(prefs.hc));
    var animations = document.getElementById("toggle-freeze");
    if (animations) animations.setAttribute("aria-pressed", String(prefs.freeze));

    var tailles = document.querySelectorAll("[data-size]");
    for (var i = 0; i < tailles.length; i++) {
      tailles[i].setAttribute(
        "aria-pressed",
        String(Number(tailles[i].getAttribute("data-size")) === prefs.size)
      );
    }
  }

  function enregistrerPreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (erreur) {
      /* stockage indisponible : les préférences restent valables pour la page */
    }
  }

  appliquerPreferences();
  var btnContraste = document.getElementById("toggle-contrast");
  if (btnContraste) {
    btnContraste.addEventListener("click", function () {
      prefs.hc = !prefs.hc;
      appliquerPreferences();
      enregistrerPreferences();
    });
  }
  var btnAnimations = document.getElementById("toggle-freeze");
  if (btnAnimations) {
    btnAnimations.addEventListener("click", function () {
      prefs.freeze = !prefs.freeze;
      appliquerPreferences();
      enregistrerPreferences();
    });
  }
  var boutonsTaille = document.querySelectorAll("[data-size]");
  for (var b = 0; b < boutonsTaille.length; b++) {
    boutonsTaille[b].addEventListener("click", function (evenement) {
      prefs.size = Number(evenement.currentTarget.getAttribute("data-size"));
      appliquerPreferences();
      enregistrerPreferences();
    });
  }

  /* ---------------------------------------------------------------------
     2. Navigation : marque la page courante
     ------------------------------------------------------------------ */
  var page = window.location.pathname.split("/").pop() || "accueil.html";
  var liens = document.querySelectorAll(".nav a");
  for (var l = 0; l < liens.length; l++) {
    if (liens[l].getAttribute("href") === page) liens[l].setAttribute("aria-current", "page");
    else liens[l].removeAttribute("aria-current");
  }

  /* ---------------------------------------------------------------------
     3. Programmation : filtres par créneau et fiches techniques
     ------------------------------------------------------------------ */
  var filtres = document.querySelectorAll("[data-filter]");
  var groupes = document.querySelectorAll("[data-slot]");
  function filtrer(creneau) {
    for (var g = 0; g < groupes.length; g++) {
      groupes[g].hidden = creneau !== "all" && groupes[g].getAttribute("data-slot") !== creneau;
    }
    for (var f = 0; f < filtres.length; f++) {
      filtres[f].setAttribute("aria-pressed", String(filtres[f].getAttribute("data-filter") === creneau));
    }
  }
  for (var i = 0; i < filtres.length; i++) {
    filtres[i].addEventListener("click", function (evenement) {
      filtrer(evenement.currentTarget.getAttribute("data-filter"));
    });
  }
  var boutonsFiche = document.querySelectorAll("[data-fiche]");
  for (var k = 0; k < boutonsFiche.length; k++) {
    boutonsFiche[k].addEventListener("click", function (evenement) {
      var bouton = evenement.currentTarget;
      var panneau = document.getElementById(bouton.getAttribute("aria-controls"));
      var ouvert = bouton.getAttribute("aria-expanded") === "true";
      bouton.setAttribute("aria-expanded", String(!ouvert));
      if (panneau) panneau.hidden = ouvert;
    });
  }

  /* ---------------------------------------------------------------------
     4. Billetterie : chaque champ HTML est une quantité indépendante.
     Les champs sont utilisés tels quels (pas de remplacement/injection DOM).
     ------------------------------------------------------------------ */
  var tarifs = [
    { id: "reduit", nom: "Prévente", prix: 10 },
    { id: "standard", nom: "Entrée sur place", prix: 15 },
    { id: "jetons", nom: "Pass + Pack Jetons", prix: 22 }
  ];
  var formulaireReservation = document.getElementById("resa-form");
  var champsQuantite = {};
  var tarifTotal = 0;
  var totalPlaces = 0;
  var resumeCommande = null;
  var erreurQuantites = null;
  var champPlaces = formulaireReservation && formulaireReservation.elements.places;

  if (formulaireReservation) {
    for (var t = 0; t < tarifs.length; t++) {
      var champTarif = document.querySelector('[data-tariff="' + tarifs[t].id + '"]');
      if (champTarif && champTarif.tagName === "INPUT") {
        champsQuantite[tarifs[t].id] = champTarif;
      }
    }

    if (Object.keys(champsQuantite).length) {
      resumeCommande = document.createElement("p");
      resumeCommande.className = "fiche ticket-summary";
      resumeCommande.id = "commande-resume";
      resumeCommande.setAttribute("aria-live", "polite");
      resumeCommande.setAttribute("aria-atomic", "true");
      formulaireReservation.insertBefore(resumeCommande, formulaireReservation.querySelector(".pmr-check"));

      erreurQuantites = document.createElement("p");
      erreurQuantites.className = "error";
      erreurQuantites.id = "quantites-erreur";
      erreurQuantites.setAttribute("role", "alert");
      erreurQuantites.hidden = true;
      resumeCommande.insertAdjacentElement("afterend", erreurQuantites);

      function afficherCommande() {
        var descriptions = [];
        totalPlaces = 0;
        tarifTotal = 0;
        for (var q = 0; q < tarifs.length; q++) {
          var tarif = tarifs[q];
          var champ = champsQuantite[tarif.id];
          var quantite = champ ? (parseInt(champ.value, 10) || 0) : 0;
          totalPlaces += quantite;
          tarifTotal += quantite * tarif.prix;
          if (quantite > 0) {
            descriptions.push(quantite + " × " + tarif.nom + " (" + (quantite * tarif.prix) + " €)");
          }
        }
        if (champPlaces) champPlaces.value = String(totalPlaces);
        resumeCommande.textContent = descriptions.length
          ? "Votre commande : " + descriptions.join(" · ") + " — " + totalPlaces +
            " place(s), total : " + tarifTotal + " €."
          : "Votre commande : sélectionnez une quantité pour chaque tarif. Maximum 10 places.";
      }

      function actualiserMaximums(champModifie) {
        var autresPlaces = 0;
        for (var q = 0; q < tarifs.length; q++) {
          var autreChamp = champsQuantite[tarifs[q].id];
          if (autreChamp && autreChamp !== champModifie) {
            autresPlaces += parseInt(autreChamp.value, 10) || 0;
          }
        }
        var maximum = Math.max(0, 10 - autresPlaces);
        champModifie.max = String(maximum);
        var quantite = parseInt(champModifie.value, 10);
        if (!Number.isFinite(quantite) || quantite < 0) quantite = 0;
        if (quantite > maximum) quantite = maximum;
        champModifie.value = String(quantite);

        for (var m = 0; m < tarifs.length; m++) {
          var champ = champsQuantite[tarifs[m].id];
          if (!champ || champ === champModifie) continue;
          var totalAutres = 0;
          for (var x = 0; x < tarifs.length; x++) {
            var autre = champsQuantite[tarifs[x].id];
            if (autre && autre !== champ) totalAutres += parseInt(autre.value, 10) || 0;
          }
          champ.max = String(Math.max(0, 10 - totalAutres));
        }
      }

      for (var a = 0; a < tarifs.length; a++) {
        (function (champ) {
          if (!champ) return;
          champ.addEventListener("input", function () {
            actualiserMaximums(champ);
            afficherCommande();
            if (erreurQuantites) {
              erreurQuantites.hidden = true;
              erreurQuantites.textContent = "";
            }
            var confirmation = document.getElementById("confirmation");
            if (confirmation) confirmation.hidden = true;
          });
          champ.addEventListener("change", function () {
            actualiserMaximums(champ);
            afficherCommande();
          });
        })(champsQuantite[tarifs[a].id]);
      }
      afficherCommande();
    }
  }

  /* ---------------------------------------------------------------------
     5. Validation de la pré-réservation (simulation, sans paiement)
     ------------------------------------------------------------------ */
  if (formulaireReservation) {
    formulaireReservation.addEventListener("submit", function (evenement) {
      evenement.preventDefault();
      var nom = formulaireReservation.elements.nom.value.trim();
      var email = formulaireReservation.elements.email.value.trim();
      var places = Number(formulaireReservation.elements.places.value);
      var erreurs = {};

      if (nom === "") erreurs.nom = "Veuillez saisir votre nom et prénom.";
      if (!/^\S+@\S+\.\S+$/.test(email)) erreurs.email = "Format attendu : nom@domaine.fr";
      if (!(places >= 1 && places <= 10)) {
        erreurs.quantites = places === 0
          ? "Sélectionnez au moins une place."
          : "La commande doit contenir entre 1 et 10 places au total.";
      }

      var nomsChamps = ["nom", "email"];
      for (var n = 0; n < nomsChamps.length; n++) {
        var id = nomsChamps[n];
        var message = document.getElementById(id + "-erreur");
        var saisie = document.getElementById(id);
        if (erreurs[id]) {
          if (message) {
            message.textContent = erreurs[id];
            message.hidden = false;
          }
          if (saisie) saisie.setAttribute("aria-invalid", "true");
        } else {
          if (message) {
            message.textContent = "";
            message.hidden = true;
          }
          if (saisie) saisie.removeAttribute("aria-invalid");
        }
      }

      if (erreurQuantites) {
        erreurQuantites.textContent = erreurs.quantites || "";
        erreurQuantites.hidden = !erreurs.quantites;
      }
      for (var v = 0; v < tarifs.length; v++) {
        var champ = champsQuantite[tarifs[v].id];
        if (champ) {
          if (erreurs.quantites) champ.setAttribute("aria-invalid", "true");
          else champ.removeAttribute("aria-invalid");
        }
      }

      var confirmation = document.getElementById("confirmation");
      var aucunPaiement = document.getElementById("aucun-paiement");
      if (Object.keys(erreurs).length > 0) {
        if (confirmation) confirmation.hidden = true;
        return;
      }

      var detailsCommande = [];
      for (var d = 0; d < tarifs.length; d++) {
        var nombre = champsQuantite[tarifs[d].id]
          ? parseInt(champsQuantite[tarifs[d].id].value, 10) || 0
          : 0;
        if (nombre > 0) detailsCommande.push(nombre + " × " + tarifs[d].nom);
      }
      if (confirmation) {
        confirmation.textContent = "Merci " + nom + " ! Votre pré-réservation de " +
          detailsCommande.join(", ") + " (" + places + " place(s), " + tarifTotal +
          " €) est confirmée à l'écran.";
        confirmation.hidden = false;
      }
      if (aucunPaiement) {
        aucunPaiement.textContent =
          "Simulation : aucune donnée n'est enregistrée et aucun paiement n'est débité.";
      }
    });
  }
})();
