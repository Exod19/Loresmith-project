# Synchroniser la Banque Loresmith

La source des images reste le Google Drive : huit dossiers, quatre pour la **surface** et quatre pour
l'**Outreterre** (Underdark). L'application n'y accède pas : elle lit `public/banque/` (WebP en 256, 512 et parfois
1024 px) et `src/banque/catalogue.json` (étiquettes).

| Dossier du Drive | Identifiant | `folder` / `region` dans `drive.json` |
| --- | --- | --- |
| Textures (surface) | `18_EpGaJbFOQbtatqtmMZmVoBZBooXMwu` | `textures` / `surface` |
| Éléments de décor (surface) | `1wBXCvyYLdaCX4C2Ia_7s8-7WxUmAF0gY` | `elements` / `surface` |
| Personnages (surface) | `1N3O2O6uippON1dyPlLrpKq5E8Jln_Vt2` | `people` / `surface` |
| Créatures et monstres (surface) | `1xDMZsTlYZmpzelNCLfnBV0dQCNmn8HAs` | `creatures` / `surface` |
| Textures (Underdark) | `1tM0n_jNkYUmKmm-UxrOW_HdYLz2WshYx` | `textures` / `outreterre` |
| Éléments de décor (Underdark) | `1FJs0yuZcY-enDUFwUt8x6nYRUijhvotp` | `elements` / `outreterre` |
| Personnages (Underdark) | `1oKX1izeFlQV3Ozzd6wNunsJgnx0SuzG3` | `people` / `outreterre` |
| Créatures et monstres (Underdark) | `1qqwjlh8dzQpbhnF15-DWUBpLltDt6swM` | `creatures` / `outreterre` |

Ces huit dossiers sont le genre **Fantasy** (`genre: fantasy` dans `drive.json`). Genres, mondes et doublons : voir
`docs/banque/STRUCTURE.md`. Les sous-dossiers ne sont pas lus. Les fichiers des dossiers sont publics en lecture : Claude les télécharge par
`https://drive.usercontent.google.com/download?id=<id>&export=download`.

## Ce que fait Claude quand tu demandes « synchronise la banque »

1. Il liste les huit dossiers du Drive et met à jour `scripts/banque/drive.json` (identifiant, titre, dossier, région).
2. Il télécharge seulement les images nouvelles ou modifiées, dans un dossier de travail (hors du dépôt), et note
   l'empreinte (MD5) de chacune dans `drive.json` : un même fichier dans deux dossiers devient une seule image. Une image déjà
   convertie dont l'original n'est pas dans ce dossier est gardée telle quelle.
3. Il lance :

   ```
   python3 -I scripts/banque/build.py <dossier des originaux>
   ```

   Le script :
   - convertit les nouvelles images en WebP, sans jamais les agrandir ;
   - garde 1024 px seulement pour les textures, les portraits et les grands éléments (8 m et plus) ;
   - recadre éléments et jetons sur leur partie visible ;
   - étiquette chaque image d'après son titre : d'abord les règles précises (`ELEMENTS`, `TEXTURES`, `PEOPLE`), puis
     les règles générales par mots-clés (`ELEMENTS_GEN`, `TEXTURES_GEN`, `CREATURES`, `PEOPLE_GEN`, `ROLES_FR`, `NOMS`) ;
     la région vient du dossier ;
   - donne un nom français à chaque image (le titre du Drive reste dans `titre`) ;
   - range les créatures à part (`public/banque/creatures/`), nommées comme dans le bestiaire ;
   - ignore les fichiers sans rapport (liste `EXCLURE`) et les signale ;
   - réunit portrait et jeton d'un même personnage ;
   - retire les fichiers qui ne correspondent plus à rien.
4. Il vérifie les images signalées « étiquettes devinées » : il ajoute une règle au script pour chacune (taille réelle,
   milieux, climats, peuple, rôles), puis relance.
5. Il lance `npm test` (le catalogue réel est vérifié), `npm run build`, puis fait un commit.

## Conseils pour les titres du Drive

Les règles lisent le titre, en français ou en anglais. Un titre clair suffit souvent :

- élément : « Cime de chêne vue du dessus » ;
- texture : « Pavés médiévaux usés » ;
- personnage : « Overhead dwarf tavern keeper ».

Pour un nouveau peuple (drow, duergar, svirfnebelin…), nomme-le dans le titre. Sans jeton de ce peuple dans la banque,
l'Outreterre reste sans image plutôt que d'y mettre un humain.

## Retouches et images des MJ

- **Images communes** (le catalogue de l'application) : seul un administrateur change leurs étiquettes ou en exclut
  une. Il le fait dans **Cartes → 🖼 Banque Loresmith**, et ses retouches valent pour tous.
  - Elles sont gardées sur le serveur (`/api/banque/retouches`, espace KV).
  - Une synchronisation de la banque ne les écrase pas.
- **Administrateurs** : la variable `ADMIN_EMAILS` du projet Pages (adresses séparées par des virgules). Sans cette
  variable, c'est le compte du propriétaire (`server/src/admins.js`).
- **Images d'un MJ** : n'importe quel MJ ajoute ses images à la banque de son univers, ou de sa campagne en cours, et
  les étiquette.
  - Ce sont des images de l'univers (`assets`, catégorie `banque`). Elles suivent ses droits : un contributeur ne change
    que les siennes.
  - Loresmith y puise comme dans le catalogue commun.

Les toits reçoivent aussi une silhouette (`masque`, 8 × 8 cases), calculée par le script. Pour un nouveau toit en L,
en T, en U ou en croix, ajoute une règle avec la bonne `forme`. Loresmith le pose ensuite tout seul, dans la bonne
orientation, sur les bâtiments qui ont cette forme.

## Où l'application s'en sert

- Cités et intérieurs : sols, arbres, toits, mobilier (`BankLayer.tsx`).
- PNJ : portraits et jetons cohérents avec le peuple du lieu (`place.ts`).
- **Atlas en strates** : sols et parois des cavernes en texture de roche de l'Outreterre, et décor posé dans chaque
  caverne (stalagmites, champignons, cristaux, éboulis, flaques, ossements) : `CaveArt.tsx`. L'Atlas d'origine reste
  tel quel.
- Page **Cartes → 🖼 Banque Loresmith** : filtres par type (dont Créatures) et par monde (surface, Outreterre).

## Deux mondes, et une fiche qui montre le jeton

- Un personnage ou une créature appartient au monde de son dossier (surface ou Outreterre), et à lui seul.
  L'application ne prend jamais une image de l'autre monde. Le MJ peut le faire à la main.
- Le script apparie chaque jeton à son portrait (`pair_auto`) : même monde, même peuple et même rôle, ou même nom pour
  une créature, plus un mot distinctif commun dans les titres.
- Un couple trompeur se refuse dans `PAIRES_REFUSEES`. Une planche-contact des paires se vérifie à chaque nouvelle
  série.
- Sans portrait jumeau, la fiche montre le jeton lui-même. Pour qu'une fiche ait un vrai visage, dépose le portrait et
  le jeton avec des titres qui se ressemblent (même rôle, même détail : « Lantern Repairer… »).
