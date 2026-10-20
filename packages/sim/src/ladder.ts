/*
 * The PLC's ladder program. A rung is an OR of branches, each branch an AND of
 * contacts, ending in one coil — the sum of products a student draws between
 * the rails.
 */

const two = (n: number) => String(n).padStart(2, '0');

/** Input addresses on the CP1E, one per INPUT post. */
export const PLC_INPUTS: string[] = Array.from({ length: 12 }, (_, i) => `I${two(i)}`);
/** Relay output addresses on the CP1E, each a contact from COM to its post. */
export const PLC_OUTPUTS: string[] = Array.from({ length: 8 }, (_, i) => `Q${two(i)}`);
/** On-delay timers: a TON coil on one, and its contacts read it. */
export const PLC_TIMERS: string[] = Array.from({ length: 8 }, (_, i) => `T${i}`);

export const TON_MIN_SEC = 0.1;
export const TON_MAX_SEC = 3600;

export interface LadderContact {
  addr: string;
  /** Normally closed: passes power while its bit is OFF. */
  nc?: boolean;
}

export type LadderCoilKind = 'OUT' | 'SET' | 'RST' | 'TON';

export interface LadderRung {
  branches: LadderContact[][];
  /** `presetSec` is the TON set point; omitted means one second. */
  coil: { addr: string; kind: LadderCoilKind; presetSec?: number };
}

/** The wall clock and each running timer's start instant, which a scan updates. */
export interface LadderClock {
  now: number;
  start: Record<string, number>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const presetMs = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(TON_MAX_SEC, Math.max(TON_MIN_SEC, v)) * 1000 : 1000;

/** Each TON's set point in ms, by timer address. A timer coiled twice takes the lower rung's. */
export function timerPresets(rungs: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(rungs)) return out;
  for (const r of rungs) {
    if (!isObj(r) || !isObj(r.coil) || r.coil.kind !== 'TON') continue;
    const addr = r.coil.addr;
    if (typeof addr === 'string' && PLC_TIMERS.includes(addr)) out[addr] = presetMs(r.coil.presetSec);
  }
  return out;
}

/**
 * One scan. `bits` holds I and the previous Q; returns the new Q bits (all of
 * PLC_OUTPUTS). Rungs run top to bottom, and a coil written by one rung is
 * seen by the rungs below it. The ladder comes from saved files, so its shape
 * is checked here: a bad contact reads OFF and a bad coil is ignored.
 *
 * With a `clock`, TON coils run: a powered TON keeps its start (or takes
 * `now`) in `clock.start`, an unpowered one loses it, and the timer's bit is
 * ON once it has been powered for its preset. Without one, timer bits stay OFF.
 */
export function scan(rungs: unknown, bits: Record<string, boolean>, clock?: LadderClock): Record<string, boolean> {
  const working: Record<string, boolean> = {};
  for (const q of PLC_OUTPUTS) working[q] = !!bits[q];
  if (!Array.isArray(rungs)) return working;
  const presets = timerPresets(rungs);
  const timerDone = (addr: string): boolean => {
    const start = clock?.start[addr];
    return start !== undefined && addr in presets && clock!.now - start >= presets[addr];
  };

  const value = (addr: unknown): boolean => {
    if (typeof addr !== 'string') return false;
    if (PLC_OUTPUTS.includes(addr)) return working[addr];
    if (PLC_INPUTS.includes(addr)) return !!bits[addr];
    if (PLC_TIMERS.includes(addr)) return timerDone(addr);
    return false;
  };

  for (const rung of rungs) {
    if (!isObj(rung) || !isObj(rung.coil) || !Array.isArray(rung.branches)) continue;
    const { addr, kind } = rung.coil;
    if (typeof addr !== 'string') continue;
    const timer = kind === 'TON' && PLC_TIMERS.includes(addr);
    if (!timer && !PLC_OUTPUTS.includes(addr)) continue;
    const power = rung.branches.some(
      (b) =>
        Array.isArray(b) && b.length > 0 && b.every((ct) => isObj(ct) && value(ct.addr) !== !!ct.nc),
    );
    if (timer) {
      if (!clock) continue;
      if (power) clock.start[addr] ??= clock.now;
      else delete clock.start[addr];
    } else if (kind === 'OUT') working[addr] = power;
    else if (kind === 'SET' && power) working[addr] = true;
    else if (kind === 'RST' && power) working[addr] = false;
  }
  return working;
}
