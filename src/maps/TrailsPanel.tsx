/**
 * Sentiers autour du groupe (MJ, carte de navigation) : chaque galerie, boyau, lézarde ou passage qui part
 * de la position du groupe, avec le DC pour le repérer et sa dangerosité perçue. Le MJ montre aux joueurs
 * ceux qu'ils ont trouvés, un par un ; ceux que le groupe voit sans chercher sont signalés.
 */
import type { AtlasData, AtlasFeature, AtlasMap } from './atlas/types';
import { detectLabel, noticedPassively, trailProfile, type TrailProfile } from './atlas/trails';

export type Trail = { f: AtlasFeature; profile: TrailProfile; noticed: boolean; shown: boolean };

/** Distance d'un point à un segment, en coordonnées de plan (0–1). */
function segDist(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Sentiers qui passent à moins de `radius` de la position (plan courant). */
export function trailsNear(data: AtlasData, map: AtlasMap, at: [number, number], revealed: string[], passive: number, radius = 0.03): Trail[] {
  const byId = new Map(data.features.map((f) => [f.id, f]));
  const out: Trail[] = [];
  for (const g of data.geometries) {
    if (g.mapId !== map.id || g.type !== 'polyline') continue;
    const f = byId.get(g.featureId);
    if (!f?.trace) continue;
    const pts = g.coordinates as [number, number][];
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(at, pts[i], pts[i + 1]));
    if (d > radius) continue;
    const profile = trailProfile(f, f.trace === 'secret' ? 15 : undefined);
    out.push({ f, profile, noticed: noticedPassively(profile.detect, passive), shown: revealed.includes(f.id) });
  }
  return out.sort((a, b) => (a.profile.detect?.dc ?? 0) - (b.profile.detect?.dc ?? 0) || a.profile.danger.level - b.profile.danger.level);
}

export function DangerChip({ profile }: { profile: TrailProfile }) {
  const d = profile.danger;
  return <span className={`trail-danger lvl-${d.level}`} title={`${d.text} (${d.why.join(', ')})`}>{d.label}</span>;
}

export default function TrailsPanel({ placeTitle, trails, passive, passiveWho, onToggle, onSelect, onRevealNoticed }: {
  placeTitle: string; trails: Trail[]; passive: number; passiveWho?: string;
  onToggle: (id: string) => void; onSelect: (f: AtlasFeature) => void; onRevealNoticed: () => void;
}) {
  const hiddenNoticed = trails.filter((t) => t.noticed && !t.shown).length;
  return (
    <div className="maps-card trails-panel">
      <h3>Sentiers autour du groupe</h3>
      <p className="maps-sub">
        Depuis <b>{placeTitle}</b> · Perception passive du groupe : <b>{passive}</b>{passiveWho ? ` (${passiveWho})` : ''}.
        Montre aux joueurs les sentiers qu’ils ont trouvés.
      </p>
      {trails.length === 0 && <p className="maps-sub">Aucun sentier ne part d’ici sur ce plan.</p>}
      {hiddenNoticed > 0 && (
        <button className="maps-btn gold" onClick={onRevealNoticed}>👁 Montrer les {hiddenNoticed} sentier{hiddenNoticed > 1 ? 's' : ''} vu{hiddenNoticed > 1 ? 's' : ''} sans chercher</button>
      )}
      <ul className="trails-list">
        {trails.map((t) => (
          <li key={t.f.id} data-on={t.shown ? 1 : 0}>
            <DangerChip profile={t.profile} />
            <button className="maps-link trails-title" onClick={() => onSelect(t.f)}>{t.f.title}</button>
            <small className={`trails-dc ${t.noticed ? 'is-noticed' : ''}`} title={t.noticed ? 'Le groupe le remarque sans chercher' : 'Il faut chercher pour le trouver'}>
              {detectLabel(t.profile.detect)}{t.noticed ? ' · vu' : ''}
            </small>
            <button className="place-eye" onClick={() => onToggle(t.f.id)} title={t.shown ? 'Visible des joueurs (clic : cacher)' : 'Caché aux joueurs (clic : montrer)'}>{t.shown ? '👁' : '🙈'}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
