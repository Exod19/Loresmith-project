/**
 * Rencontres vivantes (MJ) dans la fiche d'un lieu de l'Atlas : la classification du lieu, les rencontres admissibles
 * avec leur poids et les raisons d'exclusion, puis Générer / Régénérer / Choisir un modèle / Poser sur la carte /
 * Garder pour la campagne / Ne rien rencontrer. Les créatures sont reliées aux fiches du bestiaire Underdark importé
 * (par leur ID d'origine) ; un rôle sans statistiques reste un archétype de PNJ, jamais un faux bloc équilibré.
 * Rien de tout cela n'est montré aux joueurs.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AtlasData, AtlasFeature } from './atlas/types';
import type { EncounterGroup } from './battle/encounter';
import { loadEncounterCore, type RuntimeEncounterCore, type GeneratedEncounter, type EncounterPlace } from '../encounters';

export type LiveBestiaryRef = { id: string; name: string; hp?: number; ac?: number; token?: string; underdarkId?: string; underdark?: { gridFootprint?: { recommendedTokenCells?: { width?: number } } } };
export type LiveLog = { eventId: string; locationId: string; templateId?: string; title?: string; seed?: string; result: 'kept' | 'nothing' | 'placed'; at: number };

const STANCE: Record<string, string> = { friendly: 'amical', neutral: 'neutre', wary: 'méfiant', hostile: 'hostile', afraid: 'craintif', unaware: 'inattentif' };
const KIND: Record<string, string> = { workers: 'travailleurs', hunters: 'chasseurs', patrol: 'patrouille', trade: 'commerce', caravan: 'caravane', work: 'travail', fauna: 'faune', ecology: 'écologie', sign: 'indice', hazard: 'danger', exploration: 'exploration', social: 'social', pilgrimage: 'pèlerinage', travelers: 'voyageurs', military: 'troupe', civilian: 'civils', diplomatic: 'diplomatie' };
const REASON: Record<string, string> = {
  TERRITOIRE_MORI_VISITEURS_NON_AUTORISES: 'visiteurs étrangers non admis en territoire Moriquendi',
  MORI_HORS_TERRITOIRE_NON_AUTORISE_PAR_DEFAUT: 'Moriquendi hors de leur territoire (décision du MJ)',
  BIOME_OU_FONCTION_INADAPTE: 'milieu ou fonction du lieu inadapté',
  LIEU_EXCLU: 'lieu exclu par le modèle',
  ZONE_INADAPTEE: 'zone inadaptée (cité, transit, sauvage)',
  EXTERIEUR_SURFACE_NON_PREVU: 'surface non prévue',
  MORI_MIXTE_NON_AUTORISE_PAR_DEFAUT: 'groupe Moriquendi mixte sans exception approuvée',
  MORI_SOUS_AUTORITE_EXTERNE_INTERDIT: 'Moriquendi sous autorité étrangère (interdit)',
  MORI_SERVITEUR_D_UN_AUTRE_PEUPLE_INTERDIT: 'Moriquendi serviteur d’un autre peuple (interdit)',
  ASSOCIATION_INTERPEUPLES_NON_JUSTIFIEE: 'association entre peuples sans motif',
  CREATURE_NON_SAPIENTE_NE_PAS_DIRIGER_COMMERCE_OU_DIPLOMATIE: 'une bête ne dirige pas un commerce',
};
const reasonText = (r: string) => REASON[r] ?? (r.startsWith('EXCEPTION_NON_APPROUVEE') ? 'exception nommée non approuvée par le MJ' : r);
const STATUS: Record<string, string> = {
  DEMO_NOT_CANON: 'Lieu de démonstration : jamais canonique',
  CANON_SOURCE_CONFLICT: 'Sources en conflit : à confirmer',
  ATLAS_SOURCE_REVIEW: 'Provenance à revoir',
  CANON_OR_SOURCE_CONFIRMED: 'Lieu confirmé',
  PROPOSAL: 'Lieu en création (proposition)',
};

export default function LiveEncounters({ feature, data, bestiary, log, onPlace, onLog }: {
  feature: AtlasFeature; data: AtlasData; bestiary: LiveBestiaryRef[]; log: LiveLog[];
  /** Pose la rencontre sur la carte (repère « rencontre » dont la carte de combat reprend les groupes). */
  onPlace: (title: string, summary: string, notes: string, groups: EncounterGroup[], entry: LiveLog) => void;
  onLog: (entry: LiveLog) => void;
}) {
  const [core, setCore] = useState<RuntimeEncounterCore | null>(null);
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(1);
  const [pick, setPick] = useState('');
  const [scene, setScene] = useState<GeneratedEncounter | null>(null);
  const [none, setNone] = useState('');
  useEffect(() => { if (open && !core) loadEncounterCore().then(setCore).catch(() => setNone('Moteur de rencontres indisponible.')); }, [open, core]);
  useEffect(() => { setScene(null); setNone(''); setPick(''); setN(1); }, [feature.id]);

  const place: EncounterPlace | null = useMemo(() => (core ? core.classifyFeature(feature, data) : null), [core, feature, data]);
  const pool = useMemo(() => (core && place ? core.candidateEncounters(place).sort((a, b) => b.weight - a.weight) : []), [core, place]);
  const excluded = useMemo(() => {
    if (!core || !place) return [] as [string, number][];
    const count = new Map<string, number>();
    for (const t of core.TEMPLATES) {
      const v = core.validateComposition(t, place);
      if (!v.allowed) for (const r of v.reasons) count.set(reasonText(r), (count.get(reasonText(r)) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [core, place]);
  const total = pool.reduce((s, x) => s + x.weight, 0);
  const byUd = useMemo(() => new Map(bestiary.filter((b) => b.underdarkId).map((b) => [b.underdarkId!, b])), [bestiary]);

  const generate = (seedN: number, templateId = pick) => {
    if (!core || !place) return;
    const templates = templateId ? core.TEMPLATES.filter((t) => t.id === templateId) : undefined;
    const out = core.generateEncounter(place, templates, { seed: `${feature.id}:${seedN}` });
    if (out.status === 'generated') { setScene(out); setNone(''); } else { setScene(null); setNone(out.reason); }
  };

  /** Groupes pour la carte de combat : fiche du bestiaire importé si elle existe ; sinon un archétype sans statistiques. */
  const groupsOf = (s: GeneratedEncounter): EncounterGroup[] => s.groupMembers.filter((m) => m.count > 0).map((m) => {
    const fiche = m.creatureId ? byUd.get(m.creatureId) : undefined;
    const cells = m.gridFootprint ? Math.max(1, Math.round(m.gridFootprint.width)) : 1;
    return {
      stat: '', n: m.count, role: m.displayRole ?? m.relationToLeader, name: fiche?.name ?? m.creatureName ?? m.displayRole ?? 'Inconnu',
      detail: fiche ? 'fiche du bestiaire Underdark' : m.creatureId ? 'fiche à importer (PNJ & Créatures)' : 'archétype sans statistiques',
      image: fiche?.token, hp: fiche?.hp, ac: fiche?.ac, size: (cells >= 2 ? 2 : 1) as 1 | 2, npcId: fiche?.id,
    };
  });

  const mine = log.filter((l) => l.locationId === feature.id).slice(0, 4);
  return (
    <div className="maps-card live-enc">
      <button className="live-enc-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <h3>🎲 Rencontres vivantes</h3>
        <span className="maps-sub">{open ? '▴' : '▾'}</span>
      </button>
      {open && !core && <p className="maps-sub">{none || 'Chargement…'}</p>}
      {open && core && place && (
        <>
          <p className="maps-sub">
            {[place.owner && `peuple : ${place.owner}${place.clan ? ` (${place.clan})` : ''}`, `zone : ${place.zone}`, place.tags.length ? `fonctions : ${place.tags.join(', ')}` : ''].filter(Boolean).join(' · ')}
          </p>
          {place.eligibilityStatus && <p className={`live-status s-${place.eligibilityStatus}`}>{STATUS[place.eligibilityStatus] ?? place.eligibilityStatus}</p>}

          <div className="live-pool">
            <b>{pool.length} rencontre{pool.length > 1 ? 's' : ''} possible{pool.length > 1 ? 's' : ''}</b>
            <ul>
              {pool.slice(0, 8).map((c) => (
                <li key={c.template.id}>
                  <button className="maps-link" onClick={() => { setPick(c.template.id); generate(n, c.template.id); }}>{c.template.name}</button>
                  <small>{KIND[c.template.kind] ?? c.template.kind} · {Math.round((c.weight / (total || 1)) * 100)} %</small>
                </li>
              ))}
            </ul>
            {excluded.length > 0 && (
              <details>
                <summary>Pourquoi les autres sont exclues ({core.TEMPLATES.length - pool.length})</summary>
                <ul>{excluded.slice(0, 8).map(([r, k]) => <li key={r}><small>{k} × {r}</small></li>)}</ul>
              </details>
            )}
          </div>

          <div className="live-ctrl">
            <select className="maps-btn" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Au hasard (pondéré)</option>
              {pool.map((c) => <option key={c.template.id} value={c.template.id}>{c.template.name}</option>)}
            </select>
            <button className="maps-btn gold" disabled={!pool.length} onClick={() => generate(n)}>Générer</button>
            <button className="maps-btn" disabled={!scene} onClick={() => { setN(n + 1); generate(n + 1); }}>Régénérer</button>
            <button className="maps-btn" onClick={() => { onLog({ eventId: `${Date.now()}`, locationId: feature.id, result: 'nothing', at: Date.now() }); setScene(null); setNone('Rien à signaler cette fois : le groupe passe son chemin.'); }}>Ne rien rencontrer</button>
          </div>
          {none && <p className="maps-sub">{none}</p>}

          {scene && (
            <div className="live-scene">
              <p><strong>{scene.title}</strong> <small>({KIND[scene.kind] ?? scene.kind}, {STANCE[scene.initialStance] ?? scene.initialStance})</small></p>
              {scene.hook && <p><em>Accroche :</em> {scene.hook}</p>}
              {scene.goals && <p><em>Veut :</em> {scene.goals}</p>}
              {scene.groupMembers.length > 0 ? (
                <ul className="live-members">
                  {scene.groupMembers.map((m, i) => {
                    const fiche = m.creatureId ? byUd.get(m.creatureId) : undefined;
                    return (
                      <li key={i}>
                        {m.count} × <b>{fiche?.name ?? m.creatureName ?? m.displayRole}</b>
                        <small> {m.relationToLeader === 'leader' ? '· chef ' : ''}{m.size ? `· ${m.size}` : ''}{m.gridFootprint ? ` · ${m.gridFootprint.width}×${m.gridFootprint.height} case(s)` : ''}</small>
                        <small className={fiche ? 'ok' : 'warn'}> {fiche ? `· CA ${fiche.ac} · PV ${fiche.hp}` : m.creatureId ? '· fiche à importer' : '· archétype sans statistiques'}</small>
                        {m.potentialLoot.length > 0 && <div className="maps-sub">Porte peut-être : {m.potentialLoot.slice(0, 3).join(', ')} (rien n’est un butin garanti)</div>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="maps-sub">Scène sans acteurs (indice, danger ou exploration) : aucune créature à poser.</p>}
              {scene.cargo?.length > 0 && <p className="maps-sub">Cargaison : {scene.cargo.map((c) => `${c.name} (à ${c.owner})`).join(', ')} — appartient au groupe, ce n’est pas un butin.</p>}
              <details>
                <summary>Issues possibles</summary>
                {Object.entries(scene.branches || {}).map(([k, v]) => <p key={k} className="maps-sub"><b>{({ peaceful: 'Paisible', tension: 'Tendue', combat: 'Combat' } as Record<string, string>)[k] ?? k} :</b> {v}</p>)}
                {scene.aftermath && <p className="maps-sub"><b>Ensuite :</b> {scene.aftermath}</p>}
              </details>
              {scene.warnings.length > 0 && <p className="live-warn">{scene.warnings.map((w) => ({ LIEU_EN_DEVELOPPEMENT_SANS_CANON: 'lieu en développement (non canonique)', CERTAINS_ARCHETYPES_PNJ_SANS_BLOC_DE_STATS: 'certains rôles n’ont pas de statistiques', RENCONTRE_EXCEPTIONNELLE_NOMMEE: 'exception nommée' } as Record<string, string>)[w] ?? w).join(' · ')}</p>}
              <div className="live-ctrl">
                {scene.groupMembers.length > 0 && (
                  <button className="maps-btn gold" onClick={() => {
                    onPlace(scene.title, [scene.hook, scene.goals && `Veut : ${scene.goals}`].filter(Boolean).join('\n'), [`Attitude : ${STANCE[scene.initialStance] ?? scene.initialStance}`, scene.aftermath && `Ensuite : ${scene.aftermath}`].filter(Boolean).join('\n'), groupsOf(scene),
                      { eventId: `${Date.now()}`, locationId: feature.id, templateId: scene.templateId, title: scene.title, seed: scene.seed, result: 'placed', at: Date.now() });
                  }}>📍 Poser sur la carte</button>
                )}
                <button className="maps-btn" onClick={() => onLog({ eventId: `${Date.now()}`, locationId: feature.id, templateId: scene.templateId, title: scene.title, seed: scene.seed, result: 'kept', at: Date.now() })}>Garder pour la campagne</button>
              </div>
            </div>
          )}
          {mine.length > 0 && (
            <p className="maps-sub live-log">Ici : {mine.map((l) => `${l.result === 'nothing' ? 'rien' : l.title ?? '—'}${l.result === 'placed' ? ' (posée)' : l.result === 'kept' ? ' (gardée)' : ''}`).join(' · ')}</p>
          )}
        </>
      )}
    </div>
  );
}
