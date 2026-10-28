import {
  Archive,
  BookOpen,
  ChevronRight,
  Flag,
  Map as MapIcon,
  Play,
  ScrollText,
  Skull,
  Users,
  Wand2,
} from 'lucide-react';

// Décors utilisés tant que l'univers ou la campagne n'a pas sa propre image.
const UI = '/images/ui/';
export const DECOR = {
  hero: UI + 'hero.webp',
  cards: ['c-tours', 'c-champignons', 'c-lac', 'c-temple', 'c-bazar', 'c-pont'].map((n) => `${UI}${n}.webp`),
  avatar: UI + 'avatar.webp',
};

const SCENE_TYPES = {
  exploration: 'Exploration',
  social: 'Dialogue',
  combat: 'Combat',
  puzzle: 'Énigme',
  investigation: 'Enquête',
};

const ago = (t) => {
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`;
};

/**
 * Accueil d'un univers : bannière, campagnes, « à ne pas manquer » et colonne latérale.
 * Tout est calculé à partir des données existantes ; rien n'est inventé.
 */
export default function UniverseHome({
  universe,
  heroImage,
  campaigns,
  party,
  npcs,
  quests,
  library,
  log,
  campaignImage,
  portrait,
  libraryImage,
  setView,
}) {
  const main = campaigns[0] || null;
  const nextScene = main?.scenes?.[0] || null;
  const openQuests = quests
    .map((q) => {
      const cps = q.checkpoints || [];
      const done = cps.filter((c) => c.done).length;
      return { ...q, done, total: cps.length };
    })
    .filter((q) => !q.total || q.done < q.total)
    .slice(0, 3);
  const recentEntries = [...library]
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 3);
  const lastLog = log[0] || null;

  return (
    <div className="lsx-home">
      <div className="lsx-home-main">
        <section className="lsx-hero" style={{ '--hero': `url("${heroImage || DECOR.hero}")` }}>
          <span className="lsx-hero-frame" aria-hidden="true" />
          <div className="lsx-hero-body">
            <span className="lsx-kicker">Univers actif</span>
            <h1>{universe.name}</h1>
            {(universe.tone || universe.lore) && (
              <p>{clip(universe.lore || universe.tone, 260)}</p>
            )}
            <div className="lsx-hero-cta">
              <button className="lsx-cta" onClick={() => setView('scene')}>
                <Play size={18} aria-hidden="true" />
                <span>
                  <b>{main ? 'Reprendre la partie' : 'Ouvrir la table de jeu'}</b>
                  <small>{main ? `${main.title}${nextScene ? ' • ' + nextScene.title : ''}` : 'Aucune campagne encore'}</small>
                </span>
              </button>
              <button className="lsx-cta ghost" onClick={() => setView('library')}>
                <BookOpen size={18} aria-hidden="true" />
                <span>
                  <b>Canon de l'univers</b>
                  <small>{library.length} fiche{library.length > 1 ? 's' : ''} • peuples, lieux, artefacts…</small>
                </span>
              </button>
            </div>
          </div>
        </section>

        <SectionHead title="Campagnes de cet univers" action="Toutes les campagnes" onAction={() => setView('forge')} />
        {campaigns.length === 0 ? (
          <button className="lsx-empty-card" onClick={() => setView('forge')}>
            <ScrollText size={22} aria-hidden="true" />
            <b>Forger une première campagne</b>
            <span>Décris une idée : l'IA en tire actes, scènes et PNJ à partir de ton canon.</span>
          </button>
        ) : (
          <div className="lsx-camp-grid">
            {campaigns.slice(0, 3).map((c, i) => (
              <button key={c.id} className="lsx-camp" onClick={() => setView('forge')}>
                <span className="lsx-camp-img" style={{ backgroundImage: `url("${campaignImage(c) || DECOR.cards[i % DECOR.cards.length]}")` }} />
                <span className="lsx-camp-body">
                  <b>{c.title}</b>
                  <small>{(c.campaignThemes || []).slice(0, 3).join(' • ') || c.theme || c.setting || 'Campagne'}</small>
                  <span className="lsx-camp-meta">
                    <span><ScrollText size={13} aria-hidden="true" /> {(c.scenes || []).length} scène{(c.scenes || []).length > 1 ? 's' : ''}</span>
                    {c.level ? <span>Niv. {c.level}</span> : null}
                    {c.acts?.length ? <span>{c.acts.length} actes</span> : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <SectionHead title="À ne pas manquer" />
        <div className="lsx-glance">
          <article className="lsx-tile">
            <TileHead icon={Archive} img="sceau" title="Dernières fiches" action="Voir tout" onAction={() => setView('library')} />
            {recentEntries.length === 0 ? (
              <p className="lsx-tile-empty">La bibliothèque est encore vide.</p>
            ) : (
              <ul className="lsx-mini-list">
                {recentEntries.map((e) => {
                  const img = libraryImage(e);
                  return (
                    <li key={e.id}>
                      <button onClick={() => setView('library')}>
                        <span className="lsx-thumb" style={img ? { backgroundImage: `url("${img}")` } : undefined} />
                        <span>
                          <b>{e.title}</b>
                          <small>{[e.typeLabel, ago(e.updatedAt || e.createdAt)].filter(Boolean).join(' • ')}</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className="lsx-tile">
            <TileHead icon={ScrollText} img="rouleau" title="Prochaine scène" badge={nextScene ? SCENE_TYPES[nextScene.type] || nextScene.type : null} />
            {nextScene ? (
              <>
                <b className="lsx-tile-title">{nextScene.title}</b>
                <p className="lsx-tile-text">{clip(nextScene.summary || nextScene.expanded?.purpose, 150)}</p>
                <button className="lsx-tile-btn" onClick={() => setView('scene')}>
                  Ouvrir à la table <ChevronRight size={14} aria-hidden="true" />
                </button>
              </>
            ) : (
              <p className="lsx-tile-empty">Aucune scène préparée.</p>
            )}
          </article>

          <article className="lsx-tile">
            <TileHead icon={Flag} img="sablier" title="Quêtes en cours" action="Voir" onAction={() => setView('quests')} />
            {openQuests.length === 0 ? (
              <p className="lsx-tile-empty">Aucune quête ouverte.</p>
            ) : (
              <ul className="lsx-quest-list">
                {openQuests.map((q) => (
                  <li key={q.id}>
                    <span className="lsx-dot" data-kind={q.type === 'main' ? 'main' : 'side'} />
                    <span>
                      <b>{q.title}</b>
                      <small>{q.type === 'main' ? 'Quête principale' : 'Quête secondaire'}{q.total ? ` • ${q.done}/${q.total}` : ''}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="lsx-tile">
            <TileHead icon={Wand2} img="bougie" title="Dernière improvisation" action="Ouvrir" onAction={() => setView('conjure')} />
            {lastLog ? (
              <>
                <small className="lsx-tile-date">{ago(lastLog.t)}</small>
                <b className="lsx-tile-title">{clip(lastLog.prompt, 60)}</b>
                <p className="lsx-tile-text">{clip(typeof lastLog.out === 'string' ? lastLog.out : JSON.stringify(lastLog.out || ''), 140)}</p>
              </>
            ) : (
              <p className="lsx-tile-empty">Rien d'improvisé pour l'instant.</p>
            )}
          </article>
        </div>
      </div>

      <aside className="lsx-home-rail">
        <section className="lsx-rail-card">
          <TileHead icon={Users} title="Groupe de jeu" action="Voir tous" onAction={() => setView('party')} />
          {party.length === 0 ? (
            <p className="lsx-tile-empty">Ajoute les personnages de tes joueurs.</p>
          ) : (
            <ul className="lsx-party">
              {party.slice(0, 6).map((p) => {
                const img = portrait(p);
                return (
                  <li key={p.id}>
                    <span className="lsx-avatar" data-default={img ? undefined : 1} style={{ backgroundImage: `url("${img || DECOR.avatar}")` }} />
                    <span>
                      <b>{p.name}</b>
                      <small>{[p.cls, p.race, p.level ? `niv. ${p.level}` : ''].filter(Boolean).join(' • ')}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lsx-rail-card">
          <TileHead icon={BookOpen} title="Accès rapides" />
          <ul className="lsx-quick">
            {[
              ['bestiary', 'PNJ & créatures', Skull, npcs.length],
              ['maps', 'Cartes & lieux', MapIcon],
              ['quests', 'Quêtes', Flag, quests.length],
              ['archives', 'Archives', Archive],
              ['library', 'Bibliothèque', BookOpen, library.length],
            ].map(([v, l, Icon, n]) => (
              <li key={v}>
                <button onClick={() => setView(v)}>
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                  <span>{l}</span>
                  {n ? <em>{n}</em> : null}
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function SectionHead({ title, action, onAction }) {
  return (
    <div className="lsx-section-h">
      <h2>
        <span className="lsx-rune" aria-hidden="true">✦</span>
        {title}
      </h2>
      {action && (
        <button onClick={onAction}>
          {action} <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function TileHead({ icon: Icon, img, title, action, onAction, badge }) {
  return (
    <div className="lsx-tile-h">
      {img ? (
        <img className="lsx-tile-obj" src={`${UI}${img}.webp`} alt="" aria-hidden="true" />
      ) : (
        <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
      )}
      <b>{title}</b>
      {badge && <span className="lsx-badge">{badge}</span>}
      {action && (
        <button onClick={onAction}>
          {action} <ChevronRight size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}
