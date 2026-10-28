# Campaign Studio V3 — Lot 1 : centre de commandement, fondations, préparation réelle

## Ce qui change pour le MJ

- **Campagnes** ouvre maintenant le Campaign Studio, dans le shell Loresmith (couleurs, Cinzel / EB Garamond, coins de laiton, cuir).
- **Choix de campagne** : chaque campagne affiche son pourcentage de préparation et son état (verrouillée, à valider, prête).
  « Nouvelle campagne guidée » ouvre les Fondations ; « Forge rapide » garde l'ancien brief sur un écran.
- **Onglets du studio** : Vue d'ensemble, Fil de campagne, Dossiers des scènes, Registre, Avant la séance 1, Fondations.
- **Le Scribe** (colonne droite, sous le contenu sur petit écran) : état du projet, points surveillés, conseil, et questions libres.
  Il suggère seulement ; rien n'est modifié sans le MJ.
- **Vue d'ensemble** : 4 compteurs calculés sur le contenu réel, trajectoire actes → scènes cliquable, inventaire et couverture,
  prochaines actions triées par risque, plan des séances (durée prévue contre durée cible, marge).
- **Fondations** : 6 étapes, une question à la fois, « Propose une piste » (marquée « Proposition du Scribe » jusqu'à ce que le
  MJ la garde ou la modifie), « Je déciderai plus tard ». L'étape « Les joueurs » fixe groupe, niveau et édition (2014 par défaut).
  L'étape « Le canevas » fait écrire actes, séances et scènes par le Scribe, ou crée des séances vides à remplir.
- **Dossiers des scènes** : liste des scènes, contrôle de préparation avec la raison de chaque manque, l'essentiel modifiable
  (importance, durée, texte à lire, objectif, sorties, plan B), puis le lore complet de la scène.
  « J'ai relu : la scène est jouable » n'est possible que si les points essentiels sont remplis.
- **Registre** (version intermédiaire) : PNJ, créatures (avec le nombre d'instances) et lieux demandés par les scènes, fiche
  existante ou à créer, et création de la fiche en un clic.
- **Avant la séance 1** : contrôle de toute la campagne, bloquants, scènes à valider, avertissements.

## Règles de préparation (src/studio/prep.js)

- Une scène est **prête** seulement si ses contrôles essentiels passent ET si le MJ l'a validée.
- Toute modification du contenu après validation la remet **à revoir**. Changer le niveau, la taille du groupe ou l'édition
  remet à revoir les seules scènes avec combat. Pas de revalidation automatique.
- Contrôles essentiels : texte à lire, objectif, sortie (sauf dernière scène), plan B, PNJ avec motivation ou rôle,
  rencontre complète (créatures et tactique) et groupe défini pour les scènes de combat. Avertissements : tests sans DD,
  énigme sans indice ni test.
- La progression jouée (guide de la carte) reste distincte de la préparation.

## Données

- `src/studio/migrate.js` : migration V3 au chargement, à l'import de sauvegarde et à la création (identifiants d'actes et de
  séances, rattachement des scènes, fondations avec valeurs inconnues). Rien n'est supprimé ni inventé ; aucune scène n'est
  validée par la migration.
- Nouveaux champs : `schemaVersion`, `foundations`, `scene.importance`, `scene.timeEstimate`, `scene.prepReview`
  (`hash` du contenu validé, `partySig`), `expanded.fallback`.

## Vérifications manuelles

1. Campagnes : une ancienne campagne apparaît avec un pourcentage, sans perte de scènes.
2. Ouvrir une scène complète, la valider, modifier son texte : elle passe « À revoir ».
3. Valider une scène de combat, changer le niveau du groupe dans Fondations › Les joueurs : seule elle repasse « À revoir ».
4. Nouvelle campagne guidée : « Propose une piste », puis « Le canevas » › « Écrire le canevas avec le Scribe ».
5. Exporter puis réimporter une sauvegarde : les campagnes et validations sont conservées.

## Hors Lot 1

Graphe et matrice d'évolution (Lot 2), dossier de scène complet avec choix structurés (Lot 3), registre avec brouillons
approuvables (Lot 4), instances et jetons de combat (Lot 5), audit scellé, répétition générale et dossier MJ imprimable (Lot 6),
Scene Runner (Lot 7).
