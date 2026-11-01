// Base modes (the Presets tab) and formula recipes (the Smart tab).
// A preset only lists what differs from DEFAULTS in state.js. `palette` is a shortcut for paper + inks.

export const PRESETS = [
  {
    id: 'breathing-checkers', name: 'Breathing Checkers',
    state: {
      pattern: 'checker', density: 10,
      warps: [
        { type: 'bulge', amount: 0.78, scale: 0.58, speed: 0.8, extra: 0.2 },
        { type: 'wave', amount: 0.1, scale: 0.25, speed: 0.4, extra: 0.5 },
      ],
      depth: 0.5,
    },
  },
  {
    id: 'silk-current', name: 'Silk Current',
    state: {
      pattern: 'stripes', density: 26, param: 0,
      warps: [
        { type: 'wave', amount: 0.45, scale: 0.32, speed: 0.35, extra: 0.5 },
        { type: 'wave', amount: 0.07, scale: 0.6, speed: 0.5, extra: 0.5 },
      ],
      depth: 0.45,
    },
  },
  {
    id: 'endless-tunnel', name: 'Endless Tunnel',
    state: {
      pattern: 'checker', density: 8,
      warps: [{ type: 'tunnel', amount: 0.9, scale: 0.45, speed: 0.5, extra: 0 }],
      depth: 0.7,
    },
  },
  {
    id: 'op-sphere', name: 'Op Sphere',
    state: {
      pattern: 'stripes', density: 28, angle: 90,
      warps: [{ type: 'bulge', amount: 1, scale: 0.6, speed: 0.4, extra: 0.3 }],
      depth: 0.6,
    },
  },
  {
    id: 'moire-ghosts', name: 'Moiré Ghosts',
    state: { pattern: 'moire', density: 26, param: 0.35, flow: 0.4, depth: 0 },
  },
  {
    id: 'melting-chess', name: 'Melting Chess',
    state: {
      pattern: 'checker', density: 7,
      warps: [{ type: 'melt', amount: 0.45, scale: 0.25, speed: 0.25, extra: 0.4 }],
      depth: 0.35,
    },
  },
  {
    id: 'whirlpool', name: 'Whirlpool',
    state: {
      pattern: 'checker', density: 12, spin: 0.25,
      warps: [{ type: 'twist', amount: 1, scale: 0.4, speed: 0, extra: 1 }],
      depth: 0.4,
    },
  },
  {
    id: 'liquid-chrome', name: 'Liquid Chrome',
    state: {
      pattern: 'stripes', density: 14,
      warps: [
        { type: 'ripple', amount: 0.9, scale: 0.28, speed: 0.7, extra: 0.15 },
        { type: 'melt', amount: 0.2, scale: 0.2, speed: 0.2, extra: 0 },
      ],
      relief: 0.9, depth: 0.3, palette: 'wb',
    },
  },
  {
    id: 'zebra-dream', name: 'Zebra Dream',
    state: {
      pattern: 'zebra', density: 12, param: 0.35, flow: 0.25,
      warps: [{ type: 'wave', amount: 0.12, scale: 0.15, speed: 0.3, extra: 0.25 }],
      depth: 0.2,
    },
  },
  {
    id: 'hypno-spiral', name: 'Hypno Spiral',
    state: { pattern: 'spiral', density: 6, param: 0.15, flow: 1, depth: 0.35 },
  },
  {
    id: 'kaleido-bloom', name: 'Kaleido Bloom',
    state: {
      pattern: 'triangles', density: 8,
      warps: [
        { type: 'kaleido', amount: 0.3, scale: 0.4, speed: 0.15 },
        { type: 'twist', amount: 0.35, scale: 0.5, speed: 0.3, extra: 1 },
      ],
      depth: 0.3,
    },
  },
  {
    id: 'infinite-floor', name: 'Infinite Floor',
    state: {
      pattern: 'checker', density: 4,
      warps: [{ type: 'floor', amount: 0.5, scale: 0.5, speed: 0.7, extra: 0 }],
      depth: 0.7,
    },
  },
  {
    id: 'collapsing-squares', name: 'Collapsing Squares',
    state: {
      pattern: 'rings', density: 10, param: 1, flow: 0.8,
      warps: [{ type: 'twist', amount: 0.45, scale: 0.5, speed: 0.4, extra: 0.95 }],
      depth: 0.4,
    },
  },
  {
    id: 'paper-mandala', name: 'Paper Mandala',
    state: {
      pattern: 'stripes', density: 14,
      warps: [
        { type: 'fold', amount: 0.4, scale: 0.3, speed: 0.15, extra: 0.6 },
        { type: 'kaleido', amount: 0, scale: 0.35, speed: 0 },
      ],
      depth: 0.3,
    },
  },
  {
    id: 'halftone-swell', name: 'Halftone Swell',
    state: {
      pattern: 'dots', density: 16, param: 0.55,
      warps: [
        { type: 'bulge', amount: 0.8, scale: 0.6, speed: 0.5, extra: 0.35 },
        { type: 'ripple', amount: 0.3, scale: 0.3, speed: 0.5, extra: 0.3 },
      ],
      depth: 0.3,
    },
  },
  {
    id: 'sunburst-echo', name: 'Sunburst Echo',
    state: {
      pattern: 'rays', density: 18, param: 0.3, flow: 0.4,
      warps: [{ type: 'twist', amount: 0.3, scale: 0.5, speed: 0.5, extra: 0.95 }],
      echo: 0.6, depth: 0.2,
    },
  },
  {
    id: 'gallery-zigzag', name: 'Gallery Zigzag',
    state: {
      pattern: 'stripes', density: 20, flow: 0.3,
      warps: [{ type: 'zigzag', amount: 0.4, scale: 0.6, speed: 0.3, extra: 0.5 }],
      palette: 'gallery', depth: 0.2,
    },
  },
  {
    id: 'acid-highway', name: 'Acid Highway',
    state: {
      pattern: 'checker', density: 5,
      warps: [{ type: 'floor', amount: 0.45, scale: 0.55, speed: 1, extra: 0.4 }],
      palette: 'acid', echo: 0.45, depth: 0.6,
    },
  },
];

// Formula recipes for the Smart tab. `d` is the Density slider, `k` the magic knob, `t` time.
export const FORMULA_PRESETS = [
  { name: 'Stripes', formula: 'sin(x*d)', why: 'A sine wave going left→right. Positive = ink, negative = paper. That alone is stripes.' },
  { name: 'Checkerboard', formula: 'sin(x*d) * sin(y*d)', why: 'Multiply two stripe patterns. Where both agree you get ink — a checkerboard.' },
  { name: 'Target', formula: 'sin(r*d - t*3)', why: 'r is distance from the center, so waves of r are rings. Subtracting time makes them flow outward.' },
  { name: 'Pinwheel', formula: 'sin(a*8 + t)', why: 'a is the angle around the center. Waves of angle are spokes; adding time spins them.' },
  { name: 'Spiral', formula: 'sin(a*3 + r*d - t*2)', why: 'Spokes plus rings = a spiral. The 3 is the number of arms.' },
  { name: 'Op Bulge', formula: 'sin(x*d * (0.25 + r*r*2.5))', why: 'Stripes whose spacing grows with distance — the middle looks like it swells toward you.' },
  { name: 'Interference', formula: 'sin(hypot(x-0.35, y)*d) * sin(hypot(x+0.35, y)*d)', why: 'Two sets of rings from two points, multiplied. The ghostly curves are moiré.' },
  { name: 'Melting', formula: 'sin(x*d + 3*noise(x*2, y*2 + t*0.3))', why: 'Stripes pushed around by smooth noise blobs — like wax melting.' },
  { name: 'Plasma', formula: 'sin(x*d*0.5 + t) + sin(y*d*0.4 - t) + sin(r*d*0.6 + t*1.3)', why: 'Three waves added together. Where they pile up you get blobs that slide around.' },
  { name: 'Flower', formula: 'sin(r*d*2 - t*2 + 3*sin(a*6 + t))', why: 'Rings that get pushed in and out by the angle — 6 petals.' },
  { name: 'Hyperbolic', formula: 'sin(x*y*d*3 + t)', why: 'Multiplying x by y makes curves that swoop toward the corners.' },
  { name: 'Knob Bender', formula: 'sin(x*d + k*10*sin(y*3 + t))', why: 'Turn the k knob: it controls how hard the stripes are bent.' },
  { name: 'Heartbeat', formula: 'sin(r*d*(1 + bass) - t*4)', why: 'Ring spacing follows the bass. Load a song in the Sound tab to feel it.' },
  {
    name: 'Bent Space', formula: 'sin(x*d) * sin(y*d)', bendX: '0.15*sin(y*4 + t)', bendY: '0.15*cos(x*4 + t)',
    why: 'Same checkerboard, but the “bend” formulas push every point around before it is drawn.',
  },
];

// Click-to-insert building blocks for the formula editor.
export const BLOCKS = [
  { label: 'stripes', text: 'sin(x*d)' },
  { label: 'rings', text: 'sin(r*d)' },
  { label: 'spokes', text: 'sin(a*8)' },
  { label: 'checker', text: 'sin(x*d)*sin(y*d)' },
  { label: 'blobs', text: 'noise(x*3, y*3)' },
  { label: '+ time', text: ' + t' },
  { label: '× wobble', text: ' * (1 + 0.3*sin(y*6 + t))' },
  { label: '+ bass', text: ' + bass*3' },
  { label: 'k knob', text: 'k' },
  { label: 'abs( )', text: 'abs(', close: ')' },
];
