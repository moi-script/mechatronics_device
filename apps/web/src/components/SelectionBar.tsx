'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { PARTS, benchInventory, moduleLabel, type ModuleInstance, type ModuleType } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { CATEGORIES } from './PartsBin';

/** Parts that do the same job, where the bin's shelves are too broad: valves for valves, cylinders for cylinders. */
const KINDS: readonly (readonly ModuleType[])[] = [['FT_V52S', 'FT_V52D', 'FT_V32'], ['FT_CYL', 'FT_SCYL'], ['FT_AIR']];

/**
 * The actions for one picked part, floating just above it: put another of the
 * same down, send it back to the bin, or swap it for a spare of the same kind.
 * It follows the part through pans, zooms and drags by measuring it each frame
 * rather than re-rendering the board.
 */
export function SelectionBar({ hostRef }: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  const selected = useBoard((s) => s.selectedModuleIds);
  const modules = useBoard((s) => s.circuit.modules);
  const board = useBoard((s) => s.circuit.board ?? 'trainer');
  const addModule = useBoard((s) => s.addModule);
  const removeModule = useBoard((s) => s.removeModule);
  const replaceModule = useBoard((s) => s.replaceModule);
  const beginMove = useBoard((s) => s.beginMove);
  const moveModules = useBoard((s) => s.moveModules);
  const [replacing, setReplacing] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  const m = selected.length === 1 ? modules.find((x) => x.id === selected[0]) : undefined;

  // Spares still in the bin: the same type for Add, the same shelf for Replace.
  // and, for a bench that is already fully fitted, parts of that shelf on the board to swap places with.
  const { sameType, sameKind, onBoard } = useMemo(() => {
    if (!m) return { sameType: [] as ModuleInstance[], sameKind: [] as ModuleInstance[], onBoard: [] as ModuleInstance[] };
    const down = new Set(modules.map((x) => x.id));
    const spares = benchInventory(board).filter((x) => !down.has(x.id));
    const shelf = KINDS.find((k) => k.includes(m.type)) ?? CATEGORIES.find((c) => c.types?.includes(m.type))?.types ?? [];
    return {
      sameType: spares.filter((x) => x.type === m.type),
      sameKind: spares.filter((x) => x.type !== m.type && shelf.includes(x.type)),
      // A switch bolted to a cylinder stays where it is; it moves with its cylinder.
      onBoard: modules.filter((x) => x.id !== m.id && x.type !== m.type && shelf.includes(x.type) && !x.mount),
    };
  }, [m, modules, board]);

  useEffect(() => setReplacing(false), [m?.id]);

  useEffect(() => {
    if (!m) return;
    let raf = 0;
    const follow = () => {
      const host = hostRef.current;
      const el = host?.querySelector(`[data-module="${m.id}"]`);
      if (host && el && bar.current) {
        const r = el.getBoundingClientRect();
        const h = host.getBoundingClientRect();
        // Centred over the part, kept inside the board when the part runs off its top.
        const x = Math.min(Math.max(r.left - h.left + r.width / 2, 120), h.width - 120);
        const y = Math.max(r.top - h.top - 10, 56);
        bar.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [m, hostRef]);

  if (!m) return null;

  const btn =
    'inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={moduleLabel(m) + ' actions'}
      className="pointer-events-auto absolute top-0 left-0 z-20"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 rounded-[10px] border border-steel-400 bg-steel-100 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
        <span className="max-w-[160px] truncate px-2 font-cond text-xs font-bold tracking-[0.08em] text-carbon-900 uppercase">
          {m.id}
        </span>
        <span className="h-5 w-px bg-steel-400" />
        <button
          type="button"
          className={btn + ' text-green-ink hover:bg-steel-200'}
          disabled={sameType.length === 0}
          title={sameType.length ? `Put ${sameType[0].id} on the board` : `No spare ${PARTS[m.type].label} left in the bin`}
          onClick={() => addModule(sameType[0].id)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
        <button
          type="button"
          className={btn + (replacing ? ' bg-steel-200 text-carbon-900' : ' text-carbon-900 hover:bg-steel-200')}
          disabled={(sameKind.length === 0 && onBoard.length === 0) || !!m.mount}
          aria-expanded={replacing}
          title={
            m.mount
              ? 'Bolted to its cylinder: it moves with it'
              : sameKind.length || onBoard.length
                ? 'Swap for another part of the same kind'
                : 'Nothing else of the same kind on the bench'
          }
          onClick={() => setReplacing((v) => !v)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Replace
        </button>
        <button
          type="button"
          className={btn + ' text-red-ink hover:bg-safety-red/10'}
          title={`Send ${moduleLabel(m)} back to the bin, leads and all`}
          onClick={() => removeModule(m.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {replacing && (
        <div className="absolute top-full left-1/2 mt-1.5 w-[260px] -translate-x-1/2 rounded-xl border border-steel-400 bg-steel-50 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {sameKind.length > 0 && (
            <>
              <p className="px-1.5 pb-1 text-[11px] font-semibold text-carbon-600">From the bin · {m.id} goes back, leads and all</p>
              <ul className="mb-1.5 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                {sameKind.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => replaceModule(m.id, x.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-carbon-900 hover:bg-steel-200"
                    >
                      <span className="truncate">{PARTS[x.type].label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-carbon-600">{x.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {onBoard.length > 0 && (
            <>
              <p className="px-1.5 pb-1 text-[11px] font-semibold text-carbon-600">On the board · swap places, leads stay on</p>
              <ul className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                {onBoard.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => {
                        beginMove();
                        moveModules({ [m.id]: { x: x.x, y: x.y }, [x.id]: { x: m.x, y: m.y } });
                        setReplacing(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-carbon-900 hover:bg-steel-200"
                    >
                      <span className="truncate">{moduleLabel(x)}</span>
                      <span className="shrink-0 font-mono text-[11px] text-carbon-600">{x.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
