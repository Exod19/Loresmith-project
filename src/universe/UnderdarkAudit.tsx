/**
 * Contrôle de l'univers (réglages) : dans un univers qui n'est pas relié à l'Underdark, liste ce qui vient de
 * l'Underdark et n'y a pas sa place (fiche importée des Archives, lieu de Hosten Valak…). Ces fiches sont déjà tenues
 * à l'écart des cartes et de l'IA ; le MJ peut les supprimer ici (après confirmation).
 */
import { isUnderdarkUniverse, mentionsUnderdark, underdarkSpecific } from './underdark';

type Entry = { id: string; universeId?: string; title?: string; archiveType?: string; sourceId?: string };
type Campaign = { id: string; universeId?: string; title?: string; scenes?: { title?: string; location?: string; summary?: string }[] };

export default function UnderdarkAudit({ universe, entries, campaigns, onDelete }: {
  universe: { id: string; archives?: string }; entries: Entry[]; campaigns: Campaign[]; onDelete: (id: string) => void;
}) {
  if (isUnderdarkUniverse(universe)) return null;
  const strays = entries.filter((e) => e.universeId === universe.id && underdarkSpecific(e as Record<string, unknown>));
  const camps = campaigns.filter((c) => c.universeId === universe.id && (c.scenes ?? []).some((s) => mentionsUnderdark(`${s.title} ${s.location} ${s.summary}`)));
  if (!strays.length && !camps.length) return null;
  return (
    <div className="panel" role="region" aria-label="Contenu de l’Underdark dans cet univers">
      <div className="eyebrow">Contenu de l’Underdark dans cet univers</div>
      <p className="muted">
        Cet univers n’est pas relié à l’Underdark. Ces éléments en viennent : ils sont tenus à l’écart des cartes, des cités et de l’IA.
        Tu peux les supprimer, ou relier l’univers aux Archives de l’Underdark si c’était voulu.
      </p>
      {strays.map((e) => (
        <div key={e.id} className="row" style={{ alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1 }}>{e.title || 'Fiche sans titre'}{e.sourceId ? ' · importée des Archives' : ''}</span>
          <button className="btn" style={{ flex: 'none' }} onClick={() => { if (window.confirm(`Supprimer la fiche « ${e.title} » de cet univers ?`)) onDelete(e.id); }}>Supprimer</button>
        </div>
      ))}
      {camps.length > 0 && (
        <p className="muted">Campagnes dont des scènes nomment l’Underdark (à revoir à la main) : {camps.map((c) => c.title).join(' · ')}</p>
      )}
    </div>
  );
}
