/**
 * Canal entre la console MJ et l'écran joueur (deux fenêtres du même site, via BroadcastChannel).
 *
 * La console MJ est l'hôte : elle garde la scène courante et la renvoie à chaque écran joueur qui se connecte.
 * Rien n'est sauvegardé. Les données envoyées sont déjà filtrées pour les joueurs : aucune note ni repère secret.
 */
import type { AtlasData } from '../maps/atlas/types';

export type PlayerToken = { id: string; name: string; kind: 'pc' | 'monster' | 'other'; x: number; y: number; size: 1 | 2; icon?: string; image?: string };

/** Élément visible sur le plateau de combat : un point (cell) ou un passage (cells, déjà creusé dans le terrain). */
export type PlayerElement = { id: string; kind: 'passage' | 'point'; title: string; category: string; cell?: number };

/** Ce que voient les joueurs d'une carte ou d'un combat. */
export type PlayerBoard =
  /** `data` ne contient que le plan montré et ses lieux révélés. */
  | { mode: 'map'; title: string; planId: string; data: AtlasData; focus?: { id: string; tick: number } }
  | { mode: 'battle'; title: string; backdrop?: string; cols: number; rows: number; feetPerCell: number; round: number; tokens: PlayerToken[]; terrain?: string; elements: PlayerElement[] };

export type Stage =
  | { kind: 'blank' }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'image'; title: string; dataUrl: string }
  | { kind: 'board'; board: PlayerBoard };

export type StageMessage = { type: 'hello' } | { type: 'stage'; stage: Stage };

const CHANNEL = 'loresmith:stage:v1';

/** Nom de la fenêtre joueur : cliquer à nouveau sur « Ouvrir » réutilise la même fenêtre au lieu d'en créer une autre. */
export const PLAYER_VIEW_NAME = 'loresmith-joueurs';

/** Côté écran joueur : écoute la console et se présente. */
export function openStageChannel(onMessage: (m: StageMessage) => void) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<StageMessage>) => onMessage(e.data);
  return {
    send: (m: StageMessage) => channel.postMessage(m),
    close: () => channel.close(),
  };
}

/* ——— Côté console MJ : hôte unique ——— */

let host: BroadcastChannel | null = null;
let current: Stage = { kind: 'blank' };
const helloListeners = new Set<() => void>();

/** À appeler une fois dans la console MJ : répond aux écrans joueurs qui se connectent. */
export function hostStage() {
  if (host) return;
  host = new BroadcastChannel(CHANNEL);
  host.onmessage = (e: MessageEvent<StageMessage>) => {
    if (e.data?.type !== 'hello') return;
    host?.postMessage({ type: 'stage', stage: current } satisfies StageMessage);
    helloListeners.forEach((f) => f());
  };
}

/** Affiche une scène sur l'écran joueur et la mémorise pour les connexions suivantes. */
export function publishStage(stage: Stage) {
  hostStage();
  current = stage;
  host?.postMessage({ type: 'stage', stage } satisfies StageMessage);
}

/** Scène actuellement affichée côté joueurs. */
export const currentStage = () => current;

/** Préviens quand un écran joueur se connecte. Renvoie la fonction de désinscription. */
export function onPlayerHello(listener: () => void) {
  hostStage();
  helloListeners.add(listener);
  return () => { helloListeners.delete(listener); };
}
