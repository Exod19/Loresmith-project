# Lot 29 : objets des lieux sur le plateau, densité de l'Underdark (statut : à valider)

## Ce qui change

- **Les objets d'un lieu sauvage sont posés sur le plateau de combat.** Le plan d'un lieu (lot 26) contient des objets : coffre, tonneau, autel, colonnes, sarcophage, fontaine. Quand on ouvre le combat dans ce plan, ceux qui tombent dans le cadre deviennent des objets du plateau, avec leurs règles de couvert et de passage :
  - tonneau → tonneau ;
  - coffre → caisses ;
  - colonne ou pierre levée → rocher ;
  - autel ou sarcophage → gros rocher ;
  - fontaine → pierres.

  Ils se déplacent et se retirent comme les objets posés à la main (onglet Construire).
- **Densité des lieux sauvages de l'Underdark** (onglet Groupe de l'Atlas, carte « Lieux sauvages ») :
  - rares : environ un toutes les 11 heures de marche ;
  - normaux : un toutes les 6 à 7 heures, le réglage par défaut ;
  - nombreux : un toutes les 4 heures.

  Le réglage change les brouillons et la découverte en chemin ; les lieux déjà gardés ou découverts ne changent pas.

## Fichiers

- Modifiés :
  - `battle/BattleMode.tsx` : objets du plan du lieu (`wildObjects`) ;
  - `atlas/deepWilds.js` et `deepWilds.d.ts` : densité ;
  - `atlas/deepIndex.ts` : densité transmise au tirage, en mémoire par densité ;
  - `mapStore.ts` (`overlay.wildDensity`) ;
  - `MapViewer.tsx` : réglage de la densité dans l'onglet Groupe de l'Atlas ;
  - `atlas/deepWilds.test.mjs` (un test de plus).
- Zones à risque (`App.jsx`, `persist.js`, `sync/engine.js`, `server/src/`) : non touchées.

## Vérifications

- Dans le navigateur, plan d'un camp de bandits : le plateau de combat porte le tonneau près du feu et les caisses du chef, en plus des tentes et des points d'intérêt (F1, F2).
- Tests : la densité de l'Underdark respecte l'ordre rares < normaux < nombreux.
