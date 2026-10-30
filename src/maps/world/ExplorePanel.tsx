/**
 * Mode Exploration de la carte du monde (MJ) : le personnage du MJ arpente le monde et le définit au fil de ses pas.
 *  - fiche de l'avatar (nom, rôle, apparence, portrait), mode Rêverie ou Chronique, et option de le cacher dans le monde ;
 *  - sur le lieu sélectionné : y aller, garder un brouillon tel quel (canon), ou définir un bâtiment (type, nom, fiche).
 */
import { useState } from 'react';
import type { AtlasData, AtlasFeature } from '../atlas/types';
import type { MapRecord } from '../mapStore';
import { SLOT_TYPES, type Avatar, type Binding, type SlotType } from './generate';
import type { World } from './index';

type Props = {
  rec: MapRecord;
  data: AtlasData;
  planId: string;
  /** Lieu sélectionné sur la carte. */
  feature: AtlasFeature | null;
  onUpdate: (patch: Partial<MapRecord>) => void;
  /** Crée une fiche de lieu dans la Bibliothèque. */
  onCreateEntry?: (entry: Record<string, unknown> & { id: string; title: string }) => void;
  /** Déplace le personnage du MJ sur ce lieu. */
  onGo: (f: AtlasFeature) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const DEFINABLE: SlotType[] = ['taverne', 'auberge', 'echoppe', 'forge', 'temple', 'guilde', 'caserne', 'manoir', 'maison', 'ferme', 'atelier', 'entrepot', 'ecurie'];

/** Réduit une image en portrait carré (192 px, WebP) pour la garder dans la carte sans l'alourdir. */
function portraitOf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = 192, c = document.createElement('canvas');
      c.width = c.height = s;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, s, s);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}

export default function ExplorePanel({ rec, data, planId, feature, onUpdate, onCreateEntry, onGo }: Props) {
  const world = rec.world as World;
  const avatar: Avatar = world.avatar ?? { name: '', mode: 'reverie' };
  const [editing, setEditing] = useState(!world.avatar?.name);
  const [draft, setDraft] = useState<Avatar>(avatar);
  const [define, setDefine] = useState<{ title: string; type: SlotType; summary: string } | null>(null);
  const save = (w: World) => onUpdate({ world: w, updatedAt: Date.now() });
  const setAvatar = (a: Avatar) => save({ ...world, avatar: a });

  const isBuilding = !!feature && /:b\d+$/.test(feature.id) && feature.id.startsWith(`${planId}:`);
  const bound = feature ? Object.values(world.bindings ?? {}).find((b) => b.slotId === feature.id && !b.excluded) : undefined;
  /** Cité (ou hameau) du plan affiché, d'après l'identifiant du plan. */
  const prefix = `map-${rec.id}-c-`;
  const cityId = planId.startsWith(prefix) ? planId.slice(prefix.length).split(':')[0] : null;
  const cityName = cityId ? (world.cities.find((c) => c.id === cityId)?.name ?? data.maps.find((m) => m.id === `${prefix}${cityId}`)?.title) : undefined;

  const keep = (f: AtlasFeature) => save({ ...world, canon: [...new Set([...(world.canon ?? []), f.id])] });
  const defineBuilding = () => {
    if (!feature || !define || !cityId || !define.title.trim()) return;
    const id = uid(), now = Date.now();
    onCreateEntry?.({
      id, archiveType: 'place', title: define.title.trim(), subtitle: SLOT_TYPES[define.type].label, shortSummary: define.summary.trim(),
      currentLocation: cityName ?? '', tags: [], createdAt: now, updatedAt: now,
    });
    const b: Binding = {
      entryId: id, cityId, slotId: feature.id, type: define.type, title: define.title.trim(), summary: define.summary.trim() || undefined,
      npcs: [], hint: `${define.type}|`, pinned: true, district: null,
    };
    save({ ...world, bindings: { ...world.bindings, [id]: b }, canon: [...new Set([...(world.canon ?? []), feature.id])] });
    setDefine(null);
  };

  return (
    <div className="maps-card explore-card">
      <div className="explore-head">
        {avatar.portrait ? <img className="explore-portrait" src={avatar.portrait} alt="" /> : <span className="explore-portrait" aria-hidden />}
        <div>
          <h4>🎭 {avatar.name || 'Ton personnage'}</h4>
          <div className="maps-sub">{avatar.role || 'Personnage du MJ'}{avatar.at ? ` · ${avatar.at.title}` : ''}</div>
        </div>
      </div>
      <div className="maps-seg" role="group" aria-label="Mode de la balade">
        <button className={avatar.mode !== 'chronique' ? 'on' : ''} onClick={() => setAvatar({ ...avatar, mode: 'reverie' })}
          title="Rien ne compte, sauf ce que tu acceptes comme lore">💭 Rêverie</button>
        <button className={avatar.mode === 'chronique' ? 'on' : ''} onClick={() => setAvatar({ ...avatar, mode: 'chronique' })}
          title="Ce qui arrive est réel, aussi pour les joueurs">📜 Chronique</button>
      </div>
      <p className="maps-sub">
        {avatar.mode === 'chronique'
          ? 'Chronique : ce que ton personnage fait est réel pour les joueurs.'
          : 'Rêverie : tu arpentes le monde sans conséquence. Seul ce que tu définis ou gardes devient canon.'}
        {' '}Les lieux estompés sont des brouillons tirés au sort.
      </p>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); if (draft.name.trim()) { setAvatar({ ...avatar, ...draft, name: draft.name.trim() }); setEditing(false); } }}>
          <label>Nom<input className="maps-btn" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Le Chroniqueur" autoFocus /></label>
          <label>Rôle<input className="maps-btn" value={draft.role ?? ''} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="conteur itinérant" /></label>
          <label>Apparence<textarea className="maps-btn" rows={3} value={draft.desc ?? ''} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} placeholder="Un vieil homme au manteau couvert de cartes…" /></label>
          <label>Portrait<input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setDraft({ ...draft, portrait: await portraitOf(f) }); }} /></label>
          <div className="maps-actions">
            <button className="maps-btn gold" type="submit" disabled={!draft.name.trim()}>Enregistrer</button>
            {world.avatar?.name && <button className="maps-btn" type="button" onClick={() => { setDraft(avatar); setEditing(false); }}>Annuler</button>}
          </div>
        </form>
      ) : (
        <div className="maps-actions">
          <button className="maps-btn" onClick={() => { setDraft(avatar); setEditing(true); }}>✎ Ma fiche</button>
          {avatar.hidden
            ? <button className="maps-btn" onClick={() => setAvatar({ ...avatar, hidden: undefined })} title="Retirer ton personnage du monde des joueurs">🙈 Ne plus le cacher</button>
            : <button className="maps-btn" disabled={!avatar.at} onClick={() => avatar.at && setAvatar({ ...avatar, hidden: { planId: avatar.at.planId, at: avatar.at.at } })}
              title="Ton personnage reste là où il se trouve, comme un PNJ que les joueurs pourront croiser">🥚 Le cacher ici</button>}
        </div>
      )}
      {avatar.hidden && <p className="maps-sub">🥚 Caché dans le monde : les joueurs pourront le croiser.</p>}

      {feature && !editing && (
        <>
          <h5>📍 {feature.title}</h5>
          <div className="maps-actions">
            <button className="maps-btn gold" onClick={() => onGo(feature)}>🎭 Y aller</button>
            {feature.draft && !isBuilding && <button className="maps-btn" onClick={() => keep(feature)} title="Garder ce lieu tel quel : il n'est plus un brouillon">✓ Garder tel quel</button>}
            {isBuilding && !bound && !define && (
              <button className="maps-btn" onClick={() => setDefine({ title: feature.draft ? '' : feature.title, type: (DEFINABLE.find((t) => SLOT_TYPES[t].label === feature.title || feature.subtitle === SLOT_TYPES[t].label) ?? 'maison'), summary: '' })}>
                ✦ Définir ce bâtiment
              </button>
            )}
            {isBuilding && feature.draft && !define && <button className="maps-btn" onClick={() => keep(feature)}>✓ Garder tel quel</button>}
          </div>
          {bound && <p className="maps-sub">Lieu du lore : {bound.title}{bound.pinned ? ' (posé à la main)' : ''}.</p>}
          {define && (
            <form onSubmit={(e) => { e.preventDefault(); defineBuilding(); }}>
              <label>Nom<input className="maps-btn" value={define.title} autoFocus onChange={(e) => setDefine({ ...define, title: e.target.value })} placeholder="Le Sanglier Borgne" /></label>
              <label>Type
                <select className="maps-btn" value={define.type} onChange={(e) => setDefine({ ...define, type: e.target.value as SlotType })}>
                  {DEFINABLE.map((t) => <option key={t} value={t}>{SLOT_TYPES[t].label}</option>)}
                </select>
              </label>
              <label>Ce qu’on en dit<textarea className="maps-btn" rows={2} value={define.summary} onChange={(e) => setDefine({ ...define, summary: e.target.value })} placeholder="Une taverne enfumée où se retrouvent les bateliers." /></label>
              <div className="maps-actions">
                <button className="maps-btn gold" type="submit" disabled={!define.title.trim()}>Créer la fiche et poser le lieu</button>
                <button className="maps-btn" type="button" onClick={() => setDefine(null)}>Annuler</button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
