# Lot 28 : lieux sauvages de l'Underdark (statut : à valider)

Les lieux sauvages arrivent dans l'Atlas des profondeurs, sans jamais se mêler à ceux de la surface.

## Ce qui change

- **Des lieux le long des galeries** (`atlas/deepWilds.js`, nouveau). L'Atlas a déjà environ 1 460 lieux et 250 cavernes par plan, toutes peuplées. Les lieux sauvages de l'Underdark se posent donc dans les tronçons de galerie entre les cavernes, un peu à l'écart du tracé (une niche, une faille latérale), jamais dans une caverne ni contre un lieu existant.
  - Environ 40 par plan, soit un lieu toutes les 6 à 7 heures de marche.
  - Le tirage est toujours le même, puisqu'il vient de la galerie.
  - Les galeries secrètes et les crevasses n'en ont pas.
- **18 types souterrains** : forêt de champignons géants, lac noir (plus fréquent le long des ruisseaux), source chaude, gouffre sans fond, toile géante, grotte de cristaux chantants, campement drow abandonné, épave d'un convoi duergar, autel de Lolth, sanctuaire svirfnebelin caché, colonie de myconides, repaire de gricks, faille de vapeur, ossuaire oublié, filon de mithral, mare de vase, bivouac de réfugiés, dortoir de chauves-souris.
  - Même modèle qu'à la surface : teneur (ambiance, scène, accroche), danger, textes variés.
  - Les touches d'ambiance sont souterraines (lichens luminescents, écho en retard, roche tiède…).
  - Sous terre, une scène ou une accroche est au moins « incertaine ».
- **Pour le MJ** : les brouillons apparaissent au zoom régional, estompés. La fiche est la même qu'à la surface : Garder, Définir (types de l'Underdark), Montrer aux joueurs, Écarter, et les rencontres du lieu.
- **Enregistrés dans le calque de l'Atlas** (`overlay.wilds`) : ils rejoignent ses données, et les joueurs ne voient que ceux qui sont révélés.
- **Découverte en chemin**, à portée de torche, en suivant une galerie.
  - Le groupe s'arrête vis-à-vis du lieu. L'écran joueur annonce ce qu'on perçoit et propose « Aller voir » ou « Continuer votre chemin ». Par exemple : « Un bruissement d'ailes emplit une faille, sur votre droite ».
  - Les lieux cachés ne se voient qu'avec la Perception passive : sanctuaire svirfnebelin DD 15, autel de Lolth DD 14, toile géante, campement drow, repaire de gricks et filon de mithral DD 13, mare de vase DD 12.
  - Un lieu aperçu est enregistré ; « Aller voir » y mène le groupe et le révèle aux joueurs.
- **Rencontres du lieu, de l'Underdark seulement** : toile géante → araignées géantes ; campement drow → patrouille drow ; épave → pillards ou convoi duergar ; ossuaire → goules ou ombres ; mare de vase → vase grise, gelée ocre ou cube gélatineux ; dortoir → nuée de chauves-souris…

## La surface et l'Underdark restent séparés

- Types, textes et rencontres sont propres à chacun : `world/wilds.js` et `atlas/surfaceEncounters.ts` pour la surface ; `atlas/deepWilds.js` et la table de l'Underdark (`atlas/encounters.ts`, `DEEP_SITE_ENCOUNTERS`) pour l'Atlas.
- La fiche du lieu ne propose que les types de son monde.

## Fichiers

- Nouveaux : `atlas/deepWilds.js`, `deepWilds.d.ts`, `deepWilds.test.mjs` (3 tests), `atlas/deepIndex.ts`, `docs/carte-monde/LOT-28.md`.
- Modifiés :
  - `mapStore.ts` : `overlay.wilds`, lieux enregistrés dans les données de l'Atlas ;
  - `world/generate.d.ts` : `WildRecord` porte `planId` et `at` dans l'Underdark ;
  - `world/index.ts` (typage) ;
  - `atlas/encounters.ts` : rencontres de lieu de l'Underdark, tirage restreint ;
  - `world/WildPanel.tsx` : types proposés selon le monde ;
  - `MapViewer.tsx` : brouillons, enregistrement, fiche et découverte dans l'Atlas.
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Vérifications

Dans le navigateur, sur la strate I-3 :

- en partant de la Mare d'infiltration par une galerie, le groupe s'arrête devant le Dortoir de chauves-souris des Os blanchis ;
- l'écran joueur affiche « Un bruissement d'ailes emplit une faille, sur votre droite. Vous allez voir, ou vous continuez votre chemin ? » ;
- le lieu est enregistré dans le calque ; « Aller voir » y mène le groupe et le révèle ;
- la fiche du lieu tire une « Nuée de chauves-souris » (table de l'Underdark) ;
- au zoom régional, les brouillons voisins s'affichent pour le MJ (« Source chaude du Silence », « Toile géante… »).

## Limites

- Pas encore de plan propre au lieu : le combat se fait sur le terrain de l'Atlas à cet endroit.
- Pas de réglage de densité pour l'Underdark.
