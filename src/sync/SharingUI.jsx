/**
 * Partage dans l'interface (lot 6) : membres et rôles d'un univers, invitations, co-MJ des campagnes,
 * et accueil d'un lien d'invitation (`?invitation=…`).
 * Les droits sont vérifiés par le serveur ; l'interface ne fait que masquer ce qui serait refusé.
 */
import { useCallback, useEffect, useState } from 'react';
import { addCoGm, campaignMembers, invitationInfo, invite, listMembers, removeCoGm, removeMember, revokeInvitation, setMemberRole } from './client';
import { SyncPanel } from './SyncUI';

export const ROLE_LABEL = { owner: 'Propriétaire', editor: 'Éditeur', contributor: 'Contributeur', reader: 'Lecteur' };
const ROLE_HELP = {
  editor: 'modifie tout le contenu de l’univers',
  contributor: 'ajoute du contenu et crée ses campagnes',
  reader: 'consulte seulement',
};
const box = { border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginTop: 12 };

function Dialog({ title, children, onClose }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
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

/** Co-MJ d'une campagne dont on est le MJ : choisis parmi les membres de l'univers. */
function CoGms({ campaign, members, me, flash }) {
  const [list, setList] = useState(null);
  const load = useCallback(() => campaignMembers(campaign.id).then((r) => setList(r.members), () => setList([])), [campaign.id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!list) return null;
  const role = Object.fromEntries(list.map((m) => [m.id, m.role]));
  if (role[me] !== 'gm') return null;
  async function toggle(m) {
    try {
      if (role[m.id] === 'cogm') await removeCoGm(campaign.id, m.id);
      else await addCoGm(campaign.id, m.id);
      load();
    } catch (e) {
      flash(e.message);
    }
  }
  const others = members.filter((m) => m.id !== me);
  return (
    <div style={{ margin: '6px 0' }}>
      <b>{campaign.title || 'Campagne sans titre'}</b>
      {others.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          {others.map((m) => (
            <label key={m.id} style={{ fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={role[m.id] === 'cogm'} onChange={() => toggle(m)} /> {m.name || m.email}
            </label>
          ))}
        </div>
      ) : (
        <div className="faint" style={{ fontSize: 12 }}>Invite d’abord des MJ dans l’univers.</div>
      )}
    </div>
  );
}

export function SharingDialog({ sync, onClose, flash }) {
  const universe = sync.activeUniverse;
  const me = sync.account?.user.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', role: 'contributor' });
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await listMembers(universe.id));
      setError('');
    } catch (e) {
      setError(e.status === 404 ? 'Cet univers n’est pas encore sur le serveur : synchronise d’abord, puis reviens ici.' : e.message);
    }
  }, [universe?.id]);
  useEffect(() => {
    if (universe) load();
  }, [universe, load]);

  const myRole = data?.members.find((m) => m.id === me)?.role;
  const owner = myRole === 'owner';
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) flash(ok);
      await load();
    } catch (e) {
      flash(e.message);
    }
    setBusy(false);
  };

  async function sendInvite(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await invite(universe.id, form.email, form.role);
      setSent(res);
      setForm((f) => ({ ...f, email: '' }));
      await load();
    } catch (err) {
      flash(err.message);
    }
    setBusy(false);
  }

  return (
    <Dialog title={`Partager « ${universe?.name ?? ''} »`} onClose={onClose}>
      {!universe ? (
        <div className="faint">Aucun univers ouvert.</div>
      ) : error ? (
        <div style={{ color: 'var(--blood)' }}>{error}</div>
      ) : !data ? (
        <div className="faint">Chargement…</div>
      ) : (
        <>
          <div className="faint" style={{ fontSize: 12.5 }}>
            Tous les membres sont des MJ : ils lisent tout l’univers, secrets compris. Les joueurs n’ont pas de compte.
          </div>
          <div style={box}>
            <b>Membres</b>
            {data.members.map((m) => (
              <div key={m.id} className="row" style={{ alignItems: 'center', marginTop: 6 }}>
                <span style={{ flex: 1 }}>
                  {m.name || m.email} <span className="faint" style={{ fontSize: 12 }}>{m.email}{m.id === me ? ' (toi)' : ''}</span>
                </span>
                {owner && m.role !== 'owner' ? (
                  <select value={m.role} disabled={busy} style={{ flex: 'none', width: 'auto' }} onChange={(e) => run(() => setMemberRole(universe.id, m.id, e.target.value), 'Rôle modifié.')}>
                    {['editor', 'contributor', 'reader'].map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ flex: 'none', fontSize: 13 }}>{ROLE_LABEL[m.role]}</span>
                )}
                {m.role !== 'owner' && (owner || m.id === me) && (
                  <button
                    className="btn ghost sm"
                    style={{ flex: 'none' }}
                    disabled={busy}
                    onClick={() => {
                      const self = m.id === me;
                      if (confirm(self ? 'Quitter cet univers ? Ta copie locale reste, mais ne sera plus synchronisée.' : `Retirer ${m.name || m.email} de l’univers ?`))
                        run(() => removeMember(universe.id, m.id), self ? 'Tu as quitté l’univers.' : 'Membre retiré.');
                    }}
                  >
                    {m.id === me ? 'Quitter' : 'Retirer'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {owner && (
            <div style={box}>
              <b>Inviter un MJ</b>
              <form onSubmit={sendInvite} className="row" style={{ marginTop: 6, alignItems: 'center' }}>
                <input type="email" required placeholder="Courriel du MJ invité" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <select value={form.role} style={{ flex: 'none', width: 'auto' }} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {['editor', 'contributor', 'reader'].map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className="btn primary" style={{ flex: 'none' }} disabled={busy} type="submit">
                  Inviter
                </button>
              </form>
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                {ROLE_LABEL[form.role]} : {ROLE_HELP[form.role]}. L’invitation vaut 7 jours.
              </div>
              {sent && (
                <div style={{ marginTop: 8, fontSize: 12.5 }}>
                  {sent.emailSent ? `Courriel envoyé à ${sent.email}. ` : `Aucun courriel n’est parti (envoi non configuré) : transmets ce lien à ${sent.email}. `}
                  <div className="row" style={{ marginTop: 4 }}>
                    <input readOnly value={sent.link} onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn" style={{ flex: 'none' }} onClick={() => navigator.clipboard?.writeText(sent.link).then(() => flash('Lien copié.'), () => {})}>
                      Copier
                    </button>
                  </div>
                </div>
              )}
              {data.invitations.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="faint" style={{ fontSize: 12 }}>En attente :</div>
                  {data.invitations.map((i) => (
                    <div key={i.id} className="row" style={{ alignItems: 'center', fontSize: 13 }}>
                      <span style={{ flex: 1 }}>
                        {i.email} · {ROLE_LABEL[i.role]} · jusqu’au {new Date(i.expiresAt).toLocaleDateString('fr-CA')}
                      </span>
                      <button className="btn ghost sm" style={{ flex: 'none' }} disabled={busy} onClick={() => run(() => revokeInvitation(universe.id, i.id), 'Invitation annulée.')}>
                        Annuler
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sync.campaignsOf(universe.id).length > 0 && (
            <div style={box}>
              <b>Co-MJ de tes campagnes</b>
              <div className="faint" style={{ fontSize: 12 }}>Un co-MJ peut modifier la campagne. Seules les campagnes dont tu es le MJ apparaissent.</div>
              {sync.campaignsOf(universe.id).map((c) => (
                <CoGms key={c.id} campaign={c} members={data.members} me={me} flash={flash} />
              ))}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

/** Lien d'invitation ouvert (`?invitation=…`) : aperçu, connexion ou création de compte, puis acceptation. */
export function InvitationGate({ sync, flash }) {
  const [token] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('invitation');
    } catch {
      return null;
    }
  });
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(!token);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token && sync.server) invitationInfo(token).then(setInfo, (e) => setError(e.status === 404 ? 'Ce lien d’invitation n’est pas valide.' : e.message));
  }, [token, sync.server]);

  const close = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('invitation');
    window.history.replaceState(null, '', url.toString());
    setDone(true);
  };
  if (done || sync.server === null) return null;

  async function accept() {
    setBusy(true);
    try {
      await sync.acceptInvite(token);
      flash(`Bienvenue dans « ${info.universe} » ! L’univers arrive avec la synchronisation.`);
      close();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const state = info?.state;
  return (
    <Dialog title="Invitation" onClose={close}>
      {!sync.server ? (
        <div>Le serveur de synchronisation ne répond pas ; l’invitation ne peut pas être acceptée pour l’instant.</div>
      ) : error ? (
        <div style={{ color: 'var(--blood)' }}>{error}</div>
      ) : !info ? (
        <div className="faint">Lecture de l’invitation…</div>
      ) : state !== 'pending' ? (
        <div>
          {state === 'expired' ? 'Cette invitation a expiré : demande-en une nouvelle.' : state === 'accepted' ? 'Cette invitation a déjà été utilisée.' : 'Cette invitation a été annulée.'}
        </div>
      ) : (
        <>
          <div>
            <b>{info.from || 'Un MJ'}</b> t’invite dans l’univers <b>« {info.universe} »</b>, comme {ROLE_LABEL[info.role].toLowerCase()}.
          </div>
          <div className="faint" style={{ fontSize: 12.5, margin: '6px 0' }}>Invitation destinée à {info.email}.</div>
          {sync.account ? (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" style={{ flex: 'none' }} disabled={busy} onClick={accept}>
                Accepter et rejoindre
              </button>
              <button className="btn ghost" style={{ flex: 'none' }} onClick={close}>
                Plus tard
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, marginTop: 8 }}>Connecte-toi, ou crée ton compte avec ce courriel, pour accepter.</div>
              <SyncPanel sync={sync} />
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
