'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  ChevronRight,
  CloudUpload,
  FileDown,
  FilePlus2,
  FileUp,
  LogOut,
  Search,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { PRESETS, circuitStats, type BoardType, type Preset } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { api, CLOUD_AVAILABLE, hasCloudSession, OFFLINE, savingToDevice, type CircuitSummary, type User } from '@/lib/api';
import { exportCircuit, importCircuit } from '@/lib/projectFile';
import { useSession } from '@/store/useSession';
import { BOARDS, boardOf } from '@/lib/boards';
import { BrandMark } from './BrandMark';
import { ConfirmDialog } from './ConfirmDialog';

/** A rough read of a new password, for the four-bar meter under it. 8 is the API's floor. */
const strength = (pw: string): number =>
  pw.length < 8
    ? pw.length > 0
      ? 1
      : 0
    : 2 + Number(pw.length >= 12) + Number(/[^a-zA-Z]/.test(pw) && /[a-z]/i.test(pw)) - Number(pw.length < 10 && !/\d/.test(pw));
const STRENGTH_NOTE = ['At least 8 characters.', 'Too short: at least 8 characters.', 'Fair.', 'Good.', 'Strong.'];

/** The six boxes of a reset code; typing moves along, pasting fills them all. */
function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, digits: string) => {
    const next = (value.slice(0, i) + digits + value.slice(i + digits.length)).replace(/\D/g, '').slice(0, 6);
    onChange(next);
    boxes.current[Math.min(i + digits.length, 5)]?.focus();
  };
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-semibold text-carbon-800">Code</legend>
      <div className="grid grid-cols-6 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            aria-label={'Digit ' + (i + 1)}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            value={value[i] ?? ''}
            onChange={(e) => set(i, e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !value[i] && i > 0) {
                onChange(value.slice(0, i - 1));
                boxes.current[i - 1]?.focus();
              }
            }}
            className="h-[54px] min-w-0 rounded-[10px] border border-steel-400 bg-steel-100 text-center font-mono text-[22px] font-bold text-carbon-900 outline-none focus:border-2 focus:border-signal-amber"
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Sign in, register, and the two steps of a password reset, as one card. It
 * sits in the library where saving first asks for an account.
 */
function AuthForm({ onDone, onSkip }: { onDone: (u: User) => void; onSkip?: () => void }) {
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
      if (mode === 'reset' && form.code.length !== 6) throw new Error('The code is six digits.');
      const { user } =
        mode === 'login' ? await api.login(form) : mode === 'register' ? await api.register(form) : await api.reset(form);
      onDone(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fieldBox = (bad?: boolean) =>
    'flex h-[46px] items-center rounded-[10px] border bg-steel-100 px-3.5 focus-within:border-signal-amber focus-within:shadow-[0_0_0_3px_rgb(245_165_36/0.18)] ' +
    (bad ? 'border-safety-red' : 'border-steel-400');
  const input = 'min-w-0 flex-1 bg-transparent text-[15px] text-carbon-900 outline-none placeholder:text-steel-500';
  const label = 'flex flex-col gap-1.5 text-[13px] font-semibold text-carbon-800';
  const textLink = 'font-semibold text-signal-amber hover:brightness-110';

  const head = {
    login: ['Sign in', 'Welcome back', 'Sign in to keep your circuits between sessions.'],
    register: ['Create account', 'Make your bench yours', 'Your saved circuits follow you to any device you sign in on, the phone app included.'],
    forgot: ['Forgot password', 'Reset your password', 'Enter the email you registered with and we will send you a code to set a new password.'],
    reset: ['Set new password', 'Check your email', ''],
  }[mode];
  const action = { login: 'Sign in', register: 'Create account', forgot: 'Send code', reset: 'Set new password' }[mode];
  const score = strength(form.password);

  return (
    <section className="grid w-full shrink-0 overflow-hidden rounded-2xl border border-steel-400 bg-steel-50 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      {/* What an account is for, beside the form on a wide panel. */}
      <aside className="hidden flex-col gap-5 border-r border-steel-300 bg-[radial-gradient(ellipse_90%_70%_at_30%_0%,var(--bench-light),transparent_70%)] bg-steel-100 p-8 md:flex">
        <BrandMark className="h-11 w-11" />
        <div>
          <span className="font-cond text-xs font-bold tracking-[0.12em] text-signal-amber uppercase">Your circuits</span>
          <h3 className="mt-1.5 text-2xl leading-tight font-extrabold text-carbon-900">Keep every bench you wire</h3>
        </div>
        <ul className="flex flex-col gap-3 text-sm leading-snug text-carbon-800">
          {[
            'Saved to your account, under the names you give them.',
            'Opens on any device you sign in on, the Android app included.',
            'Share a read-only link with a classmate or your instructor.',
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-ink" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-auto text-xs leading-relaxed text-carbon-600">
          No account needed to practice: examples and circuit files work without one.
        </p>
      </aside>

      <div className="min-w-0">
      <div className="flex flex-col gap-1.5 px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono text-[11px] uppercase text-steel-500">{head[0]}</span>
        <BrandMark className="mt-1 h-9 w-9 md:hidden" />
        <h2 className="mt-2.5 text-2xl font-bold text-carbon-900">{head[1]}</h2>
        <p className="text-sm leading-normal text-carbon-600">
          {mode === 'reset' ? (
            <>
              We sent a 6-digit code to <b className="text-carbon-900">{form.email}</b>. Enter it and choose a new password.
            </>
          ) : (
            head[2]
          )}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3.5 px-6 pt-5 pb-6 sm:px-8 sm:pb-8">
        {notice && (
          <p className="rounded-[10px] border border-run-green/40 bg-run-green/10 px-3 py-2.5 text-[13px] text-green-ink">{notice}</p>
        )}
        {mode === 'register' && (
          <label className={label}>
            Name
            <span className={fieldBox()}>
              <input
                className={input}
                autoComplete="name"
                placeholder="Juan dela Cruz"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </span>
          </label>
        )}
        {mode !== 'reset' && (
          <label className={label}>
            Email
            <span className={fieldBox()}>
              <input
                className={input}
                type="email"
                autoComplete="email"
                placeholder="you@ncst.edu.ph"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </span>
          </label>
        )}
        {mode === 'reset' && <CodeBoxes value={form.code} onChange={(code) => setForm({ ...form, code })} />}
        {mode !== 'forgot' && (
          <label className={label}>
            <span className="flex justify-between">
              <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
              {mode === 'login' && (
                <button type="button" onClick={() => go('forgot')} className="font-medium text-signal-amber hover:brightness-110">
                  Forgot password?
                </button>
              )}
            </span>
            <span className={fieldBox(mode === 'login' && !!error)}>
              <input
                className={input}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={mode === 'login' && !!error}
                aria-describedby={error ? 'auth-err' : undefined}
                required
                minLength={mode === 'login' ? 1 : 8}
              />
            </span>
          </label>
        )}
        {(mode === 'register' || mode === 'reset') && (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={'h-1 rounded-full ' + (n <= score ? (score < 2 ? 'bg-safety-red' : 'bg-signal-amber') : 'bg-steel-300')} />
              ))}
            </div>
            <span className="text-xs text-carbon-600">{STRENGTH_NOTE[Math.min(score, 4)]}</span>
          </div>
        )}
        {error && (
          <p
            id="auth-err"
            role="alert"
            className="flex items-start gap-2 rounded-[10px] border border-safety-red/40 bg-safety-red/10 px-3 py-2.5 text-[13px] text-red-ink"
          >
            <CircleAlert className="mt-px h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-[11px] bg-signal-amber text-[15px] font-bold text-[#1a1204] transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'One moment…' : action}
        </button>

        {mode === 'login' && onSkip && (
          <>
            <div className="flex items-center gap-2.5 text-xs text-steel-500">
              <span className="h-px flex-1 bg-steel-300" />
              or
              <span className="h-px flex-1 bg-steel-300" />
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="h-[46px] rounded-[11px] border border-steel-400 text-sm font-semibold text-carbon-900 transition hover:bg-steel-200"
            >
              Keep practicing without an account
            </button>
          </>
        )}

        {mode === 'forgot' || mode === 'reset' ? (
          mode === 'reset' ? (
            <p className="text-center text-[13px] text-carbon-600">
              No email? Check spam, or{' '}
              <button type="button" onClick={() => go('forgot')} className={textLink}>
                send the code again
              </button>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => go('login')}
              className="flex h-11 items-center justify-center gap-2 rounded-[11px] text-sm text-carbon-800 hover:bg-steel-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          )
        ) : (
          <p className="mt-1 text-center text-sm text-carbon-600">
            {mode === 'login' ? 'No account yet? ' : 'Already registered? '}
            <button type="button" onClick={() => go(mode === 'login' ? 'register' : 'login')} className={textLink}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        )}
      </form>
      </div>
    </section>
  );
}

/** "Edited 3 h ago", the way a recent list reads. */
const ago = (iso: string): string => {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, n] of [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ] as const) {
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  }
  return 'just now';
};

/** The tag a card wears for the bench it was built on. */
const BOARD_TAG: Record<BoardType, { text: string; className: string }> = {
  simple: { text: 'RELAYS', className: 'bg-signal-amber/12 text-amber-ink' },
  pneumatics: { text: 'PLC BENCH', className: 'bg-signal-blue/15 text-signal-blue' },
  trainer: { text: 'ALL BOARDS', className: 'bg-steel-200 text-carbon-800' },
};

const cardClass = 'rounded-xl border border-steel-400 bg-steel-100 transition hover:border-carbon-600';
const sectionHead = 'font-cond text-xs font-bold uppercase tracking-[0.12em] text-carbon-600';

/**
 * Starts a fresh, unsaved board. It sits at the head of the panel because this
 * is where people come looking for "another circuit", saved or not.
 */
function NewProject({ onStarted }: { onStarted: () => void }) {
  const newProject = useBoard((s) => s.newProject);
  const setHint = useBoard((s) => s.setHint);
  const wireCount = useBoard((s) => s.circuit.wires.length);
  const [confirming, setConfirming] = useState<BoardType | null>(null);

  const start = (type: BoardType) => {
    newProject(type);
    setHint(boardOf(type).name + ' started. Save it to keep it under its own name.');
    setConfirming(null);
    onStarted();
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-signal-amber/50 bg-signal-amber/8 p-4">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-signal-amber text-[#1a1204]">
            <FilePlus2 className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-carbon-900">Add new project</span>
            <span className="mt-0.5 block text-[13px] text-carbon-800">
              A clean bench, saved separately from the circuit you have open.
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              title={b.blurb}
              onClick={() => (wireCount > 0 ? setConfirming(b.id) : start(b.id))}
              className="h-8 rounded-lg border border-signal-amber/40 bg-steel-50 px-3 text-xs font-semibold text-carbon-900 transition hover:border-signal-amber hover:bg-signal-amber/15"
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={'Start a new ' + boardOf(confirming).name + ' project?'}
          message={
            'This clears ' +
            (wireCount === 1 ? 'the lead you have run' : 'all ' + wireCount + ' leads you have run') +
            ' and puts the standard bench parts back.'
          }
          detail="Save the board first if you want to keep it."
          confirmLabel="Start new project"
          onConfirm={() => start(confirming)}
          onCancel={() => setConfirming(null)}
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
    <label className={'group flex cursor-pointer items-center gap-3.5 p-4 text-left ' + cardClass}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-steel-200 text-carbon-800 group-hover:text-signal-amber">
        <FileUp className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-carbon-900">Open a circuit file</span>
        <span className="mt-0.5 block text-[13px] text-carbon-600">
          A .mech.json file someone sent you, or one you saved yourself.
        </span>
        {error && <span className="mt-1 block text-xs text-red-ink">{error}</span>}
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
  );
}

/** A small, schematic picture of a bench for a card: panels across the top, the work below. */
function Mini({ board, lit }: { board: BoardType; lit: boolean }) {
  const panel = 'absolute rounded-md border border-steel-400 bg-steel-200';
  return (
    <div className="relative h-[120px] overflow-hidden bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,var(--bench-light),transparent_70%)] bg-[var(--bench-base)]">
      <span className={panel} style={{ left: 18, top: 18, width: 60, height: 44 }} />
      <span className={panel} style={{ left: 92, top: 18, width: 110, height: 44 }} />
      {board === 'pneumatics' ? (
        <>
          <span className={panel} style={{ left: 18, top: 76, width: 120, height: 28 }} />
          <span className="absolute rounded-full border border-steel-400 bg-steel-200" style={{ left: 150, top: 78, width: 90, height: 24 }} />
        </>
      ) : (
        [0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: 100 + i * 36,
              top: 76,
              width: 26,
              height: 26,
              background: lit && i === 0 ? '#ffc94a' : 'var(--color-steel-400)',
              boxShadow: lit && i === 0 ? '0 0 14px 4px rgba(255,180,60,0.45)' : undefined,
            }}
          />
        ))
      )}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M60 40 C 80 90, 100 90, 113 89" fill="none" stroke="#e5484d" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M180 40 C 200 80, 160 100, 149 89" fill="none" stroke="#3b82f6" strokeWidth={2.4} strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** One saved circuit, as a card: picture, name, what is in it, when it was touched. */
function CircuitCard({
  c,
  current,
  onOpen,
  onSend,
  sending,
  onDelete,
}: {
  c: CircuitSummary;
  current: boolean;
  onOpen: () => void;
  onSend: () => void;
  sending: boolean;
  onDelete: () => void;
}) {
  const board = c.board ?? 'trainer';
  return (
    <article
      className={
        'group relative flex flex-col overflow-hidden rounded-xl border bg-steel-100 transition ' +
        (current ? 'border-signal-amber' : 'border-steel-400 hover:border-carbon-600')
      }
    >
      <button type="button" onClick={onOpen} className="text-left" aria-label={'Open ' + c.name}>
        <Mini board={board} lit={current} />
        <div className="flex flex-col gap-1.5 px-3.5 py-3">
          <h3 className="truncate pr-14 text-[15px] font-semibold text-carbon-900">{c.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-carbon-600">
            <span className={'rounded-[5px] px-1.5 py-0.5 ' + BOARD_TAG[board].className}>{BOARD_TAG[board].text}</span>
            {!!c.rungs && <span className="rounded-[5px] bg-run-green/12 px-1.5 py-0.5 text-green-ink">PLC · {c.rungs} rungs</span>}
            {c.parts !== undefined && (
              <span>
                {c.parts} parts · {c.leads} leads
              </span>
            )}
          </div>
          <span className="text-xs text-carbon-600">Edited {ago(c.updatedAt)}</span>
        </div>
      </button>
      {current && (
        <span className="absolute right-2.5 top-2.5 rounded-md bg-signal-amber px-2 py-0.5 text-[11px] font-bold text-[#1a1204]">OPEN NOW</span>
      )}
      <div className="absolute bottom-2.5 right-2.5 flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          disabled={sending}
          onClick={onSend}
          className="grid h-8 w-8 place-items-center rounded-lg text-carbon-600 hover:bg-steel-200 hover:text-carbon-900 disabled:opacity-50"
          aria-label={'Send ' + c.name + ' as a file'}
          title="Send as a file"
        >
          <FileDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-lg text-carbon-600 hover:bg-steel-200 hover:text-red-ink"
          aria-label={'Delete ' + c.name}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

/** What kind of circuit an example is, for its tag. */
const presetTag = (p: Preset): { text: string; className: string } =>
  p.board === 'pneumatics'
    ? { text: 'PNEUMATIC', className: 'text-signal-blue' }
    : circuitStats(p.build()).rungs > 0
      ? { text: 'PLC', className: 'text-green-ink' }
      : { text: 'RELAYS', className: 'text-amber-ink' };

/**
 * The worked circuits that ship with the bench. They need no account: a preset
 * is built locally and dropped straight onto the board, parts and all. `compact`
 * is the strip under Recent; the Examples tab shows each one with its steps.
 */
function Presets({ onLoaded, compact, query = '' }: { onLoaded: () => void; compact?: boolean; query?: string }) {
  const loadCircuit = useBoard((s) => s.loadCircuit);
  const setHint = useBoard((s) => s.setHint);
  const wireCount = useBoard((s) => s.circuit.wires.length);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Held while we ask before throwing away a board that has leads on it. */
  const [replacing, setReplacing] = useState<Preset | null>(null);
  const tags = useMemo(() => Object.fromEntries(PRESETS.map((p) => [p.id, presetTag(p)])), []);

  const load = (p: Preset) => {
    // A preset brings its own parts, so it replaces the board outright.
    loadCircuit(p.build(), null);
    setHint(
      'Loaded "' +
        p.name +
        '"' +
        (p.board && p.board !== 'trainer' ? ' on the ' + boardOf(p.board).name : '') +
        '. Close the breaker to run it.',
    );
    setReplacing(null);
    onLoaded();
  };
  const ask = (p: Preset) => (wireCount > 0 ? setReplacing(p) : load(p));

  const q = query.trim().toLowerCase();
  const shown = PRESETS.filter((p) => !q || (p.name + ' ' + p.summary).toLowerCase().includes(q));

  return (
    <>
      {compact ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => ask(p)}
              className={'flex flex-col gap-1.5 p-3.5 text-left ' + cardClass}
            >
              <span className={'font-mono text-[11px] ' + tags[p.id].className}>{tags[p.id].text}</span>
              <span className="text-sm font-semibold text-carbon-900">{p.name}</span>
              <span className="line-clamp-2 text-xs leading-snug text-carbon-600">{p.summary}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
          {shown.map((p) => {
            const open = openId === p.id;
            return (
              <article key={p.id} className={'flex flex-col gap-2 p-4 ' + cardClass}>
                <span className={'font-mono text-[11px] ' + tags[p.id].className}>{tags[p.id].text}</span>
                <h3 className="text-[15px] font-semibold text-carbon-900">{p.name}</h3>
                <p className="text-[13px] leading-snug text-carbon-600">{p.summary}</p>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : p.id)}
                  aria-expanded={open}
                  className="inline-flex items-center gap-1 self-start text-xs font-semibold text-carbon-600 hover:text-carbon-900"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  How it runs <span className="font-mono">({p.steps.length})</span>
                </button>
                {open && (
                  <ol className="list-decimal space-y-1 rounded-lg bg-well py-2 pl-7 pr-3 text-xs leading-relaxed text-carbon-800">
                    {p.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                )}
                <div className="mt-auto flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => ask(p)}
                    className="h-[34px] rounded-[9px] bg-signal-amber px-4 text-[13px] font-bold text-[#1a1204] transition hover:brightness-110"
                  >
                    Load example
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
  const [tab, setTab] = useState<'saved' | 'presets'>('saved');
  const [query, setQuery] = useState('');
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = async (id: string) => {
    const { circuit, name } = await api.getCircuit(id);
    // Pass the id too, so Save updates it and Share can link to it.
    loadCircuit(circuit, id);
    setHint('Loaded "' + name + '".');
    onClose();
  };

  const send = async (c: CircuitSummary) => {
    setSending(c.id);
    try {
      const { circuit, name } = await api.getCircuit(c.id);
      await exportCircuit(name, circuit);
    } catch {
      // A cancelled share sheet is not a failure worth shouting about.
    } finally {
      setSending(null);
    }
  };

  const q = query.trim().toLowerCase();
  const recent = circuits.filter((c) => !q || c.name.toLowerCase().includes(q));
  const showAuth = !error && status === 'ready' && (!user || signingIn);

  const tabClass = (active: boolean) =>
    'border-b-2 py-2.5 text-sm transition ' +
    (active ? 'border-signal-amber font-semibold text-carbon-900' : 'border-transparent text-carbon-600 hover:text-carbon-900');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06090d]/60 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lib-title"
        className="flex h-[min(860px,92dvh)] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl border border-steel-400 bg-steel-50 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:gap-4 sm:px-5">
          <h2 id="lib-title" className="font-cond text-base font-bold tracking-[0.12em] text-carbon-900">
            CIRCUIT LIBRARY
          </h2>
          {user && !onDevice && (
            <span className="inline-flex h-7 items-center gap-2 rounded-full border border-steel-300 bg-steel-100 pl-1 pr-2.5 text-xs text-carbon-800">
              <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-signal-blue text-[10px] font-bold text-white">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate">{user.name}</span>
            </span>
          )}
          {onDevice && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-steel-300 bg-steel-100 px-2.5 text-xs text-carbon-800">
              <Smartphone className="h-3.5 w-3.5" />
              On this device
            </span>
          )}
          <div className="flex-1" />
          <label className="flex h-[38px] flex-[0_1_300px] items-center gap-2.5 rounded-[10px] border border-steel-400 bg-steel-100 px-3 focus-within:border-signal-amber">
            <Search className="h-4 w-4 shrink-0 text-carbon-600" />
            <span className="sr-only">Search circuits</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'saved' ? 'Search circuits' : 'Search examples'}
              className="min-w-0 flex-1 bg-transparent text-sm text-carbon-900 outline-none placeholder:text-steel-500"
            />
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library"
            className="grid h-[38px] w-[38px] place-items-center rounded-[10px] text-carbon-600 transition hover:bg-steel-200 hover:text-carbon-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div role="tablist" className="mt-3.5 flex gap-6 border-b border-steel-300 px-4 sm:px-5">
          <button type="button" role="tab" aria-selected={tab === 'saved'} onClick={() => setTab('saved')} className={tabClass(tab === 'saved')}>
            My circuits {user && <span className="font-mono text-xs text-carbon-600">{circuits.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'presets'}
            onClick={() => setTab('presets')}
            className={tabClass(tab === 'presets')}
          >
            Examples <span className="font-mono text-xs text-carbon-600">{PRESETS.length}</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-5">
          {tab === 'presets' && <Presets onLoaded={onClose} query={query} />}

          {tab === 'saved' && (
            <>
              {/* Start something */}
              <div className="grid gap-3 md:grid-cols-2">
                <NewProject onStarted={onClose} />
                <OpenFile onOpened={onClose} />
              </div>

              {error && <p className="text-sm text-red-ink">{error}</p>}

              {!error && status === 'unknown' && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5" aria-busy>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[200px] animate-pulse rounded-xl bg-steel-200" />
                  ))}
                </div>
              )}

              {showAuth && (
                <AuthForm
                  onSkip={signingIn ? () => setSigningIn(false) : onClose}
                  onDone={(u) => {
                    setUser(u);
                    setSigningIn(false);
                    void refresh();
                  }}
                />
              )}

              {/* The app's own circuits, and the offer to put them somewhere they survive a lost phone. */}
              {onDevice && !signingIn && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-steel-300 bg-steel-100 p-4">
                  <Smartphone className="h-5 w-5 shrink-0 text-carbon-600" />
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-carbon-600">
                    <b className="text-carbon-900">Saved on this device.</b> They stay here, with no account and no network
                    needed.
                    {CLOUD_AVAILABLE
                      ? ' Sign in and new saves go to your account instead, where any device you sign in on can open them.'
                      : ' Send one as a file to move it to another device.'}
                  </p>
                  {CLOUD_AVAILABLE && (
                    <button
                      type="button"
                      onClick={() => setSigningIn(true)}
                      className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-steel-400 bg-steel-50 px-3 text-[13px] font-semibold text-carbon-900 hover:bg-steel-200"
                    >
                      <CloudUpload className="h-4 w-4" />
                      Sign in or sign up
                    </button>
                  )}
                </div>
              )}

              {user && (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className={sectionHead}>Recent</h3>
                    <span className="text-xs text-carbon-600">Sorted by last edited</span>
                  </div>
                  {recent.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-steel-400 px-4 py-8 text-center text-sm text-carbon-600">
                      {q ? 'No saved circuit matches that.' : 'Nothing saved yet. Wire something up and hit Save.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
                      {recent.map((c) => (
                        <CircuitCard
                          key={c.id}
                          c={c}
                          current={c.id === savedId}
                          onOpen={() => void open(c.id)}
                          onSend={() => void send(c)}
                          sending={sending === c.id}
                          onDelete={() => setDeleting(c)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className={sectionHead}>Start from an example</h3>
                  <button type="button" onClick={() => setTab('presets')} className="text-[13px] font-semibold text-signal-amber hover:brightness-110">
                    See all {PRESETS.length}
                  </button>
                </div>
                <Presets onLoaded={onClose} compact />
              </section>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-steel-300 bg-steel-100 px-4 py-3 text-[13px] text-carbon-600 sm:px-5">
          <span>Opening a circuit replaces the bench. Save first if you want to keep what is on it.</span>
          <div className="flex-1" />
          {user && !onDevice && (
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setCircuits([]);
                void refresh();
              }}
              className="inline-flex items-center gap-1.5 hover:text-carbon-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          )}
          <span className="hidden sm:inline">Esc to close</span>
        </footer>

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
