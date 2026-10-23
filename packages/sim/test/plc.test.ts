import test from 'node:test';
import assert from 'node:assert/strict';
import { step, emptyState, devicesOn, partsOn, plcBits, presetById } from '../src/index';
import type { Circuit, EndRef, Inputs, LadderRung, Wire } from '../src/index';

const t = (moduleId: string, pinId: string): EndRef => ({ kind: 'terminal', moduleId, pinId });

let n = 0;
const wire = (a: EndRef, b: EndRef): Wire => ({ id: `w${++n}`, color: 'red', a, b });

const selfHold: LadderRung[] = [
  {
    blocks: [[[{ addr: 'I00' }], [{ addr: 'Q00' }]], [[{ addr: 'I01', nc: true }]]],
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
  const ladder: LadderRung[] = [...selfHold, { blocks: [[[{ addr: 'I05' }]]], coil: { addr: 'Q01', kind: 'OUT' } }];
  const c = circuit(ladder, [...baseWires(), wire(t('PLC1', 'Q00'), t('PLC1', 'I05'))]);
  const r = step(c, inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  assert.equal(r.actuated['PLC1.Q01'], true);
  assert.deepEqual(r.errors, []);
});

test('devicesOn names the button wired to I00', () => {
  const c = circuit();
  assert.ok(devicesOn(c, 'PLC1', 'I00').some((s) => s.includes('B1') && s.includes('14')));
  assert.deepEqual(devicesOn(c, 'PLC1', 'I07'), []);
});

test('partsOn says how each device is wired: NO or NC contact in, and what a relay switches out', () => {
  const c = circuit(selfHold, [
    ...baseWires(),
    wire(t('PBU1', 'B3_31'), t('PLC1', 'I02')),
    wire(t('PLC1', 'Q01'), t('RLY1', 'VCC')),
    wire(t('RLY1', 'NC1'), t('LAMP1', 'VCC')),
  ]);
  c.modules.push({ id: 'RLY1', type: 'RELAY', x: 0, y: 0 }, { id: 'LAMP1', type: 'LAMP', x: 0, y: 0 });
  assert.equal(partsOn(c, 'PLC1', 'I00')[0].contact, 'NO');
  assert.equal(partsOn(c, 'PLC1', 'I02')[0].contact, 'NC');
  assert.deepEqual(partsOn(c, 'PLC1', 'Q01')[0], {
    label: 'Relay 1 VCC',
    moduleId: 'RLY1',
    type: 'RELAY',
    switches: [{ kind: 'NC', loads: ['Lamp 1'] }],
  });
});

test('devicesOn still names the lamp on Q00 once the output relay closes onto the supply', () => {
  const c = circuit();
  const r = step(c, inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  assert.equal(r.actuated['PLC1.Q00'], true);
  assert.deepEqual(devicesOn(c, 'PLC1', 'Q00'), ['Push-Button Unit 1 B3 X1']);
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
    { blocks: [[[{ addr: 'I00' }]]], coil: { addr: 'T0', kind: 'TON', presetSec: 2 } },
    { blocks: [[[{ addr: 'T0' }]]], coil: { addr: 'Q00', kind: 'OUT' } },
  ];
  const c = circuit(ladder);
  const pressed = { 'PBU1.B1': true };
  const a = step(c, inputs({ pressed, now: 1000 }), emptyState());
  assert.equal(a.state.timerStart['PLC1.T0'], 1000);
  assert.equal(a.nextTickMs, 2000);
  assert.equal(a.coils['PBU1.L3'], false);
  // The live ladder reads the timer's done bit: off while counting, on once due.
  assert.equal(plcBits(c, a, 'PLC1').T0, false);
  const b = step(c, inputs({ pressed, now: 3000 }), a.state);
  assert.equal(b.coils['PBU1.L3'], true);
  assert.equal(plcBits(c, b, 'PLC1').T0, true);
});

test('an output that holds itself through a relay stays on after the start button is released', () => {
  const ladder: LadderRung[] = [
    { blocks: [[[{ addr: 'I00' }], [{ addr: 'I05' }]]], coil: { addr: 'Q00', kind: 'OUT' } },
  ];
  const c: Circuit = {
    ...circuit(ladder, [
      ...baseWires(),
      wire(t('PLC1', 'Q00'), t('RU1', 'R1_A1')),
      wire(t('RU1', 'R1_A2'), t('PSU1', 'N3')),
      wire(t('PSU1', 'P4'), t('RU1', 'R1_11')),
      wire(t('RU1', 'R1_14'), t('PLC1', 'I05')),
    ]),
  };
  c.modules.push({ id: 'RU1', type: 'FT_RELAY3', x: 0, y: 0 });
  const on = step(c, inputs({ pressed: { 'PBU1.B1': true } }), emptyState());
  assert.equal(on.actuated['PLC1.Q00'], true);
  const held = step(c, inputs(), on.state);
  assert.equal(held.actuated['PLC1.Q00'], true);
  assert.equal(step(c, inputs(), held.state).actuated['PLC1.Q00'], true);
});

test('the two-lamp PLC preset latches each lamp and stops both', () => {
  const c = presetById('plc-two-lamp-latch')!.build();
  const go = (pressed: Record<string, boolean>, prev = emptyState()) => step(c, inputs({ pressed }), prev);
  const a = go({ 'PBU1.B1': true });
  assert.deepEqual([a.coils['PBU1.L1'], a.coils['PBU1.L2']], [true, false]);
  const b = go({}, a.state);
  assert.equal(b.coils['PBU1.L1'], true);
  const d = go({}, go({ 'PBU1.B2': true }, b.state).state);
  assert.deepEqual([d.coils['PBU1.L1'], d.coils['PBU1.L2']], [true, true]);
  const off = go({}, go({ 'PBU1.B3': true }, d.state).state);
  assert.deepEqual([off.coils['PBU1.L1'], off.coils['PBU1.L2']], [false, false]);
  assert.deepEqual(off.errors, []);
});
