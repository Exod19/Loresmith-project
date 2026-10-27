/**
 * Copilote MJ : à partir de la scène préparée, indique la prochaine étape (lire le texte, demander un jet, lancer le combat),
 * le DC du jet, et ce qui se passe selon le résultat. Aucun appel IA : tout vient de la scène.
 * Le suivi (étapes faites) vit dans le composant ; il repart à zéro à chaque changement de scène (key={scene.id}).
 */
import { useState } from 'react';
import './copilot.css';

export type SkillCheck = { check: string; dc?: number | string; why?: string; on_success?: string; on_failure?: string };
export type Branch = { if: string; then: string };

type Step =
  | { id: string; kind: 'read'; title: string; text: string }
  | { id: string; kind: 'check'; title: string; check: SkillCheck }
  | { id: string; kind: 'combat'; title: string; text: string };

type Props = {
  readAloud: string;
  checks: SkillCheck[];
  branches: Branch[];
  hasMonsters: boolean;
  onOpenCombat: () => void;
};

function buildSteps({ readAloud, checks, hasMonsters }: Pick<Props, 'readAloud' | 'checks' | 'hasMonsters'>): Step[] {
  const steps: Step[] = [{ id: 'read', kind: 'read', title: 'Lire le texte d’ouverture', text: readAloud }];
  checks.forEach((c, i) => steps.push({ id: `check-${i}`, kind: 'check', title: c.check, check: c }));
  if (hasMonsters) {
    steps.push({ id: 'combat', kind: 'combat', title: 'Lancer le combat', text: 'Ouvre le Combat quand les adversaires passent à l’action.' });
  }
  return steps;
}

export default function DmCopilot({ readAloud, checks, branches, hasMonsters, onOpenCombat }: Props) {
  const steps = buildSteps({ readAloud, checks, hasMonsters });
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [totals, setTotals] = useState<Record<string, string>>({});

  const markDone = (id: string) => setDoneIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  const next = steps.find((s) => !doneIds.includes(s.id));
  const later = steps.filter((s) => s !== next && !doneIds.includes(s.id));

  return (
    <section className="panel copilot">
      <div className="copilot-head">
        <span className="eyebrow-inline">Copilote</span>
        <span className="copilot-progress">
          {Math.min(doneIds.length, steps.length)} / {steps.length} étapes
        </span>
      </div>

      {!next && <p className="copilot-done">Scène jouée. Passe à la suivante quand tu es prêt.</p>}

      {next && (
        <div className="copilot-next">
          <div className="copilot-kicker">Prochaine étape</div>
          <h3>{next.title}</h3>

          {next.kind === 'read' && <p className="copilot-text">{next.text}</p>}

          {next.kind === 'combat' && <p className="copilot-text">{next.text}</p>}

          {next.kind === 'check' && (
            <CheckStep
              check={next.check}
              total={totals[next.id] ?? ''}
              onTotal={(v) => setTotals((t) => ({ ...t, [next.id]: v }))}
            />
          )}

          <div className="copilot-actions">
            {next.kind === 'combat' && (
              <button className="btn primary" onClick={() => { onOpenCombat(); markDone(next.id); }}>
                Ouvrir le Combat
              </button>
            )}
            <button className="btn" onClick={() => markDone(next.id)}>
              ✓ {next.kind === 'check' ? 'Jet résolu' : 'Fait'}
            </button>
          </div>
        </div>
      )}

      {later.length > 0 && (
        <div className="copilot-later">
          <div className="copilot-kicker">Ensuite</div>
          <ul>
            {later.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        </div>
      )}

      {branches.length > 0 && (
        <details className="copilot-branches">
          <summary>Conséquences possibles ({branches.length})</summary>
          <ul>
            {branches.map((b, i) => (
              <li key={i}>
                <b>Si</b> {b.if} <span className="copilot-arrow">→</span> {b.then}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Jet demandé : le MJ saisit le total obtenu (dés 3D ou physiques), le copilote dit quelle issue appliquer. */
function CheckStep({ check, total, onTotal }: { check: SkillCheck; total: string; onTotal: (v: string) => void }) {
  const dc = Number(check.dc);
  const hasDc = Number.isFinite(dc) && check.dc !== '' && check.dc !== undefined;
  const value = total.trim() === '' ? null : Number(total);
  const success = hasDc && value !== null && Number.isFinite(value) ? value >= dc : null;

  return (
    <div className="copilot-check">
      <div className="copilot-dc">
        {hasDc ? <span className="tag arcane">DC {dc}</span> : <span className="tag">DC {String(check.dc ?? '?')}</span>}
        <span className="copilot-hint">Jet à faire : 1d20 · utilise le 🎲 en bas à droite</span>
      </div>
      {check.why && <p className="copilot-why">{check.why}</p>}

      {hasDc && (
        <div className="copilot-total">
          <label className="fl" htmlFor="copilot-total">Total obtenu</label>
          <input
            id="copilot-total"
            className="in"
            inputMode="numeric"
            value={total}
            onChange={(e) => onTotal(e.target.value)}
            placeholder="ex. 14"
          />
        </div>
      )}

      {success === true && (
        <div className="copilot-outcome" data-ok="1">
          <b>Réussi</b> {check.on_success && <span>→ {check.on_success}</span>}
        </div>
      )}
      {success === false && (
        <div className="copilot-outcome" data-ok="0">
          <b>Échec</b> {check.on_failure && <span>→ {check.on_failure}</span>}
        </div>
      )}
      {success === null && (check.on_success || check.on_failure) && (
        <div className="copilot-preview">
          {check.on_success && <p><b>Réussite :</b> {check.on_success}</p>}
          {check.on_failure && <p><b>Échec :</b> {check.on_failure}</p>}
        </div>
      )}
    </div>
  );
}
