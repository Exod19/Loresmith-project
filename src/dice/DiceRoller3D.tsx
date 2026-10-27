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
  { id: 'orage', label: 'Orage', themeColor: '#ffffff' },
  { id: 'abysse', label: 'Abysse', themeColor: '#ffffff' },
  { id: 'alchimie', label: 'Alchimie', themeColor: '#ffffff' },
  { id: 'sang', label: 'Sang', themeColor: '#ffffff' },
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
  const [themeLoading, setThemeLoading] = useState(false);
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
        setThemeLoading(true);
        try {
          await box.updateConfig({ theme: theme.id, themeColor: theme.themeColor });
          loadedThemeRef.current = theme.id;
        } finally {
          setThemeLoading(false);
        }
      }
      // roll() vide la table avant de lancer : pas besoin d'appeler clear().
      box.roll(f);
    } catch (err) {
      console.error('Dice-Box roll a échoué :', err);
      setError(`Notation invalide : ${f}`);
    }
  };

  return (
    <div className="flex flex-col items-center bg-gradient-to-b from-[#1c150c] via-[#16110a] to-[#0b0906] border border-[#c9a24a]/50 ring-1 ring-[#c9a24a]/15 ring-offset-2 ring-offset-[#0b0906] p-4 rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] w-full text-white">
      <h2 className="text-xl font-black font-['Cinzel'] tracking-wide text-[#ecd289] drop-shadow-[0_0_10px_rgba(201,162,74,0.35)] mb-1">
        🎲 Lanceur de dés 3D RPG
      </h2>
      <div className="h-px w-2/3 bg-gradient-to-r from-transparent via-[#c9a24a] to-transparent mb-3" aria-hidden="true" />

      <div className="grid grid-cols-5 gap-2 w-full mb-1" role="radiogroup" aria-label="Texture des dés">
        {DICE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme.id === t.id}
            onClick={() => setTheme(t)}
            disabled={themeLoading}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all hover:-translate-y-0.5 disabled:opacity-60 ${
              theme.id === t.id
                ? 'border-[#c9a24a] bg-[#c9a24a]/15 shadow-[0_0_14px_rgba(201,162,74,0.35)]'
                : 'border-[#c9a24a]/20 bg-[#1c150c] hover:border-[#c9a24a]/60'
            }`}
          >
            <img
              src={`/assets/dice-box/thumbs/${t.id}.png`}
              alt=""
              width={48}
              height={48}
              className="w-12 h-12 rounded-md object-contain"
            />
            <span className="text-[11px] font-['Cinzel'] text-[#f3e6c0]">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[#c9a24a]/80 font-['Cinzel'] mb-3 h-4" aria-live="polite">
        {themeLoading ? 'Chargement de la texture…' : `Texture : ${theme.label}`}
      </p>

      <div
        id="dice-box"
        className="w-full h-[300px] bg-[#0b0906] bg-[url('/assets/dice-roller/zone-lancer-classique.jpg')] bg-cover bg-center rounded-xl border border-[#c9a24a]/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.75)] relative overflow-hidden mb-3 [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full"
      />

      <div className="flex flex-wrap gap-1.5 w-full mb-3">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => roll(d)}
            disabled={!ready || themeLoading}
            className={`px-2.5 py-1 rounded-md border text-sm font-mono transition-all hover:-translate-y-0.5 disabled:opacity-40 ${
              notation === d
                ? 'border-[#c9a24a] bg-[#c9a24a]/15 text-[#ecd289] shadow-[0_0_10px_rgba(201,162,74,0.35)]'
                : 'border-[#c9a24a]/30 bg-[#1c150c] text-[#f3e6c0] hover:border-[#c9a24a]'
            }`}
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
          className="flex-1 px-4 py-2 rounded-lg bg-[#0b0906] border border-[#c9a24a]/40 text-[#f3e6c0] font-mono shadow-inner focus:outline-none focus:border-[#c9a24a] focus:shadow-[0_0_10px_rgba(201,162,74,0.3)]"
        />
        <button
          type="submit"
          disabled={!ready || themeLoading}
          className="px-6 py-2 font-['Cinzel'] font-bold tracking-wide rounded-lg border border-[#ecd289]/60 bg-gradient-to-b from-[#ecd289] via-[#c9a24a] to-[#7d6128] text-[#16110a] shadow-lg shadow-[#c9a24a]/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
        >
          Lancer !
        </button>
      </form>

      {!ready && !error && <p className="text-sm text-[#c9a24a]/70">Chargement du moteur 3D…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {total !== null && (
        <div className="bg-gradient-to-b from-[#1c150c] to-[#0b0906] p-4 rounded-xl border border-[#c9a24a]/50 shadow-[inset_0_0_24px_rgba(201,162,74,0.12)] w-full text-center">
          <div className="text-sm font-['Cinzel'] text-[#c9a24a]/80 uppercase tracking-[0.2em] font-semibold">Total du jet</div>
          <div className="text-5xl font-black font-['Cinzel'] text-[#ecd289] drop-shadow-[0_0_14px_rgba(236,210,137,0.45)] my-1">{total}</div>
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
        className="fixed right-4 bottom-4 z-50 w-16 h-16 rounded-full bg-[url('/assets/dice-roller/bouton-flottant-d20.png')] bg-cover bg-center shadow-lg shadow-[#c9a24a]/40 hover:scale-105 hover:shadow-[#c9a24a]/60 active:scale-95 transition-all"
      />
    </>
  );
}
