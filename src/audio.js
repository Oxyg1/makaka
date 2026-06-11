/**
 * Tiny SFX layer using WebAudio — zero asset weight, no HTML5 <audio> tags.
 *
 * Each sound is generated on the fly from oscillators so we keep the build
 * featherweight (important for fast Yandex Games load times). All sounds
 * respect the global `enabled` flag, which is persisted via the storage module.
 */

let ctx = null;
let enabled = true;

function ensureCtx() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  // Some browsers suspend the context until first user gesture.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setEnabled(v) { enabled = !!v; }
export function isEnabled() { return enabled; }

function beep({ freq = 440, dur = 0.15, type = 'sine', vol = 0.12, slide = 0 }) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export const sfx = {
  tap:        () => beep({ freq: 520, dur: 0.06, type: 'square', vol: 0.06 }),
  spawn:      () => beep({ freq: 380, dur: 0.14, type: 'triangle', vol: 0.09, slide: 220 }),
  merge:      () => {
    beep({ freq: 440, dur: 0.10, type: 'triangle', vol: 0.10, slide: 220 });
    setTimeout(() => beep({ freq: 660, dur: 0.18, type: 'sine', vol: 0.10, slide: 200 }), 70);
  },
  discover:   () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep({ freq: f, dur: 0.22, type: 'sine', vol: 0.10 }), i * 90));
  },
  reward:     () => {
    [659, 880].forEach((f, i) => setTimeout(() => beep({ freq: f, dur: 0.18, type: 'triangle', vol: 0.10 }), i * 90));
  },
  fail:       () => beep({ freq: 220, dur: 0.20, type: 'sawtooth', vol: 0.08, slide: -120 })
};
