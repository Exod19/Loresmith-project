/**
 * Écran joueur : la fenêtre à partager. Plein écran, sans menus ; elle affiche ce que la console MJ projette.
 * Les données reçues sont déjà filtrées (cf. maps/playerBoard.ts) : aucune note ni repère secret n'arrive ici.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import MapCanvas, { type Layers } from '../maps/atlas/MapCanvas';
import { setAtlasData } from '../maps/atlas/model';
import type { AtlasData, FeatureCategory } from '../maps/atlas/types';
import BattleBoard, { CATEGORY_ICON, type BoardRange } from '../maps/battle/BattleBoard';
import { reachableCells } from '../maps/battle/ranges';
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
      : <PlayerBattle board={stage.board} onAim={(from, to) => sendToHost?.({ type: 'aim', from, to })} onMove={(id, x, y) => sendToHost?.({ type: 'move', id, x, y })} />;
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

/** Préférence d'affichage de l'écran joueur (déplacement, portée), gardée sur cet appareil. */
function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => { try { const r = localStorage.getItem(key); return r === null ? initial : r === '1'; } catch { return initial; } });
  return [v, (next) => { setV(next); try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* préférence non gardée */ } }];
}

type BattleBoardData = Extract<PlayerBoard, { mode: 'battle' }>;
const VERDICT_LABEL = { crit: 'Coup critique !', hit: 'Touché !', miss: 'Raté', fumble: 'Échec critique !' } as const;

function PlayerBattle({ board, onAim, onMove }: { board: BattleBoardData; onAim?: (from: string, to: string) => void; onMove?: (id: string, x: number, y: number) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Un héros vise : le prochain jeton touché devient sa cible, et la déclaration part vers le MJ.
  const [aimer, setAimer] = useState<string | null>(null);
  const [showMove, setShowMove] = usePref('loresmith:joueurs:deplacement', false);
  const [showReach, setShowReach] = usePref('loresmith:joueurs:portee', false);
  // Glisser un jeton : il suit le doigt (ou la souris) ; la console MJ valide la case d'arrivée.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; cur: { x: number; y: number }; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const card = openId ? cardFor(board, openId) : null;
  const pick = (id: string) => {
    if (dragged.current) { dragged.current = false; return; }
    if (aimer) {
      if (id !== aimer && board.tokens.some((t) => t.id === id)) onAim?.(aimer, id);
      setAimer(null);
      return;
    }
    setOpenId((cur) => (cur === id ? null : id));
  };

  const cellAt = (clientX: number, clientY: number) => {
    const svg = wrapRef.current?.querySelector('svg.battle-board');
    if (!(svg instanceof SVGSVGElement)) return null;
    const r = svg.getBoundingClientRect();
    const k = Math.min(r.width / board.cols, r.height / board.rows);
    const x = Math.floor((clientX - (r.left + (r.width - board.cols * k) / 2)) / k);
    const y = Math.floor((clientY - (r.top + (r.height - board.rows * k) / 2)) / k);
    return x >= 0 && y >= 0 && x < board.cols && y < board.rows ? { x, y } : null;
  };
  const tokenAt = (c: { x: number; y: number }) => [...board.tokens].reverse().find((t) => c.x >= t.x && c.x < t.x + t.size && c.y >= t.y && c.y < t.y + t.size);
  const down = (e: ReactPointerEvent) => {
    if (aimer || !onMove || e.button !== 0) return;
    const c = cellAt(e.clientX, e.clientY);
    const t = c && tokenAt(c);
    if (!c || !t) return;
    dragged.current = false;
    setDrag({ id: t.id, dx: c.x - t.x, dy: c.y - t.y, cur: { x: t.x, y: t.y }, moved: false });
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    const t = board.tokens.find((q) => q.id === drag.id);
    const at = { x: Math.max(0, Math.min(board.cols - (t?.size ?? 1), c.x - drag.dx)), y: Math.max(0, Math.min(board.rows - (t?.size ?? 1), c.y - drag.dy)) };
    if (at.x !== drag.cur.x || at.y !== drag.cur.y) setDrag({ ...drag, cur: at, moved: true });
  };
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      if (drag.moved) { dragged.current = true; onMove?.(drag.id, drag.cur.x, drag.cur.y); setTimeout(() => { dragged.current = false; }, 0); }
      setDrag(null);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [drag, onMove]);
  const tokens = drag?.moved ? board.tokens.map((t) => (t.id === drag.id ? { ...t, ...drag.cur } : t)) : board.tokens;

  // Héros dont on montre le déplacement et la portée : celui qu'on glisse, sinon celui dont c'est le tour, sinon la fiche ouverte.
  const activeHero = tokens.find((t) => t.kind === 'pc' && t.id === board.turn?.active);
  const hero = tokens.find((t) => t.kind === 'pc' && t.id === drag?.id) ?? activeHero ?? tokens.find((t) => t.kind === 'pc' && t.id === openId);
  const ranges: BoardRange[] = hero && (showMove || showReach || drag?.id === hero.id) ? [{
    id: hero.id, x: hero.x, y: hero.y, size: hero.size, selected: true,
    move: showMove || drag?.id === hero.id ? reachableCells(board.terrain, board.cols, board.rows, drag?.id === hero.id ? board.tokens.find((t) => t.id === hero.id)! : hero, hero.move ?? 6) : [],
    attack: showReach ? hero.reach?.melee ?? 1 : 0,
    ranged: showReach ? hero.reach?.short ?? 0 : 0,
  }] : [];

  const centre = (id: string) => { const t = tokens.find((q) => q.id === id); return t && { x: t.x + t.size / 2, y: t.y + t.size / 2 }; };
  const a1 = board.aim && centre(board.aim.from), a2 = board.aim && centre(board.aim.to);
  const aim = a1 && a2 ? { x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, tone: board.aim!.tone } : undefined;
  const fromName = board.aim && board.tokens.find((t) => t.id === board.aim!.from)?.name;
  const toName = board.aim && board.tokens.find((t) => t.id === board.aim!.to)?.name;
  const reach = hero?.reach;
  return (
    <div className="present-battle">
      <header className="present-battle-head">
        <span>{board.title}</span>
        <span className="present-toggles">
          <button type="button" aria-pressed={showMove} data-on={showMove ? 1 : undefined} onClick={() => setShowMove(!showMove)}>👣 Déplacement{showMove && hero?.move ? ` · ${hero.move} cases` : ''}</button>
          <button type="button" aria-pressed={showReach} data-on={showReach ? 1 : undefined} onClick={() => setShowReach(!showReach)}>
            ⚔ Portée{showReach && reach ? ` · ${reach.weapon ?? 'arme'} : ${reach.short ? `${reach.short * board.feetPerCell}/${reach.long * board.feetPerCell} pi` : `allonge ${(reach.melee || 1) * board.feetPerCell} pi`}` : ''}
          </button>
        </span>
        <span>Round {board.round}</span>
      </header>
      {board.turn && <TurnStrip turn={board.turn} onOpen={(id) => setOpenId((cur) => (cur === id ? null : id))} />}
      <div
        className="present-battle-body" data-card={card ? 1 : undefined} data-dragging={drag ? 1 : undefined}
        ref={wrapRef} onPointerDown={down} onPointerMove={move}
      >
        <BattleBoard
          cols={board.cols} rows={board.rows} backdrop={board.backdrop} terrain={board.terrain} elements={board.elements} tokens={tokens} fog={board.fog} exits={board.exits}
          onElement={pick} aim={aim} ranges={ranges} hits={board.hits}
        />
        {aimer && <div className="present-aim-hint">🎯 {board.tokens.find((t) => t.id === aimer)?.name} vise : touche la cible sur le plateau.</div>}
        {!aimer && board.aim?.verdict ? (
          board.aim.damage !== undefined && (board.aim.verdict === 'hit' || board.aim.verdict === 'crit') ? (
            // Dégâts appliqués : ils prennent la place du « Touché ».
            <div key={`${board.aim.at}-dmg-${board.aim.damage}`} className={`present-verdict present-damage v-${board.aim.verdict}`} role="status" aria-live="assertive">
              <span className="present-verdict-dmg">−{board.aim.damage}<small>dégâts{board.aim.verdict === 'crit' ? ' · critique' : ''}</small></span>
              <p className="present-verdict-who">{fromName} → {toName}{board.aim.weapon ? ` · ${board.aim.weapon}` : ''}</p>
              {board.aim.line && <p className={`present-verdict-line narration-told imp-${board.aim.importance ?? 'minor'}`}>{board.aim.line}</p>}
            </div>
          ) : (
            <div key={`${board.aim.at}-${board.aim.verdict}`} className={`present-verdict v-${board.aim.verdict}`} role="status" aria-live="assertive">
              <div className="present-verdict-top">
                <b>{VERDICT_LABEL[board.aim.verdict]}</b>
                {board.aim.roll !== undefined && <span className="present-verdict-roll">{board.aim.roll}</span>}
              </div>
              <p className="present-verdict-who">{fromName} → {toName}{board.aim.weapon ? ` · ${board.aim.weapon}` : ''}</p>
              {board.aim.line && <p className={`present-verdict-line narration-told imp-${board.aim.importance ?? 'minor'}`}>{board.aim.line}</p>}
            </div>
          )
        ) : !aimer && board.aim?.text ? <div key={board.aim.text} className={`present-aim-result tone-${board.aim.tone ?? 'info'}`}>{board.aim.text}</div> : null}
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
              {(card.kind === 'pc' || card.kind === 'creature') && onAim && board.tokens.some((t) => t.id !== openId && (t.kind === 'pc') !== (card.kind === 'pc')) && (
                openId === board.turn?.active
                  ? <button className={`present-aim-btn ${card.kind === 'creature' ? 'foe' : ''}`} onClick={() => { setAimer(openId); setOpenId(null); }}>🎯 Attaquer une cible</button>
                  : <p className="present-aim-wait">{card.title} attaquera à son tour.</p>
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
  const next = turn.order.slice(now ? 1 : 0, (now ? 1 : 0) + 5);
  const face = (o: PlayerTurn['order'][number]) => (o.image
    ? <img src={o.image} alt="" />
    : <span className="present-turn-initial">{o.name.charAt(0)}</span>);
  return (
    <div className="present-turn" role="status" aria-live="polite">
      {now ? (
        <button key={now.id} className={`present-turn-now kind-${now.kind}`} onClick={() => onOpen(now.id)} title="Ouvrir sa fiche (et attaquer)">
          <span className="present-turn-portrait">{face(now)}</span>
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
          {next.map((o, i) => (
            <li key={o.id} className={`kind-${o.kind}`} style={{ '--i': i } as CSSProperties} onClick={() => onOpen(o.id)} title={o.state ? `${o.name} · ${o.state}` : o.name}>
              <span className="present-turn-portrait">{face(o)}</span>
              <span className="present-turn-name">{o.name}</span>
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
