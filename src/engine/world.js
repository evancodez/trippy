// The world, live: where every value is, the glide from one look to the next, speeds added up over time,
// and the music applied every frame.
import { PARAMS, PARAM_BY_NAME, RATE_TARGETS, SHADER_SLOTS, isColorParam, hexToRgb, rgbToHex } from './params.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const frac = x => x - Math.floor(x);
const inOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ACCUMULATED = new Set(Object.values(RATE_TARGETS));
const asValue = (name, x) => (isColorParam(name) ? (Array.isArray(x) ? x.slice() : hexToRgb(x)) : x);
export const cloneValues = v => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.slice() : x]));

export function defaultValues() {
  const v = {};
  for (const p of PARAMS) v[p.name] = asValue(p.name, p.def);
  return v;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor() {
    this.from = defaultValues();
    this.to = defaultValues();
    this.t = 1; this.dur = 1;            // glide progress, seconds
    this.acc = Object.fromEntries(Object.keys(RATE_TARGETS).map(r => [r, 0]));
    this.P = new Float32Array(SHADER_SLOTS.length);
    this.current = null;                 // the values last drawn (after music and add-ons)
  }

  // glide to a set of values (colors as hex or rgb) over `seconds`. Values the set leaves out keep heading
  // where they were going, so a partial set (new colors) doesn't freeze a glide that's under way.
  morphTo(set, seconds) {
    this.from = this.values();
    const target = cloneValues(this.to);
    for (const [k, x] of Object.entries(set)) if (PARAM_BY_NAME[k] && !ACCUMULATED.has(k)) target[k] = asValue(k, x);
    this.to = target;
    this.t = 0;
    this.dur = Math.max(0.05, seconds);
  }

  // set one value now (a slider): it applies at once and stays
  set(name, x) {
    const val = asValue(name, x);
    this.to[name] = val;
    this.from[name] = Array.isArray(val) ? val.slice() : val;
  }

  values() {
    const k = inOut(Math.min(1, this.t / this.dur));
    const v = {};
    for (const name of Object.keys(this.to)) {
      const a = this.from[name], b = this.to[name];
      v[name] = Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * k) : a + (b - a) * k;
    }
    return v;
  }

  // one frame. music = { on, bar, barLen, loud, bass, mid, high, hit, time }
  // hooks.pre(v): before speeds add up (feel knobs, music ties) · hooks.post(v): last (add-ons, the camera)
  frame(dt, music, hooks = {}) {
    this.t += dt;
    const v = this.values();
    hooks.pre?.(v);
    const dBars = dt / (music.barLen || 2);
    for (const [rate, target] of Object.entries(RATE_TARGETS)) {
      this.acc[rate] = settle(rate, this.acc[rate] + v[rate] * dBars, v[rate], dBars, v);
      v[target] += this.acc[rate];
    }
    applyMusic(v, music);
    hooks.post?.(v);
    this.current = v;
    toShader(v, this.P);
    return { P: this.P, post: toPost(v) };
  }
}

// Keep accumulated motion tidy: spins wrap invisibly at a full turn and unwind back to rest when their
// speed goes to zero; flying wraps by a space's own period (invisible inside it) and glides back when it stops.
export function settle(rate, a, speed, dBars, space = {}) {
  if (rate === 'spinRate' || rate === 'orbitRate' || rate === 'objSpin') {
    a -= TAU * Math.round(a / TAU);
    if (Math.abs(speed) < 0.005) a *= Math.exp(-dBars / 1.5);
  } else if (rate === 'swellRate') {
    a -= TAU * Math.round(a / TAU);             // the two rolling waves repeat every full turn
  } else if (rate === 'hueRate') {
    a -= Math.round(a);
    if (Math.abs(speed) < 0.002) a *= Math.exp(-dBars / 1.5);
  } else if (rate === 'flyRate') {
    const period = space.gyro > 0.999 ? TAU / space.gyroS
      : space.sponge > 0.999 ? 2 / space.spaceS
        : 0;
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

// The music, every frame: the bar drives the sway, loudness the intensity (never the speed), bass the thump.
export function applyMusic(v, m) {
  const sway = m.known ? m.sway * 0.8 : Math.sin(m.bar * TAU);
  const down = Math.exp(-frac(m.bar) * 6);
  v.roll += v.sway * 0.07 * sway;
  v.tx += v.swayX * 0.05 * Math.sin(m.bar * Math.PI) * v.frame;
  v.frame *= 1 - v.pulse * 0.04 * (m.kick ?? 0) * down;
  const I = clamp(1 + (m.loud - 0.5) * v.react, 0.3, 1.9);
  for (const k of ['folds', 'wave', 'twist', 'bulge', 'warpN', 'orbs', 'ripple', 'vortex', 'swell']) v[k] *= I;
  v.height *= 1 + v.breathe * 0.25 * sway;
  const close = 0.5 - 0.5 * Math.cos(m.bar * TAU);
  for (let i = 0; i < 2; i++) v[`h${i}curl`] += v.grab * 0.75 * close + 0.05 * Math.sin(m.time * 1.7 + i * 2.1);
  v.mouth = clamp((m.voice ?? m.mid) * 1.25 - 0.2, 0, 1);
  v.eyes = blink(m.bar, m.barLen || 2);
  v.exposure += v.hitFlash * m.hit * 0.55;
  v.time = m.time;
  return v;
}

// How steep can the sheet get? (a safe step for the ray marcher; gentle sheets march faster)
export function stepFactor(v) {
  const slope = v.folds * 0.09 * v.foldF * v.height + v.face * 0.9 * v.height + v.ripple * 0.9
    + v.media * 1.3 * v.height + v.sland * 1.6 * v.height + v.swell * 0.2 * v.swellF * v.height + (v.ori + v.stud) * 0.6 * v.height + v.mland * 0.5 * v.height + 0.15;
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
  return { glow: v.glow, glowColor: rgbToHex(v.glowColor), grain: v.grain, vignette: v.vignette, aberr: v.aberr };
}
