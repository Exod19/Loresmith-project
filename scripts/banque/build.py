#!/usr/bin/env python3
"""
Banque Loresmith : conversion des images du Drive en WebP (256, 512 et 1024 px) et catalogue.

Usage (voir docs/banque/SYNCHRONISER.md) :
    python3 -I scripts/banque/build.py <dossier des originaux> [--drive scripts/banque/drive.json]

- Les originaux (PNG du Drive) sont nommés <id Drive>.png ; drive.json donne leur titre et leur dossier
  (elements, people, textures).
- Sortie : public/banque/<type>/<slug>-<taille>.webp et src/banque/catalogue.json.
- Les étiquettes (taille réelle, milieux, climats, peuple, rôles…) viennent des RÈGLES ci-dessous, lues sur le
  titre ; une image inconnue reçoit des étiquettes devinées, que le MJ peut retoucher dans la page Banque.
- Jamais d'agrandissement : une image plus petite que 1024 px garde sa taille d'origine comme plus grande version.
"""
import json
import os
import re
import sys
import unicodedata

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'banque')
CATALOGUE = os.path.join(ROOT, 'src', 'banque', 'catalogue.json')
SIZES = (256, 512, 1024)

# ——— Règles d'étiquetage : (motif sur le titre, étiquettes). La première règle qui correspond l'emporte. ———
# taille : [largeur, hauteur] en mètres de l'emprise visible (éléments) ; côté d'une tuile (textures).
T, F, C, TR, A = 'tempere', 'froid', 'chaud', 'tropical', 'aride'
ELEMENTS = [
    # Arbres
    (r'cime de ch|canop.e de ch', dict(nom='Chêne', cat='arbre', taille=[12, 12], milieux=['foret', 'campagne', 'ville'], climats=[T])),
    (r'tilleul', dict(nom='Tilleul', cat='arbre', taille=[10, 10], milieux=['ville', 'campagne'], climats=[T])),
    (r'couronne de pin', dict(nom='Pin', cat='arbre', taille=[7, 7], milieux=['foret', 'montagne'], climats=[T, F])),
    (r'pin forestier', dict(nom='Pin sylvestre', cat='arbre', taille=[8, 8], milieux=['foret', 'montagne'], climats=[T, F])),
    (r'couronne de sapin', dict(nom='Sapin', cat='arbre', taille=[6, 6], milieux=['foret', 'montagne'], climats=[T, F])),
    (r'snow-dusted fir', dict(nom='Sapin enneigé', cat='arbre', taille=[6, 6], milieux=['foret', 'montagne'], climats=[F], saisons=['hiver'])),
    (r'frosted tree', dict(nom='Arbre givré', cat='arbre', taille=[9, 9], milieux=['foret', 'campagne', 'ville'], climats=[F, T], saisons=['hiver'])),
    (r'leafless tree', dict(nom='Arbre dénudé', cat='arbre', taille=[9, 9], milieux=['foret', 'campagne', 'ville'], climats=[T, F], saisons=['hiver', 'automne'])),
    (r'.rable automnale', dict(nom='Érable d’automne', cat='arbre', taille=[10, 10], milieux=['foret', 'ville', 'campagne'], climats=[T], saisons=['automne'])),
    (r'poirier', dict(nom='Poirier', cat='arbre', taille=[6, 6], milieux=['campagne', 'ville'], climats=[T], saisons=['printemps', 'ete', 'automne'])),
    (r'pommier', dict(nom='Pommier', cat='arbre', taille=[5, 5], milieux=['campagne', 'ville'], climats=[T], saisons=['printemps', 'ete', 'automne'])),
    (r'willow', dict(nom='Saule', cat='arbre', taille=[10, 10], milieux=['marais', 'riviere', 'campagne'], climats=[T])),
    (r'acacia', dict(nom='Acacia', cat='arbre', taille=[12, 12], milieux=['savane', 'desert'], climats=[C, A])),
    (r'date palm', dict(nom='Palmier dattier', cat='arbre', taille=[8, 8], milieux=['desert', 'oasis', 'ville', 'cote'], climats=[C, A])),
    (r'fan palm', dict(nom='Palmier éventail', cat='arbre', taille=[5, 5], milieux=['jungle', 'cote', 'ville'], climats=[C, TR])),
    (r'tropical tree canopy', dict(nom='Arbre tropical', cat='arbre', taille=[14, 14], milieux=['jungle'], climats=[TR, C])),
    # Arbustes, plantes
    (r'juniper', dict(nom='Genévrier alpin', cat='arbuste', taille=[2, 2], milieux=['montagne', 'toundra'], climats=[F, T])),
    (r'ronces', dict(nom='Ronces', cat='arbuste', taille=[2.5, 2.5], milieux=['foret', 'campagne', 'ruine'], climats=[T])),
    (r'arbustes fleuris', dict(nom='Arbustes fleuris', cat='arbuste', taille=[2.5, 2.5], milieux=['ville', 'campagne', 'jardin'], climats=[T], saisons=['printemps', 'ete'])),
    (r'fern', dict(nom='Fougères', cat='arbuste', taille=[1.6, 1.6], milieux=['foret', 'jungle'], climats=[T, TR])),
    (r'cacti', dict(nom='Cactus', cat='arbuste', taille=[1.3, 1.3], milieux=['desert'], climats=[C, A])),
    (r'reeds', dict(nom='Roseaux', cat='plante-eau', taille=[2, 2], milieux=['marais', 'riviere'], climats=[T, F])),
    (r'lily pad', dict(nom='Nénuphars', cat='plante-eau', taille=[2, 2], milieux=['marais', 'riviere', 'lac'], climats=[T, TR], saisons=['printemps', 'ete'])),
    (r'kelp', dict(nom='Varech', cat='plante-eau', taille=[2, 2], milieux=['mer', 'cote'], region=['mer', 'surface'])),
    (r'coral', dict(nom='Corail', cat='plante-eau', taille=[2, 2], milieux=['mer'], climats=[C, TR], region=['mer'])),
    (r'champignons lumin', dict(nom='Champignons luminescents', cat='souterrain', taille=[1.5, 1.5], milieux=['caverne'], region=['outreterre'])),
    (r'stalagmites', dict(nom='Stalagmites', cat='souterrain', taille=[2.5, 2.5], milieux=['caverne'], region=['outreterre'])),
    (r'am.thystes', dict(nom='Améthystes', cat='souterrain', taille=[1.4, 1.4], milieux=['caverne', 'montagne'], region=['outreterre', 'surface'])),
    # Bois mort
    (r'stump', dict(nom='Souche creuse', cat='bois', taille=[2.2, 2.2], milieux=['foret', 'marais'], climats=[T, F])),
    (r'tronc de ch.ne mort', dict(nom='Tronc mort', cat='bois', taille=[5, 1.6], milieux=['foret', 'campagne'], climats=[T, F])),
    (r'driftwood', dict(nom='Bois flotté', cat='bois', taille=[4, 2], milieux=['cote', 'riviere'])),
    (r'tropical tree roots', dict(nom='Racines tropicales', cat='bois', taille=[4, 4], milieux=['jungle', 'marais'], climats=[TR, C])),
    # Rochers
    (r'six rochers', dict(nom='Amas de rochers', cat='rocher', taille=[3, 3], milieux=['montagne', 'campagne', 'foret'])),
    (r'granit fissur', dict(nom='Rocher de granit', cat='rocher', taille=[2.6, 2.6], milieux=['montagne', 'campagne', 'foret'])),
    (r'lichen-covered', dict(nom='Bloc alpin à lichens', cat='rocher', taille=[2.6, 2.6], milieux=['montagne', 'toundra'], climats=[F, T])),
    (r'snow-capped granite', dict(nom='Rocher enneigé', cat='rocher', taille=[2.6, 2.6], milieux=['montagne', 'toundra'], climats=[F], saisons=['hiver'])),
    (r'sandstone boulder', dict(nom='Rocher de grès', cat='rocher', taille=[3, 3], milieux=['desert', 'badlands'], climats=[C, A])),
    (r'obsidian(?!.*(boundary|base))', dict(nom='Obsidienne', cat='rocher', taille=[3, 3], milieux=['volcan', 'caverne'], region=['surface', 'outreterre'])),
    (r'basalt column', dict(nom='Orgues basaltiques', cat='rocher', taille=[3, 3], milieux=['volcan', 'cote', 'caverne'], region=['surface', 'outreterre'])),
    (r'basalt hex', dict(nom='Dalles de basalte', cat='rocher', taille=[2.6, 2.6], milieux=['volcan', 'cote', 'caverne'], region=['surface', 'outreterre'])),
    (r'glacial ice', dict(nom='Bloc de glace', cat='rocher', taille=[2.6, 2.6], milieux=['toundra', 'montagne', 'lac'], climats=[F], saisons=['hiver'])),
    # Toits (bâtiments vus du ciel)
    (r'toit terracotta en l', dict(nom='Maison en L (terre cuite)', cat='toit', forme='L', materiau='tuiles', taille=[14, 14], milieux=['ville', 'campagne'], climats=[T, C], usage=['maison'])),
    (r'toit de halle', dict(nom='Halle (tuiles)', cat='toit', forme='rect', materiau='tuiles', taille=[20, 10], milieux=['ville'], climats=[T], usage=['marche', 'atelier'])),
    (r'toit en ardoise et chemin', dict(nom='Maison (ardoise)', cat='toit', forme='rect', materiau='ardoise', taille=[10, 7], milieux=['ville', 'campagne'], climats=[T, F], usage=['maison'])),
    (r'petite maison, tuiles', dict(nom='Petite maison (tuiles)', cat='toit', forme='rect', materiau='tuiles', taille=[8, 6], milieux=['ville', 'campagne'], climats=[T], usage=['maison'])),
    (r'woodland thatch roof', dict(nom='Chaumière', cat='toit', forme='rect', materiau='chaume', taille=[9, 6], milieux=['campagne', 'foret'], climats=[T, F], usage=['maison', 'ferme'])),
    (r'manoir en u', dict(nom='Manoir en U (ardoise)', cat='toit', forme='U', materiau='ardoise', taille=[30, 20], milieux=['ville'], climats=[T, F], usage=['noble'])),
    (r'grange', dict(nom='Grange (chaume)', cat='toit', forme='rect', materiau='chaume', taille=[14, 8], milieux=['campagne'], climats=[T, F], usage=['ferme'])),
    (r'toit carr. de cabane', dict(nom='Cabane (bardeaux)', cat='toit', forme='carre', materiau='bardeaux', taille=[6, 6], milieux=['campagne', 'foret', 'ville'], climats=[T, F], usage=['maison'])),
    (r'toit conique', dict(nom='Tour (ardoise)', cat='toit', forme='rond', materiau='ardoise', taille=[7, 7], milieux=['ville'], climats=[T, F], usage=['tour'])),
    (r'cruciforme', dict(nom='Temple cruciforme (cuivre)', cat='toit', forme='croix', materiau='cuivre', taille=[18, 18], milieux=['ville'], usage=['temple'])),
    (r'toit de chaume m.di.val vu', dict(nom='Chaumière', cat='toit', forme='rect', materiau='chaume', taille=[6, 11], milieux=['campagne', 'ville'], climats=[T, F], usage=['maison', 'ferme'])),
    (r'ferme m.di.vale en chaume', dict(nom='Longère (chaume)', cat='toit', forme='rect', materiau='chaume', taille=[13, 5], milieux=['campagne'], climats=[T, F], usage=['ferme', 'maison'])),
    (r'adobe', dict(nom='Maison d’adobe', cat='toit', forme='rect', materiau='adobe', taille=[9, 7], milieux=['ville', 'desert'], climats=[C, A], usage=['maison', 'atelier'])),
    (r'ardoise en t', dict(nom='Bâtisse en T (ardoise)', cat='toit', forme='T', materiau='ardoise', taille=[14, 14], milieux=['ville'], climats=[T, F], usage=['civique', 'maison'])),
    (r'atelier m.di.val en l', dict(nom='Atelier en L (bardeaux)', cat='toit', forme='L', materiau='bardeaux', taille=[12, 12], milieux=['ville'], climats=[T, F], usage=['atelier'])),
    (r'auberge en t', dict(nom='Auberge en T (ardoise)', cat='toit', forme='T', materiau='ardoise', taille=[20, 13], milieux=['ville'], climats=[T, F], usage=['auberge', 'civique'])),
    (r'toit en l m.di.val en terre', dict(nom='Maison en L (terre cuite)', cat='toit', forme='L', materiau='terre-cuite', taille=[12, 12], milieux=['ville'], climats=[T, C], usage=['maison', 'atelier'])),
    (r'toit en ardoise, vue', dict(nom='Maison (ardoise)', cat='toit', forme='rect', materiau='ardoise', taille=[11, 7], milieux=['ville'], climats=[T, F], usage=['maison', 'civique'])),
    (r'tourbe', dict(nom='Maison de tourbe', cat='toit', forme='rect', materiau='tourbe', taille=[10, 6], milieux=['campagne', 'toundra'], climats=[F], usage=['maison', 'ferme'])),
    (r'bardeaux de c.dre', dict(nom='Maison (bardeaux de cèdre)', cat='toit', forme='rect', materiau='bardeaux', taille=[7, 11], milieux=['ville', 'foret'], climats=[T, F], usage=['maison'])),
    (r'en pierre avec trappe', dict(nom='Toit-terrasse de pierre', cat='toit', forme='carre', materiau='pierre', taille=[8, 8], milieux=['ville', 'desert'], climats=[C, A, T], usage=['maison', 'atelier'])),
    (r'toit m.di.val en terre cuite', dict(nom='Maison longue (terre cuite)', cat='toit', forme='rect', materiau='terre-cuite', taille=[11, 5], milieux=['ville'], climats=[T, C], usage=['maison'])),
    (r'tuiles de terre cuite', dict(nom='Maison (tuiles)', cat='toit', forme='carre', materiau='terre-cuite', taille=[10, 10], milieux=['ville'], climats=[T, C], usage=['maison', 'civique'])),
    (r'toiture m.di.vale en u', dict(nom='Bâtisse en U (ardoise)', cat='toit', forme='U', materiau='ardoise', taille=[16, 16], milieux=['ville'], climats=[T, F], usage=['civique', 'noble'])),
    (r'd.me de gr.s', dict(nom='Dôme de grès', cat='toit', forme='rond', materiau='gres', taille=[10, 10], milieux=['ville', 'desert'], climats=[C, A, T], usage=['temple', 'civique'])),
    # Ville et campagne
    (r'fontaine octogonale', dict(nom='Fontaine octogonale', cat='monument', taille=[7, 7], milieux=['ville'], usage=['place'])),
    (r'fontaine m.di.vale', dict(nom='Fontaine', cat='monument', taille=[5.5, 5.5], milieux=['ville'], usage=['place'])),
    (r'ob.lisque', dict(nom='Obélisque', cat='monument', taille=[7, 7], milieux=['ville', 'ruine'], usage=['place'])),
    (r'gardien de bronze', dict(nom='Statue de bronze', cat='monument', taille=[2.2, 2.2], milieux=['ville', 'ruine', 'temple'], usage=['place'])),
    (r'puits de village', dict(nom='Puits de village', cat='monument', taille=[2.4, 2.4], milieux=['ville', 'campagne'], usage=['place'])),
    (r'puits rustique', dict(nom='Puits rustique', cat='monument', taille=[2.2, 2.2], milieux=['campagne', 'ville'], usage=['place'])),
    (r'pont m.di.val', dict(nom='Pont de pierre', cat='pont', taille=[3.5, 14], milieux=['ville', 'campagne', 'riviere'])),
    (r'.tal m.di.val', dict(nom='Étal de marché', cat='marche', taille=[3, 3], milieux=['ville'], usage=['marche'])),
    (r'auvent', dict(nom='Auvent de toile', cat='marche', taille=[4, 3], milieux=['ville'], usage=['marche'])),
    (r'charrette', dict(nom='Charrette', cat='mobilier', taille=[1.4, 2.8], milieux=['ville', 'campagne'], usage=['marche', 'ferme'])),
    (r'feu de camp', dict(nom='Feu de camp', cat='feu', taille=[1.6, 1.6], milieux=['campagne', 'foret', 'caverne', 'camp'], region=['surface', 'outreterre'])),
    (r'b.ches fendues', dict(nom='Bûches empilées', cat='mobilier', taille=[1.6, 1.1], milieux=['campagne', 'ville', 'interieur'], usage=['ferme'])),
    (r'bac d.eau', dict(nom='Bac d’eau', cat='mobilier', taille=[0.9, 2.6], milieux=['ville', 'campagne', 'interieur'], usage=['ecurie', 'forge'])),
    # Mobilier intérieur
    (r'lit m.di.val|accessoire m.di.val isol', dict(nom='Lit', cat='mobilier', taille=[1.1, 2.1], milieux=['interieur'], usage=['lit'])),
    (r'baril', dict(nom='Tonneau', cat='mobilier', taille=[0.75, 0.75], milieux=['interieur', 'ville'], usage=['tonneau'])),
    (r'coffre en ch.ne', dict(nom='Coffre', cat='mobilier', taille=[1.2, 0.8], milieux=['interieur'], usage=['coffre'])),
    (r'prop m.di.val isol', dict(nom='Coffre ferré', cat='mobilier', taille=[1.4, 0.95], milieux=['interieur'], usage=['coffre'])),
    (r'table m.di.vale', dict(nom='Table de chêne', cat='mobilier', taille=[2.4, 1.2], milieux=['interieur'], usage=['table'])),
    (r'autel', dict(nom='Autel basaltique', cat='mobilier', taille=[2, 1.4], milieux=['interieur', 'temple', 'ruine'], usage=['autel'], region=['surface', 'outreterre'])),
    (r'sarcophage', dict(nom='Sarcophage', cat='mobilier', taille=[1.1, 2.4], milieux=['interieur', 'crypte', 'ruine'], usage=['tombeau'])),
    (r'sommet circulaire', dict(nom='Colonne brisée', cat='ruine', taille=[1.2, 1.2], milieux=['ruine', 'temple', 'interieur'], usage=['colonne'])),
    (r'souche de colonne', dict(nom='Base de colonne', cat='ruine', taille=[1.4, 1.4], milieux=['ruine', 'temple'], usage=['colonne'])),
]

# Canopées et sols du lot « forest-ground » (index du 2026-11-09) : canopée = tuile de 60 m, sols de 4 à 6 m.
CANOPEES = {'birch-aspen': ('Canopée de bouleaux et trembles', [T, F]), 'conifer-pine': ('Canopée de conifères', [T, F]),
            'deciduous': ('Canopée de feuillus', [T]), 'mixed': ('Canopée mixte', [T, F])}
SAISON_EN = {'spring': ('printemps', 'au printemps'), 'summer': ('ete', 'en été'), 'autumn': ('automne', 'en automne'), 'winter-snow': ('hiver', 'enneigée')}
TEXTURES_LOT_FORET = [
    *[(rf'forest-canopy-{k}-{sa}-seamless', dict(nom=f'{nom} {lab}', cat='canopee', taille=60, milieux=['foret'],
       climats=[F, T] if sa == 'winter-snow' else cl, saisons=[fr], raccorder=False))
      for k, (nom, cl) in CANOPEES.items() for sa, (fr, lab) in SAISON_EN.items()],
    (r'forest-canopy-dry-olive', dict(nom='Canopée sèche (oliviers)', cat='canopee', taille=60, milieux=['foret', 'savane'], climats=[C, A], raccorder=False)),
    (r'forest-canopy-tropical', dict(nom='Canopée tropicale', cat='canopee', taille=60, milieux=['jungle'], climats=[TR, C], raccorder=False)),
    (r'texture-herbe-seche', dict(nom='Herbe sèche', cat='herbe', taille=4, milieux=['campagne', 'savane'], climats=[T, C, A], saisons=['ete', 'automne'], raccorder=False)),
    (r'texture-herbe-verte', dict(nom='Herbe verte', cat='herbe', taille=4, milieux=['campagne', 'ville', 'foret'], climats=[T], saisons=['printemps', 'ete'], raccorder=False)),
    (r'texture-mousse', dict(nom='Mousse', cat='mousse', taille=4, milieux=['foret', 'marais'], climats=[T, F], raccorder=False)),
    (r'texture-neige', dict(nom='Neige', cat='neige', taille=6, milieux=['campagne', 'foret', 'montagne', 'toundra'], climats=[F, T], saisons=['hiver'], raccorder=False)),
    (r'texture-sous-bois-aiguilles', dict(nom='Sous-bois d’aiguilles de pin', cat='humus', taille=5, milieux=['foret'], climats=[T, F], raccorder=False)),
    (r'texture-sous-bois-feuilles', dict(nom='Sous-bois de feuilles mortes', cat='humus', taille=5, milieux=['foret'], climats=[T], raccorder=False)),
    (r'texture-terre-forestiere', dict(nom='Terre forestière', cat='humus', taille=5, milieux=['foret'], climats=[T], raccorder=False)),
    # Sols de saison (2e envoi du 2026-11-09).
    (r'texture-feuilles-bouleau-automne', dict(nom='Feuilles de bouleau d’automne', cat='humus', taille=5, milieux=['foret'], climats=[T, F], saisons=['automne'], raccorder=False)),
    (r'texture-feuilles-humides-automne', dict(nom='Feuilles humides d’automne', cat='humus', taille=5, milieux=['foret'], climats=[T], saisons=['automne'], raccorder=False)),
    (r'texture-sous-bois-pousses-printemps', dict(nom='Sous-bois de jeunes pousses', cat='humus', taille=5, milieux=['foret'], climats=[T], saisons=['printemps'], raccorder=False)),
    (r'texture-sous-bois-neige-partielle', dict(nom='Sous-bois sous la neige', cat='humus', taille=5, milieux=['foret'], climats=[T, F], saisons=['hiver'], raccorder=False)),
    (r'texture-prairie-fleurie-printemps', dict(nom='Prairie fleurie', cat='herbe', taille=4, milieux=['campagne', 'foret'], climats=[T], saisons=['printemps'], raccorder=False)),
    (r'texture-prairie-fanee-automne', dict(nom='Prairie fanée', cat='herbe', taille=4, milieux=['campagne'], climats=[T], saisons=['automne'], raccorder=False)),
    (r'texture-herbe-givree-hiver', dict(nom='Herbe givrée', cat='herbe', taille=4, milieux=['campagne', 'foret'], climats=[T, F], saisons=['hiver'], raccorder=False)),
    (r'texture-steppe-ete', dict(nom='Steppe', cat='herbe', taille=4, milieux=['steppe', 'campagne'], climats=[C, A, T], saisons=['ete', 'automne'], raccorder=False)),
    (r'texture-toundra-gelee-hiver', dict(nom='Toundra gelée', cat='toundra', taille=6, milieux=['toundra'], climats=[F], saisons=['hiver'], raccorder=False)),
    (r'texture-sable-sec-ete', dict(nom='Sable sec', cat='sable', taille=6, milieux=['desert', 'cote'], climats=[C, A, T], raccorder=False)),
    (r'texture-terre-craquelee-ete', dict(nom='Terre craquelée', cat='terre', taille=6, milieux=['desert', 'savane'], climats=[C, A], raccorder=False)),
    (r'texture-boue-degel-printemps', dict(nom='Boue de dégel', cat='boue', taille=5, milieux=['campagne', 'foret', 'route'], climats=[T, F], saisons=['printemps'], raccorder=False)),
]

TEXTURES = [
    *TEXTURES_LOT_FORET,
    # Textures corrigées en 2048 px (dossier « loresmith-textures-corrigees ») : canopées vues de haut (≈ 200 m), sols, eaux.
    (r'^foret-automnale', dict(nom='Forêt d’automne vue de haut', cat='canopee', taille=200, milieux=['foret'], climats=[T], saisons=['automne'])),
    (r'^foret-coniferes', dict(nom='Forêt de conifères vue de haut', cat='canopee', taille=200, milieux=['foret'], climats=[T, F])),
    (r'^foret-enneigee', dict(nom='Forêt enneigée vue de haut', cat='canopee', taille=200, milieux=['foret'], climats=[F, T], saisons=['hiver'])),
    (r'^foret-feuillus', dict(nom='Forêt de feuillus vue de haut', cat='canopee', taille=200, milieux=['foret'], climats=[T], saisons=['printemps', 'ete'])),
    (r'^foret-mixte', dict(nom='Forêt mixte vue de haut', cat='canopee', taille=200, milieux=['foret'], climats=[T, F], saisons=['printemps', 'ete'])),
    (r'^foret-tropicale', dict(nom='Forêt tropicale vue de haut', cat='canopee', taille=200, milieux=['jungle'], climats=[TR, C])),
    (r'^sol-aiguilles', dict(nom='Aiguilles de pin', cat='humus', taille=5, milieux=['foret'], climats=[T, F])),
    (r'^sol-feuilles', dict(nom='Feuilles mortes', cat='humus', taille=5, milieux=['foret'], climats=[T])),
    (r'^sol-humus', dict(nom='Humus', cat='humus', taille=5, milieux=['foret'], climats=[T])),
    (r'^sol-mousse', dict(nom='Mousse', cat='mousse', taille=4, milieux=['foret', 'marais'], climats=[T, F])),
    (r'^sol-herbe', dict(nom='Herbe', cat='herbe', taille=4, milieux=['campagne', 'ville', 'foret'], climats=[T], saisons=['printemps', 'ete'])),
    (r'^sol-terre', dict(nom='Terre', cat='terre', taille=5, milieux=['ville', 'campagne', 'route'])),
    (r'^sol-gravier', dict(nom='Gravier', cat='gravier', taille=4, milieux=['route', 'riviere', 'montagne', 'campagne'])),
    (r'^sol-calcaire', dict(nom='Calcaire', cat='roche', taille=6, milieux=['montagne', 'campagne'])),
    (r'^sol-granite', dict(nom='Granite', cat='roche', taille=6, milieux=['montagne', 'campagne'])),
    (r'^sol-paves', dict(nom='Pavés', cat='paves', taille=8, milieux=['ville'])),
    (r'^sol-sable-humide', dict(nom='Sable humide', cat='sable', taille=5, milieux=['cote', 'riviere', 'lac'])),
    (r'^sol-sable-sec', dict(nom='Sable sec', cat='sable', taille=6, milieux=['desert', 'cote'], climats=[C, A, T])),
    (r'^eau-claire', dict(nom='Eau claire', cat='eau', taille=8, usage=['peu-profonde', 'claire'], milieux=['riviere', 'lac', 'mer'], climats=[T, C, TR])),
    (r'^eau-profonde', dict(nom='Eau profonde', cat='eau', taille=12, usage=['profonde'], milieux=['riviere', 'lac', 'mer'])),
    (r'^eau-trouble', dict(nom='Eau trouble', cat='eau', taille=10, usage=['peu-profonde', 'boueuse'], milieux=['riviere', 'marais', 'lac'], climats=[T, F])),
    (r'cendre volcanique', dict(nom='Cendre volcanique', cat='cendre', taille=6, milieux=['volcan'])),
    (r'cro.te volcanique', dict(nom='Croûte de lave', cat='lave', taille=6, milieux=['volcan'], region=['surface', 'outreterre'])),
    (r'dalles de pierre', dict(nom='Dalles de pierre', cat='dalles', taille=4, milieux=['interieur', 'ville', 'temple', 'caverne'], region=['surface', 'outreterre'])),
    # Eaux : `usage` dit la profondeur (peu-profonde près des berges, profonde au milieu) et l'aspect (boueuse, claire).
    (r'eau de rivi.re boueuse', dict(nom='Eau boueuse', cat='eau', taille=10, usage=['peu-profonde', 'boueuse'], raccorder=True, milieux=['riviere', 'marais', 'lac'], climats=[T, F])),
    (r'eau profonde vert sombre', dict(nom='Eau profonde', cat='eau', taille=12, usage=['profonde'], milieux=['riviere', 'lac', 'mer'], region=['surface', 'mer'], raccorder=True)),
    (r'eau claire turquoise peu profonde', dict(nom='Eau claire peu profonde', cat='eau', taille=8, usage=['peu-profonde', 'claire'], raccorder=True, milieux=['mer', 'lac', 'riviere'], climats=[T, C, TR])),
    (r'eau douce turquoise', dict(nom='Eau claire', cat='eau', taille=8, usage=['peu-profonde', 'claire'], milieux=['riviere', 'lac'], climats=[C, TR, T])),
    (r'eau sombre', dict(nom='Eau sombre', cat='eau', taille=8, usage=['profonde'], milieux=['riviere', 'lac', 'mer', 'marais'], region=['surface', 'mer', 'outreterre'])),
    (r'flanc montagneux', dict(nom='Granite fracturé', cat='roche', taille=8, milieux=['montagne'])),
    (r'glace lacustre', dict(nom='Glace', cat='glace', taille=8, milieux=['lac', 'riviere'], climats=[F], saisons=['hiver'])),
    (r'herbe dense', dict(nom='Prairie', cat='herbe', taille=4, milieux=['campagne', 'ville'], climats=[T], saisons=['printemps', 'ete'])),
    (r'herbes folles', dict(nom='Herbes folles dorées', cat='champ', taille=4, milieux=['campagne', 'savane'], climats=[T, C], saisons=['ete', 'automne'])),
    (r'mousse foresti', dict(nom='Mousse forestière', cat='mousse', taille=4, milieux=['foret'], climats=[T])),
    (r'neige ivoire', dict(nom='Neige fraîche', cat='neige', taille=6, milieux=['campagne', 'ville', 'montagne', 'toundra'], climats=[F, T], saisons=['hiver'])),
    (r'pav.s m.di.vaux', dict(nom='Pavés', cat='paves', taille=4, milieux=['ville'])),
    (r'planches de bois', dict(nom='Planches', cat='planches', taille=3, milieux=['interieur', 'ponton'])),
    (r'^(?!angle).*plateau granitique', dict(nom='Plateau rocheux', cat='roche', taille=8, milieux=['montagne'])),
    (r'sol brun granuleux', dict(nom='Terre battue', cat='terre', taille=5, milieux=['ville', 'campagne', 'route'])),
    (r'sol rocheux sombre', dict(nom='Roche sombre veinée', cat='roche', taille=6, milieux=['caverne'], region=['outreterre'])),
    (r'sol tropical', dict(nom='Sol de jungle', cat='humus', taille=5, milieux=['jungle'], climats=[TR, C])),
    (r'sous-bois', dict(nom='Sous-bois', cat='humus', taille=5, milieux=['foret'], climats=[T], saisons=['automne', 'hiver', 'printemps', 'ete'])),
    (r'tapis de ronces', dict(nom='Ronces', cat='ronces', taille=4, milieux=['foret', 'ruine'], climats=[T])),
    (r'badlands', dict(nom='Terre craquelée', cat='terre', taille=6, milieux=['desert', 'badlands'], climats=[C, A])),
    (r'boue humide', dict(nom='Boue', cat='boue', taille=5, milieux=['marais', 'campagne', 'route'])),
    (r'granite alpin', dict(nom='Granite alpin', cat='roche', taille=6, milieux=['montagne'], climats=[F, T])),
    (r'sable ocre', dict(nom='Sable ocre', cat='sable', taille=6, milieux=['desert', 'cote'], climats=[C, A])),
    (r'toundra', dict(nom='Toundra', cat='toundra', taille=6, milieux=['toundra', 'montagne'], climats=[F])),
    (r'tourbi.re', dict(nom='Tourbière', cat='boue', taille=6, milieux=['marais'], climats=[T, F])),
    (r'.boulis', dict(nom='Éboulis', cat='eboulis', taille=5, milieux=['montagne'])),
]

# Personnages. peuple : humain, nain, elfe, demi-elfe, halfelin, gnome, demi-orque, tieffelin (drow, duergar… à venir).
# paire : même personnage en portrait et en jeton (vue du dessus).
PEOPLE = [
    # Portraits
    (r'apple merchant', dict(nom='Marchande de pommes', peuple='humain', genre='f', roles=['marchand', 'marche', 'villageois'], paire='apple basket token')),
    (r'auburn-haired servant', dict(nom='Servante au seau', peuple='humain', genre='f', roles=['servante', 'domestique', 'serveur', 'villageois'], paire='bucket bearer')),
    (r'braided girl', dict(nom='Fillette au cheval de bois', peuple='humain', genre='f', roles=['enfant'], paire='child with wooden toy')),
    (r'cheerful halfling tavern', dict(nom='Serveur halfelin', peuple='halfelin', genre='m', roles=['serveur', 'tavernier', 'aubergiste'], paire='token with tray')),
    (r'chiaroscuro dwarf laborer', dict(nom='Manœuvre nain', peuple='nain', genre='m', roles=['ouvrier', 'porteur', 'mineur', 'villageois'], paire='dark fantasy dwarf token')),
    (r'city watch captain', dict(nom='Capitaine du guet', peuple='humain', genre='f', roles=['garde', 'capitaine', 'soldat', 'officier'], paire='darksteel officer')),
    (r'copper-skinned elf', dict(nom='Elfe voyageuse', peuple='elfe', genre='f', roles=['voyageur', 'marchand', 'pelerin'], paire='traveler in overhead conversation')),
    (r'elderly gnome scholar', dict(nom='Vieille érudite gnome', peuple='gnome', genre='f', roles=['erudit', 'savant', 'mage', 'archiviste', 'scribe'], paire='gnome scholar reading')),
    (r'elderly halfling villager', dict(nom='Vieil halfelin', peuple='halfelin', genre='m', roles=['villageois', 'ancien', 'fermier'], paire='halfling traveler with a staff')),
    (r'elven pickpocket', dict(nom='Pickpocket elfe', peuple='elfe', genre='m', roles=['voleur', 'espion', 'vagabond'], paire='sneaking map token')),
    (r'half-elf healer', dict(nom='Guérisseuse demi-elfe', peuple='demi-elfe', genre='f', roles=['soigneur', 'guerisseur', 'herboriste', 'servante'], paire='medic token')),
    (r'half-orc dock porter', dict(nom='Docker demi-orque', peuple='demi-orque', genre='m', roles=['porteur', 'docker', 'ouvrier', 'marin'], paire='traveler carrying a wooden crate')),
    (r'half-orc merchant', dict(nom='Marchand demi-orque', peuple='demi-orque', genre='m', roles=['marchand', 'boutiquier', 'negociant'], paire='dark fantasy overhead game token')),
    (r'silver-crowned elven priestess', dict(nom='Prêtresse elfe', peuple='elfe', genre='f', roles=['pretre', 'pretresse', 'clerc', 'oracle'], paire='overhead dark fantasy game token-8')),
    (r'soot-marked half-orc blacksmith', dict(nom='Forgeronne demi-orque', peuple='demi-orque', genre='f', roles=['forgeron', 'armurier', 'artisan'], paire='blacksmith with hammer')),
    (r'velvet-clad tiefling noble', dict(nom='Noble tieffelin', peuple='tieffelin', genre='m', roles=['noble', 'seigneur', 'diplomate', 'marchand'], paire='tiefling noble map token')),
    (r'weary tiefling traveler', dict(nom='Voyageur tieffelin', peuple='tieffelin', genre='m', roles=['voyageur', 'aventurier', 'pelerin'], paire='dark-fantasy traveler token')),
    (r'weathered beggar', dict(nom='Mendiant', peuple='humain', genre='m', roles=['mendiant', 'vagabond'], paire='cross-legged cloaked figure')),
    (r'weathered dwarf pilgrim', dict(nom='Pèlerine naine', peuple='nain', genre='f', roles=['pelerin', 'voyageur', 'fidele'], paire='dwarf with staff and backpack')),
    (r'weathered dwarf town guard', dict(nom='Garde nain', peuple='nain', genre='m', roles=['garde', 'soldat', 'sentinelle'], paire='shieldbearer')),
    (r'weathered farmer', dict(nom='Fermière à la faucille', peuple='humain', genre='f', roles=['fermier', 'paysan', 'villageois'], paire='sickle token')),
    (r'young gnome apprentice', dict(nom='Apprenti gnome', peuple='gnome', genre='m', roles=['apprenti', 'artisan', 'bricoleur'], paire='gnome token with wooden tool')),
    # Portraits ajoutés le 31 octobre 2026 (jeton apparié dans `paire`)
    (r'braided auburn dwarf guildmaster', dict(nom='Maître de guilde nain', peuple='nain', genre='m', roles=['guilde', 'marchand', 'notable', 'maitre'], paire='stout dwarf battlemap')),
    (r'calm freckled city guard', dict(nom='Garde de la ville', peuple='humain', genre='f', roles=['garde', 'soldat', 'sentinelle'], paire='armored warrior with wooden shield')),
    (r'copper-braided dwarf explorer', dict(nom='Exploratrice naine', peuple='nain', genre='f', roles=['explorateur', 'voyageur', 'aventurier', 'guide'], paire='dwarf explorer with staff')),
    (r'dwarven girl with woven basket', dict(nom='Fillette naine au panier', peuple='nain', genre='f', roles=['enfant'], paire='dwarf girl with basket')),
    (r'dwarven potter', dict(nom='Potière naine', peuple='nain', genre='f', roles=['potier', 'artisan'], paire='dwarf artisan with clay bowl')),
    (r'dwarven cook with ladle', dict(nom='Cuisinier nain', peuple='nain', genre='m', roles=['cuisinier', 'aubergiste', 'tavernier', 'serveur'], paire='dwarf with saucepan')),
    (r'elderly gnome cobbler', dict(nom='Vieux cordonnier gnome', peuple='gnome', genre='m', roles=['cordonnier', 'artisan'], paire='gnome shoemaker')),
    (r'elven archivist with worn', dict(nom='Archiviste elfe', peuple='elfe', genre='m', roles=['erudit', 'archiviste', 'scribe', 'bibliothecaire'], paire='moss-robed elf archivist')),
    (r'freckled dwarf baker', dict(nom='Boulangère naine', peuple='nain', genre='f', roles=['boulanger', 'marchand', 'cuisinier'], paire='dwarf baker with a loaf')),
    (r'freckled medieval boy', dict(nom='Garçon à la balle', peuple='humain', genre='m', roles=['enfant'], paire='medieval boy with cloth ball')),
    (r'friendly tiefling townsman', dict(nom='Bourgeois tieffelin', peuple='tieffelin', genre='m', roles=['villageois', 'client', 'marchand'], paire='tiefling merchant with market sack')),
    (r'ginger halfling farmer', dict(nom='Fermier halfelin', peuple='halfelin', genre='m', roles=['fermier', 'paysan', 'marchand'], paire='halfling with straw hat')),
    (r'gray-haired officiant', dict(nom='Officiant funéraire', peuple='humain', genre='m', roles=['pretre', 'officiant', 'fossoyeur', 'croque-mort'], paire='funerary officiant')),
    (r'half-elf cloth merchant portrait', dict(nom='Drapière demi-elfe', peuple='demi-elfe', genre='f', roles=['marchand', 'drapier', 'boutiquier'], paire='half-elf cloth merchant map token')),
    (r'half-elf diplomat', dict(nom='Diplomate demi-elfe', peuple='demi-elfe', genre='f', roles=['diplomate', 'noble', 'messager', 'conseiller'], paire='half-elf loresmith with sealed scroll')),
    (r'half-orc smuggler', dict(nom='Contrebandier demi-orque', peuple='demi-orque', genre='m', roles=['contrebandier', 'voleur', 'docker', 'porteur'], paire='half-orc battlemap token')),
    (r'half-orc tailor with slate', dict(nom='Tailleuse demi-orque', peuple='demi-orque', genre='f', roles=['tailleur', 'couturier', 'artisan'], paire='half-orc tailor map token')),
    (r'half-elf girl with book satchel', dict(nom='Jeune fille demi-elfe', peuple='demi-elfe', genre='f', roles=['enfant', 'apprenti', 'eleve'], paire='overhead half-elf with satchel')),
    (r'halfling healer with linen', dict(nom='Guérisseuse halfeline', peuple='halfelin', genre='f', roles=['soigneur', 'guerisseur'], paire='halfling healer with bandage roll')),
    (r'medieval carpenter holding', dict(nom='Charpentier', peuple='humain', genre='m', roles=['charpentier', 'menuisier', 'artisan', 'ouvrier'], paire='overhead medieval carpenter')),
    (r'mischievous halfling merchant', dict(nom='Marchand halfelin', peuple='halfelin', genre='m', roles=['marchand', 'colporteur', 'boutiquier'], paire='halfling with brass candlestick')),
    (r'portrait of a dwarf laundress', dict(nom='Lavandière naine', peuple='nain', genre='f', roles=['lavandiere', 'servante', 'domestique'], paire='dwarf holding folded laundry')),
    (r'resilient gnome ragpicker', dict(nom='Chiffonnière gnome', peuple='gnome', genre='f', roles=['chiffonnier', 'mendiant', 'vagabond', 'couturier'], paire='gnome seamstress token')),
    (r'rust-cloaked courier', dict(nom='Messagère', peuple='humain', genre='f', roles=['messager', 'coursier', 'voyageur'], paire='overhead courier with dispatch')),
    (r'shy tiefling boy', dict(nom='Garçon tieffelin', peuple='tieffelin', genre='m', roles=['enfant'], paire='tiefling boy map token')),
    (r'silver-bearded dwarf priest', dict(nom='Prêtre nain', peuple='nain', genre='m', roles=['pretre', 'clerc'], paire='elder dwarf with book and ochre')),
    (r'silver-haired noblewoman', dict(nom='Noble dame', peuple='humain', genre='f', roles=['noble', 'dame', 'seigneur'], paire='silver-curled noblewoman')),
    (r'silver-horned tiefling bookseller', dict(nom='Libraire tieffeline', peuple='tieffelin', genre='f', roles=['libraire', 'marchand', 'erudit'], paire='tiefling lorekeeper')),
    (r'silver-braided elven sentinel', dict(nom='Sentinelle elfe', peuple='elfe', genre='f', roles=['garde', 'eclaireur', 'chasseur', 'archer', 'sentinelle'], paire='silver-haired archer token')),
    (r'gnome herbalist-\d', dict(nom='Herboriste gnome', peuple='gnome', genre='f', roles=['herboriste', 'soigneur', 'guerisseur'], paire='gnome herbalist token')),
    (r'stern half-orc watchman', dict(nom='Garde demi-orque', peuple='demi-orque', genre='m', roles=['garde', 'soldat', 'sentinelle'])),
    (r'household steward', dict(nom='Intendante', peuple='humain', genre='f', roles=['intendant', 'domestique', 'scribe'], paire='loresmith ledger keeper')),
    (r'ledger-keeping clerk', dict(nom='Commise aux écritures', peuple='humain', genre='f', roles=['scribe', 'commis', 'comptable'], paire='plum-gowned loresmith')),
    (r'thoughtful dwarf cartographer', dict(nom='Cartographe nain', peuple='nain', genre='m', roles=['cartographe', 'erudit', 'explorateur'], paire='dwarf cartographer battle token')),
    (r'traveling halfling bard', dict(nom='Barde halfelin', peuple='halfelin', genre='m', roles=['barde', 'musicien', 'menestrel', 'voyageur'], paire='overhead halfling bard')),
    (r'weathered elf caravan trader', dict(nom='Caravanier elfe', peuple='elfe', genre='m', roles=['marchand', 'caravanier', 'voyageur'], paire='elven caravan merchant')),
    (r'weathered fisherman with coiled net', dict(nom='Pêcheur', peuple='humain', genre='m', roles=['pecheur', 'marin'], paire='elderly fisherman token')),
    (r'weathered fishmonger', dict(nom='Poissonnier', peuple='humain', genre='m', roles=['poissonnier', 'marchand'], paire='medieval fishmonger token')),
    (r'weathered half-elf laborer', dict(nom='Ouvrière demi-elfe', peuple='demi-elfe', genre='f', roles=['ouvrier', 'porteur', 'docker', 'villageois'], paire='half-elf laborer battle token')),
    (r'weathered medieval informant', dict(nom='Informatrice', peuple='humain', genre='f', roles=['espion', 'informateur', 'voleur'], paire='adventurer with burgundy scarf')),
    (r'zenith view of a leather-clad', dict(nom='Aventurier en cuir', peuple='humain', genre='m', roles=['aventurier', 'voleur', 'voyageur'])),
    # Jetons sans portrait
    (r'red-haired dwarf tavern keeper', dict(nom='Tavernière naine', peuple='nain', genre='f', roles=['tavernier', 'aubergiste', 'serveur'])),
    (r'halfling innkeeper', dict(nom='Aubergiste halfelin', peuple='halfelin', genre='m', roles=['aubergiste', 'tavernier'])),
    (r'kneeling healer', dict(nom='Guérisseuse agenouillée', peuple='demi-elfe', genre='f', roles=['soigneur', 'guerisseur'], pose='agenouille')),
    (r'kneeling prayer', dict(nom='Pèlerine en prière', peuple='nain', genre='f', roles=['pelerin', 'fidele'], pose='agenouille')),
    (r'resting with a bandaged arm', dict(nom='Blessé au repos', peuple='nain', genre='m', roles=['blesse', 'ouvrier'], pose='assis')),
    (r'sleeping dark fantasy wanderer', dict(nom='Vagabond endormi', peuple='nain', genre='m', roles=['vagabond', 'dormeur'], pose='couche')),
    (r'seated dark fantasy', dict(nom='Vieil halfelin assis', peuple='halfelin', genre='m', roles=['villageois', 'ancien', 'client'], pose='assis')),
    (r'running adventurer', dict(nom='Tieffelin en course', peuple='tieffelin', genre='m', roles=['aventurier', 'voyageur', 'fuyard'])),
    (r'top-down dark fantasy defender', dict(nom='Défenseur', peuple='elfe', genre='m', roles=['voleur', 'espion', 'aventurier'])),
    (r'overhead dark fantasy map token-16', dict(nom='Elfe en robe verte', peuple='elfe', genre='f', roles=['voyageur', 'villageois', 'client'])),
]

# Jetons appariés à un portrait : on reprend peuple et rôles du portrait.
# Jetons pris vraiment à la verticale (on voit le dessus de la tête, pas le visage) : `angle: zenith`. Les autres sont
# inclinés d'environ 15° (visage et pieds visibles) ; sur un plan vu de haut, la banque préfère les premiers.
ZENITH = ['-zenith-jeton', 'elder dwarf with book', 'halfling healer with bandage', 'funerary officiant', 'silver-haired archer',
          'armored warrior with wooden shield', 'zenith view of a leather-clad']

TOKEN_ALIASES = {
    'apple basket token': 'apple merchant', 'bucket bearer': 'auburn-haired servant', 'child with wooden toy': 'braided girl',
    'token with tray': 'cheerful halfling tavern', 'dark fantasy dwarf token': 'chiaroscuro dwarf laborer', 'darksteel officer': 'city watch captain',
    'traveler in overhead conversation': 'copper-skinned elf', 'gnome scholar reading': 'elderly gnome scholar',
    'halfling traveler with a staff': 'elderly halfling villager', 'sneaking map token': 'elven pickpocket', 'medic token': 'half-elf healer',
    'traveler carrying a wooden crate': 'half-orc dock porter', 'dark fantasy overhead game token': 'half-orc merchant',
    'overhead dark fantasy game token-8': 'silver-crowned elven priestess', 'blacksmith with hammer': 'soot-marked half-orc blacksmith',
    'tiefling noble map token': 'velvet-clad tiefling noble', 'dark-fantasy traveler token': 'weary tiefling traveler',
    'cross-legged cloaked figure': 'weathered beggar', 'dwarf with staff and backpack': 'weathered dwarf pilgrim', 'shieldbearer': 'weathered dwarf town guard',
    'sickle token': 'weathered farmer', 'gnome token with wooden tool': 'young gnome apprentice',
    'stout dwarf battlemap': 'braided auburn dwarf guildmaster',
    'armored warrior with wooden shield': 'calm freckled city guard',
    'dwarf explorer with staff': 'copper-braided dwarf explorer',
    'dwarf girl with basket': 'dwarven girl with woven basket',
    'dwarf artisan with clay bowl': 'dwarven potter',
    'dwarf with saucepan': 'dwarven cook with ladle',
    'gnome shoemaker': 'elderly gnome cobbler',
    'moss-robed elf archivist': 'elven archivist with worn',
    'dwarf baker with a loaf': 'freckled dwarf baker',
    'medieval boy with cloth ball': 'freckled medieval boy',
    'tiefling merchant with market sack': 'friendly tiefling townsman',
    'halfling with straw hat': 'ginger halfling farmer',
    'funerary officiant': 'gray-haired officiant',
    'half-elf cloth merchant map token': 'half-elf cloth merchant portrait',
    'half-elf loresmith with sealed scroll': 'half-elf diplomat',
    'half-orc battlemap token': 'half-orc smuggler',
    'half-orc tailor map token': 'half-orc tailor with slate',
    'overhead half-elf with satchel': 'half-elf girl with book satchel',
    'halfling healer with bandage roll': 'halfling healer with linen',
    'overhead medieval carpenter': 'medieval carpenter holding',
    'halfling with brass candlestick': 'mischievous halfling merchant',
    'dwarf holding folded laundry': 'portrait of a dwarf laundress',
    'gnome seamstress token': 'resilient gnome ragpicker',
    'overhead courier with dispatch': 'rust-cloaked courier',
    'tiefling boy map token': 'shy tiefling boy',
    'elder dwarf with book and ochre': 'silver-bearded dwarf priest',
    'silver-curled noblewoman': 'silver-haired noblewoman',
    'tiefling lorekeeper': 'silver-horned tiefling bookseller',
    'silver-haired archer token': 'silver-braided elven sentinel',
    'gnome herbalist token': 'gnome herbalist-4',
    'loresmith ledger keeper': 'household steward',
    'plum-gowned loresmith': 'ledger-keeping clerk',
    'dwarf cartographer battle token': 'thoughtful dwarf cartographer',
    'overhead halfling bard': 'traveling halfling bard',
    'elven caravan merchant': 'weathered elf caravan trader',
    'elderly fisherman token': 'weathered fisherman with coiled net',
    'medieval fishmonger token': 'weathered fishmonger',
    'half-elf laborer battle token': 'weathered half-elf laborer',
    'adventurer with burgundy scarf': 'weathered medieval informant',
}


# ——— Règles générales (synchronisation du 2026-11-03 : huit dossiers, surface et Outreterre) ———
# Elles s'appliquent après les règles précises ci-dessus, sur les mots du titre (anglais ou français). La région vient
# du dossier du Drive ; une règle peut l'élargir.
O = 'outreterre'

# Monde imposé par le MJ à des images rangées dans le dossier d'un autre monde (le dossier décide, sauf ici).
# Les scorpions géants vivent dans l'Underdark (indication du MJ, 2026-11-04), même déposés avec la surface.
MONDE_FORCE = [(r'scorpion', 'outreterre')]

# Fichiers déposés par erreur (images sans rapport, maquettes d'écran) : ignorés, et signalés.
EXCLURE = [r'investment and returns', r'planning for a stronger', r'coffee, clarity', r'empty chair, working legacy',
           r'navigation map', r'galerie basse n', r'passage from floor to ceiling']

# Textures : (motif, étiquettes). `tactique` : tuile de plateau dessinée (berges, gué, ravin), pas une texture répétable.
TEXTURES_GEN = [
    # Canopées vues de haut (forêts des plans de pleine nature) : du plus précis au plus général.
    (r'(canop|canopy|cimes?).*(enneig|neige|snow|givr)|(enneig|neige|snow).*(canop|canopy|cimes?)', dict(nom='Canopée enneigée', cat='canopee', taille=60, milieux=['foret'], climats=[F, T], saisons=['hiver'])),
    (r'(canop|canopy|cimes?).*(automn|autumn|fall)|(automn|autumn).*(canop|canopy)', dict(nom='Canopée d’automne', cat='canopee', taille=60, milieux=['foret'], climats=[T], saisons=['automne'])),
    (r'(canop|canopy|cimes?).*(conif|pin|sapin|pine|spruce|fir|taiga|boreal)|(conif|pine|spruce|boreal|taiga).*(canop|canopy)', dict(nom='Canopée de conifères', cat='canopee', taille=60, milieux=['foret'], climats=[T, F])),
    (r'(canop|canopy|cimes?).*(tropic|jungle|palm)|(jungle|tropical).*(canop|canopy)', dict(nom='Canopée tropicale', cat='canopee', taille=60, milieux=['jungle'], climats=[TR, C])),
    (r'(canop|canopy|cimes?).*(sec|dry|savan|olive)|(dry|savanna).*(canop|canopy)', dict(nom='Canopée sèche', cat='canopee', taille=60, milieux=['foret'], climats=[C, A])),
    (r'canop|canopy|cimes des arbres|forest from above|for.t vue du ciel', dict(nom='Canopée de feuillus', cat='canopee', taille=60, milieux=['foret'], climats=[T], saisons=['printemps', 'ete'])),
    (r'cavern floor|cave floor', dict(nom='Sol de caverne', cat='roche', taille=6, milieux=['caverne'], region=[O])),
    (r'bedrock', dict(nom='Roche-mère calcaire', cat='roche', taille=6, milieux=['caverne'], region=[O])),
    (r'silt floor', dict(nom='Limon humide', cat='vase', taille=6, milieux=['caverne', 'lac'], region=[O])),
    (r'pine needle', dict(nom='Aiguilles de pin', cat='humus', taille=4, milieux=['foret'], climats=[T, F])),
    (r'humus', dict(nom='Humus forestier', cat='humus', taille=4, milieux=['foret'], climats=[T])),
    (r'moss carpet', dict(nom='Tapis de mousse', cat='mousse', taille=4, milieux=['foret', 'marais'], climats=[T, F])),
    (r'beige sand', dict(nom='Sable fin', cat='sable', taille=5, milieux=['cote', 'desert'], climats=[T, C, A])),
    (r'taupe sand', dict(nom='Sable humide', cat='sable', taille=5, milieux=['cote', 'riviere', 'lac'])),
    (r'gravel', dict(nom='Gravier', cat='gravier', taille=4, milieux=['route', 'riviere', 'montagne', 'campagne'])),
    (r'limestone texture', dict(nom='Calcaire pâle', cat='roche', taille=6, milieux=['montagne', 'interieur', 'caverne'], region=['surface', O])),
    (r'granite texture', dict(nom='Granite gris', cat='roche', taille=6, milieux=['montagne', 'campagne'])),
    (r'rivi.re|river|gu.|rivage|baie|promontoire|fluvial', dict(nom=None, cat='tuile-eau', taille=12, usage=['tactique'], milieux=['riviere', 'lac'])),
    (r'ravin|ravine|plateau', dict(nom=None, cat='tuile-roche', taille=12, usage=['tactique'], milieux=['montagne'])),
]

# Éléments : (motif, catégorie, taille en mètres, milieux). Le premier motif qui correspond l'emporte.
ELEMENTS_GEN = [
    (r'miniature base|socle|\bbase\b', 'socle', [1.5, 1.5], []),
    # Avant les arbres : « Ivy-Crowned Stone Well » est un puits, « termite mound crown » une termitière.
    (r'\bwell\b|\bpuits\b', 'monument', [2.5, 2.5], ['ville', 'campagne', 'ruine']),
    (r'termite', 'divers', [2.5, 2.5], ['desert', 'savane']),
    (r'shrub canopy|banana', 'arbuste', [3, 3], ['foret', 'campagne', 'jungle']),
    (r'canopy|crown|cime|couronne', 'arbre', [9, 9], ['foret', 'campagne']),
    (r'lily|nenuphar|reeds|cattail|roseau|sedge|tussock', 'plante-eau', [1.5, 1.5], ['marais', 'riviere', 'lac']),
    (r'cactus|cacti|agave|bromeliad|fern|wildflower|grass patch|lichen|juniper', 'arbuste', [1.6, 1.6], ['foret', 'campagne']),
    (r'shrub|bramble|hazel|hawthorn|thorn', 'arbuste', [2.5, 2.5], ['foret', 'campagne']),
    (r'mushroom|fungal|fungi', 'champignon', [2.5, 2.5], ['caverne', 'foret']),
    (r'crystal|quartz|amethyst', 'cristal', [1.6, 1.6], ['caverne']),
    (r'stalagmite|pillar', 'stalagmite', [2.5, 2.5], ['caverne']),
    (r'opening|shaft|sinkhole|sump|crevasse|fissure|blowhole|pit trap|steps into|ramp into|hatch|trapdoor', 'ouverture', [3, 3], ['caverne']),
    (r'skeleton|skull|bones|carcass|droppings', 'ossements', [1.8, 1.8], ['caverne', 'foret', 'desert']),
    (r'boundary|cave wall|cave edge|cave bend|ridge|spur|cavebank|arc\b|rock shelf|wall segment|walkway|scree wedge|gravel shoulder|limestone arc', 'paroi', [6, 3], ['caverne']),
    (r'puddle|pool|basin|spring|sandbar|seepage|pebble crescent', 'flaque', [2.5, 2.5], ['caverne']),
    (r'campfire|bedroll|campsite|tent|tente|expedition pack|gear|lantern|crate|caisse|coffre|chest|pack,|lean-to|firewood|campsite scatter', 'campement', [2, 2], ['camp', 'caverne', 'foret']),
    (r'handcart|cart|charrette|mine rails|mine support|mining|timber|tool scatter', 'mine', [2.5, 1.5], ['caverne', 'route']),
    (r'marker|waymarker|signpost|offering|altar|autel', 'repere', [1.2, 1.2], ['caverne', 'foret', 'route']),
    (r'bootprints|footprints|hoofprint|scuff|dust patch|mud patch|gravel patch|gravel fan|calcite|sulfur|moss patch|excavation scar|ripple', 'sol', [3, 3], ['caverne']),
    (r'rubble|rockfall|boulder|rock cluster|rock outcrop|outcrop|scree|ledge|cairn|basalt|lava|ice blocks|snowdrift|slab', 'rocher', [3, 3], ['caverne', 'montagne', 'campagne']),
    (r'mist|vapor|vapour|gas veil|wisp', 'vapeur', [4, 4], ['caverne']),
    (r'tripwire|pressure plate|piton|rope|ladder', 'piege', [1.5, 1.5], ['caverne']),
    (r'bridge|footbridge|passerelle|log crossing', 'pont', [6, 2], ['riviere', 'caverne']),
    (r'log|stump|trunk|fallen .*oak|branches|root|driftwood|leaf heap|nest|burrow|den\b|dam', 'bois', [3, 2], ['foret']),
    (r'wall|mur|masonry|foundation|barricade|well\b', 'ruine', [5, 2], ['ruine', 'campagne']),
    (r'web|silk', 'toile', [3, 3], ['caverne', 'foret']),
    (r'roof|toit|house|maison', 'toit', [8, 8], ['ville', 'campagne']),
    (r'chair|chaise|bed\b|lit m', 'mobilier', [1, 1], ['interieur']),
    (r'kelp|seaweed|coral|shells|barnacle', 'plante-eau', [2, 2], ['cote', 'mer']),
    (r'termite|tumbleweed', 'divers', [2, 2], ['desert', 'savane']),
]

# Créatures : (motif, nom du bestiaire, taille en mètres). Le nom suit le bestiaire de l'Underdark quand il existe.
CREATURES = [
    (r'scorpion', 'Scorpion géant', 3), (r'bat swarm|swarm of flying bats', 'Nuée de chauves-souris', 3),
    (r'\bbat\b', 'Chauve-souris géante', 3), (r'cerveau psionique|intellect', 'Dévoreur d’intellect', 1.5),
    (r'charognard', 'Charognard rampant', 3), (r'troglodyte', 'Troglodyte', 1.5),
    (r'constrictor', 'Serpent constricteur géant', 4.5), (r'snake|viper', 'Serpent venimeux géant', 1.5),
    (r'cloaker', 'Manteleuse', 3), (r'crustac', 'Chuul', 3), (r'cube g.latineux', 'Cube gélatineux', 3),
    (r'darkmantle', 'Mante obscure', 1.5), (r'drider', 'Drider', 3), (r'ettercap', 'Ettercap', 1.5),
    (r'salamander', 'Salamandre aquatique géante', 3), (r'wolf spider', 'Araignée-loup géante', 3),
    (r'phase spider|ivory and indigo spider', 'Araignée de phase', 3), (r'spider|orb-weaver', 'Araignée géante', 3),
    (r'grick', 'Grick', 1.5), (r'grimlock', 'Grimlock', 1.5), (r'fouisseur|umber hulk', 'Horreur fouisseuse', 3),
    (r'crochets', 'Horreur crochue', 3), (r'illithid', 'Flagelleur mental', 1.5), (r'kuo-toa', 'Kuo-toa', 1.5),
    (r'perceur|piercer', 'Perceur', 1.5), (r'roper|stalagmitique', 'Roper', 3), (r'rouill', 'Monstre rouilleur', 1.5),
    (r'otyugh', 'Otyugh', 3), (r'p.cheur des cavernes', 'Pêcheur des cavernes', 3), (r'quaggoth', 'Quaggoth', 1.5),
    (r'centipede', 'Mille-pattes géant', 1.5), (r'draconic', 'Humanoïde draconique', 1.5),
]

# Personnages : peuple, genre et rôles lus dans le titre.
PEOPLE_GEN = [
    (r'moriquendi|norrianiss|warral|drehjur|iznogood|deep[- ]elf|bayou elf', 'moriquendi'), (r'drow', 'drow'),
    (r'duergar', 'duergar'), (r'deep gnome|svirfneblin|svirfnebelin', 'svirfnebelin'), (r'goblin', 'gobelin'),
    (r'halfling', 'halfelin'), (r'dwarf|dwarven', 'nain'), (r'half-elf', 'demi-elfe'), (r'half-orc', 'demi-orque'),
    (r'\belf|elven', 'elfe'), (r'gnome', 'gnome'),
]
FEMININ = r'\bwoman|priestess|prophetess|midwife|hostess|dancer|\bher\b|\bshe\b|lady|girl'
ROLES_GEN = [
    (r'priest|officiant|oracle|prophet', ['pretre', 'clerc']), (r'merchant|dealer|peddler|seller|pawnbroker|trader|outfitter', ['marchand']),
    (r'innkeeper|tavern|bar\b|hostess', ['aubergiste', 'tavernier']), (r'blacksmith', ['forgeron', 'artisan']),
    (r'guard|watch|patrol|sergeant|corporal|militia|warrior|commander|garrison|defense instructor', ['garde', 'soldat']),
    (r'archmage|mage|enchantment|ward ', ['mage']), (r'archivist|registrar|registry|clerk|notary|administrator|superintendent|magistrate|lecturer|teacher|bookseller|bookbinder|cartographer|storykeeper|keeper of', ['erudit', 'scribe']),
    (r'apothecary|herbalist|alchem|physician|healer|caregiver|infirmary|midwife', ['guerisseur', 'herboriste']),
    (r'tracker|scout|hunter|rescue', ['eclaireur', 'chasseur']), (r'ferry|boat|river captain|canal|fisher', ['batelier', 'pecheur']),
    (r'farmer|gardener|breeder|drover', ['fermier', 'eleveur']), (r'cook|kitchen', ['cuisinier']), (r'courier|relay|envoy|diplomat', ['messager', 'diplomate']),
    (r'locksmith|repairer|potter|weaver|rope maker|carpenter|laundry|quartermaster', ['artisan']), (r'dancer|fiddler', ['artiste']),
    (r'aristocrat|noble|velvet|salon', ['noble']), (r'traveler|wayfarer|expeditioner', ['voyageur']),
]

# Noms français des nouvelles images (le titre anglais reste dans `titre`). Premier motif qui correspond.
NOMS = [
    # Outreterre
    (r'bedroll camp|campsite|expedition tent', 'Campement abandonné'), (r'campfire', 'Foyer éteint'),
    (r'expedition pack|pack, rope|gear assembly', 'Paquetage abandonné'), (r'mining handcart|broken underdark handcart', 'Wagonnet de mine'),
    (r'droppings', 'Bouses de rothé'), (r'waymarker|route marker|trail marker', 'Borne de piste'), (r'steps into', 'Escalier taillé'),
    (r'rope bridge', 'Pont de corde'), (r'footbridge|bridge span|footbridge deck', 'Passerelle'), (r'offering slab', 'Dalle d’offrandes'),
    (r'waterlogged beam|timber mine support', 'Étais effondrés'), (r'mineral pool|rimstone', 'Vasque calcaire'), (r'trapdoor|hatch', 'Trappe'),
    (r'rubble|rockfall', 'Éboulement'), (r'copper-veined|iron seam', 'Dalle veinée de métal'), (r'mist|gas veil|vapor|wisp', 'Nappe de vapeur'),
    (r'spiderweb|spider silk', 'Toiles d’araignée'), (r'pillar', 'Piliers calcaires'), (r'lantern', 'Lanterne tombée'),
    (r'adventurer skeleton', 'Squelette d’aventurier'), (r'roth. carcass', 'Carcasse de rothé'), (r'roth. skeleton', 'Squelette de rothé'),
    (r'roth. skull', 'Crâne de rothé'), (r'piton', 'Piton et corde'), (r'bootprints|footprints', 'Traces de pas'), (r'hoofprint', 'Traces de sabots'),
    (r'rope coil|rope ladder', 'Corde abandonnée'), (r'stalagmite', 'Stalagmites'), (r'puddle|seepage', 'Flaque'), (r'amethyst', 'Améthystes'),
    (r'quartz', 'Quartz fumé'), (r'blue-gray crystal', 'Cristaux brisés'), (r'shaft|floor opening|cave floor opening|rock opening', 'Puits'),
    (r'sinkhole', 'Doline'), (r'sump', 'Siphon'), (r'crevasse|fissure', 'Crevasse'), (r'blowhole', 'Évent glacé'), (r'pit trap', 'Fosse piégée'),
    (r'ramp into', 'Rampe vers les ténèbres'), (r'mushroom|fungal', 'Champignons'), (r'mine rails', 'Rails de mine'), (r'mining tool', 'Outils de mineur'),
    (r'crate', 'Caisse brisée'), (r'tripwire', 'Fil-piège'), (r'pressure plate', 'Dalle à pression'), (r'sandbar|silt', 'Banc de limon'),
    (r'sulfur', 'Croûte de soufre'), (r'calcite', 'Croûte de calcite'), (r'moss patch', 'Mousse et cailloux'), (r'mud patch', 'Boue piétinée'),
    (r'^(?!.*frost).*dust', 'Poussière remuée'), (r'gravel', 'Gravier sombre'), (r'excavation', 'Saignée de fouille'), (r'bones', 'Ossements'),
    (r'^(?!.*(hawthorn|blossom|canopy|crown)).*\bspring\b', 'Source'), (r'cairn', 'Cairn'), (r'masonry foundation', 'Fondations en ruine'), (r'scree', 'Éboulis'),
    (r'walkway|rock shelf', 'Corniche'), (r'boulder', 'Blocs calcaires'), (r'obsidian.*(boundary|strip)', 'Paroi d’obsidienne'),
    (r'slate.*(boundary|segment|fragment)|y-shaped slate', 'Paroi d’ardoise'), (r'basalt cave ridge', 'Crête de basalte'),
    (r'boundary|cave wall|cave edge|cave bend|ridge|spur|cavebank|limestone arc|wall segment', 'Paroi calcaire'),
    (r'pebble crescent', 'Grève de galets'), (r'slab', 'Dalle fendue'),
    # Socles de figurines
    (r'base|socle', 'Socle'),
    # Surface
    (r'oak canopy', 'Chêne'), (r'birch canopy', 'Bouleau'), (r'spruce', 'Épicéa'), (r'scots pine', 'Pin sylvestre'), (r'olive woodland', 'Olivier'),
    (r'boreal', 'Bosquet boréal'), (r'snow-laden conifer', 'Conifère enneigé'), (r'acacia', 'Acacia'), (r'date palm', 'Palmier dattier'),
    (r'bamboo', 'Bambous'), (r'banana', 'Bananier'), (r'hawthorn', 'Aubépine en fleurs'), (r'copper and burgundy', 'Arbuste pourpre'),
    (r'frost-dusted', 'Arbuste givré'), (r'raspberry', 'Framboisiers'), (r'hazel', 'Noisetiers'), (r'bramble', 'Ronces'),
    (r'shrub', 'Buissons'), (r'fern', 'Fougères'), (r'wildflower', 'Fleurs sauvages'), (r'reeds|cattail', 'Roseaux'), (r'sedge', 'Touffe de carex'),
    (r'lily', 'Nénuphars'), (r'cacti', 'Cactus'), (r'agave', 'Agave'), (r'bromeliad', 'Broméliacées'), (r'savanna grass', 'Herbes de savane'),
    (r'lichen', 'Lichens et arbrisseaux'), (r'juniper', 'Genévrier'), (r'stump', 'Souche'), (r'log crossing', 'Tronc-passerelle'),
    (r'log|trunk|fallen .*oak', 'Tronc couché'), (r'branches', 'Tas de branches'), (r'root ball|uprooted', 'Arbre déraciné'),
    (r'mangrove', 'Racines de palétuvier'), (r'root', 'Racines'), (r'driftwood', 'Bois flotté'), (r'leaf heap', 'Tas de feuilles'),
    (r'bird nest', 'Nid abandonné'), (r'burrow|den\b', 'Terrier'), (r'beaver', 'Barrage de castors'), (r'well\b', 'Puits'),
    (r'altar', 'Autel'), (r'firewood', 'Bois de chauffage bâché'), (r'ruined stone wall|mur', 'Muret en ruine'), (r'footbridge|passerelle', 'Passerelle'),
    (r'handcart|cart\b|charrette', 'Charrette'), (r'campfire', 'Feu de camp éteint'), (r'cairn', 'Cairn'), (r'signpost', 'Poteau indicateur'),
    (r'lean-to', 'Abri de branchages'), (r'skeleton', 'Squelette'), (r'thatch roof', 'Toit de chaume'), (r'tumbleweed', 'Virevoltant'),
    (r'termite', 'Termitière'), (r'kelp|seaweed', 'Varech'), (r'coral', 'Corail'), (r'shells|barnacle', 'Coquillages et bois flotté'),
    (r'coastal rocks', 'Rochers côtiers'), (r'ice blocks', 'Blocs de glace'), (r'snowdrift', 'Congère'), (r'lava', 'Lave refroidie'),
    (r'basalt', 'Orgues basaltiques'), (r'sinkhole cave', 'Entrée de caverne'), (r'ledge', 'Corniche rocheuse'), (r'outcrop', 'Affleurement rocheux'),
    (r'boulder|rock cluster', 'Rochers'), (r'scree', 'Éboulis d’ardoise'), (r'mushroom', 'Champignons'), (r'bracket fungi', 'Tronc à polypores'),
]
ROLES_FR = [
    (r'high priest', ('Grand prêtre', 'Grande prêtresse')), (r'priest|officiant|oracle', ('Prêtre', 'Prêtresse')), (r'prophet', ('Prophète', 'Prophétesse')),
    (r'locksmith', ('Serrurier', 'Serrurière')), (r'archivist|archive', ('Archiviste', 'Archiviste')), (r'registrar|registry|clerk', ('Greffier', 'Greffière')),
    (r'notary', ('Notaire', 'Notaire')), (r'administrator|superintendent', ('Intendant', 'Intendante')), (r'magistrate', ('Magistrat', 'Magistrate')),
    (r'lecturer|teacher|instructor', ('Professeur', 'Professeure')), (r'bookseller', ('Libraire', 'Libraire')), (r'bookbinder', ('Relieur', 'Relieuse')),
    (r'cartographer|surveyor', ('Cartographe', 'Cartographe')), (r'storykeeper|keeper of', ('Gardien des mémoires', 'Gardienne des mémoires')),
    (r'archmage|mage', ('Mage', 'Mage')), (r'alchem', ('Apprenti alchimiste', 'Apprentie alchimiste')), (r'apothecary', ('Apothicaire', 'Apothicaire')),
    (r'herbalist|herbal', ('Herboriste', 'Herboriste')), (r'physician', ('Médecin', 'Médecin')), (r'healer|caregiver', ('Guérisseur', 'Guérisseuse')),
    (r'infirmary', ('Infirmier', 'Infirmière')), (r'midwife', ('Sage-femme', 'Sage-femme')), (r'tracker|rescue', ('Pisteur', 'Pisteuse')),
    (r'scout', ('Éclaireur', 'Éclaireuse')), (r'hunter', ('Chasseur', 'Chasseuse')), (r'river captain', ('Capitaine fluvial', 'Capitaine fluviale')),
    (r'ferry|boat hook', ('Passeur', 'Passeuse')), (r'boat carpenter', ('Charpentier de barques', 'Charpentière de barques')),
    (r'fisher', ('Pêcheur', 'Pêcheuse')), (r'river keeper', ('Gardien du fleuve', 'Gardienne du fleuve')), (r'mushroom farmer|gardener', ('Cultivateur de champignons', 'Cultivatrice de champignons')),
    (r'breeder', ('Éleveur', 'Éleveuse')), (r'drover', ('Bouvier', 'Bouvière')), (r'cook|kitchen', ('Cuisinier', 'Cuisinière')),
    (r'courier|relay', ('Messager', 'Messagère')), (r'envoy|diplomat', ('Diplomate', 'Diplomate')), (r'pawnbroker', ('Prêteur sur gages', 'Prêteuse sur gages')),
    (r'curio|curiosity', ('Marchand de curiosités', 'Marchande de curiosités')), (r'crystal merchant', ('Marchand de cristaux', 'Marchande de cristaux')),
    (r'mushroom merchant', ('Marchand de champignons', 'Marchande de champignons')), (r'cloth merchant', ('Drapier', 'Drapière')),
    (r'provisions', ('Vendeur de vivres', 'Vendeuse de vivres')), (r'spoon peddler', ('Colporteur', 'Colporteuse')), (r'outfitter', ('Équipementier', 'Équipementière')),
    (r'merchant|dealer|seller|trader', ('Marchand', 'Marchande')), (r'innkeeper|bar\b', ('Aubergiste', 'Aubergiste')), (r'hostess', ('Hôte', 'Hôtesse')),
    (r'tavern', ('Tavernier', 'Tavernière')), (r'blacksmith', ('Forgeron', 'Forgeronne')), (r'commander|garrison', ('Commandant', 'Commandante')),
    (r'sergeant', ('Sergent', 'Sergente')), (r'corporal|patrol', ('Patrouilleur', 'Patrouilleuse')), (r'watchkeeper|night watch', ('Veilleur de nuit', 'Veilleuse de nuit')),
    (r'gate guard|access guard|outpost guard|guard', ('Garde', 'Garde')), (r'toll', ('Péager', 'Péagère')), (r'warrior', ('Guerrier', 'Guerrière')),
    (r'quartermaster', ('Intendant', 'Intendante')), (r'repairer', ('Réparateur', 'Réparatrice')), (r'potter', ('Potier', 'Potière')),
    (r'weaver', ('Tisserand', 'Tisserande')), (r'rope maker', ('Cordier', 'Cordière')), (r'dancer', ('Danseur', 'Danseuse')),
    (r'fiddler', ('Violoneux', 'Violoneuse')), (r'aristocrat|noble|velvet', ('Noble', 'Noble')), (r'expeditioner|traveler|wayfarer', ('Voyageur', 'Voyageuse')),
    (r'goblin', ('Gobelin', 'Gobeline')), (r'elder', ('Ancien', 'Ancienne')), (r'monobrow|portrait|token|character', ('Habitant', 'Habitante')),
]
PEUPLE_FR = {'moriquendi': ('moriquendi', 'moriquendi'), 'drow': ('drow', 'drow'), 'duergar': ('duergar', 'duergar'),
             'svirfnebelin': ('svirfnebelin', 'svirfnebeline'), 'gobelin': ('', ''), 'humain': ('humain', 'humaine'),
             'nain': ('nain', 'naine'), 'halfelin': ('halfelin', 'halfeline'), 'elfe': ('elfe', 'elfe'), 'gnome': ('gnome', 'gnome')}

# ——— Synchronisation du 2026-11-09 : ferme (animaux, objets, champs), toits nommés, socles, objets du Fil des mystères ———
# `cote` : longueur réelle (m) du grand côté de l'image ; l'autre côté suit les proportions de l'image recadrée.
# `carre` : texture livrée en rectangle, recadrée en carré au centre pour se répéter sans déformation.
FERME = ['campagne', 'ferme']
FERME_ELEMENTS = [
    (r'wash tub', dict(nom='Cuve de lavage', cat='ferme', cote=1.2, milieux=FERME + ['ville'], usage=['bac'])),
    (r'wheelbarrow', dict(nom='Brouette', cat='ferme', cote=1.6, milieux=FERME, usage=['outil'])),
    (r'grain-laden farm wagon', dict(nom='Chariot de grain', cat='ferme', cote=4, milieux=FERME + ['route', 'ville'], usage=['charrette'])),
    (r'livestock water trough', dict(nom='Abreuvoir', cat='ferme', cote=2.4, milieux=FERME, usage=['ecurie', 'bac'])),
    (r'round haystack', dict(nom='Meule de foin', cat='ferme', cote=3.5, milieux=FERME, usage=['foin'], saisons=['ete', 'automne'])),
    (r'hay cart', dict(nom='Charrette de foin', cat='ferme', cote=3.5, milieux=FERME + ['route'], usage=['charrette', 'foin'], saisons=['ete', 'automne'])),
    (r'empty medieval farm cart', dict(nom='Charrette vide', cat='ferme', cote=3.2, milieux=FERME + ['route', 'ville'], usage=['charrette'])),
    (r'horse stable roof', dict(nom='Écurie (toit enneigé)', cat='toit', forme='rect', materiau='bardeaux', cote=12, milieux=FERME, climats=[F, T], saisons=['hiver'], usage=['ferme', 'ecurie'])),
    (r'hay bundle', dict(nom='Botte de foin', cat='ferme', cote=1, milieux=FERME, usage=['foin'])),
    (r'cattle barn roof', dict(nom='Étable (toit de lauzes)', cat='toit', forme='L', materiau='lauzes', cote=14, milieux=FERME, climats=[T, F], usage=['ferme'])),
    (r'stone well', dict(nom='Puits de pierre', cat='ferme', cote=2, milieux=FERME + ['ville', 'place'], usage=['puits', 'place'])),
    (r'compost heap', dict(nom='Tas de compost', cat='ferme', cote=2, milieux=FERME, usage=['fumier'])),
    (r'henhouse roof', dict(nom='Poulailler (toit)', cat='toit', forme='rect', materiau='bardeaux', cote=4, milieux=FERME, climats=[T], usage=['ferme'])),
    (r'hay feeding rack', dict(nom='Râtelier à foin', cat='ferme', cote=2.4, milieux=FERME, usage=['ecurie', 'foin'])),
    (r'oat sack', dict(nom='Sac d’avoine', cat='ferme', cote=0.7, milieux=FERME + ['interieur', 'marche'], usage=['sac', 'marche'])),
    (r'straw skep', dict(nom='Ruche de paille', cat='ferme', cote=0.6, milieux=FERME + ['jardin'], usage=['ruche'], saisons=['printemps', 'ete', 'automne'])),
    (r'manure heap', dict(nom='Tas de fumier', cat='ferme', cote=2.5, milieux=FERME, usage=['fumier'])),
    (r'basket of ripe apples', dict(nom='Panier de pommes', cat='ferme', cote=0.6, milieux=FERME + ['marche', 'interieur'], usage=['panier', 'marche'], saisons=['automne'])),
    (r'farm gate', dict(nom='Barrière de ferme', cat='cloture', cote=3.5, milieux=FERME, usage=['barriere'])),
    (r'oat-filled wooden barrel', dict(nom='Tonneau d’avoine', cat='ferme', cote=0.8, milieux=FERME + ['interieur', 'marche'], usage=['tonneau'])),
    (r'water bucket', dict(nom='Seau d’eau', cat='ferme', cote=0.45, milieux=FERME + ['interieur'], usage=['seau'])),
    (r'split firewood stack', dict(nom='Bûches empilées', cat='ferme', cote=2.2, milieux=FERME + ['ville'], usage=['bois'])),
    (r'nest with five', dict(nom='Nid aux œufs', cat='ferme', cote=0.4, milieux=FERME, usage=['poulailler'])),
    (r'ard plough', dict(nom='Araire', cat='ferme', cote=2.8, milieux=FERME, usage=['outil'])),
    (r'medieval shovel', dict(nom='Pelle', cat='ferme', cote=1.3, milieux=FERME + ['mine'], usage=['outil'])),
    (r'fence corner', dict(nom='Angle de clôture', cat='cloture', cote=3, milieux=FERME, usage=['cloture'])),
    (r'farm rake', dict(nom='Râteau', cat='ferme', cote=1.6, milieux=FERME, usage=['outil'])),
    (r'rail fence', dict(nom='Clôture de perches', cat='cloture', cote=3.5, milieux=FERME, usage=['cloture'])),
    # Fil des mystères (kit v3) : objets à leur taille réelle
    (r'trappe-obsidienne', dict(nom='Trappe d’obsidienne', cat='ouverture', taille=[1.5, 1.5], milieux=['caverne', 'ruine', 'temple'], usage=['trappe', 'enigme'], region=['surface', 'outreterre'])),
    (r'tablette-reflux', dict(nom='Tablette gravée', cat='repere', taille=[0.65, 0.45], milieux=['caverne', 'ruine', 'temple', 'interieur'], usage=['indice'], region=['surface', 'outreterre'])),
    (r'journal-recherche', dict(nom='Journal ouvert', cat='objet', taille=[0.32, 0.24], milieux=['interieur', 'caverne', 'camp'], usage=['indice', 'livre'], region=['surface', 'outreterre'])),
]
ELEMENTS[:0] = FERME_ELEMENTS

def _champ(nom, culture, saisons, taille=8, climats=(T,), carre=True, raccorder=True):
    return dict(nom=nom, cat='champ', taille=taille, usage=[culture], milieux=list(FERME), climats=list(climats), saisons=saisons, carre=carre, raccorder=raccorder)

FERME_TEXTURES = [
    (r'spring wheat germination', _champ('Blé en germination', 'ble', ['printemps'])),
    (r'lush summer wheat', _champ('Blé en herbe', 'ble', ['printemps', 'ete'])),
    (r'late-summer wheat harvest', _champ('Moisson du blé', 'ble', ['ete'], raccorder=False)),
    (r'winter wheat stubble', _champ('Chaumes de blé sous la neige', 'ble', ['hiver'], climats=(T, F))),
    (r'freshly planted potato', _champ('Pommes de terre plantées', 'pomme-de-terre', ['printemps'])),
    (r'flowering summer potato', _champ('Pommes de terre en fleurs', 'pomme-de-terre', ['ete'])),
    (r'autumn potato harvest', _champ('Récolte des pommes de terre', 'pomme-de-terre', ['automne'], raccorder=False)),
    (r'frosty winter fallow potato', _champ('Jachère givrée', 'pomme-de-terre', ['hiver'], climats=(T, F))),
    (r'spring cabbage rows', _champ('Jeunes choux', 'chou', ['printemps'])),
    (r'summer cabbage field', _champ('Choux d’été', 'chou', ['ete'])),
    (r'autumn cabbage field', _champ('Choux récoltés', 'chou', ['automne'])),
    (r'winter cabbage field', _champ('Champ de choux en hiver', 'chou', ['hiver'], climats=(T, F))),
    (r'spring blossom apple orchard', _champ('Verger en fleurs', 'verger', ['printemps'], taille=12, raccorder=False)),
    (r'summer apple orchard', _champ('Verger d’été', 'verger', ['ete'], taille=12, raccorder=False)),
    (r'autumn apple orchard', _champ('Verger d’automne', 'verger', ['automne'], taille=12, raccorder=False)),
    (r'winter apple orchard', _champ('Verger en hiver', 'verger', ['hiver'], taille=12, raccorder=False, climats=(T, F))),
    (r'transplanted rice seedlings', _champ('Rizière repiquée', 'riz', ['printemps'], climats=(C, TR))),
    (r'lush summer rice paddy', _champ('Rizière verdoyante', 'riz', ['ete'], climats=(C, TR))),
    (r'golden rice paddy', _champ('Rizière dorée', 'riz', ['automne'], climats=(C, TR), raccorder=False)),
    (r'dry-season fallow rice paddy', _champ('Rizière en jachère', 'riz', ['hiver'], climats=(C, TR, A))),
]
TEXTURES[:0] = FERME_TEXTURES

# Animaux de ferme (jetons vus du dessus) : nommés comme une créature, pour qu'un « Cheval » du plateau prenne son image.
CREATURES[:0] = [
    (r'draft horse', 'Cheval de trait', 3), (r'horse', 'Cheval', 2.6), (r'cow', 'Vache', 2.6), (r'\bpig\b', 'Cochon', 1.6),
    (r'sheep', 'Mouton', 1.4), (r'donkey', 'Âne', 2.1), (r'rooster', 'Coq', 0.6), (r'\bhen\b', 'Poule', 0.5),
    (r'goose', 'Oie', 0.8), (r'duck', 'Canard', 0.6), (r'goat', 'Chèvre', 1.4), (r'\bcat\b', 'Chat', 0.6), (r'\bdog\b', 'Chien', 1.1),
]

# Socles de figurines du dossier « Socles » (titres sans mots : file_000…) : nommés d'après leur matière, vérifiés à l'œil.
SOCLES = {
    '1OJXUAtg5sGbRf3Vz1DS8rNq7ywQFHMWK': ('Socle carré de dalles (cadre de fer)', ['interieur', 'donjon'], [1.5, 1.5]),
    '1jtcm4iBagfmZUsdzZA4mX96nkKvT12aC': ('Socle d’ardoise sombre', ['montagne', 'caverne'], None),
    '1XDJIbH9K16jaa4g-LbKvtMwOk3qzsSes': ('Socle de dalles calcaires', ['ville', 'ruine'], None),
    '1rxNluxtl8LrbIWUr88Tc6tOZvrh5PuBG': ('Socle de roche et d’éboulis', ['montagne', 'caverne'], None),
    '1B7aDBja2tmOexceqEV2FZVkno1hjz6LL': ('Socle de terre et champignons', ['foret', 'caverne'], None),
    '1qrU7c1c180DURXELrrN_i_qfUnw9g8tI': ('Socle ovale de pierre (bordure de bronze)', ['ville', 'interieur'], [2.5, 1.5]),
    '1fUzYa4-9v5pn7uqThguX3e6NscsgRWEk': ('Socle de planches', ['interieur', 'navire'], None),
    '1yNyih77-OYf_P7Z0zEO86uHucwx7tFOG': ('Socle de pierre fissurée', ['ruine', 'montagne'], None),
    '1_JtzaUgBJ_AI-ZjWSA-jCK3639qrrEl0': ('Socle de fer riveté', ['interieur', 'donjon'], None),
    '1Ekd89ozYsSZ1E84HXX4lTmWsZf2BUMON': ('Socle de marbre noir et d’améthystes', ['caverne'], None),
    '19XTm4n-j1d1sPNZaZBfBhZiUfyohUCmv': ('Socle d’herbe et de cailloux', ['campagne', 'foret'], None),
    '1RxREx8Rb1__WunSia4hfpdFNisW3NtjV': ('Socle d’obsidienne veinée de violet', ['caverne', 'volcan'], None),
    '1-LBXuUUDiNtSNeF6SRhUHbVdBJ_f2MOT': ('Socle de sable du désert', ['desert'], None),
    '1LR8nIf7YTSvfS63aNOOZi1aju-JgPLkJ': ('Socle de glace', ['toundra', 'montagne'], None),
    '1BxEpOrF9yLnNzCv_GgN63p6UMGCO8PQ0': ('Socle de terre et de feuilles mortes', ['foret'], None),
    '1L-tscXqNN_TBY9FiH06mZGvKxI4nZxDP': ('Socle de neige', ['toundra', 'montagne'], None),
    '1PftG77qttJULJz95wJIMtNzBiaOeQZiO': ('Socle d’eau', ['riviere', 'lac', 'mer'], None),
    '1gRqv-M8fj8No9NdBLY9yI9tq87dev9jP': ('Socle de nuages (marbre blanc)', ['astral', 'temple'], None),
    '1hj9rvWngirqBs8NvoI4Hb7F3dhZl35ue': ('Socle de marbre blanc (bordure dorée)', ['temple', 'palais'], None),
    '1dz2dfR6mY4f-xOEGuXMeSmQodlZzHUdZ': ('Socle de sable et de galets', ['cote', 'riviere'], None),
    '1kyaNG0MjYaykI7hWVQp247BIoEiG4WjJ': ('Socle de boue et d’aiguilles de pin', ['foret', 'marais'], None),
    '1CNBY2x2XmpkePpYSi-8ckvzx-BuuQJk-': ('Socle de lave', ['volcan', 'caverne'], None),
    '1RKi6A22Ei7Ziy-eS4B1esvRXEF7azrwh': ('Socle de planches claires (ponton)', ['ponton', 'cote', 'interieur'], None),
    '1vJqHGQbtUIxF1O6dI-uu5Ft4UGGflqem': ('Socle de pavés', ['ville', 'route'], None),
    '1DgJcUURRRWr0WSoT14TgRoLdohS59S5R': ('Socle de marbre en damier', ['temple', 'palais'], None),
    '1OH_9RqgMcSVKm8S73qwfQKnAE8rUOTzR': ('Socle de briques moussues', ['ruine', 'ville'], None),
}

# Toits nommés « toit-<bâtiment ou forme>-<matériau>-[saison|climat]-[l x p | Nm]-<empreinte> » (Drive, 2026-11-03).
TOIT_FORMES = [('temple-croix', 'croix'), ('croix', 'croix'), ('manoir-h', 'H'), ('-h-', 'H'), ('octogonal', 'octo'), ('circulaire', 'rond'),
               ('chateau-cour', 'cour'), ('forteresse', 'cour'), ('caravanserail', 'cour'), ('monastere', 'cour'), ('demeure-noble-l', 'L'),
               ('-l-', 'L'), ('-t-', 'T'), ('auberge-t', 'T'), ('-u-', 'U'), ('maison-u', 'U'), ('carre', 'carre'), ('donjon', 'carre')]
TOIT_BATIMENTS = [  # (motif, nom, usage, côté par défaut en m)
    ('ferme-chaume-annexe', 'Ferme à annexe', ['ferme', 'maison'], 14), ('ecuries', 'Écuries', ['ferme', 'ecurie'], 18),
    ('grenier', 'Grenier', ['ferme'], 10), ('longere', 'Longère', ['ferme', 'maison'], 14), ('forge', 'Forge', ['atelier'], 10),
    ('atelier', 'Atelier à appentis', ['atelier'], 12), ('echoppes-mitoyennes', 'Échoppes mitoyennes', ['marche', 'atelier'], 12),
    ('echoppe', 'Échoppe', ['marche', 'atelier'], 8), ('caravanserail', 'Caravansérail', ['auberge', 'civique'], 30),
    ('auberge', 'Auberge', ['auberge', 'civique'], 16), ('monastere', 'Monastère', ['temple', 'civique'], 28),
    ('temple', 'Temple', ['temple', 'civique'], 20), ('halle', 'Halle', ['marche', 'civique'], 22), ('entrepot', 'Entrepôt', ['atelier', 'civique'], 24),
    ('maison-commune', 'Maison commune', ['civique'], 16), ('bains', 'Bains', ['civique'], 20), ('manoir', 'Manoir', ['noble', 'civique'], 24),
    ('demeure-noble', 'Demeure noble', ['noble'], 16), ('chateau', 'Château', ['noble', 'civique'], 26), ('donjon', 'Donjon', ['noble', 'tour'], 18),
    ('forteresse', 'Forteresse', ['noble', 'civique'], 30), ('pavillon', 'Pavillon', ['noble', 'temple'], 10), ('tour', 'Tour', ['tour'], 9),
    ('refuge', 'Refuge alpin', ['maison'], 12), ('chalet', 'Chalet', ['maison'], 12), ('maison-tropicale', 'Maison tropicale', ['maison'], 14),
    ('maison-u', 'Maison en U', ['maison'], 16), ('', 'Maison', ['maison'], 10),
]
TOIT_MATERIAUX = [('terre-cuite', 'terre cuite', [T, C]), ('terre-plate', 'terre', [C, A]), ('tuiles-vertes', 'tuiles vertes', [T, C]),
                  ('chaume', 'chaume', [T]), ('bardeaux', 'bardeaux', [T, F]), ('ardoise', 'ardoise', [T, F]), ('lauzes', 'lauzes', [T, F]),
                  ('tourbe', 'tourbe', [F]), ('palmes', 'palmes', [TR, C]), ('chaux', 'chaux', [C, A]), ('pierre', 'pierre', [C, A, T])]


def toit_nomme(title):
    """Étiquettes d'un toit au nom normalisé (avec ou sans dimensions, saison, climat, empreinte) ; None sinon."""
    stem = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode().lower()
    stem = re.sub(r'\.(png|jpe?g|webp)$', '', stem)
    if not stem.startswith('toit-'):
        return None
    stem = re.sub(r'-[0-9a-f]{8}$', '', stem)
    stem = re.sub(r'-(a-verifier|reprise|variante)', '', stem)
    m = re.search(r'-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)', stem)
    rond = re.search(r'-(\d+(?:\.\d+)?)m\b', stem)
    k = f'-{stem[5:]}-'
    forme = next((f for pat, f in TOIT_FORMES if pat in k), 'rect')
    nom, usage, cote = next((n, u, c) for pat, n, u, c in TOIT_BATIMENTS if pat in k)
    mat = next(((lab, cl) for pat, lab, cl in TOIT_MATERIAUX if pat in k), ('tuiles', [T]))
    saisons = [x for x in ('printemps', 'ete', 'automne', 'hiver') if f'-{x}-' in k]
    climats = list(mat[1])
    if re.search(r'tropical|mousson|saison-seche|humide', k):
        climats = [TR, C]
    if 'desert' in k:
        climats = [C, A]
    if re.search(r'nordique|alpin', k) or saisons == ['hiver']:
        climats = sorted(set(climats) | {F})
    if nom == 'Maison' and forme in ('L', 'T', 'U'):
        nom = f'Maison en {forme}'
    detail = ', '.join([mat[0], *({'printemps': 'printemps', 'ete': 'été', 'automne': 'automne', 'hiver': 'hiver'}[x] for x in saisons)])
    meta = dict(nom=f'{nom} ({detail})', cat='toit', forme=forme, materiau=mat[0], usage=usage, milieux=['ville', 'campagne'], climats=climats, saisons=saisons)
    if 'ferme' in usage:
        meta['milieux'] = ['campagne', 'ferme', 'ville']
    if m:
        meta['taille'] = [float(m.group(1)), float(m.group(2))]
    elif rond:
        meta['taille'] = [float(rond.group(1))] * 2
    else:
        meta['cote'] = cote
    return meta



# Climat et saison d'une végétation d'après son titre (premier motif qui correspond).
VEG_HINTS = [
    (r'snow|frost|enneig|givr|neige|winter', (F, T), ('hiver',)),
    (r'blossom|en fleurs|hawthorn|cherry|cerisier', (T,), ('printemps',)),
    (r'autumn|automn|fall foliage', (T,), ('automne',)),
    (r'bare|dénudé|leafless', (T, F), ('hiver', 'automne')),
    (r'bamboo|bambou|banana|bananier|palm|palmier|tropical|mangrove|bromeliad', (TR, C), ()),
    (r'olive|olivier|acacia|agave|cact|savanna', (C, A), ()),
    (r'birch|bouleau|spruce|épicéa|boreal|boréal|scots pine|pin sylvestre|conifer|juniper|genévrier|lichen', (T, F), ()),
    (r'oak|chêne|lime|tilleul|willow|saule|hazel|noisetier|maple|érable|beech|hêtre|apple|pommier|pear|poirier', (T,), ()),
]


def first(rules, t):
    return next((v for pat, v in rules if re.search(pat, t)), None)


def infer(folder, region, title):
    """Étiquettes d'une image que les règles précises ne connaissent pas, d'après les mots de son titre."""
    t = norm(title)
    nom = re.sub(r'[\s_-]*(\(\d+\)|-\d+)?\.(png|jpe?g|webp)$', '', title).strip()
    if folder == 'textures':
        m = first(TEXTURES_GEN, t)
        if m:
            m = dict(m)
            m['nom'] = m['nom'] or nom
            m.setdefault('region', [region])
            return m
    elif folder == 'creatures':
        m = first([(p, (n, s)) for p, n, s in CREATURES], t)
        if m:
            return dict(nom=m[0], cat='creature', taille=[m[1], m[1]], milieux=['caverne'] if region == O else [], region=[region])
    elif folder == 'people':
        # Outreterre : sans peuple nommé, un habitant des cités moriquendi (le MJ retouche au besoin) ; un « nordique » est humain.
        peuple = first(PEOPLE_GEN, t) or ('humain' if region == 'surface' or re.search(r'nordic|ash-blond', t) else 'moriquendi')
        roles = sorted({r for pat, rs in ROLES_GEN if re.search(pat, t) for r in rs}) or ['villageois']
        genre = 'f' if re.search(FEMININ, t) else None
        lab = first(ROLES_FR, t) or ('Habitant', 'Habitante')
        adj = PEUPLE_FR.get(peuple, ('', ''))[1 if genre == 'f' else 0]
        nom_fr = f"{lab[1 if genre == 'f' else 0]} {adj}".strip()
        return dict(nom=nom_fr, peuple=peuple, genre=genre, roles=roles, region=[region])
    else:
        m = first([(p, (c, s, mi)) for p, c, s, mi in ELEMENTS_GEN], t)
        if m:
            c, s, mi = m
            return dict(nom='Socle de figurine' if c == 'socle' else first(NOMS, t) or nom, cat=c, taille=list(s), milieux=[x for x in mi if region != O or x == 'caverne'] or mi, region=[region])
    out = guess(folder, title)
    out['region'] = [region]
    return out


# Mots qui ne disent rien du personnage (cadrage, support) : ignorés pour apparier un jeton et son portrait.
VIDES = set('top down overhead token portrait battle map battlemap character sheet the with a an of in and by at on rpg vtt '
            'zenith zenithal vue du dessus de la le les des en une un au aux isole isolated view '
            # mots communs à tout un peuple ou à tout un décor : ils ne distinguent pas deux personnages
            'moriquendi norrianiss warral drow duergar deep gnome goblin dwarf elf halfling human woman man pale painted paint '
            'face black underdark underground cavern cave crystal amber violet amethyst light lamps lit beneath dark fantasy '
            'weathered silver haired white braided question mark marked eight eightfold leg geometric clan'.split())


def mots(titre):
    t = unicodedata.normalize('NFKD', titre).encode('ascii', 'ignore').decode().lower()
    t = re.sub(r'\.(png|jpe?g|webp)$', '', t)
    t = re.sub(r'[\s_-]*(\(\d+\)|-\d+)$', '', t)
    return {w for w in re.split(r'[^a-z]+', t) if len(w) > 2 and w not in VIDES}


# Couples que les titres rapprochent à tort (vérifiés à l'œil : deux personnes différentes). (jeton, portrait), en minuscules.
PAIRES_REFUSEES = [('pale quartermaster with towels', 'quartermaster with geometric'), ('access guard with iron key', 'outpost guard'),
                   ('underground relay guide', 'relay guide')]


def pair_auto(entries):
    """Jeton et portrait d'un même personnage (ou d'une même créature) sans paire connue : même type, même monde, même
    peuple (personnages) ou même nom (créatures), et le plus de mots communs dans leurs titres (au moins deux pour un
    personnage). Appariement glouton, du couple le plus sûr au moins sûr ; chaque image ne sert qu'une fois."""
    libres = [e for e in entries if e['type'] in ('personnage', 'creature') and not e.get('paire')]
    jetons = [e for e in libres if e['vue'] == 'jeton']
    portraits = [e for e in libres if e['vue'] == 'portrait']
    couples = []
    for j in jetons:
        for p in portraits:
            if p['type'] != j['type'] or p.get('region') != j.get('region'):
                continue
            if j['type'] == 'creature' and p['nom'] != j['nom']:
                continue
            if j['type'] == 'personnage' and (p.get('peuple') != j.get('peuple') or (j.get('genre') and p.get('genre') and j['genre'] != p['genre'])):
                continue
            # Personnage : même rôle (le nom français le porte : « Cuisinier moriquendi ») et au moins un mot distinctif commun.
            if j['type'] == 'personnage' and p['nom'] != j['nom']:
                continue
            if any(x in norm(j['titre']) and y in norm(p['titre']) for x, y in PAIRES_REFUSEES):
                continue
            commun = len(mots(j['titre']) & mots(p['titre']))
            if j['type'] == 'personnage' and commun < 1:
                continue
            couples.append((commun, j['id'], p['id']))
    pris = set()
    by_id = {e['id']: e for e in entries}
    for _, a, b in sorted(couples, reverse=True):
        if a in pris or b in pris:
            continue
        by_id[a]['paire'], by_id[b]['paire'] = b, a
        pris.update((a, b))


# Genres d'univers (cf. src/banque/genres.js). Une image commune (`*`) sert à tous les univers : sols, eaux, roches et
# végétation ordinaire. Tout le reste (personnages, créatures, bâtiments, mobilier, objets) garde le genre de son dossier.
COMMUNS_TEXTURES = {'herbe', 'champ', 'sable', 'roche', 'eau', 'neige', 'boue', 'humus', 'mousse', 'gravier', 'terre', 'glace',
                    'cendre', 'lave', 'toundra', 'eboulis', 'vase', 'ronces', 'tuile-eau', 'tuile-roche', 'sol'}
COMMUNS_ELEMENTS = {'arbre', 'arbuste', 'rocher', 'bois', 'plante-eau', 'flaque', 'stalagmite', 'cristal', 'sol', 'vapeur', 'paroi'}


def genres_of(e, genre):
    """Genres d'une image : ceux qu'une règle donne, sinon communs (nature) ou ceux de son dossier."""
    if e.get('genres'):
        return e['genres']
    if (e['type'] == 'texture' and e.get('cat') in COMMUNS_TEXTURES) or (e['type'] == 'element' and e.get('cat') in COMMUNS_ELEMENTS):
        return ['*']
    return [genre]


def ascii_slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\.(png|jpe?g|webp)$', '', s)
    s = re.sub(r'[\s_-]*(\(\d+\)|-\d+)$', '', s)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:48]


def norm(s):
    return unicodedata.normalize('NFC', s).lower().replace('’', "'")


def match(rules, title):
    t = norm(title)
    for pat, meta in rules:
        if re.search(pat, t):
            return dict(meta)
    return None


def guess(folder, title):
    """Image inconnue : étiquettes devinées (le MJ les retouche dans la page Banque)."""
    nom = re.sub(r'[\s_-]*(\(\d+\)|-\d+)?\.(png|jpe?g|webp)$', '', title).strip()
    if folder == 'textures':
        return dict(nom=nom, cat='sol', taille=5, milieux=[])
    if folder == 'people':
        return dict(nom=nom, peuple='', roles=[], devine=True)
    return dict(nom=nom, cat='divers', taille=[2, 2], milieux=[], devine=True)


# Noms normalisés des nouvelles images (consignes données à ChatGPT, doc « Échelle des images ») :
#   jeton    : <peuple>-<f|m>-<rôle>[-description][-couche|-assis|-agenouille]-zenith-jeton
#   portrait : le même nom, « portrait » au lieu de « zenith-jeton » (paire reconnue d'office)
#   mobilier : <objet>-<matériau>-<largeur>x<profondeur> ; toit : toit-<forme>-<matériau>-<l>x<p> ;
#   arbre    : <espèce>-<saison>-<diamètre> ; texture : texture-<matière>-<taille>m
PEUPLE_MOTS = {'humain': 'humain', 'humaine': 'humain', 'elfe': 'elfe', 'demi-elfe': 'demi-elfe', 'nain': 'nain', 'naine': 'nain',
               'halfelin': 'halfelin', 'halfeline': 'halfelin', 'gnome': 'gnome', 'demi-orque': 'demi-orque', 'tieffelin': 'tieffelin',
               'tieffeline': 'tieffelin', 'drow': 'drow', 'duergar': 'duergar', 'svirfnebelin': 'svirfnebelin'}
SAISONS = {'printemps', 'ete', 'automne', 'hiver'}


def structured(folder, title):
    """Étiquettes lues dans un nom normalisé ; None si le nom ne suit pas le modèle."""
    stem = unicodedata.normalize('NFKD', title).encode('ascii', 'ignore').decode().lower().strip()
    stem = re.sub(r'\.(png|jpe?g|webp)$', '', stem)
    stem = re.sub(r'\s*\(\d+\)$', '', stem)  # « (2) » ajouté par le Drive à un doublon
    stem = re.sub(r'[\s_]+', '-', stem)
    # Préfixe de série « ls-p-NNNN- » (jeu de personnages zénithaux du 2026-11-09) : il apparie jetons et portraits d'un même
    # personnage, variantes comprises (« -variante-arc-zenith-jeton », « -portrait-variante »).
    serie = None
    ms = re.match(r'^ls-p-(\d+)-(.+)$', stem)
    if ms:
        serie, stem = f'ls-p-{ms.group(1)}', ms.group(2)
        stem = re.sub(r'-portrait-variante(-\d+)?$', '-portrait', stem)
        stem = re.sub(r'-variante(-[a-z]+)*-zenith-jeton$', '-zenith-jeton', stem)
    if folder == 'people':
        m = re.match(r'^(demi-elfe|demi-orque|[a-z]+)-([fm])-([a-z]+)(.*?)-(zenith-jeton|portrait)$', stem)
        if not m or m.group(1) not in PEUPLE_MOTS:
            return None
        rest = m.group(4)
        pose = next((p for p in ('couche', 'assis', 'agenouille') if f'-{p}' in rest), None)
        meta = dict(nom=title.rsplit('.', 1)[0], peuple=PEUPLE_MOTS[m.group(1)], genre=m.group(2), roles=[m.group(3)],
                    paire=serie or stem[: m.start(5) - 1], cadre_fixe=m.group(5) == 'zenith-jeton')
        if m.group(3) == 'enfant':
            meta['roles'] = ['enfant']
        if pose:
            meta['pose'] = pose
        return meta
    if folder == 'textures':
        m = re.match(r'^texture-(.+)-(\d+(?:\.\d+)?)m$', stem)
        return dict(nom=m.group(1).replace('-', ' '), cat='sol', taille=float(m.group(2)), milieux=[], raccorder=True) if m else None
    stem = re.sub(r'-[0-9a-f]{8}$', '', stem)  # empreinte ajoutée au nom par le générateur (« toit-l-terre-cuite-12x12-247091a6 »)
    m = re.match(r'^toit-([a-z]+)-([a-z-]+)-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$', stem)
    if m:
        return dict(nom=f'Toit en {m.group(1).upper() if len(m.group(1)) == 1 else m.group(1)} ({m.group(2)})', cat='toit', forme=m.group(1).upper() if len(m.group(1)) == 1 else m.group(1),
                    usage=['maison'], taille=[float(m.group(3)), float(m.group(4))], milieux=[])
    m = re.match(r'^(.+)-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$', stem)
    if m:
        obj = m.group(1).split('-')[0]
        return dict(nom=m.group(1).replace('-', ' '), cat='mobilier', usage=[obj], taille=[float(m.group(2)), float(m.group(3))], milieux=[])
    m = re.match(r'^([a-z-]+?)-(printemps|ete|automne|hiver)-(\d+(?:\.\d+)?)$', stem)
    if m:
        d = float(m.group(3))
        return dict(nom=m.group(1).replace('-', ' '), cat='arbre' if d >= 4 else 'arbuste', taille=[d, d], saisons=[m.group(2)], milieux=[])
    return None


def seamless(im):
    """Texture raccordable sur ses quatre bords : mélange avec sa copie décalée d'une demi-tuile, le poids de l'original
    s'annulant près des bords (là où la copie décalée est continue d'un bord à l'autre)."""
    import numpy as np
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w = a.shape[:2]
    r = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)
    wx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w * 0.25), 0, 1)
    wy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h * 0.25), 0, 1)
    k = (np.minimum.outer(wy, wx))[..., None]
    k = k * k * (3 - 2 * k)
    return Image.fromarray(np.clip(a * k + r * (1 - k), 0, 255).astype(np.uint8))


def avg_color(im):
    rgba = im.convert('RGBA').resize((16, 16), Image.LANCZOS)
    px = [p for p in (rgba.get_flattened_data() if hasattr(rgba, 'get_flattened_data') else rgba.getdata()) if p[3] > 128] or [(128, 128, 128, 255)]
    r, g, b = (sum(p[i] for p in px) // len(px) for i in range(3))
    return '#%02x%02x%02x' % (r, g, b)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    raw = args[0]
    drive_path = os.path.join(ROOT, 'scripts', 'banque', 'drive.json')
    if '--drive' in args:
        drive_path = args[args.index('--drive') + 1]
    drive = json.load(open(drive_path, encoding='utf-8'))
    entries, slugs, by_title = [], set(), {}
    # Catalogue actuel : une image déjà convertie dont l'original n'est pas dans le dossier de travail est gardée telle
    # quelle (synchronisation partielle : on ne télécharge que les nouvelles).
    old = {}
    if os.path.exists(CATALOGUE):
        old = {e['drive']: e for e in json.load(open(CATALOGUE, encoding='utf-8'))['images'] if e.get('drive')}
    exclues = []
    # Doublons du Drive (même fichier, même empreinte, déposé dans plusieurs dossiers) : une seule image, dont les genres
    # et les mondes réunissent ceux de chaque dossier.
    jumeaux, doublons = {}, []
    for x in sorted(drive, key=lambda x: (x['folder'], x['title'])):
        if x.get('md5'):
            jumeaux.setdefault(x['md5'], []).append(x)
    for x in sorted(drive, key=lambda x: (x['folder'], x['title'])):
        if x.get('md5') and jumeaux[x['md5']][0] is not x:
            doublons.append(x['title'])
            continue
        autres = jumeaux.get(x.get('md5'), [x])
        genre = x.get('genre', 'fantasy')
        if any(re.search(p, norm(x['title'])) for p in EXCLURE):
            exclues.append(x['title'])
            continue
        region = x.get('region', 'surface')
        region = next((r for pat, r in MONDE_FORCE if re.search(pat, norm(x['title']))), region)
        src = os.path.join(raw, x['id'] + '.png')
        if not os.path.exists(src):
            e = old.get(x['id'])
            sub = e and {'texture': 'textures', 'element': 'elements', 'personnage': 'personnages', 'creature': 'creatures'}[e['type']]
            if e and all(os.path.exists(os.path.join(OUT, sub, f"{e['id']}-{m}.webp")) for m in e['mips']):
                e = dict(e)
                if e['type'] in ('personnage', 'creature'):
                    e['region'] = [region]  # le dossier du Drive décide : jamais un habitant des deux mondes
                elif region not in e.get('region', ['surface']):
                    e['region'] = [*e.get('region', ['surface']), region]
                e['genres'] = sorted({g for y in autres for g in genres_of(e, y.get('genre', 'fantasy'))})
                entries.append(e)
                slugs.add(e['id'])
                by_title[norm(x['title'])] = e['id']
            else:
                print('absent :', x['title'])
            continue
        im = Image.open(src)
        im.load()
        has_alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
        folder = x['folder']
        t0 = norm(x['title'])
        if t0.startswith('seamless'):
            folder = 'textures'  # texture déposée avec le décor
        if folder == 'creatures' and re.search(r'svirfneblin|deep gnome', t0):
            folder = 'people'  # un éclaireur svirfnebelin est un personnage, pas une créature
        if folder == 'creatures':
            kind, vue, meta = 'creature', 'jeton' if has_alpha else 'portrait', None
        elif folder == 'textures':
            kind, vue, meta = 'texture', 'tuile', match(TEXTURES, x['title']) or structured(folder, x['title'])
        elif folder == 'people':
            kind = 'personnage'
            vue = 'jeton' if has_alpha else 'portrait'
            meta = structured(folder, x['title']) or match(PEOPLE, x['title'])
            if meta is None:
                t = norm(x['title'])
                alias = next((v for k, v in TOKEN_ALIASES.items() if k in t), None)
                base = match(PEOPLE, alias) if alias else None
                meta = dict(base, paire=alias) if base else None
                if meta:
                    meta.pop('pose', None)
        else:
            kind, vue, meta = 'element', 'zenith', match(ELEMENTS, x['title']) or toit_nomme(x['title']) or structured(folder, x['title'])
            if x['id'] in SOCLES:
                nom_s, mi_s, t_s = SOCLES[x['id']]
                meta = dict(nom=nom_s, cat='socle', taille=t_s or [1.5, 1.5], milieux=mi_s, region=['surface', 'outreterre'] if 'caverne' in mi_s else ['surface'])
        meta = meta or infer(folder, region, x['title'])
        if region == 'outreterre' and 'region' not in meta:
            meta['region'] = ['outreterre']
        if kind in ('personnage', 'creature'):
            meta['region'] = [region]  # personnages et créatures : le monde de leur dossier, et lui seul
        if meta.get('genre') is None:
            meta.pop('genre', None)
        if vue == 'jeton' and kind == 'personnage':
            meta['angle'] = 'zenith' if any(z in norm(x['title']) for z in ZENITH) else 'incline'
        # Recadrage sur la partie visible (éléments et jetons) : la taille réelle vaut pour ce qui est dessiné.
        if has_alpha:
            bbox = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if bbox:
                # Jeton à cadre fixe (largeur du cadre = 1,5 m) : sa longueur réelle se lit avant le recadrage.
                if meta.pop('cadre_fixe', False):
                    meta['longueur'] = round(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 1.5 / im.size[0], 2)
                im = im.crop(bbox)
        meta.pop('cadre_fixe', None)
        if meta.pop('carre', False):
            w, h = im.size
            c = min(w, h)
            im = im.crop(((w - c) // 2, (h - c) // 2, (w - c) // 2 + c, (h - c) // 2 + c))
        if 'cote' in meta:
            # Grand côté réel (m) ; l'autre suit les proportions de ce qui est dessiné.
            L, (w, h) = meta.pop('cote'), im.size
            meta['taille'] = [L, round(L * h / w, 2)] if w >= h else [round(L * w / h, 2), L]
        im = im.convert('RGBA' if has_alpha else 'RGB')
        if meta.pop('raccorder', False):
            im = seamless(im)
        slug = ascii_slug(x['title'])
        if vue == 'jeton':
            slug += '-jeton'
        base_slug, n = slug, 2
        while slug in slugs:
            slug, n = f'{base_slug}-{n}', n + 1
        slugs.add(slug)
        folder_out = {'texture': 'textures', 'element': 'elements', 'personnage': 'personnages', 'creature': 'creatures'}[kind]
        os.makedirs(os.path.join(OUT, folder_out), exist_ok=True)
        w0, h0 = im.size
        mips = []
        # Tous les éléments en 1024 px aussi : les plans à l'échelle zooment jusqu'à 64 px par mètre (un mouton, un arbuste, un
        # rocher y dépassent 512 px) ; sans cette version, la carte devrait les rétrécir ou les agrandir flous.
        big = kind in ('texture', 'element') or vue == 'portrait'
        # Textures livrées en 2048 px : une version 2048 aussi (zoom maximal sur écran haute densité, tuiles de 8 à 12 m).
        sizes = SIZES + ((2048,) if kind == 'texture' and max(w0, h0) >= 2048 else ())
        for s in sizes if big else SIZES[:2]:
            k = min(1.0, s / max(w0, h0))
            # Jamais d'agrandissement : on s'arrête à la taille d'origine.
            if mips and k >= 1.0:
                break
            dest = os.path.join(OUT, folder_out, f'{slug}-{s}.webp')
            # Déjà converti (synchronisation) : on ne refait que les images nouvelles, sauf avec --force.
            if '--force' in args or not os.path.exists(dest) or os.path.getmtime(dest) < os.path.getmtime(src):
                out = im if k >= 1.0 else im.resize((max(1, round(w0 * k)), max(1, round(h0 * k))), Image.LANCZOS)
                out.save(dest, 'WEBP', quality=82 if s < 1024 else 80, method=4)
            mips.append(s)
        e = dict(id=slug, drive=x['id'], titre=x['title'], empreinte=(x.get('md5') or '')[:16] or None, type=kind, vue=vue, ratio=round(w0 / h0, 3), couleur=avg_color(im), mips=mips, **meta)
        if meta.get('cat') == 'toit' and has_alpha:
            # Silhouette du toit (8 × 8 cases, ligne par ligne) : pour le poser sur une emprise en L, en T, en U…
            a = im.getchannel('A').resize((8, 8), Image.BOX)
            e['masque'] = ''.join('1' if a.getpixel((i, j)) > 110 else '0' for j in range(8) for i in range(8))
        e.setdefault('milieux', [])
        e.setdefault('climats', [])
        e.setdefault('saisons', [])
        # Végétation sans climat ni saison dans les règles : on les déduit du titre (un arbre enneigé l'été, un bambou
        # dans une forêt tempérée, une aubépine en fleurs à l'automne seraient incohérents).
        if kind == 'element' and e.get('cat') in ('arbre', 'arbuste', 'plante', 'bois'):
            low = (x['title'] + ' ' + str(e.get('nom', ''))).lower()
            for rx, cl, sa in VEG_HINTS:
                if re.search(rx, low):
                    if not e['climats'] and cl: e['climats'] = list(cl)
                    if not e['saisons'] and sa: e['saisons'] = list(sa)
                    break
        e.setdefault('region', ['surface'])
        if kind == 'personnage':
            e.setdefault('taille', [0.9, 0.9])
        if e.get('usage') == ['tactique']:
            e['vue'] = 'tuile'
        e['genres'] = sorted({g for y in autres for g in genres_of(e, y.get('genre', 'fantasy'))})
        # Doublon déposé dans un autre monde : l'image sert aux deux (le MJ l'a voulu en la mettant dans les deux dossiers).
        for y in autres[1:]:
            if y.get('region', 'surface') not in e['region']:
                e['region'] = [*e['region'], y.get('region', 'surface')]
        if not e['empreinte']:
            e.pop('empreinte')
        entries.append(e)
        by_title[norm(x['title'])] = slug
    # Paires portrait ↔ jeton : on remplace l'indice textuel par l'identifiant de l'autre image.
    for e in entries:
        if e['type'] != 'personnage' or not e.get('paire'):
            continue
        key = e['paire']
        want = 'portrait' if e['vue'] == 'jeton' else 'jeton'
        other = next((o for o in entries if o['type'] == 'personnage' and o['vue'] == want and key in norm(o['titre'])), None)
        e['paire'] = other['id'] if other else None
    pair_auto(entries)
    # Longueur réelle (m) que couvre l'image de chaque jeton : les images remplissent toutes leur cadre, quelle que soit
    # la taille du personnage ou l'angle de vue. Mesurée à l'œil d'après la largeur des épaules (scripts/banque/
    # longueurs.json) ; un jeton absent de la liste prend une estimation d'après son peuple (tokenScale).
    longueurs = json.load(open(os.path.join(os.path.dirname(__file__), 'longueurs.json'), encoding='utf-8'))
    for e in entries:
        if e['vue'] == 'jeton' and e['id'] in longueurs:
            e['longueur'] = longueurs[e['id']]
    os.makedirs(os.path.dirname(CATALOGUE), exist_ok=True)
    with open(CATALOGUE, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'images': entries}, f, ensure_ascii=False, indent=0)
    # Fichiers qui ne correspondent plus à aucune version du catalogue (image retirée ou renommée) : retirés.
    keep = {os.path.join(OUT, {'texture': 'textures', 'element': 'elements', 'personnage': 'personnages', 'creature': 'creatures'}[e['type']], f"{e['id']}-{m}.webp") for e in entries for m in e['mips']}
    for d in ('textures', 'elements', 'personnages', 'creatures'):
        for f in os.listdir(os.path.join(OUT, d)) if os.path.isdir(os.path.join(OUT, d)) else []:
            if os.path.join(OUT, d, f) not in keep:
                os.remove(os.path.join(OUT, d, f))
    devine = [e['titre'] for e in entries if e.get('devine')]
    print(len(entries), 'images ;', sum(1 for e in entries if e['type'] == 'texture'), 'textures,',
          sum(1 for e in entries if e['type'] == 'element'), 'éléments,', sum(1 for e in entries if e['type'] == 'personnage'), 'personnages,',
          sum(1 for e in entries if e['type'] == 'creature'), 'créatures ;', sum(1 for e in entries if 'outreterre' in e['region']), 'en Outreterre')
    if exclues:
        print('Ignorées (sans rapport avec la banque) :', *exclues, sep='\n  ')
    if doublons:
        print('Doublons réunis (même fichier dans plusieurs dossiers) :', *doublons, sep='\n  ')
    if devine:
        print('Étiquettes devinées (à vérifier) :', *devine, sep='\n  ')


if __name__ == '__main__':
    main()
