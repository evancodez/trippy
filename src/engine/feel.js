// The feel knobs (each moves many settings at once; 0.5 = leave the look as it is) and breeding (Explore).
import { PARAMS, PARAM_BY_NAME, rgbToHex } from './params.js';
import { LOOKS, look, PALETTES } from './looks.js';
import { mulberry32 } from './world.js';

export const KNOBS = [
  { id: 'wild', left: 'Calm', right: 'Wild' },
  { id: 'move', left: 'Still', right: 'Moving' },
  { id: 'bold', left: 'Thin', right: 'Bold' },
];
export const defaultFeel = () => ({ wild: 0.5, move: 0.5, bold: 0.5 });
export const feelMoved = f => KNOBS.some(k => Math.abs(f[k.id] - 0.5) > 0.01);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function applyFeel(v, f) {
  const w = (f.wild - 0.5) * 2, mv = (f.move - 0.5) * 2, b = (f.bold - 0.5) * 2;
  if (w) {
    const k = w > 0 ? 1 + w * 1.6 : 1 + w * 0.9;
    for (const key of ['twist', 'vortex', 'bulge', 'wave', 'warpN', 'folds', 'orbs', 'ripple']) v[key] *= k;
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
  if (mv) {
    const k = mv > 0 ? 1 + mv * 2 : 1 + mv;
    for (const key of ['flow', 'spinRate', 'orbitRate', 'flyRate', 'objSpin', 'hueRate']) v[key] *= k;
    if (mv > 0) { v.flow += mv * 0.6 * Math.sign(v.flow || 1); v.spinRate += mv * 0.05; }
    v.sway *= Math.max(0, 1 + mv);
    v.grab *= Math.max(0, 1 + mv);
    v.breathe = clamp(v.breathe + Math.max(0, mv) * 0.5, 0, 1);
  }
  if (b) v.thick = clamp(v.thick - b * 0.7, -0.9, 0.9);      // bold: the ink spreads; thin: hairlines
  return v;
}

// ---------------------------------------------------------------- breeding: children of what you're looking at
const gauss = r => (r() + r() + r() - 1.5) * 1.15;
const GROUP_LOCKS = {
  colors: ['color', 'look'],
  camera: ['camera'],
  shapes: ['shape', 'space', 'objects'],
  lines: ['lines', 'bend'],
};
const FEATURES = [
  { check: 1 }, { check: 1, tri: 1 }, { wAng: 1, wRad: 1, wLin: 0 }, { kaleido: 1 }, { moire: 1, wRad: 1, wLin: 0 },
  { radInv: 1, wRad: 1, wLin: 0 }, { square: 1, wRad: 1, wLin: 0 }, { vortex: 1.6 }, { pinch: 1 }, { wave: 1.2, zig: 1 },
  { pitch: 1.1, focal: 1.8 }, { folds: 1.2 }, { orbs: 1 }, { twist: 2 },
];
// switches only come on whole (a 5% corridor is just a mess)
const SWITCHES = new Set(['gyro', 'sponge', 'kifs', 'hall', 'columns', 'penrose', 'mobius', 'rings', 'blob', 'drop', 'wrap']);

// parent: full values (colors as rgb arrays) → a child set, ready for world.morphTo()
export function breed(parent, strength = 0.5, locks = {}, seed = Math.random() * 1e9) {
  const r = mulberry32(seed | 0);
  const locked = new Set(Object.entries(locks).filter(([, on]) => on).flatMap(([k]) => GROUP_LOCKS[k]));
  const child = {};
  for (const [k, x] of Object.entries(parent)) child[k] = Array.isArray(x) ? rgbToHex(x) : x;
  // sometimes lean toward a whole other look
  if (r() < 0.3 * strength + 0.08) {
    const ids = Object.keys(LOOKS);
    const other = look(ids[Math.floor(r() * ids.length)]);
    const t = 0.3 + r() * 0.6 * strength;
    for (const [k, x] of Object.entries(other)) {
      const p = PARAM_BY_NAME[k];
      if (!p || locked.has(p.group) || typeof x !== 'number' || typeof child[k] !== 'number') continue;
      child[k] = SWITCHES.has(k) ? (t > 0.5 ? x : child[k]) : child[k] + (x - child[k]) * t;
    }
  }
  // nudge numbers
  for (const p of PARAMS) {
    if (!p.group || locked.has(p.group) || typeof p.def !== 'number' || p.group === 'music' || SWITCHES.has(p.name)) continue;
    if (r() > 0.25 + strength * 0.35) continue;
    child[p.name] = clamp(child[p.name] + gauss(r) * (p.max - p.min) * 0.1 * strength, p.min, p.max);
  }
  for (const k of ['spokes', 'kaleidoN']) child[k] = Math.round(child[k]);
  if (!locked.has('lines') && r() < 0.4 * strength + 0.12) Object.assign(child, FEATURES[Math.floor(r() * FEATURES.length)]);
  if (!locked.has('color') && r() < 0.2 + strength * 0.2) {
    const pal = PALETTES[Math.floor(r() * PALETTES.length)];
    Object.assign(child, { bands: 0, hueRate: 0, glow: 0 }, pal);
    delete child.name;
  }
  return child;
}
