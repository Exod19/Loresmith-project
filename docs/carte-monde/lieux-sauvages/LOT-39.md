# Lot 39 (série lieux sauvages) : tout le monde à sa place au lancement du combat, le PNJ parle le premier (statut : à valider)

## Ce qui change

- **Créatures placées avec sens** (`placeEncounter`, contexte du plateau). Chaque groupe d'une rencontre reçoit une
  posture (`postureOf`), d'après son rôle, son nom et sa fiche :
  - **montés** (cavaliers, patrouille à cheval, montures) : dehors, devant l'entrée du bâtiment, jamais dedans ;
  - **gardes**, soldats, sentinelles : dedans, près de la porte ;
  - **tireurs** (archers, frondeurs, mages, prêtres, éclaireurs) : à distance des héros (environ 7 cases), à couvert ;
  - **embusqués** (rôdeurs, assassins, araignées, ombres) : derrière un obstacle, à 4 ou 6 cases ;
  - **au contact** (les autres) : à portée de charge (environ 3 cases).
  - Personne n'est collé aux héros au premier round. Un même groupe reste au coude à coude, ou s'espace pour les
    tireurs et les embusqués.
  - Une même rencontre donne toujours la même disposition. Les créatures restent cachées aux joueurs jusqu'à ce que le
    MJ les révèle.
- **Héros à leur place.** Ils sont posés là où se trouve le groupe sur la carte de navigation. Quand le groupe n'est
  pas encore sur le plan du bâtiment, ils arrivent par son entrée plutôt qu'au centre.
- **Le PNJ ouvre la conversation.**
  - En cliquant sur un PNJ de la carte (mode MJ), un bouton « 💬 Parler à … » ouvre la conversation.
  - L'IA joue le PNJ, qui prend la parole le premier : salut, interpellation ou réaction à l'arrivée des héros, selon
    son humeur, l'heure, ce qu'il sait d'eux et ce qui s'est passé ici.
  - Même chose pour « Parler » à une créature d'une rencontre.
- **La conversation connaît l'histoire.** Le PNJ reçoit les événements de sa cité (« ce qui s'est passé ici, c'est ton
  histoire ») et l'état des bâtiments touchés (en ruine, en chantier, reconstruit), en plus de ses souvenirs et des
  rumeurs.

## Vérifications

- Test (`combatmove.test.mjs`) : dans un bâtiment avec porte, héros au milieu :
  - deux cavaliers dehors ;
  - le garde près de la porte, à l'intérieur ;
  - les archers à 4 cases ou plus ;
  - personne au contact.
- Dans le navigateur, taverne de Brumeval, avec une IA simulée : clic sur Aliénor, puis « 💬 Parler à Aliénor ». Elle
  parle la première, sans que le MJ ait rien écrit.
- 273 tests côté site, 14 côté serveur ; build réussi ; lint sans erreur.

## Fichiers

- Combat : `src/maps/battle/encounter.ts`, `BattleMode.tsx`, `combatmove.test.mjs`.
- Conversation : `src/maps/world/TalkPanel.tsx`, `src/maps/MapViewer.tsx`.
- Zones à risque : non touchées.
