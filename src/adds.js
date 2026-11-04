// Things you can add to any look. None is on by default; any of them can be pinned to the toolbar.
//   you (the camera) · a pair of hands · figures rising under the sheet · the ghost face · the ball · orbs · a picture or words
// The camera and the picture go through media.js / tracking.js; the rest are written straight into the
// world's values every frame (after the look and the music), so they ride along with whatever look is on.

import { FIGURES, FIGURE_INDEX, figureFrame } from './engine/figures.js';

export const ADDS = [
  { id: 'camera', name: 'You', icon: 'camera', blurb: 'your camera, inside the lines' },
  { id: 'hands', name: 'Hands', icon: 'hand', blurb: 'a pair of hands pressing through' },
  { id: 'figures', name: 'Figures', icon: 'figure', blurb: 'a skull, a serpent, a face, tentacles… coming up out of the sheet' },
  { id: 'face', name: 'Ghost face', icon: 'face', blurb: 'a face in the lines — or yours, from the camera' },
  { id: 'ball', name: 'Ball', icon: 'ball', blurb: 'a chrome ball the lines flow around' },
  { id: 'orbs', name: 'Orbs', icon: 'orbs', blurb: 'spheres rising through the sheet' },
  { id: 'picture', name: 'Picture', icon: 'image', blurb: 'an image, a video or words' },
];

export const defaultAdds = () => ({
  camera: { on: false, pinned: false },
  hands: { on: false, pinned: false, size: 1, push: 0.35, open: 0.55, apart: 0.55, copy: false },
  figures: { on: false, pinned: false, pick: 'hand', style: 'contour', size: 1, depth: 1, fabric: 0.5, cycle: false, every: 8, repeat: false, follow: true },
  face: { on: false, pinned: false, size: 1, depth: 1, copy: false },
  ball: { on: false, pinned: false, size: 0.13, speed: 0.45, wake: 0.7, flow: 1, follow: false },
  orbs: { on: false, pinned: false, amount: 1, grid: 5 },
  picture: { on: false, pinned: false },
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the ball
// It wanders across the view (or follows your mouse), turning gently and bouncing off the edges. On a beat
// it hops; when it lands, the sheet ripples.
export class Ball {
  constructor() {
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0.6; this.vy = 0.35; this.vz = 0;
    this.turn = 0;
    this.pres = 0;
    this.pump = 0;
  }

  // view = { tx, ty, frame, aspect, cut (the share of the width the side panel covers) }; music = { beat, bass };
  // target = [x, y] in the world (the mouse) or null.
  // Returns true on the frame it lands.
  step(dt, cfg, view, music, sound, target) {
    this.pres += ((cfg.on ? 1 : 0) - this.pres) * (1 - Math.exp(-dt * 3));
    const fx = view.frame * view.aspect * 0.82, fy = view.frame * 0.82;
    if (this.pres < 0.01) { this.x = view.tx; this.y = view.ty; return false; }
    const speed = cfg.speed * view.frame * 0.9;
    if (target) {
      const k = 1 - Math.exp(-dt * 5);
      const nx = this.x + (target[0] - this.x) * k, ny = this.y + (target[1] - this.y) * k;
      this.vx = (nx - this.x) / Math.max(dt, 1e-3); this.vy = (ny - this.y) / Math.max(dt, 1e-3);
      this.x = nx; this.y = ny;
    } else {
      // wander: the heading drifts, the speed holds
      this.turn += (Math.random() - 0.5) * dt * 3;
      this.turn *= Math.exp(-dt * 0.8);
      const a = Math.atan2(this.vy, this.vx) + this.turn * dt;
      this.vx = Math.cos(a) * speed; this.vy = Math.sin(a) * speed;
      this.x += this.vx * dt; this.y += this.vy * dt;
      const left = view.tx - fx, right = view.tx + fx - (view.cut || 0) * 2 * view.frame * view.aspect;
      if (this.x < left) { this.x = left; this.vx = Math.abs(this.vx); }
      if (this.x > right) { this.x = right; this.vx = -Math.abs(this.vx); }
      if (Math.abs(this.y - view.ty) > fy) { this.y = view.ty + Math.sign(this.y - view.ty) * fy; this.vy *= -1; }
    }
    // the beat makes it hop; the bass makes it swell
    if (music.beat && this.z < 0.02 && sound.ballBounce > 0) this.vz = cfg.size * (4 + 10 * sound.ballBounce);
    this.vz -= cfg.size * 60 * dt;
    this.z += this.vz * dt;
    let landed = false;
    if (this.z <= 0) { landed = this.vz < -cfg.size * 3; this.z = 0; this.vz = 0; }
    this.pump += (music.bass * sound.ballBounce - this.pump) * (1 - Math.exp(-dt * 12));
    return landed;
  }

  apply(v, cfg) {
    if (this.pres < 0.01) return;
    const sp = Math.hypot(this.vx, this.vy) || 1;
    Object.assign(v, {
      ball: this.pres, ballX: this.x, ballY: this.y, ballZ: this.z,
      ballR: cfg.size * (1 + this.pump * 0.25) * (v.frame / 0.6),
      ballVX: this.vx / sp, ballVY: this.vy / sp, ballWake: cfg.wake * clamp(sp / (v.frame * 0.3), 0.2, 1.4), ballFlow: cfg.flow,
    });
  }
}

// ---------------------------------------------------------------- hands, face, orbs
// a mirrored pair: the left one's thumb points right and the right one's left, like someone behind the
// sheet pressing both palms toward you
export function applyHands(v, cfg, pres, music, sound) {
  if (pres < 0.01) return;
  const f = v.frame / 0.6, s = cfg.size * f;
  const close = 0.5 - 0.5 * Math.cos(music.bar * TAU);
  const grab = sound.handsGrab * close;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const breathe = Math.sin(music.time * 0.6 + i * 1.9);
    Object.assign(v, {
      [`h${i}on`]: pres,
      [`h${i}x`]: v.tx + side * cfg.apart * 0.62 * v.frame,
      [`h${i}y`]: v.ty - 0.14 * v.frame + breathe * 0.015 * f,
      [`h${i}z`]: 0.02 + cfg.push * 0.35 * s + grab * 0.04 * s,
      [`h${i}s`]: s,
      [`h${i}a`]: -side * 0.28,
      [`h${i}curl`]: 0.15 + (1 - cfg.open) * 0.7 + grab * 0.8 + breathe * 0.04,
      [`h${i}spread`]: cfg.open * 0.9,
    });
  }
  v.handSoft = Math.max(0.03, 0.22 - cfg.push * 0.16);
}

export function applyFace(v, cfg, pres) {
  if (pres < 0.01) return;
  Object.assign(v, { face: Math.max(v.face, cfg.depth * pres), faceS: cfg.size * 0.95 * v.frame / 0.6, faceX: v.tx, faceY: v.ty });
  v.engrave = Math.max(v.engrave, 0.7 * pres);
  v.light = Math.max(v.light, 0.45 * pres);
}

export function applyOrbs(v, cfg, pres, music, sound) {
  if (pres < 0.01) return;
  v.orbs = Math.max(v.orbs, cfg.amount * pres * (1 + music.bass * sound.orbsBass));
  v.orbN = cfg.grid;
  v.light = Math.max(v.light, 0.5 * pres);
}

// how a figure is drawn: in its own contour lines, like a sounding chart; a solid shape with a line of paper
// round it; or just the look's pattern poured over it, like the hand. (The monolith is always solid.)
const FIG_STYLES = {
  contour: f => ({ figInk: f.ink ?? 0, figCont: f.ink ? 0 : 55, figHalo: 0.013, figLens: 0 }),
  silhouette: () => ({ figInk: 1, figCont: 0, figHalo: 0.02, figLens: 0.4 }),
  draped: f => ({ figInk: f.ink ?? 0, figCont: 0, figHalo: 0, figLens: f.lens ?? 1.4 }),
};

// how much the fabric clings to a figure (its veil), as a soft-union radius
export const figureSoft = (cfg, veil, S) => (0.012 + 0.09 * cfg.fabric * veil) * S;

// ---------------------------------------------------------------- the figure going under
// One at a time. It rises out of the sheet, holds its pose with the sheet cutting across it, and heaves a
// little like something floating. With the mouse on it, it follows your cursor exactly (whatever the
// camera's doing) and leans into the move; hold and it comes further out. Picking another: this one goes
// under, then the next comes up.
export class Figures {
  constructor() {
    this.a = FIGURE_INDEX.skull;              // showing
    this.swap = null;                         // the one waiting for this one to go under
    this.t = 0;                               // its own clock
    this.look = [0, 0];
    this.sing = 0;
    this.x = 0; this.y = 0; this.placed = false;
    this.vx = 0; this.vy = 0;
    this.press = 0;
    this.cy = null; this.cp = 0;              // which way it faces: after the camera, unhurried
    this.heave = 0;
    this.frame = new Float32Array(9);
    this.nextBar = null; this.nextTime = 0;
  }

  get current() { return FIGURES[this.swap ?? this.a].id; }

  pick(id) {
    const i = FIGURE_INDEX[id] ?? 0;
    this.swap = i === this.a ? null : i;
  }

  nextId(cur) {
    const pool = FIGURES.filter(f => f.id !== cur && !f.special);
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  // cfg: the add's settings; m: the music; aim: a function giving where a point on the figure's y axis has
  // to be for it to sit under your cursor (or null: it stays at home), home: where it stays; held: mouse down
  step(dt, cfg, m, aim, home, held, v) {
    let changed = null;
    if (cfg.on && cfg.cycle) {
      if (m.on) {
        if (this.nextBar == null || this.nextBar > m.bar + cfg.every * 2) this.nextBar = Math.floor(m.bar) + cfg.every;
        if (m.bar >= this.nextBar) { this.nextBar = Math.floor(m.bar) + cfg.every; changed = this.nextId(this.current); }
      } else {
        this.nextTime -= dt;
        if (this.nextTime <= 0) { this.nextTime = cfg.every * 1.8; changed = this.nextId(this.current); }
      }
      if (changed) { cfg.pick = changed; this.pick(changed); }
    } else this.nextBar = null;
    this.t += dt * (0.6 + (m.on ? m.loud : 0.4));
    this.press += ((held ? 1 : 0) - this.press) * (1 - Math.exp(-dt * 5));
    const f = FIGURES[this.a];
    // which way it faces, a little behind the camera, so it watches you come round
    if (this.cy == null) { this.cy = v.yaw; this.cp = v.pitch; }
    const kc = 1 - Math.exp(-dt * 1.6);
    this.cy += Math.atan2(Math.sin(v.yaw - this.cy), Math.cos(v.yaw - this.cy)) * kc;
    this.cy = Math.atan2(Math.sin(this.cy), Math.cos(this.cy));
    this.cp += (v.pitch - this.cp) * kc;
    // it heaves on the water, leans into a move, and tips with the melody
    const heaveA = 0.05 * Math.sin(this.t * 0.55), heaveB = 0.035 * Math.sin(this.t * 0.37 + 1.3);
    const sp = v.frame / 0.6;
    const lean = [clamp(-this.vx / sp * 0.16, -0.5, 0.5) + heaveA, clamp(-this.vx / sp * 0.22, -0.55, 0.55) + heaveB + (m.tilt || 0) * 0.22];
    figureFrame(f, this.cy, this.cp, lean, this.frame);
    const S = this.size = cfg.size * 1.06 * sp * (f.scale ?? 1) * (1 - 0.28 * Math.sin(clamp(this.cp, 0, 1.5))) * (cfg.repeat ? 0.72 : 1);
    const Uz = this.frame[5];
    // where it wants to be: with the point it's held by under your cursor, or at home
    const hg = (f.grab ?? 0);
    const lift = this.lift(cfg, m);
    this.z = S * Uz * (lift - (f.water ?? 0));
    let tx = home[0], ty = home[1];
    if (aim) {
      const on = aim(this.z + S * Uz * hg);
      tx = on[0] - S * this.frame[3] * hg;
      ty = on[1] - S * this.frame[4] * hg;
    }
    if (!this.placed) { this.x = tx; this.y = ty; this.placed = true; this.vx = this.vy = 0; }
    const k = 1 - Math.exp(-dt * (aim ? 26 : 3));
    const nx = this.x + (tx - this.x) * k, ny = this.y + (ty - this.y) * k;
    const idt = 1 / Math.max(dt, 1e-3), kv = 1 - Math.exp(-dt * 7);
    this.vx += ((nx - this.x) * idt - this.vx) * kv;
    this.vy += ((ny - this.y) * idt - this.vy) * kv;
    this.x = nx; this.y = ny;
    // eyes: on your pointer, or wandering
    let lx = Math.sin(this.t * 0.7) * 0.6, ly = Math.sin(this.t * 0.53 + 1) * 0.4;
    if (this.pointer) { lx = clamp((this.pointer[0] - this.x) / sp * 2.2, -1, 1); ly = clamp((this.pointer[1] - this.y) / sp * 2.2, -1, 1); }
    this.look[0] += (lx - this.look[0]) * (1 - Math.exp(-dt * 6));
    this.look[1] += (ly - this.look[1]) * (1 - Math.exp(-dt * 6));
    const sing = m.on ? clamp((m.voice ?? m.mid) * 1.1 + m.bass * 0.2 - 0.1, 0, 1) : 0.15 + 0.15 * Math.sin(this.t * 1.3);
    this.sing += (sing - this.sing) * (1 - Math.exp(-dt * 14));
    return changed;
  }

  // how far out of the water, in figure units: the mouse, the slow heave, the depth slider and the song
  lift(cfg, m) {
    const f = FIGURES[this.a];
    return (cfg.depth - 1) * 0.3 + this.press * (f.rise ?? 0.15) + 0.018 * Math.sin(this.t * 0.8) + (m.swell || 0) * 0.1;
  }

  apply(v, cfg, pres) {
    if (pres < 0.01) return;
    const f = FIGURES[this.a], S = this.size, sp = v.frame / 0.6;
    Object.assign(v, {
      fig: pres, figA: this.a, figS: S, figX: this.x, figY: this.y, figZ: this.z,
      figSoft: figureSoft(cfg, f.veil ?? 0.4, S), figBY: f.cy ?? 0, figBR: (f.r ?? 0.8) + 0.04, figSink: Math.max((f.r ?? 0.8) + Math.abs(f.cy ?? 0), 0.6),
      figVX: clamp(this.vx / sp, -6, 6) * 0.6, figVY: clamp(this.vy / sp, -6, 6) * 0.6,
      figT: this.t, figLX: this.look[0], figLY: this.look[1], figSing: this.sing, figRep: cfg.repeat ? 1 : 0, figSp: cfg.spacing || 1.15,
      figMelt: 3.2, figDip: 0.05, figRing: 1, figEdge: 0, ...FIG_STYLES[cfg.style === 'auto' ? f.style ?? 'contour' : cfg.style ?? 'contour'](f, v),
    });
  }
}
