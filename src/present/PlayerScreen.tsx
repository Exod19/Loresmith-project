/**
 * Écran joueur : la fenêtre à partager. Plein écran, sans menus ; elle affiche ce que la console MJ projette.
 * Les données reçues sont déjà filtrées (cf. maps/playerBoard.ts) : aucune note ni repère secret n'arrive ici.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import MapCanvas, { journeyMs, type Layers } from '../maps/atlas/MapCanvas';
import { setAtlasData } from '../maps/atlas/model';
import type { AtlasData, AtlasFeature, FeatureCategory } from '../maps/atlas/types';
import BattleBoard, { CATEGORY_ICON, type BoardRange } from '../maps/battle/BattleBoard';
import { reachableCells } from '../maps/battle/ranges';
import { moveField, moverOf, occupancy, planMove, reachDetail, type MovePlan } from '../maps/battle/movement';
import { trailProfile } from '../maps/atlas/trails';
import { describe } from '../maps/atlas/lore';
import { CALM_MS, type HaltAlert } from '../maps/atlas/omens';
import { lengthOf, project, subpath, towardOf } from '../maps/journey';
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
    // Deux onglets MJ ouverts : seule compte la scène publiée en dernier (l'autre onglet renverrait un état périmé).
    let lastAt = 0;
    const link = openStageChannel((m) => {
      if (m.type !== 'stage') return;
      if (m.at !== undefined) { if (m.at < lastAt) return; lastAt = m.at; }
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
      ? <PlayerMap board={stage.board} rev={rev} onFollow={(featureId, dir) => sendToHost?.({ type: 'follow', featureId, dir })} onPick={(featureId) => sendToHost?.({ type: 'pick', featureId })} onFork={(key, choice) => sendToHost?.({ type: 'fork', key, choice })} />
      : <PlayerBattle board={stage.board} onAim={(from, to) => sendToHost?.({ type: 'aim', from, to })} onMove={(id, x, y) => sendToHost?.({ type: 'move', id, x, y })} />;
  }
  return (
    <div className="present-blank">
      <img src="/brand/loresmith-emblem-gold-transparent.png" alt="" />
    </div>
  );
}

function PlayerMap({ board, rev, onFollow, onPick, onFork }: { board: Extract<PlayerBoard, { mode: 'map' }>; rev: number; onFollow?: (featureId: string, dir?: 'a' | 'b') => void; onPick?: (featureId: string) => void; onFork?: (key: string, choice: 'out' | 'on') => void }) {
  setAtlasData(board.data as AtlasData);
  // Un lieu ou un chemin touché : sa fiche ; un chemin peut être suivi (le MJ valide, ou fait passer l'épreuve).
  const [picked, setPicked] = useState<AtlasFeature | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  useEffect(() => { setAsked(null); }, [board.travel?.key]);
  const map = board.data.maps.find((m) => m.id === board.planId) ?? board.data.maps[0];
  if (!map) return <p className="present-wait">Carte vide.</p>;
  return (
    <div className="maps-canvas present-map">
      <MapCanvas
        key={map.id} map={map} layers={LAYERS} hidden={HIDDEN} selectedId={picked?.id ?? null} onSelect={(f) => { setPicked((cur) => (cur?.id === f.id ? null : f)); if (f.trace && picked?.id !== f.id) onPick?.(f.id); }} onAnchor={() => {}} dm={false}
        dataKey={rev}
        focus={board.focus ? { kind: board.focus.kind, id: board.focus.id } : null}
        focusKey={board.focus ? String(board.focus.tick) : undefined}
        marks={board.marks} fog={board.fog} journey={board.travel}
      />
      {picked && (
        <aside className="present-map-card" role="dialog" aria-label={picked.title}>
          <button className="present-info-close" onClick={() => setPicked(null)} aria-label="Fermer">×</button>
          <span className="present-info-kind">{picked.trace ? TRACE_FR[picked.trace] ?? 'Chemin' : 'Lieu'}</span>
          <h3>{picked.title}</h3>
          {picked.subtitle && <p>{picked.subtitle}</p>}
          {(() => { const d = describe(picked); return d ? <p className="present-map-lore">{d}</p> : null; })()}
          {picked.trace && (() => {
            const danger = trailProfile(picked).danger;
            const dir = directionOf(board, picked.id);
            return (
              <>
                <p className="present-path-facts">
                  <span className={`present-danger lvl-${danger.level}`}>{danger.label}</span>
                  {dir && <span className="present-path-dir">🧭 {dir}</span>}
                </p>
                <p className="present-path-why">{danger.text} <small>({danger.why.join(', ')})</small></p>
              </>
            );
          })()}
          {picked.trace && onFollow && (
            asked === picked.id
              ? <p className="present-aim-wait">Le MJ décide si le groupe s’y engage…</p>
              : (() => {
                const dirs = directionsOf(board, picked.id);
                if (!dirs.length) return <p className="present-aim-wait">Le groupe n’est pas sur ce chemin.</p>;
                return (
                  <div className="present-path-go">
                    {dirs.map((d) => (
                      <button key={d.dir} className="present-aim-btn" onClick={() => { onFollow(picked.id, d.dir); setAsked(picked.id); }}>🚶 Vers {d.toward}</button>
                    ))}
                  </div>
                );
              })()
          )}
        </aside>
      )}
      {board.talk && board.talk.lines.length > 0 && <TalkBox key={board.talk.key} talk={board.talk} />}
      {board.alert && <HaltNotice key={board.alert.key} alert={board.alert} />}
      {board.fork && !board.alert && (
        <ForkPrompt key={board.fork.key} fork={board.fork} readyAt={board.travel ? board.travel.at + journeyMs(board.travel.points, map.width, map.height) : 0} onChoose={onFork} />
      )}
    </div>
  );
}

/**
 * Halte en chemin : le suspense monte (« C'est tranquille… trop tranquille… »), puis soit la fausse alerte s'éteint
 * d'elle-même, soit la rencontre apparaît avec son illustration.
 */
function HaltNotice({ alert }: { alert: HaltAlert }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (alert.phase !== 'calm') return;
    const id = setTimeout(() => setGone(true), Math.max(0, CALM_MS - (Date.now() - alert.at)));
    return () => clearTimeout(id);
  }, [alert]);
  if (gone) return null;
  if (alert.phase !== 'encounter') {
    return (
      <div className={`present-halt is-${alert.phase}`} role="status">
        <p>{alert.line}</p>
      </div>
    );
  }
  return (
    <div className={`present-halt is-encounter ${alert.image ? 'has-image' : ''}`} role="alert">
      <p className="present-halt-line">{alert.line}</p>
      {alert.image && <img src={alert.image} alt={alert.title ?? ''} />}
      {alert.title && <h2>{alert.title}</h2>}
      {alert.text && <p className="present-halt-text">{alert.text}</p>}
    </div>
  );
}

/**
 * Bifurcation en chemin : un passage s'ouvre à côté du sentier. La question monte une fois le jeton arrivé ; les
 * joueurs répondent (le MJ voit la réponse et peut aussi trancher de son côté).
 */
function ForkPrompt({ fork, readyAt, onChoose }: { fork: NonNullable<Extract<PlayerBoard, { mode: 'map' }>['fork']>; readyAt: number; onChoose?: (key: string, choice: 'out' | 'on') => void }) {
  const [, tick] = useState(0);
  const [sent, setSent] = useState<'out' | 'on' | null>(null);
  useEffect(() => {
    const left = readyAt - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => tick((n) => n + 1), left + 60);
    return () => clearTimeout(id);
  }, [readyAt]);
  if (Date.now() < readyAt) return null;
  const choose = (c: 'out' | 'on') => { setSent(c); onChoose?.(fork.key, c); };
  return (
    <div className="present-halt present-fork" role="dialog" aria-label="Bifurcation">
      <p>{fork.line}</p>
      <div className="present-fork-btns">
        <button type="button" className="maps-btn gold" data-on={sent === 'out' ? 1 : 0} onClick={() => choose('out')}>{fork.out}</button>
        <button type="button" className="maps-btn" data-on={sent === 'on' ? 1 : 0} onClick={() => choose('on')}>{fork.on}</button>
      </div>
      {sent && <small className="present-fork-sent">Demandé au MJ…</small>}
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
  /** Capacités d'un jeton (vitesses de sa fiche, déplacement du héros, modes accordés par le MJ). */
  const moverFor = (t: PlayerToken) => ({ ...moverOf({ size: t.size, move: t.move, modes: t.modes }, t.speed), occ: occupancy(board.cols, t, board.tokens) });
  /** Déplacement restant ce tour (envoyé par le MJ pour les héros). */
  const leftOf = (t: PlayerToken) => t.left ?? moverFor(t).speed;
  const from = (t: PlayerToken) => ({ x: t.x, y: t.y, layer: t.layer === 'pont' ? 'pont' as const : 'sol' as const });
  const dragToken = drag ? board.tokens.find((t) => t.id === drag.id) : undefined;
  const dragPlan: MovePlan | null = drag?.moved && dragToken && board.rules ? planMove(board.rules, moverFor(dragToken), from(dragToken), drag.cur, leftOf(dragToken)) : null;
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
      // Même règle que le MJ : un trajet impossible ou trop long n'est pas envoyé (le jeton revient à sa place).
      if (drag.moved && (!dragPlan || dragPlan.ok)) { dragged.current = true; onMove?.(drag.id, drag.cur.x, drag.cur.y); setTimeout(() => { dragged.current = false; }, 0); }
      setDrag(null);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [drag, onMove, dragPlan]);
  const tokens = drag?.moved ? board.tokens.map((t) => (t.id === drag.id ? { ...t, ...drag.cur } : t)) : board.tokens;

  // Héros dont on montre le déplacement et la portée : celui qu'on glisse, sinon celui dont c'est le tour, sinon la fiche ouverte.
  const activeHero = tokens.find((t) => t.kind === 'pc' && t.id === board.turn?.active);
  const hero = tokens.find((t) => t.id === drag?.id && drag?.moved) ?? activeHero ?? tokens.find((t) => t.kind === 'pc' && t.id === openId);
  // Déplacement (cases accessibles, plus coûteuses en ambre) depuis la case de départ ; allonge et portée depuis la case
  // visée pendant un glisser.
  const detail = (h: PlayerToken) => (board.rules ? reachDetail(moveField(board.rules, moverFor(h), from(h)), leftOf(h)) : { cells: reachableCells(board.terrain, board.cols, board.rows, h, hero?.move ?? 6), costly: [] });
  const draggingHero = !!hero && drag?.id === hero.id;
  const startOf = hero ? (draggingHero ? board.tokens.find((t) => t.id === hero.id)! : hero) : null;
  const moveDetail = hero && (showMove || draggingHero) ? detail(startOf!) : null;
  const ranges: BoardRange[] = hero && (showMove || showReach || draggingHero) ? [{
    id: hero.id, x: startOf!.x, y: startOf!.y, size: hero.size, selected: true,
    move: moveDetail?.cells ?? [], costly: moveDetail?.costly,
    attack: showReach && !draggingHero ? hero.reach?.melee ?? 1 : 0,
    ranged: showReach && !draggingHero ? hero.reach?.short ?? 0 : 0,
  }, ...(draggingHero ? [{ id: `${hero.id}-at`, x: hero.x, y: hero.y, size: hero.size, selected: true, move: [], attack: hero.reach?.melee ?? 1, ranged: hero.reach?.short ?? 0 }] : [])] : [];

  const centre = (id: string) => { const t = tokens.find((q) => q.id === id); return t && { x: t.x + t.size / 2, y: t.y + t.size / 2 }; };
  const a1 = board.aim && centre(board.aim.from), a2 = board.aim && centre(board.aim.to);
  const aim = a1 && a2 ? { x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, tone: board.aim!.tone } : undefined;
  /** Portrait d'un combattant dans l'annonce d'attaque (son illustration, sinon son jeton). */
  const duelPic = (id: string) => { const t = board.tokens.find((q) => q.id === id); const src = t?.info?.image || t?.image; return src ? <img className="present-verdict-pic" src={src} alt="" /> : null; };
  const fromName = board.aim && board.tokens.find((t) => t.id === board.aim!.from)?.name;
  const toName = board.aim && board.tokens.find((t) => t.id === board.aim!.to)?.name;
  const reach = hero?.reach;
  return (
    <div className="present-battle">
      <header className="present-battle-head">
        <span>{board.title}</span>
        <span className="present-toggles">
          <button type="button" aria-pressed={showMove} data-on={showMove ? 1 : undefined} onClick={() => setShowMove(!showMove)}>👣 Déplacement{showMove && hero ? ` · reste ${leftOf(hero) * board.feetPerCell} pi` : ''}</button>
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
          cols={board.cols} rows={board.rows} backdrop={board.backdrop} theme={board.theme} terrain={board.terrain} elements={board.elements} tokens={tokens} fog={board.fog} exits={board.exits}
          onElement={pick} aim={aim} ranges={ranges} hits={board.hits} ground={board.ground} surface={board.surface} aoes={board.aoes}
          path={dragPlan && dragToken ? {
            steps: dragPlan.possible ? dragPlan.steps : [from(dragToken), drag!.cur], size: dragToken.size, ok: dragPlan.ok, possible: dragPlan.possible,
            label: dragPlan.possible ? `${dragPlan.cost * board.feetPerCell} pi${dragPlan.ok ? '' : ' ⚠'}` : '⛔',
          } : undefined}
        />
        {dragPlan && (
          <div className={`present-move-info ${dragPlan.possible ? (dragPlan.ok ? '' : 'is-over') : 'is-blocked'}`} role="status">
            <b>{dragPlan.dest}</b>
            <span>{dragPlan.possible
              ? `${dragPlan.cost * board.feetPerCell} pieds${dragPlan.notes.length ? ` · ${dragPlan.notes.join(', ')}` : ''}${dragPlan.ok ? '' : ' · trop loin'}`
              : `⛔ ${dragPlan.reason}`}</span>
          </div>
        )}
        {aimer && <div className="present-aim-hint">🎯 {board.tokens.find((t) => t.id === aimer)?.name} vise : touche la cible sur le plateau.</div>}
        {!aimer && board.aim?.verdict ? (
          board.aim.damage !== undefined && (board.aim.verdict === 'hit' || board.aim.verdict === 'crit') ? (
            // Dégâts appliqués : ils prennent la place du « Touché ».
            <div key={`${board.aim.at}-dmg-${board.aim.damage}`} className={`present-verdict present-damage v-${board.aim.verdict}`} role="status" aria-live="assertive">
              <span className="present-verdict-dmg">−{board.aim.damage}<small>dégâts{board.aim.verdict === 'crit' ? ' · critique' : ''}</small></span>
              <p className="present-verdict-who">{duelPic(board.aim.from)}{fromName} → {duelPic(board.aim.to)}{toName}{board.aim.weapon ? ` · ${board.aim.weapon}` : ''}</p>
              {board.aim.line && <p className={`present-verdict-line narration-told imp-${board.aim.importance ?? 'minor'}`}>{board.aim.line}</p>}
            </div>
          ) : (
            <div key={`${board.aim.at}-${board.aim.verdict}`} className={`present-verdict v-${board.aim.verdict}`} role="status" aria-live="assertive">
              <div className="present-verdict-top">
                <b>{VERDICT_LABEL[board.aim.verdict]}</b>
                {board.aim.roll !== undefined && <span className="present-verdict-roll">{board.aim.roll}</span>}
              </div>
              <p className="present-verdict-who">{duelPic(board.aim.from)}{fromName} → {duelPic(board.aim.to)}{toName}{board.aim.weapon ? ` · ${board.aim.weapon}` : ''}</p>
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

const TRACE_FR: Record<string, string> = {
  tunnel: 'Tunnel', galerie: 'Galerie', boyau: 'Boyau', etroit: 'Passage étroit', crevasse: 'Crevasse',
  ruisseau: 'Ruisseau souterrain', secret: 'Passage dérobé',
};
const COMPASS = ['l’est', 'le nord-est', 'le nord', 'le nord-ouest', 'l’ouest', 'le sud-ouest', 'le sud', 'le sud-est'];
const toward = (dx: number, dy: number) => COMPASS[((Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];

/** Direction d'un chemin vue du groupe : il part vers… (depuis le bout le plus proche), sinon d'où à où il s'étire. */
function directionOf(board: Extract<PlayerBoard, { mode: 'map' }>, id: string): string | null {
  const g = board.data.geometries.find((x) => x.featureId === id && x.mapId === board.planId && x.type === 'polyline');
  if (!g) return null;
  const pts = g.coordinates as [number, number][];
  const a = pts[0], b = pts[pts.length - 1];
  if (board.here) {
    const h = board.here;
    // Le groupe touche ce chemin : il part vers le bout le plus éloigné (là où il mène), comme chez le MJ.
    const seg = (p: [number, number], q: [number, number]) => {
      const dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy || 1;
      const k = Math.max(0, Math.min(1, ((h[0] - p[0]) * dx + (h[1] - p[1]) * dy) / L));
      return Math.hypot(p[0] + k * dx - h[0], p[1] + k * dy - h[1]);
    };
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, seg(pts[i], pts[i + 1]));
    if (d < 0.04) {
      const far = Math.hypot(a[0] - h[0], a[1] - h[1]) > Math.hypot(b[0] - h[0], b[1] - h[1]) ? a : b;
      return `Part vers ${toward(far[0] - h[0], far[1] - h[1])}`;
    }
  }
  const from = toward(a[0] - b[0], a[1] - b[1]).replace(/^le /, 'du ').replace(/^l’/, 'de l’');
  return `S’étire ${from} vers ${toward(b[0] - a[0], b[1] - a[1])}`;
}

/** Directions que le groupe peut prendre sur un chemin qu'il touche : vers l'un ou l'autre bout (sans dire où il mène). */
function directionsOf(board: Extract<PlayerBoard, { mode: 'map' }>, id: string): { dir: 'a' | 'b'; toward: string }[] {
  const g = board.data.geometries.find((x) => x.featureId === id && x.mapId === board.planId && x.type === 'polyline');
  if (!g || !board.here) return [];
  const pts = g.coordinates as [number, number][];
  const here = project(pts, board.here);
  if (here.d > 0.04) return [];
  const L = lengthOf(pts);
  const out: { dir: 'a' | 'b'; toward: string }[] = [];
  for (const dir of ['a', 'b'] as const) {
    const end = dir === 'b' ? L : 0;
    if (Math.abs(end - here.s) < 0.012) continue;
    const route = subpath(pts, here.s, dir === 'b' ? Math.min(L, here.s + 0.05) : Math.max(0, here.s - 0.05));
    const far = route[route.length - 1];
    out.push({ dir, toward: towardOf(far[0] - board.here[0], far[1] - board.here[1]) });
  }
  return out;
}

/**
 * Conversation montrée aux joueurs : réduite à la dernière réplique d'un clic, ou fermée (×). Une nouvelle réplique la
 * rouvre en petit, pour ne pas reprendre toute la place.
 */
function TalkBox({ talk }: { talk: { key: string; name: string; image?: string; lines: { who: string; text: string }[]; at: number } }) {
  const [state, setState] = useState<'open' | 'small' | 'closed'>('open');
  const [seen, setSeen] = useState(talk.lines.length);
  useEffect(() => {
    if (talk.lines.length !== seen) { setSeen(talk.lines.length); setState((s) => (s === 'closed' ? 'small' : s)); }
  }, [talk.lines.length, seen]);
  if (state === 'closed') return null;
  const lines = state === 'small' ? talk.lines.slice(-1) : talk.lines.slice(-3);
  return (
    <div className={`present-talk${state === 'small' ? ' is-small' : ''}`} role="log" aria-live="polite">
      <div className="present-talk-head">
        {talk.image && <img src={talk.image} alt="" />}<b>{talk.name}</b>
        <span className="present-talk-tools">
          <button onClick={() => setState(state === 'small' ? 'open' : 'small')} aria-label={state === 'small' ? 'Agrandir la conversation' : 'Réduire la conversation'}>{state === 'small' ? '▴' : '▾'}</button>
          <button onClick={() => setState('closed')} aria-label="Fermer la conversation">×</button>
        </span>
      </div>
      {lines.map((l, i) => (
        <p key={`${talk.at}-${i}`} className={l.who === talk.name ? 'is-npc' : 'is-party'}><b>{l.who}</b> {l.text}</p>
      ))}
    </div>
  );
}
