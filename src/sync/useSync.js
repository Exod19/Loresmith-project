/**
 * État de la synchronisation pour l'application : compte connecté, synchronisations (au démarrage, toutes les
 * 5 minutes, au retour du réseau, ou à la demande), conflits à régler et suppressions à confirmer.
 * Sans serveur joignable ou sans compte, rien ne change au fonctionnement local.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { currentAccount, forgetDeletions, resolveOne, serverReachable, signIn, signOut, signUp, syncOnce } from './client';

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

  const apply = useCallback((changes) => {
    if (changes.upserts.length || changes.deletes.length) dispatch({ type: 'SYNC_APPLY', changes });
  }, [dispatch]);

  const syncNow = useCallback(async ({ confirmDeletes = false, quiet = false } = {}) => {
    if (!account || busy.current || !stateRef.current) return;
    busy.current = true;
    setStatus('syncing');
    try {
      const res = await syncOnce(stateRef.current, account.user.id, { confirmDeletes });
      apply(res.changes);
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
  }, [account, apply, flash]);

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
    if (!account) return;
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

  return { server, account, status, lastSync, conflicts, pendingDeletes, error, syncNow, login, logout, resolve, recheck, decideDeletes };
}
