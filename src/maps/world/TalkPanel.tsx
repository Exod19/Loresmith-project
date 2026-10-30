/**
 * Conversation du personnage du MJ avec un PNJ (mode Exploration). L'IA joue le PNJ d'après sa fiche, son lieu, le
 * lore, la saison et le climat ; elle propose parfois du lore que le MJ accepte (fiche créée ou complétée) ou rejette.
 *  - Rêverie : rien n'est gardé, sauf le lore accepté.
 *  - Chronique : à la fin, la conversation entre dans la mémoire de l'univers (ce qui s'est passé en jeu).
 */
import { useEffect, useRef, useState } from 'react';
import { aiReady, askAI } from '../../ai/client';
import type { AtlasData, AtlasFeature } from '../atlas/types';
import type { MapRecord } from '../mapStore';
import { SLOT_TYPES } from './generate';
import type { LoreEntry } from './lore';
import { PROPOSAL_TYPES, chronicleOf, npcSystemPrompt, npcUserPrompt, parseNpcReply, type Proposal, type TalkLine } from './talk';
import type { World } from './index';
import { canSpeak, creatureVoice } from './speech';
import { npcBankImage } from '../../banque/place';

type Props = {
  rec: MapRecord;
  data: AtlasData;
  planId: string;
  npc: AtlasFeature;
  library: LoreEntry[];
  /** Contexte de l'univers (canon, bibliothèque…), orienté par un texte de recherche. */
  loreContext?: (focus: string) => string;
  onCreateEntry?: (entry: Record<string, unknown> & { id: string; title: string }) => void;
  onUpdateEntry?: (id: string, patch: Record<string, unknown>) => void;
  onChronicle?: (memory: { title: string; summary: string }) => void;
  onClose: () => void;
  /** Créature (rencontre) : son bloc de statistiques (langues, intelligence) et où on la croise. */
  creature?: { stat: { languages?: string; abil?: number[]; meta?: string }; place?: string };
  /** Montrer la conversation sur l'écran des joueurs (`null` : la retirer). */
  onShare?: (talk: { key: string; name: string; image?: string; lines: { who: string; text: string }[]; at: number } | null) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const text = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).join(' ') : v && typeof v === 'object' ? Object.values(v as object).map(text).join(' ') : '');

export default function TalkPanel({ rec, data, planId, npc, library, loreContext, onCreateEntry, onUpdateEntry, onChronicle, onClose, creature, onShare }: Props) {
  const world = (rec.world ?? { cities: [], bindings: {} }) as World;
  // Hors de la carte du monde (Atlas des profondeurs…), c'est le groupe qui parle.
  const avatar = world.avatar ?? { name: rec.world ? '' : 'Le groupe', mode: 'reverie' as const };
  const [shared, setShared] = useState(false);
  // Le panneau se ferme (autre lieu, autre onglet) : la conversation quitte l'écran des joueurs.
  const sharedRef = useRef(false);
  sharedRef.current = shared;
  const shareRef = useRef(onShare);
  shareRef.current = onShare;
  useEffect(() => () => { if (sharedRef.current) shareRef.current?.(null); }, []);
  const shareKey = useRef(`${npc.id}:${Date.now()}`);
  // Visage du PNJ : le sien, sinon un portrait de la Banque Loresmith cohérent avec la cité (jamais pour une créature).
  const face = npc.image ?? (creature ? undefined : npcBankImage(rec, planId, library, npc, 'portrait', 256));
  const share = (lines: TalkLine[], on = shared) => {
    if (!onShare || !on) return;
    onShare({ key: shareKey.current, name: npc.title, image: face, at: Date.now(), lines: lines.slice(-6).map((m) => ({ who: m.from === 'avatar' ? avatar.name || 'Le groupe' : npc.title, text: m.text })) });
  };
  const mode = avatar.mode === 'chronique' ? 'chronique' : 'reverie';
  const [history, setHistory] = useState<TalkLine[]>([]);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<(Proposal & { id: string; state?: 'ok' | 'non' })[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Où sommes-nous ? Le bâtiment (plan intérieur), sa cité, son climat ; le lieu du lore posé dessus.
  const slotId = /^(.*:b\d+):int(?::(?:e1|cave))?$/.exec(planId)?.[1];
  const building = slotId ? data.features.find((f) => f.id === slotId) : undefined;
  const binding = slotId ? Object.values(world.bindings ?? {}).find((b) => b.slotId === slotId && !b.excluded) : undefined;
  const prefix = `map-${rec.id}-c-`;
  const cityPlan = planId.startsWith(prefix) ? `${prefix}${planId.slice(prefix.length).split(':')[0]}` : undefined;
  const cityMap = data.maps.find((m) => m.id === cityPlan);
  const citySpec = world.cities.find((c) => `${prefix}${c.id}` === cityPlan);
  const subtitle = (npc.subtitle ?? '').trim();
  const entry = library.find((e) => e.id === npc.entryId);
  const fiche = entry ? text([entry.subtitle, entry.shortSummary, entry.body, entry.sections]).slice(0, 2400) : '';
  const place = building ? { title: building.title, type: binding ? SLOT_TYPES[binding.type]?.label : building.subtitle, summary: building.summary } : creature?.place ? { title: creature.place } : undefined;
  const city = cityMap ? { name: cityMap.title, population: citySpec?.population } : undefined;
  const ctx = { season: world.season, climate: cityMap?.surface?.climate, time: world.time ?? 'jour' };

  const send = async () => {
    const msg = said.trim();
    if (!msg || busy) return;
    setBusy(true); setError(null);
    const next: TalkLine[] = [...history, { from: 'avatar', text: msg }];
    setHistory(next); setSaid('');
    try {
      const lore = loreContext?.([npc.title, subtitle, place?.title, city?.name, msg].filter(Boolean).join(' ')) ?? '';
      const system = npcSystemPrompt({ npc: { name: npc.title, role: subtitle, summary: npc.summary }, fiche: [fiche, creature ? creatureVoice(creature.stat, canSpeak(creature.stat)) : ''].filter(Boolean).join('\n\n'), place, city, ctx, avatar, mode, lore });
      const reply = parseNpcReply(await askAI(system, npcUserPrompt(history, msg, avatar.name || 'Le voyageur', npc.title)));
      setHistory([...next, { from: 'npc', text: reply.say }]);
      share([...next, { from: 'npc', text: reply.say }]);
      if (reply.proposals.length) setProposals((p) => [...p, ...reply.proposals.map((x) => ({ ...x, id: uid() }))]);
      requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHistory(history);
      setSaid(msg);
    } finally { setBusy(false); }
  };

  /** Accepter : un lieu ou un PNJ devient une fiche ; une rumeur aussi ; un fait complète la fiche du PNJ (ou du lieu). */
  const accept = (p: Proposal & { id: string }) => {
    const now = Date.now();
    const where = city?.name ?? '';
    const learned = `Appris en conversation (${avatar.name || 'personnage du MJ'} et ${npc.title}) : ${p.title}. ${p.text}`;
    if (p.type === 'fait' && (entry || binding?.entryId) && onUpdateEntry) {
      const target = entry ?? library.find((e) => e.id === binding?.entryId);
      if (target) onUpdateEntry(target.id, { body: [typeof target.body === 'string' ? target.body : '', learned].filter(Boolean).join('\n\n') });
    } else {
      onCreateEntry?.({
        id: uid(), archiveType: p.type === 'lieu' ? 'place' : p.type === 'pnj' ? 'person' : 'mystery', title: p.title, shortSummary: p.text,
        body: learned, currentLocation: where, tags: ['conversation'], createdAt: now, updatedAt: now,
      });
    }
    setProposals((ps) => ps.map((x) => (x.id === p.id ? { ...x, state: 'ok' } : x)));
  };
  const reject = (id: string) => setProposals((ps) => ps.map((x) => (x.id === id ? { ...x, state: 'non' } : x)));

  const close = () => {
    if (shared) onShare?.(null);
    if (mode === 'chronique' && history.length && onChronicle) {
      onChronicle(chronicleOf({ avatar, npc: { name: npc.title, role: subtitle }, place, city, ctx, history, accepted: proposals.filter((p) => p.state === 'ok') }));
    }
    onClose();
  };

  return (
    <div className="talk-card">
      <div className="talk-head">
        <h5>{face ? <img className="talk-face" src={face} alt="" /> : '💬 '}{npc.title}{subtitle ? <small> · {subtitle}</small> : null}</h5>
        <button className="maps-btn" onClick={close} title={mode === 'chronique' ? 'Clore : la conversation entre dans la mémoire de l’univers' : 'Clore : rien n’est gardé, sauf le lore accepté'}>Clore</button>
      </div>
      <p className="maps-sub">{mode === 'chronique' ? '📜 Chronique : cette conversation sera gardée dans la mémoire de l’univers.' : '💭 Rêverie : rien n’est gardé, sauf le lore que tu acceptes.'}</p>
      {onShare && (
        <label className="maps-row" title="La conversation s’affiche sur l’écran des joueurs, réplique après réplique">
          <input type="checkbox" checked={shared} onChange={(e) => { setShared(e.target.checked); if (e.target.checked) share(history, true); else onShare(null); }} /> 📺 Montrer aux joueurs
        </label>
      )}
      {!aiReady() && <p className="world-warn">Configure l’IA dans Réglages (clé API) pour parler aux PNJ.</p>}
      <div className="talk-log" ref={logRef} aria-live="polite">
        {npc.summary && /^« /.test(npc.summary) && <div className="talk-line npc"><b>{npc.title}</b> {npc.summary.match(/^« ([^»]+) »/)?.[1]}</div>}
        {history.map((m, i) => (
          <div key={i} className={`talk-line ${m.from}`}><b>{m.from === 'avatar' ? avatar.name || 'Toi' : npc.title}</b> {m.text}</div>
        ))}
        {busy && <div className="talk-line npc is-busy">{npc.title} réfléchit…</div>}
      </div>
      {error && <p className="world-warn">{error}</p>}
      <form className="talk-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea className="maps-btn" rows={2} value={said} disabled={!aiReady()} placeholder={`Que dis-tu à ${npc.title} ?`}
          onChange={(e) => setSaid(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <button className="maps-btn gold" type="submit" disabled={busy || !said.trim() || !aiReady()}>Dire</button>
      </form>
      {proposals.length > 0 && (
        <div className="talk-props">
          <h5>Lore proposé</h5>
          {proposals.map((p) => (
            <div key={p.id} className={`talk-prop${p.state ? ` is-${p.state}` : ''}`}>
              <div><b>{PROPOSAL_TYPES[p.type]} · {p.title}</b> — {p.text}</div>
              {!p.state ? (
                <div className="maps-actions">
                  <button className="maps-btn" onClick={() => accept(p)} title={p.type === 'fait' ? 'Ajouter à la fiche du PNJ (ou du lieu)' : 'Créer la fiche dans la Bibliothèque'}>✓ Accepter</button>
                  <button className="maps-btn" onClick={() => reject(p.id)}>✗ Rejeter</button>
                </div>
              ) : <small>{p.state === 'ok' ? 'Accepté : c’est du lore.' : 'Rejeté.'}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
