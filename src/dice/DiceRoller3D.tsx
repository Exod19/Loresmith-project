/**
 * Lanceur de dés 3D (dice-box) : les dés roulent physiquement dans un canevas, puis le total et le détail s'affichent.
 * Le moteur n'est chargé qu'à la première ouverture du panneau, et reste en mémoire ensuite.
 * Les assets (dés, textures) sont dans public/assets/dice-box.
 */
import React, { useEffect, useRef, useState } from 'react';

type DieRoll = { value: number };
type DieGroup = { groupId: string; value: number; rolls?: DieRoll[] };
interface DiceBoxInstance {
  init(): Promise<unknown>;
  roll(notation: string): unknown;
}
type DiceBoxCtor = new (config: Record<string, unknown>) => DiceBoxInstance;

const QUICK_DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'];

export const DiceRoller3D: React.FC<{ active: boolean }> = ({ active }) => {
  const boxRef = useRef<DiceBoxInstance | null>(null);
  const creating = useRef(false);
  const [notation, setNotation] = useState<string>('1d20');
  const [label, setLabel] = useState<string>('');
  const [total, setTotal] = useState<number | null>(null);
  const [groups, setGroups] = useState<DieGroup[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Un seul moteur : le drapeau est posé avant l'import asynchrone (StrictMode monte deux fois).
    if (!active || creating.current) return;
    creating.current = true;
    (async () => {
      try {
        const mod = (await import('@3d-dice/dice-box')) as unknown as { default: DiceBoxCtor };
        const box = new mod.default({
          container: '#dice-box',
          id: 'dice-canvas',
          assetPath: '/assets/dice-box/',
          theme: 'default',
          themeColor: '#4f46e5',
          offscreen: false,
          // Appelé dès que les dés sont immobiles. `value` = total du groupe (ex. 2d6 → somme).
          onRollComplete: (results: DieGroup[]) => {
            setGroups(results);
            setTotal(results.reduce((sum, d) => sum + d.value, 0));
          },
        });
        boxRef.current = box;
        await box.init();
        setReady(true);
      } catch {
        setError('Le moteur 3D n’a pas pu démarrer (WebGL désactivé ?).');
      }
    })();
  }, [active]);

  const roll = (formula: string) => {
    const f = formula.trim();
    const box = boxRef.current;
    if (!box || !ready || !f) return;
    setNotation(f);
    setLabel(f);
    setTotal(null);
    setGroups([]);
    try {
      // roll() vide la table avant de lancer : pas besoin d'appeler clear().
      box.roll(f);
    } catch {
      setError(`Notation invalide : ${f}`);
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-900 p-4 rounded-2xl shadow-2xl w-full text-white">
      <h2 className="text-xl font-black text-indigo-400 mb-3">🎲 Lanceur de dés 3D RPG</h2>

      <div
        id="dice-box"
        className="w-full h-[300px] bg-slate-950 rounded-xl border border-slate-800 shadow-inner relative overflow-hidden mb-3"
      />

      <div className="flex flex-wrap gap-1.5 w-full mb-3">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => roll(d)}
            disabled={!ready}
            className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 hover:border-indigo-500 text-sm font-mono disabled:opacity-40"
          >
            {d}
          </button>
        ))}
      </div>

      <form
        className="flex gap-3 items-center w-full mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          roll(notation);
        }}
      >
        <input
          type="text"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          placeholder="Ex: 1d20+5, 2d6, 4d10"
          className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!ready}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-40"
        >
          Lancer !
        </button>
      </form>

      {!ready && !error && <p className="text-sm text-slate-400">Chargement du moteur 3D…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {total !== null && (
        <div className="bg-slate-950/60 p-4 rounded-xl border border-indigo-500/30 w-full text-center">
          <div className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total du jet</div>
          <div className="text-5xl font-black text-indigo-400 my-1">{total}</div>
          <div className="text-xs text-slate-500 font-mono mt-2">
            {label} → {groups.map((g) => `[${(g.rolls ?? []).map((r) => r.value).join(', ') || g.value}]`).join(' + ')}
          </div>
        </div>
      )}
    </div>
  );
};

/** Bouton flottant 🎲 + panneau, visible sur les pages « Jouer ». Le panneau reste monté : les dés ne sont pas réinitialisés. */
export function DiceFloater() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={`fixed right-4 bottom-20 z-50 w-[min(440px,calc(100vw-2rem))] transition-all duration-200 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <DiceRoller3D active={open} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Fermer le lanceur de dés' : 'Ouvrir le lanceur de dés'}
        className="fixed right-4 bottom-4 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-2xl shadow-lg shadow-indigo-600/40 active:scale-95 transition-all"
      >
        🎲
      </button>
    </>
  );
}
