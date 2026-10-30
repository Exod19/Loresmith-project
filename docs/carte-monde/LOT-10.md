# Carte du monde : lot 10, saisons (statut : validé)

## Ce qui change

- **Sélecteur de saison** dans la barre de la carte, à côté du moment de la journée : printemps, été, automne ou hiver. Le choix « Saison… » ne fixe aucune saison et garde l'allure d'avant.
- **Carte du monde.**
  - La neige descend avec l'hiver (limite selon la température : hiver 0,45, automne et printemps 0,22, été 0,10).
  - Les lacs du froid gèlent et les sommets blanchissent plus bas.
  - Les champs et les arbres changent de couleur : vert tendre au printemps, blé doré en été, roux en automne, jachères en hiver.
- **Cités.** La neige et la glace dépendent du climat de la cité (lot 9) :

  | Saison | Cité froide | Cité tempérée | Cité chaude |
  |---|---|---|---|
  | Hiver | Beaucoup de neige ; rivière et mer gelées | Un peu de neige ; rivière gelée | Pas de neige, saison des pluies |
  | Automne et printemps | Quelques congères | — | — |

  Une cité enneigée a des toits blancs, des champs sous la neige et une rivière glacée.
- **Combat.**
  - Les congères et la glace sont du terrain difficile : elles se traversent, mais comptent double. L'étiquette du terrain devient « Éboulis, neige ou glace ».
  - Une eau gelée n'est plus de l'eau.
  - Un plateau enneigé est peint en blanc bleuté.
- **Affluence.**
  - L'hiver, on se réfugie à la taverne (×1,5), à l'auberge et au temple, et on reste chez soi.
  - L'été, la ferme est vide (tout le monde est aux champs) et les tavernes se remplissent le soir.
  - L'automne, les échoppes et les entrepôts s'animent.
- **Répliques de saison.** Elles viennent d'une banque de phrases, sans IA, et varient selon le rôle, la saison et le climat.
  - Le personnel (tavernier, marchand, forgeron, prêtre, garde) accueille toujours le visiteur.
  - Les clients parlent une fois sur trois.
  - Exemples : « Fait froid dehors, hein ? Viens te réchauffer près du feu. » l'hiver ; « Viens te rafraîchir avec une pinte ! » l'été ; « Encore cette pluie… Entre te sécher. » l'hiver sous un climat chaud.

## Ce qui ne bouge pas

- Sans saison choisie, tout reste identique : les occupants, la carte et le combat.
- La saison ne déplace aucun bâtiment.
- Les PNJ du lore gardent leur fiche telle quelle : leurs répliques viendront avec les conversations du lot 11.

## Fichiers

- Nouveaux : `src/maps/world/seasons.js`, `seasons.d.ts`.
- Modifiés :
  - génération : `world/generate.js`, `generate.d.ts`, `interior.js`, `interior.d.ts` ;
  - carte : `MapViewer.tsx` (sélecteur), `atlas/MapCanvas.tsx`, `atlas/types.ts`, `atlas/atlas.css` ;
  - combat : `battle/BattleBoard.tsx`, `BattleMode.tsx`, `theme.ts`, `terrain.ts` (étiquette), `mapStore.ts` ;
  - tests : `world.test.mjs` (un nouveau test).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limites

- Sur la carte du monde, les rivières ne gèlent pas : seuls les lacs gèlent.
- Les répliques ne concernent que les occupants générés.
