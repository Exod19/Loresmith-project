/**
 * Nouvelle version du site : un onglet resté ouvert garde l'ancienne application jusqu'à ce qu'on la recharge.
 * Toutes les 5 minutes, et dès qu'on revient sur l'onglet, on relit /version.json ; s'il annonce une autre version que
 * celle qui tourne, un bandeau propose de recharger. Rien en développement local (pas de version.json).
 */
import { useEffect, useState } from 'react';

declare const __BUILD_ID__: string;
const RUNNING = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '';

async function onlineId(): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const v = (await r.json()) as { id?: string };
    return typeof v.id === 'string' ? v.id : null;
  } catch {
    return null; // hors ligne : on réessaiera
  }
}

export default function UpdateBanner() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!RUNNING || import.meta.env.DEV) return;
    let stop = false;
    const check = async () => { const id = await onlineId(); if (!stop && id && id !== RUNNING) setFresh(true); };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const timer = window.setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    void check();
    return () => { stop = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, []);
  if (!fresh) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 99999, display: 'flex', gap: 12, alignItems: 'center',
      padding: '10px 14px', borderRadius: 10, background: '#1c1710', border: '1px solid #c9a24a', color: '#efe3c4', boxShadow: '0 6px 24px rgba(0,0,0,.6)', font: '14px/1.3 system-ui, sans-serif', maxWidth: 'calc(100vw - 32px)' }}>
      <span>Une nouvelle version de Loresmith est en ligne.</span>
      <button onClick={() => window.location.reload()} style={{ background: '#c9a24a', color: '#1c1710', border: 0, borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Recharger</button>
      <button onClick={() => setFresh(false)} aria-label="Plus tard" style={{ background: 'transparent', color: '#efe3c4', border: 0, cursor: 'pointer', fontSize: 18 }}>×</button>
    </div>
  );
}
