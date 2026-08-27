'use client';

import { useEffect } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, CircleAlert, X } from 'lucide-react';
import { useBoard, useErrors } from '@/store/useBoard';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-steel-300 p-4">
      <h2 className="engraved mb-3 flex items-center gap-2 border-b border-steel-300 pb-2 text-[11px] font-bold text-carbon-600">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Status() {
  const nets = useBoard((s) => s.sim.nets);
  const wires = useBoard((s) => s.circuit.wires.length);
  const live = useBoard((s) => s.breakerOn && !s.tripped);
  const hot = nets.filter((n) => n.hot && !n.gnd).length;
  const gnd = nets.filter((n) => n.gnd && !n.hot).length;

  const cells: [string, string | number, string][] = [
    ['Supply', live ? 'LIVE' : 'DEAD', live ? 'text-run-green' : 'text-carbon-600'],
    ['Leads', String(wires).padStart(2, '0'), 'text-carbon-900'],
    ['Live nets', String(hot).padStart(2, '0'), 'text-signal-amber'],
    ['Ground nets', String(gnd).padStart(2, '0'), 'text-signal-blue'],
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="rounded-sm border border-steel-300 bg-steel-100 px-3 py-2">
          <div className="engraved text-[10px] text-carbon-600">{label}</div>
          <div className={clsx('font-mono text-base font-semibold tabular-nums', tone)}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Faults() {
  const errors = useErrors();
  const tripped = useBoard((s) => s.tripped);

  if (errors.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-run-green/35 bg-run-green/10 px-3 py-2 text-xs text-run-green">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        No faults detected.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {errors.map((e, i) => {
        const hard = e.code === 'SHORT_CIRCUIT';
        return (
          <li
            key={i}
            className={clsx(
              'rounded-lg border px-3 py-2 text-xs leading-relaxed',
              hard ? 'border-safety-red/35 bg-safety-red/10 text-safety-red' : 'border-signal-amber/35 bg-signal-amber/10 text-signal-amber',
            )}
          >
            <span className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wide">
              {hard ? <AlertTriangle className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
              {e.code.replace('_', ' ')}
            </span>
            {e.message}
          </li>
        );
      })}
      {tripped && <li className="text-[11px] text-carbon-600">Clear the fault, then reset the breaker to continue.</li>}
    </ul>
  );
}

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
      {open && <div className="fixed inset-0 z-30 bg-carbon-900/30 xl:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          'z-40 flex w-80 max-w-[88vw] shrink-0 flex-col overflow-y-auto border-l border-steel-400 bg-steel-50',
          'fixed inset-y-0 right-0 shadow-2xl transition-transform duration-200',
          'xl:static xl:translate-x-0 xl:shadow-none',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-carbon-600 hover:bg-steel-200 xl:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        <Section title="Board status" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
          <Status />
        </Section>
        <Section title="Simulation check" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
          <Faults />
        </Section>
        <div className="mt-auto p-4 text-[11px] leading-relaxed text-carbon-600">
          Tap a terminal, then a second terminal to run a lead. Tap the brass stub on a plugged lead to stack another
          onto it. Drag a module to move it, or drag across empty board to select several and move them together;
          shift-click adds one to the selection. Hold space or drag with the middle button to pan. Esc cancels, Del
          removes the selected lead, and Ctrl+Z / Ctrl+Shift+Z step back and forward.
        </div>
        {hint && (
          <div className="sticky bottom-0 border-t border-signal-blue/35 bg-signal-blue/10 px-4 py-3 text-xs text-signal-blue">{hint}</div>
        )}
      </aside>
    </>
  );
}
