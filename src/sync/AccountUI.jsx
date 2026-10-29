/**
 * Compte (lot 8) : avis et conditions à accepter à la première connexion, mentions et licences,
 * export des renseignements du compte et suppression du compte.
 */
import { useState } from 'react';
import { PRIVACY_CONTACT, TERMS, TERMS_VERSION } from '../shared/terms';
import { exportAccount } from './client';

function Dialog({ title, children, onClose, wide }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: wide ? 760 : 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <h3>{title}</h3>
          {onClose && (
            <button className="btn ghost sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function TermsText() {
  return (
    <div style={{ maxHeight: '50vh', overflow: 'auto', fontSize: 13, lineHeight: 1.5, paddingRight: 6 }}>
      {TERMS.map((t) => (
        <div key={t.title} style={{ marginBottom: 10 }}>
          <b>{t.title}</b>
          <div>{t.text}</div>
        </div>
      ))}
      <div className="faint" style={{ fontSize: 11.5 }}>Version du {TERMS_VERSION}.</div>
    </div>
  );
}

/** À la première connexion (ou à chaque nouvelle version) : rien ne se synchronise avant l'acceptation. */
export function TermsGate({ sync, flash }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!sync.account || sync.account.termsAccepted) return null;
  async function accept() {
    setBusy(true);
    try {
      await sync.agree();
      flash('Bienvenue ! La synchronisation démarre.');
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  }
  return (
    <Dialog title="Avant de commencer" wide>
      <div style={{ fontSize: 13, marginBottom: 10 }}>Lis ces avis et conditions. Ton compte ne sera utilisé qu’une fois acceptés.</div>
      <TermsText />
      <label style={{ display: 'flex', gap: 8, alignItems: 'baseline', margin: '12px 0', cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>J’ai lu et j’accepte ces avis et conditions d’utilisation.</span>
      </label>
      <div className="row">
        <button className="btn primary" style={{ flex: 'none' }} disabled={!checked || busy} onClick={accept}>
          Accepter
        </button>
        <button className="btn ghost" style={{ flex: 'none' }} onClick={sync.logout}>
          Refuser et me déconnecter
        </button>
      </div>
    </Dialog>
  );
}

const LICENCES = [
  ['Statistiques de créatures', 'SRD 5.1, Wizards of the Coast LLC — licence Creative Commons Attribution 4.0 (CC BY 4.0).'],
  ['Autres contenus de jeu, Archives de l’Underdark, images intégrées', 'Droits réservés à leurs titulaires ; usage privé et non commercial.'],
  ['Polices Cinzel, EB Garamond, Spectral, JetBrains Mono', 'SIL Open Font License, servies par Google Fonts.'],
  ['React, react-dom, fflate, @3d-dice/dice-box, Hono, Better Auth', 'licence MIT.'],
  ['lucide-react', 'licence ISC.'],
  ['pdfjs-dist', 'licence Apache 2.0.'],
  ['Hébergement', 'Cloudflare (Pages, Workers, D1, KV).'],
];

export function LegalDialog({ onClose }) {
  return (
    <Dialog title="Mentions, licences et confidentialité" onClose={onClose} wide>
      <TermsText />
      <div style={{ marginTop: 14 }}>
        <b>Licences</b>
        <ul style={{ fontSize: 12.5, paddingLeft: 18, margin: '6px 0' }}>
          {LICENCES.map(([what, licence]) => (
            <li key={what}>
              {what} : {licence}
            </li>
          ))}
        </ul>
        <div className="faint" style={{ fontSize: 12 }}>Renseignements personnels : {PRIVACY_CONTACT}.</div>
      </div>
    </Dialog>
  );
}

/** Dans Réglages, compte connecté : télécharger ses renseignements, supprimer son compte. */
export function AccountTools({ sync, flash }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    try {
      const data = await exportAccount();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `loresmith-compte-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      flash(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await sync.removeAccount(typed);
      flash('Ton compte est supprimé. Ton grimoire reste dans ce navigateur.');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 12, fontSize: 12.5 }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <button className="btn ghost sm" style={{ flex: 'none' }} onClick={download}>
          Télécharger mes renseignements (JSON)
        </button>
        <button className="btn ghost sm" style={{ flex: 'none', color: 'var(--blood)' }} onClick={() => setConfirming(!confirming)}>
          Supprimer mon compte…
        </button>
      </div>
      {confirming && (
        <div style={{ border: '1px solid var(--blood)', borderRadius: 6, padding: 10, marginTop: 8 }}>
          <div>
            Ton compte, tes univers (s’ils n’ont pas d’autres membres) et leurs images seront effacés du serveur. Ce que tu as écrit dans
            l’univers d’un autre MJ lui reste. Ton grimoire reste dans ce navigateur. Les sauvegardes du serveur s’effacent en 30 jours.
          </div>
          <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
            <input placeholder={`Retape ${sync.account.user.email}`} value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button className="btn" style={{ flex: 'none', color: 'var(--blood)' }} disabled={busy || !typed} onClick={remove}>
              Supprimer définitivement
            </button>
          </div>
          {error && <div style={{ color: 'var(--blood)', marginTop: 6 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
