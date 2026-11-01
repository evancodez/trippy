// Things you can add to any look. None is on by default; any of them can be pinned to the toolbar.
//   you (the camera) · a pair of hands · the ghost face · the ball · orbs · a picture or words
// The camera and the picture go through media.js / tracking.js; the rest are written straight into the
// world's values every frame (after the look and the music), so they ride along with whatever look is on.

export const ADDS = [
  { id: 'camera', name: 'You', icon: 'camera', blurb: 'your camera, inside the lines' },
  { id: 'hands', name: 'Hands', icon: 'hand', blurb: 'a pair of hands pressing through' },
  { id: 'face', name: 'Face', icon: 'face', blurb: 'a ghost face in the lines' },
  { id: 'ball', name: 'Ball', icon: 'ball', blurb: 'a chrome ball the lines flow around' },
  { id: 'orbs', name: 'Orbs', icon: 'orbs', blurb: 'spheres rising through the sheet' },
  { id: 'picture', name: 'Picture', icon: 'image', blurb: 'an image, a video or words' },
];

export const defaultAdds = () => ({
  camera: { on: false, pinned: false },
  hands: { on: false, pinned: false, size: 1, push: 0.35, open: 0.55, apart: 0.55, copy: false },
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
