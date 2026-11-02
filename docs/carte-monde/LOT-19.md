# Lot 19 : retouches partagées, bâtiments en L, en T et en U, objets sans tracé dessous

## Retouches de la banque, communes à toute l'application

- Serveur : `server/src/banque.js` (`GET /api/banque/retouches`, `PUT /api/banque/retouches/:id`). Les retouches
  sont une seule valeur JSON dans l'espace KV : pas de migration de la base.
  - Seuls les champs d'étiquette connus sont acceptés.
  - Une retouche garde l'auteur et la date.
- Règle d'accès : `canBanque` (`src/shared/policy.js`). Tout compte connecté lit et retouche.
- Navigateur (`src/banque/index.ts`) :
  - les retouches partagées sont gardées pour travailler hors ligne ;
  - les retouches faites sans compte attendent et partent à la connexion ;
  - les retouches des autres MJ sont relues au chargement et à l'ouverture de la page Banque ;
  - en mode local, sans serveur, rien ne change.

## Bâtiments composés

- `generate.js` : certains bâtiments ont une aile (L, T) ou deux (U), à l'arrière, côté cour :
  - manoirs ;
  - auberges, guildes, casernes, temples ;
  - ateliers, forges, écuries, entrepôts ;
  - fermes, et parfois des maisons.

  Le corps du bâtiment (porte, intérieur) ne change pas. Le tirage est à part : le reste de la cité est identique.
- Une aile ne se pose que si la place est libre : rue, autre bâtiment, rivière, mer, place, enceinte, champ, arbre.
  Elle compte au combat comme le reste du bâti.
- `ground.bx` décrit chaque bâtiment entier, `ground.p` la fontaine et les étals de la place du marché.
- Toits : le catalogue garde la silhouette de chaque toit (`masque`). `fitRoof` essaie chaque toit dans ses huit
  orientations (quatre quarts de tour, avec ou sans miroir) et garde celui qui épouse l'emprise. À défaut, il pose un
  toit par partie.

## Pas de tracé sous une image

- Plans de cité : quand la banque dessine, les toits, arbres et fontaines vectoriels s'effacent. Un objet sans image
  garde son tracé.
- Plans d'intérieur : même chose pour les tables, lits, tonneaux, coffres, autels, tombeaux, colonnes et bacs. Les
  tables ont maintenant leur propre tracé, séparé des comptoirs.
- Un plan d'avant la banque, sans liste d'objets, garde ses tracés.
- Combat :
  - la case est repeinte avant de poser un toit, un arbre, une fontaine ou un tonneau ;
  - le plancher ne recouvre plus les meubles peints ;
  - les toits épousent aussi les bâtiments en L, en T et en U ;
  - une petite pièce d'eau en ville devient la fontaine.

## Fichiers sensibles

`server/src/` est modifié : nouveau module `banque.js`, et son branchement dans `index.js`. `src/App.jsx`,
`src/store/persist.js` et `src/sync/engine.js` ne sont pas touchés. `src/sync/client.js` gagne deux appels.
