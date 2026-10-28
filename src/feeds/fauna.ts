/**
 * Classification de la faune : ce qu'une créature peut faire en jeu, en particulier parler et négocier.
 *
 * Ordre de décision (le premier qui s'applique gagne) :
 *  1. surcharge du MJ (OVERRIDES, ci-dessous) ;
 *  2. le statut inscrit dans la fiche des Archives (`sentience` : « sentient » ou « non-sentient ») ;
 *  3. pour le Bestiaire sans statut : « faune » par défaut, sauf si le texte évoque une conscience ou une parole.
 *     Ce dernier cas devient « à trancher » : la créature ne parle pas tant que le MJ n'a pas décidé.
 *
 * Statuts :
 *  - faune     : ne parle pas, ne négocie pas, réagit par instinct (fuite, défense, chasse, faim).
 *  - sentient  : peut parler et négocier.
 *  - inconnu   : « à trancher » ; traitée comme faune tant que le MJ ne tranche pas.
 */
import type { FeedEntry } from './underdark';

export type Sentience = 'sentient' | 'faune' | 'inconnu';

export interface Classification {
  status: Sentience;
  /** Ce qui a décidé : la fiche, le Bestiaire par défaut, le texte, ou une surcharge du MJ. */
  source: 'surcharge' | 'fiche' | 'bestiaire' | 'texte' | 'type';
  /** Peut prendre la parole en jeu. */
  canSpeak: boolean;
  label: string;
  detail: string;
}

/**
 * Surcharges du MJ, par identifiant de fiche : « faune », « sentient » ou « inconnu ».
 * Elles l'emportent sur tout le reste. Exemple : { 'cr-chuchoteur': 'sentient' }.
 */
export const OVERRIDES: Record<string, Sentience> = {
  // Décisions du MJ : faune, sans sentience.
  'tome-animalia-panthere-des-flux': 'faune',
  'tome-animalia-orbweaver-cavernicole': 'faune',
  'tome-animalia-orbweaver-des-tenebres': 'faune',
  'tome-animalia-trappeuse-des-ombres': 'faune',
  'tome-animalia-tarentule-cavernicole': 'faune',
  'tome-animalia-tarentule-dobsidienne': 'faune',
  'tome-annelida-ver-chuchoteur-chuchoteur-regent': 'faune',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Mots qui suggèrent une conscience ou une parole. « Langage » et « communication » n'y figurent pas : les animaux communiquent. */
const MENTAL = /\bsentient\w*|\bconscien\w*|\bparl(e|ent|er|ait)\b/;

const LABEL: Record<Sentience, string> = { faune: 'Faune · ne parle pas', sentient: 'Sentient · peut parler', inconnu: 'Statut à trancher' };
const DETAIL: Record<Sentience, string> = {
  faune: 'Animal ou organisme : pas de dialogue, pas de négociation. Réagit par instinct : fuite, défense de son territoire, chasse, faim.',
  sentient: 'Peut parler, négocier et mentir. Ses réactions suivent son intérêt, pas seulement son instinct.',
  inconnu: 'Les Archives laissent la question ouverte. Traitée comme faune jusqu’à décision du MJ.',
};

/** Statut et possibilités d'une fiche. `null` pour les fiches qui ne sont pas des êtres vivants (lieux, concepts…). */
export function sentienceOf(e: FeedEntry): Classification | null {
  const make = (status: Sentience, source: Classification['source']): Classification => ({
    status, source, canSpeak: status === 'sentient', label: LABEL[status], detail: DETAIL[status],
  });
  if (OVERRIDES[e.id]) return make(OVERRIDES[e.id], 'surcharge');
  if (e.sentience === 'sentient') return make('sentient', 'fiche');
  if (e.sentience === 'non-sentient') return make('faune', 'fiche');
  if (e.type === 'creature' || e.type === 'fungus') {
    const text = norm(`${e.summary} ${e.sections.map((s) => s.body).join(' ')}`);
    return MENTAL.test(text) ? make('inconnu', 'texte') : make('faune', 'bestiaire');
  }
  if (e.type === 'peuple' || e.type === 'personnage' || e.type === 'divinite') return make('sentient', 'type');
  return null;
}

/** Règle à donner à toute génération de répliques : la faune ne parle pas. */
export const FAUNA_RULE = 'Les créatures de faune (animaux, organismes sans conscience) ne parlent pas : ne leur attribue jamais de réplique, de nom de locuteur ni de voix. Elles réagissent par instinct, décrites par leurs actions et leurs sons.';

const key = (s: string) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();

/** Noms des créatures que les Archives classent comme faune (ou à trancher) : elles ne parlent pas. */
export function faunaNames(entries: FeedEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const c = sentienceOf(e);
    if (c && c.status !== 'sentient' && (e.type === 'creature' || e.type === 'fungus')) out.add(key(e.name));
  }
  return out;
}

/**
 * Garde de parole pour un nom de locuteur. Le statut propre au PNJ (sentience) l'emporte ; à défaut,
 * le nom est comparé aux créatures de faune des Archives. Un nom inconnu parle.
 */
export function speaksByName(name: string, fauna: Set<string>, npc?: { sentience?: string } | null): boolean {
  if (npc?.sentience === 'sentient') return true;
  if (npc?.sentience === 'faune' || npc?.sentience === 'inconnu') return false;
  return !fauna.has(key(name));
}
