'use client';

import { useBoard, useErrors, usePhotoreal } from '@/store/useBoard';
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

/** How far the Festech bench reaches: its PLC hangs past the trainer's plate. */
const BENCH_W = 2440;
/** Where the electrical rack ends and the pneumatics plate begins. */
const RACK_H = 470;

/**
 * The PLC Trainer Board as it stands in the lab: an aluminium frame, the
 * electrical panels hung on chrome rails, then the
 * slotted profile plate the valves and cylinders are clamped to.
 */
function PhotoBench() {
  return (
    <g pointerEvents="none">
      {/* Rails the panels hang from, behind their top and bottom edges. */}
      {[64, 392].map((y) => (
        <rect key={y} x={0} y={y} width={BENCH_W} height={26} fill="url(#rackRail)" />
      ))}
      {/* The shelf between the zones. */}
      <rect x={-12} y={RACK_H} width={BENCH_W + 24} height={22} fill="url(#rackRail)" />
      <rect x={0} y={RACK_H + 30} width={BENCH_W} height={BOARD_H - RACK_H - 30} fill="url(#airPlate)" />
      {/* The T-slots of the profile plate, every 50 mm. Plain rects: a pattern this size re-rasterises on every pan. */}
      {Array.from({ length: Math.floor((BOARD_H - RACK_H - 30) / 50) }, (_, i) => RACK_H + 30 + i * 50 + 22).map((y) => (
        <g key={y}>
          <rect y={y - 1} width={BENCH_W} height={1} fill="#eef1f3" opacity={0.6} />
          <rect y={y} width={BENCH_W} height={6} fill="#8f969d" />
          <rect y={y + 1.5} width={BENCH_W} height={3} fill="#5d646b" />
        </g>
      ))}
      {/* Two uprights and the top rail of the frame. */}
      <rect x={-20} y={-20} width={18} height={BOARD_H + 40} rx={4} fill="url(#upright)" />
      <rect x={BENCH_W + 2} y={-20} width={18} height={BOARD_H + 40} rx={4} fill="url(#upright)" />
      <rect x={-20} y={-24} width={BENCH_W + 40} height={16} rx={4} fill="url(#rackRail)" />
    </g>
  );
}

/** The mounting plate every module is screwed onto. */
export function BoardPlate() {
  const p = usePalette();
  if (usePhotoreal()) return <PhotoBench />;
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
      {/* Photoreal Festech materials, used on the PLC Trainer Board. */}
      <linearGradient id="alu" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e9ebed" />
        <stop offset="45%" stopColor="#cfd3d7" />
        <stop offset="100%" stopColor="#dcdfe2" />
      </linearGradient>
      <linearGradient id="extrusionCap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6a7078" />
        <stop offset="40%" stopColor="#33383e" />
        <stop offset="100%" stopColor="#4c525a" />
      </linearGradient>
      <linearGradient id="rackRail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f1f3f5" />
        <stop offset="35%" stopColor="#aab1b8" />
        <stop offset="60%" stopColor="#d9dde1" />
        <stop offset="100%" stopColor="#7d858d" />
      </linearGradient>
      <linearGradient id="upright" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7d858d" />
        <stop offset="40%" stopColor="#eef1f3" />
        <stop offset="70%" stopColor="#a9b0b7" />
        <stop offset="100%" stopColor="#5c636a" />
      </linearGradient>
      <linearGradient id="airPlate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c9ced3" />
        <stop offset="100%" stopColor="#b3b9bf" />
      </linearGradient>
      <linearGradient id="aluBlock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#eef0f2" />
        <stop offset="50%" stopColor="#cdd2d7" />
        <stop offset="100%" stopColor="#a9b0b7" />
      </linearGradient>
      <linearGradient id="tubeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7d868f" />
        <stop offset="18%" stopColor="#f7f9fb" />
        <stop offset="40%" stopColor="#b4bcc4" />
        <stop offset="62%" stopColor="#eef1f4" />
        <stop offset="100%" stopColor="#596169" />
      </linearGradient>
      <linearGradient id="rodGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6f7780" />
        <stop offset="35%" stopColor="#ffffff" />
        <stop offset="70%" stopColor="#a8b0b8" />
        <stop offset="100%" stopColor="#4f565d" />
      </linearGradient>
      <linearGradient id="turnedGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8f979f" />
        <stop offset="25%" stopColor="#f4f6f8" />
        <stop offset="55%" stopColor="#c2c9cf" />
        <stop offset="100%" stopColor="#6d757d" />
      </linearGradient>
      <linearGradient id="blackGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3a3e44" />
        <stop offset="100%" stopColor="#0f1113" />
      </linearGradient>
      <radialGradient id="nickGrad" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fbfbf8" />
        <stop offset="55%" stopColor="#aeb3b8" />
        <stop offset="100%" stopColor="#4f545a" />
      </radialGradient>
      <radialGradient id="brassCapGrad" cx="38%" cy="32%" r="70%">
        <stop offset="0%" stopColor="#fff0c4" />
        <stop offset="50%" stopColor="#c9a046" />
        <stop offset="100%" stopColor="#6b5014" />
      </radialGradient>
      <radialGradient id="sinter" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#ead2a2" />
        <stop offset="60%" stopColor="#b3905a" />
        <stop offset="100%" stopColor="#6b5228" />
      </radialGradient>
      <linearGradient id="plcBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3a3e44" />
        <stop offset="100%" stopColor="#1c1f23" />
      </linearGradient>
      <radialGradient id="brass" cx="35%" cy="30%">
        <stop offset="0%" stopColor={p.brass[0]} />
        <stop offset="55%" stopColor={p.brass[1]} />
        <stop offset="100%" stopColor={p.brass[2]} />
      </radialGradient>
      {/* Moulded shroud of a 4 mm socket: lit top-left, falling to shadow, over any colour. */}
      <radialGradient id="shroud" cx="36%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
      </radialGradient>
      {/* 22 mm push button, drawn at radius 1: knurled chrome bezel, its bore, a concave red cap. */}
      <radialGradient id="bzl" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#f3f6f9" />
        <stop offset="45%" stopColor="#aab5c3" />
        <stop offset="100%" stopColor="#465161" />
      </radialGradient>
      <linearGradient id="bzlIn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2f3843" />
        <stop offset="100%" stopColor="#cfd6de" />
      </linearGradient>
      <linearGradient id="capRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a0f14" />
        <stop offset="55%" stopColor="#d8383e" />
        <stop offset="100%" stopColor="#f47a7e" />
      </linearGradient>
      <radialGradient id="dish" cx="50%" cy="45%" r="55%">
        <stop offset="70%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
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
      {/* A selected lead is lit from within rather than dashed over. */}
      <filter id="cableGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="7" result="wide" />
        <feGaussianBlur stdDeviation="2.5" result="tight" />
        <feMerge>
          <feMergeNode in="wide" />
          <feMergeNode in="wide" />
          <feMergeNode in="tight" />
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
