import type { BoardType } from '@mech/sim';

/** The benches a project can start on, in the order they are offered. */
export const BOARDS: { id: BoardType; name: string; short: string; blurb: string }[] = [
  {
    id: 'simple',
    name: 'Simple Trainer Board',
    short: 'Simple',
    blurb: 'The relay trainer: supply, buttons, switches, lamps, relays and timers. No PLC.',
  },
  {
    id: 'pneumatics',
    name: 'PLC Trainer Board',
    short: 'PLC',
    blurb: 'The Festech bench: PLC, valves, and a cylinder to a row with a limit switch at each end.',
  },
  {
    id: 'trainer',
    name: 'All boards',
    short: 'All',
    blurb: 'Every part from both benches on one panel.',
  },
];

export const boardOf = (id: BoardType) => BOARDS.find((b) => b.id === id)!;
