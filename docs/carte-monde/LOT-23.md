# Lot 23 : jetons de face, jetons sur la carte de navigation, socles selon le sol

## Ce qui change

- **Fiche d'un jeton (écran des joueurs)** : un clic sur un jeton montre l'image de face, plus le jeton vu de dessus.
  On prend, dans l'ordre : l'illustration de la fiche (Archives), le portrait jumeau du jeton dans la banque
  (`paire`), puis le jeton lui-même s'il n'a pas de portrait (`faceOf`, `src/banque/index.ts`).
- **Même personne en portrait et en jeton** : le portrait d'un PNJ (`npcImage`, vue `portrait`) est tiré du jumeau de
  son jeton. Le panneau de dialogue et la carte de combat montrent donc la même personne. Une image de fiche qui est un
  portrait de la banque devient son jeton jumeau sur le plateau (`topOf`).
- **Carte de navigation** : les PNJ posés sur un plan (cité, intérieur) s'affichent avec le même jeton que sur la carte
  de combat. Le jeton garde sa taille réelle (1,1 m), il est orienté et n'a pas de socle. Il remplace le marqueur dès
  qu'il fait au moins 14 px à l'écran. La même règle vaut sur l'écran des joueurs (`AtlasFeature.token`, calculé à
  l'envoi et jamais enregistré).
- **Socles selon le sol** : sur un plateau de surface ou d'intérieur généré, le socle reprend le sol peint sous le
  jeton (`groundCells`, `src/maps/battle/groundCells.ts`) :
  - pavés en ville, terre à la campagne, herbe en pleine nature, sable au désert, toundra au froid, neige l'hiver ;
  - herbes hautes dans un champ ;
  - eau peu profonde près de la berge, eau profonde au large, glace si l'eau est gelée ;
  - pont, éboulis, sous-bois ;
  - plancher dans un intérieur, pavés au-dehors.

  Avant ce lot, ces plateaux donnaient un socle « sol de caverne ».

## Ce qui ne change pas

- Les règles de déplacement : le sol peint ne sert qu'au socle (`socleOf(..., painted)`).
- Les cavernes et l'Atlas des profondeurs : pas de thème, donc pas de sol peint ; le terrain des règles décide comme
  avant.
- Le choix du MJ (socle « aucun » ou manuel) et un sol choisi pour tout le plateau (`b.ground`) l'emportent.

## Tests

`surface.test.mjs`, cas 10 : pavés, champ, eau peu profonde ou profonde, pont, neige, sable, plancher et dehors d'un
intérieur, priorité du choix du MJ, rien en caverne.
