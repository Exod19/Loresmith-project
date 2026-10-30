# Carte du monde : lot 6, villages et hameaux explorables (statut : à valider)

## Ce que fait le lot

- **Les hameaux de la carte du monde s'explorent comme les cités.** Il y en a un à mi-chemin sur les routes assez longues. On y entre en zoomant au plus près, ou avec le bouton « Entrer dans… » de son repère.
- **Toujours le même** : le plan d'un hameau est tiré de la graine du monde et de sa route.
- **Plan d'un village** : de 50 à 220 habitants, sans muraille, des entrées au lieu des portes, une place du village avec son puits, et des fermes et des champs tout autour.
- **Bâtiments d'un village** :
  - toujours une chapelle et une taverne ;
  - une forge à partir de 80 habitants, une échoppe à partir de 120, une auberge à partir de 150 ;
  - environ la moitié des maisons sont des fermes ;
  - ni guilde, ni caserne, ni entrepôt, ni château.
- **Une cité de moins de 400 habitants** créée depuis une fiche ou par ses paramètres suit aussi ce plan de village.
- **Tout le reste s'applique** : entrer dans les bâtiments, étages et caves, occupants selon l'heure, carte de combat, fiches des occupants.
- **Le lore peut s'y poser** : une fiche de lieu qui nomme le hameau (« Le Moulin du Vieux Gaston, à Hameau de… ») y prend un bâtiment, comme dans une cité.

## Fichiers

- `src/maps/world/generate.js` et `generate.d.ts` : plan de village, hameaux générés et reliés au monde.
- `src/maps/world/index.ts` : les hameaux accueillent le lore.
- `src/maps/world/world.test.mjs` : un test de plus.

Aucune zone sensible n'a été touchée : ni `App.jsx` ni `persist.js`.
