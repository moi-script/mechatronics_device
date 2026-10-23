'use client';

/**
 * The smallest circuit the bench can run, and it really runs: the same solver
 * the board uses is wired up to four modules here — breaker, supply, push
 * button, lamp — so closing the breaker and holding the button lights the lamp
 * for the same reason it does in the app. Reversing the lamp's leads produces
 * the solver's own reversed-polarity error rather than a canned message.
 *
 * On load the three leads draw in the order you would plug them (globals.css),
 * which is the one thing here that happens without being asked.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyState, step, type Circuit } from '@mech/sim';

const terminal = (moduleId: string, pinId: string) => ({ kind: 'terminal' as const, moduleId, pinId });

/** Supply to button, button to lamp, lamp back to supply. */
function demoCircuit(reversed: boolean): Circuit {
  // Reversing swaps which lamp terminal takes the live lead and which takes the return.
  const live = reversed ? 'GND' : 'VCC';
  const back = reversed ? 'VCC' : 'GND';
  return {
    modules: [
      { id: 'BREAKER', type: 'BREAKER', x: 0, y: 0 },
      { id: 'SUPPLY', type: 'SUPPLY', x: 0, y: 0 },
      { id: 'PB1', type: 'PUSHBTN', x: 0, y: 0 },
      { id: 'LAMP1', type: 'LAMP', x: 0, y: 0 },
    ],
    wires: [
      { id: 'w1', color: 'blue', a: terminal('SUPPLY', 'VCC1'), b: terminal('PB1', 'COM1') },
      { id: 'w2', color: 'red', a: terminal('PB1', 'NO1'), b: terminal('LAMP1', live) },
      { id: 'w3', color: 'black', a: terminal('LAMP1', back), b: terminal('SUPPLY', 'GND1') },
    ],
  };
}

function Terminal({ x, y, collar }: { x: number; y: number; collar: 'red' | 'black' }) {
  return (
    <g>
      {/* A 4 mm banana socket, as on the board itself. */}
      <circle cx={x} cy={y + 1.6} r={11.4} fill="#000000" opacity={0.4} />
      <circle cx={x} cy={y} r={11} fill={collar === 'red' ? '#d93636' : '#11161d'} />
      <circle cx={x} cy={y} r={11} fill="url(#heroShroud)" />
      <circle cx={x} cy={y} r={5.6} fill="url(#heroBrass)" stroke="#3a2c08" strokeWidth={0.6} />
      <circle cx={x} cy={y} r={2.7} fill="#0b0805" />
    </g>
  );
}

function Plate({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y + 6} width={w} height={h} rx={10} fill="#000000" opacity={0.3} />
      <rect x={x} y={y} width={w} height={h} rx={10} className="fill-steel-100 stroke-steel-400" strokeWidth={1} />
      <path d={`M${x} ${y + 10} a10 10 0 0 1 10 -10 h${w - 20} a10 10 0 0 1 10 10 v16 h${-w} Z`} className="fill-well" />
      <text x={x + 10} y={y + 17.5} className="fill-carbon-900 font-cond text-[11px] font-bold tracking-[0.08em]">
        {label}
      </text>
    </g>
  );
}

/** Enter and Space work the control the same way a click and a hold do. */
const isActivate = (key: string) => key === 'Enter' || key === ' ' || key === 'Spacebar';

export function HeroCircuit({ className = '' }: { className?: string }) {
  const [closed, setClosed] = useState(false);
  const [held, setHeld] = useState(false);
  const [reversed, setReversed] = useState(false);

  const sim = useMemo(
    () =>
      step(
        demoCircuit(reversed),
        { breakerClosed: closed, pressed: { PB1: held }, toggled: {}, now: Date.now() },
        emptyState(),
      ),
    [closed, held, reversed],
  );

  const lit = !!sim.devices.LAMP1?.energized;
  const fault = sim.errors[0];

  // A press that ends off the button, or with the window losing focus, still lets go.
  const release = useCallback(() => setHeld(false), []);
  useEffect(() => {
    if (!held) return;
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', release);
    };
  }, [held, release]);

  const status = !closed
    ? { tone: 'text-carbon-600', dot: 'bg-steel-500', text: 'Breaker open. Close it to feed the board.' }
    : fault
      ? { tone: 'text-safety-red', dot: 'bg-safety-red', text: fault.message }
      : lit
        ? { tone: 'text-run-green', dot: 'bg-run-green', text: 'Lit. The button is bridging COM to NO.' }
        : { tone: 'text-carbon-800', dot: 'bg-signal-amber', text: 'Live. Hold the button to light the lamp.' };

  return (
    <figure className={`overflow-hidden rounded-[18px] border border-steel-300 bg-steel-50 shadow-[0_30px_80px_rgba(0,0,0,0.45)] ${className}`}>
      <svg viewBox="0 0 560 340" className="block w-full select-none" aria-hidden="false">
        <defs>
          <radialGradient id="heroLight" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="var(--bench-light)" />
            <stop offset="100%" stopColor="var(--bench-light)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heroShroud" cx="36%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id="heroBrass" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fbe7b0" />
            <stop offset="55%" stopColor="#c99a34" />
            <stop offset="100%" stopColor="#5c430e" />
          </radialGradient>
          <radialGradient id="heroBezel" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f3f6f9" />
            <stop offset="45%" stopColor="#aab5c3" />
            <stop offset="100%" stopColor="#465161" />
          </radialGradient>
          <linearGradient id="heroCap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#08461f" />
            <stop offset="55%" stopColor="#1d9550" />
            <stop offset="100%" stopColor="#5ad694" />
          </linearGradient>
        </defs>
        {/* The bench under an overhead lamp, as on the board page. */}
        <rect width="560" height="340" fill="var(--bench-base)" />
        <rect width="560" height="340" fill="url(#heroLight)" />

        {/* 24V supply */}
        <Plate x={24} y={44} w={116} h={200} label="24V SUPPLY" />
        <Terminal x={70} y={110} collar="red" />
        <Terminal x={70} y={200} collar="black" />
        <text x={90} y={115} className="fill-carbon-600 font-mono text-[11px]">
          VCC
        </text>
        <text x={90} y={205} className="fill-carbon-600 font-mono text-[11px]">
          GND
        </text>

        {/* Breaker — the master switch, clickable */}
        <g
          role="switch"
          aria-checked={closed}
          aria-label="Breaker"
          tabIndex={0}
          className="cursor-pointer"
          onClick={() => setClosed((v) => !v)}
          onKeyDown={(e) => {
            if (isActivate(e.key)) {
              e.preventDefault();
              setClosed((v) => !v);
            }
          }}
        >
          <Plate x={420} y={20} w={116} h={104} label="BREAKER" />
          <rect x={452} y={44} width={52} height={62} rx={7} className="fill-well stroke-steel-400" strokeWidth={1.5} />
          <rect
            x={456}
            y={closed ? 48 : 76}
            width={44}
            height={26}
            rx={5}
            className={closed ? 'fill-run-green' : 'fill-safety-red'}
            style={{ transition: 'y 140ms ease-out' }}
          />
          <text x={478} y={closed ? 96 : 66} textAnchor="middle" className="fill-carbon-600 font-mono text-[10px]">
            {closed ? 'ON' : 'OFF'}
          </text>
        </g>

        {/* Push button — press and hold */}
        <g
          role="button"
          aria-label="Push button, hold to close"
          aria-pressed={held}
          tabIndex={0}
          className="cursor-pointer"
          onPointerDown={(e) => {
            e.preventDefault();
            setHeld(true);
          }}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if (isActivate(e.key)) {
              e.preventDefault();
              setHeld(true);
            }
          }}
          onKeyUp={(e) => {
            if (isActivate(e.key)) release();
          }}
          onBlur={release}
        >
          <Plate x={238} y={28} w={120} h={132} label="PUSH BUTTON" />
          {/* Knurled bezel, its bore, and a concave cap that sinks while held. */}
          <circle cx={298} cy={90} r={23} fill="#000000" opacity={0.45} />
          <circle cx={298} cy={88} r={22} fill="url(#heroBezel)" />
          <circle cx={298} cy={88} r={17} fill="#07090c" />
          <circle cx={298} cy={held ? 89.5 : 88} r={held ? 14.6 : 15.5} fill="url(#heroCap)" />
          {!held && <ellipse cx={294} cy={81} rx={8} ry={3.4} fill="#ffffff" opacity={0.38} />}
        </g>
        <Terminal x={268} y={138} collar="black" />
        <Terminal x={328} y={138} collar="red" />

        {/* Lamp */}
        <Plate x={420} y={148} w={116} h={144} label="LAMP" />
        <circle
          cx={478}
          cy={210}
          r={27}
          className="fill-signal-amber"
          style={{ opacity: lit ? 0.28 : 0, transition: 'opacity 120ms ease-out' }}
        />
        <circle cx={478} cy={210} r={19} fill="#0a0f15" />
        <circle cx={478} cy={210} r={17} fill="#2c3540" />
        <circle
          cx={478}
          cy={210}
          r={17}
          className={fault ? 'fill-safety-red' : 'fill-signal-amber'}
          style={{ opacity: lit ? 1 : 0, transition: 'opacity 120ms ease-out' }}
        />
        <Terminal x={452} y={266} collar={reversed ? 'black' : 'red'} />
        <Terminal x={506} y={266} collar={reversed ? 'red' : 'black'} />

        {/* Leads, in the order you would plug them. */}
        <g fill="none" strokeWidth={3.6} strokeLinecap="round">
          <path
            d="M 70 110 C 120 200, 220 214, 268 138"
            pathLength={1}
            className="hero-lead hero-lead-1 stroke-signal-blue"
          />
          <path
            d="M 328 138 C 356 226, 408 214, 452 266"
            pathLength={1}
            className="hero-lead hero-lead-2 stroke-safety-red"
          />
          <path
            d="M 506 266 C 524 332, 180 336, 70 200"
            pathLength={1}
            className="hero-lead hero-lead-3 stroke-[#0a0d12] dark:stroke-[#4b5868]"
          />
        </g>
      </svg>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-steel-300 bg-steel-50 px-4 py-3">
        <span className={`flex items-center gap-2 text-sm ${status.tone}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden />
          <span aria-live="polite">{status.text}</span>
        </span>
        <button
          type="button"
          onClick={() => setReversed((v) => !v)}
          className="h-8 rounded-lg border border-steel-400 bg-steel-100 px-3 text-xs font-semibold text-carbon-900 hover:bg-steel-200"
        >
          {reversed ? 'Wire the lamp correctly' : 'Reverse the lamp leads'}
        </button>
      </figcaption>
    </figure>
  );
}
