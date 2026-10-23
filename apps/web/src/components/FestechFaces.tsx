'use client';

import {
  FT_PBU_BLOCK_Y,
  FT_PLC_INPUT_ROWS,
  FT_PLC_OUTPUT_ROWS,
  FT_RELAY_BLOCK_Y,
  LIMIT_ROLLER,
  ROD_CAP,
  moduleLabel,
  PARTS,
  type ModuleInstance,
} from '@mech/sim';
import { useBoard, usePhotoreal } from '@/store/useBoard';
import { useLadderEditor } from '@/store/useLadderEditor';
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
  const toggled = useBoard((s) => s.toggled);
  const flipToggle = useBoard((s) => s.flipToggle);
  const openLadder = useLadderEditor((s) => s.open);
  const limit = useMomentary(m.id);
  const buttons = [useMomentary(m.id + '.B1'), useMomentary(m.id + '.B2'), useMomentary(m.id + '.B3')];

  const photo = usePhotoreal();
  const k = (id: string) => m.id + '.' + id;
  const hot = (pin: string) => !!nets[pinNet[k(pin)]]?.hot;
  const gnd = (pin: string) => !!nets[pinNet[k(pin)]]?.gnd;

  if (photo && PHOTO_PNEUMATIC.has(m.type)) return <PhotoPneumatic m={m} />;

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
                  {/* Same 22 mm operator as the trainer's: knurled bezel, bore, concave cap. */}
                  <g transform={`translate(42 ${cy}) scale(22)`}>
                    <circle r={1.06} cy={0.09} fill="#000000" opacity={0.45} />
                    <circle r={1} fill="url(#bzl)" />
                    <circle r={0.93} fill="none" stroke="#28313c" strokeWidth={0.06} strokeDasharray="0.035 0.055" opacity={0.65} />
                    <circle r={0.85} fill="url(#bzlIn)" />
                    <circle r={0.78} fill="#07090c" />
                    <g transform={down ? 'translate(0 0.05) scale(0.95)' : undefined}>
                      <circle r={0.72} fill={caps[b]} opacity={lit ? 1 : 0.85} />
                      <circle r={0.72} fill="url(#dish)" />
                      {!down && <ellipse cx={-0.16} cy={-0.34} rx={0.42} ry={0.18} fill="#ffffff" opacity={0.38} />}
                    </g>
                  </g>
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
      const run = powered && !!toggled[m.id];
      const rungs = m.ladder?.length ?? 0;
      // Both keys sit on the module, so a press must not start a drag.
      const key = (x: number, label: string, lit: boolean, onPress: () => void) => (
        <g
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPress();
          }}
        >
          <rect x={x} y={46} width={40} height={17} rx={3} fill={lit ? '#22b14c' : '#2b2e33'} stroke="#55595f" />
          <Text x={x + 20} y={57.5} size={7} bold cond color={lit ? '#0b1a12' : '#e2e8f0'}>
            {label}
          </Text>
        </g>
      );
      return (
        <>
          {/* The CP1E CPU itself: a black moulded housing with its marks and a smoked window. */}
          <g pointerEvents="none">
            <rect x={230} y={36} width={236} height={62} rx={4} fill="url(#plcBody)" stroke="#050607" />
            <rect x={230} y={36} width={236} height={1.5} fill="#ffffff" opacity={0.1} />
            <rect x={230} y={36} width={84} height={62} rx={4} fill="#1f2226" />
          </g>
          <Text x={240} y={52} anchor="start" size={10} bold color="#e6e8ea">
            omron
          </Text>
          <Text x={240} y={65} anchor="start" size={9} bold cond color="#e6e8ea">
            SYSMAC CP1E
          </Text>
          <Text x={240} y={88} anchor="start" size={7} color="#b8bcc1">
            {!powered ? 'no power' : rungs === 0 ? 'NO PROGRAM LOADED' : `${rungs} ${rungs === 1 ? 'RUNG' : 'RUNGS'} · ${run ? 'RUN' : 'STOP'}`}
          </Text>
          {key(326, toggled[m.id] ? 'RUN' : 'STOP', !!toggled[m.id], () => flipToggle(m.id))}
          {key(370, 'PROGRAM', false, () => openLadder(m.id))}
          <Led x={420} y={54} on={powered} r={4} />
          <Text x={440} y={57} anchor="start" size={7} color="#9fb1c2">
            PWR
          </Text>
          <Led x={420} y={76} on={run} r={4} />
          <Text x={440} y={79} anchor="start" size={7} color="#9fb1c2">
            RUN
          </Text>
          <Text x={20} y={107} anchor="start" bold>
            INPUT CH 0
          </Text>
          <Text x={20} y={FT_PLC_INPUT_ROWS[2] - 26} anchor="start" bold>
            INPUT CH 1
          </Text>
          {Array.from({ length: 18 }, (_, i) => {
            const id = 'I' + String(i).padStart(2, '0');
            return (
              <Led
                key={id}
                x={50 + (i % 6) * 62 + 20}
                y={FT_PLC_INPUT_ROWS[Math.floor(i / 6)] - 11}
                on={powered && hot(id)} color="#ffae2a"
                r={3}
              />
            );
          })}
          <Text x={20} y={FT_PLC_OUTPUT_ROWS[0] - 24} anchor="start" bold>
            OUTPUT CH 100
          </Text>
          {Array.from({ length: 12 }, (_, i) => (
            <Led
              key={i}
              x={50 + (i % 6) * 62 + 20}
              y={FT_PLC_OUTPUT_ROWS[Math.floor(i / 6)] - 11}
              on={!!acts[k('Q' + String(i).padStart(2, '0'))]}
              r={3}
              color="#ffae2a"
            />
          ))}
        </>
      );
    }

    case 'FT_LIMIT': {
      // Bolted to a stroke it is thrown by the rod, so the face follows the
      // solver rather than the pointer.
      const down = !!acts[m.id];
      const mount = m.mount;
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
          {mount && (
            <Text x={20} y={62} anchor="start" size={10} color={p.label}>
              {moduleLabel(m).replace('Limit switch ', '') + ' · ' + (mount.at === 'out' ? 'END OF STROKE' : 'HOME')}
            </Text>
          )}
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
            const cx = idx === 1 ? 39 : 109;
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

/** The pneumatic hardware, drawn as hardware rather than as panels on the PLC Trainer Board. */
export const PHOTO_PNEUMATIC: ReadonlySet<string> = new Set([
  'FT_AIR',
  'FT_V52S',
  'FT_V52D',
  'FT_V32',
  'FT_CYL',
  'FT_SCYL',
  'FT_LIMIT',
]);

const INK = '#1c1e21';
const PRINT = '#2a2d31';

/** Printed lettering on the hardware: condensed, dark, small. */
const Print = ({
  x,
  y,
  children,
  size = 8.5,
  anchor = 'start',
  color = PRINT,
  weight = 400,
  italic,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  weight?: number;
  italic?: boolean;
}) => (
  <text
    className="t-cond"
    x={x}
    y={y}
    textAnchor={anchor}
    fontSize={size}
    fontWeight={weight}
    fontStyle={italic ? 'italic' : undefined}
    fill={color}
    style={{ pointerEvents: 'none', userSelect: 'none' }}
  >
    {children}
  </text>
);

const Mark = ({ x, y, size = 11, anchor = 'end' as const }: { x: number; y: number; size?: number; anchor?: 'start' | 'end' }) => (
  <Print x={x} y={y} size={size} anchor={anchor} weight={800} italic color="#d12a24">
    FESTECH
  </Print>
);

/** The black T-slot clamp a part is bolted down with. */
const Clamp = ({ x, y, w = 60 }: { x: number; y: number; w?: number }) => (
  <rect x={x} y={y} width={w} height={14} rx={3} fill="url(#blackGrad)" pointerEvents="none" />
);

/** A sintered bronze silencer in an exhaust port. */
const Sinter = ({ x, y, label }: { x: number; y: number; label: string }) => (
  <g pointerEvents="none">
    <rect x={x - 10} y={y - 14} width={20} height={28} rx={5} fill="url(#sinter)" />
    <rect x={x - 10} y={y - 14} width={20} height={28} rx={5} fill="none" stroke="#6b5228" strokeOpacity={0.6} />
    <Print x={x} y={y - 18} anchor="middle" size={10}>
      {label}
    </Print>
  </g>
);

/**
 * A solenoid head: the black moulded coil with its connector holes and LED,
 * and the + / - sockets set into its foot.
 */
const SolenoidHead = ({ x, name, on }: { x: number; name: string; on: boolean }) => (
  <g pointerEvents="none">
    <rect x={x} y={30} width={88} height={110} rx={6} fill="url(#blackGrad)" />
    <rect x={x + 4} y={34} width={80} height={3} rx={1.5} fill="#ffffff" opacity={0.12} />
    {[
      [x + 30, 54],
      [x + 58, 54],
      [x + 44, 76],
    ].map(([cx, cy]) => (
      <circle key={cx + '-' + cy} cx={cx} cy={cy} r={6} fill="#0a0b0d" />
    ))}
    <circle cx={x + 76} cy={44} r={3} fill={on ? '#ff3b3b' : '#5a1a1c'} />
    {on && <circle cx={x + 76} cy={44} r={8} fill="#ff3b3b" opacity={0.5} filter="url(#glow)" />}
    <Print x={x + 10} y={98} size={12} weight={700} color="#e6e8ea">
      {name}
    </Print>
    <Print x={x + 82} y={98} size={8} anchor="end" weight={700} italic color="#c9cdd2">
      FESTECH
    </Print>
  </g>
);

/** The valve's aluminium body, with its printed name and ISO symbol. */
const PhotoValveBody = ({ x, w, lines, shifted }: { x: number; w: number; lines: [string, string]; shifted: boolean }) => (
  <g pointerEvents="none">
    <rect x={x} y={26} width={w} height={118} rx={5} fill="url(#aluBlock)" />
    <rect x={x} y={26} width={w} height={118} rx={5} fill="none" stroke="#8a9096" />
    <path d={`M${x + 2} 28H${x + w - 2}`} stroke="#ffffff" strokeWidth={1.4} opacity={0.8} />
    <Print x={x + 8} y={150} size={8}>
      {lines[0]}
    </Print>
    <Print x={x + 8} y={159} size={8}>
      {lines[1]}
    </Print>
    {/* Two squares of the ISO symbol; the live one is the one the spool sits in. */}
    <g transform={`translate(${x + w - 46} 30)`} stroke={INK} strokeWidth={1} fill="none">
      <rect width={18} height={14} fill={shifted ? 'none' : '#22b14c'} fillOpacity={0.25} />
      <rect x={18} width={18} height={14} fill={shifted ? '#22b14c' : 'none'} fillOpacity={0.25} />
      <path d="M4 11l10 -8M22 3v8M32 3v8" />
    </g>
  </g>
);

export function PhotoPneumatic({ m }: { m: ModuleInstance }) {
  const coils = useBoard((s) => s.sim.coils);
  const acts = useBoard((s) => s.sim.actuated);
  const valves = useBoard((s) => s.sim.valves);
  const nets = useBoard((s) => s.sim.nets);
  const pinNet = useBoard((s) => s.sim.pinNet);
  const piston = useBoard((s) => s.sim.pistons[m.id]);
  const limit = useMomentary(m.id);
  const w = PARTS[m.type].width;
  const k = (id: string) => m.id + '.' + id;
  const hot = (pin: string) => !!nets[pinNet[k(pin)]]?.hot;

  switch (m.type) {
    case 'FT_AIR':
      return (
        <g pointerEvents="none">
          {/* The green supply line from the service unit into IN. */}
          <path d="M-26 66 C -14 62, -2 84, 22 84" fill="none" stroke="#0e5a35" strokeWidth={13} strokeLinecap="round" />
          <path d="M-26 66 C -14 62, -2 84, 22 84" fill="none" stroke="#1f8a52" strokeWidth={9} strokeLinecap="round" />
          <path d="M-26 65 C -14 61, -2 83, 22 83" fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.4} />
          <Clamp x={150} y={136} />
          <rect x={72} y={22} width={222} height={116} rx={5} fill="url(#aluBlock)" filter="url(#lift)" />
          <rect x={72} y={22} width={222} height={116} rx={5} fill="none" stroke="#8a9096" />
          <path d="M74 24H292" stroke="#ffffff" strokeWidth={1.4} opacity={0.8} />
          <rect x={6} y={70} width={60} height={28} rx={6} fill="url(#blackGrad)" />
          <path d="M92 84H284M135 40V128M185 40V128M235 40V128" stroke={INK} strokeWidth={1.2} opacity={0.55} />
          <Print x={80} y={37} size={13} color={INK}>
            -⟐
          </Print>
          <Print x={100} y={36} size={8}>
            AIR DISTRIBUTOR · PN. 12201
          </Print>
          <Mark x={288} y={37} />
        </g>
      );

    case 'FT_V52S':
    case 'FT_V32':
    case 'FT_V52D': {
      const shifted = !!valves[m.id];
      const double = m.type === 'FT_V52D';
      const is52 = m.type !== 'FT_V32';
      const bodyX = 96;
      const bodyW = (double ? 222 : w - 8) - bodyX;
      return (
        <>
          <Clamp x={bodyX + bodyW - 52} y={146} w={44} />
          <PhotoValveBody
            x={bodyX}
            w={bodyW}
            shifted={shifted}
            lines={
              m.type === 'FT_V32'
                ? ['3/2-WAY NC', 'PN. 13010']
                : double
                  ? ['5/2-WAY', 'PN. 13013']
                  : ['5/2-WAY', 'PN. 13011']
            }
          />
          {double ? (
            <>
              <SolenoidHead x={6} name="Y14" on={!!coils[k('Y14')]} />
              <SolenoidHead x={224} name="Y12" on={!!coils[k('Y12')]} />
              <Sinter x={118} y={118} label="5" />
              <Sinter x={202} y={118} label="3" />
            </>
          ) : (
            <>
              <SolenoidHead x={6} name="Y1" on={!!coils[k('Y')]} />
              {is52 ? (
                <>
                  <Sinter x={120} y={118} label="5" />
                  <Sinter x={222} y={118} label="3" />
                </>
              ) : (
                <Sinter x={130} y={118} label="3" />
              )}
            </>
          )}
          {!double && <Mark x={w - 12} y={22} size={10} />}
        </>
      );
    }

    case 'FT_CYL':
    case 'FT_SCYL': {
      const single = m.type === 'FT_SCYL';
      const st = piston ?? { extended: false, extendCoil: false, retractCoil: false, stalled: false };
      const out = !!acts[k('EXT')];
      const travel = ROD_CAP.outX - ROD_CAP.homeX;
      const capX = ROD_CAP.homeX - 28;
      const lit = (idx: 1 | 2) => (idx === 1 ? !out : out) && hot(`S${idx}_P`);
      // Reed clamps on the tube, each wired down to its own socket block under the barrel.
      const reeds = [
        { idx: 1 as const, clamp: 118, block: 39 },
        { idx: 2 as const, clamp: 186, block: 109 },
      ];
      return (
        <g pointerEvents="none">
          <Clamp x={22} y={100} />
          <Clamp x={222} y={100} />
          {/* Rod and its turned end cap, run out by the piston. */}
          <g
            style={{
              transform: `translateX(${st.extended ? travel : 0}px)`,
              transition: `transform ${STROKE_MS}ms cubic-bezier(0.4, 0.1, 0.25, 1)`,
            }}
          >
            {/* Long enough to stay inside the cylinder at full stroke; the tube hides the rest. */}
            <rect x={capX - travel - 60} y={53} width={travel + 70} height={18} rx={4} fill="url(#rodGrad)" />
            <rect x={capX} y={34} width={56} height={ROD_CAP.bottom - 34} rx={22} fill="url(#turnedGrad)" filter="url(#lift)" />
          </g>
          <rect x={86} y={36} width={136} height={52} fill="url(#tubeGrad)" filter="url(#lift)" />
          <rect x={14} y={26} width={76} height={72} rx={6} fill="url(#aluBlock)" filter="url(#lift)" />
          <rect x={14} y={26} width={76} height={72} rx={6} fill="none" stroke="#8a9096" />
          <rect x={214} y={26} width={76} height={72} rx={6} fill="url(#aluBlock)" filter="url(#lift)" />
          <rect x={214} y={26} width={76} height={72} rx={6} fill="none" stroke="#8a9096" />
          {single && <circle cx={270} cy={44} r={6} fill="url(#sinter)" />}
          <Print x={150} y={50} size={7} anchor="middle">
            {single ? 'SINGLE ACTING' : 'DOUBLE ACTING'}
          </Print>
          <Mark x={150} y={80} size={9} anchor="end" />
          {single && (
            <g transform="translate(156 72)" stroke={INK} strokeWidth={0.9} fill="none">
              <rect width={36} height={12} />
              <path d="M6 0v12M10 2l3 8l3 -8l3 8l3 -8l3 8" />
            </g>
          )}
          {reeds.map(({ idx, clamp, block }) => (
            <g key={idx}>
              <rect x={clamp - 22} y={84} width={44} height={12} rx={3} fill="url(#blackGrad)" />
              <circle cx={clamp + 14} cy={90} r={2.6} fill={lit(idx) ? '#ff3b3b' : '#5a1a1c'} />
              {lit(idx) && <circle cx={clamp + 14} cy={90} r={7} fill="#ff3b3b" opacity={0.5} filter="url(#glow)" />}
              <path
                d={`M${clamp - 22} 92 C ${clamp - 40} 110, ${block} 108, ${block} 130`}
                fill="none"
                stroke="#141518"
                strokeWidth={3}
              />
              <rect x={block - 32} y={130} width={64} height={28} rx={5} fill="url(#blackGrad)" />
            </g>
          ))}
          <Print x={capX + 64} y={30} size={8} color={st.stalled ? '#c22520' : st.extended ? '#13803a' : PRINT}>
            {st.stalled ? 'BOTH PORTS FED' : st.extended ? 'EXTENDED' : 'RETRACTED'}
          </Print>
        </g>
      );
    }

    case 'FT_LIMIT': {
      const down = !!acts[m.id];
      const mount = m.mount;
      const tag = mount ? moduleLabel(m).replace('Limit switch ', '') : m.id;
      // The roller stands where the rod-end cap passes; a loose switch keeps it mid-top.
      const rx = mount ? LIMIT_ROLLER[mount.at] : 94;
      // The lever leans from its microswitch toward the roller, from whichever side has room.
      const side = rx > 120 ? -1 : 1;
      const pivot = rx + 26 * side;
      const swX = side === 1 ? pivot - 10 : pivot - 60;
      return (
        <>
          <g pointerEvents="none">
            <Clamp x={70} y={148} w={74} />
            {/* The black body, its side showing behind the face. */}
            <rect x={4} y={22} width={50} height={128} rx={4} fill="url(#blackGrad)" />
            <rect x={8} y={26} width={8} height={120} rx={2} fill="#4a4f56" opacity={0.6} />
            {/* The microswitch on the top edge. */}
            <rect x={swX} y={6} width={70} height={20} rx={2} fill="url(#blackGrad)" />
            <rect x={pivot - 5} y={10} width={10} height={6} rx={1} fill="#2a2d31" />
            {/* The face plate. */}
            <rect x={24} y={22} width={160} height={128} rx={3} fill="#e2e3e3" filter="url(#lift)" />
            <rect x={24} y={22} width={160} height={128} rx={3} fill="none" stroke="#b7babd" />
            <path d="M26 24H182M26 24V148" stroke="#ffffff" strokeWidth={1.4} opacity={0.8} />
            <Print x={34} y={46} size={14} weight={700} color="#c8343a">
              FESTECH
            </Print>
            <g stroke={INK} strokeWidth={1} fill="none">
              <path d={`M128 44h7l9 ${down ? 0 : -7}M144 37h4M140 44v6h8`} />
            </g>
            <Print x={150} y={39} size={7}>
              N.C
            </Print>
            <Print x={150} y={53} size={7}>
              N.O
            </Print>
            {[72, 136].map((x) => (
              <g key={x} transform={`translate(${x} 78)`}>
                <circle r={10} fill="url(#brassCapGrad)" />
                <circle r={8.6} fill="none" stroke="#6b5014" strokeWidth={1.6} strokeDasharray="1 1.4" opacity={0.7} />
                <path d="M-4 0h8M0 -4v8" stroke="#3a2c08" strokeWidth={1.6} />
              </g>
            ))}
            <rect x={24} y={150} width={52} height={18} rx={4} fill="#0a0f15" />
            <text className="t-mono" x={50} y={163} textAnchor="middle" fontSize={11} fontWeight={700} fill={down ? '#fcd34d' : '#e6edf5'}>
              {tag}
              {down ? ' ●' : ''}
            </text>
          </g>
          {/* Stainless lever and roller. Bolted to a stroke, only the rod-end cap
              riding over it pushes it down; a loose one is pressed by hand. */}
          <g {...(mount ? { pointerEvents: 'none' as const } : limit)}>
            <g
              style={{
                transform: `rotate(${down ? -16 * side : 0}deg)`,
                transformOrigin: `${pivot}px 12px`,
                transition: `transform ${mount ? 180 : 120}ms`,
              }}
            >
              <path
                d={`M${pivot} 12 L ${rx + 2 * side} ${LIMIT_ROLLER.y + 2}`}
                stroke="url(#rodGrad)"
                strokeWidth={5}
                strokeLinecap="round"
              />
              <circle cx={rx} cy={LIMIT_ROLLER.y} r={10} fill="url(#nickGrad)" stroke="#5c636a" />
              <circle cx={rx} cy={LIMIT_ROLLER.y} r={2.8} fill="#3e4349" />
            </g>
          </g>
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
  const photo = usePhotoreal();
  if (photo)
    return (
      <>
        {live && <circle cx={x} cy={y} r={16} fill={TUBE_BLUE} opacity={0.4} filter="url(#glow)" />}
        <circle cx={x} cy={y + 1.5} r={13} fill="#000000" opacity={0.3} />
        <circle cx={x} cy={y} r={12} fill="url(#blackGrad)" />
        <circle cx={x} cy={y} r={8.4} fill={live ? '#2aa0ee' : '#1a86cf'} stroke="#0a4f80" />
        <circle cx={x} cy={y} r={5.4} fill="#0a0c0e" />
        <ellipse cx={x - 4} cy={y - 6} rx={3.4} ry={1.4} fill="#ffffff" opacity={0.35} transform={`rotate(-25 ${x - 4} ${y - 6})`} />
        <text
          className="t-cond"
          x={x}
          y={y + 24}
          textAnchor="middle"
          fontSize={emphasis === 'on' ? 11 : 10}
          fontWeight={700}
          fill="#1c1e21"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      </>
    );
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
