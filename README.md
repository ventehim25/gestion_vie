# 🧭 Gestion de Vie

Application web **installable (PWA)** pour mettre de l'ordre dans la vie personnelle et professionnelle.
Fonctionne **hors-ligne**, sur téléphone et ordinateur. Interface en français.

**👉 Ouvrir l'app : https://ventehim25.github.io/gestion_vie/**

---

## 📲 Installer
- **Téléphone** : ouvrir le lien dans Chrome → menu ⋮ → **« Ajouter à l'écran d'accueil »**.
- **Ordinateur** (Chrome/Edge) : icône d'installation dans la barre d'adresse.
- Ensuite tu ouvres juste l'icône **« Ma Vie »**. L'app se **met à jour toute seule**.

## ⏱️ Ta routine
- **Chaque soir (2 min)** : note tes dépenses du jour (💰 Budget), coche tes **habitudes** (Accueil), fais ton **dhikr** (Foi).
- **Chaque dimanche (15 min)** : ouvre **📊 Revue de la semaine** (Accueil → Outils).
- **Une fois/mois** : règle la part **oliviers de grand-mère** (Ferme) et regarde les **📈 Statistiques**.

---

## 🧭 Les onglets (barre du bas)
- 🏠 **Accueil** — vue d'ensemble de toutes tes caisses, habitudes (séries 🔥), épargne, et accès aux Outils.
- 💰 **Budget** — ta caisse (Moi / Business). Dépenses **détaillées par produit** (anti-gaspillage), revenus, charges fixes, **impayés** (qui te doit).
- 📅 **Planning** — tâches sur 7 jours (modifiables) + échéances.
- 🍽️ **Repas** — menu de la semaine, **stock de la maison par catégorie**, **idées de plats** réutilisables, **liste de courses** auto (ce qui manque).
- 👵 **Maman** — sa caisse (carnet entrées/sorties), revenus/charges, médicaments, dossier CNSS.
- 🚜 **Ferme** — 2 caisses (perso / oliviers partagés **79/132 sur 211 arbres**), suivi **moutons**, bilan annuel.
- 🕌 **Foi** — horaires de prière de Kénitra (+ alarmes agenda), Hijri/Ramadan, dhikr, jeûne, Khatma, Zakat, **Coran Warsh PDF** et **adhkar** (matin/soir/prière/sommeil/quotidien).
- 🎯 **Projets** — comparer tes options d'investissement (garage, appartement, terrain…) : budget, métrage, paiement, emplacement, rentabilité, journal de suivi.

## 🧰 Outils (Accueil → Outils)
📈 Statistiques · 📊 Revue de la semaine · 🚗 Voiture & entretien · 🗂️ Coffre à infos (CIN, RIB…) ·
📔 Journal & gratitude · ❤️ Santé · 📄 Documents & expirations · 🧾 Garanties · 🤝 Prêts & emprunts · 📇 Contacts utiles.

## 🔔 Alarmes du téléphone
Dans **Foi** (prières), **Maman** (médicaments), **Documents** et **Garanties** : le bouton **📅** ajoute
l'alarme dans l'**agenda de ton téléphone** → ça sonne **même quand l'app est fermée**.

## ☁️ Sauvegarde & multi-appareils
- **Réglages → ☁️ Sauvegarde GitHub** : sauvegarde automatique dans un **Gist privé**, synchronisé téléphone ↔ ordinateur.
  (Jeton GitHub avec la seule permission `gist` — n'accède à aucun de tes dépôts.)
- **Réglages → 💾 Sauvegarde fichier** : export/import d'un fichier `.json` (hors-ligne).
- 🌙 **Mode sombre** dans Réglages.

> 🔒 Tes données restent **privées** (sur ton appareil + ton Gist privé). Rien de personnel n'est dans le code public.

---

## Pour développer
Vanilla JS, aucune dépendance, aucun build. Servir en local (le service worker exige http, pas `file://`) :
```bash
npx serve .        # ou: python -m http.server 8080
```
Détails techniques, conventions et règles métier : voir **[CLAUDE.md](CLAUDE.md)**.
