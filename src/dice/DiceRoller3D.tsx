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
  updateConfig(config: { theme: string; themeColor: string }): Promise<unknown>;
  roll(notation: string): unknown;
}
type DiceBoxCtor = new (config: Record<string, unknown>) => DiceBoxInstance;

const QUICK_DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'];

/**
 * Textures disponibles : un dossier par thème dans public/assets/dice-box/themes/<id>/,
 * et une vignette (d20) dans public/assets/dice-box/thumbs/<id>.png.
 */
const DICE_THEMES = [
  { id: 'loresmith-cosmic', label: 'Cosmique', themeColor: '#ffffff' },
  { id: 'glace', label: 'Glace', themeColor: '#ffffff' },
  { id: 'arcane', label: 'Arcane', themeColor: '#ffffff' },
  { id: 'magma', label: 'Magma', themeColor: '#ffffff' },
  { id: 'foret', label: 'Forêt', themeColor: '#ffffff' },
] as const;
type DiceTheme = (typeof DICE_THEMES)[number];

export const DiceRoller3D: React.FC<{ active: boolean }> = ({ active }) => {
  const boxRef = useRef<DiceBoxInstance | null>(null);
  const creating = useRef(false);
  const [notation, setNotation] = useState<string>('1d20');
  const [label, setLabel] = useState<string>('');
  const [total, setTotal] = useState<number | null>(null);
  const [groups, setGroups] = useState<DieGroup[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<DiceTheme>(DICE_THEMES[0]);
  // Thème actuellement chargé dans le moteur (roll() ne charge pas de nouveau thème).
  const loadedThemeRef = useRef<string>(DICE_THEMES[0].id);

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
          theme: DICE_THEMES[0].id,
          themeColor: DICE_THEMES[0].themeColor,
          scale: 7,
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

  const roll = async (formula: string) => {
    const f = formula.trim();
    const box = boxRef.current;
    if (!box || !ready || !f) return;
    setNotation(f);
    setLabel(f);
    setTotal(null);
    setGroups([]);
    try {
      if (loadedThemeRef.current !== theme.id) {
        // Charge la texture choisie avant de lancer (le thème doit être chargé dans le moteur).
        await box.updateConfig({ theme: theme.id, themeColor: theme.themeColor });
        loadedThemeRef.current = theme.id;
      }
      // roll() vide la table avant de lancer : pas besoin d'appeler clear().
      box.roll(f);
    } catch (err) {
      console.error('Dice-Box roll a échoué :', err);
      setError(`Notation invalide : ${f}`);
    }
  };

  return (
    <div className="flex flex-col items-center bg-[#16110a] border border-[#c9a24a]/40 p-4 rounded-2xl shadow-2xl w-full text-white">
      <h2 className="text-xl font-black font-['Cinzel'] text-[#c9a24a] mb-3">🎲 Lanceur de dés 3D RPG</h2>

      <div className="grid grid-cols-3 gap-2 w-full mb-3" role="radiogroup" aria-label="Texture des dés">
        {DICE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme.id === t.id}
            onClick={() => setTheme(t)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
              theme.id === t.id
                ? 'border-[#c9a24a] bg-[#c9a24a]/10'
                : 'border-[#c9a24a]/20 bg-[#1c150c] hover:border-[#c9a24a]/60'
            }`}
          >
            <img
              src={`/assets/dice-box/thumbs/${t.id}.png`}
              alt=""
              width={56}
              height={56}
              className="w-14 h-14 rounded-md object-contain"
            />
            <span className="text-xs font-['Cinzel'] text-[#f3e6c0]">{t.label}</span>
          </button>
        ))}
      </div>

      <div
        id="dice-box"
        className="w-full h-[300px] bg-[#0b0906] rounded-xl border border-[#c9a24a]/30 shadow-inner relative overflow-hidden mb-3 [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full"
      />

      <div className="flex flex-wrap gap-1.5 w-full mb-3">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => roll(d)}
            disabled={!ready}
            className="px-2.5 py-1 rounded-md bg-[#1c150c] border border-[#c9a24a]/30 hover:border-[#c9a24a] text-sm font-mono disabled:opacity-40"
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
          className="flex-1 px-4 py-2 rounded-lg bg-[#1c150c] border border-[#c9a24a]/30 text-[#f3e6c0] font-mono focus:outline-none focus:border-[#c9a24a]"
        />
        <button
          type="submit"
          disabled={!ready}
          className="px-6 py-2 bg-[#7d6128] hover:bg-[#c9a24a] hover:text-[#0b0906] active:scale-95 text-[#f3e6c0] font-bold rounded-lg shadow-lg shadow-[#c9a24a]/20 transition-all disabled:opacity-40"
        >
          Lancer !
        </button>
      </form>

      {!ready && !error && <p className="text-sm text-[#c9a24a]/70">Chargement du moteur 3D…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {total !== null && (
        <div className="bg-[#0b0906]/60 p-4 rounded-xl border border-[#c9a24a]/40 w-full text-center">
          <div className="text-sm text-[#c9a24a]/70 uppercase tracking-wider font-semibold">Total du jet</div>
          <div className="text-5xl font-black text-[#ecd289] my-1">{total}</div>
          <div className="text-xs text-[#c9a24a]/60 font-mono mt-2">
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
        className="fixed right-4 bottom-4 z-50 w-14 h-14 rounded-full bg-[#7d6128] hover:bg-[#c9a24a] text-2xl shadow-lg shadow-[#c9a24a]/30 active:scale-95 transition-all"
      >
        🎲
      </button>
    </>
  );
}
