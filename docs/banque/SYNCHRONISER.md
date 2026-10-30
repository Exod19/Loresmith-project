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

## Retouches du MJ

Dans **Cartes → 🖼 Banque Loresmith**, tu peux corriger les étiquettes d'une image ou l'exclure des choix automatiques.
Ces retouches sont gardées dans ce navigateur. Pour les rendre permanentes pour tous, demande à Claude de les reporter
dans le script.
