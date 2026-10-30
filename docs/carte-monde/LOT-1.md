# Carte du monde : lot 1 (statut : à valider)

## Ce que fait le lot

- **Une seule carte du monde par univers** (« + Carte du monde » dans Cartes). Les cités y sont reliées par des routes, entre forêts, rivières, hameaux et champs.
- **Entrer dans une cité sans changer de carte** : zoomer au plus près d'une cité y entre ; dézoomer au plus loin revient au monde. Le bouton « Entrer dans… » de la fiche de la cité et le bouton ↥ font la même chose. Si le groupe se tient devant la cité, il entre par la porte qui fait face à sa route.
- **Une cité se génère depuis sa fiche de lieu**, sans rien recopier. Le générateur lit sur la fiche la population et la présence d'une muraille, d'un château, d'une haute-ville, de faubourgs, de fermes et d'une rivière. Une cité peut aussi se créer par ses paramètres (onglet 🏰 Monde).
- **Génération déterministe** : une même cité donne toujours le même plan, au mètre près (graine stable). Ajouter une cité ne déplace jamais les autres.
- **Les lieux du lore prennent la place d'un bâtiment non découvert.** Une fiche de lieu rattachée à une cité occupe un bâtiment du bon type (taverne, forge, temple…) et du bon quartier. La fiche est rattachée si elle nomme la cité, sinon elle va à la cité par défaut. Les PNJ qui mentionnent le lieu, ou que la fiche du lieu nomme, y sont posés (« Sur place : Margot Lafleur (tenancière) »).
- **Contradictions** : un lieu non découvert suit sa fiche quand elle change. Un lieu déjà découvert ne bouge plus, et la contradiction est signalée dans l'onglet Monde. Une fiche supprimée laisse son lieu en place, signalé. Rien n'est jamais effacé.
- **Carte de combat dérivée du vrai plan** : rues, bâtiments, remparts, rivière, ponts, arbres et champs, toujours le même plateau au même endroit. Une case y mesure vraiment 5 pieds. Le plateau est peint en rues et toits, pas en roche.
- Navigation, brouillard, suivi du groupe, écran joueurs et combat sont ceux de l'Atlas des profondeurs. Une carte « monde » est traitée comme l'Atlas : lieux à révéler, chemins, révélation à l'arrivée.

## Fichiers

- Nouveaux, dans `src/maps/world/` :
  - `generate.js` (cités, monde, sol de combat) et `lore.js` (ancrage du lore), en JavaScript pur, avec leurs `.d.ts` ;
  - `index.ts` (raccord avec l'application) ;
  - `WorldPanel.tsx` (onglet Monde) ;
  - `world.test.mjs` (9 tests).
- Modifiés :
  - `atlas/types.ts` : `surface` d'un plan, nouveaux décors ;
  - `mapStore.ts` : type de carte `monde`, champ `world`, drapeau `surface` du plateau ;
  - `atlas/MapCanvas.tsx` : rendu de surface, zoom au-delà des limites ;
  - `atlas/atlas.css` ;
  - `battle/local.ts` : sol réel ;
  - `battle/BattleBoard.tsx`, `battle/BattleMode.tsx`, `battle/MiniBattle.tsx` : plateau peint en surface ;
  - `MapViewer.tsx`, `MapsPage.tsx`, `TableMap.tsx`, `playerBoard.ts` ;
  - `present/StageControl.tsx`, `present/stage.ts`, `present/PlayerScreen.tsx`.
- **Zone sensible** : `src/App.jsx`, une ligne. `MapsPage` reçoit désormais les fiches de la Bibliothèque (`library={inU(state.libraryEntries || {})}`).

## Lot 2 proposé : intérieurs

- Entrer dans un bâtiment ouvre son intérieur, généré à partir de la graine de la carte et de l'emplacement : toujours le même. Le gabarit dépend du type : une taverne a une salle commune, un comptoir, une cuisine et des chambres.
- Les PNJ liés y sont placés selon leur rôle : la tenancière se tient derrière le comptoir.
- Les portes des bâtiments deviennent des sorties du plateau de combat.
