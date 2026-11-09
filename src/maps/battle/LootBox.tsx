/**
 * Fouille d'un vaincu (MJ) : suggestions de butin logiques selon ce qu'il est (cf. loot.js), à cocher puis à
 * consigner au journal du combat. Les dépouilles demandent un jet (Survie, Nature) : la case s'affiche avec son DD.
 */
import { useEffect, useMemo, useState } from 'react';
import type { BattleToken, World } from '../mapStore';
import { STATS } from '../atlas/statblocks';
import { lootOf, type LootSubject } from './loot';
import { usePuzzles } from '../../puzzles/context';

type Ref = { name: string; loot?: string[]; ecology?: { diet?: string } };
let refsCache: Ref[] | null = null;
/** Fiches d'espèce des rencontres vivantes (chargées à la première fouille, un morceau à part). */
async function loadRefs(): Promise<Ref[]> {
  if (refsCache) return refsCache;
  const mod = (await import('../../encounters/data/creature-refs.v1.json')) as unknown as { default?: { references: Ref[] }; references?: Ref[] };
  refsCache = (mod.default ?? mod).references ?? [];
  return refsCache;
}
const low = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** La fiche d'espèce la plus précise dont le nom figure dans celui du jeton (« Kuo-toa pêcheur de grotte » avant « Kuo-toa »). */
export function refFor(name: string, refs: Ref[]) {
  const n = low(name);
  return refs.filter((r) => n.includes(low(r.name))).sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

const KIND_ICON: Record<string, string> = { equipement: '🗡', objet: '🎒', vivres: '🍞', monnaie: '🪙', indice: '📜' };

export default function LootBox({ t, subject: extra, region, seed, onDone, onReset }: {
  t: Pick<BattleToken, 'id' | 'name' | 'statId' | 'looted'>; region: World; seed: string;
  /** Ce qu'on sait d'autre de lui (fiche du bestiaire de l'univers : nature, FP), à défaut d'une fiche SRD. */
  subject?: Partial<LootSubject>;
  /** Marque le vaincu comme fouillé (ce qui a été pris) et consigne la fouille au journal du combat. */
  onDone: (taken: string[], text: string) => void;
  onReset: () => void;
}) {
  const [refs, setRefs] = useState<Ref[] | null>(refsCache);
  useEffect(() => { if (!refs) loadRefs().then(setRefs).catch(() => setRefs([])); }, [refs]);
  const stat = t.statId ? STATS[t.statId] : undefined;
  const loot = useMemo(() => {
    const subject: LootSubject = { id: t.id, name: t.name, meta: stat?.meta ?? extra?.meta, ac: stat?.ac ?? extra?.ac, cr: stat?.cr ?? extra?.cr, actions: stat?.actions ?? extra?.actions, ref: refs ? refFor(t.name, refs) : null };
    return lootOf(subject, { region, seed });
  }, [t.id, t.name, stat, refs, region, seed, extra?.meta, extra?.ac, extra?.cr, extra?.actions]);
  // Tout est pris par défaut : on décoche ce que les héros laissent (la liste peut s'allonger quand les fiches arrivent).
  const [left, setLeft] = useState<Set<string>>(() => new Set());
  // Ce que les héros prennent va aussi dans le Carnet du groupe (visible sur l'écran joueur).
  const lib = usePuzzles();
  const [toCarnet, setToCarnet] = useState(true);
  const taken = { has: (label: string) => !left.has(label) };
  const toggle = (label: string) => setLeft((s) => { const n = new Set(s); if (n.has(label)) n.delete(label); else n.add(label); return n; });

  if (t.looted) {
    return (
      <div className="combat-loot done">
        <b>🎒 Déjà fouillé</b>
        <p className="maps-sub">{t.looted.length ? `Pris : ${t.looted.join(', ')}.` : 'Rien n’a été pris.'}</p>
        <button className="maps-btn" onClick={onReset} title="Effacer la fouille pour recommencer">Refouiller</button>
      </div>
    );
  }
  return (
    <div className="combat-loot">
      <b>🎒 Fouiller {t.name}</b>
      <p className="maps-sub">Suggestions selon ce qu’il est : coche ce que les héros prennent.</p>
      <ul>
        {loot.items.map((i) => (
          <li key={i.label}>
            <label><input type="checkbox" checked={taken.has(i.label)} onChange={() => toggle(i.label)} /> {KIND_ICON[i.kind] ?? '•'} {i.label}</label>
          </li>
        ))}
      </ul>
      {loot.harvest && (
        <p className="combat-loot-harvest">🔪 À prélever sur un jet de <b>{loot.harvest.skill} DD {loot.harvest.dc}</b> (10 minutes) : {loot.harvest.items.join(', ')}.</p>
      )}
      {loot.note && <p className="maps-sub">{loot.note}</p>}
      {lib && <label className="combat-loot-carnet"><input type="checkbox" checked={toCarnet} onChange={(e) => setToCarnet(e.target.checked)} /> 📜 Ajouter ce qui est pris au Carnet du groupe</label>}
      <button className="maps-btn gold" onClick={() => {
        const list = loot.items.map((i) => i.label).filter((l) => taken.has(l));
        if (lib && toCarnet) {
          const now = Date.now();
          loot.items.filter((i) => taken.has(i.label)).forEach((i, k) => lib.saveClue({
            id: `butin-${now.toString(36)}-${k}-${Math.random().toString(36).slice(2, 6)}`, universeId: lib.universeId,
            title: i.label.charAt(0).toUpperCase() + i.label.slice(1), kind: i.kind === 'indice' ? 'page' : 'objet',
            text: `Trouvé sur ${t.name}.`, held: true, gmNote: `Butin de ${t.name} (fouille après combat).`, createdAt: now,
          }));
        }
        onDone(list, list.length ? `Les héros fouillent ${t.name} : ${list.join(', ')}.${lib && toCarnet ? ' (ajouté au Carnet du groupe)' : ''}` : `Les héros fouillent ${t.name} : rien d’utile.`);
      }}>Fouillé : consigner au journal</button>
    </div>
  );
}
