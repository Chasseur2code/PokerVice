# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet
**PokerVice** : PWA 100 % statique pour gérer une partie de poker cash game entre amis (joueurs, buy-ins, recaves, départs, fin de partie, virements minimaux). Un seul appareil, pas de backend, pas de compte, persistance `localStorage`, français et euro uniquement.

Documents de référence (à lire avant toute tâche) :
- `SPEC.md` : le fonctionnel (fait foi pour le comportement et les règles de calcul).
- `DESIGN.md` : le visuel, direction « Feutre » (fait foi pour couleurs, typo, dimensions, géométrie de la table).
- Synthèse (le pourquoi, décisions, points ouverts) : `C:\Users\matth\Documents\Vault\Perso\02-Projets\pokervice\synthese.md`.

## État
La construction suit **`PLAN.md`** (étapes 0 à 10). Une session par étape : lire `PLAN.md`, annoncer le sous-plan, exécuter, terminer par `npm run test` + `npm run build` verts, cocher l'étape dans `PLAN.md`, mettre à jour cette section, commit. Étapes 0 à 5 faites (`lib/` testé ; store `src/store/game.ts` + hook `useGame` ; composants de base dans `src/ui/components/` ; page de démo temporaire `src/ui/Demo.tsx`, à remplacer). Prochaine étape : **6 (écran de préparation)**. Dépôt `Chasseur2code/PokerVice` (public), site en ligne : https://chasseur2code.github.io/PokerVice/ (redéployé à chaque push sur `main`).

## Commandes
- `npm run dev` (localhost:5173), `npm run dev:lan` (téléphone en wifi), `npm run build` (`tsc -b` puis `vite build`), `npm run preview`
- `npm run test`, `npm run test:watch`, `npm run typecheck`
- Test isolé : `npx vitest run src/lib/settlement.test.ts -t "nom du test"`

## Pièges et conventions
- Node 26 ARM64 dans `C:\Program Files\nodejs`. Dans le shell Bash de Claude, il peut manquer au PATH : préfixer `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Tokens de DESIGN §2 dans `@theme` de `src/styles/index.css` : `--color-x` → `bg-x`/`text-x`, `--radius-card` → `rounded-card`, `--shadow-card` → `shadow-card`, `--text-hero` → `text-hero`, `font-display` = Fraunces. Feutre/bois via `var(--felt)` etc. dans `:root`. Classe `num` = `tabular-nums`.
- Statut assis/parti **dérivé** du dernier `leave`/`return` (par `at`), pas stocké dans `Player`. Arrondis entiers via `divRound`/`divFloor` de `money.ts` (jamais `Math.round(a/b)`).
- Store : fabrique `createGameStore(storage)` (vanilla, testée sous Node avec un stockage mémoire) ; l'instance `gameStore` et `useGame(selector)` sont dans `store/useGame.ts`. Les actions renvoient `false` (ou `null`) si refusées. `finish` met la partie close dans `lastRecap` et une table vierge dans `game` : l'UI affiche le récap tant que `lastRecap` existe. Ne jamais muter l'état (l'annulation repose sur les références).
- Composants (`src/ui/components/`) : `PrimaryButton`/`SecondaryButton`/`IconButton` (`label` obligatoire), `BottomSheet` (contrôlée par `open`/`onClose`, portail vers `body`, `footer` = bouton principal, `full` = plein écran), `showToast(message, action?)` + un seul `<ToastHost />`, `NumberField` (texte brut, l'appelant parse avec `parseAmount`), `Table` (reçoit des `SeatSlot` déjà formatés ; positions via `lib/seats.ts`). Orientation : `useOrientation()` (ratio ≥ 5/4, pas `orientation:` à cause du clavier Android). Animations dans `index.css` (`.sheet-panel`, `.toast`, `.seat` qui centre via la propriété CSS `translate`, ne pas ajouter de `-translate-*` Tailwind).
- Preact : attribut `class` (pas `className`) ; `react` est aliasé vers `preact/compat` dans `tsconfig.app.json`.
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
