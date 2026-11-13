# PokerVice — Instructions de design (direction « Feutre »)

> Ce document complète `SPEC.md` (le *quoi*) : il décrit le *comment visuel*. En cas de doute sur le fonctionnel, `SPEC.md` fait foi ; pour tout ce qui est visuel, c'est ce document.
> Maquettes de référence : « Main » (premier lancement) et « A-Partie » (en partie), au format iPhone 390 × 844 px. Exporte-les en PNG depuis le canevas pour les donner à l'agent.

---

## 1. Principes (à respecter partout)

1. **Une seule chose importante à la fois.** Chaque écran met en avant une action principale. Elle seule a la couleur d'accent.
2. **Rien d'inutile à l'écran.** On masque ce qui est vide ou sans objet :
   - pas de stats avant « Démarrer » ;
   - pas de bascule € / Pts / BB sans configuration jetons ;
   - pas de ligne « Partis » s'il n'y en a aucun ;
   - pas de bandeau jetons sans couleurs connues ;
   - pas d'information qu'on lit déjà ailleurs (par exemple, le nombre de joueurs se voit sur la table).
3. **La table est l'interface.** On agit sur un joueur en touchant son siège. La barre du bas ne contient que les actions globales.
4. **Le pouce d'abord.** Les actions fréquentes sont en bas de l'écran, avec des cibles d'au moins 44 × 44 px.
5. **Une ambiance chaleureuse mais sobre.** On reste sur un club de poker en thème clair : pas de dégradés décoratifs hors de la table, pas d'emoji, pas d'ombres lourdes.

---

## 2. Design tokens

À déclarer en variables CSS (ou dans `theme.extend` si Tailwind).

### 2.1 Couleurs de l'interface
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F5F1E9` | Fond de l'app (crème) |
| `--surface` | `#FFFDF8` | Cartes, sièges, bottom sheets |
| `--surface-muted` | `#E9E1D3` | Fond de la bascule segmentée |
| `--border` | `#EDE5D7` | Séparateurs internes |
| `--border-strong` | `#D9CDBB` | Bordure des boutons secondaires |
| `--border-dashed` | `#B9A88F` | Sièges vides en pointillés |
| `--text` | `#2B2118` | Texte principal (brun très foncé) |
| `--text-muted` | `#6B5A48` | Libellés, texte secondaire |
| `--text-faint` | `#8C7A63` | Icône des sièges vides, bouton désactivé |
| `--accent` | `#D4952A` | **Ambre** : action principale, filet du tapis moyen, siège mis en avant |
| `--on-accent` | `#2B1A05` | Texte et icônes posés sur l'ambre (jamais de blanc) |
| `--accent-text` | `#7A4A0C` | Ambre foncé pour du texte sur fond clair (libellé « TAPIS MOYEN », « Commencez ici ») |
| `--accent-halo` | `rgba(200,134,42,0.28)` | Halo de 6 px autour du siège mis en avant |
| `--brand-green` | `#1F6B45` | Partie « Vice » du logo |
| `--gain` | `#1C6B3F` | Balances positives |
| `--loss` | `#B42318` | Balances négatives |
| `--disabled-bg` | `#E4DACB` | Bouton principal désactivé (texte `--text-faint`) |
| `--toast-bg` | `#2B2118` | Toast « Annuler » (texte blanc, action en `--accent`) |

### 2.2 La table
| Élément | Valeur |
|---|---|
| Feutre | `radial-gradient(ellipse at 50% 38%, #2F8A57 0%, #217049 55%, #175636 100%)` |
| Bord en bois | bordure de 14 px, `#6E4428` |
| Ombres | `0 10px 24px rgba(60,35,15,.28)`, `inset 0 0 0 2px rgba(255,255,255,.10)` et `inset 0 8px 30px rgba(0,0,0,.25)` |
| Liseré intérieur | ellipse en retrait de 28 px, bordure de 1 px `rgba(255,255,255,.22)` |
| Texte sur le feutre | `#FFFFFF`, et `rgba(255,255,255,.8)` pour le secondaire |

### 2.3 Couleurs des joueurs (palette de 10, dans cet ordre d'attribution)
`#E5484D` rouge · `#3E63DD` bleu · `#F59E0B` ambre · `#8E4EC6` violet · `#12A594` sarcelle · `#E93D82` rose · `#F76B15` orange · `#05A2C2` cyan · `#A18072` brun · `#6B7280` gris

### 2.4 Couleurs des jetons (assistant de répartition)
On dessine chaque pastille avec un fond plein et un anneau intérieur de 3 px (`box-shadow: inset 0 0 0 3px <anneau>`).

| Nom | Fond | Anneau |
|---|---|---|
| Blanc | `#FFFFFF` | `#CFC6B8` |
| Rouge | `#D63A3A` | `#F1B5B5` |
| Vert | `#1F8A4C` | `#A9DABC` |
| Bleu | `#2F5BD3` | `#B4C6F4` |
| Noir | `#1F1F1F` | `#8A8A8A` |
| Violet | `#7D3FC0` | `#D2B8EF` |
| Jaune | `#F2C230` | `#FAE7A6` |
| Rose | `#E0457B` | `#F6BCD0` |
| Orange | `#EE7A1E` | `#F8CDA6` |
| Gris | `#8B8F96` | `#D3D5D9` |

### 2.5 Typographie
- **Fraunces** (Google Fonts, graisses 600 et 700) : logo, gros chiffres (tapis moyen, BB, buy-in), titres de feuilles.
- **Inter** (graisses 400, 500, 600 et 700) : tout le reste.
- Activer `font-variant-numeric: tabular-nums` sur tous les montants, pour que les chiffres ne « dansent » pas pendant le chrono.
- **Performance** : auto-héberger les deux polices en woff2 (sous-ensemble latin), avec `font-display: swap`. Aucune requête vers Google en production (voir le critère 8 de la spec).

| Style | Police | Taille / graisse |
|---|---|---|
| Logo | Fraunces | 22 px / 700, lettrage −0,3 px. « Poker » en `--text`, « Vice » en `--brand-green` |
| Chiffre héros (tapis moyen) | Fraunces | 34 px / 700 |
| Chiffre centre table (BB) | Fraunces | 30 px / 700, blanc |
| Buy-in (carte de préparation) | Fraunces | 28 px / 700 |
| Titre au centre de la table | Fraunces | 22 px / 600 |
| Libellé en capitales | Inter | 12 px / 600, capitales, lettrage 0,6 à 1 px |
| Texte courant | Inter | 14 px / 400 à 600 |
| Nom du joueur sur un siège | Inter | 13 px / 600 |
| Montant sur un siège | Inter | 14 px / 700 |
| Bouton principal | Inter | 16 à 17 px / 700 |

### 2.6 Formes et espacements
- **Marges de l'écran** : 16 px sur les côtés, 12 à 16 px en haut et 16 à 20 px en bas. Prévoir aussi `env(safe-area-inset-*)`.
- **Espacement vertical entre blocs** : 10 px en partie, 14 px en préparation.
- **Rayons** :
  - cartes : 16 px ;
  - sièges : 14 px ;
  - boutons de la barre : 14 px ;
  - bouton principal : 14 à 16 px ;
  - lignes « Partis » et bandeau jetons : 12 px ;
  - bascule segmentée : 12 px (conteneur) et 9 px (segments) ;
  - bottom sheet : 20 px en haut.
- **Ombres** :
  - cartes : `0 1px 2px rgba(60,40,20,.08), 0 0 0 1px rgba(60,40,20,.06)` ;
  - sièges : `0 3px 8px rgba(40,25,10,.22)`.
- **Hauteurs** : bouton principal de 52 à 56 px, boutons icônes de 52 × 52 px, segments de 34 px (avec une zone tactile d'au moins 44 px grâce au padding du conteneur), lignes repliables de 44 px.

### 2.7 Icônes
Icônes au trait, épaisseur 2 px, bouts arrondis, 22 px (type Lucide). Celles utilisées : `user-plus` (ajouter un joueur), `clock` (historique), `plus` (siège vide), `chevron-down` (déplier), `pencil` (modifier), `sun` (écran allumé), `coins` (jetons, quand il n'y a pas de bandeau). Tout bouton qui n'a qu'une icône doit avoir un `aria-label`.

---

## 3. Géométrie de la table

Sur un écran de 390 px de large, la zone de la table mesure **358 × 460 px**. Pour d'autres tailles, on garde les proportions avec des pourcentages, et la hauteur de la zone suit l'espace disponible.

- **Ovale** : 290 × 400 px, placé à (34, 30) dans la zone, donc centré en (179, 230).
- **Centres des sièges** : ils sont sur une ellipse de rayons `rx = 140` et `ry = 200`, centrée en (179, 230).
- **Formule** pour N joueurs (de 2 à 10), siège i (de 0 à N−1), en partant du haut et dans le sens horaire :
  `θ = i × 360° / N` ; `x = cx + rx·sin θ` ; `y = cy − ry·cos θ`.
- **Siège occupé** : carte centrée sur (x, y), de 58 px de haut au minimum (54 px à partir de 9 joueurs). Sa largeur suit le prénom, entre 84 px (76 px à partir de 9 joueurs) et un maximum propre à chaque siège : la plus grande largeur qui ne touche ni les sièges voisins (6 px d'écart) ni le bord de la zone (6 px de débord tolérés), plafonnée à 140 px. À 2 joueurs, les deux sièges (haut et bas) ont donc 140 px. Le calcul est dans `seatMaxWidths` (`lib/seats.ts`).
- **Siège vide** : rond de 52 px, bordure de 2 px en pointillés `--border-dashed`, fond `--bg`, icône « + » en `--text-faint`.
- **Siège mis en avant** (premier lancement) : rond de 68 px, fond `--accent`, bordure de 4 px `--bg`, halo `0 0 0 6px var(--accent-halo)` et icône « + » en `--on-accent`.
- **Paysage et ordinateur** : l'ovale passe à l'horizontale (on inverse rx et ry), et le bandeau de stats va dans une colonne à gauche (environ 280 px de large).

---

## 4. Écrans maquettés

### 4.1 Premier lancement (avant « Démarrer ») — maquette « Main »
De haut en bas, dans une colonne flex :
1. **En-tête** (40 px) : logo à gauche ; à droite, la bascule d'unité s'il existe une configuration jetons, sinon rien.
2. **Carte buy-in** (`--surface`, rayon 16, padding 14 × 16) :
   - à gauche, le libellé « Buy-in par joueur » (13 px muted) et la valeur « 10 € » en Fraunces 28 ;
   - à droite, un bouton « Modifier » en pilule de 44 px de haut, fond `--bg`, bordure `--border-strong`. Il ouvre une bottom sheet de saisie.
3. **Table** (voir §3) :
   - **6 sièges vides** au départ ;
   - le **siège du bas** (θ = 180°) est le siège mis en avant ;
   - au centre, sur le feutre : « Installez vos joueurs » (Fraunces 22) puis « Touchez un siège + pour ajouter quelqu'un. 2 joueurs minimum. » (Inter 14, blanc à 86 %).
4. **« Commencez ici »** : 14 px / 600, en `--accent-text`, centré sous la table. Il disparaît après le premier joueur.
5. **En bas** (poussé par `margin-top: auto`) :
   - le lien souligné « Besoin d'aide pour les jetons ? » (14 px, `--text-muted`) ;
   - le bouton **« Démarrer la partie »** sur toute la largeur, 56 px de haut.

**États :**
- **0 joueur** : comme sur la maquette, avec le bouton grisé (`--disabled-bg`).
- **1 joueur** : le texte du centre devient « Encore 1 joueur » ; le siège mis en avant passe au siège vide suivant.
- **2 joueurs ou plus** : le centre affiche la BB si une configuration existe, sinon le buy-in. « Démarrer la partie » passe en `--accent` avec un texte `--on-accent`. Il n'y a plus de siège mis en avant, seulement des sièges vides normaux.
- **Sièges vides** : on en affiche toujours au moins un, tant qu'il y a moins de 10 joueurs. Au-delà de 6 joueurs, on n'affiche plus qu'**un seul** siège vide.
- **Tap sur un siège vide** : bottom sheet « Nouveau joueur ». On y trouve seulement le champ prénom (avec focus automatique), puis le bouton « Ajouter ». La couleur est attribuée automatiquement (première libre de la palette §2.3) ; elle se change ensuite via « Changer de couleur » dans le menu joueur.
- **Lien jetons** : un tap ouvre une petite bottom sheet avec deux choix, « Oui, aide-moi à répartir les jetons » (vers l'assistant) et « Non, juste convertir points ↔ € » (vers le convertisseur). Une fois « Non » choisi, le lien devient « Convertisseur jetons ↔ € ».

### 4.2 En partie — maquette « A-Partie »
1. **En-tête** (40 px) :
   - à gauche, le logo ;
   - à droite, la **bascule segmentée € | Pts | BB** (conteneur `--surface-muted`, segment actif `--surface` avec une ombre légère et un texte de graisse 700). Elle n'apparaît que si une configuration jetons existe ;
   - entre les deux, le bouton icône « Écran allumé » (`sun`, 44 px), qui passe en `--accent` quand il est actif.
2. **Carte de stats** (`--surface`, rayon 16), en deux colonnes :
   - **Gauche** (flexible), avec un filet de 4 px `--accent` sur le bord gauche :
     - le libellé « TAPIS MOYEN » (12 px, capitales, `--accent-text`) ;
     - la valeur « 31,27 € » (Fraunces 34) ;
     - puis « soit 156 BB » (13 px, muted), seulement si une configuration existe.
   - **Droite** (séparée par une bordure gauche de 1 px `--border`) : trois lignes de 13 px, avec le libellé en muted à gauche et la valeur en 600 `--text` à droite : **Durée** (h:mm:ss), **En jeu**, **Recaves**.
3. **Table** (voir §3) :
   - **Sièges occupés** : carte `--surface`. Liseré de 4 px à gauche dans la couleur du joueur (à la place d'une pastille, pour laisser toute la largeur au nom). Puis le prénom, sur deux lignes au plus avant d'être tronqué avec « … » (le nom complet s'affiche au tap). Enfin le total investi dans l'unité courante.
   - **Centre** : « BIG BLIND » (12 px, capitales, blanc à 80 %) au-dessus de la valeur (Fraunces 30). Sans configuration jetons, on affiche à la place « BUY-IN » et le buy-in commun.
4. **Ligne « Partis »** (44 px, fond transparent, bordure 1 px `#E2D8C8`, rayon 12) :
   - texte : « 1 parti · **Thomas** **+12,40 €** », avec le dernier parti et sa balance en `--gain` ou `--loss` ;
   - un chevron à droite ;
   - un tap ouvre la liste complète en bottom sheet ;
   - la ligne est masquée s'il n'y a aucun parti.
5. **Bandeau jetons** (44 px, `--surface`, rayon 12) :
   - pastilles de 16 px avec leur valeur en points (« 10 », « 50 », « 100 », « 500 »), et « pts » à droite en muted ;
   - un tap le déplie, en place ou en sheet, pour montrer la SB, la BB, la valeur en € par couleur et « 1 pt = 0,01 € » ;
   - il est masqué s'il n'y a pas de couleurs connues.
6. **Barre d'actions** (en bas, `margin-top: auto`) :
   - deux boutons icônes de 52 × 52 px, « Ajouter un joueur » et « Historique » (fond `--surface`, bordure `--border-strong`, rayon 14) ;
   - le bouton **« Terminer la partie »**, qui prend toute la largeur restante, en `--accent` avec un texte `--on-accent` ;
   - un bouton icône « Jetons » s'ajoute avant « Terminer » seulement s'il n'y a pas de bandeau jetons.

---

## 5. Composants transverses (non maquettés, à construire dans le même style)

### Bottom sheet (mobile) / modale (ordinateur, à partir de 768 px)
- **Conteneur** : fond `--surface`, rayon 20 px en haut, poignée de 36 × 4 px `--border-strong` centrée, voile `rgba(43,33,24,.4)`.
- **Contenu** : titre en Fraunces 20 / 600. Le bouton principal, sur toute la largeur et 56 px de haut, est toujours en bas de la sheet.
- **Fermeture** : on ferme en glissant vers le bas, en touchant le voile ou avec la touche Échap.
- **Champs numériques** :
  - grand champ centré en Fraunces 34, avec l'unité affichée à droite (« € » ou « pts ») ;
  - `inputmode="decimal"`, focus automatique ;
  - si une configuration existe, l'équivalent dans l'autre unité s'affiche en dessous (par exemple « = 2 000 pts · 100 BB »).

### Menu joueur (tap sur un siège)
Bottom sheet avec le nom du joueur et sa pastille en en-tête, puis :
1. **Recave**, en action principale. Elle ouvre directement la saisie, avec la pilule « +1 buy-in (20 €) » présélectionnée et un champ libre.
2. **Quitter la table** : saisie du stack de sortie. Après validation, un toast affiche la balance (« Hugo : +12,40 € », coloré en gain ou perte).
3. **Renommer** et **Changer de couleur** : ce sont des lignes de liste plus discrètes.
4. **Supprimer** : en `--loss`, et seulement si le joueur n'a aucune transaction.

### Réordonner les sièges
Un appui long (400 ms) sur un siège le soulève : agrandissement à 1,05 et ombre plus forte. On le dépose sur un autre siège pour échanger les places. Aucune poignée visible n'est ajoutée.

### Toast « Annuler »
- Il apparaît en haut de l'écran, 12 px sous la zone de sécurité (il ne masque ni la barre d'actions ni le clavier), avec un fond `--toast-bg`, un texte blanc de 14 px et l'action « Annuler » en `--accent` (graisse 700).
- Il reste 5 secondes, et un seul toast est affiché à la fois.

### Historique
Bottom sheet en plein écran, avec une liste chronologique inversée :
- chaque ligne affiche l'heure (muted), la pastille du joueur, le nom, le type (« Recave », « Départ »…) et le montant à droite ;
- un tap sur une ligne propose « Modifier » ou « Supprimer », avec une confirmation.

### Fin de partie
- **En-tête** : logo seul ; à droite, uniquement la bascule d'unité de saisie s'il existe une configuration jetons. Aucun libellé d'état (« Fin de partie », « Partie terminée ») sur cet écran ni sur le récap.
- **Saisie des stacks** : un écran par joueur assis, avec une barre de progression (« 3 / 6 ») et le compteur **« Reste à attribuer »** en héros (Fraunces 34). Ce compteur passe en `--gain` quand il atteint 0, ou en `--loss` s'il devient négatif.
- **Écart de comptage** : une carte affiche le message (« Il manque 140 points (1,40 €) ») et trois boutons empilés : Corriger, Répartir au prorata, Imputer à…

### Récap
- **Liste des balances** : triée, avec la pastille du joueur, le nom, et le montant en `--gain` ou `--loss` (graisse 700) aligné à droite.
- **Virements** : sous forme de cartes « Julie → Hugo » avec le montant en Fraunces.
- **Actions** : le bouton principal **« Copier pour WhatsApp »** en accent, puis l'interrupteur « Arrondir à l'euro », les stats et l'historique dans des sections repliables.
- Le bouton « Nouvelle partie » est en bas, en style secondaire.

### Assistant jetons et convertisseur
Ils s'ouvrent en bottom sheet plein écran. On y reprend les cartes `--surface`, les pastilles de jetons (§2.4) et le bouton principal en accent. Les valeurs modifiables sont présentées en lignes « pastille · nom · valeur · par joueur », avec des champs numériques compacts.

---

## 6. Mouvement
- Les bottom sheets s'ouvrent en 220 ms (`cubic-bezier(.2,.8,.2,1)`).
- Les toasts apparaissent en 150 ms (fondu et descente de 8 px).
- Au tap, un siège descend à `scale(.97)`.
- Respecter `prefers-reduced-motion` en supprimant les translations.
- Pas d'animation sur le chrono, seulement le changement du texte.

## 7. Accessibilité
- On utilise de vrais `<button>` et `<input>` avec leur `<label>`. Les sièges sont des boutons, avec un `aria-label` du type « Hugo, 20 € investis ».
- Contraste minimum de 4,5:1 : sur l'ambre, toujours `--on-accent`, jamais du blanc. Pour du texte ambre sur fond clair, utiliser `--accent-text`.
- Les gains et pertes ne sont pas signalés que par la couleur : le signe + ou − est toujours affiché.
- `lang="fr"` ; montants au format français (`Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`), espaces insécables comprises.
