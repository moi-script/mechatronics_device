import 'dotenv/config';
import mongoose from 'mongoose';
import type { ScriptStep } from '@mech/sim';
import { Exercise } from './models';

interface Seed {
  slug: string;
  title: string;
  brief: string;
  order: number;
  script: ScriptStep[];
}

const EXERCISES: Seed[] = [
  {
    slug: 'lamp-across-supply',
    title: '1 - Light a lamp',
    brief: 'Wire Lamp 1 across the supply so it lights as soon as the breaker is closed. Watch your polarity.',
    order: 1,
    script: [{ label: 'Lamp 1 lights with the breaker closed', breaker: true, expect: { LAMP1: 'on' } }],
  },
  {
    slug: 'push-to-light',
    title: '2 - Push to light',
    brief: 'Put push button PB1 in series with Lamp 1, using the NO contact, so the lamp only lights while PB1 is held.',
    order: 2,
    script: [
      { label: 'Lamp 1 is dark at rest', breaker: true, expect: { LAMP1: 'off' } },
      { label: 'Lamp 1 lights while PB1 is held', press: 'PB1', expect: { LAMP1: 'on' } },
      { label: 'Lamp 1 goes out when PB1 is released', release: 'PB1', expect: { LAMP1: 'off' } },
    ],
  },
  {
    slug: 'start-stop-latch',
    title: '3 - Start/stop latch',
    brief:
      'Build a motor-starter latch: PB1 (NO) starts Relay 1, Relay 1 holds itself in through its own NO contact, PB2 (NC) breaks the hold, and Lamp 1 shows the run state.',
    order: 3,
    script: [
      { label: 'Everything is at rest', breaker: true, expect: { RLY1: 'off', LAMP1: 'off' } },
      { label: 'PB1 starts the relay', press: 'PB1', expect: { RLY1: 'on', LAMP1: 'on' } },
      { label: 'The relay holds itself in after PB1 is released', release: 'PB1', expect: { RLY1: 'on', LAMP1: 'on' } },
      { label: 'PB2 drops the latch', press: 'PB2', expect: { RLY1: 'off', LAMP1: 'off' } },
      { label: 'It stays dropped after PB2 is released', release: 'PB2', expect: { RLY1: 'off', LAMP1: 'off' } },
    ],
  },
  {
    slug: 'timed-lamp',
    title: '4 - Delayed start',
    brief:
      'Energize the timer coil from the supply and run Lamp 2 through the timer NO contact. Leave the delay at 5 seconds: Lamp 2 must stay dark at first and light once the delay is up.',
    order: 4,
    script: [
      { label: 'Lamp 2 is dark while the timer runs', breaker: true, expect: { LAMP2: 'off' } },
      { label: 'Lamp 2 lights once the delay expires', advanceMs: 6000, expect: { LAMP2: 'on' } },
    ],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mechatronic_trainer');
  for (const ex of EXERCISES) {
    await Exercise.findOneAndUpdate({ slug: ex.slug }, ex, { upsert: true });
  }
  console.log('seeded ' + EXERCISES.length + ' exercises');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
