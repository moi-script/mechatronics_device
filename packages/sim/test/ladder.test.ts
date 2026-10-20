import test from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../src/index';
import type { LadderRung } from '../src/index';

const c = (addr: string, nc = false) => ({ addr, ...(nc ? { nc } : {}) });
const rung = (branches: ReturnType<typeof c>[][], addr: string, kind: LadderRung['coil']['kind'] = 'OUT'): LadderRung => ({
  branches,
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
  const off = Object.fromEntries(['Q00', 'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07'].map((q) => [q, false]));
  assert.deepEqual(scan(null, {}), off);
  assert.deepEqual(scan([{}], {}), off);
  assert.deepEqual(scan([{ branches: [[{ addr: 'X9' }]], coil: { addr: 'I03', kind: 'OUT' } }], { X9: true }), off);
});
