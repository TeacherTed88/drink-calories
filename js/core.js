/**
 * Pure business logic — no DOM, no storage. Everything here is unit-testable.
 * The UI and storage layers only ever call these functions, never re-implement them.
 */

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_IN_WEEK = 7;

/** Legacy column layouts → current indexes. Light beer/vodka/wine shifted when
 *  new beers were inserted mid-list, so old logs need remapping, not padding. */
const LEGACY_COLUMN_MAPS = {
  5: [0, 1, 20, 21, 22],                 // v1: std, qingdao, light, vodka, wine
  19: [...Array(16).keys(), 20, 21, 22], // v2: 16 beers, then light/vodka/wine
  23: [...Array(23).keys()],             // v3 modular app, pre-Meiyijai-shelf list
  58: [...Array(58).keys()],             // v3 + Meiyijia shelf; new drinks appended at 58+
};

const pad2 = (n) => String(n).padStart(2, '0');

/** Monday (start of week) of the calendar week containing `date`. */
export function mondayOf(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % DAYS_IN_WEEK));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Stable string key for a week, e.g. "2026-10-26". */
export function weekKeyOf(date) {
  const m = mondayOf(date);
  return `${m.getFullYear()}-${pad2(m.getMonth() + 1)}-${pad2(m.getDate())}`;
}

/** 7×N zero matrix: one row per weekday, one column per drink. */
export function emptyWeek(drinkCount) {
  return Array.from({ length: DAYS_IN_WEEK }, () => Array(drinkCount).fill(0));
}

/** Fresh user log with default kcal values supplied by the caller. */
export function createEmptyData(drinkCount, defaultKcal) {
  return {
    week: emptyWeek(drinkCount),
    kcal: [...defaultKcal],
    hist: {},
    weekKey: null,
  };
}

export function dayTotal(counts, kcals) {
  return counts.reduce((sum, count, i) => sum + count * kcals[i], 0);
}

export function weekTotal(week, kcals) {
  return week.reduce((sum, counts) => sum + dayTotal(counts, kcals), 0);
}

function weekHasEntries(week) {
  return week.some((counts) => counts.some((count) => count > 0));
}

/** Column sums of the week matrix — total servings per drink, for archiving. */
function drinkTotals(week) {
  return week[0].map((_, j) => week.reduce((sum, counts) => sum + counts[j], 0));
}

/**
 * Rolls `data` forward to `todayKey`, archiving the previous week if it has entries.
 * Pure: returns a NEW object; callers persist it.
 */
export function rolloverWeek(data, todayKey) {
  if (data.weekKey === todayKey) return data;
  const next = {
    ...data, // keeps kcal, myDrinks, anything future fields add
    hist: { ...data.hist },
    week: emptyWeek(data.week[0].length),
    weekKey: todayKey,
  };
  if (data.weekKey && weekHasEntries(data.week)) {
    next.hist[data.weekKey] = { drinks: drinkTotals(data.week), kcal: [...data.kcal] };
  }
  // The personal-list order is computed ONCE per week, here, from the week
  // that just ended — mid-week taps never reshuffle the list (user request).
  const width = data.week[0].length;
  const personal = Array.isArray(data.myDrinks) && data.myDrinks.length
    ? data.myDrinks
    : (Array.isArray(data.myOrder) ? data.myOrder : []);
  next.myOrder = orderByFrequency(personal, drinkFrequency(data, width));
  return next;
}

/** Total lifetime taps per drink (current week + archived weeks) — drives the
 *  "your regulars float to the top" ordering of the personal list. */
export function drinkFrequency(data, drinkCount) {
  const totals = Array(drinkCount).fill(0);
  const accumulate = (counts) => counts.forEach((count, j) => {
    if (j < drinkCount) totals[j] += count || 0;
  });
  data.week.forEach(accumulate);
  Object.values(data.hist).forEach((entry) => accumulate(entry.drinks || []));
  return totals;
}

/** Total servings of one drink logged across the current week. */
export function drinkCountThisWeek(week, drinkIndex) {
  return week.reduce((sum, day) => sum + (day[drinkIndex] || 0), 0);
}

/** Pure alcohol in grams for one day (or any counts row): count × per-serving grams. */
export function alcoholGrams(counts, grams) {
  return counts.reduce((sum, count, j) => sum + count * (grams[j] || 0), 0);
}

/** Stable sort of drink indexes by consumption, highest first. Ties keep the
 *  caller's original order so nothing visually jumps without a reason. */
export function orderByFrequency(indexes, freq) {
  return [...indexes].sort((a, b) => (freq[b] - freq[a]) || (indexes.indexOf(a) - indexes.indexOf(b)));
}

/**
 * Converts a legacy single-user payload (v1 = 5 drinks, v2 = 19 drinks) into
 * the current shape. Returns null when the payload is unusable.
 * `defaultKcal` fills drinks the user never customized.
 */
export function migrateLegacy(raw, drinkCount, defaultKcal) {
  if (!raw || !Array.isArray(raw.c) || raw.c.length !== DAYS_IN_WEEK) return null;
  const width = Array.isArray(raw.c[0]) ? raw.c[0].length : 0;
  const columnMap = LEGACY_COLUMN_MAPS[width];
  if (!columnMap && width !== drinkCount) return null;

  const data = createEmptyData(drinkCount, defaultKcal);
  data.weekKey = typeof raw.weekKey === 'string' ? raw.weekKey : null;

  // Identity map for same-width payloads; remap table for legacy layouts.
  const targetOf = columnMap ? (j) => columnMap[j] : (j) => j;

  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    for (let j = 0; j < width; j++) {
      data.week[i][targetOf(j)] = raw.c[i][j] || 0;
    }
  }

  data.kcal = Array.from({ length: drinkCount }, (_, j) => {
    const legacyIdx = columnMap ? columnMap.indexOf(j) : j;
    const legacyVal = Array.isArray(raw.k) && legacyIdx >= 0 && typeof raw.k[legacyIdx] === 'number'
      ? raw.k[legacyIdx]
      : null;
    return legacyVal ?? defaultKcal[j];
  });

  for (const [key, entry] of Object.entries(raw.hist || {})) {
    if (!entry || !Array.isArray(entry.drinks)) continue;
    const drinks = Array(drinkCount).fill(0);
    for (let j = 0; j < Math.min(width, entry.drinks.length); j++) {
      drinks[targetOf(j)] = entry.drinks[j] || 0;
    }
    data.hist[key] = { drinks, kcal: data.kcal.slice() };
  }
  // Carry the personal shortlist through migration (indexes stay valid: new
  // drinks are appended). Missing in legacy payloads — the app backfills.
  if (Array.isArray(raw.myDrinks)) {
    data.myDrinks = raw.myDrinks.filter((j) => j < drinkCount);
  }
  if (Array.isArray(raw.myOrder)) {
    data.myOrder = raw.myOrder.filter((j) => j < drinkCount);
  }
  return data;
}
