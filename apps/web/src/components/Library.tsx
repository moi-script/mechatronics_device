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

  const field = 'w-full rounded-sm border border-steel-400 bg-steel-100 px-3 py-2 text-sm text-carbon-900 outline-none focus:border-signal-amber';

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-carbon-600">Sign in to keep your circuits between sessions.</p>
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
      {error && <p className="text-xs text-safety-red">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-sm border border-run-green/40 bg-run-green/10 py-2 text-sm font-semibold text-run-green hover:bg-run-green/20 disabled:opacity-50"
      >
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="w-full text-xs text-carbon-600 hover:text-carbon-900"
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
    // Pass the id too, so Save updates it and Share can link to it.
    loadCircuit(circuit, id);
    setHint('Loaded "' + name + '".');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-900/45 p-4 sm:p-6" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg border border-steel-400 bg-steel-50 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-carbon-900">Circuit library</h2>
          <button type="button" onClick={onClose} className="text-carbon-600 hover:text-carbon-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="text-xs text-safety-red">{error}</p>}

        {!error && !user && <AuthForm onDone={(u) => { setUser(u); void refresh(); }} />}

        {user && (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-carbon-600">
              <span>Signed in as {user.name}</span>
              <button
                type="button"
                onClick={async () => {
                  await api.logout();
                  setUser(null);
                  setCircuits([]);
                }}
                className="inline-flex items-center gap-1 text-carbon-600 hover:text-carbon-900"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
            {circuits.length === 0 ? (
              <p className="text-xs text-carbon-600">Nothing saved yet. Wire something up and hit Save.</p>
            ) : (
              <ul className="max-h-[50dvh] space-y-1.5 overflow-y-auto">
                {circuits.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-sm border border-steel-300 bg-steel-100 px-3 py-2">
                    <button type="button" onClick={() => open(c.id)} className="flex-1 text-left">
                      <div className="text-xs font-semibold text-carbon-900">{c.name}</div>
                      <div className="text-[10px] text-carbon-600">{new Date(c.updatedAt).toLocaleString()}</div>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.deleteCircuit(c.id);
                        void refresh();
                      }}
                      className="text-carbon-600 hover:text-safety-red"
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
