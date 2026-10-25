'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  cleanLadder,
  moduleLabel,
  PARTS,
  partsOn,
  plcBits,
  PLC_COILS,
  PLC_INPUTS,
  PLC_MEMORY,
  PLC_OUTPUTS,
  PLC_TIMERS,
  TON_MAX_SEC,
  TON_MIN_SEC,
  type LadderCoilKind,
  type LadderContact,
  type LadderRung,
  type FieldDevice,
  type ModuleType,
} from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { PartSymbol } from './PartSymbol';

/** The same limits the API enforces on a saved ladder. */
const MAX_RUNGS = 64;
const MAX_BRANCHES = 8;
const MAX_CONTACTS = 8;
const MAX_BLOCKS = 8;

const COIL_GLYPH: Record<LadderCoilKind, string> = { OUT: '( )', SET: '(S)', RST: '(R)', TON: '(T)' };
const hasCoil = (t: ModuleType) => PARTS[t].hasCoil || !!PARTS[t].coils?.length;
// An input part is anything with a contact the PLC can read: a button, a limit or reed switch, and
// also a relay's or timer's own contact wired back to an input, as on a real panel.
const isInputPart = (t: ModuleType) =>
  t !== 'FT_PLC' &&
  // The plain timer has no NO/NC pair: its COM goes live once it times out, which an input reads.
  (t === 'TIMER' || !!PARTS[t].switches?.length || PARTS[t].contactLines > 0 || !!PARTS[t].changeovers?.length);
// An output part is one the PLC can drive: anything with a coil.
const isOutputPart = hasCoil;

const blankRung = (addr: string): LadderRung => ({ blocks: [[[{ addr }]]], coil: { addr: 'Q00', kind: 'OUT' } });

/**
 * Writes the PLC's program as rungs: each rung a run of blocks in series to one
 * coil, a block being one contact or a parallel group of them. Every address is
 * named by the device actually wired to it, so the ladder reads in the terms of
 * the board.
 */
/** The panel can be pulled up to the toolbar or down to its header, and remembers where it was left. */
const LADDER_HEIGHT_KEY = 'ladder-height';
const MIN_LADDER = 120;
const clampLadder = (h: number) => Math.round(Math.min(Math.max(h, MIN_LADDER), window.innerHeight - 140));

export function LadderEditor({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const [height, setHeight] = useState(() => {
    let saved = NaN;
    try {
      saved = Number(localStorage.getItem(LADDER_HEIGHT_KEY));
    } catch {
      // Storage blocked: start at the default.
    }
    return clampLadder(saved > 0 ? saved : window.innerHeight * 0.45);
  });

  // Dragging the top edge: up makes the panel taller, down gives the board back.
  const onResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    let h = startH;
    const move = (ev: PointerEvent) => {
      h = clampLadder(startH + startY - ev.clientY);
      setHeight(h);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(LADDER_HEIGHT_KEY, String(h));
      } catch {
        // Not remembered this time; the drag itself still worked.
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const circuit = useBoard((s) => s.circuit);
  const sim = useBoard((s) => s.sim);
  const setLadder = useBoard((s) => s.setLadder);
  const breakerOn = useBoard((s) => s.breakerOn);
  const running = useBoard((s) => !!s.toggled[moduleId]);
  const flipToggle = useBoard((s) => s.flipToggle);
  const setIo = useBoard((s) => s.setIo);
  const m = circuit.modules.find((x) => x.id === moduleId);
  const rungs = useMemo(() => cleanLadder(m?.ladder) ?? [], [m?.ladder]);
  // The part wired to each I and Q post, which the palette shows as a library of what is on the board.
  const fields = useMemo(() => {
    const out: Record<string, FieldDevice[]> = {};
    for (const a of [...PLC_INPUTS, ...PLC_OUTPUTS]) out[a] = partsOn(circuit, moduleId, a);
    return out;
  }, [circuit, moduleId]);
  const wired = useMemo(
    () => Object.fromEntries(Object.entries(fields).map(([a, ds]) => [a, ds[0]])) as Record<string, FieldDevice | undefined>,
    [fields],
  );
  // Every input and output part on the board, with the PLC posts it is led to. It follows the
  // Components bin: a part put on the board shows here at once, and goes when it is taken off.
  // The address plan: which part each I / Q address is meant for, wired or not. A part taken off
  // the board leaves the plan with it.
  const plan = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(m?.io ?? {}).filter(
          ([a, id]) => [...PLC_INPUTS, ...PLC_OUTPUTS].includes(a) && circuit.modules.some((x) => x.id === id),
        ),
      ),
    [m?.io, circuit.modules],
  );
  const partById = (id: string) => circuit.modules.find((x) => x.id === id);
  const library = useMemo(() => {
    const on = (addrs: string[], id: string) => addrs.filter((a) => fields[a].some((d) => d.moduleId === id));
    const item = (x: (typeof circuit.modules)[number], list: string[], via: string[]) => {
      const addrs = on(list, x.id);
      const planned = list.filter((a) => plan[a] === x.id && !addrs.includes(a));
      return { mod: x, addrs, via, planned, list };
    };
    const parts = circuit.modules.filter((x) => x.type !== 'FT_PLC');
    return {
      inputs: parts.filter((x) => isInputPart(x.type)).map((x) => item(x, PLC_INPUTS, [])),
      outputs: parts.filter((x) => isOutputPart(x.type)).map((x) =>
        // A lamp the PLC lights through a relay's contact.
        item(x, PLC_OUTPUTS, PLC_OUTPUTS.filter((a) => fields[a].some((d) => d.switches?.some((sw) => sw.loads.includes(moduleLabel(x)))))),
      ),
    };
  }, [circuit, fields, plan]);
  const nextFree = (list: string[]) => list.find((a) => fields[a].length === 0 && !plan[a]);
  const assign = (partId: string, list: string[]) => {
    const a = nextFree(list);
    if (!a) return;
    setIo(moduleId, { ...plan, [a]: partId });
    setArmed(a);
  };
  const unassign = (a: string) => setIo(moduleId, Object.fromEntries(Object.entries(plan).filter(([k]) => k !== a)));
  // Addresses whose wiring does not yet match the plan: shown in amber in the rungs.
  const unmatched: Record<string, boolean> = {};
  const device = useMemo(() => {
    const out: Record<string, string | undefined> = {};
    for (const a of [...PLC_INPUTS, ...PLC_OUTPUTS]) {
      out[a] = wired[a]?.label;
      const meant = plan[a] && circuit.modules.find((x) => x.id === plan[a]);
      if (!meant) continue;
      if (fields[a].length === 0) out[a] = `${moduleLabel(meant)} · not wired yet`;
      else if (!fields[a].some((d) => d.moduleId === meant.id)) out[a] = `${wired[a]!.label} ≠ plan: ${moduleLabel(meant)}`;
    }
    // Internal relays and timers live inside the PLC: nothing is wired to them, and nothing need be.
    for (const a of PLC_MEMORY) out[a] = 'internal relay';
    for (const t of PLC_TIMERS) out[t] = 'on-delay timer';
    return out;
  }, [wired, plan, fields, circuit.modules]);
  for (const a of Object.keys(plan)) unmatched[a] = !fields[a].some((d) => d.moduleId === plan[a]);
  const wiredInputs = PLC_INPUTS.filter((a) => wired[a]);
  // The address a new contact is given: picked from the palette, else the first wired input.
  const [picked, setArmed] = useState<string | null>(null);
  const armed = picked ?? wiredInputs[0] ?? PLC_INPUTS.find((a) => plan[a]) ?? 'M00';
  const bits = plcBits(circuit, sim, moduleId);
  const powered = !!sim.nets[sim.pinNet[`${moduleId}.V1`]]?.hot && !!sim.nets[sim.pinNet[`${moduleId}.G1`]]?.gnd;
  // Why the board is or is not following the ladder, in the order a student would fix it.
  const status = !breakerOn
    ? 'Breaker OFF: switch it on'
    : !powered
      ? 'No power: wire +24V and 0V to the PLC'
      : !running
        ? 'STOP: switch to RUN to run the program'
        : 'RUN: following the board live';
  // What a relay on an output switches, e.g. "NO → Lamp 1".
  const switchesNote = (a: string) =>
    wired[a]?.switches?.map((sw, i) => (
      <span key={i} className="block truncate text-[10px] font-semibold text-carbon-800">
        {sw.kind} → {sw.loads.join(', ')}
      </span>
    ));

  // Every edit downloads to the PLC at once, so the board runs what is drawn; Ctrl+Z steps back.
  const edit = (fn: (draft: LadderRung[]) => void) => {
    const draft = structuredClone(rungs);
    fn(draft);
    // A branch with every contact removed would never pass power, and a block with no branches is no block.
    setLadder(
      moduleId,
      draft.map((r) => ({
        ...r,
        blocks: r.blocks.map((k) => k.filter((b) => b.length > 0)).filter((k) => k.length > 0),
      })),
    );
  };

  const tool =
    'inline-flex h-8 items-center gap-1 rounded-lg border border-steel-400 bg-steel-100 px-3 text-[13px] font-medium text-carbon-900 hover:bg-steel-200 disabled:opacity-40';
  // Rung geometry: every cell puts its symbol's centre 44px down, where the wire runs.
  const wire = 'absolute inset-x-0 top-[43px] h-0.5 bg-carbon-800';
  const label = 'flex h-[34px] w-full flex-col items-center justify-end text-[10px] leading-tight';
  // The device's own contact comes first, so a stop button wired through its NC terminals reads "NC".
  const deviceName = (addr: string) => (
    <span
      className={`max-w-full truncate ${device[addr] && !unmatched[addr] ? 'text-carbon-600' : 'text-signal-amber'}`}
      title={wired[addr]?.contact ? `${device[addr]}, wired through its ${wired[addr]!.contact} contact` : device[addr]}
    >
      {wired[addr]?.contact && <b className="mr-0.5 text-carbon-900">{wired[addr]!.contact}</b>}
      {device[addr] ?? 'not wired'}
    </span>
  );

  // Drawn as it stands now, the way a monitored PLC shows it: a NO contact whose bit comes on
  // closes (|/|, green) and an NC one opens (| |). Tapping the symbol or its NO / NC tag flips it.
  const contact = (key: number, c: LadderContact, onFlip: () => void, onRemove: () => void) => {
    const closed = !!bits[c.addr] !== !!c.nc;
    return (
      // Wide enough for a whole device name such as "NO Push-Button Unit 1 B1 14".
      <div key={key} className="relative flex w-40 shrink-0 flex-col items-center">
        <div className={label}>
          {deviceName(c.addr)}
          <span className="flex items-center gap-0.5 font-mono font-bold text-carbon-900">
            {c.addr}
            <button
              type="button"
              onClick={onFlip}
              title="Flip this contact between NO and NC"
              aria-label={`${c.addr} ${c.nc ? 'normally closed' : 'normally open'}, flip`}
              className="rounded-md border border-steel-400 px-0.5 text-[9px] font-semibold text-carbon-700 hover:bg-steel-200"
            >
              {c.nc ? 'NC' : 'NO'}
            </button>
            <button type="button" onClick={onRemove} aria-label="Remove contact" className="text-carbon-600 hover:text-safety-red">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
        <button
          type="button"
          onClick={onFlip}
          title="Tap to flip between NO and NC"
          aria-label={`${c.addr} ${c.nc ? 'normally closed' : 'normally open'}, now ${closed ? 'closed' : 'open'}, flip`}
          className="relative h-5 rounded-md bg-steel-50 hover:bg-steel-200"
        >
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none" strokeWidth="2">
            <path d="M0 10H9M19 10H28" className="text-carbon-800" stroke="currentColor" />
            <g className={closed ? 'text-run-green' : 'text-carbon-800'} stroke="currentColor">
              <path d="M9 1V19M19 1V19" />
              {closed && <path d="M5 18L23 2" />}
            </g>
          </svg>
        </button>
      </div>
    );
  };

  const addOnWire = (onAdd: () => void, disabled: boolean, title: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      title={title}
      aria-label={title}
      className="relative mt-[36px] ml-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-steel-400 bg-steel-50 text-carbon-800 hover:bg-steel-200 disabled:opacity-40"
    >
      <Plus className="h-3 w-3" />
    </button>
  );

  if (!m) return null;

  return (
    // Docked under the board, not over it: the student presses buttons on the board and watches the rungs.
    <section
      aria-labelledby="ladder-title"
      style={{ height }}
      className="relative flex shrink-0 flex-col overflow-hidden border-t border-steel-300 bg-steel-50"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag to resize the ladder panel"
        title="Drag to resize"
        onPointerDown={onResize}
        className="group absolute inset-x-0 top-0 z-10 flex h-3 cursor-row-resize touch-none justify-center"
      >
        <span className="mt-1 h-1 w-12 rounded-full bg-steel-400 transition group-hover:bg-carbon-600" />
      </div>
      <header className="flex items-center justify-between gap-3 border-b border-steel-300 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 id="ladder-title" className="font-cond text-sm font-bold tracking-[0.12em] text-carbon-900 uppercase">
            Ladder · {moduleLabel(m)}
          </h2>
          <span
            role="status"
            className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${
              breakerOn && powered && running ? 'bg-run-green/14 text-green-ink' : 'bg-signal-amber/14 text-amber-ink'
            }`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-full ${breakerOn && powered && running ? 'bg-run-green' : 'bg-signal-amber'}`}
            />
            {status}
          </span>
          <button type="button" className={tool} onClick={() => flipToggle(moduleId)}>
            {running ? 'Switch to STOP' : 'Switch to RUN'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ladder"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-carbon-600 hover:bg-steel-200 hover:text-carbon-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Palette: pick the address the next contact gets. */}
        <aside className="max-h-40 shrink-0 overflow-y-auto border-b border-steel-300 p-3.5 sm:max-h-none sm:w-[270px] sm:border-r sm:border-b-0">
          <p className="mb-3 text-[11px] leading-snug text-carbon-600">
            Pick one, then + at the end of a rung (series) or “+ parallel” under a contact. Tap a contact’s
            -| |- symbol to flip it between NO and NC. Edits load into the PLC at once.
          </p>
          {[
            { title: 'Inputs', items: library.inputs, empty: 'Add a button or switch from Components.', post: 'to input' },
            { title: 'Outputs', items: library.outputs, empty: 'Add a relay or lamp from Components.', post: 'from output' },
          ].map(({ title, items, empty, post }) => (
            <section key={title} className="mb-2">
              <h3 className="mb-1.5 font-cond text-[11px] font-bold tracking-[0.12em] text-carbon-600 uppercase">{title} on the board</h3>
              {items.length === 0 && <p className="text-[10px] text-signal-amber">{empty}</p>}
              <ul className="space-y-1">
                {items.map(({ mod, addrs, via, planned, list }) => (
                  <li
                    key={mod.id}
                    className={`flex items-start gap-2.5 rounded-[9px] border bg-steel-100 p-2 ${
                      planned.length && !addrs.length ? 'border-dashed border-signal-amber' : addrs.length ? 'border-steel-400' : 'border-steel-300 opacity-80'
                    }`}
                  >
                    <span className="grid h-8 w-11 shrink-0 place-items-center rounded-md border border-steel-300 bg-well text-carbon-800">
                      <PartSymbol type={mod.type} className="h-7 w-10" />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-semibold text-carbon-900">{moduleLabel(mod)}</span>
                      {addrs.length === 0 && via.length === 0 && planned.length === 0 && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-signal-amber">
                          Not wired yet.
                          {nextFree(list) && (
                            <button
                              type="button"
                              onClick={() => assign(mod.id, list)}
                              title="Give this part an address now and wire it later"
                              className="rounded-md border border-signal-amber px-1 font-semibold text-carbon-900 hover:bg-signal-amber/15"
                            >
                              Use {nextFree(list)}
                            </button>
                          )}
                        </span>
                      )}
                      {planned.length > 0 && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          {planned.map((a) => (
                            <span key={a} className="inline-flex items-center rounded-md border border-dashed border-signal-amber">
                              <button
                                type="button"
                                onClick={() => setArmed(a)}
                                aria-pressed={armed === a}
                                title={`Planned: wire ${moduleLabel(mod)} ${post} ${a} to match`}
                                className={`px-1 font-mono text-[10px] font-bold ${armed === a ? 'bg-signal-amber/15 text-carbon-900' : 'text-carbon-900'}`}
                              >
                                {a}
                              </button>
                              <button
                                type="button"
                                onClick={() => unassign(a)}
                                aria-label={`Free ${a}`}
                                className="pr-0.5 text-carbon-600 hover:text-safety-red"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <span className="text-[10px] text-signal-amber">
                            planned · wire it {post} {planned.join(', ')} to match
                          </span>
                        </span>
                      )}
                      {via.length > 0 && <span className="block text-[10px] text-carbon-600">switched by the relay on</span>}
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {[...addrs, ...via].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setArmed(a)}
                            aria-pressed={armed === a}
                            title={wired[a]?.label}
                            className={`rounded-md border px-1 font-mono text-[10px] font-bold ${
                              armed === a
                                ? 'border-signal-amber bg-signal-amber/15 text-carbon-900'
                                : `border-steel-300 hover:bg-steel-200 ${bits[a] ? 'text-run-green' : 'text-carbon-900'}`
                            }`}
                          >
                            {a}
                            {wired[a]?.moduleId === mod.id && wired[a]?.contact && (
                              <span className="ml-0.5 font-sans font-semibold text-carbon-600">{wired[a]!.contact}</span>
                            )}
                          </button>
                        ))}
                      </span>
                      {addrs.map((a) => (
                        <span key={a}>{switchesNote(a)}</span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {[
            { title: 'Internal relays', addrs: PLC_MEMORY },
            { title: 'Timers', addrs: PLC_TIMERS },
          ].map(({ title, addrs }) => (
            <section key={title} className="mb-2">
              <h3 className="mb-1.5 font-cond text-[11px] font-bold tracking-[0.12em] text-carbon-600 uppercase">{title}</h3>
              <div className="flex flex-wrap gap-1">
                {addrs.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setArmed(a)}
                    aria-pressed={armed === a}
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                      armed === a
                        ? 'border-signal-amber bg-signal-amber/15 text-carbon-900'
                        : `border-steel-300 bg-steel-50 hover:bg-steel-200 ${bits[a] ? 'font-bold text-run-green' : 'text-carbon-800'}`
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {rungs.length === 0 && <p className="text-xs text-carbon-600">No rungs yet. Add one to start.</p>}
          <div className="min-w-max">
            {rungs.map((r, ri) => {
              const coilOn = !!bits[r.coil.addr];
              return (
                <div key={ri} className="flex items-stretch">
                  <div className="flex w-12 shrink-0 flex-col items-end gap-1 pr-1 pt-[36px]">
                    <span className="font-mono text-[10px] text-carbon-600">Rung {ri + 1}</span>
                    <button
                      type="button"
                      onClick={() => edit((d) => void d.splice(ri, 1))}
                      aria-label={`Delete rung ${ri + 1}`}
                      className="text-carbon-600 hover:text-safety-red"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Between the rails: blocks in series, each one contact or a parallel group, then the coil. */}
                  <div className="flex flex-1 items-start border-x-2 border-carbon-800 bg-steel-50 py-2">
                    <div className="relative h-14 w-2 shrink-0">
                      <div className={wire} />
                    </div>
                    {r.blocks.map((block, ki) => (
                      <div key={ki} className="shrink-0">
                        <div className="relative">
                          {block.map((b, bi) => (
                            <div key={bi} className="relative flex h-14 items-start px-2">
                              <div className={wire} />
                              {b.map((c, ci) =>
                                contact(
                                  ci,
                                  c,
                                  () => edit((d) => void (d[ri].blocks[ki][bi][ci].nc = !c.nc)),
                                  () => edit((d) => void d[ri].blocks[ki][bi].splice(ci, 1)),
                                ),
                              )}
                              {block.length > 1 &&
                                addOnWire(
                                  () => edit((d) => void d[ri].blocks[ki][bi].push({ addr: armed })),
                                  b.length >= MAX_CONTACTS,
                                  'Add a contact in series inside this branch',
                                )}
                            </div>
                          ))}
                          {/* Where a parallel group splits off the rung and joins it again. */}
                          {block.length > 1 && (
                            <>
                              <div className="absolute left-0 top-[43px] bottom-[11px] w-0.5 bg-carbon-800" />
                              <div className="absolute right-0 top-[43px] bottom-[11px] w-0.5 bg-carbon-800" />
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          className="ml-2 rounded-md px-1 text-[10px] font-semibold text-carbon-600 hover:bg-steel-200 hover:text-carbon-900 disabled:opacity-40"
                          disabled={block.length >= MAX_BRANCHES}
                          onClick={() => edit((d) => void d[ri].blocks[ki].push([{ addr: armed }]))}
                          title={`Add ${armed} in parallel here`}
                        >
                          + parallel
                        </button>
                      </div>
                    ))}
                    <div className="relative flex h-14 shrink-0 items-start pr-1">
                      <div className={wire} />
                      {addOnWire(
                        () => edit((d) => void d[ri].blocks.push([[{ addr: armed }]])),
                        r.blocks.length >= MAX_BLOCKS,
                        `Add ${armed} in series at the end of the rung`,
                      )}
                    </div>
                    <div className="relative h-14 min-w-6 flex-1">
                      <div className={wire} />
                    </div>
                    {/* The coil, against the right rail. */}
                    <div
                      className="relative flex w-48 shrink-0 flex-col items-center"
                      title={device[r.coil.addr] ?? 'not wired'}
                    >
                      <div className={wire} />
                      <div className={label}>
                        {deviceName(r.coil.addr)}
                        <select
                          aria-label="Coil address"
                          value={r.coil.addr}
                          onChange={(e) => edit((d) => void (d[ri].coil.addr = e.target.value))}
                          className="bg-steel-50 font-mono text-[11px] font-bold text-carbon-900"
                        >
                          {(r.coil.kind === 'TON' ? PLC_TIMERS : PLC_COILS).map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span
                        className={`relative h-5 bg-steel-50 px-1 font-mono text-sm font-bold leading-5 ${
                          coilOn ? 'text-run-green' : 'text-carbon-800'
                        }`}
                      >
                        {COIL_GLYPH[r.coil.kind]}
                      </span>
                      <span className="max-w-full text-center">{switchesNote(r.coil.addr)}</span>
                      <div className="mt-1 flex items-center gap-1">
                        <select
                          aria-label="Coil kind"
                          value={r.coil.kind}
                          onChange={(e) =>
                            edit((d) => {
                              const kind = e.target.value as LadderCoilKind;
                              // A TON coils a timer, every other kind an output or internal relay.
                              const pool = kind === 'TON' ? PLC_TIMERS : PLC_COILS;
                              d[ri].coil = {
                                kind,
                                addr: pool.includes(d[ri].coil.addr) ? d[ri].coil.addr : pool[0],
                                ...(kind === 'TON' ? { presetSec: d[ri].coil.presetSec ?? 1 } : {}),
                              };
                            })
                          }
                          className="bg-steel-50 text-[11px] text-carbon-900"
                        >
                          <option value="OUT">OUT</option>
                          <option value="SET">SET</option>
                          <option value="RST">RST</option>
                          <option value="TON">TON</option>
                        </select>
                        {r.coil.kind === 'TON' && (
                          <label className="flex items-center gap-0.5 text-[11px] text-carbon-800">
                            <input
                              key={String(r.coil.presetSec ?? 1)}
                              type="number"
                              aria-label="Timer preset in seconds"
                              min={TON_MIN_SEC}
                              max={TON_MAX_SEC}
                              step={0.1}
                              defaultValue={r.coil.presetSec ?? 1}
                              // Clamped once the student is done typing, not on every key.
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                const sec = e.target.value === '' || !Number.isFinite(v) ? 1 : Math.min(TON_MAX_SEC, Math.max(TON_MIN_SEC, v));
                                e.target.value = String(sec);
                                edit((d) => void (d[ri].coil.presetSec = sec));
                              }}
                              className="w-14 rounded-md border border-steel-400 bg-steel-50 px-1 font-mono text-carbon-900"
                            />
                            s
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className={`${tool} mt-3`}
            disabled={rungs.length >= MAX_RUNGS}
            onClick={() => edit((d) => void d.push(blankRung(armed)))}
          >
            <Plus className="h-3 w-3" /> rung
          </button>
        </div>
      </div>
    </section>
  );
}
