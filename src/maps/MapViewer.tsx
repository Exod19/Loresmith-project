/**
 * Visionneuse de carte : plan interactif, repères, rencontres, combat sur grille, et projection vers l'écran joueur.
 * Mode MJ : tout est visible, notes comprises. La projection montre aux joueurs ce qu'ils doivent voir, et se met à jour en direct.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import MapCanvas, { type Layers } from './atlas/MapCanvas';
import { CATEGORIES } from './atlas/model';
import { describe as describeFeature, dmFeature } from './atlas/lore';
import { rollEncounter, type EncCtx, type Encounter, type Zone } from './atlas/encounters';
import { STATS, SRD_CREDIT, mod, type Stat } from './atlas/statblocks';
import type { AtlasData, AtlasFeature, FeatureCategory } from './atlas/types';
import {
  activateMap, ATLAS_DEFAULT_PLAN, DEFAULT_BATTLE, EMPTY_OVERLAY, mapIdOf,
  type MapMarker, type MapOverlay, type MapRecord, type MarkerKind, type PassageLink, type PointRecord,
} from './mapStore';
import { battleBoard, mapBoard } from './playerBoard';
import BattleMode from './battle/BattleMode';
import Interactables from './Interactables';
import { publishStage } from '../present/stage';
import './maps.css';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const ZONES: { v: Zone; l: string }[] = [{ v: 'sauvage', l: 'Sauvage' }, { v: 'transit', l: 'Transit' }, { v: 'cite', l: 'Cité' }];
const KIND_LABEL: Record<MarkerKind, string> = { rencontre: 'Rencontre', passage: 'Passage secret', objet: 'Objet', repere: 'Repère' };
const KIND_ICON: Record<MarkerKind, string> = { rencontre: '⚔', passage: '🗝', objet: '◆', repere: '◆' };
const DEFAULT_TITLE: Record<MarkerKind, string> = { rencontre: 'Rencontre', passage: 'Passage secret', objet: 'Objet', repere: 'Repère' };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Repère en cours de placement : le prochain clic sur la carte le crée. */
type Draft = { kind: MarkerKind; title: string; summary?: string; notes?: string; groups?: MapMarker['groups'] };

export default function MapViewer({ rec, atlas, dm, onDm, onUpdate, onBack }: {
  rec: MapRecord; atlas: AtlasData; dm: boolean; onDm: (v: boolean) => void;
  onUpdate: (patch: Partial<MapRecord>) => void; onBack: () => void;
}) {
  const data = activateMap(rec, dm, atlas);
  const [planId, setPlanId] = useState(rec.kind === 'atlas' ? ATLAS_DEFAULT_PLAN : mapIdOf(rec));
  /** Carte de combat ouverte à la place de la carte de navigation (même mise en page). */
  const [battleOpen, setBattleOpen] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enc, setEnc] = useState<{ ctx: EncCtx; e: Encounter } | null>(null);
  const [placing, setPlacing] = useState<Draft | null>(null);
  /** Lieu que les joueurs doivent voir au centre de l'écran (demandé depuis la fiche). */
  const [focus, setFocus] = useState<{ kind: 'anchor' | 'point'; id: string; tick: number } | null>(null);

  const overlay = rec.overlay ?? EMPTY_OVERLAY;
  const map = data.maps.find((m) => m.id === planId) ?? data.maps[0];
  const markers = overlay.markers.filter((m) => m.planId === map.id);
  const markerId = selectedId?.startsWith('mk-') ? selectedId.slice(3) : null;
  const selectedMarker = markers.find((m) => m.id === markerId) ?? null;
  const feature = !markerId && selectedId ? data.features.find((f) => f.id === selectedId) ?? null : null;
  const point = rec.points?.find((p) => p.id === selectedId) ?? null;
  /** Lieu courant (lieu de l'Atlas, point perso ou repère) : c'est lui qui donne le terrain de la carte de combat. */
  const locationHint = feature
    ? { id: feature.id, title: feature.title, category: feature.category, trace: feature.trace, text: [feature.subtitle, feature.summary].filter(Boolean).join(' ') }
    : selectedMarker
      ? { id: `mk-${selectedMarker.id}`, title: selectedMarker.title, category: selectedMarker.kind === 'rencontre' ? 'danger' : 'indetermine', trace: selectedMarker.kind === 'passage' ? 'secret' : undefined, text: selectedMarker.summary, groups: selectedMarker.groups }
      : null;

  /** Lieux de l'atlas présents sur le plan : « tout révéler » ne touche qu'à ceux-là. */
  const planFeatureIds = useMemo(
    () => (rec.kind === 'atlas' ? atlas.geometries.filter((g) => g.mapId === map.id).map((g) => g.featureId) : []),
    [atlas, map.id, rec.kind],
  );

  // Projection : toute modification de la carte, du repérage ou du combat part vers l'écran joueur.
  useEffect(() => {
    if (!projecting) return;
    publishStage({ kind: 'board', board: battleOpen ? battleBoard(rec) : mapBoard(rec, atlas, map.id, focus ?? undefined) });
  }, [projecting, battleOpen, rec, atlas, map.id, focus]);

  /** Amène la vue joueurs sur ce lieu : le révèle si besoin, centre la carte chez eux, et démarre la projection. */
  const bringPlayers = (id: string) => {
    if (rec.kind === 'atlas' && !overlay.revealed.includes(id)) toggleReveal(id);
    setFocus({ kind: 'point', id, tick: Date.now() });
    setProjecting(true);
  };

  /** Suit le passage jusqu'à sa destination, sur la carte de navigation. Une porte qui mène ailleurs s'ouvre pour les joueurs. */
  const followPassage = (link: PassageLink) => {
    if (link.kind === 'marker') {
      const m = overlay.markers.find((x) => x.id === link.id);
      if (m && !m.revealed) updateMarker(m.id, { revealed: true });
    }
    // Un lieu de l'Atlas qui n'est pas encore visible devient visible au passage.
    if (link.kind === 'feature' && rec.kind === 'atlas' && !overlay.revealed.includes(link.id)) toggleReveal(link.id);
    setBattleOpen(false);
    setPlanId(link.planId);
    setSelectedId(null);
    setFocus({ kind: link.kind === 'anchor' ? 'anchor' : 'point', id: link.kind === 'anchor' ? link.id : link.kind === 'feature' ? link.id : `mk-${link.id}`, tick: Date.now() });
  };

  /** Inscrit (ou efface) la destination d'un passage. */
  const setPassageLink = (passageId: string, link: PassageLink | null) => {
    const links = { ...(overlay.passageLinks ?? {}) };
    if (link) links[passageId] = link; else delete links[passageId];
    setOverlay({ ...overlay, passageLinks: links });
  };

  function stopProjecting() {
    setProjecting(false);
    publishStage({ kind: 'blank' });
  }

  const setOverlay = (next: MapOverlay) => onUpdate({ overlay: next, updatedAt: Date.now() });
  const toggleReveal = (id: string) => setOverlay({
    ...overlay,
    revealed: overlay.revealed.includes(id) ? overlay.revealed.filter((x) => x !== id) : [...overlay.revealed, id],
  });
  const revealPlan = (on: boolean) => {
    const ids = new Set(overlay.revealed);
    planFeatureIds.forEach((id) => (on ? ids.add(id) : ids.delete(id)));
    setOverlay({ ...overlay, revealed: [...ids] });
  };

  function addMarker(x: number, y: number) {
    if (!placing) return;
    const m: MapMarker = {
      id: uid(), kind: placing.kind, title: placing.title || DEFAULT_TITLE[placing.kind], planId: map.id, x, y,
      summary: placing.summary ?? '', notes: placing.notes ?? '', revealed: false, groups: placing.groups,
    };
    setPlacing(null);
    setSelectedId(`mk-${m.id}`);
    if (m.kind === 'rencontre') {
      // Nouvelle rencontre : on oublie le plateau précédent et on ouvre la carte de combat de ce lieu, avec ses créatures.
      onUpdate({ overlay: { ...overlay, markers: [...overlay.markers, m] }, updatedAt: Date.now(), battle: { ...DEFAULT_BATTLE, tokens: [] } });
      setBattleOpen(true);
      return;
    }
    setOverlay({ ...overlay, markers: [...overlay.markers, m] });
  }
  const updateMarker = (id: string, patch: Partial<MapMarker>) => setOverlay({
    ...overlay, markers: overlay.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  });
  const removeMarker = (id: string) => {
    setOverlay({ ...overlay, markers: overlay.markers.filter((m) => m.id !== id) });
    setSelectedId(null);
  };

  return (
    <div className="atlas-page maps-viewer">
      <div className="maps-toolbar">
        {battleOpen
          ? <button className="maps-btn" onClick={() => setBattleOpen(false)}>← Carte de navigation</button>
          : <button className="maps-btn" onClick={onBack}>← Cartes</button>}
        <strong className="maps-title">{rec.title}</strong>
        {rec.kind === 'atlas' && !battleOpen && (
          <select className="maps-btn" value={planId} onChange={(e) => { setPlanId(e.target.value); setSelectedId(null); setPlacing(null); }}>
            {atlas.maps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
        {!battleOpen && <button className="maps-btn" onClick={() => setBattleOpen(true)}>⚔ Ouvrir la carte de combat</button>}
        <div className="maps-spacer" />
        <button className={`maps-btn ${projecting ? 'gold' : ''}`} onClick={() => (projecting ? stopProjecting() : setProjecting(true))}>
          {projecting ? '■ Arrêter la projection' : '▶ Projeter aux joueurs'}
        </button>
        {!battleOpen && (
          <div className="maps-seg" role="group" aria-label="Affichage">
            <button className={dm ? 'on' : ''} onClick={() => onDm(true)}>MJ</button>
            <button className={!dm ? 'on' : ''} onClick={() => onDm(false)}>Joueurs</button>
          </div>
        )}
      </div>
      {projecting && (
        <p className="maps-live">● Écran joueur : {battleOpen ? `carte de combat (${rec.title})` : map.title} · mis à jour en direct</p>
      )}

      {battleOpen ? (
        <BattleMode
          rec={rec} battle={rec.battle ?? DEFAULT_BATTLE} context={locationHint}
          atlas={data} plan={map} markers={overlay.markers}
          onFollow={followPassage} onLink={setPassageLink} onMarker={(id, patch) => updateMarker(id, patch)}
          onReveal={(id) => toggleReveal(id)}
          onBattle={(b) => onUpdate({ battle: b, updatedAt: Date.now() })}
        />
      ) : (
        <div className="maps-body">
          <div className="maps-canvas">
            <MapCanvas
              key={map.id}
              map={map}
              layers={LAYERS}
              hidden={new Set<FeatureCategory>()}
              selectedId={selectedId}
              onSelect={(f: AtlasFeature) => { setSelectedId(f.id); setEnc(null); }}
              onAnchor={() => {}}
              onPlace={dm && placing ? addMarker : undefined}
              dataKey={rec.updatedAt}
              focus={focus ? { kind: 'point', id: focus.id } : null}
              focusKey={focus ? String(focus.tick) : undefined}
              dm={dm}
            />
          </div>

          <aside className="maps-panel">
            {dm && placing && (
              <p className="maps-hint maps-placing">
                Clique sur la carte pour placer « {placing.title} ». <button className="maps-link" onClick={() => setPlacing(null)}>Annuler</button>
              </p>
            )}

            {dm && selectedMarker && (
              <MarkerEditor
                m={selectedMarker}
                onChange={(patch) => updateMarker(selectedMarker.id, patch)}
                onRemove={() => { if (window.confirm(`Supprimer « ${selectedMarker.title} » ?`)) removeMarker(selectedMarker.id); }}
                onClose={() => setSelectedId(null)}
              />
            )}

            {feature && !markerId && (
              <FeaturePanel
                f={feature} dm={dm} notes={point?.notes ?? ''}
                defaultCtx={{ zone: point?.zone ?? 'sauvage', depth: point?.depth ?? 3, place: feature.title }}
                onClose={() => setSelectedId(null)}
                onRoll={(ctx) => setEnc({ ctx, e: rollEncounter(ctx) })}
                onBring={() => bringPlayers(feature.id)}
                revealed={rec.kind === 'atlas' ? overlay.revealed.includes(feature.id) : undefined}
                onToggleReveal={rec.kind === 'atlas' ? () => toggleReveal(feature.id) : undefined}
              />
            )}

            {!feature && !selectedMarker && (
              <p className="maps-hint">
                {dm
                  ? 'Touche un lieu pour le lire, ou place un repère ci-dessous. Tout ce que tu révèles apparaît en direct chez les joueurs.'
                  : 'Mode joueurs : seules les informations partagées sont visibles.'}
              </p>
            )}

            {dm && rec.kind === 'atlas' && (
              <div className="maps-card">
                <h3>Révélations</h3>
                <p className="maps-sub">{overlay.revealed.length} lieu(x) visible(s) des joueurs, sur l'ensemble de l'Atlas.</p>
                <div className="maps-enc-ctrl">
                  <button className="maps-btn" onClick={() => revealPlan(true)}>Tout révéler sur ce plan</button>
                  <button className="maps-btn" onClick={() => revealPlan(false)}>Tout cacher sur ce plan</button>
                </div>
              </div>
            )}

            {dm && markers.some((m) => m.kind === 'rencontre') && (
              <div className="maps-card">
                <h3>Rencontres placées</h3>
                <ul className="maps-list">
                  {markers.filter((m) => m.kind === 'rencontre').map((m) => (
                    <li key={m.id} data-on={selectedId === `mk-${m.id}` ? 1 : 0}>
                      <button className="maps-link" onClick={() => setSelectedId(`mk-${m.id}`)}>{KIND_ICON[m.kind]} {m.title}</button>
                      <button className="maps-btn" onClick={() => updateMarker(m.id, { revealed: !m.revealed })}>
                        {m.revealed ? 'Visible' : 'Caché'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dm && enc && (
              <EncounterBox
                enc={enc}
                onRoll={(force) => setEnc({ ctx: enc.ctx, e: rollEncounter(enc.ctx, force) })}
                onPlace={() => setPlacing({
                  kind: 'rencontre',
                  title: enc.e.entry?.title ?? DEFAULT_TITLE.rencontre,
                  summary: [enc.e.entry?.text, enc.e.attitude, enc.e.wants && `Veut : ${enc.e.wants}`].filter(Boolean).join('\n'),
                  notes: [enc.e.check, enc.e.entry?.hook && `Accroche : ${enc.e.entry.hook}`].filter(Boolean).join('\n'),
                  groups: enc.e.groups,
                })}
              />
            )}

            {dm && rec.kind === 'custom' && (
              <PointEditor rec={rec} onUpdate={onUpdate} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </aside>
        </div>
      )}

      {dm && !battleOpen && (
        <Interactables
          markers={markers.filter((m) => m.kind !== 'rencontre')}
          onChange={(id, patch) => updateMarker(id, patch)}
          onRemove={(id) => removeMarker(id)}
          onAdd={(kind) => setPlacing({ kind, title: DEFAULT_TITLE[kind] })}
        />
      )}

      <p className="maps-footer">
        {dm && rec.kind === 'atlas' && <>Statistiques : {SRD_CREDIT} </>}
        {rec.kind === 'custom' && !dm && 'Les repères secrets restent cachés.'}
      </p>
    </div>
  );
}

function FeaturePanel({ f, dm, notes, defaultCtx, onClose, onRoll, revealed, onToggleReveal, onBring }: {
  f: AtlasFeature; dm: boolean; notes: string; defaultCtx: EncCtx; onClose: () => void; onRoll: (ctx: EncCtx) => void;
  revealed?: boolean; onToggleReveal?: () => void; onBring?: () => void;
}) {
  const [zone, setZone] = useState<Zone>(defaultCtx.zone);
  const [depth, setDepth] = useState(defaultCtx.depth);
  const guide = dm ? dmFeature(f) : null;
  const text = f.summary ?? describeFeature(f);
  return (
    <div className="maps-card">
      <div className="maps-card-head">
        <span>{CATEGORIES[f.category].glyph} {CATEGORIES[f.category].label}</span>
        <button className="maps-btn" onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <h3>{f.title}</h3>
      {f.subtitle && <p className="maps-sub">{f.subtitle}</p>}
      <p>{text}</p>
      {dm && notes && <Block title="Notes du MJ">{notes}</Block>}
      {guide && guide.checks.length > 0 && (
        <Block title="Jets suggérés">
          <ul>{guide.checks.map((c, i) => <li key={i}>{c.label}{c.dc ? ` · DD ${c.dc}` : ''}{c.ok ? ` — ${c.ok}` : ''}</li>)}</ul>
        </Block>
      )}
      {guide && guide.tips.map((t, i) => <p key={i} className="maps-tip">{t}</p>)}
      {dm && onBring && <button className="maps-btn gold" onClick={onBring}>🎯 Amener la vue joueurs ici</button>}
      {dm && onToggleReveal && (
        <button className={`maps-btn ${revealed ? '' : 'gold'}`} onClick={onToggleReveal}>
          {revealed ? '🙈 Cacher aux joueurs' : '👁 Montrer aux joueurs'}
        </button>
      )}
      {dm && (
        <div className="maps-enc-ctrl">
          <label>Zone
            <select className="maps-btn" value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
              {ZONES.map((z) => <option key={z.v} value={z.v}>{z.l}</option>)}
            </select>
          </label>
          <label>Profondeur
            <input className="maps-btn" type="number" min={1} max={9} value={depth} onChange={(e) => setDepth(Math.max(1, Math.min(9, +e.target.value || 1)))} />
          </label>
          <button className="maps-btn gold" onClick={() => onRoll({ zone, depth, place: f.title })}>⚄ Rencontre ici (1d20)</button>
        </div>
      )}
    </div>
  );
}

function MarkerEditor({ m, onChange, onRemove, onClose }: {
  m: MapMarker; onChange: (patch: Partial<MapMarker>) => void; onRemove: () => void; onClose: () => void;
}) {
  return (
    <div className="maps-card">
      <div className="maps-card-head">
        <span>{KIND_ICON[m.kind]} {KIND_LABEL[m.kind]}</span>
        <button className="maps-btn" onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <div className="maps-form">
        <input className="maps-btn" value={m.title} onChange={(e) => onChange({ title: e.target.value })} />
        <select className="maps-btn" value={m.kind} onChange={(e) => onChange({ kind: e.target.value as MarkerKind })}>
          {(Object.keys(KIND_LABEL) as MarkerKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <textarea className="maps-btn" placeholder="Texte montré aux joueurs quand le repère est visible" value={m.summary} onChange={(e) => onChange({ summary: e.target.value })} />
        <textarea className="maps-btn" placeholder="Notes du MJ (jamais montrées)" value={m.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        <label className="maps-row"><input type="checkbox" checked={m.revealed} onChange={(e) => onChange({ revealed: e.target.checked })} /> Visible des joueurs</label>
      </div>
      {m.groups && m.groups.length > 0 && (
        <Block title="Créatures (MJ)">
          {m.groups.map((g, i) => {
            const s: Stat | undefined = STATS[g.stat];
            return <div key={i}>{g.n} × {s?.name ?? g.stat}{g.role ? ` (${g.role})` : ''} {s && <span className="maps-sub">CA {s.ac} · PV {s.hp}</span>}</div>;
          })}
        </Block>
      )}
      <button className="maps-btn" onClick={onRemove}>Supprimer le repère</button>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="maps-block"><h4>{title}</h4>{children}</div>;
}

function EncounterBox({ enc, onRoll, onPlace }: { enc: { ctx: EncCtx; e: Encounter }; onRoll: (force: boolean) => void; onPlace: () => void }) {
  const { e } = enc;
  return (
    <div className="maps-card maps-enc">
      <h3>Rencontre</h3>
      <p className="maps-sub">{e.check}</p>
      {!e.happens && <p>Rien ne vient. Le lieu reste calme pour l’instant.</p>}
      {e.happens && e.entry && (
        <>
          <p><strong>{e.entry.kind} · {e.entry.title}</strong></p>
          <p>{e.entry.text}</p>
          {e.attitude && <p><em>Attitude :</em> {e.attitude}</p>}
          {e.wants && <p><em>Veut :</em> {e.wants}</p>}
          {e.entry.hook && <p><em>Accroche :</em> {e.entry.hook}</p>}
          {e.groups?.map((g, i) => {
            const s: Stat | undefined = STATS[g.stat];
            return (
              <div key={i} className="maps-group">
                <div>{g.n} × {s?.name ?? g.stat}{g.role ? ` (${g.role})` : ''} <span className="maps-sub">{g.detail}</span></div>
                {s && <div className="maps-sub">CA {s.ac} · PV {s.hp} · For {mod(s.abil[0])} · Dex {mod(s.abil[1])} · Con {mod(s.abil[2])}</div>}
              </div>
            );
          })}
        </>
      )}
      <div className="maps-enc-ctrl">
        <button className="maps-btn" onClick={() => onRoll(false)}>Relancer (1d20)</button>
        <button className="maps-btn gold" onClick={() => onRoll(true)}>Imposer une rencontre</button>
        {e.happens && <button className="maps-btn" onClick={onPlace}>Placer sur la carte</button>}
      </div>
    </div>
  );
}

/** Édition des repères d'une carte personnalisée (MJ). Position en pourcentage de l'image. */
function PointEditor({ rec, onUpdate, selectedId, onSelect }: {
  rec: MapRecord; onUpdate: (patch: Partial<MapRecord>) => void; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const points = rec.points ?? [];
  const blank = (): PointRecord => ({ id: uid(), title: '', category: 'indetermine', importance: 'regional', summary: '', notes: '', secret: false, x: 0.5, y: 0.5, zone: 'sauvage', depth: 3 });
  const [draft, setDraft] = useState<PointRecord>(blank);
  const [editing, setEditing] = useState(false);

  const save = (list: PointRecord[]) => onUpdate({ points: list, updatedAt: Date.now() });
  const submit = () => {
    if (!draft.title.trim()) return;
    save(editing ? points.map((p) => (p.id === draft.id ? draft : p)) : [...points, draft]);
    setDraft(blank()); setEditing(false);
  };
  const edit = (p: PointRecord) => { setDraft({ ...p }); setEditing(true); onSelect(p.id); };
  const set = <K extends keyof PointRecord>(k: K, v: PointRecord[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="maps-card">
      <h3>Repères ({points.length})</h3>
      <div className="maps-form">
        <input className="maps-btn" placeholder="Nom" value={draft.title} onChange={(e) => set('title', e.target.value)} />
        <select className="maps-btn" value={draft.category} onChange={(e) => set('category', e.target.value as FeatureCategory)}>
          {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <select className="maps-btn" value={draft.importance} onChange={(e) => set('importance', e.target.value as PointRecord['importance'])}>
          <option value="landmark">Repère majeur</option><option value="regional">Régional</option><option value="local">Local</option><option value="detail">Détail</option>
        </select>
        <div className="maps-row">
          <label>X % <input className="maps-btn" type="number" min={0} max={100} value={Math.round(draft.x * 100)} onChange={(e) => set('x', Math.min(1, Math.max(0, +e.target.value / 100)))} /></label>
          <label>Y % <input className="maps-btn" type="number" min={0} max={100} value={Math.round(draft.y * 100)} onChange={(e) => set('y', Math.min(1, Math.max(0, +e.target.value / 100)))} /></label>
        </div>
        <textarea className="maps-btn" placeholder="Description (visible des joueurs)" value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
        <textarea className="maps-btn" placeholder="Notes du MJ (cachées)" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        <label className="maps-row"><input type="checkbox" checked={draft.secret} onChange={(e) => set('secret', e.target.checked)} /> Repère secret</label>
        <div className="maps-row">
          <select className="maps-btn" value={draft.zone} onChange={(e) => set('zone', e.target.value as Zone)}>
            {ZONES.map((z) => <option key={z.v} value={z.v}>{z.l}</option>)}
          </select>
          <input className="maps-btn" type="number" min={1} max={9} value={draft.depth} onChange={(e) => set('depth', Math.max(1, Math.min(9, +e.target.value || 1)))} />
        </div>
        <button className="maps-btn gold" onClick={submit}>{editing ? 'Enregistrer' : 'Ajouter le repère'}</button>
        {editing && <button className="maps-btn" onClick={() => { setDraft(blank()); setEditing(false); }}>Annuler</button>}
      </div>
      <ul className="maps-list">
        {points.map((p) => (
          <li key={p.id} data-on={selectedId === p.id ? 1 : 0}>
            <button className="maps-link" onClick={() => onSelect(p.id)}>{p.title}{p.secret ? ' (secret)' : ''}</button>
            <button className="maps-btn" onClick={() => edit(p)}>Modifier</button>
            <button className="maps-btn" onClick={() => save(points.filter((x) => x.id !== p.id))}>Supprimer</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
