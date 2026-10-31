/**
 * Page « Banque Loresmith » (dans Cartes) : parcourir les images et attribuer un portrait ou un jeton à une fiche.
 *  - Images communes (le catalogue de l'application) : seul un administrateur retouche leurs étiquettes ou en exclut une.
 *  - Images du MJ : il en ajoute à son univers (ou à sa campagne en cours) et les étiquette ; elles suivent les droits
 *    de l'univers (un contributeur ne change que les siennes).
 */
import { useEffect, useMemo, useState } from 'react';
import { bankAdmin, bankSrc, overridesOf, setOverride, syncBank, useBank, type BankImage } from './index';

type Fiche = { id: string; title: string; targetType: 'library' | 'npc' };
type Props = {
  onBack: () => void;
  /** Fiches de personnage (Bibliothèque) et PNJ de l'univers, auxquels on peut attribuer une image. */
  fiches: Fiche[];
  onAssign: (fiche: Fiche, img: BankImage, src: string) => void;
  /** Ajouter une image à l'univers (ou à la campagne en cours). */
  onUpload: (file: File, kind: 'portrait' | 'jeton' | 'element' | 'texture', scope: 'univers' | 'campagne') => Promise<void>;
  /** Changer les étiquettes d'une image du MJ, ou la retirer. */
  onEditOwn: (assetId: string, patch: Partial<BankImage>) => void;
  onDeleteOwn: (assetId: string) => void;
  /** Campagne en cours (une image peut lui être propre). */
  campaignTitle?: string;
};

const TYPES = [['', 'Tout'], ['personnage', 'Personnages'], ['element', 'Éléments'], ['texture', 'Textures']] as const;
const PEUPLES = ['humain', 'nain', 'elfe', 'demi-elfe', 'halfelin', 'gnome', 'demi-orque', 'orque', 'tieffelin', 'drow', 'duergar', 'svirfnebelin', 'moriquendi'];
const list = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
const size = (img: BankImage) => (Array.isArray(img.taille) ? `${img.taille[0]} × ${img.taille[1]} m` : typeof img.taille === 'number' ? `tuile de ${img.taille} m` : '');

export default function BanquePanel({ onBack, fiches, onAssign, onUpload, onEditOwn, onDeleteOwn, campaignTitle }: Props) {
  const images = useBank();
  const [mode, setMode] = useState<'partage' | 'local' | null>(null);
  useEffect(() => { void syncBank().then(setMode); }, []);
  const [type, setType] = useState<string>('');
  const [vue, setVue] = useState<string>('');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [fiche, setFiche] = useState('');
  const [upKind, setUpKind] = useState<'portrait' | 'jeton' | 'element' | 'texture'>('jeton');
  const [upScope, setUpScope] = useState<'univers' | 'campagne'>('univers');
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return images.filter((i) => (!type || i.type === type) && (!vue || i.vue === vue)
      && (!t || [i.nom, i.titre, i.peuple, i.cat, ...(i.roles ?? []), ...(i.milieux ?? [])].join(' ').toLowerCase().includes(t)));
  }, [images, type, vue, q]);
  const sel = images.find((i) => i.id === selId) ?? null;
  const touched = overridesOf();

  const admin = bankAdmin();
  // Image du MJ : il la change lui-même ; image commune : l'administrateur seulement.
  const canEdit = !!sel && (sel.assetId ? true : admin);
  const edit = (patch: Partial<BankImage>) => {
    if (!sel || !canEdit) return;
    if (sel.assetId) onEditOwn(sel.assetId, patch); else void setOverride(sel.id, patch).then(setMode);
  };

  return (
    <div className="maps-page banque-page">
      <nav className="maps-crumbs"><button className="maps-link" onClick={onBack}>Cartes</button> › <span>Banque Loresmith</span></nav>
      <header className="maps-head">
        <h2>Banque Loresmith</h2>
        <p className="maps-sub">
          {images.length} images : personnages (portraits et jetons vus du dessus), éléments à leur taille réelle et textures de sol.
          Loresmith y puise pour les cités, les intérieurs et les combats, selon le climat, la saison et les peuples du lieu.
          Pour ajouter les nouvelles images du Drive, demande à Claude : « synchronise la banque ».
          <br />{admin ? 'Compte administrateur : tes retouches des images communes valent pour toute l’application.'
            : mode ? 'Les images communes sont réservées à l’administrateur. Tu peux ajouter les tiennes : elles sont propres à cet univers, ou à ta campagne.' : ''}
        </p>
        <div className="maps-actions banque-filters">
          <div className="maps-seg" role="group" aria-label="Type">
            {TYPES.map(([k, l]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => { setType(k); setVue(''); }}>{l}</button>)}
          </div>
          {type === 'personnage' && (
            <div className="maps-seg" role="group" aria-label="Vue">
              {[['', 'Toutes'], ['portrait', 'Portraits'], ['jeton', 'Jetons']].map(([k, l]) => <button key={k} className={vue === k ? 'on' : ''} onClick={() => setVue(k)}>{l}</button>)}
            </div>
          )}
          <input className="maps-btn" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (nom, peuple, rôle, milieu…)" />
        </div>
        <div className="maps-actions banque-upload">
          <label className="maps-btn gold" aria-disabled={busy}>
            {busy ? 'Ajout…' : '＋ Ajouter une image'}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              setBusy(true);
              try { await onUpload(f, upKind, upScope); setType(''); setQ(''); } finally { setBusy(false); }
            }} />
          </label>
          <select className="maps-btn" value={upKind} onChange={(e) => setUpKind(e.target.value as typeof upKind)} aria-label="Nature de l’image">
            <option value="jeton">Jeton (personnage vu du dessus)</option><option value="portrait">Portrait</option>
            <option value="element">Élément vu du dessus (fond transparent)</option><option value="texture">Texture de sol</option>
          </select>
          <select className="maps-btn" value={upScope} onChange={(e) => setUpScope(e.target.value as typeof upScope)} aria-label="Portée de l’image">
            <option value="univers">Pour cet univers</option>
            {campaignTitle && <option value="campagne">Pour la campagne « {campaignTitle} »</option>}
          </select>
        </div>
      </header>

      <div className="banque-body">
        <div className="banque-grid">
          {shown.map((i) => (
            <button key={i.id} className={`banque-card${selId === i.id ? ' is-sel' : ''}${i.exclu ? ' is-off' : ''}`} onClick={() => setSelId(i.id)} title={i.titre}>
              <img src={bankSrc(i, 120)} alt="" loading="lazy" className={i.type === 'texture' ? 'tex' : ''} />
              <span>{i.nom}{touched[i.id] ? ' ✎' : ''}</span>
              <small>{i.type === 'personnage' ? `${i.vue} · ${i.peuple || '?'}` : `${i.cat ?? ''} · ${size(i)}`}</small>
            </button>
          ))}
          {!shown.length && <p className="maps-hint">Aucune image ne correspond.</p>}
        </div>

        {sel && (
          <aside className="banque-detail">
            <img src={bankSrc(sel, 360)} alt={sel.nom} className={sel.type === 'texture' ? 'tex' : ''} />
            <p className="maps-sub">{sel.assetId ? `Ton image · ${sel.campaignId ? 'propre à ta campagne' : 'propre à cet univers'}` : `${sel.titre} · ${sel.mips.join(', ')} px`}</p>
            {!canEdit && <p className="maps-sub">Image commune : seul l’administrateur change ses étiquettes.</p>}
            {sel.assetId && <button className="maps-btn" onClick={() => { if (window.confirm(`Retirer « ${sel.nom} » de la banque de cet univers ?`)) { onDeleteOwn(sel.assetId!); setSelId(null); } }}>Retirer cette image</button>}
            <label>Nom <input className="maps-btn" disabled={!canEdit} value={sel.nom} onChange={(e) => edit({ nom: e.target.value })} /></label>
            {sel.type === 'personnage' ? (
              <>
                <label>Peuple
                  <select className="maps-btn" disabled={!canEdit} value={sel.peuple ?? ''} onChange={(e) => edit({ peuple: e.target.value })}>
                    <option value="">—</option>{PEUPLES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label>Rôles <input className="maps-btn" disabled={!canEdit} defaultValue={(sel.roles ?? []).join(', ')} key={`r-${sel.id}`} onBlur={(e) => edit({ roles: list(e.target.value) })} /></label>
              </>
            ) : (
              <label>Taille réelle (m) <input className="maps-btn" disabled={!canEdit} key={`t-${sel.id}`} defaultValue={Array.isArray(sel.taille) ? sel.taille.join(' × ') : String(sel.taille ?? '')}
                onBlur={(e) => { const n = e.target.value.split(/[x×*,; ]+/).map(Number).filter((x) => x > 0); if (n.length) edit({ taille: sel.type === 'texture' ? n[0] : [n[0], n[1] ?? n[0]] }); }} /></label>
            )}
            {sel.type !== 'personnage' && (
              <label>Catégorie <input className="maps-btn" disabled={!canEdit} key={`k-${sel.id}`} defaultValue={[sel.cat, ...(sel.usage ?? [])].filter(Boolean).join(', ')}
                title="arbre, arbuste, rocher, toit, mobilier, monument, marche… puis l’usage (lit, table, tonneau, coffre, place, marche…)"
                onBlur={(e) => { const [cat, ...usage] = list(e.target.value); edit({ cat, usage }); }} /></label>
            )}
            <label>Milieux <input className="maps-btn" disabled={!canEdit} key={`m-${sel.id}`} defaultValue={sel.milieux.join(', ')} onBlur={(e) => edit({ milieux: list(e.target.value) })} /></label>
            <label>Climats (vide : tous) <input className="maps-btn" disabled={!canEdit} key={`c-${sel.id}`} defaultValue={sel.climats.join(', ')} onBlur={(e) => edit({ climats: list(e.target.value) })} /></label>
            <label>Saisons (vide : toutes) <input className="maps-btn" disabled={!canEdit} key={`s-${sel.id}`} defaultValue={sel.saisons.join(', ')} onBlur={(e) => edit({ saisons: list(e.target.value) })} /></label>
            <label>Région <input className="maps-btn" disabled={!canEdit} key={`g-${sel.id}`} defaultValue={sel.region.join(', ')} onBlur={(e) => edit({ region: list(e.target.value) })} title="surface, outreterre, mer" /></label>
            <label className="maps-row"><input type="checkbox" disabled={!canEdit} checked={!!sel.exclu} onChange={(e) => edit({ exclu: e.target.checked })} /> Exclure des choix automatiques</label>
            {admin && !sel.assetId && touched[sel.id] && <button className="maps-btn" onClick={() => { void setOverride(sel.id, null).then(setMode); }}>Rétablir les étiquettes d’origine</button>}
            {sel.type === 'personnage' && (
              <div className="banque-assign">
                <h5>Attribuer à une fiche</h5>
                <select className="maps-btn" value={fiche} onChange={(e) => setFiche(e.target.value)}>
                  <option value="">Choisir une fiche…</option>
                  {fiches.map((f) => <option key={`${f.targetType}:${f.id}`} value={`${f.targetType}:${f.id}`}>{f.title}{f.targetType === 'npc' ? ' (PNJ)' : ''}</option>)}
                </select>
                <button className="maps-btn gold" disabled={!fiche} onClick={() => {
                  const f = fiches.find((x) => `${x.targetType}:${x.id}` === fiche);
                  if (f) onAssign(f, sel, bankSrc(sel, 512));
                }}>Attribuer</button>
                {sel.paire && <p className="maps-sub">Même personnage en {sel.vue === 'portrait' ? 'jeton' : 'portrait'} : <button className="maps-link" onClick={() => setSelId(sel.paire!)}>voir</button></p>}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
