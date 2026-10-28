/**
 * Rencontres tirées du Bestiaire des Archives (créatures du fichier publié).
 *
 * Première passe, à partir des paramètres et du texte descriptif de chaque fiche :
 *  - zone : « cite » si la fiche décrit un lieu habité ou urbain, « transit » si elle décrit des galeries,
 *    fissures ou conduits, « sauvage » pour les cavités ouvertes, lacs et forêts ;
 *  - profondeur : les fiches qui décrivent les abysses ou l'obscurité totale vont vers les niveaux profonds ;
 *  - effectif : solitaire → 1 ; colonies et agrégations → 2d4 ;
 *  - attitude : menace « inoffensif » → non hostile, poids plus faible ; menace inconnue → non utilisée.
 *  - seules les créatures tirent une rencontre : les fongus restent dans les Archives.
 * Les corrections manuelles sont listées dans OVERRIDES et doivent être relues par le MJ.
 */
import type { FeedEntry } from './underdark';
import { sentienceOf } from './fauna';

type Zone = 'sauvage' | 'transit' | 'cite';

export interface BestiaryEncounter {
  kind: 'Créature';
  title: string;
  text: string;
  groups: { stat: string; label: string; dice: string; role?: string }[];
  wants: string[];
  hook?: string;
  zones: Zone[];
  min: number;
  max: number;
  weight: number;
  peaceful: boolean;
  /** Identifiant de la fiche des Archives. */
  source: string;
  /** Faune : ne parle pas, réagit par instinct (voir fauna.ts). */
  faune: boolean;
  /** Peut parler et négocier. */
  talks: boolean;
  /** Libellé de statut affiché au MJ. */
  statut: string;
}

/** Corrections manuelles : zones, profondeurs ou effectifs pour une fiche précise. */
const OVERRIDES: Record<string, Partial<Pick<BestiaryEncounter, 'zones' | 'min' | 'max' | 'weight' | 'groups'>>> = {};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CITY = /urbain|cite|compost|atelier|charnier|depotoir|voies? de passage|quartier|egout|champ de bataille|litieres?/;
const CORRIDOR = /galerie|tunnel|conduit|fissure|faille|crevasse|etroit|passage|paroi|veine|micro-gouffre|porte|gond|herse|charniere/;
const DEEP = /profond|obscurite|abysse|tenebre|noye|gouffre|absolue/;
const SHALLOW = /cite|urbain|proches? des cites|surface|lisieres?/;
const COLONY = /colon|agregation|denses?|groupe|meute|nombreux|amas|reunis|synchronisation/;

function zonesOf(text: string): Zone[] {
  const z: Zone[] = [];
  if (CITY.test(text)) z.push('cite');
  if (CORRIDOR.test(text)) z.push('transit');
  if (!z.length || /cavite|lac|foret|mare|bassin|gour|clairiere|ouvert/.test(text)) z.push('sauvage');
  return z;
}

export function bestiaryEncounters(entries: FeedEntry[]): BestiaryEncounter[] {
  const out: BestiaryEncounter[] = [];
  for (const e of entries) {
    // Seules les créatures sont des monstres : les fongus (levures, colonies) restent du lore, pas des rencontres.
    if (e.type !== 'creature') continue;
    if (e.threat === 'inconnu' || !e.threat) continue; // menace non documentée : pas de rencontre
    const params = Object.fromEntries(e.params.filter((p) => p.value).map((p) => [p.label, p.value]));
    const habitat = params['Habitat principal'] ?? '';
    const social = norm(params['Type social'] ?? '');
    const text = norm(`${habitat} ${e.summary}`);
    const solitary = /solitaire/.test(social) && !COLONY.test(social);
    const colony = COLONY.test(social) || COLONY.test(text);
    const dice = solitary ? '1' : colony ? '2d4' : '1d3';
    const deep = DEEP.test(text), shallow = SHALLOW.test(text) && !deep;
    const nature = sentienceOf(e);
    const enc: BestiaryEncounter = {
      kind: 'Créature',
      title: e.name,
      text: e.summary,
      groups: [{ stat: e.id, label: e.name, dice }],
      wants: (e.statBlock?.gmBehavior ?? []).slice(0, 3),
      hook: habitat ? `Habitat : ${habitat}.` : undefined,
      zones: zonesOf(text),
      min: shallow ? 1 : deep ? 5 : 3,
      max: shallow ? 4 : deep ? 9 : 7,
      weight: e.threat === 'inoffensif' ? 1 : 2,
      peaceful: e.threat === 'inoffensif',
      source: e.id,
      faune: nature?.status !== 'sentient',
      talks: nature?.canSpeak ?? false,
      statut: nature?.label ?? '',
      ...OVERRIDES[e.id],
    };
    out.push(enc);
  }
  return out;
}
