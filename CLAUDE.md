# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet
**PokerVice** : PWA 100 % statique pour gérer une partie de poker cash game entre amis (joueurs, buy-ins, recaves, départs, fin de partie, virements minimaux). Un seul appareil, pas de backend, pas de compte, persistance `localStorage`, français et euro uniquement.

Documents de référence (à lire avant toute tâche) :
- `SPEC.md` : le fonctionnel (fait foi pour le comportement et les règles de calcul).
- `DESIGN.md` : le visuel, direction « Feutre » (fait foi pour couleurs, typo, dimensions, géométrie de la table).
- Synthèse (le pourquoi, décisions, points ouverts) : `C:\Users\matth\Documents\Vault\Perso\02-Projets\pokervice\synthese.md`.

## État
Les 11 étapes de `PLAN.md` sont faites (v1 complète : PWA installable et hors ligne, tests Vitest + Playwright, Lighthouse mobile 100/100/100). Reste à faire par Matthieu : installation sur le téléphone, essai en mode avion, puis les points ouverts de la synthèse. Dépôt `Chasseur2code/PokerVice` (public), site en ligne : https://chasseur2code.github.io/PokerVice/ (redéployé à chaque push sur `main`). Avant de commit : `npm run test`, `npm run build` et `npm run test:e2e` verts.

## Commandes
- `npm run dev` (localhost:5173), `npm run dev:lan` (téléphone en wifi), `npm run build` (`tsc -b` puis `vite build`), `npm run preview`
- `npm run test`, `npm run test:watch`, `npm run typecheck`
- Test isolé : `npx vitest run src/lib/settlement.test.ts -t "nom du test"`
- `npm run test:e2e` : Playwright sur le build (`vite preview` port 4173, lancé par la config), avec le Chrome installé (`channel: 'chrome'`). Tests dans `e2e/`. Une partie se prépare en écrivant `localStorage['pokervice'] = { state: { game, lastRecap, unit }, version: 1 }`.
- `npm run icons` : régénère les PNG de la PWA (`scripts/icons.mjs`, sans dépendance).

## Pièges et conventions
- Node 26 ARM64 dans `C:\Program Files\nodejs`. Dans le shell Bash de Claude, il peut manquer au PATH : préfixer `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Tokens de DESIGN §2 dans `@theme` de `src/styles/index.css` : `--color-x` → `bg-x`/`text-x`, `--radius-card` → `rounded-card`, `--shadow-card` → `shadow-card`, `--text-hero` → `text-hero`, `font-display` = Fraunces. Feutre/bois via `var(--felt)` etc. dans `:root`. Classe `num` = `tabular-nums`.
- Statut assis/parti **dérivé** du dernier `leave`/`return` (par `at`), pas stocké dans `Player`. Arrondis entiers via `divRound`/`divFloor` de `money.ts` (jamais `Math.round(a/b)`).
- Store : fabrique `createGameStore(storage)` (vanilla, testée sous Node avec un stockage mémoire) ; l'instance `gameStore` et `useGame(selector)` sont dans `store/useGame.ts`. Les actions renvoient `false` (ou `null`) si refusées. `finish` met la partie close dans `lastRecap` et une table vierge dans `game` : l'UI affiche le récap tant que `lastRecap` existe. Ne jamais muter l'état (l'annulation repose sur les références).
- Composants (`src/ui/components/`) : `PrimaryButton`/`SecondaryButton`/`IconButton` (`label` obligatoire), `BottomSheet` (contrôlée par `open`/`onClose`, portail vers `body`, `footer` = bouton principal, `full` = plein écran), `showToast(message, action?)` + un seul `<ToastHost />` ; après une action du store, `showUndoToast(message)` (`ui/undo.ts`), `NumberField` (texte brut, l'appelant parse avec `parseAmount`), `Table` (reçoit des `SeatSlot` déjà formatés ; disposition via `seatLayout` de `lib/seats.ts` (centres, largeur max ou diamètre, carte de base), qui suppose une carte de 64 de haut au plus (`SEAT_TALL_HEIGHT`, à tenir à jour si la carte change) ; carte en `width: max-content` bornée par `min-width`/`max-width`, car un élément absolu en largeur auto se rétrécit à la place restante après `left`). Orientation : `useOrientation()` (ratio ≥ 5/4, pas `orientation:` à cause du clavier Android). Animations dans `index.css` (`.sheet-panel`, `.toast`, `.seat` qui centre via la propriété CSS `translate`, ne pas ajouter de `-translate-*` Tailwind).
- Écrans dans `src/ui/screens/`, sheets dans `src/ui/sheets/` (props `open`/`onClose`, état du formulaire réinitialisé dans un `useEffect` sur `open` ; saisie dans un `<form id>` soumis par le bouton du `footer` via `form={id}`). Actions du store via `gameStore.getState().x()` (pas de `useGame((s) => s)`, qui re-rendrait à chaque changement). Ordre des sièges : `fromBottom([...joueurs triés par seatOrder, ...vides])` (1er joueur en bas). Saisie de montant : `inputUnitFor`, `amountToInput`, `formatEquivalent`, `parseAmount` de `lib/units.ts`. `Table` + `onSwap` = échange par appui long.
- Assistant : `ChipStock.fixedValue` = valeur imposée (colonne « Valeur », vide ou « auto » = choisie par PokerVice). Sans valeur imposée, `search` garde l'algorithme d'origine ; avec, `searchFixed` (règles assouplies à côté d'une valeur imposée, unité = PGCD des valeurs). Les valeurs imposées ne sont pas gardées dans la config.
- Jetons : `setChipConfig(cfg, buyInCents?)` (buy-in de l'assistant dans la même action) ; `setBuyIn` en préparation recalcule le point d'une config assistant (stack de départ = buy-in). Valeur d'un point ou d'un jeton en € : `formatEuroFraction` (« ≈ » si non décimal). Palette des jetons dans `lib/chipColors.ts`, pastille `ChipDot`. Bandeau (`ChipBand`) seulement si `cfg.colors` ; sinon bouton « Jetons » dans la barre (aide Oui/Non sans config, convertisseur en lecture seule + calculatrice avec config).
- Fin de partie : `Game` affiche `EndGame` (état local `ending`) ; les stacks saisis restent locaux jusqu'à `finish`. L'écart et la validité d'un prorata ou d'une imputation se calculent avec `previewFinalBalances` (même logique que `finish`). Le récap (`lib/recap.ts`, `lib/recapText.ts`) est **toujours en €**, sans bascule d'unité. Partage : `ui/share.ts` (`navigator.share`, sinon copie avec repli `execCommand` ; en http sur le wifi, ni partage ni presse-papiers moderne). Les sheets bloquent le défilement par un compteur (`lockScroll`), pas en sauvegardant `overflow` (les sheets se chevauchent pendant les transitions). Confirmations via `ConfirmSheet`.
- Clavier virtuel : une sheet qui doit l'ouvrir pour une saisie (prénom) s'ouvre par un tap qui appelle `openKeyboard()` (`ui/keyboard.ts`) **de façon synchrone** : un champ relais invisible prend le focus pendant le geste, puis `initialFocus` le passe au vrai champ. Fin de partie : unité de saisie locale (Pts par défaut avec config jetons).
- Preact : attribut `class` (pas `className`) ; `react` est aliasé vers `preact/compat` dans `tsconfig.app.json`.
- PWA : `vite-plugin-pwa` (`generateSW`, `autoUpdate`) dans `vite.config.ts` ; le glob ne prend que js/css/html/woff2 (icônes du manifest et `includeAssets` ajoutés par le plugin, sinon doublons). Dans Git Bash, `BASE_PATH=/PokerVice/` est réécrit en chemin Windows : préfixer `MSYS_NO_PATHCONV=1`.
- `base` de Vite vient de `BASE_PATH` (fourni par `.github/workflows/deploy.yml` = `/<nom-du-dépôt>/`), `/` en local.

## Architecture visée (SPEC §10)
- **Logique métier en fonctions pures dans `/lib`**, sans dépendance à l'UI, testée avec Vitest : balances, argent en jeu, tapis moyen, répartition de l'écart, règlement minimal, assistant de répartition des jetons, conversions €/points/BB.
- **État** : un store unique persisté dans `localStorage` à chaque action, avec un numéro de version de schéma pour les migrations. Une seule partie en cours + le dernier récap.
- **Event sourcing léger** : la partie stocke des `events` horodatés (`buyin`, `rebuy`, `leave`, `return`, `final`) ; balances et stats sont **toujours dérivées** des événements, jamais stockées. L'historique modifiable et le toast « Annuler » reposent là-dessus.
- Le chrono se calcule depuis `startedAt` (jamais par incrément), pour survivre aux rechargements et à la mise en veille.

## Règles non négociables
- **Argent en centimes entiers, points en entiers. Aucun calcul monétaire en flottant.** La conversion €/point doit être exacte (fraction), pas un float.
- **Règlement final = nombre minimal exact de virements** (DP sur masques de bits, maximiser les sous-groupes disjoints de somme nulle), pas l'heuristique gloutonne. Résultat déterministe à égalité. Tests sur des cas où le glouton échoue.
- Écart de comptage au prorata : méthode du plus fort reste pour les centimes ; la somme des balances doit faire exactement 0.
- La configuration jetons est **verrouillée dès « Démarrer »**.
- L'app doit fonctionner **entièrement en € sans aucune mention de jeton** si aucune configuration jetons n'existe (pas de bascule, pas de bandeau).
- Principe UI « rien d'inutile à l'écran » : pas de stats avant démarrage, pas de ligne « Partis » vide, etc. (DESIGN §1).
- Aucune requête réseau tierce en production : polices Fraunces et Inter **auto-hébergées** en woff2 (pas de Google Fonts en ligne), aucun cookie ni analytics.
- Sur l'ambre (`--accent`), toujours du texte `--on-accent`, jamais du blanc. Montants via `Intl.NumberFormat('fr-FR', …)` avec `tabular-nums`.
- Performance prioritaire : fluide sur un smartphone moyen de gamme avec 10 joueurs et 50+ événements.

Les critères d'acceptation sont dans `SPEC.md` §12 ; le hors périmètre v1 dans §11 (ne pas l'implémenter sans demande).
