# Lot 27 : lieux sauvages, finitions (statut : à valider)

Cinquième lot « lieux sauvages » : les limites repérées aux lots précédents.

## Ce qui change

- **Densité réglable** (onglet Monde, rubrique « Lieux sauvages ») :
  - rares : environ 0,4 lieu par 100 km², un lieu aperçu tous les 2 ou 3 jours ;
  - normaux : 0,65, le réglage par défaut ;
  - nombreux : environ 1 lieu par 100 km², deux par jour.

  Le réglage change les brouillons. Les lieux déjà gardés, définis ou découverts ne bougent pas. Sur la vue de test, on passe de 26 à 48 brouillons en « nombreux ».
- **Entrer directement depuis un brouillon** : le bouton « Entrer dans le lieu » de la fiche garde le lieu, puis ouvre son plan dès que le monde l'a généré.
- **Les points d'intérêt sur le plateau de combat.** Les points d'intérêt d'un lieu sauvage sont posés sur le plateau, comme éléments à fouiller (F1, F2…). Leur fiche de fouille vient de leur propre texte : le jet qu'il indique (« Investigation DD 12 ») ou, à défaut, Perception DD 10, et ce qu'on y trouve.
- **Anneau de fées visible** : seize champignons plus gros et l'anneau tracé au sol, sur le plan du lieu.

## Fichiers

- Modifiés :
  - `world/wilds.js` et `wilds.d.ts` : densité (`DENSITY`, `DENSITY_LABEL`) ;
  - `world/index.ts` (densité transmise au tirage) et `world/generate.d.ts` (`wildDensity`) ;
  - `world/WorldPanel.tsx` : réglage de la densité ;
  - `world/WildPanel.tsx` et `MapViewer.tsx` : « Entrer dans le lieu » ;
  - `world/wildPlan.js` : anneau de fées ;
  - `battle/local.ts`, `battle/search.ts` (`poiEntry`), `battle/BattleMode.tsx` : points d'intérêt sur le plateau ;
  - `world/wilds.test.mjs` (un test de plus).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Vérifications

Dans le navigateur :

- densité normale → nombreux : 26 → 48 brouillons sur la même vue ;
- « Entrer dans le lieu » sur le Marais du Héron (brouillon) : le lieu est gardé, et son plan s'ouvre avec ses points d'intérêt (« Eaux noires », « Îlot ») ;
- plateau de combat du marais : la mare, le sol de taïga, et les deux points d'intérêt (F1, F2).
