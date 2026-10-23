import test from 'node:test';
import assert from 'node:assert/strict';
import { benchInventory, emptyState, step, type Circuit, type LadderRung, type Wire } from '../src/index';

/**
 * A+ A- B+ B- run by the PLC on the pneumatics board, through the expansion
 * addresses (I12-I16, Q08-Q11) and an internal relay that is SET by one rung
 * and RST by another.
 */
function plcSequence(): Circuit {
  const wires: Wire[] = [];
  const end = (t: [string, string]) => ({ kind: 'terminal' as const, moduleId: t[0], pinId: t[1] });
  const lead = (a: [string, string], b: [string, string]) =>
    wires.push({ id: `w${wires.length}`, color: 'red', a: end(a), b: end(b) });
  const tube = (a: [string, string], b: [string, string]) =>
    wires.push({ id: `w${wires.length}`, color: 'blue', kind: 'tube', a: end(a), b: end(b) });

  lead(['PSU1', 'P1'], ['PBU1', 'V1']);
  lead(['PSU1', 'N1'], ['PBU1', 'G1']);
  lead(['PSU1', 'P2'], ['PLC1', 'V1']);
  lead(['PSU1', 'N2'], ['PLC1', 'G1']);
  lead(['PLC1', 'V2'], ['PLC1', 'COM']);
  lead(['PBU1', 'V2'], ['PBU1', 'B1_13']);
  lead(['PBU1', 'B1_14'], ['PLC1', 'I12']); // start
  lead(['PBU1', 'V3'], ['LS_A1', 'COM']);
  lead(['LS_A1', 'NO'], ['PLC1', 'I13']); // a1
  lead(['PBU1', 'V4'], ['LS_B1', 'COM']);
  lead(['LS_B1', 'NO'], ['PLC1', 'I14']); // b1
  lead(['PBU1', 'V5'], ['CYL_A', 'S1_P']);
  lead(['CYL_A', 'S1_O'], ['PLC1', 'I15']); // A home
  lead(['PSU1', 'P3'], ['CYL_B', 'S1_P']);
  lead(['CYL_B', 'S1_O'], ['PLC1', 'I16']); // B home
  lead(['PLC1', 'Q08'], ['V_A', 'Y14_P']);
  lead(['V_A', 'Y14_N'], ['PBU1', 'G2']);
  lead(['PLC1', 'Q09'], ['V_A', 'Y12_P']);
  lead(['V_A', 'Y12_N'], ['PBU1', 'G3']);
  lead(['PLC1', 'Q10'], ['V_B', 'Y14_P']);
  lead(['V_B', 'Y14_N'], ['PBU1', 'G4']);
  lead(['PLC1', 'Q11'], ['V_B', 'Y12_P']);
  lead(['V_B', 'Y12_N'], ['PBU1', 'G5']);
  tube(['AIR1', 'O1'], ['V_A', 'A1']);
  tube(['V_A', 'A4'], ['CYL_A', 'A']);
  tube(['V_A', 'A2'], ['CYL_A', 'B']);
  tube(['AIR1', 'O2'], ['V_B', 'A1']);
  tube(['V_B', 'A4'], ['CYL_B', 'A']);
  tube(['V_B', 'A2'], ['CYL_B', 'B']);

  const rung = (series: string[], coil: LadderRung['coil']): LadderRung => ({
    blocks: series.map((x) => [[{ addr: x.replace('!', ''), ...(x.startsWith('!') ? { nc: true } : {}) }]]),
    coil,
  });
  const ladder: LadderRung[] = [
    rung(['I12', 'I15', 'I16', '!M00'], { addr: 'Q08', kind: 'OUT' }), // A+
    rung(['I13'], { addr: 'M00', kind: 'SET' }),
    rung(['I13'], { addr: 'Q09', kind: 'OUT' }), // A-
    rung(['M00', 'I15'], { addr: 'Q10', kind: 'OUT' }), // B+
    rung(['I14'], { addr: 'Q11', kind: 'OUT' }), // B-
    rung(['I14'], { addr: 'M00', kind: 'RST' }),
  ];
  return {
    board: 'pneumatics',
    modules: benchInventory('pneumatics').map((m) => (m.id === 'PLC1' ? { ...m, ladder } : m)),
    wires,
  };
}

test('a PLC program runs to the end when the board only re-solves when asked to', () => {
  // The board does not solve on a fixed clock: it solves on a change, then
  // again only when the last solve asks for it (every 100 ms while it does).
  const c = plcSequence();
  const base = { breakerClosed: true, toggled: { PLC1: true } };
  let now = 1_000_000;
  let r = step(c, { ...base, pressed: {}, now }, emptyState());
  const order: string[] = [];
  const rods = () => `A${r.pistons.CYL_A.extended ? '+' : '-'} B${r.pistons.CYL_B.extended ? '+' : '-'}`;
  let last = rods();
  const record = () => {
    if (rods() !== last) order.push(rods());
    last = rods();
  };

  // A tap of button 1: pressed for one solve, released on the next.
  r = step(c, { ...base, pressed: { 'PBU1.B1': true }, now: (now += 100) }, r.state);
  record();
  r = step(c, { ...base, pressed: {}, now: (now += 100) }, r.state);
  record();

  for (let i = 0; i < 200 && r.nextTickMs !== null; i++) {
    r = step(c, { ...base, pressed: {}, now: (now += Math.max(100, r.nextTickMs)) }, r.state);
    record();
  }

  assert.deepEqual(r.errors, []);
  assert.deepEqual(order, ['A+ B-', 'A- B-', 'A- B+', 'A- B-'], 'A+ A- B+ B- in order, ending at rest');
  assert.equal(r.nextTickMs, null, 'once the cycle is over the board goes quiet');
});
