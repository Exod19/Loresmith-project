# Lot 26 : échelle mesurée de chaque jeton, visage dans la fiche d'un lieu

## Échelle

- Les images de jetons remplissent toutes leur cadre, mais leur cadrage varie : certaines montrent le personnage en
  pied, presque de côté ; d'autres de plus près, presque à la verticale. Le peuple seul ne suffisait donc pas.
- Chaque jeton porte maintenant une `longueur` : la longueur réelle, en mètres, que couvre son image. Je l'ai mesurée
  à l'œil d'après la largeur des épaules : 0,44 m pour un humain, 0,48 pour un nain, 0,3 pour un halfelin, un gnome
  ou un enfant, 0,52 pour un demi-orque. La valeur est plafonnée à la taille du personnage, puis vérifiée sur une
  planche à l'échelle.
- Les valeurs sont dans `scripts/banque/longueurs.json` ; la construction de la banque les reporte dans le catalogue.
- `tokenScale` = `longueur` ÷ 1,41 m. Sans `longueur` (jeton ajouté par un MJ), l'estimation d'après le peuple reste.
- Page Banque : l'administrateur peut retoucher la longueur de chaque jeton. Le serveur accepte le champ `longueur`
  dans les retouches (`server/src/banque.js`).

## Visage dans la fiche d'un lieu

- Écran du MJ : la fiche d'un PNJ (panneau Lieu) montre son visage.
- Écran des joueurs : la carte qui s'ouvre au toucher montre aussi son visage (`AtlasFeature.face`, calculé à
  l'envoi).
- Ordre de choix du visage :
  1. l'image du lieu ;
  2. l'illustration de sa fiche ;
  3. le portrait jumeau de son jeton ;
  4. un portrait de la banque qui lui ressemble.
