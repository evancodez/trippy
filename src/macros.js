// Four big knobs that each move dozens of settings at once, plus breeding: make 9 children of a look.
// Knobs go 0..1 with 0.5 = "leave it as it is".
import { PARAMS, PARAM_BY_NAME, hexToRgb, rgbToHex } from './film/params.js';
import { LOOKS, look, CHERRY } from './film/looks.js';
import { mulberry32 } from './film/auto.js';
import { WARP_BY_ID, WARPS, PATTERNS, PALETTES } from './catalog.js';
import { warpDefaults } from './state.js';

export const MACROS = [
  { id: 'wild', left: 'Calm', right: 'Wild' },
  { id: 'deep', left: 'Flat', right: 'Deep' },
  { id: 'color', left: 'Mono', right: 'Color' },
  { id: 'move', left: 'Still', right: 'Moving' },
];
export const defaultMacros = () => ({ wild: 0.5, deep: 0.5, color: 0.5, move: 0.5, accent: CHERRY });

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mixRGB = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const gray = c => { const l = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114; return [l, l, l]; };
const lum = c => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;

// ---------------------------------------------------------------- the film world
export function applyMacrosWorld(v, m) {
  const w = (m.wild - 0.5) * 2, d = (m.deep - 0.5) * 2, c = (m.color - 0.5) * 2, mv = (m.move - 0.5) * 2;
  if (w) {
    const k = w > 0 ? 1 + w * 1.6 : 1 + w * 0.9;
    for (const key of ['twist', 'bulge', 'wave', 'warpN', 'folds', 'orbs', 'ripple']) v[key] *= k;
    v.react *= Math.max(0.15, k);
    v.sway *= Math.max(0, 1 + w);
    if (w > 0) {
      v.warpN += w * 0.35;
      v.twist += w * 0.9;
      v.wave += w * 0.5;
      v.freq *= 1 + w * 0.2;
      v.aberr += w * 0.25;
      v.hitFlash += w * 0.4;
    }
  }
  if (d > 0) {
    v.focal = lerp(v.focal, 1.4, d * 0.75);
    if (v.pitch < 0.55) v.pitch = lerp(v.pitch, 0.55, d * 0.6);
    v.light = lerp(v.light, 1, d);
    v.engrave = lerp(v.engrave, 1.1, d);
    v.refract += d * 0.8;
    v.height *= 1 + d * 1.2;
    v.fogD += d * 0.25;
  } else if (d < 0) {
    const f = -d;
    v.focal = lerp(v.focal, 11, f);
    v.pitch *= 1 - f;
    v.light *= 1 - f;
    v.engrave *= 1 - f;
    v.height *= 1 - f * 0.9;
    v.refract *= 1 - f;
  }
  if (c < 0) {
    const f = -c;
    v.paper = mixRGB(v.paper, gray(v.paper), f);
    v.ink = mixRGB(v.ink, gray(v.ink), f);
    v.fog = mixRGB(v.fog, gray(v.fog), f);
    v.glow *= 1 - f;
  } else if (c > 0) {
    const acc = hexToRgb(m.accent || CHERRY);
    const deep = acc.map(x => x * 0.12);
    // the lighter of paper/ink takes the accent, the darker sinks toward a deep version of it
    if (lum(v.ink) > lum(v.paper)) { v.ink = mixRGB(v.ink, acc, c); v.paper = mixRGB(v.paper, deep, c * 0.8); }
    else { v.paper = mixRGB(v.paper, mixRGB(acc, [1, 1, 1], 0.15), c * 0.85); v.ink = mixRGB(v.ink, deep, c * 0.5); }
    v.fog = mixRGB(v.fog, deep, c);
    v.glow = lerp(v.glow, 0.8, c);
    v.glowColor = mixRGB(v.glowColor, acc, c);
  }
  if (mv) {
    const k = mv > 0 ? 1 + mv * 2 : 1 + mv;
    for (const key of ['flow', 'spinRate', 'orbitRate', 'flyRate', 'objSpin']) v[key] *= k;
    if (mv > 0) { v.flow += mv * 0.6 * Math.sign(v.flow || 1); v.spinRate += mv * 0.05; }
    v.sway *= Math.max(0, 1 + mv);
    v.grab *= Math.max(0, 1 + mv);
    v.breathe = clamp(v.breathe + Math.max(0, mv) * 0.5, 0, 1);
  }
  return v;
}

// ---------------------------------------------------------------- patterns
export function applyMacrosPatterns(s, m) {
  const w = (m.wild - 0.5) * 2, d = (m.deep - 0.5) * 2, c = (m.color - 0.5) * 2, mv = (m.move - 0.5) * 2;
  if (!w && !d && !c && !mv) return s;
  const out = { ...s, warps: s.warps.map(x => ({ ...x })) };
  if (w) {
    const k = w > 0 ? 1 + w * 1.4 : 1 + w * 0.9;
    for (const x of out.warps) if (WARP_BY_ID[x.type]?.reactive) x.amount = clamp(x.amount * k, -1, 1);
    out.density *= 1 + w * 0.25;
    if (w > 0) out.aberr = (out.aberr || 0) + w * 0.3;
  }
  if (d) {
    out.depth = clamp(out.depth + d * 0.6, 0, 1);
    out.relief = clamp(out.relief + Math.max(0, d) * 0.7, 0, 1);
    if (d < 0) out.relief *= 1 + d;
  }
  if (c) {
    const P = hexToRgb(out.paper), acc = hexToRgb(m.accent || CHERRY);
    if (c < 0) {
      out.paper = rgbToHex(mixRGB(P, gray(P), -c));
      out.inks = out.inks.map(x => { const I = hexToRgb(x); return rgbToHex(mixRGB(I, gray(I), -c)); });
    } else {
      const dark = lum(P) < 0.5;
      out.paper = rgbToHex(dark ? mixRGB(P, acc.map(x => x * 0.12), c) : mixRGB(P, mixRGB(acc, [1, 1, 1], 0.2), c * 0.8));
      out.inks = out.inks.map(x => rgbToHex(mixRGB(hexToRgb(x), dark ? acc : acc.map(y => y * 0.25), c * 0.9)));
      out.glow = clamp((out.glow || 0) + c * 0.6, 0, 1.5);
      out.glowColor = m.accent || CHERRY;
    }
  }
  if (mv) out.speed = clamp(out.speed * (mv > 0 ? 1 + mv * 1.5 : 1 + mv), 0, 3);
  return out;
}

// ---------------------------------------------------------------- breeding
const gauss = r => (r() + r() + r() - 1.5) * 1.15;
const GROUP_LOCKS = {
  colors: ['look', 'film'],
  camera: ['camera'],
  shapes: ['shape', 'space', 'objects'],
  lines: ['lines', 'bend'],
};
const WORLD_PALETTES = [
  { paper: '#f2f0ea', ink: '#0b0b0b' }, { paper: '#050505', ink: '#ecebe6' }, { paper: '#070203', ink: CHERRY, glow: 0.7 },
  { paper: '#f1ece4', ink: CHERRY }, { paper: '#08123d', ink: '#e7efff' }, { paper: '#0a0a0a', ink: '#c8ff2e', glow: 0.4 },
  { paper: '#5e021d', ink: '#df0149', glow: 0.5 }, { paper: '#e8e0cc', ink: '#1e1b18' },
];
const FEATURES = [
  { gyro: 1 }, { sponge: 1 }, { kifs: 1 }, { columns: 1, pitch: 1.15, focal: 1.6 }, { orbs: 1 },
  { penrose: 1 }, { mobius: 1 }, { rings: 1 }, { folds: 1.2 },
  { h0: { on: 1, x: -0.25, y: -0.15, z: 0.12, s: 1.2, a: 0.2, curl: 0.3, spread: 0.6 }, grab: 0.5 },
  { check: 0.85 }, { wAng: 1, wRad: 1, wLin: 0 }, { kaleido: 1 }, { moire: 1, wRad: 1, wLin: 0 },
  { radInv: 1, wRad: 1, wLin: 0 }, { pitch: 1.1, focal: 1.8 },
];
const SPACE_KEYS = ['gyro', 'sponge', 'kifs'];
const OBJECT_KEYS = ['penrose', 'mobius', 'rings'];

// parent: full world values (colors as rgb arrays) → a child set, ready for world.morphTo()
export function breedWorld(parent, strength = 0.5, locks = {}, seed = Math.random() * 1e9) {
  const r = mulberry32(seed | 0);
  const locked = new Set(Object.entries(locks).filter(([, on]) => on).flatMap(([k]) => GROUP_LOCKS[k]));
  const child = {};
  for (const [k, x] of Object.entries(parent)) child[k] = Array.isArray(x) ? rgbToHex(x) : x;
  // sometimes lean toward a whole other look
  if (r() < 0.35 * strength + 0.1) {
    const ids = Object.keys(LOOKS);
    const other = look(ids[Math.floor(r() * ids.length)]);
    const t = 0.3 + r() * 0.6 * strength;
    for (const [k, x] of Object.entries(other)) {
      const p = PARAM_BY_NAME[k];
      if (!p || locked.has(p.group) || typeof x !== 'number' || typeof child[k] !== 'number') continue;
      child[k] = lerp(child[k], x, t);
    }
  }
  // nudge numbers
  for (const p of PARAMS) {
    if (!p.group || locked.has(p.group) || typeof p.def !== 'number' || ['media', 'music'].includes(p.group)) continue;
    if (r() > 0.25 + strength * 0.35) continue;
    child[p.name] = clamp(child[p.name] + gauss(r) * (p.max - p.min) * 0.1 * strength, p.min, p.max);
  }
  for (const k of ['spokes', 'kaleidoN']) child[k] = Math.round(child[k]);
  // switch features on and off
  if (!locked.has('shape') && r() < 0.45 * strength + 0.15) {
    const f = FEATURES[Math.floor(r() * FEATURES.length)];
    if (SPACE_KEYS.some(k => f[k])) SPACE_KEYS.forEach(k => { child[k] = 0; });
    if (OBJECT_KEYS.some(k => f[k])) OBJECT_KEYS.forEach(k => { child[k] = 0; });
    Object.assign(child, f);
  }
  if (!locked.has('shape') && r() < 0.3 * strength) { SPACE_KEYS.forEach(k => { child[k] = 0; }); OBJECT_KEYS.forEach(k => { child[k] = 0; }); }
  if (!locked.has('look') && r() < 0.25 + strength * 0.2) Object.assign(child, WORLD_PALETTES[Math.floor(r() * WORLD_PALETTES.length)]);
  child.face = parent.face > 0.05 ? parent.face : 0;      // faces are a special guest, not bred in
  return child;
}

// patterns state → a child state
export function breedPatterns(parent, strength, mutateState, randomState, seed = Math.random() * 1e9) {
  const r = mulberry32(seed | 0);
  if (r() < 0.12 * strength) return randomState();
  let child = mutateState(parent, 0.4 + strength * 1.4);
  if (r() < 0.3 * strength) {
    const ids = PATTERNS.filter(p => p.id !== 'formula');
    child.pattern = ids[Math.floor(r() * ids.length)].id;
  }
  if (r() < 0.25 * strength && child.warps.length < 5) child.warps.push(warpDefaults(WARPS[Math.floor(r() * WARPS.length)].id));
  if (r() < 0.2 + strength * 0.2) {
    const pal = PALETTES[Math.floor(r() * PALETTES.length)];
    child.paper = pal.paper;
    child.inks = [...pal.inks];
  }
  return child;
}
