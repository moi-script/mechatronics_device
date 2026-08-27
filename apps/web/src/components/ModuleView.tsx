'use client';

import { useCallback, useContext, useRef } from 'react';
import { PARTS, moduleLabel, type ModuleInstance, type PinDef, type PinRole } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { ScaleContext } from './ScaleContext';

const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Panel palette: powder-coated steel, engraved carbon, rail signals. */
const CARBON = '#16202b';
const LABEL = '#5b6b7b';
const EDGE = '#a9b6c4';
const CASE = '#dfe6ed';
const AMBER = '#e8830c';
const BLUE = '#0b7fc7';
const GREEN = '#1b9c5a';
const RED = '#c62828';

/** Insulator collar colour, keyed to what the terminal actually is. */
const COLLAR: Record<PinRole, string> = {
  SOURCE_VCC: AMBER,
  LOAD_VCC: AMBER,
  SOURCE_GND: BLUE,
  LOAD_GND: BLUE,
  NO: GREEN,
  NC: RED,
  COM: '#46586a',
};

/** A short tag for the legend plate, naming the part's contact arrangement. */
const TAG: Record<string, string> = {
  BREAKER: 'MAIN',
  SUPPLY: '6 x 6',
  PUSHBTN: 'MOMENTARY',
  TOGGLE: 'LATCHING',
  LAMP: 'INDICATOR',
  RELAY: '1 x NO/COM/NC',
  BIGRELAY: '4 x NO/COM/NC',
  TIMER: 'ON-DELAY',
};

function Terminal({ moduleId, pin }: { moduleId: string; pin: PinDef }) {
  const pending = useBoard((s) => s.pending);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const net = useBoard((s) => s.sim.nets[s.sim.pinNet[moduleId + '.' + pin.id]]);

  const collar = COLLAR[pin.role];
  const energised = live && net ? (net.hot ? AMBER : net.gnd ? BLUE : null) : null;
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
      {pending && <circle cx={pin.x} cy={pin.y} r={16} fill="#0891b2" opacity={isSource ? 0.32 : 0.12} />}
      {/* A live terminal glows in its rail colour; the collar always states its function. */}
      {energised && <circle cx={pin.x} cy={pin.y} r={13} fill={energised} opacity={0.3} filter="url(#glow)" />}
      {/* A tinted insulator washer states the function without shouting it. */}
      <circle cx={pin.x} cy={pin.y} r={9.5} fill={collar} fillOpacity={0.2} />
      <circle cx={pin.x} cy={pin.y} r={8.6} fill="none" stroke={collar} strokeWidth={1.6} strokeOpacity={0.85} />
      <circle cx={pin.x} cy={pin.y} r={6} fill="url(#brass)" />
      <circle cx={pin.x} cy={pin.y} r={2.4} fill="#4a3410" opacity={0.75} />
      <text
        className="t-mono"
        x={pin.x}
        y={pin.y + 19}
        textAnchor="middle"
        fontSize={8.5}
        fontWeight={500}
        fill={LABEL}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {pin.label}
      </text>
    </g>
  );
}

function Led({ x, y, on, color = GREEN }: { x: number; y: number; on: boolean; color?: string }) {
  return (
    <>
      {on && <circle cx={x} cy={y} r={11} fill={color} opacity={0.4} filter="url(#glow)" />}
      <circle cx={x} cy={y} r={5} fill={on ? color : '#c2cdd8'} stroke="#8595a5" strokeWidth={1} />
      {on && <circle cx={x - 1.4} cy={y - 1.6} r={1.6} fill="#ffffff" opacity={0.75} />}
    </>
  );
}

/** A cross-slot fastener, the kind holding a real plate to its backpan. */
const Screw = ({ x, y }: { x: number; y: number }) => (
  <g style={{ pointerEvents: 'none' }}>
    <circle cx={x} cy={y} r={3.6} fill="#b9c4cf" stroke="#8c9aa8" strokeWidth={0.75} />
    <path d={`M ${x - 2.2} ${y} H ${x + 2.2}`} stroke="#7b8996" strokeWidth={0.9} />
  </g>
);

/** The engraved traffolyte strip every module wears. */
const LegendPlate = ({ w, name, tag }: { w: number; name: string; tag?: string }) => (
  <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
    <rect x={11} y={7} width={w - 22} height={21} rx={3} fill={CARBON} />
    <rect x={11} y={7} width={w - 22} height={21} rx={3} fill="none" stroke="#000000" strokeOpacity={0.35} />
    <text className="t-cond" x={20} y={22} fontSize={12.5} fontWeight={700} fill="#f1f5f9">
      {name}
    </text>
    {tag && (
      <text className="t-mono" x={w - 20} y={21.5} textAnchor="end" fontSize={7.5} fill="#8fa2b4">
        {tag}
      </text>
    )}
  </g>
);

/** The part-specific face inside a module's plate. */
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

  const status = (y: number, text: string, color = LABEL) => (
    <text className="t-mono" x={w / 2} y={y} textAnchor="middle" fontSize={8.5} fill={color} style={{ pointerEvents: 'none' }}>
      {text}
    </text>
  );

  switch (m.type) {
    case 'BREAKER': {
      const on = breakerOn && !tripped;
      return (
        <>
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              setBreaker(!breakerOn);
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={w / 2 - 24} y={46} width={48} height={74} rx={6} fill="#cfd8e1" stroke="#93a1b0" />
            <rect x={w / 2 - 20} y={50} width={40} height={66} rx={4} fill="#e9eef3" />
            {/* Hazard striping behind the lever, as on a real isolator. */}
            <rect x={w / 2 - 20} y={on ? 84 : 50} width={40} height={32} rx={3} fill="url(#hazard)" opacity={0.5} />
            <rect
              x={w / 2 - 15}
              y={on ? 52 : 84}
              width={30}
              height={30}
              rx={4}
              fill={tripped ? RED : on ? GREEN : '#8fa0b0'}
              stroke="#0f172a"
              strokeOpacity={0.25}
            />
          </g>
          <text
            className="t-cond"
            x={w / 2}
            y={137}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={tripped ? RED : on ? GREEN : LABEL}
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
          {rows.map(([label, y], i) => {
            const isGnd = label === 'GND';
            return (
              <g key={i} style={{ pointerEvents: 'none' }}>
                <rect
                  x={12}
                  y={y - 17}
                  width={w - 24}
                  height={34}
                  rx={4}
                  fill={isGnd ? 'rgba(11,127,199,0.07)' : 'rgba(232,131,12,0.07)'}
                  stroke={isGnd ? 'rgba(11,127,199,0.3)' : 'rgba(232,131,12,0.3)'}
                />
                <rect x={12} y={y - 17} width={4} height={34} rx={2} fill={isGnd ? BLUE : AMBER} />
                <text className="t-cond" x={26} y={y + 4} fontSize={11} fontWeight={700} fill={isGnd ? BLUE : AMBER}>
                  {label}
                </text>
                <text className="t-mono" x={26} y={y - 6} fontSize={6.5} fill="#8494a4">
                  {'R' + (i + 1)}
                </text>
              </g>
            );
          })}
          <Led x={w - 26} y={17.5} on={breakerOn && !tripped} color={AMBER} />
        </>
      );
    }

    case 'PUSHBTN':
      return (
        <>
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
            {/* Chrome bezel ring, then the actuator cap sunk into it when held. */}
            <circle cx={w / 2} cy={80} r={31} fill="url(#chrome)" stroke="#8595a5" strokeWidth={1} />
            <circle cx={w / 2} cy={80} r={25} fill="#b9c4cf" />
            <circle cx={w / 2} cy={pressed ? 81 : 77} r={23} fill={pressed ? '#a11d1d' : RED} />
            <circle cx={w / 2} cy={pressed ? 81 : 77} r={23} fill="url(#capGloss)" />
          </g>
          {status(122, pressed ? 'COM-NO' : 'COM-NC', pressed ? GREEN : LABEL)}
        </>
      );

    case 'TOGGLE':
      return (
        <>
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              flipToggle(m.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={w / 2 - 21} y={50} width={42} height={64} rx={6} fill="#cfd8e1" stroke="#93a1b0" />
            <rect x={w / 2 - 17} y={54} width={34} height={56} rx={4} fill="#eef2f6" />
            <rect
              x={w / 2 - 14}
              y={toggled ? 57 : 83}
              width={28}
              height={24}
              rx={3}
              fill={toggled ? GREEN : '#8fa0b0'}
              stroke="#0f172a"
              strokeOpacity={0.2}
            />
          </g>
          {status(126, toggled ? 'COM-NO' : 'COM-NC', toggled ? GREEN : LABEL)}
        </>
      );

    case 'LAMP': {
      const on = !!device?.energized;
      return (
        <>
          {on && <circle cx={w / 2} cy={78} r={42} fill="#fbbf24" opacity={0.5} filter="url(#glow)" />}
          {/* Chrome bezel and a domed lens, lit from the filament inside. */}
          <circle cx={w / 2} cy={78} r={30} fill="url(#chrome)" stroke="#8595a5" />
          <circle cx={w / 2} cy={78} r={25} fill={on ? 'url(#lensOn)' : 'url(#lensOff)'} />
          <path
            d={`M ${w / 2 - 10} 86 L ${w / 2 - 4} 69 L ${w / 2 + 4} 86 L ${w / 2 + 10} 69`}
            fill="none"
            stroke={on ? '#8a4b06' : '#9aa8b6'}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <ellipse cx={w / 2 - 7} cy={69} rx={7} ry={4.5} fill="#ffffff" opacity={on ? 0.5 : 0.65} />
          {status(122, on ? 'LIT' : 'off', on ? '#b45309' : LABEL)}
        </>
      );
    }

    case 'RELAY':
    case 'BIGRELAY': {
      const on = !!device?.energized;
      const big = m.type === 'BIGRELAY';
      const bodyY = big ? 36 : 44;
      const bodyH = big ? 40 : 40;
      return (
        <>
          {/* Clear polycarbonate housing over the coil, with a flag that throws when energized. */}
          <rect x={w / 2 - 40} y={bodyY} width={80} height={bodyH} rx={4} fill="url(#housing)" stroke="#9fb0c0" />
          <rect x={w / 2 - 34} y={bodyY + 7} width={68} height={bodyH - 16} rx={2} fill="#c8d2dc" opacity={0.85} />
          <rect
            x={on ? w / 2 + 6 : w / 2 - 30}
            y={bodyY + 10}
            width={24}
            height={bodyH - 22}
            rx={2}
            fill={on ? AMBER : '#93a1b0'}
          />
          <text className="t-mono" x={w / 2} y={bodyY + bodyH + 13} textAnchor="middle" fontSize={7.5} fill={LABEL}>
            COIL
          </text>
          <Led x={w - 24} y={17.5} on={on} />
          {big &&
            [1, 2, 3, 4].map((line) => (
              <text key={line} className="t-cond" x={26} y={142 + (line - 1) * 42} fontSize={10} fontWeight={700} fill={LABEL}>
                {'L' + line}
              </text>
            ))}
          {status(big ? 116 : 104, on ? 'ENERGIZED' : 'at rest', on ? GREEN : LABEL)}
        </>
      );
    }

    case 'TIMER': {
      const on = !!device?.energized;
      const done = !!device?.actuated;
      const pct = delayMs > 0 ? Math.min(1, elapsed / delayMs) : 1;
      const r = 27;
      const circ = 2 * Math.PI * r;
      return (
        <>
          <circle cx={w / 2} cy={86} r={r + 5} fill="url(#chrome)" stroke="#8595a5" />
          <circle cx={w / 2} cy={86} r={r} fill="#f7fafc" stroke="#cbd5e1" strokeWidth={3} />
          <circle
            cx={w / 2}
            cy={86}
            r={r}
            fill="none"
            stroke={done ? GREEN : AMBER}
            strokeWidth={3.5}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transform={`rotate(-90 ${w / 2} 86)`}
            strokeLinecap="round"
          />
          <text className="t-mono" x={w / 2} y={90} textAnchor="middle" fontSize={13} fontWeight={600} fill={CARBON}>
            {(Math.max(0, delayMs - elapsed) / 1000).toFixed(1)}
          </text>
          <Led x={w - 26} y={17.5} on={on} color={done ? GREEN : AMBER} />
          {status(128, done ? 'CONTACTS THROWN' : on ? 'timing' : 'coil off', done ? GREEN : LABEL)}
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

  const { width: pw, height: ph } = part;

  return (
    <g data-module={m.id} transform={`translate(${m.x},${m.y})`}>
      <rect
        className="no-pan"
        width={pw}
        height={ph}
        rx={8}
        fill="url(#plate)"
        stroke={EDGE}
        strokeWidth={1.25}
        filter="url(#lift)"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: 'grab' }}
      />
      {/* Bevel: a lit top edge and a shaded bottom one. */}
      <path d={`M 9 1.5 H ${pw - 9}`} stroke="#ffffff" strokeWidth={1.5} opacity={0.95} pointerEvents="none" />
      <path d={`M 9 ${ph - 1.5} H ${pw - 9}`} stroke="#8d9dac" strokeWidth={1.5} opacity={0.5} pointerEvents="none" />

      <Screw x={11} y={ph - 11} />
      <Screw x={pw - 11} y={ph - 11} />

      <title>{moduleLabel(m)}</title>
      <LegendPlate w={pw} name={m.type === 'SUPPLY' ? 'POWER SUPPLY' : m.type === 'TIMER' ? 'TIMER' : m.id} tag={TAG[m.type]} />
      <Face m={m} />
      {part.pins.map((p) => (
        <Terminal key={p.id} moduleId={m.id} pin={p} />
      ))}
    </g>
  );
}
