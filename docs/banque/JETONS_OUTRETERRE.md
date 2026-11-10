# Jetons de l'Outreterre à refaire en vue zénithale

Les 65 jetons de personnages de l'Outreterre (dossier Drive `Loresmith_map Underdark / People/Characters`) sont vus
de biais (environ 15°, visage visible). Ils doivent être refaits **à la verticale**, comme la série de surface `ls-p` :
on voit le dessus de la tête et des épaules, pas le visage.

Le portrait de chaque personnage ne change pas : le nouveau jeton doit représenter **la même personne** (mêmes
vêtements, couleurs, coiffure, accessoires). L'ancien jeton et le portrait servent de référence (liens ci-dessous).

## Cahier des charges

- Vue zénithale stricte (caméra à la verticale), personnage debout vu du dessus : sommet du crâne, épaules, bras,
  armes ou outils tenus, pointe des pieds à peine visible. Pas de visage de face, pas de perspective.
- PNG à fond **transparent**, carré, 1024 px minimum (idéalement 1254 ou 2048 px), personnage centré, qui remplit
  environ 70 % du cadre (même échelle que les jetons `ls-p` de surface).
- Lumière douce venant du haut, ombre portée légère ou absente, style peint réaliste sombre (dark fantasy), couleurs de
  l'Outreterre (pierre, violet, ambre) sur les vêtements seulement : pas de décor, pas de sol, pas de socle.
- Un fichier par jeton.

## Nom des fichiers (important : la banque les reconnaît par leur nom)

```
ls-u-<numéro>-<peuple>-<f|m>-<rôle>-<description courte>-zenith-jeton.png
```

- `<numéro>` et `<peuple>` : ceux du tableau (ex. `ls-u-0001-moriquendi`).
- `<f|m>` : femme ou homme, d'après le portrait (le tableau l'indique quand il est connu).
- `<rôle>` : le premier rôle du tableau, sans accent (ex. `artisan`, `garde`, `mage`).
- `<description>` : quelques mots, en minuscules et tirets, sans accent (ex. `serrurier-cle-de-fer`).
- Exemple : `ls-u-0001-moriquendi-m-artisan-serrurier-cle-de-fer-zenith-jeton.png`

Déposer les fichiers dans le dossier Drive `Loresmith_map Underdark / People/Characters`, puis me demander de
synchroniser : chaque nouveau jeton reprend le nom, les rôles et le portrait de l'ancien (table
`scripts/banque/outreterre-zenith.json`), l'ancien jeton est écarté de la banque et les jetons déjà posés sur les
cartes affichent automatiquement la nouvelle version. Inutile de supprimer les anciens fichiers du Drive.

## Invite type pour ChatGPT

> Génère un jeton de personnage pour une carte de jeu de rôle, vue zénithale stricte (caméra exactement à la
> verticale, on voit le dessus de la tête et les épaules, jamais le visage), personnage debout, fond transparent,
> PNG carré 1254 px, personnage centré occupant environ 70 % du cadre, style peint réaliste dark fantasy, lumière
> douce venant du haut, sans décor ni sol ni socle. Le personnage est exactement celui de l'image de référence
> jointe (mêmes vêtements, couleurs, coiffure, accessoires) : [nom du tableau], [peuple], [rôle].
> Nomme le fichier : ls-u-NNNN-peuple-f|m-role-description-zenith-jeton.png

Joindre à chaque demande le portrait (et l'ancien jeton) de la ligne correspondante.

## Les 65 jetons

| N° | Personnage | Peuple | Genre | Rôles | Ancien jeton (de biais) | Portrait de référence |
| --- | --- | --- | --- | --- | --- | --- |
| ls-u-0001 | Serrurier moriquendi | moriquendi | f/m ? | artisan | Austere Locksmith with an Iron Key [voir](https://drive.google.com/file/d/1osERgkCeKr13wYVFjtpXt-eJI2TrtrmP/view) | Moriquendi locksmith with an iron key [voir](https://drive.google.com/file/d/1IshAk5ZaKYlRjOl_tP9E62fr79K9p6xe/view) |
| ls-u-0002 | Potier moriquendi | moriquendi | f/m ? | artisan | Black-Painted Potter with Clay Bowl [voir](https://drive.google.com/file/d/1SEAj-xKz1hYSPZffZi3O3Vf12T6a9vf5/view) | Pale Moriquendi Potter in Crystal Workshop [voir](https://drive.google.com/file/d/1nDFjNuaaVoWoNrABLUPkcQWe8hJlNxxh/view) |
| ls-u-0003 | Mage moriquendi | moriquendi | f/m ? | mage | Braided Archmage with Amethyst Staff [voir](https://drive.google.com/file/d/1xzjKQvgyBdHv-YZzft2H1jwQrfRlulgP/view) | Pale Archmage Beneath Violet Crystal Light [voir](https://drive.google.com/file/d/1S5v3hIn78z87A9Av6pGSF--I138uXQaj/view) |
| ls-u-0004 | Pêcheur moriquendi | moriquendi | f/m ? | batelier, pecheur | Braided Bayou Fisher with Reed Creel [voir](https://drive.google.com/file/d/1nW7T_4uGeyngAytB6fMJ7fm7Q4ZHqa7A/view) | Moriquendi bayou fisher with ritual paint [voir](https://drive.google.com/file/d/12iqJ8md6rBNwCDrmXKduEaYW9JVKVkDw/view) |
| ls-u-0005 | Cuisinier moriquendi | moriquendi | f/m ? | cuisinier | Braided Cook with Spider Face Paint [voir](https://drive.google.com/file/d/1CrXwjZfd2j4c5MEn1Z7LW2MLexgxGi71/view) | Pale Moriquendi Cook with Spider-Leg Paint [voir](https://drive.google.com/file/d/12A_RvhAPgfqM3xMR6uLihf-I3hx782yk/view) |
| ls-u-0006 | Pisteur moriquendi | moriquendi | f/m ? | chasseur, eclaireur | Cave rescue tracker token [voir](https://drive.google.com/file/d/1CbcZqxT6CkTQd4xkVDuROeOq-44fgYML/view) | Underground Rescue Tracker Beneath Crystal Lamps [voir](https://drive.google.com/file/d/1MVULlsGDlvcm_jc43Ca3EN7Umwq4uuU2/view) |
| ls-u-0007 | Intendant moriquendi | moriquendi | f/m ? | erudit, scribe | Charcoal-coated administrator with document case [voir](https://drive.google.com/file/d/1APb23XGgv0RxEPFJz8EQ7FjmNZm-oQQN/view) | — — |
| ls-u-0008 | Grande prêtresse moriquendi | moriquendi | f | clerc, pretre | Charcoal-robed high priestess token [voir](https://drive.google.com/file/d/10TXibhYnQWeF3fi-upOrhjRIyuKh0V1t/view) | Wrinkled High Priestess in Crystal Chamber [voir](https://drive.google.com/file/d/1qfD8yzMqyy9ezc19M8BohTXXHHKWChlO/view) |
| ls-u-0009 | Greffier moriquendi | moriquendi | f/m ? | erudit, scribe | Clan-painted registrar with registry and keys [voir](https://drive.google.com/file/d/1n4nb6R-Xtx730VT64zjw2c9JqbNhNCBo/view) | Silver-haired superintendent of the crystal registry [voir](https://drive.google.com/file/d/1vYGpbwJXu_lD-v2SyTVmXYIqgk5UUf21/view) |
| ls-u-0010 | Danseuse moriquendi | moriquendi | f | artiste | Copper-haired Dancer with Ochre Sash [voir](https://drive.google.com/file/d/1Oq0ghxVyJlQvcdQf8s-1Y1kECCoBADp4/view) | — — |
| ls-u-0011 | Éclaireur svirfnebelin | svirfnebelin | f/m ? | chasseur, eclaireur | Deep gnome scout battlemap token-6 [voir](https://drive.google.com/file/d/18nFR84KPLO0DEXVgrEoaIyLVa58F5Aqk/view) | — — |
| ls-u-0012 | Grand prêtre moriquendi | moriquendi | f/m ? | clerc, pretre | Elder High Priest with Driftwood Staff [voir](https://drive.google.com/file/d/1oBtbQvrU0agPM1J2cuHMSKNOF1nwPGoa/view) | Moriquendi high priest in a crystal-lit sanctuary [voir](https://drive.google.com/file/d/1fKlknU-sCaWYiVoMpirbwNJcskVGQGk6/view) |
| ls-u-0013 | Professeur moriquendi | moriquendi | f/m ? | erudit, scribe | Elder Teacher with Geometric Face Paint [voir](https://drive.google.com/file/d/1VdN084zNpMx-4TBGNfHN6QPQiVm1mV4H/view) | Pale Moriquendi Teacher in a Crystal-Lit Classroom [voir](https://drive.google.com/file/d/1ORXV9Thue504MKVp06k0F4RZKU7MPvXa/view) |
| ls-u-0014 | Marchand de curiosités moriquendi | moriquendi | f/m ? | marchand | Lanky Curio Dealer with a Wooden Box [voir](https://drive.google.com/file/d/1n9O32anEKWSvZiTW4oHMoi9xrtfjBHml/view) | — — |
| ls-u-0015 | Habitante moriquendi | moriquendi | f | villageois | Moriquendi Woman with a Folding Fan [voir](https://drive.google.com/file/d/18XWiioEL22WH3izqUJuqM1BzTzsdnw_h/view) | — — |
| ls-u-0016 | Habitante moriquendi | moriquendi | f | villageois | Moriquendi Woman’s Overhead Character Token [voir](https://drive.google.com/file/d/1aKCMnAXwzaPKMbXCm5bkOcSic3DROtbF/view) | — — |
| ls-u-0017 | Éleveur | gobelin | f/m ? | eleveur, fermier | Moss-green cave goblin breeder-8 [voir](https://drive.google.com/file/d/1y4tDo0KU7slYMqdeichLcQEv5o8K3F6E/view) | Curious Goblin Cave Breeder-4 [voir](https://drive.google.com/file/d/1fwpvO9Ba7N34HtmVPLb7dn-l1No31ISP/view) |
| ls-u-0018 | Prophétesse moriquendi | moriquendi | f | clerc, pretre | Norrianiss Prophetess Overhead Token [voir](https://drive.google.com/file/d/1CzipUZzIfz3ZRvsTjJxrB5yay5Z0bK5Z/view) | Pale Norrianiss Prophetess in Crystal Light [voir](https://drive.google.com/file/d/1B_3U-ur0Eve3xM_FZUpC88HPZ57eI9S_/view) |
| ls-u-0019 | Gardien des mémoires moriquendi | moriquendi | f/m ? | erudit, scribe | Northern Storykeeper with Eightfold Eye Paint [voir](https://drive.google.com/file/d/1iUxZH73bkEiI0FLH7-vvrC745oS2TKY2/view) | Moriquendi keeper of northern memories [voir](https://drive.google.com/file/d/1buJ1N6umF5dPFY8CTnlnCE--ifAQR4WI/view) |
| ls-u-0020 | Garde moriquendi | moriquendi | f/m ? | garde, soldat | Overhead access guard with iron key [voir](https://drive.google.com/file/d/1cBnyz0_NFkTysS0gXRGw51Ou6J_kwTrM/view) | Moriquendi gate guard with black face paint [voir](https://drive.google.com/file/d/1kJkaVdlAzf06SCIXhr99UsIdOP5gsW0_/view) |
| ls-u-0021 | Apprenti alchimiste moriquendi | moriquendi | f/m ? | guerisseur, herboriste | Overhead Alchemy Apprentice with Amber Flask [voir](https://drive.google.com/file/d/1Q8bpvpH9IX5Cz4REb2aI5V-DmOVXL3Ms/view) | Alchemist Apprentice Beneath Crystal Caverns [voir](https://drive.google.com/file/d/1H7uTWZEnm5YcU58XqELpdCzOT_3u8gpS/view) |
| ls-u-0022 | Prêtresse moriquendi | moriquendi | f | clerc, pretre | Overhead Archive Priestess Token [voir](https://drive.google.com/file/d/1l4c6VIg3y8CKsMhH8d7GBIoybs8QVpKo/view) | — — |
| ls-u-0023 | Marchand de cristaux moriquendi | moriquendi | f/m ? | marchand | Overhead crystal merchant token [voir](https://drive.google.com/file/d/1oKY-u_RASl01bcAutln8iq4FPEku8M96/view) | Crystal Merchant in the Underground Reagent Shop [voir](https://drive.google.com/file/d/1M1j9QIuTXXdPw7q6BgUU1pvS7ZfjRzcj/view) |
| ls-u-0024 | Diplomate moriquendi | moriquendi | f/m ? | diplomate, messager | Overhead Dark Fantasy Envoy Token [voir](https://drive.google.com/file/d/1FMcY3JsNjnzDaWMZlqiRphn4X2vmIemZ/view) | Pale Moriquendi Envoy in the Crystal Hall [voir](https://drive.google.com/file/d/12FFm6cQLOIzGk0Vx5uM15bwtU7sgVCb8/view) |
| ls-u-0025 | Cultivateur de champignons svirfnebelin | svirfnebelin | f/m ? | eleveur, fermier | Overhead Deep Gnome Mushroom Farmer-7 [voir](https://drive.google.com/file/d/1sY7Hy7aEwgvSJ7vDyGNNEw2D3xjb04UI/view) | Weathered Deep Gnome Mushroom Farmer-3 [voir](https://drive.google.com/file/d/1ChVpQvslIkVdGOvzlNbOGr3uQuD-u7je/view) |
| ls-u-0026 | Prêtresse drow | drow | f | clerc, pretre | Overhead drow priestess battle token-5 [voir](https://drive.google.com/file/d/1TC_mJm-UliLZnpezwE3SwJIp28ZbLM4Z/view) | Amethyst-Robed Drow Priestess-2 [voir](https://drive.google.com/file/d/1P1fj8vUX3klJsUhvNApYPgF1cfk5z2Nf/view) |
| ls-u-0027 | Forgeron duergar | duergar | f/m ? | artisan, forgeron | Overhead duergar blacksmith token-6 [voir](https://drive.google.com/file/d/16PayOIopY7E_nW0Yw9JHgCmhlW2x2HgM/view) | Ash-Gray Duergar Blacksmith Portrait-1 [voir](https://drive.google.com/file/d/1yLSBaTnaOHO5ASie-uukEA8tJDTrtM9d/view) |
| ls-u-0028 | Commandant moriquendi | moriquendi | f/m ? | garde, soldat | Overhead garrison commander in blackened steel [voir](https://drive.google.com/file/d/14aksz4-1vcCcYldS-g7JR-dc1YwOtemi/view) | Iron-gray commander of the underdark [voir](https://drive.google.com/file/d/1N_k4bs-2_0QxOQnNQ8rq-7WSh1k6c_XG/view) |
| ls-u-0029 | Sage-femme moriquendi | moriquendi | f | guerisseur, herboriste | Overhead midwife with linen roll [voir](https://drive.google.com/file/d/1Hi_lYANt42oJhGggGkwYUivH3SckcLNL/view) | Norrianiss Midwife in the Crystal Care Room [voir](https://drive.google.com/file/d/1HA9ckdKe-csAUS2lMwD440_RUMWbb43w/view) |
| ls-u-0030 | Habitant moriquendi | moriquendi | f/m ? | villageois | Overhead pale Moriquendi map token [voir](https://drive.google.com/file/d/1d1f7K6gyLPNARw9oFhaepacuy9_XWa3w/view) | — — |
| ls-u-0031 | Patrouilleur moriquendi | moriquendi | f/m ? | garde, soldat | Overhead patrol corporal with sheathed sword [voir](https://drive.google.com/file/d/1fM8l_Lus1nW9ewPWI1JIxYEvKoeMZpJB/view) | Pale Moriquendi Patrol at Crystal Junction [voir](https://drive.google.com/file/d/1O4OWqNV_a70YpTDqjIhxcO0sqMYFgtBE/view) |
| ls-u-0032 | Prêteur sur gages moriquendi | moriquendi | f/m ? | marchand | Overhead pawnbroker with a ring box [voir](https://drive.google.com/file/d/1W259xn-DOQAYSexQpUkf_VyeLRzT6oM6/view) | Crystal-Lit Underground Pawnbroker [voir](https://drive.google.com/file/d/1fKBOk1PZXP4jj-9xy4VHbx2m9URZstCz/view) |
| ls-u-0033 | Vendeur de vivres moriquendi | moriquendi | f/m ? | marchand | Overhead provisions seller with ration bundle [voir](https://drive.google.com/file/d/16YVfLAnVe_CEsLG6YBPbbVdCy0wkYs3-/view) | — — |
| ls-u-0034 | Bouvier moriquendi | moriquendi | f/m ? | eleveur, fermier | Overhead White-Haired Drover Token [voir](https://drive.google.com/file/d/1AiDG7hS90-j4jPfcIG0khGyCgFJEe2e0/view) | Pale Pack Drover Beneath Crystal Light [voir](https://drive.google.com/file/d/1AAXhMB_wra2DbgIDO_I3xd5FXz6KfkNJ/view) |
| ls-u-0035 | Veilleur de nuit moriquendi | moriquendi | f/m ? | garde, soldat | Painted Night Watchkeeper [voir](https://drive.google.com/file/d/1oP5JxNGip4u_BSjvsEcfRThGh3VKTeen/view) | Moriquendi night watchkeeper with black face paint [voir](https://drive.google.com/file/d/1ARfH6e35cpiosluzkErtldGjt8i0gJtL/view) |
| ls-u-0036 | Professeur moriquendi | moriquendi | f/m ? | erudit, mage, scribe | Pale enchantment lecturer with arachnid paint [voir](https://drive.google.com/file/d/1R0B7TBlSR6DFBX6_pY-ZtEWnDfIY64kM/view) | Black-Painted Lecturer in the Underdark [voir](https://drive.google.com/file/d/1mg_cH5viBHSX1Ar68b4kM1aD9_Qkj-7Y/view) |
| ls-u-0037 | Herboriste moriquendi | moriquendi | f/m ? | guerisseur, herboriste | Pale Herbal Caregiver RPG Token [voir](https://drive.google.com/file/d/19MRVInI3Msnw1fx2KnuMVEnWPgpju88T/view) | — — |
| ls-u-0038 | Intendant moriquendi | moriquendi | f/m ? | artisan | Pale Quartermaster with Towels [voir](https://drive.google.com/file/d/1kKoCj2WCVmHXWrQjbWfw7BeIjzZj9WAc/view) | Black-painted linen quartermaster in crystal laundry [voir](https://drive.google.com/file/d/1kKdXZPxwRPB8mQrenOODHH7SH8kbaAhy/view) |
| ls-u-0039 | Habitant moriquendi | moriquendi | f/m ? | villageois | Pale-braided Moriquendi Character Token [voir](https://drive.google.com/file/d/1DDxUxM3-D2aKqUFZRT2Zcz1k0Cj2j7XF/view) | — — |
| ls-u-0040 | Intendant moriquendi | moriquendi | f/m ? | erudit, scribe | Plum-Coated Superintendent Token [voir](https://drive.google.com/file/d/185bCEVRukxcCqmdg12bK7qb8Fb_ApOEO/view) | — — |
| ls-u-0041 | Prêtresse moriquendi | moriquendi | f | clerc, pretre | River Priestess With Charms [voir](https://drive.google.com/file/d/1nNkys3ULf4CZpyhG9C7_XX3a3lziCF6c/view) | Teal-robed priestess by the underdark river [voir](https://drive.google.com/file/d/1rhZFMcWTIk11ac6_CIeJLGsmABqYj8FC/view) |
| ls-u-0042 | Diplomate moriquendi | moriquendi | f/m ? | diplomate, messager | Silver-haired diplomat with forked face paint [voir](https://drive.google.com/file/d/1OwV9hZSI29AFSeE4N_tFlM_XhHtjZ9sZ/view) | Pale Moriquendi Diplomat in a Crystal Cavern Embassy [voir](https://drive.google.com/file/d/1yXgRi5ngSRzuaomeIuQm-UBZ2MXRc4K7/view) |
| ls-u-0043 | Habitant moriquendi | moriquendi | f/m ? | villageois | Silver-haired Moriquendi map token(2) [voir](https://drive.google.com/file/d/1LO4GJ3qEi4i528Svt0a2vh4c7XQEFoHQ/view) | — — |
| ls-u-0044 | Greffier moriquendi | moriquendi | f/m ? | erudit, scribe | Silver-haired toll clerk overhead token [voir](https://drive.google.com/file/d/1NJjS9h1O85PEMLg99Pxq0ksOAo0agntW/view) | Black-marked checkpoint clerk beneath violet crystals [voir](https://drive.google.com/file/d/161vKS7YCaIThD27FfXl2lGi1LkXsrTpE/view) |
| ls-u-0045 | Noble moriquendi | moriquendi | f/m ? | noble | Standing Moriquendi Noble Character Token [voir](https://drive.google.com/file/d/15ON6zdYyXYjY3eW5zNodxAZWe53JLgzk/view) | — — |
| ls-u-0046 | Sergent humain | humain | f/m ? | garde, soldat | Top-Down Ash-Blond Militia Sergeant [voir](https://drive.google.com/file/d/1NZ5nk6l7i_6pTVrVTOJxTbSwopXEMVct/view) | — — |
| ls-u-0047 | Messager moriquendi | moriquendi | f/m ? | diplomate, messager | Top-down black-painted courier token [voir](https://drive.google.com/file/d/1GRga1AFfC-y7YboAnah_xrxmAVx_Un3z/view) | Pale Moriquendi courier with angular black paint [voir](https://drive.google.com/file/d/1wo-BIi_dVLs2c9SfJguHJxYnC_6RawHI/view) |
| ls-u-0048 | Marchand drow | drow | f/m ? | marchand | Top-Down Drow Merchant Token-7 [voir](https://drive.google.com/file/d/10ql2F2VMkkOth-aPc2LggKFifUsDHtIk/view) | Drow Merchant in Chiaroscuro-2 [voir](https://drive.google.com/file/d/1qZ4Tcqt6CfgD2Nx-BoHzTiLCw9tNF1LZ/view) |
| ls-u-0049 | Aubergiste duergar | duergar | f/m ? | aubergiste, tavernier | Top-down duergar innkeeper token-5 [voir](https://drive.google.com/file/d/1pWKnw1kzSJ8agVoqfzOLt06qqauf7vNr/view) | Ash-gray duergar innkeeper portrait-1 [voir](https://drive.google.com/file/d/1_x6E0qYIxbDkPKDzVrDmuo4FwrjS88ES/view) |
| ls-u-0050 | Libraire moriquendi | moriquendi | f/m ? | erudit, marchand, scribe | Top-Down Face-Painted Bookseller [voir](https://drive.google.com/file/d/1pUTuQS8rFyMFbDnYDAhb5heLj0GMIyfZ/view) | Pale Moriquendi Bookseller with Question-Mark Paint [voir](https://drive.google.com/file/d/1ECrrHypp3PLeA_v3ww4aPJ5bF7CMcb5_/view) |
| ls-u-0051 | Apothicaire | gobelin | f/m ? | guerisseur, herboriste | Top-Down Goblin Apothecary Token-8 [voir](https://drive.google.com/file/d/19LndVmIoADiNxQGiMFqDynzSVVjHzxA2/view) | Thoughtful Goblin Apothecary Portrait-3 [voir](https://drive.google.com/file/d/1xFUWcaLjMBecFQtMKtFPHpSLsZJ6117w/view) |
| ls-u-0052 | Mage moriquendi | moriquendi | f/m ? | mage | Top-down gray-robed archmage with brass frame [voir](https://drive.google.com/file/d/13_Mmn9cwPgTvQC_F3bZ41uclneJfOVMO/view) | Ward archmage in the crystal workshop [voir](https://drive.google.com/file/d/1YU7xHmmPhAzBSEyCfz8RmtE3MlTDs3aO/view) |
| ls-u-0053 | Infirmier moriquendi | moriquendi | f/m ? | guerisseur, herboriste | Top-down infirmary attendant with bandages [voir](https://drive.google.com/file/d/1FnOSkYH0zNoLwFVinWTJQKvjS54bc7Mu/view) | Pale Moriquendi Infirmary Attendant [voir](https://drive.google.com/file/d/11r_GlBQ_NBfr9UX7LE-GJFCRerjZMftD/view) |
| ls-u-0054 | Aubergiste moriquendi | moriquendi | f/m ? | aubergiste, tavernier | Top-down innkeeper with question-mark face paint [voir](https://drive.google.com/file/d/1VGEoFOAl7WS2knHgCvyEVNfVKTyh_69z/view) | Pale Moriquendi Innkeeper at the Crystal Bar [voir](https://drive.google.com/file/d/1IkYZGOYUC-k4iqoQeWrnLwbbJGzqrp_B/view) |
| ls-u-0055 | Réparateur moriquendi | moriquendi | f/m ? | artisan | Top-Down Lantern Repairer with Unlit Lantern [voir](https://drive.google.com/file/d/1DHsAVoLdd9EXvLBAnnoVnXmrkN1MluaP/view) | Lantern Repairer in the Deep [voir](https://drive.google.com/file/d/18Pfxeh2PEjq4ZhxcXxJC5RM_eB1CpCBG/view) |
| ls-u-0056 | Prêtre moriquendi | moriquendi | f/m ? | clerc, pretre | Top-down mourning officiant token [voir](https://drive.google.com/file/d/1u05E_1vfIUnZ2Fvzf-xT2A2TuKv-HUZG/view) | Moriquendi Funeral Officiant in the Underdark [voir](https://drive.google.com/file/d/1Nn4STxDjtmTI2SJspt7uGBvGJkPBrR_f/view) |
| ls-u-0057 | Professeur moriquendi | moriquendi | f/m ? | garde, soldat | Top-down painted defense instructor token [voir](https://drive.google.com/file/d/1lOcPBmLxg4Igtn0Xbwtf1fR8cl8sQGgL/view) | Underdark Defense Instructor with Question Mark Paint [voir](https://drive.google.com/file/d/1RSjYwNWLmQLHPGDtrXmkm5PEyztREuDi/view) |
| ls-u-0058 | Prêtresse moriquendi | moriquendi | f | clerc, pretre | Top-Down Priestess with Stone Offering Bowl [voir](https://drive.google.com/file/d/1vR9JyzZ-VGlMnYHm8RB5xa9d2fSlk4ZL/view) | — — |
| ls-u-0059 | Cartographe moriquendi | moriquendi | f/m ? | erudit, scribe | Top-down river cartographer with brass dividers [voir](https://drive.google.com/file/d/1NLrqiJ9pZv0JCbpAiVsE4H8LUjvB4ATu/view) | Underground river cartographer [voir](https://drive.google.com/file/d/1CXb5H_toxtoGHt6cIYYuqfEfhdJ1W8wd/view) |
| ls-u-0060 | Cordier moriquendi | moriquendi | f/m ? | artisan | Top-down rope maker with spider paint [voir](https://drive.google.com/file/d/1oECYSscxtIzPVPfKdG-bYLy5MPdvnMH1/view) | Moriquendi rope maker beneath crystal lamps [voir](https://drive.google.com/file/d/1DNiTpFysoly1a3_K4cS4tnOfVps_5hd3/view) |
| ls-u-0061 | Messager moriquendi | moriquendi | f/m ? | diplomate, messager | Top-down underground relay guide [voir](https://drive.google.com/file/d/10XY690QqzSXTZVa4oqzs2gYGvNRNWTNQ/view) | — — |
| ls-u-0062 | Éclaireur svirfnebelin | svirfnebelin | f/m ? | chasseur, eclaireur | True overhead deep gnome scout [voir](https://drive.google.com/file/d/1qgyvormE41_Sf-OmamHnC-qZ_NxDf-do/view) | White-Haired Deep Gnome Scout-4 [voir](https://drive.google.com/file/d/1UxEFY3kerLkxPL9CRqhH7AEF3vqb3xOQ/view) |
| ls-u-0063 | Passeur moriquendi | moriquendi | f/m ? | batelier, pecheur | Weathered Canal Ferryperson with Boat Hook [voir](https://drive.google.com/file/d/1ivRIbDDgq39AhHerRk1MEN4r5mptuD2v/view) | Pale Ferryperson at the Crystal-Lit Canal [voir](https://drive.google.com/file/d/1kNYIPThNzbB6I6zld1A25zcy_Kd5qKRI/view) |
| ls-u-0064 | Voyageur humain | humain | f/m ? | voyageur | Weathered Nordic Expeditioner Top-Down Token [voir](https://drive.google.com/file/d/1_hOh_gnVTlmXunjcuQpgdSrH2GZf5ujj/view) | — — |
| ls-u-0065 | Prêtresse moriquendi | moriquendi | f | clerc, pretre | White-braided priestess with ritual box [voir](https://drive.google.com/file/d/1xAnz69Q6r9wJUWU1fhOPVtYUhQBCRtw8/view) | Moriquendi Priestess Beneath Amethyst Lamps [voir](https://drive.google.com/file/d/1lXHnEaXJ_z0d5pOXOmjb244T7fBVR-IW/view) |
