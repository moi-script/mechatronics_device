'use client';

import { useCallback, useContext, useRef } from 'react';
import { PARTS, moduleLabel, type ModuleInstance, type PinDef, type PinRole } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { ScaleContext } from './ScaleContext';
import { usePalette } from '@/store/useTheme';
import { clickDown, clickUp } from '@/lib/sound';
import type { Palette } from '@/lib/palette';

const GRID = 8;
/** How long a cylinder takes to run its full stroke, on screen. */
const STROKE_MS = 700;
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
  SOLENOID: '2 x 3 VCC/GND',
  CYLINDER: 'DOUBLE-ACTING',
  TIMER: 'ON-DELAY',
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

    case 'TIMER': {
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
          {status(128, done ? 'TIMED OUT' : t.running ? 'TIMING' : 'at rest', done ? p.green : t.running ? p.amber : p.label)}
        </>
      );
    }

    default:
      return null;
  }
}

export function ModuleView({ m }: { m: ModuleInstance }) {
  const part = PARTS[m.type];
  const beginMove = useBoard((s) => s.beginMove);
  const selected = useBoard((s) => s.selectedModuleIds.includes(m.id));
  const p = usePalette();
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

      // Dragging an unselected module makes it the selection.
      let ids = board.selectedModuleIds;
      if (!ids.includes(m.id)) {
        ids = [m.id];
        board.setSelectedModules(ids);
      }

      // One snapshot for the whole drag, not one per pointer move.
      beginMove();
      const origins: Record<string, { x: number; y: number }> = {};
      for (const mod of board.circuit.modules) {
        if (ids.includes(mod.id)) origins[mod.id] = { x: mod.x, y: mod.y };
      }
      drag.current = { px: e.clientX, py: e.clientY, anchor: { x: m.x, y: m.y }, origins };

      // Capture last: if it is refused, the drag should still work.
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // No active pointer to capture; move events still reach the element.
      }
    },
    [beginMove, m.id, m.x, m.y],
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

  return (
    <g data-module={m.id} transform={`translate(${m.x},${m.y})`}>
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