import { PARTS, endKey, moduleLabel, pinKey } from './parts';
import { PLC_INPUTS, PLC_OUTPUTS } from './ladder';
import type { Circuit, EndRef, SimResult } from './types';

const endNode = (ref: EndRef): string | null =>
  ref.kind === 'terminal' ? pinKey(ref.moduleId, ref.pinId) : ref.kind === 'stack' ? endKey(ref.wireId, ref.end) : null;

/**
 * Labels of the device pins led to this PLC terminal, e.g. "Push-Button Unit
 * B1 14". Empty when nothing is wired. Traced over the leads alone, not the
 * live net: a pressed button or a closed output relay joins this terminal to
 * the supply, but the device wired to it is still the same one.
 */
export function devicesOn(circuit: Circuit, moduleId: string, pinId: string): string[] {
  const nodes = new Set([pinKey(moduleId, pinId)]);
  const leads = circuit.wires.filter((w) => w.kind !== 'tube');
  for (let grew = true; grew; ) {
    grew = false;
    for (const w of leads) {
      const ends = [endKey(w.id, 'A'), endKey(w.id, 'B'), endNode(w.a), endNode(w.b)].filter((k): k is string => !!k);
      if (ends.some((k) => nodes.has(k)) && ends.some((k) => !nodes.has(k))) {
        ends.forEach((k) => nodes.add(k));
        grew = true;
      }
    }
  }
  const out: string[] = [];
  for (const node of nodes) {
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
