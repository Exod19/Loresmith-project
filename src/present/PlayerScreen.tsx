/**
 * Écran joueur : la fenêtre à partager. Plein écran, sans menus ; elle montre ce que le MJ pousse depuis la console.
 * Les cartes sont rendues en mode joueurs : repères secrets et notes du MJ ne sont jamais affichés.
 */
import { useEffect, useState } from 'react';
import MapCanvas, { type Layers } from '../maps/atlas/MapCanvas';
import { activateMap, type MapRecord } from '../maps/mapStore';
import { useUnderdarkFeed } from '../feeds/underdark';
import type { AtlasData, FeatureCategory } from '../maps/atlas/types';
import { openStageChannel, type Stage } from './stage';
import '../maps/maps.css';
import '../maps/atlas/atlas.css';
import './present.css';

/** Même clé que la console MJ (App.jsx). */
const STORE_KEY = 'loresmith:store:v1';
const LAYERS: Layers = { points: true, etiquettes: true, galeries: true, connexions: true, ambiance: true };
const HIDDEN = new Set<FeatureCategory>();

function readMaps(): Record<string, MapRecord> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}').maps || {};
  } catch {
    return {};
  }
}

export default function PlayerScreen() {
  const [stage, setStage] = useState<Stage>({ kind: 'blank' });
  const [maps, setMaps] = useState(readMaps);
  const { feed } = useUnderdarkFeed();

  useEffect(() => {
    const link = openStageChannel((m) => {
      if (m.type !== 'stage') return;
      setStage(m.stage);
      setMaps(readMaps());
    });
    link.send({ type: 'hello' });
    return () => link.close();
  }, []);

  return (
    <div className="present-screen">
      <Scene stage={stage} maps={maps} atlas={feed?.atlas} />
      <button className="present-fs" onClick={() => document.documentElement.requestFullscreen?.()}>
        Plein écran
      </button>
    </div>
  );
}

function Scene({ stage, maps, atlas }: { stage: Stage; maps: Record<string, MapRecord>; atlas?: AtlasData }) {
  if (stage.kind === 'image') {
    return (
      <figure className="present-image">
        <img src={stage.dataUrl} alt={stage.title} />
        <figcaption>{stage.title}</figcaption>
      </figure>
    );
  }
  if (stage.kind === 'text') {
    return (
      <article className="present-text">
        <h1>{stage.title}</h1>
        <p>{stage.body}</p>
      </article>
    );
  }
  if (stage.kind === 'map') {
    const rec = maps[stage.mapId];
    if (!rec) return <p className="present-wait">Carte introuvable.</p>;
    if (rec.kind === 'atlas' && !atlas) return <p className="present-wait">Chargement de la carte…</p>;
    const data = activateMap(rec, false, atlas as AtlasData);
    const map = data.maps.find((m) => m.id === stage.planId) ?? data.maps[0];
    return (
      <div className="maps-canvas present-map">
        <MapCanvas key={map.id} map={map} layers={LAYERS} hidden={HIDDEN} selectedId={null} onSelect={() => {}} onAnchor={() => {}} dm={false} />
      </div>
    );
  }
  return (
    <div className="present-blank">
      <img src="/brand/loresmith-emblem-gold-transparent.png" alt="" />
    </div>
  );
}
