# Carte du monde : lot 5, vie des bâtiments et moment de la journée (statut : validé)

## Ce que fait le lot

- **Moment de la journée** : un sélecteur dans la barre de la carte du monde propose quatre moments (🌅 matin, ☀ jour, 🌇 soir, 🌙 nuit). Il décide qui se trouve dans chaque bâtiment. Le soir et la nuit, les plans s'assombrissent, aussi sur l'écran des joueurs.
- **Chaque bâtiment a sa vie propre** : son personnel, sa clientèle et ses heures d'ouverture.

  | Bâtiment | Personnel | Fréquentation | Fermé |
  |---|---|---|---|
  | Taverne, auberge | tavernier, serveur | clients, peu le matin, pleine le soir (buveurs, joueurs de dés, musicien, habitués…) | jamais |
  | Échoppe | marchand | clients et badauds | la nuit |
  | Forge | forgeron, apprenti | clients | la nuit |
  | Temple | prêtre, acolyte | fidèles, nombreux le matin ; un pèlerin, un mendiant | jamais |
  | Guilde | maître, garde | membres | la nuit |
  | Caserne | sergent, garde | soldats ; la nuit, ils dorment au dortoir | jamais |
  | Donjon | gardes, intendant | courtisans, serviteurs, solliciteurs | jamais |
  | Hôtel particulier | domestique | visiteurs le soir | jamais |
  | Maison, ferme | — | la famille, absente le jour ; la nuit, elle dort | jamais |
  | Entrepôt | manutentionnaire | manutentionnaires ; un veilleur la nuit | la nuit |
  | Écurie, atelier | palefrenier ; artisan et apprenti | — | la nuit |

  - Le personnel anonyme n'est ajouté que si le lore n'a pas déjà quelqu'un à ce poste. Avec Margot à la Chope Cassée, pas de second tavernier.
  - Un bâtiment fermé n'a personne au rez-de-chaussée, sauf le veilleur. Son personnel du lore (comptoir, enclume…) monte dormir à l'étage s'il y en a un.
  - Les étages suivent l'heure : les chambres sont pleines la nuit et vides le jour ; le chambellan n'y est pas la nuit, le commis rentre chez lui le soir.
  - Les prisonniers ne bougent pas.
- **Toujours les mêmes** : un même bâtiment, au même moment, a toujours les mêmes occupants, avec le même prénom, le même rôle accordé et la même ligne de description.
- **Créer la fiche d'un occupant** : le bouton « Créer la fiche de… », sur un occupant anonyme, crée son PNJ dans « PNJ & créatures » (nom, rôle, description, lieu). L'occupant devient un résident : il reste à l'endroit exact où il était, à toute heure, et n'est plus tiré au sort.

## Fichiers

- `src/maps/world/interior.js` : horaires, occupants, résidents.
- `src/maps/world/generate.js` : moment de la journée, résidents, lumière.
- `src/maps/world/generate.d.ts`, `src/maps/world/interior.d.ts`, `src/bestiary/entityGen.d.ts` : types.
- `src/maps/MapViewer.tsx` : sélecteur de moment, bouton « Créer la fiche ».
- `src/maps/MapsPage.tsx` : la fiche créée passe par `ADD_NPC`, l'action existante.
- `src/maps/atlas/MapCanvas.tsx`, `src/maps/atlas/types.ts`, `src/maps/atlas/atlas.css` : lumière.
- `src/maps/world/world.test.mjs` : un test de plus.

Aucune zone sensible n'a été touchée : ni `App.jsx` ni `persist.js`.
