import { benchSlot } from './parts';
import type { Circuit, EndRef, ModuleInstance, Wire, WireColor } from './types';

/**
 * A worked circuit that can be dropped onto the bench whole, so a student can
 * run it, trace it, and pull leads out of it rather than starting from bare
 * terminals. A preset only puts down the parts it actually uses; the rest of
 * the inventory stays in the bin.
 */
export interface Preset {
  id: string;
  name: string;
  /** One line, for the list. */
  summary: string;
  /** What the circuit does, step by step, in the order it happens. */
  steps: string[];
  build(): Circuit;
}

/** Builds the wire list for a preset, keeping ids stable and readable. */
class Harness {
  private wires: Wire[] = [];

  constructor(private prefix: string) {}

  /** Run a lead between two terminals. */
  add(from: [string, string], to: [string, string], color: WireColor = 'red'): void {
    this.wires.push({
      id: `${this.prefix}-${this.wires.length + 1}`,
      color,
      a: { kind: 'terminal', moduleId: from[0], pinId: from[1] } as EndRef,
      b: { kind: 'terminal', moduleId: to[0], pinId: to[1] } as EndRef,
    });
  }

  done(): Wire[] {
    return this.wires;
  }
}

/** The bench parts a preset uses, at their slots in the bench layout. */
const layout = (ids: string[], tweak: (m: ModuleInstance) => ModuleInstance = (m) => m): ModuleInstance[] =>
  ids.map((id) => {
    const slot = benchSlot(id);
    if (!slot) throw new Error(`No bench slot for module ${id}`);
    return tweak(slot);
  });

/**
 * Three-step sequence, lamp to lamp, with a start-up timer.
 *
 *   power up -> LAMP1 lights on its own once the timer set point runs out
 *   PB1      -> LAMP1 on, LAMP3 off
 *   PB2      -> LAMP2 on, LAMP1 off
 *   PB3      -> LAMP3 on, LAMP2 off
 *
 * Each step is a latched stage: its lamp hangs across its own coil, it holds
 * itself in through its own NO contact, and stepping forward drops the stage
 * before it. The bench has one large relay, so stages 2 and 3 are each a pair
 * of small relays with their coils paralleled, a contact multiplier: one holds
 * the stage in, the other takes the timer off the clock. The button that starts
 * a stage drops the one before it through its own NC contact, so no relay line
 * is spent on that.
 *
 *   stage 1 = BIG1 + LAMP1         L1 hold, L2 breaks stage 3, L3 + L4 gate the timer
 *                                  its hold runs through PB2 NC, so PB2 drops it
 *   stage 2 = RLY1/RLY2 + LAMP2    RLY1 holds, RLY2 gates the timer
 *                                  its hold runs through PB3 NC, so PB3 drops it
 *   stage 3 = RLY3/RLY4 + LAMP3    RLY3 holds, RLY4 gates the timer
 *
 * The timer coil runs through the NC contacts of all three stages in series,
 * so it only counts while the board is idle and cannot fire again part way
 * round. Its output reaches stage 1 through stage 1's own NC contact, which
 * matters: the bench timer ties its COM to its own VCC once it has picked up,
 * so wiring the output straight to stage 1 would let a latched stage 1 feed
 * the timer's coil back through its own output, and LAMP1 could never be
 * stepped off again.
 */
export const SEQUENCE_PRESET: Preset = {
  id: 'three-step-sequence',
  name: 'Three-step lamp sequence',
  summary: 'A timer starts LAMP1, then each button steps the lamp along and drops the one before it.',
  steps: [
    'Close the breaker and wait out the timer: LAMP1 lights on its own and latches.',
    'PB1 - LAMP1 on, LAMP3 off.',
    'PB2 - LAMP2 on, LAMP1 off.',
    'PB3 - LAMP3 on, LAMP2 off.',
    'PB1 again to come round to the start. The timer only re-runs from a dead board.',
  ],
  build(): Circuit {
    const h = new Harness('seq');

    // --- stage 1: BIG1 / LAMP1 ---------------------------------------------
    h.add(['SUPPLY', 'VCC1'], ['PB1', 'COM1']);
    h.add(['PB1', 'NO1'], ['BIG1', 'VCC']); // start
    h.add(['PB2', 'NC1'], ['BIG1', 'COM1'], 'blue'); // hold feed, broken by PB2
    h.add(['BIG1', 'NO1'], ['BIG1', 'VCC'], 'blue'); // self-hold
    h.add(['BIG1', 'GND'], ['SUPPLY', 'GND1'], 'black');
    h.add(['BIG1', 'VCC'], ['LAMP1', 'VCC']);
    h.add(['LAMP1', 'GND'], ['SUPPLY', 'GND2'], 'black');

    // --- stage 2: RLY1+RLY2 / LAMP2 ----------------------------------------
    h.add(['SUPPLY', 'VCC3'], ['PB2', 'COM1']);
    h.add(['PB2', 'NO1'], ['RLY1', 'VCC']); // start
    h.add(['PB3', 'NC1'], ['RLY1', 'COM1'], 'blue'); // hold feed, broken by PB3
    h.add(['RLY1', 'NO1'], ['RLY1', 'VCC'], 'blue'); // self-hold
    h.add(['RLY1', 'VCC'], ['RLY2', 'VCC'], 'green'); // coils in parallel
    h.add(['RLY1', 'GND'], ['SUPPLY', 'GND3'], 'black');
    h.add(['RLY2', 'GND'], ['SUPPLY', 'GND4'], 'black');
    h.add(['RLY1', 'VCC'], ['LAMP2', 'VCC']);
    h.add(['LAMP2', 'GND'], ['SUPPLY', 'GND6'], 'black');

    // --- stage 3: RLY3+RLY4 / LAMP3 ----------------------------------------
    h.add(['SUPPLY', 'VCC5'], ['PB3', 'COM1']);
    h.add(['PB3', 'NO1'], ['RLY3', 'VCC']); // start
    h.add(['SUPPLY', 'VCC6'], ['BIG1', 'COM2'], 'blue'); // hold feed, broken by stage 1
    h.add(['BIG1', 'NC2'], ['RLY3', 'COM1'], 'blue');
    h.add(['RLY3', 'NO1'], ['RLY3', 'VCC'], 'blue'); // self-hold
    h.add(['RLY3', 'VCC'], ['RLY4', 'VCC'], 'green'); // coils in parallel
    h.add(['RLY3', 'GND'], ['SUPPLY', 'GND7'], 'black');
    h.add(['RLY4', 'GND'], ['SUPPLY', 'GND5'], 'black');
    h.add(['RLY3', 'VCC'], ['LAMP3', 'VCC']);
    h.add(['LAMP3', 'GND'], ['SUPPLY', 'GND8'], 'black');

    // --- the start-up timer -------------------------------------------------
    // Coil live only while all three stages are dropped.
    h.add(['SUPPLY', 'VCC7'], ['BIG1', 'COM3'], 'yellow');
    h.add(['BIG1', 'NC3'], ['RLY2', 'COM1'], 'yellow');
    h.add(['RLY2', 'NC1'], ['RLY4', 'COM1'], 'yellow');
    h.add(['RLY4', 'NC1'], ['TMR1', 'VCC'], 'yellow');
    h.add(['TMR1', 'GND'], ['SUPPLY', 'GND9'], 'black');
    // Timed-out output into stage 1, through stage 1's own NC contact.
    h.add(['TMR1', 'COM1'], ['BIG1', 'COM4'], 'yellow');
    h.add(['BIG1', 'NC4'], ['BIG1', 'VCC'], 'yellow');

    return {
      modules: layout(
        ['BREAKER', 'SUPPLY', 'PB1', 'PB2', 'PB3', 'LAMP1', 'LAMP2', 'LAMP3', 'RLY1', 'RLY2', 'RLY3', 'RLY4', 'BIG1', 'TMR1'],
        // A short set point, so the start-up step does not hold the class up.
        (m) => (m.id === 'TMR1' ? { ...m, delaySec: 3 } : m),
      ),
      wires: h.done(),
    };
  },
};

/** Every preset the bench can load, in the order they are offered. */
export const PRESETS: readonly Preset[] = [SEQUENCE_PRESET];

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
