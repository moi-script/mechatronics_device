'use client';

/**
 * The app asking, on startup, whether the site is carrying a newer build than
 * the one running — and offering to fetch it.
 *
 * There is no store behind this app, so nothing tells a phone it is out of
 * date. What does is a small file published next to the APK download saying
 * what the newest version is; the app compares that with the version baked
 * into it and says so if it is behind.
 *
 * Android will not let an app install anything by itself, so the button hands
 * the download to the browser and the person taps Install. That is as far as
 * an APK outside a store can go, and it is far enough: the point is that they
 * are told at all.
 */
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { OFFLINE, SITE_URL } from '@/lib/api';

/** What this build is. Baked in when the APK is built. */
const VERSION_CODE = Number(process.env.NEXT_PUBLIC_APP_VERSION_CODE ?? '0');
export const VERSION_NAME = process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? '';

interface Published {
  versionCode: number;
  versionName: string;
  url: string;
  bytes?: number;
}

/** Versions already turned down, so the question is asked once each. */
const DISMISSED = 'mech-update-dismissed';

const wasDismissed = (code: number): boolean => {
  try {
    return Number(localStorage.getItem(DISMISSED) ?? '0') >= code;
  } catch {
    return false;
  }
};

const dismiss = (code: number): void => {
  try {
    localStorage.setItem(DISMISSED, String(code));
  } catch {
    // Storage off: it will ask again next time, which is the safe way round.
  }
};

export function UpdateNotice() {
  const [found, setFound] = useState<Published | null>(null);

  useEffect(() => {
    // Only the installed app can be out of date. The site is whatever it is.
    if (!OFFLINE || !SITE_URL || !VERSION_CODE) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(SITE_URL + '/apk-version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const latest = (await res.json()) as Published;
        if (cancelled) return;
        if (latest.versionCode > VERSION_CODE && !wasDismissed(latest.versionCode)) setFound(latest);
      } catch {
        // No network, or the site is down: an app that runs offline says nothing.
      }
    };

    // A moment after opening, so the check never delays the board.
    const id = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  if (!found) return null;

  const size = found.bytes ? (found.bytes / 1_000_000).toFixed(1) + ' MB' : null;
  const close = () => {
    dismiss(found.versionCode);
    setFound(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[22rem] sm:p-0">
      <div className="rounded-lg border border-steel-400 bg-steel-50 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-carbon-900">Version {found.versionName} is out</p>
            <p className="mt-1 text-xs leading-relaxed text-carbon-600">
              You are on {VERSION_NAME || 'an older build'}. Downloading opens the file in your browser; Android asks
              before installing it. Your saved circuits stay where they are.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Not now" className="text-carbon-600 hover:text-carbon-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <a
            href={SITE_URL + found.url}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="inline-flex items-center gap-1.5 rounded-sm bg-signal-amber px-3 py-2 text-xs font-bold text-carbon-900"
          >
            <Download className="h-3.5 w-3.5" />
            Download it
            {size && <span className="font-mono text-[10px] font-normal opacity-70">{size}</span>}
          </a>
          <button
            type="button"
            onClick={close}
            className="rounded-sm border border-steel-400 bg-steel-100 px-3 py-2 text-xs font-semibold text-carbon-800 hover:bg-steel-200"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
