# Audit de l'existant (lot 0)

Audit en lecture seule, fait sur l'état du dépôt au commit `822e8c1`. Aucun fichier de `src/` n'a été modifié.
Les numéros de ligne renvoient à `src/App.jsx` sauf mention contraire.

## 1. Modèle de données du grimoire

Tout le grimoire est un seul objet `state`, géré par `reducer()` (l. 4776) et créé par `seedUniverse()` (l. 4752).
Chaque collection est un dictionnaire `{ [id]: objet }`. Les identifiants viennent de `uid()` (l. 4451) :
8 caractères en base 36, tirés de `Math.random()`.

| Collection | Identifiant | Rattachement | Champs image |
|---|---|---|---|
| `universes` | `uid()` | racine ; `archives` (lien vers le flux Underdark) | aucun |
| `characters` (héros) | `uid()` | `universeId` (posé par `ADD_CHARACTER`) | via `assets` (`targetType: 'player'`) |
| `campaigns` | `uid()` | `universeId` | aucun en direct |
| ↳ `acts[]` | `act-1`, `act-2`… (unique dans la campagne seulement) | campagne | aucun |
| ↳ `sessions[]` | `ses-1`… (unique dans la campagne seulement) | `actId` | aucun |
| ↳ `scenes[]` | `uid()` | `sessionNumber`, `actId` | aucun |
| `npcs` (PNJ et créatures) | `uid()` | `universeId` ; `campaignIds[]` (facultatif) ; `linkedSceneIds[]` | `token` (data URL WebP 256 px) ; portrait via `assets` (`npc` ou `creature`) |
| `quests` | `uid()` | `universeId` | aucun |
| `libraryEntries` | `uid()` ou `arc-<id>` (Archives) | `universeId` ; `linkedCampaignIds[]` | `imageSrc`, `imageSrcs[]` (chemins publics des Archives) ; images ajoutées via `assets` (`library`) |
| `assets` | `uid()` ou `arc-img-<hash>` | `universeId`, `targetType` + `targetId` | `dataUrl` : **data URL, chemin public ou URL https** selon `source` (`upload`, `generated`, `archives`, `srd`) |
| `maps` (`MapRecord`, `src/maps/mapStore.ts`) | `uid()` ; l'Atlas a l'identifiant fixe `atlas-profondeurs` | `universeId` | `image` (data URL JPEG ≤ 2000 px) ; `battle.tokens[].image` ; `overlay.party.apart[].image` |
| `chatThreads` | `uid()` | `universeId`, `campaignId` | aucun |
| `combat` | objet unique | aucun (global à l'appareil) | `combatants[].image` (copie de `npc.token`, l. 16224) |
| `log` | `uid()`, 200 entrées max | `universeId` | aucun |
| `activeUniverseId` | — | préférence de l'appareil | — |

Constats :

- Les campagnes ont `schemaVersion: 3` (`src/studio/migrate.js`). Les autres collections n'ont pas de version.
- Une suppression ne se propage pas. `DELETE_UNIVERSE` laisse ses campagnes, PNJ, cartes et images en place. `DELETE_NPC` laisse ses `assets`. Ces orphelins restent dans la sauvegarde.
- Le champ `asset.dataUrl` est ambigu. Il contient un chemin (`/images/...`) pour les Archives et le SRD, et une vraie data URL pour les imports et les images générées.

## 2. Points de lecture et d'écriture de l'état

### Grimoire (IndexedDB, `src/store/persist.js`)

- Base `loresmith`, version 1, magasin unique `kv`, clé unique `store` : tout le grimoire est un seul enregistrement.
- `loadState(STORE_KEY)` (l. 5131) : lit IndexedDB. En cas d'absence, lit l'ancienne clé localStorage `loresmith:store:v1`. Le résultat passe ensuite dans `HYDRATE`, puis dans `migrateState`.
- `saveState` (l. 5149-5170) : **réécrit tout l'objet** 400 ms après chaque changement d'état. En cas d'échec, il retombe sur localStorage. L'erreur de quota est affichée.
- `askPersistence()` est déjà appelée au démarrage (l. 5130), mais son résultat et l'espace utilisé ne sont pas affichés.
- `onupgradeneeded` crée `kv` sans condition. Passer en version 2 sans adapter ce code ferait échouer l'ouverture, car le magasin existe déjà (à traiter au lot 1).
- Import d'une sauvegarde (`handleImportFile`, l. 5203) : il remplace tout l'état après un `confirm()` et ne garde aucune copie de l'état précédent.
- Export (`exportBackup`, l. 5026) : un fichier JSON qui contient les images en base64.

### Clés `localStorage` et `sessionStorage` (préférences de l'appareil, hors grimoire)

| Clé | Fichier | Contenu |
|---|---|---|
| `loresmith:ai:v1` | `App.jsx` l. 4495, `src/ai/client.ts` | fournisseur, modèle, **clé API IA, clé ElevenLabs** |
| `loresmith:store:v1` | `App.jsx` | ancienne sauvegarde, lue seulement en reprise |
| `loresmith:forge-brief:v1` | `App.jsx` l. 6381 | brouillon de la Forge |
| `loresmith:bestiary-sel` | `App.jsx` l. 12430 | sélection du bestiaire |
| `loresmith:combat-side-map` | `App.jsx` l. 13203 | préférence d'affichage |
| `loresmith:narration-prefs:v1`, `loresmith:narration-history:v1` | `src/combat/narration/library.ts` | réglages et historique de narration |
| `loresmith:archives-url` | `src/feeds/underdark.ts`, `src/maps/MapsPage.tsx` | URL personnalisée des Archives |
| `loresmith:atlas-known:v1` | `src/maps/MapsPage.tsx` | lieux connus après synchronisation |
| `loresmith:table-map` | `src/maps/TableMap.tsx` | carte choisie |
| `loresmith:custom-stats:v1` | `src/maps/atlas/customStats.ts` | **fiches de créatures personnalisées** (donnée de jeu hors grimoire) |
| `loresmith:studio-tab` | `src/studio/CampaignStudio.jsx` | onglet actif |
| `loresmith:joueurs:deplacement`, `loresmith:joueurs:portee` | `src/present/PlayerScreen.tsx` | options de l'écran joueur |
| session : `loresmith:scene-campaign`, `loresmith:scene-id`, `loresmith:table-scroll` | `App.jsx` l. 9349, `TableMap.tsx` | position courante |

L'écran joueur passe par `BroadcastChannel('loresmith:stage:v1')` (`src/present/stage.ts`). Rien n'y est sauvegardé.

## 3. Données secrètes d'une campagne

Les secrets sont rangés **dans les mêmes objets** que les données publiques. Aucun champ ne les isole.

- **Campagne** : `dmOverview`, `finalTruth`, `failureState`, `campaignCanon`, `mindDump`, `acts[].secrets`, `majorLocations[].secrets`, `recurringNpcs[].secret`, `factions[].hiddenTruth`, `mysteries[].truth`, `librarySuggestions[].secrets`.
- **Scène** (`scenes[].expanded`) : `dmNotes`, `hiddenTruth`, `npcs[].secret`, `encounters` (tactiques, butin), `branches`, `skillChecks`, `clues`. Seul `readAloud` est destiné aux joueurs.
- **Bibliothèque** : `libraryEntries[].secrets`. Ces fiches appartiennent à l'**univers** et non à la campagne. Il faut donc décider qui voit ce champ (voir la question Q3).
- **Cartes** : `points[].secret`, `points[].notes`, `overlay.markers[].notes`, `markers[].groups` (rencontres), `revealed: false`. Les éléments de combat secrets se trouvent dans `battle.local`.
- **Fils de discussion IA** (`chatThreads`) : ils sont rattachés à une campagne et contiennent souvent des secrets.
- Le filtrage vers l'écran joueur existe déjà (`buildCustomAtlas(rec, dm)`, `playerBoard.ts`). Il sert de modèle, mais il ne s'applique qu'à l'affichage local.

Conséquence pour les lots 3 à 5 : pour que le serveur applique la règle « secrets visibles par le MJ et les co-MJ seulement », il faut soit séparer les secrets dans le schéma cible, soit filtrer les champs côté serveur selon une liste fermée. **Un filtrage dans le front ne suffit pas.**

## 4. Couplages entre domaines de `App.jsx`

Le fichier fait **17 849 lignes**, et non 13 000 comme l'indique `CLAUDE.md`.

| Lignes | Domaine | Dépendances | Extraction |
|---|---|---|---|
| 80-4450 | `STYLE` : CSS dans une chaîne (≈ 90 Ko) | aucune | **sans risque** |
| 4451-4750 | utilitaires, appels IA (`callAIMessages`), aides images (`fileToDataUrl`, `getPrimaryAsset`) | `ai` en paramètre | sans risque ; fait doublon partiel avec `src/ai/client.ts` |
| 4743-5040 | `seedUniverse`, `reducer`, `exportBackup` | `uid`, `now`, `migrate.js` | **sans risque**, fonctions pures. C'est le point d'ancrage des lots 1, 2 et 5 |
| 5075-5470 | `App` : hydratation, sauvegarde, routage | tout | à garder ; on n'y touche que pour brancher les nouveaux modules |
| 5635-6750 | tableau de bord, cerveau d'univers, Forge | IA, état complet | couplé (lit tout `state`) |
| 6748-8412 | cartes de campagne, scènes | `dispatch`, IA, PNJ | couplé |
| 8413-9332 | Chat IA | campagnes, scènes, IA | couplé |
| 9333-10619 | `SceneRunner` | PNJ, scènes, voix | couplé |
| 10620-11640 | Bibliothèque | `assets`, IA, Archives | moyen |
| 11641-11944 | `AssetManager` (téléversement, génération d'images) | `assets` | **cible du lot 1** |
| 11945-12436 | groupe, import PDF | `assets`, `pdfjs` | moyen |
| 12437-13101 | Bestiaire, portraits (`assignPortrait`) | `assets`, `npcs`, `makeToken` | **cible du lot 1** |
| 13102-16164 | combat (`Encounter`, `War*`, panneaux) | cartes, PNJ, narration | fortement couplé |
| 16165-17460 | aides de combat pures (`parse*`, `normalize*`, `buildCombatStrategy`) | aucune (0 hook, 0 JSX) | **sans risque** |
| 17461-17849 | quêtes, `Conjure` | `dispatch` | faible |

Le contexte React `AIContext` et l'objet `state` complet sont passés en props un peu partout. Pour les lots cloud, il suffit d'extraire `reducer` et `seedUniverse`, ainsi que les aides images. Le reste peut attendre.

## 5. Poids estimé des images en base64

Estimation tirée du code, pas de données réelles. Le base64 ajoute environ 37 % au poids binaire.

| Source | Chemin dans le code | Traitement | Poids estimé dans l'état |
|---|---|---|---|
| Image téléversée dans la bibliothèque, l'`AssetManager` ou un portrait de héros | `fileToDataUrl` (l. 11139, 11731, 12019) | **aucune compression** | 1 à 7 Mo par photo |
| Image générée (`gpt-image-1`, 1024 px) | `generateOpenAIImage` (l. 11604) | **PNG brut** | 2 à 3,5 Mo |
| Portrait généré ou téléversé dans le bestiaire | `generatePortrait`, `fileToCompressed` (`src/media/images.js`) | WebP 768 px, qualité 0,85 | 60 à 150 Ko |
| Jeton de PNJ | `makeToken` | WebP 256 px | 15 à 25 Ko, **copié** dans `combat.combatants[].image` et `maps[].battle.tokens[].image` |
| Fond de carte personnalisée | `imageFileToDataUrl` (`mapStore.ts`) | JPEG 2000 px, qualité 0,86 | 0,5 à 1,6 Mo |
| Images des Archives, images SRD | `IMPORT_ARCHIVE_ENTRIES`, `tokenImage` | chemin public | négligeable |

Ordre de grandeur : 20 portraits téléversés, 5 images générées et 3 cartes donnent environ 40 à 80 Mo. Ce bloc est recopié dans IndexedDB toutes les 400 ms dès que l'état change, même pour une seule frappe au clavier. C'est le premier problème de performance, avant même la question du cloud.

`public/` pèse 127 Mo pour 600 fichiers. Il contient déjà 476 WebP, mais aussi 82 PNG et JPG qui totalisent 61,6 Mo : les textures de combat font 3 à 4 Mo pièce, et `encyclopedie/` en contient aussi. S'y ajoute `public/feeds/underdark.json`, qui pèse 8,5 Mo.

## 6. Risques et questions ouvertes

### Risques

1. **Migration IndexedDB v1 vers v2** : `onupgradeneeded` doit tester `objectStoreNames` avant de créer un magasin, sinon l'ouverture échoue et l'application retombe sur localStorage, qui sature aussitôt.
2. **Ambiguïté de `asset.dataUrl`** : la migration du lot 1 ne doit convertir que les valeurs qui commencent par `data:`. Les chemins et les URL ne doivent pas être touchés.
3. **Import destructeur** : l'import actuel remplace tout sans sauvegarde préalable, ce qui contredit la règle 9. Le lot 2 doit faire une copie avant d'importer.
4. **Orphelins** : sans propagation des suppressions, la synchronisation enverrait des campagnes et des images sans univers.
5. **Identifiant fixe de l'Atlas** (`atlas-profondeurs`) : `maps` est indexé par identifiant, donc il ne peut y avoir qu'un seul Atlas pour tous les univers. Le partage d'un univers provoquerait une collision.
6. **Identifiants `act-1` et `ses-1`** : ils ne sont uniques que dans leur campagne. Le schéma cible doit les garder imbriqués, ou les préfixer.
7. **`uid()` non cryptographique** : il suffit en local. Côté serveur, il faudra `crypto.randomUUID()`, et le serveur ne devra jamais se fier à un identifiant fourni par le client pour décider d'un droit.
8. **Clés d'IA** : elles sont hors du grimoire, donc absentes de l'export, et c'est bien. Il faut le garantir par un test aux lots 2 et 5.
9. **Fiches personnalisées dans `loresmith:custom-stats:v1`** : elles sont hors du grimoire, donc ni exportées ni synchronisées. Elles seront perdues en changeant d'appareil.
10. **Taille du bundle** : `index` pèse 1,1 Mo et `world.offscreen` 1,4 Mo. Le plan gratuit de Cloudflare Pages tolère des fichiers jusqu'à 25 Mo, donc ce n'est pas bloquant, mais le chargement hors ligne en souffre.
11. **Tests** : `npm test` ne lance qu'un fichier (`narrator.test.mjs`, 14 tests). Le script doit être élargi au lot 1, ce qui implique de modifier `package.json`.

### Questions ouvertes

- **Q1** : `state.combat`, `log`, `chatThreads` et `activeUniverseId` restent-ils propres à l'appareil, sans synchronisation ? Proposition : oui pour `combat` et `activeUniverseId` ; `chatThreads` suivrait la campagne, secrets compris.
- **Q2** : les fiches personnalisées (`custom-stats`) doivent-elles entrer dans le grimoire, et donc dans l'export et la synchronisation ?
- **Q3** : un lecteur ou un contributeur de l'univers voit-il le champ `secrets` des fiches de bibliothèque ? Proposition : seuls le propriétaire et les éditeurs le voient.
- **Q4** : les PNJ et les créatures appartiennent-ils à l'univers (état actuel) ou à une campagne ? Le champ `campaignIds` existe déjà, mais il est facultatif.
- **Q5** : faut-il garder un historique des versions côté serveur (pour annuler une synchronisation), ou seulement la dernière version accompagnée d'un numéro ?
- **Q6** : les images des Archives (chemins `public/`) restent-elles réservées à l'univers Underdark, ou sont-elles proposées à tous les univers partagés ? Cela touche aussi aux licences (voir PLAN, section 6).

## 7. Plan détaillé des lots 1 à 7

### Lot 1 : images hors de l'état

- **Fichiers** :
  - `src/store/persist.js` (zone à risque) : passage en version 2, création conditionnelle des magasins, nouveau magasin `images` ;
  - nouveau `src/store/images.js` : `putImage`, `getImage`, `deleteImage`, `usage`, et un cache d'`objectURL` ;
  - nouveau `src/store/migrateImages.js` (pur) : il parcourt l'état, remplace chaque valeur `data:` par `imageId` et retourne la liste des Blob à écrire ;
  - `src/media/images.js` : `compressImage` renvoie un Blob, avec des préréglages `portrait` (512 px) et `carte` (1600 px) ;
  - `src/maps/mapStore.ts` : `imageFileToDataUrl` passe en Blob et en WebP ;
  - `src/App.jsx` (zone à risque) : les quatre appels à `fileToDataUrl`, `generateOpenAIImage` et `assignPortrait` passent par `putImage`, et les lectures passent par un composant ou un hook `useImage(id)`.
- **Champs migrés** : `assets[].dataUrl` (seulement les `data:`), `npcs[].token`, `maps[].image`, `maps[].battle.tokens[].image`, `maps[].overlay.party.apart[].image`, `combat.combatants[].image`.
- **Ordre sûr** : sauvegarder l'état actuel sous une clé `store-backup-v1`, écrire les Blob, vérifier qu'ils se relisent, écrire le nouvel état, et ne supprimer les anciennes copies qu'ensuite. Cette procédure est réversible.
- **Tests** (`node --test`) :
  - migration d'un état fictif contenant les six sortes de champs, sans aucune perte ;
  - chemins et URL laissés intacts ;
  - migration idempotente ;
  - choix des dimensions de compression (fonction pure).
- **Critères** : la sauvegarde ne contient plus aucune chaîne `data:image` ; l'affichage est inchangé ; l'espace utilisé est visible dans Réglages.

### Lot 2 : export et import ZIP

- **Fichiers** : nouveau `src/store/archive.js`, avec `exportZip(scope)` et `importZip(file)` ; branchement sur `exportBackup` et `handleImportFile` dans `App.jsx` ; ajout de `jszip` (accord à demander).
- **Format** : `manifest.json` (version, portée, date), `grimoire.json`, `images/<imageId>.webp`. L'import d'un ancien fichier `.json` reste accepté.
- **Règles** : faire une copie de l'état avant l'import, choisir entre fusionner et remplacer, et régénérer les identifiants en cas de collision.
- **Tests** :
  - aller-retour entre l'état et le ZIP, puis retour à l'état, à l'identique ;
  - export d'un univers seul, sans ses voisins ;
  - aucune clé `loresmith:ai:v1` dans l'archive ;
  - un import en fusion n'écrase rien sans le signaler.

### Lot 3 : schéma et permissions

- **Fichiers** : `src/shared/schema.js` (tables cibles et liste fermée des champs secrets par entité, à partir de la section 3), `src/shared/policy.js` (`can(user, action, resource)`), `src/shared/redact.js` (retire les champs secrets selon le rôle), et leurs tests.
- **Tests** : une matrice qui croise les rôles (4 rôles d'univers, 2 rôles de campagne, plus un anonyme) avec les actions (`read`, `edit`, `delete`, `share`, `readSecrets`), avec tous les cas refusés ; `redact` vérifié sur chaque champ de la section 3.

### Lot 4 : backend

- **Fichiers** : `server/` (Worker, routeur, Better Auth), `server/migrations/0001_init.sql`, `wrangler.toml`, `wrangler` en dépendance de développement ; le serveur importe `src/shared/policy.js`.
- **Tables** : `users`, `universes`, `universe_members`, `campaigns`, `campaign_members`, `documents` (JSON par entité, `version`, `updated_at`), `images` (clé R2, propriétaire).
- **Tests** : `wrangler dev` local, une migration appliquée sur D1 local, une réponse 401 sans session, et une réponse 403 quand un rôle est insuffisant.

### Lot 5 : synchronisation

- **Fichiers** : nouveau `src/sync/` (file d'attente des envois, `version` par document, résolution des conflits 409), indicateur d'état dans `Shell.jsx`.
- **Règles** : une synchronisation par document (univers, campagne, entité), et non de tout l'état ; les orphelins exclus (risque 4) ; l'appareil local reste la référence.
- **Tests** : deux clients simulés qui modifient le même document reçoivent une réponse 409 et choisissent une version ; une modification faite hors ligne est rejouée au retour du réseau.

### Lot 6 : partage

- **Fichiers** : `server/` (routes d'invitation, envoi par Resend), écran « Membres » dans le front.
- **Tests** : une invitation expirée est refusée ; une personne sans compte en crée un puis accepte ; un rôle retiré renvoie 403 dès la requête suivante.

### Lot 7 : durcissement

- **Fichiers** : tâche planifiée du Worker (`cron`) qui exporte D1 vers R2, journalisation structurée, `docs/cloud/CONFORMITE.md`, tests de bout en bout avec Playwright (déjà présent dans l'environnement).
- **Tests** : une restauration depuis une sauvegarde vers une base D1 locale vide ; un parcours complet (inscription, création, partage, lecture par un co-MJ, refus pour un lecteur).
