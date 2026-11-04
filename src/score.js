// The song, directed. Picks scenes for a song from what listen.js heard: a section that slides and sways
// gets something that can flow; a quiet one gets something sparse; a loud one something that fills the
// screen. Each scene is a look, colors, maybe a figure placed off-centre, a camera. Same song, same seed, same
// film, so it can be rewound. Everything you might want to change is one of the options.
import { LOOKS, PALETTES, NEUTRAL, COLOR_KEYS, camKind } from './engine/looks.js';
import { FIGURES } from './engine/figures.js';
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
  hush: { flat: ['moire', 'sand', 'agate', 'living', 'spiral', 'dottunnel', 'quasi'], world: ['silk', 'landscape'] },
  flow: { flat: ['stripes', 'whirlpool', 'trivortex', 'spirals', 'cymatics', 'julia', 'tank', 'twins', 'agate', 'dipole', 'living', 'blaze'], world: ['silk', 'chrome', 'landscape', 'origami', 'ringtunnel', 'lattice'] },
  swell: { flat: ['spirals', 'trivortex', 'tunnel', 'quasi', 'mandala', 'circlelimit', 'twins'], world: ['checkerhills', 'hallway', 'trifloor', 'hobnail'] },
  pulse: { flat: ['maze', 'blocks', 'squeeze', 'vasarely', 'diamonds', 'squares', 'cymatics', 'dipole'], world: ['trifloor', 'road', 'dots', 'hobnail', 'origami'] },
  peak: { flat: ['circlelimit', 'stargate', 'tunnel', 'mandala', 'trivortex', 'blaze', 'lightning', 'julia'], world: ['shaft', 'sponge', 'checkerhills', 'colonnade'] },
};
// and the figures that suit it
const CAST = {
  hush: ['moon', 'eye', 'lovers', 'dog', 'isle', 'wanderer', 'monolith', 'ophelia'],
  flow: ['fluke', 'kraken', 'ophelia', 'serpent', 'hand', 'arm', 'isle', 'liner', 'wanderer'],
  swell: ['arm', 'creation', 'liberty', 'kraken', 'fluke', 'steeple', 'elephant'],
  pulse: ['skull', 'icarus', 'bowler', 'moai', 'stag', 'providence', 'elephant'],
  peak: ['skull', 'medusa', 'scream', 'liberty', 'kraken', 'providence', 'arm'],
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
  const lenBars = { slow: 28, normal: 14, fast: 7 }[opts.pace] || 14;
  const accent = pick(ACCENTS);
  const scenes = [];
  const recent = [], recentFig = [];
  let prevFlat = false;
  for (const sec of an.sections) {
    const dur = sec.end - sec.start;
    const k = sec.kind;
    // quiet passages change less; the end of a long section doesn't need its own scene
    const target = Math.max(8, lenBars * barLen * (k === 'hush' ? 1.6 : k === 'peak' ? 0.8 : 1));
    const parts = Math.max(1, Math.round(dur / target));
    for (let i = 0; i < parts; i++) {
      const t0 = sec.start + (dur * i) / parts, t1 = sec.start + (dur * (i + 1)) / parts;
      const pool = POOLS[k] || POOLS.flow;
      const world = opts.worlds && pool.world.length && r() < (prevFlat ? 0.55 : 0.3);
      const options = (world ? pool.world : pool.flat).filter(id => LOOKS[id] && !recent.includes(id));
      const lookId = pick(options.length ? options : pool.flat.filter(id => LOOKS[id]));
      recent.push(lookId); if (recent.length > 8) recent.shift();
      prevFlat = !world;
      const palette = i === 0 || r() < 0.5 ? paletteFor(opts, r, accent, k) : scenes[scenes.length - 1].palette;
      // a figure?
      let figure = null, style = 'contour', home = null;
      const chance = { none: 0, some: 0.38, lots: 0.8 }[opts.figures] ?? 0.38;
      const kindCam = camKind(lookId);
      if (kindCam !== 'fly' && kindCam !== 'object' && r() < chance) {
        const cast = (CAST[k] || CAST.flow).filter(id => !recentFig.includes(id));
        figure = pick(cast.length ? cast : CAST[k] || CAST.flow);
        recentFig.push(figure); if (recentFig.length > 5) recentFig.shift();
        const tilted = (LOOKS[lookId].set.pitch || 0) > 0.6;
        const f = FIGURES.find(x => x.id === figure);
        style = f?.style || (tilted ? pick(['draped', 'contour', 'contour']) : pick(['contour', 'contour', 'silhouette']));
        // off-centre: thirds of the screen, and low if it's looking along the ground
        const side = r() < 0.5 ? -1 : 1;
        home = [side * (0.12 + r() * 0.28), tilted ? -0.2 : -0.08 + r() * 0.1];
      }
      // now and then, when it's big and it's a place: not one figure but a whole sea of them
      let crowd = false;
      if (figure && world && (k === 'peak' || k === 'swell') && kindCam === 'open' && r() < 0.3) { figure = pick(['arm', 'arm', 'kraken', 'moai']); crowd = true; style = 'draped'; }
      const cine = world ? (kindCam === 'fly' ? false : r() < 0.65) : r() < 0.18;
      scenes.push({ t0, t1, look: lookId, palette, figure, style, home, crowd, cine, kind: k, cineSpeed: k === 'peak' ? 0.55 : k === 'hush' ? 0.15 : 0.32 });
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
