'use client';

import { useCallback, useContext, useRef } from 'react';
import { PARTS, moduleLabel, type ModuleInstance, type PinDef, type PinRole } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { ScaleContext } from './ScaleContext';
import { usePalette } from '@/store/useTheme';
import type { Palette } from '@/lib/palette';

const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Insulator collar colour: COM and GND are black, every other terminal is red. */
const BLACK_ROLES: ReadonlySet<PinRole> = new Set(['COM', 'SOURCE_GND', 'LOAD_GND']);

const collarFor = (role: PinRole, p: Palette): string => (BLACK_ROLES.has(role) ? p.pinBlack : p.pinRed);

/** A short tag for the legend plate, naming the part's contact arrangement. */
const TAG: Record<string, string> = {
  BREAKER: 'MAIN',
  SUPPLY: '6 x 6',
  PUSHBTN: 'MOMENTARY',
  TOGGLE: 'LATCHING',
  LAMP: 'INDICATOR',
  RELAY: '1 x NO/COM/NC',
  BIGRELAY: '4 x NO/COM/NC',
};

function Terminal({ moduleId, pin }: { moduleId: string; pin: PinDef }) {
  const pending = useBoard((s) => s.pending);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const net = useBoard((s) => s.sim.nets[s.sim.pinNet[moduleId + '.' + pin.id]]);

  const p = usePalette();
  const collar = collarFor(pin.role, p);
  const energised = live && net ? (net.hot ? p.amber : net.gnd ? p.blue : null) : null;
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
      {energised && <circle cx={pin.x} cy={pin.y} r={13} fill={energised} opacity={p.glowOpacity} filter="url(#glow)" />}
      {/* A tinted insulator washer states the function without shouting it. */}
      <circle cx={pin.x} cy={pin.y} r={9.5} fill={collar} fillOpacity={0.2} />
      <circle cx={pin.x} cy={pin.y} r={8.6} fill="none" stroke={collar} strokeWidth={1.6} strokeOpacity={0.85} />
      <circle cx={pin.x} cy={pin.y} r={6} fill="url(#brass)" />
      <circle cx={pin.x} cy={pin.y} r={2.4} fill={p.plugPin} opacity={0.75} />
      <text
        className="t-mono"
        x={pin.x}
        y={pin.y + 19}
        textAnchor="middle"
        fontSize={8.5}
        fontWeight={500}
        fill={p.label}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {pin.label}
      </text>
    </g>
  );
}

function Led({ x, y, on, color }: { x: number; y: number; on: boolean; color?: string }) {
  const p = usePalette();
  const lit = color ?? p.green;
  return (
    <>
      {on && <circle cx={x} cy={y} r={11} fill={lit} opacity={p.glowOpacity + 0.1} filter="url(#glow)" />}
      <circle cx={x} cy={y} r={5} fill={on ? lit : p.ledOff} stroke={p.screwStroke} strokeWidth={1} />
      {on && <circle cx={x - 1.4} cy={y - 1.6} r={1.6} fill="#ffffff" opacity={0.75} />}
    </>
  );
}

/** A cross-slot fastener, the kind holding a real plate to its backpan. */
const Screw = ({ x, y }: { x: number; y: number }) => {
  const p = usePalette();
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={x} cy={y} r={3.6} fill={p.screwFill} stroke={p.screwStroke} strokeWidth={0.75} />
      <path d={`M ${x - 2.2} ${y} H ${x + 2.2}`} stroke={p.screwSlot} strokeWidth={0.9} />
    </g>
  );
};

/** The engraved traffolyte strip every module wears. */
const LegendPlate = ({ w, name, tag }: { w: number; name: string; tag?: string }) => {
  const p = usePalette();
  return (
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <rect x={11} y={7} width={w - 22} height={21} rx={3} fill={p.legendBg} />
      <rect x={11} y={7} width={w - 22} height={21} rx={3} fill="none" stroke="#000000" strokeOpacity={0.35} />
      <text className="t-cond" x={20} y={22} fontSize={12.5} fontWeight={700} fill={p.legendText}>
        {name}
      </text>
      {tag && (
        <text className="t-mono" x={w - 20} y={21.5} textAnchor="end" fontSize={7.5} fill={p.legendTag}>
          {tag}
        </text>
      )}
    </g>
  );
};

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
  const p = usePalette();
  const w = part.width;

  const status = (y: number, text: string, color = p.label) => (
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
            <rect x={w / 2 - 24} y={46} width={48} height={74} rx={6} fill={p.recess} stroke={p.recessStroke} />
            <rect x={w / 2 - 20} y={50} width={40} height={66} rx={4} fill={p.recessInner} />
            {/* Hazard striping behind the lever, as on a real isolator. */}
            <rect x={w / 2 - 20} y={on ? 84 : 50} width={40} height={32} rx={3} fill="url(#hazard)" opacity={0.5} />
            <rect
              x={w / 2 - 15}
              y={on ? 52 : 84}
              width={30}
              height={30}
              rx={4}
              fill={tripped ? p.red : on ? p.green : p.screwStroke}
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
            fill={tripped ? p.red : on ? p.green : p.label}
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
                  fill={isGnd ? p.blue : p.amber}
                  fillOpacity={0.09}
                />
                <rect x={12} y={y - 17} width={4} height={34} rx={2} fill={isGnd ? p.blue : p.amber} />
                <text className="t-cond" x={26} y={y + 4} fontSize={11} fontWeight={700} fill={isGnd ? p.blue : p.amber}>
                  {label}
                </text>
              </g>
            );
          })}
          <Led x={w - 26} y={17.5} on={breakerOn && !tripped} color={p.amber} />
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
            <circle cx={w / 2} cy={80} r={31} fill="url(#chrome)" stroke={p.screwStroke} strokeWidth={1} />
            <circle cx={w / 2} cy={80} r={25} fill={p.recess} />
            <circle cx={w / 2} cy={pressed ? 81 : 77} r={23} fill={pressed ? '#8f1d1d' : p.red} />
            <circle cx={w / 2} cy={pressed ? 81 : 77} r={23} fill="url(#capGloss)" />
          </g>
          {status(122, pressed ? 'COM-NO' : 'COM-NC', pressed ? p.green : p.label)}
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
            <rect x={w / 2 - 21} y={50} width={42} height={64} rx={6} fill={p.recess} stroke={p.recessStroke} />
            <rect x={w / 2 - 17} y={54} width={34} height={56} rx={4} fill="#eef2f6" />
            <rect
              x={w / 2 - 14}
              y={toggled ? 57 : 83}
              width={28}
              height={24}
              rx={3}
              fill={toggled ? p.green : p.screwStroke}
              stroke="#0f172a"
              strokeOpacity={0.2}
            />
          </g>
          {status(126, toggled ? 'COM-NO' : 'COM-NC', toggled ? p.green : p.label)}
        </>
      );

    case 'LAMP': {
      const on = !!device?.energized;
      return (
        <>
          {on && <circle cx={w / 2} cy={78} r={42} fill="#fbbf24" opacity={0.5} filter="url(#glow)" />}
          {/* Chrome bezel and a domed lens, lit from the filament inside. */}
          <circle cx={w / 2} cy={78} r={30} fill="url(#chrome)" stroke={p.screwStroke} />
          <circle cx={w / 2} cy={78} r={25} fill={on ? 'url(#lensOn)' : 'url(#lensOff)'} />
          <path
            d={`M ${w / 2 - 10} 86 L ${w / 2 - 4} 69 L ${w / 2 + 4} 86 L ${w / 2 + 10} 69`}
            fill="none"
            stroke={on ? '#7c4206' : p.screwStroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <ellipse cx={w / 2 - 7} cy={69} rx={7} ry={4.5} fill="#ffffff" opacity={on ? 0.5 : 0.65} />
          {status(122, on ? 'LIT' : 'off', on ? p.amber : p.label)}
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
          <rect x={w / 2 - 40} y={bodyY} width={80} height={bodyH} rx={4} fill="url(#housing)" stroke={p.moduleStroke} />
          <rect x={w / 2 - 34} y={bodyY + 7} width={68} height={bodyH - 16} rx={2} fill={p.housingInner} opacity={0.85} />
          <rect
            x={on ? w / 2 + 6 : w / 2 - 30}
            y={bodyY + 10}
            width={24}
            height={bodyH - 22}
            rx={2}
            fill={on ? p.amber : p.screwStroke}
          />
          <text className="t-mono" x={w / 2} y={bodyY + bodyH + 13} textAnchor="middle" fontSize={7.5} fill={p.label}>
            COIL
          </text>
          <Led x={w - 24} y={17.5} on={on} />
          {big &&
            [1, 2, 3, 4].map((line) => (
              <text key={line} className="t-cond" x={26} y={142 + (line - 1) * 42} fontSize={10} fontWeight={700} fill={p.label}>
                {'L' + line}
              </text>
            ))}
          {status(big ? 116 : 104, on ? 'ENERGIZED' : 'at rest', on ? p.green : p.label)}
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
  const beginMove = useBoard((s) => s.beginMove);
  const p = usePalette();
  const getScale = useContext(ScaleContext);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      // One snapshot for the whole drag, not one per pointer move.
      beginMove();
      drag.current = { px: e.clientX, py: e.clientY, ox: m.x, oy: m.y };
    },
    [beginMove, m.x, m.y],
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
        stroke={p.moduleStroke}
        strokeWidth={1.25}
        filter="url(#lift)"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: 'grab' }}
      />
      {/* Bevel: a lit top edge and a shaded bottom one. */}
      <path d={`M 9 1.5 H ${pw - 9}`} stroke={p.bevelLight} strokeWidth={1.5} opacity={0.95} pointerEvents="none" />
      <path d={`M 9 ${ph - 1.5} H ${pw - 9}`} stroke={p.bevelDark} strokeWidth={1.5} opacity={0.5} pointerEvents="none" />

      <Screw x={11} y={ph - 11} />
      <Screw x={pw - 11} y={ph - 11} />

      <title>{moduleLabel(m)}</title>
      <LegendPlate w={pw} name={m.type === 'SUPPLY' ? 'POWER SUPPLY' : m.id} tag={TAG[m.type]} />
      <Face m={m} />
      {part.pins.map((p) => (
        <Terminal key={p.id} moduleId={m.id} pin={p} />
      ))}
    </g>
  );
}
