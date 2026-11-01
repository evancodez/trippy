// Smart music mode: write a brand-new film (a keyframe list) for any song.
// The rules are the ones from making the PPP film:
//   · glide, never cut — each section morphs the equation into the next look, landing on a bar line
//   · big jumps in loudness get short, fast glides (and an exposure flash); quiet changes get long ones
//   · quiet → snow / lines / silk / moiré · building → hands, landscape, road, tunnel · loud → orbs, chrome,
//     lattice, mandala · the peak → the red bloom, hands breaking through
//   · black & white first; the accent color is earned — a glow at first, a flood only at the peak
//   · the face peeks at most once, and maybe closes the film
//   · loudness drives intensity, the bar drives the sway, onsets flash
// A seed makes every run different (and lets you get the same one back).
import { LOOKS, look, CHERRY, CHERRY_DEEP } from './looks.js';

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
  { name: 'Cherry', color: CHERRY, deep: CHERRY_DEEP, weight: 6 },
  { name: 'Black & white only', color: null, weight: 2 },
  { name: 'Cobalt', color: '#3263ff', deep: '#08123d', weight: 1 },
  { name: 'Acid', color: '#c8ff2e', deep: '#1c2600', weight: 1 },
];

const POOLS = {
  calm: ['snow', 'scanlines', 'silk', 'moire', 'spiral', 'impossible', 'opstripes', 'squares', 'ball', 'dots'],
  build: ['silk', 'hands', 'landscape', 'road', 'tunnel', 'whirlpool', 'vasarely', 'mobius', 'colonnade', 'squeeze', 'hallway', 'checkerhills', 'trifloor', 'blob'],
  loud: ['orbs', 'chrome', 'lattice', 'mandala', 'tunnel', 'landscape', 'hands', 'sponge', 'crystals', 'gyroscope', 'trivortex', 'shaft', 'ringtunnel', 'dottunnel', 'diamonds'],
  peak: ['bloom', 'lattice', 'mandala', 'orbs', 'whirlpool', 'sponge', 'crystals', 'shaft', 'trivortex'],
};

function weighted(rng, items) {
  let r = rng() * items.reduce((s, i) => s + i.weight, 0);
  for (const i of items) if ((r -= i.weight) <= 0) return i;
  return items[0];
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, a, b) => a + rng() * (b - a);

function mean(arr, fps, a, b) {
  let s = 0, n = 0;
  for (let i = Math.floor(a * fps); i < Math.min(arr.length, b * fps); i++) { s += arr[i]; n++; }
  return n ? s / n : 0;
}

export function generateFilm(an, seed = (Math.random() * 2 ** 31) | 0, name = 'your song') {
  const rng = mulberry32(seed);
  let bpm = an.bpm;
  while (bpm < 55) bpm *= 2;
  while (bpm > 150) bpm /= 2;
  const beat = 60 / bpm;
  const beatsPerBar = bpm < 85 ? 2 : an.meter || 4;
  const barLen = beat * beatsPerBar;
  const barZero = an.beatOffset;
  const toBar = t => Math.max(0, Math.round((t - barZero) / barLen));
  const totalBars = Math.floor((an.duration - barZero) / barLen);

  // 1. sections → phrases
  const bounds = [0, ...an.boundaries.map(toBar), totalBars].filter((b, i, arr) => i === 0 || b - arr[i - 1] >= 4);
  const phrase = barLen < 2.2 ? 16 : 8;
  const cuts = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1];
    const n = Math.max(1, Math.round((b - a) / phrase));
    for (let j = 0; j < n; j++) cuts.push(Math.round(a + ((b - a) * j) / n));
  }
  const pieces = cuts.map((k, i) => {
    const k1 = cuts[i + 1] ?? totalBars;
    return { k, k1, bars: k1 - k, loud: mean(an.slow, an.fps, barZero + k * barLen, barZero + k1 * barLen) };
  });
  const louds = pieces.map(p => p.loud).sort((a, b) => a - b);
  const q = f => louds[Math.min(louds.length - 1, Math.floor(louds.length * f))] ?? 0.5;
  const tierOf = p => (p.loud >= q(0.85) && p.loud > 0.55 ? 'peak' : p.loud >= q(0.6) ? 'loud' : p.loud >= q(0.3) ? 'build' : 'calm');
  const peakAt = pieces.reduce((best, p, i) => (p.loud > pieces[best].loud ? i : best), 0);

  const accent = weighted(rng, ACCENTS);
  const faceAt = rng() < 0.6 ? Math.floor(between(rng, 1, Math.max(2, peakAt))) : -1;
  const used = {};
  let last = null;
  const keys = [];
  const lb = rng() < 0.7 ? 1 : 0;

  pieces.forEach((p, i) => {
    let tier = i === 0 ? 'calm' : tierOf(p);
    if (i === pieces.length - 1 && p.loud < q(0.5)) tier = 'calm';
    const pool = POOLS[tier].filter(k => k !== last);
    const least = Math.min(...pool.map(k => used[k] || 0));
    let kind = pick(rng, pool.filter(k => (used[k] || 0) === least));
    if (i === peakAt && rng() < 0.8) kind = 'bloom';
    if (i === pieces.length - 1 && p.loud < q(0.4)) kind = rng() < 0.5 ? 'afterglow' : 'snow';
    used[kind] = (used[kind] || 0) + 1;
    last = kind;

    // a little variety on top of the look
    const tweak = {
      freq: LOOKS[kind].set.freq ? LOOKS[kind].set.freq * between(rng, 0.8, 1.25) : undefined,
      sway: (LOOKS[kind].set.sway ?? 0.3) * between(rng, 0.7, 1.4),
      letterbox: i > peakAt ? (rng() < 0.6 ? 0 : lb) : lb,
    };
    if (['silk', 'scanlines', 'hands'].includes(kind)) tweak.linA = pick(rng, [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
    if (accent.color) {
      const hot = tier === 'peak' || i === peakAt;
      if (hot || kind === 'bloom') Object.assign(tweak, { paper: '#060203', ink: accent.color, fog: '#060203', glow: 0.75, glowColor: accent.color });
      else Object.assign(tweak, { glowColor: accent.color, glow: tier === 'calm' ? 0.1 : tier === 'build' ? 0.2 : 0.35 });
      if (kind === 'tunnel' && !hot) tweak.fog = accent.deep;
    } else if (kind === 'bloom') Object.assign(tweak, { paper: '#050505', ink: '#ecebe6', fog: '#050505', glowColor: '#ffffff', glow: 0.4 });
    for (const k of Object.keys(tweak)) if (tweak[k] === undefined) delete tweak[k];

    const prev = pieces[i - 1];
    const jump = prev ? p.loud - prev.loud : 0;
    const morph = i === 0 ? 0 : jump > 0.18 ? between(rng, 0.75, 1.5) : jump < -0.25 ? between(rng, 0.25, 1) : between(rng, 2, 4.5);
    const start = i === 0 ? 0 : jump > 0.18 ? p.k - morph : p.k - morph * 0.4;
    keys.push({
      bar: start, morph, ease: jump > 0.18 ? 'expo' : 'inOut',
      set: look(kind, tweak),
      chapter: { name: LOOKS[kind].name, story: `${{ calm: 'Quiet', build: 'Building', loud: 'Loud', peak: 'The peak' }[tier]} — ${LOOKS[kind].blurb}.`, how: `Look “${LOOKS[kind].name}”, glided in over ${morph.toFixed(1)} bars.` },
    });
    if (jump > 0.18) keys.push({ bar: p.k, morph: 0, set: { exposure: 0.8 } }, { bar: p.k, morph: 1, ease: 'out', set: { exposure: 0 } });

    // inside long pieces: drift the camera or re-form the line system
    if (p.bars >= 10) {
      const mid = p.k + Math.round(p.bars * between(rng, 0.4, 0.6));
      const moves = [
        { pitch: between(rng, 0.15, 0.5), focal: between(rng, 1.8, 4) },
        { check: 0.85, checkA: pick(rng, [Math.PI / 2, 1.0, 0.3]) },
        { frame: between(rng, 0.4, 0.9) },
        { twist: between(rng, -1.2, 1.2) },
        { wAng: 1, spokes: pick(rng, [2, 3, 5]) },
        { kaleido: 1, kaleidoN: pick(rng, [6, 8, 12]) },
      ];
      keys.push({ bar: mid, morph: between(rng, 2, 4), set: pick(rng, moves) });
    }
    if (i === faceAt && kind !== 'bloom' && kind !== 'lattice') {
      const mid = p.k + Math.max(2, Math.round(p.bars * 0.35));
      keys.push({ bar: mid, morph: 3, set: { face: 0.9, faceS: between(rng, 0.8, 1.2), engrave: 0.9, light: 0.5 } });
      keys.push({ bar: mid + 5, morph: 3, set: { face: 0 } });
    }
  });

  keys[0].set.exposure = -1;
  keys.push({ bar: 0, morph: 4, ease: 'out', set: { exposure: 0 } });
  keys.push({ bar: Math.max(1, totalBars - 4), morph: 4, set: { exposure: -1 } });

  return {
    id: 'auto', seed,
    title: `${name} — directed by the machine`,
    artist: '',
    logline: `${beatsPerBar}-beat bars at ${bpm.toFixed(1)} bpm, ${pieces.length} morphs, accent: ${accent.name}. Seed ${seed}.`,
    bpm, offset: an.beatOffset, beatsPerBar, downbeat: 0, meter: beatsPerBar === 3 ? '3/4' : `${beatsPerBar}/4`,
    duration: an.duration,
    keys,
  };
}
