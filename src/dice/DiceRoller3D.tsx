/**
 * Lanceur de dés 3D (dice-box) : les dés roulent physiquement dans un canevas, puis le total et le détail s'affichent.
 * Le moteur n'est chargé qu'à la première ouverture du panneau, et reste en mémoire ensuite.
 * Les assets (dés, textures) sont dans public/assets/dice-box.
 */
import React, { useEffect, useRef, useState } from 'react';
import { criticalOutcome, type DieGroup } from './criticalOutcome';


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
/** Arènes de fond de la zone de lancer (assets Drive « arena »). */
const ARENES = {
  classique: { label: 'Classique', url: '/assets/dice-roller/arene-classique.webp' },
  underdark: { label: 'Underdark', url: '/assets/dice-roller/arene-underdark.webp' },
} as const;
type Arene = keyof typeof ARENES;

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
  const [arene, setArene] = useState<Arene>('classique');
  const [themeLoading, setThemeLoading] = useState(false);
  const crit = criticalOutcome(groups);
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
        Lanceur de dés 3D RPG
      </h2>
      <div className="h-px w-2/3 bg-gradient-to-r from-transparent via-[#c9a24a] to-transparent mb-3" aria-hidden="true" />


      <div
        id="dice-box"
        style={{ backgroundImage: `url(${ARENES[arene].url})` }}
        className="w-full h-[clamp(180px,38vh,300px)] bg-[#0b0906] bg-cover bg-center rounded-xl border border-[#c9a24a]/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.75)] relative overflow-hidden [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full"
      />
      <div className="flex justify-end w-full mt-2 mb-3">
        <button
          type="button"
          onClick={() => setArene((a) => (a === 'classique' ? 'underdark' : 'classique'))}
          aria-label="Changer d'arène"
          className="px-2 py-0.5 rounded border border-[#c9a24a]/50 bg-[#0b0906] text-[10px] font-['Cinzel'] tracking-wide text-[#ecd289] hover:border-[#ecd289] transition-colors"
        >
          Arène : {ARENES[arene].label}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 w-full mb-3">
        {QUICK_DICE.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => roll(d)}
            disabled={!ready || themeLoading}
            className={`flex-1 min-w-0 px-1 py-1.5 rounded-md border text-sm font-mono font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40 ${
              notation === d
                ? 'border-[#ecd289] bg-gradient-to-b from-[#3a2c12] to-[#1c150c] text-[#ecd289] shadow-[0_0_12px_rgba(236,210,137,0.4)]'
                : 'border-[#c9a24a]/30 bg-gradient-to-b from-[#1c150c] to-[#0b0906] text-[#f3e6c0] hover:border-[#c9a24a] hover:text-[#ecd289]'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 w-full mb-1" role="radiogroup" aria-label="Texture des dés">
        {DICE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme.id === t.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTheme(t)}
            disabled={themeLoading}
            className={`flex-1 min-w-0 p-0.5 rounded-md border transition-all hover:-translate-y-0.5 disabled:opacity-60 ${
              theme.id === t.id
                ? 'border-[#ecd289] bg-[#c9a24a]/15 shadow-[0_0_10px_rgba(236,210,137,0.4)]'
                : 'border-[#c9a24a]/20 bg-[#1c150c] hover:border-[#c9a24a]/60'
            }`}
          >
            <img
              src={`/assets/dice-roller/cartes/${t.id}.webp`}
              alt=""
              className="w-full aspect-[67/83] rounded object-cover"
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-[#c9a24a]/80 font-['Cinzel'] mb-3 h-4" aria-live="polite">
        {themeLoading ? 'Chargement de la texture…' : `Texture : ${theme.label}`}
      </p>

      <form
        className="flex gap-3 items-center w-full mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          roll(notation);
        }}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0906] border border-[#c9a24a]/40 shadow-inner focus-within:border-[#c9a24a] focus-within:shadow-[0_0_10px_rgba(201,162,74,0.3)]">
          <img src="/assets/dice-roller/bouton-flottant-d20.png" alt="" width={22} height={22} className="w-[22px] h-[22px] shrink-0 opacity-80" />
          <input
            type="text"
            value={notation}
            onChange={(e) => setNotation(e.target.value)}
            placeholder="Ex: 1d20+5, 2d6, 4d10"
            className="flex-1 min-w-0 bg-transparent text-[#f3e6c0] font-mono focus:outline-none"
          />
          {notation && (
            <button
              type="button"
              onClick={() => setNotation('')}
              aria-label="Effacer la formule"
              className="text-[#c9a24a]/70 hover:text-[#ecd289] text-lg leading-none px-1"
            >
              ×
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!ready || themeLoading}
          className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-5 py-2 font-['Cinzel'] font-bold uppercase tracking-wider rounded-lg border border-[#ecd289]/60 bg-gradient-to-b from-[#ecd289] via-[#c9a24a] to-[#7d6128] text-[#16110a] shadow-lg shadow-[#c9a24a]/25 hover:brightness-110 active:scale-95 transition-all disabled:bg-[url('/assets/dice-roller/bouton-lancer-desactive.webp')] disabled:bg-[length:100%_100%] disabled:border-transparent disabled:text-[#8e8e8e] disabled:shadow-none disabled:cursor-not-allowed"
        >
          <img src="/assets/dice-roller/bouton-flottant-d20.png" alt="" width={18} height={18} className="w-[18px] h-[18px]" />
          Lancer !
        </button>
      </form>

      <p className="h-5 mb-1 text-sm text-center" aria-live="polite">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : !ready ? (
          <span className="text-[#c9a24a]/70">Chargement du moteur 3D…</span>
        ) : null}
      </p>

      {/* Toujours affiché (même vide) pour que la mise en page ne bouge pas à chaque lancer. */}
      <div
          className={`relative p-4 h-[11rem] flex flex-col justify-center rounded-xl border w-full text-center overflow-hidden ${
            crit === 'success'
              ? 'border-[#ecd289] bg-gradient-to-b from-[#3a2c12] via-[#1c150c] to-[#0b0906] shadow-[0_0_28px_rgba(236,210,137,0.35),inset_0_0_30px_rgba(236,210,137,0.15)]'
              : crit === 'failure'
                ? 'border-[#e5484d] bg-gradient-to-b from-[#4a0d12] via-[#1a0608] to-[#0b0906] shadow-[0_0_28px_rgba(229,72,77,0.4),inset_0_0_30px_rgba(229,72,77,0.18)]'
                : "border-[#c9a24a]/50 bg-[url('/assets/dice-roller/resultat-fond-evergreen.webp')] bg-cover bg-center shadow-[inset_0_0_24px_rgba(201,162,74,0.12)]"
          }`}
          role="status"
        >
          {crit && (
            <img
              src={`/assets/dice-roller/overlay-${crit === 'success' ? 'succes' : 'echec'}-critique.webp`}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
          <div className="relative">
          {crit && (
            <div
              className={`font-['Cinzel'] text-xs font-bold uppercase tracking-[0.25em] mb-1 ${
                crit === 'success' ? 'text-[#ecd289]' : 'text-[#ff8a8f]'
              }`}
            >
              {crit === 'success' ? '✦ Succès critique ✦' : '✖ Échec critique ✖'}
            </div>
          )}
          <div className="text-sm font-['Cinzel'] text-[#c9a24a]/80 uppercase tracking-[0.2em] font-semibold">Total du jet</div>
          <div
            className={`text-5xl font-black font-['Cinzel'] my-1 ${
              crit === 'failure'
                ? 'text-[#ff8a8f] drop-shadow-[0_0_14px_rgba(229,72,77,0.6)]'
                : 'text-[#ecd289] drop-shadow-[0_0_14px_rgba(236,210,137,0.45)]'
            }`}
          >
            {total ?? '—'}
          </div>
          <div className="text-xs text-[#c9a24a]/60 font-mono mt-2">
            {total === null
              ? 'Lancez un dé pour voir le résultat'
              : <>{label} → {groups.map((g) => `[${(g.rolls ?? []).map((r) => r.value).join(', ') || g.value}]`).join(' + ')}</>}
          </div>
          </div>
      </div>
    </div>
  );
};

/**
 * Bouton flottant 🎲 + panneau. Le panneau reste monté : les dés ne sont pas réinitialisés.
 * `open` / `onOpenChange` permettent de l'ouvrir depuis la navigation ; sans eux, il gère son état seul.
 */
export function DiceFloater({ open: openProp, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: (o: boolean) => boolean) => {
    const value = next(open);
    if (onOpenChange) onOpenChange(value);
    else setOpenState(value);
  };
  return (
    <>
      <div
        className={`ls-dice-panel fixed right-4 bottom-20 z-50 w-[min(440px,calc(100vw-2rem))] transition-all duration-200 ${
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
        className="ls-dice-fab fixed right-4 bottom-4 z-50 w-16 h-16 rounded-full bg-[url('/assets/dice-roller/bouton-flottant-d20.png')] bg-cover bg-center shadow-lg shadow-[#c9a24a]/40 hover:scale-105 hover:shadow-[#c9a24a]/60 active:scale-95 transition-all"
      />
    </>
  );
}
