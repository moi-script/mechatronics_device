'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  canConnect,
  emptyCircuit,
  emptyState,
  isMaleOccupied,
  step,
  type Circuit,
  type EndRef,
  type Inputs,
  type SimError,
  type SimResult,
  type SimState,
  type WireColor,
} from '@mech/sim';

interface Core {
  circuit: Circuit;
  breakerOn: boolean;
  tripped: boolean;
  pressed: Record<string, boolean>;
  toggled: Record<string, boolean>;
  simState: SimState;
  sim: SimResult;
  latched: SimError[];
}

interface BoardStore extends Core {
  /** Circuit snapshots either side of the present, for undo and redo. */
  past: Circuit[];
  future: Circuit[];
  wireColor: WireColor;
  /** Modules picked out with the marquee or shift-click, moved as a group. */
  selectedModuleIds: string[];
  /** Server id of the circuit on the board, once it has been saved or loaded. */
  savedCircuitId: string | null;
  pending: EndRef | null;
  cursor: { x: number; y: number };
  selectedWireId: string | null;
  hint: string | null;
  dirty: boolean;

  setBreaker(on: boolean): void;
  resetBreaker(): void;
  holdButton(id: string, down: boolean): void;
  flipToggle(id: string): void;

  moveModule(id: string, x: number, y: number): void;
  /** Reposition several modules at once, for a group drag. */
  moveModules(positions: Record<string, { x: number; y: number }>): void;
  setSelectedModules(ids: string[]): void;
  toggleModuleSelection(id: string): void;
  clearModuleSelection(): void;
  startWire(from: EndRef): void;
  completeWire(to: EndRef): void;
  cancelWire(): void;
  setCursor(x: number, y: number): void;

  undo(): void;
  redo(): void;
  /** Snapshot before a drag, so the whole move is one undo step. */
  beginMove(): void;

  setWireColor(c: WireColor): void;
  selectWire(id: string | null): void;
  deleteWire(id: string): void;
  clearWires(): void;
  loadCircuit(c: Circuit, id?: string | null): void;
  setSavedCircuitId(id: string | null): void;

  setHint(h: string | null): void;
}

/** How many steps back the board can be walked. */
const HISTORY_LIMIT = 60;

/**
 * Snapshot the circuit so the change about to happen can be undone. Taking a
 * new action always abandons the redo branch, which is what people expect.
 */
const remember = (s: { past: Circuit[]; circuit: Circuit }) => ({
  past: [...s.past, s.circuit].slice(-HISTORY_LIMIT),
  future: [] as Circuit[],
});

const inputsOf = (s: Core): Inputs => ({
  breakerClosed: s.breakerOn && !s.tripped,
  pressed: s.pressed,
  toggled: s.toggled,
});

/** Re-solve the board, latching a short circuit as a tripped breaker. */
function resolve(s: Core): Core {
  const sim = step(s.circuit, inputsOf(s), s.simState);
  if (sim.faulted && !s.tripped) {
    const next: Core = { ...s, tripped: true, latched: sim.errors, simState: emptyState() };
    return { ...next, sim: step(next.circuit, inputsOf(next), next.simState) };
  }
  return { ...s, sim, simState: sim.state, latched: s.tripped ? s.latched : [] };
}

function initial(): Core {
  const base: Core = {
    circuit: emptyCircuit(),
    breakerOn: false,
    tripped: false,
    pressed: {},
    toggled: {},
    simState: emptyState(),
    sim: undefined as unknown as SimResult,
    latched: [],
  };
  return resolve({ ...base, sim: step(base.circuit, inputsOf(base), base.simState) });
}

export const useBoard = create<BoardStore>((set, get) => ({
  ...initial(),
  past: [],
  future: [],
  wireColor: 'red',
  selectedModuleIds: [],
  savedCircuitId: null,
  pending: null,
  cursor: { x: 0, y: 0 },
  selectedWireId: null,
  hint: null,
  dirty: false,

  setBreaker: (on) => set((s) => resolve({ ...s, breakerOn: on })),
  resetBreaker: () => set((s) => resolve({ ...s, tripped: false, latched: [], simState: emptyState() })),
  holdButton: (id, down) => set((s) => resolve({ ...s, pressed: { ...s.pressed, [id]: down } })),
  flipToggle: (id) => set((s) => resolve({ ...s, toggled: { ...s.toggled, [id]: !s.toggled[id] } })),
  moveModule: (id, x, y) =>
    set((s) => ({
      circuit: {
        ...s.circuit,
        modules: s.circuit.modules.map((m) => (m.id === id ? { ...m, x, y } : m)),
      },
      dirty: true,
    })),

  moveModules: (positions) =>
    set((s) => ({
      circuit: {
        ...s.circuit,
        modules: s.circuit.modules.map((m) => (positions[m.id] ? { ...m, ...positions[m.id] } : m)),
      },
      dirty: true,
    })),

  setSelectedModules: (ids) => set({ selectedModuleIds: ids }),

  toggleModuleSelection: (id) =>
    set((s) => ({
      selectedModuleIds: s.selectedModuleIds.includes(id)
        ? s.selectedModuleIds.filter((x) => x !== id)
        : [...s.selectedModuleIds, id],
    })),

  clearModuleSelection: () => set({ selectedModuleIds: [] }),

  startWire: (from) => {
    if (from.kind === 'stack' && isMaleOccupied(get().circuit, from.wireId, from.end)) {
      set({ hint: 'That connector already carries a lead - stack onto the one above it.' });
      return;
    }
    set({ pending: from, selectedWireId: null, hint: null });
  },

  completeWire: (to) =>
    set((s) => {
      const from = s.pending;
      if (!from) return {};
      const id = 'w_' + nanoid(8);
      const checkA = canConnect(s.circuit, id, 'A', from);
      const checkB = canConnect(s.circuit, id, 'B', to);
      if (!checkA.ok || !checkB.ok) {
        return { hint: checkA.reason ?? checkB.reason ?? 'Those connectors cannot mate.', pending: null };
      }
      if (to.kind === 'stack' && isMaleOccupied(s.circuit, to.wireId, to.end)) {
        return { hint: 'That connector already carries a lead - stack onto the one above it.', pending: null };
      }
      const wire = { id, color: s.wireColor, a: from, b: to };
      return {
        ...resolve({ ...s, circuit: { ...s.circuit, wires: [...s.circuit.wires, wire] } }),
        ...remember(s),
        pending: null,
        hint: null,
        dirty: true,
      };
    }),

  cancelWire: () => set({ pending: null }),
  setCursor: (x, y) => set({ cursor: { x, y } }),

  setWireColor: (c) =>
    set((s) => {
      if (s.selectedWireId) {
        return {
          ...remember(s),
          wireColor: c,
          circuit: {
            ...s.circuit,
            wires: s.circuit.wires.map((w) => (w.id === s.selectedWireId ? { ...w, color: c } : w)),
          },
          dirty: true,
        };
      }
      return { wireColor: c };
    }),

  selectWire: (id) => set({ selectedWireId: id, pending: null }),

  deleteWire: (id) =>
    set((s) => {
      // Anything stacked on this lead falls loose rather than vanishing with it.
      const wires = s.circuit.wires
        .filter((w) => w.id !== id)
        .map((w) => {
          const drop = (ref: EndRef): EndRef =>
            ref.kind === 'stack' && ref.wireId === id ? { kind: 'loose', x: 0, y: 0 } : ref;
          return { ...w, a: drop(w.a), b: drop(w.b) };
        });
      return {
        ...resolve({ ...s, circuit: { ...s.circuit, wires } }),
        ...remember(s),
        selectedWireId: null,
        dirty: true,
      };
    }),

  clearWires: () =>
    set((s) => ({
      ...resolve({ ...s, circuit: { ...s.circuit, wires: [] } }),
      ...remember(s),
      selectedWireId: null,
      dirty: true,
    })),

  beginMove: () => set((s) => remember(s)),

  undo: () =>
    set((s) => {
      const previous = s.past.at(-1);
      if (!previous) return {};
      return {
        ...resolve({ ...s, circuit: previous }),
        past: s.past.slice(0, -1),
        future: [s.circuit, ...s.future].slice(0, HISTORY_LIMIT),
        selectedWireId: null,
        pending: null,
        dirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      const [next, ...rest] = s.future;
      if (!next) return {};
      return {
        ...resolve({ ...s, circuit: next }),
        past: [...s.past, s.circuit].slice(-HISTORY_LIMIT),
        future: rest,
        selectedWireId: null,
        pending: null,
        dirty: true,
      };
    }),

  setSavedCircuitId: (id) => set({ savedCircuitId: id }),

  loadCircuit: (c, id = null) =>
    set((s) => ({
      ...resolve({ ...s, circuit: c, simState: emptyState(), tripped: false, latched: [] }),
      past: [],
      future: [],
      selectedWireId: null,
      selectedModuleIds: [],
      pending: null,
      dirty: false,
      savedCircuitId: id,
    })),

  setHint: (h) => set({ hint: h }),
}));

export const useErrors = (): SimError[] => useBoard((s) => (s.tripped ? s.latched : s.sim.errors));
