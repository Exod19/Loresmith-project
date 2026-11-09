# Lot 41 — Jeton du groupe déplaçable, zoom du plateau de combat, décor à l'échelle

## Ce qui change

- **Jeton du groupe** : sur la carte de navigation, le MJ peut saisir le jeton « Groupe » et le lâcher ailleurs.
  Lâché près d'un lieu ponctuel, il s'y accroche ; sinon il devient une position libre (nommée d'après la nature
  alentour sur la carte du monde). La zone est marquée comme explorée. Désactivé pendant un arrêt en chemin ou une
  bifurcation à trancher.
- **Zoom du plateau de combat** :
  - molette : zoom continu sous le pointeur (Maj + molette pour faire défiler) ;
  - deux doigts : pincer pour zoomer ;
  - boutons − / + : paliers (75 % à 300 %), même depuis un zoom libre ;
  - correction : sur ordinateur, le zoom n'agrandissait que la hauteur (le cadre, en flex, se rétrécissait).
    C'est maintenant le plateau qui grandit à l'intérieur d'un cadre qui défile dans les deux sens.
- **Intérieurs** : à la pose d'un nouvel intérieur, le plateau se cadre sur le bâtiment (zoom si le bâtiment est
  petit, puis centrage). La rue autour reste accessible en dézoomant.
- **Décor à l'échelle** : arbres et arbustes du plateau de combat dimensionnés d'après leur taille réelle.
  Banque : un puits devient un monument (et n'est plus tiré comme une plante), une termitière du « divers », les
  nénuphars, roseaux et carex des plantes d'eau, les houppiers d'arbustes et bananiers des arbustes.

## Fichiers

- `src/maps/atlas/MapCanvas.tsx`, `src/maps/atlas/atlas.css` : jeton du groupe saisissable (`onMoveParty`).
- `src/maps/MapViewer.tsx` : `moveParty` (accroche au lieu le plus proche, sinon position libre).
- `src/maps/battle/BattleMode.tsx`, `src/maps/battle/battle.css` : zoom ancré, molette, pincement, cadrage des intérieurs.
- `src/banque/boardDress.ts` : taille des arbres et arbustes.
- `scripts/banque/build.py`, `src/banque/catalogue.json` : règles de classement corrigées, catalogue régénéré.

## Vérifications

273 tests côté site et 14 côté serveur au vert ; build réussi ; lint sans erreur. Parcours Chromium : jeton glissé
(déplacé et renommé), molette (100 → 135 → 100 %), boutons, cadrage d'une taverne à l'ouverture du combat.
