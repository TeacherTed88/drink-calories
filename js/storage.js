/**
 * Persistence layer — the ONLY module that touches localStorage.
 * All reads/writes are fail-soft: storage can throw (private mode, full disk),
 * so every call is wrapped and errors are reported to the caller.
 */

const REGISTRY_KEY = 'alctrack.v3.users';
const USER_PREFIX = 'alctrack.v3.data.';
const SESSION_KEY = 'alctrack.v3.session'; // localStorage: stay signed in until explicitly locked
const LEGACY_KEYS = ['alctrack.v2', 'alctrack.v1']; // newest first

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`storage.readJSON failed for ${key}:`, err);
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`storage.writeJSON failed for ${key}:`, err);
    return false;
  }
}

/** Account directory: [{ name, hash, createdAt }]. Never holds passwords. */
export function loadRegistry() {
  const registry = readJSON(REGISTRY_KEY);
  return Array.isArray(registry) ? registry : [];
}

export function saveRegistry(registry) {
  return writeJSON(REGISTRY_KEY, registry);
}

/** Each user gets an isolated namespaced slot — no cross-user leakage. */
export function loadUserData(hash) {
  return readJSON(USER_PREFIX + hash);
}

export function saveUserData(hash, data) {
  return writeJSON(USER_PREFIX + hash, data);
}

export function getSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch (err) {
    return null;
  }
}

export function setSession(hash) {
  try {
    localStorage.setItem(SESSION_KEY, hash);
  } catch (err) {
    /* Session is best-effort; the app still works without it. */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    /* ignore */
  }
}

/** Legacy single-user payload (v1 or v2), if this device has one. */
export function readLegacyData() {
  for (const key of LEGACY_KEYS) {
    const raw = readJSON(key);
    if (raw && Array.isArray(raw.c)) return raw;
  }
  return null;
}

export function clearLegacyData() {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }
}
