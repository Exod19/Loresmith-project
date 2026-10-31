# Synchroniser la Banque Loresmith

La source des images reste le Google Drive (trois dossiers : **éléments**, **personnages**, **textures**).
L'application n'y accède pas : elle lit `public/banque/` (WebP en 256, 512 et parfois 1024 px) et
`src/banque/catalogue.json` (étiquettes).

## Ce que fait Claude quand tu demandes « synchronise la banque »

1. Il liste les trois dossiers du Drive et met à jour `scripts/banque/drive.json` (identifiant, titre, dossier).
2. Il télécharge seulement les images nouvelles ou modifiées, dans un dossier de travail (hors du dépôt).
3. Il lance :

   ```
   python3 -I scripts/banque/build.py <dossier des originaux>
   ```

   Le script :
   - convertit les nouvelles images en WebP, sans jamais les agrandir ;
   - garde 1024 px seulement pour les textures, les portraits et les grands éléments (8 m et plus) ;
   - recadre éléments et jetons sur leur partie visible ;
   - étiquette chaque image d'après son titre (règles `ELEMENTS`, `TEXTURES` et `PEOPLE` du script) ;
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
