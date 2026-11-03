# Lot 26 : plan des lieux sauvages, rencontres du lieu, destinations proposées par les joueurs (statut : à valider)

Quatrième lot « lieux sauvages ».

## Ce qui change

### Le plan du lieu

- **Chaque lieu sauvage enregistré a son plan** (`world/wildPlan.js`, nouveau) : une clairière d'environ 100 × 80 m autour du lieu. On y entre comme dans un hameau, au zoom le plus fort ou par « Entrer dans… ».
- **La végétation suit le terrain** : forêt dense, lisière, plaine nue, aucun arbre au désert ni en haute montagne, neige au sol dans les terres enneigées. Rochers épars, plus nombreux en montagne. Un sentier y mène.
- **Un aménagement par type de lieu** :
  - paroi rocheuse et bouche de la grotte (géant, mine, tanière), avec la marmite et le coffre du géant ;
  - nid parmi les rochers ;
  - cabane, ermitage avec son autel, camp de trappeurs, tour de guet, ferme brûlée avec son puits ;
  - tentes du camp de bandits ou des nomades ;
  - anneau de champignons, cercle de menhirs, sanctuaire druidique (autel et vasque), cairn ;
  - tertre du tumulus et son entrée scellée ;
  - cairns du champ de bataille, colonnade ensablée ;
  - arbre-cœur colossal ;
  - source, oasis et ses palmiers, mares du marais, cascade et son bassin.
- **Points d'intérêt** : deux ou trois par lieu, avec ce qu'on y trouve et le jet à faire. Par exemple : « Tas d'ossements : bœufs, chèvres… et une épée rouillée au milieu (Investigation DD 12) » ; « Entrée scellée : une dalle gravée (Force DD 15) ».
- **Plateau de combat de pleine nature.** Le plateau tiré du plan a un sol d'herbe et de terre, jamais de pavés. Une paroi ou des rochers sont de la roche ; un abri compact (tente, cabane) garde son toit. Un drapeau `nature` passe du plan au plateau (`battle/theme.ts`, `banque/boardDress.ts`).
- Les plans de cité et de hameau sont inchangés.

### Rencontres du lieu

- Dans la fiche d'un lieu sauvage, deux boutons :
  - **🎲 Rencontre ?** : jet selon le hasard ;
  - **⚔ Rencontre du lieu** : rencontre imposée.
- La rencontre est tirée parmi celles qui conviennent au type : tanière → meute de loups ou ours ; grotte du géant → ogre ; camp de bandits → brigands ; tumulus, champ de bataille et marais → morts sans repos ; cabane et menhirs → cultistes ; mine → gobelins ou araignées… Toujours dans la table de surface, jamais celle de l'Underdark.

### Destinations proposées par les joueurs

- **Sur l'écran joueur** (carte du monde), toucher un point de la carte ouvre « Aller par là ? · 🧭 Proposer au MJ d'aller ici ». Sur la fiche d'un lieu touché, le bouton est « 🧭 Proposer d'y aller ».
- **Chez le MJ**, l'onglet Groupe s'ouvre sur la proposition : « 👀 Les joueurs proposent d'aller ici », avec le chemin tracé, la distance, la durée et le terrain. Deux boutons : **Accepter : partir** ou **Refuser**.
- Le journal de route le note : « …, à la demande des joueurs ».

## Fichiers

- Nouveaux : `world/wildPlan.js`, `wildPlan.d.ts`, `docs/carte-monde/LOT-26.md`.
- Modifiés :
  - `world/generate.js` : plan des lieux enregistrés, accès par « Entrer » ;
  - `world/WildPanel.tsx` : rencontres du lieu ;
  - `atlas/surfaceEncounters.ts` (`SITE_ENCOUNTERS`) et `atlas/encounters.ts` (tirage restreint à un lieu) ;
  - `atlas/types.ts` (`nature`, tracé `cliff`), `atlas/atlas.css`, `mapStore.ts` ;
  - `battle/theme.ts`, `battle/BattleBoard.tsx`, `battle/BattleMode.tsx`, `battle/MiniBattle.tsx`, `playerBoard.ts`, `banque/boardDress.ts` : plateau de pleine nature ;
  - `present/stage.ts` (message `goto`), `present/PlayerScreen.tsx` (proposer une destination) ;
  - `MapViewer.tsx` : proposition des joueurs, rencontres du lieu ;
  - `world/wilds.test.mjs` (un test de plus).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Vérifications

- **Plans** de la grotte du géant, du cercle de fées, du camp de bandits et de l'oasis : aménagement et points d'intérêt affichés. Les plateaux de combat sont en herbe, avec la paroi en roche.
- **Rencontres du lieu** sur huit lieux : marais → morts sans repos, clairière → ours ou chasseurs, cabane → cultistes, tanière → loups, sanctuaire druidique → loups.
- **Proposition des joueurs** : le joueur propose un point de la carte ; le MJ voit la proposition, son chemin (68 km, environ 2 jours), et l'accepte. En chemin, le groupe aperçoit un tumulus, et le journal note la tanière manquée (Perception DD 13).

## Limites

- On ne peut pas entrer dans le plan d'un brouillon : il faut d'abord garder le lieu.
- L'anneau de champignons est très discret sur le plan : il se voit surtout de près.
- Les objets du plan (coffre, tonneau, autel) ne sont pas encore posés sur le plateau de combat.
