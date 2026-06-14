# 🧭 Gestion de Vie

Application web **installable (PWA)** pour mettre de l'ordre dans la vie personnelle et professionnelle.
Fonctionne **hors-ligne**, sur téléphone et ordinateur. Les données restent **privées, sur l'appareil**.

## Espaces
- 🏠 **Accueil** — vue d'ensemble : capital, dépense du jour, disponible mensuel, prières, tâches.
- 💰 **Budget** — 3 caisses séparées (Moi / Maman / Business), charges fixes, revenus récurrents, dépenses par catégorie.
- 📅 **Planning** — tâches sur 7 jours (tournées filtres, enfants, maman, perso, foi).
- 👨‍👩‍👧 **Famille** — enfants (sorties/éducation) + maman (médicaments, dossier CNSS, budget).
- 🕌 **Spiritualité** — prières du jour, lecture du Coran, sadaqa.
- 🎯 **Projets de vie** — comparer les options (appartement, garage locatif, agriculture…) avec pour/contre et priorités.

## Utiliser en local
Ouvrir un petit serveur (le service worker exige http, pas `file://`) :
```bash
npx serve .        # ou: python -m http.server 8080
```
Puis ouvrir l'adresse affichée.

## Déployer sur GitHub Pages
1. Pousser ce dossier sur un dépôt GitHub `gestion_vie`.
2. Repo → **Settings → Pages** → Source : branche `main`, dossier `/ (root)`.
3. L'app sera en ligne à `https://<utilisateur>.github.io/gestion_vie/`.
4. Sur le téléphone : menu du navigateur → **Ajouter à l'écran d'accueil**.

## Sauvegarde / transfert entre appareils
Réglages → **Exporter** crée un fichier `.json`. **Importer** le recharge sur un autre appareil.

## Technique
Vanilla JS, aucune dépendance, aucun build. Stockage `localStorage`.
Icônes régénérables : `node icons/make-icons.js`.
