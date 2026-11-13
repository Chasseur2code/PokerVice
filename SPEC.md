# PokerVice — Spécification v1

> Application web pour gérer une partie de poker **cash game à la maison** : joueurs, buy-ins, recaves, départs, fin de partie et remboursements avec le minimum de virements.
> Optimisée smartphone (portrait), utilisable sur ordinateur. Usage privé entre amis.

---

## 1. Principes

| Principe | Décision |
|---|---|
| Appareils | **Un seul appareil** tient la partie (le « banquier »). Pas de synchronisation multi-téléphones en v1. |
| Backend | **Aucun.** Site 100 % statique. |
| Comptes | Aucun compte, aucune authentification. |
| Vie privée | Aucun cookie, aucun tracker, aucune analytics, aucun bandeau RGPD ni politique de confidentialité. |
| Persistance | `localStorage` uniquement. Sauvegarde automatique après chaque action : fermer l'onglet ou redémarrer le téléphone ne perd rien. |
| Hors ligne | PWA installable sur l'écran d'accueil, fonctionne sans réseau. |
| Langue / devise | Français uniquement, euro (€) uniquement. |
| Hébergement | Gratuit (GitHub Pages ou Vercel). |
| Thème | **Clair uniquement** en v1, direction visuelle « Feutre » (voir `DESIGN.md`). |
| Performance | Priorité absolue : chargement rapide, interactions fluides sur un téléphone moyen de gamme. |

### Modèle de paiement
**Personne ne paie au début.** Les buy-ins et recaves sont enregistrés comme des montants investis. Tout se règle **par virements à la fin de la partie**, y compris pour les joueurs partis avant la fin.

### Données conservées
- **Une seule partie en cours** à la fois.
- **Le dernier récap** reste consultable jusqu'à la création d'une nouvelle partie, qui l'écrase après confirmation.

---

## 2. Concepts et unités

### 2.1 Unités d'affichage
L'app manipule trois unités :
- **€**, toujours disponible.
- **Points** : la valeur des jetons (par exemple « 2 350 »). Il s'agit de la valeur totale, **jamais du nombre de jetons physiques**.
- **BB** : le nombre de big blinds.

Les points et les BB ne sont disponibles que si une **configuration jetons** existe (voir 2.2).

L'app doit fonctionner **entièrement en €, sans aucune mention de jeton**, si aucune configuration jetons n'est définie. Dans ce cas, aucune bascule ni aucun bandeau jetons ne s'affiche.

### 2.2 Configuration jetons
Elle s'obtient de deux façons :
1. **Avec l'aide à la répartition** (section 5). On connaît alors la valeur en points de chaque couleur, la SB, la BB et la conversion €/point.
2. **Avec le convertisseur simple** (section 6). L'utilisateur saisit « 1 point = X € » et « BB = Y points ». On ne connaît pas les couleurs.

La configuration peut être définie à tout moment si elle n'existe pas encore. **Une fois définie et la partie démarrée, elle est verrouillée** et ne peut plus être modifiée.

### 2.3 Règles de calcul
- Tous les montants en € sont stockés en **centimes entiers**, et les points en **entiers**. Aucun calcul monétaire ne se fait en flottant.
- **Investi** d'un joueur = buy-in(s) + recaves.
- **Balance** d'un joueur = stack de sortie − investi. Positive : il doit recevoir. Négative : il doit payer.
- **Argent total en jeu** = somme des montants investis par tous les joueurs − somme des stacks de sortie des joueurs partis.
- **Tapis moyen** = argent total en jeu ÷ nombre de joueurs assis.
- **Tapis moyen en BB** = tapis moyen ÷ valeur de la BB, arrondi à l'entier. Affiché seulement si une configuration jetons existe.
- **Nombre de recaves** = nombre d'événements `rebuy` de la partie (les buy-ins initiaux et les buy-ins de retour ne comptent pas).

---

## 3. Parcours utilisateur

```
Arrivée sur le site
  └─ La table est directement affichée (pas d'écran « ouvrir une table »)
       ├─ Réglage du buy-in commun
       ├─ Ajout des joueurs autour de la table
       ├─ Bouton « Besoin d'aide pour les jetons ? »
       │     ├─ Oui → assistant de répartition (§5) → configuration jetons
       │     └─ Non → le bouton devient « Convertisseur jetons ↔ € » (§6)
       └─ Bouton « Démarrer » → lance le chrono, enregistre les buy-ins initiaux
  Pendant la partie
       ├─ Ajouter un joueur (avec buy-in)
       ├─ Recave
       ├─ Départ d'un joueur (saisie de son stack → balance affichée)
       ├─ Retour d'un joueur parti
       └─ Historique des actions
  « Terminer la partie »
       ├─ Saisie du stack final de chaque joueur assis
       ├─ Gestion d'un éventuel écart
       └─ Récap : balances + virements minimaux + stats + copie du texte
```

---

## 4. Écran principal : la table

### 4.0 Premier lancement (avant « Démarrer »)
L'écran doit guider sans texte superflu. **Aucune stat n'est affichée** (elles vaudraient toutes zéro).
De haut en bas :
1. **En-tête** : logo « PokerVice ».
   - **Bandeau d'installation** (smartphone, dans le navigateur, à chaque visite) : « Installez l'app : plein écran, hors connexion ». Bouton « Installer » si le navigateur le permet (Chrome Android), sinon le geste à faire (iOS : Partager → « Sur l'écran d'accueil » ; autres : menu du navigateur). Une croix le cache jusqu'à la prochaine visite ; il disparaît aussi dès que l'app est installée.
2. **Carte buy-in** : « Buy-in par joueur : 10 € » (10 € par défaut, puis le dernier buy-in utilisé), avec un bouton « Modifier ».
3. **La table** : sièges vides « + » en pointillés. Le siège du bas (le plus proche du pouce) est **mis en avant** avec la couleur d'accent et la mention « Commencez ici », qui disparaît dès le premier joueur ajouté. Au centre : « Installez vos joueurs » et « Touchez un siège + pour ajouter quelqu'un. »
4. **Lien discret** « Besoin d'aide pour les jetons ? » (voir §3, §5, §6).
5. **Bouton « Démarrer la partie »**, grisé tant qu'il y a moins de 2 joueurs, puis en couleur d'accent.

### 4.1 Disposition en partie (portrait)
De haut en bas :
1. **En-tête** : logo à gauche ; à droite, la **bascule d'unité € / Pts / BB**, visible seulement si une configuration jetons existe. Elle convertit **tous** les montants affichés dans l'app.
2. **Bandeau de stats** : le **tapis moyen** est mis en avant (à la façon d'un tournoi Winamax), avec en dessous son équivalent « soit 156 BB » si une configuration jetons existe. À côté, en petit : **durée** (chrono), **argent total en jeu**, **nombre de recaves**. Le nombre de joueurs assis n'est **pas** affiché : il se lit directement sur la table.
3. **La table** : un ovale vertical en **feutre vert**, avec les joueurs placés autour. Au centre : **la BB uniquement** (dans l'unité courante). Sans configuration jetons, le centre affiche le buy-in commun.
4. **Ligne « Partis »** repliée (par exemple « 1 parti · Thomas +12,40 € »), masquée s'il n'y a aucun joueur parti. Un tap la déplie (voir 4.4).
5. **Bandeau jetons compact**, visible seulement si les couleurs sont connues (aide utilisée). Il montre des pastilles de couleur avec leur valeur en points. Un tap le déplie pour afficher la SB, la BB, la valeur en € de chaque couleur et la conversion. Le bandeau reste **toujours visible**, pour éviter toute confusion avec les valeurs imprimées sur les jetons.
6. **Barre d'actions** : « Ajouter un joueur » (icône), « Historique » (icône) et **« Terminer la partie »** (bouton principal, large). Un bouton « Jetons » (icône) s'ajoute seulement s'il n'y a pas de bandeau jetons (convertisseur ou aucune configuration). Recave et départ ne sont **pas** dans la barre : ils passent par le tap sur un siège.

En **paysage** et sur **ordinateur**, la table s'élargit (ovale horizontal) et les stats peuvent passer sur le côté.

### 4.2 Sièges
- De 2 à 10 joueurs assis. Les positions sont calculées pour se répartir harmonieusement autour de l'ovale, quel que soit le nombre de joueurs.
- Chaque siège affiche la **couleur** propre au joueur (palette prédéfinie, en liseré), le **nom complet** (la carte s'élargit selon la place disponible, puis le nom passe sur deux lignes ; tronqué avec « … » au-delà, nom complet visible au tap), et le **total investi** dans l'unité courante.
- Pas de stack en temps réel : on ne cherche pas à suivre les stacks pendant la partie.
- Les sièges sont **réordonnables** (glisser-déposer) pour refléter les places réelles.
- Pas de bouton dealer.

### 4.3 Menu joueur (tap sur un siège)
- **Recave**
- **Quitter la table**
- **Renommer**
- **Changer de couleur**
- **Supprimer**, seulement si le joueur n'a aucune transaction (par exemple, ajouté par erreur)

### 4.4 Joueurs partis
- Ils sont retirés de la table et apparaissent dans une **liste « Partis »** (ligne repliée sous la table, qui se déplie en panneau), avec leur investi, leur stack de sortie, leur **balance** et l'heure de départ.
- Action **« Revenir à la table »** : le joueur se rassoit avec un nouveau buy-in (montant par défaut = buy-in commun, modifiable). Son historique et sa balance cumulée sont conservés.
- Ils sont **toujours inclus** dans le règlement final.

### 4.5 Écran allumé
Option (interrupteur) pour empêcher la mise en veille du téléphone pendant la partie, via l'API Wake Lock, si elle est disponible. Elle prend la forme d'un petit bouton icône dans l'en-tête, à gauche de la bascule d'unité, masqué si l'API n'existe pas.

---

## 5. Assistant de répartition des jetons

### 5.1 Entrées
| Champ | Défaut | Notes |
|---|---|---|
| Buy-in (€) | buy-in commun | |
| Nombre max de joueurs | nb joueurs actuels | 2 à 10 |
| Recaves attendues par joueur | 1 | sert à garder une réserve |
| Profondeur de départ | 100 BB | réglable de 50 à 200 |
| Couleurs | — | entre 4 et 7 couleurs. Pour chacune : une **couleur** (palette : blanc, rouge, vert, bleu, noir, violet, jaune, rose, orange, gris… avec un nom renommable), une **quantité** de jetons et une **valeur** facultative (valeur imprimée ; « auto » = choisie par PokerVice). Une valeur imposée veut dire « si cette couleur sert, c'est à cette valeur » : une couleur imposée qui n'entre pas dans le stack reste en réserve. |
| Mallettes précomposées | — | boutons qui remplissent les couleurs d'un coup (« Mallette de Félix ») ; liste dans `lib/chipColors.ts` |

### 5.2 Règles
- **Ratio SB:BB = 1:2.**
- **Le plus petit jeton vaut la SB.**
- **BB en € = buy-in ÷ profondeur** (par exemple 20 € et 100 BB donnent une BB à 0,20 €). Les montants en € n'ont pas à être ronds.
- Les valeurs en points suivent autant que possible une suite « ronde » : 1, 2, 5, 10, 25, 50, 100, 250, 500, 1 000…
- Stack de départ par joueur = profondeur × BB, en points.
- Contrainte de stock : pour chaque couleur, nb par joueur × nb max de joueurs ≤ quantité disponible (stacks de départ).
- **Recaves à part** (idée reprise de [poker-chipper](https://github.com/jstrieb/poker-chipper)) : la réserve des couleurs utilisées doit permettre de composer nb max de joueurs × recaves attendues recaves d'un stack chacune, **dans n'importe quelle composition**, gros jetons d'abord (par exemple 2 jetons de 100 pour une recave de 200 pts). Une recave n'a pas à reproduire le stack de départ.
- **Couleurs de recave** (« plaques ») : si la réserve des couleurs du stack ne suffit pas, l'assistant ajoute une couleur (deux au plus) **absente des stacks de départ**, qui ne sert qu'aux recaves. Sa valeur : la valeur imprimée, ou une valeur ronde, au-dessus de la plus grosse valeur du stack et au plus égale au stack ; la plus petite qui suffit (plus facile à changer). Elle a une valeur dans la config (bandeau, convertisseur), 0 jeton par joueur, et toute sa quantité compte dans la réserve. Exemple : mallette de Félix, 6 joueurs, 1 recave : stack 1-5-10-25, noirs à 100 pour les recaves.
- Une couleur peut rester entièrement en réserve, sans valeur, si c'est utile.

### 5.3 Objectif : liquidité maximale
L'algorithme cherche la répartition qui permet à **chaque joueur de miser n'importe quel montant et de rendre la monnaie** :
- assez de jetons de la plus petite valeur par joueur pour payer les blinds plusieurs fois et faire l'appoint. Le besoin dépend du rapport r avec la couleur suivante (r − 1 jetons composent tout montant inférieur, plus une marge pour les blinds) : **conseillé r + 3, minimum r (3 au moins), cible 2r**. Soit 8 conseillés et 5 au minimum pour r = 5, et 5 conseillés et 3 au minimum pour r = 2. **Contrainte souple** : entre le minimum et le conseillé, la répartition est proposée avec un avertissement plutôt que refusée ;
- un écart raisonnable entre deux valeurs successives (rapport de 2 à 5, idéalement) ;
- pour chaque valeur, assez de jetons de la valeur inférieure pour faire la monnaie ;
- le moins possible de jetons de forte valeur dans le stack de départ ;
- pas de piles inutiles. Si la couleur suivante vaut r fois plus, r − 1 jetons suffisent pour composer tout montant et 2r permettent de payer deux fois sans faire la monnaie. On ne pénalise donc rien jusqu'à 2r jetons, on pénalise légèrement jusqu'à 3r et fortement au-delà. Pour la plus petite et la plus grosse couleur, ces seuils sont d'au moins 10 et 15 (la plus petite paie aussi les blinds ; la plus grosse porte la valeur en quelques jetons). 20 jetons d'une couleur au maximum.

Les couleurs les plus nombreuses reçoivent en priorité les plus petites valeurs. La recherche peut être exhaustive (l'espace est petit : 7 couleurs au plus) avec une fonction de score. L'implémentation est à préciser en mode plan.

### 5.4 Sortie
- **Une seule proposition** : la meilleure.
- Elle affiche la valeur de chaque couleur (en points et en €), la SB et la BB, la composition du stack de départ par joueur (nb de jetons de chaque couleur), le total par joueur (points, €, BB) et la réserve restante par couleur, avec le nombre de recaves (gros jetons d'abord) qu'elle permet pour toute la table.
- La proposition est **modifiable à la main** (valeurs et quantités par joueur) avant validation. Les totaux sont recalculés en direct.
- **Si aucune répartition correcte n'existe**, un message clair indique la contrainte qui bloque et ce qu'on peut assouplir (moins de BB, moins de recaves prévues, moins de joueurs).
- La validation crée la configuration jetons. Elle est verrouillée dès que la partie démarre.

### 5.5 Recaves en jetons
Pas de répartition par couleur pour les recaves. L'app affiche seulement l'équivalent en points (et en BB) du montant recavé.

---

## 6. Convertisseur simple (sans l'aide)

Si l'utilisateur répond « Non » à l'aide, le bouton devient **« Convertisseur jetons ↔ € »**. Il ouvre une fenêtre :
- Champs : **1 point = X €** et **BB = Y points**.
- Une calculatrice rapide convertit un montant saisi en €, en points et en BB.
- La validation crée la configuration jetons (sans couleurs, donc sans bandeau jetons). La bascule € / Points / BB devient disponible.
- La configuration est verrouillée dès que la partie a démarré.

---

## 7. Actions de partie

Toutes les actions sont **horodatées (heure réelle)**. La durée écoulée se recalcule à partir de l'heure de début.

| Action | Saisie | Effet |
|---|---|---|
| **Démarrer** | — | Enregistre l'heure de début, lance le chrono, enregistre un buy-in pour chaque joueur assis, verrouille la configuration jetons. |
| **Ajouter un joueur** | nom, buy-in (défaut = buy-in commun, modifiable) | Nouveau siège, couleur attribuée automatiquement (modifiable ensuite par « Changer de couleur »). Si la partie a démarré, un buy-in est enregistré. |
| **Recave** | montant : raccourci « +1 buy-in » ou montant libre, en € (ou en points si une configuration existe) | Augmente l'investi. Pas de plafond. |
| **Quitter la table** | stack de sortie (en € ou en points) | Le joueur passe dans « Partis ». **Sa balance s'affiche immédiatement** (par exemple « Hugo : +12,40 € »). |
| **Revenir** | buy-in | Le joueur se rassoit. |

### Correction et annulation
- Un toast **« Annuler »** s'affiche quelques secondes après chaque action.
- L'**historique** liste toutes les actions (heure, joueur, type, montant). Chaque entrée est **modifiable ou supprimable**, avec confirmation. Les balances sont recalculées.

### Historique
Il est consultable **pendant la partie** (dans un panneau) et **dans le récap final**.

### Chrono
- Il démarre au bouton « Démarrer » et ne s'arrête jamais (pas de pause).
- Il est calculé à partir de l'heure de début, et non par incrément, pour rester exact après une mise en veille ou un rechargement.

---

## 8. Fin de partie

### 8.1 Saisie des stacks finaux
- « Terminer la partie » demande une **confirmation**. La même confirmation propose aussi **« Abandonner la partie (sans récap) »** : retour à une table vide, sans saisie des stacks ni récap (annulable 5 s).
- Une seule page liste tous les joueurs assis, chacun avec son champ de stack final (à remplir dans n'importe quel ordre ; Entrée passe au prochain champ vide), en € ou en points : une bascule € | Pts propre à cet écran, sur **Pts par défaut** s'il existe une configuration jetons (sinon tout en €).
- Un compteur **« Reste à attribuer »** part de l'argent total en jeu et diminue jusqu'à 0. « Valider » s'active quand tous les stacks sont saisis.

### 8.2 Écart de comptage
Si la somme des stacks finaux ne correspond pas à l'argent total en jeu :
- l'app affiche l'écart **en points et en €** (par exemple « Il manque 140 points (1,40 €) » ou « 140 points (1,40 €) en trop ») ;
- **« Corriger »** permet de revenir à la saisie ;
- **« Répartir au prorata »** répartit l'écart au prorata des stacks finaux (méthode du plus fort reste pour les centimes) ;
- **« Imputer à… »** reporte tout l'écart sur un joueur choisi.

### 8.3 Récap
- Les **balances** de tous les joueurs, partis compris : investi, stack final, balance. Tri du plus gros gagnant au plus gros perdant, avec un code couleur gain / perte.
- Les **virements proposés** : « Julie → Hugo : 23,50 € ».
  - **Nombre de virements minimal exact** (pas l'heuristique gloutonne) : maximiser le nombre de sous-groupes disjoints de somme nulle, avec une programmation dynamique sur masques de bits. C'est faisable car le nombre de participants est petit. À nombre de virements égal, le résultat doit être déterministe.
  - Calcul au centime. Une option **« Arrondir à l'euro »** arrondit les virements, puis ajuste pour que la somme reste nulle.
- Des **stats** : durée, total des buy-ins, plus gros gagnant, plus gros perdant.
- L'**historique** complet des actions.
- Un bouton **« Copier pour WhatsApp »** qui copie un texte brut, par exemple :

```
PokerVice — 05/11/2026 · 20:12 → 01:47 (5h35)

Balances
+42,30 € Hugo
+12,10 € Sarah
 -4,40 € Léo
-50,00 € Julie

Virements
Julie → Hugo : 42,30 €
Julie → Sarah : 7,70 €
Léo → Sarah : 4,40 €
```

### 8.4 Après le récap
- La partie est **close et non rouvrable**.
- Le récap reste affiché ou accessible jusqu'à la création d'une **nouvelle partie** (bouton dédié, avec la confirmation « le récap précédent sera effacé »).

---

## 9. Design

La direction retenue est **« Feutre »**. Les couleurs, typographies, dimensions et la description de chaque écran sont dans **`DESIGN.md`**, qui fait foi pour tout ce qui est visuel. En résumé :
- **Thème clair et chaleureux** : fond crème, cartes blanc cassé, texte brun très foncé.
- **Table réaliste** : feutre vert en léger dégradé, bord en bois, liseré intérieur discret.
- **Une seule couleur d'accent, l'ambre** : pour l'action principale, le tapis moyen et le siège mis en avant au premier lancement.
- **Typographie** : Fraunces (logo, gros chiffres, titres) et Inter (interface), avec des chiffres à chasse fixe.
- **Interface sobre** : rien n'est affiché s'il est inutile à ce moment-là (pas de stats avant le démarrage, pas de bascule sans configuration, pas de ligne « Partis » vide).
- **Ergonomie** : cibles tactiles d'au moins 44 px, et clavier numérique pour les saisies (`inputmode="decimal"`).
- **Feuilles d'action** (recave, départ…) : en **bottom sheets** sur mobile, en modales sur ordinateur.
- **Animations** légères seulement, sans effet coûteux.

---

## 10. Technique (recommandation, à valider en mode plan)

| Sujet | Proposition |
|---|---|
| Build | Vite + TypeScript |
| UI | React (ou Preact pour la légèreté) |
| Styles | Tailwind CSS |
| État | Store unique (Zustand ou `useReducer`) persisté dans `localStorage`, avec un numéro de version de schéma pour migrer plus tard |
| PWA | `vite-plugin-pwa` (manifest « PokerVice », icônes, cache hors ligne) |
| Tests | Vitest sur la logique pure : balances, argent en jeu et tapis moyen, répartition de l'écart, règlement minimal, algorithme de répartition des jetons, conversions |
| Architecture | Toute la logique métier en **fonctions pures**, séparées de l'UI (`/lib`) |
| Déploiement | GitHub Pages ou Vercel (gratuit) |

### Modèle de données (indicatif)
```ts
Game {
  version, status: 'setup' | 'running' | 'finished',
  createdAt, startedAt?, endedAt?,
  defaultBuyInCents,
  chipConfig?: {
    mode: 'assistant' | 'converter',
    centsPerPoint (rationnel ou fraction exacte), bbPoints, sbPoints,
    colors?: [{ id, name, hex, valuePoints, perPlayer, totalQty }]
  },
  players: [{ id, name, color, seatOrder, status: 'seated' | 'left' }],
  events: [{ id, at, type: 'buyin' | 'rebuy' | 'leave' | 'return' | 'final',
             playerId, amountCents }],
  discrepancyResolution?: { type: 'prorata' | 'assign', playerId? },
  wakeLock: boolean
}
LastRecap { ...snapshot de la partie terminée + virements calculés }
```
Les balances et les stats sont **dérivées** des événements, jamais stockées.

---

## 11. Hors périmètre v1 (à faire plus tard)

- [x] **Mode sombre** (fait le 2026-11-13 : bouton lune dans l'en-tête, suit le système tant qu'on n'a rien choisi)
- [ ] **Emoji par joueur**
- [ ] **Mode tableau** (vue liste ou tableau des joueurs, alternative à la table ovale)
- [ ] **Transferts entre joueurs** : (a) achat de jetons entre joueurs, (b) prêt pour une recave, (c) remboursement déjà fait pendant la soirée
- [ ] Paiement direct d'un joueur au moment de son départ
- [ ] Synchronisation multi-téléphones (backend)
- [ ] Rappels de pause
- [ ] Plusieurs propositions de répartition des jetons
- [ ] Historique de plusieurs parties
- [ ] Export du récap en image

---

## 12. Critères d'acceptation clés

1. Sans aucune configuration jetons, on peut jouer une partie complète en € : joueurs, recaves, départs, fin, récap et virements.
2. Après un rechargement de la page en pleine partie, tout est restauré à l'identique, chrono compris.
3. Un joueur parti avant la fin apparaît dans les balances et dans les virements.
4. Le nombre de virements proposé est le minimum exact (vérifié par des tests sur des cas où l'heuristique gloutonne échoue).
5. La somme des balances fait exactement 0 € après la résolution de l'écart, au centime près.
6. Avec 4 à 7 couleurs et des quantités réalistes, l'assistant propose une répartition à 100 BB ou explique pourquoi c'est impossible.
7. La configuration jetons ne peut plus être modifiée après « Démarrer ».
8. L'app fonctionne hors ligne une fois installée, sans cookie ni requête réseau tierce.
9. Les interactions restent fluides sur un smartphone milieu de gamme, avec 10 joueurs et plus de 50 événements.
