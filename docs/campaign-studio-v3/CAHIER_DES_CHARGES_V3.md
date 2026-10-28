# LoreSmith — Campaign Studio V3
## Centre de préparation de campagne · Cahier des charges produit, UX et architecture

**Statut :** proposition de conception détaillée, accompagnée d'une maquette HTML interactive.  
**Base :** amélioration du Campaign Studio V2, sans prétendre être intégrée au code actuellement déployé.  
**Priorité confirmée :** **tous les éléments nécessaires de toute la campagne doivent être préparés, reliés et validés avant la séance 1**.

> Je peux imaginer librement, mais je n'arrive pas à la première séance avec des trous que je devrai combler sous pression. LoreSmith m'aide à transformer mon histoire en un dossier de campagne utilisable, à vérifier que ses ressources existent, et à visualiser l'évolution de l'intrigue.

---

## 1. Le changement majeur par rapport à V2

**V2 :** l'atelier accompagnait le MJ de ses premières idées jusqu'à une scène jouable, avec préparation progressive et minimale.  
**V3 :** **la création reste progressive, mais le lancement devient un jalon exigeant**. Le MJ peut construire dans n'importe quel ordre; il ne peut pas déclarer sa campagne prête tant que ses scènes et embranchements essentiels n'ont pas des ressources et conséquences utilisables.

Ce changement est important : la préparation doit être complète **pour la campagne entière**, pas uniquement pour les trois premières heures. Il ne faut cependant pas confondre « préparation complète » avec « écrire chaque phrase ou prédire chaque choix ». La complétude désigne la couverture des situations, acteurs, indices, règles, issues et voies de repli. Un MJ doit toujours pouvoir accueillir une idée totalement imprévisible de ses joueurs.

### Les cinq règles non négociables

1. **Un seul projet, une vue globale :** le MJ voit les actes, toutes les scènes, les séances, les fils narratifs, les ressources et l'état de préparation dans une console.
2. **Pas de scène isolée :** chacune a des préconditions, des conséquences, au moins une sortie et des liens aux scènes voisines. Un changement indique ce qu'il remet en question.
3. **Création au besoin, pas prolifération :** PNJ, monstres, cartes et documents sont identifiés et créés parce qu'une scène les nécessite. Les mêmes fiches sont réutilisées ailleurs.
4. **Les propositions IA ne sont pas des faits :** elles demeurent des brouillons jusqu'à validation du MJ, et ne modifient jamais le canon de l'univers automatiquement.
5. **Verrou de lancement strict :** aucune scène obligatoire ne doit présenter un manque bloquant et aucun asset indispensable ne doit manquer avant de marquer la **campagne** « Prête à jouer ».

### Ce que le MJ doit ressentir

- **Avant la rédaction :** « Parfait, je comprends ce que je vais devoir créer. »
- **Pendant la rédaction :** « L'application organise mon imagination et prépare les bons éléments. »
- **À travers les scènes :** « Je vois ce qui est révélé, qui change, où les héros pourraient aller et quelles conséquences persistent. »
- **Avant la séance 1 :** « J'ai un dossier pour toutes les scènes, toutes les rencontres, mes documents, mes plans B et mon épilogue. Je peux me concentrer sur mes joueurs. »

---

## 2. Les six destinations de l'interface

### 2.1 Centre de commandement / Vue d'ensemble

Écran d'accueil de chaque campagne, toujours accessible :

- Titre, univers, prémisse, conflit, niveau et composition du groupe, règles, durée estimée.
- Cartes de progression : scènes écrites, scènes vérifiées, séances planifiées, éléments bloquants, ressources réutilisées et manquantes.
- **Trame à trois niveaux :** actes → scènes → composants de scène, chaque carte étant cliquable.
- **Inventaire de préparation priorisé**, sur les risques les plus importants, et pas sur les derniers champs touchés.
- Budget de temps des séances, marge prévue et signalement si le volume est insuffisant ou trop ambitieux.
- Alerte claire lorsque la séance 1 ne peut pas être lancée parce que les scènes 7, 8 ou 9 ne sont pas finalisées.
- Aucun CTA trompeur « Jouer maintenant » tant que les vérifications bloquantes ne sont pas satisfaites.

**Maquette :** `01-vue-ensemble.png`.

### 2.2 Fil de campagne / Trame complète

Trois sous-vues, toutes parcourables avant la première séance :

**Structure des scènes**
- Actes et scènes dans l'ordre prévu, scènes facultatives, routes alternatives et liens causaux.
- Chaque scène affiche sa durée estimée, la séance à laquelle elle appartient et son statut.
- Cliquer sur une scène ouvre immédiatement son dossier.
- Les scènes n'étant pas un chemin forcé, les connexions indiquent « possible après » ou « conditionnel », pas nécessairement « scène qui suivra ».

**Évolution dramatique**
- Une courbe de tension prévue sur l'ensemble du scénario.
- Une **matrice par scène** : indices disponibles, menace, choix, état des alliés, objectif antagoniste.
- Fils narratifs (mystère, quête, antagoniste, destin des PNJ récurrents) avec étapes : introduction → développement → bascule → résolution.
- Visibilité distincte du **plan du MJ** et, plus tard, de **l'état réel joué**. Le plan n'est jamais présenté comme un fait accompli.

**Choix et conséquences**
- Simulateur : « Et s'ils n'accordent pas leur confiance ? Et s'ils sauvent les captifs ? Et s'ils refusent le marché ? »
- Les décisions importantes produisent des effets sur une ou plusieurs scènes ultérieures.
- L'outil affiche les embranchements non documentés et les transitions qui peuvent mener à une impasse.
- **Éviter l'explosion combinatoire :** stocker les conséquences et conditions indépendamment, ne pas créer 64 copies de scènes pour 64 combinaisons théoriques. Vérifier que les conditions compatibles possèdent une résolution.

**Maquettes :** `02-fil-de-campagne.png`, `03-evolution.png`, `04-choix-consequences.png`.

### 2.3 Dossiers des scènes / Runbook

Chaque scène doit devenir une unité opérationnelle complète. Voir la section 4 pour le contrat de données et le niveau minimal de préparation.

**Maquettes :** `05-dossier-scene.png`, `06-scene-a-preparer.png`.

### 2.4 Registre des ressources / Production

Un inventaire unique de la campagne, lié à la Library et au bestiaire, qui distingue :

- **PNJ** : rôles, motivations, informations, répliques, secrets, portrait si utile.
- **Créatures** : bloc de statistiques réutilisable, groupes, instances physiques et jetons.
- **Lieux** : description, raccordement à l'univers, carte éventuelle.
- **Cartes** : couches MJ/joueurs, zones, placements, déclencheurs.
- **Pièges / mécanismes** : DD, conditions, effets, esquive et conséquences.
- **Documents joueurs** : cartes, lettres, énigmes, indices visuels et objets à remettre.
- **Quêtes et mystères** : questions, preuves, révélations et résolution.

Chaque entrée indique **créée/à créer**, dans combien de scènes elle sert, quelles scènes seront touchées par une modification, et si elle constitue une condition de lancement.

**Maquette :** `07-registre-ressources.png`.

### 2.5 Avant la séance 1 / Contrôle général

Une **porte de lancement** commune à toute la campagne : toutes les séances sont auditées, pas seulement la première. Elle affiche une liste triée de points bloquants, des avertissements, les ressources manquantes et la possibilité de relancer l'audit.

**Maquette :** `08-audit-premiere-seance.png`.

### 2.6 Fondations de campagne / Questionnaire progressif

Conserver et raffiner le parcours V2 : monde, étincelle, joueurs, conflit, ouverture, canevas. Réponses courtes, suggestions contextualisées, passage possible, modifications ultérieures sans perte de données. **Différence V3 :** une question passée ne bloque pas la création; les paramètres indispensables manquants bloquent seulement la certification finale (ex. nombre/niveau du groupe pour le combat).

**Maquette :** `09-fondations.png`.

---

## 3. Deux progressions distinctes

### Progression de conception

`Idée → Planifiée → Détaillée → Vérifiée → Prête`

Une scène peut être « planifiée » sans qu'aucune de ses fiches soit encore créée. Le MJ n'est pas puni pendant l'écriture. Les propositions IA possèdent leur propre état, non inclus dans « vérifiée ».

### Progression de jeu

`À jouer → En cours → Résolue → Conséquences appliquées`

Elle appartient au **Scene Runner** et commence seulement quand le groupe joue. **Elle ne doit pas être mélangée au pourcentage de préparation.**

**Exemple :** une scène peut être 100 % prête mais 0 % jouée. Quand les PJ éliminent un antagoniste plus tôt que prévu, le Scene Runner enregistre ce fait, puis signale les scènes à réviser; il ne modifie pas rétroactivement le plan d'origine sans confirmation.

### Statuts robustes des ressources

- `missing` : ressource requise identifiée mais absente;
- `suggested` : brouillon proposé par l'IA, non validé;
- `draft` : objet créé mais incomplet;
- `review_needed` : révision requise après modification d'une dépendance;
- `verified` : objet et liens contrôlés, MJ a approuvé;
- `optional` : contenu facultatif explicitement déclaré tel.

Les compteurs doivent être calculés depuis l'état réel des objets, non depuis une simple chaîne de caractères ou des cases décochées.

---

## 4. Contrat d'une scène « prête »

### 4.1 Métadonnées

- Identifiant stable, titre, acte, séance prévue, durée min./typique/max.
- Type : social, exploration, combat, énigme, transition, révélations, épilogue (combinables).
- Objectif dramatique. Pourquoi cette scène existe-t-elle ?
- Conditions d'entrée : lieu, état, événement, choix précédent.
- Conditions de sortie : quels événements déclenchent la prochaine situation possible ?
- Importance : essentielle, optionnelle ou conditionnelle. Une scène conditionnelle a ses conditions et son issue préparées.

### 4.2 Ce que le MJ peut immédiatement utiliser

1. **À lire ou paraphraser** : courte description sensorielle. Identifier ce qui est visible pour les PJ; les secrets restent dans la couche MJ.
2. **Le vrai contexte** : informations cachées, intentions de PNJ, cause réelle de l'événement, état initial du lieu.
3. **Les acteurs** : PNJ impliqués, rôle, première attitude, ce qu'ils savent, ce qu'ils veulent, deux répliques ou réponses probables; lien stable à la fiche.
4. **Trois réactions plausibles** : explorer, négocier, combattre/partir (ajustées au type de scène), avec résultats et conséquences préparés.
5. **Plan B** : une réaction imprévue ou un échec ne doit pas briser tout le récit. Documenter une réponse générique et une sortie.
6. **Tests et règles** : DD, compétence, conséquence du succès/échec et règle applicable. Les indices nécessaires à la progression ne sont pas enfermés derrière un seul jet.
7. **Combat le cas échéant** : objectifs, nombre et type de monstres, stat blocks, placements, visibility, tactiques, moral, renforts, terrain, issues alternatives et récompenses.
8. **Indices et révélations** : élément à découvrir, source, autres sources, scènes qui en dépendent; préciser si les joueurs doivent le voir physiquement.
9. **Cartes et supports joueurs** : lien de fichier, statut vérifié, version sans secrets. Une carte de combat ou une image marquée `required` doit exister avant le lancement.
10. **Résultat / répercussions** : variables de campagne modifiées, PNJ affectés, indice dévoilé, objectifs ouverts/clos, issue vers les scènes suivantes.
11. **Note minute** : ce que le MJ doit absolument se rappeler et que le Scribe pourra condenser en aide-mémoire de séance.

### 4.3 Contrôles de complétude conditionnels

Une scène **sans combat** n'a pas besoin de carte tactique ou de statistiques. Une scène **avec combat prévu** requiert sa composition, ses règles, ses tactiques et ses placements ou un plan de théâtre de l'esprit explicite. Une scène **avec indice critique** exige un mode d'accès fiable et un autre accès indépendant. Une scène **à plusieurs issues** exige les conséquences et liens de chaque option déclarée.

Exemples de vérificateurs :

- `sceneHasEntryAndExit(scene)`
- `sceneHasPreparedFallback(scene)`
- `criticalCluesReachable(scene,storyGraph)`
- `requiredResourcesExistAndVerified(scene.resourceRefs)`
- `npcMotivationsResolved(scene.npcRefs)`
- `encounterRulesValid(scene.encounterRefs, party, edition)`
- `mapVisibilityReviewed(scene.mapRef)`
- `allBranchOutputsResolved(scene.branchEdges, graph)`
- `sceneNarrativeReviewedAfterLastEdit(scene)`

L'interface peut montrer une checklist, **mais le calcul final doit être fondé sur ces vérifications et la validation du MJ**, pas sur les cases seules.

---

## 5. Préparer toutes les séances sans épuiser le MJ

L'outil doit faire estimer un nombre de séances et un temps disponible, puis aider à répartir la matière. Le MJ peut toujours réorganiser les scènes : la durée **prévue** est distincte du temps **réel**.

Pour une séance cible de 3 h :

- Proposer des scènes dont l'estimation médiane totalise environ **2 h 20 à 2 h 40**, laissant 20 à 40 min d'imprévus, pauses et discussions.
- Afficher la somme des durées des scènes, les variations et la marge, pas simplement un nombre de scènes.
- Signaler une séance qui contient un climax + trois combats lourds ou, inversement, seulement dix minutes de contenu.
- Permettre « réserve préparée » : un événement facultatif prêt à activer si les joueurs avancent plus vite; il compte dans le projet sans imposer sa présence.
- Ajouter une vérification de **respiration** entre gros combats et révélations importantes.

Une scène en option reste soit **complètement préparée**, soit clairement exclue de la campagne à lancer. Il ne faut pas la compter comme contenu « prêt » si elle est seulement une idée.

---

## 6. Le graphe narratif et les fils vivants

Représenter le plan comme un **graphe orienté** de scènes et de conséquences, pas comme une simple liste ordonnée.

Chaque nœud `Scene` porte :
- `entryConditions[]`, `exitEdges[]`, `reveals[]`, `stateChanges[]`, `requiredResources[]`;
- `narrativeThreads[]` (mystères, quêtes, antagonistes, relations);
- `primaryNextScenes[]`, `optionalNextScenes[]`;
- `fallbackEdges[]` quand un chemin échoue;
- une date de révision et des dépendances.

### Trois façons de voir la progression

**Trajectoire** : les nœuds par acte, avec alternatifs, regroupements, transitions.  
**Matrice** : une colonne par scène et une ligne par fil narratif — qui sait quoi, menace, objectifs, indices, alliés.  
**Simulation** : choisir des décisions importantes et afficher, scène par scène, les conséquences projetées.

Exemple fictif de dépendance :

`S2 : sceau trouvé → S3 : registres compatibles → S7 : sceau comme argument → S8 : condition de négociation → S9 : vérité dévoilée ou cachée.`

Modifier le sceau dans S2 doit envoyer des alertes à S3, S7, S8 et S9 et éventuellement placer leurs ressources en `review_needed`. Une proposition de correction doit afficher un **diff** et nécessiter une approbation explicite.

### Éviter les « dead ends »

Pour tout enjeu essentiel : vérifier au moins deux chemins d'accès ou un chemin garanti qui n'exige pas une réussite au dé. Pour toute décision significative : conséquence préparée, même si les joueurs ne vont pas où on l'avait prévu. Ce n'est pas un railroading : l'univers réagit à leurs choix.

---

## 7. Les ressources générées à la demande

### Exemple de scène

« Une sentinelle blessée attend près d'un chariot. Un marchand cherche sa sœur. Un ogre et quatre gobelins attendent en embuscade. »

Le Scribe propose :

| Nature | Ce qui est nécessaire | À créer / réutiliser |
|---|---|---|
| PNJ | Une sentinelle, un marchand | Deux références PNJ; préparer motivations et informations essentielles, puis portraits facultatifs |
| Créatures | Un ogre, quatre gobelins | **Deux** fiches de type, **cinq** instances, **cinq** jetons — chercher dans le bestiaire d'abord |
| Carte | Un passage, un chariot, des hauteurs | Carte ou plan relatif, couche MJ, position visible/cachée |
| Mystère | Disparition d'une caravane | Une piste et son mode d'accès, avec une voie alternative |
| Suite | La sœur disparue | Référence vers un PNJ futur et lien vers la scène où elle apparaîtra |

Les propositions de l'IA doivent séparer strictement :

- **Détecté dans le texte du MJ** : fait énoncé, accompagné d'un extrait source.
- **Référence au canon existant** : ID et source interne de l'univers.
- **Inférence probable** : « Je crois que tu as besoin d'un PNJ informateur. »
- **Proposition créative** : invention à valider, pas enregistrée comme canon.
- **Inconnu** : une décision non prise ou une donnée incomplète.

### Machine de proposition

Pour chaque suggestion : `[Réutiliser une fiche] [Créer un brouillon] [Compléter avec le Scribe] [Modifier] [Ignorer]`. Aucune génération d'image ou de fiche nouvelle ne devrait être systématique. Si un PNJ revient dans une autre scène, seule sa **participation à la scène** est créée; sa fiche-source reste unique.

### Images

Prévoir trois modes : générer via l'intégration Images autorisée, téléverser, associer depuis la bibliothèque. Statut `optional` par défaut pour portrait d'ambiance; `required` si le MJ a explicitement déclaré qu'une illustration, une carte ou une lettre doit être remise aux joueurs.

### Monstres et cartes

Séparer impérativement : `monsterType` → `encounterGroup` → `creatureInstance` → `token`. Chaque instance possède PV/état potentiels distincts. Un jeton possède coordonnées, visibilité MJ/joueurs, zone ou patrouille, déclencheur, notes et placement. Sans carte, fournir une disposition relative valide en théâtre de l'esprit.

Pour les règles D&D : utiliser un moteur déterministe propre à la version 2014 ou 2024. L'IA peut suggérer une composition et une tactique, mais ne doit **pas** inventer un budget de difficulté présenté comme vérifié.

---

## 8. Le verrou de préparation (« Preflight »)

### Conditions d'entrée en mode « Prêt à jouer »

- [ ] Univers/campagne sélectionnés et canon distinct des propositions.
- [ ] Nombre de PJ, niveaux ou fourchette prévue, édition de règles et règles maison pertinentes définis.
- [ ] **Toutes** les scènes obligatoires / conditionnelles jouables possèdent les sections requises selon leurs types.
- [ ] Le graphe relie les débuts possibles à au moins une fin, sans dépendance critique impossible.
- [ ] Les choix importants ont des résultats et des conséquences documentés.
- [ ] Tous les indices critiques ont des accès suffisants, pas de blocage par un seul jet.
- [ ] Tous les PNJ nécessaires ont leurs motivations/informations utilisables.
- [ ] Tous les monstres, rencontres, règles de combat et placements requis sont validés.
- [ ] Toutes les cartes, énigmes, pièces à remettre et illustrations marquées « requises » sont disponibles.
- [ ] Les séances ont une répartition temporelle raisonnable et une marge prévue.
- [ ] L'épilogue et les issues principales sont écrits.
- [ ] L'audit n'affiche aucune contradiction forte non résolue ou élément `review_needed` essentiel.
- [ ] Le MJ a explicitement passé le dernier contrôle de campagne et scellé un instantané de préparation.

**Statuts de préflight :**

- `BLOCKED` : contenu essentiel absent, règle non calculée, lien cassé ou contradiction non résolue.
- `REVIEW` : dossier présent mais nouvellement modifié ou critique à confirmer.
- `READY` : toutes les conditions de lancement sont satisfaites.

Un score sur 100 % peut renseigner le progrès, mais ne doit pas permettre à une moyenne de masquer une **seule** scène terminale dépourvue de résolution.

### Quand une donnée change

Changer le niveau des PJ → toutes les rencontres dépendantes deviennent `review_needed`.  
Changer le nom ou la motivation d'un PNJ → les scènes qui y font référence sont listées.  
Modifier une révélation → le fil narratif, les supports joueurs et les scènes ultérieures sont réaudités.  
Modifier un texte de scène → la vérification narrative doit être renouvelée.

**La version scellée ne doit pas être écrasée.** Enregistrer une nouvelle révision de préparation. Le MJ conserve toujours son dossier antérieur.

### Répétition générale

Le Scribe peut mener un exercice de robustesse :

1. **Explorateurs :** prennent tout leur temps, fouillent, ratent des jets et posent des questions.
2. **Impulsifs :** attaquent tôt, sautent des scènes sociales et déclenchent des alarmes.
3. **Diplomates :** refusent les combats et négocient avec les antagonistes.

Le résultat est un **rapport de lacunes et risques**, pas une nouvelle aventure inventée automatiquement. Le MJ choisit les correctifs à préparer et le Preflight est relancé après validation.

---

## 9. Le dossier MJ exportable (« Campaign Binder »)

Un MJ débutant devrait pouvoir ouvrir ou imprimer un **véritable runbook**, pas seulement un JSON.

### Pack maître de jeu

- Page titre et résumé de campagne, monde et paramètres de groupe.
- Sommaire des actes, révélations, fils narratifs, relations et fins.
- Calendrier des séances avec temps de jeu prévu, réserve et changements de rythme.
- Une section / page par scène : texte à dire, secrets, PNJ, choix, tests, combat/placement, indices, ressources et transitions.
- Fiches des PNJ, monstres et autres ressources reliées.
- Planches de jetons, cartes MJ avec secrets et placements.
- Pages de référence rapide : noms, objectifs, réponses à questions fréquentes, tables de conséquences.
- État de préparation et avertissement **BROUILLON** si le lancement n'est pas encore approuvé.

### Pack joueurs (séparé)

- Documents et illustrations explicitement révélables.
- Cartes sans ennemis cachés, positions secrètes, répliques MJ ou informations inconnues des joueurs.
- Les secrets ne doivent jamais être présents dans les champs et données exportés côté joueurs, pas seulement cachés par CSS.

**Dans la maquette :** l'export du dossier MJ produit un fichier **HTML lisible**, contenant les 9 scènes et leurs choix préparés, avec un tampon « brouillon » si l'audit n'est pas complété. Un export JSON structuré est accessible depuis le registre pour tester les données. C'est une démonstration, pas encore le pack multi-fichiers définitif.

---

## 10. UX / Direction artistique

- Conserver l'identité dark fantasy LoreSmith de V2 (laiton patiné, cuir, parchemin, charbon, typographie éditoriale).
- **Trois zones :** navigation persistante, surface de travail principale, Scribe contextuel. Sur petit écran, le Scribe passe sous la surface principale plutôt que d'étouffer l'éditeur.
- **Un sujet par question** dans les fondations; les paramètres avancés sont dépliables.
- **Navigation non linéaire** pendant la conception : passer de l'épilogue au chapitre 1 ou du registre au combat.
- **Jamais de feuille gigantesque vide** : on commence avec un plan de scène générable, des sections dépliables et des suggestions liées à un besoin réel.
- **États visibles sans jargon** : à créer, brouillon, à vérifier, prêt; badges de blocage uniquement là où il y en a réellement.
- Le fil complet permet une compréhension immédiate; le détail des dossiers apparaît seulement après le clic.
- Accessibilité : contrastes lisibles, raccourcis clavier éventuels, focus visible, avertissements textuels non fondés seulement sur la couleur, réduction des animations si demandée, version mobile utile.

---

## 11. Modèle de données cible (illustratif, adapter au reducer existant)

```ts
type PrepState = 'missing' | 'suggested' | 'draft' | 'review_needed' | 'verified' | 'optional';
type SourceKind = 'universe_canon' | 'gm_authored' | 'ai_proposed' | 'unknown';

interface CampaignDesign {
  id: string;
  universeId: string;
  title: string;
  premise?: string;
  partyConfig: { memberIds: string[]; count?: number; levels?: number[]; edition: '2014'|'2024'|'other' };
  actIds: string[];
  sceneIds: string[];
  sessionIds: string[];
  threadIds: string[];
  designRevision: number;
  prepStatus: 'draft' | 'blocked' | 'review' | 'ready';
  sealedSnapshotId?: string;
}

interface SceneDesign {
  id: string;
  campaignId: string;
  actId: string;
  sessionId?: string;
  title: string;
  typeTags: string[];
  required: boolean;
  timeEstimate: { min: number; likely: number; max: number };
  gmReadAloud: string;
  dmSecrets: string[];
  objective: string;
  entranceConditions: Condition[];
  exits: SceneEdge[];
  options: SceneOption[];
  fallback: string;
  clueIds: string[];
  resourceRefs: ResourceRef[];
  encounterIds: string[];
  impacts: WorldStateChange[];
  prepReview: { state: PrepState; reviewedAt?: string; reviewedRevision?: number };
  revision: number;
}

interface SceneOption { id: string; playerApproach: string; gmResponse: string; consequences: WorldStateChange[]; nextSceneIds: string[]; }
interface SceneEdge { targetSceneId: string; conditions: Condition[]; fallback?: boolean; }
interface ResourceRef { resourceId: string; sceneId: string; role: string; required: boolean; }
interface NarrativeThread { id: string; campaignId: string; label: string; stageBySceneId: Record<string, 'introduced'|'developed'|'turned'|'resolved'>; }
interface PrepRequirement { id: string; scopeId: string; kind: string; critical: boolean; validator: string; state: PrepState; reason?: string; affectedIds: string[]; }
interface AuditResult { campaignId: string; revision: number; blockers: PrepRequirement[]; warnings: PrepRequirement[]; ready: boolean; }
interface CampaignSnapshot { id: string; campaignId: string; revision: number; sealedAt: string; resourceVersions: Record<string,number>; audit: AuditResult; }
```

> Les types `Condition` et `WorldStateChange` doivent référencer des variables de campagne clairement nommées (ex. `alarmRaised`, `survivorsRescued`, `debtAccepted`) et une sémantique testable. Ne pas stocker exclusivement des phrases non structurées pour les dépendances de jeu.

### Remarques pour la persistance

- Le code historique LoreSmith possède un reducer, une bibliothèque, des univers et une sauvegarde locale/export-import JSON : s'y raccorder après inspection, sans casser leurs identifiants.
- Ne jamais créer un second registre de personnages concurrent du registre officiel. Utiliser `entityId` + `resourceRef`.
- Prévoir une migration versionnée des anciennes campagnes vers les nouveaux champs; les champs manquants deviennent `unknown`, pas des faux faits.
- Les snapshots du dossier scellé sont immuables; la session jouée les référence mais possède ses propres données d'état.

---

## 12. Contrat IA : Scribe et génération structurée

Le Scribe n'a **pas** le droit de valider les points de contrôle à la place du MJ. Il peut proposer, préremplir, extraire, comparer, expliquer et faire un audit — tous les changements sont des propositions.

### Analyser une scène

Entrée :

- l'univers et ses faits canoniques pertinents (ID et résumé),
- la campagne (révision, état, thèmes),
- la scène et ses voisins (quelques extraits pertinents),
- Party et édition,
- les références de bibliothèque existantes.

Sortie JSON structurée, validée par schéma :

```json
{
  "sceneId": "scene-05",
  "detectedNeeds": [
    {
      "kind": "trap",
      "label": "Mécanisme de la galerie",
      "sourceKind": "gm_authored",
      "sourceExcerpt": "Un ancien mécanisme grince...",
      "known": {"location": "galerie"},
      "unknownFields": ["trigger", "dc", "failureEffect", "bypass"],
      "reuseMatches": [],
      "suggestion": {"bypass": "conduit étroit"},
      "requiresReview": true
    }
  ],
  "storyImpactCandidates": [
    {"targetSceneId": "scene-06", "reason": "L'alarme peut déplacer les captifs", "sourceKind": "ai_proposed"}
  ],
  "readinessFindings": [
    {"severity": "blocker", "code": "TRAP_RULES_MISSING", "field": "trap.dc", "reason": "Un piège prévu n'a pas de règle ou d'effet confirmé"}
  ]
}
```

**La réponse est une proposition.** Aucun nom, secret, objet canonique, indice inventé ou statistique chiffrée ne doit être automatiquement accepté.

### Appels IA raisonnables

- À la demande « analyser cette scène », « aide-moi à compléter », « propose trois routes », « vérifie le fil », « répète la séance ».
- Pas d'appel IA à chaque frappe. Prévoir annulation et gestion des versions de réponse.
- Dédupliquer suggestions par catégorie, source et identité connue; éviter que la même extraction crée trois fois le même PNJ.
- Permettre « Pas d'IA ici ». Le MJ doit pouvoir tout faire manuellement.

---

## 13. Implémentation par lots, dans l'ordre

**Lot 0 — Audit du code existant**  
Trouver les composants Campaigns, Generator, Universe Builder, Library, NPCs & Monsters, Party, Scene Runner, Combat, Images/Conjure et les actions du reducer. Documenter leurs modèles et leurs points de raccordement. Faire un commit initial propre avant modification, si autorisé.

**Lot 1 — Centre de commandement & persistance**  
Créer la navigation et les compteurs de préparation à partir des données réelles, brancher le wizard V2 et permettre la navigation non linéaire.

**Lot 2 — Scènes et graphe narratif**  
Instaurer actes, séances, scènes, liens conditionnels, matrice d'évolution, tension prévue, fils narratifs et impact des modifications.

**Lot 3 — Runbook de scène et contenu opérationnel**  
Éditeur complet, entrée/exit/plan B, choix, indices, sources et statut de chaque section; le MJ peut travailler manuellement.

**Lot 4 — Registre de production et dédoublonnage**  
Références aux fiches canoniques, suggestions d'objets à créer, brouillons approuvables, système d'images et de documents joueurs.

**Lot 5 — Rencontres, cartes et règles**  
Stat block/type vs instance vs token, vue MJ/joueur, visibilité, déclencheurs, théâtre de l'esprit, calcul déterministe propre à l'édition.

**Lot 6 — Preflight, simulation, export**  
Vérifications conditionnelles, invalidations de dépendances, audit de tous les actes, répétition générale, snapshots scellés et vrai binder MJ / pack joueurs.

**Lot 7 — Raccordement Scene Runner et qualité**  
Importer le snapshot scellé, suivi de l'état joué distinct, tests de données, compatibilité backups, migrations, responsive, accessibilité et tests utilisateur.

### Ne pas faire

- Remplacer l'architecture de stockage et de navigation sans audit.
- Ajouter tout dans `src/App.jsx` si des modules réutilisables peuvent être isolés.
- Faire écrire le canon par l'IA sans approbation.
- Considérer une scène prête parce qu'elle contient beaucoup de texte ou qu'une case a été cochée.
- Rendre obligatoires les illustrations purement décoratives.
- Confondre préparation, scénario prévu et événements réellement joués.
- Calculer des budgets de rencontre uniquement par LLM.
- Exporter les secrets du MJ dans le paquet joueurs.

---

## 14. Critères de recette

### Conception

- [ ] Une campagne de 12 scènes / 4 séances affiche toutes ses scènes et tous ses fils dans la vue globale, sans tronquer le contenu.
- [ ] Un MJ peut quitter une étape du wizard et revenir plus tard; les informations déjà connues sont préremplies.
- [ ] Une scène avec trois issues et une porte fermée peut être suivie jusqu'à ses trois conséquences sans bloquer le graphe.
- [ ] Une révélation modifiée remonte les scènes ultérieures dépendantes à revoir.

### Ressources

- [ ] Un PNJ dans trois scènes renvoie à **une** fiche source, avec trois apparitions distinctes.
- [ ] Un type de monstre × 7 instances donne **une** fiche et **sept** états individuels.
- [ ] Les ennemis cachés et les secrets de scène ne sont jamais visibles en vue joueurs ou dans les exports joueurs.
- [ ] Les ressources `required` manquantes bloquent le lancement; les portraits `optional` non produits ne le bloquent pas.

### Lancement

- [ ] Une campagne où S1 est prête mais S9 n'a pas de fin **reste non prête** avant la première séance.
- [ ] Un indice critique sans autre accès ou plan B fait échouer le preflight.
- [ ] Un combat sans calcul pour l'édition choisie fait échouer le preflight.
- [ ] Changer l'édition ou le niveau du groupe invalide les rencontres concernées.
- [ ] Un Scribe qui génère dix brouillons **ne valide rien** de façon autonome.
- [ ] Le résultat de l'audit est reproductible pour un même snapshot et expose la raison de chaque blocage.
- [ ] Le pack MJ est lisible, complet, ordonné et imprimable; le pack joueurs est dépourvu d'information MJ.

### Résilience

- [ ] La migration des anciennes campagnes et l'export/import des backups fonctionnent sans perte.
- [ ] Les modifications non sauvegardées et les conflits de révision sont signalés.
- [ ] Le mode mobile permet de consulter et modifier une scène sans défilement horizontal de toute la page.
- [ ] Les écrans sont utilisables au clavier; interactions de carte ont une alternative sans glisser-déposer.

---

## 15. À propos du prototype fourni

`campaign-studio-v3.html` est un **prototype autonome, hors ligne** contenant :

- une campagne illustrative, **Les Veilleurs du Col**, avec 3 actes, 9 scènes et 3 séances;
- la progression de préparation par scène et globale;
- la vue d'ensemble, le graphe, la courbe de tension, la matrice et le simulateur de trois choix;
- le détail des scènes avec texte modifiable, intentions, réactions, plans B et ressources;
- le registre de ressources partagées;
- le placement des jetons (scènes 1 et 8) et le masque de visibilité joueurs;
- l'audit pré-séance, le contrôle des manques, une répétition générale simulée;
- des confirmations locales, des invalidations illustratives après modification;
- l'export d'un **runbook HTML**, et l'export des données JSON depuis le registre.

**Limites assumées :** l'IA est simulée; l'illustration des cartes est démonstrative; les budgets de rencontres ne sont pas calculés; les fiches ne sont pas reliées au véritable bestiaire; les contrôles de présence des champs sont représentés par des validations simplifiées; la persistance passe par `localStorage` de cette page, pas par le reducer de production. La campagne est inventée comme exemple et ne crée aucun canon Moriquendi.

**Instruction de départ à Claude Code :** lire `PROMPT_CLAUDE_CODE_V3.md`, ouvrir la maquette, inspecter l'application en place et commencer au **Lot 0**, puis au **Lot 1** seulement une fois les raccordements confirmés.
