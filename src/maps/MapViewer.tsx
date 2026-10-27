/**
 * Visionneuse de carte interactive : plan (moteur de l'Atlas), panneau de repère, rencontres aléatoires.
 * Mode MJ : conseils, notes, passages secrets, rencontres. Mode joueurs : seulement ce qui peut être montré.
 */
import { useState, type ReactNode } from 'react';
import MapCanvas, { type Layers } from './atlas/MapCanvas';
import { CATEGORIES } from './atlas/model';
import { describe as describeFeature, dmFeature } from './atlas/lore';
import { rollEncounter, type EncCtx, type Encounter, type Zone } from './atlas/encounters';
import { STATS, SRD_CREDIT, mod, type Stat } from './atlas/statblocks';
import type { AtlasData, AtlasFeature, FeatureCategory } from './atlas/types';
import { activateMap, ATLAS_DEFAULT_PLAN, mapIdOf, type MapRecord, type PointRecord } from './mapStore';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const ZONES: { v: Zone; l: string }[] = [{ v: 'sauvage', l: 'Sauvage' }, { v: 'transit', l: 'Transit' }, { v: 'cite', l: 'Cité' }];

export default function MapViewer({ rec, atlas, dm, onDm, onUpdate, onBack }: {
  rec: MapRecord; atlas: AtlasData; dm: boolean; onDm: (v: boolean) => void;
  onUpdate: (patch: Partial<MapRecord>) => void; onBack: () => void;
}) {
  const data = activateMap(rec, dm, atlas);
  const [planId, setPlanId] = useState(rec.kind === 'atlas' ? ATLAS_DEFAULT_PLAN : mapIdOf(rec));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enc, setEnc] = useState<{ ctx: EncCtx; e: Encounter } | null>(null);

  const map = data.maps.find((m) => m.id === planId) ?? data.maps[0];
  const feature = selectedId ? data.features.find((f) => f.id === selectedId) ?? null : null;
  const point = rec.points?.find((p) => p.id === selectedId) ?? null;

  const roll = (ctx: EncCtx, force = false) => setEnc({ ctx, e: rollEncounter(ctx, force) });

  return (
    <div className="atlas-page maps-viewer">
      <div className="maps-toolbar">
        <button className="maps-btn" onClick={onBack}>← Cartes</button>
        <strong className="maps-title">{rec.title}</strong>
        {rec.kind === 'atlas' && (
          <select className="maps-btn" value={planId} onChange={(e) => { setPlanId(e.target.value); setSelectedId(null); }}>
            {atlas.maps.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
        <div className="maps-spacer" />
        <div className="maps-seg" role="group" aria-label="Affichage">
          <button className={dm ? 'on' : ''} onClick={() => onDm(true)}>MJ</button>
          <button className={!dm ? 'on' : ''} onClick={() => onDm(false)}>Joueurs</button>
        </div>
      </div>

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
            dm={dm}
          />
        </div>

        <aside className="maps-panel">
          {feature && (
            <FeaturePanel
              f={feature} dm={dm} notes={point?.notes ?? ''}
              onClose={() => setSelectedId(null)}
              onRoll={(ctx) => roll(ctx)}
              defaultCtx={{ zone: point?.zone ?? 'sauvage', depth: point?.depth ?? 3, place: feature.title }}
            />
          )}
          {!feature && <p className="maps-hint">Touche un repère pour le lire. {dm ? 'Mode MJ : conseils et rencontres disponibles.' : 'Mode joueurs : seules les informations partagées sont visibles.'}</p>}
          {!feature && rec.kind === 'custom' && (
            <div className="maps-card">
              <h3>Index des lieux</h3>
              <ul className="maps-list">
                {(rec.points ?? []).filter((p) => dm || !p.secret).map((p) => (
                  <li key={p.id}><button className="maps-link" onClick={() => setSelectedId(p.id)}>{p.title}{dm && p.secret ? ' (secret)' : ''}</button></li>
                ))}
              </ul>
            </div>
          )}

          {dm && enc && <EncounterBox enc={enc} onRoll={(force) => roll(enc.ctx, force)} />}

          {dm && rec.kind === 'custom' && (
            <PointEditor rec={rec} onUpdate={onUpdate} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </aside>
      </div>
      <p className="maps-footer">
        {dm && rec.kind === 'atlas' && <>Statistiques : {SRD_CREDIT} </>}
        {rec.kind === 'custom' && !dm && 'Les repères secrets restent cachés.'}
      </p>
    </div>
  );
}

function FeaturePanel({ f, dm, notes, defaultCtx, onClose, onRoll }: {
  f: AtlasFeature; dm: boolean; notes: string; defaultCtx: EncCtx; onClose: () => void; onRoll: (ctx: EncCtx) => void;
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

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="maps-block"><h4>{title}</h4>{children}</div>;
}

function EncounterBox({ enc, onRoll }: { enc: { ctx: EncCtx; e: Encounter }; onRoll: (force: boolean) => void }) {
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
                <div>{g.n} × {g.label ?? s?.name ?? g.stat}{g.role ? ` (${g.role})` : ''} <span className="maps-sub">{g.detail}</span></div>
                {s && <div className="maps-sub">CA {s.ac} · PV {s.hp} · For {mod(s.abil[0])} · Dex {mod(s.abil[1])} · Con {mod(s.abil[2])}</div>}
              </div>
            );
          })}
        </>
      )}
      <div className="maps-enc-ctrl">
        <button className="maps-btn" onClick={() => onRoll(false)}>Relancer (1d20)</button>
        <button className="maps-btn gold" onClick={() => onRoll(true)}>Imposer une rencontre</button>
      </div>
    </div>
  );
}

/** Édition des repères d'une carte personnalisée (MJ). Position en pourcentage de l'image. */
function PointEditor({ rec, onUpdate, selectedId, onSelect }: {
  rec: MapRecord; onUpdate: (patch: Partial<MapRecord>) => void; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const points = rec.points ?? [];
  const blank = (): PointRecord => ({ id: Math.random().toString(36).slice(2, 10), title: '', category: 'indetermine', importance: 'regional', summary: '', notes: '', secret: false, x: 0.5, y: 0.5, zone: 'sauvage', depth: 3 });
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
