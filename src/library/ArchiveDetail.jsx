/**
 * Détail complet d'une fiche des Archives, lu depuis le fichier publié : tout ce que la fiche d'origine contient
 * et que la copie de bibliothèque ne reprend pas (cycle de vie, capacités, récolte, observations, citations,
 * chapitres, statistiques de jeu, comportement MJ).
 */
import { useState } from 'react';
import { sentienceOf } from '../feeds/fauna';

const paras = (text) => String(text || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/^#+\s*/gm, '')
  .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const mod = (v) => { const m = Math.floor((v - 10) / 2); return `${v} (${m >= 0 ? '+' : '−'}${Math.abs(m)})`; };
const ABILITY_KIND = { narratif: 'Capacités narratives', approuve: 'Capacités approuvées (GN)', suppose: 'Capacités supposées' };
const APPROVAL = { officiel: 'Officiel GN', adaptation: 'Adaptation', brouillon: 'Brouillon' };

function Block({ title, children }) {
  return (
    <section className="dossier-section archive-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function NamedList({ items = [] }) {
  return items.filter((x) => x && (x.name || x.text || x.description)).map((x, i) => (
    <div key={i} className="archive-named">
      <b>{x.name}</b>
      {paras(x.text ?? x.description).map((p, j) => <p key={j}>{p}</p>)}
    </div>
  ));
}

function StatBlock({ s }) {
  const ab = s.abilities;
  const rows = [['Saves', s.saves], ['Compétences', s.skills], ['Sens', s.senses], ['Langues', s.languages],
    ['Résistances', s.resistances], ['Vulnérabilités', s.vulnerabilities], ['Immunités', s.immunities],
    ['Immunités (états)', s.conditionImmunities], ['Environnement', s.environment]].filter(([, v]) => v);
  return (
    <div className="archive-statblock">
      <div className="archive-stat-head">
        <span>{[s.creatureType, s.alignment].filter(Boolean).join(' · ')}</span>
        <span className={`archive-approval ${s.approval}`}>{APPROVAL[s.approval] ?? s.approval}</span>
      </div>
      <div className="archive-stat-line">
        {s.ac && <span><b>CA</b> {s.ac}</span>}
        {s.hp && <span><b>PV</b> {s.hp}</span>}
        {s.speed && <span><b>Vitesse</b> {s.speed}</span>}
        {s.cr && <span><b>FP</b> {s.cr}</span>}
      </div>
      {ab && (
        <div className="archive-abilities">
          {[['FOR', ab.str], ['DEX', ab.dex], ['CON', ab.con], ['INT', ab.int], ['SAG', ab.wis], ['CHA', ab.cha]].map(([k, v]) => (
            <div key={k}><small>{k}</small><b>{mod(v)}</b></div>
          ))}
        </div>
      )}
      {rows.length > 0 && <dl className="dossier-id">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      <NamedList items={s.traits} />
      <NamedList items={s.environmentTraits} />
      {s.actions?.length > 0 && <><h3 className="archive-sub">Actions</h3><NamedList items={s.actions} /></>}
      {s.reactions?.length > 0 && <><h3 className="archive-sub">Réactions</h3><NamedList items={s.reactions} /></>}
      {s.legendaryActions?.length > 0 && <><h3 className="archive-sub">Actions légendaires</h3><NamedList items={s.legendaryActions} /></>}
    </div>
  );
}

export default function ArchiveDetail({ a }) {
  const [openChapter, setOpenChapter] = useState(null);
  const chapters = a.document?.chapters ?? [];
  const abilityGroups = Object.keys(ABILITY_KIND).map((k) => [k, (a.abilities ?? []).filter((x) => x.kind === k)]).filter(([, l]) => l.length);
  const nature = sentienceOf(a);
  const facts = [nature && ['Nature', nature.label], a.threat && ['Menace', a.threat], a.warral != null && ['Échelle Warral', a.warral]].filter(Boolean);

  return (
    <>
      {facts.length > 0 && (
        <div className="archive-facts">
          {facts.map(([k, v]) => <span key={k}><small>{k}</small> {String(v)}</span>)}
        </div>
      )}
      {nature && <p className="archive-muted">{nature.detail}</p>}

      {a.statBlock && (
        <Block title="Statistiques de jeu">
          <StatBlock s={a.statBlock} />
        </Block>
      )}

      {a.gmBehavior?.length > 0 && (
        <Block title="Comportement — pour le MJ">
          <ul className="archive-list">{a.gmBehavior.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </Block>
      )}

      {a.lifecycle?.length > 0 && (
        <Block title="Cycle de vie">
          <ol className="archive-stages">
            {a.lifecycle.map((st) => (
              <li key={st.id}>
                <b>{st.name}</b>{st.duration && <small> · {st.duration}</small>}
                {paras(st.description).map((p, i) => <p key={i}>{p}</p>)}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {abilityGroups.map(([k, list]) => (
        <Block key={k} title={ABILITY_KIND[k]}>
          {list.map((x) => (
            <div key={x.id} className="archive-named">
              <b>{x.name}</b>
              {paras(x.description).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ))}
        </Block>
      ))}

      {a.harvest?.length > 0 && (
        <Block title="Récolte et usages">
          {a.harvest.map((h) => (
            <div key={h.id} className="archive-named">
              <b>{h.part}</b>
              <dl className="dossier-id">
                {[['Méthode', h.method], ['Conservation', h.conservation], ['Propriétés supposées', h.allegedProperties], ['Usages', h.uses]]
                  .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          ))}
        </Block>
      )}

      {a.observations?.length > 0 && (
        <Block title="Observations">
          {a.observations.map((o) => (
            <div key={o.id} className="archive-named">
              <b>{o.title || 'Observation'}</b>
              <small className="archive-meta">{[o.author, o.date, o.place].filter(Boolean).join(' · ')}</small>
              {paras(o.text).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ))}
        </Block>
      )}

      {a.citations?.length > 0 && (
        <Block title="Sources citées">
          <ul className="archive-list">
            {a.citations.map((c) => (
              <li key={c.id}>{[c.label, c.locator].filter(Boolean).join(', ')}{c.note ? ` — ${c.note}` : ''}</li>
            ))}
          </ul>
        </Block>
      )}

      {(a.contradictions || a.openQuestions) && (
        <Block title="Contradictions et questions ouvertes">
          {a.contradictions && paras(a.contradictions).map((p, i) => <p key={`c${i}`}>{p}</p>)}
          {a.openQuestions && <p className="archive-muted">À trancher : {a.openQuestions}</p>}
        </Block>
      )}

      {chapters.length > 0 && (
        <Block title={`Chapitres (${chapters.length})`}>
          <div className="archive-chapters">
            {chapters.map((c, i) => (
              <div key={c.id ?? i} className="archive-chapter" data-open={openChapter === i ? 1 : 0}>
                <button type="button" onClick={() => setOpenChapter(openChapter === i ? null : i)}>
                  <span>{c.title}</span>
                  <small>{openChapter === i ? 'Replier' : 'Lire'}</small>
                </button>
                {openChapter === i && paras(c.body).map((p, j) => <p key={j}>{p}</p>)}
              </div>
            ))}
          </div>
        </Block>
      )}
    </>
  );
}
