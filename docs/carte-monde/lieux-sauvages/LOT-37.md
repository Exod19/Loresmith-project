# Lot 37 (série lieux sauvages) : l'intérieur du combat est celui de la navigation (statut : à valider)

## Ce qui change

- **Mobilier repris tel quel.**
  - Le plateau de combat d'un intérieur porte le dessin du mobilier de la carte de navigation (comptoir, cheminée,
    four, tabourets, tapis, escaliers, trappe…), mis à l'échelle des cases (`local.decor`).
  - Les images de la banque se posent par-dessus (tables, lits, tonneaux, coffres, autels), avec la même image, la même
    taille et le même sens qu'en navigation (`local.furniture`, `propSprite` partagé avec `BankLayer`).
  - Les tuiles brunes génériques ne s'affichent plus, et un obstacle isolé ne devient plus un tonneau ou un coffre tiré
    au sort.
- **Sol et dehors.**
  - Le plancher n'est plus remplacé par des pavés : le « dehors » s'arrêtait mal aux portes de 2 cases et entrait dans
    le bâtiment (`outsideOf`, `paintInterior`).
  - Autour du bâtiment, le sol reste neutre, comme sur la carte de navigation.
- **Heure et lumière.**
  - Le soir et la nuit, le terrain et le mobilier s'assombrissent comme en navigation, sur l'écran du MJ, sur l'écran
    joueur et sur la mini-carte. Les jetons restent lisibles.
- **Les gens suivent l'heure.**
  - Les PNJ présents sur le plateau sont ceux de la navigation à cette heure-là.
  - Quand ils changent (le soir, la nuit, la saison), ceux qui sont partis quittent le plateau et les nouveaux venus
    prennent leur place (`placeNpcs`, effet sur `npcKey`).

## Vérification

Dans le navigateur, taverne de Brumeval :

- de jour comme de nuit, le plateau porte les tables rondes, les tabourets, la cheminée, le four, le comptoir, les
  tonneaux et la trappe de la carte de navigation, aux mêmes places ;
- la nuit, le plateau est assombri et le personnel de nuit remplace celui du jour.

## Fichiers

- `src/banque/BankLayer.tsx` (`propSprite`), `src/banque/boardDress.ts`.
- Combat : `src/maps/battle/BattleBoard.tsx` (`FurnitureLayer`, tracés, lumière), `BattleMode.tsx` (`furnitureOf`,
  `decorOf`, `placeNpcs`), `groundCells.ts`, `MiniBattle.tsx`, `battle.css`.
- Écran joueur et données : `src/maps/mapStore.ts`, `src/maps/playerBoard.ts`, `src/present/stage.ts`,
  `src/present/PlayerScreen.tsx`.
- Zones à risque : non touchées.
