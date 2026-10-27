/**
 * Canal entre la console MJ et l'écran joueur (deux fenêtres du même site, via BroadcastChannel).
 *
 * Rien n'est sauvegardé : ce qui est affiché vit le temps de la session. Un écran joueur qui se connecte
 * dit « bonjour » et reçoit aussitôt la scène en cours.
 */
export type Stage =
  | { kind: 'blank' }
  | { kind: 'text'; title: string; body: string }
  | { kind: 'image'; title: string; dataUrl: string }
  /** `mapId` : identifiant de la carte dans le stockage ; `planId` : plan à afficher (cf. mapIdOf). */
  | { kind: 'map'; mapId: string; planId: string };

export type StageMessage = { type: 'hello' } | { type: 'stage'; stage: Stage };

const CHANNEL = 'loresmith:stage:v1';

/** Nom de la fenêtre joueur : cliquer à nouveau sur « Ouvrir » réutilise la même fenêtre au lieu d'en créer une autre. */
export const PLAYER_VIEW_NAME = 'loresmith-joueurs';

export function openStageChannel(onMessage: (m: StageMessage) => void) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<StageMessage>) => onMessage(e.data);
  return {
    send: (m: StageMessage) => channel.postMessage(m),
    close: () => channel.close(),
  };
}
