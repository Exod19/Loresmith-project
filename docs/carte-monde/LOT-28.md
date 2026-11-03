# Lot 28 : routes, chemins et sentiers de la carte du monde

Les voies relient maintenant les grands lieux de façon logique, du plus sûr au plus sauvage (`src/maps/world/voies.js`,
tracées dans `terrainV2` de `src/maps/world/generate.js`).

## Voies

| Voie | Tracé | Où | Patrouilles et fréquentation | Allure | Repérage | Danger |
|---|---|---|---|---|---|---|
| Route royale | large, claire | entre deux grandes cités (2 500 habitants et plus), ou entre une très grande cité (5 000) et une cité moyenne (1 200) | pavée, entretenue, patrouillée par la garde, très fréquentée | 1 | évidente | Sûr |
| Chemin | terre battue | entre une cité et ses voisines plus modestes, par les hameaux | patrouilles rares, fréquenté | 1,1 | évident | Sûr |
| Sentier | tirets | vers un lac, une forêt ou un lieu sauvage, depuis la route ou le village le plus proche | aucune patrouille, peu fréquenté | 1,3 | Perception 10 | Praticable |
| Piste forestière | pointillés | un sentier qui passe surtout sous les arbres | rarement empruntée ; Sagesse (Survie) DD 12 pour ne pas s'égarer | 1,6 | Perception 13 | Incertain |
| Sentier de montagne | pointillés | vers les sommets, par les cols | chevriers et contrebandiers ; éboulis, vent, à-pics | 1,6 | Perception 12 | Incertain |

- Deux grandes cités assez proches (moins de 60 % de la largeur du monde) ont toujours leur route royale directe.
- Les sentiers sont tracés du plus proche au plus lointain. Chacun devient un départ possible pour le suivant : le
  réseau s'enfonce peu à peu dans la nature, sans ligne droite à travers tout le pays.
- Chaque tronçon fait au plus 60 km (ou 15 % de la largeur du monde) ; 40 sentiers au plus.
- Ils suivent le terrain comme les routes (vallées, cols, contournement des lacs).
- Chaque voie a sa durée (km et jours de marche) et une description pour le MJ : surface, entretien, patrouilles,
  fréquentation.

## Suivre une voie

- `trailProfile` lit le champ `voie` : repérage et danger en mots d'extérieur.
- `hoursOn` applique l'allure de chaque voie à la surface (`SLOW_SURFACE`).
- Les lieux sauvages vus en chemin (`wildAlong`) suivent les sentiers comme les routes : on peut explorer la nature.

## Ce qui ne change pas

- L'Atlas des profondeurs (l'Underdark) et ses galeries.
- Les cités et leurs rues.
- Les mondes à l'ancienne, sans relief à l'échelle.

## Tests

`voies.test.mjs` :
- nature des routes et des sentiers ;
- un monde à l'échelle a une route royale, des chemins et au moins trois sentiers, chacun relié à un lieu qui existe ;
- le même monde à chaque génération.

## Rencontres selon la voie (lot 28 bis)

- La fréquence ne change pas : même jet de 1d20, même seuil.
- Ce qu'on croise dépend de la voie suivie (`VOIE_TABLES` et `surfacePool`, `src/maps/atlas/surfaceEncounters.ts`).
  La voie vient de la route suivie pendant le voyage, ou du bouton « Rencontre ici » sur sa fiche.

| Voie | Ce qu'on y croise | Rencontres propres |
|---|---|---|
| Route royale | marchands, patrouilles (poids × 3), pèlerins ; brigands rares (× 0,15) ; jamais de loups ni de bêtes | grande caravane, courrier royal, marcheurs et colporteurs, péage du pont, relais de poste |
| Chemin | la table de la route ; brigands un peu moins fréquents | marcheurs et colporteurs |
| Sentier | mélange route et nature ; peu de marchands et de patrouilles | bûcherons, braconniers |
| Piste forestière | brigands et loups (× 2,5), araignées (× 2), ours, gobelins ; jamais de caravane ni de patrouille | bûcherons, braconniers, worgs en chasse |
| Sentier de montagne | ogres (× 2,5), orques, loups ; pas d'araignées | chevriers, contrebandiers du col, éboulement |

- Sans voie (hors route), la table de toujours, sans les rencontres propres aux voies.
- Test : `src/maps/atlas/voieEncounters.test.mjs`.
