/**
 * Horloge du monde : la date du jeu (Jour 1, Jour 2…, à la minute près) avance selon ce que font les personnages,
 * jamais selon le temps réel. Voyage (heures de marche), combat (6 secondes par round), repos, fouille, ou le MJ à la
 * main. Le moment de la journée (`world.time`) et la saison (`world.season`, si le MJ en a choisi une) en découlent.
 *
 * JavaScript pur, testé par clock.test.mjs.
 */

export const DAY = 24 * 60;
/** Durée d'une saison, en jours (une année de 364 jours). */
export const SEASON_DAYS = 91;
export const SEASON_ORDER = ['printemps', 'ete', 'automne', 'hiver'];
/** Début de chaque moment de la journée (minutes depuis minuit). */
export const PERIOD_START = { matin: 6 * 60, jour: 11 * 60, soir: 17 * 60, nuit: 22 * 60 };

/** Moment de la journée d'une minute (0–1439) : matin 6 h, jour 11 h, soir 17 h, nuit 22 h. */
export function periodOf(minute) {
  const m = ((minute % DAY) + DAY) % DAY;
  return m >= PERIOD_START.nuit || m < PERIOD_START.matin ? 'nuit' : m >= PERIOD_START.soir ? 'soir' : m >= PERIOD_START.jour ? 'jour' : 'matin';
}

/** Horloge d'un monde : la sienne, ou une horloge neuve calée sur le moment choisi jusqu'ici (Jour 1). */
export function clockOf(world) {
  if (world?.clock && Number.isFinite(world.clock.day)) return world.clock;
  const start = PERIOD_START[world?.time ?? 'jour'] ?? PERIOD_START.jour;
  // Un peu après le début du moment : « le jour » commence vers midi, « la nuit » vers minuit.
  const minute = { matin: 8 * 60, jour: 13 * 60, soir: 19 * 60, nuit: 23 * 60 + 30 }[world?.time ?? 'jour'] ?? start;
  return { day: 1, minute, seasonDay: 30 };
}

/**
 * Le monde, après `minutes` de jeu (peut être fractionnaire : un round fait 0,1 min). La saison avance d'elle-même
 * tous les 91 jours si le MJ en a choisi une. Renvoie un nouveau monde (l'ancien n'est pas modifié).
 */
export function tick(world, minutes) {
  const c = clockOf(world);
  const total = c.minute + Math.max(0, minutes);
  const days = Math.floor(total / DAY);
  const clock = { ...c, day: c.day + days, minute: Math.round((total - days * DAY) * 10) / 10, seasonDay: (c.seasonDay ?? 0) + days };
  let season = world.season;
  if (season) {
    let i = SEASON_ORDER.indexOf(season);
    while (clock.seasonDay >= SEASON_DAYS) { clock.seasonDay -= SEASON_DAYS; i = (i + 1) % 4; }
    season = SEASON_ORDER[i];
  } else clock.seasonDay %= SEASON_DAYS;
  return { ...world, clock, time: periodOf(clock.minute), ...(season ? { season } : {}) };
}

/** Minutes jusqu'au prochain début d'un moment (« jusqu'à l'aube » : jusqu'au matin). */
export function untilPeriod(world, period) {
  const c = clockOf(world);
  const to = PERIOD_START[period] ?? PERIOD_START.matin;
  const d = to - c.minute;
  return d > 0 ? d : d + DAY;
}

/** « Jour 12 · 14 h 30 ». */
export function clockLabel(clockOrWorld) {
  const c = clockOrWorld?.day ? clockOrWorld : clockOf(clockOrWorld);
  const m = Math.floor(c.minute);
  return `Jour ${c.day} · ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Instant absolu (minutes depuis le Jour 1 à minuit), pour comparer et dater les événements. */
export const stamp = (c) => (c.day - 1) * DAY + c.minute;

/** Temps écoulé entre deux instants, en mots : « 3 jours », « 5 h », « 2 mois ». */
export function elapsedLabel(fromStamp, toStamp) {
  const min = Math.max(0, toStamp - fromStamp);
  if (min < 60) return `${Math.round(min)} min`;
  if (min < DAY) return `${Math.round(min / 60)} h`;
  const d = Math.floor(min / DAY);
  if (d < 30) return `${d} jour${d > 1 ? 's' : ''}`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} mois` : `${Math.round(d / 364)} an${d >= 728 ? 's' : ''}`;
}

/** Durées courantes (minutes) : ce que coûtent les actions du jeu. */
export const DURATIONS = {
  round: 0.1, fouille: 10, reposCourt: 60, reposLong: 8 * 60, heure: 60, jour: DAY, semaine: 7 * DAY, mois: 30 * DAY,
};
