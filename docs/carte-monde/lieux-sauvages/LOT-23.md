# Lot 23 : lieux sauvages de la carte du monde, modèle et génération (statut : à valider)

Premier des quatre lots « lieux sauvages » : on zoome dans la nature (plaines, flancs de montagne, forêts, déserts,
neiges, marais) et on y trouve des lieux tirés au sort, que le MJ garde, définit ou écarte. Les joueurs n'en voient
aucun tant qu'ils ne l'ont pas découvert.

## Ce qui change

- **Des lieux partout, sans rien stocker** (`world/wilds.js`).
  - Le monde est découpé en cases de 10 km. Chaque case tire, toujours de la même façon (graine du monde), 0 à 2 lieux : environ 0,65 lieu par 100 km², c'est la densité « normale ».
  - Un lieu est posé sur le vrai terrain : jamais en mer, jamais dans une cité ni sur son terroir proche.
  - Son type suit le terrain : biome, altitude, pente, forêt, humidité, distance aux routes et aux cités. Il y a 26 types :
    - **montagne** : grotte du géant, nid de wyverne, mine abandonnée, ermitage, belvédère, cascade ;
    - **forêt** : cercle de fées, arbre-cœur, sanctuaire druidique, camp de bandits, cabane isolée, clairière, tanière ;
    - **plaine** : tumulus, cercle de menhirs, ferme abandonnée, vieux champ de bataille, tour de guet en ruine, source ;
    - **steppe et désert** : campement nomade, oasis, ruines ensablées ;
    - **froid** : cairn des voyageurs, camp de trappeurs ;
    - **marais**.
  - **Teneur.** Environ 55 % de lieux d'ambiance (un beau lieu, rien de spécial, un texte à lire), 30 % de scènes et 15 % d'accroches de quête secondaire. Chaque type a ses textes.
  - **Danger** : calme, incertain, dangereux ou périlleux. Il monte avec la distance aux routes et aux cités, et certains types (grotte du géant, nid de wyverne, camp de bandits…) ajoutent un cran. Un lieu d'ambiance reste calme.
- **Affichage pour le MJ seulement.**
  - Les brouillons apparaissent quand la vue fait moins de 90 km de large, estompés et le nom en italique.
  - Ils sont calculés pour la seule fenêtre affichée (arrondie à des blocs de 30 km) : environ 1 ms par vue, et rien n'alourdit les données des joueurs.
- **Fiche du lieu** (`world/WildPanel.tsx`), dans l'onglet Lieu : teneur, danger, situation (« à 23 km au nord-est de Brumeval · taïga · 640 m »), texte à lire aux joueurs, scène ou accroche, notes du MJ. Les gestes possibles :
  - **✓ Garder** : le brouillon est enregistré tel quel et ne bouge plus ;
  - **✦ Définir** (ou **Modifier**) : nom, type, teneur, danger, textes et notes ;
  - **👁 Montrer aux joueurs** : le lieu est gardé du même coup et apparaît sur leur carte. Le bouton de révélation habituel fait de même ;
  - **✕ Écarter** : ce lieu n'existera pas, même en brouillon.
- **Lieux enregistrés** (`world.wilds`, par clé de case) : ils font partie de la carte du monde générée, comme les hameaux. Écarter ou garder un lieu ne déplace jamais les autres lieux de sa case.

## Ce qui ne bouge pas

- Les joueurs ne voient rien de nouveau : ni symbole ni brouillon, seulement les lieux révélés.
- Les anciens mondes (« Ancienne carte ») n'ont pas de lieux sauvages.
- Les cités, les hameaux, le relief, les routes et le lore sont inchangés.

## Fichiers

- Nouveaux : `world/wilds.js`, `wilds.d.ts`, `wilds.test.mjs` (4 tests), `world/WildPanel.tsx`.
- Modifiés :
  - `world/generate.js` et `generate.d.ts` : lieux enregistrés dans le monde, `wildFeatureOf`, type `WildRecord` ;
  - `world/index.ts` : brouillons de la fenêtre affichée (`wildDrafts`), relief en mémoire ;
  - `atlas/MapCanvas.tsx` : fenêtre affichée signalée (`onView`), style des lieux sauvages ;
  - `atlas/types.ts`, `atlas/atlas.css`, `maps.css`, `mapStore.ts` (`activateMap` accepte une clé de plus), `MapViewer.tsx`.
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limites

- Les lacs ne sont pas encore évités : un lieu peut tomber sur l'eau d'un lac (les mers, elles, sont évitées).
- Il n'y a pas encore de découverte en voyage (lot suivant), ni de plan du lieu quand on zoome au plus près, ni de rencontre propre au lieu.
