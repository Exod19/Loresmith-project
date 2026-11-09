# Lot 40 (série lieux sauvages) : révéler par famille, ce que les héros voient ou tout (statut : à valider)

## Ce qui change

- **Carte de navigation** (onglet Groupe, rubrique « Révélations »).
  - Le bouton « Tout révéler sur ce plan » est remplacé par trois familles, chacune avec deux boutons :
    - **Chemins** (tracés : routes, sentiers, galeries, escaliers) : « que le groupe voit » ou « tous » ;
    - **Éléments** (lieux, bâtiments, repères) : « que le groupe voit » ou « tous » ;
    - **Monstres** (rencontres posées sur la carte) : « que le groupe voit » ou « tous ».
  - Ce que le groupe voit :
    - dans un bâtiment, la ligne de vue depuis sa position, murs compris ;
    - ailleurs, la portée de vue de l'écran joueur.
  - « Tout cacher sur ce plan » reste.
  - Une ligne dit ce qui a été révélé (« 2 éléments révélés », « Aucun chemin caché à révéler dans le champ de vision
    du groupe »).
- **Carte de combat** (menu « 👁 Révéler » à côté de Brouillard).
  - Monstres, chemins et éléments, chacun « que les héros voient » ou « tous » :
    - **monstres** : les jetons cachés (créatures, PNJ) ;
    - **chemins** : les passages et les sorties ;
    - **éléments** : les lieux, les objets posés, les repères et les points de fouille.
  - Ce que les héros voient est calculé d'après la vue réelle de chaque héros (portée, ligne de vue, murs et portes
    fermées).
- Rien de ce qui est déjà révélé n'est caché par ces boutons.

## Vérification

Dans le navigateur, taverne de Brumeval :

- « Éléments : que le groupe voit » ne trouve rien de nouveau (dans un bâtiment, ce qui se voit est déjà révélé en
  entrant) ;
- « Éléments : tous » révèle les deux éléments restants ;
- sur la carte de combat, le menu « 👁 Révéler » s'ouvre avec ses trois familles et dit ce qu'il a fait.

272 tests côté site et 14 côté serveur, tous au vert ; build réussi ; lint sans erreur.

## Fichiers

- `src/maps/MapViewer.tsx` (`revealNav`), `src/maps/maps.css`.
- `src/maps/battle/BattleMode.tsx` (`revealBoard`, `onRevealMany`), `src/maps/battle/battle.css`.
- Zones à risque : non touchées.
