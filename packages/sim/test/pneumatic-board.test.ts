import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PNEUMATIC_BOARD_SEQUENCE,
  STROKE_MS,
  benchInventory,
  emptyState,
  moduleLabel,
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

test('every cylinder on the pneumatics board has a switch at each end of its stroke', () => {
  const bench = benchInventory('pneumatics');
  const cylinders = bench.filter((m) => m.type === 'FT_CYL' || m.type === 'FT_SCYL');
  assert.ok(cylinders.length >= 4, 'the board is rows of cylinders');

  for (const cyl of cylinders) {
    const mounted = bench.filter((m) => m.mount?.cylinderId === cyl.id);
    assert.deepEqual(
      mounted.map((m) => m.mount?.at).sort(),
      ['home', 'out'],
      `${cyl.id} should have a switch at each end`,
    );
    // The row reads left to right: home switch, cylinder, far switch.
    const home = mounted.find((m) => m.mount?.at === 'home')!;
    const out = mounted.find((m) => m.mount?.at === 'out')!;
    assert.ok(home.x < cyl.x && cyl.x < out.x, `${cyl.id}'s switches should sit at the ends of its row`);
    assert.equal(home.y, cyl.y);
    assert.equal(out.y, cyl.y);
  }
});

test('the switches are named the way the sequence sheet names them', () => {
  const bench = benchInventory('pneumatics');
  const label = (id: string) => moduleLabel(bench.find((m) => m.id === id)!);
  assert.equal(label('LS_A0'), 'Limit switch a0');
  assert.equal(label('LS_A1'), 'Limit switch a1');
  assert.equal(label('CYL_A'), 'Pneumatic Cylinder A');
});

test('a mounted limit switch is thrown by the rod, not by a finger', () => {
  const c = circuit();
  let now = 500_000;
  let r = step(c, inputs({ now }), emptyState());

  // At rest both rods are home, so both a0 switches are made and the far ones
  // are not. Nothing is pressed: the board says so on its own.
  assert.equal(r.actuated.LS_A0, true, 'a0 should be made while A is home');
  assert.equal(r.actuated.LS_A1, false);
  assert.equal(r.actuated.LS_B0, true);
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
