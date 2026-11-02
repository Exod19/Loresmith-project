# Lot 22 : rivières, lacs et mer en matières, sur les plans de cité

- **Formes** : les formes de l'eau viennent du plan et restent indépendantes des textures (`src/maps/atlas/water.js`,
  testé).
  - Rivières : polylignes avec leur demi-largeur.
  - Lacs et mer : polygones.
- **Matières** (`WaterLayer.tsx`) : motifs SVG à leur taille réelle en mètres, ancrés au plan, jamais étirés.
  - Eau peu profonde : boueuse en climat tempéré ou froid, claire en climat chaud et en mer.
  - Eau profonde : vert sombre.
  - Glace quand les eaux sont gelées.
  - Les trois eaux fournies le 31 octobre 2026 entrent dans la banque (`raccorder` : rendues raccordables sur leurs
    quatre bords par le script).
- **Profondeur** : 12 paliers cumulés dans un masque, sans marche visible.
  - Rivières : du bord (peu profond) au milieu (profond).
  - Lacs et mer : haut-fond le long du rivage, eau profonde au large.
- **Berges** : tirées des contours ; terre mouillée (ou sable, ou neige) qui s'estompe vers la terre, en quatre bandes.
- **Confluences** : toutes les rivières sont dans un même masque, leurs traits arrondis se fondent sans couture.
- **Animation légère facultative** : les motifs dérivent lentement, chacun dans son sens.
  - Bouton 🌊 / ≡ près du zoom pour passer en mode statique ; le réglage est gardé dans le navigateur.
  - Statique par défaut si le système demande de réduire les animations.
  - Toujours statique sur l'eau gelée.
- **Combat** (plateaux de surface) : eau peu profonde au bord, profonde au large (distance en cases à la terre), et
  berges assombries.
- **Pas touchés** : carte du monde, intérieurs, Atlas des profondeurs.
