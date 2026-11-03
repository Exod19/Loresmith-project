# Lot 27 : jetons uniques par scène, l'évident visible en entrant, fouille des pièces

## Jetons uniques par scène

- `sceneTokens` (`src/banque/place.ts`) répartit les jetons entre tous les PNJ d'un même plan. L'ordre est stable :
  les PNJ du lore d'abord, puis les anonymes, chacun par identifiant.
- Un PNJ qui a son propre jeton (bestiaire, image de fiche) le garde et le réserve.
- Les autres reçoivent une image encore libre qui respecte leur genre, leur peuple, leur rôle et leur pose. Une image
  déjà prise n'est reprise qu'en dernier recours, quand la banque n'a plus d'autre choix cohérent
  (`npcPick({ exclude })`, `pickPerson({ exclude })`).
- La carte de navigation, la carte de combat et le panneau de dialogue utilisent cette même répartition. Le visage
  suit le jeton.

## L'évident visible en entrant

- `visibleFrom` (`src/maps/world/sight.js`) donne tout ce qui se voit depuis la position du groupe : aucun mur entre
  lui et la chose (les portes et les passages laissent passer la vue), à moins de 30 m.
- Dans un intérieur, dès que le groupe se tient quelque part, tout cela est révélé aux joueurs. Cela vaut en entrant,
  en changeant de pièce ou d'étage, et quand l'heure change et que d'autres occupants arrivent.
- Ce qui est révélé : les occupants, le mobilier nommé, les escaliers et les pièces.
- Ce qui reste caché : les PNJ cachés, les passages secrets et les repères du MJ.

## Fouille des pièces

Chaque pièce d'un intérieur porte un DD de fouille discrète (`searchDC`, `src/maps/world/fouille.js`), calculé à la
génération d'après qui s'y trouve et le moment :

| Situation | Effet sur le DD |
|---|---|
| Base selon le bâtiment | ferme 10, maison 11, échoppe 12, taverne 12, temple 14, manoir 15, caserne 16, château 18 |
| Personne éveillée | + 2 chacune (+ 8 au plus) |
| Personnel attentif | + 3 |
| Garde qui surveille | + 10 |
| Tout le monde dort | − 2 |
| Pièce vide | − 3 |
| Nuit | − 2 |

- Le DD est borné entre 8 et 30, avec un libellé : Facile, Moyenne, Difficile, Très difficile, Presque impossible.
- Fiche de la pièce (MJ) : le DD, ses raisons, puis le jet du joueur → « Fouiller ».
- `rollFind` donne le résultat :
  - **échec** : rien ; un échec de 5 ou plus, et quelqu'un remarque le manège ;
  - **réussite** : le plus souvent des broutilles (vêtements, chiffon, breloques), parfois quelque chose d'utile, rarement
    une vraie trouvaille ; plus le jet dépasse le DD, plus elle est probable.
- Les trouvailles dépendent de la pièce : cuisine, chambre, salle, cellier, atelier, chapelle, bureau, poste de garde.
- Le DD n'est jamais envoyé à l'écran des joueurs.

## Tests

- `sight.test.mjs` : murs, porte, PNJ caché, rien derrière un mur.
- `fouille.test.mjs` : DD selon la foule, les gardes et l'heure ; répartition des trouvailles ; une pièce générée
  plus facile à fouiller la nuit que le soir.

## Noms normalisés des nouvelles images

- `scripts/banque/build.py` (`structured`) lit les étiquettes dans les noms de fichiers. Les modèles suivent le
  document « Loresmith — Échelle des images » remis à ChatGPT :

  | Image | Modèle de nom |
  |---|---|
  | Jeton | `peuple-genre-rôle-…-zenith-jeton` |
  | Portrait jumeau | même nom, avec `portrait` |
  | Mobilier | `objet-matériau-LxP` |
  | Toit | `toit-forme-matériau-LxP` |
  | Arbre | `espèce-saison-diamètre` |
  | Texture | `texture-matière-Nm` |

- Un jeton à cadre fixe (1 024 px = 1,5 m) reçoit sa longueur réelle, mesurée avant le recadrage.
- Un rôle d'image au féminin (« taverniere ») correspond au rôle demandé (`pickPerson`).
