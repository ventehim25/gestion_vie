# Gestion de Vie — PWA d'organisation personnelle

App web installable (PWA) qui aide l'utilisateur (Maroc, Kénitra) à organiser sa vie perso et pro :
argent, repas, famille, mère (Alzheimer), ferme (oliviers/moutons), foi, projets d'investissement, et outils anti-oubli.
Interface **en français**. Toute la logique est **hors-ligne** (offline-first).

## Pile technique
- **Vanilla JS, aucun build, aucune dépendance.** 4 fichiers servis tels quels :
  - `index.html` — coquille + barre d'onglets + enregistrement du service worker.
  - `app.js` (~2300 lignes) — toute la logique : data model, router, écrans, modales.
  - `styles.css` — styles + thème (variables CSS, `.dark` pour le mode sombre).
  - `sw.js` — service worker.
- `manifest.webmanifest`, `icons/icon.svg` — métadonnées PWA.
- Hébergé sur **GitHub Pages** : https://ventehim25.github.io/gestion_vie/ (repo public `ventehim25/gestion_vie`).

## Workflow (IMPORTANT)
- **Commit + push à CHAQUE modification.** Fin de message de commit :
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Toujours `node --check app.js` avant de committer.
- Après push, GitHub Pages redéploie (~30-90 s). Vérifier :
  `gh api repos/ventehim25/gestion_vie/pages/builds/latest --jq .status` → attendre `built`.
- **Jamais de données personnelles dans le code** (chiffres, noms). Le repo est public.
  Les données réelles vivent côté appareil + Gist privé (voir Sauvegarde).
- L'utilisateur a un **autre** projet privé « gestion filtre » — ne jamais y toucher.

## Données (state)
- Un seul objet global `DB`, persisté dans `localStorage` (clé `gestion_vie_v1`) en JSON.
- `seed()` = structure + valeurs par défaut (toutes à zéro/vides, jamais de perso).
- `migrate(d)` fusionne les données stockées avec `seed()` pour garantir que les nouveaux
  champs existent. **Quand tu ajoutes un champ au state, mets-le à jour dans `seed()` ET `migrate()`**
  (la fusion est volontairement explicite par clé pour les objets imbriqués : `meals`, `farm`, `mother`, `spiritual`, `car`, `health`, `health`, etc.).
- `save()` = `persist()` + `DB.updatedAt` + push GitHub différé. Toujours appeler `save()` après une mutation, puis `router()` pour réafficher.

## Sauvegarde GitHub (multi-appareils)
- Synchro via **Gist privé** (scope token = `gist` uniquement → ne touche aucun repo).
- Config dans `localStorage` (clé `gestion_vie_sync`) : `{ token, gistId, enabled }` — **séparée de DB**, jamais exportée.
- `ghPush/ghPull/ghCreateGist`, fichier `gestion-vie-data.json` dans le gist. Pull au démarrage si distant plus récent (`updatedAt`).
- `gestion-vie-*.json` est **gitignoré** (fichier de données local, ne jamais committer).

## Routing
- Hash router : `#/route`. Objet `routes` mappe route → `renderX(viewEl)`.
- **Onglets (barre du bas, dans `index.html`)** : Accueil(`/`), Budget, Planning, Repas, Famille, Maman, Ferme, Foi(`spirituel`), Projets.
- **Écrans hors barre** (accédés via Accueil → « Outils » ou liens) : `reglages`, `stats`, `revue`,
  `voiture`, `coffre`, `journal`, `sante`, `adhkar`, `rappels` (Documents & expirations), `garanties`, `prets`, `contacts`.
- `applyTheme()` est appelé dans `router()` (mode clair/sombre).

## Conventions UI
- Helpers : `el(html)`, `$(sel,parent)`, `field(label,inputHtml)`, `options(arr,sel)`, `modal(title,bodyHtml)`,
  `escape()`, `fmtDH()`, `todayISO()`, `monthOf()`, `uid()`.
- Les écrans construisent le HTML en template literal puis câblent les handlers (`.onclick`) après `v.append(el(...))`.
- Textes UI en français. Argent en DH. `isOwn(t)` exclut la caisse `Maman` du Budget/Accueil.

## Règles métier à connaître
- **Caisse Maman séparée** : le Budget = caisses `Moi`/`Business` seulement (`OWN_ACCOUNTS`). Tout ce qui est `account: 'Maman'` vit dans l'onglet Maman.
- **Ferme = 2 caisses** : `perso` et `partage`. La caisse partagée concerne **uniquement les oliviers**,
  répartie au prorata des arbres : total **211** = **79** (lui) + **132** (grand-mère). `treeSplit(montant)`.
- **Alarmes téléphone** : pas de push serveur. On génère des fichiers **.ics** (`downloadICS`) que l'utilisateur
  ouvre → ajout à l'agenda natif (prières 30 j, médicaments quotidiens, échéances, garanties).
- **Adhkar / Coran** : adhkar intégrés (arabe, hors-ligne) dans `ADHKAR` (matin/soir/prière/sommeil/quotidien).
  Coran Warsh + Hisn al-Muslim = liens PDF archive.org (vérifiés). Contenu religieux : rester prudent sur l'arabe.

## Ajouter une fonctionnalité (recette)
1. Si état persistant : ajouter le champ dans `seed()` **et** `migrate()`.
2. Écrire `renderX(v)` (+ modales associées).
3. Ajouter la route dans `routes`. Si onglet : `<a data-tab>` dans `index.html` (barre déjà chargée, 9 onglets max raisonnable). Sinon : lien depuis Accueil → Outils.
4. `node --check app.js`, commit, push, vérifier le build Pages.

## Profil utilisateur (contexte, ne pas coder en dur)
Distribue des filtres auto (Kénitra→Tanger/Marrakech), ~7000 DH/mois, capital ~300k.
Marié, 2 enfants, mère avec Alzheimer (loyer garage 1900/mois, dossier CNSS). Cherche logement. Pratiquant.
Fermes à Chichaoua (oliviers + moutons). Préfère des solutions **simples** et concrètes.
