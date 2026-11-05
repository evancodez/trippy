// Things you can add to any look. None is on by default; any of them can be pinned to the toolbar.
//   you (the camera) · a pair of hands · figures rising under the sheet · the ghost face · the ball · orbs · a picture or words
// The camera and the picture go through media.js / tracking.js; the rest are written straight into the
// world's values every frame (after the look and the music), so they ride along with whatever look is on.

import { FIGURES, FIGURE_INDEX } from './engine/figures.js';
import { rayOnSheet, rayAt, noSheet, camDist, camHeight } from './engine/camera.js';

export const ADDS = [
  { id: 'camera', name: 'You', icon: 'camera', blurb: 'your camera, inside the lines' },
  { id: 'hands', name: 'Hands', icon: 'hand', blurb: 'a pair of hands pressing through' },
  { id: 'figures', name: 'Figures', icon: 'figure', blurb: 'a face, a skull, a heart, tentacles… pressing up through the sheet' },
  { id: 'face', name: 'Ghost face', icon: 'face', blurb: 'a face in the lines — or yours, from the camera' },
  { id: 'ball', name: 'Ball', icon: 'ball', blurb: 'a chrome ball the lines flow around' },
  { id: 'orbs', name: 'Orbs', icon: 'orbs', blurb: 'spheres rising through the sheet' },
  { id: 'picture', name: 'Picture', icon: 'image', blurb: 'an image, a video or words' },
];

export const defaultAdds = () => ({
  camera: { on: false, pinned: false },
  hands: { on: false, pinned: false, size: 1, push: 0.35, open: 0.55, apart: 0.55, copy: false },
  figures: { on: false, pinned: false, pick: 'hand', burst: 0.25, size: 1, depth: 1, melt: 3.5, cycle: false, every: 8, repeat: false, follow: true },
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

// ---------------------------------------------------------------- the hand under your cursor
// Pressing up through the sheet from behind: it lies tipped back a little whatever the camera does, and the
// fabric melts over it. Your cursor is its wrist, for any camera. A click closes it into a fist and pushes it
// up, by an amount that scales with the hand and stays well short of the lens. Its fingers play the melody.
const HAND_TIP = 0.3, HAND_TURN = 0.15;                  // how the shader holds it (hands(), its q.yz and q.xy)
const WRIST_Y = -0.1, WRIST_Z = -0.01;                   // where its wrist is, on the hand
const WRIST_BACK = [Math.cos(HAND_TIP) * WRIST_Y - Math.sin(HAND_TIP) * WRIST_Z, Math.sin(HAND_TIP) * WRIST_Y + Math.cos(HAND_TIP) * WRIST_Z];
export class CursorHand {
  constructor() {
    this.on = 0; this.press = 0; this.t = 0;
    this.x = 0; this.y = 0; this.z = 0; this.s = 1; this.a = HAND_TURN;
    this.u = 0; this.w = -0.24;                  // where on screen the wrist is (stays there if the cursor leaves)
    this.placed = false;
    this.play = new Float32Array(5);
  }

  // cfg: the figure settings; m: the music; v: this frame's values; cursor: [u, w] or null; want: it should
  // be showing; held: mouse down; fingers: the shader's finger curls, of which this hand has 10..14
  step(dt, cfg, m, v, cursor, want, held, fingers) {
    this.on += ((want ? 1 : 0) - this.on) * (1 - Math.exp(-dt * 4));
    if (this.on < 0.001 && !want) { this.placed = false; return false; }
    this.press += ((held ? 1 : 0) - this.press) * (1 - Math.exp(-dt * 6));
    this.t += dt;
    if (cursor) { this.u = cursor[0]; this.w = cursor[1]; }
    const sp = v.frame / 0.6, s = this.s = 1.25 * sp * (cfg.size || 1);
    // it comes up facing you, then keeps that orientation: turn the camera and you see it from another side
    if (!this.placed) this.a = Math.atan2(Math.sin(HAND_TURN + v.yaw + v.roll), Math.cos(HAND_TURN + v.yaw + v.roll));
    const a = this.a;
    const ox = -Math.sin(a) * WRIST_BACK[0] * s, oy = Math.cos(a) * WRIST_BACK[0] * s, oz = WRIST_BACK[1] * s;
    // how far it stands out of the sheet, and how far a press pushes it (never most of the way to the lens)
    const fly = noSheet(v);
    let z = 0.04 * sp + Math.min(0.32 * sp, 0.22 * camHeight(v)) * this.press;
    const on = fly ? rayAt(v, this.u, this.w, 0.95 * s) : rayOnSheet(v, this.u, this.w, z + oz, 4 * camDist(v));
    if (fly) z = on[2] - oz;
    const tx = on[0] - ox, ty = on[1] - oy;
    if (!this.placed) { this.x = tx; this.y = ty; this.z = z; this.placed = true; }
    const k = 1 - Math.exp(-dt * 14);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    this.z += (z - this.z) * (fly ? k : 1);
    // the melody runs across the fingers, from the little finger up to the index
    const voice = m.on ? clamp(m.voice ?? 0, 0, 1) : 0, at = (m.height ?? 0.5) * 3;
    for (let i = 0; i < 4; i++) {
      const hit = Math.exp(-(((3 - i) - at) ** 2) / 0.7);
      this.play[i + 1] += (hit * voice * 0.42 - this.play[i + 1]) * (1 - Math.exp(-dt * 16));
      fingers[11 + i] = this.play[i + 1];
    }
    fingers[10] = voice * 0.08;
    return true;
  }

  apply(v) {
    if (this.on < 0.001) return;
    Object.assign(v, {
      h2on: this.on, h2x: this.x, h2y: this.y, h2z: this.z, h2s: this.s, h2a: this.a,
      h2curl: 0.15 + this.press * 0.9, h2spread: 0.6 - this.press * 0.3,
    });
    v.handSoft = Math.min(v.handSoft, 0.2);
  }
}

// ---------------------------------------------------------------- what's lying under the sheet
// One at a time. It rises out of the flat sheet, and when you pick another this one melts into it. With the
// mouse on it, it follows your cursor, whatever the camera's doing, and the lines drag behind it. Hold and it
// comes further up. It stays turned the way it is: move the camera and you see it from another side.
const mixN = (a, b, t) => a + (b - a) * t;
const up = (x, want, rate, dt) => x + (want - x) * (1 - Math.exp(-dt * rate));
export class Figures {
  constructor() {
    this.a = FIGURE_INDEX.sleeper;            // showing
    this.b = null;                            // turning into
    this.mix = 0; this.mixDur = 3;
    this.t = 0;                               // its own clock
    this.x = 0; this.y = 0; this.placed = false;
    this.vx = 0; this.vy = 0;
    this.press = 0; this.sing = 0; this.lub = 0; this.fl = 0; this.shut = 0; this.blinkAt = 3;
    this.lx = 0; this.ly = 0; this.spin = 0; this.heading = 0; this.facing = 0; this.thru = 0; this.orbit = 0; this.idle = 1;
    this.w = new Float32Array(4);
    this.size = 1;
    this.nextBar = null; this.nextTime = 0;
  }

  get current() { return FIGURES[this.b ?? this.a].id; }

  nextId(cur) {
    const pool = FIGURES.filter(f => f.id !== cur && !f.special);
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  // cfg: the add's settings; m: the music; aim: where your cursor lands on the sheet (or null: it stays at
  // home), home: where it stays; held: mouse down
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
      if (changed) cfg.pick = changed;
    } else this.nextBar = null;
    this.t += dt * (0.6 + (m.on ? m.loud : 0.4));
    this.press = up(this.press, held ? 1 : 0, 5, dt);
    const f = FIGURES[this.a];
    this.size = cfg.size * v.frame * (f.scale ?? 1) * (cfg.repeat ? 0.55 : 1);
    // it comes up the right way round for the camera that's looking at it, and then keeps that way however the camera turns
    if (!this.placed) this.facing = f.glide ? 0 : v.yaw + v.roll;
    let tx = home[0], ty = home[1];
    const hx = this.x, hy = this.y;
    if (aim) { const on = aim(0); tx = on[0]; ty = on[1]; }
    if (f.glide) {
      // it won't sit still: left alone it roams, and when you stop it circles you
      if (!aim) { tx += Math.sin(this.t * 0.31) * 0.72 * v.frame; ty += Math.sin(this.t * 0.23 + 1) * 0.52 * v.frame; }
      const moved = this.lastTx === undefined ? 0 : Math.hypot(tx - this.lastTx, ty - this.lastTy) / Math.max(dt, 1e-3) / v.frame;
      this.lastTx = tx; this.lastTy = ty;
      this.idle = up(this.idle, moved > 0.25 ? 0 : 1, moved > 0.25 ? 8 : 1.4, dt);
      this.orbit += dt * (0.8 + 0.5 * (m.on ? m.loud : 0.3));
      const R = 0.34 * this.size * this.idle;
      tx += Math.cos(this.orbit) * R; ty += Math.sin(this.orbit) * R;
    }
    if (!this.placed) { this.x = tx; this.y = ty; this.placed = true; this.vx = this.vy = 0; }
    const k = 1 - Math.exp(-dt * (f.glide ? 5 : aim ? 18 : 2.5));
    const nx = this.x + (tx - this.x) * k, ny = this.y + (ty - this.y) * k;
    const idt = 1 / Math.max(dt, 1e-3), kv = 1 - Math.exp(-dt * 7);
    this.vx += ((nx - this.x) * idt - this.vx) * kv;
    this.vy += ((ny - this.y) * idt - this.vy) * kv;
    this.x = nx; this.y = ny;
    if (f.glide) {
      const sp = Math.hypot(this.vx, this.vy) / Math.max(this.size, 1e-3);
      if (sp > 0.05) {
        const want = Math.atan2(this.vy, this.vx) - Math.PI / 2, dh = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
        this.heading += dh * (1 - Math.exp(-dt * 3));
      }
    } else this.heading = 0;
    // what the music does to it
    // a mouth opens on each note and closes between them; holding a long one keeps it a little open
    this.syll = Math.max((this.syll ?? 0) * Math.exp(-dt * 5.5), m.on && m.note ? 0.45 + 0.55 * (m.voice ?? 0) : 0);
    const sing = m.on ? clamp((m.voice ?? m.mid) * 0.3 + this.syll * 0.8, 0, 1) : 0.06 + 0.06 * Math.sin(this.t * 1.3);
    this.sing = up(this.sing, sing, 16, dt);
    const breath = (0.5 + 0.5 * Math.sin(this.t * 1.15)) * (m.on ? 0.5 + 0.7 * m.loud : 0.75);
    const kick = m.on ? m.kick ?? 0 : Math.max(0, Math.sin(this.t * 3.4)) ** 12;
    this.lub = Math.max(this.lub * Math.exp(-dt * 6), up(this.lub, kick, 40, dt));
    this.fl = up(this.fl, (m.on ? clamp((m.high ?? 0) * 1.2 + (m.hat ?? 0) * 0.5, 0, 1) : 0.15) * (0.55 + 0.45 * Math.sin(this.t * 19)), 22, dt);
    // an eye blinks now and then, on a beat if there is one, and shuts while you hold
    this.blinkAt -= dt;
    if (this.blinkAt < 0 && (!m.on || m.beat)) { this.blinkAt = 3 + Math.random() * 5; this.blinkT = 0; }
    if (this.blinkT !== undefined) { this.blinkT += dt; if (this.blinkT > 0.34) this.blinkT = undefined; }
    const blink = this.blinkT !== undefined ? Math.sin((this.blinkT / 0.34) * Math.PI) : 0;
    this.shut = up(this.shut, Math.max(blink, this.press), 26, dt);
    const drive = {
      voice: this.sing, press: this.press, breath, kick: Math.max(this.lub * 0.9, this.press * 0.7),
      cry: Math.max(this.sing * 0.85, this.press), flutter: Math.max(this.fl * 0.7, this.press), blink: this.shut,
      beat: Math.max(0.35 + 0.35 * Math.sin(this.t * 2.1), this.press) * (0.8 + this.press * 0.6),
    };
    (f.shapes || []).forEach((s, i) => { this.w[i] = drive[s] ?? 0; });
    // where it's looking
    let lx = m.on ? clamp(m.sway ?? 0, -1, 1) : Math.sin(this.t * 0.31) * 0.7, ly = m.on ? clamp((m.height ?? 0) * 0.5, -1, 1) : Math.sin(this.t * 0.23 + 1) * 0.4;
    if (f.lookAt === 'cursor' && this.pointer) { lx = clamp((this.pointer[0] - this.x) / (this.size * 0.7), -1, 1); ly = clamp((this.pointer[1] - this.y) / (this.size * 0.7), -1, 1); }
    const lr = f.lookAt === 'cursor' ? 9 : 2.2;
    this.lx = up(this.lx, lx, lr, dt); this.ly = up(this.ly, ly, lr, dt);
    this.spin += dt * (f.spin ?? 0) * (0.5 + (m.on ? m.loud * 1.3 : 0.3));
    // how far through the sheet it has come: the song's arc brings it through, your mouse tears it open
    const arcT = m.on ? clamp((m.swell ?? 0.4) - 0.35, 0, 0.65) : 0;
    const thru = clamp((cfg.burst ?? 0.25) * (1 + arcT) + arcT * 0.22 + this.press * 0.6, 0, 0.85);
    this.thru = up(this.thru, thru, held ? 5 : 1.1, dt);
    return changed;
  }

  apply(v, cfg, pres, m, A, B) {
    const f = FIGURES[this.a], slope = Math.max(A?.meta.slope ?? 3, B?.meta.slope ?? 0);
    const arc = m.on ? clamp((m.swell ?? 0.4) - 0.3, 0, 1) : 0;
    const amp = cfg.depth * (f.tall ?? 1) * (1 + this.press * (f.rise ?? 0.25) + arc * (f.ride ?? 0.2) + 0.02 * Math.sin(this.t * 0.8) + (m.on ? (f.pulse ?? 0) * this.lub : 0));
    const sm = this.mix * this.mix * (3 - 2 * this.mix);
    const [la, lk] = f.look || [0, 1.6];
    Object.assign(v, {
      fig: pres, figS: this.size, figX: this.x, figY: this.y, figT: this.t,
      figVX: clamp(this.vx / v.frame, -6, 6) * 0.6, figVY: clamp(this.vy / v.frame, -6, 6) * 0.6,
      figRep: cfg.repeat ? 1 : 0, figSp: cfg.spacing || 2, figRot: this.spin + this.heading + this.facing, figMix: sm, figAmp: amp,
      figTop: mixN(A?.meta.top ?? 0.4, B?.meta.top ?? A?.meta.top ?? 0.4, sm) * amp, figBurst: this.thru,
      figStep: Math.min(1, 1.15 / Math.sqrt(1 + (0.55 * slope * amp) ** 2)),
      figShapes: A?.shapes ? 1 : 0, figLookX: la * this.lx * (1 - sm), figLookY: la * this.ly * (1 - sm), figLookK: lk,
      figWrithe: (f.writhe?.[0] ?? 0) * (0.7 + (m.on ? m.loud * 0.6 : 0.3) + this.press * 0.7), figWF: f.writhe?.[1] ?? 6, figWT: this.t * (f.writhe?.[2] ?? 0) * 2,
    });
    for (let i = 0; i < 4; i++) this.w[i] *= 1 - sm;
  }
}
