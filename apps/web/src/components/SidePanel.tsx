'use client';

import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CircleAlert, X } from 'lucide-react';
import { PLC_INPUTS, PLC_OUTPUTS, moduleLabel, partsOn } from '@mech/sim';
import { useBoard, useErrors } from '@/store/useBoard';

const head = 'font-cond text-xs font-bold uppercase tracking-[0.12em] text-carbon-600';

/** The one line that matters first: is the supply live, and is anything wrong. */
function Supply() {
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const tripped = useBoard((s) => s.tripped);
  const faults = useErrors().length;

  const tone = tripped
    ? { box: 'border-safety-red/40 bg-safety-red/10', dot: 'bg-safety-red', text: 'text-red-ink', title: 'Breaker tripped' }
    : live
      ? { box: 'border-run-green/35 bg-run-green/8', dot: 'bg-run-green', text: 'text-green-ink', title: 'Supply live' }
      : { box: 'border-steel-300 bg-steel-100', dot: 'bg-steel-500', text: 'text-carbon-900', title: 'Supply dead' };

  return (
    <div className={clsx('flex items-center gap-3 rounded-xl border p-3', tone.box)}>
      <span
        className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', tone.dot)}
        style={live || tripped ? { boxShadow: `0 0 10px var(--color-${tripped ? 'safety-red' : 'run-green'})` } : undefined}
      />
      <div>
        <div className={clsx('text-[15px] font-bold', tone.text)}>{tone.title}</div>
        <div className="text-xs text-carbon-600">
          {faults === 0 ? 'No faults detected' : faults === 1 ? '1 fault below' : faults + ' faults below'}
          {!live && !tripped && ' · close the breaker to run'}
        </div>
      </div>
    </div>
  );
}

function Counts() {
  const nets = useBoard((s) => s.sim.nets);
  const wires = useBoard((s) => s.circuit.wires.length);
  const hot = nets.filter((n) => n.hot && !n.gnd).length;
  const gnd = nets.filter((n) => n.gnd && !n.hot).length;

  const cells: [string, number, string][] = [
    ['leads', wires, 'text-carbon-900'],
    ['live nets', hot, 'text-signal-amber'],
    ['ground', gnd, 'text-signal-blue'],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="rounded-[10px] border border-steel-300 bg-steel-100 p-2.5">
          <div className={clsx('font-mono text-xl font-bold tabular-nums', tone)}>{value}</div>
          <div className="text-[11px] text-carbon-600">{label}</div>
        </div>
      ))}
    </div>
  );
}

/** Faults first, then PLC addresses that are planned for a part with no lead to it yet. */
function Notices() {
  const errors = useErrors();
  const tripped = useBoard((s) => s.tripped);
  const circuit = useBoard((s) => s.circuit);

  const unwired = useMemo(() => {
    const out: string[] = [];
    for (const plc of circuit.modules.filter((m) => m.type === 'FT_PLC')) {
      for (const [addr, id] of Object.entries(plc.io ?? {})) {
        const part = circuit.modules.find((m) => m.id === id);
        if (!part || ![...PLC_INPUTS, ...PLC_OUTPUTS].includes(addr)) continue;
        if (!partsOn(circuit, plc.id, addr).some((d) => d.moduleId === id))
          out.push(moduleLabel(part) + ' is planned on ' + addr + ' but has no lead yet.');
      }
    }
    return out;
  }, [circuit]);

  if (errors.length === 0 && unwired.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {errors.map((e, i) => {
        const hard = e.code === 'SHORT_CIRCUIT';
        return (
          <li
            key={i}
            className={clsx(
              'flex gap-2.5 rounded-xl border p-3 text-[13px] leading-snug',
              hard ? 'border-safety-red/40 bg-safety-red/10 text-red-ink' : 'border-signal-amber/45 bg-signal-amber/8 text-amber-ink',
            )}
          >
            {hard ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              <b className="block text-xs uppercase tracking-wide">{e.code.replace('_', ' ')}</b>
              {e.message}
            </span>
          </li>
        );
      })}
      {tripped && <li className="text-xs text-carbon-600">Clear the fault, then reset the breaker to continue.</li>}
      {unwired.map((text) => (
        <li
          key={text}
          className="flex gap-2.5 rounded-xl border border-dashed border-signal-amber/60 bg-signal-amber/8 p-3 text-[13px] leading-snug text-amber-ink"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Click ×2', 'Run a lead'],
  ['Brass stub', 'Stack another lead'],
  ['Drag', 'Move or box-select'],
  ['Space', 'Pan the bench'],
  ['Esc', 'Cancel a lead'],
  ['Del', 'Remove lead'],
  ['Ctrl Z', 'Undo'],
];

export function SidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hint = useBoard((s) => s.hint);
  const setHint = useBoard((s) => s.setHint);

  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(null), 6000);
    return () => clearTimeout(id);
  }, [hint, setHint]);

  return (
    <>
      {/* Below xl the panel slides in over the board instead of taking its width. */}
      {open && <div className="fixed inset-0 z-30 bg-[#06090d]/50 xl:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          'z-40 flex w-[300px] max-w-[88vw] shrink-0 flex-col gap-4 overflow-y-auto border-l border-steel-300 bg-steel-50 p-[18px]',
          'fixed inset-y-0 right-0 shadow-2xl transition-transform duration-200',
          'xl:static xl:translate-x-0 xl:shadow-none',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className={head}>Board status</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close status"
            className="rounded-md p-1 text-carbon-600 hover:bg-steel-200 xl:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Supply />
        <Counts />
        <Notices />

        {hint && (
          <p
            role="status"
            className="rounded-xl border border-signal-blue/35 bg-signal-blue/10 px-3 py-2.5 text-[13px] leading-snug text-carbon-900"
          >
            {hint}
          </p>
        )}

        <div className="flex-1" />
        <div className="rounded-xl border border-steel-300 bg-steel-100 p-3">
          <div className={head + ' mb-2 text-[11px]'}>Shortcuts</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 text-xs text-carbon-800">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-carbon-900">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </>
  );
}
