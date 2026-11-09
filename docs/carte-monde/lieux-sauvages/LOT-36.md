# Lot 36 (série lieux sauvages) : chaque lieu, sa propre scène de combat (statut : à valider)

## Le problème

Le plateau de combat d'une grange montrait un rocher au milieu, un pont en travers de la salle, des caisses, des
tonneaux et des arbres. Il montrait aussi des personnages venus de nulle part, et les héros n'étaient pas à leur
place. Tout venait du lieu précédent : en changeant de lieu, seuls les monstres étaient remplacés.

- Les objets posés restaient : objets d'un lieu sauvage (rocher, tonneau, caisses), pont et murs bâtis à la main,
  zones, corrections de cases, fond tactique.
- Les PNJ de l'ancienne scène restaient sur le plateau.
- Les héros gardaient leurs anciennes cases.
- Le tour, la manche et le journal continuaient.

## Ce qui change

Quand on ouvre le combat dans un **nouveau lieu**, la scène repart de zéro (`generate`, `BattleMode.tsx`) :

- rien de l'ancien lieu n'est repris :
  - ni créatures ni PNJ ;
  - ni objets, murs, zones, corrections de cases, fond tactique, mondes choisis ;
  - ni zones d'effet, visée, dégâts en attente, énigme en cours ;
  - le tour repart à zéro, la manche à 1, le journal est vidé ;
- seuls les **héros** suivent. Ils sont posés là où se trouve le groupe sur la carte de navigation : son lieu, son
  repère ou son point libre (`placeCoords`). À défaut, ils vont au centre du lieu ;
- les **PNJ du lieu** sont posés à leur place, comme sur la carte de navigation ;
- une rencontre place ses créatures autour des héros ;
- « Régénérer » dans le même lieu garde la scène : seule la disposition du terrain change.

## Vérification

Dans le navigateur, sur une carte du monde avec deux intérieurs :

- le plateau a d'abord servi dans une maison (pont, rocher, un loup, Gaspard, Hugues, manche 3) ;
- le groupe passe à la trappe de la taverne, puis on clique sur « Combat » ;
- résultat : aucun objet, aucun loup ni ancien Gaspard, manche 1, journal vide ;
- Hugues est posé près de la trappe, et les PNJ de la taverne (Aliénor, Clémence, Gaspard le musicien…) sont à leurs
  places.

## Fichiers

- `src/maps/battle/BattleMode.tsx`.
- Zones à risque : non touchées.
