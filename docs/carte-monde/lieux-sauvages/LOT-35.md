# Lot 35 (série lieux sauvages) : l'Underdark reste dans ses univers (statut : à valider)

## Le problème

Dans un univers de surface, une cité montrait un bâtiment « La Porte souterraine (Hosten Valak Niveau 1) ». Ce nom
vient de l'Atlas des profondeurs. Le format « lieu (plan) » est celui que l'IA reçoit quand on lui donne les lieux de
l'Atlas. Une fiche de l'Underdark se trouvait donc dans la bibliothèque de cet univers, et la carte du monde place
d'office chaque fiche de lieu dans une cité.

## La règle

Ce qui est propre à l'Underdark ne sort jamais des univers Underdark : Archives, Atlas des profondeurs, Hosten Valak,
strates, peuples et créatures de l'Outreterre. Un univers est « Underdark » quand il est relié aux Archives de
l'Underdark. Seul le niveau application (règles, interface, images communes) est partagé.

## Ce qui change

- `src/universe/underdark.js` (nouveau) :
  - `isUnderdarkUniverse` ;
  - `underdarkSpecific` : une fiche est de l'Underdark si elle vient des Archives ou si son titre, son sous-titre ou
    son résumé nomme Underdark, Outreterre, Hosten Valak, l'Atlas des profondeurs, une strate ou les Moriquendi ;
  - `scopedEntries` : les fiches qu'un univers peut utiliser.
- **Cartes** :
  - hors univers Underdark, la bibliothèque passée aux cartes est filtrée ;
  - une fiche de l'Underdark déjà posée dans une cité perd son bâtiment, même découvert (`syncBindings` : `hidden`) ;
  - la fiche reste dans la bibliothèque.
- **IA** (`buildLoreContext`) : hors univers Underdark, ni Archives ni lieux de l'Atlas, même si un flux traîne en
  mémoire, et aucune fiche de l'Underdark de la bibliothèque. Au changement d'univers, les Archives chargées sont
  vidées tout de suite (forge de campagne, studio).
- **Banque** : hors univers Underdark, aucune image propre à l'Outreterre n'est proposée d'office (401 images sur 786
  dans un univers de surface). Le plateau n'y offre pas « Outreterre ».
- **Accueil de l'univers** : l'encadré « Contenu de l'Underdark dans cet univers » liste les fiches de l'Underdark
  présentes par erreur, avec « Supprimer » (après confirmation), et les campagnes dont des scènes nomment
  l'Underdark.

## Vérifications

- Test (`world.test.mjs`) : une Porte souterraine déjà posée et découverte dans une cité de surface en est retirée ; la
  taverne ordinaire reste.
- Test (`underdark.test.mjs`) : une fiche est classée de l'Underdark d'après son titre, son origine ou son résumé ;
  « passage souterrain » seul ne suffit pas.
- Dans le navigateur, univers de surface avec une Porte souterraine dans sa bibliothèque : l'encadré la signale ; la
  banque propose 401 images.
- 271 tests côté site, 14 côté serveur ; build réussi ; lint sans erreur.

## Fichiers

- Nouveaux : `src/universe/underdark.js`, `underdark.d.ts`, `underdark.test.mjs`, `UnderdarkAudit.tsx`.
- Modifiés :
  - `src/ai/loreContext.js` ;
  - cartes : `src/maps/MapsPage.tsx`, `MapViewer.tsx`, `src/maps/world/index.ts`, `lore.js`, `lore.d.ts`,
    `world.test.mjs` ;
  - banque : `src/banque/index.ts`, `src/maps/battle/TilePanel.tsx` ;
  - `src/studio/CampaignStudio.jsx`.
- **Zone à risque : `src/App.jsx`** :
  - portée de la banque selon l'univers ;
  - Archives vidées au changement d'univers ;
  - encadré de contrôle sur l'accueil.

## Question ouverte

La fiche de l'univers concerné a pu arriver de plusieurs façons : une campagne forgée pendant que l'univers était relié
aux Archives, un import, ou une campagne copiée. L'encadré de l'accueil permet de la retrouver et de la supprimer.

## Complément : tout réécrire d'un coup

- Sur l'accueil d'un univers non relié, le bouton « ✨ Tout réécrire pour cet univers » envoie à l'IA chaque fiche de
  l'Underdark et chaque scène de campagne qui en parle. Elle les réécrit pour cet univers :
  - les lieux deviennent des lieux de surface ;
  - les enjeux, les PNJ, les indices et la longueur restent les mêmes ;
  - les scènes qui ne parlent pas de l'Underdark ne sont pas touchées.
- Une réponse qui nomme encore l'Underdark est refusée et signalée ; l'élément reste tel quel.
- Une fiche importée des Archives perd ce lien une fois réécrite.
- L'original est gardé (`avantReecriture`). La rubrique « Réécrits pour cet univers » permet de le rétablir.
- Le client d'IA accepte une limite de réponse plus haute (`maxTokens`) pour les scènes développées.
- Fichiers : `src/universe/rewriteUnderdark.ts` (nouveau), `UnderdarkAudit.tsx`, `src/ai/client.ts`, et `src/App.jsx`
  (zone à risque : deux actions passées à l'encadré).
- Vérifié dans le navigateur, avec une IA simulée :
  - la Porte souterraine devient « La Porte des Catacombes » ;
  - la scène « Descente » à Hosten Valak devient une descente aux catacombes de Port-Sel ;
  - la scène « Marché » reste intacte ;
  - « Rétablir l'original » remet la fiche d'origine.
