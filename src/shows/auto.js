// Smart music mode: cut a brand-new film to any song.
// The rules are the ones learned making the PPP film:
//   · cut on bar lines, at the song's own section changes (split long sections every ~8–16 bars)
//   · quiet → static/ghost/moiré, building → silk/faces/floors/tunnels, loud → glass/mandala/chrome, peak → red bloom
//   · black & white first; the accent color is earned — a glow at first, a flood only at the peak
//   · big jumps in loudness get a flash cut on the downbeat, drops get a cut, everything else a slow wipe
//   · loudness drives intensity, the bar drives the sway, onsets drop ripples and glitches
// A seed makes every run different (and lets you get the same run back).
import { ARCHETYPES as A, W, pick } from '../scenes.js';
import { CHERRY } from '../catalog.js';

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

const ACCENTS = [
  { name: 'Cherry', color: CHERRY, weight: 6 },
  { name: 'Black & white only', color: null, weight: 2 },
  { name: 'Cobalt', color: '#2f5cff', weight: 1 },
  { name: 'Acid', color: '#c8ff2e', weight: 1 },
];

const POOLS = {
  calm: ['staticGhost', 'scanlines', 'moireGhosts', 'silk', 'halftone'],
  build: ['silk', 'halftone', 'faceRelief', 'floorRide', 'tunnelRide', 'sphereWorld', 'tiltWorld'],
  loud: ['tiltWorld', 'tunnelRide', 'lensGrid', 'mandala', 'chromeCloth', 'sphereWorld', 'faceRelief'],
  peak: ['bloom', 'lensGrid', 'mandala', 'tunnelRide', 'sphereWorld'],
};

const NAMES = {
  staticGhost: 'Snow', scanlines: 'Scan Lines', moireGhosts: 'Ghost Rings', silk: 'Silk', halftone: 'Newsprint Face',
  faceRelief: 'Relief', floorRide: 'Road', tunnelRide: 'Tunnel', sphereWorld: 'World', tiltWorld: 'Tilt',
  lensGrid: 'Glass', mandala: 'Mandala', chromeCloth: 'Chrome', bloom: 'Bloom', afterglow: 'Afterglow',
};

function weighted(rng, items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const i of items) if ((r -= i.weight) <= 0) return i;
  return items[0];
}

function mean(arr, fps, a, b) {
  let s = 0, n = 0;
  for (let i = Math.floor(a * fps); i < Math.min(arr.length, b * fps); i++) { s += arr[i]; n++; }
  return n ? s / n : 0;
}

export function generateShow(an, seed = (Math.random() * 2 ** 31) | 0, name = 'your song') {
  const rng = mulberry32(seed);
  let bpm = an.bpm;
  while (bpm < 55) bpm *= 2;
  while (bpm > 150) bpm /= 2;
  const beat = 60 / bpm;
  const beatsPerBar = bpm < 85 ? 2 : an.meter || 4;
  const barLen = beat * beatsPerBar;
  const barZero = an.beatOffset;
  const toBar = t => Math.max(0, Math.round((t - barZero) / barLen));
  const barT = k => barZero + k * barLen;
  const totalBars = Math.floor((an.duration - barZero) / barLen);

  // 1. section boundaries in bars, long sections split into phrases
  const bounds = [0, ...an.boundaries.map(toBar), totalBars].filter((b, i, arr) => i === 0 || b - arr[i - 1] >= 4);
  const phrase = barLen < 2.2 ? 16 : 8;
  const cuts = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1];
    const pieces = Math.max(1, Math.round((b - a) / phrase));
    for (let j = 0; j < pieces; j++) cuts.push(Math.round(a + ((b - a) * j) / pieces));
  }

  // 2. how loud is each piece, compared to the song's own range
  const pieces = cuts.map((k, i) => {
    const t0 = barT(k), t1 = barT(cuts[i + 1] ?? totalBars);
    return { k, t0, t1, loud: mean(an.slow, an.fps, t0, t1), bright: mean(an.centroid, an.fps, t0, t1) };
  });
  const louds = pieces.map(p => p.loud).sort((a, b) => a - b);
  const q = f => louds[Math.min(louds.length - 1, Math.floor(louds.length * f))] ?? 0.5;
  const tier = p => (p.loud >= q(0.85) && p.loud > 0.55 ? 'peak' : p.loud >= q(0.6) ? 'loud' : p.loud >= q(0.3) ? 'build' : 'calm');

  const accent = weighted(rng, ACCENTS);
  const accentPalette = accent.color ? { paper: '#070203', inks: [accent.color] } : { palette: 'wb' };
  const glowColor = accent.color || '#ffffff';
  const peakAt = pieces.reduce((best, p, i) => (p.loud > pieces[best].loud ? i : best), 0);

  // 3. choose a scene for every piece, favoring ones not used yet
  let last = null;
  const used = {};
  const choose = pool => {
    const options = pool.filter(k => k !== last);
    const least = Math.min(...options.map(k => used[k] || 0));
    return pick(rng, options.filter(k => (used[k] || 0) === least));
  };
  const scenes = pieces.map((p, i) => {
    const t = i === 0 ? 'calm' : i === pieces.length - 1 && p.loud < q(0.5) ? 'calm' : tier(p);
    let kind = choose(POOLS[t]) || 'silk';
    if (i === peakAt && rng() < 0.75) kind = 'bloom';
    if (i === pieces.length - 1 && p.loud < q(0.4)) kind = rng() < 0.5 ? 'afterglow' : 'staticGhost';
    last = kind;
    used[kind] = (used[kind] || 0) + 1;
    const afterPeak = i > peakAt;
    const hot = t === 'peak' || (t === 'loud' && rng() < 0.3);
    const opts = {
      density: undefined,
      ghost: 0.75 + rng() * 0.25,
      size: 0.38 + rng() * 0.2,
      glow: accent.color ? (t === 'calm' ? 0.2 : t === 'build' ? 0.35 : 0.6) * (0.6 + rng() * 0.8) : 0.15,
      inside: pick(rng, ['checker', 'rings', 'stripes', undefined]),
      pattern: kind === 'mandala' ? pick(rng, ['triangles', 'hex', 'cells']) : kind === 'tunnelRide' ? pick(rng, ['checker', 'checker', 'hex', 'stripes']) : undefined,
      rowsPerBar: pick(rng, [1, 2, 2, 4]),
      appear: [2, Math.max(4, (p.t1 - p.t0) * 0.6)],
      moire: rng() < 0.5 ? [2, (p.t1 - p.t0) * 0.7] : undefined,
      palette: hot && accent.color ? undefined : rng() < 0.3 ? 'wb' : 'bw',
    };
    const arch = A[kind](opts);
    const look = { ...arch.look, glowColor };
    if (hot && accent.color && kind !== 'chromeCloth') Object.assign(look, accentPalette);
    if (t === 'peak' || afterPeak) look.letterbox = rng() < 0.6 ? 0 : 1;

    // how to get here from the previous piece
    const prev = pieces[i - 1];
    const jump = prev ? p.loud - prev.loud : 0;
    let tin;
    if (i === 0) tin = { type: 'cut' };
    else if (jump > 0.18) tin = { type: 'flash', dur: 0.35 + rng() * 0.3, color: t === 'peak' && accent.color ? accent.color : '#ffffff' };
    else if (jump < -0.25) tin = { type: rng() < 0.6 ? 'cut' : 'dissolve', beats: 2, lead: 0 };
    else tin = { type: pick(rng, ['dissolve', 'rings', 'iris', 'ink', 'blinds', 'dissolve']), beats: pick(rng, [2, 4, 4, 6, 8]) };

    // a little extra life, different every run
    const spin = (rng() - 0.5) * 0.2;
    const ripples = rng() < 0.5;
    const fadeIn = i === 0, fadeOut = i === pieces.length - 1;
    const sceneDur = p.t1 - p.t0;
    return {
      at: i === 0 ? 0 : p.t0, bar: p.k,
      name: NAMES[kind] || kind,
      story: `${t === 'calm' ? 'Quiet' : t === 'build' ? 'Building' : t === 'loud' ? 'Loud' : 'The peak'} — ${NAMES[kind]}.`,
      how: arch.how,
      look, react: arch.react,
      in: tin,
      update(s, c) {
        arch.update(s, c);
        s.spin = spin;
        if (ripples && c.hit > 0.6) c.ripple((rng() - 0.5) * 1.2, (rng() - 0.5) * 0.7, c.hit);
        if (fadeIn) s.vignette += 3 * (1 - c.ramp(0, 4));
        if (fadeOut) s.vignette += 3 * c.ramp(sceneDur - 6, sceneDur);
      },
    };
  });

  return {
    id: 'auto', seed,
    title: `${name} — auto-directed`,
    logline: `Cut on ${beatsPerBar}-beat bars at ${bpm.toFixed(1)} bpm across ${scenes.length} scenes. Accent: ${accent.name}. Seed ${seed}.`,
    bpm, offset: an.beatOffset, beatsPerBar, downbeat: 0, meter: beatsPerBar === 3 ? '3/4' : `${beatsPerBar}/4`,
    duration: an.duration,
    scenes,
  };
}
