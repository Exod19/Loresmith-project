/**
 * Console MJ → écran joueur. Ouvre la fenêtre à partager, puis choisit ce qu'elle montre :
 * écran noir, texte à lire, carte, image (monstre, PNJ, lieu, objet…).
 * Pour la carte et le combat en cours, la vue « Cartes » projette en direct : on les retrouve ici.
 */
import { useEffect, useState } from 'react';
import { loadUnderdarkFeed } from '../feeds/underdark';
import { mapBoard } from '../maps/playerBoard';
import { mapIdOf, type MapRecord } from '../maps/mapStore';
import type { AtlasData } from '../maps/atlas/types';
import { currentStage, onPlayerHello, PLAYER_VIEW_NAME, publishStage, type Stage } from './stage';
import './present.css';

type Asset = { id: string; name?: string; dataUrl?: string; universeId?: string; category?: string };

type Props = {
  universe: { id: string; name: string } | null;
  state: { maps?: Record<string, MapRecord>; assets?: Record<string, Asset> };
  flash: (m: string) => void;
};

const BLANK: Stage = { kind: 'blank' };
const LABEL: Record<Stage['kind'], string> = { blank: 'Écran noir', text: 'Texte', image: 'Image', board: 'Carte / combat' };

export default function StageControl({ universe, state, flash }: Props) {
  const [stage, setStage] = useState<Stage>(() => currentStage());
  const [linked, setLinked] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => onPlayerHello(() => setLinked(true)), []);

  function show(next: Stage) {
    if (!linked) flash("Ouvre l'écran joueur pour voir le résultat.");
    setStage(next);
    publishStage(next);
  }

  async function showMap(rec: MapRecord) {
    // Le plan entier de l'Atlas vient du fichier des Archives : on le charge au besoin (les cartes perso n'en ont pas besoin).
    const feed = rec.kind === 'atlas' ? await loadUnderdarkFeed().catch(() => null) : null;
    if (rec.kind === 'atlas' && !feed) { flash('Archives indisponibles.'); return; }
    show({ kind: 'board', board: mapBoard(rec, feed?.atlas as AtlasData, mapIdOf(rec)) });
  }

  function openPlayerScreen() {
    const url = new URL(window.location.href);
    url.search = '?view=player';
    window.open(url.toString(), PLAYER_VIEW_NAME, 'noopener');
  }

  const maps = Object.values(state.maps ?? {})
    .filter((m) => m.universeId === universe?.id)
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  const images = Object.values(state.assets ?? {}).filter((a) => a.universeId === universe?.id && a.dataUrl);

  return (
    <>
      <h1 className="view">Écran joueur</h1>
      <p className="sub">
        Ouvre la fenêtre joueur et partage-la à l'écran. Ta console reste sur ton écran : ce que tu choisis ici
        apparaît immédiatement là-bas, sans notes ni repères secrets.
      </p>

      <div className="panel present-status">
        <span className="present-dot" data-on={linked ? 1 : 0} />
        <span>{linked ? 'Un écran joueur a répondu.' : 'Aucun écran joueur pour l’instant.'}</span>
        <button className="btn primary" onClick={openPlayerScreen}>Ouvrir l’écran joueur</button>
        <button className="btn" onClick={() => show(BLANK)}>Écran noir</button>
        <span className="present-now">
          Affiché : {LABEL[stage.kind]}
          {(stage.kind === 'text' || stage.kind === 'image') && ` · ${stage.title}`}
        </span>
      </div>

      <div className="eyebrow">Texte à lire</div>
      <div className="panel">
        <div className="field">
          <label className="fl">Titre</label>
          <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Le seuil de Hosten Valak" />
        </div>
        <div className="field">
          <label className="fl">Texte</label>
          <textarea className="in" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ce que tu lis à voix haute…" />
        </div>
        <button
          className="btn primary"
          disabled={!body.trim()}
          onClick={() => show({ kind: 'text', title: title.trim(), body: body.trim() })}
        >
          Montrer le texte
        </button>
      </div>

      <div className="eyebrow">Cartes</div>
      {maps.length === 0 ? (
        <p className="sub">Aucune carte dans cet univers. Crée-la dans Cartes.</p>
      ) : (
        <div className="present-grid">
          {maps.map((m) => (
            <button key={m.id} className="present-tile" onClick={() => showMap(m)}>
              {m.image ? <img src={m.image} alt="" /> : <div className="present-tile-empty">◇</div>}
              <span>{m.title}</span>
            </button>
          ))}
        </div>
      )}
      <p className="sub">Pour révéler des lieux, placer des rencontres ou lancer un combat, utilise l'onglet Cartes : la projection suit en direct.</p>

      <div className="eyebrow">Images : monstres, PNJ, lieux, objets</div>
      {images.length === 0 ? (
        <p className="sub">Aucune image. Ajoute-les dans Images : elles apparaîtront ici.</p>
      ) : (
        <div className="present-grid">
          {images.map((a) => (
            <button
              key={a.id}
              className="present-tile"
              data-on={stage.kind === 'image' && stage.dataUrl === a.dataUrl ? 1 : 0}
              onClick={() => show({ kind: 'image', title: a.name ?? 'Image', dataUrl: a.dataUrl as string })}
            >
              <img src={a.dataUrl} alt="" />
              <span>{a.name ?? 'Image'}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

