// Every knob of the world, in one list. A look is a set of these values, and switching looks glides them,
// so the equation itself re-forms instead of cutting.
//
// kind:  shader – sent to the GPU every frame
//        color  – a hex color, sent as three floats
//        rate   – a "per bar" speed, added up over time into a shader value (see RATE_TARGETS)
//        mod    – how much the music moves things, applied in JS every frame
//        post   – the finishing pass (glow, grain, vignette, color split)
// group: where the slider lives in Tweak → More. No group = set by the app (add-ons, sound, motion), never a slider.

const P = (name, def, min, max, group = null, label = null, kind = 'shader') => ({ name, def, min, max, group, label, kind });
const C = (name, def, group, label, kind = 'color') => ({ name, def, group, label, kind });

const HANDS = [];
for (let i = 0; i < 3; i++) {
  HANDS.push(
    P(`h${i}on`, 0, 0, 1), P(`h${i}x`, 0, -3, 3), P(`h${i}y`, 0, -3, 3), P(`h${i}z`, 0.05, -0.6, 0.8),
    P(`h${i}s`, 1, 0.3, 4), P(`h${i}a`, 0, -3.2, 3.2), P(`h${i}curl`, 0.25, -0.3, 1.6), P(`h${i}spread`, 0.5, 0, 1.5),
  );
}

export const PARAMS = [
  // camera
  P('focal', 8, 0.8, 12, 'camera', 'Lens: wide ↔ flat'),
  P('frame', 0.6, 0.05, 3, 'camera', 'Zoom out'),
  P('pitch', 0, -1.3, 1.4, 'camera', 'Tilt back'),
  P('yaw', 0, -3.14, 3.14, 'camera', 'Turn around'),
  P('roll', 0, -3.14, 3.14, 'camera', 'Roll'),
  P('tx', 0, -2, 2, 'camera', 'Pan ↔'),
  P('ty', 0, -2, 2, 'camera', 'Pan ↕'),
  P('fly', 0, 0, 0),
  // the line equation
  P('freq', 14, 2, 90, 'lines', 'Line count'),
  P('thick', 0, -0.9, 0.9, 'lines', 'Ink: bold ↔ thin'),
  P('frot', 0, -3.14, 3.14, 'lines', 'Turn'),
  P('linA', 0, -3.14, 3.14, 'lines', 'Line angle'),
  P('wLin', 1, 0, 1, 'lines', 'Straight lines'),
  P('wRad', 0, 0, 1, 'lines', 'Rings'),
  P('radLog', 0, 0, 1, 'lines', 'Rings: even ↔ deep'),
  P('radInv', 0, 0, 1, 'lines', 'Tunnel'),
  P('square', 0, -1, 1, 'lines', 'Rings: diamond ↔ round ↔ square'),
  P('wAng', 0, 0, 1, 'lines', 'Spiral'),
  P('spokes', 6, 1, 24, 'lines', 'Spiral arms / spokes'),
  P('check', 0, 0, 1, 'lines', 'Cross lines (checkers)'),
  P('checkA', 1.5708, -3.14, 3.14, 'lines', 'Cross angle'),
  P('checkPolar', 0, 0, 1, 'lines', 'Cross with spokes'),
  P('tri', 0, 0, 1, 'lines', 'Checkers → triangles'),
  P('moire', 0, 0, 1, 'lines', 'Moiré'),
  P('moireOff', 0.25, 0, 1, 'lines', 'Moiré gap'),
  P('contour', 0, 0, 1, 'lines', 'Contour slices'),
  P('wrap', 0, 0, 1, 'lines', 'Lines wrap round shapes and walls'),
  P('refract', 0, 0, 2, 'lines', 'Lines bend over the relief'),
  P('blaze', 0, 0, 1, 'lines', 'Rings zigzag'),
  P('blazeN', 24, 3, 60, 'lines', 'Zigzags round the ring'),
  P('phase', 0, 0, 0),
  // patterns that aren't lines at all: each replaces the line equation as it comes up
  P('hyper', 0, 0, 1, 'strange', 'Hyperbolic tiles'),
  P('hyperP', 8, 4, 12, 'strange', 'Hyperbolic: how many meet at the middle'),
  P('hyperQ', 3, 3, 8, 'strange', 'Hyperbolic: how many meet at each corner'),
  P('hyperS', 0.56, 0.2, 2, 'strange', 'Hyperbolic: size of the disk'),
  P('cube', 0, 0, 1, 'strange', 'Tumbling blocks'),
  P('cubeShift', 0.5, 0, 1, 'strange', 'Blocks: pistons'),
  P('truchet', 0, 0, 1, 'strange', 'Truchet maze'),
  P('truchetLine', 0, 0, 1, 'strange', 'Maze: solid ↔ lines'),
  P('truchetT', 0, 0, 0),
  P('crys', 0, 0, 1, 'strange', 'Crystal: families of lines'),
  P('crysN', 5, 2, 7, 'strange', 'Crystal: how many families'),
  P('crysT', 0, -3.14, 3.14, 'strange', 'Crystal: turn'),
  P('sumi', 0, 0, 1, 'strange', 'Marbled ink, dropped by the music'),
  P('lock', 0, 0, 1, 'strange', 'Squares turning into interlocking shapes'),
  P('lockA', 1, 0, 2, 'strange', 'Interlock: how far gone'),
  P('cells', 0, 0, 1, 'strange', 'Cells: dots in a grid, swelling with the sound'),
  P('cellSq', 0, 0, 1, 'strange', 'Cells: round ↔ square'),
  P('star', 0, 0, 1, 'strange', 'Star lattice'),
  P('starA', 0.6, 0.05, 1.5, 'strange', 'Star: how sharp'),
  P('starB', 8, 1, 24, 'strange', 'Star: rings in each'),
  P('starHex', 0, 0, 1, 'strange', 'Star: fours ↔ sixes'),
  P('lace', 0, 0, 1, 'strange', 'Circle lace'),
  P('laceK', 1.2, 0.8, 1.6, 'strange', 'Lace: its shape'),
  P('laceB', 3, 0.5, 12, 'strange', 'Lace: bands'),
  P('weave', 0, 0, 1, 'strange', 'Woven ribbons'),
  P('seig', 0, 0, 1, 'strange', 'Wave scales'),
  P('ouchi', 0, 0, 1, 'strange', 'Discs floating on bricks'),
  P('ouchiT', 0, 0, 0),
  P('pins', 0, 0, 1, 'shape', 'A bed of pins'),
  P('pinF', 34, 6, 90, 'shape', 'Pins across'),
  P('quasi', 0, 0, 1, 'strange', 'Quasicrystal'),
  P('quasiN', 7, 3, 13, 'strange', 'Quasicrystal: folds'),
  P('cym', 0, 0, 1, 'strange', 'Cymatics'),
  P('cymN', 3, 1, 14, 'strange', 'Cymatics: first mode'),
  P('cymM', 5, 1, 14, 'strange', 'Cymatics: second mode'),
  P('cymRound', 0, 0, 1, 'strange', 'Plate: square ↔ round'),
  P('cymSand', 0, 0, 1, 'strange', 'Solid ↔ lines of sand'),
  P('julia', 0, 0, 1, 'strange', 'Julia set'),
  P('juliaA', 0.7, -3.2, 3.2, 'strange', 'Julia: angle'),
  P('juliaR', 0.76, 0.3, 1, 'strange', 'Julia: radius'),
  P('agate', 0, 0, 1, 'strange', 'Agate'),
  P('wells', 0, 0, 1, 'strange', 'Ripple tank'),
  P('wellN', 3, 2, 7, 'strange', 'Ripple tank: sources'),
  P('wellR', 0.35, 0, 1.2, 'strange', 'Ripple tank: how far apart'),
  P('wellT', 0, 0, 0),
  P('living', 0, 0, 1, 'strange', 'Living labyrinth'),
  // bending the plane
  P('conf', 0, 0, 1, 'bend', 'Conformal: tiles wound into a spiral'),
  P('confA', 0, -12, 12, 'bend', 'Conformal: how far it winds'),
  P('confP', 0, -1, 1, 'bend', 'Conformal: a second pole'),
  P('confX', 0.28, 0, 1, 'bend', 'Conformal: how far apart'),
  P('planes', 0, 0, 1, 'bend', 'A floor and a ceiling'),
  P('twist', 0, -4, 4, 'bend', 'Twist'),
  P('vortex', 0, -3, 3, 'bend', 'Vortex'),
  P('bulge', 0, -1, 1, 'bend', 'Bulge ↔ pinch'),
  P('wave', 0, 0, 2, 'bend', 'Waves'),
  P('waveF', 6, 1, 30, 'bend', 'Wave size'),
  P('zig', 0, 0, 1, 'bend', 'Waves: smooth ↔ zigzag'),
  P('swell', 0, 0, 2, 'bend', 'Waves rolling through'),
  P('swellF', 3, 0.5, 12, 'bend', 'Rolling wave size'),
  P('swellPh', 0, 0, 0),
  P('warpN', 0, 0, 1.5, 'bend', 'Melt'),
  P('pinch', 0, 0, 1, 'bend', 'Squeeze band'),
  P('pinchX', 0, -1.5, 1.5, 'bend', 'Squeeze band position'),
  P('kaleido', 0, 0, 1, 'bend', 'Kaleidoscope'),
  P('kaleidoN', 6, 2, 16, 'bend', 'Mirrors'),
  P('cfog', 0, 0, 1, 'bend', 'Dark center'),
  // the sheet's relief
  P('height', 1, 0, 3, 'shape', 'Relief height'),
  P('folds', 0, 0, 2, 'shape', 'Folds'),
  P('foldF', 6, 1, 20, 'shape', 'Fold size'),
  P('ori', 0, 0, 2, 'shape', 'Origami pleats'),
  P('oriF', 5, 1, 20, 'shape', 'Pleat size'),
  P('stud', 0, 0, 2, 'shape', 'Pyramid studs'),
  P('ripple', 0, 0, 2, 'shape', 'Ripples from the center'),
  P('ripPhase', 0, 0, 0),
  P('orbs', 0, 0, 1.5, 'shape', 'Orbs rising'),
  P('orbN', 5, 2, 14, 'shape', 'Orb grid'),
  // spaces to fly through
  P('gyro', 0, 0, 1, 'space', 'Lattice'),
  P('gyroS', 5, 1, 14, 'space', 'Lattice size'),
  P('gyroType', 0, 0, 1, 'space', 'Lattice: organic ↔ portals'),
  P('sponge', 0, 0, 1, 'space', 'Menger sponge'),
  P('spaceS', 1.2, 0.3, 4, 'space', 'Fractal scale'),
  P('hall', 0, 0, 1, 'space', 'Corridor'),
  P('hallW', 0.6, 0.2, 2, 'space', 'Corridor width'),
  P('hallOpen', 0, 0, 1, 'space', 'Corridor: box ↔ open to the dark'),
  P('hallRound', 0, 0, 1, 'space', 'Corridor: square ↔ round'),
  P('hallWave', 0, 0, 1.5, 'space', 'Walls ripple'),
  P('columns', 0, 0, 1, 'space', 'Colonnade'),
  P('colN', 0.9, 0.3, 3, 'space', 'Column spacing'),
  P('colH', 0.9, 0.1, 3, 'space', 'Column height'),
  // objects
  P('penrose', 0, 0, 1, 'objects', 'Impossible triangle'),
  P('reveal', 0, -3.14, 3.14, 'objects', 'Reveal the trick'),
  P('mobius', 0, 0, 1, 'objects', 'Möbius strip'),
  P('blob', 0, 0, 1, 'objects', 'Blob'),
  P('blobLump', 0.6, 0, 1.5, 'objects', 'Blob: sphere ↔ lumpy'),
  P('objX', 0, -2, 2, 'objects', 'Object ↔'),
  P('objY', 0, -2, 2, 'objects', 'Object ↕'),
  P('objZ', 0.35, -0.5, 1.5, 'objects', 'Object comes forward'),
  P('objS', 0.42, 0.1, 2, 'objects', 'Object size'),
  P('objSoft', 0.06, 0.005, 0.4, 'objects', 'Fabric over the object'),
  P('objTilt', 0.9, -3.14, 3.14, 'objects', 'Object tilt'),
  P('objRot', 0, 0, 0),
  P('drop', 0, 0, 1, 'objects', 'Floor drops away'),
  // add-ons (set by the app): the ghost face, hands, the ball
  P('face', 0, 0, 1.5), P('faceS', 0.6, 0.2, 2.5), P('faceX', 0, -1.5, 1.5), P('faceY', 0, -1.5, 1.5),
  P('faceRoll', 0, -1.5, 1.5), P('faceTurn', 0, -1.5, 1.5), P('mouth', 0, 0, 1), P('eyes', 1, 0, 1),
  P('handSoft', 0.15, 0.01, 0.45),
  // the form under your cursor (set by the app): where, which, and everything that's been done to it
  P('formOn', 0, 0, 1), P('formX', 0, -9, 9), P('formY', 0, -9, 9), P('formZ', 0, -9, 9), P('formS', 1, 0.05, 6), P('formYaw', 0, 0, 0), P('formLean', 0, 0, 0),
  P('formA', 0, 0, 16), P('formB', 0, 0, 16), P('formMix', 0, 0, 1), P('formFA', 1, 1, 24), P('formFB', 1, 1, 24), P('formEA', 0, 0, 4), P('formEB', 0, 0, 4),
  P('formOpen', 0, 0, 1), P('formSoft', 0.2, 0, 1), P('formBound', 1, 0, 9), P('formSpread', 0.3, 0, 2), P('formSpin', 0, 0, 0), P('formEchoS', 0.62, 0.3, 0.9), P('formEchoT', 0.6, -3, 3),
  P('formField', 0, 0, 9), P('formTwist', 0, -30, 30), P('formBend', 0, -8, 8), P('formWave', 0, -3, 3), P('formWaveT', 0, 0, 0), P('formRopeT', 0, 0, 0),
  P('formSlice', 0, 0, 1), P('formSliceF', 11, 1, 60), P('formSliceA', 0.5, -4, 4), P('formSliceP', 0, 0, 0), P('formRings', 0, 0, 1), P('formRingT', 0, 0, 0),
  P('formHoles', 0, 0, 1), P('formBumps', 0, 0, 1), P('formBlocks', 0, 0, 1), P('formSwell', 0, -1, 1), P('formBaked', 0, 0, 1),
  P('formNeg', 0, 0, 1), P('formFill', 0, -1, 1), P('formFine', 1, 0.1, 8), P('formContour', 0, 0, 1), P('formStripeA', 0.9, -4, 4), P('formStripeF', 130, 4, 400), P('formStripeW', 0, -1.2, 1.2), P('formAura', 0, 0, 3), P('formAuraT', 0, 0, 0),
  P('formLens', 1, 0, 6), P('formLit', 0, 0, 4), P('formRim', 0, 0, 4), P('formShade', 0, 0, 1), P('relief', 0, 0, 4),
  ...HANDS,
  P('ball', 0, 0, 1), P('ballX', 0, -4, 4), P('ballY', 0, -4, 4), P('ballZ', 0, -1, 2), P('ballR', 0.12, 0.02, 1),
  P('ballVX', 1, -1, 1), P('ballVY', 0, -1, 1), P('ballWake', 0.5, 0, 2), P('ballFlow', 1, 0, 2),
  // color
  C('paper', '#f2f0ea', 'color', 'Paper'),
  C('ink', '#0b0b0b', 'color', 'Ink'),
  C('ink2', '#d80146', 'color', 'Second ink'),
  C('fog', '#000000', 'color', 'Shadow'),
  P('bands', 0, 0, 1, 'color', 'Every other line in the second ink'),
  P('hue', 0, 0, 0),
  P('fogD', 0.15, 0, 1, 'look', 'Fog'),
  P('light', 0, 0, 1, 'look', '3D lighting'),
  P('engrave', 0, 0, 1.5, 'look', 'Engraving (light thins the lines)'),
  P('invert', 0, 0, 1, 'look', 'Invert'),
  P('echo', 0, 0, 0.95, 'look', 'Echo trails'),
  P('exposure', 0, -1, 2, 'look', 'Exposure'),
  P('time', 0, 0, 0),
  // a picture under the sheet: the camera, an image, a video or words (set by the app)
  P('media', 0, 0, 3), P('mediaInk', 0, 0, 2), P('mediaS', 0.6, 0.1, 3), P('mediaX', 0, -2, 2), P('mediaY', 0, -2, 2),
  P('mediaInv', 0, 0, 1), P('mediaMask', 0, 0, 1), P('mediaWarp', 0, 0, 1), P('mediaPhoto', 0, 0, 1),
  P('photoColor', 0, 0, 1), P('mediaCalm', 0, 0, 1), P('mediaLift', 0, 0, 1), P('aura', 0, 0, 3),
  // the sound itself (set from the Sound tab): the waveform, the spectrum, a landscape of it, and the melody's curve
  P('swave', 0, 0, 2), P('sspec', 0, 0, 2), P('sland', 0, 0, 2), P('mwave', 0, 0, 3), P('mland', 0, 0, 3),
  // the finishing pass
  P('glow', 0, 0, 1.5, 'look', 'Glow', 'post'),
  C('glowColor', '#d80146', 'color', 'Glow', 'post'),
  P('grain', 0.08, 0, 1, 'look', 'Grain', 'post'),
  P('vignette', 0.3, 0, 2, 'look', 'Vignette', 'post'),
  P('aberr', 0, 0, 1, 'look', 'Color split', 'post'),
  // how the music moves things
  P('sway', 0, 0, 1.5, 'music', 'Sway on the bar', 'mod'),
  P('swayX', 0, 0, 1.5, 'music', 'Drift on the bar', 'mod'),
  P('pulse', 0, 0, 1, 'music', 'Bass thump', 'mod'),
  P('react', 0.6, 0, 1.5, 'music', 'Loudness → intensity', 'mod'),
  P('breathe', 0, 0, 1, 'music', 'Breathe on the bar', 'mod'),
  P('grab', 0, 0, 1, 'music', 'Hands grab on the bar', 'mod'),
  P('hitFlash', 0, 0, 1, 'music', 'Flash on hits', 'mod'),
  // speeds, per bar
  P('flow', 0, -4, 4, 'motion', 'Flow', 'rate'),
  P('spinRate', 0, -0.6, 0.6, 'motion', 'Spin', 'rate'),
  P('orbitRate', 0, -0.4, 0.4, 'motion', 'Orbit', 'rate'),
  P('flyRate', 0, -1.2, 1.2, 'motion', 'Fly forward', 'rate'),
  P('objSpin', 0.15, -1, 1, 'motion', 'Object spin', 'rate'),
  P('swellRate', 1.5, -6, 6, 'motion', 'Rolling wave speed', 'rate'),
  P('hueRate', 0, -0.5, 0.5, 'color', 'Color cycle', 'rate'),
  P('ripRate', 2.5, 0, 10, null, null, 'rate'),
];

// rates add into these values
export const RATE_TARGETS = { flow: 'phase', spinRate: 'frot', orbitRate: 'yaw', flyRate: 'fly', ripRate: 'ripPhase', objSpin: 'objRot', hueRate: 'hue', swellRate: 'swellPh' };

export const PARAM_BY_NAME = Object.fromEntries(PARAMS.map(p => [p.name, p]));
export const DEFAULTS = Object.fromEntries(PARAMS.map(p => [p.name, p.def]));
export const isColorParam = name => typeof DEFAULTS[name] === 'string';

// shader slots: one float per shader param, three per shader color
// the patterns that aren't lines: one replaces another not by fading across it but by opening out through it
export const SWITCH_KEYS = ['conf', 'hyper', 'cube', 'truchet', 'cym', 'julia', 'agate', 'wells', 'quasi', 'living', 'crys', 'sumi', 'lock', 'cells', 'star', 'lace', 'weave', 'seig', 'ouchi'];

export const SHADER_SLOTS = [];
for (const p of PARAMS) {
  if (p.kind === 'shader') SHADER_SLOTS.push({ name: p.name });
  else if (p.kind === 'color') ['r', 'g', 'b'].forEach((c, i) => SHADER_SLOTS.push({ name: p.name, channel: i, macro: `${p.name}_${c}` }));
}
export const SHADER_COUNT = SHADER_SLOTS.length;
export const SHADER_VEC4S = Math.ceil(SHADER_COUNT / 4);

export function shaderDefines() {
  // four to a slot: some phones only give a shader 224 slots, and a lone float takes up a whole one
  return SHADER_SLOTS.map((s, i) => `#define ${(s.macro || s.name).toUpperCase()} uV[${i >> 2}].${'xyzw'[i & 3]}`).join('\n') + '\n#define UP(i) uV[(i) >> 2][(i) & 3]';
}

export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}
