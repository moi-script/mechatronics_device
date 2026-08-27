import { PARTS, type Circuit, type EndRef, type WireColor } from '@mech/sim';

export interface Point {
  x: number;
  y: number;
}

export const BOARD_W = 2010;
export const BOARD_H = 920;

/** Vertical rise of each stacked lead, so a tower of plugs is visible. */
export const STACK_DY = 13;

/** Lead colours, picked to stay legible against the light board. */
export const WIRE_HEX: Record<WireColor, string> = {
  blue: '#1d4ed8',
  green: '#15803d',
  red: '#dc2626',
  black: '#1e293b',
  yellow: '#ca8a04',
};

export function pinPos(circuit: Circuit, moduleId: string, pinId: string): Point {
  const m = circuit.modules.find((x) => x.id === moduleId);
  if (!m) return { x: 0, y: 0 };
  const p = PARTS[m.type].pins.find((x) => x.id === pinId);
  if (!p) return { x: m.x, y: m.y };
  return { x: m.x + p.x, y: m.y + p.y };
}

/** Where a wire end physically sits, following any stack of leads beneath it. */
export function endPos(circuit: Circuit, ref: EndRef, depth = 0): Point {
  if (ref.kind === 'loose') return { x: ref.x, y: ref.y };
  if (ref.kind === 'terminal') return pinPos(circuit, ref.moduleId, ref.pinId);
  if (depth > 24) return { x: 0, y: 0 };
  const host = circuit.wires.find((w) => w.id === ref.wireId);
  if (!host) return { x: 0, y: 0 };
  const below = endPos(circuit, ref.end === 'A' ? host.a : host.b, depth + 1);
  return { x: below.x, y: below.y - STACK_DY };
}

/** A lead hangs between its two ends rather than running straight. */
export function wirePath(a: Point, b: Point): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sag = Math.min(150, Math.hypot(dx, dy) * 0.38) + 18;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y + sag}, ${b.x} ${b.y}`;
}

export const sameRef = (a: EndRef | null, b: EndRef | null): boolean => {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'terminal' && b.kind === 'terminal') return a.moduleId === b.moduleId && a.pinId === b.pinId;
  if (a.kind === 'stack' && b.kind === 'stack') return a.wireId === b.wireId && a.end === b.end;
  return false;
};
