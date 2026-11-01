// "PPP" — a film in lines, for Beach House's PPP (Depression Cherry, 2015).
//
// Measured from the song (src/analysis.js): 6:09, a steady 69.92 bpm on the dotted quarter, so each
// 6/8 bar lasts 1.716 s. Every change in the song lands on a bar line:
//   14 bass · 30 & 47 swells · 64 near-silence · 78 return · 111 second swell · 125 the heavy stretch
//   142 tension · 158 the guitar climax · 200 the drop · 206 the tail
//
// There are no cuts. The whole film is one world — a membrane of lines — and every key below glides
// its values to new ones over a few bars, so each "scene" is the previous equation re-forming.
// The story: the snow becomes lines; something behind the lines tries to get through; the sheet
// becomes a landscape, falls into a hole, travels, grows heavy, melts into a lattice, blooms red
// and breaks open with the guitar, then breathes everything in and goes back to snow.
import { look, NIGHT, CHALK, CHERRY, CHERRY_DEEP } from './looks.js';

const BPM = 69.92;
const OFFSET = 0.197;
const H = Math.PI / 2;

// a key that *starts* at `bar` and glides for `morph` bars
const at = (bar, morph, set, extra = {}) => ({ bar, morph, set, ...extra });
// a key that *lands* on `bar` after gliding `morph` bars
const land = (bar, morph, set, extra = {}) => ({ bar: bar - morph, morph, set, ...extra });
const chapter = (name, story, how) => ({ chapter: { name, story, how } });

const RED = { paper: '#070203', ink: CHERRY, fog: '#070203', glow: 0.75, letterbox: 0 };
const LB = { letterbox: 1 };

export const PPP_FILM = {
  id: 'ppp',
  title: 'PPP — a film in lines',
  artist: 'Beach House',
  logline: 'One membrane of lines, no cuts. The snow becomes lines, something behind them tries to get through, the world tips and falls and travels, blooms red with the guitar, and goes back to snow.',
  bpm: BPM, offset: OFFSET, beatsPerBar: 2, downbeat: 1, meter: '6/8', duration: 368.74,
  keys: [
    // ———————————————————————————————————————— Snow
    at(0, 0, look('snow', { ...LB, exposure: -1, face: 0, faceS: 0.8, sway: 0.1 }), chapter('Snow',
      'A dead channel. For a moment something in the noise is looking back.',
      'TV static on the membrane. The face is a relief under it; “engraving” thins the noise where light hits, so it shows only as denser and sparser snow.')),
    at(0, 5, { exposure: 0 }, { ease: 'out' }),
    at(3, 4, { face: 1.0 }),
    at(8.5, 3, { face: 0 }),

    // ———————————————————————————————————————— The lines form
    at(7, 7, look('scanlines', { ...LB, freq: 48, wave: 0.2, engrave: 0.35, sway: 0.2 }), { ease: 'smooth', ...chapter('The Lines Form',
      'The snow combs itself into lines, and the lines begin to lean with the waltz.',
      'Static fades out of the equation while straight lines fade in — nothing cuts, the noise literally resolves. The line field rocks once per 6/8 bar.') }),
    at(11, 3, { freq: 36, wave: 0.5 }),

    // ———————————————————————————————————————— Silk
    at(12.5, 2.5, look('silk', { ...LB, freq: 30 }), chapter('Silk',
      'The bass arrives: the lines swing upright and become silk, rocking left on one and right on two.',
      'Line angle turns 90° across the bass entrance; folds in the membrane bend the lines (refraction) and catch the light. One ripple, once.')),
    at(14, 0, { ripple: 0.8 }),
    at(14, 7, { ripple: 0 }, { ease: 'out' }),
    at(19, 9, { pitch: 0.3, focal: 2.3, folds: 1.05 }),

    // ———————————————————————————————————————— Presence
    at(28.5, 3, look('silk', {
      ...LB, freq: 34, folds: 0.35, wave: 0.25, handSoft: 0.24, engrave: 0.75, light: 0.45, refract: 1.6, pitch: 0.12, focal: 2.6, grab: 0.3,
      h0: { on: 0, x: 0.06, y: -0.14, z: 0.06, s: 1.15, a: 0.1, curl: 0.1, spread: 0.7 },
      h1: { on: 0, x: -0.38, y: 0.08, z: 0.02, s: 1.0, a: 0.5, curl: 0.2, spread: 0.5 },
    }), chapter('Presence',
      'Something is behind the silk. A hand presses into it, draws back, and comes again with another.',
      'Real 3D hands (jointed fingers that curl on the bar) pushed into the membrane from behind; a soft union stretches the lines over them like fabric.')),
    at(31, 5, { h0: { on: 1 } }, { ease: 'smooth' }),
    at(36, 3, { h0: { on: 0.35, curl: 0.55 } }),
    at(38.5, 5, { h1: { on: 1 }, h0: { on: 0.95, x: 0.32, curl: 0.2 } }),
    at(44, 3, { h0: { on: 0 }, h1: { on: 0 } }),

    // ———————————————————————————————————————— Landscape
    at(45.5, 3, look('landscape', { ...LB, glow: 0.18 }), chapter('Landscape',
      'The swell tips the sheet back until it is a landscape of ridge lines. Orbs rise out of it like breath.',
      'The camera pitches back and widens its lens; the folds become hills. A grid of spheres rises through the sheet in a travelling wave.')),
    at(51, 4, { orbs: 0.9, orbN: 5 }),
    at(55, 4, { check: 0.85, checkA: H, orbs: 0.45 }),
    at(58, 4, { pitch: 0, focal: 7, wLin: 0, wRad: 1, radInv: 0.9, check: 0, orbs: 0, folds: 0, cfog: 0.9, freq: 12, orbitRate: 0, flow: -1.5 }),
    at(62, 2, { frame: 0.12, flow: -3 }, { ease: 'in' }),

    // ———————————————————————————————————————— The gap
    at(64, 3.5, look('moire', { ...LB, frame: 0.6 }), chapter('The Gap',
      'Everything falls into the center and the band drops out. Two ghosts of rings drift through each other in the dark.',
      'The landscape flattens and the line equation becomes rings, then a tunnel we fall into — and out of it, two ring sets multiplied together (moiré), thin light on black.')),
    at(70, 8, { moireOff: 0.65, freq: 54 }),

    // ———————————————————————————————————————— Road
    at(76.5, 3, look('road', {
      ...LB, handSoft: 0.1, grab: 0.4, light: 0.35, engrave: 0.45,
      h0: { on: 0, x: -0.5, y: 1.9, z: 0.28, s: 1.45, a: 0.25, curl: 0.15, spread: 0.6 },
      h1: { on: 0, x: 0.55, y: 2.7, z: 0.28, s: 1.5, a: -0.25, curl: 0.3, spread: 0.5 },
    }), chapter('Road',
      'The band returns and a road unrolls toward us, the horizon rocking with the waltz. Far ahead, hands rise out of the floor.',
      'The same sheet, now a floor seen from just above it; cross lines make it checkered and flow pulls it toward us. The hands come up through the floor and grab on the bar.')),
    at(83, 6, { h0: { on: 1 } }),
    at(86, 6, { h1: { on: 1 } }),
    at(92, 3, { h0: { on: 0 }, h1: { on: 0 } }),

    // ———————————————————————————————————————— Tunnel
    at(93.5, 6, look('tunnel', LB), chapter('Tunnel',
      'The road curls up around us into a tunnel. Deep cherry waits at the far end.',
      'The camera rises from the floor while the equation trades straight lines for 1/r rings and spokes — the floor becomes a tunnel without a cut. The center fades into deep cherry.')),
    at(103, 6, { twist: 1.1, spokes: 16, freq: 11 }),

    // ———————————————————————————————————————— Orbs
    land(111, 1.5, look('orbs', { ...LB, glow: 0.35, focal: 1.7 }), { ease: 'expo', ...chapter('Orbs',
      'The second swell bursts us out of the tunnel into a field of rising spheres.',
      'A fast dolly-zoom: the lens widens as we pull back, so the tunnel stretches and opens into the orb field.') }),
    at(117, 6, { pitch: 1.0, frame: 0.55, orbN: 4, focal: 1.6, orbitRate: 0.06 }),

    // ———————————————————————————————————————— Chrome
    at(123.5, 3, look('chrome', {
      ...LB, handSoft: 0.3, folds: 1.2,
      h0: { on: 0, x: -0.32, y: 0.0, z: 0.12, s: 1.3, a: 0.3, curl: 0.3, spread: 0.6 },
      h1: { on: 0, x: 0.36, y: 0.12, z: 0.12, s: 1.2, a: -0.4, curl: 0.4, spread: 0.5 },
      h2: { on: 0, x: 0.0, y: -0.3, z: 0.12, s: 1.4, a: 0.0, curl: 0.2, spread: 0.8 },
    }), chapter('Weight',
      'The heaviest stretch. The membrane turns to liquid chrome; hands strain against it from behind, and for a moment a face.',
      'White lines on black with full lighting; loudness deepens the folds. Three hands press in one after another; then the face relief rises and sinks — its second and last peek before the end.')),
    at(128, 4, { h0: { on: 1 } }),
    at(130, 4, { h1: { on: 1 } }),
    at(132, 4, { h2: { on: 1 } }),
    at(134.5, 3, { h0: { on: 0 }, h1: { on: 0 }, h2: { on: 0 }, face: 1.1, faceS: 1.15, folds: 0.25, engrave: 1, refract: 1.1 }),
    at(139, 3, { face: 0, folds: 1.2, engrave: 0.75, refract: 1.6 }),

    // ———————————————————————————————————————— Lattice
    at(140.5, 6, look('lattice', { ...LB, paper: NIGHT, ink: CHALK, flyRate: 0.2, gyroType: 0.4 }), chapter('Lattice',
      'Tension. The chrome folds in on itself and becomes a lattice, and we fly into it.',
      'The membrane’s distance field is blended into a gyroid / Schwarz-P lattice, so the sheet physically melts into it; contour lines slice it as we fly.')),
    at(148, 6, { gyroType: 1 }),
    at(150, 8, { flyRate: 0.45, spinRate: 0.06, glow: 0.45, fog: CHERRY_DEEP }),

    // ———————————————————————————————————————— Bloom
    land(158, 1.5, look('bloom', { exposure: 0, letterbox: 0 }), { ease: 'expo', ...chapter('Bloom',
      'The guitar. Red floods in, the frame opens, the lattice snaps back into a sheet — and two hands break through it, grabbing at you.',
      'The red is measured from the Depression Cherry cover (#d80146). The hands switch from a soft union to a hard one, so they come through the lines instead of under them.') }),
    at(158, 0, { exposure: 1.1 }),
    at(158, 1.2, { exposure: 0 }, { ease: 'out' }),
    at(160, 6, { h0: { z: 0.6, s: 1.85 }, h1: { z: 0.55, s: 1.8 } }),

    // ———————————————————————————————————————— Rapture
    land(166, 1.5, look('whirlpool', { ...RED, light: 0, sway: 0.7 }), chapter('Rapture',
      'The solo. The equation keeps re-forming on every other bar: whirlpool, spiral, mandala, tunnel, sphere, orbs, chrome, lattice.',
      'No cuts — each look is a new set of weights in the same equation, gliding for one and a half bars and landing exactly on the downbeat.')),
    land(168, 1.5, look('spiral', { ...RED, sway: 0.6 })),
    land(170, 1.5, look('mandala', { ...RED })),
    land(172, 1.5, look('tunnel', { ...RED, fog: '#070203' })),
    land(174, 1.5, look('vasarely', { ...RED })),
    land(176, 1.5, look('orbs', { ...RED })),
    land(178, 1.5, look('chrome', { ...RED, ink: CHERRY })),
    land(180, 1.5, look('lattice', { ...RED, gyroType: 1 })),

    // ———————————————————————————————————————— Overload
    at(182, 1, { flyRate: 0.75, spinRate: 0.12, hitFlash: 0.6, aberr: 0.4, echo: 0.3 }, chapter('Overload',
      'Faster through the lattice, red and white trading places on the bar.',
      'Fly speed and spin climb; strong onsets flash the exposure; ink color swaps every two bars; echo trails.')),
    at(184, 1, { ink: CHALK }),
    at(186, 1, { ink: CHERRY }),
    at(188, 1, { ink: CHALK }),

    // ———————————————————————————————————————— Apex
    land(190, 2, look('face', { paper: '#0a0103', ink: '#df0149', fog: '#0a0103', face: 1.35, faceS: 1.4, freq: 50, frame: 0.75, light: 0.8, engrave: 1.1, refract: 1.3, glow: 0.65, letterbox: 0, sway: 0.7, focal: 2.6 }), chapter('Apex',
      'The last peak. The face, finally, carved into velvet — and on the final bars it breathes everything in.',
      'The face relief on a velvet palette from the cover; its mouth follows the mids. Then a pinch and a zoom into the center swallow the frame.')),
    at(197.5, 2.5, { bulge: -1, frame: 0.05, face: 0.6, exposure: -0.35 }, { ease: 'in' }),

    // ———————————————————————————————————————— Afterglow
    at(200, 0.3, look('afterglow', { ...LB, glow: 0.45 }), { ease: 'out', ...chapter('Afterglow',
      'The drop. Rings fall away into the dark while the red drains out of the light.',
      'A very fast glide (half a beat) exactly on the drop; then the glow fades over six bars.') }),
    at(201, 5, { glow: 0 }),

    // ———————————————————————————————————————— Snow again
    at(204.5, 4, look('snow', { ...LB, face: 0.5, faceS: 0.6 }), chapter('Snow Again',
      'Back to the snow. The face is still in there, smaller, fading — then even the noise goes dark.',
      'Rings dissolve back into static; the face relief sinks; exposure falls to black.')),
    at(209, 4, { face: 0 }),
    at(210, 4, { exposure: -1 }),
  ],
};
