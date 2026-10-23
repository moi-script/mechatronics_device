import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PNEUMATIC_BOARD_SEQUENCE,
  STROKE_MS,
  benchInventory,
  emptyState,
  limitSlot,
  moduleLabel,
  seatLimits,
  step,
} from '../src/index';
import type { Circuit, Inputs, SimResult } from '../src/index';

/**
 * The pneumatics board: cylinders in rows with a limit switch bolted at each
 * end of the stroke. Nobody presses those switches — the rod arriving is what
 * throws them, which is what the whole board exists to show.
 */

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: {},
  now: 0,
  ...over,
});

const rods = (r: SimResult): [boolean, boolean] => [r.pistons.CYL_A.extended, r.pistons.CYL_B.extended];
const circuit = (): Circuit => PNEUMATIC_BOARD_SEQUENCE.build();

test('every cylinder on the pneumatics board has one switch, at the end of its stroke', () => {
  const bench = benchInventory('pneumatics');
  const cylinders = bench.filter((m) => m.type === 'FT_CYL' || m.type === 'FT_SCYL');
  assert.ok(cylinders.length >= 4, 'the board is rows of cylinders');

  for (const cyl of cylinders) {
    const mounted = bench.filter((m) => m.mount?.cylinderId === cyl.id);
    assert.deepEqual(
      mounted.map((m) => m.mount?.at).sort(),
      ['out'],
      `${cyl.id} should have its switch at the far end`,
    );
    // It sits on its fixed seat under the rod path.
    const out = mounted[0];
    assert.deepEqual({ x: out.x, y: out.y }, limitSlot(cyl, 'out'));
    assert.ok(out.y > cyl.y, `${cyl.id}'s switch should sit under its rod`);
  }
});

test('a mounted switch follows its cylinder', () => {
  const bench = benchInventory('pneumatics');
  const moved = seatLimits(bench.map((m) => (m.id === 'CYL_A' ? { ...m, x: m.x + 100, y: m.y + 40 } : m)));
  const cyl = moved.find((m) => m.id === 'CYL_A')!;
  assert.deepEqual(
    (({ x, y }) => ({ x, y }))(moved.find((m) => m.id === 'LS_A1')!),
    limitSlot(cyl, 'out'),
  );
});

test('the switches are named the way the sequence sheet names them', () => {
  const bench = benchInventory('pneumatics');
  const label = (id: string) => moduleLabel(bench.find((m) => m.id === id)!);
  assert.equal(label('LS_A1'), 'Limit switch a1');
  assert.equal(label('CYL_A'), 'Pneumatic Cylinder A');
});

test('a mounted limit switch is thrown by the rod, not by a finger', () => {
  const c = circuit();
  let now = 500_000;
  let r = step(c, inputs({ now }), emptyState());

  // At rest both rods are home, so neither far switch is made. Nothing is
  // pressed: the board says so on its own.
  assert.equal(r.actuated.LS_A1, false);
  assert.equal(r.actuated.LS_B1, false);
  assert.deepEqual(r.errors, []);

  // Pressing a mounted switch by hand does nothing; only the rod moves it.
  r = step(c, inputs({ now, pressed: { LS_A1: true } }), r.state);
  assert.equal(r.actuated.LS_A1, false, 'a hand should not be able to throw a bolted switch');
  assert.deepEqual(rods(r), [false, false]);
});

test('A+ A- B+ B- runs off the limit switches from one press of button 1', () => {
  const c = circuit();
  let now = 500_000;
  let r = step(c, inputs({ now }), emptyState());
  assert.deepEqual(rods(r), [false, false]);
  assert.equal(r.nextTickMs, null);

  const settle = () => {
    now += STROKE_MS;
    r = step(c, inputs({ now }), r.state);
    assert.deepEqual(r.errors, [], 'the cycle should run without a fault');
    return rods(r);
  };

  // A+
  r = step(c, inputs({ now, pressed: { 'PBU1.B1': true } }), r.state);
  assert.deepEqual(rods(r), [true, false], 'button 1 should send A out');

  // Mid-stroke a1 has not been reached, so nothing steps along.
  r = step(c, inputs({ now: now + 100 }), r.state);
  assert.equal(r.actuated.LS_A1, false, 'a1 is only made once the rod gets there');
  assert.deepEqual(rods(r), [true, false]);

  // A- : the rod runs into a1, which drops A+ and fires A-.
  assert.deepEqual(settle(), [false, false], 'a1 should send A home');
  assert.equal(r.coils['RU1.R1'], true, 'R1 should be holding itself in');

  // B+ : A back on a0, with R1 still held.
  assert.deepEqual(settle(), [false, true], 'a0 with R1 held should send B out');

  // B- : b1 drops R1 and sends B home.
  assert.deepEqual(settle(), [false, false], 'b1 should send B home');

  now += STROKE_MS;
  r = step(c, inputs({ now }), r.state);
  assert.equal(r.coils['RU1.R1'], false, 'R1 should be dropped at the end of the cycle');
  assert.equal(r.nextTickMs, null, 'the cycle should stop, not run round again');
  assert.deepEqual(rods(r), [false, false]);

  // And again on the next press.
  r = step(c, inputs({ now, pressed: { 'PBU1.B1': true } }), r.state);
  assert.deepEqual(rods(r), [true, false], 'a second press should start a fresh cycle');
});
