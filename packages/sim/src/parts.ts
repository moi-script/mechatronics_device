import type { ModuleType, PartDef, PinDef, ModuleInstance, Circuit } from './types';

const pin = (id: string, label: string, role: PinDef['role'], x: number, y: number, line?: number): PinDef => ({
  id,
  label,
  role,
  x,
  y,
  ...(line === undefined ? {} : { line }),
});

/** Six rows, exactly as they sit on the bench supply: every row carries six pins. */
const SUPPLY_ROWS: { role: 'SOURCE_VCC' | 'SOURCE_GND'; label: string }[] = [
  { role: 'SOURCE_VCC', label: 'VCC' },
  { role: 'SOURCE_GND', label: 'GND' },
  { role: 'SOURCE_VCC', label: 'VCC' },
  { role: 'SOURCE_GND', label: 'GND' },
  { role: 'SOURCE_VCC', label: 'VCC' },
  { role: 'SOURCE_GND', label: 'GND' },
];

export const SUPPLY_ROW_Y = [58, 96, 134, 172, 210, 248];
export const SUPPLY_PIN_X = (i: number) => 78 + i * 58;

const supplyPins = (): PinDef[] => {
  const pins: PinDef[] = [];
  let vcc = 0;
  let gnd = 0;
  SUPPLY_ROWS.forEach((row, r) => {
    for (let i = 0; i < 6; i++) {
      const n = row.role === 'SOURCE_VCC' ? ++vcc : ++gnd;
      // The id stays unique for the solver; the panel just prints VCC or GND.
      const id = row.label + n;
      pins.push(pin(id, row.label, row.role, SUPPLY_PIN_X(i), SUPPLY_ROW_Y[r]));
    }
  });
  return pins;
};

/**
 * Solenoid breakout block: two rows, three VCC|GND pairs per row — six pairs
 * total. Row 1 is meant for the three cylinders' extend coils, row 2 for
 * their retract coils (or wire it however you like; the board doesn't care).
 */
export const SOLENOID_ROW_Y = [58, 106];
const SOLENOID_GROUP_GAP = 88;
const SOLENOID_PAIR_GAP = 46;
export const SOLENOID_PAIR_X = (i: number) => 40 + i * SOLENOID_GROUP_GAP;

const solenoidPins = (): PinDef[] => {
  const pins: PinDef[] = [];
  let vcc = 0;
  let gnd = 0;
  SOLENOID_ROW_Y.forEach((y) => {
    for (let i = 0; i < 3; i++) {
      const x0 = SOLENOID_PAIR_X(i);
      pins.push(pin(`VCC${++vcc}`, 'VCC', 'SOURCE_VCC', x0, y));
      pins.push(pin(`GND${++gnd}`, 'GND', 'SOURCE_GND', x0 + SOLENOID_PAIR_GAP, y));
    }
  });
  return pins;
};

/** On-delay set point: what a fresh timer is dialled to, and its dial range. */
export const TIMER_DEFAULT_DELAY_SEC = 5;
export const TIMER_MIN_DELAY_SEC = 1;
export const TIMER_MAX_DELAY_SEC = 60;

/** Set point of one timer in ms, clamped to the dial. */
export const timerDelayMs = (m: ModuleInstance): number =>
  Math.round(
    Math.min(TIMER_MAX_DELAY_SEC, Math.max(TIMER_MIN_DELAY_SEC, m.delaySec ?? TIMER_DEFAULT_DELAY_SEC)) * 1000,
  );

/** One NO/COM/NC line laid out horizontally. */
const contactLine = (line: number, y: number, x0: number, gap = 44): PinDef[] => [
  pin(`NO${line}`, 'NO', 'NO', x0, y, line),
  pin(`COM${line}`, 'COM', 'COM', x0 + gap, y, line),
  pin(`NC${line}`, 'NC', 'NC', x0 + gap * 2, y, line),
];

export const PARTS: Record<ModuleType, PartDef> = {
  BREAKER: {
    type: 'BREAKER',
    label: 'Breaker',
    width: 132,
    height: 148,
    pins: [],
    contactLines: 0,
    hasCoil: false,
  },
  SUPPLY: {
    type: 'SUPPLY',
    label: 'Power Supply',
    width: 430,
    height: 286,
    pins: supplyPins(),
    contactLines: 0,
    hasCoil: false,
  },
  PUSHBTN: {
    type: 'PUSHBTN',
    label: 'Push Button',
    width: 150,
    height: 168,
    pins: contactLine(1, 138, 31),
    contactLines: 1,
    hasCoil: false,
  },
  TOGGLE: {
    type: 'TOGGLE',
    label: 'Toggle Switch',
    width: 150,
    height: 168,
    pins: contactLine(1, 138, 31),
    contactLines: 1,
    hasCoil: false,
  },
  LAMP: {
    type: 'LAMP',
    label: 'Lamp',
    width: 128,
    height: 168,
    pins: [pin('VCC', 'VCC', 'LOAD_VCC', 40, 138), pin('GND', 'GND', 'LOAD_GND', 88, 138)],
    contactLines: 0,
    hasCoil: true,
  },
  RELAY: {
    type: 'RELAY',
    label: 'Relay',
    width: 170,
    height: 198,
    pins: [
      pin('VCC', 'VCC', 'LOAD_VCC', 52, 122),
      pin('GND', 'GND', 'LOAD_GND', 118, 122),
      ...contactLine(1, 168, 41),
    ],
    contactLines: 1,
    hasCoil: true,
  },
  BIGRELAY: {
    type: 'BIGRELAY',
    label: 'Large Relay',
    width: 268,
    height: 300,
    pins: [
      pin('VCC', 'VCC', 'LOAD_VCC', 88, 78),
      pin('GND', 'GND', 'LOAD_GND', 178, 78),
      ...contactLine(1, 138, 66),
      ...contactLine(2, 180, 66),
      ...contactLine(3, 222, 66),
      ...contactLine(4, 264, 66),
    ],
    contactLines: 4,
    hasCoil: true,
  },
  SOLENOID: {
    type: 'SOLENOID',
    label: 'Solenoid Block',
    width: 300,
    height: 170,
    pins: solenoidPins(),
    contactLines: 0,
    hasCoil: false,
  },
  CYLINDER: {
    type: 'CYLINDER',
    label: 'Cylinder',
    width: 260,
    height: 180,
    // Double-acting: one solenoid drives the rod out, the other pulls it back,
    // and both share the return. With neither energized the valve holds
    // whatever position the rod was left in.
    pins: [
      pin('EXT', 'EXT', 'LOAD_VCC', 60, 148),
      pin('RET', 'RET', 'LOAD_VCC', 130, 148),
      pin('GND', 'GND', 'LOAD_GND', 200, 148),
    ],
    contactLines: 0,
    hasCoil: false,
    coils: [
      { id: 'EXT', vcc: 'EXT', gnd: 'GND' },
      { id: 'RET', vcc: 'RET', gnd: 'GND' },
    ],
  },
  TIMER: {
    type: 'TIMER',
    label: 'Timer',
    width: 170,
    height: 168,
    // Three terminals, exactly as on the bench unit: the coil pair that starts
    // it running, and a single common output that the timer feeds from VCC
    // once it has picked up. No NO/NC pair to wire — the COM is the output.
    pins: [
      pin('VCC', 'VCC', 'LOAD_VCC', 52, 108),
      pin('GND', 'GND', 'LOAD_GND', 118, 108),
      pin('COM1', 'COM', 'COM', 85, 148, 1),
    ],
    contactLines: 0,
    hasCoil: true,
  },
};

export const partOf = (type: ModuleType): PartDef => PARTS[type];

/** "moduleId.pinId" — the solver's node key for a terminal. */
export const pinKey = (moduleId: string, pinId: string): string => `${moduleId}.${pinId}`;
/** "~wireId.END" — the solver's node key for one end of a wire. */
export const endKey = (wireId: string, end: 'A' | 'B'): string => `~${wireId}.${end}`;

/**
 * The fixed inventory, in its default bench arrangement: every part the
 * trainer owns, at the spot it lives on the bench. Nothing is ever created
 * beyond this list — the parts bin just hands out what is not already down.
 */
export function benchInventory(): ModuleInstance[] {
  const modules: ModuleInstance[] = [
    { id: 'BREAKER', type: 'BREAKER', x: 40, y: 40 },
    { id: 'SUPPLY', type: 'SUPPLY', x: 210, y: 40 },
  ];
  for (let i = 0; i < 6; i++) modules.push({ id: `PB${i + 1}`, type: 'PUSHBTN', x: 40 + i * 162, y: 370 });
  for (let i = 0; i < 3; i++) modules.push({ id: `SW${i + 1}`, type: 'TOGGLE', x: 1030 + i * 162, y: 370 });
  for (let i = 0; i < 3; i++) modules.push({ id: `LAMP${i + 1}`, type: 'LAMP', x: 1530 + i * 140, y: 370 });
  for (let i = 0; i < 5; i++) modules.push({ id: `RLY${i + 1}`, type: 'RELAY', x: 40 + i * 186, y: 580 });
  for (let i = 0; i < 2; i++) modules.push({ id: `BIG${i + 1}`, type: 'BIGRELAY', x: 1000 + i * 290, y: 580 });
  for (let i = 0; i < 3; i++)
    modules.push({ id: `TMR${i + 1}`, type: 'TIMER', x: 1600 + i * 186, y: 580, delaySec: TIMER_DEFAULT_DELAY_SEC });
  modules.push({ id: 'SOL1', type: 'SOLENOID', x: 40, y: 920 });
  for (let i = 0; i < 3; i++) modules.push({ id: `CYL${i + 1}`, type: 'CYLINDER', x: 400 + i * 300, y: 920 });
  return modules;
}

/**
 * What is already on the board when the bench is opened. The rest waits in the
 * parts bin, so a first-time student is not met with the whole inventory.
 */
export const STARTING_MODULE_IDS: readonly string[] = ['BREAKER', 'SUPPLY'];

export function defaultModules(): ModuleInstance[] {
  return benchInventory().filter((m) => STARTING_MODULE_IDS.includes(m.id));
}

/** The stock still in the bin: bench parts that are not on the board. */
export function spareModules(circuit: Circuit): ModuleInstance[] {
  const down = new Set(circuit.modules.map((m) => m.id));
  return benchInventory().filter((m) => !down.has(m.id));
}

/** The bench slot for one id, so the bin can put a part back where it belongs. */
export const benchSlot = (id: string): ModuleInstance | undefined => benchInventory().find((m) => m.id === id);

export const emptyCircuit = (): Circuit => ({
  modules: defaultModules(),
  wires: [],
});

/** Human label for a module id, e.g. "Relay 2". */
export function moduleLabel(m: ModuleInstance): string {
  const base = PARTS[m.type].label;
  const n = m.id.match(/\d+$/);
  return n ? `${base} ${n[0]}` : base;
}