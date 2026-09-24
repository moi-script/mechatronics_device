import type { Circuit } from '@mech/sim';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface CircuitSummary {
  id: string;
  name: string;
  shareId?: string;
  updatedAt: string;
}

/**
 * Set for the Android build, which ships as static files inside the APK with
 * no server of its own.
 */
export const OFFLINE = process.env.NEXT_PUBLIC_OFFLINE === '1';

/**
 * Where the app reaches the live API, baked in when the APK is built. The site
 * itself never needs this: it calls /api on its own origin and the Next.js
 * route forwards it.
 *
 * With it set, the app can sign in to a cloud account; without it, the app is
 * device-only and never touches a network. Either way the board runs offline,
 * so a dead network or a sleeping free-tier API costs nothing but the account.
 */
export const CLOUD_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export const CLOUD_AVAILABLE = !OFFLINE || CLOUD_URL !== '';

/** Where the site lives, for share links the app cannot serve itself. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

// ---- Session token, for the app ----
//
// A Capacitor webview is a different origin from the site, so the session
// cookie would be cross-site and Android often drops it. The app asks the API
// for the token instead and carries it itself.

const TOKEN_KEY = 'mech-token';

const readToken = (): string | null => {
  if (!OFFLINE) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A webview with storage blocked just stays signed out.
  }
};

/** Signed in to a cloud account from the app. */
export const hasCloudSession = (): boolean => readToken() !== null;

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const base = OFFLINE ? CLOUD_URL : '/api';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as object) };
  if (OFFLINE) headers['X-Mech-Client'] = 'app';
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(base + path, {
    // The app authenticates with its token, so it sends nothing ambient.
    credentials: OFFLINE ? 'omit' : 'include',
    ...init,
    headers,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && token) writeToken(null); // the token expired or was revoked
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Request failed (' + res.status + ')');
  return body as T;
}

const post = (data: unknown) => ({ method: 'POST', body: JSON.stringify(data) });

/** Keeps the token the API hands back when the app signs in. */
async function withToken<T extends { token?: string }>(call: Promise<T>): Promise<T> {
  const out = await call;
  if (out.token) writeToken(out.token);
  return out;
}

const cloud = {
  me: () => req<{ user: User | null }>('/auth/me'),
  register: (d: { email: string; password: string; name: string }) =>
    withToken(req<{ user: User; token?: string }>('/auth/register', post(d))),
  login: (d: { email: string; password: string }) =>
    withToken(req<{ user: User; token?: string }>('/auth/login', post(d))),
  forgot: (d: { email: string }) => req<{ ok: true }>('/auth/forgot', post(d)),
  reset: (d: { email: string; code: string; password: string }) =>
    withToken(req<{ user: User; token?: string }>('/auth/reset', post(d))),
  logout: async () => {
    try {
      await req<{ ok: true }>('/auth/logout', { method: 'POST' });
    } finally {
      writeToken(null);
    }
    return { ok: true } as const;
  },

  listCircuits: () => req<{ circuits: CircuitSummary[] }>('/circuits'),
  getCircuit: (id: string) => req<{ circuit: Circuit; name: string; id: string }>('/circuits/' + id),
  createCircuit: (d: { name: string; circuit: Circuit }) => req<{ id: string }>('/circuits', post(d)),
  updateCircuit: (id: string, d: { name?: string; circuit?: Circuit }) =>
    req<{ ok: true }>('/circuits/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteCircuit: (id: string) => req<{ ok: true }>('/circuits/' + id, { method: 'DELETE' }),
  share: (id: string) => req<{ shareId: string }>('/circuits/' + id + '/share', { method: 'POST' }),
  shared: (shareId: string) => req<{ circuit: Circuit; name: string }>('/share/' + shareId),
};

// ---- On-device storage, for an app with nobody signed in ----

interface StoredCircuit {
  id: string;
  name: string;
  circuit: Circuit;
  updatedAt: string;
}

const STORE_KEY = 'mech-circuits';
const DEVICE_USER: User = { id: 'device', email: '', name: 'this device' };

function readAll(): StoredCircuit[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as StoredCircuit[];
  } catch {
    return [];
  }
}

function writeAll(list: StoredCircuit[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    throw new Error('The phone refused to store the circuit. Free some space and try again.');
  }
}

function find(id: string): StoredCircuit {
  const hit = readAll().find((c) => c.id === id);
  if (!hit) throw new Error('That circuit is no longer on this device.');
  return hit;
}

const noNetwork = () =>
  Promise.reject(new Error('Sign in to share a link, or send the circuit as a file instead.'));

const device: typeof cloud = {
  me: async () => ({ user: DEVICE_USER }),
  register: async () => ({ user: DEVICE_USER }),
  login: async () => ({ user: DEVICE_USER }),
  forgot: async () => ({ ok: true }),
  reset: async () => ({ user: DEVICE_USER }),
  logout: async () => ({ ok: true }),

  listCircuits: async () => ({
    circuits: readAll()
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  }),
  getCircuit: async (id) => {
    const { circuit, name } = find(id);
    return { circuit, name, id };
  },
  createCircuit: async ({ name, circuit }) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    writeAll([...readAll(), { id, name, circuit, updatedAt: new Date().toISOString() }]);
    return { id };
  },
  updateCircuit: async (id, d) => {
    const existing = find(id);
    writeAll(readAll().map((c) => (c.id === id ? { ...existing, ...d, updatedAt: new Date().toISOString() } : c)));
    return { ok: true };
  },
  deleteCircuit: async (id) => {
    writeAll(readAll().filter((c) => c.id !== id));
    return { ok: true };
  },
  share: noNetwork,
  shared: noNetwork,
};

/**
 * The website always talks to its own API. The app keeps circuits on the
 * device until someone signs in, and from then on works out of their account
 * — so the same build serves a student with no account and one who wants their
 * boards on every device they own.
 */
const route: typeof cloud = {
  me: async () => {
    if (!hasCloudSession()) return device.me();
    try {
      const out = await cloud.me();
      // A token the API no longer honours drops us back to the device.
      return out.user ? out : device.me();
    } catch {
      // Offline, or the API is asleep: the device's own circuits still open.
      return device.me();
    }
  },
  register: (d) => (CLOUD_URL ? cloud.register(d) : device.register(d)),
  login: (d) => (CLOUD_URL ? cloud.login(d) : device.login(d)),
  forgot: (d) => (CLOUD_URL ? cloud.forgot(d) : device.forgot(d)),
  reset: (d) => (CLOUD_URL ? cloud.reset(d) : device.reset(d)),
  logout: async () => (hasCloudSession() ? cloud.logout() : device.logout()),

  listCircuits: () => (hasCloudSession() ? cloud.listCircuits() : device.listCircuits()),
  getCircuit: (id) => (hasCloudSession() ? cloud.getCircuit(id) : device.getCircuit(id)),
  createCircuit: (d) => (hasCloudSession() ? cloud.createCircuit(d) : device.createCircuit(d)),
  updateCircuit: (id, d) => (hasCloudSession() ? cloud.updateCircuit(id, d) : device.updateCircuit(id, d)),
  deleteCircuit: (id) => (hasCloudSession() ? cloud.deleteCircuit(id) : device.deleteCircuit(id)),
  share: (id) => (hasCloudSession() ? cloud.share(id) : device.share(id)),
  shared: (shareId) => (hasCloudSession() ? cloud.shared(shareId) : device.shared(shareId)),
};

export const api = OFFLINE ? route : cloud;

/** True when circuits are going to the device rather than an account. */
export const savingToDevice = (): boolean => OFFLINE && !hasCloudSession();
