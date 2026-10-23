import { PARTS, endKey, moduleLabel, pinKey } from './parts';
import { PLC_COILS, PLC_INPUTS, PLC_TIMERS } from './ladder';
import type { Circuit, EndRef, ModuleInstance, ModuleType, SimResult } from './types';

const endNode = (ref: EndRef): string | null =>
  ref.kind === 'terminal' ? pinKey(ref.moduleId, ref.pinId) : ref.kind === 'stack' ? endKey(ref.wireId, ref.end) : null;

/** The pins of other modules led to this one, over the leads alone. */
function ledTo(circuit: Circuit, moduleId: string, pinId: string): { m: ModuleInstance; pin: string }[] {
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
  const out: { m: ModuleInstance; pin: string }[] = [];
  for (const node of nodes) {
    if (node.startsWith('~')) continue;
    const dot = node.indexOf('.');
    const modId = node.slice(0, dot);
    const pin = node.slice(dot + 1);
    if (modId === moduleId) continue;
    const m = circuit.modules.find((x) => x.id === modId);
    if (m && PARTS[m.type].pins.some((p) => p.id === pin)) out.push({ m, pin });
  }
  return out;
}

type ContactKind = 'NO' | 'NC';

/** Whether a pin is on a normally open or normally closed contact of its part, if it is on one at all. */
function contactKind(m: ModuleInstance, pin: string): ContactKind | undefined {
  const part = PARTS[m.type];
  const role = part.pins.find((p) => p.id === pin)?.role;
  if (role === 'NO' || role === 'NC') return role;
  const sw = part.switches?.find((s) => s.pins.includes(pin));
  // A switch that closes when its button is pressed is a NO contact.
  if (sw) return sw.closedWhen ? 'NO' : 'NC';
  return undefined;
}

/** The NO and NC pins switched by the coil whose + end is this pin; none when it is not a coil. */
function switchedBy(m: ModuleInstance, pin: string): { pin: string; kind: ContactKind }[] {
  const part = PARTS[m.type];
  const coils = part.coils ?? (part.hasCoil ? [{ id: '', vcc: 'VCC', gnd: 'GND' }] : []);
  const coil = coils.find((c) => c.vcc === pin);
  if (!coil) return [];
  const out: { pin: string; kind: ContactKind }[] = [];
  if (coil.id === '') {
    for (let l = 1; l <= part.contactLines; l++) out.push({ pin: `NO${l}`, kind: 'NO' }, { pin: `NC${l}`, kind: 'NC' });
  }
  for (const c of part.changeovers ?? []) {
    if (c.actuator === coil.id) out.push({ pin: c.no, kind: 'NO' }, { pin: c.nc, kind: 'NC' });
  }
  return out;
}

export interface FieldDevice {
  /** e.g. "Push-Button Unit 1 B1 14". */
  label: string;
  moduleId: string;
  type: ModuleType;
  /** For an input: whether the device's own contact wired here is NO or NC. */
  contact?: ContactKind;
  /** For an output driving a relay coil: what each of that relay's contacts switches. */
  switches?: { kind: ContactKind; loads: string[] }[];
}

/**
 * The devices led to this PLC terminal, with the part each belongs to and how
 * it is wired. Empty when nothing is wired. Traced over the leads alone, not
 * the live net: a pressed button or a closed output relay joins this terminal
 * to the supply, but the device wired to it is still the same one.
 */
export function partsOn(circuit: Circuit, moduleId: string, pinId: string): FieldDevice[] {
  return ledTo(circuit, moduleId, pinId).map(({ m, pin }) => {
    const def = PARTS[m.type].pins.find((p) => p.id === pin)!;
    // Pins on a multi-unit panel are named "B1_14": keep the unit, it is what tells them apart.
    const unit = pin.includes('_') ? `${pin.split('_')[0]} ` : '';
    const switches = switchedBy(m, pin)
      .map(({ pin: p, kind }) => ({ kind, loads: ledTo(circuit, m.id, p).map((l) => moduleLabel(l.m)) }))
      .filter((s) => s.loads.length > 0);
    const contact = contactKind(m, pin);
    return {
      label: `${moduleLabel(m)} ${unit}${def.label}`,
      moduleId: m.id,
      type: m.type,
      ...(contact ? { contact } : {}),
      ...(switches.length ? { switches } : {}),
    };
  });
}

/** Just the labels of `partsOn`. */
export const devicesOn = (circuit: Circuit, moduleId: string, pinId: string): string[] =>
  partsOn(circuit, moduleId, pinId).map((p) => p.label);

/** Every I, Q, M and T bit of one PLC right now, for the live ladder view. */
export function plcBits(circuit: Circuit, result: SimResult, moduleId: string): Record<string, boolean> {
  const bits: Record<string, boolean> = {};
  for (const i of PLC_INPUTS) bits[i] = !!result.nets[result.pinNet[pinKey(moduleId, i)]]?.hot;
  for (const q of [...PLC_COILS, ...PLC_TIMERS]) bits[q] = !!result.actuated[`${moduleId}.${q}`];
  return bits;
}
