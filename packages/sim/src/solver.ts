import { PARTS, pinKey, endKey, moduleLabel } from './parts';
import type {
  Circuit,
  DeviceState,
  EndRef,
  Inputs,
  ModuleInstance,
  NetInfo,
  SimError,
  SimResult,
  SimState,
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
  reversed: { moduleId: string; pinId: string }[];
}

/** One electrical evaluation with the contacts frozen in the given positions. */
function evaluate(circuit: Circuit, breakerClosed: boolean, actuated: Record<string, boolean>): Pass {
  const dsu = new DisjointSet();

  for (const m of circuit.modules) {
    for (const p of PARTS[m.type].pins) dsu.add(pinKey(m.id, p.id));
  }

  for (const w of circuit.wires) {
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
      const key = pinKey(m.id, p.id);
      const id = netOf(key);
      pinNet[key] = id;
      if (!breakerClosed) continue;
      if (p.role === 'SOURCE_VCC') nets[id].hot = true;
      if (p.role === 'SOURCE_GND') nets[id].gnd = true;
    }
  }

  const wireNet: Record<string, number> = {};
  for (const w of circuit.wires) wireNet[w.id] = netOf(endKey(w.id, 'A'));

  const shortedNets = nets.filter((n) => n.hot && n.gnd).map((n) => n.id);

  const coil: Record<string, boolean> = {};
  const reversed: { moduleId: string; pinId: string }[] = [];
  for (const m of circuit.modules) {
    const part = PARTS[m.type];
    if (!part.hasCoil) continue;
    const vcc = nets[pinNet[pinKey(m.id, 'VCC')]];
    const gnd = nets[pinNet[pinKey(m.id, 'GND')]];
    coil[m.id] = shortedNets.length === 0 && vcc.hot && gnd.gnd;
    if (vcc.gnd && !vcc.hot) reversed.push({ moduleId: m.id, pinId: 'VCC' });
    if (gnd.hot && !gnd.gnd) reversed.push({ moduleId: m.id, pinId: 'GND' });
  }

  return { nets, pinNet, wireNet, coil, shortedNets, reversed };
}

/** Contact position each part takes for a given coil / input state. */
function actuationFor(m: ModuleInstance, inputs: Inputs, coil: Record<string, boolean>): boolean {
  switch (m.type) {
    case 'PUSHBTN':
      return !!inputs.pressed[m.id];
    case 'TOGGLE':
      return !!inputs.toggled[m.id];
    case 'RELAY':
    case 'BIGRELAY':
      return !!coil[m.id];
    default:
      return false;
  }
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

  let coil = { ...prev.coil };
  let actuated: Record<string, boolean> = {};
  for (const m of circuit.modules) {
    actuated[m.id] = actuationFor(m, inputs, coil);
  }

  let pass = evaluate(circuit, inputs.breakerClosed, actuated);
  for (let i = 0; i < MAX_PASSES; i++) {
    if (pass.shortedNets.length > 0) break;
    const next: Record<string, boolean> = {};
    for (const m of circuit.modules) {
      next[m.id] = actuationFor(m, inputs, pass.coil);
    }
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
    const rail = r.pinId === 'VCC' ? 'a ground net' : 'a supply net';
    errors.push({
      code: 'REVERSED_POLARITY',
      moduleId: r.moduleId,
      pinId: r.pinId,
      message: `Reversed polarity: ${labelOf(r.moduleId)} ${r.pinId} is wired to ${rail}.`,
    });
  }

  const devices: Record<string, DeviceState> = {};
  for (const m of circuit.modules) {
    devices[m.id] = {
      energized: faulted ? false : !!coil[m.id],
      actuated: faulted ? false : !!actuated[m.id],
    };
  }

  return {
    nets: pass.nets,
    pinNet: pass.pinNet,
    wireNet: pass.wireNet,
    devices,
    errors,
    faulted,
    state: { coil: faulted ? {} : coil },
  };
}
