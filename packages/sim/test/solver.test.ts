import test from 'node:test';
import assert from 'node:assert/strict';
import { benchInventory, defaultModules, emptyCircuit, spareModules, step, canConnect, emptyState, timerDelayMs } from '../src/index';
import type { Circuit, EndRef, Inputs, Wire } from '../src/index';

const t = (moduleId: string, pinId: string): EndRef => ({ kind: 'terminal', moduleId, pinId });

let n = 0;
const wire = (a: EndRef, b: EndRef): Wire => ({ id: `w${++n}`, color: 'red', a, b });

// Tests wire up the whole bench; the board itself starts with only the
// essentials down and the rest waiting in the parts bin.
const board = (...wires: Wire[]): Circuit => ({ modules: benchInventory(), wires });

const T0 = 1_000_000;

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: {},
  now: T0,
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

test('a timer feeds its COM through only after its set point has run out', () => {
  const c = board(
    wire(t('SUPPLY', 'VCC1'), t('SW1', 'COM1')),
    wire(t('SW1', 'NO1'), t('TMR1', 'VCC')),
    wire(t('TMR1', 'GND'), t('SUPPLY', 'GND1')),
    wire(t('TMR1', 'COM1'), t('LAMP1', 'VCC')),
    wire(t('LAMP1', 'GND'), t('SUPPLY', 'GND1')),
  );
  const delayMs = timerDelayMs(c.modules.find((m) => m.id === 'TMR1')!);
  const on = { toggled: { SW1: true } };

  const idle = run(c, inputs());
  assert.equal(idle.timers.TMR1.running, false);
  assert.equal(idle.nextTickMs, null);

  // Coil live: counting, contact still open.
  const started = step(c, inputs(on), emptyState());
  assert.equal(started.devices.TMR1.energized, true);
  assert.equal(started.devices.LAMP1.energized, false);
  assert.equal(started.timers.TMR1.running, true);
  assert.equal(started.nextTickMs, delayMs);

  // Part way through it is still open, and the countdown has moved on.
  const midway = step(c, inputs({ ...on, now: T0 + delayMs - 500 }), started.state);
  assert.equal(midway.devices.LAMP1.energized, false);
  assert.equal(midway.timers.TMR1.remainingMs, 500);

  // Set point reached: COM is fed.
  const timedOut = step(c, inputs({ ...on, now: T0 + delayMs }), midway.state);
  assert.equal(timedOut.devices.TMR1.actuated, true);
  assert.equal(timedOut.devices.LAMP1.energized, true);
  assert.equal(timedOut.nextTickMs, null);

  // Dropping the coil drops the contact and loses the count.
  const dropped = step(c, inputs({ now: T0 + delayMs + 10 }), timedOut.state);
  assert.equal(dropped.devices.LAMP1.energized, false);
  assert.deepEqual(dropped.state.timerStart, {});

  // Re-energizing starts a fresh count rather than resuming the old one.
  const again = step(c, inputs({ ...on, now: T0 + delayMs + 20 }), dropped.state);
  assert.equal(again.devices.LAMP1.energized, false);
  assert.equal(again.timers.TMR1.remainingMs, delayMs);
});

test('the timer set point is dialled per module', () => {
  const c: Circuit = {
    modules: benchInventory().map((m) => (m.id === 'TMR1' ? { ...m, delaySec: 2 } : m)),
    wires: [
      wire(t('SUPPLY', 'VCC1'), t('TMR1', 'VCC')),
      wire(t('TMR1', 'GND'), t('SUPPLY', 'GND1')),
      wire(t('TMR1', 'COM1'), t('LAMP1', 'VCC')),
      wire(t('LAMP1', 'GND'), t('SUPPLY', 'GND1')),
    ],
  };
  const started = step(c, inputs(), emptyState());
  assert.equal(started.timers.TMR1.delayMs, 2000);
  assert.equal(step(c, inputs({ now: T0 + 1999 }), started.state).devices.LAMP1.energized, false);
  assert.equal(step(c, inputs({ now: T0 + 2000 }), started.state).devices.LAMP1.energized, true);
});

test('a cylinder extends on one solenoid, retracts on the other, and holds between', () => {
  // Both solenoids run off the solenoid block, switched by a button each.
  const c = board(
    wire(t('SOL1', 'VCC1'), t('PB1', 'COM1')),
    wire(t('PB1', 'NO1'), t('CYL1', 'EXT')),
    wire(t('SOL1', 'VCC2'), t('PB2', 'COM1')),
    wire(t('PB2', 'NO1'), t('CYL1', 'RET')),
    wire(t('CYL1', 'GND'), t('SOL1', 'GND1')),
  );

  const idle = run(c, inputs());
  assert.equal(idle.pistons.CYL1.extended, false);

  const out = step(c, inputs({ pressed: { PB1: true } }), emptyState());
  assert.equal(out.pistons.CYL1.extendCoil, true);
  assert.equal(out.pistons.CYL1.extended, true);

  // Solenoid released: the valve holds, so the rod stays out.
  const held = step(c, inputs(), out.state);
  assert.equal(held.pistons.CYL1.extendCoil, false);
  assert.equal(held.pistons.CYL1.extended, true, 'rod should hold its position');

  const back = step(c, inputs({ pressed: { PB2: true } }), held.state);
  assert.equal(back.pistons.CYL1.extended, false);

  // Both coils fed at once stalls the valve and the rod keeps its position.
  const stalled = step(c, inputs({ pressed: { PB1: true, PB2: true } }), back.state);
  assert.equal(stalled.pistons.CYL1.stalled, true);
  assert.equal(stalled.pistons.CYL1.extended, false);
});

test('the board starts with only the essentials down, the rest in the bin', () => {
  const start = emptyCircuit();
  assert.deepEqual(
    start.modules.map((m) => m.id),
    ['BREAKER', 'SUPPLY'],
  );
  assert.equal(defaultModules().length + spareModules(start).length, benchInventory().length);
  assert.ok(spareModules(start).some((m) => m.id === 'PB1'));
  assert.equal(spareModules({ modules: benchInventory(), wires: [] }).length, 0);
});

test('Festech: a push-button unit NO contact feeds a relay-unit coil, which throws all four changeovers', () => {
  const c = board(
    wire(t('PSU1', 'P1'), t('PBU1', 'V1')),
    wire(t('PBU1', 'V5'), t('PBU1', 'B1_13')),
    wire(t('PBU1', 'B1_14'), t('RU1', 'R2_A1')),
    wire(t('RU1', 'R2_A2'), t('PSU1', 'N1')),
  );
  assert.equal(run(c, inputs()).actuated['RU1.R2'], false);
  const r = run(c, inputs({ pressed: { 'PBU1.B1': true } }));
  assert.equal(r.actuated['RU1.R2'], true);
  assert.equal(r.pinNet['RU1.R2_11'], r.pinNet['RU1.R2_14']);
});

test('Festech: a 5/2 single-solenoid valve drives a cylinder out and the front reed sensor follows a stroke later', () => {
  const tube = (a: EndRef, b: EndRef): Wire => ({ ...wire(a, b), kind: 'tube', color: 'blue' });
  const c = board(
    tube(t('AIR1', 'O1'), t('V52S1', 'A1')),
    tube(t('V52S1', 'A4'), t('PCYL1', 'A')),
    tube(t('V52S1', 'A2'), t('PCYL1', 'B')),
    wire(t('PSU1', 'P1'), t('V52S1', 'Y_P')),
    wire(t('V52S1', 'Y_N'), t('PSU1', 'N1')),
  );
  const first = run(c, inputs());
  assert.equal(first.pistons.PCYL1.extended, true);
  assert.equal(first.actuated['PCYL1.EXT'], false);
  assert.equal(first.nextTickMs, 700);
  const later = step(c, inputs({ now: T0 + 700 }), first.state);
  assert.equal(later.actuated['PCYL1.EXT'], true);
});

test('air tubing only fits air ports', () => {
  const c = board();
  assert.equal(canConnect(c, 'x', 'A', t('PSU1', 'P1'), 'tube').ok, false);
  assert.equal(canConnect(c, 'x', 'A', t('PCYL1', 'A'), 'lead').ok, false);
  assert.equal(canConnect(c, 'x', 'A', t('PCYL1', 'A'), 'tube').ok, true);
});

test('Festech: a single-acting cylinder extends on air through a 3/2 valve and springs home when it vents', () => {
  const tube = (a: EndRef, b: EndRef): Wire => ({ ...wire(a, b), kind: 'tube', color: 'blue' });
  const c = board(
    tube(t('AIR1', 'O2'), t('V32N1', 'A1')),
    tube(t('V32N1', 'A2'), t('SCYL2', 'A')),
    wire(t('PSU1', 'P1'), t('V32N1', 'Y_P')),
    wire(t('V32N1', 'Y_N'), t('PSU1', 'N1')),
  );
  const out = run(c, inputs());
  assert.equal(out.pistons.SCYL2.extended, true);
  const home = step(c, inputs({ breakerClosed: false, now: T0 + 700 }), out.state);
  assert.equal(home.pistons.SCYL2.extended, false);
});

test('the timer relay holds COM on NC for its set point, then throws all four lines to NO', () => {
  const c = board(wire(t('SUPPLY', 'VCC1'), t('TRLY1', 'VCC')), wire(t('TRLY1', 'GND'), t('SUPPLY', 'GND1')));
  const delay = timerDelayMs(c.modules.find((m) => m.id === 'TRLY1')!);
  let r = run(c, inputs());
  assert.equal(r.pinNet['TRLY1.COM3'], r.pinNet['TRLY1.NC3']);
  assert.equal(r.nextTickMs, delay);
  r = step(c, inputs({ now: T0 + delay - 1 }), r.state);
  assert.equal(r.devices.TRLY1.actuated, false);
  r = step(c, inputs({ now: T0 + delay }), r.state);
  for (const line of [1, 2, 3, 4]) assert.equal(r.pinNet[`TRLY1.COM${line}`], r.pinNet[`TRLY1.NO${line}`]);
  r = step(c, inputs({ now: T0 + delay + 10, breakerClosed: false }), r.state);
  assert.equal(r.pinNet['TRLY1.COM1'], r.pinNet['TRLY1.NC1']);
});
