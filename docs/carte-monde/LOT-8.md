# Carte du monde : lot 8, personnage du MJ et mode Exploration (statut : validé)

## Ce que fait le lot

- **Mode Exploration** : le bouton « 🎭 Exploration » de la barre de la carte du monde est réservé au MJ. Ton personnage y arpente le monde sans toucher au groupe ni à ce que voient les joueurs.
  - On se déplace avec « 🎭 Y aller » sur un lieu, en entrant dans une cité ou un bâtiment (bouton ou zoom), et en prenant les escaliers et les sorties.
  - Ton personnage est marqué sur la carte, en doré.
- **Fiche de ton personnage** : nom, rôle, apparence et portrait. Le portrait est réduit à 192 px pour rester léger.
- **Rêverie ou Chronique** : Rêverie est le mode par défaut, et on peut basculer à tout moment.
  - En Rêverie, rien ne compte, sauf ce que tu définis ou gardes.
  - En Chronique, ce que ton personnage fait sera réel pour les joueurs. Ça prendra son sens avec les conversations et les rencontres des lots suivants.
- **Brouillon ou canon** : en exploration, ce qui est encore tiré au sort s'affiche estompé, avec un nom en italique. Ça touche :
  - les bâtiments sans lieu du lore ;
  - les occupants anonymes ;
  - les hameaux, les forêts, les rivières et les lacs.

  Les cités, le château, les rues, les lieux du lore, les résidents et tout ce qui a été renommé sont canon.
- **Définir le monde en le parcourant** :
  - « ✦ Définir ce bâtiment » : un nom, un type (taverne, temple, forge…) et ce qu'on en dit. La fiche de lieu est créée dans la Bibliothèque, et le lieu est épinglé à ce bâtiment. Il n'en bouge plus, même si sa fiche ne dit pas de quel type il est, et aucune contradiction n'est signalée.
  - « ✓ Garder tel quel » : un brouillon devient canon sans changement.
  - Les occupants se définissent avec « Créer la fiche » (lot 5), et tout se renomme (lot 7).
- **🥚 Le personnage caché** : « Le cacher ici » laisse ton personnage là où il se trouve, comme un PNJ ordinaire, avec son nom, son rôle, son apparence et son portrait. Les joueurs pourront le croiser, et il entre en combat comme les autres PNJ. « Ne plus le cacher » le retire du monde.

## Fichiers

- Nouveau : `src/maps/world/ExplorePanel.tsx`.
- Modifiés :
  - `src/maps/world/generate.js` et `generate.d.ts` : brouillons, personnage caché, types de l'avatar ;
  - `src/maps/world/lore.js` : lieux épinglés ;
  - `src/maps/world/index.ts` : la position de l'avatar ne relance pas la génération ;
  - `src/maps/MapViewer.tsx` : mode Exploration et déplacements de l'avatar ;
  - `src/maps/MapsPage.tsx` : création de fiche de lieu par l'action `ADD_LIBRARY_ENTRY` existante ;
  - `src/maps/atlas/MapCanvas.tsx`, `src/maps/atlas/types.ts`, `src/maps/atlas/atlas.css`, `src/present/stage.ts` ;
  - `src/maps/world/world.test.mjs` : un test de plus.

Aucune zone sensible n'a été touchée : ni `App.jsx` ni `persist.js`.
