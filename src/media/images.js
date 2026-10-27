/**
 * Images de Loresmith : compression, jetons ronds pour les cartes, images des Archives de l'Underdark
 * (index et correspondance par nom), et génération d'un portrait.
 */
import { norm } from '../ai/loreContext';

const BASE = import.meta.env.BASE_URL || '/';

/** Chemin public d'une image des Archives (les chemins du fichier sont relatifs au site). */
export const archiveSrc = (src) => (!src || /^(https?:|data:|blob:|\/)/.test(src) ? src : `${BASE}${src}`);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible.'));
    img.src = src;
  });
}

/** Réduit une image (fichier importé, image générée) pour ménager le stockage du navigateur. */
export async function compressImage(src, { max = 768, quality = 0.85 } = {}) {
  const img = await loadImage(src);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  const out = c.toDataURL('image/webp', quality);
  return out.startsWith('data:image/webp') ? out : c.toDataURL('image/jpeg', quality);
}

/** Lit un fichier image et le compresse. */
export function fileToCompressed(file, opts) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => compressImage(r.result, opts).then(resolve, () => resolve(r.result));
    r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(file);
  });
}

/**
 * Jeton rond pour les cartes : l'image recadrée au centre (vers le haut, là où est le visage),
 * cerclée d'or (rouge pour une créature hostile). Petit (≈ 15 Ko) : il voyage avec la carte.
 */
export async function makeToken(src, { size = 256, hostile = false } = {}) {
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = img.height > img.width ? Math.min((img.height - side) * 0.2, img.height - side) : 0;
  const ring = Math.round(size * 0.06);
  g.save();
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - ring / 2, 0, Math.PI * 2);
  g.clip();
  g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  g.restore();
  g.lineWidth = ring;
  g.strokeStyle = hostile ? '#8f2a1a' : '#c9a24a';
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - ring / 2, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = Math.max(1, ring / 4);
  g.strokeStyle = 'rgba(0,0,0,.65)';
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - ring, 0, Math.PI * 2);
  g.stroke();
  return c.toDataURL('image/webp', 0.9);
}

/** Toutes les images des Archives : celles des fiches, puis celles des lieux de l'Atlas. */
export function archiveImageIndex(feed) {
  if (!feed) return [];
  const out = [];
  const seen = new Set();
  for (const e of feed.entries || []) {
    for (const img of e.images || []) {
      const src = archiveSrc(img.src);
      if (seen.has(src)) continue;
      seen.add(src);
      out.push({ id: `${e.id}:${img.id}`, src, caption: img.caption || img.alt || e.name, entryId: e.id, entryName: e.name, entryType: e.type, kind: img.kind || '', names: [e.name, e.scientificName, ...(e.altNames || []).map((a) => a.value)].filter(Boolean) });
    }
  }
  for (const f of feed.atlas?.features || []) {
    if (!f.image) continue;
    const src = archiveSrc(f.image);
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({ id: `atlas:${f.id}`, src, caption: f.title, entryId: f.entryId || '', entryName: f.title, entryType: 'lieu', kind: 'atlas', names: [f.title] });
  }
  return out;
}

/**
 * Images des Archives qui correspondent à un nom (fiche de bibliothèque, PNJ, créature).
 * Nom exact ou nom alternatif d'abord ; à défaut, un nom des Archives contenu dans le titre (≥ 5 lettres).
 */
export function matchArchiveImages(names, index) {
  const keys = names.map(norm).filter(Boolean);
  if (!keys.length || !index.length) return [];
  const exact = index.filter((img) => img.names.some((n) => keys.includes(norm(n))));
  if (exact.length) return exact;
  return index.filter((img) =>
    img.names.some((n) => {
      const k = norm(n);
      return k.length >= 5 && keys.some((t) => (` ${t} `).includes(` ${k} `));
    })
  );
}

/**
 * Génère un portrait. Avec une clé OpenAI : gpt-image-1. Sinon : Pollinations (gratuit, sans clé),
 * qui reçoit seulement la description visuelle. Le résultat est compressé avant d'être gardé.
 */
export async function generatePortrait(ai, prompt) {
  const full = `${prompt}. Dark fantasy tabletop RPG character portrait, painterly, dramatic lighting, centered bust, plain dark background, no text, no watermark.`;
  if (ai?.provider === 'openai' && ai.apiKey) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.apiKey },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: full, size: '1024x1024' }),
    });
    if (!res.ok) throw new Error('Génération d’image refusée (' + res.status + ').');
    const data = await res.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('Aucune image renvoyée.');
    return compressImage('data:image/png;base64,' + b64);
  }
  const seed = Math.floor(Math.random() * 1e6);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full.slice(0, 900))}?width=768&height=768&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Le service d’images gratuit ne répond pas (' + res.status + '). Réessaie plus tard.');
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Image illisible.'));
    r.readAsDataURL(blob);
  });
  return compressImage(dataUrl);
}
