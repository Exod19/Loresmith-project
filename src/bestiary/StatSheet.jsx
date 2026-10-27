/**
 * Fiche de PNJ ou de créature, au format d'un bloc de statistiques D&D 5e complet,
 * suivie de ce qui sert à jouer le personnage (voix, motivations, secrets, répliques) et du butin.
 */
import { proficiencyForCr, xpForCr } from './entityGen';
import './bestiary.css';

const ABIL = [
  ['str', 'FOR'],
  ['dex', 'DEX'],
  ['con', 'CON'],
  ['int', 'INT'],
  ['wis', 'SAG'],
  ['cha', 'CHA'],
];
const TYPE_LABEL = {
  action: 'Actions',
  'bonus action': 'Actions bonus',
  reaction: 'Réactions',
  'legendary action': 'Actions légendaires',
  'lair action': 'Actions de repaire',
};
const RESET = { round: 'par round', turn: 'par tour', 'short rest': 'repos court', 'long rest': 'repos long', day: 'par jour', encounter: 'par rencontre' };
const SIZE = { TP: 'Très petite', P: 'Petite', M: 'Moyenne', G: 'Grande', TG: 'Très grande', Gig: 'Gigantesque' };

const mod = (v) => Math.floor(((Number(v) || 10) - 10) / 2);
const signed = (n) => (n >= 0 ? `+${n}` : `−${-n}`);

function avg(dice, bonus) {
  const m = /(\d+)d(\d+)/.exec(dice || '');
  if (!m) return null;
  return Math.floor((Number(m[1]) * (Number(m[2]) + 1)) / 2) + (Number(bonus) || 0);
}

function attackLine(a) {
  const bits = [];
  if (a.attackBonus !== undefined && a.attackBonus !== null && a.attackBonus !== '') bits.push(`${signed(Number(a.attackBonus))} au toucher`);
  if (a.range) bits.push(a.range);
  const av = avg(a.damageDice, a.damageBonus);
  if (av !== null) bits.push(`Touché : ${av} (${a.damageDice}${Number(a.damageBonus) ? ` ${signed(Number(a.damageBonus))}` : ''})${a.damageType ? ` ${a.damageType}` : ''}`);
  if (a.save) bits.push(`Sauvegarde : ${a.save}`);
  return bits.join(' · ');
}

function Line({ label, value }) {
  if (!value || (Array.isArray(value) && !value.length)) return null;
  return (
    <p className="ss-line">
      <b>{label}</b> {Array.isArray(value) ? value.join(', ') : value}
    </p>
  );
}

function Uses({ left, max, reset, onSpend, onRestore }) {
  if (!max) return null;
  return (
    <span className="ss-uses">
      {Array.from({ length: Math.min(max, 10) }, (_, i) => (
        <i key={i} data-on={i < left ? 1 : 0} />
      ))}
      <small>{RESET[reset] || reset || ''}</small>
      <button type="button" onClick={onSpend} disabled={left <= 0} title="Utiliser">
        −
      </button>
      <button type="button" onClick={onRestore} disabled={left >= max} title="Récupérer">
        +
      </button>
    </span>
  );
}

export default function StatSheet({ n, portrait, token, scenes = [], campaigns = [], onSpendAction, onEffect, actions, onPortraitClick }) {
  const isMonster = n.entityType === 'monster' || n.isMonster;
  const pb = proficiencyForCr(n.cr);
  const xp = xpForCr(n.cr);
  const meta = [n.size && (SIZE[n.size] || n.size), n.type || n.kind, n.alignment].filter(Boolean).join(' · ');
  const byType = {};
  (n.actions || []).forEach((a, i) => {
    const t = TYPE_LABEL[a.type] ? a.type : 'action';
    (byType[t] ||= []).push([a, i]);
  });

  return (
    <article className="ss" data-kind={isMonster ? 'monster' : 'npc'}>
      <header className="ss-head">
        <button type="button" className="ss-portrait" onClick={onPortraitClick} title="Image et jeton">
          {portrait ? <img src={portrait} alt={n.name} /> : <span>{isMonster ? '👹' : '✦'}</span>}
          {token && <img className="ss-token" src={token} alt="Jeton" />}
        </button>
        <div className="ss-title">
          <div className="ss-kicker">
            <span>{isMonster ? 'Créature' : 'PNJ'}</span>
            {n.role && <span>{n.role}</span>}
            {n.attitude && <span>{n.attitude}</span>}
            {n.faction && <span>{n.faction}</span>}
          </div>
          <h2>{n.name}</h2>
          {meta && <p className="ss-meta">{meta}</p>}
          {n.shortDescription && <p className="ss-short">{n.shortDescription}</p>}
          {actions}
        </div>
      </header>

      <div className="ss-block">
        <div className="ss-quick">
          <div>
            <b>Classe d’armure</b> {n.ac || '—'}
            {n.acNote ? ` (${n.acNote})` : ''}
          </div>
          <div>
            <b>Points de vie</b> {n.hp || '—'}
            {n.hitDice ? ` (${n.hitDice})` : ''}
          </div>
          <div>
            <b>Vitesse</b> {n.speed || '—'}
          </div>
        </div>
        <div className="ss-abil">
          {ABIL.map(([k, l]) => (
            <div key={k}>
              <small>{l}</small>
              <b>{n[k] || 10}</b>
              <span>{signed(mod(n[k]))}</span>
            </div>
          ))}
        </div>
        <Line label="Jets de sauvegarde" value={(n.saves || []).map((s) => `${s.name} ${s.bonus}`.trim())} />
        <Line label="Compétences" value={(n.skills || []).map((s) => `${s.name} ${s.bonus}`.trim())} />
        <Line label="Vulnérabilités" value={n.vulnerabilities} />
        <Line label="Résistances" value={n.resistances} />
        <Line label="Immunités" value={n.immunities} />
        <Line label="Immunités d’état" value={n.conditionImmunities} />
        <Line label="Sens" value={n.senses} />
        <Line label="Langues" value={n.languages} />
        <p className="ss-line">
          <b>Facteur de puissance</b> {n.cr || '—'}
          {xp ? ` (${xp} PX)` : ''} · <b>Bonus de maîtrise</b> {signed(pb)}
        </p>
      </div>

      {(n.traits || []).length > 0 && (
        <section className="ss-sec">
          {(n.traits || []).map((t, i) => (
            <p key={i}>
              <b>{t.name}.</b> {t.desc}
            </p>
          ))}
        </section>
      )}

      {n.spellcasting?.list?.length > 0 && (
        <section className="ss-sec">
          <h3>Incantation</h3>
          <p>
            Caractéristique : {n.spellcasting.ability || '—'}
            {n.spellcasting.dc ? ` · DD ${n.spellcasting.dc}` : ''}
            {n.spellcasting.attack ? ` · attaque ${n.spellcasting.attack}` : ''}
          </p>
          <ul>
            {n.spellcasting.list.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {Object.entries(TYPE_LABEL).map(([type, label]) =>
        byType[type]?.length ? (
          <section key={type} className="ss-sec">
            <h3>{label}</h3>
            {byType[type].map(([a, i]) => (
              <div key={i} className="ss-action">
                <p>
                  <b>{a.name}.</b> {attackLine(a) && <em>{attackLine(a)}. </em>}
                  {a.desc}
                </p>
                <Uses
                  left={Number(a.usesLeft ?? a.usesMax ?? 0)}
                  max={Number(a.usesMax || 0)}
                  reset={a.reset}
                  onSpend={() => onSpendAction?.(i, -1)}
                  onRestore={() => onSpendAction?.(i, 1)}
                />
              </div>
            ))}
          </section>
        ) : null
      )}

      {(n.legendaryActions || []).length > 0 && (
        <section className="ss-sec">
          <h3>Actions légendaires</h3>
          {n.legendaryActions.map((a, i) => (
            <p key={i}>
              <b>{a.name}.</b> {a.desc}
            </p>
          ))}
        </section>
      )}

      {(n.effects || []).length > 0 && (
        <section className="ss-sec">
          <h3>Effets activables</h3>
          {n.effects.map((e, i) => (
            <div key={i} className="ss-action" data-active={e.active ? 1 : 0}>
              <p>
                <button type="button" className="ss-toggle" onClick={() => onEffect?.(i, { active: !e.active })}>
                  {e.icon || '✦'} {e.active ? 'Actif' : 'Inactif'}
                </button>{' '}
                <b>{e.name}.</b> {e.desc || e.short}
              </p>
              <Uses
                left={Number(e.usesLeft ?? e.usesMax ?? 0)}
                max={Number(e.usesMax || 0)}
                reset={e.reset}
                onSpend={() => onEffect?.(i, { usesLeft: Math.max(0, Number(e.usesLeft ?? e.usesMax ?? 0) - 1) })}
                onRestore={() => onEffect?.(i, { usesLeft: Math.min(Number(e.usesMax || 0), Number(e.usesLeft ?? e.usesMax ?? 0) + 1) })}
              />
            </div>
          ))}
        </section>
      )}

      {n.tactics && (
        <section className="ss-sec ss-gm">
          <h3>Tactique</h3>
          <p>{n.tactics}</p>
        </section>
      )}

      {(n.voice || n.motivation || n.secret || n.quotes?.length || n.sceneUse || n.function) && (
        <section className="ss-sec ss-gm">
          <h3>Pour le jouer</h3>
          {n.function && (
            <p>
              <b>Fonction :</b> {n.function}
            </p>
          )}
          {n.voice && (
            <p>
              <b>Voix :</b> {n.voice}
              {n.speechPatterns ? ` — ${n.speechPatterns}` : ''}
            </p>
          )}
          {n.motivation && (
            <p>
              <b>Veut :</b> {n.motivation}
            </p>
          )}
          {n.secret && (
            <p>
              <b>Secret :</b> {n.secret}
            </p>
          )}
          {n.sceneUse && (
            <p>
              <b>En scène :</b> {n.sceneUse}
            </p>
          )}
          {n.quotes?.length > 0 && (
            <ul className="ss-quotes">
              {n.quotes.map((q, i) => (
                <li key={i}>« {q} »</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(n.description || n.backstory) && (
        <section className="ss-sec">
          <h3>Description</h3>
          {n.description && <p>{n.description}</p>}
          {n.backstory && <p>{n.backstory}</p>}
        </section>
      )}

      {(n.lootTable || []).length > 0 && (
        <section className="ss-sec">
          <h3>Butin (d20)</h3>
          <table className="ss-loot">
            <tbody>
              {n.lootTable.map((l, i) => (
                <tr key={i}>
                  <td>{l.roll}</td>
                  <td>
                    <b>{l.item}</b> {l.desc}
                  </td>
                  <td>{l.rarity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(scenes.length > 0 || campaigns.length > 0) && (
        <section className="ss-sec">
          <h3>Apparitions</h3>
          <div className="ss-chips">
            {campaigns.map((c) => (
              <span key={c}>Campagne · {c}</span>
            ))}
            {scenes.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>
      )}
      {n.source && <p className="ss-source">Source : {n.source}</p>}
    </article>
  );
}
