// Every knob of the film world, in one list. A "look" is just a set of these values,
// and every transition is these values gliding from one look to the next — so the
// equation itself re-forms instead of cross-fading pictures.
//
// kind:  shader – sent to the GPU every frame
//        color  – a hex color, sent as three floats
//        rate   – "per bar" speeds that get integrated into a shader value (see RATE_TARGETS)
//        mod    – music modulation amounts, applied in JS every frame
//        post   – the film-look pass (glow, grain, letterbox…)

const P = (name, def, min, max, group = null, label = null, kind = 'shader') => ({ name, def, min, max, group, label, kind });
const C = (name, def, group, label, kind = 'color') => ({ name, def, group, label, kind });

const HANDS = [];
for (let i = 0; i < 3; i++) {
  HANDS.push(
    P(`h${i}on`, 0, 0, 1), P(`h${i}x`, (i - 1) * 0.5, -3, 3), P(`h${i}y`, 0, -3, 3), P(`h${i}z`, 0.05, -0.6, 0.8),
    P(`h${i}s`, 1, 0.3, 4), P(`h${i}a`, 0, -3.2, 3.2), P(`h${i}curl`, 0.25, -0.3, 1.6), P(`h${i}spread`, 0.5, 0, 1.5),
  );
}

export const PARAMS = [
  // camera
  P('focal', 8, 0.8, 12, 'camera', 'Lens — wide ↔ flat'),
  P('frame', 0.6, 0.05, 3, 'camera', 'Zoom out'),
  P('pitch', 0, -1.3, 1.4, 'camera', 'Tilt back'),
  P('yaw', 0, -3.14, 3.14, 'camera', 'Turn'),
  P('roll', 0, -3.14, 3.14, 'camera', 'Roll'),
  P('tx', 0, -2, 2, 'camera', 'Pan ↔'),
  P('ty', 0, -2, 2, 'camera', 'Pan ↕'),
  P('fly', 0, 0, 0),
  // the line equation
  P('freq', 14, 2, 90, 'lines', 'Line density'),
  P('frot', 0, -3.14, 3.14, 'lines', 'Rotate'),
  P('linA', 0, -3.14, 3.14, 'lines', 'Line angle'),
  P('wLin', 1, 0, 1, 'lines', 'Straight lines'),
  P('wRad', 0, 0, 1, 'lines', 'Rings'),
  P('radLog', 0, 0, 1, 'lines', 'Rings: even ↔ deep'),
  P('radInv', 0, 0, 1, 'lines', 'Tunnel'),
  P('wAng', 0, 0, 1, 'lines', 'Spiral'),
  P('spokes', 6, 1, 24, 'lines', 'Spiral arms'),
  P('check', 0, 0, 1, 'lines', 'Cross lines'),
  P('checkA', 1.5708, -3.14, 3.14, 'lines', 'Cross angle'),
  P('checkPolar', 0, 0, 1, 'lines', 'Cross with spokes'),
  P('moire', 0, 0, 1, 'lines', 'Moiré'),
  P('moireOff', 0.25, 0, 1, 'lines', 'Moiré gap'),
  P('contour', 0, 0, 1, 'lines', 'Contour slices'),
  P('phase', 0, 0, 0),
  P('thick', 0, -0.9, 0.9, 'lines', 'Ink thickness'),
  P('refract', 0, 0, 2, 'shape', 'Lines bend over shapes'),
  P('stat', 0, 0, 1, 'lines', 'TV static'),
  // bending the plane
  P('twist', 0, -4, 4, 'bend', 'Twist'),
  P('bulge', 0, -1, 1, 'bend', 'Bulge ↔ pinch'),
  P('wave', 0, 0, 2, 'bend', 'Waves'),
  P('waveF', 6, 1, 30, 'bend', 'Wave size'),
  P('warpN', 0, 0, 1.5, 'bend', 'Melt'),
  P('kaleido', 0, 0, 1, 'bend', 'Kaleidoscope'),
  P('kaleidoN', 6, 2, 16, 'bend', 'Mirrors'),
  P('cfog', 0, 0, 1, 'bend', 'Dark center'),
  // 3D shapes in and behind the membrane
  P('height', 1, 0, 3, 'shape', 'Relief height'),
  P('folds', 0, 0, 2, 'shape', 'Silk folds'),
  P('foldF', 6, 1, 20, 'shape', 'Fold size'),
  P('ripple', 0, 0, 2, 'shape', 'Ripples'),
  P('ripPhase', 0, 0, 0),
  P('face', 0, 0, 1.5, 'shape', 'Ghost face'),
  P('faceS', 0.6, 0.2, 2.5, 'shape', 'Face size'),
  P('faceX', 0, -1.5, 1.5),
  P('faceY', 0, -1.5, 1.5),
  P('faceRoll', 0, -1.5, 1.5),
  P('faceTurn', 0, -1.5, 1.5),
  P('orbs', 0, 0, 1.5, 'shape', 'Orbs rising'),
  P('orbN', 5, 2, 14, 'shape', 'Orb grid'),
  P('gyro', 0, 0, 1, 'shape', 'Lattice'),
  P('gyroS', 5, 1, 14, 'shape', 'Lattice size'),
  P('gyroType', 0, 0, 1, 'shape', 'Lattice: organic ↔ portals'),
  P('sponge', 0, 0, 1, 'space', 'Menger sponge (fractal)'),
  P('kifs', 0, 0, 1, 'space', 'Fractal crystals'),
  P('kifsA', 0.6, -3.14, 3.14, 'space', 'Crystal fold angle'),
  P('spaceS', 1.2, 0.3, 4, 'space', 'Fractal scale'),
  P('columns', 0, 0, 1, 'space', 'Colonnade rising'),
  P('colN', 0.9, 0.3, 3, 'space', 'Column spacing'),
  P('colH', 0.9, 0.1, 3, 'space', 'Column height'),
  P('penrose', 0, 0, 1, 'objects', 'Impossible triangle'),
  P('reveal', 0, -3.14, 3.14, 'objects', 'Reveal the trick (turn it)'),
  P('mobius', 0, 0, 1, 'objects', 'Möbius strip'),
  P('rings', 0, 0, 1, 'objects', 'Gyroscope rings'),
  P('objX', 0, -2, 2, 'objects', 'Object ↔'),
  P('objY', 0, -2, 2, 'objects', 'Object ↕'),
  P('objZ', 0.35, -0.5, 1.5, 'objects', 'Object pushes through'),
  P('objS', 0.42, 0.1, 2, 'objects', 'Object size'),
  P('objSoft', 0.06, 0.005, 0.4, 'objects', 'Fabric over objects'),
  P('objTilt', 0.9, -3.14, 3.14, 'objects', 'Object tilt'),
  P('objRot', 0, 0, 0),
  P('handSoft', 0.15, 0.01, 0.45, 'shape', 'Fabric over hands'),
  P('mouth', 0, 0, 1),
  P('eyes', 1, 0, 1),
  // look
  C('paper', '#f2f0ea', 'look', 'Paper'),
  C('ink', '#0b0b0b', 'look', 'Ink'),
  C('fog', '#000000', 'look', 'Shadow'),
  P('fogD', 0.15, 0, 1, 'look', 'Fog'),
  P('light', 0, 0, 1, 'look', '3D lighting'),
  P('engrave', 0, 0, 1.5, 'look', 'Engraving'),
  P('invert', 0, 0, 1, 'look', 'Invert'),
  P('echo', 0, 0, 0.95, 'look', 'Echo trails'),
  P('exposure', 0, -1, 2, 'look', 'Exposure'),
  P('time', 0, 0, 0),
  // a picture under the membrane: the camera, an image, a video or words
  P('media', 0, 0, 3, 'media', 'Relief height'),
  P('mediaInk', 0, 0, 2, 'media', 'Drawn in line thickness'),
  P('mediaS', 0.6, 0.1, 3, 'media', 'Picture size'),
  P('mediaX', 0, -2, 2, 'media', 'Picture ↔'),
  P('mediaY', 0, -2, 2, 'media', 'Picture ↕'),
  P('mediaInv', 0, 0, 1, 'media', 'Invert the picture'),
  P('mediaSoft', 1.5, 0, 6, 'media', 'Soften'),
  P('mediaMask', 0, 0, 1),
  P('mediaWarp', 0, 0, 1, 'media', 'Bend it with the warps'),
  ...HANDS,
  // the film-look pass
  P('glow', 0, 0, 1.5, 'film', 'Halation glow', 'post'),
  C('glowColor', '#d80146', 'film', 'Glow color', 'post'),
  P('grain', 0.14, 0, 1, 'film', 'Grain', 'post'),
  P('vignette', 0.45, 0, 2, 'film', 'Vignette', 'post'),
  P('letterbox', 0, 0, 1, 'film', 'Letterbox', 'post'),
  P('aberr', 0, 0, 1, 'film', 'Color split', 'post'),
  P('flicker', 0, 0, 1, 'film', 'Flicker', 'post'),
  P('weave', 0, 0, 1, 'film', 'Gate weave', 'post'),
  // music modulation
  P('sway', 0, 0, 1.5, 'music', 'Sway on the bar', 'mod'),
  P('swayX', 0, 0, 1.5, 'music', 'Drift on the bar', 'mod'),
  P('pulse', 0, 0, 1, 'music', 'Bass thump', 'mod'),
  P('react', 0.6, 0, 1.5, 'music', 'Loudness → intensity', 'mod'),
  P('breathe', 0, 0, 1, 'music', 'Breathe on the bar', 'mod'),
  P('grab', 0, 0, 1, 'music', 'Hands grab on the bar', 'mod'),
  P('hitFlash', 0, 0, 1, 'music', 'Flash on hits', 'mod'),
  // speeds, per bar
  P('flow', 0, -4, 4, 'motion', 'Line flow', 'rate'),
  P('spinRate', 0, -0.6, 0.6, 'motion', 'Spin', 'rate'),
  P('orbitRate', 0, -0.4, 0.4, 'motion', 'Orbit', 'rate'),
  P('flyRate', 0, -1.2, 1.2, 'motion', 'Fly forward', 'rate'),
  P('ripRate', 2.5, 0, 10, null, null, 'rate'),
  P('objSpin', 0.15, -1, 1, 'motion', 'Object spin', 'rate'),
];

// rates add into these values
export const RATE_TARGETS = { flow: 'phase', spinRate: 'frot', orbitRate: 'yaw', flyRate: 'fly', ripRate: 'ripPhase', objSpin: 'objRot' };

export const PARAM_BY_NAME = Object.fromEntries(PARAMS.map(p => [p.name, p]));
export const DEFAULTS = Object.fromEntries(PARAMS.map(p => [p.name, p.def]));
export const COLOR_NAMES = PARAMS.filter(p => p.kind === 'color' || (p.kind === 'post' && typeof p.def === 'string')).map(p => p.name);

// shader slots: one float per shader param, three per shader color
export const SHADER_SLOTS = [];
for (const p of PARAMS) {
  if (p.kind === 'shader') SHADER_SLOTS.push({ name: p.name });
  else if (p.kind === 'color') ['r', 'g', 'b'].forEach((c, i) => SHADER_SLOTS.push({ name: p.name, channel: i, macro: `${p.name}_${c}` }));
}
export const SHADER_COUNT = SHADER_SLOTS.length;

export function shaderDefines() {
  return SHADER_SLOTS.map((s, i) => `#define ${(s.macro || s.name).toUpperCase()} uP[${i}]`).join('\n');
}

export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}
