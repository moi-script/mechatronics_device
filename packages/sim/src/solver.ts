import { PARTS, pinKey, endKey, moduleLabel, timerDelayMs } from './parts';
import type {
  Circuit,
  DeviceState,
  EndRef,
  Inputs,
  ModuleInstance,
  NetInfo,
  PartDef,
  SimError,
  SimResult,
  SimState,
  PistonState,
  TimerState,
} from './types';

const MAX_PASSES = 50;

class DisjointSet {
  private parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    this.add(key);
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression.
    let cur = key;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  keys(): string[] {
    return [...this.parent.keys()];
  }
}

/** The node key an end plugs into, or null when it dangles. */
function endTarget(ref: EndRef): string | null {
  if (ref.kind === 'terminal') return pinKey(ref.moduleId, ref.pinId);
  if (ref.kind === 'stack') return endKey(ref.wireId, ref.end);
  return null;
}

interface Pass {
  nets: NetInfo[];
  pinNet: Record<string, number>;
  wireNet: Record<string, number>;
  coil: Record<string, boolean>;
  shortedNets: number[];
  reversed: { moduleId: string; pinId: string; onGround: boolean }[];
}

/** Actuator key: "" is the module itself, anything else a named sub-unit. */
const actKey = (moduleId: string, actuator: string): string => (actuator ? `${moduleId}.${actuator}` : moduleId);

/** How long a pneumatic stroke takes before the reed sensors see the piston arrive. */
export const STROKE_MS = 700;

/**
 * Every coil a part carries. Most have the one VCC/GND pair; the double-acting
 * cylinder names its two so they can be told apart.
 */
const coilsOf = (part: PartDef): { id: string; vcc: string; gnd: string }[] =>
  part.coils ?? (part.hasCoil ? [{ id: '', vcc: 'VCC', gnd: 'GND' }] : []);

/** The plain coil is keyed by module id; named ones by "moduleId.coilId". */
const coilKey = (moduleId: string, coilId: string): string => (coilId ? `${moduleId}.${coilId}` : moduleId);

/** One electrical evaluation with the contacts frozen in the given positions. */
function evaluate(circuit: Circuit, breakerClosed: boolean, actuated: Record<string, boolean>): Pass {
  const dsu = new DisjointSet();

  for (const m of circuit.modules) {
    for (const p of PARTS[m.type].pins) if (p.role !== 'AIR') dsu.add(pinKey(m.id, p.id));
  }

  for (const w of circuit.wires) {
    if (w.kind === 'tube') continue;
    const a = endKey(w.id, 'A');
    const b = endKey(w.id, 'B');
    dsu.union(a, b); // the wire itself conducts
    const ta = endTarget(w.a);
    const tb = endTarget(w.b);
    if (ta) dsu.union(a, ta);
    if (tb) dsu.union(b, tb);
  }

  // Contacts: COM conducts to NC at rest, to NO when thrown.
  for (const m of circuit.modules) {
    const part = PARTS[m.type];
    for (let line = 1; line <= part.contactLines; line++) {
      const other = actuated[m.id] ? `NO${line}` : `NC${line}`;
      dsu.union(pinKey(m.id, `COM${line}`), pinKey(m.id, other));
    }
    // The timer has no NO/NC pair: its COM is fed from its own VCC terminal
    // once the timer has picked up, and floats while it sits at rest.
    if (m.type === 'TIMER' && actuated[m.id]) {
      dsu.union(pinKey(m.id, 'COM1'), pinKey(m.id, 'VCC'));
    }
    for (const bus of part.buses ?? []) {
      for (const id of bus.slice(1)) dsu.union(pinKey(m.id, bus[0]), pinKey(m.id, id));
    }
    for (const s of part.switches ?? []) {
      if (!!actuated[actKey(m.id, s.actuator)] === s.closedWhen) {
        dsu.union(pinKey(m.id, s.pins[0]), pinKey(m.id, s.pins[1]));
      }
    }
    for (const c of part.changeovers ?? []) {
      dsu.union(pinKey(m.id, c.com), pinKey(m.id, actuated[actKey(m.id, c.actuator)] ? c.no : c.nc));
    }
  }

  const rootToNet = new Map<string, number>();
  const nets: NetInfo[] = [];
  const netOf = (key: string): number => {
    const root = dsu.find(key);
    let id = rootToNet.get(root);
    if (id === undefined) {
      id = nets.length;
      rootToNet.set(root, id);
      nets.push({ id, hot: false, gnd: false, nodes: [] });
    }
    return id;
  };

  for (const key of dsu.keys()) nets[netOf(key)].nodes.push(key);

  const pinNet: Record<string, number> = {};
  for (const m of circuit.modules) {
    for (const p of PARTS[m.type].pins) {
      if (p.role === 'AIR') continue;
      const key = pinKey(m.id, p.id);
      const id = netOf(key);
      pinNet[key] = id;
      if (!breakerClosed) continue;
      if (p.role === 'SOURCE_VCC') nets[id].hot = true;
      if (p.role === 'SOURCE_GND') nets[id].gnd = true;
    }
  }

  const wireNet: Record<string, number> = {};
  for (const w of circuit.wires) if (w.kind !== 'tube') wireNet[w.id] = netOf(endKey(w.id, 'A'));

  const shortedNets = nets.filter((n) => n.hot && n.gnd).map((n) => n.id);

  const coil: Record<string, boolean> = {};
  const reversed: Pass['reversed'] = [];
  for (const m of circuit.modules) {
    for (const c of coilsOf(PARTS[m.type])) {
      const vcc = nets[pinNet[pinKey(m.id, c.vcc)]];
      const gnd = nets[pinNet[pinKey(m.id, c.gnd)]];
      coil[coilKey(m.id, c.id)] = shortedNets.length === 0 && vcc.hot && gnd.gnd;
      if (vcc.gnd && !vcc.hot) reversed.push({ moduleId: m.id, pinId: c.vcc, onGround: true });
      if (gnd.hot && !gnd.gnd) reversed.push({ moduleId: m.id, pinId: c.gnd, onGround: false });
    }
  }

  return { nets, pinNet, wireNet, coil, shortedNets, reversed };
}

/**
 * When a timer's count started: the instant carried over from the last step if
 * its coil was already live, otherwise now. Dropping the coil clears it.
 */
const timerStartOf = (
  m: ModuleInstance,
  coilOn: boolean,
  prevStart: Record<string, number>,
  now: number,
): number | null => (coilOn ? (prevStart[m.id] ?? now) : null);

/** Contact position each part takes for a given coil / input state. */
function actuationFor(
  m: ModuleInstance,
  inputs: Inputs,
  coil: Record<string, boolean>,
  prevStart: Record<string, number>,
): boolean {
  switch (m.type) {
    case 'PUSHBTN':
      return !!inputs.pressed[m.id];
    case 'TOGGLE':
      return !!inputs.toggled[m.id];
    case 'RELAY':
    case 'BIGRELAY':
      return !!coil[m.id];
    case 'TIMER':
    case 'TMRRELAY': {
      // On-delay: the contact only makes once the coil has been held for the
      // whole set point. The start instant is fixed for this step, so the
      // feedback loop below still settles.
      const start = timerStartOf(m, !!coil[m.id], prevStart, inputs.now);
      return start !== null && inputs.now - start >= timerDelayMs(m);
    }
    default:
      return false;
  }
}

/**
 * Every actuator one module owns: the module itself for the original parts,
 * plus named sub-units on the Festech panels — each button of the push-button
 * unit, each relay of the relay unit, the piston position a cylinder's reed
 * sensors read.
 */
function actuatorsFor(
  m: ModuleInstance,
  inputs: Inputs,
  coil: Record<string, boolean>,
  prevStart: Record<string, number>,
  sensedRod: Record<string, boolean>,
  out: Record<string, boolean>,
): void {
  switch (m.type) {
    case 'FT_PBU':
      for (const b of ['B1', 'B2', 'B3']) out[actKey(m.id, b)] = !!inputs.pressed[actKey(m.id, b)];
      return;
    case 'FT_RELAY3':
      for (const r of ['R1', 'R2', 'R3']) out[actKey(m.id, r)] = !!coil[coilKey(m.id, r)];
      return;
    case 'FT_LIMIT': {
      // Bolted to a stroke, the rod throws it by arriving: the switch at the
      // home end is made while the rod is back, the one at the far end while
      // it is out. A loose switch is still pressed by hand.
      const mount = m.mount;
      if (mount) {
        const rodOut = !!sensedRod[mount.cylinderId];
        out[m.id] = mount.at === 'out' ? rodOut : !rodOut;
        return;
      }
      out[m.id] = !!inputs.pressed[m.id];
      return;
    }
    case 'FT_CYL':
    case 'FT_SCYL':
      // The sensors read where the piston has actually got to, which is not
      // where it is headed until a full stroke has gone by.
      out[actKey(m.id, 'EXT')] = !!sensedRod[m.id];
      return;
    default:
      out[m.id] = actuationFor(m, inputs, coil, prevStart);
  }
}

const actuationMap = (
  circuit: Circuit,
  inputs: Inputs,
  coil: Record<string, boolean>,
  prevStart: Record<string, number>,
  sensedRod: Record<string, boolean>,
): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const m of circuit.modules) actuatorsFor(m, inputs, coil, prevStart, sensedRod, out);
  return out;
};

/**
 * The air side of the bench. Fittings joined by tubing, and the passages each
 * valve spool opens, form air nets; a net fed from the distributor is under
 * pressure and anything else is open to exhaust.
 */
function solveAir(
  circuit: Circuit,
  valves: Record<string, boolean>,
): { air: Record<string, boolean>; tubeAir: Record<string, boolean> } {
  const dsu = new DisjointSet();
  for (const m of circuit.modules) {
    for (const p of PARTS[m.type].pins) if (p.role === 'AIR') dsu.add(pinKey(m.id, p.id));
  }
  for (const w of circuit.wires) {
    if (w.kind !== 'tube' || w.a.kind !== 'terminal' || w.b.kind !== 'terminal') continue;
    dsu.union(pinKey(w.a.moduleId, w.a.pinId), pinKey(w.b.moduleId, w.b.pinId));
  }
  for (const m of circuit.modules) {
    const k = (id: string) => pinKey(m.id, id);
    const shifted = !!valves[m.id];
    if (m.type === 'FT_V52S' || m.type === 'FT_V52D') dsu.union(k('A1'), k(shifted ? 'A4' : 'A2'));
    if (m.type === 'FT_V32' && shifted) dsu.union(k('A1'), k('A2'));
  }
  const fed = new Set<string>();
  for (const m of circuit.modules) {
    if (!PARTS[m.type].airSource) continue;
    for (const p of PARTS[m.type].pins) if (p.role === 'AIR') fed.add(dsu.find(pinKey(m.id, p.id)));
  }
  const air: Record<string, boolean> = {};
  for (const key of dsu.keys()) air[key] = fed.has(dsu.find(key));
  const tubeAir: Record<string, boolean> = {};
  for (const w of circuit.wires) {
    if (w.kind === 'tube' && w.a.kind === 'terminal') tubeAir[w.id] = !!air[pinKey(w.a.moduleId, w.a.pinId)];
  }
  return { air, tubeAir };
}

const sameActuation = (a: Record<string, boolean>, b: Record<string, boolean>): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

/**
 * Solve the board. Pure: same inputs, same result. Relay feedback is resolved
 * by re-solving until the contacts stop moving.
 */
export function step(circuit: Circuit, inputs: Inputs, prev: SimState): SimResult {
  const labelOf = (id: string): string => {
    const m = circuit.modules.find((x) => x.id === id);
    return m ? moduleLabel(m) : id;
  };

  const prevStart = prev.timerStart ?? {};
  let coil = { ...prev.coil };
  const prevRod = prev.rod ?? {};
  const prevRodAt = prev.rodAt ?? {};

  /**
   * Where the reed sensors think each piston is. A rod that set off less than
   * a stroke ago has not reached the far sensor yet, so it still reads at the
   * end it left — which is what keeps a sensor-stepped sequence running at the
   * speed of the rods instead of the speed of the solver.
   */
  const sensedRod: Record<string, boolean> = {};
  for (const m of circuit.modules) {
    if (m.type !== 'FT_CYL' && m.type !== 'FT_SCYL') continue;
    const was = !!prevRod[m.id];
    const at = prevRodAt[m.id];
    sensedRod[m.id] = at === undefined || inputs.now - at >= STROKE_MS ? was : !was;
  }

  let actuated = actuationMap(circuit, inputs, coil, prevStart, sensedRod);

  let pass = evaluate(circuit, inputs.breakerClosed, actuated);
  for (let i = 0; i < MAX_PASSES; i++) {
    if (pass.shortedNets.length > 0) break;
    const next = actuationMap(circuit, inputs, pass.coil, prevStart, sensedRod);
    if (sameActuation(next, actuated)) break;
    actuated = next;
    pass = evaluate(circuit, inputs.breakerClosed, actuated);
  }
  coil = pass.coil;

  const faulted = pass.shortedNets.length > 0;
  const errors: SimError[] = [];

  for (const netId of pass.shortedNets) {
    errors.push({
      code: 'SHORT_CIRCUIT',
      netId,
      message: `Short circuit on net ${netId}: a supply pin and a ground pin are on the same net with no load between them. Breaker tripped.`,
    });
  }

  const seen = new Set<string>();
  for (const r of pass.reversed) {
    const key = `${r.moduleId}.${r.pinId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rail = r.onGround ? 'a ground net' : 'a supply net';
    errors.push({
      code: 'REVERSED_POLARITY',
      moduleId: r.moduleId,
      pinId: r.pinId,
      message: `Reversed polarity: ${labelOf(r.moduleId)} ${r.pinId} is wired to ${rail}.`,
    });
  }

  const devices: Record<string, DeviceState> = {};
  for (const m of circuit.modules) {
    const live = coilsOf(PARTS[m.type]).some((c) => coil[coilKey(m.id, c.id)]);
    devices[m.id] = {
      energized: faulted ? false : live,
      actuated: faulted ? false : !!actuated[m.id],
    };
  }

  // Cylinders: one solenoid drives the rod out, the other pulls it back. With
  // both or neither energized the valve stays put, so the rod holds where it
  // was left — which is why the position has to be carried between steps.
  const rod: Record<string, boolean> = {};
  const pistons: Record<string, PistonState> = {};
  for (const m of circuit.modules) {
    if (m.type !== 'CYLINDER') continue;
    const extendCoil = !faulted && !!coil[coilKey(m.id, 'EXT')];
    const retractCoil = !faulted && !!coil[coilKey(m.id, 'RET')];
    const was = prev.rod?.[m.id] ?? false;
    const extended = extendCoil === retractCoil ? was : extendCoil;
    rod[m.id] = extended;
    pistons[m.id] = { extended, extendCoil, retractCoil, stalled: extendCoil && retractCoil };
  }

  // Valves: a single-solenoid spool follows its coil and springs back; the
  // double-solenoid spool goes where the last lone coil sent it and stays.
  const prevValve = prev.valve ?? {};
  const valves: Record<string, boolean> = {};
  const valve: Record<string, boolean> = {};
  for (const m of circuit.modules) {
    const on = (id: string) => !faulted && !!coil[coilKey(m.id, id)];
    if (m.type === 'FT_V52S' || m.type === 'FT_V32') valves[m.id] = on('Y');
    if (m.type === 'FT_V52D') {
      const y14 = on('Y14');
      const y12 = on('Y12');
      valves[m.id] = y14 === y12 ? !!prevValve[m.id] : y14;
      valve[m.id] = valves[m.id];
    }
  }

  // Pneumatic cylinders move on whichever port is under pressure. A stroke
  // that starts now is reported to the sensors on a follow-up tick.
  const { air, tubeAir } = solveAir(circuit, valves);
  const rodAt: Record<string, number> = {};
  // How long until the rod furthest from its destination gets there.
  let strokeLeft: number | null = null;
  for (const m of circuit.modules) {
    if (m.type !== 'FT_CYL' && m.type !== 'FT_SCYL') continue;
    const a = !!air[pinKey(m.id, 'A')];
    const b = !!air[pinKey(m.id, 'B')];
    const was = prevRod[m.id] ?? false;
    // The single-acting rod has no B port: its spring returns it whenever A vents.
    const extended = m.type === 'FT_SCYL' ? a : a === b ? was : a;
    // A rod that has just set off starts its stroke now; one that was already
    // on its way keeps the instant it left, so the clock is not restarted by
    // every re-solve. A rod standing still is a stroke old and fully sensed.
    const at = extended !== was ? inputs.now : (prevRodAt[m.id] ?? inputs.now - STROKE_MS);
    rodAt[m.id] = at;
    const left = STROKE_MS - (inputs.now - at);
    if (left > 0) strokeLeft = strokeLeft === null ? left : Math.min(strokeLeft, left);
    rod[m.id] = extended;
    pistons[m.id] = { extended, extendCoil: a, retractCoil: b, stalled: a && b };
  }

  // Carry each running timer's start instant forward, and report the countdown.
  const timerStart: Record<string, number> = {};
  const timers: Record<string, TimerState> = {};
  let nextTickMs: number | null = null;
  for (const m of circuit.modules) {
    if (m.type !== 'TIMER' && m.type !== 'TMRRELAY') continue;
    const delayMs = timerDelayMs(m);
    const start = faulted ? null : timerStartOf(m, !!coil[m.id], prevStart, inputs.now);
    if (start !== null) timerStart[m.id] = start;
    const done = !faulted && !!actuated[m.id];
    const remainingMs = start === null || done ? (done ? 0 : delayMs) : Math.max(0, delayMs - (inputs.now - start));
    const running = start !== null && !done;
    timers[m.id] = { delayMs, remainingMs, running, done };
    // The board changes by itself when this one times out, so say when.
    if (running) nextTickMs = nextTickMs === null ? remainingMs : Math.min(nextTickMs, remainingMs);
  }
  if (strokeLeft !== null) nextTickMs = nextTickMs === null ? strokeLeft : Math.min(nextTickMs, strokeLeft);

  return {
    nets: pass.nets,
    pinNet: pass.pinNet,
    wireNet: pass.wireNet,
    devices,
    pistons,
    timers,
    nextTickMs,
    actuated: faulted ? {} : actuated,
    coils: faulted ? {} : coil,
    air,
    tubeAir,
    valves,
    errors,
    faulted,
    state: { coil: faulted ? {} : coil, timerStart: faulted ? {} : timerStart, rod, rodAt, valve },
  };
}
