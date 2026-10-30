import { useState } from 'react';
import { X, Hammer, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { aiReady, askAI, parseJson } from '../ai/client';
import {
  STYLE_EXAMPLES,
  START_EXAMPLES,
  SPECIFIC_EXAMPLES,
  SIZES,
  COMPLEXITIES,
  GUIDED_QUESTIONS,
  emptyBrief,
  canForge,
  answeredCount,
  skippedCount,
  composeLore,
  questionsPrompt,
  parseExtraQuestions,
} from './forgeBrief';
import './universeForge.css';

const STEPS = [
  { id: 'souffle', label: 'Le souffle' },
  { id: 'ampleur', label: 'L’ampleur' },
  { id: 'questions', label: 'Les questions' },
  { id: 'forge', label: 'La forge' },
];
// Mode « découverte » : on ne bâtit qu'un lieu de départ, le reste vient des campagnes.
const DISCOVER_STEPS = [
  { id: 'souffle', label: 'Le souffle' },
  { id: 'depart', label: 'Le point de départ' },
  { id: 'forge', label: 'La forge' },
];

/** Assistant plein écran de création d'univers : affiché avant que l'univers devienne actif. */
export default function UniverseForge({ onClose, onForge }) {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(emptyBrief);
  const [lore, setLore] = useState(null); // null = canon composé automatiquement
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const set = (patch) => setBrief((b) => ({ ...b, ...patch }));
  const toggleSkip = (id) => setBrief((b) => ({ ...b, skipped: { ...b.skipped, [id]: !b.skipped[id] } }));
  const setAnswer = (id, v) => setBrief((b) => ({ ...b, answers: { ...b.answers, [id]: v } }));
  const questions = [...GUIDED_QUESTIONS, ...brief.extraQuestions];
  const composed = composeLore(brief);
  const finalLore = lore ?? composed;
  const steps = brief.mode === 'discover' ? DISCOVER_STEPS : STEPS;
  const cur = steps[Math.min(step, steps.length - 1)].id;
  const last = step >= steps.length - 1;
  const setStart = (patch) => setBrief((b) => ({ ...b, start: { ...b.start, ...patch } }));

  async function suggestQuestions() {
    setBusy('questions');
    setError('');
    try {
      const { system, user } = questionsPrompt(brief);
      const extra = parseExtraQuestions(parseJson(await askAI(system, user, { json: true })));
      if (!extra.length) throw new Error('L’IA n’a proposé aucune question exploitable.');
      set({ extraQuestions: extra });
    } catch (e) {
      setError(e.message || 'Échec de la suggestion.');
    } finally {
      setBusy('');
    }
  }

  async function writeCanon() {
    setBusy('canon');
    setError('');
    try {
      const text = await askAI(
        'Tu es l’architecte de lore de Loresmith. À partir du brief, rédige le canon de départ d’un univers de jeu de rôle : 3 à 5 paragraphes, concrets, jouables, sans inventer de campagne. Langue : français. N’écris que le texte du canon.',
        `Nom : ${brief.name}\n\nBrief :\n${composed}`,
      );
      setLore(text);
    } catch (e) {
      setError(e.message || 'Échec de la rédaction.');
    } finally {
      setBusy('');
    }
  }

  function forge() {
    onForge(brief, lore);
  }

  return (
    <div className="uf-overlay" role="dialog" aria-modal="true" aria-label="Forge d’univers">
      <header className="uf-head">
        <div className="uf-title">
          <Hammer size={20} aria-hidden="true" />
          <div>
            <b>Forge d’univers</b>
            <span>Un nouveau monde, de l’étincelle au canon</span>
          </div>
        </div>
        <ol className="uf-steps" aria-label="Étapes">
          {steps.map((s, i) => (
            <li key={s.id} data-state={i === step ? 'on' : i < step ? 'done' : 'todo'}>
              <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                <i>{i + 1}</i>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="uf-close" onClick={onClose} aria-label="Fermer la forge">
          <X size={18} />
        </button>
      </header>

      <main className="uf-body">
        {cur === 'souffle' && (
          <section className="uf-card">
            <div className="uf-modes" role="radiogroup" aria-label="Façon de commencer">
              <button type="button" role="radio" aria-checked={brief.mode === 'full'} data-on={brief.mode === 'full' ? 1 : 0} onClick={() => set({ mode: 'full' })}>
                <b>Tout bâtir maintenant</b>
                <small>Ampleur, questions, canon : je pose les fondations avant de jouer.</small>
              </button>
              <button type="button" role="radio" aria-checked={brief.mode === 'discover'} data-on={brief.mode === 'discover' ? 1 : 0} onClick={() => set({ mode: 'discover' })}>
                <b>Partir d’un lieu et découvrir en jouant</b>
                <small>Je commence par une ville : le monde se révèle campagne après campagne, comme un brouillard qui se lève.</small>
              </button>
            </div>
            <h2>Donne un nom et un souffle à ton monde</h2>
            <p className="uf-lead">Décris-le avec tes mots, comme à un ami : on n’a pas besoin d’une case à cocher.</p>
            <label className="uf-field">
              <span>Nom de l’univers</span>
              <input
                className="in"
                autoFocus
                value={brief.name}
                placeholder="Les Terres Brisées, Aerth, La Cité des Cent Cloches…"
                onChange={(e) => set({ name: e.target.value })}
              />
            </label>
            <label className="uf-field">
              <span>Quel genre d’univers imagines-tu ?</span>
              <textarea
                className="in"
                rows={4}
                value={brief.style}
                placeholder="Ambiance, époque, genre, inspirations… Quelques phrases suffisent."
                onChange={(e) => set({ style: e.target.value })}
              />
            </label>
            <div className="uf-examples">
              <small>Besoin d’inspiration ? Clique pour reprendre un exemple :</small>
              {STYLE_EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex}
                  onClick={() => set({ style: brief.style.trim() ? `${brief.style.trim()} ${ex}` : ex })}
                >
                  {ex}
                </button>
              ))}
            </div>
          </section>
        )}

        {cur === 'depart' && (
          <section className="uf-card">
            <h2>Où commence l’aventure ?</h2>
            <p className="uf-lead">
              Un seul lieu suffit. Ce qui l’entoure se découvrira au fil des séances : chaque ville, chaque peuple et chaque secret
              que tu joueras s’ajoutera à l’univers et à sa carte.
            </p>
            <label className="uf-field">
              <span>Nom du lieu de départ</span>
              <input className="in" autoFocus value={brief.start.name} placeholder="Brumecombe, Fort-Cendre, Les Trois-Ponts…" onChange={(e) => setStart({ name: e.target.value })} />
            </label>
            <label className="uf-field">
              <span>À quoi ressemble-t-il ?</span>
              <textarea className="in" rows={3} value={brief.start.description} placeholder="Ambiance, habitants, ce qu’on y voit en arrivant…" onChange={(e) => setStart({ description: e.target.value })} />
            </label>
            <label className="uf-field">
              <span>Qu’est-ce qui s’y passe en ce moment ? (facultatif)</span>
              <textarea className="in" rows={2} value={brief.start.tension} placeholder="Une tension, une rumeur, un danger qui monte…" onChange={(e) => setStart({ tension: e.target.value })} />
            </label>
            <div className="uf-examples">
              <small>Besoin d’inspiration ?</small>
              {START_EXAMPLES.map((ex) => (
                <button type="button" key={ex} onClick={() => setStart({ name: ex.split(',')[0], description: ex.includes(',') ? ex.slice(ex.indexOf(',') + 1).trim() : '' })}>
                  {ex}
                </button>
              ))}
            </div>
          </section>
        )}

        {cur === 'ampleur' && (
          <section className="uf-card">
            <h2>Quelle est l’ampleur de ton univers ?</h2>
            <p className="uf-lead">
              Tout est facultatif et rien n’est définitif : tu pourras préciser ou agrandir ton univers à tout moment.
            </p>
            <div className="uf-group">
              <span>Taille</span>
              <div className="uf-choices">
                {SIZES.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    data-on={brief.size === s.id ? 1 : 0}
                    onClick={() => set({ size: brief.size === s.id ? '' : s.id })}
                  >
                    <b>{s.label}</b>
                    <small>{s.hint}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="uf-group">
              <span>Complexité</span>
              <div className="uf-choices">
                {COMPLEXITIES.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    data-on={brief.complexity === c.id ? 1 : 0}
                    onClick={() => set({ complexity: brief.complexity === c.id ? '' : c.id })}
                  >
                    <b>{c.label}</b>
                    <small>{c.hint}</small>
                  </button>
                ))}
              </div>
            </div>
            <label className="uf-field">
              <span>Spécificités : ce qui rend ton monde unique</span>
              <textarea
                className="in"
                rows={3}
                value={brief.specifics}
                placeholder="Règles étranges, tabous, objets, phénomènes, ce que tu veux absolument y retrouver…"
                onChange={(e) => set({ specifics: e.target.value })}
              />
            </label>
            <div className="uf-examples">
              <small>Exemples :</small>
              {SPECIFIC_EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex}
                  onClick={() => set({ specifics: brief.specifics.trim() ? `${brief.specifics.trim()} ${ex}` : ex })}
                >
                  {ex}
                </button>
              ))}
            </div>
          </section>
        )}

        {cur === 'questions' && (
          <section className="uf-card">
            <h2>Quelques questions pour bâtir le monde</h2>
            <p className="uf-lead">
              Aucune question n’est obligatoire. Tu ne sais pas encore ? Passe-la : tu pourras tout préciser, changer ou
              ajouter plus tard dans la page Univers, ou le laisser émerger au fil de tes campagnes.
            </p>
            <p className="uf-count">
              {answeredCount(brief)} réponse(s) · {skippedCount(brief)} laissée(s) pour plus tard
            </p>
            {questions.map((q) => {
              const skipped = !!brief.skipped[q.id] && !(brief.answers[q.id] || '').trim();
              return (
                <div className="uf-field" key={q.id} data-skipped={skipped ? 1 : 0}>
                  <span>{q.question}</span>
                  {skipped ? (
                    <div className="uf-skipped">
                      <em>Laissée pour plus tard : tu pourras y répondre quand tu le voudras.</em>
                      <button type="button" className="btn ghost" onClick={() => toggleSkip(q.id)}>
                        Y répondre
                      </button>
                    </div>
                  ) : (
                    <>
                      {q.why && <em>{q.why}</em>}
                      <textarea
                        className="in"
                        rows={2}
                        value={brief.answers[q.id] || ''}
                        placeholder={q.example ? `Ex. : ${q.example}` : ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                      <button type="button" className="uf-skip" onClick={() => toggleSkip(q.id)}>
                        Je ne sais pas encore
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <div className="uf-ai">
              <button type="button" className="btn ghost" onClick={() => setStep(steps.length - 1)}>
                Passer toutes les questions
              </button>
              {aiReady() ? (
                <button type="button" className="btn" disabled={!!busy} onClick={suggestQuestions}>
                  <Sparkles size={15} aria-hidden="true" />
                  {busy === 'questions' ? 'Réflexion…' : 'Proposer des questions adaptées à mon univers'}
                </button>
              ) : (
                <small>Configure l’IA dans Réglages pour obtenir des questions adaptées à ton univers.</small>
              )}
            </div>
          </section>
        )}

        {cur === 'forge' && (
          <section className="uf-card">
            <h2>{brief.name.trim() || 'Ton univers'} est prêt à être forgé</h2>
            <p className="uf-lead">
              Voici le canon de départ. L’IA le relira à chaque génération ; tu pourras le modifier à tout moment.
            </p>
            {skippedCount(brief) > 0 && (
              <p className="uf-note">
                {skippedCount(brief)} question(s) laissée(s) pour plus tard : rien n’est perdu, tu pourras les compléter
                quand l’univers se précisera.
              </p>
            )}
            {brief.mode === 'discover' && (
              <p className="uf-note">
                Ton univers naîtra avec son lieu de départ et une carte qui ne montre que lui. Ensuite, tu crées une campagne : à chaque séance jouée,
                les lieux, personnages et peuples découverts s’ajoutent et la carte grandit.
              </p>
            )}
            {!canForge(brief) && (
              <p className="uf-warn" role="alert">
                {brief.mode === 'discover' && brief.name.trim() ? 'Il manque le lieu de départ : retourne à l’étape précédente.' : 'Il manque un nom : retourne à la première étape.'}
              </p>
            )}
            <label className="uf-field">
              <span>Canon de l’univers</span>
              <textarea
                className="in"
                rows={12}
                value={finalLore}
                placeholder="Rien n’a encore été écrit : tu pourras tout ajouter dans la page Univers."
                onChange={(e) => setLore(e.target.value)}
              />
            </label>
            <div className="uf-ai">
              {aiReady() ? (
                <button type="button" className="btn" disabled={!!busy || !composed} onClick={writeCanon}>
                  <Sparkles size={15} aria-hidden="true" />
                  {busy === 'canon' ? 'Rédaction…' : 'Rédiger le canon avec l’IA'}
                </button>
              ) : (
                <small>Sans IA, le canon reprend tes réponses telles quelles.</small>
              )}
              {lore !== null && (
                <button type="button" className="btn ghost" onClick={() => setLore(null)}>
                  Revenir au canon composé
                </button>
              )}
            </div>
          </section>
        )}

        {error && (
          <p className="uf-warn" role="alert">
            {error}
          </p>
        )}
      </main>

      <footer className="uf-foot">
        <button type="button" className="btn ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>
          <ChevronLeft size={15} aria-hidden="true" />
          {step === 0 ? 'Annuler' : 'Retour'}
        </button>
        {last ? (
          <button type="button" className="btn primary" disabled={!canForge(brief) || !!busy} onClick={forge}>
            <Hammer size={15} aria-hidden="true" /> Forger l’univers
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>
            Suivant <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
      </footer>
    </div>
  );
}
