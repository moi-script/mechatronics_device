'use client';

import { useBoard, useErrors } from '@/store/useBoard';
import { BOARD_H, BOARD_W } from '@/lib/geometry';
import { usePalette } from '@/store/useTheme';

/**
 * The engineering title block. A real panel drawing carries one, and it is the
 * honest place to put the board's live metadata.
 */
function TitleBlock() {
  const leads = useBoard((s) => s.circuit.wires.length);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const tripped = useBoard((s) => s.tripped);
  const faults = useErrors().length;
  const p = usePalette();

  const x = BOARD_W - 412;
  const y = BOARD_H - 152;
  const w = 380;
  const h = 120;
  const colW = w / 3;

  const cells: [string, string, string][] = [
    ['SUPPLY', tripped ? 'TRIPPED' : live ? 'LIVE' : 'ISOLATED', tripped ? p.red : live ? p.green : p.label],
    ['LEADS', String(leads).padStart(2, '0'), p.ink],
    ['FAULTS', String(faults).padStart(2, '0'), faults ? p.red : p.ink],
  ];

  return (
    <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <rect width={w} height={h} fill={p.titleFace} stroke={p.titleRule} strokeWidth={1.5} />
      <rect width={w} height={38} fill={p.titleBar} />
      <text className="t-cond" x={14} y={25} fontSize={14} fontWeight={700} fill={p.titleBarText} letterSpacing={1.2}>
        MECHATRONIC TRAINER
      </text>
      <text className="t-mono" x={w - 14} y={24} textAnchor="end" fontSize={8.5} fill={p.legendTag}>
        SHEET 1/1 · REV A
      </text>

      {cells.map(([label, value, color], i) => (
        <g key={label} transform={`translate(${i * colW},38)`}>
          {i > 0 && <path d={`M 0 0 V ${h - 38}`} stroke={p.titleRule} strokeWidth={1} />}
          <text className="t-mono" x={12} y={20} fontSize={8} fill={p.label} letterSpacing={0.8}>
            {label}
          </text>
          <text className="t-cond" x={12} y={48} fontSize={22} fontWeight={700} fill={color}>
            {value}
          </text>
        </g>
      ))}
      <path d={`M 0 ${h - 22} H ${w}`} stroke={p.titleRule} strokeWidth={1} />
      <text className="t-mono" x={12} y={h - 8} fontSize={7.5} fill={p.label}>
        DIN-RAIL TRAINING PANEL · 24 V DC · NOT TO SCALE
      </text>
    </g>
  );
}

/** The mounting plate every module is screwed onto. */
export function BoardPlate() {
  const p = usePalette();
  return (
    <>
      <rect width={BOARD_W} height={BOARD_H} rx={10} fill="url(#backplate)" stroke={p.boardStroke} strokeWidth={2} />
      {/* Inset scribe line, like the edge fold on a steel backpan. */}
      <rect
        x={14}
        y={14}
        width={BOARD_W - 28}
        height={BOARD_H - 28}
        rx={6}
        fill="none"
        stroke={p.bevelLight}
        strokeOpacity={0.7}
      />
      <rect
        x={15}
        y={15}
        width={BOARD_W - 30}
        height={BOARD_H - 30}
        rx={6}
        fill="none"
        stroke={p.bevelDark}
        strokeOpacity={0.5}
      />
      {[
        [30, 30],
        [BOARD_W - 30, 30],
        [30, BOARD_H - 30],
        [BOARD_W - 30, BOARD_H - 30],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={6} fill={p.screwFill} stroke={p.screwStroke} />
          <circle cx={cx} cy={cy} r={2.5} fill={p.screwSlot} />
        </g>
      ))}
      <TitleBlock />
    </>
  );
}

/** Materials: the gradients and filters every panel part is built from. */
export function BoardDefs() {
  const p = usePalette();
  return (
    <defs>
      <linearGradient id="backplate" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor={p.backplate[0]} />
        <stop offset="100%" stopColor={p.backplate[1]} />
      </linearGradient>
      <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={p.plate[0]} />
        <stop offset="55%" stopColor={p.plate[1]} />
        <stop offset="100%" stopColor={p.plate[2]} />
      </linearGradient>
      <linearGradient id="chrome" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor={p.chrome[0]} />
        <stop offset="45%" stopColor={p.chrome[1]} />
        <stop offset="100%" stopColor={p.chrome[2]} />
      </linearGradient>
      <linearGradient id="housing" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={p.housing[0]} />
        <stop offset="100%" stopColor={p.housing[1]} />
      </linearGradient>
      <linearGradient id="capGloss" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
      </linearGradient>
      <radialGradient id="brass" cx="35%" cy="30%">
        <stop offset="0%" stopColor={p.brass[0]} />
        <stop offset="55%" stopColor={p.brass[1]} />
        <stop offset="100%" stopColor={p.brass[2]} />
      </radialGradient>
      <radialGradient id="lensOn" cx="38%" cy="32%">
        <stop offset="0%" stopColor={p.lensOn[0]} />
        <stop offset="45%" stopColor={p.lensOn[1]} />
        <stop offset="100%" stopColor={p.lensOn[2]} />
      </radialGradient>
      <radialGradient id="lensOff" cx="38%" cy="32%">
        <stop offset="0%" stopColor={p.lensOff[0]} />
        <stop offset="100%" stopColor={p.lensOff[1]} />
      </radialGradient>
      <pattern id="hazard" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#f5d020" />
        <rect width="5" height="10" fill="#1a232e" />
      </pattern>
      <filter id="glow" x="-90%" y="-90%" width="280%" height="280%">
        <feGaussianBlur stdDeviation="6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="lift" x="-12%" y="-12%" width="130%" height="140%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor={p.cableShadow} floodOpacity={p.cableShadowOpacity} />
      </filter>
      <filter id="cable" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={p.cableShadow} floodOpacity={p.cableShadowOpacity} />
      </filter>
    </defs>
  );
}
