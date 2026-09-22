import test from 'node:test';
import assert from 'node:assert/strict';
import { PNEUMATIC_SEQUENCE_PRESET, PRESETS, STROKE_MS, emptyState, presetById, step } from '../src/index';
import type { Circuit, Inputs, SimResult } from '../src/index';

/**
 * A+ A- B+ B-, run the way a student runs it: close the breaker, press button
 * 1 once, and let the reed sensors step the rest. How it is wired, and why the
 * memory relay is needed at all, is in the preset itself.
 */

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: {},
  now: 0,
  ...over,
});

/** Where both rods are, as a pair, so a step reads like the sequence sheet. */
const rods = (r: SimResult): [boolean, boolean] => [r.pistons.PCYL1.extended, r.pistons.PCYL2.extended];

const circuit = (): Circuit => PNEUMATIC_SEQUENCE_PRESET.build();

test('A+ A- B+ B- runs to the end from one press of button 1', () => {
  const c = circuit();
  let now = 500_000;
  let r = step(c, inputs({ now }), emptyState());

  // At rest: the spools feed 1 to 2, so both rods are held home.
  assert.deepEqual(r.errors, []);
  assert.equal(r.faulted, false);
  assert.deepEqual(rods(r), [false, false]);
  assert.equal(r.nextTickMs, null, 'nothing should be moving before the button is pressed');

  /** One stroke's worth of time, with the button left alone. */
  const settle = () => {
    now += STROKE_MS;
    r = step(c, inputs({ now }), r.state);
    assert.deepEqual(r.errors, [], 'the cycle should run without a fault');
    return rods(r);
  };

  // A+ : the press throws the spool, and the rod is on its way out.
  r = step(c, inputs({ now, pressed: { 'PBU1.B1': true } }), r.state);
  assert.deepEqual(rods(r), [true, false], 'button 1 should send A out');
  assert.equal(r.nextTickMs, STROKE_MS);

  // Part way through the stroke the sensor has not been reached, so nothing
  // steps along: the sequence runs at the speed of the rods.
  r = step(c, inputs({ now: now + 100 }), r.state);
  assert.deepEqual(rods(r), [true, false], 'A should still be on its way out');
  assert.equal(r.coils['RU1.R2'], false, 'the front sensor should not have been reached yet');
  assert.equal(r.nextTickMs, STROKE_MS - 100);

  // A- : the front sensor picks up R2, which drops A+ and fires A-.
  assert.deepEqual(settle(), [false, false], 'A should come home off its own front sensor');
  assert.equal(r.coils['RU1.R2'], true, 'R2 should be holding itself in');

  // B+ : the rear sensor, with R2 still held, is what starts B.
  assert.deepEqual(settle(), [false, true], 'B should go out once A is home again');

  // B- : the front sensor picks up R3, which drops R2 and sends B home.
  assert.deepEqual(settle(), [false, false], 'B should come home off its own front sensor');

  // The board is back where it started: no relay held, nothing on the clock.
  now += STROKE_MS;
  r = step(c, inputs({ now }), r.state);
  assert.equal(r.coils['RU1.R2'], false, 'R2 should be dropped at the end of the cycle');
  assert.equal(r.coils['RU1.R3'], false);
  assert.deepEqual(rods(r), [false, false]);
  assert.equal(r.nextTickMs, null, 'the cycle should stop, not run round again');

  // And it runs again on the next press.
  r = step(c, inputs({ now, pressed: { 'PBU1.B1': true } }), r.state);
  assert.deepEqual(rods(r), [true, false], 'a second press should start a fresh cycle');
});

test('the breaker holds the whole sequence dead', () => {
  const c = circuit();
  const r = step(c, inputs({ breakerClosed: false, pressed: { 'PBU1.B1': true } }), emptyState());
  assert.deepEqual(rods(r), [false, false]);
  assert.deepEqual(r.errors, []);
});

test('the pneumatic sequence is not in the shipped library', () => {
  // It is saved in the accounts that use it, so the library does not carry a
  // second copy for people to load by mistake.
  assert.equal(presetById('pneumatic-a-b-sequence'), undefined);
  assert.ok(!PRESETS.includes(PNEUMATIC_SEQUENCE_PRESET));
});
