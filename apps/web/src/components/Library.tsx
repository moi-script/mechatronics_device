'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CloudUpload,
  FileDown,
  FilePlus2,
  FileUp,
  FolderOpen,
  LogOut,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { PRESETS, type BoardType, type Preset } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { api, CLOUD_AVAILABLE, hasCloudSession, OFFLINE, savingToDevice, type CircuitSummary, type User } from '@/lib/api';
import { exportCircuit, importCircuit } from '@/lib/projectFile';
import { useSession } from '@/store/useSession';
import { ConfirmDialog } from './ConfirmDialog';

function AuthForm({ onDone }: { onDone: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', code: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: typeof mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'forgot') {
        await api.forgot({ email: form.email });
        setForm({ ...form, code: '', password: '' });
        setMode('reset');
        setNotice('If that email is registered, a six-digit code is on its way. Check spam too.');
        return;
      }
      const { user } =
        mode === 'login'
          ? await api.login(form)
          : mode === 'register'
            ? await api.register(form)
            : await api.reset(form);
      onDone(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-sm border border-steel-400 bg-steel-100 px-3 py-2 text-sm text-carbon-900 outline-none focus:border-signal-amber';
  const link = 'w-full text-xs text-carbon-600 hover:text-carbon-900';

  const intro = {
    login: 'Sign in to keep your circuits between sessions.',
    register: 'Sign in to keep your circuits between sessions.',
    forgot: 'Enter the email you registered with and we will send you a code to set a new password.',
    reset: 'Enter the code from the email and choose a new password.',
  }[mode];

  const action = { login: 'Sign in', register: 'Create account', forgot: 'Send code', reset: 'Set new password' }[mode];

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-carbon-600">{intro}</p>
      {notice && <p className="text-xs text-run-green">{notice}</p>}
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
        readOnly={mode === 'reset'}
        required
      />
      {mode === 'reset' && (
        <input
          className={field}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Six-digit code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          required
          pattern="\d{6}"
        />
      )}
      {mode !== 'forgot' && (
        <input
          className={field}
          type="password"
          placeholder={mode === 'reset' ? 'New password' : 'Password'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={mode === 'login' ? 1 : 8}
        />
      )}
      {error && <p className="text-xs text-safety-red">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-sm border border-run-green/40 bg-run-green/10 py-2 text-sm font-semibold text-run-green hover:bg-run-green/20 disabled:opacity-50"
      >
        {action}
      </button>
      {mode === 'login' && (
        <button type="button" onClick={() => go('forgot')} className={link}>
          Forgot password?
        </button>
      )}
      {mode === 'reset' && (
        <button type="button" onClick={() => go('forgot')} className={link}>
          Didn&apos;t get it? Send another code
        </button>
      )}
      <button type="button" onClick={() => go(mode === 'login' ? 'register' : 'login')} className={link}>
        {mode === 'login' ? 'No account yet? Register' : mode === 'register' ? 'Already registered? Sign in' : 'Back to sign in'}
      </button>
    </form>
  );
}

/**
 * Starts a fresh, unsaved board. It sits at the head of the panel because this
 * is where people come looking for "another circuit", saved or not.
 */
/** The benches a project can start on, in the order they are offered. */
const BOARDS: { id: BoardType; name: string; blurb: string }[] = [
  {
    id: 'trainer',
    name: 'Trainer bench',
    blurb: 'The full panel: supply, buttons, lamps, relays, timers and the Festech units.',
  },
  {
    id: 'pneumatics',
    name: 'Pneumatics board',
    blurb: 'One cylinder to a row, with a limit switch bolted at each end of its stroke.',
  },
];

function NewProject({ onStarted }: { onStarted: () => void }) {
  const newProject = useBoard((s) => s.newProject);
  const setHint = useBoard((s) => s.setHint);
  const wireCount = useBoard((s) => s.circuit.wires.length);
  const [confirming, setConfirming] = useState(false);

  const [board, setBoard] = useState<BoardType>('trainer');

  const start = (type: BoardType = board) => {
    newProject(type);
    const bench = BOARDS.find((b) => b.id === type)!;
    setHint(bench.name + ' started. Save it to keep it under its own name.');
    setConfirming(false);
    onStarted();
  };

  return (
    <>
      <div className="rounded-md border border-dashed border-steel-400 bg-steel-100 p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-steel-400 bg-steel-50 text-carbon-800">
            <FilePlus2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-carbon-900">Add new project</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-600">
              A clean bench, saved separately from the circuit you have open.
            </p>
          </div>
        </div>
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBoard(b.id);
                if (wireCount > 0) setConfirming(true);
                else start(b.id);
              }}
              className="rounded-sm border border-steel-400 bg-steel-50 px-2.5 py-2 text-left transition hover:border-signal-amber hover:bg-steel-200"
            >
              <span className="block text-[11px] font-semibold text-carbon-900">{b.name}</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-carbon-600">{b.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Start a new project?"
          message={
            'This clears ' +
            (wireCount === 1 ? 'the lead you have run' : 'all ' + wireCount + ' leads you have run') +
            ' and puts the standard bench parts back.'
          }
          detail="Save the board first if you want to keep it."
          confirmLabel="Start new project"
          onConfirm={() => start()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

/**
 * Opening a circuit that arrived as a file: from a classmate over chat, from
 * your own storage, from the laptop you built it on. The picker is the
 * device's own, so wherever the file landed is where it can be found.
 */
function OpenFile({ onOpened }: { onOpened: () => void }) {
  const loadCircuit = useBoard((s) => s.loadCircuit);
  const setHint = useBoard((s) => s.setHint);
  const [error, setError] = useState<string | null>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const { name, circuit } = await importCircuit(file);
      // No id: it belongs to whoever opened it, and Save makes it theirs.
      loadCircuit(circuit, null);
      setHint('Opened "' + name + '" from a file. Save it to keep it.');
      onOpened();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <label className="group flex w-full cursor-pointer items-center gap-3 rounded-md border border-dashed border-steel-400 bg-steel-100 px-3 py-3 text-left transition hover:border-signal-amber hover:bg-steel-200">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-steel-400 bg-steel-50 text-carbon-800 group-hover:text-signal-amber">
          <FileUp className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-carbon-900">Open a circuit file</span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-carbon-600">
            A .mech.json file someone sent you, or one you saved yourself.
          </span>
        </span>
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {error && <p className="mt-1.5 text-[10px] text-safety-red">{error}</p>}
    </>
  );
}

/**
 * The worked circuits that ship with the bench. They need no account: a preset
 * is built locally and dropped straight onto the board, parts and all.
 */
function Presets({ onLoaded }: { onLoaded: () => void }) {
  const loadCircuit = useBoard((s) => s.loadCircuit);
  const setHint = useBoard((s) => s.setHint);
  const wireCount = useBoard((s) => s.circuit.wires.length);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Held while we ask before throwing away a board that has leads on it. */
  const [replacing, setReplacing] = useState<Preset | null>(null);

  const load = (p: Preset) => {
    // A preset brings its own parts, so it replaces the board outright.
    loadCircuit(p.build(), null);
    setHint(
      'Loaded "' +
        p.name +
        '"' +
        (p.board === 'pneumatics' ? ' on the pneumatics board' : '') +
        '. Close the breaker to run it.',
    );
    setReplacing(null);
    onLoaded();
  };

  return (
    <>
      <ul className="space-y-2">
        {PRESETS.map((p) => {
          const open = openId === p.id;
          return (
            <li key={p.id} className="overflow-hidden rounded-md border border-steel-300 bg-steel-100">
              <div className="flex items-start gap-3 px-3 py-2.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-steel-400 bg-steel-50 text-signal-amber">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-carbon-900">{p.name}</span>
                    {p.board === 'pneumatics' && (
                      <span className="shrink-0 rounded-sm bg-signal-blue/15 px-1.5 py-0.5 text-[9px] font-semibold text-signal-blue">
                        PNEUMATICS BOARD
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-600">{p.summary}</p>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : p.id)}
                    aria-expanded={open}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-carbon-600 hover:text-carbon-900"
                  >
                    {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    How it runs
                    <span className="font-mono text-carbon-600">({p.steps.length})</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => (wireCount > 0 ? setReplacing(p) : load(p))}
                  className="shrink-0 rounded-sm border border-run-green/40 bg-run-green/10 px-2.5 py-1.5 text-[11px] font-semibold text-run-green hover:bg-run-green/20"
                >
                  Load
                </button>
              </div>
              {open && (
                <ol className="list-decimal space-y-1 border-t border-steel-300 bg-steel-50 py-2 pl-8 pr-3 text-[10px] leading-relaxed text-carbon-600">
                  {p.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      {replacing && (
        <ConfirmDialog
          title={'Load "' + replacing.name + '"?'}
          message={
            'This replaces what is on the board, including ' +
            (wireCount === 1 ? 'the lead you have run' : 'all ' + wireCount + ' leads you have run') +
            ', and puts down the parts the preset needs.'
          }
          detail="Save the board first if you want to keep it."
          confirmLabel="Load the preset"
          onConfirm={() => load(replacing)}
          onCancel={() => setReplacing(null)}
        />
      )}
    </>
  );
}

export function Library({ onClose }: { onClose: () => void }) {
  const loadCircuit = useBoard((s) => s.loadCircuit);
  const setHint = useBoard((s) => s.setHint);
  const savedId = useBoard((s) => s.savedCircuitId);

  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const error = useSession((s) => s.error);
  const setUser = useSession((s) => s.setUser);
  const signOut = useSession((s) => s.signOut);
  const ensureSession = useSession((s) => s.ensure);

  const [circuits, setCircuits] = useState<CircuitSummary[]>([]);
  const [tab, setTab] = useState<'presets' | 'saved'>('presets');
  const [deleting, setDeleting] = useState<CircuitSummary | null>(null);
  /**
   * In the app, circuits go to the device until someone signs in. These two
   * say which of those we are looking at, and whether the sign-in form has
   * been asked for.
   */
  const [onDevice, setOnDevice] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setOnDevice(savingToDevice());
    try {
      const { circuits } = await api.listCircuits();
      setCircuits(circuits);
    } catch {
      setCircuits([]);
    }
  }, []);

  useEffect(() => {
    // The session is normally resolved before this ever opens, so ensure()
    // answers from cache and the panel never flashes the sign-in form.
    void ensureSession().then((u) => {
      if (u) void refresh();
    });
  }, [ensureSession, refresh]);

  const open = async (id: string) => {
    const { circuit, name } = await api.getCircuit(id);
    // Pass the id too, so Save updates it and Share can link to it.
    loadCircuit(circuit, id);
    setHint('Loaded "' + name + '".');
    onClose();
  };

  const tabClass = (active: boolean) =>
    'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ' +
    (active
      ? 'border-signal-amber text-carbon-900'
      : 'border-transparent text-carbon-600 hover:text-carbon-900');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-900/45 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-steel-400 bg-steel-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-steel-300 bg-steel-100 px-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="engraved text-xs font-bold text-carbon-900">Circuit library</h2>
            <button type="button" onClick={onClose} className="text-carbon-600 hover:text-carbon-900" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setTab('presets')} className={tabClass(tab === 'presets')}>
              <Sparkles className="h-3.5 w-3.5" />
              Presets
              <span className="font-mono text-[10px] text-carbon-600">{PRESETS.length}</span>
            </button>
            <button type="button" onClick={() => setTab('saved')} className={tabClass(tab === 'saved')}>
              <FolderOpen className="h-3.5 w-3.5" />
              My circuits
              {user && <span className="font-mono text-[10px] text-carbon-600">{circuits.length}</span>}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 space-y-2">
            <NewProject onStarted={onClose} />
            <OpenFile onOpened={onClose} />
          </div>

          {tab === 'presets' && <Presets onLoaded={onClose} />}

          {tab === 'saved' && (
            <>
              {error && <p className="text-xs text-safety-red">{error}</p>}

              {!error && status === 'unknown' && (
                <div className="space-y-2" aria-busy>
                  <div className="h-4 w-40 animate-pulse rounded-sm bg-steel-200" />
                  <div className="h-12 animate-pulse rounded-md bg-steel-200" />
                  <div className="h-12 animate-pulse rounded-md bg-steel-200" />
                </div>
              )}

              {!error && status === 'ready' && (!user || signingIn) && (
                <AuthForm
                  onDone={(u) => {
                    setUser(u);
                    setSigningIn(false);
                    void refresh();
                  }}
                />
              )}

              {/* The app's own circuits, and the offer to put them somewhere
                  they survive a lost phone. */}
              {onDevice && !signingIn && (
                <div className="mb-3 rounded-md border border-steel-300 bg-steel-100 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-carbon-900">
                    <Smartphone className="h-3.5 w-3.5" />
                    Saved on this device
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-carbon-600">
                    They stay here, with no account and no network needed.
                    {CLOUD_AVAILABLE
                      ? ' Sign in and new saves go to your account instead, where any device you sign in on can open them.'
                      : ' Send one as a file to move it to another device.'}
                  </p>
                  {CLOUD_AVAILABLE && (
                    <button
                      type="button"
                      onClick={() => setSigningIn(true)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-steel-400 bg-steel-50 px-2.5 py-1.5 text-[11px] font-semibold text-carbon-900 hover:bg-steel-200"
                    >
                      <CloudUpload className="h-3.5 w-3.5" />
                      Sign in or sign up
                    </button>
                  )}
                </div>
              )}

              {user && circuits.length === 0 && (
                <p className="text-xs text-carbon-600">Nothing saved yet. Wire something up and hit Save.</p>
              )}

              {user && circuits.length > 0 && (
                <ul className="space-y-1.5">
                  {circuits.map((c) => {
                    const current = c.id === savedId;
                    return (
                      <li
                        key={c.id}
                        className={
                          'flex items-center gap-2 rounded-md border px-3 py-2 transition ' +
                          (current
                            ? 'border-signal-amber/60 bg-signal-amber/10'
                            : 'border-steel-300 bg-steel-100 hover:border-carbon-600')
                        }
                      >
                        <button type="button" onClick={() => open(c.id)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-carbon-900">{c.name}</span>
                            {current && (
                              <span className="shrink-0 rounded-sm bg-signal-amber/20 px-1.5 py-0.5 text-[9px] font-semibold text-signal-amber">
                                OPEN
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-carbon-600">
                            <Clock className="h-3 w-3" />
                            {new Date(c.updatedAt).toLocaleString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={sending === c.id}
                          onClick={async () => {
                            setSending(c.id);
                            try {
                              const { circuit, name } = await api.getCircuit(c.id);
                              await exportCircuit(name, circuit);
                            } catch {
                              // A cancelled share sheet is not a failure worth shouting about.
                            } finally {
                              setSending(null);
                            }
                          }}
                          className="text-carbon-600 hover:text-carbon-900 disabled:opacity-50"
                          aria-label={'Send ' + c.name + ' as a file'}
                          title="Send as a file"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          className="text-carbon-600 hover:text-safety-red"
                          aria-label={'Delete ' + c.name}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {user && !onDevice && (
          <footer className="flex items-center justify-between border-t border-steel-300 bg-steel-100 px-4 py-2 text-[11px] text-carbon-600">
            <span className="truncate">Signed in as {user.name}</span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setCircuits([]);
                void refresh();
              }}
              className="inline-flex shrink-0 items-center gap-1 hover:text-carbon-900"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </footer>
        )}

      {deleting && (
          <ConfirmDialog
            title={'Delete "' + deleting.name + '"?'}
            message="The saved copy goes for good, and any share link to it stops working."
            detail="What is on the board right now is untouched."
            confirmLabel="Delete circuit"
            onConfirm={async () => {
              const gone = deleting;
              setDeleting(null);
              await api.deleteCircuit(gone.id);
              if (gone.id === savedId) useBoard.getState().setSavedCircuitId(null);
              void refresh();
            }}
            onCancel={() => setDeleting(null)}
          />
        )}
      </div>
    </div>
  );
}
