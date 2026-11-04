// The looks. A look is a set of values laid over NEUTRAL (so anything it doesn't use glides back to rest),
// plus the handful of sliders that matter most for it (`tweaks`). Looks are grouped into sections that
// belong together; switching between any two glides the whole equation from one to the other.

export const CHERRY = '#d80146';
export const CHERRY_DEEP = '#5e021d';
export const BONE = '#f2f0ea';
export const INK = '#0b0b0b';
export const NIGHT = '#050505';
export const CHALK = '#ecebe6';
const H = Math.PI / 2;

export const NEUTRAL = {
  focal: 8, frame: 0.6, pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0,
  freq: 18, thick: 0, frot: 0, linA: 0, wLin: 1, wRad: 0, radLog: 0, radInv: 0, square: 0, wAng: 0, spokes: 6,
  check: 0, checkA: H, checkPolar: 0, tri: 0, moire: 0, contour: 0, wrap: 0, refract: 0.6, blaze: 0, blazeN: 24,
  hyper: 0, hyperP: 8, hyperQ: 3, hyperS: 0.56, cube: 0, cubeShift: 0.5, truchet: 0, truchetLine: 0, quasi: 0, quasiN: 7,
  cym: 0, cymN: 3, cymM: 5, cymRound: 0, cymSand: 0, julia: 0, juliaA: 0.7, juliaR: 0.76, agate: 0, wells: 0, wellN: 3, wellR: 0.35, living: 0,
  conf: 0, confA: 0, confP: 0, confX: 0.28, planes: 0, ori: 0, oriF: 5, stud: 0,
  twist: 0, vortex: 0, bulge: 0, wave: 0, waveF: 6, zig: 0, warpN: 0, pinch: 0, pinchX: 0, kaleido: 0, kaleidoN: 6, cfog: 0,
  swell: 0, swellF: 3, swellRate: 1.5,
  height: 1, folds: 0, foldF: 6, ripple: 0, orbs: 0, orbN: 5,
  gyro: 0, sponge: 0, hall: 0, hallWave: 0, columns: 0,
  penrose: 0, mobius: 0, blob: 0, drop: 0, objSoft: 0.06,
  paper: BONE, ink: INK, ink2: CHERRY, fog: '#000000', bands: 0, glowColor: CHERRY,
  fogD: 0.15, light: 0, engrave: 0, invert: 0, echo: 0, exposure: 0,
  glow: 0, grain: 0.08, vignette: 0.3, aberr: 0,
  sway: 0, swayX: 0, pulse: 0, react: 0.6, breathe: 0, grab: 0, hitFlash: 0,
  flow: 0, spinRate: 0, orbitRate: 0, flyRate: 0, objSpin: 0, hueRate: 0,
};

// crisp 1-bit: no grain, no vignette, no shading — just black and white
const PURE = { grain: 0.03, vignette: 0.1, light: 0, engrave: 0, refract: 0, fog: '#000000' };

export const GROUPS = [
  ['solid', 'Solid', 'flat, hard-edged, black and white'],
  ['strange', 'Strange', 'patterns that come out of mathematics and sound'],
  ['worlds', 'Worlds', 'the pattern as a place'],
];

export const LOOKS = {
  // ---------------------------------------------------------------- lines
  stripes: {
    group: 'solid', name: 'Op Stripes', blurb: 'fat stripes flowing like hung fabric',
    set: { ...PURE, freq: 15, wave: 0.9, waveF: 3.5, warpN: 0.35, flow: 0.25, sway: 0.3 },
    tweaks: ['wave', 'waveF', 'warpN', 'twist'],
  },
  squeeze: {
    group: 'solid', name: 'Squeeze', blurb: 'a checkerboard sliding through a band where it crushes into thin lines',
    set: { ...PURE, freq: 7, check: 1, pinch: 1, pinchX: 0.15, wave: 0.35, waveF: 2, bulge: 0.25, flow: 0.5, sway: 0.25 },
    tweaks: ['pinch', 'pinchX', 'check', 'bulge'],
  },
  lightning: {
    group: 'strange', name: 'Lightning', blurb: 'thin white zigzags cracking across the dark',
    set: { ...PURE, paper: NIGHT, ink: CHALK, freq: 5, thick: 0.82, wave: 1.7, waveF: 7, zig: 1, warpN: 0.25, pitch: 0.85, focal: 1.7, flow: 0.35, hitFlash: 0.4, glow: 0.2 },
    tweaks: ['wave', 'zig', 'waveF', 'warpN'],
  },
  moire: {
    group: 'strange', name: 'Ghost Rings', blurb: 'two sets of rings drifting through each other',
    set: { wLin: 0, wRad: 1, freq: 46, moire: 1, moireOff: 0.3, thick: 0.45, paper: NIGHT, ink: CHALK, glow: 0.55, flow: 0.08, sway: 0.15, react: 0.3 },
    tweaks: ['moire', 'moireOff'],
  },
  // ---------------------------------------------------------------- rings & tunnels
  tunnel: {
    group: 'strange', name: 'Tunnel', blurb: 'rings and spokes falling into a deep red center',
    set: { wLin: 0, wRad: 1, radInv: 1, freq: 9, check: 1, checkPolar: 1, spokes: 12, flow: -2, cfog: 0.85, fog: CHERRY_DEEP, sway: 0.45, twist: 0.3, spinRate: 0.04 },
    tweaks: ['spokes', 'twist', 'cfog', 'check'],
  },
  squares: {
    group: 'solid', name: 'Square Tunnel', blurb: 'nested squares pouring out of a vanishing point',
    set: { ...PURE, wLin: 0, wRad: 1, radInv: 1, square: 1, freq: 9, flow: -1.4, twist: 0.25, swayX: 0.5, sway: 0.25, cfog: 0.35 },
    tweaks: ['square', 'twist', 'radInv', 'cfog'],
  },
  diamonds: {
    group: 'solid', name: 'Diamonds', blurb: 'diamond rings breathing in and out, crossed by a fan',
    set: { ...PURE, wLin: 0, wRad: 1, square: -1, freq: 13, check: 0.7, checkPolar: 1, spokes: 4, flow: -0.6, breathe: 0.4, pulse: 0.4 },
    tweaks: ['square', 'spokes', 'check', 'twist'],
  },
  spiral: {
    group: 'strange', name: 'Spiral', blurb: 'rings that became a spiral',
    set: { wLin: 0, wRad: 1, radLog: 0.6, wAng: 1, spokes: 3, freq: 20, flow: -0.8, sway: 0.3, cfog: 0.2 },
    tweaks: ['spokes', 'radLog', 'twist', 'vortex'],
  },
  whirlpool: {
    group: 'solid', name: 'Whirlpool', blurb: 'rings wound up by a twist',
    set: { wLin: 0, wRad: 1, freq: 16, twist: 2.4, check: 0.85, checkPolar: 1, spokes: 8, flow: -0.5, spinRate: 0.06, sway: 0.3, cfog: 0.3 },
    tweaks: ['twist', 'spokes', 'check', 'cfog'],
  },
  // ---------------------------------------------------------------- tiles
  trivortex: {
    group: 'solid', name: 'Triangle Vortex', blurb: 'triangles wound into a center that never ends',
    set: { ...PURE, freq: 8, check: 1, tri: 1, vortex: 2.4, spinRate: 0.06, flow: -0.3, cfog: 0.4, sway: 0.2 },
    tweaks: ['vortex', 'tri', 'checkA', 'cfog'], ride: { vortex: 0.8, frot: 0.3 },
  },
  vasarely: {
    group: 'solid', name: 'Vasarely', blurb: 'a checkerboard swelling into a sphere',
    set: { freq: 11, check: 1, bulge: 0.9, sway: 0.3, pulse: 0.5 },
    tweaks: ['bulge', 'checkA', 'tri', 'twist'],
  },
  dottunnel: {
    group: 'strange', name: 'Dot Tunnel', blurb: 'rings of dots falling inward',
    set: { ...PURE, wLin: 0, wRad: 1, radInv: 1, freq: 8, check: 1, checkPolar: 1, spokes: 18, thick: 0.45, flow: -1.6, spinRate: 0.04, cfog: 0.5 },
    tweaks: ['spokes', 'twist', 'vortex', 'cfog'],
  },
  mandala: {
    group: 'strange', name: 'Mandala', blurb: 'mirrored and folded into a kaleidoscope',
    set: { kaleido: 1, kaleidoN: 8, wLin: 0.6, wRad: 0.4, freq: 18, check: 0.6, checkA: 1.0, twist: 0.6, flow: 0.4, spinRate: 0.05, pulse: 0.6 },
    tweaks: ['kaleidoN', 'twist', 'check', 'tri'],
  },
  // ---------------------------------------------------------------- new, solid
  spirals: {
    group: 'solid', name: 'Endless Triangles', blurb: 'triangles wound into a spiral, keeping their shape as they fall in for ever',
    set: { ...PURE, freq: 8, check: 1, tri: 1, conf: 1, spokes: 14, confA: 5, flow: -1.2, spinRate: 0.03 },
    tweaks: ['spokes', 'confA', 'tri', 'freq'], ride: { confA: 0, frot: 0.5, bulge: 0.2 },
  },
  dipole: {
    group: 'solid', name: 'Two Poles', blurb: 'a checkerboard pouring out of one point and into another',
    set: { ...PURE, freq: 8, check: 1, conf: 1, spokes: 12, confA: 0, confP: -1, confX: 0.3, flow: -1.1 },
    tweaks: ['confX', 'spokes', 'confA', 'tri'], ride: { confX: 0.12, frot: 0.3 },
  },
  twins: {
    group: 'solid', name: 'Twin Whirlpools', blurb: 'two vortices of triangles, turning round each other',
    set: { ...PURE, freq: 8, check: 1, tri: 1, conf: 1, spokes: 8, confA: 4, confP: 1, confX: 0.26, flow: -0.9, spinRate: 0.07 },
    tweaks: ['confX', 'spokes', 'confA', 'tri'], ride: { confX: 0.1, frot: 0.4 },
  },
  circlelimit: {
    group: 'solid', name: 'Circle Limit', blurb: 'triangles to the edge of infinity, after Escher: a hyperbolic plane, flying forward',
    set: { ...PURE, hyper: 1, hyperP: 8, hyperQ: 3, flow: 1.4, spinRate: 0.02, fog: '#000000' },
    tweaks: ['hyperP', 'hyperQ', 'hyperS', 'flow'], ride: { hyperS: 0.04, frot: 0.5 },
  },
  blocks: {
    group: 'solid', name: 'Tumbling Blocks', blurb: 'cubes out of flat rhombi, pushing in and out like pistons',
    set: { ...PURE, cube: 1, freq: 14, cubeShift: 0.6, flow: 0.6 },
    tweaks: ['freq', 'cubeShift', 'twist', 'bulge'], ride: { bulge: 0.3, frot: 0.15 },
  },
  maze: {
    group: 'solid', name: 'Truchet', blurb: 'a maze with no ends, its tiles flipping with the music',
    set: { ...PURE, truchet: 1, freq: 22, spinRate: 0.015, wave: 0.15, waveF: 3 },
    tweaks: ['freq', 'truchetLine', 'wave', 'twist'], ride: { twist: 0.5, bulge: 0.15 },
  },
  blaze: {
    group: 'solid', name: 'Blaze', blurb: 'rings that zigzag out of step, after Bridget Riley',
    set: { ...PURE, wLin: 0, wRad: 1, freq: 12, blaze: 1, blazeN: 28, flow: -0.7 },
    tweaks: ['blaze', 'blazeN', 'freq', 'square'], ride: { blazeN: 3, frot: 0.2 },
  },
  stargate: {
    group: 'solid', name: 'Stargate', blurb: 'a floor and a ceiling racing out of the horizon',
    set: { ...PURE, planes: 1, freq: 5, check: 1, tri: 0, flow: -2.6, linA: H, vignette: 0.5 },
    tweaks: ['freq', 'check', 'tri', 'flow'], ride: { roll: 0.3, twist: 0.2 },
  },
  // ---------------------------------------------------------------- new, strange
  cymatics: {
    group: 'strange', name: 'Cymatics', blurb: 'sand on a singing plate: the note decides the figure, and a slide slides it',
    set: { ...PURE, cym: 1, cymN: 3, cymM: 5, cymSand: 0, flow: 0.1 },
    tweaks: ['cymN', 'cymM', 'cymRound', 'cymSand'], melody: 'cym',
  },
  sand: {
    group: 'strange', name: 'Chladni Sand', blurb: 'the lines of a round plate, white on black',
    set: { ...PURE, paper: NIGHT, ink: CHALK, cym: 1, cymN: 4, cymM: 3, cymRound: 1, cymSand: 1, glow: 0.2, glowColor: CHALK, flow: 0.4 },
    tweaks: ['cymN', 'cymM', 'cymRound', 'cymSand'], melody: 'cym',
  },
  julia: {
    group: 'strange', name: 'Julia', blurb: 'a fractal that walks round with the tune',
    set: { ...PURE, julia: 1, juliaA: 0.7, juliaR: 0.76, freq: 34, flow: 0.8 },
    tweaks: ['juliaA', 'juliaR', 'freq', 'kaleido'], melody: 'julia',
  },
  quasi: {
    group: 'strange', name: 'Quasicrystal', blurb: 'seven plane waves that never quite repeat',
    set: { ...PURE, quasi: 1, quasiN: 7, freq: 14, flow: 0.7, spinRate: 0.015 },
    tweaks: ['quasiN', 'freq', 'twist', 'bulge'], ride: { frot: 0.25, bulge: 0.2 },
  },
  agate: {
    group: 'strange', name: 'Agate', blurb: 'contour lines of a stone that never stops folding',
    set: { ...PURE, agate: 1, freq: 13, flow: 0.5 },
    tweaks: ['freq', 'thick', 'twist', 'bulge'], ride: { bulge: 0.25, twist: 0.4 },
  },
  tank: {
    group: 'strange', name: 'Ripple Tank', blurb: 'rings from three sources, adding up; the sources drift with the music',
    set: { ...PURE, wLin: 0, wells: 1, wellN: 3, wellR: 0.32, freq: 22, flow: -1.1 },
    tweaks: ['wellN', 'wellR', 'freq', 'thick'], ride: { wellR: 0.1 }, melody: 'wells',
  },
  living: {
    group: 'strange', name: 'Living Labyrinth', blurb: 'it grows by itself, like a fingerprint or a coral; the beat feeds it',
    set: { ...PURE, living: 1, wave: 0.08, waveF: 3, spinRate: 0.01 },
    tweaks: ['twist', 'bulge', 'wave', 'thick'], ride: { twist: 0.4, bulge: 0.2 },
  },
  // ---------------------------------------------------------------- 3D sheets
  silk: {
    group: 'worlds', name: 'Silk', blurb: 'vertical lines in a slow current, folds catching the light',
    set: { freq: 30, wave: 0.7, waveF: 3, folds: 1.1, foldF: 4, refract: 1.5, focal: 2.6, light: 0.4, engrave: 0.65, sway: 0.55, react: 0.85, flow: 0.25 },
    tweaks: ['folds', 'foldF', 'wave', 'engrave'],
  },
  chrome: {
    group: 'worlds', name: 'Chrome Silk', blurb: 'white lines on black, heavy liquid folds',
    set: { pitch: 0.25, focal: 2.2, freq: 24, folds: 1.6, foldF: 4.5, refract: 1.6, light: 1, engrave: 0.75, paper: NIGHT, ink: CHALK, glow: 0.25, react: 1.2, sway: 0.55, flow: 0.35 },
    tweaks: ['folds', 'foldF', 'light', 'refract'],
  },
  landscape: {
    group: 'worlds', name: 'Line Landscape', blurb: 'the sheet tipped back into hills of ridge lines',
    set: { pitch: 1.1, focal: 1.8, frame: 0.5, ty: 0.3, linA: H, freq: 34, folds: 1.1, foldF: 4.5, light: 0.5, engrave: 0.55, fogD: 0.4, sway: 0.25, react: 1, orbitRate: 0.02, flow: 0.4 },
    tweaks: ['folds', 'height', 'pitch', 'fogD'],
  },
  checkerhills: {
    group: 'worlds', name: 'Checker Hills', blurb: 'a checkerboard draped over hills, under a white sky',
    set: { ...PURE, pitch: 1.2, focal: 1.6, frame: 0.5, ty: 0.9, freq: 7, check: 1, folds: 1.8, foldF: 4, height: 2.2, fog: BONE, fogD: 0.3, flow: 0.35, orbitRate: 0.02, react: 1 },
    tweaks: ['folds', 'height', 'tri', 'pitch'],
  },
  trifloor: {
    group: 'worlds', name: 'Triangle Floor', blurb: 'a floor of triangles racing to the horizon',
    set: { ...PURE, pitch: 1.25, focal: 1.5, frame: 0.45, ty: 1.2, freq: 9, check: 1, tri: 1, flow: -1.6, fogD: 0.5, sway: 0.5 },
    tweaks: ['folds', 'tri', 'pitch', 'fogD'],
  },
  road: {
    group: 'worlds', name: 'Endless Road', blurb: 'a checkered floor rolling toward you, the horizon rocking',
    set: { pitch: 1.22, focal: 1.5, frame: 0.45, ty: 1.2, linA: H, freq: 9, check: 0.8, folds: 0.25, foldF: 2.5, fogD: 0.45, sway: 0.8, flow: -2, light: 0.2, engrave: 0.3 },
    tweaks: ['folds', 'check', 'pitch', 'fogD'],
  },
  dots: {
    group: 'worlds', name: 'Dot Field', blurb: 'polka dots riding a slow swell',
    set: { ...PURE, freq: 13, check: 1, thick: 0.5, folds: 0.9, foldF: 2.4, refract: 1.4, pitch: 0.5, focal: 2.2, flow: 0.3, react: 0.9 },
    tweaks: ['folds', 'foldF', 'refract', 'pitch'],
  },
  orbs: {
    group: 'worlds', name: 'Orb Field', blurb: 'a grid of spheres rising through the lines, a wave at a time',
    set: { pitch: 0.55, focal: 2.4, frame: 0.7, linA: 0.785, freq: 26, orbs: 1, orbN: 5, light: 0.65, engrave: 0.6, fogD: 0.3, react: 0.9, flow: 0.6, orbitRate: 0.03 },
    tweaks: ['orbs', 'orbN', 'pitch', 'engrave'],
  },
  origami: {
    group: 'worlds', name: 'Origami', blurb: 'a sheet pleated into hard zigzags, the lines breaking at every fold',
    set: { ...PURE, pitch: 0.8, focal: 2.0, frame: 0.55, linA: H, freq: 16, ori: 1, oriF: 4, refract: 1.1, light: 0.35, flow: 0.4, orbitRate: 0.015, fogD: 0.25 },
    tweaks: ['ori', 'oriF', 'refract', 'pitch'], ride: { height: 0.4 },
  },
  hobnail: {
    group: 'worlds', name: 'Hobnail', blurb: 'a floor of hard little pyramids, a checkerboard bent over them',
    set: { ...PURE, pitch: 0.95, focal: 1.8, frame: 0.5, ty: 0.4, freq: 8, check: 1, stud: 1, oriF: 5, refract: 0.9, flow: -0.8, fogD: 0.3 },
    tweaks: ['stud', 'oriF', 'refract', 'pitch'], ride: { height: 0.5 },
  },
  // ---------------------------------------------------------------- fly through
  hallway: {
    group: 'worlds', name: 'Hallway', blurb: 'down a corridor of stripes, its walls rippling, open to the dark',
    set: { ...PURE, hall: 1, hallW: 0.55, hallOpen: 1, hallRound: 0, hallWave: 0.45, wrap: 1, freq: 6, focal: 1.0, frame: 0.6, fogD: 0.22, flyRate: 0.55, sway: 0.25 },
    tweaks: ['hallW', 'hallWave', 'hallOpen', 'check'],
  },
  shaft: {
    group: 'worlds', name: 'Triangle Shaft', blurb: 'a square shaft tiled with triangles, white light at the end',
    set: { ...PURE, hall: 1, hallW: 0.7, hallOpen: 0, hallRound: 0, wrap: 1, freq: 7, check: 1, tri: 1, focal: 1.0, frame: 0.6, fog: BONE, fogD: 0.32, flyRate: 0.6, spinRate: 0.03 },
    tweaks: ['hallW', 'hallRound', 'tri', 'hallWave'],
  },
  ringtunnel: {
    group: 'worlds', name: 'Ring Tunnel', blurb: 'a round tunnel of rings, seen a little off its axis',
    set: { ...PURE, hall: 1, hallW: 0.5, hallRound: 1, wrap: 1, freq: 5, thick: 0.15, tx: 0.16, ty: -0.1, focal: 1.1, frame: 0.6, fogD: 0.3, flyRate: 0.4, swayX: 0.5 },
    tweaks: ['hallW', 'hallWave', 'tx', 'check'],
  },
  lattice: {
    group: 'worlds', name: 'Lattice', blurb: 'the sheet melts into an endless 3D lattice you fly through',
    set: { gyro: 1, gyroS: 3.5, gyroType: 1, focal: 1.15, frame: 0.6, wLin: 0.25, contour: 0.85, freq: 16, light: 0.85, engrave: 0.55, fogD: 0.35, flyRate: 0.25, spinRate: 0.02, react: 0.9, glow: 0.3 },
    tweaks: ['gyroS', 'gyroType', 'contour', 'light'],
  },
  sponge: {
    group: 'worlds', name: 'Menger Sponge', blurb: 'an infinite fractal of square holes, flown straight through',
    set: { sponge: 1, spaceS: 1.0, focal: 1.2, frame: 0.6, wLin: 0.3, contour: 0.8, freq: 14, light: 0.85, engrave: 0.6, fogD: 0.35, flyRate: 0.22, react: 0.8 },
    tweaks: ['spaceS', 'contour', 'light', 'fogD'],
  },
  colonnade: {
    group: 'worlds', name: 'Colonnade', blurb: 'endless columns rising out of a floor of lines',
    set: { columns: 1, colN: 0.9, colH: 1.0, pitch: 1.18, focal: 1.5, frame: 0.5, ty: 1.0, linA: H, freq: 22, check: 0.6, light: 0.7, engrave: 0.6, fogD: 0.4, flow: -0.5, sway: 0.4 },
    tweaks: ['colN', 'colH', 'pitch', 'check'],
  },
  // ---------------------------------------------------------------- shapes in the dark
  ball: {
    group: 'worlds', name: 'Striped Ball', blurb: 'a sphere of wavy stripes turning in the dark',
    set: { ...PURE, blob: 1, blobLump: 0, drop: 1, wrap: 1, objX: 0, objY: 0, objZ: 0.1, objS: 0.5, objTilt: 0.25, objSpin: 0.12, objSoft: 0.01, freq: 14, wave: 0.35, waveF: 5, focal: 3.2, frame: 0.65 },
    tweaks: ['objS', 'blobLump', 'objTilt', 'wave'],
  },
  impossible: {
    group: 'worlds', name: 'Impossible', blurb: 'a Penrose triangle — it only closes up from exactly here',
    set: { freq: 34, linA: H, penrose: 1, objX: 0, objY: 0, objZ: 1.0, objS: 0.75, objSoft: 0.02, reveal: 0, light: 0.85, engrave: 0.85, refract: 0.3, focal: 7, frame: 0.65, sway: 0.1 },
    tweaks: ['reveal', 'objS', 'engrave', 'freq'],
  },
  mobius: {
    group: 'worlds', name: 'Möbius', blurb: 'a one-sided strip turning slowly under the lines',
    set: { freq: 30, linA: 0.5, mobius: 1, objX: 0, objY: 0, objZ: 0.32, objS: 0.62, objTilt: 1.0, objSpin: 0.2, objSoft: 0.1, light: 0.75, engrave: 0.7, refract: 1, focal: 3, sway: 0.25 },
    tweaks: ['objTilt', 'objS', 'objSoft', 'engrave'],
  },
};

// how the cinematic camera treats a look
const CAM = {
  open: ['stripes', 'squeeze', 'lightning', 'blocks', 'maze', 'quasi', 'agate', 'living', 'silk', 'chrome', 'landscape', 'checkerhills', 'trifloor', 'road', 'dots', 'orbs', 'origami', 'hobnail', 'colonnade'],
  fly: ['hallway', 'shaft', 'ringtunnel', 'lattice', 'sponge', 'stargate'],
  object: ['ball', 'impossible', 'mobius'],
};
export const camKind = id => Object.keys(CAM).find(k => CAM[k].includes(id)) || 'center';

export function look(id, extra = {}) {
  return { ...NEUTRAL, ...LOOKS[id].set, ...extra };
}

// colors: one click recolors the look (they're a tweak like any other, so Reset brings the look's own back)
export const COLOR_KEYS = ['paper', 'ink', 'ink2', 'fog', 'bands', 'glow', 'glowColor', 'hueRate'];
export const PALETTES = [
  { name: 'Black & white', paper: BONE, ink: INK, fog: '#000000' },
  { name: 'White on black', paper: NIGHT, ink: CHALK, fog: '#000000' },
  { name: 'Cherry', paper: '#070203', ink: CHERRY, fog: '#070203', glow: 0.6, glowColor: CHERRY },
  { name: 'Cherry on bone', paper: '#f1ece4', ink: CHERRY, fog: '#2a0610' },
  { name: 'Cherry & ink', paper: '#f1ece4', ink: INK, ink2: CHERRY, bands: 1, fog: '#1a0408' },
  { name: 'Blueprint', paper: '#123a7a', ink: '#e7efff', fog: '#061a3a' },
  { name: 'Acid', paper: '#0a0a0a', ink: '#d7ff3a', fog: '#000000', glow: 0.4, glowColor: '#d7ff3a' },
  { name: 'Bubblegum', paper: '#ffd3e6', ink: '#2b1d5c', fog: '#2b1d5c' },
  { name: 'Gilded', paper: '#121110', ink: '#d9b45a', fog: '#000000', glow: 0.3, glowColor: '#d9b45a' },
  { name: 'Sunset', paper: '#1a0f2e', ink: '#ff6b6b', ink2: '#ffd43b', bands: 1, fog: '#1a0f2e', glow: 0.4, glowColor: '#ff6b6b' },
  { name: 'Deep sea', paper: '#031b26', ink: '#3ad1c3', ink2: '#1b8fbf', bands: 1, fog: '#020d13' },
  { name: 'Prism', paper: '#0b0b0b', ink: '#ff3b3b', ink2: '#3b7bff', bands: 1, fog: '#000000', hueRate: 0.08, glow: 0.3, glowColor: '#ffffff' },
  { name: 'Candy', paper: '#fff6ea', ink: '#ff4fa3', ink2: '#28c2ff', bands: 1, fog: '#fff6ea' },
];
