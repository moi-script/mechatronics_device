'use client';

import { useCallback, useContext, useRef } from 'react';
import { PARTS, moduleLabel, type ModuleInstance, type PinDef } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { ScaleContext } from './ScaleContext';

const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Board palette, tuned for the light bench. */
const INK = '#0f172a';
const LABEL = '#64748b';
const CASE = '#e2e8f0';
const EDGE = '#94a3b8';
const HOT = '#ea580c';
const GND = '#0284c7';

function Terminal({ moduleId, pin }: { moduleId: string; pin: PinDef }) {
  const pending = useBoard((s) => s.pending);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const net = useBoard((s) => s.sim.nets[s.sim.pinNet[moduleId + '.' + pin.id]]);

  const ring = !live || !net ? EDGE : net.hot ? HOT : net.gnd ? GND : EDGE;
  const isSource = pending?.kind === 'terminal' && pending.moduleId === moduleId && pending.pinId === pin.id;

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const ref = { kind: 'terminal' as const, moduleId, pinId: pin.id };
    // Read live state: two clicks can land before React re-renders.
    const board = useBoard.getState();
    if (board.pending) board.completeWire(ref);
    else board.startWire(ref);
  };

  return (
    <g data-pin={moduleId + '.' + pin.id} onPointerDown={onDown} style={{ cursor: 'crosshair' }}>
      {pending && <circle cx={pin.x} cy={pin.y} r={16} fill="#0891b2" opacity={isSource ? 0.35 : 0.13} />}
      <circle cx={pin.x} cy={pin.y} r={9} fill="#f1f5f9" stroke="#cbd5e1" />
      <circle cx={pin.x} cy={pin.y} r={7} fill="url(#brass)" stroke={ring} strokeWidth={2.5} />
      <circle cx={pin.x} cy={pin.y} r={2.5} fill="#78350f" opacity={0.5} />
      <text
        x={pin.x}
        y={pin.y + 19}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill={LABEL}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {pin.label}
      </text>
    </g>
  );
}

function Led({ x, y, on, color = '#16a34a' }: { x: number; y: number; on: boolean; color?: string }) {
  return (
    <>
      {on && <circle cx={x} cy={y} r={11} fill={color} opacity={0.35} filter="url(#glow)" />}
      <circle cx={x} cy={y} r={5} fill={on ? color : CASE} stroke={EDGE} strokeWidth={1.25} />
    </>
  );
}

const Cap = ({ x, y, text, sub }: { x: number; y: number; text: string; sub?: string }) => (
  <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
    <text x={x} y={y} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK} letterSpacing={0.6}>
      {text}
    </text>
    {sub && (
      <text x={x} y={y + 14} textAnchor="middle" fontSize={9} fill={LABEL}>
        {sub}
      </text>
    )}
  </g>
);

/** The part-specific face drawn inside a module's shell. */
function Face({ m }: { m: ModuleInstance }) {
  const part = PARTS[m.type];
  const device = useBoard((s) => s.sim.devices[m.id]);
  const tripped = useBoard((s) => s.tripped);
  const breakerOn = useBoard((s) => s.breakerOn);
  const setBreaker = useBoard((s) => s.setBreaker);
  const holdButton = useBoard((s) => s.holdButton);
  const flipToggle = useBoard((s) => s.flipToggle);
  const toggled = useBoard((s) => !!s.toggled[m.id]);
  const pressed = useBoard((s) => !!s.pressed[m.id]);
  const delayMs = useBoard((s) => s.circuit.timerDelayMs);
  const elapsed = useBoard((s) => s.sim.state.timerElapsedMs[m.id] ?? 0);
  const w = part.width;

  switch (m.type) {
    case 'BREAKER': {
      const on = breakerOn && !tripped;
      return (
        <>
          <Cap x={w / 2} y={26} text="BREAKER" />
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              setBreaker(!breakerOn);
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={w / 2 - 22} y={44} width={44} height={72} rx={8} fill={CASE} stroke={EDGE} />
            <rect
              x={w / 2 - 16}
              y={on ? 50 : 82}
              width={32}
              height={28}
              rx={5}
              fill={tripped ? '#dc2626' : on ? '#16a34a' : '#94a3b8'}
            />
          </g>
          <text
            x={w / 2}
            y={134}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={tripped ? '#dc2626' : on ? '#15803d' : LABEL}
          >
            {tripped ? 'TRIPPED' : on ? 'ON' : 'OFF'}
          </text>
        </>
      );
    }

    case 'SUPPLY': {
      // All six rows are complete: six terminals each, alternating VCC and GND.
      const rows: [string, number][] = [
        ['VCC', 58],
        ['GND', 96],
        ['VCC', 134],
        ['GND', 172],
        ['VCC', 210],
        ['GND', 248],
      ];
      return (
        <>
          <Cap x={w / 2} y={28} text="POWER SUPPLY" />
          {rows.map(([label, y], i) => (
            <g key={i} style={{ pointerEvents: 'none' }}>
              <rect
                x={14}
                y={y - 17}
                width={w - 28}
                height={34}
                rx={7}
                fill={label === 'GND' ? 'rgba(2,132,199,0.07)' : 'rgba(234,88,12,0.07)'}
                stroke={label === 'GND' ? 'rgba(2,132,199,0.28)' : 'rgba(234,88,12,0.28)'}
              />
              <text x={26} y={y + 4} fontSize={10} fontWeight={800} fill={label === 'GND' ? GND : HOT}>
                {label}
              </text>
              <text x={26} y={y - 7} fontSize={7} fill="#94a3b8">
                {'ROW ' + (i + 1)}
              </text>
            </g>
          ))}
          <Led x={w - 26} y={26} on={breakerOn && !tripped} color={HOT} />
        </>
      );
    }

    case 'PUSHBTN':
      return (
        <>
          <Cap x={w / 2} y={24} text={m.id} sub="momentary" />
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              holdButton(m.id, true);
            }}
            onPointerUp={() => holdButton(m.id, false)}
            onPointerCancel={() => holdButton(m.id, false)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={w / 2} cy={80} r={30} fill={CASE} stroke={EDGE} strokeWidth={2} />
            <circle
              cx={w / 2}
              cy={pressed ? 82 : 78}
              r={23}
              fill={pressed ? '#991b1b' : '#dc2626'}
              stroke="#7f1d1d"
              strokeWidth={2}
            />
          </g>
        </>
      );

    case 'TOGGLE':
      return (
        <>
          <Cap x={w / 2} y={24} text={m.id} sub="latching" />
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              flipToggle(m.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={w / 2 - 20} y={50} width={40} height={62} rx={8} fill={CASE} stroke={EDGE} strokeWidth={2} />
            <rect
              x={w / 2 - 13}
              y={toggled ? 56 : 84}
              width={26}
              height={22}
              rx={4}
              fill={toggled ? '#16a34a' : '#94a3b8'}
            />
          </g>
          <text x={w / 2} y={126} textAnchor="middle" fontSize={9} fill={LABEL}>
            {toggled ? 'COM-NO' : 'COM-NC'}
          </text>
        </>
      );

    case 'LAMP': {
      const on = !!device?.energized;
      return (
        <>
          <Cap x={w / 2} y={24} text={m.id} />
          {on && <circle cx={w / 2} cy={78} r={40} fill="#facc15" opacity={0.45} filter="url(#glow)" />}
          <circle cx={w / 2} cy={78} r={26} fill={on ? '#fde047' : CASE} stroke={on ? '#ca8a04' : EDGE} strokeWidth={2.5} />
          <path
            d={'M ' + (w / 2 - 10) + ' 86 L ' + (w / 2 - 4) + ' 68 L ' + (w / 2 + 4) + ' 86 L ' + (w / 2 + 10) + ' 68'}
            fill="none"
            stroke={on ? '#92400e' : EDGE}
            strokeWidth={2.5}
          />
        </>
      );
    }

    case 'RELAY':
    case 'BIGRELAY': {
      const on = !!device?.energized;
      const big = m.type === 'BIGRELAY';
      return (
        <>
          <Cap x={w / 2} y={24} text={m.id} sub={big ? '4 x NO/COM/NC' : 'NO/COM/NC'} />
          <rect x={w / 2 - 34} y={big ? 34 : 46} width={68} height={big ? 30 : 34} rx={5} fill={CASE} stroke={EDGE} />
          <text x={w / 2} y={big ? 54 : 68} textAnchor="middle" fontSize={9} fill={LABEL} style={{ pointerEvents: 'none' }}>
            COIL
          </text>
          <Led x={w - 24} y={26} on={on} />
          {big &&
            [1, 2, 3, 4].map((line) => (
              <text key={line} x={26} y={142 + (line - 1) * 42} fontSize={9} fontWeight={700} fill={LABEL}>
                {'L' + line}
              </text>
            ))}
          <text x={w / 2} y={big ? 116 : 100} textAnchor="middle" fontSize={9} fill={on ? '#15803d' : LABEL}>
            {on ? 'ENERGIZED' : 'at rest'}
          </text>
        </>
      );
    }

    case 'TIMER': {
      const on = !!device?.energized;
      const done = !!device?.actuated;
      const pct = delayMs > 0 ? Math.min(1, elapsed / delayMs) : 1;
      const r = 26;
      const circ = 2 * Math.PI * r;
      return (
        <>
          <Cap x={w / 2} y={24} text="TIMER" sub="ON-delay" />
          <circle cx={w / 2} cy={86} r={r} fill="#ffffff" stroke={CASE} strokeWidth={4} />
          <circle
            cx={w / 2}
            cy={86}
            r={r}
            fill="none"
            stroke={done ? '#16a34a' : HOT}
            strokeWidth={4}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transform={'rotate(-90 ' + w / 2 + ' 86)'}
            strokeLinecap="round"
          />
          <text x={w / 2} y={90} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
            {(Math.max(0, delayMs - elapsed) / 1000).toFixed(1) + 's'}
          </text>
          <Led x={w - 26} y={26} on={on} color={done ? '#16a34a' : HOT} />
          <text x={w / 2} y={128} textAnchor="middle" fontSize={9} fill={LABEL}>
            {done ? 'contacts thrown' : on ? 'timing...' : 'coil off'}
          </text>
        </>
      );
    }

    default:
      return null;
  }
}

export function ModuleView({ m }: { m: ModuleInstance }) {
  const part = PARTS[m.type];
  const moveModule = useBoard((s) => s.moveModule);
  const getScale = useContext(ScaleContext);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      drag.current = { px: e.clientX, py: e.clientY, ox: m.x, oy: m.y };
    },
    [m.x, m.y],
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const k = getScale();
      const nx = drag.current.ox + (e.clientX - drag.current.px) / k;
      const ny = drag.current.oy + (e.clientY - drag.current.py) / k;
      moveModule(m.id, snap(Math.max(0, nx)), snap(Math.max(0, ny)));
    },
    [getScale, m.id, moveModule],
  );

  const onUp = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <g data-module={m.id} transform={'translate(' + m.x + ',' + m.y + ')'}>
      <rect x={2} y={3} width={part.width} height={part.height} rx={12} fill="#0f172a" opacity={0.07} pointerEvents="none" />
      <rect
        className="no-pan"
        width={part.width}
        height={part.height}
        rx={12}
        fill="url(#panel)"
        stroke="#cbd5e1"
        strokeWidth={1.5}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: 'grab' }}
      />
      <title>{moduleLabel(m)}</title>
      <Face m={m} />
      {part.pins.map((p) => (
        <Terminal key={p.id} moduleId={m.id} pin={p} />
      ))}
    </g>
  );
}
