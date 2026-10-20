import { PARTS, moduleLabel, pinKey } from './parts';
import { PLC_INPUTS, PLC_OUTPUTS } from './ladder';
import type { Circuit, SimResult } from './types';

/**
 * Labels of the device pins sharing a net with this PLC terminal, e.g.
 * "Push-Button Unit B1 14". Empty when nothing is wired.
 */
export function devicesOn(circuit: Circuit, result: SimResult, moduleId: string, pinId: string): string[] {
  const net = result.nets[result.pinNet[pinKey(moduleId, pinId)]];
  if (!net) return [];
  const out: string[] = [];
  for (const node of net.nodes) {
    if (node.startsWith('~')) continue;
    const dot = node.indexOf('.');
    const modId = node.slice(0, dot);
    const pin = node.slice(dot + 1);
    if (modId === moduleId) continue;
    const m = circuit.modules.find((x) => x.id === modId);
    const def = m && PARTS[m.type].pins.find((p) => p.id === pin);
    if (!m || !def) continue;
    // Pins on a multi-unit panel are named "B1_14": keep the unit, it is what tells them apart.
    const unit = pin.includes('_') ? `${pin.split('_')[0]} ` : '';
    out.push(`${moduleLabel(m)} ${unit}${def.label}`);
  }
  return out;
}

/** Every I and Q bit of one PLC right now, for the live ladder view. */
export function plcBits(circuit: Circuit, result: SimResult, moduleId: string): Record<string, boolean> {
  const bits: Record<string, boolean> = {};
  for (const i of PLC_INPUTS) bits[i] = !!result.nets[result.pinNet[pinKey(moduleId, i)]]?.hot;
  for (const q of PLC_OUTPUTS) bits[q] = !!result.actuated[`${moduleId}.${q}`];
  return bits;
}
