import test from 'node:test';
import assert from 'node:assert/strict';
import { step, emptyState, devicesOn, plcBits } from '../src/index';
import type { Circuit, EndRef, Inputs, LadderRung, Wire } from '../src/index';

const t = (moduleId: string, pinId: string): EndRef => ({ kind: 'terminal', moduleId, pinId });

let n = 0;
const wire = (a: EndRef, b: EndRef): Wire => ({ id: `w${++n}`, color: 'red', a, b });

const selfHold: LadderRung[] = [
  {
    branches: [
      [{ addr: 'I00' }, { addr: 'I01', nc: true }],
      [{ addr: 'Q00' }, { addr: 'I01', nc: true }],
    ],
    coil: { addr: 'Q00', kind: 'OUT' },
  },
];

const ground = wire(t('PSU1', 'N1'), t('PLC1', 'G1'));
const baseWires = (): Wire[] => [
  wire(t('PSU1', 'P1'), t('PLC1', 'V1')),
  ground,
  wire(t('PSU1', 'P2'), t('PLC1', 'COM')),
  wire(t('PSU1', 'P3'), t('PBU1', 'B1_13')),
  wire(t('PBU1', 'B1_14'), t('PLC1', 'I00')),
  wire(t('PSU1', 'P4'), t('PBU1', 'B2_13')),
  wire(t('PBU1', 'B2_14'), t('PLC1', 'I01')),
  wire(t('PLC1', 'Q00'), t('PBU1', 'B3_X1')),
  wire(t('PBU1', 'B3_X2'), t('PSU1', 'N2')),
];

const circuit = (ladder: LadderRung[] = selfHold, wires: Wire[] = baseWires()): Circuit => ({
  modules: [
    { id: 'PSU1', type: 'FT_PSU', x: 0, y: 0 },
    { id: 'PBU1', type: 'FT_PBU', x: 0, y: 0 },
    { id: 'PLC1', type: 'FT_PLC', x: 0, y: 0, ladder },
  ],
  wires,
});

const RUN = { PLC1: true };
const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: RUN,
  now: 0,
  ...over,
});

test('in RUN, the start button lights the lamp and it stays on', () => {
  const c = circuit();
  const on = step(c, inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  assert.equal(on.coils['PBU1.L3'], true);
  const held = step(c, inputs(), on.state);
  assert.equal(held.coils['PBU1.L3'], true);
  const off = step(c, inputs({ pressed: { 'PBU1.B2': true } }), held.state);
  assert.equal(off.coils['PBU1.L3'], false);
});

test('in STOP, or without power, nothing switches', () => {
  const pressed = { 'PBU1.B1': true };
  assert.equal(step(circuit(), inputs({ pressed, toggled: {} }), emptyState()).coils['PBU1.L3'], false);
  const unpowered = circuit(selfHold, baseWires().filter((w) => w.id !== ground.id));
  assert.equal(step(unpowered, inputs({ pressed }), emptyState()).coils['PBU1.L3'], false);
});

test('a short clears the latched output', () => {
  const on = step(circuit(), inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  assert.equal(on.state.plc?.['PLC1.Q00'], true);
  const shorted = circuit(selfHold, [...baseWires(), wire(t('PSU1', 'P1'), t('PSU1', 'N1'))]);
  const r = step(shorted, inputs(), on.state);
  assert.equal(r.faulted, true);
  assert.deepEqual(r.state.plc, {});
});

test('an output fed back to an input settles', () => {
  const ladder: LadderRung[] = [...selfHold, { branches: [[{ addr: 'I05' }]], coil: { addr: 'Q01', kind: 'OUT' } }];
  const c = circuit(ladder, [...baseWires(), wire(t('PLC1', 'Q00'), t('PLC1', 'I05'))]);
  const r = step(c, inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  assert.equal(r.actuated['PLC1.Q01'], true);
  assert.deepEqual(r.errors, []);
});

test('devicesOn names the button wired to I00', () => {
  const c = circuit();
  const r = step(c, inputs(), emptyState());
  assert.ok(devicesOn(c, r, 'PLC1', 'I00').some((s) => s.includes('B1') && s.includes('14')));
  assert.deepEqual(devicesOn(c, r, 'PLC1', 'I07'), []);
});

test('plcBits reports a pressed input and a live output', () => {
  const c = circuit();
  const r = step(c, inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  const bits = plcBits(c, r, 'PLC1');
  assert.equal(bits.I00, true);
  assert.equal(bits.Q00, true);
});

test('a PLC timer runs on the wall clock and says when it is due', () => {
  const ladder: LadderRung[] = [
    { branches: [[{ addr: 'I00' }]], coil: { addr: 'T0', kind: 'TON', presetSec: 2 } },
    { branches: [[{ addr: 'T0' }]], coil: { addr: 'Q00', kind: 'OUT' } },
  ];
  const c = circuit(ladder);
  const pressed = { 'PBU1.B1': true };
  const a = step(c, inputs({ pressed, now: 1000 }), emptyState());
  assert.equal(a.state.timerStart['PLC1.T0'], 1000);
  assert.equal(a.nextTickMs, 2000);
  assert.equal(a.coils['PBU1.L3'], false);
  const b = step(c, inputs({ pressed, now: 3000 }), a.state);
  assert.equal(b.coils['PBU1.L3'], true);
});
