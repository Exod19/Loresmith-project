/**
 * Canal entre la console MJ et l'écran joueur (deux fenêtres du même site, via BroadcastChannel).
 *
 * La console MJ est l'hôte : elle garde la scène courante et la renvoie à chaque écran joueur qui se connecte.
 * Rien n'est sauvegardé. Les données envoyées sont déjà filtrées pour les joueurs : aucune note ni repère secret.
 */
import type { AtlasData } from '../maps/atlas/types';

/** `info` : fiche en jeu montrée quand un joueur clique sur le jeton. */
export type PlayerToken = { id: string; name: string; kind: 'pc' | 'monster' | 'other'; x: number; y: number; size: 1 | 2; icon?: string; image?: string; statId?: string; info?: { subtitle?: string; text?: string; image?: string };
  /** C'est son tour. PV : chiffres pour les héros seulement ; les créatures n'ont qu'un état en mots. */
  active?: boolean; hp?: number; maxHp?: number; state?: string;
  /** Héros : déplacement en cases et portée de l'arme en main (allonge, portée courte et longue, en cases). */
  move?: number; reach?: { melee: number; short: number; long: number; weapon?: string } };

/** Dégâts (amount < 0) ou soins reçus par un jeton, écrits en grand au-dessus de lui. */
export type BoardHit = { id: string; to: string; amount: number; at: number };

/** Ordre d'initiative montré aux joueurs : seulement les combattants visibles. `active` : null si celui qui joue est caché. */
export type PlayerTurn = { active: string | null; order: { id: string; name: string; kind: PlayerToken['kind']; image?: string; state?: string }[] };

/** Élément visible sur le plateau de combat : un point (cell) ou un passage (cells, déjà creusé dans le terrain). */
/** `cells` : cases d'un passage ; `secret` : passage découvert par les joueurs (teinte propre). */
export type PlayerElement = { id: string; kind: 'passage' | 'point'; title: string; category: string; cell?: number; cells?: number[]; secret?: boolean; image?: string;
  /** Texte montré dans l'encadré d'un élément (joueurs) : rien n'est envoyé s'il n'est pas visible. */
  info?: { subtitle?: string; text?: string; image?: string };
};

/** Ce que voient les joueurs d'une carte ou d'un combat. */
export type PlayerBoard =
  /** `data` ne contient que le plan montré et ses lieux révélés. */
  | { mode: 'map'; title: string; planId: string; data: AtlasData; focus?: { kind: 'anchor' | 'point'; id: string; tick: number } }
  | { mode: 'battle'; title: string; backdrop?: string; cols: number; rows: number; feetPerCell: number; round: number; tokens: PlayerToken[]; terrain?: string; elements: PlayerElement[]; turn?: PlayerTurn;
    /** Brouillard de guerre : cases vues par les héros, et déjà explorées. Absent = tout le plateau est visible. */
    fog?: { visible: number[]; explored: number[] };
    /** Sorties au bord du plateau, avec leur destination si les héros la connaissent. */
    exits?: { cell: number; dir: 'n' | 's' | 'e' | 'w'; label: string; known: boolean }[];
    /** Attaque en cours : trait de l'attaquant à la cible, et résultat annoncé. */
    aim?: { from: string; to: string; text?: string; tone?: 'hit' | 'miss' | 'crit' | 'info'; at?: number;
      /** Verdict du jet pour toucher, total obtenu, phrase de récit, et dégâts infligés une fois appliqués. */
      verdict?: 'hit' | 'crit' | 'miss' | 'fumble'; roll?: number; line?: string; damage?: number; weapon?: string };
    /** Dégâts et soins récents, à écrire en grand sur le plateau. */
    hits?: BoardHit[] };

export type Stage =
  | { kind: 'blank' }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'image'; title: string; dataUrl: string }
  | { kind: 'board'; board: PlayerBoard };

/** `aim` : depuis l'écran joueur, un héros déclare qu'il attaque une cible (le MJ résout). */
/** `move` : depuis l'écran joueur, un jeton est glissé sur une autre case (le MJ valide). */
export type StageMessage = { type: 'hello' } | { type: 'stage'; stage: Stage } | { type: 'aim'; from: string; to: string } | { type: 'move'; id: string; x: number; y: number };

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
const aimListeners = new Set<(from: string, to: string) => void>();
const moveListeners = new Set<(id: string, x: number, y: number) => void>();

/** À appeler une fois dans la console MJ : répond aux écrans joueurs qui se connectent. */
export function hostStage() {
  if (host) return;
  host = new BroadcastChannel(CHANNEL);
  host.onmessage = (e: MessageEvent<StageMessage>) => {
    if (e.data?.type === 'aim') { const { from, to } = e.data; aimListeners.forEach((f) => f(from, to)); return; }
    if (e.data?.type === 'move') { const { id, x, y } = e.data; moveListeners.forEach((f) => f(id, x, y)); return; }
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

/** Préviens quand un joueur déclare une attaque depuis l'écran joueur. Renvoie la fonction de désinscription. */
export function onPlayerAim(listener: (from: string, to: string) => void) {
  hostStage();
  aimListeners.add(listener);
  return () => { aimListeners.delete(listener); };
}

/** Préviens quand un jeton est glissé depuis l'écran joueur. Renvoie la fonction de désinscription. */
export function onPlayerMove(listener: (id: string, x: number, y: number) => void) {
  hostStage();
  moveListeners.add(listener);
  return () => { moveListeners.delete(listener); };
}
