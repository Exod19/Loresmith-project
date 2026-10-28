# Campaign Studio V3 — Lot 0 : audit du dépôt réel

Ce document fait l'état des lieux du code avant toute modification, comme le demande le cahier des charges
(section 13). Il sert de référence pour les lots suivants. Rien dans le code n'a été modifié pour ce lot.

Références : `CAHIER_DES_CHARGES_V3.md`, `PROMPT_CLAUDE_CODE_V3.md` et la maquette `campaign-studio-v3.html`
(dossier Drive « LoreSmith_Campaign_Studio_V3 »).

---

## 1. Ce qu'il faut retenir

- **Le terrain est bon.** Les campagnes ont déjà des séances, des scènes à identifiant stable, des PNJ et créatures
  partagés (`state.npcs`), une bibliothèque, des cartes avec rencontres, une persistance IndexedDB et un export JSON.
  V3 peut se construire **par-dessus** sans casser les campagnes existantes.
- **Il manque surtout la structure.** Aujourd'hui, une scène est un bloc de texte enrichi (`scene.expanded`).
  Il n'y a ni sorties, ni conditions, ni références de ressources, ni état de préparation calculé.
  C'est le cœur des lots 1 à 3.
- **La maquette n'est pas à la charte Loresmith.** Elle utilise des tons vert-charbon, une autre typographie et une
  seconde barre latérale « Campaign Studio V3 ». Le studio sera intégré dans le shell Loresmith existant, avec ses couleurs
  et ses polices (voir section 6).
- **`src/App.jsx` fait ~17 000 lignes.** Tout le code V3 ira dans un dossier `src/studio/`, branché à App par une seule vue.

---

## 2. Inventaire des modules et points de raccordement

| Module (cahier) | Où dans le code | Ce qu'il fait aujourd'hui | Raccordement V3 |
|---|---|---|---|
| Navigation / shell | `src/shell/Shell.jsx` (`NAV`), `App.jsx` (`view`) | Barre latérale par moment d'usage ; vue `forge` = « Campagnes » | La vue `forge` devient Campaign Studio. Le studio a sa navigation secondaire **dans** la page, pas une seconde barre latérale |
| Generator / Campaigns | `App.jsx` : `Forge`, `CampaignCard`, `SceneRow`, `EditableText`, `writeCampaignSession` ; `src/forge/campaignPipeline.js` | Brief à champs « IA décide », bible, écriture séance par séance, liste des campagnes | Le brief devient les **Fondations** (6 étapes). Bible et séances restent les moteurs de génération du Scribe |
| Lore par scène / séance | `src/forge/LoreEditor.jsx`, `src/forge/loreGen.js` (branche `claude/nifty-brown-7f5jch`, pas encore dans `main`) | Rubriques PNJ, dialogues, rencontres, DD, environnement, indices, butin, à la main ou par l'IA | Devient la base du **dossier de scène** (Lot 3). À fusionner avant de commencer |
| Universe Builder | `App.jsx` : `UniverseBrainPanel`, `universe.lore`, `universe.memoryLog`, `universe.loreSuggestions` | Canon, mémoire vivante, sections structurées | **Source de vérité** : lu par le Scribe via `src/ai/loreContext.js`, jamais écrit par le studio sans approbation |
| Library | `App.jsx` : `Library`, `LibraryEntryEditor` ; `src/library/Dossier.jsx` ; `state.libraryEntries` | Fiches (lieux, personnages, factions, mystères…), connaissances joueurs graduées par DD, images | Registre : lieux, mystères, documents joueurs = références `libraryEntries[id]` |
| Archives | `src/feeds/underdark.ts`, `ArchivesPage.tsx` | Canon publié de l'Underdark, importé dans la bibliothèque | Canon en lecture seule ; jamais modifié |
| NPCs & Monsters | `App.jsx` : `Bestiary`, `BestiaryEditor` ; `src/bestiary/` ; `state.npcs` | Fiches 5e complètes, portraits, jetons, SRD | Registre : **une fiche par PNJ ou type de créature** (`npcs[id]`). Les apparitions en scène sont des références, pas des copies |
| Party | `App.jsx` : `Party`, `state.characters` | Personnages joueurs (niveau, classe, PV, CA…) | Fondations : composition et niveau du groupe ; leur changement invalide les rencontres |
| Combat | `App.jsx` : `Encounter` (`state.combat`) ; `src/maps/battle/*` | Deux systèmes : tracker de combat historique, et carte de combat avec jetons | Lot 5 seulement. Contrat : `monsterType` = `npcs[id]` → groupe → instances → jetons (`BattleToken`) |
| Cartes | `src/maps/*`, `state.maps` | Atlas, cartes perso, repères, rencontres, guide de campagne invoquée | Le guide (`CampaignGuide.tsx`) lit les scènes ; il lira les sorties et les lieux structurés de V3 |
| Scene Runner | `App.jsx` : `SceneRunner` | Console de jeu : scène active, dialogues, tests, entités | Lot 7. État joué distinct de la préparation |
| Images / Conjure | `App.jsx` : `AssetManager`, `Conjure` ; `src/media/images.js` ; `state.assets` | Images liées par `targetType/targetId`, génération OpenAI / Pollinations | Registre : illustrations `optional` par défaut, `required` sur déclaration du MJ |
| Persistance | `src/store/persist.js`, `App.jsx` (`HYDRATE`, export / import) | IndexedDB, reprise de l'ancienne clé localStorage, sauvegarde JSON | Migration versionnée des campagnes au chargement **et** à l'import |
| IA | `App.jsx` : `callAI`, `callAIMessages` ; `src/ai/json.js`, `src/ai/loreContext.js` | Appels compatibles OpenAI, JSON réparé si tronqué, contexte de lore | Le Scribe réutilise cette couche, avec des réponses en **brouillons** à approuver |

### Actions du reducer existantes

`ADD/UPDATE/DELETE` pour univers, personnages, campagnes, scènes (`UPDATE_SCENE`), PNJ, quêtes, assets, fiches de
bibliothèque, cartes, fils de discussion ; plus `IMPORT_ARCHIVE_ENTRIES`, `COMBAT_SET`, `ADD_LOG`, `HYDRATE`.
`UPDATE_CAMPAIGN` et `UPDATE_SCENE` font des fusions superficielles : suffisant pour V3, à condition de passer des
objets complets pour les sous-structures.

---

## 3. Modèle actuel d'une campagne

```js
campaign = {
  id, universeId, title, premise, hook, setting, createdAt,
  campaignMode,            // 'oneshot' | 'short' | 'arc' | 'long' (anciennes : 'short' | 'long')
  brief,                   // champs du brief (titre, thème, conflit, lieux…), hours, level, sessions
  campaignCanon, dmOverview, finalTruth, failureState, campaignThemes, campaignQuestions,
  acts: [{ title, summary, purpose, openingBeat, turningPoint, finale, secrets, consequences }],   // pas d'id
  sessions: [{ sessionNumber, act, title, summary, mainGoal, mainLocation, scenes: [plan],
               detailed, dmBrief, recap, cliffhanger, npcs?, encounters?, clues? }],
  scenes: [{ id, title, type, summary, sessionNumber, location, outline?,
             expanded: { setting, readAloud, purpose, dmNotes, sensoryDetails, hiddenTruth,
                         guidance[], nextLocation, npcs[], dialogues[], encounters[{ creatures[] }],
                         skillChecks[], envChecks[], clues[], branches[], loot[], … } }],
  recurringNpcs, factions, majorLocations, mysteries, monsters,   // texte de la bible, pas des références
  librarySuggestions, linkedLibraryEntryIds,
  memoryLog, brainScratch,
  progress: { sceneId, done[] },   // état JOUÉ (guide de la carte) — déjà distinct de la préparation
}
```

Les anciennes campagnes (avant la Forge en plusieurs passes) n'ont ni `sessions`, ni `brief`, ni `scenes[].sessionNumber`.

---

## 4. Écarts entre l'existant et V3

| Exigence V3 | État actuel | Lot |
|---|---|---|
| Actes, séances, scènes reliés par identifiants | Actes sans id ; scènes liées aux séances par numéro | 1 (migration) |
| Centre de commandement avec vrais compteurs | Liste de cartes de campagne, barre « séances écrites » | 1 |
| Fondations guidées, une question à la fois | Brief en 17 champs groupés, sur un seul écran | 1 |
| Préparation calculée depuis l'état réel | Aucune ; seulement `detailed` par séance | 1 (compteurs), 6 (preflight) |
| Préparation ≠ progression jouée | Déjà séparées (`progress` vs contenu), mais non nommées | 1 |
| Graphe : entrées, sorties, conditions, plan B | `branches[]` et `guidance[]` en texte libre | 2–3 |
| Fils narratifs, matrice, tension | Absents | 2 |
| Registre de ressources (références, pas copies) | PNJ de scène = texte ; créatures de rencontre = noms | 4 |
| Type de monstre → instances → jetons | Fiches uniques (`npcs`) et jetons existent ; pas d'instances par scène | 5 |
| Budget de rencontre déterministe 2014 / 2024 | Absent ; FP seulement | 5 |
| Brouillons IA approuvables (source / faits / propositions / inconnus) | L'IA écrit directement dans la campagne | 1 (règle), 4 (registre) |
| Invalidations (niveau, édition, révélation modifiée) | Absentes | 1 (niveau/édition), 6 |
| Audit, répétition générale, instantané scellé | Absents | 6 |
| Dossier MJ imprimable, pack joueurs sans secrets | Export JSON du grimoire seulement | 6 |

---

## 5. Données V3 proposées (adaptées au reducer existant)

Principe : **on enrichit l'objet campagne existant**, on ne crée pas de registre concurrent. Les PNJ, créatures,
fiches et cartes restent dans `state.npcs`, `state.libraryEntries`, `state.maps`, `state.assets` ; la campagne n'en
garde que des références.

```js
campaign = {
  ...champs existants,
  schemaVersion: 3,
  foundations: { world, spark, players, conflict, opening, canvas,          // 6 étapes (texte du MJ)
                 skipped: [], edition: '2014' | '2024' | 'other',
                 partyIds: [], partyCount, partyLevels: [] },
  acts:     [{ id, title, summary, … }],                                       // id ajouté par la migration
  sessions: [{ id, sessionNumber, actId, title, targetMinutes, … }],           // id ajouté par la migration
  scenes:   [{ id, actId, sessionNumber, …,
               required: true | false, importance: 'essential' | 'optional' | 'conditional',
               timeEstimate: { min, likely, max },
               entry: [Condition], exits: [{ targetSceneId, conditions, fallback }],
               options: [{ id, approach, response, consequences, nextSceneIds }],
               fallback: '',
               resourceRefs: [{ kind: 'npc' | 'creature' | 'place' | 'map' | 'document' | 'trap' | 'clue',
                                refId, role, required, count }],
               prepReview: { state: 'idea' | 'planned' | 'detailed' | 'verified' | 'ready',
                             reviewedRevision, reviewedAt },
               revision }],
  threads:  [{ id, label, kind, stageBySceneId: { [sceneId]: 'introduced' | 'developed' | 'turned' | 'resolved' } }],
  variables: [{ id, label, initial }],                                          // alarmRaised, survivorsRescued…
  drafts:   [{ id, scope, sourceKind, sourceExcerpt, proposal, status: 'pending' | 'accepted' | 'rejected' }],
  audit:    { revision, ranAt, blockers: [], warnings: [] },
  snapshots: [{ id, revision, sealedAt, audit }],                               // immuables
  designRevision,
}
```

- **Calcul de la préparation** : fonctions pures dans `src/studio/prep.js` (`sceneHasEntryAndExit`,
  `sceneHasPreparedFallback`, `requiredResourcesExist`, `encounterRulesValid`…). Les compteurs et l'audit en
  découlent ; aucune case cochée ne suffit seule.
- **Actions** : on garde `UPDATE_CAMPAIGN` et `UPDATE_SCENE`. On ajoute seulement `SEAL_CAMPAIGN_SNAPSHOT`
  (instantané immuable) au Lot 6. Les invalidations sont calculées par le studio et écrites via `UPDATE_CAMPAIGN`.
- **Révisions** : chaque modification de scène incrémente `scene.revision` ; une scène vérifiée à une révision
  antérieure redevient « à revoir ». Pas de revalidation automatique.

### Migration

`migrateCampaign(c)` (pure, idempotente) dans `src/studio/migrate.js`, appelée au chargement (`HYDRATE`) et à
l'import de sauvegarde :

1. `schemaVersion` absent → 3 ; rien n'est supprimé.
2. Actes et séances reçoivent un `id` stable ; les scènes reçoivent `actId` d'après la séance, sinon aucun.
3. Ancien brief → `foundations` (monde = univers, étincelle = thème, conflit = conflit central…).
4. Scènes : `prepReview.state` = `detailed` si elles ont du contenu, sinon `idea` ou `planned`. **Jamais `verified`.**
5. Champs inconnus laissés vides ou marqués inconnus, jamais inventés.
6. Les anciennes campagnes sans séances reçoivent une séance 1 qui regroupe leurs scènes.

---

## 6. Adapter la maquette à la charte Loresmith

| Maquette ChatGPT | Loresmith (à garder) |
|---|---|
| Fond vert-charbon, panneaux verdâtres | Fond `--bg #0b0906`, panneaux `--panel` / `--panel-2` (brun-noir), filets `--line` dorés |
| Laiton `#c8a96a` approximatif | Or Loresmith : `--gold #c9a24a`, `--gold-lt`, `--gold-dk` |
| Titres en serif léger, corps en sans-serif | **Cinzel** pour les titres et libellés, **EB Garamond** pour le texte, Spectral pour le texte à lire |
| Seconde barre latérale « Campaign Studio V3 » | Shell Loresmith inchangé ; navigation du studio en **onglets dans la page** |
| Encart « Texte du MJ » sur parchemin clair | Garder l'idée, avec le style parchemin déjà utilisé (fiches 5e, passage à lire de la bibliothèque) |
| Scribe en colonne droite | Garder : colonne droite sur grand écran, sous la surface principale sur mobile |
| Statuts couleur | Statuts Loresmith : or (prêt), braise (à préparer), sang (bloquant), turquoise (brouillon IA), avec un libellé texte |

Le vocabulaire de la maquette est conservé (Centre de commandement, Fil de campagne, Dossiers des scènes,
Registre, Avant la séance 1, Fondations, Le Scribe), avec le logo et l'emblème Loresmith existants.

---

## 7. Plan du Lot 1 (prochaine livraison)

**Fichiers** : `src/studio/CampaignStudio.jsx` (coquille, onglets, Scribe), `CommandCenter.jsx`, `Foundations.jsx`,
`prep.js`, `migrate.js`, `studio.css`. Dans `App.jsx` : la vue `forge` affiche le studio ; migration au chargement
et à l'import.

**Contenu** :
1. Sélecteur de campagnes + « Nouvelle campagne » (part des Fondations).
2. Centre de commandement : en-tête de campagne, 4 compteurs réels (scènes prêtes, préparation générale, séances
   planifiées, travail restant), trajectoire actes → scènes (cliquables), prochaines actions utiles triées par risque,
   plan des séances avec durées et marge, mention claire « Lancement verrouillé » tant que tout n'est pas prêt.
3. Fondations en 6 étapes (une question à la fois, « Propose une piste », « Je déciderai plus tard »), reliées au
   groupe (Party) et à l'édition ; changer le niveau ou l'édition marque les rencontres « à revoir ».
4. Les vues Fil, Dossiers, Registre et Avant la séance 1 sont présentes dans la navigation et affichent l'existant
   (scènes, lore) en attendant leurs lots ; la Forge en plusieurs passes reste disponible depuis les Fondations.

**Hors Lot 1** : graphe et matrice (Lot 2), éditeur de dossier complet (Lot 3), registre et brouillons (Lot 4),
combat (Lot 5), audit / export (Lot 6), Scene Runner (Lot 7).

---

## 8. Points à trancher avant le Lot 1

1. **Fusion préalable** : le lore par scène et par séance (`cb9ed41`) est sur `claude/nifty-brown-7f5jch`, pas dans
   `main`. Le studio s'appuie dessus ; il faut le fusionner d'abord.
2. **Édition par défaut** : 2014 (SRD 5.1 déjà dans le code) ou 2024 ?
3. **Durée cible par séance** : 3 h par défaut, avec 20 à 40 min de marge, comme dans le cahier ?
4. **Ancienne Forge** : la garder accessible comme « génération rapide » dans les Fondations (recommandé), ou la retirer ?
