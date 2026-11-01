// The "look" of a scene is one plain object. Presets, saves, undo and share links are all just copies of it.
import { PATTERNS, WARPS, PALETTES, PATTERN_BY_ID, WARP_BY_ID, MAX_INKS } from './catalog.js';
import { FORMULA_PRESETS } from './presets.js';
import { MAX_WARPS } from './shaders.js';

export const DEFAULTS = {
  pattern: 'stripes', density: 12, thickness: 0, param: 0, angle: 0, flow: 0,
  formula: 'sin(x*d)', bendX: '0', bendY: '0',
  warps: [],
  mixMode: 'off', mixPattern: 'stripes', mixDensity: 12, mixParam: 0.5, mixAngle: 8, mixFlow: 0, mixFlat: false,
  speed: 1, zoom: 1, spin: 0, rotate: 0, follow: false,
  soft: 0, depth: 0.3, relief: 0, echo: 0, grain: 0.12, vignette: 0.3, invert: false,
  glow: 0, glowColor: '#d80146', aberr: 0, flicker: 0, weave: 0, letterbox: 0,
  paper: '#f4f3ee', inks: ['#0b0b0b'], fog: '#000000', cycle: 0,
};

// Slider ranges for every numeric top-level setting (used by the UI and by mutate/randomize).
export const RANGES = {
  density: { min: 1, max: 40, step: 0.1 },
  thickness: { min: -0.9, max: 0.9 },
  param: { min: 0, max: 1 },
  angle: { min: -180, max: 180, step: 1 },
  flow: { min: -2, max: 2 },
  speed: { min: 0, max: 3 },
  zoom: { min: 0.2, max: 4 },
  spin: { min: -1, max: 1 },
  soft: { min: 0, max: 1 },
  depth: { min: 0, max: 1 },
  relief: { min: 0, max: 1 },
  echo: { min: 0, max: 0.95 },
  grain: { min: 0, max: 1 },
  vignette: { min: 0, max: 1 },
  cycle: { min: 0, max: 4 },
  rotate: { min: -180, max: 180, step: 1 },
  mixDensity: { min: 1, max: 40, step: 0.1 },
  mixParam: { min: 0, max: 1 },
  mixAngle: { min: -90, max: 90, step: 0.5 },
  mixFlow: { min: -2, max: 2 },
  glow: { min: 0, max: 1.5 },
  aberr: { min: 0, max: 1 },
  flicker: { min: 0, max: 1 },
  weave: { min: 0, max: 1 },
  letterbox: { min: 0, max: 1 },
};

export function warpDefaults(type) {
  const p = WARP_BY_ID[type].params;
  return {
    type, on: true,
    amount: p.amount?.def ?? 0, scale: p.scale?.def ?? 0.5,
    speed: p.speed?.def ?? 0, extra: p.extra?.def ?? 0,
  };
}

export function makeState(partial = {}) {
  const s = { ...structuredClone(DEFAULTS), ...structuredClone(partial) };
  if (partial.palette) {
    const pal = PALETTES.find(p => p.id === partial.palette);
    if (pal) {
      s.paper = partial.paper ?? pal.paper;
      s.inks = partial.inks ? [...partial.inks] : [...pal.inks];
    }
    delete s.palette;
  }
  if (!PATTERN_BY_ID[s.pattern]) s.pattern = 'stripes';
  if (!PATTERN_BY_ID[s.mixPattern] || s.mixPattern === 'formula') s.mixPattern = 'stripes';
  if (partial.param === undefined) s.param = PATTERN_BY_ID[s.pattern].param.def;
  s.warps = (s.warps || []).filter(w => WARP_BY_ID[w.type]).slice(0, MAX_WARPS).map(w => ({ ...warpDefaults(w.type), ...w }));
  s.inks = (s.inks || []).slice(0, MAX_INKS);
  if (!s.inks.length) s.inks = ['#0b0b0b'];
  return s;
}

// Deep copy without the runtime-only fields (warp phases etc. start with _).
export function cloneState(s) {
  return JSON.parse(JSON.stringify(s, (k, v) => (k.startsWith('_') ? undefined : v)));
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

// Small random nudges to everything — press it again and again to "evolve" a look.
export function mutateState(s, amount = 1) {
  const m = cloneState(s);
  const nudge = (v, r, scale = 0.12) => clamp(v + gauss() * (r.max - r.min) * scale * amount, r.min, r.max);
  m.density = nudge(m.density, { min: 2, max: 32 }, 0.08);
  m.thickness = nudge(m.thickness, { min: -0.6, max: 0.6 }, 0.1);
  m.param = nudge(m.param, RANGES.param);
  m.angle = Math.round(nudge(m.angle, RANGES.angle, 0.05));
  if (Math.random() < 0.5) m.flow = nudge(m.flow, { min: -1.2, max: 1.2 }, 0.15);
  m.depth = nudge(m.depth, RANGES.depth, 0.1);
  for (const w of m.warps) {
    const p = WARP_BY_ID[w.type].params;
    for (const key of ['amount', 'scale', 'speed', 'extra']) {
      if (p[key]) w[key] = nudge(w[key], p[key], key === 'speed' ? 0.08 : 0.12);
    }
  }
  if (Math.random() < 0.25 * amount && m.warps.length < 4) m.warps.push(randomWarp(m.warps));
  else if (Math.random() < 0.12 * amount && m.warps.length > 1) m.warps.splice(Math.floor(Math.random() * m.warps.length), 1);
  return makeState(m);
}

const SPACE_WARPS = ['tunnel', 'floor', 'tiles', 'kaleido', 'fold', 'sphere', 'tilt', 'lenses'];

function randomWarp(existing = []) {
  // only one "space-changing" warp at a time, otherwise it turns to mush
  const hasSpace = existing.some(w => SPACE_WARPS.includes(w.type));
  const choices = WARPS.map(w => w.id).filter(id => !(hasSpace && SPACE_WARPS.includes(id)) && !existing.some(e => e.type === id));
  const type = pick(choices.length ? choices : ['wave']);
  const w = warpDefaults(type);
  const p = WARP_BY_ID[type].params;
  for (const key of ['amount', 'scale', 'extra']) {
    if (!p[key]) continue;
    const r = p[key];
    w[key] = clamp(p[key].def + (Math.random() - 0.5) * (r.max - r.min) * 0.6, r.min, r.max);
  }
  w.speed = clamp(p.speed.def * rand(0.3, 1.6) * (Math.random() < 0.2 ? -1 : 1), -2, 2);
  return w;
}

// A completely fresh random look.
export function randomState() {
  const usable = PATTERNS.filter(p => p.id !== 'formula');
  const s = {
    pattern: pick(usable).id,
    density: rand(5, 22),
    thickness: Math.random() < 0.7 ? 0 : rand(-0.4, 0.4),
    param: Math.random(),
    angle: Math.random() < 0.6 ? 0 : pick([45, 90, -30, 15]),
    flow: Math.random() < 0.5 ? 0 : rand(-0.8, 0.8),
    depth: rand(0, 0.6),
    relief: Math.random() < 0.15 ? rand(0.5, 0.9) : 0,
    echo: Math.random() < 0.15 ? rand(0.3, 0.7) : 0,
    soft: Math.random() < 0.12 ? rand(0.2, 0.6) : 0,
    warps: [],
  };
  if (Math.random() < 0.18) {
    s.mixMode = pick(['xor', 'xor', 'and', 'add']);
    s.mixPattern = pick(['stripes', 'rings', 'checker', 'rays']);
    s.mixDensity = rand(6, 24);
    s.mixAngle = rand(-12, 12);
    s.mixFlat = Math.random() < 0.5;
  }
  if (Math.random() < 0.15) {
    const f = pick(FORMULA_PRESETS);
    Object.assign(s, { pattern: 'formula', formula: f.formula, bendX: f.bendX || '0', bendY: f.bendY || '0', density: f.density ?? 10 });
  }
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) s.warps.push(randomWarp(s.warps));
  // put space-changing warps first so the others bend the result
  s.warps.sort((a, b) => SPACE_WARPS.includes(b.type) - SPACE_WARPS.includes(a.type));
  const pal = Math.random() < 0.65 ? PALETTES[Math.random() < 0.8 ? 0 : 1] : pick(PALETTES);
  if (Math.random() < 0.25) { s.glow = rand(0.2, 0.7); s.fog = Math.random() < 0.5 ? '#000000' : '#5e021d'; }
  s.paper = pal.paper;
  s.inks = [...pal.inks];
  s.cycle = pal.inks.length > 1 && Math.random() < 0.5 ? rand(0.3, 1.5) : 0;
  return makeState(s);
}

// ---- share links: state → compressed base64url in the URL hash ----
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeShare(s) {
  const json = new TextEncoder().encode(JSON.stringify(cloneState(s)));
  if (typeof CompressionStream !== 'undefined') return 'z' + b64(await pipe(json, new CompressionStream('deflate-raw')));
  return 'j' + b64(json);
}

export async function decodeShare(str) {
  const bytes = unb64(str.slice(1));
  const json = str[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return makeState(JSON.parse(new TextDecoder().decode(json)));
}
