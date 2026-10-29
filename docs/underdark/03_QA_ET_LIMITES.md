# LoreSmith Underdark — Contrôle qualité et périmètre livré

**Testé le :** 28 octobre 2026 — Kit V1.

## Résultats reproductibles

| Test | Résultat |
|---|---|
| Tests moteur de référence | **19 / 19 réussis** (`node --test tests/engine.test.mjs`) |
| Scènes individuelles | **89**, IDs uniques, chacune avec tag `Underdark` |
| Créatures référencées | **95** IDs `underdark_...` présents dans la banque existante; loot potentiel importé |
| Archétypes PNJ | **32**, dont 17 Moriquendi; statblocks manquants explicitement signalés |
| Matrice d'association | 13 peuples, ordonnée et asymétrique pour les Moriquendi |
| Archives géographiques | 7 lieux canoniques-clés dans un fichier indépendant, avec inconnues préservées |
| Compilateur de catalogue | Réussi sur un **Atlas fictif de test** et une cité abrégée fictive |
| Inventaire de test | 20 enregistrements : 4 points, 4 contextes, 5 enregistrements de cité, 1 connexion, 6 lieux canoniques non présents dans la fixture |
| Répétabilité | Tirage par graine reproductible |
| Navigateur / Node | Même résultat sur un tirage identique : test de parité réussi |
| Prohibition Moriquendi | Cas normal interdit et cas nommé autorisé si approbation explicite; tests réussis |
| Faune en territoire Moriquendi | Permise sans assimilation à un visiteur étranger |
| Collection conceptuelle « Les Palissades » | Exclue des lieux concrets; 5 capitales restent des références distinctes |
| Exploitation hors ligne | Aucun appel réseau/API payante pour les générateurs locaux |

### Essai indicatif de répartition dans une mine duergar

250 tirages **démonstratifs** à graine variée, dans un contexte possédé par les duergars : 223 scènes de faction duergar, 19 indépendantes, 1 kobold, 5 orques et 2 svirfneblines. C'est un **contrôle de distribution logicielle**, pas une estimation de la démographie duergar; les coefficients sont configurables.

## Points ouverts (ne pas annoncer comme déjà livrés)

- L'inventaire exhaustif **du dépôt GitHub courant n'a pas été calculé** dans ce kit : le script devra être exécuté par Claude Code sur une copie locale de l'Atlas à jour. La quantité finale de lieux, y compris ceux des plans procéduraux, est inconnue ici.
- Aucun commit/push n'a été fait dans les dépôts Fléau ou LoreSmith. Le ZIP est une **livraison de documents, données, scripts de préparation et adaptateur**, non une fonctionnalité déployée.
- L'ancien `src/atlas/encounters.ts` et ses statblocks n'ont pas encore été interfacés avec les IDs `underdark_...`.
- Les `npc-archetypes` Moriquendi sont des professions/figures de jeu, **sans points de vie ni actions**. Pas d'invention automatique de chiffres présentés comme officiels.
- Le moteur ne gère pas encore les droits économiques ni le calcul du prix, la persistance des relations et la fréquence des déplacements; il prépare des scènes et des cargaisons correctement séparées.
- Le CR/équilibrage précis, les grilles complexes multi-hauteurs et la composition de combats préparés de difficulté garantie restent à implémenter dans l'application.
- Les brouillons d'Atelier présents uniquement dans le navigateur nécessitent un **export explicite** avant de pouvoir être reconnus par le script Node.
- Les données d'Hosten Valak possèdent des provenances documentaires distinctes (Tome II vs cartes Atlas plus récentes). Le système **signale** les ambiguïtés au lieu de décider silencieusement laquelle fait loi.
- Le canon de la géographie, des cultures et de certains personnages (y compris des monstres appartenant à D&D) doit être revu avant publication commerciale.

## Commandes pour Claude Code

```bash
node --test tests/engine.test.mjs
node scripts/build-atlas-inventory.mjs --atlas-json examples/atlas-fixture.json --cities-dir examples/cities --out examples/export-fixture
node scripts/audit-encounters.mjs > examples/audit-sample.json
```

Le rapport final du véritable Atlas doit être joint aux travaux d'intégration, avec le nombre exact de lieux détectés, leurs sources et les anomalies à réviser.
