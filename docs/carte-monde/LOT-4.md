# Carte du monde : lot 4, occupants des bâtiments (statut : à valider)

## Ce que fait le lot

- **Les PNJ sont visibles par défaut.** Sur la carte de combat, les jetons des PNJ sont visibles des joueurs et entrent dans l'initiative. Seule exception : le PNJ expressément caché, c'est-à-dire celui dont la fiche le dit embusqué, dissimulé, tapi, invisible, incognito ou caché. Il reste caché tant que le MJ ne le révèle pas, et n'est pas révélé d'office en entrant dans le bâtiment.
- **Chaque PNJ du lore va au niveau qui lui convient**, si le bâtiment a ce niveau :
  - voyageur, pensionnaire, pèlerin : dans une chambre à l'étage ;
  - famille, domestique, valet, chambellan : à l'étage ;
  - prisonnier, captif : dans une cellule des cachots ;
  - geôlier, bourreau : dans la salle de garde ;
  - fossoyeur, gardien de la crypte : dans la crypte ;
  - caviste : au cellier.

  Les autres restent au rez-de-chaussée, à leur place (comptoir, porte, enclume…).
- **Des occupants anonymes là où c'est logique**, toujours les mêmes pour un même bâtiment :

  | Niveau | Occupants |
  |---|---|
  | Chambres d'auberge ou de taverne | un voyageur dans environ une chambre sur deux (marchand de passage, pèlerin, mercenaire, colporteur, barde…) |
  | Appartements d'un hôtel particulier | un domestique |
  | Appartements d'un donjon | un garde sur le palier, et un chambellan |
  | Bureaux de guilde | un commis, parfois un scribe |
  | Logis d'échoppe ou de maison | parfois un enfant du propriétaire |
  | Cachots | un geôlier, et des prisonniers dans environ deux cellules sur cinq |
  | Cellier, crypte, réserve | vides |

- Chaque occupant a un prénom, un rôle accordé (geôlier ou geôlière) et une ligne de description. En combat, il devient un jeton comme les PNJ du lore.

## Fichiers

- `src/maps/world/interior.js` et `interior.d.ts` : répartition par niveau, occupants, PNJ cachés.
- `src/maps/atlas/types.ts` : drapeau `hiddenNpc`.
- `src/maps/battle/BattleMode.tsx` : jetons visibles par défaut.
- `src/maps/MapViewer.tsx` : un PNJ caché n'est pas révélé en entrant.
- `src/maps/world/world.test.mjs` : un test de plus.

Aucune zone sensible n'a été touchée : ni `App.jsx` ni `persist.js`.
