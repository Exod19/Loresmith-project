# Lot 24 : lieux sauvages, découverte en voyage (statut : à valider)

Deuxième des quatre lots « lieux sauvages ». Il intègre aussi les retours sur le lot 23 : séparer la surface et
l'Underdark, et varier les descriptions.

## Ce qui change

### Découverte en voyage

- **On voit selon le terrain.** Sur la carte du monde, en suivant une route, le groupe aperçoit les lieux sauvages à portée de vue :
  - environ 6 km au désert et dans la steppe, 5 km en montagne et dans la neige, 4,5 km en terrain dégagé ;
  - jamais plus de 1,5 km en forêt, même pour une tour ;
  - certains lieux se voient de plus loin : une tour de guet ou une oasis à 6 km, un nid de wyverne qui tourne au-dessus d'un pic.
- **Le groupe s'arrête sur la route, vis-à-vis du lieu.** L'écran joueur annonce ce qu'on aperçoit, de quel côté, et propose « Aller voir » ou « Continuer la route ». Par exemple : « Sur votre gauche, une cheminée fume entre les arbres. Vous allez voir, ou vous continuez la route ? ». C'est le même mécanisme que les bifurcations de l'Underdark.
  - Chaque type de lieu a sa ou ses phrases d'annonce : « un grondement d'eau monte sur votre droite », « des lucioles dansent en plein jour »…
  - Un lieu déjà connu des joueurs s'annonce par son nom.
- **Lieux cachés.** Le cercle de fées (DD 15), le sanctuaire druidique (14), le camp de bandits et la tanière (13), la mine et l'ermitage (12), la source (11) ne se voient que si la Perception passive du groupe atteint leur DD. Sinon, le journal de route du MJ note : « En chemin, passé sans le voir près de : Cercle de fées des Lucioles (Perception DD 15) ».
- **Un lieu aperçu est enregistré** : il ne bougera plus, mais les joueurs ne le voient pas encore. « Aller voir » mène le groupe hors de la route, jusqu'au lieu, et le révèle aux joueurs. L'épreuve d'un lieu dangereux et la halte de rencontre s'appliquent comme ailleurs.
- **Continuer la route** reprend le trajet sans s'arrêter de nouveau devant le même lieu.

### La surface et l'Underdark ne se mêlent plus

- **Rencontres** (`atlas/surfaceEncounters.ts`, nouveau). La carte du monde a sa propre table : marchands, patrouille du seigneur, pèlerins, brigands, loups, ours, chasseurs, gobelins, orques, gnolls, ogre, araignées, morts sans repos, cultistes, signes (feu de camp tiède, charrette renversée, pendu au carrefour), paysans, coupe-bourses.
  - Les haltes en chemin et le bouton « Rencontre ici » tirent dans cette table, par zone : nature, sur la route, aux abords d'une cité.
  - La table de l'Underdark (convois duergars, caravanes drows…) n'est plus utilisée que dans l'Atlas, et le réglage de profondeur disparaît à la surface.
- **Descriptions** (`world/surfaceLore.ts`, nouveau). Une forêt, des monts, un lac, une rivière, la mer, une route, un hameau ou une cité ont des textes de surface. Avant, une forêt était décrite comme « une salle de la strate, reliée aux autres par des boyaux » et une route comme un tunnel. C'est valable chez le MJ et sur l'écran joueur.
- **Libellés et conseils.** À la surface, on lit « Eaux », « Route / chemin », « Nature »… au lieu d'« Eaux souterraines » ou de « Galerie ». Les conseils de MJ de l'Underdark (« les issues de la salle », « 1d20 ≥ 18 par heure passée dans la salle ») ne s'affichent plus sur les forêts, les lacs, les routes ni les lieux sauvages.
- Les lieux sauvages n'existent qu'à la surface.

### Descriptions plus variées

- Au texte de chaque type s'ajoute, trois fois sur quatre, une touche d'ambiance : selon le biome (six par biome : tempéré, taïga, steppe, désert, neige) ou selon les sens (douze : un corbeau qui observe, une odeur de fumée sans feu, un écho en retard…).
- Sur un royaume, 128 tumulus donnent 38 textes différents. Aucune IA n'est nécessaire.

## Fichiers

- Nouveaux : `atlas/surfaceEncounters.ts`, `world/surfaceLore.ts`, `docs/carte-monde/LOT-24.md`.
- Modifiés :
  - `world/wilds.js` et `wilds.d.ts` : visibilité, DD, phrases d'annonce (`sightOf`), touches d'ambiance, forêt du lieu ;
  - `world/index.ts` : lieux visibles le long d'un trajet (`wildAlong`), découpe du trajet (`cutWalk`, `walkKm`) ;
  - `world/generate.d.ts` ; `journey.ts` (les lieux sauvages ne sont pas des étapes ordinaires, court chemin `spur`) ;
  - `mapStore.ts` (bifurcation portant un lieu sauvage) ;
  - `MapViewer.tsx` : découverte en route, rencontres, descriptions et libellés de surface ;
  - `atlas/encounters.ts` (table selon la surface) ; `present/PlayerScreen.tsx` (descriptions de surface) ;
  - `world/wilds.test.mjs` (deux tests de plus).
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Vérifications

Dans le navigateur, sur un royaume de test (Brumeval → Arnfel, 107 km) :

- le groupe va jusqu'au premier hameau, puis s'arrête vis-à-vis de la Cabane isolée de la Mère Grise ; l'écran joueur affiche la question avec ses deux boutons ;
- « Aller voir » mène à la cabane et la révèle aux joueurs ;
- « Continuer la route » mène au hameau suivant sans s'arrêter de nouveau.

## Limites

- On ne découvre que le long des routes : marcher à travers la campagne viendra plus tard.
- La densité reste « normale » : environ un à deux lieux aperçus par jour de marche, selon le terrain. Un réglage rare / riche pourra s'ajouter.
