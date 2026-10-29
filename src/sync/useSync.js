/**
 * État de la synchronisation pour l'application : compte connecté, synchronisations (au démarrage, toutes les
 * 5 minutes, au retour du réseau, ou à la demande), conflits à régler et suppressions à confirmer.
 * Sans serveur joignable ou sans compte, rien ne change au fonctionnement local.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { renameMapFor } from './apply';
import { acceptInvitation, acceptTerms, currentAccount, deleteAccount, forgetDeletions, forgetSync, resolveOne, serverReachable, signIn, signOut, signUp, syncOnce } from './client';

const PERIOD = 5 * 60 * 1000;

export function useSync({ state, dispatch, hydrated, flash }) {
  const [server, setServer] = useState(null); // null : pas encore vérifié
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('off'); // off | idle | syncing | offline | error
  const [lastSync, setLastSync] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState(null);
  const [error, setError] = useState('');
  const stateRef = useRef(state);
  stateRef.current = state;
  const busy = useRef(false);
  const resync = useRef(false);

  const apply = useCallback((changes) => {
    if (changes.upserts.length || changes.deletes.length) dispatch({ type: 'SYNC_APPLY', changes });
  }, [dispatch]);

  const syncNow = useCallback(async ({ confirmDeletes = false, quiet = false } = {}) => {
    // Rien ne part tant que les avis et conditions ne sont pas acceptés (le serveur refuserait de toute façon).
    if (!account?.termsAccepted || busy.current || !stateRef.current) return;
    busy.current = true;
    setStatus('syncing');
    try {
      const res = await syncOnce(stateRef.current, account.user.id, { confirmDeletes });
      apply(res.changes);
      // Identifiants pris par un autre compte : renommés ici, puis renvoyés à la synchronisation suivante.
      if (res.idTaken?.length) {
        dispatch({ type: 'SYNC_RENAME', map: [...renameMapFor(stateRef.current, res.idTaken)] });
        resync.current = true;
      }
      if (res.signedOut) {
        setAccount(null);
        setStatus('off');
        return;
      }
      setConflicts(res.conflicts);
      setPendingDeletes(res.pendingDeletes);
      setStatus(res.offline ? 'offline' : 'idle');
      setError('');
      if (!res.offline) setLastSync(Date.now());
      if (!quiet && !res.offline && !res.conflicts.length) {
        const { pulled, pushed, deleted } = res.stats;
        flash(pulled + pushed + deleted ? `Synchronisé : ${pulled} reçu(s), ${pushed} envoyé(s)${deleted ? `, ${deleted} supprimé(s)` : ''}` : 'Déjà à jour');
      }
    } catch (e) {
      setStatus('error');
      setError(e.message);
    } finally {
      busy.current = false;
    }
  }, [account, apply, dispatch, flash]);

  // Après un renommage, une synchronisation de plus envoie les éléments sous leurs nouveaux identifiants.
  useEffect(() => {
    if (resync.current && !busy.current) {
      resync.current = false;
      syncNow({ quiet: true });
    }
  }, [state, syncNow]);

  // Au démarrage : le serveur répond-il, et y a-t-il une session ?
  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const up = await serverReachable();
      setServer(up);
      if (up) setAccount(await currentAccount().catch(() => null));
    })();
  }, [hydrated]);

  // Compte connecté : une synchronisation tout de suite, puis toutes les 5 minutes et au retour du réseau.
  useEffect(() => {
    if (!account?.termsAccepted) return;
    syncNow({ quiet: true });
    const timer = setInterval(() => syncNow({ quiet: true }), PERIOD);
    const online = () => syncNow({ quiet: true });
    window.addEventListener('online', online);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', online);
    };
  }, [account, syncNow]);

  const login = useCallback(async (mode, { name, email, password }) => {
    if (mode === 'signup') await signUp(name || email.split('@')[0], email, password);
    else await signIn(email, password);
    setAccount(await currentAccount());
  }, []);

  const logout = useCallback(async () => {
    await signOut().catch(() => {});
    setAccount(null);
    setStatus('off');
    setConflicts([]);
  }, []);

  const resolve = useCallback(async (conflict, choice) => {
    const res = await resolveOne(conflict, choice);
    apply(res.changes);
    setConflicts((list) => {
      const rest = list.filter((c) => c.key !== conflict.key);
      return res.conflict ? [...rest, res.conflict] : rest;
    });
  }, [apply]);

  const recheck = useCallback(async () => {
    const up = await serverReachable();
    setServer(up);
    setAccount(up ? await currentAccount().catch(() => null) : null);
  }, []);

  /** Suppressions en attente : `true` les confirme, `false` fait revenir les éléments depuis le serveur. */
  const decideDeletes = useCallback(async (confirm) => {
    const list = pendingDeletes || [];
    setPendingDeletes(null);
    if (!confirm) await forgetDeletions(list.map((g) => g.key));
    await syncNow({ confirmDeletes: confirm });
  }, [pendingDeletes, syncNow]);

  /** Accepte une invitation, puis synchronise pour recevoir l'univers et l'ouvrir. */
  const focus = useRef(null);
  const acceptInvite = useCallback(async (token) => {
    const { universeId } = await acceptInvitation(token);
    focus.current = universeId;
    // Une synchronisation en cours se termine d'abord ; la suivante reçoit l'univers rejoint.
    for (let i = 0; i < 50 && busy.current; i++) await new Promise((r) => setTimeout(r, 200));
    setAccount(await currentAccount());
    return universeId;
  }, []);

  // L'univers rejoint est ouvert dès qu'il est arrivé dans le grimoire.
  useEffect(() => {
    if (focus.current && state?.universes?.[focus.current]) {
      dispatch({ type: 'SET_UNIVERSE', id: focus.current });
      focus.current = null;
    }
  }, [state, dispatch]);

  const agree = useCallback(async () => {
    await acceptTerms(account.termsVersion);
    setAccount(await currentAccount());
  }, [account]);

  /** Supprime le compte sur le serveur. Le grimoire de ce navigateur, lui, reste. */
  const removeAccount = useCallback(async (confirm) => {
    await deleteAccount(confirm);
    await forgetSync().catch(() => {});
    setAccount(null);
    setStatus('off');
    setConflicts([]);
    setPendingDeletes(null);
  }, []);

  const activeUniverse = state?.universes?.[state?.activeUniverseId] ?? null;
  const campaignsOf = (universeId) => Object.values(state?.campaigns || {}).filter((c) => c.universeId === universeId);

  return { server, account, status, lastSync, conflicts, pendingDeletes, error, syncNow, login, logout, resolve, recheck, decideDeletes, acceptInvite, activeUniverse, campaignsOf, agree, removeAccount, refreshAccount: async () => setAccount(await currentAccount()) };
}
