# Loresmith — standard des images

Ce standard vaut pour toute image ajoutée à l'interface (décors, illustrations, ornements). Il existe pour une raison : une image affichée plus grande que sa taille réelle devient floue ou pixellisée, surtout sur les écrans haute densité (Mac, téléphones, 4K), qui affichent deux pixels réels par pixel CSS.

## Règles générales

1. **Résolution native.** Chaque image doit faire au moins **2 fois** sa plus grande taille d'affichage. Ne jamais agrandir une image après génération (pas d'upscale IA ou logiciel) : elle doit être générée à cette taille.
2. **Une image par fichier.** Pas de planches ni de découpes : une planche de 1536 px découpée en 20 morceaux donne 20 images trop petites.
3. **Aucun texte, aucun chiffre, aucune interface** dans l'image. Les libellés restent en HTML.
4. **Pas de cadre peint** autour des scènes et vignettes : les cadres sont gérés en CSS.
5. **Transparence réelle** pour tout objet détouré : PNG avec canal alpha, pas un fond noir à retirer ensuite.
6. **Format de livraison** : PNG (sans perte). La conversion en WebP optimisé est faite à l'intégration.
7. **Couleurs** : sRGB. Palette : noirs chauds, laiton et or patinés, améthyste, lueurs de bougie ambrées, touches de cyan froid. Éviter les noirs bleutés et les couleurs saturées.
8. **Nommage** : `categorie-sujet.png` en minuscules, sans accents (ex. `banniere-underdark.png`, `repli-artefact.png`).

## Formats par type

| Type | Taille de livraison | Ratio | Composition |
|---|---|---|---|
| Bannière d'univers ou de campagne | **2560 × 960** | 8:3 | Sujet dans le tiers droit ; les 40 % de gauche sombres et peu détaillés (le titre s'y pose). |
| Fond de page (Générateur, Table de jeu, Cartes, Combat, Bibliothèque) | **2560 × 1440** | 16:9 | Centre calme et sombre (le contenu le couvre) ; détails sur les bords et les coins. |
| Vignette de campagne ou de lieu | **1280 × 720** | 16:9 | Sujet centré, lisible en petit ; bas de l'image plus sombre (le titre s'y pose). |
| Illustration de repli par type de fiche | **1280 × 720** | 16:9 | Un objet ou une scène emblématique, centré, fond sombre uni. |
| Portrait (PNJ, joueur, avatar par défaut) | **1024 × 1024** | 1:1 | Buste centré, regard vers le spectateur, fond sombre uni ; le visage tient dans le cercle central (60 %). |
| Objet détouré (bougie, sablier, livre…) | **1024 × 1024** | 1:1 | PNG transparent, objet centré, marge de 8 % ; éclairage chaud venant du haut à gauche. |
| Coin ornemental | **512 × 512** | 1:1 | PNG transparent, coin **haut-gauche** seulement ; les deux branches se terminent par un filet fin de 2 % de la largeur, posé à 4 % du bord (il se raccorde aux filets CSS). |
| Séparateur horizontal | **2048 × 128** | 16:1 | PNG transparent, motif centré symétrique, extrémités qui s'effilent. |
| Décor de barre latérale | **800 × 2400** | 1:3 | Sujet dans le tiers **bas** ; les deux tiers du haut presque noirs (le menu s'y trouve). |
| Bord de table en bas de page | **3200 × 600** | 16:3 | Objets posés sur le bas de l'image ; la moitié du haut se fond dans le noir. |
| Bouton flottant du dé | **512 × 512** | 1:1 | PNG transparent, médaillon rond centré. |
| Emblème (faction, type de quête) | **512 × 512** | 1:1 | PNG transparent, symbole gravé dans un médaillon, lisible à 32 px. |

## Ce qui n'a plus besoin d'image

Les matières (parchemin, cuir, pierre veinée) sont générées en SVG procédural dans `src/shell/shell.css`. Elles restent nettes à toute résolution et ne pèsent rien. Une texture image n'est utile que si elle est **raccordable sur les quatre bords**, générée nativement en **2048 × 2048**.

## Inventaire des images d'interface

Toutes les images ci-dessous sont versionnées dans le dépôt : elles ne dépendent plus du Drive.
Source : dossier Drive « Loresmith », envoi du 28 octobre 2026 (originaux PNG 1672 × 941 et plus).

| Fichier (`public/images/ui/`) | Rôle | Original |
|---|---|---|
| `hero.webp` | Bannière de l'univers (accueil) | Gothic City Beneath the Cavern Depths |
| `hero-campagne.webp` | Bannière du Campaign Studio | Gothic City Beneath the Crystals |
| `repli-artifact.webp` | Fiche sans image : artefact | Amethyst Astrolabe on Obsidian |
| `repli-place.webp` | Fiche sans image : lieu | Amber Light at the Stone Sanctuary |
| `repli-person.webp` | Fiche sans image : personnage | Ancient Draconic Humanoid in Cave Shadows |
| `repli-vivant.webp` | Fiche sans image : espèce | Giant Blind Salamander of the Underdark |
| `repli-faction.webp` | Fiche sans image : faction | Heraldic Spider on a Frayed Amethyst Banner |
| `repli-mystery.webp` | Fiche sans image : mystère | The obsidian monolith's amethyst fissure |
| `repli-document.webp` | Fiche sans image : document | Ancient Sealed Parchment Dispatch |
| `repli-event.webp` | Fiche sans image : événement | Eclipse Over an Ancient Stone Circle |
| `bord-table.webp` | Bas de chaque page | Ancient Dungeon Master's Desk Edge |
| `avatar.webp` | Personnage sans portrait | Spider-marked Warral deep elf |
| `d20.webp` | Bouton flottant du dé | Antique Brass Medallion with Faceted Amethyst Die |
| `fond-table.webp` | Fond : Table de jeu | Subterranean obsidian gaming table |
| `fond-generateur.webp` | Fond : Générateur & voix | Obsidian Creator's Mineral Workshop |
| `fond-atlas.webp` | Fond : Cartes | Obsidian Cartographer's Chamber |
| `fond-combat.webp` | Fond : Combat | Obsidian Siege Ruins |
| `fond-bibliotheque.webp` | Fond : Bibliothèque et Archives | Obsidian archive of ancient books |
| `fond-campagnes.webp` | Fond : Campagnes | Obsidian Cavern Gateway |

**Villes** (`public/images/villes/`, liste dans `villes.json`) : Durn Kheled, Grik-Grak, Khord Varr, Nhal Sereth, Oruum, Ssilume, Ssyr Vael, Vasecroche, Vel Ashael, Zhaer Velyss, et deux panoramas gothiques. Réservées à la création de villes (Myconides, Duergars, etc.) ; pas encore affichées.

**Réserve** (`assets/reserve/`, hors du site) : *Hosten Valak assiégée par les Illithids*, réservée à une campagne précise. **Ne pas l'utiliser ailleurs.**
