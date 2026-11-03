# Lot 25 : marche hors route (statut : à valider)

Troisième lot « lieux sauvages » : le groupe peut quitter les routes et marcher à travers la campagne, en gardant le
contrôle du MJ. Le plan du lieu au zoom maximal passe au lot suivant, avec les scènes.

## Ce qui change

- **🧭 Hors route** (onglet Groupe, carte du monde) : « Choisir une destination », puis tu touches un lieu (lieu sauvage, hameau, cité…) ou n'importe quel point de la carte.
  - Un point en pleine nature reçoit un nom selon le terrain : « Cœur de la forêt », « Lisière de forêt », « Flanc de montagne », « Haute montagne », « Étendue enneigée », « Steppe », « En plein désert », « Collines », « Campagne ».
- **Le chemin est proposé avant le départ** : tracé en pointillés sur la carte, avec sa longueur, sa durée de marche et le terrain traversé. Par exemple : « 50,1 km à travers la campagne · ≈ 2 jours (15 h) de marche · 97 % en forêt ». On peut partir, changer de destination ou annuler.
  - Le chemin est le moins pénible : il suit les vallées et les cols, et contourne la mer et les lacs. Le calcul est celui des routes (`travelGrid`, `routeOn`).
  - La durée compte pleinement la pente, la forêt, la neige et la haute montagne (4,8 km d'effort par heure).
  - Sans passage à pied (île, autre rive), le panneau le dit.
- **En chemin, tout s'applique comme sur une route.**
  - Les lieux sauvages s'aperçoivent selon le terrain, et les lieux cachés selon la Perception passive (lot 24). Le groupe s'arrête vis-à-vis d'un lieu ; l'écran joueur propose « Aller voir » ou « Continuer votre chemin ».
  - Les haltes de rencontre tirent dans la table de surface, zone « Nature ».
  - Continuer reprend le chemin vers la destination ; le demi-tour ramène au point de départ.
- **Arrivée.** Le groupe se tient au lieu choisi, ou en pleine nature à l'endroit touché, et peut repartir de là, par une route proche ou à nouveau hors route.
  - Une destination encore en brouillon (lieu sauvage) est gardée au départ, puis révélée aux joueurs à l'arrivée.
  - La marche hors route n'ajoute rien à la carte des joueurs, à part le chemin parcouru dans le brouillard.
- **Les lacs sont évités** par les lieux sauvages, comme la mer (limite du lot 23 levée).

## Fichiers

- Modifiés :
  - `world/index.ts` : `crossPath` (chemin, durée, terrain), `wildernessLabel`, lacs et grille de voyage en mémoire ;
  - `world/generate.js` et `generate.d.ts` : `worldLakes` ; `world/terrain.d.ts` (`crossCountry`) ;
  - `world/wilds.js` et `wilds.d.ts` (lacs évités) ;
  - `journey.ts` et `mapStore.ts` : destination hors route portée par le trajet et la bifurcation ;
  - `atlas/MapCanvas.tsx` et `atlas/atlas.css` : tracé proposé (`preview`) ;
  - `MapViewer.tsx` : panneau Hors route, départ, bifurcations, haltes et demi-tour hors route ; `maps.css`.
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Vérifications

Dans le navigateur, sur le royaume de test, depuis Brumeval vers un point de forêt au nord-ouest :

- le tracé proposé s'affiche, avec « 50,1 km · ≈ 2 jours (15 h) · 97 % en forêt » ;
- au départ, le groupe aperçoit la Cabane isolée aux Corbeaux et s'arrête vis-à-vis ;
- « Continuer votre chemin » le mène à destination, en pleine nature.

## Limites

- Ce sont les joueurs qui demandent les routes depuis leur écran, mais c'est le MJ qui choisit une destination hors route.
- Pas encore de sentiers secondaires dessinés sur la carte : le chemin suivi reste visible dans le brouillard des joueurs, pas comme un tracé permanent.
