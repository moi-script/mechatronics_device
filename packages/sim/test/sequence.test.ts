import test from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENCE_PRESET, PRESETS, benchSlot, presetById, step, emptyState, timerDelayMs } from '../src/index';
import type { Circuit, Inputs, SimResult } from '../src/index';

/**
 * The three-step sequence preset, run the way a student runs it:
 *
 *   power up -> after the timer set point, LAMP1 lights on its own
 *   PB1      -> LAMP1 on, LAMP3 off
 *   PB2      -> LAMP2 on, LAMP1 off
 *   PB3      -> LAMP3 on, LAMP2 off
 *
 * How it is wired, and why, is in the preset itself.
 */

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  breakerClosed: true,
  pressed: {},
  toggled: {},
  now: 0,
  ...over,
});

/** Which lamps are lit, as a triple, so a step reads like the sequence sheet. */
const lamps = (r: SimResult): [boolean, boolean, boolean] => [
  r.devices.LAMP1.energized,
  r.devices.LAMP2.energized,
  r.devices.LAMP3.energized,
];

const circuit = (): Circuit => SEQUENCE_PRESET.build();

test('the three-step sequence walks LAMP1 -> LAMP2 -> LAMP3 and back', () => {
  const c = circuit();
  const delayMs = timerDelayMs(c.modules.find((m) => m.id === 'TMR1')!);
  const T0 = 1_000_000;

  // Power up: nothing lit, the timer is counting.
  let r = step(c, inputs({ now: T0 }), emptyState());
  assert.deepEqual(r.errors, []);
  assert.equal(r.faulted, false);
  assert.deepEqual(lamps(r), [false, false, false]);
  assert.equal(r.timers.TMR1.running, true);
  assert.equal(r.nextTickMs, delayMs);

  // Part way through, still dark.
  r = step(c, inputs({ now: T0 + delayMs - 1 }), r.state);
  assert.deepEqual(lamps(r), [false, false, false]);

  // Set point reached: LAMP1 comes on by itself and latches.
  r = step(c, inputs({ now: T0 + delayMs }), r.state);
  assert.deepEqual(lamps(r), [true, false, false], 'timer should light LAMP1');
  // Stage 1 latched, so the timer is dropped and off the clock for good.
  assert.equal(r.devices.TMR1.energized, false);
  assert.equal(r.nextTickMs, null);

  const hold = (at: number) => {
    r = step(c, inputs({ now: at }), r.state);
    return lamps(r);
  };
  const tap = (id: string, at: number) => {
    r = step(c, inputs({ now: at, pressed: { [id]: true } }), r.state);
    const held = lamps(r);
    r = step(c, inputs({ now: at + 100 }), r.state); // released
    assert.deepEqual(lamps(r), held, `${id} should latch, not just flash`);
    return held;
  };

  let now = T0 + delayMs;
  assert.deepEqual(hold((now += 1000)), [true, false, false], 'LAMP1 holds on its own');

  // PB2: LAMP2 on, LAMP1 off.
  assert.deepEqual(tap('PB2', (now += 1000)), [false, true, false]);

  // PB3: LAMP3 on, LAMP2 off.
  assert.deepEqual(tap('PB3', (now += 1000)), [false, false, true]);

  // PB1: LAMP1 on, LAMP3 off — round again.
  assert.deepEqual(tap('PB1', (now += 1000)), [true, false, false]);

  // PB2 again, to show the ring keeps turning.
  assert.deepEqual(tap('PB2', (now += 1000)), [false, true, false]);

  // The timer never re-fires mid-sequence: it only counts with the board idle.
  assert.equal(r.timers.TMR1.running, false);
  assert.deepEqual(r.errors, []);
});

test('PB1 starts the sequence early, before the timer has run out', () => {
  const c = circuit();
  const T0 = 1_000_000;

  let r = step(c, inputs({ now: T0 }), emptyState());
  assert.equal(r.timers.TMR1.running, true);

  r = step(c, inputs({ now: T0 + 200, pressed: { PB1: true } }), r.state);
  assert.deepEqual(lamps(r), [true, false, false]);

  r = step(c, inputs({ now: T0 + 300 }), r.state);
  assert.deepEqual(lamps(r), [true, false, false], 'LAMP1 stays latched after release');
  assert.equal(r.timers.TMR1.running, false, 'stage 1 takes the timer off the clock');
});

test('opening the breaker drops the whole sequence', () => {
  const c = circuit();
  let r = step(c, inputs({ now: 0, pressed: { PB3: true } }), emptyState());
  assert.deepEqual(lamps(r), [false, false, true]);

  r = step(c, inputs({ now: 100, breakerClosed: false }), r.state);
  assert.deepEqual(lamps(r), [false, false, false]);

  // Power back on: the board comes up idle and the timer starts a fresh count.
  r = step(c, inputs({ now: 200 }), r.state);
  assert.deepEqual(lamps(r), [false, false, false]);
  assert.equal(r.timers.TMR1.running, true);
});

test('the preset puts down real bench parts, at their bench slots', () => {
  const c = circuit();
  const ids = new Set<string>();
  for (const m of c.modules) {
    const slot = benchSlot(m.id);
    assert.ok(slot, `${m.id} is not a bench part`);
    assert.deepEqual([m.x, m.y], [slot!.x, slot!.y], `${m.id} should sit at its bench slot`);
    assert.equal(ids.has(m.id), false, `${m.id} is down twice`);
    ids.add(m.id);
  }

  // Every lead lands on a part that is actually on the board.
  for (const w of c.wires) {
    for (const e of [w.a, w.b]) {
      assert.equal(e.kind, 'terminal');
      if (e.kind === 'terminal') assert.ok(ids.has(e.moduleId), `lead ${w.id} runs to absent ${e.moduleId}`);
    }
  }
  assert.equal(new Set(c.wires.map((w) => w.id)).size, c.wires.length, 'lead ids should be unique');

  // The parts the sequence does not use stay in the bin.
  assert.equal(ids.has('CYL1'), false);
  assert.equal(ids.has('SW1'), false);
});

test('presets are listed and can be looked up by id', () => {
  assert.ok(PRESETS.includes(SEQUENCE_PRESET));
  assert.equal(presetById(SEQUENCE_PRESET.id), SEQUENCE_PRESET);
  assert.equal(presetById('nothing-like-it'), undefined);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length, 'preset ids should be unique');
});
