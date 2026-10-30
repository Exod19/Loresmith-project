# Carte du monde : lot 11, conversations IA avec les PNJ (statut : validé)

## Ce qui change

- **💬 Parler.** En mode Exploration, un PNJ sélectionné propose « 💬 Parler », à côté de « 🎭 Y aller ».
  - Le PNJ peut venir du lore, être un occupant généré ou avoir une fiche créée par le MJ.
  - Ton personnage le rejoint et la conversation s'ouvre dans le panneau.
  - Entrée envoie la réplique ; Maj+Entrée va à la ligne.
- **L'IA joue le PNJ** à la première personne, d'après :
  - sa fiche dans la Bibliothèque, s'il en a une, et ce qu'on sait de lui ;
  - le bâtiment, la cité, sa taille et son climat ;
  - le moment de la journée et la saison : il parle du temps qu'il fait ;
  - ton personnage (nom, rôle, apparence) ;
  - le lore de l'univers (canon, Bibliothèque, mémoire vivante), trié selon le sujet.
- **Lore proposé.** Quand l'IA invente un lieu, un PNJ, une rumeur ou un fait, elle le propose sous sa réplique. Tu acceptes ou tu rejettes.
  - Un lieu ou un PNJ accepté devient une fiche de la Bibliothèque, située dans la cité. Un lieu accepté se pose ensuite tout seul sur un bâtiment non découvert, comme toute fiche de lieu.
  - Une rumeur acceptée devient une fiche « mystère ».
  - Un fait accepté complète la fiche du PNJ, ou à défaut celle du lieu.
- **Rêverie ou Chronique.**
  - En Rêverie, rien n'est gardé, sauf le lore accepté.
  - En Chronique, à la clôture, la conversation entre dans la mémoire de l'univers : qui, où, quand, les sujets, la dernière réponse et le lore retenu. Les autres outils d'IA s'en souviendront.
- **Clé d'IA.** La conversation utilise l'IA configurée dans Réglages, avec la clé de l'utilisateur, qui reste dans le navigateur. Sans clé, le panneau le dit.

## Fichiers

- Nouveaux : `src/maps/world/talk.js` (prompt et lecture de la réponse, sans dépendance), `talk.d.ts`, `TalkPanel.tsx`.
- Modifiés :
  - `world/ExplorePanel.tsx` (bouton Parler) ;
  - `MapViewer.tsx` (passage des props) ;
  - `MapsPage.tsx` :
    - contexte du lore via `buildLoreContext` ;
    - mise à jour d'une fiche (`UPDATE_LIBRARY_ENTRY`) ;
    - mémoire de l'univers (`UPDATE_UNIVERSE`, `memoryLog`, au même format que la mémoire assimilée) ;
  - `atlas/atlas.css` ;
  - `world.test.mjs` (un nouveau test).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés : les actions existantes suffisent.

## Vérifications

- Les tests couvrent le prompt (fiche, lieu, cité, saison, climat, moment, avatar, mode, lore), la lecture de la réponse et des propositions, et le résumé de la chronique.
- Navigateur, avec une IA simulée :
  - le prompt envoyé contient bien Margot, La Chope Cassée, Brumeval, l'hiver, le soir et le Chroniqueur ;
  - la proposition « Le Vieux Moulin » acceptée devient une fiche de lieu à Brumeval, la rumeur rejetée ne laisse rien ;
  - en Chronique, la clôture ajoute la conversation à la mémoire de l'univers.

## Limites

- On parle aux PNJ, pas encore aux monstres des rencontres.
- La conversation n'est pas projetée sur l'écran des joueurs.
