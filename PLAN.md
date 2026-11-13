# PokerVice — Plan de construction de A à Z

## Contexte
Le dépôt ne contient que `SPEC.md` (le fonctionnel), `DESIGN.md` (le visuel) et `CLAUDE.md` (les règles de travail). Il n'y a encore ni code, ni dépôt git, ni Node sur la machine (`node` est introuvable ; git 2.53 est présent). Le but est de découper la construction en étapes autonomes. Chacune sera exécutée par une session d'agent distincte, se terminera par des tests verts et un commit, et laissera l'app dans un état qui marche.

## Stack retenue (tranche le §10 de la spec)
| Sujet | Choix | Pourquoi |
|---|---|---|
| Build | Vite + TypeScript strict | Démarrage instantané ; le typage protège les calculs d'argent. |
| UI | **Preact** (+ `preact/compat`) | Même API que React pour ~4 Ko au lieu de ~45 Ko : c'est le bon choix pour un « téléphone moyen de gamme » (§1, performance). |
| État | **Zustand** + middleware `persist` (`version` + `migrate`) | Un store unique, sérialisé dans `localStorage` à chaque action, avec des migrations de schéma prévues dès le départ. |
| Styles | **Tailwind v4** ; les tokens de DESIGN §2 vont dans `@theme` (variables CSS) | Les tokens deviennent des classes (`bg-surface`, `text-accent-text`). |
| Polices | `@fontsource/fraunces` + `@fontsource/inter` (woff2, sous-ensemble latin) | Polices auto-hébergées, aucune requête vers Google (critère 8). |
| Icônes | `lucide-preact` (import par icône) | Le tree-shaking ne garde que les 7 icônes utilisées. |
| PWA | `vite-plugin-pwa` (Workbox, `registerType: 'autoUpdate'`) | Hors ligne et installation sur l'écran d'accueil. |
| Tests | Vitest pour `/lib` et le store ; Playwright pour un test de bout en bout à la fin | La logique pure est testée finement ; le parcours complet est vérifié une fois. |
| Déploiement | GitHub Pages via GitHub Actions | Gratuit, et le compte `Chasseur2code` est déjà en place. Attention : `base` doit valoir `/<nom-du-dépôt>/` dans Vite. |

**Comment les morceaux se relient** : `src/lib/` contient des fonctions pures (entrée → sortie, sans état). `src/store/` détient la partie : une liste d'événements, plus des actions qui ajoutent ou modifient ces événements. `src/ui/` lit le store et appelle les fonctions de `lib` pour *dériver* ce qu'il affiche (balances, stats). L'UI n'écrit jamais de calcul elle-même.

```
src/
  lib/      money.ts units.ts derive.ts settlement.ts discrepancy.ts chips.ts seats.ts recapText.ts types.ts
  store/    game.ts (Zustand, persist v1, actions = événements)
  ui/       components/ (BottomSheet, Toast, NumberField, Seat, Table…) screens/ (Setup, Game, EndGame, Recap) sheets/
  styles/   index.css (@theme tokens, @font-face via fontsource)
```

---

## Étapes
Chaque étape suit la même fin : `npm run test` et `npm run build` passent, mise à jour de la section « État » de `CLAUDE.md`, commit (ou plusieurs petits commits).

### [x] Étape 0 — Outillage et squelette
- Installer Node LTS **ARM64** (`winget install OpenJS.NodeJS.LTS` ou l'installeur de nodejs.org). Vérifier `node -v`. En cas de blocage par Smart App Control, prendre une version un peu plus ancienne.
- `git init`, `.gitignore` (node_modules, dist, .env), créer le dépôt GitHub sur le site.
- `npm create vite@latest . -- --template preact-ts`, puis installer Tailwind v4 (`@tailwindcss/vite`), Zustand, fontsource, lucide-preact et Vitest.
- `src/styles/index.css` : tous les tokens de DESIGN §2.1 à 2.6 dans `@theme`, les polices, `tabular-nums` et `lang="fr"`.
- Scripts npm : `dev`, `dev:lan` (`vite --host`, pour tester sur le téléphone en wifi), `build`, `preview`, `test`, `test:watch`, `typecheck`.
- Workflow `.github/workflows/deploy.yml` (build, puis Pages). Page « Hello PokerVice » déployée.
- `README.md` (ce que fait le projet, installation, architecture ci-dessus) ; compléter `CLAUDE.md` avec les commandes, dont le test isolé : `npx vitest run src/lib/settlement.test.ts -t "nom du test"`.
- Créer `Vault/Perso/02-Projets/pokervice/synthese.md` (décisions de stack ci-dessus).
- **Vérif** : `npm run dev` affiche la page, avec les bonnes polices et la couleur de fond `#F5F1E9` ; le site GitHub Pages est en ligne.

### [x] Étape 1 — Modèle et calculs de base (`lib/`)
- `types.ts` : `Game`, `Player`, `GameEvent`, `ChipConfig` (SPEC §10). La conversion €/point est une **fraction exacte** `{num, den}` de centimes par point.
- `money.ts` : centimes ↔ affichage `Intl fr-FR`, analyse d'une saisie française (« 12,5 » → 1250), arrondis entiers explicites.
- `units.ts` : conversions € ↔ points ↔ BB avec la fraction ; formatage selon l'unité courante.
- `derive.ts` : investi, balance, argent en jeu, tapis moyen (€ et BB), nombre de recaves, joueurs assis / partis, durée à partir de `startedAt`. Tout est calculé à partir des `events`.
- **Vérif** : tests Vitest couvrant chaque formule du §2.3, y compris un joueur parti puis revenu.

### [x] Étape 2 — Règlement et écart (`lib/`)
- `settlement.ts` : **nombre minimal exact de virements**. Programmation dynamique sur masques de bits : `dp[mask]` = nombre maximal de sous-groupes de somme nulle. Nombre de virements = n − nombre de groupes. On reconstruit ensuite les virements de chaque groupe (le plus gros débiteur paie le plus gros créancier). L'ordre est déterministe (tri par montant puis par id). Les balances nulles sont exclues ; au plus 2^20 états, ce qui est négligeable.
- Option « Arrondir à l'euro » : arrondir chaque virement, puis corriger le résidu sur le plus gros virement pour garder une somme nulle.
- `discrepancy.ts` : prorata des stacks finaux avec la méthode du plus fort reste ; « imputer à » un joueur ; message « Il manque X points (Y €) » ou « en trop ».
- **Vérif** : tests sur des cas où **le glouton échoue** (par ex. +8,+7,−4,−4,−7 : le glouton fait 4 virements, l'optimum 3), somme des balances = 0 au centime (critères 4 et 5), déterminisme.

### [x] Étape 3 — Assistant de répartition des jetons (`lib/chips.ts`)
- Entrées et règles de SPEC §5.1 à 5.3. Recherche exhaustive :
  1. trier les couleurs par quantité décroissante (les plus nombreuses prennent les petites valeurs) ;
  2. choisir k couleurs utilisées (3 à 7, le reste en réserve) ;
  3. choisir des suites de valeurs dans la série ronde 1, 2, 5, 10, 25, 50, 100…, avec un rapport de 2 à 5 entre deux valeurs successives et la plus petite valeur = SB = BB/2 ;
  4. pour chaque suite, répartir le stack (profondeur × BB) en jetons par joueur, en respectant le plafond `floor(qté / (joueurs × (1+recaves)))` ;
  5. noter chaque répartition : au moins 10 petits jetons, de quoi faire la monnaie à chaque niveau, peu de grosses valeurs.
  On garde la meilleure. Sinon, une erreur explicite indique la contrainte bloquante et ce qu'on peut assouplir.
- Fonction de recalcul pour l'édition manuelle (totaux, réserve, recaves possibles).
- **Vérif** : tests avec 4 à 7 couleurs et des quantités réalistes (par ex. une mallette de 300 ou 500 jetons) à 100 BB, plus un cas impossible (critère 6).

### [x] Étape 4 — Store et persistance (`store/game.ts`)
- État : `game` (une partie) + `lastRecap`. Actions : `setBuyIn`, `addPlayer`, `updatePlayer` (prénom et/ou couleur), `deletePlayer` (seulement sans transaction), `reorderSeats`, `setChipConfig` (refusée si `running`), `start`, `rebuy`, `leave`, `return`, `editEvent`, `deleteEvent`, `finish`, `newGame`, `setUnit`, `setWakeLock`.
- Annulation : chaque action garde l'état précédent (instantané) ; `undo()` est disponible pendant 5 s.
- `persist` : clé `pokervice`, `version: 1`, `migrate` prêt pour plus tard.
- **Vérif** : tests du store (enchaînement d'une partie complète, verrouillage de la config, annulation, rechargement simulé avec restauration à l'identique).

### [x] Étape 5 — Composants de base et table
- `BottomSheet` (mobile) / modale (≥ 768 px), animation de 220 ms, fermeture par glissement, voile ou Échap ; `Toast` (un seul à la fois, 5 s) ; `NumberField` (Fraunces 34, unité, équivalence affichée en dessous) ; boutons principal, secondaire et icône.
- `lib/seats.ts` : positions sur l'ellipse (DESIGN §3), tailles 84×58 puis 76×54 à partir de 9 joueurs, inversion de l'ovale en paysage (testé).
- `Table` : feutre, bois, liseré, centre configurable, sièges occupés, vides et mis en avant.
- **Vérif** : page de démo temporaire avec 2, 6 et 10 sièges, en portrait et en paysage.

### [x] Étape 6 — Écran de préparation (DESIGN §4.1)
- En-tête, carte buy-in avec sheet « Modifier », table avec 6 sièges vides, siège du bas mis en avant et « Commencez ici », états 0, 1 et 2+ joueurs, sheet « Nouveau joueur » (couleur attribuée automatiquement selon la palette §2.3), lien « Besoin d'aide pour les jetons ? » avec sa sheet Oui / Non (l'assistant et le convertisseur sont branchés à l'étape 8), bouton « Démarrer » désactivé ou en accent.
- **Vérif** : sur téléphone (`npm run dev:lan`), ajouter 3 joueurs puis démarrer.

### [x] Étape 7 — Écran de partie (DESIGN §4.2)
- 7a : carte de stats (tapis moyen en héros, durée qui tourne avec `setInterval` d'une seconde mais calculée depuis `startedAt`, en jeu, recaves), table avec l'investi, menu joueur (recave avec la pilule « +1 buy-in », quitter avec le toast de balance, renommer, couleur, supprimer), ligne « Partis » et sheet avec « Revenir à la table », ajout d'un joueur en cours de partie.
- 7b : toast « Annuler », sheet Historique (modifier ou supprimer avec confirmation), réordonnancement par appui long de 400 ms puis échange de sièges, bouton Wake Lock (masqué si l'API n'existe pas, réacquis sur `visibilitychange`).
- **Vérif** : une partie complète en € sur le téléphone, rechargement en pleine partie avec chrono intact (critères 1 et 2).

### [x] Étape 8 — Jetons : convertisseur, assistant, unités
- Convertisseur (SPEC §6) avec une calculatrice ; assistant (SPEC §5) en sheet plein écran : formulaire, proposition modifiable, message d'échec ; bascule segmentée € | Pts | BB dans l'en-tête ; bandeau jetons dépliable ; bouton « Jetons » dans la barre quand il n'y a pas de bandeau ; saisies en points dans les sheets ; verrouillage après « Démarrer ».
- **Vérif** : une partie avec l'assistant, une partie avec le convertisseur et une partie sans configuration. Dans ce dernier cas, **aucune** mention de jeton ne doit apparaître.

### [x] Étape 9 — Fin de partie et récap
- Confirmation, puis saisie joueur par joueur (progression « 3 / 6 », « Reste à attribuer » en vert ou rouge), carte d'écart avec Corriger, Prorata et Imputer à…, récap (balances triées avec le signe, virements, interrupteur « Arrondir à l'euro », stats et historique repliables), `lib/recapText.ts` au format exact de SPEC §8.3 avec copie dans le presse-papiers, « Nouvelle partie » avec confirmation, partie non rouvrable.
- **Vérif** : test unitaire du texte WhatsApp ; un joueur parti avant la fin apparaît dans les virements (critère 3).

### [ ] Étape 10 — PWA, responsive, finitions, mise en ligne
- `vite-plugin-pwa` : manifest « PokerVice », icônes 192, 512 et maskable, cache hors ligne de tout le build.
- Paysage et ordinateur : ovale horizontal, stats dans une colonne de 280 px. `prefers-reduced-motion`, `aria-label` sur les sièges et les icônes, contraste vérifié, zones de sécurité (safe-area).
- Performance : Lighthouse mobile ; test avec 10 joueurs et plus de 50 événements (pas de re-rendu de toute la table à chaque tic du chrono : le chrono a son propre composant).
- Test Playwright de bout en bout sur le parcours complet. Vérifier dans l'onglet Réseau qu'il n'y a **aucune requête tierce** (critère 8).
- Déploiement final, installation sur le téléphone, essai en mode avion. Revue des 9 critères de SPEC §12, synthèse Obsidian à jour.

---

## Comment faire exécuter ce plan (ma recommandation)
1. **Copier ce plan dans le dépôt** sous `PLAN.md`, avec une case à cocher par étape. Il sera versionné et servira de fil conducteur ; `CLAUDE.md` y renverra.
2. **Une nouvelle session Claude Code par étape**, dans ce même dossier (dans VS Code : nouvel onglet ou `/clear`). Message type : « Exécute l'étape N de PLAN.md. Annonce ton sous-plan, puis fais-la. » Chaque session démarre avec un contexte propre (elle lit `CLAUDE.md`, `PLAN.md`, `SPEC.md` et `DESIGN.md`), ce qui coûte moins cher et donne un meilleur résultat qu'une session géante qui s'alourdit.
3. **Pas de sous-agents lancés par moi**, et pas d'étapes en parallèle. Un sous-agent travaille en arrière-plan sans que tu puisses intervenir ni tester entre les étapes. Or chaque étape s'appuie sur la précédente, et c'est toi qui dois regarder le résultat sur ton téléphone avant de passer à la suite.
4. **Entre deux étapes** : tu testes (`npm run dev:lan` puis ouvrir l'adresse sur le téléphone), tu relis le diff ou tu lances `/code-review`, puis tu coches la case. Si quelque chose ne va pas, corrige-le dans la même session avant de commencer la suivante.
5. **Modèle** : Opus pour les étapes 2, 3 et 4 (algorithmes et store). Sonnet suffit pour l'outillage et une bonne partie de l'UI si tu veux économiser.

## Vérification globale
À la fin de l'étape 10 : les 9 critères de SPEC §12 sont validés un par un (tests Vitest pour 4, 5 et 6 ; Playwright pour 1, 2, 3 et 7 ; mode avion et onglet Réseau pour 8 ; profil Performance avec 10 joueurs et 50 événements pour 9).
