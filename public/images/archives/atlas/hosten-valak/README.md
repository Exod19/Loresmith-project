# Hosten Valak — Illustrations de lieux (Atlas)

Ce dossier contient **6 illustrations distinctes de lieux**, créées suivant la bible visuelle
`docs/atlas/guide-visuel-hosten-valak.md`. Aucune illustration de personnage.

## Correspondance exacte avec le code

| Palier | Lieu | Identifiant dans `src/atlas/hostenValak.ts` | Image |
| --- | --- | --- | --- |
| 0 — Le Seuil | Porte de Hosten Valak | `hv-0-2` | `palier-0-le-seuil/porte-de-hosten-valak.webp` |
| 0 — Le Seuil | Portail d’arrivée | `hv-0-9` | `palier-0-le-seuil/portail-arrivee.webp` |
| 0 — Le Seuil | Le Grand Gouffre | `hv-0-4` | `palier-0-le-seuil/grand-gouffre.webp` |
| 1 — L’Accueil | La Grande Place | `hv-1-6` | `palier-1-accueil/grande-place.webp` |
| 1 — L’Accueil | Hall militaire | `hv-1-10` | `palier-1-accueil/hall-militaire.webp` |
| 1 — L’Accueil | Bazar | `hv-1-8` | `palier-1-accueil/bazar.webp` |

La source de vérité pour les correspondances est `manifest.json`.

## Comment les afficher dans l’application

L’Atelier déjà présent dans le projet lit `public/data/atelier.json` :
`atlas.features[featureId].image` accepte une URL relative sans préfixe `public/` :

```json
{
  "atlas": {
    "features": {
      "hv-0-2": {
        "image": "images/archives/atlas/hosten-valak/palier-0-le-seuil/porte-de-hosten-valak.webp"
      }
    }
  }
}
```

**Ne pas remplacer tout le fichier `atelier.json` par cet exemple.**
Le script `scripts/hosten-valak-associer-images.mjs` fusionne les six valeurs
sans effacer les entrées préexistantes. Depuis la racine du projet :

```bash
node scripts/hosten-valak-associer-images.mjs
```

Cette étape fera afficher les images dans le panneau d’un lieu quand il est
sélectionné dans l’Atlas (via `featureImage(f)` dans `src/pages/Atlas.tsx`).

## Important pour Claude Code

- Ce sont des **illustrations d’ambiance d’un lieu**, pas des plans à coordonnées.
- Ne pas les substituer aux huit cartes vectorielles des paliers.
- Ne pas les appliquer à toutes les fiches d’une famille : association **par `featureId` seulement**.
- Respecter les huit paliers locaux (0–7), distincts des trois grands niveaux de l’Underdark.
- Ne pas ajouter de titres, marques, épingles ou grille sur les images : l’interface le fait séparément.
- La silhouette architecturale des images est une interprétation artistique, pas une localisation canonique exacte.
- Format WebP, `1672 × 941`, qualité 86, pour réduire le poids sans sacrifier le détail.
