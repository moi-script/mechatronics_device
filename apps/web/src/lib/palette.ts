import type { WireColor } from '@mech/sim';

export type Mode = 'light' | 'dark';
export type ThemeChoice = Mode | 'system';

/**
 * Every colour the SVG panel is drawn from. SVG presentation attributes cannot
 * resolve CSS variables, so the board takes its palette as values instead.
 */
export interface Palette {
  /** Module face gradient, top to bottom. */
  plate: [string, string, string];
  backplate: [string, string];
  boardStroke: string;
  moduleStroke: string;
  bevelLight: string;
  bevelDark: string;

  legendBg: string;
  legendText: string;
  legendTag: string;

  ink: string;
  label: string;

  recess: string;
  recessStroke: string;
  recessInner: string;
  chrome: [string, string, string];
  housing: [string, string];
  housingInner: string;
  lensOff: [string, string];
  lensOn: [string, string, string];
  brass: [string, string, string];
  screwFill: string;
  screwStroke: string;
  screwSlot: string;
  ledOff: string;

  amber: string;
  blue: string;
  green: string;
  red: string;
  neutral: string;

  /** Terminal collars: COM and GND are black, every other pin is red. */
  pinBlack: string;
  pinRed: string;

  titleFace: string;
  titleBar: string;
  titleBarText: string;
  titleRule: string;

  plugPin: string;
  cableShadow: string;
  cableShadowOpacity: number;
  glowOpacity: number;
}

export const LIGHT: Palette = {
  plate: ['#fdfefe', '#f2f6f9', '#e4eaf1'],
  backplate: ['#eef2f6', '#dbe2ea'],
  boardStroke: '#93a1b0',
  moduleStroke: '#a9b6c4',
  bevelLight: '#ffffff',
  bevelDark: '#8d9dac',

  legendBg: '#16202b',
  legendText: '#f1f5f9',
  legendTag: '#8fa2b4',

  ink: '#16202b',
  label: '#5b6b7b',

  recess: '#cfd8e1',
  recessStroke: '#93a1b0',
  recessInner: '#e9eef3',
  chrome: ['#ffffff', '#cdd7e0', '#9fadbb'],
  housing: ['#eff4f8', '#d3dde6'],
  housingInner: '#c8d2dc',
  lensOff: ['#f4f7fa', '#ccd6df'],
  lensOn: ['#fffbe8', '#fcd34d', '#d97706'],
  brass: ['#fde9b0', '#d9a83a', '#8a6a12'],
  screwFill: '#b9c4cf',
  screwStroke: '#8c9aa8',
  screwSlot: '#7b8996',
  ledOff: '#c2cdd8',

  amber: '#e8830c',
  blue: '#0b7fc7',
  green: '#1b9c5a',
  red: '#c62828',
  neutral: '#46586a',

  pinBlack: '#11181f',
  pinRed: '#c62828',

  titleFace: '#f6f8fa',
  titleBar: '#16202b',
  titleBarText: '#f1f5f9',
  titleRule: '#16202b',

  plugPin: '#6b5210',
  cableShadow: '#1e293b',
  cableShadowOpacity: 0.3,
  glowOpacity: 0.3,
};

/** The same panel under low workshop light: dark cases, brighter signals. */
export const DARK: Palette = {
  plate: ['#232d3a', '#1c2531', '#18202b'],
  backplate: ['#161e28', '#10161e'],
  boardStroke: '#2e3a4a',
  moduleStroke: '#2e3a4a',
  bevelLight: '#54637a',
  bevelDark: '#0e141d',

  legendBg: '#0a0f15',
  legendText: '#e6edf5',
  legendTag: '#7d8fa3',

  ink: '#e6edf5',
  label: '#93a3b6',

  recess: '#1b2431',
  recessStroke: '#46566b',
  recessInner: '#131a24',
  chrome: ['#8a99ad', '#5a6b81', '#38455a'],
  housing: ['#33404f', '#232d3b'],
  housingInner: '#2b3746',
  lensOff: ['#5b6675', '#1b222b'],
  lensOn: ['#fff6d5', '#ffc94a', '#e07a10'],
  brass: ['#f6dfa4', '#c99a34', '#7a5c10'],
  screwFill: '#46566b',
  screwStroke: '#6a7c93',
  screwSlot: '#8496ab',
  ledOff: '#33404f',

  amber: '#f5a524',
  blue: '#3b82f6',
  green: '#34d399',
  red: '#e5484d',
  neutral: '#8496ab',

  // Still black, just deep enough to separate from the dark plate behind it.
  pinBlack: '#05090e',
  pinRed: '#d93636',

  titleFace: '#141b26',
  titleBar: '#0a0f15',
  titleBarText: '#e2e8f0',
  titleRule: '#46566b',

  plugPin: '#3a2c08',
  cableShadow: '#000000',
  cableShadowOpacity: 0.5,
  glowOpacity: 0.45,
};

/**
 * The PLC Trainer Board drawn as the Festech bench really looks: brushed
 * aluminium panels with printed black legends and nickel socket inserts. It is
 * the same in either theme, the way the real panels do not change with the
 * room lights.
 */
export const PHOTO: Palette = {
  plate: ['#e9ebed', '#cfd3d7', '#dcdfe2'],
  backplate: ['#1d3c80', '#142a5c'],
  boardStroke: '#7d858d',
  moduleStroke: '#8a9096',
  bevelLight: '#ffffff',
  bevelDark: '#3b4046',

  legendBg: '#2b2e33',
  legendText: '#1c1e21',
  legendTag: '#4c525a',

  ink: '#1c1e21',
  label: '#2a2d31',

  recess: '#18191c',
  recessStroke: '#55595f',
  recessInner: '#2b2e33',
  chrome: ['#ffffff', '#c5ccd3', '#6f7881'],
  housing: ['#e3e6e9', '#a9b0b7'],
  housingInner: '#cfd3d7',
  lensOff: ['#d8dde2', '#4c535a'],
  lensOn: ['#fff6d5', '#ffc94a', '#e07a10'],
  brass: ['#fbfbf8', '#aeb3b8', '#4f545a'],
  screwFill: '#c5ccd3',
  screwStroke: '#5c646d',
  screwSlot: '#3e4349',
  ledOff: '#4c535a',

  amber: '#f5a524',
  blue: '#1890bd',
  green: '#22b14c',
  red: '#e3262b',
  neutral: '#6f7881',

  pinBlack: '#1d2024',
  pinRed: '#cf1f24',

  titleFace: '#cfd3d7',
  titleBar: '#33383e',
  titleBarText: '#f1f3f5',
  titleRule: '#7d858d',

  plugPin: '#4f545a',
  cableShadow: '#06122e',
  cableShadowOpacity: 0.55,
  glowOpacity: 0.45,
};

export const paletteFor = (mode: Mode): Palette => (mode === 'dark' ? DARK : LIGHT);

/** Lead colours. The dark set is lifted so a black lead still reads on a dark panel. */
export const WIRE_BY_MODE: Record<Mode, Record<WireColor, string>> = {
  light: {
    red: '#dc2626',
    black: '#1e293b',
    blue: '#1d4ed8',
    green: '#15803d',
    yellow: '#ca8a04',
    white: '#cbd5e1',
    orange: '#ea580c',
    brown: '#92400e',
    violet: '#7c3aed',
    grey: '#64748b',
    pink: '#db2777',
    cyan: '#0891b2',
  },
  dark: {
    red: '#ef4444',
    black: '#5b6b80',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    white: '#e2e8f0',
    orange: '#f97316',
    brown: '#b45309',
    violet: '#a78bfa',
    grey: '#94a3b8',
    pink: '#f472b6',
    cyan: '#22d3ee',
  },
};

/** The lengthwise highlight that makes each lead read as round cable. */
export const WIRE_HI_BY_MODE: Record<Mode, Record<WireColor, string>> = {
  light: {
    red: '#fca5a5',
    black: '#64748b',
    blue: '#60a5fa',
    green: '#4ade80',
    yellow: '#fde047',
    white: '#ffffff',
    orange: '#fdba74',
    brown: '#d97706',
    violet: '#c4b5fd',
    grey: '#cbd5e1',
    pink: '#f9a8d4',
    cyan: '#67e8f9',
  },
  dark: {
    red: '#fca5a5',
    black: '#94a3b8',
    blue: '#93c5fd',
    green: '#86efac',
    yellow: '#fef08a',
    white: '#ffffff',
    orange: '#fed7aa',
    brown: '#f59e0b',
    violet: '#ddd6fe',
    grey: '#cbd5e1',
    pink: '#fbcfe8',
    cyan: '#a5f3fc',
  },
};
