# Lot 38 (série lieux sauvages) : banque plus maniable, images jamais étirées, événements liés entre eux (statut : à valider)

## Banque Loresmith

- **Supprimer une image en un clic.** Sur chaque carte, un bouton 🗑 apparaît au survol (toujours visible sur un
  écran tactile). Il ouvre la même confirmation que « Supprimer définitivement ».
  - Il est réservé à l'administrateur pour les images communes. L'administrateur est le compte
    sam@groupeadjuvant.ca, à condition d'être connecté.
  - Les cartes prennent l'image la plus proche, et « Images supprimées » permet de rétablir.
- **La fiche défile seule.** La fiche de l'image sélectionnée ne dépasse plus la fenêtre : elle a son propre défilement,
  sans entraîner la page, et la grille défile normalement.

## Images jamais étirées

- **Plus de déformation.** Chaque image de la banque garde ses proportions dans sa place. C'est le cas sur la carte de
  navigation, dans les cavernes, pour le mobilier du combat et sur le plateau peint.
- **Plus de pixellisation.** Sur la carte de navigation et dans les cavernes, une image n'est jamais affichée plus grande
  que sa résolution d'origine : au-delà, elle cesse de grandir au lieu de devenir floue (`noUpscale`).

## Événements liés entre eux

- **Nouvelles natures** : « Travaux, chantier » et « Reconstruction, réparation ».
- **Nature reconnue d'après le texte** (« reconstruit », « rebâti », « réparé », « a brûlé », « détruit », « volé »)
  quand elle n'est pas choisie (`kindFromText`).
- **Le plus récent l'emporte.** Un événement plus récent sur le même lieu remplace l'état laissé par le précédent
  (`supersededAt`) :
  - « Le temple a brûlé », puis « on l'a reconstruit » : la carte remontre le temple debout ;
  - les suites de l'incendie (déblaiement, chantier proposé) s'arrêtent et ne reviennent pas.
- **Dans l'histoire de l'univers.** Chaque événement inscrit dans le journal du monde entre dans la mémoire de l'univers,
  que l'IA lit pour les scènes, les fiches et les conversations : les PNJ en parlent désormais.

## Vérifications

- Test (`consequences.test.mjs`) :
  - temple brûlé : ruine ;
  - deux jours plus tard, « On a reconstruit le temple » : reconstruit ;
  - soixante jours plus tard : toujours reconstruit, aucune suite en attente.
- 272 tests côté site, 14 côté serveur ; build réussi ; lint sans erreur.

## Fichiers

- Banque : `src/banque/BanquePanel.tsx`, `src/maps/maps.css`, `src/banque/index.ts` (`noUpscale`), `BankLayer.tsx`,
  `CaveArt.tsx`, `boardDress.ts`.
- Combat : `src/maps/battle/BattleBoard.tsx`.
- Monde et événements : `src/maps/world/worldEvents.js`, `consequences.js`, `consequences.test.mjs`,
  `src/maps/MapViewer.tsx`, `src/maps/MapsPage.tsx`.
- Zones à risque : non touchées.
