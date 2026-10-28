/**
 * Minimal test runner for the pure logic in core.js and auth.js.
 * Open tests.html on the deployed site (https required for crypto.subtle).
 */

import { mondayOf, weekKeyOf, createEmptyData, dayTotal, weekTotal, rolloverWeek, migrateLegacy }
  from './core.js';
import { hashCredentials } from './auth.js';

const results = [];
const test = (name, fn) => results.push({ name, fn });
const assertEqual = (actual, expected, label = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const assertTrue = (value, label = '') => {
  if (!value) throw new Error(`${label} expected truthy value`);
};

/* ------------------------------- core.js ------------------------------- */

test('mondayOf finds Monday of the current week', () => {
  // 2026-10-28 is a Wednesday → Monday is 2026-10-26
  assertEqual(weekKeyOf(new Date('2026-10-28T12:00:00')), '2026-10-26');
  // A Sunday (2026-11-01) still belongs to the week starting 2026-10-26
  assertEqual(weekKeyOf(new Date('2026-11-01T08:00:00')), '2026-10-26');
  assertEqual(mondayOf(new Date('2026-10-26T09:00:00')).getDay(), 1);
});

test('dayTotal / weekTotal multiply counts by kcal', () => {
  const kcal = [100, 200];
  assertEqual(dayTotal([2, 1], kcal), 400, 'dayTotal');
  assertEqual(weekTotal([[1, 0], [0, 2], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], kcal), 500, 'weekTotal');
});

test('rolloverWeek archives a finished week and starts fresh', () => {
  const data = createEmptyData(3, [100, 200, 300]);
  data.weekKey = '2026-10-19';
  data.week[0][1] = 2; // Mon: 2 × 200 kcal
  data.week[6][0] = 1; // Sun: 1 × 100 kcal

  const rolled = rolloverWeek(data, '2026-10-26');
  assertEqual(rolled.weekKey, '2026-10-26');
  assertEqual(weekTotal(rolled.week, rolled.kcal), 0, 'new week starts empty');
  assertEqual(dayTotal(rolled.hist['2026-10-19'].drinks, rolled.hist['2026-10-19'].kcal), 500, 'archive keeps totals');
  // Original object untouched (purity check)
  assertEqual(weekTotal(data.week, data.kcal), 500);
});

test('rolloverWeek does nothing when the week is unchanged', () => {
  const data = createEmptyData(2, [100, 200]);
  data.weekKey = '2026-10-26';
  assertEqual(rolloverWeek(data, '2026-10-26'), data);
});

test('rolloverWeek skips archiving an empty week', () => {
  const data = createEmptyData(2, [100, 200]);
  data.weekKey = '2026-10-19';
  const rolled = rolloverWeek(data, '2026-10-26');
  assertEqual(Object.keys(rolled.hist).length, 0);
});

/* ----------------------------- migration ------------------------------- */

const legacy19 = {
  c: Array.from({ length: 7 }, () => Array(19).fill(0)),
  k: Array.from({ length: 19 }, (_, j) => 100 + j),
  hist: { '2026-10-12': { drinks: Array.from({ length: 19 }, (_, j) => (j === 0 ? 3 : 0)), k: [] } },
  weekKey: '2026-10-26',
};
legacy19.c[0][0] = 1;   // Mon: 1 beer
legacy19.c[0][17] = 2;  // Mon: 2 vodka

test('migrateLegacy remaps a v2 (19-drink) payload onto the 23-drink layout', () => {
  const data = migrateLegacy(legacy19, 58, Array(58).fill(150));
  assertTrue(data !== null);
  assertEqual(data.week[0][0], 1, 'beer stays put');
  assertEqual(data.week[0][21], 2, 'vodka moved 17 → 21');
  assertEqual(data.week[0][17], 0, 'new Guinness slot starts empty');
  assertEqual(data.kcal[5], 105, 'custom kcal survives');
  assertEqual(data.hist['2026-10-12'].drinks[0], 3);
});

const legacy5 = {
  c: [[2, 0, 1, 0, 3], ...Array(6).fill(null).map(() => [0, 0, 0, 0, 0])],
  k: [215, 195, 150, 100, 125],
  hist: {},
  weekKey: '2026-10-26',
};

test('migrateLegacy maps a v1 (5-drink) payload onto the 23-drink layout', () => {
  const data = migrateLegacy(legacy5, 58, Array(58).fill(150));
  assertTrue(data !== null);
  assertEqual(data.week[0][0], 2,  'standard beer');
  assertEqual(data.week[0][1], 0,  'qingdao');
  assertEqual(data.week[0][20], 1, 'light beer moved 16 → 20');
  assertEqual(data.week[0][21], 0, 'vodka moved 17 → 21');
  assertEqual(data.week[0][22], 3, 'wine moved 18 → 22');
  assertEqual(data.kcal[0], 215, 'legacy kcal wins over defaults');
  assertEqual(data.kcal[10], 150, 'unknown drinks get defaults');
});

test('migrateLegacy rejects malformed payloads', () => {
  assertEqual(migrateLegacy(null, 58, []), null);
  assertEqual(migrateLegacy({ c: 'nope' }, 58, []), null);
});

/* ------------------------------- auth.js ------------------------------- */

test('hashCredentials is deterministic and password-sensitive', async () => {
  const a = await hashCredentials('Ted', 'hunter2');
  const b = await hashCredentials('Ted', 'hunter2');
  const c = await hashCredentials('Ted', 'hunter3');
  const d = await hashCredentials('ted ', 'hunter2'); // name normalization
  assertEqual(a, b);
  assertTrue(a !== c, 'different password → different hash');
  assertEqual(a, d, 'name is case/space-insensitive');
  assertTrue(/^[0-9a-f]{64}$/.test(a), 'SHA-256 hex output');
});

/* ------------------------------- runner -------------------------------- */

const host = document.getElementById('results');
host.innerHTML = '';
let passed = 0;

for (const { name, fn } of results) {
  const row = document.createElement('div');
  try {
    await fn();
    row.className = 'pass';
    row.textContent = `✓ ${name}`;
    passed++;
  } catch (err) {
    row.className = 'fail';
    row.textContent = `✗ ${name} — ${err.message}`;
  }
  host.append(row);
}

const summary = document.getElementById('summary');
summary.textContent = `${passed}/${results.length} tests passed`;
summary.className = passed === results.length ? 'pass' : 'fail';
