# Carte du monde : lot 16, relief net au zoom et escales en mer (statut : à valider)

## Ce qui change

- **Relief net quand on zoome.**
  - Au-delà d'un zoom ×1,8, la partie visible (plus une marge) est redessinée à 900 px, dans le « worker ». Elle se recalcule un tiers de seconde après qu'on cesse de glisser ou de zoomer, par-dessus le relief entier.
  - Un micro-relief s'ajoute à l'ombrage de ces vues rapprochées, plus marqué en montagne. Il ne sert qu'à l'image : le terrain du jeu (combat, routes, placement) ne change pas.
- **Escales sur les traversées.**
  - Chaque jour de mer (120 km), une étape. Si une terre (île ou côte) est à portée (30 km pour un royaume), c'est un mouillage : « Mouillage de Brubois · Escale · jour 3 de la traversée ». Sinon, c'est une nuit au large : « Au large · jour 2 ».
  - Ces étapes sont des lieux de la carte : le groupe s'y arrête en suivant la traversée, ou on lui propose d'y faire escale si le mouillage est à côté de la route.
- **Navigation près des côtes.** Les navires longent volontiers les côtes et les îles plutôt que la haute mer.

## Fichiers

- Modifiés :
  - relief : `world/terrain.js` (fenêtre de rendu, micro-relief, coût de la navigation), `terrain.d.ts`, `reliefWorker.ts`, `reliefImage.ts` (détail de la vue), `atlas/MapCanvas.tsx` ;
  - escales : `world/generate.js` ;
  - tests : `world.test.mjs` (un nouveau test).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.
