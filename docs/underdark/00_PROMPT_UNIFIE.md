# Mission unique — Importer le bundle intégral LoreSmith Underdark

Tu as reçu `LORESMITH_UNDERDARK_COMPLETE_2026-10-29.zip`. Décompresse-le et suis `00_COMMENCER_ICI.md`, puis les documents détaillés dans `03_RENCONTRES_ET_ASSOCIATIONS/KIT_RENCONTRES_VIVANTES_V1/docs/`.

## But

Mettre en place **une bibliothèque partagée entre univers** dont la collection des créatures Underdark est filtrée par `tags: ["Underdark"]`; relier ses monstres aux rencontres en contexte, aux groupes sociaux et à l'Atlas des profondeurs, sans perdre la progression et les modifications déjà faites par le MJ.

## A. Audit préalable, sans changement

- Détecte le ou les dépôts effectifs : LoreSmith et `Exod19/Fl-au-Bestiaire` sont potentiellement **deux applications différentes**. Ne pas présumer qu'un code d'Atlas Fléau existe dans LoreSmith.
- Vérifie version, branche et état Git, stockages (localStorage, IndexedDB, serveur), modes d'import existants, clés des monstres, générateur d'encounters, Mode MJ et composant de carte tactique.
- Sauvegarde la base, les campagnes, tous les IDs et les modifications d'utilisateurs.
- Fais un inventaire des 683 fiches du master et de tous les IDs déjà présents, des images, variantes et associations.
- Exécute d'abord les contrôles `07_CONTROLES_ET_MANIFESTES/VERIFIER_BUNDLE.py` et `node --test .../tests/engine.test.mjs`.

## B. Import non destructif

- Utilise `01_BESTIAIRE/00_MASTER_IMPORT/MASTER_683_CREATURES_CORRIGEES.json` pour comparer puis insérer les IDs manquants. **Pas d'upsert destructif** par nom ou ID.
- Les correctifs `02_CORRECTIFS/` sont **déjà inclus** dans ce master. Ne les utiliser séparément que pour une mise à jour contrôlée des anciennes entrées, avec comparaison préalable.
- Les 12 créatures 001–012 ont été **reconstruites** depuis le chat et non récupérées d'un fichier original : préférer les données de la bibliothèque existante.
- Réaliser un contrôle strict des règles combat/taille : 5 ft par case; Tiny emprise partagée/alternative; Small/Medium 1×1, Large 2×2, Huge 3×3, Gargantuan ≥4×4; montures et transformations à gérer distinctement.
- Ne pas supprimer les champs natifs spécifiques aux volumes successifs (lootTable, gridFootprint, variantOf, visualAnchor, rightsReview).

## C. Associations et social

- Charger `data/association-policy.v1.json`, `association-matrix.v1.json`, `encounter-templates.v1.json`, `npc-archetypes.v1.json`, `creature-refs.v1.json` du kit de rencontres.
- Un Moriquendi ne sert **jamais** automatiquement un marchand kobold ou autre étranger. Un Moriquendi dirigeant un groupe avec serviteurs étrangers est une **exception rare nommée, motivée, activée par le MJ**; aucune exception implicite ni choix automatique au hasard.
- Les cinq clans Norrianiss, Warral, Bois-de-l'Est, Iznogood et Drehjur appartiennent à une **même nation**, et peuvent cohabiter.
- Ne jamais faire apparaître un clan « Ventreen »; c'est une partie du nom de la cité Ozzoloh Ventreen.
- Réactions sociales, buts, moral/fuite, rapports hiérarchiques, commerce, objets portés, cargaisons, récoltes naturelles et réputation doivent être indépendants du fait d'être hostile ou non.
- Les PNJ Moriquendi non dotés de stats ne deviennent pas automatiquement des combattants inventés.

## D. Atlas et positions (dans le dépôt Fléau)

- Exécuter depuis le dossier du kit :

```bash
node scripts/build-atlas-inventory.mjs --repo /CHEMIN/DEPOT/Fl-au-Bestiaire --out /CHEMIN/EXPORT/atlas-reel
```

- Ne pas se contenter de l'export `examples/` qui est fictif. Classifier les features, cartes, villes publiées, galeries, paliers, ruines, champs fongiques, endroits domestiques, zones dangereuses et routes par ID stable et taxonomie; conserver provenance et statut canonique/placement.
- Conserver les lieux « known but unplaced » sans fabriquer de coordonnées. Attention aux données de Hosten Valak qui proviennent de sources éditoriales différentes; faire remonter les conflits aux humains.
- Ne pas auto-promouvoir les cités duergar `Khordun` et `Kharaz-Dûmel` de `creation` vers `confirme`.
- Brancher la classification uniquement en overlay de rencontres/campagnes; jamais effacer les fiches d'Atlas source.

## E. UI et intégration progressive

1. Prévoir l'interface bibliothèque partagée avec filtres Underdark / faction / famille / rôle / danger / sentience / taille / loot / habitats.
2. Ajouter au panneau MJ de chaque lieu les rencontres proposées, poids et raisons d'inclusion/exclusion; bouton Générer / Régénérer / Adapter / Ajouter à la campagne / Passer son chemin.
3. Dérouler les 89 modèles (caravanes, marchands, mineurs, familles, patrouilles, bestioles, accidents) avec composition, profils, objectifs, attitude, biens transportés, issue pacifique et conséquences.
4. Afficher les membres sur la carte avec empreinte de grille, mais **ne pas les positionner arbitrairement** dans un trou ou sur un mur. Garder la correction manuelle du MJ.
5. Conserver `src/atlas/encounters.ts` et `src/atlas/statblocks.ts` existants jusqu'à migration testée et réversible.
6. Les modifications de réputation, rencontres résolues et inventaires ne changent pas le lore officiel; les stocker par univers/campagne.
7. Ne pas exposer les informations réservées au MJ sur l'Atlas public/joueur.

## F. Tests de validation obligatoires

- Les 683 IDs sont uniques, liens `variantOf` présents, les tags Underdark, la taille, les PV, les listes de butin et leurs propriétaires cohérents; aucune créature ajoutée deux fois.
- Vérifier 19 tests moteur, la synchronisation browser/Node, extraction d'Atlas démo et extraction réelle; vérifier les manques de stats et les exceptions Moriquendi.
- Tester 8 contextes: Palissade Moriquendi, marché duergar, mine, caravane hors territoire, élevage, forêt fongique, ruine, zone dangereuse isolée.
- Produire un bilan de couverture des lieux (lieux recensés / classés / ambiguës), un rapport d'import par ID et des captures de l'interface MJ.
- Tester `typecheck`, `build` et tests du dépôt de destination. Commit/push UNIQUEMENT lorsque le MJ l'approuve.

## G. Livrer les résultats

Fournir une synthèse du nombre d'IDs importés, ignorés ou en conflit; les classifications réelles des lieux et les cas à confirmer; les nouvelles capacités du générateur de rencontres; captures et résultats de tests. **Ne pas masquer les échecs** ou reconstruire la carte en dehors des données officielles.

Aucune image finale n'est incluse. Ne pas solliciter d'API payante pour des images sans demande explicite.
