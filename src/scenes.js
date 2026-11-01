// Scene building blocks for music videos. Each returns { look, react, how, update(s, c) }.
// `look` is a starting state (like a preset); update() runs every frame with the music context `c`:
//   c.bar / c.beat (continuous counts), c.sway (one rock per bar), c.loud, c.bass, c.mid, c.high,
//   c.hit (onset strength this frame), c.ramp(a, b) (0→1 between a and b seconds into the scene) …
// Motion is locked to the song's bars and beats; loudness only changes how *strong* things are.
import { CHERRY, CHERRY_DEEP } from './catalog.js';

const TAU = Math.PI * 2;
export const W = (s, type) => s.warps.find(w => w.type === type);
const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// eyes close briefly at the end of every `every` bars
export function blink(c, every = 8) {
  const tc = (((c.bar % every) + every) % every) * c.barLen;
  const x = (tc - (every * c.barLen - 0.3)) / 0.3;
  return x > 0 && x < 1 ? Math.abs(x * 2 - 1) : 1;
}

export const ARCHETYPES = {
  // The ghost in the static: TV snow where only the shading of a face makes it visible.
  staticGhost: (o = {}) => ({
    react: 0.4,
    how: 'TV-static pattern; the Ghost warp adds halftone shading, so the face exists only as denser and sparser snow.',
    look: {
      pattern: 'static', density: o.density ?? 70, param: 0.3,
      warps: [{ type: 'sway', amount: 0.08, scale: 0.5, extra: 0 }, { type: 'face', amount: o.ghost ?? 0.9, scale: o.size ?? 0.42, extra: 1 }],
      palette: o.palette ?? 'bw', depth: 0, grain: 0.3, flicker: 0.5, vignette: 0.6, weave: 0.4, letterbox: o.letterbox ?? 1,
      glow: o.glow ?? 0, glowColor: CHERRY,
    },
    update(s, c) {
      W(s, 'sway')._ph = c.bar;
      const f = W(s, 'face');
      f.amount *= (o.appear ? c.ramp(...o.appear) : 1) * (o.vanish ? 1 - c.ramp(...o.vanish) : 1);
      f._ph = c.bar * 0.5;
      c.rt.face.eyes = blink(c);
    },
  }),

  // Dense scan lines that sway; a face slowly surfaces as relief.
  scanlines: (o = {}) => ({
    react: 0.5,
    how: 'Very dense horizontal stripes rocked by the Sway warp once per bar; the Ghost warp bends them into a face.',
    look: {
      pattern: 'stripes', density: o.density ?? 70, angle: 90,
      warps: [{ type: 'sway', amount: 0.12, scale: 0.6, extra: 0.4 }, { type: 'face', amount: 0, scale: o.size ?? 0.45, extra: 0.8 }],
      palette: o.palette ?? 'bw', depth: 0.35, grain: 0.2, vignette: 0.5, flicker: 0.25, weave: 0.3, letterbox: 1,
    },
    update(s, c) {
      W(s, 'sway')._ph = c.bar;
      const f = W(s, 'face');
      f.amount = (o.ghost ?? 0.8) * (o.appear ? c.ramp(...o.appear) : 1);
      f._ph = c.bar * 0.5;
      s.density = lerp(o.density ?? 70, o.densityTo ?? o.density ?? 70, c.u);
      c.rt.face.eyes = blink(c);
    },
  }),

  // Silk: vertical stripes in a slow current, rocking with each bar. A face can rise through it.
  silk: (o = {}) => ({
    react: 0.8,
    how: 'Vertical stripes + two Wave warps (wave phase locked to the bar) + Sway; loudness deepens the waves; the Ghost rises through.',
    look: {
      pattern: 'stripes', density: o.density ?? 46,
      warps: [
        { type: 'wave', amount: 0.32, scale: 0.3, extra: 0.5 },
        { type: 'wave', amount: 0.06, scale: 0.62, extra: 0.5 },
        { type: 'sway', amount: 0.18, scale: 0.9, extra: 0.5 },
        { type: 'face', amount: 0, scale: o.size ?? 0.45, extra: 0.8 },
      ],
      palette: o.palette ?? 'bw', depth: 0.45, grain: 0.14, vignette: 0.45, flicker: 0.12, weave: 0.2, letterbox: 1,
      glow: o.glow ?? 0, glowColor: CHERRY,
    },
    update(s, c) {
      const [w1, w2] = s.warps.filter(w => w.type === 'wave');
      w1._ph = (c.bar * TAU) / 2.5 / 2;
      w2._ph = (c.beat * TAU) / 2.5;
      W(s, 'sway')._ph = c.bar;
      const f = W(s, 'face');
      f.amount = (o.ghost ?? 0) * (o.appear ? c.ramp(...o.appear) : 1);
      f._ph = c.bar * 0.5;
      c.rt.face.eyes = blink(c);
    },
  }),

  // A halftone portrait: a grid of dots shaded by the ghost face, breathing on each bar.
  halftone: (o = {}) => ({
    react: 0.6,
    how: 'Dots pattern; the Ghost warp’s shading changes dot size (halftone) while a Bulge breathes once per bar.',
    look: {
      pattern: 'dots', density: o.density ?? 44, param: 0.5,
      warps: [
        { type: 'bulge', amount: 0.25, scale: 0.9, extra: 0 },
        { type: 'face', amount: o.ghost ?? 0.95, scale: o.size ?? 0.44, extra: 1 },
        { type: 'sway', amount: 0.1, scale: 0.5, extra: 0 },
      ],
      palette: o.palette ?? 'bw', depth: 0.2, grain: 0.16, vignette: 0.5, flicker: 0.15, weave: 0.2, letterbox: 1,
    },
    update(s, c) {
      W(s, 'bulge')._ph = (c.bar * TAU) / 1.7;
      W(s, 'sway')._ph = c.bar;
      W(s, 'face')._ph = c.bar * 0.5;
      s.param = 0.45 + 0.08 * c.tick * c.loud;
      c.rt.face.eyes = blink(c);
    },
  }),

  // The face in horizontal relief, with a second stripe layer creeping in as moiré.
  faceRelief: (o = {}) => ({
    react: 0.8,
    how: 'Horizontal stripes over the Ghost; an XOR second layer (flat, slightly rotated) adds moiré as the music grows.',
    look: {
      pattern: 'stripes', density: o.density ?? 44, angle: 90,
      mixMode: 'off', mixPattern: 'stripes', mixDensity: o.density ?? 44, mixAngle: 93, mixFlat: true,
      warps: [{ type: 'face', amount: o.ghost ?? 0.85, scale: o.size ?? 0.48, extra: 0.75 }, { type: 'sway', amount: 0.1, scale: 0.6, extra: 0.3 }],
      palette: o.palette ?? 'bw', depth: 0.45, grain: 0.14, vignette: 0.45, flicker: 0.1, weave: 0.2, letterbox: 1,
      glow: o.glow ?? 0, glowColor: CHERRY, zoom: o.zoom ?? 1,
    },
    update(s, c) {
      W(s, 'face')._ph = c.bar * 0.5;
      W(s, 'sway')._ph = c.bar;
      if (o.moire) { s.mixMode = c.ramp(...o.moire) > 0.02 ? 'xor' : 'off'; s.mixAngle = 90 + 6 * (1 - c.ramp(...o.moire)) + 1.5 * c.sway2; }
      if (o.zoomTo) s.zoom = lerp(o.zoom ?? 1, o.zoomTo, c.u);
      c.rt.face.eyes = blink(c);
    },
  }),

  // The flat world tips back into 3D and rocks like a boat.
  tiltWorld: (o = {}) => ({
    react: 0.9,
    how: 'Checkers + the Tilt warp (a real perspective plane) rocking on the bar + a breathing Twist; strong onsets drop ripples.',
    look: {
      pattern: o.pattern ?? 'checker', density: o.density ?? 9,
      warps: [{ type: 'twist', amount: 0.18, scale: 0.6, extra: 1 }, { type: 'tilt', amount: 0.55, scale: 0.35, extra: 0 }],
      palette: o.palette ?? 'bw', depth: 0.55, grain: 0.12, vignette: 0.45, glow: o.glow ?? 0.25, glowColor: CHERRY, letterbox: 1, flow: 0,
    },
    update(s, c) {
      W(s, 'tilt')._ph = (c.bar * TAU) / 2;
      W(s, 'tilt').extra = 0.12 * Math.sin(c.bar * TAU / 8);
      W(s, 'twist')._ph = (c.bar * TAU) / 1.2 / 2;
      c.rt.phase = c.bar * 0.5;
      if (c.hit > 0.5) c.ripple((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8, c.hit * 1.2);
      s.glow *= 0.4 + c.loud;
    },
  }),

  // A ball in space wearing stripes, the background flipped (figure/ground).
  sphereWorld: (o = {}) => ({
    react: 0.6,
    how: 'The Sphere warp (real 3D ball) spins one turn every 8 bars; "Inside 3D" layering puts a different pattern on the ball.',
    look: {
      pattern: o.pattern ?? 'stripes', density: o.density ?? 22,
      mixMode: o.inside ? 'inside' : 'off', mixPattern: o.inside ?? 'checker', mixDensity: 12,
      warps: [{ type: 'sway', amount: 0.1, scale: 0, extra: 0 }, { type: 'sphere', amount: 0.85, scale: o.size ?? 0.58, extra: 1 }],
      palette: o.palette ?? 'bw', depth: 0.3, grain: 0.12, vignette: 0.5, glow: o.glow ?? 0.35, glowColor: CHERRY, letterbox: 1,
    },
    update(s, c) {
      W(s, 'sphere')._ph = (c.bar * TAU) / 8;
      W(s, 'sphere').scale = (o.size ?? 0.58) * (1 + 0.04 * c.downbeat * c.loud) * (o.implode ? 1 - c.ramp(...o.implode) * 0.97 : 1);
      W(s, 'sway')._ph = c.bar;
      c.rt.phase = c.beat * 0.25;
      s.glow *= 0.3 + c.loud;
    },
  }),

  // Two sets of rings interfering — sparse, shimmering, white on black.
  moireGhosts: (o = {}) => ({
    react: 0.3,
    how: 'Moiré pattern (two ring sets multiplied) with fat black ink so only thin light lines survive, drifting on a slow orbit; the halation glow is cherry red.',
    look: {
      pattern: 'moire', density: o.density ?? 34, param: 0.3, thickness: -0.3,
      palette: 'bw', depth: 0, grain: 0.18, vignette: 0.6, glow: o.glow ?? 0.6, glowColor: CHERRY, letterbox: 1, flicker: 0.15,
      warps: [{ type: 'sway', amount: 0.06, scale: 0, extra: 0 }],
    },
    update(s, c) {
      c.rt.phase = (c.bar * TAU) / 4 / 0.5 * 0.25;
      W(s, 'sway')._ph = c.bar * 0.5;
      s.param = 0.25 + 0.15 * Math.sin(c.bar * TAU / 16);
      s.glow *= 0.6 + c.high;
    },
  }),

  // An endless floor moving one tile per bar, the horizon rolling with the sway.
  floorRide: (o = {}) => ({
    react: 0.7,
    how: 'Checkers + the Floor warp; forward motion is exactly one tile per bar; the horizon rolls with the bar-sway.',
    look: {
      pattern: 'checker', density: o.density ?? 5,
      warps: [{ type: 'floor', amount: 0.5, scale: 0.5, extra: 0 }],
      palette: o.palette ?? 'bw', depth: 0.75, grain: 0.12, vignette: 0.5, letterbox: 1, fog: o.fog ?? '#000000',
      glow: o.glow ?? 0.15, glowColor: CHERRY,
    },
    update(s, c) {
      const f = W(s, 'floor');
      f._ph = c.bar / (0.6 * s.density);
      f.extra = 0.35 * Math.sin(c.bar * TAU / 16);
      s.rotate = 5 * c.sway;
    },
  }),

  // Flying down a tunnel, one ring per bar, corkscrewing gently.
  tunnelRide: (o = {}) => ({
    react: 0.7,
    how: 'Checkers + the Tunnel warp; the flight speed is locked to the bar, the corkscrew follows a 16-bar curve; fog is deep cherry.',
    look: {
      pattern: o.pattern ?? 'checker', density: o.density ?? 8,
      warps: [{ type: 'tunnel', amount: 0.88, scale: o.slices ?? 0.45, extra: 0 }, { type: 'sway', amount: 0.12, scale: 0, extra: 0 }],
      palette: o.palette ?? 'bw', depth: 0.8, grain: 0.12, vignette: 0.5, letterbox: 1, fog: o.fog ?? CHERRY_DEEP,
      glow: o.glow ?? 0.25, glowColor: CHERRY,
    },
    update(s, c) {
      const tw = W(s, 'tunnel');
      tw._ph = (c.bar * (o.rowsPerBar ?? 2)) / (0.2 * s.density) * 2 / 2;
      tw.extra = 0.25 * Math.sin(c.bar * TAU / 16);
      W(s, 'sway')._ph = c.bar;
      s.zoom = 1 + 0.06 * c.downbeat * c.bass;
    },
  }),

  // Vasarely's glass balls, pulsing on every beat.
  lensGrid: (o = {}) => ({
    react: 0.9,
    how: 'Checkers seen through the Lenses warp; each ball pulses once per beat in a wave across the grid.',
    look: {
      pattern: o.pattern ?? 'checker', density: o.density ?? 16,
      warps: [{ type: 'lenses', amount: 0.85, scale: 0.32, extra: 0.6 }, { type: 'sway', amount: 0.08, scale: 0, extra: 0 }],
      palette: o.palette ?? 'bw', depth: 0.25, grain: 0.12, vignette: 0.45, letterbox: 1, glow: o.glow ?? 0.3, glowColor: CHERRY,
    },
    update(s, c) {
      W(s, 'lenses')._ph = c.beat * Math.PI;
      W(s, 'sway')._ph = c.bar;
      c.rt.phase = c.bar * 0.25;
    },
  }),

  // Liquid chrome silk, heavy and slow.
  chromeCloth: (o = {}) => ({
    react: 1,
    how: 'Stripes + the Cloth warp (silky folds) + Chrome relief; the folds flow with the bar and deepen with loudness.',
    look: {
      pattern: 'stripes', density: o.density ?? 18,
      warps: [{ type: 'cloth', amount: 0.55, scale: 0.3, extra: 0.6 }, { type: 'sway', amount: 0.12, scale: 0.8, extra: 0.4 }],
      relief: 0.85, palette: o.palette ?? 'wb', depth: 0.35, grain: 0.1, vignette: 0.5, letterbox: 1, glow: o.glow ?? 0.25, glowColor: CHERRY,
    },
    update(s, c) {
      W(s, 'cloth')._ph = (c.bar * TAU) / 4;
      W(s, 'sway')._ph = c.bar;
      s.glow *= 0.4 + c.loud;
    },
  }),

  // A kaleidoscopic mandala that thumps with the bass and tears on hard hits.
  mandala: (o = {}) => ({
    react: 0.9,
    how: 'Triangles/hex + Kaleidoscope + Fold; bass hits push the zoom, hard onsets fire the Glitch warp for a few frames.',
    look: {
      pattern: o.pattern ?? 'triangles', density: o.density ?? 9,
      warps: [{ type: 'fold', amount: 0.35, scale: 0.3, extra: 0.4 }, { type: 'kaleido', amount: 0.2, scale: 0.4 }, { type: 'glitch', amount: 0, scale: 0.4, extra: 0.5 }],
      palette: o.palette ?? 'bw', depth: 0.35, grain: 0.12, vignette: 0.5, letterbox: 1, glow: o.glow ?? 0.3, glowColor: CHERRY,
    },
    update(s, c) {
      W(s, 'fold')._ph = (c.bar * TAU) / 8 / 0.25;
      W(s, 'kaleido')._ph = (c.bar * TAU) / 16 / 0.25;
      const g = W(s, 'glitch');
      g.amount = Math.max(0, c.onset - 0.45) * 1.6 * (o.glitch ?? 1);
      g._ph = c.t;
      s.zoom = 1 + 0.08 * Math.pow(c.bass, 2) * c.downbeat;
      c.rt.phase = c.bar * 0.5;
    },
  }),

  // The climax: the ghost, huge, in cherry red, swaying to the guitar.
  bloom: (o = {}) => ({
    react: 1,
    how: 'Dense stripes + a large Ghost in cherry red; Sway on every bar, echo trails, cherry halation; onsets ripple out of the mouth.',
    look: {
      pattern: 'stripes', density: o.density ?? 52, angle: o.angle ?? 90,
      warps: [{ type: 'face', amount: o.ghost ?? 0.95, scale: o.size ?? 0.55, extra: 0.8 }, { type: 'sway', amount: 0.2, scale: 0.7, extra: 0.5 }],
      palette: o.palette ?? 'cherry', depth: 0.4, grain: 0.15, vignette: 0.5, echo: o.echo ?? 0.35, glow: 0.9, glowColor: CHERRY, letterbox: 1, aberr: 0.15,
    },
    update(s, c) {
      W(s, 'face')._ph = c.bar * 0.5;
      W(s, 'sway')._ph = c.bar;
      if (c.hit > 0.55) c.ripple(0, -0.13 * (o.size ?? 0.55) * 4, c.hit);
      s.aberr = 0.1 + 0.4 * c.downbeat * c.loud;
      c.rt.face.mouth = Math.min(1, c.mid * 1.3);
    },
  }),

  // Slow rings falling away into the dark, the red draining out.
  afterglow: (o = {}) => ({
    react: 0.4,
    how: 'Rings through a slow Tunnel, white on black; the cherry glow drains away across the scene.',
    look: {
      pattern: 'rings', density: 10, param: 0.33,
      warps: [{ type: 'tunnel', amount: 0.75, scale: 0.2, extra: 0 }, { type: 'sway', amount: 0.08, scale: 0, extra: 0 }],
      palette: 'wb', depth: 0.8, grain: 0.2, vignette: 0.7, glow: 0.8, glowColor: CHERRY, letterbox: 1, fog: '#000000',
    },
    update(s, c) {
      W(s, 'tunnel')._ph = c.bar * 0.4;
      W(s, 'sway')._ph = c.bar;
      s.glow *= 1 - c.u;
      s.zoom = 1 + c.u * 0.6;
    },
  }),
};
