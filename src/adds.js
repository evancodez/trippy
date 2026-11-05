// Things you can add to any look. None is on by default; any of them can be pinned to the toolbar.
//   you (the camera) · a pair of hands · figures rising under the sheet · the ghost face · the ball · orbs · a picture or words
// The camera and the picture go through media.js / tracking.js; the rest are written straight into the
// world's values every frame (after the look and the music), so they ride along with whatever look is on.

import { FORMS, FORM_INDEX, BASES, BASE_REACH, BASE_SCALE, BASE_WARP, BAKED, SHIFT_DEFAULTS } from './engine/forms.js';
import { rayOnSheet, rayAt, noSheet, camDist, camHeight } from './engine/camera.js';

export const ADDS = [
  { id: 'camera', name: 'You', icon: 'camera', blurb: 'your camera, inside the lines' },
  { id: 'hands', name: 'Hands', icon: 'hand', blurb: 'a pair of hands pressing through' },
  { id: 'figures', name: 'Figures', icon: 'figure', blurb: 'a hand, a face, things grown and things cut, coming up through the sheet' },
  { id: 'face', name: 'Ghost face', icon: 'face', blurb: 'a face in the lines — or yours, from the camera' },
  { id: 'ball', name: 'Ball', icon: 'ball', blurb: 'a chrome ball the lines flow around' },
  { id: 'orbs', name: 'Orbs', icon: 'orbs', blurb: 'spheres rising through the sheet' },
  { id: 'picture', name: 'Picture', icon: 'image', blurb: 'an image, a video or words' },
];

export const defaultAdds = () => ({
  camera: { on: false, pinned: false },
  hands: { on: false, pinned: false, size: 1, push: 0.35, open: 0.55, apart: 0.55, copy: false },
  figures: { on: false, pinned: false, pick: 'hand', size: 1, morph: 2.5, follow: true, drift: 0, music: 0.6, shift: { ...SHIFT_DEFAULTS } },
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

// ---------------------------------------------------------------- the form under your cursor
// It comes up through the sheet where your cursor is (for the hand, that's its wrist), facing you, and keeps that
// orientation: turn the camera and you see it from another side. Hold and it reacts, and rises a little, by an
// amount that scales with it and stays well short of the lens. What's been done to it eases from one setting to
// the next, and anything that can't ease (another solid, another number of copies) melts across.
const HAND_TURN = 0.15, HAND_TIP = 0.3;
const WRIST_Y = -0.1, WRIST_Z = -0.01;                   // where its wrist is, on the hand
const WRIST_BACK = [Math.cos(HAND_TIP) * WRIST_Y - Math.sin(HAND_TIP) * WRIST_Z, Math.sin(HAND_TIP) * WRIST_Y + Math.cos(HAND_TIP) * WRIST_Z];
const eased = Object.keys(SHIFT_DEFAULTS).filter(k => k !== 'fold' && k !== 'echo');

export class Form {
  constructor() {
    this.on = 0; this.press = 0; this.t = 0; this.sing = 0; this.syll = 0;
    this.x = 0; this.y = 0; this.z = 0; this.s = 1; this.facing = 0;
    this.u = 0; this.w = -0.24;                  // where on screen it is (it stays there if the cursor leaves)
    this.lookUp = 0;
    this.placed = false;
    this.a = 0; this.b = null; this.mix = 0;     // which solid it is, and the one it's melting into
    this.fa = 1; this.fb = 1; this.ea = 0; this.eb = 0;
    this.play = new Float32Array(5);
    this.val = { ...SHIFT_DEFAULTS };
    this.wave = 0; this.rope = 0; this.ring = 0; this.aura = 0; this.spinT = 0; this.sliceT = 0;
  }

  get base() { return BASES[this.b != null && this.mix > 0.5 ? this.b : this.a]; }
  get bakedNow() { const A = BASES[this.a], B = this.b != null ? BASES[this.b] : null; return BAKED[A] || (B && BAKED[B]) || null; }

  // cfg: the settings; m: the music; v: this frame's values; cursor: [u, w] or null; want: it should be showing;
  // held: mouse down; fingers: the shader's finger curls, of which it has 10..14
  step(dt, cfg, m, v, cursor, want, held, fingers, ready) {
    const form = FORMS[FORM_INDEX[cfg.pick]] || FORMS[0];
    const wantBase = BASES.indexOf(form.base), S = cfg.shift;
    // another solid, another count of copies: melts across, once what it needs has arrived
    const fold = Math.round(S.fold), echo = Math.round(S.echo);
    const differs = wantBase !== this.a || fold !== this.fa || echo !== this.ea;
    if (this.b == null && differs && ready(wantBase)) {
      if (this.on < 0.02) { this.a = wantBase; this.fa = fold; this.ea = echo; }
      else { this.b = wantBase; this.fb = fold; this.eb = echo; this.mix = 0; }
    }
    if (this.b != null) {
      this.mix += dt / Math.max(cfg.morph, 0.3);
      if (this.mix >= 1) { this.a = this.b; this.fa = this.fb; this.ea = this.eb; this.b = null; this.mix = 0; }
    }
    const up = want && (this.on > 0.02 ? ready(this.a) : ready(wantBase));      // nothing comes up until it has what it's coming up as
    this.on += ((up ? 1 : 0) - this.on) * (1 - Math.exp(-dt * (up ? 1.6 : 2.5)));
    if (this.on < 0.001 && !up) { this.placed = false; return false; }
    this.press += ((held ? 1 : 0) - this.press) * (1 - Math.exp(-dt * 6));
    this.t += dt;
    for (const k of eased) this.val[k] += (S[k] - this.val[k]) * (1 - Math.exp(-dt * 2.2));
    if (cursor) { this.u = cursor[0]; this.w = cursor[1]; }
    const val = this.val, sp = v.frame / 0.6;
    const mixK = this.b != null ? this.mix : 0, baseK = BASE_SCALE[BASES[this.a]] * (1 - mixK) + (this.b != null ? BASE_SCALE[BASES[this.b]] * mixK : 0);
    const s = this.s = 1.25 * sp * (cfg.size || 1) * baseK;
    if (!this.placed) {
      this.facing = Math.atan2(Math.sin(v.yaw + v.roll), Math.cos(v.yaw + v.roll));
      // a face comes up looking at you, whichever way the camera was when it came
      this.lookUp = clamp(v.pitch, 0, 1.2) * 0.8;
    }
    // the hand's wrist is on the cursor; anything else, its middle
    const handK = (this.a === 0 ? 1 - this.mix : 0) + (this.b === 0 ? this.mix : 0);
    const a = this.facing + val.turn + handK * HAND_TURN;
    const ox = -Math.sin(a) * WRIST_BACK[0] * s * handK, oy = Math.cos(a) * WRIST_BACK[0] * s * handK, oz = WRIST_BACK[1] * s * handK;
    const fly = noSheet(v);
    // where it stands comes from the cursor at rest; holding only lifts it straight up from there. (Keeping it on
    // the cursor's line of sight as it rose would slide it toward the camera.)
    const rest = 0.04 * sp + val.rise * s * 0.5;
    let z = rest + Math.min(0.32 * sp, 0.22 * camHeight(v)) * this.press * (handK * 0.7 + 0.3);
    const at = fly ? rayAt(v, this.u, this.w, 0.95 * s) : rayOnSheet(v, this.u, this.w, rest + oz, 4 * camDist(v));
    if (fly) z = at[2] - oz;
    const tx = at[0] - ox, ty = at[1] - oy;
    if (!this.placed) { this.x = tx; this.y = ty; this.z = z; this.placed = true; }
    const k = 1 - Math.exp(-dt * 14);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    this.z += (z - this.z) * (fly ? k : 1);
    // the song: the tune runs across a hand's fingers, opens a mouth; everything else breathes with it
    const mus = m.on ? cfg.music : 0, voice = m.on ? clamp(m.voice ?? 0, 0, 1) : 0, height = (m.height ?? 0.5) * 3;
    for (let i = 0; i < 4; i++) {
      const hit = Math.exp(-(((3 - i) - height) ** 2) / 0.7);
      this.play[i + 1] += (hit * voice * 0.42 - this.play[i + 1]) * (1 - Math.exp(-dt * 16));
      fingers[11 + i] = this.play[i + 1];
    }
    fingers[10] = voice * 0.08;
    this.syll = Math.max(this.syll * Math.exp(-dt * 5.5), m.on && m.note ? 0.45 + 0.55 * voice : 0);
    this.sing += (mus * clamp(voice * 0.3 + this.syll * 0.8, 0, 1) - this.sing) * (1 - Math.exp(-dt * 14));
    const flow = m.on ? 0.5 + (m.loud ?? 0.4) * 1.4 * mus : 0.5;
    this.wave += dt * 1.1 * flow; this.rope += dt * 0.32 * flow; this.ring += dt * 0.028 * flow; this.sliceT += dt * 0.11 * flow; this.spinT += dt * 0.06 * flow;
    this.aura += dt * 1.8 * flow;
    return true;
  }

  blend(A, B, of) {
    const m = this.b != null ? this.mix * this.mix * (3 - 2 * this.mix) : 0;
    return of(A, this.fa) * (1 - m) + of(B, this.b != null ? this.fb : this.fa) * m;
  }
  yawOf(A, B) { return this.blend(A, B, n => (n === 'hand' ? HAND_TURN : 0)); }
  leanOf(A, B) { return this.blend(A, B, (n, fold) => (n === 'face' && fold <= 1 ? this.lookUp : 0)); }

  // the hand has the fine outline to carry heavier ink; anything else keeps the pattern as sharp as it is on the sheet
  drawn(V) {
    const k = (this.a === 0 ? 1 - this.mix : 0) + (this.b === 0 ? this.mix : 0);
    const m = this.b != null ? this.mix : 0, warp = BASE_WARP[BASES[this.a]] * (1 - m) + (this.b != null ? BASE_WARP[BASES[this.b]] * m : 0);
    return { formLit: 1.5 * k, formRim: 0.35 * k, formLens: V.warp * warp, formShade: V.shade * (1 - k) };
  }

  apply(v, cfg, m) {
    if (this.on < 0.001) return;
    const V = this.val, D = cfg.drift, T = this.t;
    // left to keep changing: everything leans slowly one way and then the other, never quite repeating
    const w = (a, b) => D * Math.sin(T * a + b);
    const mus = m.on ? cfg.music : 0, bass = mus * (m.bass ?? 0);
    const fold = Math.max(this.fa, this.b != null ? this.fb : 1), echo = Math.max(this.ea, this.b != null ? this.eb : 0);
    const A = BASES[this.a], B = this.b != null ? BASES[this.b] : A;
    const twist = V.twist + w(0.19, 0) * 2.2, bend = V.bend + w(0.13, 1.3) * 0.9, waveA = V.wave + D * 0.3 + mus * (m.mid ?? 0) * 0.25;
    const swell = V.swell + bass * 0.012 + (this.sing > 0 && A !== 'hand' && A !== 'face' ? this.sing * 0.008 : 0);
    let bound = Math.max(BASE_REACH[A], BASE_REACH[B]);
    if (echo > 0) bound *= 1 + (echo * 0.75);
    if (fold > 1) bound += V.spread;
    bound += Math.abs(swell) + Math.abs(waveA) * 0.14;
    if (Math.abs(bend) > 0.2 || Math.abs(twist) > 0.2) bound *= 1.1;
    const open = Math.max(this.press, A === 'face' || B === 'face' ? this.sing * 0.7 : A === 'hand' || B === 'hand' ? 0 : this.sing * 0.3);
    const field = V.field > 0.01 ? (bound * 1.35 + 0.08) * (2.1 - V.field) : 0;
    Object.assign(v, {
      formOn: this.on, formX: this.x, formY: this.y, formZ: this.z, formS: this.s,
      formYaw: this.facing + V.turn + this.yawOf(A, B), formLean: V.lean + this.leanOf(A, B),
      formA: this.a, formB: this.b ?? this.a, formMix: this.b != null ? this.mix * this.mix * (3 - 2 * this.mix) : 0,
      formFA: this.fa, formFB: this.b != null ? this.fb : this.fa, formEA: this.ea, formEB: this.b != null ? this.eb : this.ea,
      formOpen: open, formSoft: (V.blocks > 0.02 ? 0.012 : 0.015 + V.melt * V.melt * 0.42) * v.frame / 0.6, formBound: bound,
      formSpread: V.spread, formSpin: V.spin + this.spinT * (fold > 1 ? 1 : 0), formEchoS: V.echoSize, formEchoT: V.echoTurn + w(0.17, 2) * 0.25,
      formField: field, formTwist: twist, formBend: bend, formWave: waveA > 0.004 ? waveA : 0, formWaveT: this.wave, formRopeT: this.rope,
      formSlice: V.slice, formSliceF: V.layers, formSliceA: V.sliceTilt + w(0.11, 0.7) * 0.5, formSliceP: this.sliceT, formRings: V.rings, formRingT: this.ring,
      formHoles: V.holes, formBumps: V.bumps, formBlocks: V.blocks > 0.02 ? 0.012 + V.blocks * 0.09 : 0, formSwell: swell,
      formBaked: BAKED[A] || BAKED[B] ? 1 : 0, formThrow: V.throw,
      ...this.drawn(V),
      formNeg: V.neg, formFill: V.fill, formFine: V.fine, formContour: V.contour, formStripeA: V.stripeTilt, formStripeF: V.stripes, formStripeW: V.stripeInk, formAura: V.aura + bass * V.aura, formAuraT: this.aura,
    });
  }
}
