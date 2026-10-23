'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';

/**
 * Shows the share link itself rather than announcing it somewhere off-screen.
 * The URL stays selectable so it can be copied by hand if the clipboard API is
 * unavailable, which it is on any page not served over HTTPS.
 */
export function ShareDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fall back to selecting it so the reader can copy manually.
      inputRef.current?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#06090d]/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-2xl border border-steel-400 bg-steel-50 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="share-title" className="text-lg font-bold text-carbon-900">
              Share this circuit
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-carbon-600">
              Anyone with the link can open the board and run it. They cannot change your copy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-carbon-600 hover:bg-steel-200 hover:text-carbon-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="h-10 w-full rounded-[10px] border border-steel-400 bg-steel-100 px-3 font-mono text-xs text-carbon-900 outline-none focus:border-signal-amber"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 h-9 rounded-[9px] bg-signal-amber px-4 text-sm font-bold text-[#1a1204] hover:brightness-110"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-signal-blue hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open the shared view
        </a>
      </div>
    </div>
  );
}
