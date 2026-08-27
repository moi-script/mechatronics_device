'use client';

import { useMemo } from 'react';
import type { EndRef, WireEnd } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { STACK_DY, WIRE_HEX, endPos, wirePath } from '@/lib/geometry';

/** The exposed male on top of a plugged wire end, ready to be stacked onto. */
function Male({ x, y, wireId, end, taken }: { x: number; y: number; wireId: string; end: WireEnd; taken: boolean }) {
  const pending = useBoard((s) => s.pending);
  if (taken) return null;

  const ref: EndRef = { kind: 'stack', wireId, end };
  return (
    <g
      onPointerDown={(e) => {
        e.stopPropagation();
        const board = useBoard.getState();
        if (board.pending) board.completeWire(ref);
        else board.startWire(ref);
      }}
      style={{ cursor: 'crosshair' }}
    >
      {pending && <circle cx={x} cy={y - STACK_DY} r={13} fill="#0891b2" opacity={0.16} />}
      <rect x={x - 3} y={y - STACK_DY} width={6} height={STACK_DY} rx={2} fill="url(#brass)" stroke="#78350f" strokeWidth={0.75} />
    </g>
  );
}

export function Wires() {
  const circuit = useBoard((s) => s.circuit);
  const selectedWireId = useBoard((s) => s.selectedWireId);
  const selectWire = useBoard((s) => s.selectWire);
  const pending = useBoard((s) => s.pending);
  const cursor = useBoard((s) => s.cursor);
  const wireColor = useBoard((s) => s.wireColor);

  const takenMales = useMemo(() => {
    const set = new Set<string>();
    for (const w of circuit.wires) {
      for (const ref of [w.a, w.b]) {
        if (ref.kind === 'stack') set.add(ref.wireId + '.' + ref.end);
      }
    }
    return set;
  }, [circuit.wires]);

  const ends = useMemo(
    () =>
      circuit.wires.map((w) => ({
        wire: w,
        a: endPos(circuit, w.a),
        b: endPos(circuit, w.b),
        plugged: { a: w.a.kind !== 'loose', b: w.b.kind !== 'loose' },
      })),
    [circuit],
  );

  return (
    <g>
      {ends.map(({ wire, a, b }) => {
        const d = wirePath(a, b);
        const selected = wire.id === selectedWireId;
        return (
          <g key={wire.id}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                selectWire(selected ? null : wire.id);
              }}
            />
            <path d={d} fill="none" stroke="#94a3b8" strokeWidth={7} opacity={0.5} strokeLinecap="round" />
            <path
              d={d}
              fill="none"
              stroke={WIRE_HEX[wire.color]}
              strokeWidth={selected ? 6 : 4.5}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {selected && <path d={d} fill="none" stroke="#0f172a" strokeWidth={1.5} strokeDasharray="6 6" pointerEvents="none" />}
          </g>
        );
      })}

      {ends.map(({ wire, a, b, plugged }) => (
        <g key={wire.id + '-plugs'}>
          <circle cx={a.x} cy={a.y} r={5.5} fill={WIRE_HEX[wire.color]} stroke="#f8fafc" strokeWidth={1.5} pointerEvents="none" />
          <circle cx={b.x} cy={b.y} r={5.5} fill={WIRE_HEX[wire.color]} stroke="#f8fafc" strokeWidth={1.5} pointerEvents="none" />
          {plugged.a && <Male x={a.x} y={a.y} wireId={wire.id} end="A" taken={takenMales.has(wire.id + '.A')} />}
          {plugged.b && <Male x={b.x} y={b.y} wireId={wire.id} end="B" taken={takenMales.has(wire.id + '.B')} />}
        </g>
      ))}

      {pending && (
        <g pointerEvents="none">
          <path
            d={wirePath(endPos(circuit, pending), cursor)}
            fill="none"
            stroke={WIRE_HEX[wireColor]}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.75}
            strokeDasharray="10 6"
          />
          <circle cx={cursor.x} cy={cursor.y} r={5} fill={WIRE_HEX[wireColor]} />
        </g>
      )}
    </g>
  );
}
