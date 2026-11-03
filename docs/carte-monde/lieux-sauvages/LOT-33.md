# Lot 33 (série lieux sauvages) : genres d'univers, monde du plateau, inventaire sans doublons (statut : à valider)

Structure complète : `docs/banque/STRUCTURE.md`.

## Ce qui change

- **Genres d'univers** (Univers → Canon → « Genres de l'univers ») :
  - fantasy, steampunk, historique, moderne, post-apocalyptique, science-fiction ;
  - un univers en a un ou plusieurs ; les univers existants sont en fantasy.
  - La banque ne propose d'office que les images de ces genres, plus les images communes (`*`). Pas de centaure dans
    un univers futuriste.
- **Images communes ou propres à un genre**, décidé par le script :
  - communes : textures naturelles, tuiles de rivière et de ravin, arbres, rochers, plantes, stalagmites, parois ;
  - propres au genre de leur dossier : personnages, créatures, bâtiments, mobilier, objets, sols bâtis.
  - Catalogue actuel : 236 images communes, 550 en fantasy.
- **Page Banque** :
  - case « Tous les genres » pour voir tout le catalogue ;
  - champ « Genres d'univers » retouchable par l'administrateur (le serveur accepte ce champ).
- **Monde du plateau** (Construire) : « Automatique » (déduit du lieu), « Surface » ou « Outreterre ». Sur un plateau
  vierge, sans choix, la banque ne propose rien.
- **Pas de doublons** :
  - chaque original a une empreinte MD5 (`drive.json` : `md5` ; catalogue : `empreinte`) ;
  - un même fichier dans deux dossiers devient une seule image, avec les genres et les mondes réunis.

## Vérifications

Dans le navigateur, même plateau et mêmes monstres :

- plateau vierge : jetons génériques ;
- monde Outreterre : Otyugh, araignée et grick de la banque ;
- univers science-fiction : jetons génériques, aucune créature de fantasy ;
- monde Surface : aucune créature de l'Outreterre.

Tests : 268 côté site (dont 2 nouveaux sur les genres), 14 côté serveur.

## Fichiers

- Nouveaux : `src/banque/genres.js`, `genres.d.ts`, `genres.test.mjs`, `GenrePicker.tsx`, `docs/banque/STRUCTURE.md`.
- Modifiés :
  - banque : `src/banque/index.ts` (filtre par genre, `setBankGenres`, `useBankAll`), `banque.d.ts`, `BanquePanel.tsx`,
    `catalogue.json` ;
  - script : `scripts/banque/build.py` (genres, empreintes, doublons) et `drive.json` ;
  - combat : `src/maps/battle/TilePanel.tsx` (`WorldPicker`), `BattleMode.tsx`, `vignettes.ts`, `src/maps/mapStore.ts` ;
  - `docs/banque/SYNCHRONISER.md`.
- **Zones à risque** :
  - `src/App.jsx` : genres de l'univers transmis à la banque, et champ « Genres de l'univers » ;
  - `server/src/banque.js` : `genres` ajouté aux champs retouchables.
