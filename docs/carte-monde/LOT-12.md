# Carte du monde : lot 12, échelle, relief, distances et placement (statut : validé)

## Ce qui change

- **Une échelle par monde.** Elle se choisit dans le panneau Monde : région (~50 km), royaume (~500 km, par défaut pour un nouveau monde) ou continent (~2 000 km).
  - Tout est à taille réelle. Une cité de 1 500 habitants fait environ 2 km avec ses champs ; une chaîne de montagnes, des centaines de kilomètres ; une forêt, des dizaines.
  - Le repère d'une cité reste lisible, mais sa tache sur la carte a sa vraie taille.
- **Relief continu** (`world/terrain.js`).
  - L'altitude va jusqu'à ~4 000 m. Les montagnes forment des chaînes, et chaque monde de départ en a au moins une.
  - La neige vient avec l'altitude et la latitude, et les pentes sont ombrées.
  - Les biomes se fondent les uns dans les autres, avec des limites ondulées.
  - Les forêts ont une canopée ; les champs entourent les cités.
  - Le relief est défini partout en kilomètres : agrandir le monde (lot 13) ne changera rien à ce qui existe.
- **Côtes irrégulières.** Une mer n'existe que pour les cités portuaires. Son rivage a des baies, des péninsules et des îles, là où le relief émerge. Un port est placé sur une côte ; s'il n'y en a pas, une mer est créée au-delà du bord le plus proche.
- **Rivières et lacs.** Les rivières naissent en altitude, là où il pleut, et descendent la pente jusqu'à la mer, au bord du monde ou à un creux où elles forment un lac. Il y a aussi des lacs de plaine.
- **Routes par les vallées.** Elles sont tracées par A* sur le relief : la pente, les cols et la forêt coûtent, la mer et les lacs bloquent.
  - Chaque route affiche sa longueur et sa durée, par exemple « 168 km · 4 ½ jours de marche ».
  - Les hameaux s'égrènent le long des routes : un à mi-chemin, deux sur une très longue route.
- **Distances.** Le panneau Monde liste les distances depuis une cité : km par la route (le plus court chemin dans le réseau) ou à vol d'oiseau, direction, et jours aux rythmes de D&D 5e (lent 29, normal 38, rapide 48 km par jour).
- **Distances voulues.**
  - Elles se lisent sur une fiche (« à deux jours de marche au nord de Brumeval », « à 80 km à l'ouest d'Arnfel », « à trois jours à cheval de… ») ou se saisissent avec 📏 Situer.
  - Le placement les respecte autant que possible, en plaine, sur la terre ferme et à l'écart des autres cités.
  - Le panneau signale celles qu'il n'a pas pu tenir.
- **📍 Déplacer une cité.** On clique ensuite sur la carte du monde. Le plan de la cité ne change pas ; un port garde la mer de son côté.
- **Combat sur la carte du monde.** Le plateau vient du terrain réel du lieu :
  - une pente raide donne des rochers et des éboulis, la neige du terrain difficile, la forêt des arbres ;
  - une montagne ne tient pas dans un plateau de combat : on combat sur son flanc ;
  - les couleurs du plateau suivent le terrain (neige, froid, chaud).
- **Fluidité.** Le relief se dessine dans un « worker », sans geler l'interface.

## Ce qui ne bouge pas

- Les mondes créés avant ce lot gardent leur carte, à l'identique. L'option « Ancienne carte » reste sélectionnée.
- Choisir une échelle convertit le monde : les cités gardent leur disposition et leur plan ; le relief, les forêts, les rivières et les routes sont redessinés ; un port garde une mer de son côté.
- Les lieux posés, découverts ou renommés dans les cités ne bougent pas.

## Fichiers

- Nouveaux : `world/terrain.js`, `terrain.d.ts`, `reliefImage.ts`, `reliefWorker.ts`.
- Modifiés :
  - génération : `world/generate.js` (branche « monde à l'échelle », sol de combat), `generate.d.ts`, `index.ts` (placement, déplacement, échelle, distances), `lore.js` et `lore.d.ts` (distances lues sur les fiches) ;
  - interface : `WorldPanel.tsx`, `MapViewer.tsx` (déplacer une cité), `atlas/MapCanvas.tsx` (image du relief), `atlas/types.ts`, `atlas/atlas.css` ;
  - combat : `battle/BattleMode.tsx` (thème du plateau selon le terrain) ;
  - tests : `world.test.mjs` (deux nouveaux tests).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limites

- Le relief est une image d'environ 820 px de large : il devient flou quand on zoome beaucoup. Les détails fins (rivières, routes, cités) restent nets.
- Les noms des éléments naturels d'un ancien monde converti sont tirés à nouveau.
