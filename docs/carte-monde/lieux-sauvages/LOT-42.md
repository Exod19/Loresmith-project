# Lot 42 — Fouille des vaincus, lieux marqués par leur histoire, portes verrouillées

## Fouille des vaincus (butin logique)

- Un monstre ou PNJ à 0 PV affiche, dans sa fiche de combat (pupitre du MJ, onglet Tour), un encadré **🎒 Fouiller**.
- Les suggestions viennent de ce qu'il est (`src/maps/battle/loot.js`) :
  1. l'équipement de sa fiche (armure de la CA, armes des actions, munitions), souvent abîmé ;
  2. son métier, lu dans son nom (pêcheur, garde, prêtre, marchand, bandit, noble…) ;
  3. son espèce (fiches de l'Outreterre : objets portés d'ordinaire, nourriture) ;
  4. sa nature (bête, mort-vivant, vase, élémentaire, plante, fiélon…) ;
  5. une bourse modeste selon sa puissance, jamais sur une bête, et parfois un petit objet personnel (accroche).
- Les bêtes et monstres n'ont pas de bourse mais des **dépouilles à prélever** sur un jet (Survie ou Nature, DD selon le FP).
- Exemple : un pêcheur kuo-toa porte deux ou trois poissons aveugles, un filet, des hameçons en os, sa lance de pêche ;
  jamais d'habits de noble.
- Le MJ décoche ce que les héros laissent, puis « Fouillé : consigner au journal » (journal du combat). « Refouiller »
  efface la fouille. Tirage stable : la suggestion ne change pas d'un clic à l'autre.

## Lot 5 — Les lieux portent leur histoire

- **Intérieurs** : un bâtiment en ruine, en chantier ou délaissé (mémoire du monde) le montre :
  - carte de navigation de l'intérieur assombrie / poussiéreuse, bandeau d'état ;
  - plateau de combat : mobilier réduit (ruine 35 %, chantier 15 %), teinte brûlée ou poussiéreuse, bandeau pour le MJ ;
  - personne n'y vit plus : les PNJ ne sont pas posés sur le plateau d'un bâtiment en ruine ou en chantier ;
  - l'effraction nocturne n'est plus proposée sur une ruine.
- **Relogement** (`src/maps/world/relocation.js`) : après un incendie, les habitants vivent ailleurs jusqu'à la
  reconstruction. Un autre bâtiment du même genre les accueille s'il existe (un autre temple), sinon la place du marché
  (offices en plein air, comptoir sous la tente, forge de campagne, étal de fortune…). Un repère pointillé vert marque le
  lieu provisoire sur la carte de la cité ; les fiches du bâtiment sinistré et du lieu d'accueil l'indiquent. Le PNJ
  délogé en parle quand on lui parle (« Parler »).
- **« Que s'est-il passé ici ? »** dans la fiche d'un bâtiment : événements et suites du lieu, du plus ancien au plus
  récent, et un récit à lire aux joueurs (IA, si configurée), avec une piste pour le MJ.
- **Objet emporté** : après une fouille réussie d'une pièce, « 🎒 Les héros l'emportent » inscrit la disparition dans la
  mémoire du monde (un vol si quelqu'un vit là) : plainte, soupçons, rumeurs, et le PNJ s'en souvient.

## Lot 6 — Portes verrouillées

- « Entrer dans … » sur un bâtiment fermé à clé (la nuit, sauf tavernes et auberges) ouvre une fenêtre : crocheter
  (Dextérité, outils de voleur, DD selon le bâtiment et le quartier) ou forcer (Athlétisme, DD + 2, bruyant).
- Raté : une minute perdue (crocheter) ou du bruit (forcer). Réussi : on entre. Une porte enfoncée s'inscrit dans la
  mémoire du monde (on la découvrira au matin).
- Le MJ peut toujours « Entrer quand même » (une clé, un occupant qui ouvre) ou fermer la fenêtre (×, Échap, clic à côté).
- Une porte ouverte le reste pour la nuit.

## Fichiers

- Créés : `src/maps/battle/loot.js` (+ `.d.ts`, `.test.mjs`), `src/maps/battle/LootBox.tsx`, `src/maps/battle/placeLook.ts`,
  `src/maps/world/relocation.js` (+ `.d.ts`, `.test.mjs`), `src/maps/world/PlaceHistory.tsx`, `src/maps/world/LockGate.tsx`.
- Modifiés : `src/App.jsx` (fouille dans la fiche de combat), `src/maps/MapViewer.tsx`, `src/maps/battle/BattleMode.tsx`,
  `src/maps/battle/CombatPanel.tsx`, `src/maps/world/TalkPanel.tsx`, `src/maps/mapStore.ts` (champ `looted` d'un jeton),
  `src/maps/atlas/MapCanvas.tsx` (repère `temp`), feuilles de style.

## Vérifications

282 tests côté site et 14 côté serveur au vert ; build réussi ; lint sans erreur. Parcours Chromium : intérieur en
ruine (bandeaux, aucun PNJ), fouille d'un pêcheur kuo-toa vaincu (poissons, filet, hameçons, lance de pêche), relogement
et histoire de la taverne incendiée, porte d'échoppe verrouillée la nuit (échec, Échap, réussite puis entrée).

## Complément — Serrures du MJ et butin au Carnet

- **Serrures posées par le MJ** (fiche d'un lieu de la carte du monde) : « 🔒 Fermer à clé » verrouille un lieu à toute
  heure (crypte, coffre-fort, porte condamnée), avec un DD réglable (15 par défaut, forcer : + 2) ; « 🔓 Ouvert même la
  nuit » dispense un bâtiment de crochetage (les héros ont la clé). Un lieu verrouillé se crochète depuis sa fiche
  (« Crocheter… ») ou en tentant d'y entrer (bâtiments et sites). Une fois ouvert, il le reste ; « Refermer » ou
  « Serrure normale » pour revenir en arrière. Une serrure forcée s'inscrit dans la mémoire du monde. Champ
  `world.locks` (voyage avec la carte).
- **Butin au Carnet** : ce que les héros prennent sur un vaincu est ajouté au Carnet du groupe (case cochée par défaut),
  un élément par objet, visible sur l'écran joueur. « Refouiller » ne retire pas ce qui est déjà au Carnet (à supprimer
  depuis le Carnet si besoin).
