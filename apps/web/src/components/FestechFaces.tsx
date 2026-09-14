'use client';

import {
  FT_PBU_BLOCK_Y,
  FT_PLC_INPUT_ROWS,
  FT_PLC_OUTPUT_Y,
  FT_RELAY_BLOCK_Y,
  PARTS,
  type ModuleInstance,
} from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { usePalette } from '@/store/useTheme';
import { clickDown, clickUp } from '@/lib/sound';

/** How long the rod takes to run its stroke on screen; the sim reports the sensors after the same time. */
const STROKE_MS = 700;
const COIL_BLOCK = '#1d252e';
const TUBE_BLUE = '#1f8fe5';

function Led({ x, y, on, color, r = 4.5 }: { x: number; y: number; on: boolean; color?: string; r?: number }) {
  const p = usePalette();
  const lit = color ?? p.green;
  return (
    <g pointerEvents="none">
      {on && <circle cx={x} cy={y} r={r * 2.2} fill={lit} opacity={p.glowOpacity + 0.1} filter="url(#glow)" />}
      <circle cx={x} cy={y} r={r} fill={on ? lit : p.ledOff} stroke={p.screwStroke} strokeWidth={0.8} />
    </g>
  );
}

function Text({
  x,
  y,
  children,
  size = 8.5,
  anchor = 'middle',
  color,
  bold,
  cond,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  bold?: boolean;
  cond?: boolean;
}) {
  const p = usePalette();
  return (
    <text
      className={cond ? 't-cond' : 't-mono'}
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={bold ? 700 : 500}
      fill={color ?? p.label}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {children}
    </text>
  );
}

/** Pointer handlers for a momentary actuator: held while the pointer is down. */
function useMomentary(id: string) {
  const holdButton = useBoard((s) => s.holdButton);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      clickDown();
      holdButton(id, true);
    },
    onPointerUp: () => {
      clickUp();
      holdButton(id, false);
    },
    onPointerCancel: () => holdButton(id, false),
    style: { cursor: 'pointer' },
  };
}

/** A tinted strip behind a +24V or 0V distribution row. */
function RailStrip({ y, w, gnd }: { y: number; w: number; gnd: boolean }) {
  const p = usePalette();
  const c = gnd ? p.blue : p.pinRed;
  return (
    <g pointerEvents="none">
      <rect x={12} y={y - 16} width={w - 24} height={32} rx={4} fill={c} fillOpacity={0.07} />
      <rect x={12} y={y - 16} width={4} height={32} rx={2} fill={c} />
    </g>
  );
}

/** A solenoid coil block: the black moulding with its + / - plug below it. */
function CoilBlock({ x, name, on }: { x: number; name: string; on: boolean }) {
  const p = usePalette();
  return (
    <g pointerEvents="none">
      <rect x={x} y={40} width={76} height={58} rx={4} fill={COIL_BLOCK} stroke="#000" strokeOpacity={0.4} />
      <rect x={x + 6} y={46} width={64} height={10} rx={2} fill="#ffffff" opacity={0.06} />
      <text className="t-cond" x={x + 38} y={80} textAnchor="middle" fontSize={13} fontWeight={700} fill="#e2e8f0">
        {name}
      </text>
      <circle cx={x + 66} cy={50} r={3.5} fill={on ? p.amber : '#3b4652'} />
      {on && <circle cx={x + 66} cy={50} r={8} fill={p.amber} opacity={0.4} filter="url(#glow)" />}
    </g>
  );
}

/** A sintered exhaust silencer screwed into port 3 or 5. */
function Silencer({ x, y, label }: { x: number; y: number; label: string }) {
  const p = usePalette();
  return (
    <g pointerEvents="none">
      <rect x={x - 7} y={y - 9} width={14} height={18} rx={3} fill="#c9b27a" stroke={p.screwStroke} strokeWidth={0.6} />
      {[-4, 0, 4].map((d) => (
        <line key={d} x1={x - 6} x2={x + 6} y1={y + d} y2={y + d} stroke="#8a7440" strokeWidth={0.8} />
      ))}
      <Text x={x} y={y + 20}>
        {label}
      </Text>
    </g>
  );
}

/** Aluminium valve body behind the fittings. */
function ValveBody({ x, w }: { x: number; w: number }) {
  const p = usePalette();
  return (
    <rect x={x} y={36} width={w} height={100} rx={4} fill="url(#chrome)" stroke={p.moduleStroke} pointerEvents="none" />
  );
}

export function FestechFace({ m }: { m: ModuleInstance }) {
  const p = usePalette();
  const part = PARTS[m.type];
  const w = part.width;
  const coils = useBoard((s) => s.sim.coils);
  const acts = useBoard((s) => s.sim.actuated);
  const valves = useBoard((s) => s.sim.valves);
  const nets = useBoard((s) => s.sim.nets);
  const pinNet = useBoard((s) => s.sim.pinNet);
  const pressed = useBoard((s) => s.pressed);
  const breakerOn = useBoard((s) => s.breakerOn);
  const tripped = useBoard((s) => s.tripped);
  const setBreaker = useBoard((s) => s.setBreaker);
  const piston = useBoard((s) => s.sim.pistons[m.id]);
  const limit = useMomentary(m.id);
  const buttons = [useMomentary(m.id + '.B1'), useMomentary(m.id + '.B2'), useMomentary(m.id + '.B3')];

  const k = (id: string) => m.id + '.' + id;
  const hot = (pin: string) => !!nets[pinNet[k(pin)]]?.hot;
  const gnd = (pin: string) => !!nets[pinNet[k(pin)]]?.gnd;

  switch (m.type) {
    case 'FT_PSU': {
      const on = breakerOn && !tripped;
      return (
        <>
          <Text x={w / 2} y={74} size={18} bold cond color={p.ink}>
            DC24V / 5A
          </Text>
          <Text x={w / 2} y={96}>
            FESTECH PN 13030 POWER SUPPLY
          </Text>
          {/* Mounting screws, as on the panel. */}
          {[
            [w / 2 - 50, 150],
            [w / 2 + 50, 150],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={4} fill={p.screwFill} stroke={p.screwStroke} pointerEvents="none" />
          ))}
          <Text x={140} y={232}>
            24V LED
          </Text>
          <Led x={140} y={248} on={on} color={p.red} r={5} />
          <circle cx={178} cy={248} r={9} fill={p.recess} stroke={p.recessStroke} pointerEvents="none" />
          <Text x={178} y={272}>
            FUSE
          </Text>
          {/* The rocker is the supply's own mains switch: it opens and closes the bench power. */}
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              setBreaker(!breakerOn);
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x={204} y={232} width={48} height={32} rx={4} fill={p.recess} stroke={p.recessStroke} />
            <rect
              x={on ? 228 : 208}
              y={236}
              width={20}
              height={24}
              rx={3}
              fill={tripped ? p.red : on ? p.green : '#1d252e'}
            />
          </g>
          <Text x={228} y={276}>
            {tripped ? 'TRIPPED' : on ? 'ON' : 'OFF'}
          </Text>
        </>
      );
    }

    case 'FT_PBU': {
      const caps = ['#eceff3', '#f97316', '#16a34a'];
      return (
        <>
          <RailStrip y={50} w={w} gnd={false} />
          <RailStrip y={354} w={w} gnd />
          {[0, 1, 2].map((b) => {
            const y0 = FT_PBU_BLOCK_Y(b);
            const cy = y0 + 32;
            const B = 'B' + (b + 1);
            const down = !!pressed[k(B)];
            const lit = !!coils[k('L' + (b + 1))];
            return (
              <g key={b}>
                {b > 0 && (
                  <line
                    x1={16}
                    x2={w - 16}
                    y1={y0 - 8}
                    y2={y0 - 8}
                    stroke={p.moduleStroke}
                    strokeOpacity={0.5}
                    pointerEvents="none"
                  />
                )}
                <g {...buttons[b]}>
                  {lit && <circle cx={42} cy={cy} r={30} fill={caps[b]} opacity={0.55} filter="url(#glow)" />}
                  <circle cx={42} cy={cy} r={22} fill="url(#chrome)" stroke={p.screwStroke} />
                  <circle cx={42} cy={cy + (down ? 1 : -1)} r={16} fill={caps[b]} opacity={lit ? 1 : 0.78} />
                  <circle cx={42} cy={cy + (down ? 1 : -1)} r={16} fill="url(#capGloss)" />
                </g>
                {/* Contact blades: NO pairs stand open, NC pairs closed, until the button is pushed. */}
                {[true, true, false, false].map((no, i) => {
                  const x = 100 + i * 50;
                  const closed = no === down;
                  return (
                    <path
                      key={i}
                      d={closed ? `M ${x} ${cy - 10} V ${cy + 10}` : `M ${x} ${cy + 10} L ${x + 9} ${cy - 8}`}
                      stroke={closed ? p.green : p.ink}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      pointerEvents="none"
                    />
                  );
                })}
                <line
                  x1={68}
                  x2={262}
                  y1={cy}
                  y2={cy}
                  stroke={p.label}
                  strokeDasharray="3 4"
                  strokeOpacity={0.6}
                  pointerEvents="none"
                />
                <circle
                  cx={300}
                  cy={cy}
                  r={8}
                  fill="none"
                  stroke={lit ? p.amber : p.ink}
                  strokeWidth={1.4}
                  pointerEvents="none"
                />
                <path
                  d={`M 294 ${cy - 6} L 306 ${cy + 6} M 306 ${cy - 6} L 294 ${cy + 6}`}
                  stroke={lit ? p.amber : p.ink}
                  strokeWidth={1.2}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </>
      );
    }

    case 'FT_RELAY3':
      return (
        <>
          <RailStrip y={48} w={w} gnd={false} />
          <RailStrip y={370} w={w} gnd />
          {[0, 1, 2].map((r) => {
            const y0 = FT_RELAY_BLOCK_Y(r);
            const R = 'R' + (r + 1);
            const on = !!acts[k(R)];
            return (
              <g key={r} pointerEvents="none">
                {r > 0 && (
                  <line x1={16} x2={w - 16} y1={y0 - 10} y2={y0 - 10} stroke={p.moduleStroke} strokeOpacity={0.5} />
                )}
                {/* Coil between A1 and A2. */}
                <rect
                  x={30}
                  y={y0 + 27}
                  width={20}
                  height={10}
                  rx={1.5}
                  fill={on ? p.amber : 'none'}
                  stroke={p.ink}
                  strokeWidth={1.2}
                />
                <Led x={70} y={y0 + 32} on={on} />
                <line
                  x1={80}
                  x2={w - 16}
                  y1={y0 + 32}
                  y2={y0 + 32}
                  stroke={p.label}
                  strokeDasharray="3 4"
                  strokeOpacity={0.5}
                />
                {[1, 2, 3, 4].map((c) => {
                  const xNc = 100 + (c - 1) * 80;
                  const xCom = xNc + 19;
                  const tip = on ? xNc + 38 : xNc;
                  return (
                    <path
                      key={c}
                      d={`M ${xCom} ${y0 + 42} L ${tip} ${y0 + 22}`}
                      stroke={on ? p.green : p.ink}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            );
          })}
        </>
      );

    case 'FT_PLC': {
      const powered = hot('V1') && gnd('G1');
      return (
        <>
          <rect x={232} y={38} width={232} height={56} rx={4} fill="#22303c" pointerEvents="none" />
          <Text x={246} y={58} anchor="start" size={12} bold cond color="#e2e8f0">
            OMRON CP1E
          </Text>
          <Text x={246} y={80} anchor="start" color="#9fb1c2">
            {powered ? 'NO PROGRAM LOADED' : 'no power'}
          </Text>
          <Led x={420} y={54} on={powered} r={4} />
          <Text x={440} y={57} anchor="start" size={7} color="#9fb1c2">
            PWR
          </Text>
          <Led x={420} y={76} on={false} r={4} />
          <Text x={440} y={79} anchor="start" size={7} color="#9fb1c2">
            RUN
          </Text>
          <Text x={20} y={107} anchor="start" bold>
            INPUT CH 0
          </Text>
          {Array.from({ length: 12 }, (_, i) => {
            const id = 'I' + String(i).padStart(2, '0');
            return (
              <Led
                key={id}
                x={50 + (i % 6) * 62 + 20}
                y={FT_PLC_INPUT_ROWS[Math.floor(i / 6)] - 11}
                on={powered && hot(id)}
                r={3}
              />
            );
          })}
          <Text x={20} y={FT_PLC_OUTPUT_Y - 24} anchor="start" bold>
            OUTPUT CH 100
          </Text>
          {Array.from({ length: 8 }, (_, i) => (
            <Led key={i} x={50 + i * 52 + 18} y={FT_PLC_OUTPUT_Y - 11} on={false} r={3} />
          ))}
        </>
      );
    }

    case 'FT_LIMIT': {
      const down = !!pressed[m.id];
      return (
        <>
          {/* Roller lever: push it to throw the contact. */}
          <g {...limit}>
            <rect x={w - 64} y={38} width={24} height={26} rx={3} fill={p.recess} stroke={p.recessStroke} />
            <g
              style={{
                transform: `rotate(${down ? 18 : 0}deg)`,
                transformOrigin: `${w - 52}px 52px`,
                transition: 'transform 120ms',
              }}
            >
              <rect
                x={w - 54}
                y={48}
                width={36}
                height={7}
                rx={3}
                fill="url(#chrome)"
                stroke={p.screwStroke}
                strokeWidth={0.6}
              />
              <circle cx={w - 20} cy={51} r={9} fill="url(#chrome)" stroke={p.screwStroke} />
              <circle cx={w - 20} cy={51} r={2.5} fill={p.screwStroke} />
            </g>
          </g>
          <Text x={20} y={46} anchor="start" size={11} bold cond color={p.red}>
            FESTECH
          </Text>
          {[50, 90].map((x) => (
            <circle key={x} cx={x} cy={74} r={7} fill="url(#brass)" stroke={p.screwStroke} pointerEvents="none" />
          ))}
          <Text x={20} y={100} anchor="start" color={down ? p.green : p.label}>
            {down ? 'COM - N.O' : 'COM - N.C'}
          </Text>
        </>
      );
    }

    case 'FT_V52S':
    case 'FT_V32': {
      const shifted = !!valves[m.id];
      const is52 = m.type === 'FT_V52S';
      return (
        <>
          <CoilBlock x={12} name="Y1" on={!!coils[k('Y')]} />
          <ValveBody x={100} w={w - 112} />
          {is52 ? (
            <>
              <Silencer x={127} y={120} label="5" />
              <Silencer x={213} y={120} label="3" />
            </>
          ) : (
            <Silencer x={130} y={120} label="3" />
          )}
          <Text x={w - 16} y={150} anchor="end" color={shifted ? p.green : p.label}>
            {is52 ? (shifted ? '1>4  2>3' : '1>2  4>5') : shifted ? '1>2' : '2>3  1 shut'}
          </Text>
        </>
      );
    }

    case 'FT_V52D': {
      const shifted = !!valves[m.id];
      return (
        <>
          <CoilBlock x={12} name="Y14" on={!!coils[k('Y14')]} />
          <ValveBody x={98} w={126} />
          <Silencer x={118} y={120} label="5" />
          <Silencer x={202} y={120} label="3" />
          <CoilBlock x={232} name="Y12" on={!!coils[k('Y12')]} />
          <Text x={w / 2} y={150} color={shifted ? p.green : p.label}>
            {shifted ? '1>4  2>3' : '1>2  4>5'}
          </Text>
        </>
      );
    }

    case 'FT_AIR':
      return (
        <>
          <rect
            x={20}
            y={70}
            width={60}
            height={28}
            rx={3}
            fill="url(#chrome)"
            stroke={p.moduleStroke}
            pointerEvents="none"
          />
          <rect
            x={80}
            y={34}
            width={w - 100}
            height={100}
            rx={4}
            fill="url(#chrome)"
            stroke={p.moduleStroke}
            pointerEvents="none"
          />
          <Text x={w - 26} y={88} anchor="end" size={7}>
            8 OUT
          </Text>
        </>
      );

    case 'FT_CYL':
    case 'FT_SCYL': {
      const single = m.type === 'FT_SCYL';
      const st = piston ?? { extended: false, extendCoil: false, retractCoil: false, stalled: false };
      const travel = 150;
      const out = !!acts[k('EXT')];
      const sensorLit = (idx: 1 | 2) => (idx === 1 ? !out : out) && hot(`S${idx}_P`);
      return (
        <>
          {/* Port stems from the fittings down into the end caps. */}
          {(single ? [50] : [50, 250]).map((x) => (
            <rect
              key={x}
              x={x - 4}
              y={60}
              width={8}
              height={14}
              fill="url(#chrome)"
              stroke={p.screwStroke}
              strokeWidth={0.5}
              pointerEvents="none"
            />
          ))}
          <rect
            x={30}
            y={72}
            width={262}
            height={40}
            rx={5}
            fill="url(#housing)"
            stroke={p.moduleStroke}
            pointerEvents="none"
          />
          <rect
            x={24}
            y={68}
            width={12}
            height={48}
            rx={2}
            fill="url(#chrome)"
            stroke={p.screwStroke}
            strokeWidth={0.6}
            pointerEvents="none"
          />
          <rect
            x={286}
            y={68}
            width={12}
            height={48}
            rx={2}
            fill="url(#chrome)"
            stroke={p.screwStroke}
            strokeWidth={0.6}
            pointerEvents="none"
          />
          <g
            style={{
              transform: `translateX(${st.extended ? travel : 0}px)`,
              transition: `transform ${STROKE_MS}ms cubic-bezier(0.4, 0.1, 0.25, 1)`,
              pointerEvents: 'none',
            }}
          >
            <rect
              x={80}
              y={76}
              width={16}
              height={32}
              rx={2}
              fill={p.chrome[0]}
              stroke={p.screwStroke}
              strokeWidth={0.6}
            />
            <rect
              x={96}
              y={88}
              width={220}
              height={8}
              rx={3}
              fill="url(#chrome)"
              stroke={p.screwStroke}
              strokeWidth={0.5}
            />
            <rect
              x={312}
              y={82}
              width={12}
              height={20}
              rx={2}
              fill={p.chrome[0]}
              stroke={p.screwStroke}
              strokeWidth={0.6}
            />
          </g>
          {/* The return spring, squeezed as the piston runs out. */}
          {single && (
            <path
              d={Array.from({ length: 9 }, (_, i) => {
                const x0 = 100 + (st.extended ? travel : 0);
                const x = x0 + ((286 - x0) * i) / 8;
                return (i === 0 ? 'M ' : 'L ') + x + ' ' + (i % 2 ? 78 : 106);
              }).join(' ')}
              fill="none"
              stroke={p.screwStroke}
              strokeWidth={1.4}
              pointerEvents="none"
            />
          )}
          {/* Reed sensors clamped under the barrel, each with its own LED. */}
          {([1, 2] as const).map((idx) => {
            const cx = idx === 1 ? 89 : 239;
            return (
              <g key={idx} pointerEvents="none">
                <rect x={cx - 26} y={112} width={52} height={14} rx={2} fill={COIL_BLOCK} />
                <circle cx={cx + 16} cy={119} r={3} fill={sensorLit(idx) ? '#ef4444' : '#3b4652'} />
                {sensorLit(idx) && (
                  <circle cx={cx + 16} cy={119} r={7} fill="#ef4444" opacity={0.45} filter="url(#glow)" />
                )}
              </g>
            );
          })}
          {[
            { x: 50, live: st.extendCoil },
            ...(single ? [] : [{ x: 250, live: st.retractCoil }]),
          ].map((port) => (
            <circle
              key={port.x}
              cx={port.x + 16}
              cy={40}
              r={3}
              fill={port.live ? TUBE_BLUE : p.ledOff}
              pointerEvents="none"
            />
          ))}
          <Text x={w - 16} y={150} anchor="end" color={st.stalled ? p.red : st.extended ? p.green : p.label}>
            {st.stalled ? 'BOTH PORTS FED' : st.extended ? 'EXTENDED' : 'retracted'}
          </Text>
        </>
      );
    }

    default:
      return null;
  }
}

/** A push-in pneumatic fitting: dark body, blue release collet, glowing when under pressure. */
export function AirFitting({
  x,
  y,
  label,
  live,
  emphasis,
}: {
  x: number;
  y: number;
  label: string;
  live: boolean;
  emphasis: 'on' | 'off' | null;
}) {
  const p = usePalette();
  return (
    <>
      {live && <circle cx={x} cy={y} r={14} fill={TUBE_BLUE} opacity={0.35} filter="url(#glow)" />}
      <polygon
        points={Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          return `${x + Math.cos(a) * 11},${y + Math.sin(a) * 11}`;
        }).join(' ')}
        fill="#2a3440"
        stroke="#0b1015"
        strokeWidth={0.8}
      />
      <circle cx={x} cy={y} r={7.5} fill={live ? TUBE_BLUE : '#0b5c9e'} stroke="#0b1015" strokeWidth={0.6} />
      <circle cx={x} cy={y} r={3.2} fill="#0a0f14" />
      <text
        className="t-mono"
        x={x}
        y={y + 22}
        textAnchor="middle"
        fontSize={emphasis === 'on' ? 10 : 8.5}
        fontWeight={emphasis === 'on' ? 700 : 600}
        fill={emphasis === 'on' ? p.ink : p.label}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </>
  );
}
