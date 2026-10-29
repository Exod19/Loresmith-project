# LoreSmith — Chroniques du Combat v1.0

Bibliothèque de narrations de combat originales, en français (fr-CA), prête à importer dans un projet React/Vite.

## Contenu

- `manifest.json` : inventaire et politiques de sélection.
- `data/*.json` : collections séparées, chaque entrée avec ID unique, résultat, tonalité, rareté, tags et conditions.
- `INTEGRATION_CLAUDE.md` : cahier des charges technique.
- `validate.py` : vérification locale des doublons, variables et conditions.

## Principes

Les narrations sont des **descriptions**, jamais des instructions de mécanique. Le moteur doit résoudre le combat **avant** de choisir la phrase. `critical_fail` est une catégorie narrative, pas une pénalité automatique. `legendary` est réservé aux coups critiques fatals contre un boss dans cette version.

**Attention :** certaines phrases sont assemblées à partir de segments narratifs écrits à la main pour assurer un grand volume. Les textes sont uniques, mais certaines constructions stylistiques se ressemblent. Un audit éditorial reste souhaitable avant une publication commerciale.

Les étiquettes `weapons: ["any"]` et `creatures: ["any"]` sont des jokers. Les autres valeurs doivent être comparées exactement. Les narrations avec `conditions` ne sont éligibles que si tous leurs prédicats sont vérifiés.

## Règle linguistique

Les phrases utilisent principalement `{attacker}` et `{target}`. Le code doit injecter des noms d'affichage qui fonctionnent grammaticalement dans les phrases. Pour les noms génériques, préférer une chaîne incluant l'article (`le squelette`, `l'orc`) lorsque nécessaire. Ne pas tenter de conjuguer des genres à la volée.

## Vérification

`python validate.py`
