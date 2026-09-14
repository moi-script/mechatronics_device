import type { ModuleType, PartDef, PinDef } from './types';

/*
 * Festech trainer modules. Every panel here is laid out from the photographs
 * of the bench, with the same number of posts and the same markings.
 */

type Collar = PinDef['collar'];

const fp = (id: string, label: string, role: PinDef['role'], x: number, y: number, collar?: Collar): PinDef => ({
  id,
  label,
  role,
  x,
  y,
  ...(collar ? { collar } : {}),
});

/** A row of posts joined inside the panel: the +24V or 0V distribution strip. */
const busRow = (
  prefix: string,
  label: string,
  n: number,
  y: number,
  x0: number,
  gap: number,
  collar: Collar,
): PinDef[] => Array.from({ length: n }, (_, i) => fp(`${prefix}${i + 1}`, label, 'PASS', x0 + i * gap, y, collar));

const idsOf = (pins: PinDef[]) => pins.map((q) => q.id);
const two = (n: number) => String(n).padStart(2, '0');

/** DC 24V / 5A supply: two +24V posts in each top corner, two 0V in each bottom corner. */
function psu(): PartDef {
  return {
    type: 'FT_PSU',
    label: '24V Power Supply',
    width: 360,
    height: 290,
    pins: [
      ...[40, 80, 280, 320].map((x, i) => fp(`P${i + 1}`, '+24V', 'SOURCE_VCC', x, 62, 'red')),
      ...[40, 80, 280, 320].map((x, i) => fp(`N${i + 1}`, '0V', 'SOURCE_GND', x, 248, 'blue')),
    ],
    contactLines: 0,
    hasCoil: false,
  };
}

/** Top of each button's block on the push-button unit. */
export const FT_PBU_BLOCK_Y = (b: number) => 84 + b * 88;

/**
 * Push-button switch unit: three illuminated buttons, each with 13-14 and
 * 23-24 NO, 31-32 and 41-42 NC, and its lamp on X1-X2. A +24V strip runs along
 * the top and a 0V strip along the bottom.
 */
function pushButtonUnit(): PartDef {
  const top = busRow('V', '+24V', 5, 50, 60, 60, 'red');
  const bottom = busRow('G', '0V', 5, 354, 60, 60, 'blue');
  const pins: PinDef[] = [...top, ...bottom];
  const switches: NonNullable<PartDef['switches']> = [];
  const coils: NonNullable<PartDef['coils']> = [];
  const pairs: [string, string, boolean][] = [
    ['13', '14', true],
    ['23', '24', true],
    ['31', '32', false],
    ['41', '42', false],
  ];
  for (let b = 0; b < 3; b++) {
    const B = `B${b + 1}`;
    const y0 = FT_PBU_BLOCK_Y(b);
    pairs.forEach(([t, u, no], k) => {
      const x = 100 + k * 50;
      pins.push(fp(`${B}_${t}`, t, 'PASS', x, y0 + 12, 'black'));
      pins.push(fp(`${B}_${u}`, u, 'PASS', x, y0 + 52, 'black'));
      switches.push({ pins: [`${B}_${t}`, `${B}_${u}`], closedWhen: no, actuator: B });
    });
    pins.push(fp(`${B}_X1`, 'X1', 'LOAD_VCC', 300, y0 + 12, 'black'));
    pins.push(fp(`${B}_X2`, 'X2', 'LOAD_GND', 300, y0 + 52, 'black'));
    coils.push({ id: `L${b + 1}`, vcc: `${B}_X1`, gnd: `${B}_X2` });
  }
  return {
    type: 'FT_PBU',
    label: 'Push-Button Unit',
    width: 340,
    height: 384,
    pins,
    contactLines: 0,
    hasCoil: false,
    coils,
    switches,
    buses: [idsOf(top), idsOf(bottom)],
  };
}

/** Top of each relay's block on the relay unit. */
export const FT_RELAY_BLOCK_Y = (r: number) => 82 + r * 96;

/**
 * Relay unit, 3-fold: each relay has coil A1-A2 and four changeovers — COM on
 * 11/21/31/41, NC on 12/22/32/42, NO on 14/24/34/44.
 */
function relayUnit(): PartDef {
  const top = busRow('V', '+24V', 5, 48, 80, 70, 'red');
  const bottom = busRow('G', '0V', 5, 370, 80, 70, 'blue');
  const pins: PinDef[] = [...top, ...bottom];
  const coils: NonNullable<PartDef['coils']> = [];
  const changeovers: NonNullable<PartDef['changeovers']> = [];
  for (let r = 0; r < 3; r++) {
    const R = `R${r + 1}`;
    const y0 = FT_RELAY_BLOCK_Y(r);
    pins.push(fp(`${R}_A1`, 'A1', 'LOAD_VCC', 40, y0 + 10, 'red'));
    pins.push(fp(`${R}_A2`, 'A2', 'LOAD_GND', 40, y0 + 54, 'black'));
    coils.push({ id: R, vcc: `${R}_A1`, gnd: `${R}_A2` });
    for (let c = 1; c <= 4; c++) {
      const xNc = 100 + (c - 1) * 80;
      pins.push(fp(`${R}_${c}2`, `${c}2`, 'NC', xNc, y0 + 10, 'black'));
      pins.push(fp(`${R}_${c}4`, `${c}4`, 'NO', xNc + 38, y0 + 10, 'black'));
      pins.push(fp(`${R}_${c}1`, `${c}1`, 'COM', xNc + 19, y0 + 54, 'black'));
      changeovers.push({ com: `${R}_${c}1`, no: `${R}_${c}4`, nc: `${R}_${c}2`, actuator: R });
    }
  }
  return {
    type: 'FT_RELAY3',
    label: 'Relay Unit',
    width: 420,
    height: 400,
    pins,
    contactLines: 0,
    hasCoil: false,
    coils,
    changeovers,
    buses: [idsOf(top), idsOf(bottom)],
  };
}

export const FT_PLC_INPUT_ROWS = [132, 182];
export const FT_PLC_OUTPUT_Y = 252;

/** OMRON CP1E: inputs 00-11, outputs 00-07, and its own +24V / 0V posts. */
function plc(): PartDef {
  const v = [fp('V1', '+24V', 'PASS', 40, 62, 'red'), fp('V2', '+24V', 'PASS', 80, 62, 'red')];
  const g = [fp('G1', '0V', 'PASS', 130, 62, 'blue'), fp('G2', '0V', 'PASS', 170, 62, 'blue')];
  const inputs = Array.from({ length: 12 }, (_, i) =>
    fp(`I${two(i)}`, two(i), 'INPUT', 50 + (i % 6) * 62, FT_PLC_INPUT_ROWS[Math.floor(i / 6)], 'black'),
  );
  const outputs = Array.from({ length: 8 }, (_, i) =>
    fp(`Q${two(i)}`, two(i), 'PASS', 50 + i * 52, FT_PLC_OUTPUT_Y, 'black'),
  );
  return {
    type: 'FT_PLC',
    label: 'PLC CP1E',
    width: 480,
    height: 290,
    pins: [...v, ...g, ...inputs, ...outputs],
    contactLines: 0,
    hasCoil: false,
    buses: [idsOf(v), idsOf(g)],
  };
}

/** The electrical plug on a solenoid coil block: + and -. */
const solenoidPair = (id: string, x: number, y: number): PinDef[] => [
  fp(`${id}_P`, '+', 'LOAD_VCC', x, y, 'red'),
  fp(`${id}_N`, '-', 'LOAD_GND', x + 38, y, 'black'),
];

export const FESTECH_PARTS: Record<Extract<ModuleType, `FT_${string}`>, PartDef> = {
  FT_PSU: psu(),
  FT_PBU: pushButtonUnit(),
  FT_RELAY3: relayUnit(),
  FT_PLC: plc(),
  FT_LIMIT: {
    type: 'FT_LIMIT',
    label: 'Limit Switch',
    width: 190,
    height: 160,
    pins: [
      fp('NC', 'N.C', 'NC', 45, 120, 'black'),
      fp('NO', 'N.O', 'NO', 95, 120, 'black'),
      fp('COM', 'COM', 'COM', 145, 120, 'red'),
    ],
    contactLines: 0,
    hasCoil: false,
    changeovers: [{ com: 'COM', no: 'NO', nc: 'NC', actuator: '' }],
  },
  FT_V52S: {
    type: 'FT_V52S',
    label: '5/2 Valve, Single Solenoid',
    width: 250,
    height: 160,
    // At rest 1 feeds 2 and 4 exhausts through 5; energized 1 feeds 4 and 2
    // exhausts through 3. Exhausts 3 and 5 carry silencers, not fittings.
    pins: [
      ...solenoidPair('Y', 32, 120),
      fp('A4', '4', 'AIR', 140, 56),
      fp('A2', '2', 'AIR', 200, 56),
      fp('A1', '1', 'AIR', 170, 120),
    ],
    contactLines: 0,
    hasCoil: false,
    coils: [{ id: 'Y', vcc: 'Y_P', gnd: 'Y_N' }],
  },
  FT_V52D: {
    type: 'FT_V52D',
    label: '5/2 Valve, Double Solenoid',
    width: 320,
    height: 160,
    // Y14 throws the spool to 1->4, Y12 back to 1->2. With neither (or both) it stays put.
    pins: [
      ...solenoidPair('Y14', 32, 120),
      fp('A4', '4', 'AIR', 130, 56),
      fp('A2', '2', 'AIR', 190, 56),
      fp('A1', '1', 'AIR', 160, 120),
      ...solenoidPair('Y12', 250, 120),
    ],
    contactLines: 0,
    hasCoil: false,
    coils: [
      { id: 'Y14', vcc: 'Y14_P', gnd: 'Y14_N' },
      { id: 'Y12', vcc: 'Y12_P', gnd: 'Y12_N' },
    ],
  },
  FT_V32: {
    type: 'FT_V32',
    label: '3/2 Valve NC, Single Solenoid',
    width: 230,
    height: 160,
    // Normally closed: 1 is blocked and 2 exhausts through 3; energized 1 feeds 2.
    pins: [...solenoidPair('Y', 32, 120), fp('A2', '2', 'AIR', 160, 56), fp('A1', '1', 'AIR', 190, 120)],
    contactLines: 0,
    hasCoil: false,
    coils: [{ id: 'Y', vcc: 'Y_P', gnd: 'Y_N' }],
  },
  FT_AIR: {
    type: 'FT_AIR',
    label: 'Air Distributor',
    width: 300,
    height: 145,
    pins: [
      fp('IN', 'IN', 'AIR', 40, 84),
      ...Array.from({ length: 8 }, (_, i) =>
        fp(`O${i + 1}`, String(i + 1), 'AIR', 110 + (i % 4) * 50, i < 4 ? 56 : 112),
      ),
    ],
    contactLines: 0,
    hasCoil: false,
    airSource: true,
  },
  FT_CYL: {
    type: 'FT_CYL',
    label: 'Pneumatic Cylinder',
    width: 470,
    height: 180,
    // Air into A drives the rod out, air into B brings it home. The two reed
    // sensors clamped to the barrel close + to OUT while the piston magnet sits
    // under them: the rear one when retracted, the front one when extended.
    pins: [
      fp('A', 'A', 'AIR', 50, 52),
      fp('B', 'B', 'AIR', 250, 52),
      fp('S1_P', '+', 'PASS', 70, 146, 'red'),
      fp('S1_O', 'OUT', 'PASS', 108, 146, 'black'),
      fp('S2_P', '+', 'PASS', 220, 146, 'red'),
      fp('S2_O', 'OUT', 'PASS', 258, 146, 'black'),
    ],
    contactLines: 0,
    hasCoil: false,
    switches: [
      { pins: ['S1_P', 'S1_O'], closedWhen: false, actuator: 'EXT' },
      { pins: ['S2_P', 'S2_O'], closedWhen: true, actuator: 'EXT' },
    ],
  },
  FT_SCYL: {
    type: 'FT_SCYL',
    label: 'Single-Acting Cylinder',
    width: 470,
    height: 180,
    // One air port: pressure on A drives the rod out, and the spring brings it
    // home the moment A vents. Same two reed sensors as the double-acting one.
    pins: [
      fp('A', 'A', 'AIR', 50, 52),
      fp('S1_P', '+', 'PASS', 70, 146, 'red'),
      fp('S1_O', 'OUT', 'PASS', 108, 146, 'black'),
      fp('S2_P', '+', 'PASS', 220, 146, 'red'),
      fp('S2_O', 'OUT', 'PASS', 258, 146, 'black'),
    ],
    contactLines: 0,
    hasCoil: false,
    switches: [
      { pins: ['S1_P', 'S1_O'], closedWhen: false, actuator: 'EXT' },
      { pins: ['S2_P', 'S2_O'], closedWhen: true, actuator: 'EXT' },
    ],
  },
};

/** The Festech stock and where it sits on the bench, below the original trainer. */
export const FESTECH_INVENTORY: { id: string; type: ModuleType; x: number; y: number }[] = [
  { id: 'PSU1', type: 'FT_PSU', x: 40, y: 1160 },
  { id: 'PBU1', type: 'FT_PBU', x: 420, y: 1160 },
  { id: 'RU1', type: 'FT_RELAY3', x: 780, y: 1160 },
  { id: 'PLC1', type: 'FT_PLC', x: 1220, y: 1160 },
  { id: 'LS1', type: 'FT_LIMIT', x: 1720, y: 1160 },
  { id: 'LS2', type: 'FT_LIMIT', x: 1720, y: 1340 },
  { id: 'AIR1', type: 'FT_AIR', x: 40, y: 1590 },
  { id: 'V52S1', type: 'FT_V52S', x: 360, y: 1590 },
  { id: 'V52D1', type: 'FT_V52D', x: 630, y: 1590 },
  { id: 'V32N1', type: 'FT_V32', x: 970, y: 1590 },
  { id: 'PCYL1', type: 'FT_CYL', x: 1220, y: 1590 },
  { id: 'PCYL2', type: 'FT_CYL', x: 360, y: 1790 },
  { id: 'PCYL3', type: 'FT_CYL', x: 850, y: 1790 },
  { id: 'SCYL1', type: 'FT_SCYL', x: 40, y: 1990 },
  { id: 'SCYL2', type: 'FT_SCYL', x: 530, y: 1990 },
  { id: 'SCYL3', type: 'FT_SCYL', x: 1020, y: 1990 },
  { id: 'V52S2', type: 'FT_V52S', x: 1340, y: 1790 },
  { id: 'V52D2', type: 'FT_V52D', x: 1610, y: 1790 },
  { id: 'V32N2', type: 'FT_V32', x: 1510, y: 1990 },
  { id: 'V52S3', type: 'FT_V52S', x: 40, y: 1790 },
  { id: 'V52D3', type: 'FT_V52D', x: 40, y: 2190 },
  { id: 'V32N3', type: 'FT_V32', x: 380, y: 2190 },
  { id: 'AIR2', type: 'FT_AIR', x: 630, y: 2190 },
  { id: 'AIR3', type: 'FT_AIR', x: 950, y: 2190 },
  { id: 'AIR4', type: 'FT_AIR', x: 1270, y: 2190 },
];
