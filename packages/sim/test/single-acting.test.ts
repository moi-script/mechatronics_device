import test from 'node:test';
import assert from 'node:assert/strict';
import { SINGLE_ACTING_SEQUENCE_PRESET, STROKE_MS, emptyState, step } from '../src/index';
import type { Inputs, SimResult } from '../src/index';

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: {},
  now: 0,
  ...over,
});

const rods = (r: SimResult): [boolean, boolean] => [r.pistons.SCYL1.extended, r.pistons.SCYL2.extended];

test('A+, then A- with B+ together, then B-, from one press of button 1', () => {
  const c = SINGLE_ACTING_SEQUENCE_PRESET.build();
  let now = 500_000;
  let r = step(c, inputs({ now }), emptyState());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(rods(r), [false, false]);
  assert.equal(r.nextTickMs, null);

  const settle = () => {
    now += STROKE_MS;
    r = step(c, inputs({ now }), r.state);
    assert.deepEqual(r.errors, []);
    return rods(r);
  };

  r = step(c, inputs({ now, pressed: { 'PBU1.B1': true } }), r.state);
  assert.deepEqual(rods(r), [true, false], 'A+');
  assert.deepEqual(settle(), [false, true], 'A- and B+ in the same step');
  assert.deepEqual(settle(), [false, false], 'B-');
  assert.deepEqual(settle(), [false, false]);
  assert.equal(r.nextTickMs, null, 'the cycle stops');
  assert.equal(r.coils['RU1.R2'], false);
  assert.equal(r.coils['RU1.R3'], false);

  r = step(c, inputs({ now, pressed: { 'PBU1.B1': true } }), r.state);
  assert.deepEqual(rods(r), [true, false], 'a second press starts again');
});
