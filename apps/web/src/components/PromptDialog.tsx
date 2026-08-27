'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * An in-app replacement for window.prompt, so naming a circuit looks like the
 * rest of the panel instead of a browser chrome dialog.
 */
export function PromptDialog({
  title,
  message,
  label,
  defaultValue = '',
  placeholder,
  confirmLabel,
  maxLength = 120,
  busy = false,
  onSubmit,
  onCancel,
}: {
  title: string;
  message?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel: string;
  maxLength?: number;
  busy?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    el?.focus();
    // Select the suggestion so typing replaces it, as window.prompt did.
    el?.select();
  }, []);

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

  const trimmed = value.trim();

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-carbon-900/45 p-4"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        className="w-full max-w-sm rounded-lg border border-steel-400 bg-steel-50 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !busy) onSubmit(trimmed);
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="prompt-title" className="engraved text-sm font-bold text-carbon-900">
              {title}
            </h2>
            {message && <p className="mt-1.5 text-xs leading-relaxed text-carbon-600">{message}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-sm p-1 text-carbon-600 hover:bg-steel-200 hover:text-carbon-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="engraved mb-1.5 block text-[10px] font-semibold text-carbon-600" htmlFor="prompt-input">
          {label}
        </label>
        <input
          id="prompt-input"
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-sm border border-steel-400 bg-steel-100 px-3 py-2 text-sm text-carbon-900 outline-none focus:border-signal-amber"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-steel-400 bg-steel-100 px-3 py-1.5 text-xs font-semibold text-carbon-800 hover:bg-steel-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed || busy}
            className="rounded-sm border border-run-green/50 bg-run-green/15 px-3 py-1.5 text-xs font-bold text-run-green hover:bg-run-green/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
