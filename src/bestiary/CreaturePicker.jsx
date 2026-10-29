/**
 * Sélecteur de créatures pour le combat : par type, puis par famille, puis par variante (de la plus faible à la plus
 * forte), avec l'image, le rôle, FP, PV, CA et la taille. On choisit combien, on voit l'effet sur la difficulté, et
 * on ajoute (placement tactique) ou on glisse la vignette sur le plateau, à l'endroit voulu.
 */
import { useMemo, useState } from 'react';
import { buildCatalog } from './catalog.js';

/** Type de données du glisser-déposer vers la carte de combat. */
export const CREATURE_DRAG = 'application/x-loresmith-creature';

const SIZE_FR = { TP: 'très petite', P: 'petite', M: 'moyenne', G: 'grande', TG: 'très grande', Gig: 'gigantesque' };
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * `npcs` : les fiches du bestiaire ; `imageOf(n)` : son jeton ; `rate(n, count)` : difficulté si on l'ajoute
 * ({ label, before }) ; `onAdd(n, count)` : ajout avec placement tactique ; `payloadOf(n, count)` : ce que porte le glisser.
 */
export default function CreaturePicker({ npcs, imageOf, rate, onAdd, payloadOf }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [fam, setFam] = useState('');
  const [sel, setSel] = useState('');
  const [count, setCount] = useState(1);

  const monsters = useMemo(() => npcs.filter((n) => n.entityType === 'monster' || n.isMonster), [npcs]);
  const catalog = useMemo(() => buildCatalog(monsters), [monsters]);
  const found = useMemo(() => {
    const k = fold(q.trim());
    return k ? monsters.filter((n) => fold(`${n.name} ${n.kind} ${n.type} ${n.role}`).includes(k)).slice(0, 24) : [];
  }, [monsters, q]);
  const typeNode = catalog.find((t) => t.type === type);
  const famNode = typeNode?.families.find((f) => f.key === fam);
  const variants = q.trim() ? found : famNode ? famNode.members : [];
  const chosen = monsters.find((n) => n.id === sel) || null;
  const r = chosen ? rate(chosen, count) : null;

  const tile = (n) => (
    <li key={n.id}>
      <button
        type="button" className="cp-tile" data-on={sel === n.id ? 1 : 0} onClick={() => setSel(n.id)}
        draggable onDragStart={(e) => { e.dataTransfer.setData(CREATURE_DRAG, JSON.stringify(payloadOf(n, count))); e.dataTransfer.effectAllowed = 'copy'; setSel(n.id); }}
        title="Glisse sur le plateau pour la poser à cet endroit"
      >
        {imageOf(n) ? <img src={imageOf(n)} alt="" loading="lazy" /> : <span className="cp-ph">👹</span>}
        <span className="cp-tile-text">
          <b>{n.name}</b>
          <small>{[n.underdark?.variantRoleLabel, `FP ${n.cr || '—'}`, `PV ${n.hp}`, `CA ${n.ac}`, SIZE_FR[n.size]].filter(Boolean).join(' · ')}</small>
        </span>
      </button>
    </li>
  );

  return (
    <div className="cp">
      <input className="input" placeholder="Chercher une créature (gobelin, araignée, limon…)" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q.trim() && (
        <>
          <div className="cp-chips" role="tablist" aria-label="Type de créature">
            {catalog.map((t) => (
              <button key={t.type} type="button" role="tab" aria-selected={type === t.type} data-on={type === t.type ? 1 : 0} onClick={() => { setType(t.type); setFam(''); setSel(''); }}>
                {t.type} <small>{t.count}</small>
              </button>
            ))}
          </div>
          {typeNode && (
            <div className="cp-chips cp-fams" role="tablist" aria-label="Famille">
              {typeNode.families.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={fam === f.key} data-on={fam === f.key ? 1 : 0} onClick={() => { setFam(f.key); setSel(f.members.length === 1 ? f.members[0].id : ''); }}>
                  {f.name}{f.members.length > 1 ? <small> {f.members.length}</small> : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {variants.length > 0 && <ul className="cp-tiles">{variants.map(tile)}</ul>}
      {!q.trim() && !typeNode && <p className="muted cp-hint">Choisis un type, puis une famille : ses variantes s’affichent de la plus faible à la plus forte.</p>}
      {q.trim() && !found.length && <p className="muted cp-hint">Aucune fiche de ce nom dans le bestiaire.</p>}

      {chosen && (
        <div className="cp-add">
          <div className="cp-count">
            <button type="button" className="btn sm" onClick={() => setCount(Math.max(1, count - 1))}>−</button>
            <b>{count}</b>
            <button type="button" className="btn sm" onClick={() => setCount(Math.min(12, count + 1))}>+</button>
            <span>× {chosen.name}</span>
          </div>
          {r && <p className={`cp-rate lvl-${r.label}`}>Difficulté : {r.before} → <b>{r.label}</b> ({r.adjusted} XP ajustés)</p>}
          <div className="skirmish-row wrap">
            <button className="btn sm primary" onClick={() => onAdd(chosen, count)}>Ajouter {count > 1 ? `les ${count}` : ''} (placement tactique)</button>
            <span className="muted cp-hint">… ou glisse la vignette sur le plateau.</span>
          </div>
        </div>
      )}
    </div>
  );
}
