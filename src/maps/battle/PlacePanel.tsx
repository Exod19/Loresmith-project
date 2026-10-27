/**
 * Le lieu, dans le panneau de la carte de combat : ce qu'on peut fouiller, les passages secrets, les sorties.
 * Chaque ligne porte le même repère que le plateau (F1, S1, E1) : survoler une ligne l'éclaire pour le MJ seulement,
 * sans rien révéler aux joueurs. Les galeries sans destination ne sont pas listées : elles restent sur le plateau.
 */
import type { ReactNode } from 'react';
import type { PartyPlace, PassageLink } from '../mapStore';
import type { SearchEntry } from './search';
import type { TrailProfile } from '../atlas/trails';
import { DangerChip } from '../TrailsPanel';

/** `seenBy` : le joueur qui le remarque sans chercher (Perception passive, à portée de vue). */
export type SearchItem = { id: string; label: string; title: string; entry: SearchEntry; shown: boolean; seenBy?: string };
export type SecretItem = { id: string; label: string; title: string; dc?: number; check?: string; found: boolean; link?: PassageLink; profile?: TrailProfile; seenBy?: string };
export type ExitItem = { id: string; label: string; title: string; link: PassageLink; toward: boolean; profile?: TrailProfile };
type LinkOption = { value: string; label: string; link: PassageLink };
/** Sorties affichées d'emblée ; les autres sont repliées (celles qui mènent à la destination passent en tête). */
const SHOWN_EXITS = 6;

type Props = {
  title: string;
  text?: string;
  dest?: PartyPlace;
  search: SearchItem[];
  secrets: SecretItem[];
  exits: ExitItem[];
  /** Galeries visibles sur le plateau mais sans destination connue. */
  others: number;
  options: LinkOption[];
  onOpen: (id: string) => void;
  onHover: (id: string | null) => void;
  onToggle: (id: string) => void;
  onFollow: (link: PassageLink) => void;
  onLink: (passageId: string, link: PassageLink | null) => void;
  legend?: ReactNode;
};

export default function PlacePanel({ title, text, dest, search, secrets, exits, others, options, onOpen, onHover, onToggle, onFollow, onLink, legend }: Props) {
  const hover = (id: string) => ({ onMouseEnter: () => onHover(id), onMouseLeave: () => onHover(null), onFocus: () => onHover(id), onBlur: () => onHover(null) });
  const toward = exits.filter((e) => e.toward);
  const exitRow = (e: ExitItem) => (
    <li key={e.id} {...hover(e.id)} data-toward={e.toward ? 1 : 0}>
      <span className="place-tag tone-exit">{e.label}</span>
      <span className="place-title"><button className="maps-link" onClick={() => onOpen(e.id)}>{e.title}</button> <small>→ {e.link.label}</small>{e.toward && <small className="place-toward"> 🎯</small>}</span>
      {e.profile && <span className="place-meta"><DangerChip profile={e.profile} /></span>}
      <button className="maps-btn gold" onClick={() => onFollow(e.link)}>Suivre ➜</button>
      <details className="place-edit">
        <summary title="Modifier la destination">✎</summary>
        <select className="maps-btn" value="" onChange={(ev) => { const o = options.find((x) => x.value === ev.target.value); if (o) onLink(e.id, o.link); else if (ev.target.value === 'clear') onLink(e.id, null); }}>
          <option value="">Nouvelle destination…</option>
          <option value="clear">Revenir à celle de l’Atlas</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </details>
    </li>
  );
  return (
    <div className="place-panel">
      <section className="maps-card place-head">
        <h3>{title}</h3>
        {text && <p className="maps-sub">{text}</p>}
        {dest && (
          <p className={`place-dest ${toward.length ? 'ok' : ''}`}>
            🎯 Le groupe veut rejoindre <b>{dest.title}</b>
            {toward.length
              ? <> : prendre {toward.map((e) => e.label).join(' ou ')}.</>
              : <> : aucune sortie connue d’ici n’y mène directement. Inscris une destination à une sortie (✎), ou suis la plus proche.</>}
          </p>
        )}
      </section>

      <section className="maps-card place-list is-search">
        <h4>À fouiller <small>({search.length})</small></h4>
        {search.length === 0 && <p className="maps-sub">Rien de notable à fouiller ici.</p>}
        <ul>
          {search.map((s) => (
            <li key={s.id} {...hover(s.id)}>
              <span className="place-tag tone-search">{s.label}</span>
              <button className="maps-link place-title" onClick={() => onOpen(s.id)}>{s.title}</button>
              <span className="place-meta">
                <small className="place-dc">{s.entry.skill} {s.entry.dc}</small>
                {s.seenBy && !s.shown && <small className="place-seen" title="Remarqué sans chercher (Perception passive, à portée de vue)">vu par {s.seenBy}</small>}
              </span>
              <button className="place-eye" title={s.shown ? 'Visible des joueurs (clic : cacher)' : 'Caché aux joueurs (clic : montrer)'} onClick={() => onToggle(s.id)}>{s.shown ? '👁' : '🙈'}</button>
            </li>
          ))}
        </ul>
      </section>

      {secrets.length > 0 && (
        <section className="maps-card place-list is-passages">
          <h4>Passages secrets <small>({secrets.filter((s) => s.found).length}/{secrets.length} découverts)</small></h4>
          <ul>
            {secrets.map((s) => (
              <li key={s.id} {...hover(s.id)} data-on={s.found ? 1 : 0}>
                <span className="place-tag tone-secret">{s.label}</span>
                <button className="maps-link place-title" onClick={() => onOpen(s.id)}>{s.title}</button>
                <span className="place-meta">
                  {s.profile && <DangerChip profile={s.profile} />}
                  {s.dc !== undefined && <small className="place-dc">{(s.check ?? 'Perception').replace(/^.*\((.*)\)$/, '$1')} {s.dc}</small>}
                  {s.seenBy && !s.found && <small className="place-seen">vu par {s.seenBy}</small>}
                </span>
                <button className={`maps-btn ${s.found ? '' : 'gold'}`} onClick={() => onToggle(s.id)} title={s.found ? 'Le recacher aux joueurs' : 'Les joueurs l’ont trouvé : le leur montrer'}>
                  {s.found ? '🔓 Trouvé' : '🔒 Caché'}
                </button>
                {s.found && s.link && <button className="maps-btn" onClick={() => onFollow(s.link!)} title={`Vers ${s.link.label}`}>Suivre ➜</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="maps-card place-list is-passages">
        <h4>Sorties <small>({exits.length})</small></h4>
        {exits.length === 0 && <p className="maps-sub">Aucune sortie dont la destination est connue.</p>}
        <ul>{exits.slice(0, SHOWN_EXITS).map(exitRow)}</ul>
        {exits.length > SHOWN_EXITS && (
          <details className="place-more">
            <summary>{exits.length - SHOWN_EXITS} autres sorties</summary>
            <ul>{exits.slice(SHOWN_EXITS).map(exitRow)}</ul>
          </details>
        )}
        {others > 0 && <p className="maps-sub">{others} autre{others > 1 ? 's' : ''} galerie{others > 1 ? 's' : ''} relie{others > 1 ? 'nt' : ''} des points du lieu : clique-en une sur le plateau pour sa fiche ou sa destination.</p>}
      </section>

      {legend}
    </div>
  );
}
