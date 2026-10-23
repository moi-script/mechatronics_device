'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';

const STORE = 'mech-class-submit';

/** The last code and answers, so a student's section is already filled in next time. */
const remembered = (): { code: string; info: Record<string, string> } => {
  try {
    return { code: '', info: {}, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') };
  } catch {
    return { code: '', info: {} };
  }
};

const input =
  'h-[46px] w-full rounded-[10px] border border-steel-400 bg-steel-100 px-3.5 text-[15px] text-carbon-900 outline-none focus:border-signal-amber';
const label = 'mb-1.5 block text-[13px] font-semibold text-carbon-800';

/**
 * Handing the board in: the class code first, then the name and whatever the
 * instructor asked every student to fill in, such as their section.
 */
export function SubmitDialog({
  defaultName,
  onSubmit,
  onCancel,
}: {
  defaultName: string;
  onSubmit: (d: { code: string; name: string; info: Record<string, string> }) => Promise<void>;
  onCancel: () => void;
}) {
  const [saved] = useState(remembered);
  const [code, setCode] = useState(saved.code);
  const [klass, setKlass] = useState<{ to: string; fields: string[] } | null>(null);
  const [name, setName] = useState(defaultName);
  const [info, setInfo] = useState<Record<string, string>>(saved.info);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = code.trim().toUpperCase();
      if (!klass) {
        setKlass(await api.classInfo(c));
        return;
      }
      const answers = Object.fromEntries(klass.fields.map((f) => [f, (info[f] ?? '').trim()]));
      await onSubmit({ code: c, name: name.trim(), info: answers });
      try {
        localStorage.setItem(STORE, JSON.stringify({ code: c, info: { ...info, ...answers } }));
      } catch {
        // Only a convenience for next time.
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ready = klass ? !!name.trim() && klass.fields.every((f) => info[f]?.trim()) : code.trim().length === 6;

  return (
    <div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-[#06090d]/60 p-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        className="flex w-full max-w-sm flex-col gap-3.5 rounded-2xl border border-steel-400 bg-steel-50 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={go}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="submit-title" className="text-lg font-bold text-carbon-900">
              {klass ? 'Submit to ' + klass.to : 'Submit to your instructor'}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-carbon-600">
              {klass
                ? 'Your name is added for you. Submitting the same name again replaces the earlier copy.'
                : 'Type the class code your instructor gave you. The board goes straight to their library, under your name.'}
            </p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-md p-1 text-carbon-600 hover:bg-steel-200 hover:text-carbon-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!klass ? (
          <div>
            <label className={label} htmlFor="submit-code">
              Class code
            </label>
            <input
              id="submit-code"
              autoFocus
              value={code}
              maxLength={6}
              placeholder="ABC234"
              onChange={(e) => setCode(e.target.value)}
              className={input + ' font-mono uppercase tracking-[0.15em]'}
            />
          </div>
        ) : (
          <>
            {klass.fields.map((f, i) => (
              <div key={f}>
                <label className={label} htmlFor={'submit-f' + i}>
                  {f}
                </label>
                <input
                  id={'submit-f' + i}
                  autoFocus={i === 0}
                  value={info[f] ?? ''}
                  maxLength={60}
                  onChange={(e) => setInfo({ ...info, [f]: e.target.value })}
                  className={input}
                />
              </div>
            ))}
            <div>
              <label className={label} htmlFor="submit-name">
                Activity or circuit name
              </label>
              <input
                id="submit-name"
                autoFocus={klass.fields.length === 0}
                value={name}
                maxLength={120}
                placeholder="Lab 3 — start/stop latch"
                onChange={(e) => setName(e.target.value)}
                className={input}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-[13px] text-red-ink">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={klass ? () => setKlass(null) : onCancel}
            className="h-9 rounded-[9px] border border-steel-400 bg-steel-100 px-4 text-sm font-semibold text-carbon-900 hover:bg-steel-200"
          >
            {klass ? 'Back' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={!ready || busy}
            className="h-9 rounded-[9px] bg-signal-amber px-4 text-sm font-bold text-[#1a1204] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'One moment…' : klass ? 'Submit' : 'Next'}
          </button>
        </div>
      </form>
    </div>
  );
}
