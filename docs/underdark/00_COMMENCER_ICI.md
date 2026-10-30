# LORE SMITH / UNDERDARK — ARCHIVE TOTALE POUR CLAUDE CODE

**Date : 29 octobre 2026 — bundle hors ligne.** Les sources originales des volumes 2–5 et du moteur de rencontres sont conservées sans réécriture; les correctifs et le master sont séparés.

## Quels fichiers donner à Claude ?

Donner **ce ZIP entier**, et lui demander de commencer par `06_INSTRUCTIONS_CLAUDE/00_PROMPT_UNIFIE_POUR_CLAUDE_CODE.md`.

## Résumé vérifié

| Élément | Qté / statut |
|---|---|
| Bestiaire V1 | **12** fiches **RECONSTITUÉES**, pas fichier d'origine original |
| Bestiaire V2 | 20 fiches originales |
| Bestiaire V3 | 194 fiches originales |
| Bestiaire V4 | 177 fiches originales |
| Bestiaire V5 | 280 fiches originales |
| Total | **683 IDs distincts : `underdark_001` à `underdark_683`** |
| Correctif taille | 226 enregistrements pour IDs 001–226 |
| Correctif butin | 371 enregistrements pour IDs 013–403 |
| Rencontre vivante | 89 modèles, 32 archétypes, 95 correspondances, matrice 13 peuples |
| Atlas | moteurs d'export + taxonomie + lieux canoniques du kit; **inventaire réel intégral à calculer sur le dépôt courant** |
| Images finales | Aucune; seulement prompts et manifestes d'images |

## Règle critique d'import

1. **Sauvegarder** la bibliothèque présente avant toute opération.
2. Examiner les IDs déjà présents, leurs modifications locales et leurs liens aux campagnes.
3. Préférer le fichier `01_BESTIAIRE/00_MASTER_IMPORT/MASTER_683_CREATURES_CORRIGEES.json` comme *source comparative* (pas un ordre d'upsert destructif).
4. Importer **uniquement les IDs absents** (`mergeKey: id`). Pour les IDs existants, produire un diff et demander approbation avant toute correction.
5. Le master a déjà les correctifs taille et butin ; ne pas appliquer les patches deux fois.
6. Les 12 fiches du volume 1 ne sont **pas byte-identiques à l'ancien texte** : la collection locale existante fait autorité.
7. Ne jamais assimiler Moriquendi de clans différents à des peuples ennemis. Respecter les restrictions asymétriques des étrangers.
8. Les lieux de démonstration ne deviennent jamais canoniques. Extraire l'Atlas réellement courant avant d'associer des rencontres géolocalisées.
9. La classification et les rencontres doivent rester distinctes des données officielles des Archives; conserver les événements dans un monde / campagne.
10. Ne pas donner les marchandises au joueur comme butin automatique. Respecter l'origine et la propriété des objets.

## Index du bundle

- `01_BESTIAIRE/00_MASTER_IMPORT/` : master consolidé de 683 fiches corrigées, index CSV et fiches unitaires.
- `01_BESTIAIRE/01_VOLUME_1_RECONSTITUE/` : 12 fiches reconstituées, avec avertissement.
- `01_BESTIAIRE/02_VOLUMES_ORIGINAUX/` : originaux intacts V2–V5, extraits et lisibles.
- `01_BESTIAIRE/03_FICHIERS_COMBINES_HISTORIQUES/` : anciennes versions 2+3, 2+4, 2+5 à conserver pour traçabilité, **ne pas importer en plus du master**.
- `02_CORRECTIFS/` : fichiers originaux de patch, et politique non destructive.
- `03_RENCONTRES_ET_ASSOCIATIONS/` : moteur Node/React, modèles, civilités, règles Moriquendi, tests, taxonomie et scripts d'Atlas.
- `04_ATLAS_LIEUX/` : état cartographique vérifié et index partiel de lieux; vrai inventaire à extraire dans le dépôt.
- `05_IMAGES_ET_TOKENS/` : standard visuel, manifestes d'images, aucune image finale.
- `06_INSTRUCTIONS_CLAUDE/` : prompt unifié + prompts historiques des 5 volumes et rencontres.
- `07_CONTROLES_ET_MANIFESTES/` : rapports qualité, index CSV, checksums SHA-256 et inventaires.
- `99_ARCHIVES_SOURCES/` : archives ZIP originales conservées à l'identique pour archivage.

## IMPORTANT — Le master n'est pas un nouvel univers canonique

Les chiffres, attaques et PV des anciens packs sont des adaptations maison LoreSmith, non des blocs D&D officiels. Les 683 fiches ne sont pas toutes garanties équilibrées. Certains noms et éléments D&D nécessitent vérification de droits avant redistribution commerciale.
