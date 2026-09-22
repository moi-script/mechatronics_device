/**
 * The smallest circuit the bench can run, drawn the way it sits on the panel:
 * supply to a push button, the button to a lamp, and a return lead sweeping
 * back along the bottom. On load the three leads draw in the order you would
 * plug them, then the lamp lights. The whole sequence is CSS, and it holds
 * still under `prefers-reduced-motion` (see globals.css).
 */
function Terminal({ x, y, collar }: { x: number; y: number; collar: 'red' | 'black' }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} className={collar === 'red' ? 'fill-safety-red' : 'fill-carbon-900'} />
      <circle cx={x} cy={y} r={6.5} className="fill-steel-200" />
      <circle cx={x} cy={y} r={2.6} className="fill-carbon-900/70" />
    </g>
  );
}

function Plate({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} className="fill-steel-100 stroke-steel-400" strokeWidth={1.5} />
      <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={5} className="fill-none stroke-steel-300" />
      <text
        x={x + w / 2}
        y={y + 24}
        textAnchor="middle"
        className="fill-carbon-600 font-cond text-[12px] font-semibold tracking-wide"
      >
        {label}
      </text>
    </g>
  );
}

export function HeroCircuit({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 340" className={className} role="img" aria-label="A supply, a push button and a lamp wired with three leads; closing the button lights the lamp.">
      {/* Bench surface behind the modules. */}
      <rect width="560" height="340" rx={12} className="fill-steel-200" />
      <g className="stroke-steel-300" strokeWidth={1}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={i} x1={0} y1={i * 48 + 20} x2={560} y2={i * 48 + 20} />
        ))}
      </g>

      {/* 24V supply */}
      <Plate x={24} y={44} w={116} h={200} label="24V SUPPLY" />
      <Terminal x={70} y={110} collar="red" />
      <Terminal x={70} y={200} collar="black" />
      <text x={90} y={115} className="fill-carbon-600 font-mono text-[11px]">VCC</text>
      <text x={90} y={205} className="fill-carbon-600 font-mono text-[11px]">GND</text>

      {/* Push button */}
      <Plate x={238} y={28} w={120} h={132} label="PUSH BUTTON" />
      <circle cx={298} cy={88} r={21} className="fill-steel-300 stroke-steel-400" strokeWidth={1.5} />
      <circle cx={298} cy={88} r={14} className="hero-cap fill-run-green" />
      <Terminal x={268} y={138} collar="black" />
      <Terminal x={328} y={138} collar="red" />

      {/* Lamp */}
      <Plate x={420} y={148} w={116} h={144} label="LAMP" />
      <circle cx={478} cy={210} r={27} className="hero-glow fill-signal-amber" />
      <circle cx={478} cy={210} r={17} className="fill-steel-300 stroke-steel-400" strokeWidth={1.5} />
      <circle cx={478} cy={210} r={17} className="hero-bulb fill-signal-amber" />
      <Terminal x={452} y={266} collar="red" />
      <Terminal x={506} y={266} collar="black" />

      {/* Leads, in the order you would plug them. */}
      <g fill="none" strokeWidth={6} strokeLinecap="round">
        <path d="M 70 110 C 120 200, 220 214, 268 138" pathLength={1} className="hero-lead hero-lead-1 stroke-signal-blue" />
        <path d="M 328 138 C 356 226, 408 214, 452 266" pathLength={1} className="hero-lead hero-lead-2 stroke-safety-red" />
        <path d="M 506 266 C 524 332, 180 336, 70 200" pathLength={1} className="hero-lead hero-lead-3 stroke-carbon-900" />
      </g>
    </svg>
  );
}
