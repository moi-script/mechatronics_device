import type { ModuleType, PartDef, PinDef, ModuleInstance, Circuit } from './types';

const pin = (id: string, label: string, role: PinDef['role'], x: number, y: number, line?: number): PinDef => ({
  id,
  label,
  role,
  x,
  y,
  ...(line === undefined ? {} : { line }),
});

/** Six rows, exactly as they sit on the bench supply. */
const supplyPins = (): PinDef[] => {
  const pins: PinDef[] = [];
  for (let i = 0; i < 6; i++) pins.push(pin(`VCC${i + 1}`, `VCC${i + 1}`, 'SOURCE_VCC', 78 + i * 58, 58));
  for (let i = 0; i < 6; i++) pins.push(pin(`GND${i + 1}`, `GND${i + 1}`, 'SOURCE_GND', 78 + i * 58, 96));
  pins.push(pin('VCC7', 'VCC', 'SOURCE_VCC', 78, 134));
  pins.push(pin('GND7', 'GND', 'SOURCE_GND', 78, 172));
  pins.push(pin('VCC8', 'VCC', 'SOURCE_VCC', 78, 210));
  pins.push(pin('GND8', 'GND', 'SOURCE_GND', 78, 248));
  return pins;
};

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
  TIMER: {
    type: 'TIMER',
    label: 'ON-Delay Timer',
    width: 190,
    height: 226,
    pins: [
      pin('VCC', 'VCC', 'LOAD_VCC', 62, 150),
      pin('GND', 'GND', 'LOAD_GND', 128, 150),
      ...contactLine(1, 196, 51),
    ],
    contactLines: 1,
    hasCoil: true,
  },
};

export const partOf = (type: ModuleType): PartDef => PARTS[type];

/** "moduleId.pinId" — the solver's node key for a terminal. */
export const pinKey = (moduleId: string, pinId: string): string => `${moduleId}.${pinId}`;
/** "~wireId.END" — the solver's node key for one end of a wire. */
export const endKey = (wireId: string, end: 'A' | 'B'): string => `~${wireId}.${end}`;

/** The fixed inventory, in its default bench arrangement. */
export function defaultModules(): ModuleInstance[] {
  const modules: ModuleInstance[] = [
    { id: 'BREAKER', type: 'BREAKER', x: 40, y: 40 },
    { id: 'SUPPLY', type: 'SUPPLY', x: 210, y: 40 },
    { id: 'TIMER', type: 'TIMER', x: 690, y: 40 },
  ];
  for (let i = 0; i < 6; i++) modules.push({ id: `PB${i + 1}`, type: 'PUSHBTN', x: 40 + i * 162, y: 370 });
  for (let i = 0; i < 3; i++) modules.push({ id: `SW${i + 1}`, type: 'TOGGLE', x: 1030 + i * 162, y: 370 });
  for (let i = 0; i < 3; i++) modules.push({ id: `LAMP${i + 1}`, type: 'LAMP', x: 1530 + i * 140, y: 370 });
  for (let i = 0; i < 5; i++) modules.push({ id: `RLY${i + 1}`, type: 'RELAY', x: 40 + i * 186, y: 580 });
  for (let i = 0; i < 2; i++) modules.push({ id: `BIG${i + 1}`, type: 'BIGRELAY', x: 1000 + i * 290, y: 580 });
  return modules;
}

export const emptyCircuit = (): Circuit => ({
  modules: defaultModules(),
  wires: [],
  timerDelayMs: 5000,
});

/** Human label for a module id, e.g. "Relay 2". */
export function moduleLabel(m: ModuleInstance): string {
  const base = PARTS[m.type].label;
  const n = m.id.match(/\d+$/);
  return n ? `${base} ${n[0]}` : base;
}
