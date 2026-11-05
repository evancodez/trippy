// The song, directed. Picks scenes for a song from what listen.js heard: a section that slides and sways
// gets something that can flow; a quiet one gets something sparse; a loud one something that fills the
// screen. Each scene is a look, colors, maybe a figure placed off-centre, a camera. Same song, same seed, same
// film, so it can be rewound. Everything you might want to change is one of the options.
import { LOOKS, PALETTES, NEUTRAL, COLOR_KEYS, camKind } from './engine/looks.js';
import { mulberry32 } from './engine/world.js';

export const defaultOptions = () => ({
  auto: true,
  color: 'bw',          // 'bw' · 'accent' (one color runs through it) · 'full'
  figures: 'some',      // 'none' · 'some' · 'lots'
  worlds: true,         // 3D looks as well as flat ones
  pace: 'normal',       // 'slow' · 'normal' · 'fast'
  mood: 'flow',         // what the picture follows: 'flow' (the tune) · 'even' · 'hit' (the drums)
  seed: 1,
});

// the look pools for each character of section
const POOLS = {
  hush: { flat: ['ink', 'moire', 'sand', 'agate', 'living', 'seigaiha', 'lace', 'ouchi'], world: ['silk', 'landscape'] },
  flow: { flat: ['ink', 'metamorph', 'weave', 'seigaiha', 'khatam', 'crystal', 'stripes', 'whirlpool', 'trivortex', 'spirals', 'tank', 'blaze'], world: ['silk', 'chrome', 'landscape', 'origami', 'ringtunnel', 'lattice'] },
  swell: { flat: ['crystal', 'rosette', 'planets', 'lace', 'spirals', 'trivortex', 'tunnel', 'mandala', 'circlelimit', 'twins'], world: ['pulsar', 'checkerhills', 'hallway', 'trifloor', 'pinart'] },
  pulse: { flat: ['crystal', 'shards', 'planets', 'weave', 'maze', 'blocks', 'squeeze', 'vasarely', 'diamonds', 'cymatics', 'dipole'], world: ['pulsar', 'pinart', 'trifloor', 'road', 'dots', 'origami'] },
  peak: { flat: ['crystal', 'shards', 'rosette', 'planets', 'circlelimit', 'stargate', 'tunnel', 'mandala', 'trivortex', 'blaze', 'lightning'], world: ['pulsar', 'pinart', 'shaft', 'sponge', 'checkerhills', 'colonnade'] },
};
// and the figures that suit it
const CAST = {
  hush: ['sleeper', 'eye', 'veil', 'ammonite', 'lovers'],
  flow: ['sleeper', 'manta', 'lovers', 'kraken', 'hand', 'moth', 'ammonite'],
  swell: ['cry', 'ribs', 'kraken', 'heart', 'veil'],
  pulse: ['heart', 'skull', 'kraken', 'ribs', 'moth'],
  peak: ['skull', 'cry', 'heart', 'kraken'],
};
const ACCENTS = ['#d80146', '#ff5a1f', '#2d5bff', '#c9f73a', '#e8c547', '#19c3b2', '#ff4fa3'];
const FULL = PALETTES.filter(p => !['Black & white', 'White on black'].includes(p.name));
const BW = PALETTES.filter(p => ['Black & white', 'White on black'].includes(p.name));

const hashString = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function paletteFor(opts, r, accent, kind) {
  if (opts.color === 'bw') return BW[r() < (kind === 'peak' ? 0.55 : 0.3) ? 1 : 0];
  if (opts.color === 'accent') {
    const light = r() < 0.5;
    if (r() < 0.3) return BW[light ? 0 : 1];
    return light
      ? { name: 'accent', paper: '#f2f0ea', ink: accent, fog: '#120306' }
      : { name: 'accent', paper: '#070506', ink: accent, fog: '#000000', glow: 0.35, glowColor: accent };
  }
  return FULL[Math.floor(r() * FULL.length)];
}

// songId + analysis + options → scenes: [{ t0, t1, look, palette, figure, style, home, cine, kind }]
export function buildScore(songId, an, opts) {
  const r = mulberry32(hashString(songId) ^ (opts.seed * 2654435761 >>> 0));
  const pick = a => a[Math.floor(r() * a.length)];
  const barLen = (60 / an.bpm) * an.meter;
  const lenBars = { slow: 16, normal: 8, fast: 4 }[opts.pace] || 8;
  const snap = x => { const D = an.down; if (!D?.length) return x; let lo = 0, hi = D.length - 1; while (lo < hi) { const c = (lo + hi) >> 1; if (D[c] < x) lo = c + 1; else hi = c; } const a = D[Math.max(lo - 1, 0)], b = D[lo]; return x - a < b - x ? a : b; };
  const accent = pick(ACCENTS);
  const scenes = [];
  const recent = [], recentFig = [];
  let prevFlat = false;
  for (const sec of an.sections) {
    const dur = sec.end - sec.start;
    const k = sec.kind;
    // quiet passages change less; the end of a long section doesn't need its own scene
    const target = Math.max(6, lenBars * barLen * (k === 'hush' ? 1.5 : k === 'peak' ? 0.85 : 1));
    const parts = Math.max(1, Math.round(dur / target));
    for (let i = 0; i < parts; i++) {
      const t0 = i === 0 ? sec.start : snap(sec.start + (dur * i) / parts), t1 = i === parts - 1 ? sec.end : snap(sec.start + (dur * (i + 1)) / parts);
      const pool = POOLS[k] || POOLS.flow;
      const world = opts.worlds && pool.world.length && r() < (prevFlat ? 0.55 : 0.3);
      const options = (world ? pool.world : pool.flat).filter(id => LOOKS[id] && !recent.includes(id));
      const lookId = pick(options.length ? options : pool.flat.filter(id => LOOKS[id]));
      recent.push(lookId); if (recent.length > 8) recent.shift();
      prevFlat = !world;
      const palette = i === 0 || r() < 0.5 ? paletteFor(opts, r, accent, k) : scenes[scenes.length - 1].palette;
      // a figure?
      let figure = null, home = null;
      const chance = { none: 0, some: 0.6, lots: 0.9 }[opts.figures] ?? 0.6;
      const kindCam = camKind(lookId);
      if (kindCam !== 'fly' && kindCam !== 'object' && r() < chance) {
        const cast = (CAST[k] || CAST.flow).filter(id => !recentFig.includes(id));
        figure = pick(cast.length ? cast : CAST[k] || CAST.flow);
        recentFig.push(figure); if (recentFig.length > 5) recentFig.shift();
        const tilted = (LOOKS[lookId].set.pitch || 0) > 0.6;
        // off-centre: thirds of the screen, and low if it's looking along the ground
        const side = r() < 0.5 ? -1 : 1;
        home = [side * (0.04 + r() * 0.2), tilted ? -0.14 : -0.04 + r() * 0.08];
      }
      // now and then, when it's big and it's a place: not one figure but a whole sea of them
      let crowd = false;
      if (figure && world && (k === 'peak' || k === 'swell') && kindCam === 'open' && r() < 0.3) { figure = pick(['sleeper', 'skull', 'heart', 'moth']); crowd = true; }
      // most of a scene is the morph into it: a slow change that fills the time, quicker when a big section lands
      const length = t1 - t0, landing = i === 0 && (k === 'peak' || k === 'pulse');
      const glide = landing ? Math.min(6, length * 0.5) : Math.max(4, Math.min(16, length * (k === 'hush' ? 0.85 : 0.72)));
      const paceK = { slow: 0.75, normal: 1, fast: 1.25 }[opts.pace] || 1;
      const cineSpeed = (k === 'peak' ? 0.72 : k === 'hush' ? 0.3 : k === 'flow' ? 0.46 : 0.58) * paceK;
      scenes.push({ t0, t1, look: lookId, palette, figure, home, crowd, kind: k, cineSpeed, glide, first: i === 0 });
    }
  }
  return { scenes, accent };
}

// the set of look values a palette sets
export function paletteSet(p) {
  const set = {};
  for (const k of COLOR_KEYS) set[k] = p[k] ?? NEUTRAL[k];
  return set;
}

export const sceneAt = (score, t) => {
  if (!score) return -1;
  const S = score.scenes;
  for (let i = 0; i < S.length; i++) if (t < S[i].t1) return i;
  return S.length - 1;
};
