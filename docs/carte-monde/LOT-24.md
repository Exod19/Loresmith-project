# Lot 24 : jetons vus de haut, image de fiche toujours présente

## Jetons vus de haut

- Chaque jeton de la banque porte maintenant un `angle` :
  - `zenith` : pris à la verticale, on voit le dessus de la tête ;
  - `incline` : vu à environ 15°, visage et pieds visibles.

  La liste des jetons `zenith` est dans `ZENITH` (`scripts/banque/build.py`). Il y en a 6 sur 72 :
  - nain aîné au livre ;
  - guérisseuse halfeline ;
  - officiant funéraire ;
  - archère aux cheveux d'argent ;
  - guerrière au bouclier ;
  - aventurier en cuir.
- Choix d'un jeton (`pickPerson`) :
  - quand un jeton `zenith` porte le rôle demandé, il passe seul ;
  - sinon, les jetons `zenith` sont favorisés (poids × 4) ;
  - le rôle reste prioritaire : un tavernier incliné passe avant un garde vu de haut.
- Un jeton incliné ne tourne plus sur lui-même (`turnsFreely`), ni sur la carte de combat ni sur la carte de
  navigation. Il reste droit, ce qui évite les perspectives qui penchent de travers. Un jeton `zenith` (ou une image
  ajoutée par le MJ) continue de se tourner vers son vis-à-vis.
- Les jetons déjà enregistrés dans un combat en cours gardent leur image. Le choix vaut pour les prochains plateaux,
  et tout de suite sur la carte de navigation.

## Image de fiche

- `faceOf` donne toujours un visage pour un jeton de la banque :
  - d'abord son portrait jumeau ;
  - sinon un portrait qui lui ressemble : même genre obligatoire, même peuple, même rôle, toujours le même pour ce
    jeton.
- Écran des joueurs : la carte d'un jeton prend, dans l'ordre :
  1. l'illustration de la fiche (Archives, PNJ) ;
  2. l'image de la fiche du PNJ sur la carte ;
  3. le visage de la banque ;
  4. en dernier recours, le jeton.
- Combat (pupitre du MJ et fil d'initiative) : faute d'illustration de fiche, on montre le visage de la banque au lieu
  d'un monogramme (`src/App.jsx`, deux lignes).
