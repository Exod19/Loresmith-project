# Lot 32 (série lieux sauvages) : deux mondes séparés, fiche = jeton, tuiles orientables, lint (statut : à valider)

## Ce qui change

- **La surface et l'Outreterre ne se mêlent jamais.** L'application ne prend jamais seule une image de l'autre monde ;
  seul le MJ peut le faire, à la main.
  - Un personnage ou une créature appartient au monde de son dossier du Drive, et à lui seul : `region` contient un
    seul monde. Les images déjà converties suivent aussi leur dossier.
  - Le tirage des PNJ (`pickPerson`) ne prend que des images du monde demandé. Les cités et la carte du monde sont à la
    surface.
  - Créatures du plateau : le monde vient du plateau.
    - Plan d'une cité, du monde ou d'un lieu sauvage de la surface → surface.
    - Plan de l'Atlas → Outreterre.
    - Plateau vierge → aucun choix automatique.
  - Exemple vérifié : un « Scorpion géant » sur un plateau de l'Atlas garde le jeton générique, parce que le scorpion
    de la banque vient des dossiers de la surface.
- **L'image de fiche montre la même personne ou la même créature que le jeton.**
  - Jetons et portraits sont appariés par le script de la banque : même type, même monde, même peuple et même rôle,
    ou même nom pour une créature, plus un mot distinctif commun dans leurs titres.
  - 48 nouvelles paires de personnages de l'Outreterre, vérifiées sur planche-contact. Trois couples trompeurs sont
    refusés (`PAIRES_REFUSEES`).
  - 27 créatures ont leur portrait jumeau.
  - Sans portrait jumeau, la fiche montre le jeton lui-même, jamais un sosie. Pour une créature, un jeton qui a son
    jumeau est préféré.
  - Où l'image de fiche suit le jeton du plateau :
    - fiche du combattant et fil d'initiative (module Combat) ;
    - panneau d'attaque ;
    - liste et fiche de la carte de combat ;
    - fiche montrée aux joueurs.
- **Fond tactique** :
  - bouton « ↻ Tourner d'un quart de tour » : l'image et le terrain lu tournent ensemble ;
  - les jetons qui se retrouvent dans un gouffre, dans la roche ou en eau profonde vont sur la place sûre la plus
    proche, et le panneau dit combien ont bougé ;
  - lissage de la lecture : une ombre isolée au milieu d'un ravin, ou un reflet au milieu d'eau profonde, prend le
    terrain de ses voisines.
- **Lint** : plus aucune erreur.
  - Les configurations des énigmes, qui changent de forme selon le mécanisme, ont un type commun documenté (`Dyn`).
  - La réponse de l'IA de l'atelier est typée.

## Fichiers

- `scripts/banque/build.py` (monde strict, appariement), `src/banque/catalogue.json`.
- `src/banque/banque.js`, `banque.d.ts`, `index.ts`, `tiles.js` ; tests `banque.test.mjs` et `tiles.test.mjs`.
- `src/maps/battle/vignettes.ts` (`battleRegion`), `placement.ts` (`relocateUnsafe`) et son test `combatmove.test.mjs`.
- Combat : `BattleMode.tsx`, `BattleBoard.tsx`, `MiniBattle.tsx`, `CombatPanel.tsx`, `TilePanel.tsx`.
- Écran joueur : `src/maps/playerBoard.ts`, `src/present/stage.ts`, `src/present/PlayerScreen.tsx`.
- `src/maps/mapStore.ts`.
- Énigmes : `src/puzzles/types.ts`, `engine.ts`, `templates.ts`, `MechanismConfig.tsx`, `Atelier.tsx`.
- **Zone à risque : `src/App.jsx`**. Visage du jeton dans la fiche du combattant, l'initiative et le panneau
  d'attaque (`boardFace`). Retrait du portrait de créature sans monde connu.
