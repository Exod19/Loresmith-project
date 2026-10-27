/**
 * Écran joueur : la fenêtre à partager. Plein écran, sans menus ; elle affiche ce que la console MJ projette.
 * Les données reçues sont déjà filtrées (cf. maps/playerBoard.ts) : aucune note ni repère secret n'arrive ici.
 */
import { useEffect, useState } from 'react';
import MapCanvas, { type Layers } from '../maps/atlas/MapCanvas';
import { setAtlasData } from '../maps/atlas/model';
import type { AtlasData, FeatureCategory } from '../maps/atlas/types';
import BattleBoard from '../maps/battle/BattleBoard';
import { openStageChannel, type PlayerBoard, type Stage } from './stage';
import '../maps/maps.css';
import '../maps/atlas/atlas.css';
import '../maps/battle/battle.css';
import './present.css';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const HIDDEN = new Set<FeatureCategory>();

export default function PlayerScreen() {
  const [stage, setStage] = useState<Stage>({ kind: 'blank' });
  // Compteur à chaque envoi : force la carte à relire ses données même si le plan ne change pas.
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const link = openStageChannel((m) => {
      if (m.type !== 'stage') return;
      setStage(m.stage);
      setRev((r) => r + 1);
    });
    link.send({ type: 'hello' });
    return () => link.close();
  }, []);

  return (
    <div className="present-screen">
      <Scene stage={stage} rev={rev} />
      <button className="present-fs" onClick={() => document.documentElement.requestFullscreen?.()}>
        Plein écran
      </button>
    </div>
  );
}

function Scene({ stage, rev }: { stage: Stage; rev: number }) {
  if (stage.kind === 'image') {
    return (
      <figure className="present-image">
        <img src={stage.dataUrl} alt={stage.title} />
        <figcaption>{stage.title}</figcaption>
      </figure>
    );
  }
  if (stage.kind === 'text') {
    return (
      <article className="present-text">
        <h1>{stage.title}</h1>
        <p>{stage.body}</p>
      </article>
    );
  }
  if (stage.kind === 'board') {
    return stage.board.mode === 'map'
      ? <PlayerMap board={stage.board} rev={rev} />
      : <PlayerBattle board={stage.board} />;
  }
  return (
    <div className="present-blank">
      <img src="/brand/loresmith-emblem-gold-transparent.png" alt="" />
    </div>
  );
}

function PlayerMap({ board, rev }: { board: Extract<PlayerBoard, { mode: 'map' }>; rev: number }) {
  setAtlasData(board.data as AtlasData);
  const map = board.data.maps.find((m) => m.id === board.planId) ?? board.data.maps[0];
  if (!map) return <p className="present-wait">Carte vide.</p>;
  return (
    <div className="maps-canvas present-map">
      <MapCanvas
        key={map.id} map={map} layers={LAYERS} hidden={HIDDEN} selectedId={null} onSelect={() => {}} onAnchor={() => {}} dm={false}
        dataKey={rev}
        focus={board.focus ? { kind: 'point', id: board.focus.id } : null}
        focusKey={board.focus ? String(board.focus.tick) : undefined}
      />
    </div>
  );
}

function PlayerBattle({ board }: { board: Extract<PlayerBoard, { mode: 'battle' }> }) {
  return (
    <div className="present-battle">
      <header className="present-battle-head">
        <span>{board.title}</span>
        <span>Round {board.round}</span>
      </header>
      <BattleBoard cols={board.cols} rows={board.rows} backdrop={board.backdrop} terrain={board.terrain} elements={board.elements} tokens={board.tokens} />
    </div>
  );
}
