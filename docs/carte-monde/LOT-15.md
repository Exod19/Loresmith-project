# Carte du monde : lot 15, parler aux créatures et conversation chez les joueurs (statut : à valider)

## Ce qui change

- **💬 Parler aux créatures d'une rencontre.** Le bouton n'est proposé qu'aux créatures qui peuvent parler. La règle (`world/speech.js`) lit leur bloc de statistiques :
  - pas de langue (« — ») : elle ne parle pas. Loup, araignée géante, vase, crabe…
  - « comprend… mais ne parle pas » : elle ne parle pas. Zombi, squelette…
  - Intelligence de 3 ou moins : elle ne parle pas.
  - télépathie : elle « parle » dans l'esprit de son interlocuteur.
  - sans bloc de statistiques connu : on ne suppose rien, et on invite le MJ à compléter ses langues.

  Les autres affichent « 🔇 ne parle aucune langue » (ou la raison). L'IA joue la créature selon sa nature, ses langues (elle ne parle pas couramment une langue qu'elle ignore) et son intelligence : phrases courtes et besoins immédiats pour une créature très peu intelligente, langage riche pour une créature brillante. Le lore proposé, la Rêverie et la Chronique marchent comme pour les PNJ. Hors de la carte du monde (l'Atlas des profondeurs), c'est « le groupe » qui parle.
- **📺 Montrer aux joueurs.** Une case du panneau de conversation affiche la conversation sur l'écran des joueurs : nom et portrait, puis les dernières répliques, au fil de la discussion. Elle disparaît à la clôture. Elle est décochée par défaut : en Rêverie, le MJ reste seul.

## Vérifications

- Les tests couvrent un crabe, un loup, un zombi, un drow, une créature télépathe, une créature d'Intelligence 2 et une créature sans bloc de statistiques.
- Dans le navigateur, avec une IA simulée, sur une rencontre de 3 drows, un loup et une araignée :
  - seul l'éclaireur drow propose « Parler » ;
  - le prompt contient sa nature et ses langues ;
  - la conversation apparaît sur l'écran des joueurs.

## Fichiers

- Nouveaux : `world/speech.js`, `speech.d.ts`.
- Modifiés :
  - `world/TalkPanel.tsx` : créatures, partage, monde facultatif ;
  - `world/ExplorePanel.tsx` ;
  - `MapViewer.tsx` : bouton Parler dans les créatures d'une rencontre, partage ;
  - `mapStore.ts`, `playerBoard.ts`, `present/stage.ts`, `present/PlayerScreen.tsx` : conversation chez les joueurs ;
  - `battle/battle.css` ;
  - `world.test.mjs`.
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.
