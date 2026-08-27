import { step } from './solver';
import { emptyState, type Circuit, type Inputs, type SimState } from './types';

export interface ScriptStep {
  label?: string;
  /** Push button id to hold down. */
  press?: string;
  /** Push button id to release. */
  release?: string;
  /** Toggle switch id to flip. */
  toggle?: string;
  /** Open or close the breaker. */
  breaker?: boolean;
  /** Device id -> expected state. */
  expect?: Record<string, 'on' | 'off'>;
}

export interface StepResult {
  label: string;
  ok: boolean;
  detail: string;
}

export interface GradeResult {
  passed: boolean;
  results: StepResult[];
}

/**
 * Replay a script through the same solver the browser uses, so a grade cannot
 * be faked client-side.
 */
export function runScript(circuit: Circuit, script: ScriptStep[]): GradeResult {
  const inputs: Inputs = { breakerClosed: true, pressed: {}, toggled: {} };
  let state: SimState = emptyState();
  const results: StepResult[] = [];

  for (const [i, s] of script.entries()) {
    if (s.breaker !== undefined) inputs.breakerClosed = s.breaker;
    if (s.press) inputs.pressed[s.press] = true;
    if (s.release) inputs.pressed[s.release] = false;
    if (s.toggle) inputs.toggled[s.toggle] = !inputs.toggled[s.toggle];

    const result = step(circuit, inputs, state);
    state = result.state;

    if (!s.expect) continue;

    const misses: string[] = [];
    for (const [deviceId, want] of Object.entries(s.expect)) {
      const got = result.devices[deviceId]?.energized ? 'on' : 'off';
      if (got !== want) misses.push(`${deviceId} expected ${want}, got ${got}`);
    }
    const shorted = result.errors.some((e) => e.code === 'SHORT_CIRCUIT');
    if (shorted) misses.push('short circuit tripped the breaker');

    results.push({
      label: s.label ?? `Step ${i + 1}`,
      ok: misses.length === 0,
      detail: misses.length === 0 ? 'passed' : misses.join('; '),
    });
  }

  return { passed: results.length > 0 && results.every((r) => r.ok), results };
}
