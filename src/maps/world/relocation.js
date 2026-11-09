/**
 * Après un incendie ou une destruction, la vie continue ailleurs : la prêtresse célèbre les offices en plein air sur la
 * place, le tavernier sert sous une tente, le forgeron monte une forge de campagne… jusqu'à la reconstruction, où chacun
 * revient. Le lieu provisoire est un bâtiment du même genre s'il y en a un autre dans la cité (un second temple les
 * accueille), sinon la place du marché, sinon les abords des ruines.
 *
 * JavaScript pur, testé par relocation.test.mjs.
 */
import { atPlace } from './consequences.js';

/** Qui vit là quand on ne connaît pas encore les habitants (intérieur jamais visité). */
const ROLE = {
  temple: 'le prêtre et les fidèles', taverne: 'le tavernier', auberge: 'l’aubergiste et ses gens', forge: 'le forgeron',
  echoppe: 'le marchand', atelier: 'l’artisan', maison: 'la famille', ferme: 'les fermiers', manoir: 'les maîtres de maison et leurs domestiques',
  guilde: 'les membres de la guilde', caserne: 'la garnison', ecurie: 'le palefrenier', entrepot: 'le propriétaire', chateau: 'la maisonnée',
};

/** Ce que devient l'activité, et le nom du lieu provisoire. */
const TEMP = {
  temple: { label: 'Office en plein air', host: 'accueille aussi les fidèles du temple incendié', text: (who, at, pl) => `${who} ${pl ? 'célèbrent' : 'célèbre'} désormais les offices ${at}, sous un dais de toile ; les fidèles apportent bancs, cierges et offrandes.` },
  taverne: { label: 'Comptoir sous la tente', host: 'sert aussi les habitués de la taverne détruite', text: (who, at) => `${who} sert à boire ${at}, sous une tente, sur des tonneaux en guise de comptoir.` },
  auberge: { label: 'Voyageurs logés chez l’habitant', host: 'loge aussi les voyageurs de l’auberge détruite', text: (who, at) => `${who} place les voyageurs chez l’habitant et tient ses comptes ${at}.` },
  forge: { label: 'Forge de campagne', host: 'prête son enclume au forgeron sinistré', text: (who, at) => `${who} a monté une forge de campagne ${at} : un soufflet, une enclume sur une souche.` },
  echoppe: { label: 'Étal de fortune', host: 'fait place à l’étal du marchand sinistré', text: (who, at) => `${who} vend ce qu’il a sauvé sur un étal ${at}.` },
  atelier: { label: 'Atelier de fortune', host: 'prête un coin d’atelier', text: (who, at) => `${who} travaille ${at}, avec les outils qu’il a pu sauver.` },
  caserne: { label: 'Poste de garde provisoire', host: 'accueille la garnison', text: (who, at) => `${who} a installé un poste provisoire ${at}.` },
};
const DEFAULT = { label: 'Sinistrés relogés', host: 'héberge des sinistrés', text: (who, at, pl) => `${who} ${pl ? 'sont hébergés' : 'est hébergé'} ${at}, en attendant la reconstruction.` };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/**
 * Relogement des occupants d'un bâtiment sinistré.
 * `b` : { id, title, type } ; `etat` : état du lieu ; `residents` : noms connus ; `city` : { sameType: [{ id, title }],
 * market?: { id, title } }. Renvoie null si personne n'est délogé, sinon { to: { id, title } | null, label, text, who }.
 */
export function relocationOf(b, etat, residents = [], city = {}) {
  if (etat !== 'ruine' && etat !== 'chantier') return null;
  const t = TEMP[b.type] ?? DEFAULT;
  // Le premier habitant porte la phrase (accord au singulier) ; les autres le suivent.
  const who = residents.length ? residents[0] : ROLE[b.type] ?? 'les occupants';
  const along = residents.length > 1 ? ` À ses côtés : ${residents.slice(1, 4).join(', ')}${residents.length > 4 ? '…' : ''}.` : '';
  const others = (city.sameType ?? []).filter((x) => x.id !== b.id);
  const host = others.length ? others[hash(b.id) % others.length] : null;
  const to = host ?? city.market ?? null;
  const pl = / et |^les /.test(who);
  if (host) {
    // Accueillis sous un autre toit du même genre : la phrase dit qui les reçoit.
    const at = atPlace(host.title), adj = /^à la /.test(at) ? ' voisine' : /^au /.test(at) ? ' voisin' : '';
    return { to, label: `${t.label} (${b.title})`, who, text: `${cap(who)} ${pl ? 'ont' : 'a'} trouvé refuge ${at}${adj}, qui ${t.host}.${along}`, host: true };
  }
  const at = city.market ? `sur ${city.market.title.replace(/^Place/, 'la place')}` : 'devant les ruines';
  return { to, label: t.label, who, text: cap(t.text(cap(who), at, pl)) + along, host: false };
}

/** Retour après la reconstruction (pour la mémoire du monde et le MJ). */
export function returnOf(b, residents = []) {
  const who = residents.length ? residents.join(' et ') : ROLE[b.type] ?? 'les occupants';
  return `${cap(who)} ${/ et |^les /.test(who) ? 'ont' : 'a'} réintégré ${b.title} reconstruit.`;
}
