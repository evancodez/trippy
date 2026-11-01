// Worlds mode: the film engine, live. You pick a look and everything glides there; you can push sliders
// while it moves, let it auto-morph on the bar, play music into it, and press your own hand through it.
import { PARAMS, PARAM_BY_NAME, RATE_TARGETS, SHADER_COUNT, hexToRgb } from './film/params.js';
import { defaultValues, expand, applyMusic, toShader, toPost, settle, EASE } from './film/timeline.js';
import { LOOKS, look } from './film/looks.js';
import { mulberry32 } from './film/auto.js';

const DEFAULT_VALUES = defaultValues();
const isColor = name => Array.isArray(DEFAULT_VALUES[name]);
const ACCUMULATED = new Set(Object.values(RATE_TARGETS));
const clone = v => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.slice() : x]));

export class World {
  constructor() {
    this.base = defaultValues();        // where we are (no music, no rates)
    this.from = clone(this.base);
    this.to = clone(this.base);
    this.t = 1; this.dur = 1;           // morph progress (seconds)
    this.ease = EASE.inOut;
    this.acc = Object.fromEntries(Object.keys(RATE_TARGETS).map(r => [r, 0]));
    this.P = new Float32Array(SHADER_COUNT);
    this.current = null;                // the values last drawn (after music)
    this.lookId = null;
    this.auto = false;
    this.autoBars = 8;
    this.lastAutoBar = 0;
    this.morphBars = 3;
    this.hand = { on: 0, x: 0, y: 0, press: 0 };
    this.rng = mulberry32((Math.random() * 2 ** 31) | 0);
  }

  // glide everything to a look (a full set of values), over `bars` bars of `barLen` seconds
  morphTo(set, seconds) {
    this.from = this.values();
    const target = clone(this.from);
    for (const [k, x] of Object.entries(expand(set))) {
      if (!PARAM_BY_NAME[k] || ACCUMULATED.has(k)) continue;
      target[k] = isColor(k) ? (Array.isArray(x) ? x : hexToRgb(x)) : x;
    }
    this.to = target;
    this.t = 0;
    this.dur = Math.max(0.05, seconds);
  }

  goLook(id, seconds) {
    this.lookId = id;
    this.morphTo(look(id), seconds);
  }

  // a random look with random tweaks — the "Surprise" of Worlds
  surprise(seconds) {
    const ids = Object.keys(LOOKS);
    const id = ids[Math.floor(this.rng() * ids.length)];
    const s = look(id);
    if (s.freq) s.freq *= 0.75 + this.rng() * 0.6;
    if (this.rng() < 0.35) s.twist = (this.rng() - 0.5) * 2.4;
    if (this.rng() < 0.25) Object.assign(s, { kaleido: 1, kaleidoN: [6, 8, 12][Math.floor(this.rng() * 3)] });
    if (this.rng() < 0.25) Object.assign(s, { check: 0.85, checkA: this.rng() * 3 });
    if (this.rng() < 0.3) Object.assign(s, { pitch: this.rng() * 0.9, focal: 1.6 + this.rng() * 3 });
    this.lookId = id;
    this.morphTo(s, seconds);
    return LOOKS[id].name;
  }

  // nudge the current values a little
  mutate(seconds) {
    const v = this.values();
    const s = {};
    for (const p of PARAMS) {
      if (!p.group || p.kind === 'color' || typeof p.def !== 'number') continue;
      if (['camera', 'film'].includes(p.group) && this.rng() < 0.6) continue;
      if (this.rng() < 0.55) continue;
      const span = (p.max - p.min) * 0.12;
      s[p.name] = Math.min(p.max, Math.max(p.min, v[p.name] + (this.rng() - 0.5) * 2 * span));
    }
    this.morphTo(s, seconds);
  }

  // set one value directly (a slider): it applies now and stays
  set(name, x) {
    const val = isColor(name) ? hexToRgb(x) : x;
    this.to[name] = val;
    this.from[name] = Array.isArray(val) ? val.slice() : val;
  }

  get(name) {
    return this.values()[name];
  }

  values() {
    const k = this.ease(Math.min(1, this.t / this.dur));
    const v = {};
    for (const name of Object.keys(this.to)) {
      const a = this.from[name], b = this.to[name];
      v[name] = Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * k) : a + (b - a) * k;
    }
    return v;
  }

  // one frame. music = { bar, barLen, loud, bass, mid, high, hit, time }
  // hooks.pre(v) runs before speeds are integrated (the macro knobs), hooks.post(v) last (camera, hands)
  frame(dt, music, hooks = {}) {
    this.t += dt;
    const v = this.values();
    hooks.pre?.(v);
    const dBars = dt / (music.barLen || 2);
    for (const [rate, target] of Object.entries(RATE_TARGETS)) {
      this.acc[rate] = settle(rate, this.acc[rate] + v[rate] * dBars, v[rate], dBars, v);
      v[target] += this.acc[rate];
    }
    // your hand, pressing through from behind
    const h = this.hand;
    if (h.on > 0.001) {
      Object.assign(v, {
        h2on: h.on, h2x: h.x, h2y: h.y, h2z: 0.04 + h.press * 0.32, h2s: 1.25, h2a: 0.15,
        h2curl: 0.15 + h.press * 0.9, h2spread: 0.6 - h.press * 0.3,
      });
      v.handSoft = Math.min(v.handSoft, 0.2);
    }
    applyMusic(v, music);
    hooks.post?.(v);
    this.current = v;
    toShader(v, this.P);
    return { P: this.P, post: toPost(v) };
  }

  // auto-morph on the bar
  tickAuto(bar, barLen) {
    if (!this.auto) return null;
    if (bar - this.lastAutoBar >= this.autoBars || bar < this.lastAutoBar) {
      this.lastAutoBar = Math.floor(bar);
      return this.surprise(this.morphBars * barLen);
    }
    return null;
  }
}

