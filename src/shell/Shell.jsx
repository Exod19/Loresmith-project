import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  ChevronDown,
  Dices,
  Download,
  ExternalLink,
  Feather,
  Flag,
  Globe,
  Image,
  Map as MapIcon,
  Menu,
  Monitor,
  ScrollText,
  Search,
  Settings,
  Skull,
  Sparkles,
  Swords,
  Upload,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import './shell.css';

// Navigation regroupée par moment d'usage : Monde → Préparation → Session.
export const NAV = [
  {
    id: 'monde',
    label: 'Monde',
    icon: Globe,
    items: [
      { view: 'dashboard', label: 'Univers', icon: Globe },
      { view: 'library', label: 'Bibliothèque', icon: BookOpen },
      { view: 'archives', label: 'Archives', icon: Archive },
      { view: 'maps', label: 'Cartes', icon: MapIcon },
      { view: 'bestiary', label: 'PNJ & créatures', icon: Skull },
      { view: 'party', label: 'Groupe de jeu', icon: Users },
      { view: 'assets', label: 'Images', icon: Image },
    ],
  },
  {
    id: 'prep',
    label: 'Préparation',
    icon: Feather,
    items: [
      { view: 'forge', label: 'Campagnes', icon: ScrollText },
      { view: 'chat', label: 'Générateur & voix', icon: Sparkles },
    ],
  },
  {
    id: 'session',
    label: 'Session',
    icon: Swords,
    items: [
      { view: 'present', label: 'Écran joueur', icon: Monitor },
      { view: 'scene', label: 'Table de jeu', icon: Feather },
      { view: 'encounter', label: 'Combat', icon: Swords },
      { view: 'quests', label: 'Quêtes', icon: Flag },
      { view: 'conjure', label: 'Improviser', icon: Wand2 },
    ],
  },
];

export function findNav(view) {
  for (const g of NAV) {
    const item = g.items.find((i) => i.view === view);
    if (item) return { group: g, item };
  }
  return { group: NAV[0], item: NAV[0].items[0] };
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
export const SHORTCUT = isMac ? '⌘K' : 'Ctrl K';

/* ------------------------------- Sidebar ------------------------------- */
export function Sidebar({
  view,
  setView,
  brand,
  universes,
  universe,
  universeImage,
  onSwitchUniverse,
  onOpenSearch,
  onOpenDice,
  onSettings,
  open,
  onClose,
}) {
  const current = findNav(view).group.id;
  const [openGroups, setOpenGroups] = useState(() => ({ [current]: true, monde: true }));
  useEffect(() => setOpenGroups((g) => ({ ...g, [current]: true })), [current]);

  function go(v) {
    setView(v);
    onClose?.();
  }

  return (
    <>
      <div className="lsx-scrim" data-open={open ? 1 : 0} onClick={onClose} aria-hidden="true" />
      <aside className="lsx-side" data-open={open ? 1 : 0} aria-label="Navigation principale">
        <div className="lsx-brand">
          <img className="lsx-brand-emblem" src={brand.emblem} alt="" />
          <div>
            <img className="lsx-brand-word" src={brand.wordmark} alt="Loresmith" />
            <span>Vos univers prennent vie</span>
          </div>
          <button className="lsx-side-close" onClick={onClose} aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>

        <nav className="lsx-nav">
          {NAV.map((g) => {
            const GIcon = g.icon;
            const isOpen = !!openGroups[g.id];
            const active = g.id === current;
            return (
              <div className="lsx-group" key={g.id} data-active={active ? 1 : 0}>
                <button
                  className="lsx-group-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !s[g.id] }))}
                >
                  <GIcon size={19} strokeWidth={1.6} aria-hidden="true" />
                  <span>{g.label}</span>
                  <ChevronDown size={15} className="lsx-chev" aria-hidden="true" />
                </button>
                <div className="lsx-group-items" hidden={!isOpen}>
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.view}
                        className="lsx-item"
                        data-on={view === it.view ? 1 : 0}
                        aria-current={view === it.view ? 'page' : undefined}
                        onClick={() => go(it.view)}
                      >
                        <Icon size={15} strokeWidth={1.6} aria-hidden="true" />
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="lsx-sep" />
        <button className="lsx-tool" onClick={() => { onOpenDice(); onClose?.(); }}>
          <Dices size={17} strokeWidth={1.6} aria-hidden="true" /> Lanceur de dés
        </button>
        <button className="lsx-tool" onClick={() => { onOpenSearch(); onClose?.(); }}>
          <Search size={17} strokeWidth={1.6} aria-hidden="true" /> Recherche globale
          <kbd>{SHORTCUT}</kbd>
        </button>

        <div className="lsx-sep" />
        <div className="lsx-label">Univers actif</div>
        <label className="lsx-universe">
          <span
            className="lsx-universe-img"
            style={universeImage ? { backgroundImage: `url("${universeImage}")` } : undefined}
            aria-hidden="true"
          />
          <span className="lsx-universe-name">{universe?.name || 'Aucun univers'}</span>
          <ChevronDown size={15} aria-hidden="true" />
          <select
            aria-label="Changer d'univers"
            value={universe?.id || ''}
            onChange={(e) => onSwitchUniverse(e.target.value)}
          >
            {universes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <div className="lsx-side-foot">
          <button className="lsx-tool" onClick={() => { onSettings(); onClose?.(); }}>
            <Settings size={17} strokeWidth={1.6} aria-hidden="true" /> Réglages de l'IA
          </button>
        </div>
      </aside>
    </>
  );
}

/* -------------------------------- Topbar ------------------------------- */
export function Topbar({ view, onMenu, onOpenSearch, onExport, onImport, onSettings, onPopout, saveState }) {
  const { group, item } = findNav(view);
  return (
    <header className="lsx-top">
      <button className="lsx-icon lsx-menu" onClick={onMenu} aria-label="Ouvrir le menu">
        <Menu size={19} />
      </button>
      <div className="lsx-crumb" aria-label="Fil d'Ariane">
        <span>{group.label}</span>
        <i aria-hidden="true">›</i>
        <b>{item.label}</b>
      </div>
      <button className="lsx-search" onClick={onOpenSearch}>
        <Search size={16} aria-hidden="true" />
        <span>Rechercher dans cet univers…</span>
        <kbd>{SHORTCUT}</kbd>
      </button>
      <div className="lsx-top-actions">
        <span
          className="lsx-save"
          data-state={saveState.status}
          title={saveState.message || ''}
          role="status"
        >
          <i aria-hidden="true" />
          {saveState.status === 'error' ? 'Sauvegarde échouée' : saveState.status === 'pending' ? 'Enregistrement…' : 'Enregistré'}
        </span>
        <button className="lsx-icon wide" title="Ouvrir la table de jeu dans un nouvel onglet" onClick={() => onPopout('scene')}>
          <ExternalLink size={14} aria-hidden="true" /> <span>Table</span>
        </button>
        <button className="lsx-icon wide" title="Ouvrir le combat dans un nouvel onglet" onClick={() => onPopout('encounter')}>
          <ExternalLink size={14} aria-hidden="true" /> <span>Combat</span>
        </button>
        <button className="lsx-icon" title="Exporter une sauvegarde (.json)" aria-label="Exporter une sauvegarde" onClick={onExport}>
          <Download size={16} aria-hidden="true" />
        </button>
        <button className="lsx-icon" title="Restaurer une sauvegarde (.json)" aria-label="Restaurer une sauvegarde" onClick={onImport}>
          <Upload size={16} aria-hidden="true" />
        </button>
        <button className="lsx-icon" title="Réglages de l'IA" aria-label="Réglages de l'IA" onClick={onSettings}>
          <Settings size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

/* --------------------------- Barre mobile ------------------------------ */
export function MobileBar({ view, setView, onOpenDice, onMenu }) {
  const items = [
    ['dashboard', 'Univers', Globe],
    ['library', 'Biblio', BookOpen],
    ['scene', 'Table', Feather],
    ['encounter', 'Combat', Swords],
  ];
  return (
    <nav className="lsx-mobilebar" aria-label="Navigation rapide">
      {items.slice(0, 2).map(([v, l, Icon]) => (
        <button key={v} data-on={view === v ? 1 : 0} onClick={() => setView(v)}>
          <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
          <span>{l}</span>
        </button>
      ))}
      <button className="lsx-mobile-dice" onClick={onOpenDice} aria-label="Lanceur de dés">
        <D20Glyph />
      </button>
      {items.slice(2).map(([v, l, Icon]) => (
        <button key={v} data-on={view === v ? 1 : 0} onClick={() => setView(v)}>
          <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
          <span>{l}</span>
        </button>
      ))}
      <button onClick={onMenu}>
        <Menu size={19} strokeWidth={1.6} aria-hidden="true" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

export function D20Glyph({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="lsx-d20">
      <path d="M32 3 58 18v28L32 61 6 46V18z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M32 3 18 26h28zM18 26 6 18M46 26l12-8M18 26l-12 20M46 26l12 20M18 26l14 23 14-23M32 49v12M32 49 6 46M32 49l26-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity=".75" />
      <text x="32" y="42" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="11" fontWeight="700" fill="currentColor">20</text>
    </svg>
  );
}

/* ---------------------------- Palette ⌘K ------------------------------- */
export function CommandPalette({ open, onClose, items, onPick }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = norm(q);
    const list = needle
      ? items.filter((it) => norm(`${it.label} ${it.hint || ''} ${it.kind}`).includes(needle))
      : items.filter((it) => it.kind === 'Page');
    return list.slice(0, 40);
  }, [q, items]);

  if (!open) return null;

  function onKey(e) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[idx]) {
      onPick(results[idx]);
    }
  }

  return (
    <div className="lsx-palette-scrim" onMouseDown={onClose}>
      <div className="lsx-palette" role="dialog" aria-label="Recherche globale" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lsx-palette-in">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={onKey}
            placeholder="Campagne, scène, PNJ, fiche, quête, page…"
            aria-label="Rechercher"
          />
          <kbd>Échap</kbd>
        </div>
        <ul className="lsx-palette-list" role="listbox">
          {results.length === 0 && <li className="lsx-palette-empty">Rien trouvé dans cet univers.</li>}
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === idx}>
              <button data-on={i === idx ? 1 : 0} onMouseEnter={() => setIdx(i)} onClick={() => onPick(r)}>
                <span className="lsx-palette-kind">{r.kind}</span>
                <span className="lsx-palette-label">{r.label}</span>
                {r.hint && <span className="lsx-palette-hint">{r.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
