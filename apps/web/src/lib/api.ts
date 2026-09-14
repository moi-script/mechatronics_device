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
 * no server behind it. Circuits then live on the device instead of an account.
 */
export const OFFLINE = process.env.NEXT_PUBLIC_OFFLINE === '1';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Request failed (' + res.status + ')');
  return body as T;
}

const post = (data: unknown) => ({ method: 'POST', body: JSON.stringify(data) });

const online = {
  me: () => req<{ user: User | null }>('/auth/me'),
  register: (d: { email: string; password: string; name: string }) => req<{ user: User }>('/auth/register', post(d)),
  login: (d: { email: string; password: string }) => req<{ user: User }>('/auth/login', post(d)),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),

  listCircuits: () => req<{ circuits: CircuitSummary[] }>('/circuits'),
  getCircuit: (id: string) => req<{ circuit: Circuit; name: string; id: string }>('/circuits/' + id),
  createCircuit: (d: { name: string; circuit: Circuit }) => req<{ id: string }>('/circuits', post(d)),
  updateCircuit: (id: string, d: { name?: string; circuit?: Circuit }) =>
    req<{ ok: true }>('/circuits/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteCircuit: (id: string) => req<{ ok: true }>('/circuits/' + id, { method: 'DELETE' }),
  share: (id: string) => req<{ shareId: string }>('/circuits/' + id + '/share', { method: 'POST' }),
  shared: (shareId: string) => req<{ circuit: Circuit; name: string }>('/share/' + shareId),
};

// ---- On-device storage for the offline build ----

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

const noNetwork = () => Promise.reject(new Error('Sharing needs the web version, since links are served online.'));

const offline: typeof online = {
  me: async () => ({ user: DEVICE_USER }),
  register: async () => ({ user: DEVICE_USER }),
  login: async () => ({ user: DEVICE_USER }),
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
    writeAll(
      readAll().map((c) => (c.id === id ? { ...existing, ...d, updatedAt: new Date().toISOString() } : c)),
    );
    return { ok: true };
  },
  deleteCircuit: async (id) => {
    writeAll(readAll().filter((c) => c.id !== id));
    return { ok: true };
  },
  share: noNetwork,
  shared: noNetwork,
};

export const api = OFFLINE ? offline : online;
