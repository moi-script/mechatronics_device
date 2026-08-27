import type { Circuit, EndRef, WireEnd } from './types';
import { endKey } from './parts';

type StackRef = Extract<EndRef, { kind: 'stack' }>;

export interface ConnectCheck {
  ok: boolean;
  reason?: string;
}

const sameEnd = (ref: EndRef, wireId: string, end: WireEnd): boolean =>
  ref.kind === 'stack' && ref.wireId === wireId && ref.end === end;

/** True when another end's female already occupies this end's male. */
export function isMaleOccupied(circuit: Circuit, wireId: string, end: WireEnd, ignoreWireId?: string): boolean {
  return circuit.wires.some(
    (w) => w.id !== ignoreWireId && (sameEnd(w.a, wireId, end) || sameEnd(w.b, wireId, end)),
  );
}

/**
 * A wire end's female may go onto a component post or onto another end's male.
 * One male hosts exactly one female, and a chain may never loop back on itself.
 */
export function canConnect(circuit: Circuit, wireId: string, end: WireEnd, target: EndRef): ConnectCheck {
  if (target.kind === 'loose') return { ok: true };

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
