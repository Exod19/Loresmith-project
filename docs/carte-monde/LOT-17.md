# Carte du monde : lot 17, terrains lisibles à tout zoom (statut : à valider)

## Ce qui change

Le relief d'un monde à l'échelle se lit comme une carte, à toute échelle de zoom.

- **Symboles dessinés dans l'image** : aucun élément ajouté à la page, donc rien de plus lourd à afficher.
  - Les feuillus sont des boules éclairées en haut à gauche, avec leur ombre portée ; les conifères sont des triangles, avec une face claire et une face sombre.
  - Les sommets sont des pics dessinés, coiffés de neige quand il fait froid ou au-delà de ~2 700 m.
  - La steppe et la prairie ont des touffes d'herbe ; le désert, des rides de dunes ; la neige, des reflets bleutés à l'ombre.
  - Les symboles gardent ~6 px à l'écran, quel que soit le zoom. Ils sont ancrés sur une grille en km, pour qu'ils ne « grouillent » pas quand on fait glisser la carte.
- **Courbes de niveau** tous les 500 m, et tous les 200 m de près.
- **Mer.** Un trait de rivage net et des eaux claires près des côtes.
- **Terroirs.**
  - De près, les champs autour des cités montrent leurs parcelles.
  - Le bord du terroir et de la plaine d'une cité est irrégulier : plus de disque ni de « cratère » rond autour des villes.
- **Légende** repliable, en haut à gauche de la carte du monde : forêts de feuillus et de conifères, steppe, désert, montagnes, neige, champs, courbes de niveau, mer et traversées.

## Coût

- Tout est calculé dans le « worker », sans bloquer l'interface. Le rendu passe d'environ 0,9 s à 1,4 s pour l'image entière (820 px), puis un peu moins pour la vue rapprochée.
- L'image reste un JPEG d'environ 820 px, mis en mémoire.
- Rien à télécharger : aucune texture ni image externe.

## Fichiers

- Modifiés :
  - `world/terrain.js` : symboles, courbes, rivage, terroirs irréguliers ;
  - `atlas/MapCanvas.tsx` : légende ;
  - `atlas/atlas.css`.
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limite

- La plaine d'une cité a maintenant un contour irrégulier : l'altitude change un peu autour des cités des mondes à l'échelle.
