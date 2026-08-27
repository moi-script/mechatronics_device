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
