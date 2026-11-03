# Lot 30 : le monde réagit au temps qui passe (lot C du monde vivant)

Chaque événement de la mémoire du monde a des suites (`src/maps/world/consequences.js`), selon sa nature, le lieu et le
temps écoulé. Elles s'ajoutent quand l'horloge avance (`passTime` : voyage, repos, fouille, avance du MJ) et quand on
inscrit un événement (`evolve`).

## Petites suites automatiques, grosses suites validées par le MJ

| Nature | Suites automatiques | Suites proposées au MJ |
|---|---|---|
| Incendie d'un bâtiment | ruine aussitôt, déblaiement à 5 jours | chantier à 30 jours, puis « Nouvel(le) … » rebâti à 150 jours (seulement si le chantier a été accepté) |
| Destruction | ruine | chantier à 45 jours, rebâti à 180 jours |
| Cadavre laissé | à 1 jour, son sort (voir plus bas) | enquête de la milice, si les héros l'ont laissé et qu'il a été découvert |
| Mort | la rumeur, au bout d'une demi-journée | les proches réclament justice (rancune), si les héros en sont les auteurs |
| Vol | plainte | rancune du volé envers les héros |
| Effraction | la maison change de serrure | la garde redouble de rondes |
| Agression | — | le PNJ a peur des héros |
| Humiliation | — | le PNJ garde rancune |
| Aide | — | le PNJ est reconnaissant |
| Accord | le PNJ en parle | — |
| Lieu délaissé | poussière à 7 jours, puis squatteurs, bêtes ou rumeur de hantise à 30 jours | — |
| Toute affaire notable ou grave où les héros ont joué un rôle | la rumeur court en ville au bout d'un jour | — |

- **Sort d'un cadavre** : en pleine nature, il est souvent dévoré par les bêtes, parfois emporté par un nécromancien,
  parfois découvert. En ville ou sur une route, il est presque toujours découvert par la milice.
- **Tirages stables** : chaque tirage est réglé par l'identifiant de l'événement. Avancer de 40 jours d'un coup ou jour
  par jour donne le même monde.
- **Décisions** : « Conséquences à valider » (onglet Journal, compteur sur l'onglet) → Accepter ou Refuser. Une suite
  refusée bloque celles qui en dépendent.

## Ce qui en découle

- **Carte** : un bâtiment en ruine (carcasse noircie, braises), en chantier (échafaudages) ou délaissé se voit sur le
  plan de la cité, chez le MJ et chez les joueurs. Sa fiche l'indique (« 🔥 En ruine »).
- **PNJ** : sa fiche (MJ) dit ce qu'il ressent (rancune, peur, reconnaissance) et ce dont il se souvient. En dialogue,
  l'IA le sait aussi, ainsi que les rumeurs qui courent dans sa cité ; il en parle à sa manière.
- **Journal** : chaque événement montre ses suites, datées : de lui-même, accepté ou refusé.

## Tests

`consequences.test.mjs` :
- l'église incendiée : ruine, chantier et reconstruction validés, nom du nouveau bâtiment, rumeur ;
- le cadavre sur une piste : même sort en une ou plusieurs fois, souvent dévoré en forêt ;
- le PNJ humilié : rancune après acceptation, rien après un refus ;
- la maison délaissée ;
- les articles devant les noms de lieux.
