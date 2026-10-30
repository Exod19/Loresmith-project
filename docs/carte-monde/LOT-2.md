# Carte du monde : lot 2, intérieurs (statut : à valider)

## Ce que fait le lot

- **Entrer dans un bâtiment sans changer de carte** : zoomer au plus près d'un bâtiment de la cité y entre ; dézoomer au plus loin (ou ↥) ressort dans la rue. Le bouton « Entrer dans… » de la fiche d'un bâtiment fait la même chose.
- **Toujours le même intérieur** : la graine vient de l'emplacement, le gabarit du type de bâtiment, les dimensions de son empreinte réelle (agrandie si elle est trop petite pour le gabarit). Une fois sur deux, le gabarit est retourné, pour que deux tavernes ne se ressemblent pas.
- **Gabarits** : taverne, auberge, échoppe, forge, temple, maison, hôtel particulier, corps de garde, donjon, maison de guilde, écurie, entrepôt, atelier, ferme. Chacun a ses pièces, ses cloisons, ses portes et son mobilier.
- **PNJ à leur place selon leur rôle** :
  - derrière le comptoir : tenancière, marchand ;
  - à l'enclume : forgeron ;
  - à l'autel : prêtre ;
  - au trône : seigneur ;
  - à la porte : garde, videur ;
  - en cuisine : cuisinier ;
  - au bureau : scribe, maître de guilde.

  Chaque PNJ apparaît avec sa description, tirée de sa fiche.
- **Le groupe entre avec la vue** : s'il est devant le bâtiment, il passe à l'entrée. La première pièce et les PNJ présents sont alors révélés aux joueurs. En ressortant, il se retrouve devant le bâtiment.
- **Combat à l'intérieur** :
  - murs fermés, portes et passages ouverts, quelle que soit la trame des cases ;
  - comptoir, âtre et autel infranchissables ; tables et lits en terrain de décor ;
  - la porte d'entrée est une sortie qui mène à la rue ;
  - le plateau est peint en planches, murs et pavés.
- Un intérieur n'est ajouté à la carte que lorsqu'on y entre : la carte reste légère.

## Fichiers

- Nouveaux :
  - `src/maps/world/interior.js` et `interior.d.ts` ;
  - `docs/carte-monde/LOT-2.md`.
- Modifiés :
  - `world/generate.js` : façade et empreinte des emplacements, intérieurs dans le monde, murs et portes sur la grille ;
  - `world/lore.js` : description des PNJ ;
  - `world/index.ts`, `world/world.test.mjs` (un test de plus) ;
  - `atlas/types.ts`, `atlas/MapCanvas.tsx`, `atlas/atlas.css` ;
  - `battle/BattleBoard.tsx`, `battle/BattleMode.tsx`, `battle/MiniBattle.tsx` ;
  - `mapStore.ts`, `playerBoard.ts`, `MapViewer.tsx` ;
  - `present/stage.ts`.
- Aucune zone sensible touchée : ni `App.jsx` ni `persist.js`.

## Pistes pour la suite

- Les PNJ de l'intérieur posés d'office comme jetons, cachés, quand un combat éclate dans le bâtiment.
- Un étage pour les auberges (les chambres), accessible par l'escalier.
