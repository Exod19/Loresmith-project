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
    (r'obsidian', dict(nom='Obsidienne', cat='rocher', taille=[3, 3], milieux=['volcan', 'caverne'], region=['surface', 'outreterre'])),
    (r'basalt column', dict(nom='Orgues basaltiques', cat='rocher', taille=[3, 3], milieux=['volcan', 'cote', 'caverne'], region=['surface', 'outreterre'])),
    (r'basalt hex', dict(nom='Dalles de basalte', cat='rocher', taille=[2.6, 2.6], milieux=['volcan', 'cote', 'caverne'], region=['surface', 'outreterre'])),
    (r'glacial ice', dict(nom='Bloc de glace', cat='rocher', taille=[2.6, 2.6], milieux=['toundra', 'montagne', 'lac'], climats=[F], saisons=['hiver'])),
    # Toits (bâtiments vus du ciel)
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

TEXTURES = [
    (r'cendre volcanique', dict(nom='Cendre volcanique', cat='cendre', taille=6, milieux=['volcan'])),
    (r'cro.te volcanique', dict(nom='Croûte de lave', cat='lave', taille=6, milieux=['volcan'], region=['surface', 'outreterre'])),
    (r'dalles de pierre', dict(nom='Dalles de pierre', cat='dalles', taille=4, milieux=['interieur', 'ville', 'temple', 'caverne'], region=['surface', 'outreterre'])),
    (r'eau douce turquoise', dict(nom='Eau claire', cat='eau', taille=8, milieux=['riviere', 'lac'], climats=[C, TR, T])),
    (r'eau sombre', dict(nom='Eau sombre', cat='eau', taille=8, milieux=['riviere', 'lac', 'mer', 'marais'], region=['surface', 'mer', 'outreterre'])),
    (r'flanc montagneux', dict(nom='Granite fracturé', cat='roche', taille=8, milieux=['montagne'])),
    (r'glace lacustre', dict(nom='Glace', cat='glace', taille=8, milieux=['lac', 'riviere'], climats=[F], saisons=['hiver'])),
    (r'herbe dense', dict(nom='Prairie', cat='herbe', taille=4, milieux=['campagne', 'ville'], climats=[T], saisons=['printemps', 'ete'])),
    (r'herbes folles', dict(nom='Herbes folles dorées', cat='champ', taille=4, milieux=['campagne', 'savane'], climats=[T, C], saisons=['ete', 'automne'])),
    (r'mousse foresti', dict(nom='Mousse forestière', cat='mousse', taille=4, milieux=['foret'], climats=[T])),
    (r'neige ivoire', dict(nom='Neige fraîche', cat='neige', taille=6, milieux=['campagne', 'ville', 'montagne', 'toundra'], climats=[F, T], saisons=['hiver'])),
    (r'pav.s m.di.vaux', dict(nom='Pavés', cat='paves', taille=4, milieux=['ville'])),
    (r'planches de bois', dict(nom='Planches', cat='planches', taille=3, milieux=['interieur', 'ponton'])),
    (r'plateau granitique', dict(nom='Plateau rocheux', cat='roche', taille=8, milieux=['montagne'])),
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
    for x in sorted(drive, key=lambda x: (x['folder'], x['title'])):
        src = os.path.join(raw, x['id'] + '.png')
        if not os.path.exists(src):
            print('absent :', x['title'])
            continue
        im = Image.open(src)
        im.load()
        has_alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
        folder = x['folder']
        if folder == 'textures':
            kind, vue, meta = 'texture', 'tuile', match(TEXTURES, x['title'])
        elif folder == 'people':
            kind = 'personnage'
            vue = 'jeton' if has_alpha else 'portrait'
            meta = match(PEOPLE, x['title'])
            if meta is None:
                t = norm(x['title'])
                alias = next((v for k, v in TOKEN_ALIASES.items() if k in t), None)
                base = match(PEOPLE, alias) if alias else None
                meta = dict(base, paire=alias) if base else None
                if meta:
                    meta.pop('pose', None)
        else:
            kind, vue, meta = 'element', 'zenith', match(ELEMENTS, x['title'])
        meta = meta or guess(folder, x['title'])
        # Recadrage sur la partie visible (éléments et jetons) : la taille réelle vaut pour ce qui est dessiné.
        if has_alpha:
            bbox = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if bbox:
                im = im.crop(bbox)
        im = im.convert('RGBA' if has_alpha else 'RGB')
        slug = ascii_slug(x['title'])
        if vue == 'jeton':
            slug += '-jeton'
        base_slug, n = slug, 2
        while slug in slugs:
            slug, n = f'{base_slug}-{n}', n + 1
        slugs.add(slug)
        folder_out = {'texture': 'textures', 'element': 'elements', 'personnage': 'personnages'}[kind]
        os.makedirs(os.path.join(OUT, folder_out), exist_ok=True)
        w0, h0 = im.size
        mips = []
        # 1024 px seulement là où un zoom l'exige (textures, portraits, grands éléments) : la banque reste légère.
        big = kind == 'texture' or vue == 'portrait' or (kind == 'element' and isinstance(meta.get('taille'), list) and max(meta['taille']) >= 8)
        for s in SIZES if big else SIZES[:2]:
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
        e = dict(id=slug, drive=x['id'], titre=x['title'], type=kind, vue=vue, ratio=round(w0 / h0, 3), couleur=avg_color(im), mips=mips, **meta)
        if meta.get('cat') == 'toit' and has_alpha:
            # Silhouette du toit (8 × 8 cases, ligne par ligne) : pour le poser sur une emprise en L, en T, en U…
            a = im.getchannel('A').resize((8, 8), Image.BOX)
            e['masque'] = ''.join('1' if a.getpixel((i, j)) > 110 else '0' for j in range(8) for i in range(8))
        e.setdefault('milieux', [])
        e.setdefault('climats', [])
        e.setdefault('saisons', [])
        e.setdefault('region', ['surface'])
        if kind == 'personnage':
            e.setdefault('taille', [0.9, 0.9])
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
    os.makedirs(os.path.dirname(CATALOGUE), exist_ok=True)
    with open(CATALOGUE, 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'images': entries}, f, ensure_ascii=False, indent=0)
    # Fichiers qui ne correspondent plus à aucune version du catalogue (image retirée ou renommée) : retirés.
    keep = {os.path.join(OUT, {'texture': 'textures', 'element': 'elements', 'personnage': 'personnages'}[e['type']], f"{e['id']}-{m}.webp") for e in entries for m in e['mips']}
    for d in ('textures', 'elements', 'personnages'):
        for f in os.listdir(os.path.join(OUT, d)) if os.path.isdir(os.path.join(OUT, d)) else []:
            if os.path.join(OUT, d, f) not in keep:
                os.remove(os.path.join(OUT, d, f))
    devine = [e['titre'] for e in entries if e.get('devine')]
    print(len(entries), 'images ;', sum(1 for e in entries if e['type'] == 'texture'), 'textures,',
          sum(1 for e in entries if e['type'] == 'element'), 'éléments,', sum(1 for e in entries if e['type'] == 'personnage'), 'personnages')
    if devine:
        print('Étiquettes devinées (à vérifier) :', *devine, sep='\n  ')


if __name__ == '__main__':
    main()
