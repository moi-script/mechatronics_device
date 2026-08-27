'use client';

import { useMemo } from 'react';
import type { EndRef, WireEnd } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { STACK_DY, endPos, wirePath } from '@/lib/geometry';
import { usePalette, useWireColors, useWireHighlights } from '@/store/useTheme';

/** The exposed male on top of a plugged lead, ready for another to stack on it. */
function Male({ x, y, wireId, end, taken }: { x: number; y: number; wireId: string; end: WireEnd; taken: boolean }) {
  const pending = useBoard((s) => s.pending);
  const p = usePalette();
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
      <rect
        x={x - 3}
        y={y - STACK_DY}
        width={6}
        height={STACK_DY}
        rx={1.5}
        fill="url(#brass)"
        stroke={p.plugPin}
        strokeWidth={0.6}
      />
      <rect x={x - 3} y={y - STACK_DY} width={2} height={STACK_DY} fill="#ffffff" opacity={0.35} />
    </g>
  );
}

/** A banana plug: a coloured insulator boot over a brass pin. */
function Plug({ x, y, color }: { x: number; y: number; color: string }) {
  const p = usePalette();
  return (
    <g pointerEvents="none">
      <rect x={x - 6} y={y - 3} width={12} height={15} rx={3} fill={color} />
      <rect x={x - 6} y={y - 3} width={4} height={15} rx={2} fill="#ffffff" opacity={0.28} />
      <circle cx={x} cy={y} r={4.5} fill="url(#brass)" stroke={p.plugPin} strokeWidth={0.6} />
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
  const WIRE_HEX = useWireColors();
  const WIRE_HI = useWireHighlights();

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
              strokeWidth={18}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                selectWire(selected ? null : wire.id);
              }}
            />
            {/* Round cable: a shaded core with a lengthwise highlight along the top. */}
            <path
              d={d}
              fill="none"
              stroke={WIRE_HEX[wire.color]}
              strokeWidth={selected ? 7 : 5.5}
              strokeLinecap="round"
              filter="url(#cable)"
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke={WIRE_HI[wire.color]}
              strokeWidth={selected ? 2 : 1.6}
              strokeLinecap="round"
              opacity={0.75}
              transform="translate(0,-1.2)"
              pointerEvents="none"
            />
            {selected && (
              <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeDasharray="5 7" pointerEvents="none" />
            )}
          </g>
        );
      })}

      {ends.map(({ wire, a, b, plugged }) => (
        <g key={wire.id + '-plugs'}>
          <Plug x={a.x} y={a.y} color={WIRE_HEX[wire.color]} />
          <Plug x={b.x} y={b.y} color={WIRE_HEX[wire.color]} />
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
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.8}
            strokeDasharray="12 7"
          />
          <Plug x={cursor.x} y={cursor.y} color={WIRE_HEX[wireColor]} />
        </g>
      )}
    </g>
  );
}
