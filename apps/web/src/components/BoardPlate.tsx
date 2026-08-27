'use client';

import { useBoard, useErrors } from '@/store/useBoard';
import { BOARD_H, BOARD_W } from '@/lib/geometry';

/**
 * The engineering title block. A real panel drawing carries one, and it is the
 * honest place to put the board's live metadata.
 */
function TitleBlock() {
  const leads = useBoard((s) => s.circuit.wires.length);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const tripped = useBoard((s) => s.tripped);
  const faults = useErrors().length;

  const x = BOARD_W - 412;
  const y = BOARD_H - 152;
  const w = 380;
  const h = 120;
  const colW = w / 3;

  const cells: [string, string, string][] = [
    ['SUPPLY', tripped ? 'TRIPPED' : live ? 'LIVE' : 'ISOLATED', tripped ? '#c62828' : live ? '#1b9c5a' : '#5b6b7b'],
    ['LEADS', String(leads).padStart(2, '0'), '#16202b'],
    ['FAULTS', String(faults).padStart(2, '0'), faults ? '#c62828' : '#16202b'],
  ];

  return (
    <g transform={`translate(${x},${y})`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <rect width={w} height={h} fill="#f6f8fa" stroke="#16202b" strokeWidth={1.5} />
      <rect width={w} height={38} fill="#16202b" />
      <text className="t-cond" x={14} y={25} fontSize={14} fontWeight={700} fill="#f1f5f9" letterSpacing={1.2}>
        MECHATRONIC TRAINER
      </text>
      <text className="t-mono" x={w - 14} y={24} textAnchor="end" fontSize={8.5} fill="#8fa2b4">
        SHEET 1/1 · REV A
      </text>

      {cells.map(([label, value, color], i) => (
        <g key={label} transform={`translate(${i * colW},38)`}>
          {i > 0 && <path d={`M 0 0 V ${h - 38}`} stroke="#16202b" strokeWidth={1} />}
          <text className="t-mono" x={12} y={20} fontSize={8} fill="#5b6b7b" letterSpacing={0.8}>
            {label}
          </text>
          <text className="t-cond" x={12} y={48} fontSize={22} fontWeight={700} fill={color}>
            {value}
          </text>
        </g>
      ))}
      <path d={`M 0 ${h - 22} H ${w}`} stroke="#16202b" strokeWidth={1} />
      <text className="t-mono" x={12} y={h - 8} fontSize={7.5} fill="#5b6b7b">
        DIN-RAIL TRAINING PANEL · 24 V DC · NOT TO SCALE
      </text>
    </g>
  );
}

/** The mounting plate every module is screwed onto. */
export function BoardPlate() {
  return (
    <>
      <rect width={BOARD_W} height={BOARD_H} rx={10} fill="url(#backplate)" stroke="#93a1b0" strokeWidth={2} />
      {/* Inset scribe line, like the edge fold on a steel backpan. */}
      <rect
        x={14}
        y={14}
        width={BOARD_W - 28}
        height={BOARD_H - 28}
        rx={6}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.7}
      />
      <rect
        x={15}
        y={15}
        width={BOARD_W - 30}
        height={BOARD_H - 30}
        rx={6}
        fill="none"
        stroke="#a9b6c4"
        strokeOpacity={0.5}
      />
      {[
        [30, 30],
        [BOARD_W - 30, 30],
        [30, BOARD_H - 30],
        [BOARD_W - 30, BOARD_H - 30],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={6} fill="#c3ccd7" stroke="#93a1b0" />
          <circle cx={cx} cy={cy} r={2.5} fill="#8595a5" />
        </g>
      ))}
      <TitleBlock />
    </>
  );
}

/** Materials: the gradients and filters every panel part is built from. */
export function BoardDefs() {
  return (
    <defs>
      <linearGradient id="backplate" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#eef2f6" />
        <stop offset="100%" stopColor="#dbe2ea" />
      </linearGradient>
      <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fdfefe" />
        <stop offset="55%" stopColor="#f2f6f9" />
        <stop offset="100%" stopColor="#e4eaf1" />
      </linearGradient>
      <linearGradient id="chrome" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#cdd7e0" />
        <stop offset="100%" stopColor="#9fadbb" />
      </linearGradient>
      <linearGradient id="housing" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#eff4f8" />
        <stop offset="100%" stopColor="#d3dde6" />
      </linearGradient>
      <linearGradient id="capGloss" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
      </linearGradient>
      <radialGradient id="brass" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#fde9b0" />
        <stop offset="55%" stopColor="#d9a83a" />
        <stop offset="100%" stopColor="#8a6a12" />
      </radialGradient>
      <radialGradient id="lensOn" cx="38%" cy="32%">
        <stop offset="0%" stopColor="#fffbe8" />
        <stop offset="45%" stopColor="#fcd34d" />
        <stop offset="100%" stopColor="#d97706" />
      </radialGradient>
      <radialGradient id="lensOff" cx="38%" cy="32%">
        <stop offset="0%" stopColor="#f4f7fa" />
        <stop offset="100%" stopColor="#ccd6df" />
      </radialGradient>
      <pattern id="hazard" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#f5d020" />
        <rect width="5" height="10" fill="#16202b" />
      </pattern>
      <filter id="glow" x="-90%" y="-90%" width="280%" height="280%">
        <feGaussianBlur stdDeviation="6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="lift" x="-12%" y="-12%" width="130%" height="140%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#334155" floodOpacity="0.28" />
      </filter>
      <filter id="cable" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#1e293b" floodOpacity="0.3" />
      </filter>
    </defs>
  );
}
