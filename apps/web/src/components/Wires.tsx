'use client';

import { useMemo } from 'react';
import { PARTS, moduleLabel, type EndRef, type WireEnd } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { STACK_DY, endPos, endTerminal, wirePath } from '@/lib/geometry';
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

/** How far back everything the picked lead does not touch is drawn. */
const DIM = 0.16;

/** A small engraved tag naming the terminal a picked lead's end sits on. */
function EndTag({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const p = usePalette();
  // The board draws no text metrics, so the plate is sized off the string.
  const w = text.length * 5.9 + 18;
  return (
    <g transform={`translate(${x},${y - 34})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <path d={`M 0 6 L -4.5 -1 H 4.5 Z`} fill={p.titleBar} />
      <rect x={-w / 2} y={-19} width={w} height={20} rx={4} fill={p.titleBar} />
      <rect x={-w / 2} y={-19} width={3.5} height={20} rx={1.5} fill={color} />
      <text
        className="t-mono"
        x={0}
        y={-5}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={600}
        letterSpacing={0.4}
        fill={p.titleBarText}
      >
        {text}
      </text>
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

  /**
   * What the picked lead joins, in the words printed on the panel: the module's
   * legend and the terminal's own marking, at each end.
   */
  const tags = useMemo(() => {
    const picked = ends.find((e) => e.wire.id === selectedWireId);
    if (!picked) return [];
    return (['a', 'b'] as const).map((end) => {
      const ref = end === 'a' ? picked.wire.a : picked.wire.b;
      const t = endTerminal(circuit.wires, ref);
      const m = t && circuit.modules.find((x) => x.id === t.moduleId);
      const pin = m && t ? PARTS[m.type].pins.find((x) => x.id === t.pinId) : null;
      const text = m && pin ? moduleLabel(m).toUpperCase() + ' · ' + pin.label : 'LOOSE END';
      const at = picked[end];
      return { key: picked.wire.id + end, x: at.x, y: at.y, text, color: WIRE_HEX[picked.wire.color] };
    });
  }, [ends, circuit, selectedWireId, WIRE_HEX]);

  /** Everything a selected lead does not touch is drawn back out of the way. */
  const faded = (id: string) => (selectedWireId && id !== selectedWireId ? DIM : 1);

  return (
    <g>
      {ends.map(({ wire, a, b }) => {
        const d = wirePath(a, b);
        const selected = wire.id === selectedWireId;
        return (
          <g key={wire.id} opacity={faded(wire.id)}>
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
            {/* A picked lead is lit from within, so it reads as the live one. */}
            {selected && (
              <path
                d={d}
                fill="none"
                stroke={WIRE_HEX[wire.color]}
                strokeWidth={8}
                strokeLinecap="round"
                filter="url(#cableGlow)"
                pointerEvents="none"
              />
            )}
            {/* Round cable: a shaded core with a lengthwise highlight along the top. */}
            <path
              d={d}
              fill="none"
              stroke={WIRE_HEX[wire.color]}
              strokeWidth={selected ? 7 : 5.5}
              strokeLinecap="round"
              filter={selected ? undefined : 'url(#cable)'}
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke={WIRE_HI[wire.color]}
              strokeWidth={selected ? 2.4 : 1.6}
              strokeLinecap="round"
              opacity={selected ? 0.95 : 0.75}
              transform="translate(0,-1.2)"
              pointerEvents="none"
            />
          </g>
        );
      })}

      {ends.map(({ wire, a, b, plugged }) => (
        <g key={wire.id + '-plugs'} opacity={faded(wire.id)}>
          <Plug x={a.x} y={a.y} color={WIRE_HEX[wire.color]} />
          <Plug x={b.x} y={b.y} color={WIRE_HEX[wire.color]} />
          {plugged.a && <Male x={a.x} y={a.y} wireId={wire.id} end="A" taken={takenMales.has(wire.id + '.A')} />}
          {plugged.b && <Male x={b.x} y={b.y} wireId={wire.id} end="B" taken={takenMales.has(wire.id + '.B')} />}
        </g>
      ))}

      {/* Both ends of the picked lead say, in words, what it joins. */}
      {tags.map((tag) => (
        <EndTag key={tag.key} x={tag.x} y={tag.y} text={tag.text} color={tag.color} />
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
