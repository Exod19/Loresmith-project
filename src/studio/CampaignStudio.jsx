/**
 * Campaign Studio : atelier guidé de création et de préparation de campagne (Lot 1).
 *
 * Trois zones : la navigation du studio (onglets, dans le shell Loresmith), la surface de travail, et le Scribe
 * en colonne droite (sous la surface sur mobile). Les compteurs viennent de `prep.js`, calculés sur les données
 * réelles. Les vues Fil, Dossiers, Registre et Avant la séance 1 réutilisent l'existant en attendant leurs lots.
 */
import { useEffect, useMemo, useState } from 'react';
import { BRIEF_FIELDS, FORMATS, emptyBrief, proposeBrief } from '../forge/campaignPipeline';
import { buildLoreContext, feedFor } from '../ai/loreContext';
import { SCENE_STATE, campaignPrep, campaignResources, partySignature, sceneHash } from './prep';
import { migrateCampaign } from './migrate';
import './studio.css';

const UI = '/images/ui/';
const TAB_KEY = 'loresmith:studio-tab';
const uid = () => Math.random().toString(36).slice(2, 10);

const TABS = [
  ['overview', 'Vue d’ensemble'],
  ['thread', 'Fil de campagne'],
  ['scenes', 'Dossiers des scènes'],
  ['registry', 'Registre'],
  ['preflight', 'Avant la séance 1'],
  ['foundations', 'Fondations'],
];

const STATUS = {
  blocked: { label: 'Lancement verrouillé', tone: 'blood', text: 'Des éléments essentiels manquent encore.' },
  review: { label: 'À valider', tone: 'gold', text: 'Tout est écrit : il reste à relire et confirmer les scènes.' },
  ready: { label: 'Prête à jouer', tone: 'verdant', text: 'Toutes les scènes sont préparées et validées.' },
};

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);

function Badge({ tone = 'gold', children }) {
  return <span className={`cs-badge tone-${tone}`}>{children}</span>;
}
function StateBadge({ state }) {
  const s = SCENE_STATE[state] || SCENE_STATE.idea;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
function SectionHead({ title, children }) {
  return (
    <div className="lsx-section-h">
      <h2>
        <span className="lsx-rune">✦</span> {title}
      </h2>
      {children}
    </div>
  );
}
function Bar({ value }) {
  return (
    <span className="cs-bar" aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/* =========================================================================== */

export default function CampaignStudio({ universe, state, campaigns, party, npcs, dispatch, flash, setView, call, services }) {
  const active = campaigns.find((c) => c.id === universe.activeCampaignId) || null;
  const [browsing, setBrowsing] = useState(!active);
  const [quick, setQuick] = useState(false);
  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) || 'overview';
    } catch {
      return 'overview';
    }
  });
  const [sceneId, setSceneId] = useState('');
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    let alive = true;
    feedFor(universe).then((f) => alive && setFeed(f));
    return () => {
      alive = false;
    };
  }, [universe.id, universe.archives]);

  const camp = active && !browsing ? migrateCampaign(active) : null;
  const prep = useMemo(() => (camp ? campaignPrep(camp, { party }) : null), [camp, party]);

  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
    window.scrollTo({ top: 0 });
  };
  const open = (id, t = 'overview') => {
    dispatch({ type: 'UPDATE_UNIVERSE', id: universe.id, patch: { activeCampaignId: id } });
    setBrowsing(false);
    setTab(t);
  };
  const openScene = (id) => {
    setSceneId(id);
    setTab('scenes');
  };
  const patchCamp = (patch) => dispatch({ type: 'UPDATE_CAMPAIGN', id: camp.id, patch });

  function newCampaign() {
    const id = uid();
    const level = Math.round(party.reduce((a, p) => a + (Number(p.level) || 0), 0) / (party.length || 1)) || null;
    dispatch({
      type: 'ADD_CAMPAIGN',
      c: migrateCampaign({
        id,
        title: 'Nouvelle campagne',
        premise: '',
        createdAt: Date.now(),
        brief: { ...emptyBrief(), level: level || 3 },
        acts: [],
        sessions: [],
        scenes: [],
        foundations: { edition: '2014', partyIds: party.map((p) => p.id), partyCount: party.length || null, partyLevel: level, targetMinutes: 180, skipped: [], proposed: [] },
      }),
    });
    open(id, 'foundations');
  }

  if (!camp) {
    return (
      <CampaignPicker
        {...{ universe, campaigns, party, quick, setQuick, services }}
        onOpen={(id) => open(id)}
        onNew={newCampaign}
      />
    );
  }

  const status = STATUS[prep.status];
  const view =
    tab === 'thread' ? (
      services.renderCampaign(camp, feed)
    ) : tab === 'scenes' ? (
      <SceneDossiers {...{ camp, prep, sceneId, setSceneId, services, dispatch, flash, feed }} />
    ) : tab === 'registry' ? (
      <Registry {...{ camp, state, npcs, services, setView, openScene, feed }} />
    ) : tab === 'preflight' ? (
      <Preflight {...{ camp, prep, openScene, setTab }} />
    ) : tab === 'foundations' ? (
      <Foundations {...{ camp, universe, state, party, feed, call, services, patchCamp, flash, setTab }} />
    ) : (
      <CommandCenter {...{ camp, prep, universe, setTab, openScene }} />
    );

  return (
    <div className="cs">
      <div className="cs-top">
        <nav className="cs-crumbs" aria-label="Fil d’Ariane">
          <button type="button" onClick={() => setBrowsing(true)}>
            Campagnes
          </button>
          <span aria-hidden="true">›</span>
          <b>{camp.title}</b>
        </nav>
        <div className="cs-top-actions">
          <Badge tone={status.tone}>{status.label}</Badge>
          <button type="button" className="lsx-tile-btn" onClick={() => setTab('preflight')}>
            Contrôle avant séance
          </button>
        </div>
      </div>

      <div className="cs-tabs" role="tablist" aria-label="Campaign Studio">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-on={tab === id ? 1 : 0} onClick={() => setTab(id)}>
            {label}
            {id === 'preflight' && prep.blockers.length > 0 && <small>{prep.blockers.length}</small>}
          </button>
        ))}
      </div>

      <div className="cs-layout">
        <main className="cs-main">{view}</main>
        <Scribe {...{ camp, prep, universe, state, party, feed, call, setTab, openScene }} />
      </div>
    </div>
  );
}

/* ---------------------------- Choix de campagne --------------------------- */

function CampaignPicker({ universe, campaigns, party, quick, setQuick, services, onOpen, onNew }) {
  return (
    <div className="cs">
      <section className="lsx-hero cs-hero" style={{ '--hero': `url("${UI}hero.webp")` }}>
        <span className="lsx-hero-frame" aria-hidden="true" />
        <div className="lsx-hero-body">
          <span className="lsx-kicker">Campaign Studio · {universe.name}</span>
          <h1>Tes campagnes</h1>
          <p>
            Pars d’une idée d’une phrase. Le studio te guide question par question, organise tes actes et tes scènes, et te dit
            exactement ce qu’il reste à préparer avant la première séance.
          </p>
          <div className="lsx-hero-cta">
            <button type="button" className="lsx-cta" onClick={onNew}>
              <span>
                <b>Nouvelle campagne guidée</b>
                <small>Six questions, puis le canevas</small>
              </span>
            </button>
            <button type="button" className="lsx-cta ghost" onClick={() => setQuick((v) => !v)}>
              <span>
                <b>{quick ? 'Fermer la forge rapide' : 'Forge rapide'}</b>
                <small>Tout le brief sur un écran</small>
              </span>
            </button>
          </div>
        </div>
      </section>

      {quick && <div className="cs-quick">{services.renderQuickForge()}</div>}

      <SectionHead title="Campagnes de l’univers" />
      {campaigns.length === 0 ? (
        <button type="button" className="lsx-empty-card" onClick={onNew}>
          <b>Aucune campagne pour l’instant</b>
          <span>Commence par une campagne guidée.</span>
        </button>
      ) : (
        <div className="lsx-camp-grid">
          {campaigns.map((c, i) => {
            const m = migrateCampaign(c);
            const p = campaignPrep(m, { party });
            const st = STATUS[p.status];
            return (
              <button key={c.id} type="button" className="lsx-camp" onClick={() => onOpen(c.id)}>
                <span className="lsx-camp-img" style={{ backgroundImage: `url("${UI}${['c-tours', 'c-temple', 'c-lac', 'c-bazar', 'c-pont', 'c-champignons'][i % 6]}.webp")` }} />
                <span className="lsx-camp-body">
                  <b>{c.title}</b>
                  <small>{c.premise || 'Pas encore de prémisse.'}</small>
                  <span className="cs-camp-prep">
                    <Bar value={p.pct} /> <span>{p.pct} %</span>
                  </span>
                  <span className="lsx-camp-meta">
                    <span>
                      {p.scenesReady}/{p.scenesTotal} scènes prêtes
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Centre de commandement ------------------------ */

function CommandCenter({ camp, prep, universe, setTab, openScene }) {
  const status = STATUS[prep.status];
  const totalMin = prep.sessions.reduce((a, s) => a + s.minutes, 0);
  const acts = camp.acts?.length ? camp.acts : [{ id: '', title: 'Campagne' }];
  const scenesOf = (actId) => prep.scenes.filter((x) => (camp.acts?.length ? x.scene.actId === actId : true));
  const orphan = camp.acts?.length ? prep.scenes.filter((x) => !camp.acts.some((a) => a.id === x.scene.actId)) : [];

  return (
    <>
      <section className="lsx-hero cs-hero" style={{ '--hero': `url("${UI}hero.webp")` }}>
        <span className="lsx-hero-frame" aria-hidden="true" />
        <div className="lsx-hero-body">
          <span className="lsx-kicker">Centre de commandement · {universe.name}</span>
          <h1>{camp.title}</h1>
          <p>{camp.premise || 'Commence par les Fondations : une idée d’une phrase suffit pour démarrer.'}</p>
          <div className="lsx-hero-cta">
            <button type="button" className="lsx-cta" onClick={() => setTab(prep.scenesTotal ? 'thread' : 'foundations')}>
              <span>
                <b>{prep.scenesTotal ? 'Explorer le fil complet' : 'Poser les fondations'}</b>
                <small>{prep.scenesTotal ? `${prep.scenesTotal} scènes, ${prep.sessions.length} séance(s)` : 'Six questions, une à la fois'}</small>
              </span>
            </button>
            <button type="button" className="lsx-cta ghost" onClick={() => setTab('preflight')}>
              <span>
                <b>Contrôle de préparation</b>
                <small>{status.text}</small>
              </span>
            </button>
          </div>
        </div>
      </section>

      <SectionHead title="Ton projet, d’un seul regard">
        <small className="cs-note">Calculé sur le contenu réel de tes scènes.</small>
      </SectionHead>
      <div className="cs-stats">
        <article className="lsx-tile">
          <span className="cs-stat-label">Scènes prêtes</span>
          <b className="cs-stat">
            {prep.scenesReady}
            <small> / {prep.scenesTotal}</small>
          </b>
          <span className="cs-stat-sub">Écrites, complètes et validées</span>
        </article>
        <article className="lsx-tile">
          <span className="cs-stat-label">Préparation générale</span>
          <b className="cs-stat">
            {prep.pct}
            <small> %</small>
          </b>
          <span className="cs-stat-sub">
            {prep.checksOk} / {prep.checksTotal} contrôles passés
          </span>
        </article>
        <article className="lsx-tile">
          <span className="cs-stat-label">Séances planifiées</span>
          <b className="cs-stat">{prep.sessions.length}</b>
          <span className="cs-stat-sub">{fmtMin(totalMin)} de matière prévue</span>
        </article>
        <article className="lsx-tile">
          <span className="cs-stat-label">Travail restant</span>
          <b className="cs-stat">{prep.blockers.length}</b>
          <span className="cs-stat-sub">
            Bloquant{prep.blockers.length > 1 ? 's' : ''} · {prep.toValidate.length} à valider
          </span>
        </article>
      </div>

      <SectionHead title="Trajectoire de la campagne">
        <button type="button" onClick={() => setTab('thread')}>
          Voir le fil complet ›
        </button>
      </SectionHead>
      {prep.scenesTotal === 0 ? (
        <div className="lsx-empty-card cs-empty">
          <b>Pas encore de scènes</b>
          <span>Les Fondations mènent au canevas : le Scribe peut l’écrire, ou tu le construis toi-même.</span>
          <button type="button" className="lsx-tile-btn" onClick={() => setTab('foundations')}>
            Aller aux Fondations
          </button>
        </div>
      ) : (
        <div className="cs-acts">
          {[...acts, ...(orphan.length ? [{ id: '__', title: 'Hors acte' }] : [])].map((a, ai) => {
            const list = a.id === '__' ? orphan : scenesOf(a.id);
            if (!list.length) return null;
            return (
              <section key={a.id || ai} className="cs-act">
                <header>
                  <span className="lsx-kicker">
                    {camp.acts?.length && a.id !== '__' ? `Acte ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][ai] || ai + 1}` : 'Scènes'}
                  </span>
                  <b>{a.title}</b>
                  {a.summary && <small>{a.summary}</small>}
                </header>
                {list.map((x) => {
                  const ok = x.checks.filter((c) => c.ok).length;
                  return (
                    <button key={x.scene.id} type="button" className="cs-scene" onClick={() => openScene(x.scene.id)}>
                      <span className="cs-scene-meta">
                        <span>
                          {String(x.index + 1).padStart(2, '0')} · Séance {x.scene.sessionNumber ?? '—'}
                        </span>
                        <span>{x.minutes} min</span>
                      </span>
                      <b>{x.scene.title}</b>
                      <span className="cs-scene-foot">
                        <small>{x.scene.type}</small>
                        <StateBadge state={x.state} />
                      </span>
                      <Bar value={(ok / x.checks.length) * 100} />
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <div className="cs-note-bar">
        Les scènes sont des situations préparées, pas un chemin imposé : chaque dossier documente ses sorties et son plan B.
      </div>

      <SectionHead title="Prêt à raconter, pas encore prêt à lancer" />
      <div className="cs-inventory">
        <article className="lsx-rail-card">
          <div className="cs-inv-head">
            <b>Le grand inventaire</b>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <div className="cs-inv-pct">
            <b>{prep.pct} %</b>
            <Bar value={prep.pct} />
          </div>
          <p className="lsx-tile-text">
            Les illustrations décoratives n’empêchent pas de jouer. Les sorties de scène, les plans B, les rencontres et les PNJ
            utilisables, oui. Une moyenne ne masque jamais une scène sans issue.
          </p>
          <button type="button" className="lsx-tile-btn" onClick={() => setTab('preflight')}>
            Passer le contrôle général
          </button>
        </article>
        <article className="lsx-rail-card">
          <span className="lsx-kicker">Couverture de l’histoire</span>
          <ul className="cs-cover">
            {prep.campaignChecks.map((c) => (
              <li key={c.id} data-ok={c.ok ? 1 : 0}>
                <span aria-hidden="true">{c.ok ? '✓' : '!'}</span> {c.label}
                {!c.ok && <small>{c.reason}</small>}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <SectionHead title="Les prochaines actions utiles">
        <small className="cs-note">Triées par risque de blocage.</small>
      </SectionHead>
      {prep.items.length === 0 ? (
        <p className="lsx-tile-empty">Rien à signaler : la campagne est prête.</p>
      ) : (
        <ul className="cs-actions">
          {prep.items.slice(0, 6).map((c, i) => (
            <li key={i}>
              <span>
                <b>{c.reason || c.label}</b>
                <small>{c.scope === 'campaign' ? 'Campagne' : `Scène ${c.sceneIndex + 1} · ${c.sceneTitle}`}</small>
              </span>
              <button type="button" className="lsx-tile-btn" onClick={() => (c.scope === 'scene' ? openScene(c.sceneId) : setTab(c.id === 'party' ? 'foundations' : 'thread'))}>
                Préparer ›
              </button>
            </li>
          ))}
        </ul>
      )}

      {prep.sessions.length > 0 && (
        <>
          <SectionHead title="Plan des séances">
            <small className="cs-note">{fmtMin(prep.sessions[0].target)} visées par séance, avec une marge pour l’imprévu.</small>
          </SectionHead>
          <div className="cs-sessions">
            {prep.sessions.map((s) => (
              <article key={s.session.sessionNumber} className="lsx-tile">
                <span className="lsx-kicker">Séance {String(s.session.sessionNumber).padStart(2, '0')}</span>
                <b className="lsx-tile-title">{s.session.title}</b>
                <p className="lsx-tile-text">{s.scenes.map((x) => x.scene.title).join(' · ') || 'Aucune scène.'}</p>
                <div className="cs-session-time">
                  <b>{fmtMin(s.minutes)}</b>
                  <small> / {fmtMin(s.target)}</small>
                  <Badge tone={s.ready === s.scenes.length && s.scenes.length ? 'verdant' : 'gold'}>
                    {s.ready} / {s.scenes.length}
                  </Badge>
                </div>
                <Bar value={(s.minutes / s.target) * 100} />
                {s.warn && <small className="cs-warn">{s.warn}</small>}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* -------------------------------- Fondations ------------------------------ */

const STEPS = [
  { key: 'world', title: 'Le monde', question: 'Où se déroule l’aventure, et dans quel ton ?', main: 'mainLocations', extras: ['tone'], hint: 'Les éléments de ton univers sont une source de vérité. Le Scribe propose sans jamais modifier ton canon.' },
  { key: 'spark', title: 'L’étincelle', question: 'Quelle est l’idée de départ, en une phrase ?', main: 'theme', extras: ['title', 'creatures', 'recurringSymbols'], hint: 'Une image, une injustice, un mystère : une phrase suffit pour commencer.' },
  { key: 'players', title: 'Les joueurs', question: 'Qui joue, à quel niveau, et avec quelles règles ?', main: 'playerBackstoryHooks', extras: [], hint: 'Le niveau, la taille du groupe et l’édition servent à vérifier les rencontres. Les changer remet les combats à revérifier.' },
  { key: 'conflict', title: 'Le conflit', question: 'Qu’est-ce qui menace, et qui en est responsable ?', main: 'centralConflict', extras: ['mainVillain', 'villainGoal', 'finalStakes', 'factions', 'mysteries'], hint: 'Un antagoniste qui veut quelque chose fait avancer l’histoire même quand les héros hésitent.' },
  { key: 'opening', title: 'L’ouverture', question: 'Comment les héros entrent-ils dans l’histoire ?', main: 'startingSituation', extras: ['keyNpcs'], hint: 'La première scène doit donner une raison d’agir tout de suite.' },
  { key: 'canvas', title: 'Le canevas', question: 'Quelle ampleur pour cette campagne ?', main: null, extras: ['rewardStyle', 'constraints'], hint: 'Le Scribe peut écrire le canevas complet (actes, séances, scènes) à partir de tes réponses. Tu pourras tout modifier.' },
];
const FIELD = Object.fromEntries(BRIEF_FIELDS.map((f) => [f.key, f]));

function Foundations({ camp, universe, state, party, feed, call, services, patchCamp, flash, setTab }) {
  const brief = { ...emptyBrief(), ...(camp.brief || {}) };
  const f = camp.foundations || {};
  const [i, setI] = useState(() => Math.max(0, STEPS.findIndex((s) => !answered(s, brief, f, party))));
  const [busy, setBusy] = useState('');
  const [steps, setSteps] = useState([]);
  const [writeAll, setWriteAll] = useState(true);
  const step = STEPS[i] || STEPS[0];

  const setBrief = (k, v) => {
    const patch = { brief: { ...brief, [k]: v }, foundations: { ...f, proposed: (f.proposed || []).filter((x) => x !== k), skipped: (f.skipped || []).filter((x) => x !== step.key) } };
    if (k === 'title' && v.trim()) patch.title = v.trim();
    if (k === 'theme' && !camp.premise) patch.premise = v;
    patchCamp(patch);
  };
  const setF = (patch) => patchCamp({ foundations: { ...f, ...patch } });

  async function propose(keys) {
    setBusy(keys.join());
    try {
      const ctx = buildLoreContext({ universe, state, feed, party, focus: Object.values(brief).join(' ') });
      const got = await proposeBrief(call, ctx, brief, keys);
      if (!Object.keys(got).length) throw new Error('Le Scribe n’a rien proposé. Réessaie, ou précise une autre réponse d’abord.');
      patchCamp({ brief: { ...brief, ...got }, foundations: { ...f, proposed: [...new Set([...(f.proposed || []), ...Object.keys(got)])] } });
      flash('Proposition du Scribe ajoutée : relis-la, modifie-la ou garde-la.');
    } catch (e) {
      flash(e.message);
    }
    setBusy('');
  }

  async function forgeCanvas() {
    if (camp.scenes?.length && !confirm('Le canevas actuel (actes, séances, scènes) sera remplacé par celui du Scribe. Continuer ?')) return;
    setBusy('forge');
    setSteps([]);
    try {
      await services.forge(camp, {
        feed,
        brief,
        writeAll,
        onStep: (label, status, note) =>
          setSteps((list) => {
            const k = list.findIndex((s) => s.label === label);
            const next = { label, status, note };
            return k === -1 ? [...list, next] : list.map((s, j) => (j === k ? next : s));
          }),
      });
      flash('Canevas écrit : passe au fil de campagne, puis aux dossiers des scènes.');
    } catch (e) {
      flash(e.message);
    }
    setBusy('');
  }

  function buildMyself() {
    const n = Math.max(1, Number(brief.sessions) || 1);
    const sessions = Array.from({ length: n }, (_, k) => camp.sessions?.[k] || { id: `ses-${k + 1}`, sessionNumber: k + 1, title: `Séance ${k + 1}`, summary: '', detailed: false });
    patchCamp({ sessions });
    setTab('thread');
    flash(`${n} séance(s) prêtes à remplir : ajoute tes scènes depuis « Lore de la séance ».`);
  }

  const renderField = (key, primary) => {
    const fd = FIELD[key];
    if (!fd) return null;
    const v = brief[key] || '';
    const proposed = (f.proposed || []).includes(key);
    return (
      <div key={key} className={'cs-answer' + (primary ? ' primary' : '')}>
        <label className="fl">
          {primary ? 'Ta réponse' : fd.label}
          {proposed && <Badge tone="teal">Proposition du Scribe</Badge>}
        </label>
        {primary || fd.long ? (
          <textarea className="in" rows={primary ? 4 : 2} value={v} placeholder={fd.ph || ''} onChange={(e) => setBrief(key, e.target.value)} />
        ) : (
          <input className="in" value={v} placeholder={fd.ph || ''} onChange={(e) => setBrief(key, e.target.value)} />
        )}
        <div className="cs-answer-actions">
          <button type="button" className="lsx-tile-btn" disabled={!!busy} onClick={() => propose([key])}>
            {busy === key ? '…' : '✦ Propose une piste'}
          </button>
          {proposed && (
            <button type="button" className="lsx-tile-btn" onClick={() => setF({ proposed: (f.proposed || []).filter((x) => x !== key) })}>
              ✓ Je garde
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="cs-page-head">
        <span className="lsx-kicker">Création guidée · à tout moment</span>
        <h1>Les fondations restent vivantes</h1>
        <p>Une question à la fois. Réponds, demande une piste au Scribe, ou décide plus tard : rien n’est perdu, tout reste modifiable.</p>
      </div>

      <div className="cs-wizard">
        <ol className="cs-steps">
          {STEPS.map((s, k) => {
            const done = answered(s, brief, f, party);
            const later = (f.skipped || []).includes(s.key);
            return (
              <li key={s.key}>
                <button type="button" data-on={k === i ? 1 : 0} onClick={() => setI(k)}>
                  <b>
                    {String(k + 1).padStart(2, '0')} · {s.title}
                  </b>
                  <small>{done ? 'Réponse enregistrée' : later ? 'Je déciderai plus tard' : 'À répondre'}</small>
                </button>
              </li>
            );
          })}
        </ol>

        <section className="lsx-rail-card cs-step">
          <span className="lsx-kicker">
            Étape {i + 1} / {STEPS.length}
          </span>
          <h2>{step.question}</h2>
          <p className="lsx-tile-text">{step.hint}</p>

          {step.key === 'world' && (
            <p className="cs-world">
              Univers : <b>{universe.name}</b>
              {universe.tone ? ` · ${universe.tone}` : ''}
            </p>
          )}

          {step.key === 'players' && <PartyFields {...{ f, party, setF }} />}

          {step.key === 'canvas' && (
            <div className="cs-canvas-grid">
              <label className="fl">
                Format
                <select
                  className="in"
                  value={brief.format}
                  onChange={(e) => patchCamp({ brief: { ...brief, format: e.target.value, sessions: FORMATS[e.target.value]?.sessions || brief.sessions } })}
                >
                  {Object.entries(FORMATS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fl">
                Séances
                <input className="in" type="number" min="1" max="24" value={brief.sessions} onChange={(e) => patchCamp({ brief: { ...brief, sessions: Math.max(1, Math.min(24, +e.target.value || 1)) } })} />
              </label>
              <label className="fl">
                Durée d’une séance
                <select className="in" value={f.targetMinutes || 180} onChange={(e) => setF({ targetMinutes: +e.target.value })}>
                  {[120, 150, 180, 210, 240, 300].map((m) => (
                    <option key={m} value={m}>
                      {fmtMin(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step.main && renderField(step.main, true)}
          {step.extras.length > 0 && (
            <details className="cs-extras" open={step.extras.some((k) => brief[k])}>
              <summary>Préciser davantage (facultatif)</summary>
              {step.extras.map((k) => renderField(k, false))}
            </details>
          )}

          {step.key !== 'canvas' && (
            <div className="cs-answer-actions">
              <button type="button" className="lsx-tile-btn" onClick={() => {
                  setF({ skipped: [...new Set([...(f.skipped || []), step.key])] });
                  setI(Math.min(STEPS.length - 1, i + 1));
                }}
              >
                Je déciderai plus tard
              </button>
            </div>
          )}

          {step.key === 'canvas' && (
            <div className="cs-canvas-actions">
              <label className="cs-check">
                <input type="checkbox" checked={writeAll} onChange={(e) => setWriteAll(e.target.checked)} /> Écrire aussi chaque séance scène par scène
              </label>
              <div className="lsx-hero-cta">
                <button type="button" className="lsx-cta" disabled={!!busy} onClick={forgeCanvas}>
                  <span>
                    <b>{busy === 'forge' ? 'Le Scribe écrit…' : '✦ Écrire le canevas avec le Scribe'}</b>
                    <small>Actes, séances et scènes, à partir de tes réponses</small>
                  </span>
                </button>
                <button type="button" className="lsx-cta ghost" disabled={!!busy} onClick={buildMyself}>
                  <span>
                    <b>Je construis moi-même</b>
                    <small>Des séances vides, à remplir scène par scène</small>
                  </span>
                </button>
              </div>
              {steps.length > 0 && (
                <ol className="forge-steps">
                  {steps.map((s) => (
                    <li key={s.label} data-status={s.status}>
                      <span>{s.status === 'run' ? <span className="spin" /> : s.status === 'ok' ? '✓' : '✕'}</span>
                      <b>{s.label}</b>
                      {s.note && <small>{s.note}</small>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="cs-step-nav">
            <button type="button" className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
              ← Retour
            </button>
            {i < STEPS.length - 1 && (
              <button type="button" className="btn primary" onClick={() => setI(i + 1)}>
                Continuer →
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function answered(step, brief, f, party) {
  if (step.key === 'players') return !!(f.edition && (Number(f.partyCount) || party.length) && (Number(f.partyLevel) || party.some((p) => p.level)));
  if (step.key === 'canvas') return false;
  return !!String(brief[step.main] || '').trim();
}

function PartyFields({ f, party, setF }) {
  const ids = f.partyIds || [];
  return (
    <div className="cs-party">
      {party.length > 0 ? (
        <div className="cs-party-list">
          {party.map((p) => (
            <label key={p.id} className="cs-check">
              <input
                type="checkbox"
                checked={ids.includes(p.id)}
                onChange={(e) => {
                  const next = e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id);
                  const lv = party.filter((x) => next.includes(x.id)).map((x) => Number(x.level)).filter(Boolean);
                  setF({ partyIds: next, partyCount: next.length || null, partyLevel: lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : f.partyLevel });
                }}
              />
              {p.name} <small>{[p.cls, p.race, p.level && `niv. ${p.level}`].filter(Boolean).join(' · ')}</small>
            </label>
          ))}
        </div>
      ) : (
        <p className="lsx-tile-text">Aucun personnage dans « Groupe de jeu » : indique la taille et le niveau ci-dessous.</p>
      )}
      <div className="cs-canvas-grid">
        <label className="fl">
          Nombre de joueurs
          <input className="in" type="number" min="1" max="10" value={f.partyCount ?? ''} onChange={(e) => setF({ partyCount: +e.target.value || null })} />
        </label>
        <label className="fl">
          Niveau moyen
          <input className="in" type="number" min="1" max="20" value={f.partyLevel ?? ''} onChange={(e) => setF({ partyLevel: +e.target.value || null })} />
        </label>
        <label className="fl">
          Édition
          <select className="in" value={f.edition || ''} onChange={(e) => setF({ edition: e.target.value || null })}>
            <option value="">À choisir</option>
            <option value="2014">D&D 5e (2014)</option>
            <option value="2024">D&D 5e (2024)</option>
            <option value="other">Autre / règles maison</option>
          </select>
        </label>
      </div>
    </div>
  );
}

/* ------------------------------ Dossiers des scènes ----------------------- */

function SceneDossiers({ camp, prep, sceneId, setSceneId, services, dispatch, flash, feed }) {
  const current = prep.scenes.find((x) => x.scene.id === sceneId) || prep.scenes.find((x) => x.state !== 'ready') || prep.scenes[0];
  if (!current) return <p className="lsx-tile-empty">Aucune scène : commence par les Fondations ou le fil de campagne.</p>;
  const sc = current.scene;
  const x = sc.expanded || {};
  const session = (camp.sessions || []).find((s) => s.sessionNumber === sc.sessionNumber);
  const content = current.checks.filter((c) => c.id !== 'verified');
  const canValidate = content.every((c) => c.ok || !c.critical) && !!sc.expanded;
  const verified = current.checks.find((c) => c.id === 'verified');
  const save = (patch) => dispatch({ type: 'UPDATE_SCENE', cid: camp.id, sid: sc.id, patch });
  const saveX = (patch) => save({ expanded: { ...x, ...patch } });
  const pos = prep.scenes.indexOf(current);

  return (
    <div className="cs-dossiers">
      <aside className="cs-scene-list">
        {(camp.sessions || []).map((s) => (
          <div key={s.sessionNumber}>
            <span className="lsx-kicker">Séance {s.sessionNumber}</span>
            {prep.scenes
              .filter((y) => y.scene.sessionNumber === s.sessionNumber)
              .map((y) => (
                <button key={y.scene.id} type="button" data-on={y.scene.id === sc.id ? 1 : 0} onClick={() => setSceneId(y.scene.id)}>
                  <b>
                    S{y.index + 1} {y.scene.title}
                  </b>
                  <StateBadge state={y.state} />
                </button>
              ))}
          </div>
        ))}
      </aside>

      <div className="cs-dossier">
        <div className="cs-page-head">
          <span className="lsx-kicker">
            Séance {sc.sessionNumber ?? '—'} · Scène {pos + 1}
            {session ? ` · ${session.title}` : ''}
          </span>
          <h1>{sc.title}</h1>
          <div className="cs-dossier-meta">
            <StateBadge state={current.state} />
            <span>{sc.type}</span>
            <span>{current.minutes} min</span>
            <span>{sc.location || x.setting || 'Lieu non précisé'}</span>
          </div>
        </div>

        <section className="lsx-rail-card cs-checklist">
          <div className="cs-inv-head">
            <b>Contrôle de préparation</b>
            {verified?.ok ? <Badge tone="verdant">Validée</Badge> : <Badge tone={canValidate ? 'gold' : 'ember'}>{canValidate ? 'Prête à valider' : 'À compléter'}</Badge>}
          </div>
          <ul className="cs-cover">
            {current.checks.map((c) => (
              <li key={c.id} data-ok={c.ok ? 1 : 0} data-critical={c.critical ? 1 : 0}>
                <span aria-hidden="true">{c.ok ? '✓' : c.critical ? '!' : '·'}</span> {c.label}
                {!c.ok && <small>{c.reason}</small>}
              </li>
            ))}
          </ul>
          <div className="cs-answer-actions">
            {verified?.ok ? (
              <button type="button" className="lsx-tile-btn" onClick={() => save({ prepReview: null })}>
                Retirer ma validation
              </button>
            ) : (
              <button
                type="button"
                className="lsx-tile-btn"
                disabled={!canValidate}
                title={canValidate ? 'Confirme que tu as relu la scène et qu’elle est jouable' : 'Complète d’abord les points marqués « ! »'}
                onClick={() => {
                  save({ prepReview: { hash: sceneHash(sc), partySig: partySignature(prep.party), at: Date.now() } });
                  flash(`Scène validée : ${sc.title}`);
                }}
              >
                ✓ J’ai relu : la scène est jouable
              </button>
            )}
          </div>
        </section>

        <section className="lsx-tile cs-essentials">
          <span className="lsx-kicker">L’essentiel de la scène</span>
          <div className="cs-canvas-grid">
            <label className="fl">
              Importance
              <select className="in" value={sc.importance || 'essential'} onChange={(e) => save({ importance: e.target.value })}>
                <option value="essential">Essentielle</option>
                <option value="conditional">Conditionnelle</option>
                <option value="optional">Facultative (réserve)</option>
              </select>
            </label>
            <label className="fl">
              Durée prévue (min)
              <input className="in" type="number" min="5" max="240" value={sc.timeEstimate?.likely ?? current.minutes} onChange={(e) => save({ timeEstimate: { ...(sc.timeEstimate || {}), likely: +e.target.value || null } })} />
            </label>
          </div>
          {sc.expanded ? (
            <>
              <label className="fl">
                Texte à lire ou paraphraser
                <textarea className="in cs-parchment" rows={4} value={x.readAloud || ''} onChange={(e) => saveX({ readAloud: e.target.value })} />
              </label>
              <label className="fl">
                Objectif dramatique
                <textarea className="in" rows={2} value={x.purpose || ''} onChange={(e) => saveX({ purpose: e.target.value })} />
              </label>
              <label className="fl">
                Sortie : comment le groupe passe à la suite (une piste par ligne)
                <textarea className="in" rows={3} value={(x.guidance || []).join('\n')} onChange={(e) => saveX({ guidance: e.target.value.split('\n') })} />
              </label>
              <label className="fl">
                Plan B : si les héros ignorent la piste ou échouent
                <textarea className="in" rows={2} value={x.fallback || ''} onChange={(e) => saveX({ fallback: e.target.value })} />
              </label>
            </>
          ) : (
            <p className="lsx-tile-text">Cette scène n’est encore qu’une ligne du plan : écris-la avec « ✦ Développer » ci-dessous, ou écris toute sa séance depuis le fil de campagne.</p>
          )}
        </section>

        {services.renderScene(camp, sc, session, pos, feed)}

        <div className="cs-step-nav">
          <button type="button" className="btn ghost" disabled={pos <= 0} onClick={() => setSceneId(prep.scenes[pos - 1].scene.id)}>
            ← Scène précédente
          </button>
          <button type="button" className="btn primary" disabled={pos >= prep.scenes.length - 1} onClick={() => setSceneId(prep.scenes[pos + 1].scene.id)}>
            Scène suivante →
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Registre ------------------------------- */

const KIND = { npc: 'PNJ', creature: 'Créature', place: 'Lieu' };

function Registry({ camp, state, npcs, services, setView, openScene, feed }) {
  const library = Object.values(state.libraryEntries || {}).filter((e) => e.universeId === camp.universeId);
  const list = useMemo(() => campaignResources(camp, { npcs, library }), [camp, npcs, library.length]);
  const [busy, setBusy] = useState('');
  const missing = list.filter((r) => r.status === 'missing' && r.kind !== 'place').length;
  const sceneTitle = (id) => {
    const i = (camp.scenes || []).findIndex((s) => s.id === id);
    return i === -1 ? '' : `S${i + 1}`;
  };

  async function create(r) {
    setBusy(r.name);
    await services.createSheet({ camp, name: r.name, mode: r.kind === 'npc' ? 'npc' : 'monster', count: r.instances }, feed);
    setBusy('');
  }

  return (
    <>
      <div className="cs-page-head">
        <span className="lsx-kicker">Production · une fiche par ressource</span>
        <h1>Registre des ressources</h1>
        <p>
          Ce que tes scènes demandent : PNJ, créatures et lieux. Une fiche unique sert dans toutes les scènes ; les créatures
          indiquent combien d’instances il faudra sur la carte. {missing ? `${missing} fiche(s) à créer.` : 'Toutes les fiches de PNJ et de créatures existent.'}
        </p>
      </div>
      {list.length === 0 ? (
        <p className="lsx-tile-empty">Aucune ressource détectée : écris d’abord tes scènes.</p>
      ) : (
        <div className="cs-registry">
          {list.map((r) => (
            <article key={`${r.kind}-${r.name}`} className="lsx-tile">
              <div className="lsx-tile-h">
                <b>{r.name}</b>
                <Badge tone={r.status === 'missing' ? (r.kind === 'place' ? 'faint' : 'ember') : 'verdant'}>
                  {r.status === 'created' ? 'Fiche créée' : r.status === 'srd' ? 'Fiche SRD' : r.kind === 'place' ? 'Sans fiche' : 'À créer'}
                </Badge>
              </div>
              <p className="lsx-tile-text">
                {KIND[r.kind]}
                {r.kind === 'creature' && r.instances ? ` · ${r.instances} instance(s)` : ''} · {r.scenes.length ? `${r.scenes.length} scène(s)` : 'mentionné dans la bible'}
              </p>
              <div className="cs-chips">
                {r.scenes.map((id) => (
                  <button key={id} type="button" onClick={() => openScene(id)}>
                    {sceneTitle(id)}
                  </button>
                ))}
              </div>
              <div className="cs-answer-actions">
                {r.sheet && r.kind !== 'place' && (
                  <button type="button" className="lsx-tile-btn" onClick={() => setView('bestiary')}>
                    Ouvrir la fiche
                  </button>
                )}
                {r.sheet && r.kind === 'place' && (
                  <button type="button" className="lsx-tile-btn" onClick={() => setView('library')}>
                    Ouvrir dans la bibliothèque
                  </button>
                )}
                {r.status !== 'created' && r.kind !== 'place' && (
                  <button type="button" className="lsx-tile-btn" disabled={!!busy} onClick={() => create(r)}>
                    {busy === r.name ? 'Création…' : '✦ Créer la fiche'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------------------- Avant la séance 1 --------------------------- */

function Preflight({ camp, prep, openScene, setTab }) {
  const status = STATUS[prep.status];
  const byScene = new Map();
  for (const c of [...prep.blockers, ...prep.toValidate]) {
    if (c.scope !== 'scene') continue;
    byScene.set(c.sceneId, [...(byScene.get(c.sceneId) || []), c]);
  }
  const campaignIssues = prep.blockers.filter((c) => c.scope === 'campaign');
  return (
    <>
      <div className="cs-page-head">
        <span className="lsx-kicker">Contrôle général · toute la campagne</span>
        <h1>Avant la séance 1</h1>
        <p>Toutes les séances sont contrôlées, pas seulement la première. Le lancement s’ouvre quand chaque scène est écrite, complète et validée par toi.</p>
      </div>
      <section className={`lsx-rail-card cs-gate tone-${status.tone}`}>
        <b>{status.label}</b>
        <span>{status.text}</span>
        <small>
          {prep.blockers.length} bloquant(s) · {prep.toValidate.length} scène(s) à valider · {prep.warnings.length} avertissement(s)
        </small>
      </section>

      {campaignIssues.length > 0 && (
        <>
          <SectionHead title="Campagne" />
          <ul className="cs-actions">
            {campaignIssues.map((c) => (
              <li key={c.id}>
                <span>
                  <b>{c.label}</b>
                  <small>{c.reason}</small>
                </span>
                <button type="button" className="lsx-tile-btn" onClick={() => setTab(c.id === 'party' ? 'foundations' : 'thread')}>
                  Préparer ›
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {byScene.size > 0 && (
        <>
          <SectionHead title="Scènes" />
          <ul className="cs-actions">
            {prep.scenes
              .filter((x) => byScene.has(x.scene.id))
              .map((x) => (
                <li key={x.scene.id}>
                  <span>
                    <b>
                      S{x.index + 1} · {x.scene.title} <StateBadge state={x.state} />
                    </b>
                    {byScene.get(x.scene.id).map((c) => (
                      <small key={c.id}>
                        {c.critical && c.id !== 'verified' ? '! ' : '· '}
                        {c.reason}
                      </small>
                    ))}
                  </span>
                  <button type="button" className="lsx-tile-btn" onClick={() => openScene(x.scene.id)}>
                    Ouvrir le dossier ›
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {prep.warnings.length > 0 && (
        <>
          <SectionHead title="Avertissements" />
          <ul className="cs-actions">
            {prep.warnings.map((c, i) => (
              <li key={i}>
                <span>
                  <b>{c.label}</b>
                  <small>
                    {c.sceneTitle ? `${c.sceneTitle} · ` : ''}
                    {c.reason}
                  </small>
                </span>
                {c.sceneId && (
                  <button type="button" className="lsx-tile-btn" onClick={() => openScene(c.sceneId)}>
                    Voir ›
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ---------------------------------- Scribe -------------------------------- */

function Scribe({ camp, prep, universe, state, party, feed, call, setTab, openScene }) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const top = prep.items[0];
  const missingRes = useMemo(() => campaignResources(camp, { npcs: Object.values(state.npcs || {}) }).filter((r) => r.status === 'missing' && r.kind !== 'place').length, [camp, state.npcs]);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true);
    setAnswer('');
    try {
      const ctx = buildLoreContext({ universe, state, feed, party, budget: 6000, focus: `${q} ${camp.title} ${camp.premise}` });
      const scenes = prep.scenes.map((x) => `S${x.index + 1} « ${x.scene.title} » (${SCENE_STATE[x.state].label}) — ${x.scene.summary || ''}`).join('\n');
      const issues = prep.items.slice(0, 12).map((c) => `- ${c.sceneTitle ? `${c.sceneTitle} : ` : ''}${c.reason || c.label}`).join('\n');
      const text = await call({
        system: `Tu es le Scribe de Loresmith, conseiller de préparation d'un maître de jeu (D&D 5e). Tu réponds en français, de façon concise et concrète.
Tu proposes, tu ne décides pas : présente tes idées comme des suggestions que le MJ validera. Ne modifie jamais le canon de l'univers.`,
        prompt: `${ctx}\n\nCAMPAGNE : ${camp.title} — ${camp.premise || ''}\nSCÈNES :\n${scenes || '—'}\nPOINTS OUVERTS :\n${issues || '—'}\n\nQUESTION DU MJ : ${q}`,
        json: false,
        maxTokens: 1200,
      });
      setAnswer(String(text || '').trim());
    } catch (e) {
      setAnswer(`⚠ ${e.message}`);
    }
    setBusy(false);
  }

  return (
    <aside className="cs-scribe" aria-label="Le Scribe">
      <div className="cs-scribe-head">
        <img src={`${UI}bougie.webp`} alt="" aria-hidden="true" />
        <span>
          <b>Le Scribe</b>
          <small>Conseiller de préparation</small>
        </span>
      </div>
      <article className="lsx-rail-card">
        <span className="lsx-kicker">État du projet</span>
        <b className="lsx-tile-title">{STATUS[prep.status].label}</b>
        <p className="lsx-tile-text">{STATUS[prep.status].text}</p>
      </article>
      <article className="lsx-rail-card">
        <span className="lsx-kicker">Je garde un œil sur</span>
        <ul className="cs-watch">
          <li>
            {prep.scenesReady} / {prep.scenesTotal} scènes prêtes
          </li>
          <li>{prep.blockers.length} élément(s) bloquant(s)</li>
          <li>{missingRes} fiche(s) de PNJ ou créature à créer</li>
        </ul>
      </article>
      {top && (
        <article className="lsx-rail-card">
          <span className="lsx-kicker">Conseil du Scribe</span>
          <p className="lsx-tile-text">
            Commence par : <b>{String(top.reason || top.label).replace(/\.$/, '')}</b>
            {top.sceneTitle ? ` (${top.sceneTitle})` : ''}.
          </p>
          <button type="button" className="lsx-tile-btn" onClick={() => (top.scope === 'scene' ? openScene(top.sceneId) : setTab(top.id === 'party' ? 'foundations' : 'thread'))}>
            Y aller ›
          </button>
        </article>
      )}
      <article className="lsx-rail-card cs-ask">
        <span className="lsx-kicker">Demande au Scribe</span>
        <textarea className="in" rows={3} value={q} placeholder="Ex. Quels indices risquent de manquer à mes joueurs ?" onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn primary" disabled={busy || !q.trim()} onClick={ask}>
          {busy ? 'Le Scribe réfléchit…' : '✦ Obtenir une suggestion'}
        </button>
        {answer && <div className="cs-answer-text">{answer}</div>}
        <small className="cs-note">Suggestions seulement : rien n’est modifié sans toi.</small>
      </article>
    </aside>
  );
}
