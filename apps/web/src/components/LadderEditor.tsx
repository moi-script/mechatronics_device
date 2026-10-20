'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  devicesOn,
  plcBits,
  PLC_INPUTS,
  PLC_OUTPUTS,
  type LadderCoilKind,
  type LadderContact,
  type LadderRung,
} from '@mech/sim';
import { useBoard } from '@/store/useBoard';

/** The same limits the API enforces on a saved ladder. */
const MAX_RUNGS = 64;
const MAX_BRANCHES = 8;
const MAX_CONTACTS = 8;

const COIL_GLYPH: Record<LadderCoilKind, string> = { OUT: '( )', SET: '(S)', RST: '(R)' };

const blankRung = (addr: string): LadderRung => ({ branches: [[{ addr }]], coil: { addr: 'Q00', kind: 'OUT' } });

/**
 * Writes the PLC's program as rungs: each rung an OR of branches, each branch
 * an AND of contacts, ending in one coil. Every address is named by the device
 * actually wired to it, so the ladder reads in the terms of the board.
 */
export function LadderEditor({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const circuit = useBoard((s) => s.circuit);
  const sim = useBoard((s) => s.sim);
  const setLadder = useBoard((s) => s.setLadder);
  const m = circuit.modules.find((x) => x.id === moduleId);
  const [rungs, setRungs] = useState<LadderRung[]>(() => structuredClone(m?.ladder ?? []));
  // The address a new contact is given: picked from the palette.
  const [armed, setArmed] = useState('I00');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const device = useMemo(() => {
    const out: Record<string, string | undefined> = {};
    for (const a of [...PLC_INPUTS, ...PLC_OUTPUTS]) out[a] = devicesOn(circuit, sim, moduleId, a)[0];
    return out;
  }, [circuit, sim, moduleId]);
  const bits = plcBits(circuit, sim, moduleId);

  const edit = (fn: (draft: LadderRung[]) => void) =>
    setRungs((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });

  const save = () => {
    // A branch with every contact removed would never pass power; drop it.
    const clean = rungs.map((r) => ({ ...r, branches: r.branches.filter((b) => b.length > 0) }));
    setLadder(moduleId, clean);
    onClose();
  };

  const chip = 'rounded-sm border px-1.5 py-1 font-mono text-[11px]';
  const tool =
    'inline-flex items-center gap-1 rounded-sm border border-steel-400 bg-steel-100 px-2 py-1 text-[11px] font-semibold text-carbon-800 hover:bg-steel-200 disabled:opacity-40';

  const contact = (key: number, c: LadderContact, onFlip: () => void, onRemove: () => void) => {
    const passing = bits[c.addr] !== !!c.nc;
    const unwired = !device[c.addr];
    return (
      <span
        key={key}
        className={`${chip} inline-flex items-center gap-1 ${
          passing ? 'border-run-green bg-run-green/15 text-carbon-900' : 'border-steel-400 bg-steel-100 text-carbon-800'
        }`}
        title={device[c.addr] ?? 'not wired'}
      >
        <button type="button" onClick={onFlip} title="Flip NO / NC" className="font-bold">
          {c.nc ? '|/|' : '| |'}
        </button>
        <span>{c.addr}</span>
        {unwired && <span className="text-[9px] text-signal-amber">not wired</span>}
        <button type="button" onClick={onRemove} aria-label="Remove contact" className="text-carbon-600 hover:text-safety-red">
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  };

  if (!m) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-carbon-900/45 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ladder-title"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-steel-400 bg-steel-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-steel-300 bg-steel-100 px-4 py-3">
          <h2 id="ladder-title" className="engraved text-xs font-bold text-carbon-900">
            Ladder program · PLC CP1E
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-carbon-600 hover:text-carbon-900">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Palette: pick the address the next contact gets. */}
          <aside className="max-h-40 shrink-0 overflow-y-auto border-b border-steel-300 p-2 sm:max-h-none sm:w-60 sm:border-r sm:border-b-0">
            <p className="mb-1 text-[10px] text-carbon-600">Pick an address, then “+ contact”.</p>
            <ul className="space-y-0.5">
              {[...PLC_INPUTS, ...PLC_OUTPUTS].map((a) => (
                <li key={a}>
                  <button
                    type="button"
                    onClick={() => setArmed(a)}
                    className={`w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] ${
                      armed === a ? 'bg-signal-amber/20 text-carbon-900' : 'text-carbon-800 hover:bg-steel-200'
                    }`}
                  >
                    <span className={`font-mono ${bits[a] ? 'text-run-green font-bold' : ''}`}>{a}</span> ·{' '}
                    {device[a] ?? <span className="text-signal-amber">not wired</span>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {rungs.length === 0 && <p className="text-xs text-carbon-600">No rungs yet. Add one to start.</p>}
            {rungs.map((r, ri) => {
              const coilOn = !!bits[r.coil.addr];
              return (
                <section key={ri} className="rounded-md border border-steel-300 bg-steel-100 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-carbon-600">Rung {ri + 1}</span>
                    <button
                      type="button"
                      className={tool}
                      onClick={() => edit((d) => void d.splice(ri, 1))}
                      aria-label="Delete rung"
                    >
                      <Trash2 className="h-3 w-3" /> rung
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1 space-y-1 border-l-2 border-carbon-600 pl-2">
                      {r.branches.map((b, bi) => (
                        <div key={bi} className="flex flex-wrap items-center gap-1">
                          {bi > 0 && <span className="text-[9px] font-bold text-carbon-600">OR</span>}
                          {b.map((c, ci) =>
                            contact(
                              ci,
                              c,
                              () => edit((d) => void (d[ri].branches[bi][ci].nc = !c.nc)),
                              () => edit((d) => void d[ri].branches[bi].splice(ci, 1)),
                            ),
                          )}
                          <button
                            type="button"
                            className={tool}
                            disabled={b.length >= MAX_CONTACTS}
                            onClick={() => edit((d) => void d[ri].branches[bi].push({ addr: armed }))}
                          >
                            <Plus className="h-3 w-3" /> contact
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={tool}
                        disabled={r.branches.length >= MAX_BRANCHES}
                        onClick={() => edit((d) => void d[ri].branches.push([{ addr: armed }]))}
                      >
                        <Plus className="h-3 w-3" /> branch (OR)
                      </button>
                    </div>
                    {/* The coil, at the right rail. */}
                    <div
                      className={`${chip} flex items-center gap-1 ${
                        coilOn ? 'border-run-green bg-run-green/15' : 'border-steel-400 bg-steel-50'
                      }`}
                      title={device[r.coil.addr] ?? 'not wired'}
                    >
                      <span className="font-bold">{COIL_GLYPH[r.coil.kind]}</span>
                      <select
                        aria-label="Coil address"
                        value={r.coil.addr}
                        onChange={(e) => edit((d) => void (d[ri].coil.addr = e.target.value))}
                        className="bg-transparent font-mono text-[11px] text-carbon-900"
                      >
                        {PLC_OUTPUTS.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Coil kind"
                        value={r.coil.kind}
                        onChange={(e) => edit((d) => void (d[ri].coil.kind = e.target.value as LadderCoilKind))}
                        className="bg-transparent text-[11px] text-carbon-900"
                      >
                        <option value="OUT">OUT</option>
                        <option value="SET">SET</option>
                        <option value="RST">RST</option>
                      </select>
                      {!device[r.coil.addr] && <span className="text-[9px] text-signal-amber">not wired</span>}
                    </div>
                  </div>
                </section>
              );
            })}
            <button
              type="button"
              className={tool}
              disabled={rungs.length >= MAX_RUNGS}
              onClick={() => edit((d) => void d.push(blankRung(armed)))}
            >
              <Plus className="h-3 w-3" /> rung
            </button>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-steel-300 bg-steel-100 px-4 py-2">
          <button type="button" className={tool} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-sm bg-signal-amber px-3 py-1 text-[11px] font-bold text-white hover:brightness-110"
          >
            Save to PLC
          </button>
        </footer>
      </div>
    </div>
  );
}
