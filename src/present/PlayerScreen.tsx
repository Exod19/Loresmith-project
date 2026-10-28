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
import { openStageChannel, type PlayerBoard, type PlayerElement, type PlayerToken, type PlayerTurn, type Stage, type StageMessage } from './stage';
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

/** Lien vers la console MJ, pour les déclarations d'attaque faites depuis l'écran joueur. */
let sendToHost: ((m: StageMessage) => void) | null = null;

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
    sendToHost = link.send;
    link.send({ type: 'hello' });
    return () => { sendToHost = null; link.close(); };
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
      : <PlayerBattle board={stage.board} onAim={(from, to) => sendToHost?.({ type: 'aim', from, to })} />;
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

function PlayerBattle({ board, onAim }: { board: Extract<PlayerBoard, { mode: 'battle' }>; onAim?: (from: string, to: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Un héros vise : le prochain jeton touché devient sa cible, et la déclaration part vers le MJ.
  const [aimer, setAimer] = useState<string | null>(null);
  const card = openId ? cardFor(board, openId) : null;
  const pick = (id: string) => {
    if (aimer) {
      if (id !== aimer && board.tokens.some((t) => t.id === id)) onAim?.(aimer, id);
      setAimer(null);
      return;
    }
    setOpenId((cur) => (cur === id ? null : id));
  };
  const centre = (id: string) => { const t = board.tokens.find((q) => q.id === id); return t && { x: t.x + t.size / 2, y: t.y + t.size / 2 }; };
  const a1 = board.aim && centre(board.aim.from), a2 = board.aim && centre(board.aim.to);
  const aim = a1 && a2 ? { x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, tone: board.aim!.tone } : undefined;
  return (
    <div className="present-battle">
      <header className="present-battle-head">
        <span>{board.title}</span>
        <span>Round {board.round}</span>
      </header>
      {board.turn && <TurnStrip turn={board.turn} onOpen={(id) => setOpenId((cur) => (cur === id ? null : id))} />}
      {aimer && <div className="present-aim-hint">🎯 {board.tokens.find((t) => t.id === aimer)?.name} vise : touche la cible sur le plateau.</div>}
      {!aimer && board.aim?.text && <div key={board.aim.text} className={`present-aim-result tone-${board.aim.tone ?? 'info'}`}>{board.aim.text}</div>}
      <div className="present-battle-body" data-card={card ? 1 : undefined}>
        <BattleBoard
          cols={board.cols} rows={board.rows} backdrop={board.backdrop} terrain={board.terrain} elements={board.elements} tokens={board.tokens} fog={board.fog} exits={board.exits}
          onElement={pick} aim={aim}
        />
        {card && (
          <aside key={openId} className="present-card" data-kind={card.kind} role="dialog" aria-label={card.title}>
            <button className="present-info-close" onClick={() => setOpenId(null)} aria-label="Fermer">×</button>
            {card.image && (
              <figure className="present-card-hero">
                <img src={card.image} alt="" />
              </figure>
            )}
            <div className="present-card-body">
              <span className="present-info-kind">{card.icon && <>{card.icon} </>}{card.subtitle}</span>
              <h3>{card.title}</h3>
              {card.text && card.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
              {card.kind === 'pc' && onAim && board.tokens.some((t) => t.kind !== 'pc') && (
                <button className="present-aim-btn" onClick={() => { setAimer(openId); setOpenId(null); }}>🎯 Attaquer une cible</button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Bandeau d'initiative : celui qui joue en grand (avatar ou illustration), puis les suivants en petites vignettes.
 * Les créatures n'affichent qu'un état en mots. Rejouer l'animation à chaque changement de tour (clé = id actif).
 */
function TurnStrip({ turn, onOpen }: { turn: PlayerTurn; onOpen: (id: string) => void }) {
  const now = turn.active && turn.order[0]?.id === turn.active ? turn.order[0] : null;
  const next = turn.order.slice(now ? 1 : 0, (now ? 1 : 0) + 3);
  return (
    <div className="present-turn" role="status" aria-live="polite">
      {now ? (
        <button key={now.id} className={`present-turn-now kind-${now.kind}`} onClick={() => onOpen(now.id)}>
          {now.image ? <img src={now.image} alt="" /> : <span className="present-turn-initial">{now.name.charAt(0)}</span>}
          <span className="present-turn-text">
            <small>Au tour de</small>
            <b>{now.name}</b>
            {now.state && <em>{now.state}</em>}
          </span>
        </button>
      ) : (
        <div className="present-turn-now waiting"><span className="present-turn-text"><small>Le combat continue…</small></span></div>
      )}
      {next.length > 0 && (
        <ol className="present-turn-next" aria-label="Ensuite">
          <li className="present-turn-label">Ensuite</li>
          {next.map((o) => (
            <li key={o.id} className={`kind-${o.kind}`} onClick={() => onOpen(o.id)} title={o.state ? `${o.name} · ${o.state}` : o.name}>
              {o.image ? <img src={o.image} alt="" /> : <span className="present-turn-initial">{o.name.charAt(0)}</span>}
              <span>{o.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Contenu de la fiche d'un élément ou d'un jeton, tel que les joueurs le voient. */
function cardFor(board: Extract<PlayerBoard, { mode: 'battle' }>, id: string) {
  const el = board.elements.find((e) => e.id === id);
  if (el) {
    const image = el.info?.image ?? (CATEGORY_IMG[el.category] ? vignette(CATEGORY_IMG[el.category]) : undefined);
    const kind = el.kind === 'passage' ? (el.secret ? 'secret' : 'passage') : el.info?.subtitle === 'Objet' ? 'butin' : 'lieu';
    return { kind, title: el.title, subtitle: el.info?.subtitle ?? KIND_NAME[el.kind], icon: CATEGORY_ICON[el.category], text: el.info?.text, image };
  }
  const token = board.tokens.find((t) => t.id === id);
  if (token) {
    const kind = token.kind === 'monster' ? 'creature' : token.kind === 'pc' ? 'pc' : 'repere';
    return { kind, title: token.name, subtitle: [token.info?.subtitle ?? KIND_NAME_TOKEN[token.kind], token.state].filter(Boolean).join(' · '), icon: undefined, text: token.info?.text, image: token.info?.image };
  }
  return null;
}

const KIND_NAME_TOKEN: Record<PlayerToken['kind'], string> = { pc: 'Compagnon', monster: 'Créature', other: 'Présence' };
const KIND_NAME: Record<PlayerElement['kind'], string> = { passage: 'Passage', point: 'Lieu' };
