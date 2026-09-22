'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2, X } from 'lucide-react';
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
const CATEGORIES: readonly { id: string; label: string; types: readonly ModuleType[] | null }[] = [
  { id: 'all', label: 'All parts', types: null },
  { id: 'power', label: 'Power', types: ['BREAKER', 'SUPPLY'] },
  { id: 'inputs', label: 'Inputs', types: ['PUSHBTN', 'TOGGLE'] },
  { id: 'control', label: 'Control', types: ['RELAY', 'BIGRELAY', 'TMRRELAY', 'TIMER'] },
  { id: 'outputs', label: 'Outputs', types: ['LAMP', 'SOLENOID', 'CYLINDER'] },
  { id: 'festech', label: 'Festech panels', types: ['FT_PSU', 'FT_PBU', 'FT_RELAY3', 'FT_PLC', 'FT_LIMIT'] },
  { id: 'pneumatics', label: 'Pneumatics', types: ['FT_AIR', 'FT_V52S', 'FT_V52D', 'FT_V32', 'FT_CYL', 'FT_SCYL'] },
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
  FT_PLC: 'OMRON CP1E: inputs 00-11 with LEDs, outputs 00-07, +24V and 0V posts. No ladder program loaded.',
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
  const board = useBoard((s) => s.circuit.board ?? 'trainer');
  const groups = useGroups(board);

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const down = new Set(onBoard.map((m) => m.id));
  const total = groups.reduce((n, g) => n + g.parts.length, 0);

  const q = query.trim().toLowerCase();
  const shelf = CATEGORIES.find((c) => c.id === category)?.types ?? null;
  const shown = groups.filter((g) => {
    if (shelf && !shelf.includes(g.type)) return false;
    if (!q) return true;
    // Match the part name, its blurb, or a single unit tag such as "RLY3".
    return (
      PARTS[g.type].label.toLowerCase().includes(q) ||
      BLURB[g.type].toLowerCase().includes(q) ||
      g.parts.some((m) => m.id.toLowerCase().includes(q))
    );
  });

  const countIn = (types: readonly ModuleType[] | null) =>
    groups.filter((g) => !types || types.includes(g.type)).reduce((n, g) => n + g.parts.length, 0);

  const unitChip =
    'inline-flex items-center gap-1 rounded-sm px-2 py-1 font-mono text-[11px] transition border ';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-900/45 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-steel-400 bg-steel-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-steel-300 bg-steel-100 px-4 py-3">
          <div className="mr-auto">
            <h2 className="engraved text-xs font-bold text-carbon-900">Components</h2>
            <p className="mt-0.5 text-[11px] text-carbon-600">
              <span className="font-mono text-carbon-900">
                {down.size}/{total}
              </span>{' '}
              on the board
            </p>
          </div>
          <div className="relative flex-1 basis-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-carbon-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parts, e.g. relay or RLY3"
              aria-label="Search components"
              className="w-full rounded-sm border border-steel-400 bg-steel-50 py-1.5 pl-8 pr-2 text-xs text-carbon-900 outline-none focus:border-signal-amber"
            />
          </div>
          {/* Empties the board in one undoable step, leads and all. */}
          <button
            type="button"
            disabled={down.size === 0}
            onClick={() => removeModules([...down])}
            className="inline-flex items-center gap-1 rounded-sm border border-safety-red/40 bg-safety-red/10 px-2 py-1 text-[10px] font-semibold text-safety-red hover:bg-safety-red/20 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Clear all
          </button>
          <button type="button" onClick={onClose} className="text-carbon-600 hover:text-carbon-900" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Shelves: a rail on a wide panel, a scrolling strip on a phone. */}
          <nav className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-steel-300 bg-steel-100 p-2 sm:flex">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={
                  'flex items-center justify-between rounded-sm px-2.5 py-2 text-left text-xs font-semibold transition ' +
                  (category === c.id
                    ? 'bg-steel-50 text-carbon-900 shadow-sm ring-1 ring-steel-400'
                    : 'text-carbon-600 hover:bg-steel-200 hover:text-carbon-900')
                }
              >
                {c.label}
                <span className="font-mono text-[10px] text-carbon-600">{countIn(c.types)}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="flex gap-1.5 overflow-x-auto border-b border-steel-300 px-3 py-2 sm:hidden">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={
                    'shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ' +
                    (category === c.id
                      ? 'border-carbon-900 bg-carbon-900 text-steel-50'
                      : 'border-steel-400 bg-steel-100 text-carbon-600')
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-carbon-600">Nothing on the bench matches that.</p>
            ) : (
              <ul className="divide-y divide-steel-300">
                {shown.map((g) => {
                  const placed = g.parts.filter((m) => down.has(m.id)).length;
                  const spares = g.parts.filter((m) => !down.has(m.id));
                  return (
                    <li key={g.type} className="flex gap-3 px-4 py-3">
                      {/* The symbol tile, the way a schematic palette shows stock. */}
                      <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-md border border-steel-400 bg-steel-100 text-carbon-800">
                        <PartSymbol type={g.type} className="h-10 w-14" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-xs font-semibold text-carbon-900">{PARTS[g.type].label}</h3>
                          <span className="font-mono text-[10px] text-carbon-600">
                            {placed}/{g.parts.length}
                          </span>
                          {spares.length > 0 && (
                            <button
                              type="button"
                              onClick={() => spares.forEach((m) => addModule(m.id))}
                              className="ml-auto inline-flex items-center gap-1 rounded-sm border border-run-green/40 bg-run-green/10 px-2 py-1 text-[10px] font-semibold text-run-green hover:bg-run-green/20"
                            >
                              <Plus className="h-3 w-3" />
                              {spares.length > 1 ? 'Add all' : 'Add'}
                            </button>
                          )}
                          {placed > 0 && (
                            <button
                              type="button"
                              onClick={() => removeModules(g.parts.filter((m) => down.has(m.id)).map((m) => m.id))}
                              className={
                                (spares.length > 0 ? '' : 'ml-auto ') +
                                'inline-flex items-center gap-1 rounded-sm border border-safety-red/40 bg-safety-red/10 px-2 py-1 text-[10px] font-semibold text-safety-red hover:bg-safety-red/20'
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                              {placed > 1 ? 'Clear all' : 'Clear'}
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-600">{BLURB[g.type]}</p>

                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {g.parts.map((m) => {
                            const isDown = down.has(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                title={
                                  isDown ? 'Take ' + moduleLabel(m) + ' off the board' : 'Put ' + moduleLabel(m) + ' on the board'
                                }
                                onClick={() => (isDown ? removeModule(m.id) : addModule(m.id))}
                                className={
                                  unitChip +
                                  (isDown
                                    ? 'border-run-green/40 bg-run-green/10 text-run-green hover:bg-run-green/20'
                                    : 'border-dashed border-steel-400 bg-steel-100 text-carbon-600 hover:border-carbon-600 hover:text-carbon-900')
                                }
                              >
                                {isDown ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                {m.id}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <footer className="border-t border-steel-300 bg-steel-100 px-4 py-2 text-[10px] text-carbon-600">
          Green tags are on the board. Click one to send it back to the bin, leads and all.
        </footer>
      </div>
    </div>
  );
}
