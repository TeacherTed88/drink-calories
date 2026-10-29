/**
 * Application orchestrator — owns the runtime state and wires the layers:
 * auth (who), storage (persist), core (rules), ui (pixels).
 * Contains no business math and no DOM building.
 */

import { DRINKS } from './drinks.js';
import {
  DAY_NAMES, weekKeyOf, createEmptyData, rolloverWeek, migrateLegacy,
  drinkFrequency, orderByFrequency, drinkCountThisWeek,
} from './core.js';
import {
  loadRegistry, saveRegistry, loadUserData, saveUserData,
  getSession, setSession, clearSession, readLegacyData, clearLegacyData,
} from './storage.js';
import { AuthError, createAccount, verifyLogin } from './auth.js';
import { createUI } from './ui.js';

const MS_PER_DAY = 864e5;
const DEFAULT_KCAL = DRINKS.map((drink) => drink.kcal);
/** New accounts start with the essentials: standard, Qingdao, Asahi, vodka, wine. */
const DEFAULT_MY_DRINKS = [0, 1, 15, 21, 22];

/**
 * Session-scoped app state. `data` is the persisted per-user log;
 * `selectedDay` is UI-only and deliberately not persisted.
 */
let currentUser = null;
let data = null;
let selectedDay = (new Date().getDay() + 6) % 7;

const weekDates = Array.from({ length: 7 }, (_, i) => {
  const monday = mondayDate();
  return new Date(monday.getTime() + i * MS_PER_DAY);
});

function mondayDate() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function persist() {
  if (!currentUser) return;
  const ok = saveUserData(currentUser.hash, data);
  if (!ok) ui.toast('Could not save — storage is unavailable');
}

/** Loads (and rolls over) the user's log; seeds from legacy data on first use. */
function loadUserLog(user) {
  let loaded = loadUserData(user.hash);
  if (!loaded) {
    loaded = createEmptyData(DRINKS.length, DEFAULT_KCAL);
    const legacy = readLegacyData();
    if (legacy) {
      const migrated = migrateLegacy(legacy, DRINKS.length, DEFAULT_KCAL);
      if (migrated) {
        loaded = migrated;
        clearLegacyData(); // one-time import; from now on the v3 slot owns the data
        ui.toast('Your existing log was imported');
      }
    }
  }
  // Personal shortlist came in after v3 launched — backfill for existing logs.
  if (!Array.isArray(loaded.myDrinks) || loaded.myDrinks.length === 0) {
    loaded.myDrinks = [...DEFAULT_MY_DRINKS];
  }
  // List order freezes weekly (computed at Monday rollover). Older logs have
  // no stored order yet — compute one now from their history and freeze it.
  if (!Array.isArray(loaded.myOrder) || loaded.myOrder.length === 0) {
    loaded.myOrder = orderByFrequency(loaded.myDrinks, drinkFrequency(loaded, DRINKS.length));
  }
  // Archive the previous week if the calendar has moved on since last visit.
  data = rolloverWeek(loaded, weekKeyOf(new Date()));
  persist();
}

function refresh() {
  ui.render({ user: currentUser, drinks: DRINKS, data, weekDates, selectedDay });
}

/* ------------------------------ actions ------------------------------ */

const ui = createUI({
  onSelectDay: (dayIndex) => {
    selectedDay = dayIndex;
    refresh();
  },
  onIncrement: (drinkIndex) => {
    data.week[selectedDay][drinkIndex] += 1;
    persist();
    refresh();
  },
  onDecrement: (drinkIndex) => {
    if (data.week[selectedDay][drinkIndex] === 0) return;
    data.week[selectedDay][drinkIndex] -= 1;
    persist();
    refresh();
  },
  onClearDay: () => {
    const empty = data.week[selectedDay].every((count) => count === 0);
    if (empty) return;
    if (!confirm(`Clear all drinks for ${DAY_NAMES[selectedDay]}?`)) return;
    data.week[selectedDay] = data.week[selectedDay].map(() => 0);
    persist();
    refresh();
    ui.toast('Day cleared');
  },
  onAddToMine: (drinkIndex) => {
    if (data.myDrinks.includes(drinkIndex)) return;
    data.myDrinks.unshift(drinkIndex); // membership
    data.myOrder.unshift(drinkIndex);   // position: new items surface at top mid-week
    persist();
    refresh();
    ui.toast(`${DRINKS[drinkIndex].name} added to your list`);
  },
  onRemoveFromMine: (drinkIndex) => {
    // Guard-rail: a drink with logged servings this week can't silently leave
    // the list — the user must confirm dropping its calories too. Archived
    // past weeks are never touched.
    const loggedThisWeek = drinkCountThisWeek(data.week, drinkIndex);
    if (loggedThisWeek > 0) {
      const confirmed = confirm(
        `You've logged ${loggedThisWeek} × ${DRINKS[drinkIndex].name} this week.\n\n` +
        'Remove them too? Their calories will be subtracted from this week.'
      );
      if (!confirmed) return;
      data.week = data.week.map((day) => {
        const cleared = [...day];
        cleared[drinkIndex] = 0;
        return cleared;
      });
    }
    data.myDrinks = data.myDrinks.filter((j) => j !== drinkIndex);
    data.myOrder = data.myOrder.filter((j) => j !== drinkIndex);
    persist();
    refresh();
    ui.toast(loggedThisWeek > 0
      ? 'Removed, with its logged drinks'
      : 'Removed — it stays in the catalog below');
  },
  onUpdateKcal: (drinkIndex, value) => {
    data.kcal[drinkIndex] = value;
    persist();
    refresh();
    ui.toast(`${DRINKS[drinkIndex].name}: ${value} kcal`);
  },
  onLock: () => {
    clearSession();
    currentUser = null;
    data = null;
    ui.showAuth();
  },
  onSignIn: async (name, password) => {
    try {
      const registry = loadRegistry();
      const user = await verifyLogin(registry, name, password);
      enterApp(user);
    } catch (err) {
      ui.showAuth(err instanceof AuthError ? err.message : 'Sign-in failed — try again.');
    }
  },
  onCreateAccount: async (name, password) => {
    try {
      const registry = loadRegistry();
      const { user, registry: nextRegistry } = await createAccount(registry, name, password);
      saveRegistry(nextRegistry);
      enterApp(user);
    } catch (err) {
      ui.showAuth(err instanceof AuthError ? err.message : 'Could not create the account.');
    }
  },
});

function enterApp(user) {
  currentUser = user;
  setSession(user.hash);
  loadUserLog(user);
  ui.hideAuth();
  refresh();
}

/* -------------------------------- boot -------------------------------- */

async function boot() {
  ui.bind();
  const sessionHash = getSession();
  const registry = loadRegistry();
  const user = registry.find((entry) => entry.hash === sessionHash);
  if (user) {
    enterApp(user);
  } else {
    clearSession();
    ui.showAuth();
  }
}

boot();
