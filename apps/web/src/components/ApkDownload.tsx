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

/**
 * A random name this browser calls itself, so the tally can tell a second tap
 * from a second person.
 *
 * The server cannot work this out for itself: every request reaches it through
 * Vercel and then Render, so the address it sees belongs to a proxy that moves
 * between instances, not to anyone downloading. Letting the browser say who it
 * is keeps the count independent of how the site happens to be hosted.
 *
 * It identifies nobody — it is random, it lives on the one device, and the
 * server stores only a hash of it.
 */
const DEVICE = 'mech-device';

function deviceId(): string {
  try {
    const seen = localStorage.getItem(DEVICE);
    if (seen) return seen;
    const made = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE, made);
    return made;
  } catch {
    // Storage blocked: the download still counts, it just cannot be told
    // apart from another one later.
    return 'anonymous';
  }
}

/** Tell the API a download is starting. Never blocks it, never throws. */
function count(): void {
  try {
    void fetch('/api/downloads', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: deviceId() }),
    }).catch(() => {});
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
 * How many downloads there have been, read off the panel the way this app
 * reads off every other count.
 *
 * The board already shows LEADS 00 and FAULTS 00 in zero-padded registers, so
 * a download tally has somewhere to live that was not invented for it: a
 * totalizer, the cycle counter bolted beside a machine. That also settles what
 * nothing looks like — 0000 is a reading an instrument is happy to give, where
 * a sentence saying there are none reads like an apology.
 *
 * Steel and carbon only. The amber belongs to the download button; a register
 * competing with it would be a second thing asking to be pressed, and this one
 * cannot be pressed at all.
 *
 * Zero is a real answer. Only an API that never replied leaves the register
 * out, because then there is genuinely nothing to read.
 */
export function DownloadCount({
  className,
  /** Off where the surrounding row already names what is being counted. */
  labelled = true,
}: {
  className?: string;
  labelled?: boolean;
}) {
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

  if (total === null) return null;

  // Four places keeps the register a fixed width as the count climbs, and
  // widens only if it ever outgrows them.
  const digits = String(total).padStart(4, '0').split('');

  return (
    <span className={'inline-flex shrink-0 items-center gap-2 ' + (className ?? '')}>
      <span
        className="flex overflow-hidden rounded-[2px] border border-steel-400 bg-steel-50"
        role="img"
        aria-label={total.toLocaleString('en-GB') + (total === 1 ? ' download' : ' downloads')}
      >
        {digits.map((d, i) => (
          <span
            key={i}
            aria-hidden
            className="border-l border-steel-300 px-[5px] py-[3px] font-mono text-[13px] leading-none font-semibold tabular-nums text-carbon-900 first:border-l-0"
          >
            {d}
          </span>
        ))}
      </span>
      {labelled && (
        <span aria-hidden className="text-xs text-carbon-600">
          {total === 1 ? 'download' : 'downloads'}
        </span>
      )}
    </span>
  );
}
