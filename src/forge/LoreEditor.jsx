/**
 * Éditeur de lore par rubrique, pour une scène ou une séance. Chaque rubrique se saisit à la main,
 * ou se génère par l'IA avec ou sans consigne. Les modifications sont enregistrées au fil de la frappe.
 */
import { useState } from 'react';
import { SCENE_KINDS, SESSION_KINDS, creaturesToText, generateLoreItems, textToCreatures } from './loreGen';
import { generateEntities } from '../bestiary/entityGen';
import { buildLoreContext } from '../ai/loreContext';
import './lore.css';

/**
 * Crée la fiche complète d'une créature de rencontre dans PNJ & Créatures (IA), avec son FP et son nom.
 * Renvoie la fiche créée, pour pouvoir la rattacher à la campagne.
 */
export async function createCreatureSheet({ call, creature, universe, state, feed, party, camp, dispatch, flash }) {
  try {
    const ctx = buildLoreContext({ universe, state, feed, party, budget: 6000, noNamedPersons: true, focus: `${creature.name} ${camp?.title || ''}` });
    const [entity] = await generateEntities(call, {
      ctx: `${ctx}\n\nCAMPAGNE : ${camp?.title || ''} — ${camp?.premise || ''}`,
      items: [{ mode: 'monster', name: creature.name, cr: creature.cr || '', notes: `Créature de rencontre, quantité prévue : ${creature.count || 1}` }],
      level: party[0]?.level || 3,
      size: party.length || 4,
    });
    const n = { ...entity, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now(), campaignIds: camp ? [camp.id] : [] };
    dispatch({ type: 'ADD_NPC', n });
    flash(`Fiche créée : ${n.name} (PNJ & Créatures).`);
    return n;
  } catch (e) {
    flash(e.message);
    return null;
  }
}

const ENV_KEYS = ['setting', 'sensoryDetails', 'hiddenTruth'];

/** Lit / écrit la valeur d'une rubrique à son emplacement dans la scène ou la séance. */
function readScene(scene, key) {
  const x = scene.expanded || {};
  if (key === 'environment') return Object.fromEntries(ENV_KEYS.map((k) => [k, x[k] || '']));
  return x[key] ?? (SCENE_KINDS[key]?.kind === 'list' || SCENE_KINDS[key]?.kind === 'strings' ? [] : '');
}
function writeScene(scene, key, value) {
  if (key === 'environment') return { ...(scene.expanded || {}), ...value };
  return { ...(scene.expanded || {}), [key]: value };
}

/** Une rubrique : en-tête, boutons de génération, puis les entrées éditables. */
function LoreBlock({ def, value, onSave, onGenerate, onCreatureSheet, busy }) {
  const [consigne, setConsigne] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const isList = def.kind === 'list';
  const isStrings = def.kind === 'strings';
  const isText = def.kind === 'text';
  const items = isList || isStrings ? value || [] : null;
  const count = isList || isStrings ? items.length : value ? 1 : 0;

  const setItem = (i, key, v) => onSave(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const setString = (i, v) => onSave(items.map((it, j) => (j === i ? v : it)));
  const blank = () => {
    const o = {};
    def.fields.forEach(([k, , type]) => (o[k] = type === 'lines' ? [] : type === 'num' ? 0 : ''));
    return o;
  };

  function renderField([key, label, type], it, i) {
    const raw = it[key];
    const val = type === 'lines' ? (raw || []).join('\n') : type === 'creatures' ? creaturesToText(raw) : raw ?? '';
    const set = (v) => setItem(i, key, type === 'lines' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : type === 'creatures' ? textToCreatures(v) : type === 'num' ? Number(v) || 0 : v);
    return (
      <label key={key} className={'lore-field' + (type === 'area' || type === 'lines' || type === 'creatures' ? ' wide' : '')}>
        <span>{label}</span>
        {type === 'area' || type === 'lines' || type === 'creatures' ? (
          <textarea className="in" rows={2} value={val} onChange={(e) => set(e.target.value)} />
        ) : (
          <input className="in" type={type === 'num' ? 'number' : 'text'} value={val} onChange={(e) => set(e.target.value)} />
        )}
      </label>
    );
  }

  return (
    <div className="lore-block">
      <div className="lore-head">
        <b>{def.label}</b>
        <small>{isText || def.kind === 'single' ? (value ? 'rédigé' : 'vide') : `${count} élément${count > 1 ? 's' : ''}`}</small>
        <div className="lore-actions">
          {(isList || isStrings) && (
            <button type="button" className="btn ghost sm" onClick={() => onSave([...items, isStrings ? '' : blank()])}>
              + À la main
            </button>
          )}
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onGenerate('')}>
            {busy ? <span className="spin" /> : '✦ Générer'}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setShowPrompt((v) => !v)}>
            ✎ Avec consigne
          </button>
        </div>
      </div>
      {showPrompt && (
        <div className="lore-prompt">
          <textarea className="in" rows={2} value={consigne} onChange={(e) => setConsigne(e.target.value)} placeholder={def.hint || 'Ce que tu veux, en quelques mots…'} />
          <button type="button" className="btn sm primary" disabled={busy || !consigne.trim()} onClick={() => onGenerate(consigne)}>
            Générer selon la consigne
          </button>
        </div>
      )}
      {def.hint && count === 0 && <p className="lore-hint">{def.hint}</p>}

      {isText && <textarea className="in lore-text" rows={3} value={value || ''} onChange={(e) => onSave(e.target.value)} />}

      {def.kind === 'single' && (
        <div className="lore-grid">{def.fields.map((f) => <label key={f[0]} className={'lore-field' + (f[2] === 'area' ? ' wide' : '')}><span>{f[1]}</span>{f[2] === 'area' ? <textarea className="in" rows={2} value={value?.[f[0]] || ''} onChange={(e) => onSave({ ...value, [f[0]]: e.target.value })} /> : <input className="in" value={value?.[f[0]] || ''} onChange={(e) => onSave({ ...value, [f[0]]: e.target.value })} />}</label>)}</div>
      )}

      {isStrings &&
        items.map((s, i) => (
          <div key={i} className="lore-item">
            <textarea className="in" rows={2} value={s} onChange={(e) => setString(i, e.target.value)} />
            <button type="button" className="btn ghost sm danger" onClick={() => onSave(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}

      {isList &&
        items.map((it, i) => (
          <div key={i} className="lore-item">
            <div className="lore-grid">{def.fields.map((f) => renderField(f, it, i))}</div>
            {def.fields.some((f) => f[2] === 'creatures') && onCreatureSheet && (
              <div className="lore-sheets">
                {textToCreatures(creaturesToText(it.creatures)).map((c, j) => (
                  <button key={j} type="button" className="btn ghost sm" onClick={() => onCreatureSheet(c)} title="Crée la fiche complète dans PNJ & Créatures">
                    → Fiche de {c.name || 'la créature'}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn ghost sm danger lore-del" onClick={() => onSave(items.filter((_, j) => j !== i))}>✕ Retirer</button>
          </div>
        ))}
    </div>
  );
}

/** Rubriques d'une scène. */
export function SceneLore({ camp, scene, session, universe, state, party, feed, call, dispatch, flash, kinds = Object.keys(SCENE_KINDS), onCreatureSheet }) {
  const [busy, setBusy] = useState('');
  const save = (key, value) => dispatch({ type: 'UPDATE_SCENE', cid: camp.id, sid: scene.id, patch: { expanded: writeScene(scene, key, value) } });
  async function gen(key, prompt) {
    setBusy(key);
    try {
      const def = SCENE_KINDS[key];
      const got = await generateLoreItems({ call, def, universe, state, feed, party, camp, scene, session, prompt, count: 3 });
      const cur = readScene(scene, key);
      if (def.kind === 'list' || def.kind === 'strings') save(key, [...cur, ...got]);
      else if (def.kind === 'single') save(key, got);
      flash(`${def.label} : ${def.kind === 'single' ? 'mis à jour' : `${got.length} ajouté(s)`}.`);
    } catch (e) {
      flash(e.message);
    }
    setBusy('');
  }
  return (
    <div className="lore-wrap">
      {kinds.map((key) => (
        <LoreBlock
          key={key}
          def={SCENE_KINDS[key]}
          value={readScene(scene, key)}
          busy={busy === key}
          onSave={(v) => save(key, v)}
          onGenerate={(p) => gen(key, p)}
          onCreatureSheet={key === 'encounters' ? onCreatureSheet : undefined}
        />
      ))}
    </div>
  );
}

/** Rubriques d'une séance : brief, PNJ, rencontres, fils conducteurs, et ajout de scènes. */
export function SessionLore({ camp, session, universe, state, party, feed, call, dispatch, flash, onAddScene, onCreatureSheet }) {
  const [busy, setBusy] = useState('');
  const save = (patch) =>
    dispatch({ type: 'UPDATE_CAMPAIGN', id: camp.id, patch: { sessions: camp.sessions.map((s) => (s.sessionNumber === session.sessionNumber ? { ...s, ...patch } : s)) } });
  const readS = (key) => (key === 'sessionBrief' ? session.dmBrief || '' : session[key] ?? (SESSION_KINDS[key]?.kind === 'list' || SESSION_KINDS[key]?.kind === 'strings' ? [] : ''));
  const writeS = (key, v) => (key === 'sessionBrief' ? { dmBrief: v } : { [key]: v });
  async function gen(key, prompt) {
    setBusy(key);
    try {
      const def = SESSION_KINDS[key];
      const got = await generateLoreItems({ call, def, universe, state, feed, party, camp, session, prompt, count: 3 });
      if (def.kind === 'text') save({ dmBrief: got });
      else if (def.kind === 'list' || def.kind === 'strings') save({ [key]: [...readS(key), ...got] });
      flash(`${def.label} : mis à jour.`);
    } catch (e) {
      flash(e.message);
    }
    setBusy('');
  }
  return (
    <div className="lore-wrap lore-session">
      {Object.keys(SESSION_KINDS).map((key) => (
        <LoreBlock
          key={key}
          def={SESSION_KINDS[key]}
          value={readS(key)}
          busy={busy === key}
          onSave={(v) => save(writeS(key, v))}
          onGenerate={(p) => gen(key, p)}
          onCreatureSheet={key === 'encounters' ? onCreatureSheet : undefined}
        />
      ))}
      <AddScene onAdd={onAddScene} call={call} camp={camp} session={session} universe={universe} state={state} feed={feed} party={party} flash={flash} />
    </div>
  );
}

/** Ajout d'une scène à la séance : à la main (titre) ou générée avec une consigne. */
function AddScene({ onAdd, call, camp, session, universe, state, feed, party, flash }) {
  const [title, setTitle] = useState('');
  const [consigne, setConsigne] = useState('');
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true);
    try {
      const def = { label: 'Nouvelle scène', kind: 'single', hint: 'Une scène complète de la séance : titre, type (social, exploration, combat, puzzle, climax), lieu exact, résumé et objectif.', schema: '{ "title": str, "type": "social|exploration|combat|puzzle|climax", "location": str, "summary": str, "purpose": str }' };
      const got = await generateLoreItems({ call, def, universe, state, feed, party, camp, session, prompt: consigne, count: 1 });
      onAdd({ title: got.title || title || 'Scène', type: got.type, location: got.location, summary: got.summary, purpose: got.purpose });
      setConsigne('');
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  }
  return (
    <div className="lore-block lore-add">
      <div className="lore-head"><b>Ajouter une scène</b></div>
      <div className="lore-prompt">
        <input className="in" placeholder="Titre (à la main)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="btn sm" onClick={() => onAdd({ title: title || 'Nouvelle scène', type: 'exploration' })}>+ À la main</button>
      </div>
      <div className="lore-prompt">
        <input className="in" placeholder="Consigne pour l’IA (facultatif)" value={consigne} onChange={(e) => setConsigne(e.target.value)} />
        <button type="button" className="btn sm primary" disabled={busy} onClick={generate}>{busy ? <span className="spin" /> : '✦ Générer une scène'}</button>
      </div>
    </div>
  );
}
