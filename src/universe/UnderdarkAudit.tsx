/**
 * Contrôle de l'univers (accueil) : dans un univers qui n'est pas relié à l'Underdark, liste ce qui vient de l'Underdark
 * (fiche importée des Archives, lieu de Hosten Valak, scène qui en parle). Ces éléments sont déjà tenus à l'écart des
 * cartes et de l'IA. Le MJ peut tout faire réécrire d'un coup par l'IA pour cet univers (originaux gardés, rétablissables),
 * ou supprimer une fiche (après confirmation).
 */
import { useState } from 'react';
import { aiReady } from '../ai/client';
import { isUnderdarkUniverse, underdarkSpecific } from './underdark';
import { restoreCampaign, restoreEntry, rewriteCampaign, rewriteEntry, sceneHasUnderdark, type Campaign, type Entry } from './rewriteUnderdark';

type U = { id: string; archives?: string; name?: string; tone?: string; lore?: string; genres?: string[] };
type E = Entry & { universeId?: string };
type C = Campaign & { universeId?: string };

export default function UnderdarkAudit({ universe, entries, campaigns, onDelete, onUpdateEntry, onUpdateCampaign }: {
  universe: U; entries: E[]; campaigns: C[];
  onDelete: (id: string) => void; onUpdateEntry: (id: string, patch: Partial<Entry>) => void; onUpdateCampaign: (id: string, patch: Partial<Campaign>) => void;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (isUnderdarkUniverse(universe)) return null;
  const mine = <T extends { universeId?: string }>(l: T[]) => l.filter((x) => x.universeId === universe.id);
  const strays = mine(entries).filter((e) => underdarkSpecific(e as Record<string, unknown>));
  const camps = mine(campaigns).filter((c) => (c.scenes ?? []).some(sceneHasUnderdark));
  const rewritten = [...mine(entries).filter((e) => e.avantReecriture), ...mine(campaigns).filter((c) => c.avantReecriture)];
  if (!strays.length && !camps.length && !rewritten.length) return null;

  const rewriteAll = async () => {
    setError('');
    const total = strays.length + camps.length;
    let n = 0;
    const fails: string[] = [];
    for (const e of strays) {
      setBusy(`Réécriture ${++n}/${total} : ${e.title}`);
      try { onUpdateEntry(e.id, await rewriteEntry(universe, e)); } catch (err) { fails.push((err as Error).message); }
    }
    for (const c of camps) {
      setBusy(`Réécriture ${++n}/${total} : campagne « ${c.title} »`);
      try { onUpdateCampaign(c.id, await rewriteCampaign(universe, c)); } catch (err) { fails.push((err as Error).message); }
    }
    setBusy('');
    if (fails.length) setError(`${fails.length} élément(s) non réécrit(s) : ${fails.join(' ; ')}`);
  };

  return (
    <div className="panel" role="region" aria-label="Contenu de l’Underdark dans cet univers">
      <div className="eyebrow">Contenu de l’Underdark dans cet univers</div>
      {(strays.length > 0 || camps.length > 0) && (
        <>
          <p className="muted">
            Cet univers n’est pas relié à l’Underdark. Ces éléments en viennent : ils sont tenus à l’écart des cartes, des cités et de l’IA.
            « Tout réécrire » les adapte à cet univers d’un seul coup (lieux de surface, mêmes enjeux et mêmes PNJ) ; les originaux sont gardés.
          </p>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button className="btn primary" style={{ flex: 'none' }} disabled={!!busy || !aiReady()} title={aiReady() ? '' : 'Configure une clé d’IA dans Réglages'} onClick={rewriteAll}>
              {busy ? 'Réécriture…' : '✨ Tout réécrire pour cet univers'}
            </button>
            {busy && <span className="muted">{busy}</span>}
          </div>
          {error && <p className="muted" role="alert">{error}</p>}
          {strays.map((e) => (
            <div key={e.id} className="row" style={{ alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>{e.title || 'Fiche sans titre'}{e.sourceId ? ' · importée des Archives' : ''}</span>
              <button className="btn" style={{ flex: 'none' }} disabled={!!busy} onClick={() => { if (window.confirm(`Supprimer la fiche « ${e.title} » de cet univers ?`)) onDelete(e.id); }}>Supprimer</button>
            </div>
          ))}
          {camps.length > 0 && <p className="muted">Campagnes dont des scènes nomment l’Underdark : {camps.map((c) => c.title).join(' · ')}</p>}
        </>
      )}
      {rewritten.length > 0 && (
        <details>
          <summary className="muted">Réécrits pour cet univers ({rewritten.length}) : rétablir un original</summary>
          {rewritten.map((x) => (
            <div key={x.id} className="row" style={{ alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1 }}>{x.title}{'scenes' in x ? ' · campagne' : ''}</span>
              <button className="btn" style={{ flex: 'none' }} onClick={() => ('scenes' in x ? onUpdateCampaign(x.id, restoreCampaign(x as C)) : onUpdateEntry(x.id, restoreEntry(x as E)))}>Rétablir l’original</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
