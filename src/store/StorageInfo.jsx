/**
 * Espace de stockage du navigateur, affiché dans Réglages : ce qu'occupe Loresmith (grimoire et images),
 * le quota accordé, et si le navigateur a accepté de ne pas effacer les données.
 */
import { useEffect, useState } from 'react';
import { askPersistence, storageUsage } from './persist';

const mo = (bytes) => (bytes / 1048576).toLocaleString('fr-CA', { maximumFractionDigits: bytes < 10485760 ? 1 : 0 }) + ' Mo';

export default function StorageInfo() {
  const [info, setInfo] = useState(null);
  const refresh = () => storageUsage().then(setInfo);
  useEffect(() => {
    refresh();
  }, []);
  if (!info) return null;
  return (
    <div className="faint" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
      Stockage local : {mo(info.usage)} utilisés{info.quota ? ` sur ${mo(info.quota)} disponibles` : ''}.{' '}
      {info.persisted ? (
        'Le navigateur protège ces données de l’effacement automatique.'
      ) : (
        <>
          Le navigateur peut effacer ces données s’il manque d’espace.{' '}
          <button className="btn ghost" style={{ padding: '1px 8px', fontSize: 11.5 }} onClick={() => askPersistence().then(refresh)}>
            Demander la protection
          </button>
        </>
      )}
    </div>
  );
}
