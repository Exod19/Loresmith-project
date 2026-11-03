# Lot 31 (série lieux sauvages) : créatures de la banque sur le plateau, fonds tactiques (statut : à valider)

## Ce qui change

- **Créatures de la banque sur le plateau de combat.** Un monstre sans image prend le jeton vu du dessus de la banque
  qui porte son nom (dossiers « créatures » du Drive).
  - Le nom de créature le plus long contenu dans celui du jeton l'emporte : « Araignée géante chasseuse 2 » → Araignée
    géante, « Otyugh » → Otyugh.
  - Pour quelques fiches SRD (grick, otyugh, roper, cube gélatineux, araignée géante…), la fiche suffit.
  - Toujours la même image pour un même nom.
  - Les jetons sont dessinés en entier, sans médaillon, et tournés vers leur vis-à-vis, comme ceux des personnages.
  - Même rendu sur l'écran des joueurs.
  - Le fil d'initiative montre le portrait de la créature (sa version « de face » dans la banque).
  - Une image choisie par le MJ prime toujours ; sans créature à son nom, le portrait SRD ou le jeton générique reste.
- **Fonds tactiques** (onglet Construire, rubrique « Fond tactique »). Une tuile de la banque couvre tout le plateau : rivière
  centrale, coude, jonction en T, gué, rivage, baie, promontoire, ravin, ravine, angle de plateau.
  - Le terrain de chaque case est lu dans l'image (`src/banque/tiles.js`) :
    - eau turquoise → eau peu profonde ;
    - eau sombre → eau profonde ;
    - noir d'un ravin → gouffre ;
    - herbe → herbe ;
    - roche grise → sol rocheux ;
    - galets d'un gué → gué.
  - Ces terrains sont posés comme corrections de cases : les règles (terrain difficile, nage, vide) s'appliquent, et le MJ
    corrige à la main s'il veut.
  - « Retirer le fond tactique » rend les corrections d'avant.
  - Le fond s'affiche aussi sur l'écran des joueurs et sur la mini-carte.
  - L'image est cadrée comme une couverture : centrée, rognée sur le côté qui dépasse.

## Fichiers

- Nouveaux :
  - `src/banque/tiles.js`, `tiles.d.ts`, `tiles.test.mjs` (3 tests) ;
  - `src/maps/battle/TilePanel.tsx`.
- Modifiés :
  - `src/banque/index.ts` : `creatureToken`, `creaturePortrait`, images de `creatures/` reconnues comme jetons ;
  - `src/maps/battle/vignettes.ts` (`tokenImage`) ;
  - `BattleBoard.tsx`, `BattleMode.tsx`, `MiniBattle.tsx`, `battle.css` ;
  - `src/maps/mapStore.ts` (`battle.tile`) ;
  - `src/maps/playerBoard.ts`, `src/present/stage.ts`, `src/present/PlayerScreen.tsx` ;
  - `scripts/banque/build.py` : « Angle de plateau granitique » est une tuile tactique, pas une texture de sol ;
  - `src/banque/catalogue.json`.
- **Zone à risque : `src/App.jsx`**. Une ligne dans `combatantPictureOf` (portrait de la banque en dernier recours pour
  l'initiative) et l'import correspondant.

## Limites

- Une tuile ne tourne pas encore (orientation fixe).
- Les jetons déjà posés ne bougent pas si leur case devient un gouffre ou de l'eau profonde.
