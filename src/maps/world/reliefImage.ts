/**
 * Image du relief d'un monde à l'échelle : calculée par un « worker » (repli sur le fil principal), puis gardée en
 * mémoire. Pendant un nouveau calcul (saison changée…), l'image précédente reste affichée.
 */
import { useEffect, useState } from 'react';
import { renderRelief, type Relief } from './terrain';

const cache = new Map<string, string>();
const MAX_PX = 820;

function toUrl(px: Uint8ClampedArray, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
  return c.toDataURL('image/jpeg', 0.9);
}

let worker: Worker | null | undefined;
const waiting = new Map<string, ((url: string) => void)[]>();
function render(key: string, relief: Relief, w: number, h: number): Promise<string> {
  return new Promise((resolve) => {
    const list = waiting.get(key);
    if (list) { list.push(resolve); return; }
    waiting.set(key, [resolve]);
    const done = (url: string) => { cache.set(key, url); if (cache.size > 6) cache.delete(cache.keys().next().value!); for (const f of waiting.get(key) ?? []) f(url); waiting.delete(key); };
    if (worker === undefined) {
      try {
        worker = new Worker(new URL('./reliefWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (ev: MessageEvent<{ key: string; px: Uint8ClampedArray; w: number; h: number }>) => {
          const pending = waiting.get(ev.data.key);
          if (pending) { const url = toUrl(ev.data.px, ev.data.w, ev.data.h); cache.set(ev.data.key, url); for (const f of pending) f(url); waiting.delete(ev.data.key); }
        };
        worker.onerror = () => { worker = null; };
      } catch { worker = null; }
    }
    if (worker) worker.postMessage({ key, relief, w, h });
    else setTimeout(() => done(toUrl(renderRelief(relief, w, h), w, h)), 0);
  });
}

/** URL (image) du relief, ou `null` tant qu'elle se calcule. */
export function useReliefImage(relief: Relief | undefined, W: number, H: number): string | null {
  const key = relief ? JSON.stringify(relief) : '';
  const [url, setUrl] = useState<string | null>(() => (key ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!relief) { setUrl(null); return; }
    const hit = cache.get(key);
    if (hit) { setUrl(hit); return; }
    let alive = true;
    const w = Math.min(MAX_PX, Math.round(W)), h = Math.max(1, Math.round((w * H) / W));
    void render(key, relief, w, h).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, W, H]);
  return relief ? url : null;
}
