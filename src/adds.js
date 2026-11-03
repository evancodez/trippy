// Things you can add to any look. None is on by default; any of them can be pinned to the toolbar.
//   you (the camera) · a pair of hands · figures rising under the sheet · the ghost face · the ball · orbs · a picture or words
// The camera and the picture go through media.js / tracking.js; the rest are written straight into the
// world's values every frame (after the look and the music), so they ride along with whatever look is on.

import { FIGURES, FIGURE_INDEX } from './engine/figures.js';

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
  figures: { on: false, pinned: false, pick: 'skull', size: 1, depth: 1, fabric: 0.45, spin: 0, cycle: false, every: 4, repeat: false, follow: false },
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

// so a figure reads in any look (like the ghost face): light thins the ink on its slopes and the
// lines bend over it
export function figureLight(v, k) {
  v.engrave = Math.max(v.engrave, 0.75 * k);
  v.light = Math.max(v.light, 0.45 * k);
  v.refract = Math.max(v.refract, 0.6 * k);
}

// how much the fabric clings to a figure (its veil), as a soft-union radius
export const figureSoft = (cfg, veil, S) => (0.02 + 0.2 * cfg.fabric * veil) * S;

// ---------------------------------------------------------------- figures pressing through the sheet
// One figure at a time, and picking another doesn't cut: the old one re-forms into the new one.
// With "change with the music" it moves on by itself every few bars. Eyes follow your pointer;
// jaws and wings move with the sound.
export class Figures {
  constructor() {
    this.a = 0; this.b = 0; this.mix = 0;     // showing a, turning into b
    this.t = 0;                               // its own clock (serpents slither, the ouroboros turns)
    this.rot = 0;
    this.look = [0, 0];
    this.sing = 0;
    this.x = 0; this.y = 0; this.placed = false;
    this.cy = null; this.cp = 0;              // which way they face: after the camera, unhurried
    this.nextBar = null; this.nextTime = 0;
    this.swap = null;                         // one from another group, waiting for this one to sink away
  }

  get current() { return FIGURES[this.swap ?? (this.mix > 0.5 ? this.b : this.a)].id; }

  // one from the same group re-forms out of this one; one from another group waits for this one to sink
  // away (main.js does that, while the shader for its group is built), then comes up
  pick(id) {
    const i = FIGURE_INDEX[id] ?? 0;
    if (this.mix > 0) { this.a = this.mix > 0.5 ? this.b : this.a; this.mix = 0; }
    this.swap = null;
    if (i === this.a) return;
    if (FIGURES[i].group !== FIGURES[this.a].group) { this.swap = i; return; }
    this.b = i;
    this.mix = 0.0001;
  }

  // the next one when changing with the music: another from the same group (so the shader already has
  // it), never the same twice
  nextId(cur) {
    const g = FIGURES[FIGURE_INDEX[cur] ?? 0].group, pool = FIGURES.filter(f => f.group === g && f.id !== cur);
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  // cfg: the add's settings; m: the music; pointer: where your pointer is on the sheet (or null); center: the view's middle
  // Returns the id it moved on to, if it changed by itself this frame.
  step(dt, cfg, m, pointer, center) {
    let changed = null;
    if (this.mix > 0 && this.canMorph !== false) {           // (once the shader can draw the new one)
      this.mix = Math.min(1, this.mix + dt / 1.6);
      if (this.mix >= 1) { this.a = this.b; this.mix = 0; }
    }
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
    this.rot += dt * cfg.spin * 0.6;
    // where it is: the middle of the view, or drifting after your pointer
    const target = cfg.follow && pointer ? pointer : center;
    if (!this.placed) { this.x = target[0]; this.y = target[1]; this.placed = true; }
    const k = 1 - Math.exp(-dt * (cfg.follow ? 2.5 : 4));
    this.x += (target[0] - this.x) * k; this.y += (target[1] - this.y) * k;
    // eyes: on your pointer, or wandering
    let lx = Math.sin(this.t * 0.7) * 0.6, ly = Math.sin(this.t * 0.53 + 1) * 0.4;
    if (pointer) { lx = clamp((pointer[0] - this.x) * 2.2, -1, 1); ly = clamp((pointer[1] - this.y) * 2.2, -1, 1); }
    this.look[0] += (lx - this.look[0]) * (1 - Math.exp(-dt * 6));
    this.look[1] += (ly - this.look[1]) * (1 - Math.exp(-dt * 6));
    const sing = m.on ? clamp(m.mid * 1.2 + m.bass * 0.4 - 0.15, 0, 1) : 0.15 + 0.15 * Math.sin(this.t * 1.3);
    this.sing += (sing - this.sing) * (1 - Math.exp(-dt * 14));
    return changed;
  }

  // every figure (this one and a figure tool) turns to face the camera, a little behind it, so it watches
  // you come round
  turn(v, dt) {
    if (this.cy == null) { this.cy = v.yaw; this.cp = v.pitch; }
    const k = 1 - Math.exp(-dt * 1.6);
    this.cy += Math.atan2(Math.sin(v.yaw - this.cy), Math.cos(v.yaw - this.cy)) * k;
    this.cy = Math.atan2(Math.sin(this.cy), Math.cos(this.cy));
    this.cp += (v.pitch - this.cp) * k;
    Object.assign(v, { figCY: this.cy, figCP: this.cp });
  }

  apply(v, cfg, pres) {
    if (pres < 0.01) return;
    const S = cfg.size * 0.95 * v.frame / 0.6;
    const A = FIGURES[this.a], B = FIGURES[this.b], k = this.mix, lerp = key => A[key] + (B[key] - A[key]) * k;
    Object.assign(v, {
      fig: pres, figA: this.a, figB: this.b, figMix: k * k * (3 - 2 * k), figStA: A.stand, figStB: B.stand,
      // standing up to a low camera, it comes up a little further, so its chin clears the sheet
      figS: S, figX: this.x, figY: this.y, figZ: ((cfg.depth - 1) * 0.12 + lerp('lift') + 0.1 * Math.sin(Math.max(this.cp, 0)) * (1 - lerp('stand'))) * S, figSoft: figureSoft(cfg, lerp('veil'), S),
      figRot: this.rot, figT: this.t, figLX: this.look[0], figLY: this.look[1], figSing: this.sing, figRep: cfg.repeat ? 1 : 0,
    });
    figureLight(v, pres);
  }
}
