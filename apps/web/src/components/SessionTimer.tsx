'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pause, Play, RotateCcw, Square, Timer as TimerIcon } from 'lucide-react';

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

/** Three short beeps, synthesised so the app carries no audio asset. */
function alarm() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28, 0.56].forEach((at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.2);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // No audio available; the visual alarm still fires.
  }
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
};

/**
 * A practice alarm for the bench session. It is deliberately not wired to the
 * board: it just counts the activity down and rings.
 */
export function SessionTimer() {
  const [armed, setArmed] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const [remainingMs, setRemainingMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const endsAt = useRef(0);
  const wrap = useRef<HTMLDivElement>(null);

  const start = useCallback((mins: number) => {
    const ms = Math.max(1, Math.round(mins)) * 60_000;
    setMinutes(Math.max(1, Math.round(mins)));
    setRemainingMs(ms);
    endsAt.current = Date.now() + ms;
    setArmed(true);
    setRunning(true);
    setFinished(false);
    setMenuOpen(false);
  }, []);

  const stop = useCallback(() => {
    setArmed(false);
    setRunning(false);
    setFinished(false);
    setRemainingMs(0);
    setMenuOpen(false);
  }, []);

  // Count down against a wall-clock deadline so throttled tabs stay accurate.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = endsAt.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setRunning(false);
        setFinished(true);
        alarm();
      } else {
        setRemainingMs(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!finished) return;
    const original = document.title;
    document.title = "TIME'S UP - " + original;
    return () => {
      document.title = original;
    };
  }, [finished]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const chip =
    'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-semibold transition';
  const iconBtn = 'rounded-sm p-1 text-carbon-600 hover:bg-steel-200 hover:text-carbon-900';

  return (
    <div ref={wrap} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => (finished ? stop() : setMenuOpen((v) => !v))}
        title={armed ? 'Session timer' : 'Set a practice timer'}
        className={clsx(
          chip,
          finished
            ? 'animate-pulse border-safety-red bg-safety-red/15 text-safety-red'
            : armed
              ? 'border-signal-amber/50 bg-signal-amber/10 text-signal-amber'
              : 'border-steel-400 bg-steel-50 text-carbon-600 hover:bg-steel-200',
        )}
      >
        <TimerIcon className="h-3.5 w-3.5" />
        {finished ? (
          <span className="engraved">Time&apos;s up</span>
        ) : armed ? (
          <span className="font-mono tabular-nums">{mmss(remainingMs)}</span>
        ) : (
          <span className="engraved">Timer off</span>
        )}
      </button>

      {armed && !finished && (
        <>
          <button
            type="button"
            className={iconBtn}
            title={running ? 'Pause' : 'Resume'}
            onClick={() => {
              if (running) {
                setRemainingMs(endsAt.current - Date.now());
                setRunning(false);
              } else {
                endsAt.current = Date.now() + remainingMs;
                setRunning(true);
              }
            }}
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            className={iconBtn}
            title={'Restart ' + minutes + ' min'}
            onClick={() => start(minutes)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconBtn} title="Turn the timer off" onClick={stop}>
            <Square className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {menuOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-sm border border-steel-400 bg-steel-50 p-3 shadow-xl">
          <p className="engraved mb-2 text-[10px] font-bold text-carbon-600">Practice timer</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => start(m)}
                className="rounded-sm border border-steel-400 bg-steel-100 py-1.5 font-mono text-[11px] text-carbon-900 hover:border-signal-amber hover:bg-signal-amber/10"
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-carbon-600">minutes</p>

          <form
            className="mt-3 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(custom);
              if (Number.isFinite(n) && n > 0) start(n);
            }}
          >
            <input
              type="number"
              min={1}
              max={600}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom"
              className="w-full rounded-sm border border-steel-400 bg-steel-100 px-2 py-1 font-mono text-[11px] text-carbon-900 outline-none focus:border-signal-amber"
            />
            <button
              type="submit"
              className="rounded-sm border border-run-green/40 bg-run-green/10 px-2.5 py-1 text-[11px] font-semibold text-run-green hover:bg-run-green/20"
            >
              Start
            </button>
          </form>

          {armed && (
            <button
              type="button"
              onClick={stop}
              className="mt-2 w-full rounded-sm border border-steel-400 bg-steel-100 py-1.5 text-[11px] font-semibold text-carbon-600 hover:bg-steel-200"
            >
              Turn timer off
            </button>
          )}
        </div>
      )}
    </div>
  );
}
