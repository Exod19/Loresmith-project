# Lot 18 : Banque Loresmith

## Objet

Les images du Drive (166 : 86 éléments, 54 personnages, 26 textures) habillent les cartes et les fiches, à leur taille
réelle et avec cohérence.

## Contenu

- **Banque** : `public/banque/` (WebP 256, 512 et 1024 px, 38 Mo) et `src/banque/catalogue.json`, produits par
  `scripts/banque/build.py`. Mise à jour : voir `docs/banque/SYNCHRONISER.md`.
- **Moteur de cohérence** (`src/banque/banque.js`, testé) :
  - les peuples d'un lieu viennent de sa fiche ;
  - l'Outreterre n'a que des peuples des profondeurs ;
  - à la surface, un peuple des profondeurs n'apparaît que si la fiche le nomme ;
  - un peuple banni ou dit chassé est écarté ;
  - une cité qui chasse créatures, démons ou sang-mêlé n'a ni tieffelin, ni demi-orque ;
  - le rôle prime (une tavernière reçoit un jeton de tavernier) ; à défaut, une figure ordinaire, sinon rien ;
  - éléments et textures suivent le climat, la saison et la région ;
  - le même PNJ garde toujours le même visage.
- **Plans de navigation** (cités et intérieurs ; jamais la carte du monde ni l'Atlas des profondeurs) :
  - toits et arbres à leur taille réelle ;
  - mobilier des intérieurs (lits, tables, tonneaux, coffres, autels, sarcophages, colonnes, bacs) ;
  - sols en texture (champs, places, planchers, dalles) ;
  - un objet sous 5 pixels à l'écran n'est pas dessiné ;
  - la version d'image suit la taille à l'écran et la densité de l'écran, sans agrandissement ;
  - un toit suit l'axe de son bâtiment, et les faîtages alternent ; un arbre ou un meuble prend son propre angle.
- **Combat** (plateaux de surface et d'intérieur) :
  - sols en texture continue à l'échelle (1 case = 1,5 m) ;
  - pavés en ville, terre à la campagne ;
  - toits sur les bâtiments presque rectangulaires ;
  - couronnes d'arbres ;
  - tonneaux et coffres sur les obstacles isolés.

  Le dessin vectoriel reste dessous : si une image manque, le plateau reste lisible.
- **Jetons** : un PNJ de la carte du monde sans jeton propre reçoit un jeton de la banque. Il est cohérent avec la cité
  et son rôle, dessiné en entier et tourné vers son vis-à-vis le plus proche (le groupe face aux monstres).
- **Fiches** :
  - la conversation avec un PNJ montre un portrait de la banque (aussi sur l'écran des joueurs) ;
  - un personnage créé en jeu reçoit un portrait ;
  - la page **Cartes → 🖼 Banque Loresmith** permet de parcourir les images, retoucher leurs étiquettes, exclure une
    image et attribuer un portrait ou un jeton à une fiche de la Bibliothèque ou à un PNJ.
- **Intérieurs** : `ground.p` liste le mobilier (nature, position, taille, angle) pour la banque.

## Fichiers sensibles

`src/App.jsx` et `src/store/persist.js` n'ont pas été modifiés. Une image attribuée est un « asset », comme une image
téléversée : elle passe par l'action existante `ADD_ASSET`.
