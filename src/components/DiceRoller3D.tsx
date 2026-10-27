// components/DiceRoller3D.tsx
import React, { useEffect, useRef, useState } from 'react';
import DiceBox from '@3d-dice/dice-box';

const CONTAINER_ID = 'dice-box';

interface DieResult {
  value: number;
  qty?: number;
  sides?: number | string;
}

export const DiceRoller3D: React.FC = () => {
  const diceBoxRef = useRef<DiceBox | null>(null);
  // dice-box ne peut être utilisé (clear/roll) qu'une fois init() terminé
  const readyRef = useRef(false);
  const [notation, setNotation] = useState<string>('1d20');
  const [total, setTotal] = useState<number | null>(null);
  const [individualResults, setIndividualResults] = useState<DieResult[]>([]);

  useEffect(() => {
    // Initialisation du moteur 3D sur le conteneur div.
    // dice-box attend un sélecteur CSS (et non un élément DOM) pour `container`.
    if (!diceBoxRef.current) {
      diceBoxRef.current = new DiceBox({
        container: `#${CONTAINER_ID}`,
        id: 'dice-canvas',
        width: 600,
        height: 400,
        theme: 'default', // Thèmes interchangeables (cool, metal, glass...)
        themeColor: '#4f46e5', // Couleur des dés (ex: Violet Indigo)
        offscreen: false, // Mettre à true en production pour booster les performances
        // Les assets (ammo WASM, thèmes) sont dans public/assets/
        assetPath: '/assets/',

        // Callback appelé dès que les dés s'arrêtent de rouler
        onRollComplete: (results: DieResult[]) => {
          // Calcule le total combiné de tous les dés lancés
          const totalScore = results.reduce((sum, die) => sum + die.value, 0);
          setTotal(totalScore);
          setIndividualResults(results);
        },
      });

      // Lancement de la configuration asynchrone
      diceBoxRef.current
        .init()
        .then(() => {
          readyRef.current = true;
          console.log('Moteur 3D Dice-Box prêt !');
        })
        .catch((err: unknown) => {
          console.error('Échec de l’initialisation de Dice-Box :', err);
        });
    }

    // Nettoyage au démontage du composant
    return () => {
      if (diceBoxRef.current && readyRef.current) {
        diceBoxRef.current.clear();
      }
    };
  }, []);

  const handleRoll = () => {
    if (diceBoxRef.current && readyRef.current && notation) {
      // Efface les anciens dés présents à l'écran
      diceBoxRef.current.clear();
      setTotal(null);
      // Lance la formule passée (ex: "2d6" lancera physiquement deux d6 dans le canvas)
      diceBoxRef.current.roll(notation);
    }
  };

  return (
    <div className="flex flex-col items-center bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-2xl mx-auto text-white">
      <h2 className="text-2xl font-black text-indigo-400 mb-4">🎲 Lanceur de Dés 3D Rpg</h2>

      {/* Conteneur du Canvas 3D où les dés vont physiquement rouler et rebondir */}
      <div
        id={CONTAINER_ID}
        className="w-[600px] h-[400px] bg-slate-950 rounded-xl border border-slate-800 shadow-inner relative overflow-hidden mb-4 [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full"
      />

      {/* Interface de contrôle */}
      <div className="flex gap-3 items-center w-full mb-6">
        <input
          type="text"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          placeholder="Ex: 1d20, 2d6, 4d10"
          className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleRoll}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/30 transition-all"
        >
          Lancer !
        </button>
      </div>

      {/* Affichage dynamique des résultats */}
      {total !== null && (
        <div className="bg-slate-950/60 p-4 rounded-xl border border-indigo-500/30 w-full text-center animate-fade-in">
          <div className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total du Jet</div>
          <div className="text-5xl font-black text-indigo-400 my-1">{total}</div>
          <div className="text-xs text-slate-500 font-mono mt-2">
            Détails : {individualResults.map((d) => `[${d.qty ?? 1}d${d.sides ?? '?'}: ${d.value}]`).join(' + ')}
          </div>
        </div>
      )}
    </div>
  );
};
