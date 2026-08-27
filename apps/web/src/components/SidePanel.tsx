'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, CircleAlert, GraduationCap, XCircle } from 'lucide-react';
import { useBoard, useErrors } from '@/store/useBoard';
import { api, type Exercise, type GradeResponse } from '@/lib/api';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/10 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
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
    ['Power', live ? 'LIVE' : 'DEAD', live ? 'text-emerald-400' : 'text-slate-500'],
    ['Leads', wires, 'text-slate-200'],
    ['Live nets', hot, 'text-amber-400'],
    ['Ground nets', gnd, 'text-sky-400'],
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
          <div className={clsx('text-base font-bold tabular-nums', tone)}>{value}</div>
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
      <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
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
              'rounded-lg px-3 py-2 text-xs leading-relaxed',
              hard ? 'bg-red-500/12 text-red-200' : 'bg-amber-500/12 text-amber-200',
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
      {tripped && <li className="text-[11px] text-slate-500">Clear the fault, then reset the breaker to continue.</li>}
    </ul>
  );
}

function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [grade, setGrade] = useState<Record<string, GradeResponse>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listExercises()
      .then((r) => setExercises(r.exercises))
      .catch(() => setError('Exercises need the API running (npm run dev:api).'));
  }, []);

  const check = async (id: string) => {
    try {
      const res = await api.grade(id, useBoard.getState().circuit);
      setGrade((g) => ({ ...g, [id]: res }));
      setOpenId(id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error) return <p className="text-xs text-slate-500">{error}</p>;
  if (exercises.length === 0) return <p className="text-xs text-slate-500">No exercises yet.</p>;

  return (
    <ul className="space-y-2">
      {exercises.map((ex) => {
        const g = grade[ex.id];
        return (
          <li key={ex.id} className="rounded-lg bg-white/5 p-3">
            <div className="text-xs font-bold text-slate-200">{ex.title}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{ex.brief}</p>
            <button
              type="button"
              onClick={() => check(ex.id)}
              className="mt-2 rounded-md bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/25"
            >
              Check my wiring
            </button>
            {g && openId === ex.id && (
              <ul className="mt-2 space-y-1">
                {g.results.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px]">
                    {r.ok ? (
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                    )}
                    <span className={r.ok ? 'text-slate-400' : 'text-red-300'}>
                      {r.label}
                      {!r.ok && ' — ' + r.detail}
                    </span>
                  </li>
                ))}
                <li className={clsx('pt-1 text-[11px] font-bold', g.passed ? 'text-emerald-400' : 'text-amber-400')}>
                  {g.passed ? 'All checks passed.' : 'Not there yet.'}
                </li>
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SidePanel() {
  const hint = useBoard((s) => s.hint);
  const setHint = useBoard((s) => s.setHint);

  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(null), 6000);
    return () => clearTimeout(id);
  }, [hint, setHint]);

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-bench-900/60">
      <Section title="Board status" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
        <Status />
      </Section>
      <Section title="Simulation check" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        <Faults />
      </Section>
      <Section title="Lab exercises" icon={<GraduationCap className="h-3.5 w-3.5" />}>
        <Exercises />
      </Section>
      <div className="mt-auto p-4 text-[11px] leading-relaxed text-slate-500">
        Click a terminal, then click a second terminal to run a lead. Click the brass stub on a plugged lead to stack
        another onto it. Drag a module to move it. Esc cancels, Del removes the selected lead.
      </div>
      {hint && (
        <div className="sticky bottom-0 border-t border-white/10 bg-sky-500/15 px-4 py-3 text-xs text-sky-200">{hint}</div>
      )}
    </aside>
  );
}
