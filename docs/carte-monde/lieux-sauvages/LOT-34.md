# Lot 34 (série lieux sauvages) : mondes cumulables, genres pirate, cyberpunk et horreur, scorpions de l'Underdark (statut : à valider)

## Ce qui change

- **Mondes du plateau cumulables** (Construire → « Mondes du plateau ») : Surface, Outreterre, ou les deux, par exemple
  pour l'entrée d'une caverne. Sans case cochée, le monde est déduit du lieu ; sur un plateau vierge, rien n'est
  proposé. L'ancien réglage à un seul monde reste lu.
- **Nouveaux genres d'univers** : Cyberpunk, Pirates (flibuste), Horreur. Les genres se combinent :
  - « fantasy + pirate » donne la flibuste dans un monde de fantasy ;
  - « pirate » seul donne la flibuste sans créatures de fantasy.
- **Scorpions géants : Outreterre.** Les quatre images, déposées dans le dossier Créatures de la surface, sont rangées
  dans l'Outreterre par une exception du script (`MONDE_FORCE`). Le mieux reste de les déplacer dans le dossier
  Underdark du Drive.

## Vérifications

- Dans le navigateur, sur le même plateau :
  - deux mondes cochés : créatures de l'Underdark ;
  - univers « pirate » seul : jetons génériques ;
  - univers « fantasy + pirate » : créatures de l'Underdark.
- Test : les scorpions sont tous en Outreterre.
- 269 tests côté site, 14 côté serveur ; build réussi ; lint sans erreur.

## Fichiers

- `src/maps/mapStore.ts` (`World`, `region` en liste), `src/maps/battle/vignettes.ts`, `TilePanel.tsx`.
- `src/banque/index.ts` (`creatureToken` sur plusieurs mondes), `genres.js`, `genres.test.mjs`, `catalogue.json`.
- `scripts/banque/build.py` (`MONDE_FORCE`), `docs/banque/STRUCTURE.md`.
- Zones à risque : non touchées.
