'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogOut, Trash2, X } from 'lucide-react';
import { useBoard } from '@/store/useBoard';
import { api, type CircuitSummary, type User } from '@/lib/api';

function AuthForm({ onDone }: { onDone: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = mode === 'login' ? await api.login(form) : await api.register(form);
      onDone(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg bg-black/40 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-amber-400/60';

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-slate-400">Sign in to keep your circuits between sessions.</p>
      {mode === 'register' && (
        <input
          className={field}
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      )}
      <input
        className={field}
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        className={field}
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
        minLength={6}
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-emerald-500/20 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="w-full text-xs text-slate-500 hover:text-slate-300"
      >
        {mode === 'login' ? 'No account yet? Register' : 'Already registered? Sign in'}
      </button>
    </form>
  );
}

export function Library({ onClose }: { onClose: () => void }) {
  const loadCircuit = useBoard((s) => s.loadCircuit);
  const setHint = useBoard((s) => s.setHint);
  const [user, setUser] = useState<User | null>(null);
  const [circuits, setCircuits] = useState<CircuitSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { circuits } = await api.listCircuits();
      setCircuits(circuits);
    } catch {
      setCircuits([]);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        setUser(user);
        if (user) void refresh();
      })
      .catch(() => setError('The API is not reachable. Start it with npm run dev:api.'));
  }, [refresh]);

  const open = async (id: string) => {
    const { circuit, name } = await api.getCircuit(id);
    loadCircuit(circuit);
    setHint('Loaded "' + name + '".');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-bench-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-slate-100">Circuit library</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="text-xs text-red-300">{error}</p>}

        {!error && !user && <AuthForm onDone={(u) => { setUser(u); void refresh(); }} />}

        {user && (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>Signed in as {user.name}</span>
              <button
                type="button"
                onClick={async () => {
                  await api.logout();
                  setUser(null);
                  setCircuits([]);
                }}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-200"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
            {circuits.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing saved yet. Wire something up and hit Save.</p>
            ) : (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {circuits.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                    <button type="button" onClick={() => open(c.id)} className="flex-1 text-left">
                      <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{new Date(c.updatedAt).toLocaleString()}</div>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.deleteCircuit(c.id);
                        void refresh();
                      }}
                      className="text-slate-600 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
