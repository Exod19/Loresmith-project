# LoreSmith / Fléau — Atlas Underdark : inventaire, classification et association des rencontres

**Version :** 1.0 — 28 octobre 2026  
**Statut :** document autonome demandé pour les lieux, accompagné de deux scripts exécutables et d'une intégration navigateur.  
**Objet :** exploiter les identifiants **existants** de l'Atlas de navigation; ne pas recréer de carte, dessiner des villes inventées ou déduire des coordonnées inconnues.

## 1. Sources réelles examinées

Dépôt GitHub : `Exod19/Fl-au-Bestiaire`, branche de référence lue : `claude/underdark-encyclopedia-gp0j59`. Le script doit être lancé **dans une copie à jour de cette branche**, ou dans la branche réellement utilisée par Claude si elle a évolué.

| Source | Ce qu'elle contient | Rôle dans le classificateur |
|---|---|---|
| `src/atlas/data.ts` | Objet `ATLAS` final, niveaux, strates, espaces, cartes, points, géométries, ancres, connexions | **Source runtime des lieux de l'Atlas**; import après enrichissement. |
| `src/atlas/types.ts` | `AtlasFeature`, `AtlasSpace`, `AtlasMap`, `AtlasGeometry`, `AtlasConnection`, `PlacementStatus`, `CanonStatus` | Typage et traçabilité. |
| `src/atlas/procedural.ts` | Centaines/milliers de repères potentiels, **explicitement de démonstration** | Classifier pour jeu/test; **jamais promouvoir au canon**. |
| `src/atlas/hostenValak.ts` | Cartes détaillées de Hosten Valak en paliers, noms de quartiers, ponts, marchés, gouffres | Classification fine, avec signalement des différences de provenance. |
| `src/atlas/cities.ts` | Import `atlas-cite-v1`, publication et chargement des cités | Identifier lieux ajoutés par l'éditeur, y compris les paliers. |
| `public/data/cites/index.json` | Index des cités publiées | Lire les JSON listés, pas simplement les deux cités trouvées à date. |
| `public/data/cites/khordun.json` | Khordun, cité duergar de forge/mines, statut `creation` | Exemple de cité en développement. |
| `public/data/cites/kharaz-dumel.json` | Kharaz-Dûmel, cité duergar à sept paliers, statut `creation` | Exemple de centaines de lieux à classifier individuellement. |
| `src/atlas/encounters.ts` | Ancien moteur de rencontres `rollEncounter` limité aux zones sauvage/transit/cité | **Conserver** et prévoir migration/bridge; ne pas écraser sans vérification. |
| `src/atlas/statblocks.ts` | Blocs statistiques associés à des IDs historiques | Compatibilité avec la banque `underdark_...` à mettre en place. |
| `Tome_II_Les_Domaines_Moriquendi` et `Fiches_Encyclopediques_Tome_II.md` | Géographie politique, cinq Palissades, Royolo, restrictions Moriquendi | **Autorité sur le canon**; distingue statut du lieu et statut de sa localisation. |

**Remarque :** les données courantes du dépôt ont été **inspectées**, mais la compilation d'un inventaire intégral n'a pas été exécutée contre ce dépôt privé dans cette livraison. Le script livré exécutera cette indexation sur la copie locale disponible à Claude Code. Le fichier d'exemple est un **test**, pas une liste exhaustive ou une exportation canonique.

## 2. Les lieux confirmés et leur statut géographique

| Lieu | Peuple / clan | Position confirmée | Rencontres typiques proposées |
|---|---|---|---|
| **Ozzoloh Ventreen** | Moriquendi / **Norrianiss** | Au nord du Grand niveau I, dans une strate profonde; numéro et coordonnées inconnus. | Étudiants interclaniques, guildes, gardes, responsables de formation, négociants Moriquendi, archivistes. |
| **Hosten Valak** | Moriquendi / **Warral** | Tome II : pas de localisation précise. Atlas : cité dite « du sud » et cartes de paliers; provenance à revoir, aucun Grand niveau inventé. | Portiers, gardes, ateliers, marché avec marchands Moriquendi, pèlerins, dignitaires. |
| **Dasnogood** | Moriquendi / **Iznogood** | Non localisée dans les sources de référence. | Groupes Moriquendi génériques correspondant à la fonction d'une capitale, sans inventer une économie spécialisée. |
| **Gualidurth** | Moriquendi / **Bois-de-l'Est** | Non localisée. | Patrouilles, civils, commerce interne et vie de quartier; aucune géographie arbitraire. |
| **Gjertet** | Moriquendi / **Drehjur** | Non localisée; sa perte et sa récupération sont confirmées. | Gardes, résidents, pèlerins éventuels; ne pas inventer le responsable de la reconquête. |
| **Avant-poste de Royolo** | Moriquendi, clan non fixé ici | Unique avant-poste **à la surface**, coordonnées inconnues. | Surveillants, messagers, reconnaissance et signaux de menace; circulation étrangère rare. |
| **Bibliothèque centrale d'Ozzoloh Ventreen** | Moriquendi / Norrianiss | À Ozzoloh; position interne inconnue. | Archivistes, scribes, chercheurs, gardes, lecteurs Moriquendi. |

`Ventreen` n'est **pas un clan**. Hosten Valak et Ozzoloh Ventreen ne doivent pas être forcées dans la grille `n1-strate-1...5` simplement pour rendre la carte plus remplie.

### Cités duergar actuellement publiées dans la branche examinée

**Khordun, la Forge-Grise** (`cite-khordun`) est une cité `creation`, indiquée en strate I-4 de manière approximative. Des lieux précis sont documentés par son JSON, par exemple Porte de Fer-Noir, Bureau des Poids, Enclos des rothés, Grande Forge du Clan Thrum, Fonderie des Chaînes, Puits de trempe, Galeries d'adamantite. Les rencontres appropriées sont différentes pour chacun : contrôles, commerçants, éleveurs, forgerons, mineurs, prisonniers ou personnel du chantier.

**Kharaz-Dûmel, la Cité des Sept Portées** (`cite-kharaz-dumel`) est aussi `creation`, approximativement associée à I-3 par son fichier. Elle contient des paliers/lieux nommés : Galerie des Arrivants, Hall des Poids Étrangers, Marché des Sept Marteaux, Quai des Palans, Bourse des Contrats, Maison des Soigneurs, Grande Forge du Cœur-Rouge, Terrasses des Champignons, Mines du Filon Muet, etc. Le générateur doit indexer **chaque `paliers[].lieux[]`**, pas attribuer la même table de rencontres à toute la ville.

**Aucune de ces créations duergar ne devient canon Moriquendi simplement parce qu'elle figure dans l'Atlas.** Leur statut est conservé dans l'export.

## 3. L'Atlas est plus qu'une liste de villes

Le script parcourt :

1. **`ATLAS.features`** : tous les marqueurs, zones, titres, lieux, chemins significatifs.
2. **`ATLAS.maps`** : cartes comme contextes géographiques (une carte n'est pas un point géolocalisé).
3. **`ATLAS.spaces`** : sites, secteurs, paliers et entre-strates.
4. **`ATLAS.strata`** : contextes par couche, sans leur attribuer un peuple propriétaire par défaut.
5. **`ATLAS.connections`** : ponts, passages, puits, portails, ascenseurs, sens de circulation et dangers.
6. **`public/data/cites/index.json` et chaque cité `atlas-cite-v1`** : paliers et lieux de la ville.
7. **`--drafts-dir` (option)** : export préalable des brouillons locaux que Claude aura accès à exporter depuis l'Atelier; ils restent marqués `local_draft`.
8. **Lieux canoniques connus mais non localisés** : apparaissent dans l'index, sans coordonnées fictives.

### Règle géographique non négociable

`sourceStatus` et `placementStatus` ne sont pas interchangeables. Une cité peut **exister dans le canon** mais **ne pas être géolocalisée**. `demo:true`, `placementStatus:'illustrative'`, ou un plan vectoriel interne ne constituent jamais des coordonnées réelles. Le statut `creation` représente du contenu de travail. Les points de l'Atlas `documented` ne deviennent pas pour autant documentés si leur géométrie n'est pas confirmée.

Les références spatiales restent les **IDs originaux** (`feature.id`, `space.id`, `map.id`, `connection.id`), jamais la simple chaîne du titre. Deux lieux peuvent porter le nom « Mine de test » sans être le même site.

## 4. Taxonomie des lieux et tables de rencontre associées

Fichier central : `data/location-taxonomy.v1.json`. Les indices sont cumulables; « Mine duergar au bord d'une rivière » peut recevoir `mine + aquatic + route + owned:duergar`, ce qui produit une combinaison de rencontres plutôt que de tirer l'un des quatre contextes au hasard.

| Type / tags | Rencontres admissibles | Exclusions ou garde-fous |
|---|---|---|
| `market` / bazar / bourse / auberge | Marchands, gardes de boutique, porteurs, convoyeurs, négociation, vol | Pas de prédateurs aléatoires au centre d'une cité sécurisée sauf intrusion documentée. |
| `mine` / filon / carrière | Équipe de mineurs, contremaître, outils, blessés, accident, géologues, faune opportuniste | Faire dominer le peuple propriétaire; ne pas déclarer tous les travailleurs captifs. |
| `forge` / fonderie / trempe | Forgerons, apprentis, convoyeurs de minerai, garde, incident | Pas de « boss volcanique » sans raison; chaleur et risque utiles. |
| `farm` / serre / champignonnière / enclos | Jardiniers, cueilleurs, bergers, bêtes domestiques, nuisibles | Fongique n'implique pas systématiquement hostilité. |
| `residential` / quartier / foyers | Familles, vieillards, enfants, voisins, livreurs, artisans | Punitions et conséquences fortes pour agressions de civils. |
| `checkpoint` / porte / garnison | Gardes, contrôle d'identité, porteurs de messages, douaniers | Distinguer patrouilles et civils; vérifier règles d'admission Moriquendi. |
| `route` / passage / pont / escalier | Caravane, éclaireurs, migrants, faune, embuscade, accident | Vérifier la taille réelle des créatures et chariots par rapport au passage. |
| `aquatic` / lac / fleuve / citerne | Pêcheurs, transport fluvial, faune aquatique, courant, noyade | Un poisson géant n'est pas dans une citerne fermée sans connexion. |
| `religious` / sanctuaire / temple | Pèlerins, officiants, gardes rituels, vol d'offrandes | Culte de la ville/clan si documenté; aucun rituel universel inventé. |
| `scholar` / archives / académie | Archivistes, scribes, apprentis, chercheurs, escorte de manuscrits | Séparer travail académique et complot secret. |
| `hazard` / gouffre / éboulement | Exploration, piège naturel, corps blessé, indices, secours | Les dangers géologiques ne sont pas obligatoirement des monstres. |
| `ruins` / ouvrage abandonné | Fouilleurs, charognards, indices, cavités, morts-vivants possibles | Ne pas inventer l'origine historique de la ruine. |
| `portals` | Messager, poste de contrôle, porteur de marchandises | Existence et destination du portail doivent être sourcées. |
| `surface` / Royolo | Surveillance, diplomatie exceptionnelle, alerte | Royolo n'est pas une ville marchande cosmopolite. |

### Influence du groupe dominant

Après le filtre de lieu, le système favorise le **peuple propriétaire** du site. Exemple :

- Mine de Kharaz-Dûmel → mineurs et contremaîtres **duergar** dominants; équipe gobeline sous contrat possible mais rare et justifiée.
- Bazar Moriquendi → commerçants **Moriquendi**, pas une caravane de gobelins étrangère sans autorisation.
- Lac hors cité → pêcheurs, faune, voyageurs sur berges si route connue.
- Secteur en ruine sans propriétaire → exploration, récupérateurs, animaux; pas d'autorité urbaine tirée arbitrairement.

Les pondérations restent configurables et ne définissent pas de statistiques de population canonique.

## 5. Paramètres ajoutables à un lieu dans LoreSmith

Au-delà de l'Atlas existant, chaque lieu peut recevoir une **surcouche non destructive** propre à la campagne :

```json
{
  "locationId": "cite-khordun-0-grande-forge-du-clan-thrum",
  "overlayVersion": 1,
  "controlledByFaction": "duergar",
  "habitatTags": ["forge", "underdark", "industrial"],
  "visitorPolicy": "limited",
  "routeTraffic": "high",
  "securityLevel": "guarded",
  "warState": "unknown",
  "supplyState": "normal",
  "recentAttacks": [],
  "terrain": {"minPassageCells": 1, "verticality": "multi_level", "water": false},
  "encounterOverrides": {"blockedTemplateIds": [], "forcedTemplateIds": [], "weights": {}},
  "editorialStatus": "campaign_overlay_not_canon"
}
```

Le `locationId` ci-dessus illustre le format de génération et **doit être validé contre l'index final**. L'Atlas ne contient pas nécessairement les valeurs `routeTraffic`, `securityLevel`, `supplyState` : laisser `unknown` si non renseignées, plutôt que deviner. Les données de campagne ne réécrivent jamais les sources de l'Atlas.

## 6. Algorithme de classification (déterministe)

Pour chaque entité (feature, map, espace, strate, connexion, lieu de cité) :

1. Utiliser son **ID natif**, pas son nom comme clé primaire.
2. Associer sa catégorie Atlas (`cite`, `voie`, `garde`, `ressource`, `eau`, `ruine`, `vivant`…), puis enrichir à partir de sa **désignation réelle** (par exemple `Marché`, `Mine`, `Bazar`, `Pont`, `Temple`).
3. Si le lieu appartient à une cité connue dans son **scope** (`hosten-valak` / `cite-khordun` / `cite-kharaz-dumel`), transmettre **le peuple dominant**, sans déduire une appartenance d'un simple nom similaire.
4. Conserver `canonStatus`, `placementStatus`, `sourceKind`, `needsReview`, `scenarioOnly`, coordonnées et `mapIds`, sans promotion.
5. Regrouper les tags : biome, fonction, présence sociale, faune, route, danger.
6. Pour les rencontres, appliquer d'abord les **interdictions Moriquendi**, puis les restrictions de visite, puis le biome, puis les poids de peuple dominant et de fréquentation.
7. Produire `eligibleTemplates` pour le MJ et inclure les refus `reason` lors du mode diagnostic (utile pour comprendre pourquoi une caravane n'apparaît pas).
8. Exporter l'index en JSON + CSV, ainsi que les connexions. Aucun appel à un LLM, à une API d'images ou à un service payant n'est nécessaire.

### Pourquoi ne pas classifier seulement selon le nom

« Hall des Poids Étrangers » n'est pas une mine; c'est un lieu de contrôle douanier malgré le mot `poids`. « Galerie des Arrivants » fait partie d'une cité duergar, contrairement à une galerie sauvage. Deux « Pont suspendu » peuvent appartenir à deux paliers différents. Le **contexte parent**, la catégorie, le peuple et le statut doivent prévaloir sur les mots-clés si l'information existe.

## 7. Scripts livrés — commandes

Depuis une copie locale du **dépôt Fléau** où `npm install` a été exécuté, **sans modifier le dépôt** :

```bash
node /chemin/vers/LoreSmith_Underdark_rencontres_v1/scripts/build-atlas-inventory.mjs \
  --repo /chemin/vers/Fl-au-Bestiaire \
  --out /chemin/vers/atlas-encounters-export
```

Ce script lit `src/atlas/data.ts` avec l'`esbuild` déjà disponible dans le dépôt Vite, puis lit toutes les cités enregistrées dans `public/data/cites/index.json`. Il ne fait aucun `commit`, aucun `push`, aucune mise à jour de lore. Sorties :

- `atlas-location-index.json` : chaque point/context/lieu classé et tous ses modèles admissibles;
- `atlas-location-index.csv` : colonnes lisibles pour validation humaine;
- `atlas-routes.json` : connexions orientées, accès, difficultés déjà documentées;
- `atlas-classification-report.md` : effectifs et taux de révision.

Pour importer aussi des **brouillons locaux** après export explicite de l'Atelier :

```bash
node scripts/build-atlas-inventory.mjs \
  --repo /chemin/vers/Fl-au-Bestiaire \
  --drafts-dir /chemin/vers/brouillons-exportes \
  --out /chemin/vers/atlas-encounters-export
```

**Limite technique vérifiée :** les brouillons stockés uniquement en `localStorage`/IndexedDB dans le navigateur ne sont pas accessibles depuis un script Node isolé. Claude doit d'abord les exporter de l'Atelier, en respectant leur statut de brouillon. Ne pas prétendre qu'un fichier sur disque voit automatiquement les données d'une session web.

### Générer une scène d'essai

```bash
node scripts/generate-encounter.mjs \
  --index atlas-encounters-export/atlas-location-index.json \
  --location-id <ID_PROVENANT_DU_CSV> \
  --seed session-001
```

Le même ID et la même graine produisent la même sélection et les mêmes effectifs (tant que les modèles et données n'ont pas changé). Cette commande émet une scène JSON à utiliser avec la bibliothèque, la table de jeu ou la préparation de campagne.

### Test sans dépôt

Le ZIP inclut `examples/atlas-fixture.json` et un mini JSON de cité. Ils sont **fictifs et explicitement marqués comme données de test** :

```bash
node scripts/build-atlas-inventory.mjs \
  --atlas-json examples/atlas-fixture.json \
  --cities-dir examples/cities \
  --out examples/export-fixture
node --test tests/engine.test.mjs
```

La **validation sur le véritable Atlas** sera exécutée par Claude Code sur la branche à jour. Le résultat exact (nombre de milliers ou centaines de repères générés) doit être lu depuis `atlas-classification-report.md`, non annoncé à l'avance.

## 8. Intégration directe dans LoreSmith / le navigateur

Le répertoire `integration/` contient un moteur **sans dépendances Node**. Copier le pack entier sous `src/encounters/` de l'application Vite (de façon à conserver `data/` et `integration/` côte à côte), puis :

```ts
import { ATLAS } from '../atlas/data';
import { classifyCurrentAtlas, drawAtLocation } from '../encounters/integration/encounter-browser';
const inventory = classifyCurrentAtlas(ATLAS, /* publishedCityJsons */ []);
const scene = drawAtLocation(inventory, 'lieu-royolo', 'campagne-001-session-004');
```

Les chemins d'import ci-dessus sont **illustratifs** et doivent être adaptés par Claude selon le fichier d'appel. Les JSON des cités publiées doivent être chargés explicitement, via l'index et `fetch` dans le navigateur (ou par imports statiques lors du build); **ne pas envoyer des appels `fetch` sur chaque tirage**.

Le moteur V1 ne remplace pas automatiquement `src/atlas/encounters.ts`. Prévoir un **pont progressif** pour ne pas casser le bouton de rencontres aléatoires existant : utiliser le classificateur d'abord en mode lecture et observation, puis brancher les nouvelles scènes sur les panneaux de lieu. Faire des tests par cartes et après chaque modification du repo (commit/push/reload pour vérifier le déploiement).

## 9. Exemple de conversion de lieux en rencontres

**Mine duergar** : `owner=duergar`, `tags=[mine,resource]`, statut `creation` si issu du JSON cité. Rencontres : équipe de mineurs duergar, contrôle de quotas, accident de mine, caravane de minerai, parfois visiteurs contractuels. Présenter « butin » : pioches, lampes, minerai appartenant au chantier; pas de récompense gratuite.

**Porte de Hosten Valak** : `owner=moriquendi`, `clan=Warral`, `tags=[checkpoint,urban]`. Rencontres : portiers Mori, contrôle, escorte Mori; **pas** de marchand gobelin ordinaire. Si le MJ configure un convoi étranger autorisé, sa permission doit citer la rencontre et l'autorité qui l'accepte.

**Forêt de champignons géants** (carte de démonstration) : `tags=[ecology,farm/cave selon la fiche]`; colonies myconides selon habitat, faune non hostile, prédateurs et signes biologiques. Rester `DEMO_NOT_CANON` même après génération.

**Archives centrales d'Ozzoloh** : `owner=moriquendi`, `clan=Norrianiss`, `tags=[scholar,archives]`; archivistes, étudiants, représentants des cinq clans, scribes, surveillants. L'emplacement exact de la salle est **inconnu**, même si les rencontres peuvent être préparées.

**Caravane sur une route neutre** : `owner=null`, `tags=[route]`. Espèces variées possibles si **une raison explicite** les réunit : commerce, guerre, recherche commune, exode. Une patrouille Moriquendi n'est pas injectée par défaut.

## 10. Validation demandée à Claude Code

- [ ] Charger toutes les entrées réelles `ATLAS.features` et compter le résultat après enrichissement procédural.
- [ ] Indexer les espaces, cartes, strates, connexions et les sites/cités publiés sans collision d'IDs.
- [ ] Extraire les lieux de chaque palier des deux villes duergar et de tout nouveau JSON présent dans `index.json`.
- [ ] Exporter aussi les brouillons uniquement si explicitement disponibles, et les marquer `local_draft`.
- [ ] Les cinq Palissades sont reconnues; quatre restent non localisées dans la source Tome II; Ozzoloh a seulement une position relative.
- [ ] Royolo est à la surface mais n'est pas arbitrairement placé sur une carte.
- [ ] Tous les `demo:true` restent `DEMO_NOT_CANON`.
- [ ] Tous les lieux proposent des rencontres adaptées ou explicitement « aucune rencontre admissible » — jamais de groupes incohérents silencieusement forcés.
- [ ] Dans une mine duergar, vérifier que la fréquence des Duergars domine les groupes extérieurs (hors exceptions configurées).
- [ ] Dans une Palissade, refus d'une caravane étrangère ordinaire; faune biologiquement compatible encore autorisée.
- [ ] Afficher les motifs d'exclusion dans l'interface de diagnostic du MJ.
- [ ] Valider les stats, IDs et footprints des créatures; marquer les archétypes Mori sans stats comme `NOT_YET_DEFINED`.
- [ ] Ne pas écraser l'ancien système de rencontres, les dossiers d'Atlas, les sources documentaires ni les cartes.
- [ ] Ne pas modifier le canon d'après des sorties IA ou procédurales sans décision explicite.

**Conclusion :** ce travail ne consiste pas à ajouter des marqueurs artificiels à la carte. Il consiste à donner une **fonction de jeu à chaque entrée déjà existante**, tout en maintenant les distinctions établies par le lore, les incertitudes de localisation et les choix éditoriaux du MJ.
