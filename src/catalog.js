// Everything the app knows how to draw: base patterns, warps (space benders) and color palettes.
// `code` values must match the numbers used in shaders.js.

export const PATTERNS = [
  { id: 'stripes', code: 0, name: 'Stripes', blurb: 'plain stripes', param: { label: 'Taper', def: 0 } },
  { id: 'checker', code: 1, name: 'Checkers', blurb: 'a checkerboard', param: { label: 'Squash', def: 0.5 } },
  { id: 'rings', code: 2, name: 'Rings', blurb: 'rings inside rings', param: { label: 'Shape ◇ ○ □', def: 0.33 } },
  { id: 'spiral', code: 3, name: 'Spiral', blurb: 'a spiral', param: { label: 'Arms', def: 0.15, fmt: v => String(Math.floor(1 + v * 7.99)) } },
  { id: 'rays', code: 4, name: 'Rays', blurb: 'rays shooting out of the middle', param: { label: 'Swirl', def: 0 } },
  { id: 'dots', code: 5, name: 'Dots', blurb: 'a grid of dots', param: { label: 'Dot size', def: 0.45 } },
  { id: 'grid', code: 6, name: 'Grid', blurb: 'graph-paper lines', param: { label: 'Skew', def: 0.5 } },
  { id: 'moire', code: 7, name: 'Moiré', blurb: 'two sets of rings overlapping', param: { label: 'Gap', def: 0.3 } },
  { id: 'zebra', code: 8, name: 'Zebra', blurb: 'wiggly zebra contours', param: { label: 'Blob size', def: 0.35 } },
  { id: 'triangles', code: 9, name: 'Triangles', blurb: 'a triangle tiling', param: { label: 'Shift', def: 0 } },
  { id: 'static', code: 11, name: 'Static', blurb: 'TV static', param: { label: 'Grain size', def: 0.4 } },
  { id: 'cells', code: 12, name: 'Cells', blurb: 'rings around drifting cells', param: { label: 'Rings per cell', def: 0.4 } },
  { id: 'hex', code: 13, name: 'Hex', blurb: 'a honeycomb of hexagons', param: { label: 'Rings per hex', def: 0.35 } },
  { id: 'formula', code: 10, name: 'Formula', blurb: 'your own formula', param: { label: 'k · magic knob', def: 0.5 } },
];

// how the optional second pattern layer combines with the first
export const MIX_MODES = [
  { id: 'off', name: 'Off' },
  { id: 'xor', name: 'XOR', blurb: 'ink where exactly one has ink — instant moiré' },
  { id: 'and', name: 'Overlap', blurb: 'ink only where both have ink' },
  { id: 'or', name: 'Combine', blurb: 'ink wherever either has ink' },
  { id: 'add', name: 'Interfere', blurb: 'the two waves add up' },
  { id: 'inside', name: 'Inside 3D', blurb: 'layer 2 shows inside spheres and faces' },
];

// Every warp has the same four knobs (amount, scale, speed, extra); `null` hides a knob that does nothing.
export const WARPS = [
  {
    reactive: true,
    id: 'wave', code: 1, name: 'Wave', blurb: 'Wiggles everything side to side.',
    verb: () => 'wobble it with a wave',
    params: {
      amount: { label: 'Strength', min: 0, max: 1, def: 0.4 },
      scale: { label: 'Tightness', min: 0, max: 1, def: 0.45 },
      speed: { label: 'Speed', min: -2, max: 2, def: 0.5 },
      extra: { label: 'Direction', min: 0, max: 1, def: 0.5 },
    },
  },
  {
    reactive: true,
    id: 'ripple', code: 2, name: 'Ripple', blurb: 'Rings flowing out of the center, like a pond.',
    verb: () => 'send ripples out from the middle',
    params: {
      amount: { label: 'Strength', min: 0, max: 1, def: 0.65 },
      scale: { label: 'Tightness', min: 0, max: 1, def: 0.35 },
      speed: { label: 'Speed', min: -2, max: 2, def: 0.6 },
      extra: { label: 'Fade out', min: 0, max: 1, def: 0.3 },
    },
  },
  {
    reactive: true,
    id: 'twist', code: 3, name: 'Twist', blurb: 'Spins the middle more than the edges.',
    verb: w => (w.speed !== 0 ? 'twist it back and forth' : 'twist it around the center'),
    params: {
      amount: { label: 'Twist (− reverses)', min: -1, max: 1, def: 0.4 },
      scale: { label: 'Reach', min: 0, max: 1, def: 0.5 },
      speed: { label: 'Breathe', min: -2, max: 2, def: 0.4 },
      extra: { label: 'Spiral ↔ Whirlpool', min: 0, max: 1, def: 0.95 },
    },
  },
  {
    reactive: true,
    id: 'bulge', code: 4, name: 'Bulge', blurb: 'Puffs it up like a balloon (or sucks it in).',
    verb: w => (w.amount < 0 ? 'pinch it inward' : 'puff it up like a balloon'),
    params: {
      amount: { label: 'Puff (− pinches)', min: -1, max: 1, def: 0.75 },
      scale: { label: 'Size', min: 0, max: 1, def: 0.55 },
      speed: { label: 'Drift speed', min: -2, max: 2, def: 0.4 },
      extra: { label: 'Wander', min: 0, max: 1, def: 0 },
    },
  },
  {
    reactive: true,
    id: 'melt', code: 5, name: 'Melt', blurb: 'Smears it with slow, lava-lamp blobs.',
    verb: () => 'melt it like wax',
    params: {
      amount: { label: 'Melt', min: 0, max: 1, def: 0.35 },
      scale: { label: 'Detail', min: 0, max: 1, def: 0.3 },
      speed: { label: 'Flow', min: -2, max: 2, def: 0.3 },
      extra: { label: 'Turbulence', min: 0, max: 1, def: 0.3 },
    },
  },
  {
    id: 'tunnel', code: 6, name: 'Tunnel', blurb: 'Wraps it into an endless tunnel you fly through.',
    verb: () => 'wrap it into an endless tunnel',
    params: {
      amount: { label: 'Depth', min: 0, max: 1, def: 0.85 },
      scale: { label: 'Slices', min: 0, max: 1, def: 0.45 },
      speed: { label: 'Fly speed', min: -2, max: 2, def: 0.6 },
      extra: { label: 'Corkscrew', min: -1, max: 1, def: 0 },
    },
  },
  {
    id: 'kaleido', code: 7, name: 'Kaleidoscope', blurb: 'Mirrors one slice all the way around.',
    verb: () => 'mirror it like a kaleidoscope',
    params: {
      amount: { label: 'Offset', min: -1, max: 1, def: 0.3 },
      scale: { label: 'Mirrors', min: 0, max: 1, def: 0.3 },
      speed: { label: 'Spin', min: -2, max: 2, def: 0.2 },
      extra: null,
    },
  },
  {
    id: 'fold', code: 8, name: 'Fold', blurb: 'Folds space over itself like paper.',
    verb: () => 'fold it like paper',
    params: {
      amount: { label: 'Fold offset', min: 0, max: 1, def: 0.4 },
      scale: { label: 'Fold angle', min: 0, max: 1, def: 0.3 },
      speed: { label: 'Spin', min: -2, max: 2, def: 0.2 },
      extra: { label: 'Folds', min: 0, max: 1, def: 0.4 },
    },
  },
  {
    id: 'floor', code: 9, name: 'Floor', blurb: 'Lays it flat as an endless floor and ceiling.',
    verb: () => 'lay it down as an endless floor',
    params: {
      amount: { label: 'Depth', min: 0, max: 1, def: 0.5 },
      scale: { label: 'Horizon', min: 0, max: 1, def: 0.5 },
      speed: { label: 'Forward speed', min: -2, max: 2, def: 0.6 },
      extra: { label: 'Road bend', min: -1, max: 1, def: 0 },
    },
  },
  {
    id: 'tiles', code: 10, name: 'Tiles', blurb: 'Cuts it into tiles that turn in opposite directions.',
    verb: () => 'cut it into flipping tiles',
    params: {
      amount: { label: 'Turn', min: -1, max: 1, def: 0.25 },
      scale: { label: 'Tile count', min: 0, max: 1, def: 0.35 },
      speed: { label: 'Spin', min: -2, max: 2, def: 0 },
      extra: { label: 'Size flip', min: 0, max: 1, def: 0 },
    },
  },
  {
    reactive: true,
    id: 'zigzag', code: 11, name: 'Zigzag', blurb: 'Sharp zigzags instead of smooth waves.',
    verb: () => 'zigzag it',
    params: {
      amount: { label: 'Strength', min: 0, max: 1, def: 0.35 },
      scale: { label: 'Tightness', min: 0, max: 1, def: 0.5 },
      speed: { label: 'Speed', min: -2, max: 2, def: 0.3 },
      extra: { label: 'Direction', min: 0, max: 1, def: 0.5 },
    },
  },
  {
    reactive: true,
    id: 'sway', code: 12, name: 'Sway', blurb: 'Rocks everything like a pendulum.',
    verb: () => 'rock it like a pendulum',
    params: {
      amount: { label: 'Swing', min: 0, max: 1, def: 0.4 },
      scale: { label: 'Pivot height', min: 0, max: 1, def: 0.6 },
      speed: { label: 'Swings / sec', min: -2, max: 2, def: 0.35 },
      extra: { label: 'Ripple down', min: 0, max: 1, def: 0.3 },
    },
  },
  {
    reactive: true,
    id: 'cloth', code: 13, name: 'Cloth', blurb: 'Silky 3D folds that catch the light.',
    verb: () => 'drape it like silk',
    params: {
      amount: { label: 'Fold depth', min: 0, max: 1, def: 0.5 },
      scale: { label: 'Fold size', min: 0, max: 1, def: 0.35 },
      speed: { label: 'Flow', min: -2, max: 2, def: 0.4 },
      extra: { label: 'Sheen', min: 0, max: 1, def: 0.7 },
    },
  },
  {
    id: 'sphere', code: 14, name: 'Sphere', blurb: 'Wraps it around a real 3D ball.',
    verb: () => 'wrap it around a spinning ball',
    params: {
      amount: { label: 'Lighting', min: 0, max: 1, def: 0.8 },
      scale: { label: 'Size', min: 0, max: 1, def: 0.55 },
      speed: { label: 'Spin', min: -2, max: 2, def: 0.4 },
      extra: { label: 'Flip background', min: 0, max: 1, def: 1 },
    },
  },
  {
    id: 'tilt', code: 15, name: 'Tilt', blurb: 'Tips the whole sheet back in 3D space.',
    verb: () => 'tip it back into 3D space',
    params: {
      amount: { label: 'Tilt', min: -1, max: 1, def: 0.55 },
      scale: { label: 'Lens', min: 0, max: 1, def: 0.4 },
      speed: { label: 'Rock', min: -2, max: 2, def: 0.3 },
      extra: { label: 'Turn', min: -1, max: 1, def: 0 },
    },
  },
  {
    reactive: true,
    id: 'face', code: 16, name: 'Ghost', blurb: 'A face pressing through the pattern (eyes and mouth are hollows).',
    verb: w => (w.amount < 0 ? 'press a hollow face into it' : 'let a ghost face push through it'),
    params: {
      amount: { label: 'Depth (− hollow)', min: -1, max: 1, def: 0.7 },
      scale: { label: 'Size', min: 0, max: 1, def: 0.35 },
      speed: { label: 'Sway', min: -2, max: 2, def: 0.3 },
      extra: { label: 'Shading', min: 0, max: 1, def: 0.6 },
    },
  },
  {
    reactive: true,
    id: 'lenses', code: 17, name: 'Lenses', blurb: 'A grid of glass balls, each bulging.',
    verb: () => 'look at it through a grid of glass balls',
    params: {
      amount: { label: 'Bulge', min: -1, max: 1, def: 0.75 },
      scale: { label: 'Grid size', min: 0, max: 1, def: 0.35 },
      speed: { label: 'Pulse', min: -2, max: 2, def: 0.5 },
      extra: { label: 'Shading', min: 0, max: 1, def: 0.6 },
    },
  },
  {
    reactive: true,
    id: 'glitch', code: 18, name: 'Glitch', blurb: 'Tears it into flickering scan lines.',
    verb: () => 'tear it with glitches',
    params: {
      amount: { label: 'Tears', min: 0, max: 1, def: 0.35 },
      scale: { label: 'Line count', min: 0, max: 1, def: 0.4 },
      speed: { label: 'Flicker', min: -2, max: 2, def: 0.8 },
      extra: { label: 'Shift', min: 0, max: 1, def: 0.5 },
    },
  },
];

// the reds measured from the Depression Cherry cover
export const CHERRY = '#d80146';
export const CHERRY_MID = '#8c012b';
export const CHERRY_DEEP = '#5e021d';

export const PALETTES = [
  { id: 'bw', name: 'Black & White', paper: '#f4f3ee', inks: ['#0b0b0b'] },
  { id: 'wb', name: 'White on Black', paper: '#090909', inks: ['#f1f0ea'] },
  { id: 'news', name: 'Newsprint', paper: '#e8e0cc', inks: ['#1e1b18'] },
  { id: 'blueprint', name: 'Blueprint', paper: '#123a7a', inks: ['#e7efff'] },
  { id: 'acid', name: 'Acid', paper: '#0a0a0a', inks: ['#d7ff3a'] },
  { id: 'bubblegum', name: 'Bubblegum', paper: '#ffd3e6', inks: ['#2b1d5c'] },
  { id: 'cherry', name: 'Cherry', paper: '#070203', inks: ['#d80146'] },
  { id: 'cherrybone', name: 'Cherry on Bone', paper: '#f1ece4', inks: ['#d80146'] },
  { id: 'cherryink', name: 'Cherry & Ink', paper: '#f1ece4', inks: ['#0b0b0b', '#d80146'] },
  { id: 'velvet', name: 'Velvet', paper: '#5e021d', inks: ['#df0149'] },
  { id: 'gilded', name: 'Gilded', paper: '#121110', inks: ['#d9b45a'] },
  { id: 'gallery', name: 'Gallery', paper: '#f2ede2', inks: ['#e2463a', '#1f6fb2', '#2f9a5f', '#151515'] },
  { id: 'sunset', name: 'Sunset', paper: '#1a0f2e', inks: ['#ff6b6b', '#ffa94d', '#ffd43b', '#f783ac'] },
  { id: 'deepsea', name: 'Deep Sea', paper: '#031b26', inks: ['#3ad1c3', '#1b8fbf', '#a7f3e8'] },
  { id: 'prism', name: 'Prism', paper: '#0b0b0b', inks: ['#ff3b3b', '#3bff6a', '#3b7bff'] },
  { id: 'candy', name: 'Candy', paper: '#fff6ea', inks: ['#ff4fa3', '#28c2ff', '#ffcf26', '#7b5cff', '#13d39a'] },
];

export const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map(p => [p.id, p]));
export const WARP_BY_ID = Object.fromEntries(WARPS.map(w => [w.id, w]));
export const MAX_INKS = 5;
