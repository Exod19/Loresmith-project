# Mandat à coller dans Claude Code — LoreSmith Campaign Studio V3

Tu travailles sur mon application LoreSmith existante. Je te fournis deux fichiers :

- `campaign-studio-v3.html` : prototype interactif autonome illustrant le look et les interactions attendus;
- `CAHIER_DES_CHARGES_V3.md` : cahier des charges UX, narratif, logique et technique.

## Objectif produit

Remplacer le générateur de campagnes par **Campaign Studio V3**, un atelier de création guidée et de préparation complète. Un MJ débutant doit pouvoir écrire une campagne dans son univers, visualiser son évolution de la première à la dernière scène, créer uniquement les fiches nécessaires et **préparer toutes ses scènes et ressources avant la séance 1**. Il doit savoir exactement ce qui reste à faire, et disposer d'un dossier MJ prêt à consulter ou imprimer. Le Scribe aide, suggère et détecte; il ne remplace pas les décisions du MJ.

## Contraintes absolues

1. **Ne réécris pas le projet from scratch.** Inspecte les composants existants, les flux de données, le reducer, la persistance, les clés de sauvegarde et les modules Universe Builder, Campaigns, Library, Party, NPCs & Monsters, Combat, Scene Runner, Images et Conjure. Réutilise leurs systèmes.
2. Les éléments du canon de l'univers sont sources de vérité et ne doivent jamais être écrasés par des suggestions de l'IA.
3. Une scène « prête » nécessite du contenu et des ressources **effectivement présents et validés**, pas une simple case cochée.
4. Préparation globale et progression des séances réellement jouées sont deux états différents.
5. Une fiche PNJ ou monstre est unique et partagée entre les scènes; les instances physiques de combat sont distinctes.
6. Toutes les scènes obligatoires et conditionnelles, ainsi que leurs issues et ressources nécessaires, doivent être vérifiées avant d'autoriser le lancement de la première séance.
7. Chaque modification d'un élément source invalide les audits et dépendances concernés. Ne revalide pas automatiquement.
8. L'IA doit proposer les changements sous forme de brouillons révisables (source / faits confirmés / propositions / inconnus), avec approbation explicite.
9. L'interface doit respecter l'esthétique LoreSmith existante. Le HTML n'est pas un module prêt à copier tel quel dans React; il sert de référence visuelle et comportementale.
10. Ne supprime aucune donnée utilisateur ou campagne existante et ne casse pas l'export/import des backups.

## Méthode de livraison

Commence par le **Lot 0 : audit de l'architecture réelle**. Donne-moi un inventaire clair des composants et des points de raccordement, un plan des nouveaux états/actions et une proposition de migration avant de modifier des fichiers.

Ensuite, implémente **un lot à la fois** en suivant l'ordre du cahier des charges. Après chaque lot :

- Expliquer ce qui a été changé côté produit, avec les fichiers affectés.
- Vérifier le build, les erreurs React et les interactions critiques.
- Faire un commit cohérent et un push si le dépôt est correctement configuré et si l'opération est autorisée, pour que l'aperçu se mette à jour.
- Donner une courte liste de vérifications manuelles dans l'interface.
- Ne pas attaquer les modules Combat, Scene Runner ou Images avant d'avoir des contrats d'objets stables.

## Première livraison attendue

**Lot 0**, puis **Lot 1** : nouvelle navigation, centre de commandement, fondations guidées, vrais compteurs de préparation et stockage compatible avec les campagnes existantes. Les vues suivantes pourront ensuite s'ajouter sans devoir modifier l'architecture de données au complet.

## Définition de réussite

Un MJ peut commencer avec une idée d'une phrase, bâtir tous ses chapitres et scènes, inspecter son histoire du début à l'épilogue, compléter les ressources utiles, lancer un audit, résoudre tous les blocages puis produire son dossier MJ. S'il oublie une sortie de scène, un monstre, un indice, une règle de piège ou une conséquence majeure, **LoreSmith doit le lui signaler avant la première séance**.
