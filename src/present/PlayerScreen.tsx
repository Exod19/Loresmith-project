/**
 * Écran joueur : la fenêtre à partager. Plein écran, sans menus ; elle affiche ce que la console MJ projette.
 * Les données reçues sont déjà filtrées (cf. maps/playerBoard.ts) : aucune note ni repère secret n'arrive ici.
 */
import { useEffect, useState } from 'react';
import MapCanvas, { type Layers } from '../maps/atlas/MapCanvas';
import { setAtlasData } from '../maps/atlas/model';
import type { AtlasData, FeatureCategory } from '../maps/atlas/types';
import BattleBoard, { CATEGORY_ICON } from '../maps/battle/BattleBoard';
import { CATEGORY_IMG, vignette } from '../maps/battle/vignettes';
import { openStageChannel, type PlayerBoard, type PlayerElement, type PlayerToken, type Stage } from './stage';
import '../maps/maps.css';
import '../maps/atlas/atlas.css';
import '../maps/battle/battle.css';
import './present.css';

const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const HIDDEN = new Set<FeatureCategory>();

// Ce qui est montré : un nouvel élément déclenche un fondu ; une mise à jour du même
// élément (jeton déplacé, repère révélé…) s'applique sans transition.
function stageKey(stage: Stage): string {
  if (stage.kind === 'image') return `image:${stage.title}:${stage.dataUrl.length}:${stage.dataUrl.slice(-48)}`;
  if (stage.kind === 'text') return `text:${stage.title}\n${stage.body}`;
  if (stage.kind === 'board') return stage.board.mode === 'map' ? `map:${stage.board.planId}` : 'battle';
  return 'blank';
}

type Layer = { id: number; key: string; stage: Stage; rev: number; leaving: boolean };
const FADE_OUT_MS = 700;

export default function PlayerScreen() {
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, key: 'blank', stage: { kind: 'blank' }, rev: 0, leaving: false }]);

  useEffect(() => {
    let next = 1;
    const link = openStageChannel((m) => {
      if (m.type !== 'stage') return;
      const key = stageKey(m.stage);
      setLayers((ls) => {
        const current = ls.find((l) => !l.leaving);
        // Même élément : on met à jour sur place (rev force la carte à relire ses données).
        if (current && current.key === key) return ls.map((l) => (l === current ? { ...l, stage: m.stage, rev: l.rev + 1 } : l));
        const id = next++;
        setTimeout(() => setLayers((now) => now.filter((l) => !l.leaving || l.id > id)), FADE_OUT_MS + 50);
        return [...ls.map((l) => ({ ...l, leaving: true })), { id, key, stage: m.stage, rev: 0, leaving: false }];
      });
    });
    link.send({ type: 'hello' });
    return () => link.close();
  }, []);

  return (
    <div className="present-screen">
      {layers.map((l) => (
        <div key={l.id} className="present-layer" data-leaving={l.leaving ? 1 : undefined} aria-hidden={l.leaving || undefined}>
          <Scene stage={l.stage} rev={l.rev} />
        </div>
      ))}
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
        focus={board.focus ? { kind: board.focus.kind, id: board.focus.id } : null}
        focusKey={board.focus ? String(board.focus.tick) : undefined}
      />
    </div>
  );
}

function PlayerBattle({ board }: { board: Extract<PlayerBoard, { mode: 'battle' }> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const card = openId ? cardFor(board, openId) : null;
  return (
    <div className="present-battle">
      <header className="present-battle-head">
        <span>{board.title}</span>
        <span>Round {board.round}</span>
      </header>
      <BattleBoard
        cols={board.cols} rows={board.rows} backdrop={board.backdrop} terrain={board.terrain} elements={board.elements} tokens={board.tokens}
        onElement={(id) => setOpenId((cur) => (cur === id ? null : id))}
      />
      {card && (
        <aside className="present-card" role="dialog" aria-label={card.title}>
          {card.image && <img className="present-card-img" src={card.image} alt={card.title} />}
          <div className="present-card-body">
            <button className="present-info-close" onClick={() => setOpenId(null)} aria-label="Fermer">×</button>
            <span className="present-info-kind">{card.icon && <>{card.icon} </>}{card.subtitle}</span>
            <h3>{card.title}</h3>
            {card.text && card.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </aside>
      )}
    </div>
  );
}

/** Contenu de la fiche d'un élément ou d'un jeton, tel que les joueurs le voient. */
function cardFor(board: Extract<PlayerBoard, { mode: 'battle' }>, id: string) {
  const el = board.elements.find((e) => e.id === id);
  if (el) {
    const image = el.info?.image ?? (CATEGORY_IMG[el.category] ? vignette(CATEGORY_IMG[el.category]) : undefined);
    return { title: el.title, subtitle: el.info?.subtitle ?? KIND_NAME[el.kind], icon: CATEGORY_ICON[el.category], text: el.info?.text, image };
  }
  const token = board.tokens.find((t) => t.id === id);
  if (token) return { title: token.name, subtitle: token.info?.subtitle ?? KIND_NAME_TOKEN[token.kind], icon: undefined, text: token.info?.text, image: token.info?.image };
  return null;
}

const KIND_NAME_TOKEN: Record<PlayerToken['kind'], string> = { pc: 'Compagnon', monster: 'Créature', other: 'Présence' };
const KIND_NAME: Record<PlayerElement['kind'], string> = { passage: 'Passage', point: 'Lieu' };
