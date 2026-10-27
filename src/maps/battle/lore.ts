/**
 * Explications en jeu des créatures, lues par les joueurs quand ils cliquent sur un jeton.
 * Ton de conteur : ce que l'on raconte dans les galeries, sans chiffres ni statistiques.
 */
export const CREATURE_LORE: Record<string, string> = {
  duergar: 'Les nains gris de Dhaal-Kuldrum ont grandi dans la chaleur des forges souterraines et détestent la lumière du soleil. Ils avancent en rang serré, boucliers levés, sans un mot.',
  drow: 'Les elfes noirs de la cité souterraine voient dans le noir mieux que n’importe qui. Ils tendent leurs embuscades sans bruit : une lueur dans l’obscurité, une seconde trop tard, et il est déjà trop tard.',
  svirfneblin: 'Gnomes des profondeurs, patients et discrets. Ils se fondent dans la roche et disparaissent avant que l’on ait eu le temps de les voir.',
  commoner: 'Un simple habitant des profondeurs, cramponné à sa vie de mineur ou de marchand. Il n’a rien à faire ici, et il le sait.',
  guard: 'Une sentinelle postée à l’entrée d’un passage. Son armure est usée, mais son regard reste vif : elle surveille ce qui monte des galeries d’en bas.',
  bandit: 'Un pillard des galeries, prêt à détrousser tout voyageur isolé. Il connaît les tunnels mieux que n’importe quel guide.',
  thug: 'Une brute payée pour faire peur. Dans les profondeurs, la force vaut mieux que la parole, et il le fait savoir.',
  scout: 'Un éclaireur discret, au regard perçant. Il repère les voyageurs bien avant qu’ils ne le voient.',
  veteran: 'Un vétéran des guerres souterraines, couvert de cicatrices. Il ne craint plus grand-chose, sauf ce qui rôde sous les pieds.',
  priest: 'Un prêtre qui prie des dieux que la surface a oubliés. Sa voix porte loin dans les grottes, et ses fidèles l’écoutent sans jamais poser de questions.',
  spy: 'Un espion qui vend les secrets des galeries au plus offrant. Il écoute toujours avant de parler, et il sait déjà ce que vous cachez.',
  'giant-lizard': 'Un lézard géant aux écailles grises, tapi dans les marécages souterrains. Il attend, immobile, qu’une proie s’approche trop près de l’eau.',
  'bat-swarm': 'Un nuage de chauves-souris qui tourbillonne sous la voûte. Un battement d’ailes, des cris aigus, et l’air se remplit de crocs.',
  'giant-centipede': 'Un mille-pattes de la taille d’un homme, aux pinces venimeuses. Il rampe dans les fissures et surgit sans prévenir.',
  'giant-spider': 'Une araignée géante qui tisse ses toiles entre les stalactites. Une fois prise dans le fil, la proie ne bouge plus.',
  'violet-fungus': 'Un champignon violet qui déploie ses tentacules dès qu’une proie approche. Sa couleur attire le regard, son contact brûle la peau.',
  shrieker: 'Un champignon qui pousse des cris stridents dès qu’il sent du mouvement. Il prévient toute la grotte de votre présence.',
  'gray-ooze': 'Une masse grise et gluante qui ronge le bois et la chair. Elle avance lentement, mais rien ne lui échappe.',
  grick: 'Une créature sans yeux, couverte de tentacules, qui rampe sur les parois. Elle surgit de la roche sans le moindre bruit.',
  darkmantle: 'Une créature qui se laisse tomber du plafond et enveloppe sa proie dans une cape noire. On ne voit rien, on n’entend rien, puis tout s’arrête.',
  'ochre-jelly': 'Une gelée ocre qui se glisse sous les portes et dissout tout sur son passage. Elle n’a ni yeux ni oreilles, seulement la faim.',
  'gelatinous-cube': 'Un cube translucide qui avance dans les galeries, emportant les restes de ses victimes. On distingue parfois des objets flotter en son cœur.',
  ghoul: 'Un mort-vivant affamé qui hante les cimetières souterrains. Son contact paralyse, et sa faim ne s’arrête jamais.',
  shadow: 'Une ombre sans corps qui glisse le long des murs. Elle prend la force de ceux qu’elle touche et murmure des prénoms oubliés.',
  otyugh: 'Une créature répugnante qui vit dans les ordures et les fosses. Elle se nourrit de tout ce qui pourrit, et de ce qui pourrira bientôt.',
  'umber-hulk': 'Un monstre qui creuse la roche comme du sable, et dont le regard vous paralyse. Une fois sorti de terre, il ne s’arrête plus.',
  roper: 'Une créature qui ressemble à un rocher jusqu’à ce qu’elle lance ses filaments. Les proies croient se reposer contre la pierre, et la pierre les attrape.',
};

export const KIND_LORE: Record<'pc' | 'monster' | 'other', string> = {
  pc: 'Un compagnon de l’expédition, dont les pas résonnent dans les galeries à vos côtés.',
  monster: 'Une créature des profondeurs. Elle vous a repérés.',
  other: 'Une présence dont on ne sait pas grand-chose, si ce n’est qu’elle se déplace.',
};
