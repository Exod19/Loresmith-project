# Générer les textures de canopée (forêts vues de haut)

Dans les plans « Environs » (et les lieux sauvages), la forêt vue de loin est dessinée par des taches vertes rondes.
Dès que la Banque Loresmith contient une texture de catégorie `canopee` qui convient au climat et à la saison, ces
taches sont remplies avec elle ; de près, les arbres de la banque prennent le relais. Rien d'autre à faire dans le code.

## Le cahier des charges

- **Vue** : zénithale stricte (orthographique, appareil à la verticale), pas de perspective, pas d'horizon ni de ciel.
- **Raccordable** : bords qui se raccordent sur les quatre côtés (« seamless / tileable »). Vérifier en mettant deux
  copies côte à côte : aucune couture.
- **Échelle** : une image représente environ **60 m de côté**. Avec des houppiers de 8 à 15 m de diamètre, cela fait 5 à
  8 arbres par côté. Pas d'arbres géants, pas de feuilles visibles une à une.
- **Couverture** : canopée continue, presque sans trou (quelques ombres entre les couronnes). Pas de chemin, pas de
  bâtiment, pas d'eau, pas de personnage.
- **Lumière** : douce et diffuse, ombres courtes, la même pour toutes les variantes, afin qu'elles se raccordent entre
  elles et avec les arbres de la banque.
- **Format** : carré, 2048 × 2048 px (1024 au minimum), PNG ou JPG, sans transparence.
- **Style** : le même que les arbres déjà présents (peint, réaliste, couleurs assez sourdes) ; éviter le vert fluo.

## Les variantes (une par fichier) et leur nom

Le titre du fichier sur le Drive décide du classement : il doit contenir **« canopy »** (ou « canopée ») et le mot de
la variante. Exemples de titres :

| Variante | Titre conseillé | Utilisée pour |
| --- | --- | --- |
| Feuillus d'été | `Forest canopy deciduous summer seamless` | climat tempéré, printemps et été |
| Feuillus d'automne | `Forest canopy autumn seamless` | climat tempéré, automne |
| Conifères | `Forest canopy conifer pine seamless` | tempéré et froid, toute l'année hors neige |
| Enneigée | `Forest canopy snow conifer seamless` | hiver (froid et tempéré) |
| Tropicale | `Forest canopy tropical jungle seamless` | climats tropical et chaud |
| Sèche | `Forest canopy dry olive savanna seamless` | climats chaud et aride |

Deux ou trois images par variante évitent la répétition (le choix est stable pour un même plan).

## Exemple d'invite (à adapter à l'outil)

> Seamless tileable texture, strict top-down orthographic aerial view of a dense temperate deciduous forest canopy in
> summer, oak and beech crowns 8 to 15 meters wide, about 6 trees across the image, soft diffuse daylight, short
> shadows between crowns, muted natural greens, painted realistic style for a tabletop RPG battle map, no path, no
> water, no buildings, no sky, no perspective, no text, no border.

Pour les autres variantes, remplacer « temperate deciduous forest canopy in summer, oak and beech crowns » par :
- automne : « temperate deciduous forest canopy in autumn, mixed orange, red and gold crowns » ;
- conifères : « dense pine and spruce forest canopy, star-shaped conifer crowns » ;
- neige : « snow-covered conifer forest canopy in winter, white snow on dark green crowns » ;
- tropicale : « dense tropical jungle canopy, broad leaves and palm crowns » ;
- sèche : « sparse dry mediterranean woodland canopy, olive and holm oak crowns, patches of dry ground ».

## Ensuite

Déposer les images dans le dossier Drive des textures de surface (le même que les autres textures), puis me
demander de synchroniser la banque : elles seront converties (WebP 256, 512, 1024 px), classées dans `canopee` et
utilisées automatiquement.

### Optionnel : lisières plus naturelles

Les bords de la forêt restent faits de taches rondes. Pour les adoucir, on pourra ajouter des **bosquets détourés** :
PNG à fond transparent, vue zénithale, un groupe de 3 à 6 couronnes (environ 25 m de large), titre contenant
`tree clump top-down`. Me prévenir quand il y en a : il faudra une petite règle pour les poser le long des lisières.
