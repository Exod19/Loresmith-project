/**
 * Genres de l'univers (réglages de l'univers) : ils décident des images que Loresmith propose d'office. Une image de la
 * banque d'un autre genre (un centaure dans un univers futuriste) n'est jamais choisie seule ; le MJ peut toujours la
 * poser à la main.
 */
import { GENRES, genresOf } from './genres';

export default function GenrePicker({ universe, onChange }: { universe: { genres?: string[] } | null; onChange: (genres: string[]) => void }) {
  const cur = genresOf(universe);
  const toggle = (id: string) => {
    const next = cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id];
    if (next.length) onChange(next); // au moins un genre
  };
  return (
    <div className="genre-picker" role="group" aria-label="Genres de l’univers">
      {GENRES.map((g) => (
        <label key={g.id} className="row" style={{ gap: 6, alignItems: 'center', display: 'inline-flex', marginRight: 14 }}>
          <input type="checkbox" checked={cur.includes(g.id)} onChange={() => toggle(g.id)} /> {g.label}
        </label>
      ))}
      <small className="muted" style={{ display: 'block', marginTop: 4 }}>
        Images de la banque proposées d’office : celles de ces genres, et les images communes (sols, eau, roche, végétation).
      </small>
    </div>
  );
}
