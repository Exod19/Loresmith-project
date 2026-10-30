# Carte du monde : lot 7, tout renommer et un tracé plus naturel (statut : validé)

## Tout renommer

- **Partout sur la carte du monde** : le bouton « ✎ Renommer » de la fiche d'un lieu donne un autre nom à ce lieu. Ça vaut pour une rue, un bâtiment, une place, une porte, un hameau, une forêt, une rivière, une pièce ou un occupant.
  - Le nouveau nom s'affiche partout où le lieu apparaît, y compris dans le titre du plan intérieur d'un bâtiment renommé et du plan d'un hameau renommé.
  - « ↺ Nom d'origine » remet le nom tiré au sort.
  - Pour un occupant anonyme, mieux vaut créer sa fiche : son nom tient alors à toute heure.
- **Une cité** se renomme depuis sa fiche ou depuis l'onglet 🏰 Monde, et son nom change partout : routes, portes, plans. Sa fiche de lore n'est pas touchée.
- **Le monde lui-même** se renomme depuis l'onglet 🏰 Monde.

## Un tracé plus naturel

### Cités

- La rue de ceinture n'est plus un cercle : elle s'élargit et se resserre.
- Les grand-rues, les ruelles et la montée du château serpentent.
- Chaque maison a un retrait et un angle un peu différents de sa voisine. Les rangées s'interrompent de temps à autre pour une cour ou un jardin.
- Les arrière-cours varient en largeur.
- Les champs ont des bords un peu de travers.

### Villages et hameaux

- Plus de ceinture ni de ruelles en étoile. La route traverse en serpentant, et deux à quatre chemins partent de la place ou de la grand-rue vers les fermes.
- Les maisons sont posées librement le long des chemins, avec des jardins entre elles.
- Un village est plus lâche qu'une ville (environ 45 habitants à l'hectare, contre 170), et sa place est petite.

### Intérieurs

- Les tables d'une salle commune sont posées au gré des clients. Rondes ou longues, un peu tournées, avec leurs tabourets ; jamais collées entre elles ni sur un escalier.
- Chaque chambre est meublée à sa façon : lit à gauche ou à droite, coffre au pied du lit ou contre le mur, parfois une petite table.
- Sur la carte de combat, les tables tournées comptent comme du décor, à leur vraie place.

## Fichiers

- `src/maps/world/generate.js` et `generate.d.ts` : tracé, villages, noms choisis.
- `src/maps/world/interior.js` : tables, tabourets, chambres.
- `src/maps/world/WorldPanel.tsx` : renommer le monde et les cités.
- `src/maps/MapViewer.tsx` : « ✎ Renommer » et « ↺ Nom d'origine ».
- `src/maps/atlas/types.ts`, `src/maps/atlas/atlas.css` : tabourets.
- `src/maps/world/world.test.mjs` : un test de plus.

Aucune zone sensible n'a été touchée : ni `App.jsx` ni `persist.js`.

## Note

Les plans déjà générés changent d'aspect, puisque le tracé a changé. Les lieux du lore se replacent d'eux-mêmes s'ils ne sont pas encore découverts. Ceux déjà découverts gardent leur emplacement, sur un bâtiment qui peut avoir bougé un peu.
