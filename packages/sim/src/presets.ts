import { benchSlot } from './parts';
import type { BoardType, Circuit, EndRef, ModuleInstance, Wire, WireColor } from './types';

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
  /** Which bench it is built on. Absent means the trainer. */
  board?: BoardType;
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

  /** Run air tubing between two fittings. Tubing is blue on the bench. */
  tube(from: [string, string], to: [string, string]): void {
    this.wires.push({
      id: `${this.prefix}-t${this.wires.length + 1}`,
      color: 'blue',
      kind: 'tube',
      a: { kind: 'terminal', moduleId: from[0], pinId: from[1] } as EndRef,
      b: { kind: 'terminal', moduleId: to[0], pinId: to[1] } as EndRef,
    });
  }

  done(): Wire[] {
    return this.wires;
  }
}

/** The bench parts a preset uses, at their slots in the bench layout. */
const layout = (
  ids: string[],
  tweak: (m: ModuleInstance) => ModuleInstance = (m) => m,
  board: BoardType = 'trainer',
): ModuleInstance[] =>
  ids.map((id) => {
    const slot = benchSlot(id, board);
    if (!slot) throw new Error(`No ${board} bench slot for module ${id}`);
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

/**
 * A+ A- B+ B-, on the Festech pneumatic panels, from one press of button 1.
 *
 *   PB1 -> A extends
 *   a1  -> A retracts
 *   a0  -> B extends
 *   b1  -> B retracts, and the board comes back to rest
 *
 * The limit switches are the reed sensors clamped to each barrel: a0 and b0
 * close while their piston sits home, a1 and b1 while it sits out. Nothing
 * else knows where a rod is, so every step but the first is started by one.
 *
 * Both valves are 5/2 double-solenoid, which is what makes a one-press cycle
 * possible: the spool stays where the last pulse put it, so a step only needs
 * a signal long enough to throw it, not held for the whole stroke.
 *
 * The problem the relays solve is a0. It is closed at rest and closed again
 * after A comes home, so on its own it would fire B+ the moment the breaker
 * closed. R2 is the memory that tells the two apart: it picks up on a1, holds
 * itself in, and B+ runs through its contact, so B+ can only happen on the a0
 * that follows an a1.
 *
 *   R2   set by a1, held through R3's NC contact
 *        11-12 NC  breaks A+ once A is out, so both A solenoids are never live
 *        21-24 NO  its own hold
 *        31-34 NO  A-
 *        41-44 NO  arms B+, in series with a0
 *   R3   picked up by b1, not held
 *        11-12 NC  drops R2, which ends the cycle
 *        21-22 NC  breaks B+ before B- fires
 *
 * b1 drives R3 and the B- solenoid together, so the last step needs no memory:
 * B retracts, b1 opens, everything falls away, and the board is back where it
 * started with the spools holding both rods home.
 */
export const PNEUMATIC_SEQUENCE_PRESET: Preset = {
  id: 'pneumatic-a-b-sequence',
  name: 'Pneumatic sequence A+ A- B+ B-',
  summary: 'One press of button 1 runs both cylinders through the full cycle, stepped along by the reed sensors.',
  steps: [
    'Close the breaker. Both rods sit home, held there by the spools at rest.',
    'Press button 1 on the push-button unit: cylinder A extends (A+).',
    "A's front sensor closes, picks up relay R2, and sends A back home (A-).",
    "A's rear sensor closes with R2 still held, so cylinder B extends (B+).",
    "B's front sensor picks up R3, which drops R2 and sends B home (B-). The cycle is over and button 1 starts it again.",
  ],
  build(): Circuit {
    const h = new Harness('pneu');

    // --- power ---------------------------------------------------------------
    // Everything is distributed from the relay unit's two strips, and the
    // button unit is fed from the post at the far end of its own strip: a lead
    // run to the near end would hang across the button faces, and a lead lying
    // over a cap is a lead you have to move before you can press it.
    h.add(['PSU1', 'P1'], ['RU1', 'V1']);
    h.add(['PSU1', 'N1'], ['RU1', 'G1'], 'blue');
    h.add(['RU1', 'V2'], ['PBU1', 'V5']);

    // --- step 1: button 1 extends A -----------------------------------------
    h.add(['PBU1', 'V4'], ['PBU1', 'B1_13']);
    h.add(['PBU1', 'B1_14'], ['RU1', 'R2_12']); // through R2 NC, so A+ drops once A is out
    h.add(['RU1', 'R2_11'], ['V52D1', 'Y14_P']);
    h.add(['V52D1', 'Y14_N'], ['RU1', 'G4'], 'blue');

    // --- step 2: a1 picks up R2, R2 retracts A ------------------------------
    h.add(['RU1', 'V3'], ['PCYL1', 'S2_P']); // a1: A extended
    h.add(['PCYL1', 'S2_O'], ['RU1', 'R2_A1']);
    h.add(['RU1', 'R2_A2'], ['RU1', 'G2'], 'blue');
    h.add(['RU1', 'V4'], ['RU1', 'R3_12'], 'yellow'); // hold feed, broken by R3
    h.add(['RU1', 'R3_11'], ['RU1', 'R2_24'], 'yellow');
    h.add(['RU1', 'R2_21'], ['RU1', 'R2_A1'], 'yellow');
    h.add(['RU1', 'V5'], ['RU1', 'R2_31'], 'green'); // A-
    h.add(['RU1', 'R2_34'], ['V52D1', 'Y12_P'], 'green');
    h.add(['V52D1', 'Y12_N'], ['RU1', 'G5'], 'blue');

    // --- step 3: a0 with R2 still held extends B ----------------------------
    h.add(['RU1', 'V3'], ['PCYL1', 'S1_P']); // a0: A home, stacked on a1's feed
    h.add(['PCYL1', 'S1_O'], ['RU1', 'R2_41'], 'green');
    h.add(['RU1', 'R2_44'], ['RU1', 'R3_22'], 'green'); // through R3 NC, so B+ drops before B-
    h.add(['RU1', 'R3_21'], ['V52D2', 'Y14_P'], 'green');
    h.add(['V52D2', 'Y14_N'], ['PSU1', 'N2'], 'blue');

    // --- step 4: b1 picks up R3, which retracts B and ends the cycle --------
    h.add(['RU1', 'V2'], ['PCYL2', 'S2_P']); // b1: B extended
    h.add(['PCYL2', 'S2_O'], ['RU1', 'R3_A1']);
    h.add(['RU1', 'R3_A2'], ['RU1', 'G3'], 'blue');
    h.add(['PCYL2', 'S2_O'], ['V52D2', 'Y12_P']);
    h.add(['V52D2', 'Y12_N'], ['PSU1', 'N3'], 'blue');

    // --- air: the distributor feeds both valves, each valve its own cylinder -
    // At rest a 5/2 spool feeds 1 to 2, so port 2 goes to the retract side and
    // the rods are held home before anyone touches the bench.
    h.tube(['AIR1', 'O1'], ['V52D1', 'A1']);
    h.tube(['V52D1', 'A4'], ['PCYL1', 'A']);
    h.tube(['V52D1', 'A2'], ['PCYL1', 'B']);
    h.tube(['AIR1', 'O2'], ['V52D2', 'A1']);
    h.tube(['V52D2', 'A4'], ['PCYL2', 'A']);
    h.tube(['V52D2', 'A2'], ['PCYL2', 'B']);

    return {
      modules: layout(
        ['BREAKER', 'PSU1', 'PBU1', 'RU1', 'AIR1', 'V52D1', 'V52D2', 'PCYL1', 'PCYL2'],
        // Nothing from the original trainer row is used, so the breaker comes
        // down to sit above the Festech panels rather than leaving the loaded
        // board with a screen of empty bench between it and everything else.
        (m) => (m.id === 'BREAKER' ? { ...m, x: 40, y: 990 } : m),
      ),
      wires: h.done(),
    };
  },
};

/**
 * The same sequence on the pneumatics board, stepped by real limit switches.
 *
 *   PB1 -> A extends
 *   a1  -> A retracts
 *   a0  -> B extends
 *   b1  -> B retracts, and the board comes back to rest
 *
 * Each switch is bolted to a stroke: a0 sits under the rod of A while it is
 * home, a1 at the far end where it runs into it. That is the difference from
 * the trainer version, which reads the reed sensors clamped to the barrel — a
 * limit switch is a mechanical thing the rod hits, and on this board it is
 * thrown by the rod arriving rather than by anyone pressing it.
 *
 * A changeover contact on each switch is what makes this simpler than the
 * reed-sensor version: one relay does the whole job instead of two.
 *
 *   R1   set by a1, held through b1's NC contact, dropped when B arrives
 *        11-12 NC  in series with the button, so A+ drops once A is out
 *        21-24 NO  its own hold
 *        31-34 NO  arms B+, in series with a0
 *
 * The problem it solves is still a0: closed at rest and closed again after A
 * comes home, so on its own it would send B out the moment the breaker closed.
 * R1 is the memory that tells those two apart.
 */
export const PNEUMATIC_BOARD_SEQUENCE: Preset = {
  id: 'pneumatic-board-a-b-sequence',
  name: 'A+ A- B+ B- on limit switches',
  summary: 'The pneumatics board: one press of button 1, and the rods trip the switches that run the rest.',
  board: 'pneumatics',
  steps: [
    'Close the breaker. Both rods are home, each sitting on its own a0 switch.',
    'Press button 1 on the push-button unit: cylinder A extends (A+).',
    'A runs into a1, which picks up relay R1 and sends A back home (A-).',
    'A settles back onto a0, and with R1 still held that sends cylinder B out (B+).',
    'B runs into b1, which drops R1 and sends B home (B-). The cycle is over and button 1 starts it again.',
  ],
  build(): Circuit {
    const h = new Harness('pneu2');

    // --- power ---------------------------------------------------------------
    h.add(['PSU1', 'P1'], ['RU1', 'V1']);
    h.add(['PSU1', 'N1'], ['RU1', 'G1'], 'blue');
    h.add(['RU1', 'V2'], ['PBU1', 'V5']); // fed from the far end, clear of the buttons

    // --- step 1: button 1 extends A, until a1 drops the command --------------
    h.add(['PBU1', 'V4'], ['PBU1', 'B1_13']);
    h.add(['PBU1', 'B1_14'], ['RU1', 'R1_12']); // R1 NC: open once A is out
    h.add(['RU1', 'R1_11'], ['V_A', 'Y14_P']);
    h.add(['V_A', 'Y14_N'], ['RU1', 'G2'], 'blue');

    // --- step 2: a1 sends A home, and remembers that it went out -------------
    h.add(['RU1', 'V3'], ['LS_A1', 'COM']);
    h.add(['LS_A1', 'NO'], ['V_A', 'Y12_P'], 'green'); // A-
    h.add(['V_A', 'Y12_N'], ['RU1', 'G3'], 'blue');
    h.add(['LS_A1', 'NO'], ['RU1', 'R1_A1'], 'yellow'); // sets R1
    h.add(['RU1', 'R1_A2'], ['RU1', 'G4'], 'blue');
    h.add(['RU1', 'V4'], ['LS_B1', 'COM']);
    h.add(['LS_B1', 'NC'], ['RU1', 'R1_24'], 'yellow'); // hold feed, broken when B arrives
    h.add(['RU1', 'R1_21'], ['RU1', 'R1_A1'], 'yellow');

    // --- step 3: a0 with R1 still held sends B out ---------------------------
    h.add(['RU1', 'V5'], ['LS_A0', 'COM']);
    h.add(['LS_A0', 'NO'], ['RU1', 'R1_31'], 'green');
    h.add(['RU1', 'R1_34'], ['V_B', 'Y14_P'], 'green');
    h.add(['V_B', 'Y14_N'], ['RU1', 'G5'], 'blue');

    // --- step 4: b1 sends B home and drops R1, which ends the cycle ----------
    h.add(['LS_B1', 'NO'], ['V_B', 'Y12_P']);
    h.add(['V_B', 'Y12_N'], ['PSU1', 'N2'], 'blue');

    // --- air: the distributor feeds both valves ------------------------------
    h.tube(['AIR1', 'O1'], ['V_A', 'A1']);
    h.tube(['V_A', 'A4'], ['CYL_A', 'A']);
    h.tube(['V_A', 'A2'], ['CYL_A', 'B']);
    h.tube(['AIR1', 'O2'], ['V_B', 'A1']);
    h.tube(['V_B', 'A4'], ['CYL_B', 'A']);
    h.tube(['V_B', 'A2'], ['CYL_B', 'B']);

    return {
      board: 'pneumatics',
      modules: layout(
        ['BREAKER', 'PSU1', 'AIR1', 'PBU1', 'RU1', 'V_A', 'LS_A0', 'CYL_A', 'LS_A1', 'V_B', 'LS_B0', 'CYL_B', 'LS_B1'],
        (m) => m,
        'pneumatics',
      ),
      wires: h.done(),
    };
  },
};

/**
 * A+, then A- and B+ together, then B-, on two single-acting cylinders.
 *
 *   PB1 -> A extends
 *   a1  -> A retracts and B extends, in the same instant
 *   b1  -> B retracts, and the board comes back to rest
 *
 * Built from the Festech panels only. A single-acting rod sits out only while
 * its 3/2 valve is energized, and the spring brings it home the moment the
 * coil drops, so each rod needs a relay to hold its valve for the stroke:
 *
 *   R1   A's memory: set by button 1, held through R2's NC contact
 *        21-24 NO  its own hold
 *        31-34 NO  the A valve
 *   R2   B's memory: set by a1, held through R3's NC contact
 *        11-12 NC  feeds button 1 and R1's hold, so a1 dropping A is the
 *                  same event as picking B up, and button 1 is dead while
 *                  B is out
 *        21-24 NO  its own hold
 *        31-34 NO  the B valve
 *   R3   picked up by b1, not held
 *        11-12 NC  feeds a1 and R2's hold, so b1 ends the cycle
 *
 * a1 and b1 are the front reed sensors on each barrel. a1 stays made while A
 * is on its way home, which is why R3 has to break a1's feed as well as R2's
 * hold, or R2 could be picked straight back up.
 */
export const SINGLE_ACTING_SEQUENCE_PRESET: Preset = {
  id: 'single-acting-a-ab-b-sequence',
  name: 'Single-acting A+ (A- B+) B-',
  summary: 'Two single-acting cylinders: A out, then A home as B goes out, then B home.',
  steps: [
    'Close the breaker. Both rods sit home on their springs.',
    'Press button 1 on the push-button unit: relay R1 latches and cylinder A extends (A+).',
    "A's front sensor a1 picks up R2, which drops R1 and energizes B's valve: A retracts as B extends (A- B+).",
    "B's front sensor b1 picks up R3, which drops R2: B retracts (B-). The cycle is over and button 1 starts it again.",
  ],
  build(): Circuit {
    const h = new Harness('sact');

    // --- power ---------------------------------------------------------------
    h.add(['PSU1', 'P1'], ['RU1', 'V1']);
    h.add(['PSU1', 'N1'], ['RU1', 'G1'], 'blue');
    h.add(['RU1', 'V2'], ['PBU1', 'V5']);

    // --- step 1: button 1 latches R1, R1 extends A --------------------------
    h.add(['RU1', 'V3'], ['RU1', 'R2_11']); // everything of A's runs through R2 NC
    h.add(['RU1', 'R2_12'], ['PBU1', 'B1_13']);
    h.add(['PBU1', 'B1_14'], ['RU1', 'R1_A1']);
    h.add(['RU1', 'R1_A2'], ['RU1', 'G2'], 'blue');
    h.add(['RU1', 'R2_12'], ['RU1', 'R1_21'], 'yellow'); // hold, broken by R2
    h.add(['RU1', 'R1_24'], ['RU1', 'R1_A1'], 'yellow');
    h.add(['RU1', 'V4'], ['RU1', 'R1_31'], 'green'); // A valve
    h.add(['RU1', 'R1_34'], ['V32N1', 'Y_P'], 'green');
    h.add(['V32N1', 'Y_N'], ['RU1', 'G3'], 'blue');

    // --- step 2: a1 latches R2, which drops A and extends B -----------------
    h.add(['RU1', 'V5'], ['RU1', 'R3_11']); // everything of B's runs through R3 NC
    h.add(['RU1', 'R3_12'], ['SCYL1', 'S2_P']); // a1: A extended
    h.add(['SCYL1', 'S2_O'], ['RU1', 'R2_A1']);
    h.add(['RU1', 'R2_A2'], ['RU1', 'G4'], 'blue');
    h.add(['RU1', 'R3_12'], ['RU1', 'R2_21'], 'yellow'); // hold, broken by R3
    h.add(['RU1', 'R2_24'], ['RU1', 'R2_A1'], 'yellow');
    h.add(['PSU1', 'P2'], ['RU1', 'R2_31'], 'green'); // B valve
    h.add(['RU1', 'R2_34'], ['V32N2', 'Y_P'], 'green');
    h.add(['V32N2', 'Y_N'], ['RU1', 'G5'], 'blue');

    // --- step 3: b1 picks up R3, which drops R2 and sends B home ------------
    h.add(['PSU1', 'P3'], ['SCYL2', 'S2_P']); // b1: B extended
    h.add(['SCYL2', 'S2_O'], ['RU1', 'R3_A1']);
    h.add(['RU1', 'R3_A2'], ['PSU1', 'N2'], 'blue');

    // --- air: the distributor feeds both 3/2 valves, each its own cylinder --
    h.tube(['AIR1', 'O1'], ['V32N1', 'A1']);
    h.tube(['V32N1', 'A2'], ['SCYL1', 'A']);
    h.tube(['AIR1', 'O2'], ['V32N2', 'A1']);
    h.tube(['V32N2', 'A2'], ['SCYL2', 'A']);

    return {
      modules: layout(
        ['BREAKER', 'PSU1', 'PBU1', 'RU1', 'AIR1', 'V32N1', 'V32N2', 'SCYL1', 'SCYL2'],
        (m) => (m.id === 'BREAKER' ? { ...m, x: 40, y: 990 } : m),
      ),
      wires: h.done(),
    };
  },
};

/**
 * Every preset the bench offers. The two pneumatic sequences are built and
 * tested here but not listed: they live in the accounts of the people who use
 * them, and a library that ships a copy of a circuit you already have saved
 * only invites you to load the wrong one.
 */
export const PRESETS: readonly Preset[] = [SEQUENCE_PRESET];

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
