/**
 * Fond tactique (MJ, onglet Construire) : une tuile de la Banque Loresmith (rivière, gué, baie, ravin…) couvre tout le
 * plateau, et le terrain de chaque case est lu dans l'image (eau, gouffre, herbe, roche ; cf. banque/tiles.js).
 * Retirer le fond rend les corrections de cases d'avant.
 */
import { useState } from 'react';
import { bankSrc, useBank, type BankImage } from '../../banque';
import { isFordTile, tileCells } from '../../banque/tiles';
import type { CellFix, TerrainId } from './surface';

/** Lit une image de la banque dans un canevas (même origine), tournée de `rot` quarts de tour, et renvoie ses pixels. */
function pixels(src: string, rot = 0): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const w0 = Math.min(256, im.naturalWidth), h0 = Math.round((w0 * im.naturalHeight) / im.naturalWidth);
      const odd = rot % 2 === 1, w = odd ? h0 : w0, h = odd ? w0 : h0;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('canevas indisponible'));
      ctx.translate(w / 2, h / 2); ctx.rotate((rot * Math.PI) / 2); ctx.drawImage(im, -w0 / 2, -h0 / 2, w0, h0);
      resolve({ data: ctx.getImageData(0, 0, w, h).data, w, h });
    };
    im.onerror = () => reject(new Error('image introuvable'));
    im.src = src;
  });
}

/** Terrain de chaque case d'un plateau couvert par la tuile, prêt à servir de corrections de cases. */
export async function tileFix(img: BankImage, cols: number, rows: number, rot = 0): Promise<Record<string, CellFix>> {
  const { data, w, h } = await pixels(bankSrc(img, 256), rot);
  const cells = tileCells(data, w, h, cols, rows, isFordTile(img)) as TerrainId[];
  return Object.fromEntries(cells.map((t, i) => [String(i), { t }]));
}

export const isTactical = (i: BankImage) => i.type === 'texture' && !!i.usage?.includes('tactique') && !i.exclu;

export default function TilePanel({ current, note, onPick, onClear, onTurn }: { current?: string; note?: string; onPick: (img: BankImage) => Promise<void>; onClear: () => void; onTurn: () => Promise<void> }) {
  const tiles = useBank().filter(isTactical);
  const [busy, setBusy] = useState<string | null>(null);
  if (!tiles.length) return null;
  return (
    <section className="maps-card build-panel tile-panel">
      <h3>Fond tactique</h3>
      <p className="build-hint">Une tuile de la banque couvre le plateau ; l’eau, le gué, le ravin et la roche deviennent des règles de case. Un jeton qui se retrouve dans le vide ou en eau profonde est posé sur la place sûre la plus proche. Tu corriges ensuite à la main si besoin.</p>
      <div className="tile-grid">
        {tiles.map((t) => (
          <button key={t.id} className={`tile-pick${current === t.id ? ' on' : ''}`} disabled={!!busy} title={t.nom}
            onClick={async () => { setBusy(t.id); try { await onPick(t); } finally { setBusy(null); } }}>
            <img src={bankSrc(t, 120)} alt="" loading="lazy" />
            <span>{busy === t.id ? 'Lecture…' : t.nom}</span>
          </button>
        ))}
      </div>
      {note && <p className="build-hint" role="status">{note}</p>}
      {current && (
        <div className="maps-actions">
          <button className="maps-btn" disabled={!!busy} onClick={async () => { setBusy('tour'); try { await onTurn(); } finally { setBusy(null); } }}>{busy === 'tour' ? 'Lecture…' : '↻ Tourner d’un quart de tour'}</button>
          <button className="maps-btn" onClick={onClear}>Retirer le fond tactique</button>
        </div>
      )}
    </section>
  );
}
