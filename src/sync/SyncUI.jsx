/**
 * Interface de la synchronisation : compte (dans Réglages), conflits à régler, suppressions à confirmer.
 */
import { useState } from 'react';
import { apiUrl, setApiUrl } from './client';
import { SharingDialog } from './SharingUI';

const TYPE_LABEL = {
  universe: 'Univers',
  campaign: 'Campagne',
  character: 'Héros',
  npc: 'PNJ ou créature',
  quest: 'Quête',
  library: 'Fiche de bibliothèque',
  map: 'Carte',
  asset: 'Image',
  chat: 'Discussion',
  userState: 'Combat en cours et journal',
};
const nameOf = (c) => {
  const d = c.local || c.remote?.data || {};
  return d.name || d.title || d.caption || '';
};
export const describe = (c) => `${TYPE_LABEL[c.type] || c.type}${nameOf(c) ? ` « ${nameOf(c)} »` : ''}`;

/** Petit état affiché dans la barre du haut (rien si aucun compte n'est connecté). */
export function syncBadge(sync) {
  if (!sync.account) return null;
  if (sync.conflicts.length) return { tone: 'error', text: `${sync.conflicts.length} conflit${sync.conflicts.length > 1 ? 's' : ''}` };
  if (sync.pendingDeletes) return { tone: 'error', text: 'Suppressions à confirmer' };
  return {
    syncing: { tone: 'pending', text: 'Synchronisation…' },
    offline: { tone: 'pending', text: 'Hors ligne' },
    error: { tone: 'error', text: 'Synchro en échec' },
  }[sync.status] ?? { tone: 'saved', text: 'Synchronisé' };
}

const box = { border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginTop: 14 };

export function SyncPanel({ sync, flash = () => {} }) {
  const [sharing, setSharing] = useState(false);
  const [mode, setMode] = useState('signin');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState(apiUrl());
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await sync.login(mode, f);
      setF((x) => ({ ...x, password: '' }));
    } catch (err) {
      setMsg(err.status === 401 ? 'Courriel ou mot de passe incorrect.' : err.message);
    }
    setBusy(false);
  }

  return (
    <div style={box}>
      <h4 style={{ margin: '0 0 8px' }}>Compte et synchronisation</h4>
      {sync.server === null ? (
        <div className="faint">Recherche du serveur…</div>
      ) : !sync.server ? (
        <>
          <div className="faint" style={{ fontSize: 12.5 }}>
            Aucun serveur de synchronisation ne répond{url ? ` à ${url}` : ' sur ce site'}. Loresmith fonctionne normalement, en local.
          </div>
          <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
            <input value={url} placeholder="https://… (adresse du serveur)" onChange={(e) => setUrl(e.target.value)} />
            <button className="btn" style={{ flex: 'none' }} onClick={() => { setApiUrl(url); sync.recheck(); }}>
              Réessayer
            </button>
          </div>
        </>
      ) : sync.account ? (
        <>
          <div style={{ fontSize: 13 }}>
            Connecté : <b>{sync.account.user.email}</b>
          </div>
          <div className="faint" style={{ fontSize: 12, margin: '4px 0 10px' }}>
            {sync.status === 'syncing'
              ? 'Synchronisation en cours…'
              : sync.status === 'offline'
                ? 'Hors ligne : tes changements restent ici et partiront au retour du réseau.'
                : sync.status === 'error'
                  ? `Dernière synchronisation en échec : ${sync.error}`
                  : sync.lastSync
                    ? `Dernière synchronisation : ${new Date(sync.lastSync).toLocaleTimeString('fr-CA')}`
                    : 'Pas encore synchronisé.'}{' '}
            Synchronisation automatique toutes les 5 minutes.
          </div>
          <div className="row">
            <button className="btn primary" style={{ flex: 'none' }} disabled={sync.status === 'syncing'} onClick={() => sync.syncNow()}>
              Synchroniser maintenant
            </button>
            {sync.activeUniverse && (
              <button className="btn" style={{ flex: 'none' }} onClick={() => setSharing(true)}>
                Partager « {sync.activeUniverse.name} »
              </button>
            )}
            <button className="btn ghost" style={{ flex: 'none' }} onClick={sync.logout}>
              Se déconnecter
            </button>
          </div>
          {sharing && <SharingDialog sync={sync} flash={flash} onClose={() => setSharing(false)} />}
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="faint" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Un compte MJ permet de retrouver ton grimoire sur tous tes appareils et de partager des univers. Sans compte, tout reste dans ce navigateur.
          </div>
          {mode === 'signup' && <input placeholder="Nom affiché" value={f.name} onChange={set('name')} style={{ marginBottom: 6 }} />}
          <input type="email" required placeholder="Courriel" value={f.email} onChange={set('email')} style={{ marginBottom: 6 }} autoComplete="email" />
          <input
            type="password"
            required
            minLength={10}
            placeholder="Mot de passe (10 caractères minimum)"
            value={f.password}
            onChange={set('password')}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          {msg && <div style={{ color: 'var(--blood)', fontSize: 12.5, marginTop: 6 }}>{msg}</div>}
          <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
            <button className="btn primary" style={{ flex: 'none' }} disabled={busy} type="submit">
              {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button type="button" className="btn ghost" style={{ flex: 'none' }} onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? 'J’ai déjà un compte' : 'Créer un compte'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Dialog({ title, children, onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <h3>{title}</h3>
          <button className="btn ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

/** Conflits : pour chacun, l'utilisateur garde sa version ou prend celle du serveur. Rien n'est tranché sans lui. */
export function ConflictDialog({ sync, onClose, flash }) {
  const [busy, setBusy] = useState('');
  async function choose(c, choice) {
    setBusy(c.key);
    try {
      await sync.resolve(c, choice);
      flash(choice === 'mine' ? 'Ta version a été envoyée.' : 'La version du serveur a été reprise.');
    } catch (e) {
      flash('Impossible : ' + e.message);
    }
    setBusy('');
  }
  return (
    <Dialog title="Versions différentes à départager" onClose={onClose}>
      <div className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>
        Ces éléments ont changé ici et sur le serveur depuis la dernière synchronisation. Choisis la version à garder ; l’autre reste dans l’historique du serveur.
      </div>
      {sync.conflicts.map((c) => (
        <div key={c.key} style={{ ...box, marginTop: 8 }}>
          <div>
            <b>{describe(c)}</b>
          </div>
          <div className="faint" style={{ fontSize: 12, margin: '4px 0 8px' }}>
            {c.refused
              ? `Le serveur refuse ta modification (${c.refused === 403 ? 'tu n’as que le droit de lecture' : c.message || 'refus'}).`
              : c.local === null
                ? 'Supprimé ici, modifié sur le serveur.'
                : !c.remote || c.remote.deleted
                  ? 'Modifié ici, supprimé sur le serveur.'
                  : 'Modifié ici et sur le serveur.'}
            {c.local && c.remote?.data && (c.local.name || c.local.title) !== (c.remote.data.name || c.remote.data.title) && (
              <> Ici : « {c.local.name || c.local.title} » · serveur : « {c.remote.data.name || c.remote.data.title} ».</>
            )}
          </div>
          <div className="row">
            {!c.refused && (
              <button className="btn" style={{ flex: 'none' }} disabled={!!busy} onClick={() => choose(c, 'mine')}>
                {c.local === null ? 'Confirmer la suppression' : 'Garder ma version'}
              </button>
            )}
            <button className="btn" style={{ flex: 'none' }} disabled={!!busy} onClick={() => choose(c, 'theirs')}>
              {!c.remote || c.remote.deleted ? 'Accepter la suppression' : 'Prendre la version du serveur'}
            </button>
          </div>
        </div>
      ))}
    </Dialog>
  );
}

/** Beaucoup de suppressions d'un coup (ex. après un import « remplacer tout ») : confirmation explicite. */
export function DeleteConfirm({ sync, onClose }) {
  const list = sync.pendingDeletes || [];
  return (
    <Dialog title="Supprimer aussi sur le serveur ?" onClose={onClose}>
      <div style={{ fontSize: 13 }}>
        {list.length} éléments ont disparu de ce grimoire depuis la dernière synchronisation. Les supprimer aussi pour tes autres appareils et les MJ avec qui tu partages ?
      </div>
      <ul style={{ fontSize: 12.5, maxHeight: 180, overflow: 'auto', paddingLeft: 18 }}>
        {list.slice(0, 50).map((g) => (
          <li key={g.key}>{TYPE_LABEL[g.type] || g.type} ({g.id})</li>
        ))}
      </ul>
      <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
        Rien n’est effacé pour de bon : le serveur garde l’historique. Si tu refuses, ces éléments sont repris du serveur.
      </div>
      <div className="row">
        <button className="btn primary" style={{ flex: 'none' }} onClick={() => { sync.decideDeletes(true); onClose(); }}>
          Oui, supprimer
        </button>
        <button className="btn ghost" style={{ flex: 'none' }} onClick={() => { sync.decideDeletes(false); onClose(); }}>
          Non
        </button>
      </div>
    </Dialog>
  );
}
