/**
 * Client-side authentication for a static site: no server exists to check
 * credentials against, so we store a salted SHA-256 hash instead of the
 * password itself. This keeps plaintext passwords out of localStorage, but it
 * is obfuscation, not real security — there is no recovery if a password is
 * forgotten, because the hash is what ties a user to their data.
 */

const APP_SALT = 'drinkcal-v3';
const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 4;

export class AuthError extends Error {}

async function sha256(text) {
  if (!crypto?.subtle) {
    throw new AuthError('Secure connection required — open the app via https, not a local file.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Credential hash is derived from BOTH name+password so two users with the
 *  same password never collide, and the same password yields different hashes. */
export function hashCredentials(name, password) {
  const normalized = name.trim().toLowerCase();
  return sha256(`${APP_SALT}:${normalized}:${password}`);
}

export function findUser(registry, name) {
  const normalized = name.trim().toLowerCase();
  return registry.find((user) => user.name.toLowerCase() === normalized) || null;
}

/** Registers a new user; throws AuthError for validation/duplicate problems. */
export async function createAccount(registry, name, password) {
  const cleanName = name.trim();
  if (cleanName.length < MIN_NAME_LENGTH) throw new AuthError('Name needs at least 2 characters.');
  if (password.length < MIN_PASSWORD_LENGTH) throw new AuthError('Password needs at least 4 characters.');
  if (findUser(registry, cleanName)) throw new AuthError('That name is taken — sign in instead.');

  const hash = await hashCredentials(cleanName, password);
  const user = { name: cleanName, hash, createdAt: new Date().toISOString() };
  return { user, registry: [...registry, user] };
}

/** Verifies credentials against the registry; throws AuthError on mismatch. */
export async function verifyLogin(registry, name, password) {
  const user = findUser(registry, name);
  if (!user) throw new AuthError('No account with that name — create one first.');
  const hash = await hashCredentials(name, password);
  if (hash !== user.hash) throw new AuthError('Wrong password.');
  return user;
}
