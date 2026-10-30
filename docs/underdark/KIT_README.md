# LoreSmith Underdark — Rencontres vivantes (kit V1)

Deux documents de conception et un prototype **exécutable**, ancrés dans les structures réelles du dépôt `Exod19/Fl-au-Bestiaire` inspectées en octobre 2026.

## Ce que contient le pack

- **89 scénarios** : caravanes, travailleurs, patrouilles, civils, pèlerins, excursions, faune, indices, dangers. Tous tagués `Underdark`.
- **32 archétypes PNJ** : 17 rôles Moriquendi et 15 surcouches professionnelles applicables à des peuples selon leur culture (statistiques Moriquendi à compléter, non inventées).
- **95 références du bestiaire** existant : noms, tailles, footprints, butin potentiel, lien aux IDs `underdark_...`.
- **13 peuples dans une matrice d'association**, avec règles orientées Moriquendi et motifs explicites pour les groupes étrangers multi-espèces.
- **7 lieux canoniques-clés** décrits sans fausses coordonnées.
- Un classificateur des **lieux de l'Atlas réel**, avec identification des features, cartes, paliers, strates, routes et villes publiées.
- Un moteur de **scènes locales reproductibles** et une variante client utilisable en Vite/React.

## Commencer

1. Lire `docs/01_REGLES_ASSOCIATIONS_ET_GROUPES.md`.
2. Lire `docs/02_ATLAS_LIEUX_ET_RENCONTRES.md`.
3. Exécuter `node --test tests/engine.test.mjs` depuis ce dossier (Node 20+ recommandé).
4. Exécuter le test de classification :

```bash
node scripts/build-atlas-inventory.mjs --atlas-json examples/atlas-fixture.json --cities-dir examples/cities --out examples/export-fixture
```

5. Donner `CLAUDE_CODE_IMPORT.md` et tout le ZIP à Claude Code. Pour le **vrai inventaire**, l'Atlas à extraire se trouve dans le dépôt privé de Fléau accessible à Claude, et non dans les exemples du ZIP :

```bash
node scripts/build-atlas-inventory.mjs --repo /chemin/vers/Fl-au-Bestiaire --out ./export-reel-flau
```

## Répartition des fichiers

| Fichier | But |
|---|---|
| `docs/01_*` | Cahier de règles de composition, diplomatie, sentience, commerce, butin, morale, scénarios. |
| `docs/02_*` | Classification des vrais lieux de navigation, politique d'import, provenance géographique, exemples. |
| `data/association-policy.v1.json` | Contraintes générales et paramètres de jeu. |
| `data/association-matrix.v1.json` | Relations asymétriques entre 13 peuples. |
| `data/encounter-templates.v1.json` | 89 scènes et compositions, inclut les exceptions nommées. |
| `data/creature-refs.v1.json` | 95 correspondances validées vers le bestiaire existant. |
| `data/npc-archetypes.v1.json` | 32 types de PNJ et équipements ordinaires. |
| `data/location-taxonomy.v1.json` | Classification fonctionnelle des lieux. |
| `data/canon-locations.v1.json` | Emplacements et états de connaissance à préserver. |
| `scripts/engine.mjs` | Moteur Node, sans réseau. |
| `scripts/build-atlas-inventory.mjs` | Extraction/annotation depuis l'Atlas React/TS local et les cités publiées. |
| `scripts/generate-encounter.mjs` | Tirage de scène pour un lieu existant. |
| `scripts/sync-browser-core.mjs` | Génération du moteur compatible navigateur à partir de la logique Node. |
| `integration/encounter-browser.ts` | Entrée Vite pour LoreSmith/Fléau. |
| `tests/engine.test.mjs` | Tests de cohérence, Moriquendi, doublons, provenance, tirage et chemins. |
| `examples/*` | Données artificielles pour vérifier le pipeline sans toucher au canon. |

## Limites et principes de sécurité éditoriale

- **Pas d'inventaire intégral exécuté sur le vrai dépôt dans cette livraison.** La branche GitHub a été inspectée; Claude Code doit lancer le script contre sa copie locale à jour. Les seules sorties CSV/JSON incluses sont celles d'une fixture artificielle.
- **Pas de changement au dépôt GitHub** ni à la carte officielle, ni de migration automatique.
- Les archives et la carte comportent parfois des sources de dates/statuts différents (ex. Hosten Valak) : le kit **signale** et conserve la provenance.
- Les 17 rôles Moriquendi sont des **archétypes sans statistique de combat**, pas des adversaires équilibrés déjà prêts.
- Certains monstres D&D ne sont pas nécessairement redistribuables sous licence ouverte. Vérifier le périmètre des droits avant toute publication commerciale.
- Générateur de **rencontre** local, pas une API payante de génération d'images, pas un simulateur économique complet.
