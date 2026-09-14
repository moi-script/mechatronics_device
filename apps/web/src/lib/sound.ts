/**
 * Panel sounds, synthesised so the app carries no audio assets.
 *
 * A switch click is a short burst of filtered noise, not a tone: the transient
 * is what the ear reads as a mechanical contact. Press is brighter and louder
 * than release, which is how a real momentary button behaves.
 */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;

type WindowWithWebkit = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    // Browsers start the context suspended until a gesture; a click is one.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const frames = Math.floor(ac.sampleRate * 0.05);
    noiseBuffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** One filtered noise transient: the click itself. */
function tick(frequency: number, duration: number, peak: number): void {
  if (muted) return;
  const ac = context();
  if (!ac) return;

  try {
    const source = ac.createBufferSource();
    source.buffer = noise(ac);

    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency;
    band.Q.value = 1.1;

    const gain = ac.createGain();
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(band).connect(gain).connect(ac.destination);
    source.start(t);
    source.stop(t + duration + 0.02);
  } catch {
    // Audio is a nicety; never let it break an interaction.
  }
}

/** The button going down. */
export const clickDown = (): void => tick(2400, 0.022, 0.22);

/** The button coming back up: softer and duller. */
export const clickUp = (): void => tick(1500, 0.016, 0.12);

/** Three beeps when the practice timer runs out. */
export function alarm(): void {
  if (muted) return;
  const ac = context();
  if (!ac) return;

  try {
    for (const at of [0, 0.28, 0.56]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ac.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.18);
      osc.connect(gain).connect(ac.destination);
      osc.start(ac.currentTime + at);
      osc.stop(ac.currentTime + at + 0.2);
    }
  } catch {
    // The visual alarm still fires.
  }
}

/** Set from the sound preference so muting reaches the audio layer directly. */
export const setMuted = (value: boolean): void => {
  muted = value;
};

let airBuffer: AudioBuffer | null = null;

/** A second of white noise, long enough for a full valve blast. */
function airNoise(ac: AudioContext): AudioBuffer {
  if (!airBuffer) {
    const frames = Math.floor(ac.sampleRate * 1.0);
    airBuffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = airBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  }
  return airBuffer;
}

/**
 * Compressed air through a valve: a hard-edged noise burst whose band sweeps
 * down as the pressure spends itself. Extending is the loud one — the full
 * supply slamming into the cylinder, ending in the thud of the piston hitting
 * the end cap. Retracting is the quieter exhaust hiss out of the silencer.
 */
export function airBlast(extend: boolean): void {
  if (muted) return;
  const ac = context();
  if (!ac) return;

  try {
    const t = ac.currentTime;
    const length = extend ? 0.75 : 0.55;
    const peak = extend ? 0.9 : 0.35;

    const source = ac.createBufferSource();
    source.buffer = airNoise(ac);

    // Strip the rumble so it reads as air, then sweep the band down with the pressure.
    const high = ac.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 500;

    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(extend ? 5200 : 4200, t);
    band.frequency.exponentialRampToValueAtTime(extend ? 1400 : 1800, t + length);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);

    source.connect(high).connect(band).connect(gain).connect(ac.destination);
    source.start(t);
    source.stop(t + length + 0.05);

    // The piston landing on the end cap, a stroke's length after the valve opens.
    if (extend) {
      const hit = t + 0.62;
      const thud = ac.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(140, hit);
      thud.frequency.exponentialRampToValueAtTime(55, hit + 0.12);
      const thudGain = ac.createGain();
      thudGain.gain.setValueAtTime(0.0001, hit);
      thudGain.gain.exponentialRampToValueAtTime(0.7, hit + 0.004);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.16);
      thud.connect(thudGain).connect(ac.destination);
      thud.start(hit);
      thud.stop(hit + 0.2);
    }
  } catch {
    // The rod still moves on screen.
  }
}
