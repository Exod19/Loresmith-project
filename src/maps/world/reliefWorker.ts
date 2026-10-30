/** Calcule les pixels du relief hors du fil principal (l'interface ne gèle pas pendant le dessin). */
import { renderRelief, type Relief } from './terrain';

self.onmessage = (ev: MessageEvent<{ key: string; relief: Relief; w: number; h: number; win?: [number, number, number, number] }>) => {
  const { key, relief, w, h, win } = ev.data;
  const px = renderRelief(relief, w, h, win);
  (self as unknown as Worker).postMessage({ key, px, w, h }, [px.buffer]);
};
