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
  plate: ['#2c3849', '#242f3e', '#1b2431'],
  backplate: ['#1b2431', '#141b26'],
  boardStroke: '#3d4b5e',
  moduleStroke: '#3d4b5e',
  bevelLight: '#54637a',
  bevelDark: '#0e141d',

  legendBg: '#0b1119',
  legendText: '#e2e8f0',
  legendTag: '#7d8fa3',

  ink: '#e8eef5',
  label: '#94a5b8',

  recess: '#1b2431',
  recessStroke: '#46566b',
  recessInner: '#131a24',
  chrome: ['#8a99ad', '#5a6b81', '#38455a'],
  housing: ['#33404f', '#232d3b'],
  housingInner: '#2b3746',
  lensOff: ['#2f3b4a', '#1d2632'],
  lensOn: ['#fffbe8', '#fcd34d', '#c2410c'],
  brass: ['#f6dfa4', '#c99a34', '#7a5c10'],
  screwFill: '#46566b',
  screwStroke: '#6a7c93',
  screwSlot: '#8496ab',
  ledOff: '#33404f',

  amber: '#f59e0b',
  blue: '#38bdf8',
  green: '#22c55e',
  red: '#f05252',
  neutral: '#8496ab',

  titleFace: '#141b26',
  titleBar: '#0b1119',
  titleBarText: '#e2e8f0',
  titleRule: '#46566b',

  plugPin: '#3a2c08',
  cableShadow: '#000000',
  cableShadowOpacity: 0.5,
  glowOpacity: 0.45,
};

export const paletteFor = (mode: Mode): Palette => (mode === 'dark' ? DARK : LIGHT);

/** Lead colours. The dark set is lifted so a black lead still reads on a dark panel. */
export const WIRE_BY_MODE: Record<Mode, Record<WireColor, string>> = {
  light: { blue: '#1d4ed8', green: '#15803d', red: '#dc2626', black: '#1e293b', yellow: '#ca8a04' },
  dark: { blue: '#3b82f6', green: '#22c55e', red: '#ef4444', black: '#5b6b80', yellow: '#eab308' },
};

/** The lengthwise highlight that makes each lead read as round cable. */
export const WIRE_HI_BY_MODE: Record<Mode, Record<WireColor, string>> = {
  light: { blue: '#60a5fa', green: '#4ade80', red: '#fca5a5', black: '#64748b', yellow: '#fde047' },
  dark: { blue: '#93c5fd', green: '#86efac', red: '#fca5a5', black: '#94a3b8', yellow: '#fef08a' },
};
