import type { Circuit, EndRef, PinRole, WireEnd, WireKind } from './types';
import { PARTS, endKey } from './parts';

/** The role of the post a terminal ref points at, if it exists. */
export function roleAt(circuit: Circuit, ref: EndRef): PinRole | null {
  if (ref.kind !== 'terminal') return null;
  const m = circuit.modules.find((x) => x.id === ref.moduleId);
  return (m && PARTS[m.type].pins.find((p) => p.id === ref.pinId)?.role) ?? null;
}

/** What runs from a starting point: tubing out of an air fitting, a lead from anything else. */
export const kindFrom = (circuit: Circuit, ref: EndRef): WireKind => (roleAt(circuit, ref) === 'AIR' ? 'tube' : 'lead');

type StackRef = Extract<EndRef, { kind: 'stack' }>;

export interface ConnectCheck {
  ok: boolean;
  reason?: string;
}

const sameEnd = (ref: EndRef, wireId: string, end: WireEnd): boolean =>
  ref.kind === 'stack' && ref.wireId === wireId && ref.end === end;

/** True when another end's female already occupies this end's male. */
export function isMaleOccupied(circuit: Circuit, wireId: string, end: WireEnd, ignoreWireId?: string): boolean {
  return circuit.wires.some((w) => w.id !== ignoreWireId && (sameEnd(w.a, wireId, end) || sameEnd(w.b, wireId, end)));
}

/**
 * A wire end's female may go onto a component post or onto another end's male.
 * One male hosts exactly one female, and a chain may never loop back on itself.
 */
export function canConnect(
  circuit: Circuit,
  wireId: string,
  end: WireEnd,
  target: EndRef,
  kind: WireKind = 'lead',
): ConnectCheck {
  if (target.kind === 'loose') return { ok: true };

  // Tubing and leads never mix: a push-in fitting takes one tube, a post takes plugs.
  const air = roleAt(circuit, target) === 'AIR';
  if (kind === 'tube') {
    if (!air || target.kind !== 'terminal')
      return { ok: false, reason: 'Air tubing only pushes into a pneumatic fitting.' };
    const taken = circuit.wires.some(
      (w) =>
        w.id !== wireId &&
        w.kind === 'tube' &&
        [w.a, w.b].some((e) => e.kind === 'terminal' && e.moduleId === target.moduleId && e.pinId === target.pinId),
    );
    if (taken) return { ok: false, reason: 'That fitting already holds a tube.' };
    return { ok: true };
  }
  if (air) return { ok: false, reason: 'That is an air fitting - it takes tubing, not a lead.' };
  if (target.kind === 'stack' && circuit.wires.find((w) => w.id === target.wireId)?.kind === 'tube') {
    return { ok: false, reason: 'A lead cannot stack onto air tubing.' };
  }

  if (target.kind === 'stack') {
    if (target.wireId === wireId) {
      return { ok: false, reason: 'A wire cannot plug into itself.' };
    }
    if (isMaleOccupied(circuit, target.wireId, target.end, wireId)) {
      return { ok: false, reason: 'That connector is already taken — stack onto the lead above it instead.' };
    }
    // Walk the chain the target hangs from; reaching ourselves would be a loop.
    const seen = new Set<string>([endKey(wireId, end)]);
    let cursor: EndRef = target;
    while (cursor.kind === 'stack') {
      const link: StackRef = cursor;
      const key = endKey(link.wireId, link.end);
      if (seen.has(key)) return { ok: false, reason: 'That would plug a chain of leads back into itself.' };
      seen.add(key);
      const host = circuit.wires.find((w) => w.id === link.wireId);
      if (!host) break;
      cursor = link.end === 'A' ? host.a : host.b;
    }
  }

  return { ok: true };
}
