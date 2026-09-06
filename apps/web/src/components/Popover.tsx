'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * A small panel hung off a toolbar button. It closes on Escape or on a click
 * anywhere outside, which is all a toolbar menu on this bench ever needs.
 */
export function Popover({
  trigger,
  panel,
  title,
  align = 'left',
  buttonClass,
  panelClass,
}: {
  trigger: React.ReactNode;
  panel: (close: () => void) => React.ReactNode;
  title?: string;
  align?: 'left' | 'right';
  buttonClass?: string;
  panelClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={host} className="relative">
      <button
        type="button"
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs font-semibold transition',
          open ? 'border-carbon-900 bg-steel-200 text-carbon-900' : 'border-steel-400 bg-steel-50 text-carbon-800 hover:bg-steel-200',
          buttonClass,
        )}
      >
        {trigger}
      </button>

      {open && (
        <div
          className={clsx(
            'absolute top-full z-50 mt-1.5 rounded-sm border-2 border-carbon-900 bg-steel-50 p-2 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            panelClass,
          )}
        >
          {panel(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
