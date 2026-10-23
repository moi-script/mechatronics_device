import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLadder, PLC_COILS, scan } from '../src/index';
import type { LadderRung } from '../src/index';

const c = (addr: string, nc = false) => ({ addr, ...(nc ? { nc } : {}) });
// One parallel group of the given branches, then the coil.
const rung = (branches: ReturnType<typeof c>[][], addr: string, kind: LadderRung['coil']['kind'] = 'OUT'): LadderRung => ({
  blocks: [branches],
  coil: { addr, kind },
});

test('AND, OR and NC contacts', () => {
  const ladder = [rung([[c('I00'), c('I01', true)], [c('I02')]], 'Q00')];
  assert.equal(scan(ladder, { I00: true }).Q00, true);
  assert.equal(scan(ladder, { I00: true, I01: true }).Q00, false);
  assert.equal(scan(ladder, { I02: true }).Q00, true);
});

test('a self-hold keeps the output on after the start button is released', () => {
  const ladder = [rung([[c('I00'), c('I01', true)], [c('Q00'), c('I01', true)]], 'Q00')];
  assert.equal(scan(ladder, { I00: true }).Q00, true);
  assert.equal(scan(ladder, { Q00: true }).Q00, true);
  assert.equal(scan(ladder, { Q00: true, I01: true }).Q00, false);
});

test('a parallel group anywhere in the rung: start and seal-in, then the stop in series', () => {
  const startStop: LadderRung = { blocks: [[[c('I00')], [c('Q00')]], [[c('I01', true)]]], coil: { addr: 'Q00', kind: 'OUT' } };
  assert.equal(scan([startStop], {}).Q00, false);
  assert.equal(scan([startStop], { I00: true }).Q00, true);
  assert.equal(scan([startStop], { Q00: true }).Q00, true);
  assert.equal(scan([startStop], { Q00: true, I01: true }).Q00, false);
  // NC first, then a parallel group: the second rung of the picture.
  const middle: LadderRung = { blocks: [[[c('I02', true)]], [[c('I03')], [c('I04')]]], coil: { addr: 'Q01', kind: 'OUT' } };
  assert.equal(scan([middle], { I04: true }).Q01, true);
  assert.equal(scan([middle], { I02: true, I04: true }).Q01, false);
  assert.equal(scan([middle], {}).Q01, false);
});

test('internal relays M hold state and drive the rungs below them', () => {
  const ladder: LadderRung[] = [
    { blocks: [[[c('I00')], [c('M00')]], [[c('I01', true)]]], coil: { addr: 'M00', kind: 'OUT' } },
    { blocks: [[[c('M00')]]], coil: { addr: 'Q00', kind: 'OUT' } },
  ];
  const on = scan(ladder, { I00: true });
  assert.equal(on.M00, true);
  assert.equal(on.Q00, true);
  const held = scan(ladder, { M00: on.M00 });
  assert.equal(held.Q00, true);
  assert.equal(scan(ladder, { M00: true, I01: true }).Q00, false);
});

test('a rung saved as branches, before blocks, still runs and loads as one parallel group', () => {
  const old = [{ branches: [[{ addr: 'I00' }], [{ addr: 'I01' }]], coil: { addr: 'Q00', kind: 'OUT' } }];
  assert.equal(scan(old, { I01: true }).Q00, true);
  assert.deepEqual(cleanLadder(old), [{ blocks: [[[{ addr: 'I00' }], [{ addr: 'I01' }]]], coil: { addr: 'Q00', kind: 'OUT' } }]);
});

test('SET latches and RST clears', () => {
  const ladder = [rung([[c('I00')]], 'Q01', 'SET'), rung([[c('I01')]], 'Q01', 'RST')];
  assert.equal(scan(ladder, { I00: true }).Q01, true);
  assert.equal(scan(ladder, { Q01: true }).Q01, true);
  assert.equal(scan(ladder, { Q01: true, I01: true }).Q01, false);
});

test('a lower rung sees the coil above it, and the last write wins', () => {
  const ladder = [rung([[c('I00')]], 'Q00'), rung([[c('Q00')]], 'Q01'), rung([[c('I01')]], 'Q00')];
  const q = scan(ladder, { I00: true });
  assert.equal(q.Q01, true);
  assert.equal(q.Q00, false);
});

test('junk never throws and reads as off', () => {
  const off = Object.fromEntries(PLC_COILS.map((q) => [q, false]));
  assert.deepEqual(scan(null, {}), off);
  assert.deepEqual(scan([{}], {}), off);
  assert.deepEqual(scan([{ branches: [[{ addr: 'X9' }]], coil: { addr: 'I03', kind: 'OUT' } }], { X9: true }), off);
});

test('a TON makes its bit after the preset and drops it when unpowered', () => {
  const ladder = [
    { branches: [[c('I00')]], coil: { addr: 'T0', kind: 'TON' as const, presetSec: 2 } },
    rung([[c('T0')]], 'Q00'),
  ];
  const clock = { now: 0, start: {} as Record<string, number> };
  assert.equal(scan(ladder, { I00: true }, clock).Q00, false);
  assert.equal(clock.start.T0, 0);
  assert.equal(scan(ladder, { I00: true }, { ...clock, now: 1999 }).Q00, false);
  assert.equal(scan(ladder, { I00: true }, { ...clock, now: 2000 }).Q00, true);
  const released = { now: 2500, start: { ...clock.start } };
  assert.equal(scan(ladder, {}, released).Q00, false);
  assert.equal(released.start.T0, undefined);
});

test('cleanLadder keeps good rungs and drops junk a file could carry', () => {
  assert.equal(cleanLadder('x'), undefined);
  const good = rung([[c('I00'), c('I01', true)]], 'Q00');
  assert.deepEqual(cleanLadder([{ coil: 'x' }, good, { branches: [[{ addr: 'Q00' }, 7]], coil: { addr: 'Q01', kind: 'BAD' } }]), [good]);
  // Junk contacts, then empty branches and blocks, fall away; a rung left with only its coil stays to be filled in.
  assert.deepEqual(cleanLadder([{ blocks: [[[{ addr: 'I00' }, 7], []], [[]]], coil: { addr: 'T0', kind: 'TON', presetSec: 'x' } }]), [
    { blocks: [[[{ addr: 'I00' }]]], coil: { addr: 'T0', kind: 'TON' } },
  ]);
  assert.deepEqual(cleanLadder([{ coil: { addr: 'Q00', kind: 'OUT' } }]), [{ blocks: [], coil: { addr: 'Q00', kind: 'OUT' } }]);
});
