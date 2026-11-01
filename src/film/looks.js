// Looks for the film world. A look is a set of parameter values; morphing between looks is the whole
// point, so every look is laid over NEUTRAL — anything a look doesn't use glides back to rest.
// These are shared by the PPP film, the smart music films and the Worlds mode.
import { CHERRY, CHERRY_DEEP, CHERRY_MID } from '../catalog.js';

export const BONE = '#f2f0ea';
export const INK = '#0b0b0b';
export const NIGHT = '#050505';
export const CHALK = '#ecebe6';
export { CHERRY, CHERRY_DEEP, CHERRY_MID };
const H = Math.PI / 2;
// pure 1-bit: no grain, no gate weave, no shading — just black and white
const PURE = { grain: 0.03, vignette: 0.1, flicker: 0, weave: 0, light: 0, engrave: 0, refract: 0, fog: '#000000' };

export const NEUTRAL = {
  focal: 8, frame: 0.6, pitch: 0, roll: 0, tx: 0, ty: 0,
  freq: 18, linA: 0, wLin: 1, wRad: 0, radLog: 0, radInv: 0, wAng: 0, check: 0, checkPolar: 0, moire: 0, contour: 0, thick: 0, stat: 0,
  square: 0, tri: 0, wrap: 0,
  twist: 0, bulge: 0, wave: 0, zig: 0, warpN: 0, kaleido: 0, cfog: 0, vortex: 0, pinch: 0, pinchX: 0,
  height: 1, folds: 0, ripple: 0, face: 0, orbs: 0, gyro: 0, sponge: 0, kifs: 0, columns: 0, penrose: 0, mobius: 0, rings: 0, handSoft: 0.15, refract: 0.6,
  hall: 0, hallWave: 0, blob: 0, drop: 0,
  paper: BONE, ink: INK, fog: '#000000', fogD: 0.15, light: 0, engrave: 0, invert: 0, echo: 0, exposure: 0,
  h0: { on: 0 }, h1: { on: 0 }, h2: { on: 0 },
  glow: 0, grain: 0.14, vignette: 0.45, aberr: 0, flicker: 0.1, weave: 0.15,
  sway: 0, swayX: 0, pulse: 0, react: 0.6, breathe: 0, grab: 0, hitFlash: 0,
  flow: 0, spinRate: 0, orbitRate: 0, flyRate: 0,
};

export const LOOKS = {
  snow: {
    cat: 'flat', name: 'Snow', blurb: 'TV static; a relief is only visible as denser snow',
    set: { stat: 1, freq: 40, linA: H, engrave: 1.5, grain: 0.3, flicker: 0.45, weave: 0.4, vignette: 0.75, faceS: 0.75, light: 0.25 },
  },
  scanlines: {
    cat: 'flat', name: 'Scan Lines', blurb: 'fine horizontal lines rocking on the bar',
    set: { freq: 36, linA: H, wave: 0.35, waveF: 4, sway: 0.35, engrave: 0.35, flow: 0.15 },
  },
  silk: {
    cat: 'deep', name: 'Silk', blurb: 'vertical lines in a slow current, folds catching the light',
    set: { freq: 30, linA: 0, wave: 0.7, waveF: 3, folds: 1.1, foldF: 4, refract: 1.5, focal: 2.6, light: 0.4, engrave: 0.65, sway: 0.55, react: 0.85, flow: 0.25 },
  },
  hands: {
    cat: 'bodies', name: 'Hands in Silk', blurb: 'hands pressing through a fabric of lines',
    set: {
      freq: 34, linA: 0, folds: 0.25, foldF: 4, light: 0.45, engrave: 0.7, sway: 0.3, handSoft: 0.22, grab: 0.4, flow: 0.15,
      h0: { on: 1, x: -0.22, y: -0.12, z: 0.02, s: 0.95, a: 0.25, curl: 0.15, spread: 0.6 },
      h1: { on: 1, x: 0.3, y: 0.05, z: -0.02, s: 0.85, a: -0.35, curl: 0.3, spread: 0.4 },
    },
  },
  landscape: {
    cat: 'deep', name: 'Line Landscape', blurb: 'the sheet tipped back into hills of ridge lines',
    set: { pitch: 1.1, focal: 1.8, frame: 0.5, ty: 0.3, linA: H, freq: 34, folds: 1.1, foldF: 4.5, light: 0.5, engrave: 0.55, fogD: 0.4, sway: 0.25, react: 1, orbitRate: 0.02, flow: 0.4 },
  },
  orbs: {
    cat: 'deep', name: 'Orb Field', blurb: 'a grid of spheres rising through the lines, a wave at a time',
    set: { pitch: 0.55, focal: 2.4, frame: 0.7, linA: 0.785, freq: 26, orbs: 1, orbN: 5, light: 0.65, engrave: 0.6, fogD: 0.3, react: 0.9, flow: 0.6, orbitRate: 0.03 },
  },
  road: {
    cat: 'deep', name: 'Endless Road', blurb: 'a checkered floor rolling toward you, the horizon rocking',
    set: { pitch: 1.22, focal: 1.5, frame: 0.45, ty: 1.2, linA: H, freq: 9, check: 0.8, checkA: H, folds: 0.25, foldF: 2.5, fogD: 0.45, sway: 0.8, flow: -2, light: 0.2, engrave: 0.3 },
  },
  tunnel: {
    cat: 'flat', name: 'Tunnel', blurb: 'rings and spokes falling into a deep red center',
    set: { wLin: 0, wRad: 1, radInv: 1, freq: 9, check: 1, checkPolar: 1, spokes: 12, flow: -2, cfog: 0.85, fog: CHERRY_DEEP, sway: 0.45, twist: 0.3, spinRate: 0.04 },
  },
  moire: {
    cat: 'flat', name: 'Ghost Rings', blurb: 'two ring sets drifting through each other; thin light on black',
    set: { wLin: 0, wRad: 1, freq: 46, moire: 1, moireOff: 0.3, thick: 0.45, paper: NIGHT, ink: CHALK, glow: 0.55, flow: 0.08, sway: 0.15, react: 0.3 },
  },
  chrome: {
    cat: 'deep', name: 'Chrome Silk', blurb: 'white lines on black, heavy liquid folds',
    set: { pitch: 0.25, focal: 2.2, linA: 0, freq: 24, folds: 1.6, foldF: 4.5, refract: 1.6, light: 1, engrave: 0.75, paper: NIGHT, ink: CHALK, glow: 0.25, react: 1.2, sway: 0.55, flow: 0.35 },
  },
  lattice: {
    cat: 'space', name: 'Lattice', blurb: 'the sheet melts into an endless 3D lattice you fly through',
    set: { gyro: 1, gyroS: 3.5, gyroType: 1, focal: 1.15, frame: 0.6, wLin: 0.25, contour: 0.85, freq: 16, light: 0.85, engrave: 0.55, fogD: 0.35, flyRate: 0.25, spinRate: 0.02, react: 0.9, glow: 0.3 },
  },
  whirlpool: {
    cat: 'flat', name: 'Whirlpool', blurb: 'rings wound up by a twist',
    set: { wLin: 0, wRad: 1, freq: 16, twist: 2.4, check: 0.85, checkPolar: 1, spokes: 8, flow: -0.5, spinRate: 0.06, sway: 0.3, cfog: 0.3 },
  },
  spiral: {
    cat: 'flat', name: 'Spiral', blurb: 'rings that became a spiral',
    set: { wLin: 0, wRad: 1, radLog: 0.6, wAng: 1, spokes: 3, freq: 20, flow: -0.8, sway: 0.3, cfog: 0.2 },
  },
  mandala: {
    cat: 'flat', name: 'Mandala', blurb: 'mirrored and folded into a kaleidoscope',
    set: { kaleido: 1, kaleidoN: 8, wLin: 0.6, wRad: 0.4, freq: 18, check: 0.6, checkA: 1.0, twist: 0.6, flow: 0.4, spinRate: 0.05, pulse: 0.6 },
  },
  vasarely: {
    cat: 'flat', name: 'Vasarely', blurb: 'a checkerboard swelling into a sphere',
    set: { freq: 11, check: 1, checkA: H, bulge: 0.9, light: 0, breathe: 0, sway: 0.3, pulse: 0.5 },
  },
  face: {
    cat: 'bodies', name: 'The Face', blurb: 'a face pressing through the lines',
    set: { freq: 40, linA: H, face: 1, faceS: 0.95, light: 0.55, engrave: 0.9, sway: 0.5 },
  },
  bloom: {
    cat: 'bodies', name: 'Red Bloom', blurb: 'red lines; hands break through and grab',
    set: {
      freq: 28, linA: H, paper: '#070203', ink: CHERRY, fog: '#070203', light: 0.7, engrave: 0.7, glow: 0.9, focal: 1.9, pitch: 0.12, frame: 0.7,
      handSoft: 0.035, grab: 1, sway: 0.6, react: 1.1,
      h0: { on: 1, x: -0.36, y: -0.3, z: 0.42, s: 1.7, a: 0.3, curl: 0.2, spread: 0.7 },
      h1: { on: 1, x: 0.4, y: -0.26, z: 0.38, s: 1.65, a: -0.3, curl: 0.3, spread: 0.6 },
    },
  },
  impossible: {
    cat: 'objects', name: 'Impossible', blurb: 'a Penrose triangle — it only closes up from exactly here',
    set: { freq: 34, linA: H, penrose: 1, objX: 0, objY: 0, objZ: 1.0, objS: 0.75, objSoft: 0.02, reveal: 0, light: 0.85, engrave: 0.85, refract: 0.3, focal: 7, frame: 0.65, sway: 0.1, paper: BONE, ink: INK },
  },
  mobius: {
    cat: 'objects', name: 'Möbius', blurb: 'a one-sided strip turning slowly under the lines',
    set: { freq: 30, linA: 0.5, mobius: 1, objX: 0, objY: 0, objZ: 0.32, objS: 0.62, objTilt: 1.0, objSpin: 0.2, objSoft: 0.1, light: 0.75, engrave: 0.7, refract: 1, focal: 3, sway: 0.25 },
  },
  gyroscope: {
    cat: 'objects', name: 'Gyroscope', blurb: 'three rings spinning inside each other',
    set: { freq: 24, linA: H, rings: 1, objX: 0, objY: 0, objZ: 0.45, objS: 0.62, objSoft: 0.02, objSpin: 0.25, light: 0.85, engrave: 0.6, refract: 0.5, focal: 4, paper: NIGHT, ink: CHALK, glow: 0.2 },
  },
  sponge: {
    cat: 'space', name: 'Menger Sponge', blurb: 'an infinite fractal of square holes, flown straight through',
    set: { sponge: 1, spaceS: 1.0, focal: 1.2, frame: 0.6, wLin: 0.3, contour: 0.8, freq: 14, light: 0.85, engrave: 0.6, fogD: 0.35, flyRate: 0.22, react: 0.8 },
  },
  crystals: {
    cat: 'space', name: 'Fractal Crystals', blurb: 'folding fractal crystals drifting past in the dark',
    set: { kifs: 1, spaceS: 0.75, kifsA: 0.6, focal: 1.25, frame: 0.6, contour: 0.6, wLin: 0.4, freq: 9, light: 0.95, engrave: 0.55, fogD: 0.22, flyRate: 0.16, spinRate: 0.02, glow: 0.2 },
  },
  colonnade: {
    cat: 'deep', name: 'Colonnade', blurb: 'endless columns rising out of a floor of lines',
    set: { columns: 1, colN: 0.9, colH: 1.0, pitch: 1.18, focal: 1.5, frame: 0.5, ty: 1.0, linA: H, freq: 22, check: 0.6, checkA: H, light: 0.7, engrave: 0.6, fogD: 0.4, flow: -0.5, sway: 0.4 },
  },
  portrait: {
    cat: 'bodies', name: 'Portrait Lines', blurb: 'fine lines tuned for your camera, pictures and words',
    set: { freq: 56, linA: H, light: 0.55, engrave: 0.9, refract: 1.3, focal: 4, sway: 0.15 },
  },
  afterglow: {
    cat: 'flat', name: 'Afterglow', blurb: 'white rings falling away into the dark',
    set: { wLin: 0, wRad: 1, radInv: 0.85, freq: 18, thick: 0.6, paper: NIGHT, ink: CHALK, cfog: 0.75, glow: 0.3, flow: -0.6, vignette: 0.8, twist: 0.4 },
  },
  // ---- after Beach House's "7" visualizer: hard black & white tiles — stripes, checkers, triangles, dots —
  // squeezed, wound into vortices, wrapped round floating shapes and laid along corridors you fly down
  opstripes: {
    cat: 'flat', name: 'Op Stripes', blurb: 'fat stripes flowing like hung fabric',
    set: { ...PURE, freq: 15, linA: 0, wave: 0.9, waveF: 3.5, warpN: 0.35, flow: 0.25, sway: 0.3 },
  },
  squeeze: {
    cat: 'flat', name: 'Squeeze', blurb: 'a checkerboard sliding through a band where it crushes into thin lines',
    set: { ...PURE, freq: 7, check: 1, checkA: H, pinch: 1, pinchX: 0.15, wave: 0.35, waveF: 2, bulge: 0.25, flow: 0.5, sway: 0.25 },
  },
  squares: {
    cat: 'flat', name: 'Square Tunnel', blurb: 'nested squares pouring out of a vanishing point',
    set: { ...PURE, wLin: 0, wRad: 1, radInv: 1, square: 1, freq: 9, flow: -1.4, twist: 0.25, swayX: 0.5, sway: 0.25, cfog: 0.35, fog: '#000000' },
  },
  diamonds: {
    cat: 'flat', name: 'Diamonds', blurb: 'diamond rings breathing in and out, crossed by a fan',
    set: { ...PURE, wLin: 0, wRad: 1, square: -1, freq: 13, check: 0.7, checkPolar: 1, spokes: 4, flow: -0.6, breathe: 0.4, pulse: 0.4 },
  },
  trivortex: {
    cat: 'flat', name: 'Triangle Vortex', blurb: 'triangles wound into a center that never ends',
    set: { ...PURE, freq: 8, check: 1, checkA: H, tri: 1, vortex: 2.4, spinRate: 0.06, flow: -0.3, cfog: 0.4, sway: 0.2 },
  },
  dots: {
    cat: 'deep', name: 'Dot Field', blurb: 'polka dots riding a slow swell',
    set: { ...PURE, freq: 13, check: 1, checkA: H, thick: 0.5, folds: 0.9, foldF: 2.4, refract: 1.4, pitch: 0.5, focal: 2.2, flow: 0.3, react: 0.9 },
  },
  dottunnel: {
    cat: 'flat', name: 'Dot Tunnel', blurb: 'rings of dots falling inward',
    set: { ...PURE, wLin: 0, wRad: 1, radInv: 1, freq: 8, check: 1, checkPolar: 1, spokes: 18, thick: 0.45, flow: -1.6, spinRate: 0.04, cfog: 0.5 },
  },
  trifloor: {
    cat: 'deep', name: 'Triangle Floor', blurb: 'a floor of triangles racing to the horizon',
    set: { ...PURE, pitch: 1.25, focal: 1.5, frame: 0.45, ty: 1.2, freq: 9, check: 1, checkA: H, tri: 1, flow: -1.6, fogD: 0.5, sway: 0.5 },
  },
  checkerhills: {
    cat: 'deep', name: 'Checker Hills', blurb: 'a checkerboard draped over hills, under a white sky',
    set: { ...PURE, pitch: 1.2, focal: 1.6, frame: 0.5, ty: 0.9, freq: 7, check: 1, checkA: H, folds: 1.8, foldF: 4, height: 2.2, fog: BONE, fogD: 0.3, flow: 0.35, orbitRate: 0.02, react: 1 },
  },
  zigzag: {
    cat: 'deep', name: 'Lightning', blurb: 'thin white zigzags cracking across the dark',
    set: { ...PURE, paper: NIGHT, ink: CHALK, freq: 5, thick: 0.82, wave: 1.7, waveF: 7, zig: 1, warpN: 0.25, pitch: 0.85, focal: 1.7, flow: 0.35, hitFlash: 0.4, glow: 0.2 },
  },
  hallway: {
    cat: 'space', name: 'Hallway', blurb: 'down a corridor of stripes, its walls rippling, open to the dark',
    set: { ...PURE, hall: 1, hallW: 0.55, hallOpen: 1, hallRound: 0, hallWave: 0.45, wrap: 1, wLin: 1, linA: 0, freq: 6, focal: 1.0, frame: 0.6, fogD: 0.22, flyRate: 0.55, sway: 0.25 },
  },
  shaft: {
    cat: 'space', name: 'Triangle Shaft', blurb: 'a square shaft tiled with triangles, white light at the end',
    set: { ...PURE, hall: 1, hallW: 0.7, hallOpen: 0, hallRound: 0, wrap: 1, freq: 7, check: 1, checkA: H, tri: 1, focal: 1.0, frame: 0.6, fog: BONE, fogD: 0.32, flyRate: 0.6, spinRate: 0.03 },
  },
  ringtunnel: {
    cat: 'space', name: 'Ring Tunnel', blurb: 'a round tunnel of rings, seen a little off its axis',
    set: { ...PURE, hall: 1, hallW: 0.5, hallRound: 1, wrap: 1, freq: 5, thick: 0.15, tx: 0.16, ty: -0.1, focal: 1.1, frame: 0.6, fogD: 0.3, flyRate: 0.4, swayX: 0.5 },
  },
  ball: {
    cat: 'objects', name: 'Striped Ball', blurb: 'a sphere of wavy stripes turning in the dark',
    set: { ...PURE, blob: 1, blobLump: 0, drop: 1, wrap: 1, objX: 0, objY: 0, objZ: 0.1, objS: 0.5, objTilt: 0.25, objSpin: 0.12, objSoft: 0.01, freq: 14, linA: 0, wave: 0.35, waveF: 5, focal: 3.2, frame: 0.65 },
  },
  blob: {
    cat: 'objects', name: 'Lumpy Blob', blurb: 'a twisted, two-lobed lump of stripes, turning',
    set: { ...PURE, blob: 1, blobLump: 1, drop: 1, wrap: 1, objX: 0, objY: 0, objZ: 0.1, objS: 0.42, objTilt: 0.45, objSpin: 0.2, objSoft: 0.01, freq: 18, linA: 0, focal: 3, frame: 0.65 },
  },
};

// how the looks are grouped in the panel (and which kinds auto-morph may pick)
export const LOOK_CATS = [
  ['flat', 'Flat op art'],
  ['deep', '3D sheets'],
  ['space', 'Fly through'],
  ['objects', 'Objects'],
  ['bodies', 'Hands & faces'],
];

export function look(name, extra = {}) {
  return { ...NEUTRAL, ...LOOKS[name].set, ...extra };
}
