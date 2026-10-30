# Carte du monde : lot 14, voyages en mer et temps de route réels (statut : à valider)

## Ce qui change

- **Traversées en mer.** Chaque port est relié par la mer à ses deux ports les plus proches.
  - La route maritime est tracée sur l'eau seulement : elle part du point d'eau le plus proche du port et longe les côtes sans les toucher.
  - Elle s'affiche en pointillés clairs, avec sa durée, par exemple « Traversée de Havre-Gris à Port-Sel · 153 km · 1 ½ jour en navire ».
  - Le groupe peut la suivre comme une route.
- **Distances par la route et la mer.** Le panneau combine les deux : « 352 km par la route et la mer (dont 167 km en navire) · 7 jours de voyage ». Un navire fait environ 120 km par jour.
- **🌊 Traverser : découvrir l'autre rive.** Pour une mer, le monde s'étend au-delà, jusqu'à l'autre rive.
  - Ces terres lointaines, un autre continent, reçoivent un nom (« Terres de Rocroche ») affiché sur la carte.
  - On peut y fonder des cités et des ports, reliés par la mer.
  - Une fois la mer traversée, on peut agrandir de ce côté.
  - Le climat suit la latitude : traverser vers le pôle mène à des terres froides.
- **Les mers s'allongent le long de la côte**, comme un vrai bras de mer d'un bord à l'autre de la carte, au lieu d'un bassin rond. Les mers créées avant ce lot gardent leur forme.
- **Temps de route réels.**
  - Sur un plan à l'échelle (carte du monde, cités, hameaux), le temps de marche se compte en vrais kilomètres : 4,8 km/h, le rythme normal de D&D 5e, ralenti selon le passage. En navire, c'est 5 km/h.
  - Auparavant, ces plans reprenaient la durée fixe de l'Atlas des profondeurs. L'Atlas des profondeurs ne change pas.
  - Au-delà de 10 h, la durée s'affiche en jours (8 h de marche par jour) : « 4 ½ jours (35 h) ».
  - Sur la carte du monde, un jet de rencontre a lieu une ou deux fois par jour (toutes les 4 à 8 h) au lieu de toutes les 1 à 2 h. Sous terre et en ville, rien ne change.
- **Noms élidés** pour les mondes à l'échelle : « Terres d'Aubelande », « Monts d'Orval ».

## Fichiers

- Modifiés :
  - génération : `world/generate.js` (traversées, terres lointaines, élision), `generate.d.ts`, `terrain.js` et `terrain.d.ts` (grille marine, point d'eau le plus proche, mers allongées), `index.ts` (traverser une mer, distances par la mer) ;
  - interface : `WorldPanel.tsx`, `atlas/atlas.css` ;
  - voyage : `journey.ts` (heures en km réels, durées en jours), `MapViewer.tsx` (fréquence des rencontres sur le monde) ;
  - types et passages : `atlas/types.ts` (tracé « maritime »), `atlas/MapCanvas.tsx`, `atlas/trails.ts` (danger d'une traversée) ;
  - tests : `world.test.mjs` (un nouveau test).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limites

- Une cité portuaire est placée sur la meilleure côte : elle n'est pas forcément sur l'autre rive. Utilise 📏 Situer ou 📍 Déplacer pour la mettre outre-mer.
- La traversée ne gère pas les escales.
