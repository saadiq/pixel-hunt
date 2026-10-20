// Web Audio effects, ported from the prototype. Audio starts on the first tap (autoplay rules).

type AC = typeof AudioContext;
let actx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let lastBite = 0;
let enabled = true;

export function setEnabled(on: boolean): void {
  enabled = on;
}

/** iOS suspends (or "interrupts") the context after calls, locking and backgrounding; a tap may resume it. */
function wake(ac: AudioContext): void {
  const st = ac.state as AudioContextState | 'interrupted';
  if (st === 'suspended' || st === 'interrupted') ac.resume().catch(() => { /* best effort */ });
}

/** Creates the audio context on the first tap and wakes it on every later one. */
export function ensureAudio(): void {
  if (actx) { wake(actx); return; }
  try {
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext) as AC | undefined;
    if (!Ctor) return;
    actx = new Ctor();
    const len = Math.floor(actx.sampleRate * 0.05);
    noise = actx.createBuffer(1, len, actx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    wake(actx);
  } catch {
    actx = null;
  }
}

/** A short crunch, rate-limited to one per 30ms. */
export function bite(): void {
  if (!enabled || !actx || !noise) return;
  const t = actx.currentTime;
  if (t - lastBite < 0.03) return;
  lastBite = t;
  try {
    const s = actx.createBufferSource();
    s.buffer = noise;
    s.playbackRate.value = 0.75 + Math.random() * 0.6;
    const f = actx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1300 + Math.random() * 1000;
    f.Q.value = 1.1;
    const g = actx.createGain();
    g.gain.value = 0.28;
    s.connect(f).connect(g).connect(actx.destination);
    s.start();
  } catch { /* audio is best effort */ }
}

export function tone(freqs: number[], dur = 0.09, type: OscillatorType = 'triangle', vol = 0.08): void {
  if (!enabled || !actx) return;
  const ac = actx;
  try {
    freqs.forEach((fq, k) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + k * dur;
      o.type = type;
      o.frequency.value = fq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur * 1.7);
    });
  } catch { /* audio is best effort */ }
}
