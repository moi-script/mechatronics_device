'use client';

/**
 * The download button, and the tally underneath it.
 *
 * The APK is a static file on this origin, so nothing sees it being fetched.
 * Counting therefore happens beside the download rather than in front of it:
 * the button tells the API a download is starting and then gets out of the
 * way. Routing the file itself through the API would have been exact, but the
 * API sleeps on a free plan, and a download that waits half a minute for a
 * counter to wake up is worse than a count that is occasionally short.
 *
 * `keepalive` is what makes that work — the browser is navigating away to
 * fetch the file, and without it the request would be cancelled on the way
 * out.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { OFFLINE } from '@/lib/api';

/** Tell the API a download is starting. Never blocks it, never throws. */
function count(): void {
  try {
    void fetch('/api/downloads', { method: 'POST', keepalive: true }).catch(() => {});
  } catch {
    // A blocked or failed count is not worth interrupting a download over.
  }
}

interface Props {
  href: string;
  className?: string;
  children: ReactNode;
}

export function ApkDownloadLink({ href, className, children }: Props) {
  return (
    <a href={href} download onClick={count} className={className}>
      {children}
    </a>
  );
}

/**
 * How many downloads there have been, once the API says. It renders nothing
 * until then — and nothing at all if the API is asleep or the count is zero,
 * because an empty number beside a download button reads worse than no
 * number at all.
 */
export function DownloadCount({ className }: { className?: string }) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    // The installed app is not where anyone downloads the installed app.
    if (OFFLINE) return;
    let cancelled = false;

    fetch('/api/downloads')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { count: number | null } | null) => {
        if (!cancelled && typeof body?.count === 'number') setTotal(body.count);
      })
      .catch(() => {
        // Asleep or unreachable: the page simply does not mention a count.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (total === null || total === 0) return null;

  return (
    <span className={className}>
      {total.toLocaleString('en-GB')} {total === 1 ? 'download' : 'downloads'}
    </span>
  );
}
