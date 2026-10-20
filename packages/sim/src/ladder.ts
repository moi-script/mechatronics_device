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

export interface LadderContact {
  addr: string;
  /** Normally closed: passes power while its bit is OFF. */
  nc?: boolean;
}

export type LadderCoilKind = 'OUT' | 'SET' | 'RST';

export interface LadderRung {
  branches: LadderContact[][];
  coil: { addr: string; kind: LadderCoilKind };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * One scan. `bits` holds I and the previous Q; returns the new Q bits (all of
 * PLC_OUTPUTS). Rungs run top to bottom, and a coil written by one rung is
 * seen by the rungs below it. The ladder comes from saved files, so its shape
 * is checked here: a bad contact reads OFF and a bad coil is ignored.
 */
export function scan(rungs: unknown, bits: Record<string, boolean>): Record<string, boolean> {
  const working: Record<string, boolean> = {};
  for (const q of PLC_OUTPUTS) working[q] = !!bits[q];
  if (!Array.isArray(rungs)) return working;

  const value = (addr: unknown): boolean => {
    if (typeof addr !== 'string') return false;
    if (PLC_OUTPUTS.includes(addr)) return working[addr];
    if (PLC_INPUTS.includes(addr)) return !!bits[addr];
    return false;
  };

  for (const rung of rungs) {
    if (!isObj(rung) || !isObj(rung.coil) || !Array.isArray(rung.branches)) continue;
    const { addr, kind } = rung.coil;
    if (typeof addr !== 'string' || !PLC_OUTPUTS.includes(addr)) continue;
    const power = rung.branches.some(
      (b) =>
        Array.isArray(b) && b.length > 0 && b.every((ct) => isObj(ct) && value(ct.addr) !== !!ct.nc),
    );
    if (kind === 'OUT') working[addr] = power;
    else if (kind === 'SET' && power) working[addr] = true;
    else if (kind === 'RST' && power) working[addr] = false;
  }
  return working;
}
