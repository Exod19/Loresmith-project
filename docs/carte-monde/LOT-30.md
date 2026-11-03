# Lot 30 : banque en huit dossiers (surface et Outreterre), cavernes habillées dans l'Atlas en strates (statut : à valider)

## Ce qui change

- **La banque suit les huit dossiers du Drive** : textures, décor, personnages et créatures, pour la surface et pour
  l'Outreterre (voir `docs/banque/SYNCHRONISER.md`).
  - Première synchronisation : 544 nouvelles images ; les 246 déjà présentes avaient simplement changé de dossier.
  - Catalogue : 786 images, dont 52 textures, 352 éléments, 316 personnages et 66 créatures. 396 sont en Outreterre.
  - Ignorés et signalés : 7 fichiers sans rapport (quatre images « bureau », trois maquettes d'écran de navigation).
- **Nouveau type « créature »** : jetons et portraits, nommés comme dans le bestiaire de l'Underdark (Otyugh, Grick,
  Flagelleur mental, Roper…), dans `public/banque/creatures/`.
- **Étiquettes générales par mots-clés** : catégorie, taille réelle, milieux, peuple, rôles et un nom français.
  - Une seule image a reçu des étiquettes devinées.
  - Les habitants de l'Outreterre sans peuple nommé dans leur titre sont rangés chez les Moriquendi. Le MJ
    administrateur peut retoucher ce choix dans la page Banque.
- **Page Banque** : filtre Créatures et filtre par monde (surface, Outreterre).
- **Atlas en strates, carte de navigation** (MJ et écran joueur) :
  - les sols des cavernes et des galeries prennent une texture de roche de l'Outreterre ;
  - les parois prennent une roche-mère calcaire ;
  - un grain fin apparaît en zoomant ;
  - chaque caverne reçoit un décor qui ne change pas d'une ouverture à l'autre : stalagmites, champignons, cristaux,
    éboulis, flaques, ossements. Ce décor est symbolique, à l'échelle de la caverne, et ne s'affiche qu'une fois assez
    grand à l'écran.
  - L'Atlas des profondeurs d'origine n'est pas modifié.

## Fichiers

- Nouveaux : `src/banque/CaveArt.tsx`, `public/banque/creatures/`, les nouvelles images de `public/banque/*`, ce document.
- Modifiés :
  - `scripts/banque/build.py` : régions, créatures, règles générales, noms français, exclusions, images déjà converties
    gardées ;
  - `scripts/banque/drive.json` ;
  - `src/banque/catalogue.json` ;
  - `src/banque/banque.js` et `banque.d.ts` (type `creature`) ;
  - `src/banque/BanquePanel.tsx` (filtres) ;
  - `src/maps/atlas/MapCanvas.tsx` et `atlas.css` (`cavernArt`) ;
  - `src/maps/MapViewer.tsx`, `src/maps/playerBoard.ts`, `src/present/stage.ts` et `src/present/PlayerScreen.tsx`
    (option transmise à l'écran joueur) ;
  - `docs/banque/SYNCHRONISER.md`.
- Zones à risque (`App.jsx`, `persist.js`, `sync/engine.js`, `server/src/`) : non touchées.

## Limites

- Les créatures sont au catalogue, mais le plateau de combat ne les pose pas encore tout seul sur les monstres.
- Les tuiles tactiques de rivière et de ravin sont rangées (`usage: tactique`), sans être encore utilisées.
