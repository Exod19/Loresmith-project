# Le Fil des Mystères (kit v3) — intégration dans LoreSmith

Ce document relie le kit « Fil des Mystères v3 » (spécification, annexe B, QA) au dépôt réel.

## Audit : ce qui existait déjà et a été réutilisé

| Notion du kit | Dans LoreSmith | Fichiers |
|---|---|---|
| `PuzzleInstance` | Énigme du grimoire (collection `puzzles`) posée sur une porte, une herse ou un coffre de la carte de combat | `src/puzzles/`, `src/maps/battle/surface.ts` (`lock`) |
| Moteur de mécanisme, solveur | Moteur v2 porté (12 mécanismes) et solveur par mécanisme | `src/puzzles/engine.ts`, `src/puzzles/solver.ts` |
| Atelier 7 étapes, contrôle qualité | Atelier d'énigmes | `src/puzzles/Atelier.tsx`, `src/puzzles/quality.ts` |
| Carnet des joueurs | Collection `clues` (« held » = en possession du groupe), consultable sur l'écran joueur pendant une énigme | `src/puzzles/CarnetPanel.tsx`, `PuzzleStage.tsx` |
| Scènes, chronologie | Campagnes (`campaigns[].scenes[]`, ordonnées, `played`) | `src/App.jsx` (Forge, Table de jeu) |
| Serveur autoritaire | La console MJ fait autorité ; l'écran joueur ne reçoit qu'une vue filtrée (BroadcastChannel) ; le serveur synchronise les documents et retire les champs secrets (`SECRET_FIELDS`) | `src/present/stage.ts`, `src/shared/schema.js` |

## Ajouté

- Collection `mysteries` (`MysteryArc`) : faits (`KnowledgeAtom`), supports (`ClueDesign`), emplacements
  (`SceneSlot`), manifestations (`ClueManifestation`), verrous (`Gate` → énigme du grimoire), journal d'audit.
  Entièrement réservée au MJ (`SECRET_FIELDS.mystery`).
- Planificateur (`src/mysteries/planner.ts`) : validation (références, compatibilité de support, capacité, objet
  unique, fait critique seulement dans une branche facultative), propositions motivées (top 3), couverture des
  verrous `READY / AT_RISK / BLOCKED / UNKNOWN`, cycle de vie, report (annexe B3) idempotent.
- Section Énigmes → onglet « Fil des mystères » : éditeur en 6 étapes (intention, verrous, faits, supports,
  distribution sur la chronologie des scènes, validation), IA facultative pour proposer faits et supports.
- Table de jeu : panneau MJ des indices de la scène (halo améthyste pour un fait critique non trouvé, au plus 3,
  désactivable, `prefers-reduced-motion`), actions Montré / Découvert / Pris → carnet / Passé à côté / Reporter,
  et alertes des verrous à venir.

## Écarts assumés (abstractions provisoires)

- Chronologie = ordre des scènes de la campagne ; pas encore de graphe de routes ni d'actes datés
  (`campaign.route.changed`, routes multiples : à venir). En campagne ouverte, la couverture reste indicative.
- Pas de serveur de jeu temps réel : l'autorité est la console MJ (local d'abord, coût zéro). La synchronisation
  entre comptes passe par les documents ; les joueurs n'ont pas de compte et ne reçoivent que la vue filtrée.
- Compréhension déclarée (`understood`) prévue dans le modèle, pas encore exposée à la table.
- Pas encore : graphe visuel des connaissances, timeline multi-pistes, hypothèses des joueurs dans le carnet,
  modes multi-joueurs (pilote, vote), export/import d'un arc entre univers, actifs graphiques du kit.

## Tests

- `src/mysteries/mysteries.test.mjs` : couverture, scène jouée sans réécriture, report (déplacement d'un indice
  jamais vu / seconde source d'un indice exposé), idempotence, objet pris qui reste au groupe, revue MJ sans
  emplacement, validation.
- `src/shared/schema.test.mjs` : le fil des mystères ne garde que son titre quand les secrets sont retirés.
