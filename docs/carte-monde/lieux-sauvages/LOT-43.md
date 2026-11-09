# Lot 43 — Les environs, à pied : visiter la nature sans cité

Demande : zoomer sur un lieu de la carte de navigation (par exemple une forêt) et y visiter des clairières, des
ruisseaux, des sentiers… La nature doit se visiter sans avoir à créer de ville.

## Constat

La carte du monde ne zoome que jusqu'à environ 70 km de large : à cette échelle, une clairière ou un ruisseau ne
font pas un pixel, et les lieux sauvages (lots 23 à 27) ne sont tirés qu'à raison d'environ un par 100 km². Pousser le
zoom de la carte du monde ne suffit pas : son terrain est calculé sur une grille de quelques km, il reste plat.

## Ce qui change

- **Les environs (plan de zone, `world/zonePlan.js`)** : un plan d'environ 4 × 3,2 km autour d'un point de pleine nature.
  - Sa végétation suit le terrain du monde, lissé et bruité pour des lisières naturelles : bosquets serrés en forêt,
    arbres épars en campagne. Une canopée se voit de loin ; les arbres de la Banque apparaissent de près.
  - Les rivières, lacs et routes du monde qui traversent la zone y passent.
  - Les petits lieux de la zone ont leur trouée, leur ruisseau, leur mare ou leurs rochers. Un réseau de sentiers les relie.
  - Son nom vient de la forêt ou des monts alentour (« Forêt de Vieuxbois · environs »), sinon du terrain.
- **Petits lieux** (`world/wilds.js`, `nookSitesIn`) : 0 à 2 par km², plus nombreux en forêt.
  - **Types** : petite clairière, ruisseau, gué, sentier, vieux chêne, arbre tombé, rochers moussus, mare, fourré,
    coin de cueillette, bosquet, éboulis.
  - **Teneur** : presque tous des lieux d'ambiance, parfois une petite scène.
  - **Dans la fiche** : textes à lire et jets suggérés.
  - **Statut** : comme les grands lieux sauvages, ce sont des brouillons pour le MJ. On les garde, on les définit, on les écarte, ou l'on y entre.
- **Entrer dans un petit lieu** : son plan d'une centaine de mètres (`wildPlan.js`, aménagements ajoutés pour chaque
  type) : le ruisseau qui traverse avec son tronc couché, les pierres du gué, l'embranchement du sentier, l'arbre
  tombé et sa motte, la mare… Points d'intérêt et plateau de combat comme pour tout lieu sauvage.
- **Comment y aller**
  - Zoom maximal sur la carte du monde puis encore un cran, en pleine nature : on descend dans les environs. Près
    d'une cité, d'un hameau ou d'un lieu (moins de 5 km), on y entre comme avant.
  - Fiche d'une forêt, de monts, d'un lac ou d'une rivière : « 🔍 Explorer à pied ».
  - Onglet Groupe, le groupe en pleine nature : « 🔍 Les environs (4 km) », où le groupe descend avec la vue, ou « Ici même
    (100 m) », qui crée un lieu « Sous-bois » ou « En pleine nature » là où il se tient.
  - Dézoomer au maximum ou ↥ remonte à la carte du monde ; le groupe y remonte au même endroit.
  - Les environs visités sont gardés (`world.zones`) et repérés sur la carte du monde.
- La catégorie « Eaux souterraines » devient « Eaux » (elle sert aussi à la surface).

## Fichiers

- Créés : `src/maps/world/zonePlan.js` (+ `.d.ts`, `.test.mjs`).
- Modifiés : `src/maps/world/wilds.js` (+ `.d.ts`) : petits lieux, `nookSitesIn`, `spotSite` ; `src/maps/world/wildPlan.js` :
  plans des petits lieux ; `src/maps/world/index.ts` : plans de zone dans les données du monde, `zoneFor`, `zoneDrafts`,
  `spotRecord`, petits lieux au zoom rapproché ; `src/maps/world/generate.js` (+ `.d.ts`) : `worldRivers`, champ
  `zones` ; `src/maps/MapViewer.tsx` : zoom, boutons, brouillons de zone, remontée du groupe ; `src/maps/atlas/model.ts`.

## Vérifications

286 tests côté site (4 nouveaux) et 14 côté serveur au vert ; build réussi ; lint sans erreur. Parcours Chromium : zoom
au maximum sur la Forêt de Vieuxbois → « Forêt de Vieuxbois · environs » (petites clairières, ruisseau, vieux chêne,
fourré, sentiers…), vue rapprochée (arbres, ruisseau, sentier), entrée dans « Ruisseau des Lavandières » (plan du
ruisseau, tronc couché, points d'intérêt).
