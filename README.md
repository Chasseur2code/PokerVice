# PokerVice

Application web (PWA) 100 % statique pour gérer une partie de poker **cash game** entre amis : joueurs, buy-ins, recaves, départs, fin de partie et calcul du **nombre minimal de virements** pour se rembourser.

- Un seul appareil, pas de serveur, pas de compte : tout est stocké dans le `localStorage` du navigateur.
- Français et euro uniquement. Fonctionne hors ligne une fois installée.
- Aucune requête vers un service tiers (polices auto-hébergées, ni cookie ni analytics).

Le fonctionnel est décrit dans [SPEC.md](SPEC.md), le visuel dans [DESIGN.md](DESIGN.md), et la construction étape par étape dans [PLAN.md](PLAN.md).

## Installation

Prérequis : Node.js LTS (≥ 22) et git.

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # accessible depuis le téléphone sur le même wifi (adresse « Network » affichée)
```

| Commande | Rôle |
|---|---|
| `npm run dev` / `dev:lan` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Vérifie les types puis produit le site statique dans `dist/` |
| `npm run preview` | Sert `dist/` localement, comme en production |
| `npm run test` / `test:watch` | Tests Vitest (une fois / en continu) |
| `npm run typecheck` | Vérification TypeScript seule |

## Déploiement

Chaque push sur `main` lance [.github/workflows/deploy.yml](.github/workflows/deploy.yml) : tests, build, puis publication sur **GitHub Pages**. Le workflow passe `BASE_PATH=/<nom-du-dépôt>/` à Vite, car Pages sert le site dans un sous-dossier.

Configuration unique sur GitHub : *Settings → Pages → Build and deployment → Source : GitHub Actions*.

## Stack

| Sujet | Choix |
|---|---|
| Build | Vite + TypeScript strict |
| UI | Preact (API de React, ~4 Ko) |
| État | Zustand + `persist` (localStorage, schéma versionné) |
| Styles | Tailwind CSS v4, tokens de design dans `@theme` ([src/styles/index.css](src/styles/index.css)) |
| Polices | Fraunces et Inter via fontsource (woff2 auto-hébergés) |
| Icônes | lucide-preact |
| Tests | Vitest (logique), Playwright (parcours complet, plus tard) |

## Architecture

```
src/
  lib/      fonctions pures : argent, unités, dérivations, règlement, écart, jetons, sièges, texte du récap
  store/    store Zustand unique : la partie = une liste d'événements ; les actions ajoutent/modifient des événements
  ui/       composants et écrans Preact
  styles/   index.css (tokens, polices)
```

Les morceaux se relient dans un seul sens : **`ui/` lit `store/` et appelle `lib/`** pour dériver ce qu'il affiche.

- La partie est stockée comme une suite d'**événements horodatés** (`buyin`, `rebuy`, `leave`, `return`, `final`). Balances et statistiques ne sont jamais stockées : elles sont recalculées à partir des événements, ce qui rend l'historique modifiable et l'annulation triviales.
- Toute la logique de calcul vit dans `lib/`, sans dépendance à l'UI, et est testée unitairement.
- L'argent est manipulé en **centimes entiers** ; aucun calcul monétaire en virgule flottante.
