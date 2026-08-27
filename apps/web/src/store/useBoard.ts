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
  wireColor: WireColor;
  pending: EndRef | null;
  cursor: { x: number; y: number };
  selectedWireId: string | null;
  hint: string | null;
  dirty: boolean;

  setBreaker(on: boolean): void;
  resetBreaker(): void;
  holdButton(id: string, down: boolean): void;
  flipToggle(id: string): void;
  setTimerDelay(ms: number): void;

  moveModule(id: string, x: number, y: number): void;
  startWire(from: EndRef): void;
  completeWire(to: EndRef): void;
  cancelWire(): void;
  setCursor(x: number, y: number): void;

  setWireColor(c: WireColor): void;
  selectWire(id: string | null): void;
  deleteWire(id: string): void;
  clearWires(): void;
  loadCircuit(c: Circuit): void;

  tick(dtMs: number): void;
  setHint(h: string | null): void;
}

const inputsOf = (s: Core): Inputs => ({
  breakerClosed: s.breakerOn && !s.tripped,
  pressed: s.pressed,
  toggled: s.toggled,
});

/** Re-solve the board, latching a short circuit as a tripped breaker. */
function resolve(s: Core, dtMs = 0): Core {
  const sim = step(s.circuit, inputsOf(s), s.simState, dtMs);
  if (sim.faulted && !s.tripped) {
    const next: Core = { ...s, tripped: true, latched: sim.errors, simState: emptyState() };
    return { ...next, sim: step(next.circuit, inputsOf(next), next.simState, 0) };
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
  return resolve({ ...base, sim: step(base.circuit, inputsOf(base), base.simState, 0) });
}

export const useBoard = create<BoardStore>((set, get) => ({
  ...initial(),
  wireColor: 'red',
  pending: null,
  cursor: { x: 0, y: 0 },
  selectedWireId: null,
  hint: null,
  dirty: false,

  setBreaker: (on) => set((s) => resolve({ ...s, breakerOn: on })),
  resetBreaker: () => set((s) => resolve({ ...s, tripped: false, latched: [], simState: emptyState() })),
  holdButton: (id, down) => set((s) => resolve({ ...s, pressed: { ...s.pressed, [id]: down } })),
  flipToggle: (id) => set((s) => resolve({ ...s, toggled: { ...s.toggled, [id]: !s.toggled[id] } })),
  setTimerDelay: (ms) =>
    set((s) => ({ ...resolve({ ...s, circuit: { ...s.circuit, timerDelayMs: ms } }), dirty: true })),

  moveModule: (id, x, y) =>
    set((s) => ({
      circuit: {
        ...s.circuit,
        modules: s.circuit.modules.map((m) => (m.id === id ? { ...m, x, y } : m)),
      },
      dirty: true,
    })),

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
      return { ...resolve({ ...s, circuit: { ...s.circuit, wires } }), selectedWireId: null, dirty: true };
    }),

  clearWires: () => set((s) => ({ ...resolve({ ...s, circuit: { ...s.circuit, wires: [] } }), dirty: true })),

  loadCircuit: (c) =>
    set((s) => ({
      ...resolve({ ...s, circuit: c, simState: emptyState(), tripped: false, latched: [] }),
      selectedWireId: null,
      pending: null,
      dirty: false,
    })),

  tick: (dtMs) => set((s) => resolve(s, dtMs)),
  setHint: (h) => set({ hint: h }),
}));

export const useErrors = (): SimError[] => useBoard((s) => (s.tripped ? s.latched : s.sim.errors));
