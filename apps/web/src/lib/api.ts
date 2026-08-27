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

export interface Exercise {
  id: string;
  title: string;
  brief: string;
}

export interface GradeResponse {
  passed: boolean;
  results: { label: string; ok: boolean; detail: string }[];
}

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

export const api = {
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

  listExercises: () => req<{ exercises: Exercise[] }>('/exercises'),
  grade: (id: string, circuit: Circuit) => req<GradeResponse>('/exercises/' + id + '/grade', post({ circuit })),
};
