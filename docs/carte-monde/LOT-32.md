# Lot 32 : le retour des héros (lot E du monde vivant)

- **Passages** : chaque fois que le groupe change de plan (voyage, « Le groupe est ici », entrée dans un bâtiment), ses
  passages sont notés (`world.visits`, `src/maps/world/retour.js`). Les clés sont la cité (`…-c-<id>`) et chacun de ses
  bâtiments (`…:b12`). Le plan quitté est noté aussi.
- **Récit du retour** : en revenant dans un lieu après au moins 6 heures de jeu, si quelque chose a changé, le MJ voit
  en haut du panneau une carte « 🔁 Depuis votre dernier passage ». Elle donne le lieu, depuis quand, et la liste :
  - les nouveaux événements ;
  - leurs suites appliquées depuis (une suite validée compte à l'instant de la décision : un chantier accepté hier est
    une nouvelle) ;
  - les PNJ qui en gardent un sentiment.
- **Pour les joueurs** : le MJ peut montrer ce qui se voit sur place (ruines, chantiers, maisons délaissées) et ce qui
  se raconte (rumeurs) : une carte « Depuis votre dernier passage » s'affiche sur leur écran. Les sentiments des PNJ et
  les événements cachés restent au MJ. Il retire la carte d'un clic ; la fermer côté MJ la retire aussi.
- **Bâtiments** : les ruines et les chantiers se voyaient déjà sur le plan (lot 30). La fiche du lieu les indique.
- **Effraction** : son titre suit les articles du lieu (« Effraction à la forge »).

## Tests

`retour.test.mjs` :
- lieux où l'on revient ;
- retour un mois plus tard (ruine visible, rancune réservée au MJ) ;
- pas de récit pour un premier passage ni pour un aller-retour de quelques heures ;
- un chantier accepté pendant l'absence est une nouvelle.
