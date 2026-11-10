# Directives pour générer les images de champs (ChatGPT, Midjourney…)

## Comment Loresmith pose un champ

- Sur la carte de navigation, un champ est une **lanière** de 60 à 100 m sur 18 à 27 m.
- Loresmith la découpe en **parcelles presque carrées** (environ 20 × 20 m). Chacune reçoit **une seule image entière**,
  jamais répétée en carrelage.
- Une étroite bande d'herbe sépare les parcelles. Les parcelles d'un même champ ont la même culture, sans être
  forcément la même image.
- L'image est **carrée** et un peu rognée au besoin. Elle peut être tournée d'un demi-tour ou mise en miroir pour varier.

## Ce qu'il faut demander

À coller au début de chaque demande, puis préciser la culture et la saison :

> Vue strictement verticale (orthographique, à 90°, sans perspective ni horizon), image **carrée 1:1**, 1024 × 1024
> ou plus. Une **seule parcelle cultivée qui remplit toute l'image**, d'un bord à l'autre, sans bordure, sans chemin,
> sans haie, sans clôture, sans bâtiment, sans personnage ni animal. Éclairage doux et diffus, ombres courtes, aucun
> vignettage. **Rangs de culture parallèles à un bord de l'image**, réguliers et visibles d'un bout à l'autre,
> espacés comme en vrai (environ 70 cm pour les pommes de terre, 50 cm pour les choux, un semis serré pour le blé).
> **Un seul état de la culture sur toute l'image** : pas de moitié récoltée et moitié sur pied, pas de bandes de
> couleurs différentes. La parcelle mesure environ 20 m de côté. Style : peinture réaliste pour carte de jeu de rôle.

À préciser ensuite :
- **Culture et état**, par exemple « blé mûr doré, prêt à moissonner » ou « jeunes choux en rangs sur terre brune ».
- **Saison** : printemps, été, automne ou hiver (neige, givre, chaume).
- **Climat**, si ce n'est pas tempéré : rizière inondée (chaud, tropical), terre sèche (aride).

## À éviter (ce qui donnait un rendu bizarre)

- Une image en hauteur (1024 × 1536) avec plusieurs bandes : une partie récoltée, une sur pied, un chemin.
  Découpée ou répétée, elle produit des rayures.
- Des rangs en biais : d'une parcelle à l'autre, ils ne s'alignent plus.
- Un cadre, une haie ou une ombre portée sur un bord : la bordure se voit à chaque parcelle.

## Variantes utiles

- **Deux ou trois images par culture et par saison**, même cadrage et même rangs, avec de petites différences : une
  touffe plus haute, un rang plus clair, quelques mauvaises herbes. Les parcelles voisines ne se ressemblent plus.
- **Nommer le fichier** d'après le contenu, en anglais ou en français : « Ripe golden wheat field, late summer ». Le
  script reconnaît la culture et la saison au titre (cf. `FERME_TEXTURES` dans `scripts/banque/build.py`).

Les vergers suivent les mêmes règles. Arbres alignés en quinconce, couronnes entières dans l'image, aucun arbre
coupé au bord si possible.
