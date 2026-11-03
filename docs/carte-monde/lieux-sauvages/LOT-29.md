# Lot 29 : horloge et mémoire du monde (lots A et B du monde vivant)

## Horloge du monde (`src/maps/world/clock.js`)

- Chaque monde a sa date de jeu (`world.clock` : jour, minute, jour dans la saison) : « Jour 12 · 14 h 30 ». Elle
  avance selon ce que font les personnages, jamais selon le temps réel :
  - voyage : les heures de marche du groupe ;
  - combat sur la carte du monde : 6 secondes par round ;
  - fouille d'une pièce : 10 min ;
  - le MJ, à la main (onglet Journal) : + 10 min, repos court (1 h), repos long (8 h), jusqu'à l'aube, jusqu'au soir,
    + 1 jour, + 1 semaine, ou une durée libre (minutes, heures, jours, semaines, mois).
- Le moment de la journée en découle : matin à 6 h, jour à 11 h, soir à 17 h, nuit à 22 h. Le sélecteur de moment
  avance maintenant le temps jusqu'au moment choisi.
- La saison, si le MJ en a choisi une, change d'elle-même tous les 91 jours.
- Un monde sans horloge démarre au Jour 1, au moment qu'il avait.
- L'horloge et la mémoire n'entrent pas dans la clé du cache de génération : avancer de quelques minutes ne régénère
  pas la carte. Seul un changement de moment de la journée ou de saison le fait.

## Mémoire du monde (`src/maps/world/worldEvents.js`, onglet 🕰 Journal)

- Chaque événement (`world.events`) porte :
  - une date (à la minute) ;
  - un titre et des détails ;
  - une nature : incendie, destruction, mort, cadavre laissé, vol, effraction, agression, humiliation, aide, accord,
    lieu délaissé, découverte, rumeur, autre ;
  - un lieu de la carte ;
  - les PNJ touchés ;
  - l'implication des héros : auteurs, témoins, victimes, ou sans eux ;
  - une gravité : mineur, notable, grave.
- On l'inscrit à la main (lieu proposé : le lieu choisi, sinon celui du groupe).
- On peut aussi coller ses notes de séance : l'IA propose les événements qui changent le monde, en reprenant les noms
  des lieux et des PNJ connus. Le MJ coche ce qui est vrai ; rien n'est inscrit sans lui.
- Liste du plus récent au plus ancien, avec « il y a … » et un lien vers le lieu sur la carte.

## La suite

- Lot C : le monde réagit au temps qui passe. Petits effets automatiques ; gros effets (bâtiments, PNJ) proposés au
  MJ.
- Lot D : la nuit et l'effraction.
- Lot E : « depuis votre dernier passage ».

## Tests

`clock.test.mjs` : avance par voyage, repos et rounds ; moment de la journée ; saison tous les 91 jours ; temps écoulé
en mots ; événements datés, triés, situés ; notes de séance lues.
