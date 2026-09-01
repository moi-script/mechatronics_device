'use client';

import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { PARTS, benchInventory, moduleLabel, type ModuleInstance, type ModuleType } from '@mech/sim';
import { useBoard } from '@/store/useBoard';

/** The bench stock grouped by part, in the order it sits on the bench. */
function useGroups(): { type: ModuleType; parts: ModuleInstance[] }[] {
  return useMemo(() => {
    const groups: { type: ModuleType; parts: ModuleInstance[] }[] = [];
    for (const m of benchInventory()) {
      const group = groups.find((g) => g.type === m.type);
      if (group) group.parts.push(m);
      else groups.push({ type: m.type, parts: [m] });
    }
    return groups;
  }, []);
}

/**
 * The parts bin: everything the bench owns, whether it is down on the board or
 * not. Clicking a spare puts it on the board at its bench slot; clicking one
 * that is already down takes it back, along with any leads plugged into it.
 */
export function PartsBin({ onClose }: { onClose: () => void }) {
  const onBoard = useBoard((s) => s.circuit.modules);
  const addModule = useBoard((s) => s.addModule);
  const removeModule = useBoard((s) => s.removeModule);
  const groups = useGroups();

  const down = new Set(onBoard.map((m) => m.id));
  const total = groups.reduce((n, g) => n + g.parts.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-900/45 p-4 sm:p-6" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-steel-400 bg-steel-50 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-carbon-900">Components</h2>
          <button type="button" onClick={onClose} className="text-carbon-600 hover:text-carbon-900" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-carbon-600">
          {down.size} of {total} on the board. Click a part to put it down, or one that is down to take it back.
        </p>

        <div className="space-y-4">
          {groups.map((g) => {
            const placed = g.parts.filter((m) => down.has(m.id)).length;
            const spares = g.parts.filter((m) => !down.has(m.id));
            return (
              <section key={g.type}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h3 className="text-xs font-semibold text-carbon-900">{PARTS[g.type].label}</h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-carbon-600">
                      {placed}/{g.parts.length}
                    </span>
                    {spares.length > 1 && (
                      <button
                        type="button"
                        onClick={() => spares.forEach((m) => addModule(m.id))}
                        className="text-[10px] font-semibold text-carbon-600 underline-offset-2 hover:text-carbon-900 hover:underline"
                      >
                        Add all
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.parts.map((m) => {
                    const isDown = down.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        title={isDown ? `Take ${moduleLabel(m)} off the board` : `Put ${moduleLabel(m)} on the board`}
                        onClick={() => (isDown ? removeModule(m.id) : addModule(m.id))}
                        className={
                          'inline-flex items-center gap-1 rounded-sm px-2 py-1 font-mono text-[11px] transition ' +
                          (isDown
                            ? 'border border-run-green/40 bg-run-green/10 text-run-green hover:bg-run-green/20'
                            : 'border border-dashed border-steel-400 bg-steel-100 text-carbon-600 hover:border-carbon-600 hover:text-carbon-900')
                        }
                      >
                        {isDown ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {m.id}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
