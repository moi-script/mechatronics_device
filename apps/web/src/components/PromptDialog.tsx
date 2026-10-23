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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#06090d]/60 p-4"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        className="w-full max-w-sm rounded-2xl border border-steel-400 bg-steel-50 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !busy) onSubmit(trimmed);
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="prompt-title" className="text-lg font-bold text-carbon-900">
              {title}
            </h2>
            {message && <p className="mt-1.5 text-sm leading-relaxed text-carbon-600">{message}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1 text-carbon-600 hover:bg-steel-200 hover:text-carbon-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-[13px] font-semibold text-carbon-800" htmlFor="prompt-input">
          {label}
        </label>
        <input
          id="prompt-input"
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="h-[46px] w-full rounded-[10px] border border-steel-400 bg-steel-100 px-3.5 text-[15px] text-carbon-900 outline-none focus:border-signal-amber"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[9px] border border-steel-400 bg-steel-100 px-4 text-sm font-semibold text-carbon-900 hover:bg-steel-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed || busy}
            className="h-9 rounded-[9px] bg-signal-amber px-4 text-sm font-bold text-[#1a1204] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
