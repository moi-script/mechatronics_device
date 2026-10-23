/*
 * The PLC's ladder program. A rung is a run of blocks in series from the left
 * rail to one coil. A block is an OR of branches, each branch an AND of
 * contacts: a lone contact is a block of one branch of one, and a parallel
 * group is a block of several — so a rung can open and close parallel groups
 * anywhere along it, as drawn between the rails.
 */

const two = (n: number) => String(n).padStart(2, '0');

/** Input addresses on the CP1E, one per INPUT post. */
// The CP1E N30's 18 inputs: I00-I11 are CH 0, I12-I17 are CH 1 00-05.
export const PLC_INPUTS: string[] = Array.from({ length: 18 }, (_, i) => `I${two(i)}`);
/** Relay output addresses on the CP1E, each a contact from COM to its post. */
// Its 12 relay outputs: Q00-Q07 are CH 100, Q08-Q11 are CH 101 00-03.
export const PLC_OUTPUTS: string[] = Array.from({ length: 12 }, (_, i) => `Q${two(i)}`);
/** Internal relays: coils and contacts that live only inside the PLC, nothing wired to them. */
export const PLC_MEMORY: string[] = Array.from({ length: 16 }, (_, i) => `M${two(i)}`);
/** On-delay timers: a TON coil on one, and its contacts read it. */
export const PLC_TIMERS: string[] = Array.from({ length: 8 }, (_, i) => `T${i}`);
/** Every bit an OUT, SET or RST coil can drive, and that carries from one scan to the next. */
export const PLC_COILS: string[] = [...PLC_OUTPUTS, ...PLC_MEMORY];

export const TON_MIN_SEC = 0.1;
export const TON_MAX_SEC = 3600;

export interface LadderContact {
  addr: string;
  /** Normally closed: passes power while its bit is OFF. */
  nc?: boolean;
}

export type LadderCoilKind = 'OUT' | 'SET' | 'RST' | 'TON';

export interface LadderRung {
  /** In series, left to right; each block is parallel branches of series contacts. */
  blocks: LadderContact[][][];
  /** `presetSec` is the TON set point; omitted means one second. */
  coil: { addr: string; kind: LadderCoilKind; presetSec?: number };
}

/** The wall clock and each running timer's start instant, which a scan updates. */
export interface LadderClock {
  now: number;
  start: Record<string, number>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** A rung's blocks; a rung saved before blocks existed is one parallel group, its `branches`. */
const blocksOf = (r: Record<string, unknown>): unknown[] =>
  Array.isArray(r.blocks) ? r.blocks : Array.isArray(r.branches) ? [r.branches] : [];

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
 * One scan. `bits` holds I and the previous Q and M; returns the new Q and M
 * bits (all of PLC_COILS). Rungs run top to bottom, and a coil written by one
 * rung is seen by the rungs below it. The ladder comes from saved files, so its
 * shape is checked here: a bad contact reads OFF and a bad coil is ignored.
 *
 * With a `clock`, TON coils run: a powered TON keeps its start (or takes
 * `now`) in `clock.start`, an unpowered one loses it, and the timer's bit is
 * ON once it has been powered for its preset. Without one, timer bits stay OFF.
 */
export function scan(rungs: unknown, bits: Record<string, boolean>, clock?: LadderClock): Record<string, boolean> {
  const working: Record<string, boolean> = {};
  for (const q of PLC_COILS) working[q] = !!bits[q];
  if (!Array.isArray(rungs)) return working;
  const presets = timerPresets(rungs);
  const timerDone = (addr: string): boolean => {
    const start = clock?.start[addr];
    return start !== undefined && addr in presets && clock!.now - start >= presets[addr];
  };

  const value = (addr: unknown): boolean => {
    if (typeof addr !== 'string') return false;
    if (PLC_COILS.includes(addr)) return working[addr];
    if (PLC_INPUTS.includes(addr)) return !!bits[addr];
    if (PLC_TIMERS.includes(addr)) return timerDone(addr);
    return false;
  };
  const passes = (ct: unknown) => isObj(ct) && value(ct.addr) !== !!ct.nc;
  const branchesOf = (block: unknown): unknown[][] =>
    Array.isArray(block) ? block.filter((b): b is unknown[] => Array.isArray(b) && b.length > 0) : [];

  for (const rung of rungs) {
    if (!isObj(rung) || !isObj(rung.coil)) continue;
    const { addr, kind } = rung.coil;
    if (typeof addr !== 'string') continue;
    const timer = kind === 'TON' && PLC_TIMERS.includes(addr);
    if (!timer && !PLC_COILS.includes(addr)) continue;
    // A block with no contacts in it is no block; a rung with no blocks never powers.
    const blocks = blocksOf(rung).map(branchesOf).filter((bs) => bs.length > 0);
    const power = blocks.length > 0 && blocks.every((bs) => bs.some((b) => b.every(passes)));
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

const COIL_KINDS: LadderCoilKind[] = ['OUT', 'SET', 'RST', 'TON'];

/**
 * A ladder from a project file, reduced to well-formed rungs with no empty
 * branches or blocks; undefined when it is not a list at all. The solver copes
 * with junk, but the editor draws every rung and would trip on a bad shape.
 */
export function cleanLadder(v: unknown): LadderRung[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: LadderRung[] = [];
  for (const r of v) {
    if (!isObj(r) || !isObj(r.coil)) continue;
    const { addr, kind, presetSec } = r.coil;
    if (typeof addr !== 'string' || !COIL_KINDS.includes(kind as LadderCoilKind)) continue;
    const contacts = (b: unknown[]) =>
      b
        .filter((ct): ct is Record<string, unknown> => isObj(ct) && typeof ct.addr === 'string')
        .map((ct) => ({ addr: ct.addr as string, ...(ct.nc === true ? { nc: true } : {}) }));
    const blocks = blocksOf(r)
      .filter(Array.isArray)
      .map((block: unknown[]) => block.filter(Array.isArray).map(contacts).filter((b) => b.length > 0))
      .filter((block) => block.length > 0);
    const coil = {
      addr,
      kind: kind as LadderCoilKind,
      ...(typeof presetSec === 'number' && Number.isFinite(presetSec) ? { presetSec } : {}),
    };
    out.push({ blocks, coil });
  }
  return out;
}
