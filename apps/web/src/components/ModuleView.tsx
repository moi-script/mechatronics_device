'use client';

import { useCallback, useContext, useRef } from 'react';
import { PARTS, moduleLabel, type ModuleInstance, type PinDef, type PinRole } from '@mech/sim';
import { useBoard, usePhotoreal } from '@/store/useBoard';
import { ScaleContext } from './ScaleContext';
import type { WireFocus } from '@/lib/geometry';
import { usePalette } from '@/store/useTheme';
import { clickDown, clickUp } from '@/lib/sound';
import type { Palette } from '@/lib/palette';
import { AirFitting, FestechFace, PHOTO_PNEUMATIC } from './FestechFaces';

const GRID = 8;
/** How long a cylinder takes to run its full stroke, on screen. */
const STROKE_MS = 700;
const snap = (v: number) => Math.round(v / GRID) * GRID;

/** Insulator collar colour: COM and GND are black, every other terminal is red. */
const BLACK_ROLES: ReadonlySet<PinRole> = new Set(['COM', 'SOURCE_GND', 'LOAD_GND']);

const collarFor = (pin: PinDef, p: Palette): string => {
  if (pin.collar === 'blue') return p.blue;
  if (pin.collar) return pin.collar === 'black' ? p.pinBlack : p.pinRed;
  return BLACK_ROLES.has(pin.role) ? p.pinBlack : p.pinRed;
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
  TMRRELAY: 'ON-DELAY RELAY',
  SOLENOID: '2 x 3 VCC/GND',
  CYLINDER: 'DOUBLE-ACTING',
  TIMER: 'ON-DELAY',
  FT_PSU: 'DC 24V / 5A',
  FT_PBU: '3 x 2NO+2NC',
  FT_RELAY3: '3 x 4 C/O',
  FT_PLC: 'OMRON CP1E',
  FT_LIMIT: 'ROLLER LEVER',
  FT_V52S: '5/2 SINGLE SOL.',
  FT_V52D: '5/2 DOUBLE SOL.',
  FT_V32: '3/2 NC',
  FT_AIR: '1 IN / 8 OUT',
  FT_CYL: 'DOUBLE-ACTING',
  FT_SCYL: 'SINGLE-ACTING',
};

/**
 * How a terminal reads while a lead is picked: `on` is one of the two the lead
 * lands on, `off` is a neighbour on the same module, null is business as usual.
 */
type Emphasis = 'on' | 'off' | null;

function Terminal({ moduleId, pin, emphasis }: { moduleId: string; pin: PinDef; emphasis: Emphasis }) {
  const pending = useBoard((s) => s.pending);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const net = useBoard((s) => s.sim.nets[s.sim.pinNet[moduleId + '.' + pin.id]]);
  const pressurized = useBoard((s) => !!s.sim.air[moduleId + '.' + pin.id]);

  const p = usePalette();
  const collar = collarFor(pin, p);
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
    <g
      data-pin={moduleId + '.' + pin.id}
      onPointerDown={onDown}
      opacity={emphasis === 'off' ? 0.3 : 1}
      style={{
        cursor: 'crosshair',
        filter: emphasis === 'off' ? 'blur(1.6px)' : undefined,
        transition: 'opacity 140ms ease',
      }}
    >
      {/* The terminal the picked lead lands on wears a ring, so the eye finds it. */}
      {emphasis === 'on' && (
        <>
          <circle cx={pin.x} cy={pin.y} r={17} fill={p.amber} opacity={0.18} filter="url(#glow)" />
          <circle cx={pin.x} cy={pin.y} r={14} fill="none" stroke={p.amber} strokeWidth={2.2} />
        </>
      )}
      {pending && <circle cx={pin.x} cy={pin.y} r={16} fill="#0891b2" opacity={isSource ? 0.32 : 0.12} />}
      {pin.role === 'AIR' ? (
        <AirFitting x={pin.x} y={pin.y} label={pin.label} live={pressurized} emphasis={emphasis} />
      ) : (
        <>
      {/* A live terminal glows in its rail colour; the collar always states its function. */}
      {energised && <circle cx={pin.x} cy={pin.y} r={13} fill={energised} opacity={p.glowOpacity} filter="url(#glow)" />}
      {/* A 4 mm banana socket: shroud moulded in its function colour, brass ring, the hole. */}
      <circle cx={pin.x} cy={pin.y + 1.6} r={10.4} fill="#000000" opacity={0.45} />
      <circle cx={pin.x} cy={pin.y} r={10} fill={collar} />
      <circle cx={pin.x} cy={pin.y} r={10} fill="url(#shroud)" stroke="#000000" strokeOpacity={0.4} strokeWidth={0.8} />
      <circle cx={pin.x} cy={pin.y} r={7.4} fill="none" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={0.9} />
      <circle cx={pin.x} cy={pin.y} r={5} fill="url(#brass)" stroke="#3a2c08" strokeWidth={0.6} />
      <circle cx={pin.x} cy={pin.y} r={2.5} fill="#0b0805" />
      <ellipse cx={pin.x - 4.2} cy={pin.y - 5.6} rx={2.6} ry={1.3} fill="#ffffff" opacity={0.35} transform={`rotate(-30 ${pin.x - 4.2} ${pin.y - 5.6})`} />
      <text
        className="t-mono"
        x={pin.x}
        y={pin.y + 19}
        textAnchor="middle"
        fontSize={emphasis === 'on' ? 10 : 8.5}
        fontWeight={emphasis === 'on' ? 700 : 500}
        fill={emphasis === 'on' ? p.ink : p.label}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {pin.label}
      </text>
        </>
      )}
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

/** What is printed across the top of each Festech panel, as on the real ones. */
const PANEL_TITLE: Partial<Record<string, [string, string]>> = {
  FT_PSU: ['POWER SUPPLY', 'PN 13030'],
  FT_PBU: ['PUSH-BUTTON SWITCH', 'PN 13032'],
  FT_RELAY3: ['RELAY UNIT (3-FOLD)', 'PN 13030'],
  FT_PLC: ['PLC TRAINER  (OMRON CP1E series)', 'PN 13050'],
  BREAKER: ['BREAKER', ''],
};

/**
 * The photoreal panel: brushed aluminium with dark extrusion end caps on the
 * rack panels, a printed title and the red Festech mark, and the unit's tag on
 * the bottom cap. The hardware clamped to the air plate gets corner bolts instead.
 */
function PhotoChassis({ m, w, h }: { m: ModuleInstance; w: number; h: number }) {
  const title = PANEL_TITLE[m.type];
  const rackPanel = !!title;
  return (
    <g pointerEvents="none" style={{ userSelect: 'none' }}>
      {rackPanel ? (
        <>
          <rect width={w} height={12} fill="url(#extrusionCap)" />
          <rect y={h - 12} width={w} height={12} fill="url(#extrusionCap)" />
          <rect width={5} height={h} fill="#3b4046" />
          <rect x={w - 5} width={5} height={h} fill="#3b4046" />
          <text x={w - 14} y={9.5} textAnchor="end" fontSize={7.5} className="t-mono" fill="#e4e6e8">
            {m.id}
            {title[1] && '  ·  ' + title[1]}
          </text>
        </>
      ) : (
        <>
          <rect width={w} height={h} rx={2} fill="none" stroke="#8a9096" />
          {[
            [9, 9],
            [w - 9, 9],
            [9, h - 9],
            [w - 9, h - 9],
          ].map(([x, y]) => (
            <g key={x + '-' + y}>
              <circle cx={x} cy={y} r={4} fill="url(#brass)" />
              <path d={`M${x - 2.4} ${y}H${x + 2.4}M${x} ${y - 2.4}V${y + 2.4}`} stroke="#3e4349" strokeWidth={1} />
            </g>
          ))}
        </>
      )}
      <text x={rackPanel ? 16 : 20} y={rackPanel ? 28 : 24} fontSize={rackPanel ? 12 : 11} fontWeight={700} className="t-cond" fill="#1c1e21">
        {title?.[0] ?? m.id}
      </text>
      {rackPanel && m.type.startsWith('FT_') && (
        <text x={w - 16} y={28} textAnchor="end" fontSize={12} fontWeight={800} fontStyle="italic" className="t-cond" fill="#d12a24">
          FESTECH
        </text>
      )}
    </g>
  );
}

/** The part-specific face inside a module's plate. */
/** SVG arc path between two clock angles, measured from twelve o'clock. */
function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const at = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return [cx + Math.sin(rad) * r, cy - Math.cos(rad) * r];
  };
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function Face({ m }: { m: ModuleInstance }) {
  const part = PARTS[m.type];
  const device = useBoard((s) => s.sim.devices[m.id]);
  const timer = useBoard((s) => s.sim.timers[m.id]);
  const piston = useBoard((s) => s.sim.pistons[m.id]);
  const setTimerDelay = useBoard((s) => s.setTimerDelay);
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
              clickDown();
              holdButton(m.id, true);
            }}
            onPointerUp={() => {
              clickUp();
              holdButton(m.id, false);
            }}
            onPointerCancel={() => holdButton(m.id, false)}
            style={{ cursor: 'pointer' }}
          >
            {/* Knurled bezel and its dark bore; the cap sinks and loses its shine when held. */}
            <g transform={`translate(${w / 2} 80) scale(31)`}>
              <circle r={1.06} cy={0.09} fill="#000000" opacity={0.45} />
              <circle r={1} fill="url(#bzl)" />
              <circle r={0.93} fill="none" stroke="#28313c" strokeWidth={0.06} strokeDasharray="0.035 0.055" opacity={0.65} />
              <circle r={0.85} fill="url(#bzlIn)" />
              <circle r={0.78} fill="#07090c" />
              <g transform={pressed ? 'translate(0 0.05) scale(0.95)' : undefined} opacity={pressed ? 0.85 : 1}>
                <circle r={0.72} fill="url(#capRed)" />
                <circle r={0.72} fill="url(#dish)" />
                {!pressed && (
                  <>
                    <ellipse cx={-0.16} cy={-0.34} rx={0.42} ry={0.18} fill="#ffffff" opacity={0.38} />
                    <circle r={0.72} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={0.035} />
                    <ellipse cx={0.3} cy={0.42} rx={0.22} ry={0.07} fill="#ffffff" opacity={0.18} />
                  </>
                )}
              </g>
            </g>
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

    case 'SOLENOID': {
      // Mirrors the SUPPLY block's striping, just two rows of three pairs
      // instead of six full rows. Values match SOLENOID_ROW_Y / SOLENOID_PAIR_X
      // in parts.ts — keep them in sync if you resize the part.
      const rowY = [58, 106];
      const pairX = [40, 128, 216];
      return (
        <>
          {rowY.map((y) => (
            <g key={y} style={{ pointerEvents: 'none' }}>
              <rect x={12} y={y - 17} width={w - 24} height={34} rx={4} fill={p.amber} fillOpacity={0.07} />
              {pairX.map((x0) => (
                <rect key={x0} x={x0 - 6} y={y - 15} width={64} height={30} rx={3} fill="none" stroke={p.moduleStroke} strokeOpacity={0.4} />
              ))}
            </g>
          ))}
        </>
      );
    }

    case 'CYLINDER': {
      const st = piston ?? { extended: false, extendCoil: false, retractCoil: false, stalled: false };
      // Barrel geometry: the rod slides ROD_TRAVEL to the right when extended.
      const bx = 26;
      const barrelW = 108;
      const travel = 84;
      const capX = bx + barrelW;
      return (
        <>
          {/* Barrel with its two end caps and tie rods. */}
          <rect x={bx} y={48} width={barrelW} height={46} rx={5} fill="url(#housing)" stroke={p.moduleStroke} />
          <rect x={bx + 5} y={54} width={barrelW - 10} height={34} rx={3} fill={p.housingInner} opacity={0.85} />
          <rect x={bx - 5} y={44} width={10} height={54} rx={2} fill="url(#chrome)" stroke={p.screwStroke} strokeWidth={0.6} />
          <rect x={capX - 5} y={44} width={10} height={54} rx={2} fill="url(#chrome)" stroke={p.screwStroke} strokeWidth={0.6} />
          {[52, 90].map((y) => (
            <line key={y} x1={bx} y1={y} x2={capX} y2={y} stroke={p.screwStroke} strokeOpacity={0.35} strokeWidth={1} />
          ))}

          {/* Rod and piston, moved as one group so both strokes animate. */}
          <g
            style={{
              transform: `translateX(${st.extended ? travel : 0}px)`,
              transition: `transform ${STROKE_MS}ms cubic-bezier(0.4, 0.1, 0.25, 1)`,
              pointerEvents: 'none',
            }}
          >
            {/* Piston head, riding inside the barrel. */}
            <rect x={bx + 12} y={54} width={16} height={34} rx={2} fill={p.chrome[0]} stroke={p.screwStroke} strokeWidth={0.6} />
            {/* Rod, running out through the front cap. */}
            <rect x={bx + 26} y={67} width={travel + 28} height={8} rx={3} fill="url(#chrome)" stroke={p.screwStroke} strokeWidth={0.5} />
            {/* Clevis on the rod's free end. */}
            <rect x={bx + travel + 50} y={60} width={12} height={22} rx={2} fill={p.chrome[0]} stroke={p.screwStroke} strokeWidth={0.6} />
            <circle cx={bx + travel + 56} cy={71} r={3} fill={p.recess} stroke={p.screwStroke} strokeWidth={0.6} />
          </g>

          {/* Air ports: the one being fed glows. */}
          {[
            { x: bx + 16, live: st.extendCoil, label: 'A' },
            { x: capX - 22, live: st.retractCoil, label: 'B' },
          ].map((port) => (
            <g key={port.label} style={{ pointerEvents: 'none' }}>
              <rect x={port.x} y={100} width={16} height={9} rx={2} fill={port.live ? p.amber : p.screwStroke} />
              <text className="t-mono" x={port.x + 8} y={121} textAnchor="middle" fontSize={7.5} fill={p.label}>
                {port.label}
              </text>
            </g>
          ))}

          {/* One LED per solenoid, so it is obvious which coil is being fed. */}
          <Led x={w - 42} y={17.5} on={st.extendCoil} color={p.amber} />
          <Led x={w - 22} y={17.5} on={st.retractCoil} />
          {status(
            132,
            st.stalled ? 'STALLED' : st.extended ? 'EXTENDED' : 'retracted',
            st.stalled ? p.red : st.extended ? p.green : p.label,
          )}
        </>
      );
    }

    case 'TIMER':
    case 'TMRRELAY': {
      const relay = m.type === 'TMRRELAY';
      const on = !!device?.energized;
      const done = !!device?.actuated;
      const t = timer ?? { delayMs: 5000, remainingMs: 5000, running: false, done: false };
      // Pointer sweeps a 270-degree scale from the set point down to zero.
      const progress = t.delayMs > 0 ? 1 - t.remainingMs / t.delayMs : 0;
      const angle = -135 + progress * 270;
      const rad = (angle * Math.PI) / 180;
      const secs = Math.max(0, t.remainingMs / 1000);
      const readout = (t.running ? secs : t.delayMs / 1000).toFixed(1) + 's';
      const nudge = (by: number) => (e: React.PointerEvent) => {
        e.stopPropagation();
        setTimerDelay(m.id, (m.delaySec ?? 5) + by);
      };
      return (
        <>
          {/* Dial housing: the scale sweeps as the set point counts down. */}
          <rect x={w / 2 - 40} y={36} width={80} height={54} rx={4} fill="url(#housing)" stroke={p.moduleStroke} />
          <circle cx={w / 2} cy={63} r={20} fill={p.recess} stroke={p.recessStroke} />
          <circle cx={w / 2} cy={63} r={17} fill={p.housingInner} opacity={0.85} />
          {/* Elapsed arc, filling clockwise as the timer runs out. */}
          {t.running && progress > 0 && (
            <path
              d={arc(w / 2, 63, 14, -135, angle)}
              fill="none"
              stroke={p.amber}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.9}
            />
          )}
          {[-135, -67.5, 0, 67.5, 135].map((a) => (
            <line
              key={a}
              x1={w / 2 + Math.sin((a * Math.PI) / 180) * 11.5}
              y1={63 - Math.cos((a * Math.PI) / 180) * 11.5}
              x2={w / 2 + Math.sin((a * Math.PI) / 180) * 15.5}
              y2={63 - Math.cos((a * Math.PI) / 180) * 15.5}
              stroke={p.label}
              strokeWidth={1}
            />
          ))}
          <line
            x1={w / 2}
            y1={63}
            x2={w / 2 + Math.sin(rad) * 12}
            y2={63 - Math.cos(rad) * 12}
            stroke={done ? p.green : on ? p.amber : p.screwStroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={w / 2} cy={63} r={2} fill={p.screwStroke} />
          {/* Set point, dialled with the two rockers either side of it. */}
          <g onPointerDown={nudge(-1)} style={{ cursor: 'pointer' }}>
            <rect x={20} y={54} width={18} height={18} rx={3} fill={p.recess} stroke={p.recessStroke} />
            <path d={`M 25 63 H 33`} stroke={p.label} strokeWidth={1.6} />
          </g>
          <g onPointerDown={nudge(1)} style={{ cursor: 'pointer' }}>
            <rect x={w - 38} y={54} width={18} height={18} rx={3} fill={p.recess} stroke={p.recessStroke} />
            <path d={`M ${w - 29} 58 V 68 M ${w - 34} 63 H ${w - 24}`} stroke={p.label} strokeWidth={1.6} />
          </g>
          <text
            className="t-mono"
            x={w / 2}
            y={100}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={done ? p.green : t.running ? p.amber : p.label}
            style={{ pointerEvents: 'none' }}
          >
            {readout}
          </text>
          <Led x={w - 24} y={17.5} on={done} />
          {relay &&
            [1, 2, 3, 4].map((line) => (
              <text key={line} className="t-cond" x={26} y={182 + (line - 1) * 42} fontSize={10} fontWeight={700} fill={p.label}>
                {'L' + line}
              </text>
            ))}
          {status(
            relay ? 156 : 128,
            done ? (relay ? 'TIMED OUT - COM-NO' : 'TIMED OUT') : t.running ? 'TIMING' : relay ? 'at rest - COM-NC' : 'at rest',
            done ? p.green : t.running ? p.amber : p.label,
          )}
        </>
      );
    }

    default:
      return <FestechFace m={m} />;
  }
}

export function ModuleView({ m, focus }: { m: ModuleInstance; focus?: WireFocus | null }) {
  const part = PARTS[m.type];
  const beginMove = useBoard((s) => s.beginMove);
  const selected = useBoard((s) => s.selectedModuleIds.includes(m.id));
  const p = usePalette();
  const photo = usePhotoreal();
  const hardware = photo && PHOTO_PNEUMATIC.has(m.type);
  const getScale = useContext(ScaleContext);
  // Where every module being dragged started, so the group moves as one. The
  // anchor is the module actually grabbed; it decides the snapped delta.
  const drag = useRef<{
    px: number;
    py: number;
    anchor: { x: number; y: number };
    origins: Record<string, { x: number; y: number }>;
  } | null>(null);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const board = useBoard.getState();

      // Shift adjusts the selection rather than starting a drag.
      if (e.shiftKey) {
        board.toggleModuleSelection(m.id);
        return;
      }

      // A switch bolted to a stroke is moved by moving its cylinder.
      const grab = (m.mount && board.circuit.modules.find((c) => c.id === m.mount!.cylinderId)) || m;

      // Dragging an unselected module makes it the selection.
      let ids = board.selectedModuleIds;
      if (!ids.includes(grab.id)) {
        ids = [grab.id];
        board.setSelectedModules(ids);
      }

      // One snapshot for the whole drag, not one per pointer move.
      beginMove();
      const origins: Record<string, { x: number; y: number }> = {};
      for (const mod of board.circuit.modules) {
        if (ids.includes(mod.id)) origins[mod.id] = { x: mod.x, y: mod.y };
      }
      drag.current = { px: e.clientX, py: e.clientY, anchor: { x: grab.x, y: grab.y }, origins };

      // Capture last: if it is refused, the drag should still work.
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // No active pointer to capture; move events still reach the element.
      }
    },
    [beginMove, m],
  );

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const k = getScale();
      const dx = (e.clientX - state.px) / k;
      const dy = (e.clientY - state.py) / k;

      // Snap the grabbed module, then shift the rest by that same delta, so a
      // group keeps its relative spacing instead of each part snapping apart.
      const snappedDx = snap(Math.max(0, state.anchor.x + dx)) - state.anchor.x;
      const snappedDy = snap(Math.max(0, state.anchor.y + dy)) - state.anchor.y;

      const next: Record<string, { x: number; y: number }> = {};
      for (const [id, origin] of Object.entries(state.origins)) {
        next[id] = { x: Math.max(0, origin.x + snappedDx), y: Math.max(0, origin.y + snappedDy) };
      }
      useBoard.getState().moveModules(next);
    },
    [getScale],
  );

  const onUp = useCallback(() => {
    drag.current = null;
  }, []);

  const { width: pw, height: ph } = part;
  // A picked lead narrows the board to the two modules it joins; the rest of
  // the bench steps back rather than disappearing.
  const outside = !!focus && !focus.modules.has(m.id);

  return (
    <g
      data-module={m.id}
      transform={`translate(${m.x},${m.y})`}
      opacity={outside ? 0.25 : 1}
      style={{ filter: outside ? 'blur(2px)' : undefined, transition: 'opacity 160ms ease' }}
    >
      {selected && (
        <rect
          x={-5}
          y={-5}
          width={pw + 10}
          height={ph + 10}
          rx={12}
          fill="none"
          stroke={p.amber}
          strokeWidth={2.5}
          strokeDasharray="8 5"
          pointerEvents="none"
        />
      )}
      <rect
        className="no-pan"
        width={pw}
        height={ph}
        rx={photo ? 2 : 8}
        // Pneumatic hardware on the photoreal bench has no panel of its own; the
        // invisible rect is still what you grab to move it.
        fill={hardware ? 'transparent' : photo ? 'url(#alu)' : 'url(#plate)'}
        stroke={photo ? 'none' : p.moduleStroke}
        strokeWidth={1.25}
        filter={hardware ? undefined : 'url(#lift)'}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: 'grab' }}
      />
      {hardware ? null : photo ? (
        <PhotoChassis m={m} w={pw} h={ph} />
      ) : (
        <>
          {/* Bevel: a lit top edge and a shaded bottom one. */}
          <path d={`M 9 1.5 H ${pw - 9}`} stroke={p.bevelLight} strokeWidth={1.5} opacity={0.95} pointerEvents="none" />
          <path d={`M 9 ${ph - 1.5} H ${pw - 9}`} stroke={p.bevelDark} strokeWidth={1.5} opacity={0.5} pointerEvents="none" />

          <Screw x={11} y={ph - 11} />
          <Screw x={pw - 11} y={ph - 11} />
          <LegendPlate w={pw} name={m.type === 'SUPPLY' ? 'POWER SUPPLY' : m.id} tag={TAG[m.type]} />
        </>
      )}

      <title>{moduleLabel(m)}</title>
      <Face m={m} />
      {part.pins.map((pin) => (
        <Terminal
          key={pin.id}
          moduleId={m.id}
          pin={pin}
          emphasis={!focus || outside ? null : focus.pins.has(m.id + '.' + pin.id) ? 'on' : 'off'}
        />
      ))}
    </g>
  );
}