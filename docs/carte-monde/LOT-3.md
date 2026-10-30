# Carte du monde : lot 3, étages, caves et PNJ en combat (statut : à valider)

## Ce que fait le lot

### Étages et sous-sols, là où c'est pertinent

| Bâtiment | Étage | Sous-sol |
|---|---|---|
| Taverne, auberge | chambres | cellier (trappe) |
| Hôtel particulier | appartements | cellier |
| Donjon | appartements | cachots (cellules à grilles, salle de garde) |
| Temple | — | crypte (tombeaux, ossuaire) |
| Maison de guilde | bureaux | réserve |
| Échoppe | logis | — |
| Maison (assez grande, plus de 55 m²) | logis | — |
| Ferme, entrepôt | — | cellier |

- Tous les niveaux d'un bâtiment ont la même emprise et la même orientation, et l'escalier tombe exactement au même endroit d'un niveau à l'autre. L'étage est organisé en couloir qui passe par l'escalier, avec des pièces de part et d'autre (lit, coffre ou bureau). La cave a des piliers, des tonneaux, des caisses ou des tombeaux.
- **Navigation** : toucher un escalier ou une trappe change de niveau. Si le groupe est dans le bâtiment, il suit et arrive au pied ou en haut de l'escalier, et ce qu'il y voit est révélé aux joueurs. Dézoomer au plus loin, ou appuyer sur ↥, ramène de l'étage ou de la cave au rez-de-chaussée, puis à la rue.
- **Combat** : chaque niveau a son plateau, avec ses murs, ses portes, ses piliers et ses tombeaux. L'escalier est une sortie du plateau, qui mène à l'autre niveau.

### Les PNJ dans le combat

- Quand la carte de combat s'ouvre dans un bâtiment, ses PNJ sont posés d'office à leur place : la tenancière au comptoir, le videur à la porte. Le MJ les déplace ensuite à sa guise.
- Un PNJ est visible des joueurs s'ils l'ont déjà vu ; sinon, il reste caché jusqu'à ce que le MJ le révèle.
- Si le PNJ a une fiche dans « PNJ & créatures », son jeton en reprend les PV, la CA et l'image.
- Un PNJ déjà présent sur le plateau n'est jamais posé une deuxième fois.

### Petit ajustement

- Sur la carte du monde, le jet de rencontre d'un lieu propose la zone « Cité » par défaut, au lieu de « Sauvage ».

## Fichiers

- `src/maps/world/interior.js` : niveaux, escaliers, étage et cave générés.
- `src/maps/world/generate.js` : tous les niveaux d'un bâtiment dans le monde.
- `src/maps/world/world.test.mjs` : un test de plus.
- `src/maps/battle/BattleMode.tsx` : PNJ posés en jetons.
- `src/maps/MapViewer.tsx` : escaliers, retour au rez-de-chaussée, zone « Cité ».
- `src/maps/atlas/MapCanvas.tsx`, `atlas/types.ts`, `atlas/atlas.css` : sols de cave, trappes, piliers.

Aucune zone sensible n'a été touchée : ni `App.jsx` ni `persist.js`.
