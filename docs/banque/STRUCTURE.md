# Banque Loresmith : structure de l'inventaire (genres, mondes, doublons)

Loresmith accueillera des univers fantasy, steampunk, historiques, modernes, post-apocalyptiques, de science-fiction…
L'inventaire d'images est **unique** : une image n'existe qu'une fois. Ses étiquettes disent où elle a sa place.

## Les deux axes

| Axe | Champ | Exemples | Qui le fixe |
| --- | --- | --- | --- |
| **Genre d'univers** | `genres` sur l'image ; `genres` sur l'univers | `fantasy`, `steampunk`, `historique`, `moderne`, `postapo`, `scifi`, `cyberpunk`, `pirate`, `horreur` ; `*` = tous | le dossier du Drive, ou une règle du script ; l'univers : réglages (Univers → Genres) |
| **Monde dans l'univers** | `region` sur l'image ; monde du lieu ou du plateau | `surface`, `outreterre`, `mer` (plus tard `espace`, `orbite`…) | le dossier du Drive (sauf `MONDE_FORCE`) ; le plateau : déduit du lieu, ou choisi par le MJ, un ou plusieurs (Construire → Mondes du plateau) |

**Règle d'or : Loresmith ne propose jamais seul une image hors de l'univers.**
- Une image est proposée d'office seulement si :
  - un de ses genres est celui de l'univers, ou elle est commune (`*`) ;
  - et son monde est celui du lieu.
- Pas de centaure dans un univers futuriste, pas de drow à la surface.
- Le MJ, lui, peut toujours poser n'importe quelle image à la main (page Banque, case « Tous les genres »).

Genres et mondes se combinent librement.
- Un univers « fantasy + pirate » reçoit la flibuste dans un monde de fantasy, centaures compris. Un univers
  « pirate » seul reçoit la flibuste sans magie ni monstres de fantasy.
- Un plateau peut cumuler plusieurs mondes, par exemple l'entrée d'une caverne : surface et Outreterre.

**Exceptions au dossier** : `MONDE_FORCE` dans le script impose un monde à des images rangées ailleurs. Les scorpions
géants sont de l'Outreterre, même déposés avec la surface. Le mieux reste de les déplacer dans le bon dossier du Drive.

## Ce qui est commun, ce qui est propre à un genre

- **Commun (`*`)** :
  - textures naturelles : herbe, sable, terre, roche, boue, neige, glace, eau, lave, humus, gravier ;
  - tuiles de rivière et de ravin ;
  - éléments naturels : arbres, arbustes, rochers, bois mort, plantes d'eau, flaques, stalagmites, cristaux, parois de
    caverne.
  - Une forêt de chênes est la même en 1200 et en 2300.
- **Propre au genre du dossier** : personnages, créatures, bâtiments et toits, mobilier, objets, campements, mines,
  pièges, socles, sols bâtis (pavés, dalles, planches).
- Le script décide d'après la catégorie : `COMMUNS_TEXTURES` et `COMMUNS_ELEMENTS` dans `scripts/banque/build.py`.
- L'administrateur corrige image par image dans la page Banque (« Genres d'univers ») ; ses retouches sont partagées.

Les personnages et les créatures ne sont **jamais** communs, comme le vérifie un test : un garde, un monstre,
appartiennent toujours à un genre.

## Dossiers du Drive

Organisation recommandée, un dossier par genre, puis par monde, puis par type :

```
Loresmith/
  Commun (tous univers)/        → genre « * » : textures et nature uniquement
    Textures/  Éléments de décor/
  Fantasy/
    Surface/   Textures/ Éléments de décor/ Personnages/ Créatures/
    Underdark/ Textures/ Éléments de décor/ Personnages/ Créatures/
  Steampunk/
    Surface/   …
  Science-fiction/
    Surface/   …   (plus tard : Station orbitale/, Vaisseau/…)
```

- Les huit dossiers actuels sont ceux de **Fantasy / Surface** et **Fantasy / Underdark** : `genre: fantasy` dans
  `scripts/banque/drive.json`.
- Pour un nouveau genre, crée ses dossiers et donne-moi leurs liens. J'ajoute le genre dans `src/banque/genres.js`
  (`GENRES`) et ses dossiers dans le tableau de `docs/banque/SYNCHRONISER.md`.

## Pas de doublons

- Chaque fichier a une **empreinte** (somme MD5 de l'original), gardée dans `drive.json` (`md5`) et dans le catalogue
  (`empreinte`).
- Le même fichier déposé dans deux dossiers devient **une seule image**, dont les genres et les mondes réunissent ceux
  des deux dossiers. Par exemple, une texture de pierre mise dans Fantasy et dans Steampunk sert aux deux. Le script
  signale ces doublons.
- Une image proche mais pas identique (recadrée, retouchée) reste une image distincte : c'est voulu, une variante a sa
  place.
- Les images converties avant les empreintes (les 246 premières) en reçoivent une à leur prochain téléchargement.

## Rôle de chaque champ (rappel)

- `type` : `texture`, `element`, `personnage` ou `creature`.
- `vue` : `tuile`, `zenith`, `jeton` ou `portrait`.
- `cat`, `usage`, `forme`, `materiau` : nature de l'objet.
- `taille` : taille réelle.
- `milieux`, `climats`, `saisons` : où et quand l'image convient, à l'intérieur d'un même genre et d'un même monde.
- `peuple`, `genre` (f/m), `roles` : personnages.
- `paire` : jeton ↔ portrait de la même personne ou de la même créature.
