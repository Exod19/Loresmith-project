# Lot 25 : jetons à la même échelle, bon genre et bon peuple, places logiques

## Même échelle pour tous les personnages

- Chaque image de la banque remplit son cadre, quelle que soit la taille réelle du personnage. Un halfelin y paraît
  donc aussi grand qu'un humain.
- `tokenScale` (`src/banque/banque.js`) corrige l'échelle d'après les étiquettes de l'image :
  - stature du peuple : humain, elfe, tieffelin 1 ; demi-orque 1,08 ; nain 0,78 ; halfelin 0,6 ; gnome 0,58 ;
  - enfant : × 0,68 ;
  - vue à la verticale : × 0,68 (l'image couvre les épaules, plus la hauteur) ;
  - agenouillé ou assis : × 0,72.
- L'échelle est appliquée sur la carte de combat et sur la carte de navigation, avec la même longueur de référence
  (1,41 m pour un humain debout).

## Le bon genre, le bon peuple

- `npcTraits` lit le genre et le peuple d'un PNJ, dans cet ordre :
  1. les champs de sa fiche (`gender`, `race`) ;
  2. son rôle (« tavernière ») ;
  3. son prénom (`nameGenre`) ;
  4. sa description.
- Les occupants générés gardent le genre de leur prénom (`genre` sur le lieu).
- Le genre est strict : jamais une image de femme pour un homme. Le peuple écrit sur la fiche passe avant les peuples
  du lieu, sauf s'il y est proscrit.
- Ordre de repli : son peuple et son rôle, puis son peuple, puis le lieu et son rôle, puis le lieu.

## Des places logiques

- `settleOccupants` (`src/maps/world/settle.js`) replace chaque occupant d'un intérieur :
  - jamais sur une table, un lit, un comptoir, un tonneau, un bac, un escalier ou dans un mur ;
  - au moins 0,95 m entre deux personnes.
- Les résidents posés par le MJ ne bougent pas.
- Sur la carte de combat, un PNJ se pose sur une case de sol libre, jamais sur un meuble, dans l'eau ou sur des
  gravats.

## Qui dort est au lit

- Un dormeur est mis dans le lit libre le plus proche (`pose: 'couche'`).
- Sur la carte de navigation, il est couché dans l'axe du lit. Un jeton debout y est allongé sous une couverture ;
  le jeton couché de la banque est pris quand le genre et le peuple concordent.
- S'il n'y a plus de lit : un occupant anonyme n'est pas placé ; un PNJ du lore reste, éveillé.
- Les poses (assis, agenouillé, couché) ne sortent plus jamais au hasard : seulement quand la scène les demande.

## Tests

- `settle.test.mjs` : taverne, auberge, caserne, maison, ferme, forge et temple, de jour, le soir et la nuit.
- `banque.test.mjs` : genres des prénoms, peuples tirés du texte, genre strict, poses, échelle.
