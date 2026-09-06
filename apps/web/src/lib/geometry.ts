import { PARTS, type Circuit, type EndRef, type Wire } from '@mech/sim';

export interface Point {
  x: number;
  y: number;
}

export const BOARD_W = 2010;
export const BOARD_H = 2010;

/** Spacing of the bench ruling, in board units. */
export const GRID_MINOR = 50;
export const GRID_MAJOR = 250;

/**
 * How much bench answers to a click on empty space around the plate. It is not
 * a boundary: the canvas draws past it and panning is unlimited, so this only
 * decides how far out a marquee drag or a click-to-deselect still lands.
 */
export const CANVAS_PAD = 4000;
export const CANVAS_W = BOARD_W + CANVAS_PAD * 2;
export const CANVAS_H = BOARD_H + CANVAS_PAD * 2;

/** Vertical rise of each stacked lead, so a tower of plugs is visible. */
export const STACK_DY = 13;

/** Lead colours, picked to stay legible against the light board. */
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

/**
 * The terminal a wire end finally lands on, following any stack of leads
 * beneath it. A loose end lands nowhere and gives back null.
 */
export function endTerminal(
  wires: Wire[],
  ref: EndRef,
  depth = 0,
): { moduleId: string; pinId: string } | null {
  if (ref.kind === 'terminal') return { moduleId: ref.moduleId, pinId: ref.pinId };
  if (ref.kind === 'loose' || depth > 24) return null;
  const host = wires.find((w) => w.id === ref.wireId);
  if (!host) return null;
  return endTerminal(wires, ref.end === 'A' ? host.a : host.b, depth + 1);
}

/**
 * What a selected lead puts the board's attention on: the two modules it joins
 * and the two terminals it lands on. Everything else is drawn back.
 */
export interface WireFocus {
  modules: Set<string>;
  /** Terminals as `moduleId.pinId`. */
  pins: Set<string>;
}

export function wireFocus(wires: Wire[], wireId: string | null): WireFocus | null {
  if (!wireId) return null;
  const wire = wires.find((w) => w.id === wireId);
  if (!wire) return null;
  const focus: WireFocus = { modules: new Set(), pins: new Set() };
  for (const ref of [wire.a, wire.b]) {
    const t = endTerminal(wires, ref);
    if (!t) continue;
    focus.modules.add(t.moduleId);
    focus.pins.add(t.moduleId + '.' + t.pinId);
  }
  return focus;
}
