'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';

/**
 * A blocking confirmation for destructive actions. Cancel takes focus, so a
 * stray Enter dismisses the dialog rather than carrying out the deletion.
 */
export function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-carbon-900/45 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-lg border border-steel-400 bg-steel-50 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-safety-red/15 text-safety-red">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 id="confirm-title" className="engraved text-sm font-bold text-carbon-900">
              {title}
            </h2>
            <p id="confirm-message" className="mt-1.5 text-xs leading-relaxed text-carbon-600">
              {message}
            </p>
            {detail && <p className="mt-1.5 text-[11px] leading-relaxed text-carbon-600">{detail}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={clsx(
              'rounded-sm border border-steel-400 bg-steel-100 px-3 py-1.5 text-xs font-semibold',
              'text-carbon-800 hover:bg-steel-200',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-sm border border-safety-red/50 bg-safety-red/15 px-3 py-1.5 text-xs font-bold text-safety-red hover:bg-safety-red/25"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
