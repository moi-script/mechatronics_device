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
  | 'SOLENOID'
  | 'CYLINDER'
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
  /**
   * Named coils, for parts carrying more than the plain VCC/GND pair — the
   * double-acting cylinder's extend and retract solenoids, for instance.
   * Their state is keyed "moduleId.coilId"; the plain pair is keyed "moduleId".
   */
  coils?: { id: string; vcc: string; gnd: string }[];
}

export interface ModuleInstance {
  id: string;
  type: ModuleType;
  x: number;
  y: number;
  /** Timer set point, in seconds. TIMER only; omitted means the default. */
  delaySec?: number;
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
}

export interface Inputs {
  breakerClosed: boolean;
  /** Wall clock in ms, the only thing the on-delay timers run on. */
  now: number;
  /** Push button module ids currently held down. */
  pressed: Record<string, boolean>;
  /** Toggle switch module ids currently flipped. */
  toggled: Record<string, boolean>;
}

export interface SimState {
  /** Coil state carried between steps so relay feedback settles. */
  coil: Record<string, boolean>;
  /**
   * Piston id -> rod extended. A double-acting cylinder holds its last
   * position when both solenoids drop, so it has to be remembered.
   */
  rod: Record<string, boolean>;
  /**
   * Timer id -> the instant its coil went live. A timer counts from here and
   * loses the count the moment its coil drops, exactly like the bench unit.
   */
  timerStart: Record<string, number>;
}

export interface DeviceState {
  /** Lamp lit, or coil energized. */
  energized: boolean;
  /** Contacts thrown: COM conducts to NO instead of NC. */
  actuated: boolean;
}

/** What one on-delay timer is doing right now, for the module face. */
export interface TimerState {
  /** Set point in ms. */
  delayMs: number;
  /** ms left to run; 0 once the contact has made. */
  remainingMs: number;
  /** Coil live but not yet timed out. */
  running: boolean;
  /** Timed out: COM is fed. */
  done: boolean;
}

/** What one double-acting cylinder is doing, for the module face. */
export interface PistonState {
  /** Rod out. This is the position it is moving to, not where it is drawn. */
  extended: boolean;
  extendCoil: boolean;
  retractCoil: boolean;
  /** Both solenoids energized at once: the valve is stalled and it holds. */
  stalled: boolean;
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
  /** Timer id -> its countdown, for the module face. */
  timers: Record<string, TimerState>;
  /** Cylinder id -> its rod position and solenoid states. */
  pistons: Record<string, PistonState>;
  /**
   * ms until a running timer would next change the board, or null when
   * nothing is on the clock. The UI re-solves on this to keep the sim honest.
   */
  nextTickMs: number | null;
  errors: SimError[];
  /** A short circuit tripped the breaker; everything is dead. */
  faulted: boolean;
  state: SimState;
}

export const emptyState = (): SimState => ({ coil: {}, timerStart: {}, rod: {} });