/** Every pin carries a role the solver understands. */
export type PinRole =
  | 'SOURCE_VCC'
  | 'SOURCE_GND'
  | 'LOAD_VCC'
  | 'LOAD_GND'
  | 'COM'
  | 'NO'
  | 'NC';

export type ModuleType =
  | 'BREAKER'
  | 'SUPPLY'
  | 'PUSHBTN'
  | 'TOGGLE'
  | 'LAMP'
  | 'RELAY'
  | 'BIGRELAY'
  | 'TIMER';

export interface PinDef {
  id: string;
  label: string;
  role: PinRole;
  /** Contact line this pin belongs to; only meaningful for COM/NO/NC. */
  line?: number;
  /** Position relative to the module's top-left corner. */
  x: number;
  y: number;
}

export interface PartDef {
  type: ModuleType;
  label: string;
  width: number;
  height: number;
  pins: PinDef[];
  /** Number of NO/COM/NC lines this part switches. */
  contactLines: number;
  /** True when the part has a LOAD_VCC/LOAD_GND pair that drives something. */
  hasCoil: boolean;
}

export interface ModuleInstance {
  id: string;
  type: ModuleType;
  x: number;
  y: number;
}

export const WIRE_COLORS = ['blue', 'green', 'red', 'black', 'yellow'] as const;
export type WireColor = (typeof WIRE_COLORS)[number];

export type WireEnd = 'A' | 'B';

/**
 * Where one end of a wire is plugged in. Each end carries a female (which goes
 * onto the target) and a male (which another end's female may stack onto).
 */
export type EndRef =
  | { kind: 'terminal'; moduleId: string; pinId: string }
  | { kind: 'stack'; wireId: string; end: WireEnd }
  | { kind: 'loose'; x: number; y: number };

export interface Wire {
  id: string;
  color: WireColor;
  a: EndRef;
  b: EndRef;
}

export interface Circuit {
  modules: ModuleInstance[];
  wires: Wire[];
  /** ON-delay of the timer module, in milliseconds. */
  timerDelayMs: number;
}

export interface Inputs {
  breakerClosed: boolean;
  /** Push button module ids currently held down. */
  pressed: Record<string, boolean>;
  /** Toggle switch module ids currently flipped. */
  toggled: Record<string, boolean>;
}

export interface SimState {
  /** Time each timer's coil has been continuously energized. */
  timerElapsedMs: Record<string, number>;
  /** Coil state carried between steps so relay feedback settles. */
  coil: Record<string, boolean>;
}

export interface DeviceState {
  /** Lamp lit, or coil energized. */
  energized: boolean;
  /** Contacts thrown: COM conducts to NO instead of NC. */
  actuated: boolean;
}

export type SimErrorCode = 'SHORT_CIRCUIT' | 'REVERSED_POLARITY';

export interface SimError {
  code: SimErrorCode;
  message: string;
  netId?: number;
  moduleId?: string;
  pinId?: string;
}

export interface NetInfo {
  id: number;
  hot: boolean;
  gnd: boolean;
  /** Node keys belonging to this net: "module.pin" and "~wire.END". */
  nodes: string[];
}

export interface SimResult {
  nets: NetInfo[];
  /** "moduleId.pinId" -> net id */
  pinNet: Record<string, number>;
  /** wire id -> net id */
  wireNet: Record<string, number>;
  devices: Record<string, DeviceState>;
  errors: SimError[];
  /** A short circuit tripped the breaker; everything is dead. */
  faulted: boolean;
  state: SimState;
}

export const emptyState = (): SimState => ({ timerElapsedMs: {}, coil: {} });
