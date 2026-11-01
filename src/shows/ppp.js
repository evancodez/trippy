// "PPP" — a film in geometry, cut to Beach House's PPP (Depression Cherry, 2015).
//
// Measured from the song (src/analysis.js): 6:09 long, a steady 69.92 bpm on the dotted quarter,
// so each 6/8 bar lasts 1.716 s. The grid starts at 0.197 s, and the downbeat falls on the second
// beat of that grid. Every section change in the song lands exactly on a bar line:
//   bar 14 bass enters · 30 & 47 swells · 64 near-silence · 78 return · 111 second swell
//   125 the heavy stretch · 158 the guitar climax · 200 the drop · 206 the tail
//
// The story (abstract): a presence in the noise slowly becomes a face, the world gains depth,
// loses everything for a moment, travels, grows heavy, blooms red with the guitar, and dissolves
// back into snow.
import { ARCHETYPES as A, W } from '../scenes.js';
import { CHERRY } from '../catalog.js';

const BPM = 69.92;
const OFFSET = 0.197;
const BEAT = 60 / BPM;
const BAR = 2 * BEAT;
const DOWN = OFFSET + BEAT;
export const bar = k => DOWN + k * BAR;

// archetype + extra per-frame logic and look tweaks
const plus = (arch, lookPatch = {}, fn = null) => ({
  ...arch,
  look: { ...arch.look, ...lookPatch },
  update(s, c) { arch.update(s, c); fn?.(s, c); },
});

const scene = (k, name, story, arch, transition) => ({
  at: k === 0 ? 0 : bar(k), bar: k, name, story, how: arch.how, look: arch.look, react: arch.react, update: arch.update,
  in: transition,
});

export const PPP_SHOW = {
  id: 'ppp',
  title: 'PPP — a film in geometry',
  artist: 'Beach House',
  logline: 'A presence in the static slowly becomes a face, gains depth, loses everything, travels, blooms red with the guitar, and dissolves back into snow.',
  bpm: BPM, offset: OFFSET, beatsPerBar: 2, downbeat: 1, meter: '6/8',
  duration: 368.7,
  scenes: [
    scene(0, 'Snow', 'Before anything: snow on a dead channel. Something in the noise is looking back.',
      plus(A.staticGhost({ ghost: 0.95, appear: [4, 13], size: 0.4 }), {}, (s, c) => {
        s.thickness = -1.7 * (1 - c.ramp(0, 7));          // fade up out of black
      })),
    scene(7, 'Tuning', 'The noise combs itself into lines, and the lines start to lean with the waltz.',
      A.scanlines({ density: 120, densityTo: 72, ghost: 0.75, appear: [2, 11] }), { type: 'ink', beats: 6 }),
    scene(14, 'First Breath', 'The bass arrives and the lines become silk, rocking left on one and right on two. A face presses up from underneath.',
      A.silk({ density: 54, ghost: 0.9, appear: [8, 26] }), { type: 'rings', beats: 3, lead: 0.2 }),
    scene(30, 'The Face', 'The face, drawn in dots like an old newspaper photo. It breathes once a bar and blinks every eight.',
      A.halftone({ density: 46, ghost: 0.95 }), { type: 'ink', beats: 4 }),
    scene(38, 'Relief', 'Lines again, bending over cheekbones. A second set drifts across it and the moiré starts to shimmer.',
      A.faceRelief({ density: 42, moire: [5, 14], zoom: 1.05, zoomTo: 0.82 }), { type: 'dissolve', beats: 4 }),
    scene(47, 'Swell', 'The swell: the flat world tips back into real perspective and rocks like a boat. The first red appears at the edges of the light.',
      A.tiltWorld({ density: 9, glow: 0.3 }), { type: 'flash', dur: 0.5 }),
    scene(55, 'The World as an Object', 'Everything gathers onto one spinning ball… and as the band drops out, it collapses into a point.',
      plus(A.sphereWorld({ inside: 'checker', size: 0.58, implode: [7 * BAR, 9 * BAR] }), {}, (s, c) => {
        s.vignette += c.ramp(7 * BAR, 9 * BAR) * 2.5;
      }), { type: 'iris', beats: 4 }),
    scene(64, 'The Gap', 'Almost silence. Two ghosts of rings pass through each other, and a thin red afterglow hangs in the dark.',
      A.moireGhosts({ density: 34, glow: 0.7 }), { type: 'dissolve', beats: 2, lead: 0 }),
    scene(78, 'Return', 'The band returns and a road unrolls beneath us: one tile per bar, the horizon rolling with the waltz.',
      A.floorRide({ density: 5 }), { type: 'rings', beats: 4 }),
    scene(95, 'Into the Tunnel', 'The road curls up around us into a tunnel. Deep cherry is waiting at the far end.',
      A.tunnelRide({ rowsPerBar: 2 }), { type: 'dissolve', beats: 8 }),
    scene(111, 'Glass', 'The second swell: a wall of glass balls, each one breathing on the beat. Every ball holds the same tiny world.',
      A.lensGrid({ density: 16, glow: 0.35 }), { type: 'flash', dur: 0.45, color: CHERRY }),
    scene(118, 'Orbit', 'One world again, bigger, turning once every eight bars. Rings on the inside, stripes on the outside.',
      A.sphereWorld({ inside: 'rings', size: 0.66, glow: 0.45 }), { type: 'iris', beats: 3 }),
    scene(125, 'Weight', 'The heaviest stretch. Everything turns to liquid chrome silk and moves like something enormous breathing.',
      A.chromeCloth({ density: 18 }), { type: 'dissolve', beats: 4 }),
    scene(142, 'Mandala', 'Tension. The silk folds into a mandala. The bass shoves it, and on the hardest hits it tears.',
      plus(A.mandala({ pattern: 'hex', density: 10 }), {}, (s, c) => {
        W(s, 'glitch').amount *= 0.6 + c.u * 1.2;           // tearing more and more until the bloom
        s.aberr = c.u * 0.4;
      }), { type: 'blinds', beats: 4 }),
    scene(158, 'Bloom', 'It blooms. The red of Depression Cherry floods in, the bars of the frame open, and the ghost returns — enormous, swaying to the guitar.',
      plus(A.bloom({ density: 52, size: 0.55 }), { letterbox: 0 }), { type: 'flash', dur: 0.7, color: CHERRY }),
    scene(166, 'Rapture I — Tunnel', 'The guitar takes over. We cut on the bar, four bars at a time: tunnel…',
      plus(A.tunnelRide({ palette: 'cherry', fog: '#000000', rowsPerBar: 4, glow: 0.7 }), { letterbox: 0 }), { type: 'flash', dur: 0.3 }),
    scene(170, 'Rapture II — Face', '…face…',
      plus(A.halftone({ palette: 'cherry', density: 40 }), { letterbox: 0, glow: 0.7 }), { type: 'flash', dur: 0.3, color: CHERRY }),
    scene(174, 'Rapture III — Glass', '…glass…',
      plus(A.lensGrid({ palette: 'cherryink', density: 14, glow: 0.6 }), { letterbox: 0 }), { type: 'flash', dur: 0.3 }),
    scene(178, 'Rapture IV — World', '…world. All of it red now.',
      plus(A.sphereWorld({ palette: 'cherry', inside: 'checker', size: 0.72, glow: 0.8 }), { letterbox: 0 }), { type: 'flash', dur: 0.3, color: CHERRY }),
    {
      at: bar(182), bar: 182, name: 'Overload', story: 'Overload: two pattern layers spin against each other and every interference fringe flickers red and white.',
      how: 'Rays XOR rings (second layer), Kaleidoscope + Twist, red/black/white inks taking turns, color split on every downbeat.',
      in: { type: 'flash', dur: 0.4, color: CHERRY },
      react: 1,
      look: {
        pattern: 'rays', density: 20, param: 0.2, mixMode: 'xor', mixPattern: 'rings', mixDensity: 16, mixFlat: true,
        warps: [{ type: 'kaleido', amount: 0.15, scale: 0.45 }, { type: 'twist', amount: 0.35, scale: 0.6, extra: 1 }],
        palette: 'cherryink', cycle: 0, depth: 0.3, glow: 0.45, glowColor: CHERRY, aberr: 0.3, echo: 0.3, grain: 0.15, vignette: 0.45,
      },
      update(s, c) {
        W(s, 'kaleido')._ph = (c.bar * Math.PI * 2) / 8 / 0.25;
        W(s, 'twist')._ph = (c.bar * Math.PI * 2) / 1.2 / 2;
        c.rt.phase = c.bar;
        c.rt.phase2 = -c.bar * 0.5;
        c.rt.cycle = Math.floor(c.beat);
        s.aberr = 0.15 + 0.6 * c.downbeat * c.loud;
      },
    },
    scene(190, 'Apex', 'The last peak. The face once more, carved into velvet — and on the final bars it breathes everything in.',
      plus(A.bloom({ palette: 'velvet', size: 0.62, density: 60, angle: 0, echo: 0.45 }), { letterbox: 0 }, (s, c) => {
        const pinch = c.ramp(8 * BAR, 10 * BAR);
        W(s, 'face').amount *= 1 - pinch * 0.5;
        s.zoom = 1 + pinch * 3;
        s.vignette += pinch * 2;
      }), { type: 'flash', dur: 0.5, color: CHERRY }),
    scene(200, 'Afterglow', 'The drop. Rings fall away into the dark while the red drains out of the light.',
      A.afterglow({}), { type: 'cut' }),
    scene(206, 'Snow Again', 'Back to the snow. The face is still in there, smaller, fading… then even the noise goes dark.',
      plus(A.staticGhost({ ghost: 0.9, size: 0.34, vanish: [3, 11], glow: 0.25 }), {}, (s, c) => {
        s.thickness = -1.8 * c.ramp(7, 13.5);              // fade down into black
      }), { type: 'dissolve', beats: 6 }),
  ],
};
