# Lot 21 : terrain naturel des plans de cité

D'après le prototype « loresmith-terrain » fourni par l'utilisateur (`terrain.js`, `INTEGRATION-CLAUDE.md`).

- `src/maps/world/naturalTerrain.js` (testé) reprend le principe du prototype, en mètres et en module ES.
  - Herbe et terre nue en bruit de valeur à trois échelles, teintées selon le climat, la saison et la neige.
  - Chemins de terre : une seule surface, faite de l'union des distances à toutes les rues. Ni anneau ni raccord
    aux carrefours, ni bordure dessinée.
  - Places et cours en pavés.
  - Les segments de rue sont indexés par cases, pour qu'une tuile ne regarde que les rues proches.
- `src/maps/atlas/NaturalTerrain.tsx` dessine des tuiles de 256 px sous les champs, rivières, toits et libellés,
  dans la même transformation que le plan.
  - Le niveau de détail se cale sur la densité réelle (de 0,25 à 8 pixels par mètre).
  - Les tuiles sont calculées une à une, du centre vers les bords ; les demandes obsolètes sont abandonnées.
  - Le cache garde 96 tuiles au plus. Les tuiles plus grossières restent dessous pendant le chargement.
- Graine : l'identifiant du plan. Un même point garde le même aspect à chaque déplacement.
- Le tracé vectoriel des rues reste en place mais devient invisible : sélection et clics inchangés. Le sol de combat
  et les règles de déplacement ne changent pas.
- Seulement sur les plans de cité. Ni la carte du monde (relief propre), ni les intérieurs, ni l'Atlas des
  profondeurs.
