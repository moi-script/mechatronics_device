import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCircuit, step, canConnect, emptyState } from '../src/index';
import type { Circuit, EndRef, Inputs, Wire } from '../src/index';

const t = (moduleId: string, pinId: string): EndRef => ({ kind: 'terminal', moduleId, pinId });

let n = 0;
const wire = (a: EndRef, b: EndRef): Wire => ({ id: `w${++n}`, color: 'red', a, b });

const board = (...wires: Wire[]): Circuit => ({ ...emptyCircuit(), wires });

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: {},
  ...over,
});

const run = (c: Circuit, i: Inputs) => step(c, i, emptyState());

test('a lamp across the supply lights, and goes dark when the breaker opens', () => {
  const c = board(wire(t('SUPPLY', 'VCC1'), t('LAMP1', 'VCC')), wire(t('SUPPLY', 'GND1'), t('LAMP1', 'GND')));
  assert.equal(run(c, inputs()).devices.LAMP1.energized, true);
  assert.equal(run(c, inputs({ breakerClosed: false })).devices.LAMP1.energized, false);
});

test('supply tied straight to ground is a short circuit', () => {
  const r = run(board(wire(t('SUPPLY', 'VCC1'), t('SUPPLY', 'GND1'))), inputs());
  assert.equal(r.faulted, true);
  assert.equal(r.errors[0].code, 'SHORT_CIRCUIT');
});

test('a lamp wired backwards reports reversed polarity and stays dark', () => {
  const c = board(wire(t('SUPPLY', 'GND1'), t('LAMP1', 'VCC')), wire(t('SUPPLY', 'VCC1'), t('LAMP1', 'GND')));
  const r = run(c, inputs());
  assert.equal(r.devices.LAMP1.energized, false);
  assert.ok(r.errors.some((e) => e.code === 'REVERSED_POLARITY' && e.moduleId === 'LAMP1'));
});

test('a relay holds itself in through its own NO contact after the button is released', () => {
  const c = board(
    wire(t('SUPPLY', 'VCC1'), t('PB1', 'COM1')),
    wire(t('PB1', 'NO1'), t('RLY1', 'VCC')),
    wire(t('RLY1', 'GND'), t('SUPPLY', 'GND1')),
    wire(t('SUPPLY', 'VCC1'), t('RLY1', 'COM1')),
    wire(t('RLY1', 'NO1'), t('RLY1', 'VCC')),
  );
  let s = emptyState();
  assert.equal(step(c, inputs(), s).devices.RLY1.energized, false);

  const pressed = step(c, inputs({ pressed: { PB1: true } }), s);
  assert.equal(pressed.devices.RLY1.energized, true);

  const released = step(c, inputs(), pressed.state);
  assert.equal(released.devices.RLY1.energized, true, 'latch should hold');
});

test('a male connector already carrying a lead refuses a second one', () => {
  const w1 = wire(t('SUPPLY', 'VCC1'), t('LAMP1', 'VCC'));
  const w2: Wire = { id: 'w-stacked', color: 'blue', a: { kind: 'stack', wireId: w1.id, end: 'A' }, b: t('LAMP2', 'VCC') };
  const c = board(w1, w2);
  const taken = canConnect(c, 'w-third', 'A', { kind: 'stack', wireId: w1.id, end: 'A' });
  assert.equal(taken.ok, false);
  const free = canConnect(c, 'w-third', 'A', { kind: 'stack', wireId: w2.id, end: 'A' });
  assert.equal(free.ok, true);
});
