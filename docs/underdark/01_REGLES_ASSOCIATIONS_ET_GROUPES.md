# LoreSmith / Fléau — Cahier d'architecture du système de rencontres vivantes

**Version :** 1.0 — 28 octobre 2026  
**Statut :** conception fonctionnelle + moteur de référence exécutable  
**Portée :** bibliothèque d'univers partagé, génération de groupes, scènes sociales, rencontres hostiles, non hostiles, écologie, commerce et conséquences.  
**Règle de qualité :** toute règle étiquetée « canon confirmé » provient des Archives; tout autre chiffre, groupe ou comportement de jeu est une proposition du générateur, modifiable par le MJ.

## 1. Pourquoi séparer créature et rencontre

- **Espèce / créature :** caractéristiques, taille, tempérament, intelligence, habitat, attaques, récoltes biologiques et butin potentiel (ex. kobold, lézard cavernicole).
- **Variante / métier :** spécialisation (kobold porteur, mineur, archer, prêtre, marchand). Un métier ne modifie pas la nature de l'espèce; il apporte équipement, outils et rôle.
- **Individu :** identité persistante, nom éventuel, famille, clan, faction, blessure, inventaire personnel, relations et mémoire des joueurs.
- **Groupe :** plusieurs individus reliés par une autorité, une tâche, un lien de parenté, une mission, une association contractuelle ou une simple proximité écologique.
- **Rencontre :** groupe + lieu + moment + circonstance + objectif + déclencheurs + possibilités de résolution + conséquences. Une rencontre peut être un signe, une procession, un marché, un accident ou une créature qui fuit.
- **Territoire / lieu :** identité propre, peuple dominant, éventuel clan, fonction, économie, dangers, trafic et statut géographique/canonique.
- **État du monde :** réputation, pénuries, état d'une route, conflit, alerte, passage déjà visité. Conditionne le générateur sans réécrire l'encyclopédie.

### Pipeline logique

1. Choisir un **lieu précis**, un contexte de voyage ou une région non localisée. Son statut canonique et son propriétaire sont récupérés, jamais devinés.
2. Filtrer les **situations plausibles** pour le biome et la fonction (marché, mine, sanctuaire, route, zone sauvage…).
3. Exclure, AVANT tout tirage, les associations sociales/territoriales impossibles.
4. Appliquer les affinités du peuple local, la fréquence de passage, le niveau de danger, la situation de guerre et la saison fictive ou l'activité locale (uniquement si ces états sont définis).
5. Tirer une scène avec une **graine déterministe**. Offrir au MJ les autres choix admissibles.
6. Résoudre effectifs, leaders, civils, gardes, bêtes, occupation de grille et marchandises.
7. Enregistrer **intentions, réactions, moral, issues sans combat et conséquences**.
8. N'attribuer **aucune possession automatiquement comme butin**; distinguer objets portés, propriété du groupe, cargaison, animaux, récoltes et trésors.

## 2. Invariants confirmés du canon Moriquendi

**Sources de référence :** `Tome_II_Les_Domaines_Moriquendi.docx` et `Fiches_Encyclopediques_Tome_II.md` (rubriques `co-domaines-moriquendi`, `co-palissades-moriquendi`, `co-isolement-territorial-moriquendi`, `li-royolo`).

1. Les Moriquendi sont une nation comprenant **exactement cinq clans** : Norrianiss, Warral, Iznogood, Bois-de-l'Est, Drehjur. `Ventreen` est un élément du nom **Ozzoloh Ventreen**, pas un sixième clan.
2. Les Moriquendi peuvent vivre et servir avec d'autres Moriquendi de **clans différents**. Une composition interclanique n'est pas une association avec un peuple étranger.
3. Les étrangers sont **rarement admis sur le territoire Moriquendi**. Le régime d'accès varie selon la Palissade et n'est pas uniformément documenté.
4. Le commerce entre Palissades est **supervisé par les Patrons**; les métiers civils disposent de **guildes et corporations**. Les taux, taxes, tarifs et spécialisations économiques de chaque cité ne sont pas établis.
5. Royolo est le **seul avant-poste moriquendi à la surface**. Sa mission est la surveillance; ce n'est ni une Palissade ni une capitale additionnelle.
6. Les Moriquendi se déplacent aussi par des moyens magiques, mais aucun maillage détaillé de portails, trajet, durée de voyage ou emplacement non publié ne peut être inventé.

### Règles de génération choisies pour LoreSmith (propositions, non nouveaux faits historiques)

| Relation | Politique | Motif |
|---|---|---|
| Moriquendi → Moriquendi, même clan | **Autorisé** | Association interne ordinaire. |
| Moriquendi → Moriquendi, clans différents | **Autorisé** | Appartenance à la même nation. |
| Moriquendi → peuple étranger, groupe ordinaire de camarades | **Bloqué par défaut** | Ne pas transformer une exception en normalité. |
| Moriquendi dirige un groupe avec **serviteurs kobolds** | **Exception nommée et approuvée** | Cas particulier : grand marchand et entourage; nom + circonstance + approbation MJ requis. |
| Kobold marchand → Moriquendi serviteur/employé/escorte sous son commandement | **Interdit dans la génération automatique, même avec exception de groupe** | Asymétrie décisive voulue pour l'univers. Tout changement de règle doit passer par une décision de canon distincte. |
| Visiteurs non-Moriquendi en territoire Moriquendi | **Bloqués par défaut** | Nécessitent une raison et une autorisation ciblées par lieu/groupe. |
| Moriquendi sur route non moriquendi | **Exceptionnelle / décision MJ** | Ne pas transformer une présence rare en circulation régulière. |
| Faune sauvage, insectes, limons, spores en région Moriquendi | **Autorisé si habitat plausible** | La restriction concerne les visiteurs sociaux, pas les animaux naturellement présents. |
| Plusieurs peuples non Moriquendi dans une même caravane | **Possible, sous justification** | Contrat, menace commune, commerce, escorte ou nécessité; aucune alliance universelle implicite. |

**Test obligatoire :** le générateur doit autoriser « marchand Moriquendi + serviteurs kobolds » UNIQUEMENT avec l'ID de scène rare, un chef Moriquendi identifié, `enabled: true`, une justification et l'approbation explicite du MJ. Il doit rejeter « marchand kobold + serviteur Moriquendi » même si l'on inverse simplement les noms ou l'ordre des personnages. Il ne crée aucune nouvelle règle de diplomatie entre peuples.

## 3. Le modèle d'association doit être directionnel

Ne pas construire une simple matrice `espèce A aime / n'aime pas espèce B`. Décrire séparément :

- `species`, `faction`, `clan`, `guild`, `household`, `groupId`, `individualId`;
- `relationType` : famille, appartenance à la même nation, partenaire, client, fournisseur, escorte, salarié, serviteur, captif, ennemi, proie, prédateur, animal de bât, monture, parasite, témoin;
- `direction` : `leader -> member`, `employer -> employee`, `owner -> mount`, `predator -> prey`; **l'inverse n'est pas automatiquement vrai**;
- `consent` : volontaire, contrat, subordination, coercition, inconnu;
- `authority` : commandement, propriétaire de la cargaison, direction militaire, décision civile, aucun;
- `duration` : permanent, mission, voyage, contrat, rencontre fortuite;
- `status` : `canon_confirme`, `fiche_source`, `proposition_mj`, `exception_approuvee`, `inconnu`;
- `evidence` : identifiant de la fiche de lore, ordre du MJ, contrat, témoignage, nom du responsable;
- `sharedGoal` : objectif concret qui justifie leur présence simultanée.

Une patrouille partage une mission et une hiérarchie; des réfugiés de deux peuples peuvent cheminer ensemble **sans être une famille commune**; un orque qui attaque un rat est une scène écologique, pas une alliance orque/rat.

### Niveau de sentience

- `0` : automate/biologie sans conscience exploitable. Pas de négociation, d'économie ou de commandement.
- `1` : instinct. Réagit à la nourriture, à la douleur, à la présence.
- `2` : intelligence animale. Sait chasser, fuir, protéger des petits, reconnaître certaines routines.
- `3` : communication/culture simple possibles; peut avoir des pratiques sociales limitées selon sa fiche.
- `4` : culture, langage, négociation, professions et organisation politique possibles.
- `5` : sentience complexe/exceptionnelle.

Une créature tier 0–2 ne peut pas devenir « marchand », « diplomate », « capitaine » par une assignation de métier générique. Une monture et une bête de somme peuvent toutefois figurer comme dépendants d'un groupe sapient.

## 4. Matrice des factions : comment la lire

Fichier : `data/association-matrix.v1.json` — 13 peuples, politiques orientées. Les cellules Moriquendi sont **bloquées par défaut**; les cellules entre peuples étrangers sont **possibles seulement dans des situations explicites**. Ce fichier ne prétend PAS valider des traités ou hostilités de D&D/Fléau qui ne sont pas dans les sources.

La relation entre **factions** est prioritaire sur le raccourci par espèce : deux compagnies de gobelins peuvent se battre; un mineur duergar et un prospecteur svirfneblin peuvent coopérer pour un chantier; une araignée n'a pas d'affiliation politique.

Ordre d'évaluation : `situation imposée par MJ` → `interdits de canon` → `conditions de propriété du territoire` → `fonction/habitat` → `relation de groupe` → `représentation locale` → `fréquence/poids` → `tirage`. L'intervention du MJ ne doit **jamais** secrètement modifier les règles de canon persistées dans les Archives.

## 5. Composition d'un groupe

Chaque modèle de scène possède :

| Champ | Description |
|---|---|
| `id`, `name`, `kind` | ID stable, nom, type (commerce, travail, faune, patrouille, signe, danger, etc.). |
| `faction`, `groupCategory` | Groupe principal, groupe normal ou exception nommée. |
| `locationTags`, `excludedTags`, `zone` | Fonctions de lieu compatibles, exclusions et type de milieu. |
| `groupMembers[]` | Individus à tirer : `creatureId` existant ou `archetypeId`, `species`, `relationToLeader`, `countDice`. |
| `associationJustification` | Obligatoire pour les groupes multi-espèces étrangers (contrat, exode, commerce, projet commun). |
| `rarity` | `common`, `uncommon`, `rare`, `exceptional`. Une interdiction reste interdite même avec une rareté minime. |
| `initialStance`, `primaryGoal` | Réaction initiale et ce que les acteurs veulent vraiment. |
| `hook`, `branches`, `aftermath` | Accroche, issue paisible/tendue/violente et persistance. |
| `cargo[]` | Marchandises avec propriétaire; aucune récompense automatique. |
| `exceptionId` | Identifiant de l'exception à approuver explicitement. |
| `status`, `tags` | Traçabilité (`proposition_mj`), `Underdark`, `Encounter`. |

**Important :** `creatureId` pointe vers une fiche de la bibliothèque **existante** (`underdark_...`). L'Atlas Fléau possède aussi des identifiants de stats historiques tels que `duergar`, `commoner` dans `src/atlas/statblocks.ts`. Il faudra une couche d'adaptation explicite, **pas une correspondance par chaîne approximative**.

### Tailles et placement

La fiche d'espèce/variante garde sa grille originale, en cases de 5 pieds : Tiny ½×½, Small/Medium 1×1, Large 2×2, Huge 3×3, Gargantuan 4×4 minimum. Une nuée utilise son **emprise de nuée**, pas la taille d'un spécimen. Une monture et son cavalier n'occupent pas deux cases distinctes côte à côte. La forme, l'encombrement de la cargaison et les autres créatures peuvent interdire un pont trop étroit. Le moteur contient un fallback par taille, **mais ne devine pas les footprints pour les PNJ sans fiche de stats**.

### Cohérence logistique

Définir `formation` (avant-garde, milieu, arrière-garde), `leader`, `civilianProtection`, `packAnimals`, `walkingSpeed`, `passageWidth`, `lightEmission`, `foodDays`, `currentFatigue` si on veut placer automatiquement la scène sur la grille. Ces valeurs sont des paramètres de simulation facultatifs, PAS des données déjà confirmées par le corpus.

## 6. Commerce, propriété et butin crédible

Le moteur sépare au minimum :

1. **Objets portés par un individu** : pioche du mineur, bonnet de garde, couteau d'un cuisinier, registre d'un intendant. Ils ont souvent une valeur minime ou un mauvais état.
2. **Marchandises vendues** : denrées, cordes, minerai, cristaux. Elles restent la propriété du négociant ou de la faction.
3. **Équipement collectif** : montures, chariot, tente, outils communs. Pas de « butin » personnel implicite.
4. **Objets contenus dans l'environnement** : caisses oubliées, nid, restes d'une chasse, matériau exploitable.
5. **Prélèvement biologique** : soie, venin, chitin, spores, viande, os, à condition de réussir la récolte et de disposer des outils.

`loot` dans une fiche signifie **potentiel récupérable**, pas automatiquement possédé par les personnages joueurs. Une créature sauvage peut avoir une pierre dans son gésier, mais elle ne transporte pas une bourse de pièces par défaut. Le fait de voler des marchandises peut avoir une conséquence sociale et légale même si aucun combat n'a eu lieu.

### Exemples

- Mineurs svirfneblins : pioches, lampes, outils de mesure, cailloux, sac de nourriture; une roche intéressante éventuelle, jamais garantie.
- Patrouille gobeline : arcs courts, flèches usées, signal de guet, ration détrempée.
- Marchand duergar : poids commerciaux, registre, lingots et caisses appartenant au convoi.
- Famille gobeline : couverture, jouet, marmite, pièces de réparation; **ne pas** attribuer un trésor simplement parce qu'un enfant est présent.
- Araignée : soie, venin, mue; ressources conditionnées par la présence d'un nid et une récolte.

## 7. Réactions et comportements sociaux

Une scène a un **état initial** (`friendly`, `neutral`, `wary`, `hostile`, `afraid`, `unaware`) et peut évoluer après les actions des joueurs : parole, menace, vol, offrande, aide, fuite, intrusion, attaque, rapport de force. `hostile` ne veut pas forcément dire « combat immédiat » : des gardes peuvent exiger le départ; une bête territoriale peut faire une démonstration de force puis renoncer.

Prévoir les déclencheurs :
- `triggerAttack` : attaque subie, nid menacé, intrusion interdite, faim, ordre reçu;
- `triggerFlee` : blessure, nombre défavorable, petit menacé, leader défait;
- `triggerTrade` : marchandises intéressantes, autorisation, langue commune;
- `triggerAid` : secours, réputation, intérêt commun;
- `triggerReport` : intrusion, infraction, message diplomatique;
- `endState` : ignorés, renseignement obtenu, commerce conclu, dette, poursuite, ennemi déclaré, fuite, mort.

**Ne pas inventer un alignement moral racial.** Les objectifs et les circonstances orientent le comportement; même un prédateur peut ignorer les joueurs s'il vient de manger.

## 8. Pondération par territoire et fréquence

Le moteur initial utilise des **règles de blocage** puis une pondération indicative :

- même peuple qu'un site possédé : **4× le poids de base**;
- visiteur étranger non-Moriquendi dans un site possédé : **0,06×**, si le groupe est explicitement valide;
- faune pertinente dans un site habité : **0,65×**;
- groupe indépendant : **0,4×**;
- trafic fort / faible : **1,8× / 0,4×** sur caravane, commerce, voyageurs (si l'état est renseigné);
- guerre active : **1,5×** sur patrouilles et troupes (si état renseigné).

Ces coefficients sont **des paramètres de jeu initiaux**, pas une mesure canonique des populations. Tous les paramètres se calibrent dans une interface MJ plus tard. Leur objectif est qu'une mine duergar fasse principalement rencontrer des équipes duergar, tout en laissant de rares missions interpeuples plausibles.

Ne pas déduire une densité réelle de population à partir d'un niveau de zoom. `unknown` vaut « à renseigner », pas « trafic moyen ». Les lieux `demo` ne deviennent pas canon après une rencontre.

## 9. Difficulté, pacifisme et scènes sans acteurs

Une rencontre peut être `kind: sign`, `hazard`, `ecology` ou `exploration` avec `groupMembers: []`. Il faut alors créer une **fiche de scène** sans fausse fiche monstre ni combat : empreintes, pont effondré, caravane déjà passée, cadavre, colonie d'insectes au repos, végétation consommable, odeur d'une forge à proximité.

Pour les combats, le moteur de rencontres donne des groupes et leurs tailles, **pas encore un CR équilibré au niveau du groupe**. Une version future doit calculer l'économie d'actions, la vitesse, le terrain, les sauvegardes, la taille du groupe de joueurs et ses ressources avant de prétendre que la rencontre est facile ou mortelle.

Le système peut aussi tirer **« aucune rencontre »**, à distinguer d'un indice environnemental. Ce choix doit être contrôlé par la fréquence de voyage/heure/jour de l'itinéraire; la première version fournit un tirage forcé de scène uniquement. Ne pas créer un combat à chaque déplacement.

## 10. Conséquences persistantes : modèle recommandé

Après résolution d'une rencontre, enregistrer dans la **campagne** (pas le canon mondial) :

```json
{
  "eventId": "campaign-example-001",
  "universeId": "underdark",
  "locationId": "cite-kharaz-dumel-0-galerie-des-arrivants",
  "templateId": "enc_075",
  "result": "trade_completed",
  "factionDelta": [{"faction": "duergar", "reputationChange": 1}],
  "cargoTransferred": [],
  "casualties": [],
  "routeChange": "none",
  "canonWriteBack": false
}
```

`eventId` et `locationId` ci-dessus sont **illustratifs** : le champ `locationId` doit provenir de l'index réellement généré avant toute sauvegarde. Le MJ peut activer la persistance de certains individus nommés et retrouver les conséquences lors d'une visite ultérieure.

## 11. Fichiers fournis et limites de la V1

- `data/association-policy.v1.json` : paramètres de factions, relations, sentience, économie, hostilité et butin.
- `data/association-matrix.v1.json` : matrice 13×13 avec traitement asymétrique Moriquendi.
- `data/npc-archetypes.v1.json` : **32** archétypes civils/utilitaires, dont 17 rôles Moriquendi à statblocks encore non définis.
- `data/encounter-templates.v1.json` : **89** rencontres explicites taguées `Underdark`.
- `data/creature-refs.v1.json` : références validées de variantes du bestiaire existant, empreintes et possessions potentielles.
- `scripts/engine.mjs` : lecture, validation, composition, tirage déterministe en Node.
- `integration/browser-core.mjs` et `integration/encounter-browser.ts` : version pour une application Vite/React sans appels Node.

**Ce qui est déjà exécutable** : composition, exceptions Moriquendi, filtres territoriaux, fonction des lieux, sélection pondérée, comptes de groupe par dés, équipement potentiel, séparation de la cargaison, taille/grille et reproduction par graine.

**Ce qui reste à développer par Claude dans l'application** : affichage des scènes, mapping entre IDs Atlas de Fléau et fiches LoreSmith, import des vrais PNJ Moriquendi, économie des actions, génération d'un plan de combat, résolution des transactions, persistance, réputation, fréquence d'apparition et état du monde. Aucune de ces intégrations n'est prétendue terminée.

## 12. Scénarios d'acceptation (tests de canon)

- [ ] Mori Norrianiss + Mori Drehjur dans une même patrouille : autorisé.
- [ ] Marchand kobold + serviteur Moriquendi : refusé même si le générateur essaie de modifier l'ordre.
- [ ] Marchand Moriquendi célèbre et porteurs kobolds : refusé sans une exception nommée **explicitement activée** par le MJ.
- [ ] Même exception avec un chef nommé, justificatif et validation MJ : autorisée **pour la scène**; aucun changement global.
- [ ] Marchand gobelin dans une Palissade : refusé par défaut.
- [ ] Araignée en territoire Moriquendi : possible si habitat adapté (ce n'est pas un visiteur étranger).
- [ ] Mineur svirfneblin + guide duergar : seulement avec raison professionnelle explicite.
- [ ] Mineur muni d'une pioche; cargaison non auto-lootée.
- [ ] Monstre non sentient ne devient pas marchand par tirage de métier.
- [ ] Une rencontre de signe ou danger ne crée pas des créatures artificielles.
- [ ] La taille des créatures et montures est conservée jusqu'au placement sur la grille.
- [ ] Les résultats de campagne ne réécrivent pas la vérité encyclopédique.
