# Mission Claude Code — intégrer LoreSmith / Fléau : rencontres vivantes

**Instruction principale :** applique ce kit en respectant l'existant. Ne reconstruis pas l'Atlas, ne remplace pas son moteur de navigation, n'importe pas des données de démonstration comme canon. Ne crée aucune nouvelle règle sociale Moriquendi implicite.

## Ce qui est disponible

- `docs/01_REGLES_ASSOCIATIONS_ET_GROUPES.md` : **source fonctionnelle**, canon vs règles proposées, gestion asymétrique des Moriquendi.
- `docs/02_ATLAS_LIEUX_ET_RENCONTRES.md` : **guide d'indexation réelle**, mapping vers `src/atlas/*`, exemples par lieu.
- `data/*.json` : 89 modèles de scènes, 95 créatures référencées, 32 rôles civils (dont Moriquendi), politiques de relation, 13×13 factions, taxonomie, sept lieux canoniques clés.
- `scripts/*.mjs` : contrôle des données, classification, export, tirage, synchronisation du moteur pour navigateur.
- `integration/*.mjs`, `integration/*.ts` : moteur client Vite sans `node:fs`.
- `examples/` : contexte artificiel de test, jamais canon.

## A. Vérifier l'environnement AVANT toute modification

1. Vérifie sur quelle branche tu travailles et l'état du dépôt : `git status`, `git branch --show-current`.
2. Repère le chemin réel du repo Fléau (`Exod19/Fl-au-Bestiaire`) et sa version courante. L'Atlas examiné en préparation est dans `src/atlas/data.ts`, `types.ts`, `procedural.ts`, `hostenValak.ts`, `cities.ts`; l'ancien moteur est `src/atlas/encounters.ts`.
3. Identifie où se trouve LoreSmith et comment la bibliothèque de créatures `underdark_001...` est stockée; **ne pars pas du principe que LoreSmith et les Archives de la Toile sont le même repo**.
4. Identifie l'actuelle voie d'import : sauvegardes JSON, IndexedDB, API, bibliothèque partagée. Prévois une adaptation sans duplication des créatures.
5. Lis les documents de canon présents dans les Archives avant de créer une exception sociale.

## B. Valider le kit en lecture seule

```bash
node scripts/sync-browser-core.mjs
node --test tests/engine.test.mjs
node scripts/build-atlas-inventory.mjs \
  --atlas-json examples/atlas-fixture.json \
  --cities-dir examples/cities \
  --out examples/export-fixture
```

Les chemins ci-dessus sont relatifs à la racine du **kit**. Aucun autre service externe n'est nécessaire pour la simulation. Ne pas remplacer l'index testé par des lieux officiels sans provenance.

## C. Extraire l'Atlas réel de Fléau

Dans le dépôt Fléau, assure-toi que `node_modules`/`esbuild` existent (dépendances Vite déjà utilisées, sinon `npm install`). Puis, depuis la racine du kit :

```bash
node scripts/build-atlas-inventory.mjs \
  --repo /chemin/vers/Fl-au-Bestiaire \
  --out ./export-reel-flau
```

Ensuite vérifie les 4 sorties, notamment `atlas-classification-report.md`, `atlas-location-index.csv`, et les cas à revoir. Les lieux `demo:true` doivent rester séparés des lieux confirmés. Vérifie la reconnaissance de chaque palier publié de **Khordun** et **Kharaz-Dûmel**, et de chaque lieu d'**Hosten Valak** déjà enregistré.

**Brouillons :** s'ils résident seulement en localStorage/IndexedDB de l'Atelier, implémente dans l'interface un export JSON explicite ou utilise la fonction d'export existante, puis relance avec `--drafts-dir`. Un script Node externe ne peut pas lire magiquement le navigateur.

## D. Séparer source d'Atlas et table de jeu

- Maintenir les emplacements non documentés comme non localisés. Ne pas déplacer Ozzoloh Ventreen/Hosten Valak vers un numéro de strate hypothétique.
- Ne pas créer de nouveau clan « Ventreen ».
- Les villes duergar publiées sont marquées `creation`, non canon établi.
- Conserver les statuts `creation`, `confirme`, `illustrative`, `unknown`, les références et la provenance d'origine.
- Les données de campagnes (visite, commerce, vol, réputation, combat) vivent dans un **overlay de campagne**, pas dans les Archives officielles.

## E. Brancher les rencontres sans casser les boutons existants

1. Conserver `src/atlas/encounters.ts` et `src/atlas/statblocks.ts` tant qu'un adaptateur n'est pas livré et testé.
2. Copier les fichiers `data/` et `integration/` du kit dans **le même sous-répertoire d'application**, par exemple `src/encounters/data/` et `src/encounters/integration/`.
3. Utiliser `classifyCurrentAtlas(ATLAS, publishedCities)` une seule fois à l'initialisation du registre ou après mise à jour, puis indexer par ID. Charger les `publishedCities` depuis l'index publié de Fléau; ne pas faire un appel réseau par jet de rencontre.
4. Pour chaque lieu cliqué dans l'Atlas, montrer dans **le panneau MJ** un onglet « Rencontres possibles », trié et filtré : nature, rôle, fonction du lieu, appartenance, réaction, composition, butin, difficulté **si calculée** et raison des exclusions.
5. Offrir : « Générer », « Régénérer avec nouvelle graine », « Choisir un modèle », « Personnaliser », « Garder pour la campagne » et « Ne rien rencontrer ». Les contrôles sont des objectifs UI, pas des composants livrés.
6. Associer chaque `creatureId` au registre des 683 fiches; garder le lien au statblock, au portrait, au token et à l'emprise de grille. Les rôles Moriquendi `NOT_YET_DEFINED` doivent rester des archétypes de PNJ, **pas des faux statblocks équilibrés**.
7. Les marchandises ne sont pas les objets portés; la fouille d'une créature ne vole pas automatiquement les caisses d'une caravane. Un objet commercial peut être acquis par transaction, vol, abandon ou récompense volontaire.
8. Respecter le Mode MJ, déjà prévu dans `src/lib/dm.ts`; les statistiques, objectifs secrets et révélations ne doivent pas apparaître sur la vue joueur/encyclopédie publique.
9. Faire `npm run typecheck`, `npm run build`, tests du repo, et un test manuel sur smartphone/desktop dans la version déployée.

## F. Cas de contrôle avant merge

Tester au minimum les 19 tests unitaires du kit ET :

- Ozzoloh : Moriquendi de plusieurs clans possibles; visiteurs étrangers **non injectés normalement**.
- Marchand kobold + serviteur Moriquendi : **refus bloquant**.
- Négociant Moriquendi célèbre + serviteurs kobolds : seulement exception **nommée**, validée, `enabled:true`; pas de nouveauté canonique globale.
- Kharaz-Dûmel, **Mine du Filon Muet** : mineurs duergar et chariots cohérents; rares externes sous prétexte documenté, pas de tirage « peuple au hasard ».
- Enclos de rothés : bêtes, soigneurs, gardiens et accidents, pas de combat obligatoire.
- Ancienne ruine : échos, trace, charognards, explorateurs, pas un marchand aléatoire.
- Une zone `demo` : scènes pour test mais toujours étiquetée `DEMO_NOT_CANON`.
- Un lieu connu mais non localisé : préparation de rencontre possible sans faux pin.
- Une nuée ou un lézard : cases de grille correctes; aucune pièce d'or générée sans objet ingéré explicite.
- Un champ sans stats : marquer comme incomplet, ne pas inventer un CA/PV présenté comme canon.

## G. Livrables demandés lors de ton intégration

- Index réel exporté et rapport des classifications (totaux + corrections manuelles).
- Liste des conflits/provenances non résolus.
- Adapteur unique `creatureId ↔ statblockId` avec tests.
- Écran MJ « Rencontre » lié au panneau du lieu.
- Persistance des scènes résolues propre à l'univers/la campagne.
- Rapport des tests et captures du fonctionnement.
- Liste des prochaines améliorations (équilibrage, rencontres par heure, placements automatiques, économie).

**Ne pas modifier automatiquement le canon des Archives, ne pas inventer de coordonnées, ne pas réintroduire des rencontres avec Moriquendi subordonnés à des peuples étrangers, ne pas générer d'images ni appeler d'API payante pour ce chantier.**
