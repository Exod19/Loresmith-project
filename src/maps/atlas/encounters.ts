/**
 * Rencontres aléatoires de l'Atlas (D&D 5e) : créatures, mais aussi convois, travailleurs, voyageurs et signes.
 * Chaque rencontre précise l'effectif (dés lancés), l'attitude, ce que veulent les rencontrés, une accroche,
 * et renvoie aux fiches de statistiques complètes (statblocks.ts).
 */
export type Zone = 'sauvage' | 'transit' | 'cite';
export type EncCtx = { zone: Zone; depth: number; place: string; assassins?: boolean };
type Group = { stat: string; dice: string; role?: string; label?: string };
export type Entry = {
  kind: 'Créature' | 'Convoi' | 'Travailleurs' | 'Voyageurs' | 'Patrouille' | 'Signe';
  title: string; text: string; groups?: Group[]; wants?: string[]; hook?: string;
  zones: Zone[]; min?: number; max?: number; weight?: number; peaceful?: boolean; assassins?: boolean;
};

const E: Entry[] = [
  /* ——— Convois et caravanes ——— */
  { kind: 'Convoi', title: 'Convoi duergar', zones: ['sauvage', 'transit'], weight: 3,
    text: 'Une file de lézards de bât chargés de lingots et de minerai avance au pas, encadrée de duergars en armure. Le contremaître exige qu’on s’écarte de la voie.',
    groups: [{ stat: 'duergar', dice: '1d4+2' }, { stat: 'giant-lizard', dice: '1d4', role: 'bêtes de bât' }, { stat: 'veteran', dice: '1', role: 'contremaître duergar' }],
    wants: ['passer sans perdre de temps', 'percevoir un péage (5 pa par tête)', 'acheter des vivres frais', 'recruter des bras pour un tronçon dangereux'],
    hook: 'Un des lézards boite : le contremaître paierait bien quelqu’un pour l’escorter jusqu’à la prochaine halte.' },
  { kind: 'Convoi', title: 'Caravane de marchands drows', zones: ['sauvage', 'transit'], weight: 2,
    text: 'Des palanquins voilés, des porteurs enchaînés et des gardes silencieux : une maison marchande drow se déplace avec sa marchandise et ses secrets.',
    groups: [{ stat: 'drow', dice: '1d4+1' }, { stat: 'guard', dice: '2', role: 'porteurs armés' }, { stat: 'priest', dice: '1', role: 'prêtresse de la maison' }],
    wants: ['commercer (soies d’araignée, poisons, champignons rares)', 'obtenir des nouvelles des maisons rivales', 'se débarrasser de témoins gênants'],
    hook: 'L’un des porteurs, un svirfnebelin, glisse un regard suppliant aux personnages.' },
  { kind: 'Convoi', title: 'Caravane bigarrée', zones: ['sauvage', 'transit'], weight: 2, peaceful: true,
    text: 'Des marchands de plusieurs peuples voyagent ensemble pour se protéger : on troque sel, champignons séchés, outils et nouvelles autour des lézards.',
    groups: [{ stat: 'commoner', dice: '2d4', role: 'marchands' }, { stat: 'guard', dice: '1d4', role: 'mercenaires' }, { stat: 'scout', dice: '1', role: 'guide' }],
    wants: ['commercer', 'partager un bivouac sûr', 'savoir si la route devant est praticable'] },

  /* ——— Travailleurs ——— */
  { kind: 'Travailleurs', title: 'Prospecteurs svirfnebelins', zones: ['sauvage', 'transit'], weight: 3, peaceful: true,
    text: 'Le tintement régulier de pics : une petite équipe de gnomes des profondeurs sonde une veine. Ils se figent et se fondent dans la roche à l’approche.',
    groups: [{ stat: 'svirfneblin', dice: '1d4+1' }],
    wants: ['qu’on les laisse travailler', 'échanger des gemmes contre des vivres', 'des renseignements sur une menace qui rôde près de leur filon'],
    hook: 'Leur filon a percé une poche ancienne : quelque chose y respire.' },
  { kind: 'Travailleurs', title: 'Équipe de mineurs sous contrainte', zones: ['sauvage', 'transit'], weight: 2,
    text: 'Des mineurs épuisés, de races diverses, creusent sous la surveillance de contremaîtres duergars. Les chaînes tintent à chaque coup de pioche.',
    groups: [{ stat: 'commoner', dice: '2d6', role: 'mineurs asservis' }, { stat: 'duergar', dice: '1d3', role: 'contremaîtres' }],
    wants: ['(contremaîtres) qu’on passe son chemin', '(mineurs) être libérés', '(contremaîtres) acheter de la main-d’œuvre'] },
  { kind: 'Travailleurs', title: 'Cueilleurs de champignons', zones: ['sauvage', 'transit', 'cite'], weight: 2, peaceful: true,
    text: 'Des cueilleurs aux paniers dorsaux grattent les parois humides ; ils connaissent chaque espèce, comestible ou mortelle.',
    groups: [{ stat: 'commoner', dice: '1d6+1', role: 'cueilleurs' }],
    wants: ['vendre des champignons', 'être escortés jusqu’à une colonie de spores éloignée', 'qu’on ne piétine pas leurs cultures'] },

  /* ——— Voyageurs et patrouilles ——— */
  { kind: 'Voyageurs', title: 'Réfugiés', zones: ['sauvage', 'transit'], weight: 2, peaceful: true,
    text: 'Une colonne de réfugiés fuit une cité tombée ; ils portent leurs enfants et ce qui leur reste. Leur guide surveille l’arrière avec inquiétude.',
    groups: [{ stat: 'commoner', dice: '2d6' }, { stat: 'scout', dice: '1', role: 'guide' }],
    wants: ['de l’eau et des soins', 'une escorte', 'des nouvelles de leurs proches'], hook: 'Ils sont suivis.' },
  { kind: 'Patrouille', title: 'Patrouille drow', zones: ['sauvage', 'transit'], min: 2, weight: 2,
    text: 'Des silhouettes glissent sans bruit le long de la voûte ; une patrouille drow traque quelqu’un — ou quelque chose.',
    groups: [{ stat: 'drow', dice: '1d4+2' }, { stat: 'veteran', dice: '1', role: 'capitaine drow' }],
    wants: ['retrouver un fugitif', 'imposer l’autorité de leur maison', 'capturer des esclaves'] },
  { kind: 'Patrouille', title: 'Pillards', zones: ['sauvage', 'transit'], weight: 2,
    text: 'Une bande de pillards a monté une embuscade dans une étroiture : une corde tendue, des arbalètes, un chef qui parle fort.',
    groups: [{ stat: 'bandit', dice: '1d6+2' }, { stat: 'thug', dice: '1', role: 'chef' }],
    wants: ['un péage forcé', 'les montures et l’équipement', 'des otages à rançonner'] },

  /* ——— Créatures ——— */
  { kind: 'Créature', title: 'Nuée de chauves-souris', zones: ['sauvage', 'transit'], max: 3, weight: 2,
    text: 'Un battement d’ailes enfle dans le noir : une colonie dérangée déferle dans la galerie.', groups: [{ stat: 'bat-swarm', dice: '1d3' }] },
  { kind: 'Créature', title: 'Mille-pattes géants', zones: ['sauvage', 'transit'], max: 3, weight: 2,
    text: 'Un cliquetis de pattes sous les éboulis : des mille-pattes géants sortent de leurs galeries.', groups: [{ stat: 'giant-centipede', dice: '1d4+1' }] },
  { kind: 'Créature', title: 'Toiles et araignées géantes', zones: ['sauvage', 'transit'], weight: 2,
    text: 'Les toiles barrent le passage comme des voiles ; au-dessus, quelque chose attend que les fils vibrent.', groups: [{ stat: 'giant-spider', dice: '1d3' }] },
  { kind: 'Créature', title: 'Jardin de champignons violets', zones: ['sauvage', 'transit'], max: 4, weight: 2,
    text: 'Un bosquet de champignons pâles ; certains sont des criards, d’autres des champignons violets aux filaments avides.',
    groups: [{ stat: 'violet-fungus', dice: '1d4' }, { stat: 'shrieker', dice: '1d4' }] },
  { kind: 'Créature', title: 'Vase grise', zones: ['sauvage', 'transit'], max: 4, weight: 1,
    text: 'Une flaque huileuse au milieu du passage… qui se met à couler vers le groupe.', groups: [{ stat: 'gray-ooze', dice: '1d2' }] },
  { kind: 'Créature', title: 'Gricks', zones: ['sauvage', 'transit'], min: 2, weight: 2,
    text: 'Des formes tubulaires se détachent de la paroi, tentacules ouverts comme des fleurs.', groups: [{ stat: 'grick', dice: '1d2' }] },
  { kind: 'Créature', title: 'Manteaux noirs', zones: ['sauvage', 'transit'], weight: 2,
    text: 'Les stalactites du plafond se décrochent une à une : des manteaux noirs plongent sur les têtes.', groups: [{ stat: 'darkmantle', dice: '1d4' }] },
  { kind: 'Créature', title: 'Gelée ocre', zones: ['sauvage', 'transit'], min: 2, weight: 1,
    text: 'Une masse jaunâtre rampe au plafond ; elle se laisse tomber sur la première source de chaleur.', groups: [{ stat: 'ochre-jelly', dice: '1' }] },
  { kind: 'Créature', title: 'Cube gélatineux', zones: ['sauvage', 'transit'], min: 2, weight: 1,
    text: 'La galerie est étrangement propre ; des os et une boucle de ceinture flottent dans l’air, à hauteur d’homme.', groups: [{ stat: 'gelatinous-cube', dice: '1' }] },
  { kind: 'Créature', title: 'Goules', zones: ['sauvage', 'transit'], min: 2, weight: 2,
    text: 'Une odeur de charnier : des goules se disputent un cadavre de voyageur et lèvent la tête.', groups: [{ stat: 'ghoul', dice: '1d4+1' }] },
  { kind: 'Créature', title: 'Ombres', zones: ['sauvage', 'transit'], min: 3, weight: 1,
    text: 'Les ombres portées des personnages s’allongent… puis d’autres s’en détachent.', groups: [{ stat: 'shadow', dice: '1d3' }] },
  { kind: 'Créature', title: 'Otyugh', zones: ['sauvage', 'transit', 'cite'], min: 3, weight: 1,
    text: 'Un dépotoir de déchets et d’ossements ; un œil sur tige émerge de la fange.', groups: [{ stat: 'otyugh', dice: '1' }] },
  { kind: 'Créature', title: 'Mastodonte des ténèbres', zones: ['sauvage', 'transit'], min: 4, weight: 1,
    text: 'La paroi tremble, puis éclate : un mastodonte des ténèbres surgit de la roche, ses yeux multiples cherchant des proies.', groups: [{ stat: 'umber-hulk', dice: '1' }] },
  { kind: 'Créature', title: 'Enlaceur', zones: ['sauvage', 'transit'], min: 4, weight: 1,
    text: 'Une stalagmite isolée au milieu de la salle ; des fils gluants pendent autour, presque invisibles.', groups: [{ stat: 'roper', dice: '1' }] },

  /* ——— Cités ——— */
  { kind: 'Patrouille', title: 'Patrouille de la garde', zones: ['cite'], weight: 3,
    text: 'Une patrouille fait sa ronde et contrôle les étrangers : laissez-passer, armes, raison de la visite.',
    groups: [{ stat: 'guard', dice: '1d4+2' }, { stat: 'veteran', dice: '1', role: 'sergent' }], wants: ['contrôler', 'un pot-de-vin', 'des informations sur un fugitif'] },
  { kind: 'Voyageurs', title: 'Marchand ambulant', zones: ['cite'], weight: 2, peaceful: true,
    text: 'Un marchand pousse un étal roulant, escorté d’un garde las ; il vend de tout, et surtout des rumeurs.',
    groups: [{ stat: 'commoner', dice: '1', role: 'marchand' }, { stat: 'guard', dice: '1' }], wants: ['vendre', 'acheter du rare', 'trouver un porteur discret'] },
  { kind: 'Patrouille', title: 'Coupe-bourses', zones: ['cite'], weight: 2,
    text: 'Une bousculade dans la foule : quelqu’un vient de délester un personnage (Perception passive contre Escamotage +4).',
    groups: [{ stat: 'bandit', dice: '1d3' }, { stat: 'spy', dice: '1', role: 'meneur' }], wants: ['la bourse', 'filer sans combat'] },
  { kind: 'Voyageurs', title: 'Procession religieuse', zones: ['cite'], weight: 1, peaceful: true,
    text: 'Chants graves et encens : une procession traverse la place ; il est malvenu de lui couper la route.',
    groups: [{ stat: 'priest', dice: '1' }, { stat: 'commoner', dice: '2d6', role: 'fidèles' }, { stat: 'guard', dice: '2' }], wants: ['le respect du rite', 'des offrandes'] },
  { kind: 'Travailleurs', title: 'Ouvriers d’une autre race', zones: ['cite'], weight: 2, peaceful: true,
    text: 'Une équipe d’ouvriers étrangers à la cité répare un pont ou une façade ; ils parlent une autre langue et observent les passants.',
    groups: [{ stat: 'commoner', dice: '1d6+2', role: 'ouvriers' }, { stat: 'guard', dice: '1', role: 'surveillant' }], wants: ['finir leur journée', 'un renseignement sur un parent disparu', 'vendre un objet trouvé dans les gravats'] },
  { kind: 'Patrouille', title: 'Assassins en mission', zones: ['cite'], assassins: true, weight: 3,
    text: 'Deux silhouettes vous dépassent d’un pas trop régulier ; un signe discret s’échange avec un guetteur sur un toit.',
    groups: [{ stat: 'spy', dice: '1d3' }, { stat: 'thug', dice: '1d2', role: 'hommes de main' }], wants: ['une cible qui n’est peut-être pas vous', 'qu’on ne les ait pas remarqués', 'recruter un étranger pour un contrat'] },

  /* ——— Signes (sans combat) ——— */
  { kind: 'Signe', title: 'Traces fraîches', zones: ['sauvage', 'transit'], weight: 2, peaceful: true,
    text: 'Des empreintes profondes et des griffures fraîches sur la paroi : une grande créature est passée il y a moins d’une heure. Sagesse (Survie) DD 13 pour l’identifier ; échec : le groupe la croit plus loin qu’elle n’est.' },
  { kind: 'Signe', title: 'Cadavre de voyageur', zones: ['sauvage', 'transit'], weight: 2, peaceful: true,
    text: 'Un voyageur mort depuis peu, sac éventré. Sagesse (Médecine) DD 12 : cause de la mort (poison, griffes, chute). Fouille (Investigation DD 12) : 2d10 pa et une carte griffonnée ; échec : on ne trouve que des vivres gâtés.' },
  { kind: 'Signe', title: 'Grondement lointain', zones: ['sauvage', 'transit'], weight: 1, peaceful: true,
    text: 'Un éboulement au loin ; la poussière arrive par vagues. La voie la plus courte est peut-être obstruée (1 sur 1d4).' },
  { kind: 'Signe', title: 'Lueur mouvante', zones: ['sauvage', 'transit'], weight: 1, peaceful: true,
    text: 'Une lueur violette se déplace au loin puis s’éteint : voyageurs, feu follet ou piège ? Discrétion de groupe DD 13 pour s’approcher sans être vus ; échec : la lueur s’éteint et ne revient pas.' },
];

const ATT = [
  [2, 'Hostile : attaque ou rançonne sans négocier.'], [5, 'Méfiant : armes au clair, exige que le groupe s’explique.'],
  [9, 'Neutre : prudent, prêt à discuter ou à commercer.'], [12, 'Bien disposé : partage nouvelles et bivouac.'],
] as const;

const rnd = (n: number) => 1 + Math.floor(Math.random() * n);
export function roll(dice: string): { total: number; detail: string } {
  const m = dice.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return { total: +dice, detail: dice };
  const rolls = Array.from({ length: +m[1] }, () => rnd(+m[2])); const bonus = +(m[3] ?? 0);
  const total = Math.max(1, rolls.reduce((a, b) => a + b, 0) + bonus);
  return { total, detail: `${dice} → [${rolls.join(', ')}]${bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : ''} = ${total}` };
}

export type Encounter = {
  d20: number; check: string; happens: boolean; entry?: Entry; attitude?: string; wants?: string;
  groups?: { stat: string; role?: string; label?: string; n: number; detail: string }[];
};

/** Tire une rencontre : d20 de déclenchement (≥ 15, ou ≥ 13 dans les profondeurs et les entre-strates), puis table pondérée. */
/** Rencontres supplémentaires (Bestiaire des Archives), ajoutées au tirage. */
let POOL: Entry[] = E;
export function setBestiary(list: Entry[]) { POOL = [...E, ...list]; }

export function rollEncounter(ctx: EncCtx, force = false): Encounter {
  const threshold = ctx.zone === 'cite' ? 14 : ctx.depth >= 4 || ctx.zone === 'transit' ? 13 : 15;
  const d20 = rnd(20); const happens = force || d20 >= threshold;
  const check = force ? 'Rencontre imposée par le MJ' : `1d20 = ${d20} (rencontre sur ${threshold} ou plus)`;
  if (!happens) return { d20, check, happens };
  const pool = POOL.filter((e) => e.zones.includes(ctx.zone) && (e.min ?? 1) <= ctx.depth && ctx.depth <= (e.max ?? 9) && (!e.assassins || ctx.assassins));
  const sum = pool.reduce((a, e) => a + (e.weight ?? 1), 0); let r = Math.random() * sum; let entry = pool[0];
  for (const e of pool) { r -= e.weight ?? 1; if (r <= 0) { entry = e; break; } }
  const r2 = roll('2d6'); const att = entry.kind === 'Signe' ? undefined
    : `2d6 = ${r2.total} → ${(entry.kind === 'Créature' ? 'Hostile ou affamée : elle attaque si elle a l’avantage, sinon elle guette.' : ATT.find(([n]) => r2.total <= n)?.[1] ?? 'Amical : propose son aide ou un échange avantageux.')}`;
  const attitude = att && entry.peaceful && r2.total <= 2 ? `2d6 = ${r2.total} → Méfiant : ils ont été attaqués récemment et tirent à vue si on les surprend.` : att;
  return { d20, check, happens, entry, attitude, wants: entry.wants?.[Math.floor(Math.random() * entry.wants.length)],
    groups: entry.groups?.map((g) => { const r = roll(g.dice); return { stat: g.stat, role: g.role, label: g.label, n: r.total, detail: r.detail }; }) };
}
