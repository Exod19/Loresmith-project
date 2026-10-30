# Carte du monde : lot 9, climat et terrain (statut : à valider)

## Ce qui change

- **Climat par latitude.** Hémisphère nord par défaut : le haut de la carte est froid, le bas est chaud. Le bouton « Hémisphère sud » inverse tout. L'étendue des climats se règle dans le panneau Monde : des neiges au désert, nordique, tempéré ou méridional.
- **Biomes sur la carte du monde.** Il y en a cinq : terres enneigées, taïga, tempéré, steppe et désert. Une petite part de hasard rend les frontières naturelles. Près de l'eau, une terre torride reste une steppe au lieu de devenir un désert. Le relief et la végétation suivent :
  - au froid, des forêts de conifères ;
  - dans la steppe, des forêts clairsemées ;
  - au désert, aucune forêt, mais des dunes ;
  - une ou deux chaînes de montagnes, aux sommets enneigés quand il fait froid.
- **Grèves.** Un lac a une grève de sable, ou de galets quand il fait froid.
- **Mer seulement pour les ports.** Une fiche qui parle de port, de quais, de docks, de havre, de bord de mer, de littoral, etc. fait de la cité un port. Il y a aussi la case « Port de mer » et le bouton « ⚓ Port » dans la liste des cités.
  - La mer s'étend vers le bord de carte le plus proche, choisi une fois pour toutes à la création de la cité.
  - Sur la carte du monde, ce côté devient une côte avec une plage. Elle passe au ras des ports et reste au large des autres cités.
  - Sur le plan du port, on trouve la mer, la grève, les quais, la rue du Port avec sa porte dans le rempart, des pontons et des entrepôts près des quais. Aucune porte ne donne sur la mer.
- **Allure des cités selon leur climat.**
  - Au froid : toits d'ardoise sombre et sol pâle.
  - Au chaud : toits plats ocre et blancs, et sol sec.
  - Le plateau de combat suit les mêmes couleurs. Un ponton s'y traverse à pied au-dessus de l'eau.

## Ce qui ne bouge pas

- Le climat ne change que l'allure des cités, jamais leur plan : les lieux posés et découverts restent en place, même si on change d'hémisphère.
- Une cité qui n'est pas un port reste identique, à l'octet près. La mer a son propre tirage au sort.
- Les forêts d'un monde existant gardent leur identifiant. Une forêt tombée dans le désert est simplement omise.
- Ajouter ou retirer la mer d'une cité où des lieux sont déjà découverts est bloqué, comme le bouton « Depuis la fiche ».

## Fichiers

- Nouveaux : `src/maps/world/climate.js`, `climate.d.ts`, `src/maps/battle/theme.ts`.
- Modifiés :
  - génération : `world/generate.js`, `generate.d.ts`, `index.ts`, `lore.js` ;
  - interface : `WorldPanel.tsx`, `atlas/MapCanvas.tsx`, `atlas/types.ts`, `atlas/atlas.css` ;
  - combat : `battle/BattleBoard.tsx`, `BattleMode.tsx`, `MiniBattle.tsx`, `playerBoard.ts`, `mapStore.ts`, `present/stage.ts` ;
  - tests : `world.test.mjs` (deux nouveaux tests).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limites

- Les montagnes ne bloquent pas encore le passage sur un plateau de combat tiré de la carte du monde.
- Les voyages en mer vers d'autres continents sont pour plus tard.
- La mer a une côte unique par bord de carte.
