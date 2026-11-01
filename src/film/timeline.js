// Keyframes → per-parameter tracks. A key says "starting at bar N, glide these values to here over M bars".
// Every parameter has its own track, so several things can morph at once, overlapping freely.
import { PARAMS, PARAM_BY_NAME, DEFAULTS, RATE_TARGETS, SHADER_SLOTS, hexToRgb, rgbToHex } from './params.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const frac = x => x - Math.floor(x);

export const EASE = {
  linear: x => x,
  inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  smooth: x => x * x * (3 - 2 * x),
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  expo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
};

const isColor = name => typeof DEFAULTS[name] === 'string';
const asValue = (name, v) => (isColor(name) ? (Array.isArray(v) ? v : hexToRgb(v)) : v);
const lerp = (a, b, t) => (Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * t) : a + (b - a) * t);

// { h0: { on, x, … } } → { h0on, h0x, … }
export function expand(set) {
  const out = {};
  for (const [k, v] of Object.entries(set || {})) {
    if (/^h[0-2]$/.test(k) && v && typeof v === 'object') for (const [f, x] of Object.entries(v)) out[`${k}${f}`] = x;
    else out[k] = v;
  }
  return out;
}

export function defaultValues() {
  const v = {};
  for (const p of PARAMS) v[p.name] = asValue(p.name, p.def);
  return v;
}

export class Timeline {
  // def = { bpm, offset, beatsPerBar, downbeat, duration, keys: [{ bar, morph, ease, set, chapter }] }
  constructor(def) {
    this.def = def;
    this.beatLen = 60 / def.bpm;
    this.barLen = this.beatLen * (def.beatsPerBar || 2);
    this.barZero = def.offset + (def.downbeat || 0) * this.beatLen;
    this.duration = def.duration;
    this.tracks = {};
    const keys = [...def.keys].sort((a, b) => a.bar - b.bar);
    for (const k of keys) {
      const t0 = k.bar <= 0 && !(k.morph > 0) ? -1 : this.barT(k.bar);   // the opening look holds from the very first frame
      const t1 = t0 + Math.max(0, k.morph ?? 2) * this.barLen;
      const ease = EASE[k.ease || 'inOut'];
      for (const [name, raw] of Object.entries(expand(k.set))) {
        if (!PARAM_BY_NAME[name]) { console.warn('unknown film param', name); continue; }
        const from = this.valueAt(name, t0);
        (this.tracks[name] ||= []).push({ t0, t1, from, to: asValue(name, raw), ease });
      }
    }
    this.chapters = keys.filter(k => k.chapter).map(k => ({ ...k.chapter, bar: k.bar, at: k.bar <= 0 ? 0 : this.barT(k.bar) }));
    this.integrate();
  }

  barT(bar) { return this.barZero + bar * this.barLen; }

  valueAt(name, t) {
    let v = asValue(name, DEFAULTS[name]);
    for (const s of this.tracks[name] || []) {
      if (t < s.t0) break;
      v = t >= s.t1 ? s.to : lerp(s.from, s.to, s.ease((t - s.t0) / (s.t1 - s.t0)));
    }
    return v;
  }

  // speeds are "per bar"; add them up over time so changing a speed never makes things jump
  integrate() {
    this.step = 1 / 30;
    const n = Math.ceil((this.duration + 2) / this.step) + 1;
    this.acc = {};
    for (const rate of Object.keys(RATE_TARGETS)) {
      const a = new Float32Array(n);
      for (let i = 1; i < n; i++) {
        const t = (i - 1) * this.step;
        const space = { gyro: this.valueAt('gyro', t), gyroS: this.valueAt('gyroS', t), sponge: this.valueAt('sponge', t), kifs: this.valueAt('kifs', t), spaceS: this.valueAt('spaceS', t) };
        a[i] = settle(rate, a[i - 1] + this.valueAt(rate, t) * this.step / this.barLen, this.valueAt(rate, t), this.step / this.barLen, space);
      }
      this.acc[rate] = a;
    }
  }

  accAt(rate, t) {
    const a = this.acc[rate], x = Math.max(0, t) / this.step, i = Math.floor(x);
    if (i >= a.length - 1) return a[a.length - 1];
    return a[i] + (a[i + 1] - a[i]) * (x - i);
  }

  values(t) {
    const v = {};
    for (const p of PARAMS) v[p.name] = this.valueAt(p.name, t);
    for (const [rate, target] of Object.entries(RATE_TARGETS)) v[target] += this.accAt(rate, t);
    return v;
  }

  chapterAt(t) {
    let i = -1;
    this.chapters.forEach((c, k) => { if (c.at <= t + 1e-3) i = k; });
    return i;
  }
}

// Keep accumulated motion tidy: spins and orbits wrap invisibly at a full turn and unwind back to rest
// when their speed returns to zero; flight wraps by the lattice's own period (invisible inside it)
// and glides back out when it stops. `dBars` is the time step in bars.
export function settle(rate, a, speed, dBars, space = {}) {
  if (rate === 'spinRate' || rate === 'orbitRate' || rate === 'objSpin') {
    a -= Math.PI * 2 * Math.round(a / (Math.PI * 2));
    if (Math.abs(speed) < 0.005) a *= Math.exp(-dBars / 1.5);
  } else if (rate === 'flyRate') {
    // inside a periodic space, flying one period forward looks exactly the same: wrap it
    const period = space.gyro > 0.999 ? (Math.PI * 2) / space.gyroS
      : space.sponge > 0.999 ? 2 / space.spaceS
        : space.kifs > 0.999 ? 4 / space.spaceS : 0;
    if (period) a -= period * Math.round(a / period);
    if (Math.abs(speed) < 1e-4) a *= Math.exp(-dBars / 1.2);
  }
  return a;
}

// eyes close briefly at the end of every 8 bars
function blink(bar, barLen) {
  const tc = frac(bar / 8) * 8 * barLen;
  const x = (tc - (8 * barLen - 0.3)) / 0.3;
  return x > 0 && x < 1 ? Math.abs(x * 2 - 1) : 1;
}

// The music, every frame. m = { bar, barLen, loud, bass, mid, high, hit, time }
export function applyMusic(v, m) {
  const sway = Math.sin(m.bar * TAU);
  const down = Math.exp(-frac(m.bar) * 6);
  v.roll += v.sway * 0.07 * sway;
  v.tx += v.swayX * 0.05 * Math.sin(m.bar * Math.PI) * v.frame;
  v.frame *= 1 - v.pulse * 0.08 * m.bass * m.bass * down;
  const I = clamp(1 + (m.loud - 0.5) * v.react, 0.3, 1.9);
  for (const k of ['folds', 'wave', 'twist', 'bulge', 'warpN', 'orbs', 'ripple']) v[k] *= I;
  v.height *= 1 + v.breathe * 0.25 * sway;
  const close = 0.5 - 0.5 * Math.cos(m.bar * TAU);
  for (let i = 0; i < 3; i++) {
    v[`h${i}curl`] += v.grab * 0.75 * close + 0.05 * Math.sin(m.time * 1.7 + i * 2.1);
    v[`h${i}z`] += v.grab * 0.03 * down * v[`h${i}s`];
  }
  v.mouth = clamp(m.mid * 1.25 - 0.2, 0, 1);
  v.eyes = blink(m.bar, m.barLen || 2);
  v.exposure += v.hitFlash * m.hit * 0.55;
  v.kifsA += 0.14 * Math.sin(m.bar * TAU / 16);               // the crystals keep refolding, slowly
  v.time = m.time;
  return v;
}

// How steep can the membrane get? (a safe step size for the ray marcher; gentle sheets march faster)
export function stepFactor(v) {
  const slope = v.folds * 0.09 * v.foldF * v.height + v.face * 0.9 * v.height + v.ripple * 0.9 + (v.media || 0) * 1.3 * v.height + (v.sland || 0) * 1.6 * v.height + 0.15;
  return Math.min(0.92, Math.max(0.4, 0.92 / Math.sqrt(1 + slope * slope)));
}

export function toShader(v, out) {
  SHADER_SLOTS.forEach((s, i) => {
    const x = v[s.name];
    out[i] = s.channel == null ? x : x[s.channel];
  });
  return out;
}

export function toPost(v) {
  return {
    glow: v.glow, glowColor: rgbToHex(v.glowColor), grain: v.grain, vignette: v.vignette,
    letterbox: v.letterbox, aberr: v.aberr, flicker: v.flicker, weave: v.weave,
  };
}
