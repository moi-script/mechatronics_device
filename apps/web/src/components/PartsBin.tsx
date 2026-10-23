'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import {
  PARTS,
  benchInventory,
  moduleLabel,
  type BoardType,
  type ModuleInstance,
  type ModuleType,
} from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { PartSymbol } from './PartSymbol';

/** Shelves of the bin, so the palette reads like a catalogue rather than a list. */
export const CATEGORIES: readonly { id: string; label: string; heading: string; types: readonly ModuleType[] | null }[] = [
  { id: 'all', label: 'All parts', heading: '', types: null },
  { id: 'power', label: 'Power', heading: 'Power · what feeds the bench', types: ['BREAKER', 'SUPPLY'] },
  { id: 'inputs', label: 'Inputs', heading: 'Inputs · you press or flip them', types: ['PUSHBTN', 'TOGGLE'] },
  { id: 'control', label: 'Control', heading: 'Control · relays and timers', types: ['RELAY', 'BIGRELAY', 'TMRRELAY', 'TIMER'] },
  { id: 'outputs', label: 'Outputs', heading: 'Outputs · what the circuit drives', types: ['LAMP', 'SOLENOID', 'CYLINDER'] },
  {
    id: 'festech',
    label: 'Festech panels',
    heading: 'Festech panels · the PLC bench',
    types: ['FT_PSU', 'FT_PBU', 'FT_RELAY3', 'FT_PLC', 'FT_LIMIT'],
  },
  {
    id: 'pneumatics',
    label: 'Pneumatics',
    heading: 'Pneumatics · air, valves and cylinders',
    types: ['FT_AIR', 'FT_V52S', 'FT_V52D', 'FT_V32', 'FT_CYL', 'FT_SCYL'],
  },
];

/** One line of catalogue copy per part, so the symbol is not the only clue. */
const BLURB: Record<ModuleType, string> = {
  BREAKER: 'Closes the supply to the whole board.',
  SUPPLY: '24 V DC rails: six VCC and six GND per row.',
  PUSHBTN: 'Momentary NO/NC contact, live only while held.',
  TOGGLE: 'Maintained NO/NC contact, stays where you flip it.',
  LAMP: 'Indicator load across VCC and GND.',
  RELAY: 'Coil plus one NO/COM/NC line.',
  BIGRELAY: 'Coil plus four NO/COM/NC lines.',
  TMRRELAY: 'On-delay large relay: once the coil is live it waits the set time, then all four lines switch NC to NO.',
  SOLENOID: 'Breakout block: six VCC/GND pairs for valve coils.',
  CYLINDER: 'Double-acting rod, driven by extend and retract coils.',
  TIMER: 'On-delay: COM feeds VCC once the set point runs out.',
  FT_PSU: 'DC 24V / 5A: four +24V posts on top, four 0V posts below. Its rocker switches the bench on.',
  FT_PBU: 'Three lit buttons, each 13-14 and 23-24 NO, 31-32 and 41-42 NC, lamp on X1-X2. +24V and 0V strips.',
  FT_RELAY3: 'Three relays: coil A1-A2, COM 11/21/31/41, NC 12/22/32/42, NO 14/24/34/44.',
  FT_PLC: 'OMRON CP1E: inputs 00-11, relay outputs 00-07 on COM, +24V and 0V posts. Runs a ladder program.',
  FT_LIMIT: 'Roller lever switch: COM, N.O and N.C. Push the roller to throw it.',
  FT_AIR: 'Compressed-air manifold: IN plus eight outlets, all under pressure. Blue tubing only.',
  FT_V52S: 'Solenoid Y1 +/-. Air 1 in, 2 and 4 to the cylinder, 3 and 5 silenced exhaust. Springs back.',
  FT_V52D: 'Solenoids Y14 and Y12. Same ports as the single; the spool stays where it was last sent.',
  FT_V32: 'Normally closed: air 1 in, 2 out, 3 exhaust. Solenoid Y1 opens 1 to 2.',
  FT_CYL: 'Air into A extends, into B retracts. Two reed sensors (+ / OUT) close at each end of stroke.',
  FT_SCYL: 'Spring return: air into A extends, venting A lets the spring pull it home. Two reed sensors (+ / OUT).',
};

/** The bench stock grouped by part, in the order it sits on the bench. */
function useGroups(board: BoardType): { type: ModuleType; parts: ModuleInstance[] }[] {
  return useMemo(() => {
    const groups: { type: ModuleType; parts: ModuleInstance[] }[] = [];
    for (const m of benchInventory(board)) {
      const group = groups.find((g) => g.type === m.type);
      if (group) group.parts.push(m);
      else groups.push({ type: m.type, parts: [m] });
    }
    return groups;
  }, [board]);
}

/**
 * The parts bin: everything the bench owns, whether it is down on the board or
 * not. Browse it by shelf or by name, then click a unit to put it down, or one
 * that is already down to take it back along with any leads plugged into it.
 */
export function PartsBin({ onClose }: { onClose: () => void }) {
  const onBoard = useBoard((s) => s.circuit.modules);
  const addModule = useBoard((s) => s.addModule);
  const removeModule = useBoard((s) => s.removeModule);
  const removeModules = useBoard((s) => s.removeModules);
  const undo = useBoard((s) => s.undo);
  const board = useBoard((s) => s.circuit.board ?? 'trainer');
  const groups = useGroups(board);

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  /** The last thing done in the bin, said back in the footer with a way to undo it. */
  const [last, setLast] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  // Esc closes; "/" jumps to the search box, as in most catalogues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '/' && document.activeElement !== search.current) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const down = new Set(onBoard.map((m) => m.id));
  const placedIn = (parts: ModuleInstance[]) => parts.filter((m) => down.has(m.id)).length;
  const total = groups.reduce((n, g) => n + g.parts.length, 0);
  const placedTotal = groups.reduce((n, g) => n + placedIn(g.parts), 0);

  const q = query.trim().toLowerCase();
  // A bench without Festech or pneumatic stock should not offer empty shelves for them.
  const shelves = CATEGORIES.filter((c) => !c.types || groups.some((g) => c.types!.includes(g.type)));
  const matches = (g: { type: ModuleType; parts: ModuleInstance[] }) =>
    !q ||
    // Match the part name, its blurb, or a single unit tag such as "RLY3".
    PARTS[g.type].label.toLowerCase().includes(q) ||
    BLURB[g.type].toLowerCase().includes(q) ||
    g.parts.some((m) => m.id.toLowerCase().includes(q));
  const sections = shelves
    .filter((c) => c.types && (category === 'all' || category === c.id))
    .map((c) => ({ ...c, groups: groups.filter((g) => c.types!.includes(g.type) && matches(g)) }))
    .filter((c) => c.groups.length > 0);

  const countIn = (types: readonly ModuleType[] | null) => {
    const inShelf = groups.filter((g) => !types || types.includes(g.type));
    return inShelf.reduce((n, g) => n + placedIn(g.parts), 0) + '/' + inShelf.reduce((n, g) => n + g.parts.length, 0);
  };

  const put = (ids: string[]) => {
    ids.forEach((id) => addModule(id));
    setLast(ids.length === 1 ? ids[0] + ' placed at its bench slot' : ids.length + ' parts placed at their bench slots');
  };
  const takeBack = (ids: string[]) => {
    if (ids.length === 1) removeModule(ids[0]);
    else removeModules(ids);
    setLast(ids.length === 1 ? ids[0] + ' sent back to the bin' : ids.length + ' parts sent back to the bin');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06090d]/60 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bin-title"
        className="flex h-[min(860px,92dvh)] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl border border-steel-400 bg-steel-50 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title, how full the bench is, search, actions. */}
        <header className="flex flex-wrap items-center gap-3 border-b border-steel-300 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="flex min-w-[180px] flex-col gap-1.5">
            <h2 id="bin-title" className="font-cond text-base font-bold tracking-[0.12em] text-carbon-900">
              COMPONENTS
            </h2>
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 w-[120px] overflow-hidden rounded-full bg-steel-300">
                <div className="h-full bg-signal-amber" style={{ width: (total ? (placedTotal / total) * 100 : 0) + '%' }} />
              </div>
              <span className="text-xs text-carbon-600">
                <b className="font-mono text-carbon-900">{placedTotal}</b> of {total} on the bench
              </span>
            </div>
          </div>
          <label className="flex h-[42px] flex-[1_1_260px] items-center gap-2.5 rounded-[10px] border border-steel-400 bg-steel-100 px-3.5 focus-within:border-signal-amber">
            <Search className="h-4 w-4 shrink-0 text-carbon-600" />
            <span className="sr-only">Search parts</span>
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parts, e.g. relay or RLY3"
              className="min-w-0 flex-1 bg-transparent text-sm text-carbon-900 outline-none placeholder:text-steel-500"
            />
            <kbd className="hidden rounded-[5px] border border-steel-400 px-1.5 font-mono text-[11px] text-steel-500 sm:inline">
              /
            </kbd>
          </label>
          {/* Empties the board in one undoable step, leads and all. */}
          <button
            type="button"
            disabled={down.size === 0}
            onClick={() => takeBack([...down])}
            className="h-[42px] rounded-[10px] border border-safety-red/40 px-3.5 text-sm text-red-ink transition hover:bg-safety-red/10 disabled:opacity-40"
          >
            Clear the bench
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close components"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-carbon-600 transition hover:bg-steel-200 hover:text-carbon-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Shelves: a rail on a wide panel, a scrolling strip on a phone. */}
          <nav
            aria-label="Shelves"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-steel-300 p-2 sm:w-[220px] sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-r sm:px-2.5 sm:py-3.5"
          >
            {shelves.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-current={category === c.id}
                className={
                  'flex shrink-0 items-center justify-between gap-3 rounded-[9px] px-3 py-2 text-left text-sm transition sm:py-2.5 ' +
                  (category === c.id ? 'bg-signal-amber/12 font-semibold text-amber-ink' : 'text-carbon-800 hover:bg-steel-200')
                }
              >
                <span>{c.label}</span>
                <span className={'font-mono text-xs ' + (category === c.id ? '' : 'text-carbon-600')}>{countIn(c.types)}</span>
              </button>
            ))}
            <div className="hidden flex-1 sm:block" />
            <p className="hidden rounded-[10px] border border-steel-300 bg-steel-100 p-3 text-xs leading-relaxed text-carbon-600 sm:block">
              The bench owns a fixed set of parts. A part on the board can&apos;t be taken twice.
            </p>
          </nav>

          {/* Parts */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5">
            {sections.length === 0 && <p className="py-10 text-center text-sm text-carbon-600">Nothing on the bench matches that.</p>}
            {sections.map((c) => (
              <section key={c.id} className="flex flex-col gap-3">
                <h3 className="font-cond text-xs font-bold uppercase tracking-[0.12em] text-carbon-600">{c.heading}</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {c.groups.map((g) => {
                    const placed = placedIn(g.parts);
                    const spares = g.parts.filter((m) => !down.has(m.id));
                    return (
                      <article key={g.type} className="flex flex-col gap-3 rounded-xl border border-steel-400 bg-steel-100 p-3.5">
                        <div className="flex gap-3.5">
                          {/* The symbol tile, the way a schematic palette shows stock. */}
                          <div className="grid h-16 w-[76px] shrink-0 place-items-center rounded-[10px] border border-steel-300 bg-well text-carbon-800">
                            <PartSymbol type={g.type} className="h-10 w-14" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <h4 className="text-base font-semibold text-carbon-900">{PARTS[g.type].label}</h4>
                              <span className="shrink-0 font-mono text-xs text-carbon-600">
                                {placed} / {g.parts.length}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] leading-snug text-carbon-600">{BLURB[g.type]}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {g.parts.map((m) => {
                            const isDown = down.has(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                aria-pressed={isDown}
                                title={
                                  isDown ? 'On the bench: tap to send ' + moduleLabel(m) + ' back' : 'Put ' + moduleLabel(m) + ' on the bench'
                                }
                                onClick={() => (isDown ? takeBack([m.id]) : put([m.id]))}
                                className={
                                  'inline-flex h-[30px] items-center gap-1 rounded-lg px-2.5 font-mono text-xs transition ' +
                                  (isDown
                                    ? 'border border-signal-amber bg-signal-amber/15 font-bold text-amber-ink'
                                    : 'border border-dashed border-steel-500/70 text-carbon-800 hover:border-signal-amber hover:text-amber-ink')
                                }
                              >
                                {isDown ? <Check className="h-3 w-3" /> : '+ '}
                                {m.id}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2 border-t border-steel-300 pt-2.5">
                          {spares.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => put(spares.map((m) => m.id))}
                              className="h-[30px] rounded-[7px] px-2.5 text-[13px] font-semibold text-green-ink transition hover:bg-steel-200"
                            >
                              {spares.length === 1 ? '+ Add' : placed === 0 ? '+ Add all ' + spares.length : '+ Add the rest'}
                            </button>
                          ) : (
                            <span className="px-2.5 text-[13px] text-carbon-600">All on the bench</span>
                          )}
                          {placed > 0 && (
                            <button
                              type="button"
                              onClick={() => takeBack(g.parts.filter((m) => down.has(m.id)).map((m) => m.id))}
                              className="h-[30px] rounded-[7px] px-2.5 text-[13px] text-red-ink transition hover:bg-steel-200"
                            >
                              {placed === 1 ? 'Send back' : 'Send all back'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Footer: what was just done, and the way back. */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-steel-300 bg-steel-100 px-4 py-3 sm:px-5">
          {last ? (
            <>
              <span className="inline-flex items-center gap-2 text-[13px] text-carbon-800">
                <span className="h-2 w-2 rounded-full bg-run-green" />
                {last}
              </span>
              <button
                type="button"
                onClick={() => {
                  undo();
                  setLast(null);
                }}
                className="h-[30px] rounded-[7px] px-2.5 text-[13px] font-semibold text-signal-amber transition hover:bg-steel-200"
              >
                Undo
              </button>
            </>
          ) : (
            <span className="text-[13px] text-carbon-600">Amber tags are on the bench. Tap one to send it back, leads and all.</span>
          )}
          <div className="flex-1" />
          <span className="hidden text-xs text-steel-500 sm:inline">Esc to close</span>
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] rounded-[9px] bg-signal-amber px-[18px] text-sm font-bold text-[#1a1204] transition hover:brightness-110"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
