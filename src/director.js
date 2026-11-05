// The cinematic camera: one long, unbroken move. It never stops and never cuts. A shot is a pose the camera
// is on its way to (looking straight down, tipped back, low across the lines to the horizon, banked), and
// the path runs through those poses as a smooth curve, so it arrives at each still moving, on its way to the
// next. Over open looks it also travels, like a drone across a landscape; around a look with a middle it
// keeps the middle in view and wanders around it; inside a tunnel it rolls. On top of the look's own camera,
// so a pattern's scale and centre carry through. `speed` runs from drifting to sweeping.
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const FIELDS = ['pitch', 'yaw', 'roll', 'lf', 'lz', 'tx', 'ty'];
// these have somewhere to turn around; the others (a pan, a slow turn) just keep going
const TURNING = new Set(['pitch', 'roll', 'lf', 'lz']);

// lf: log of the lens; lz: log of the zoom (how much further in or out than the look's own frame)
const lens = (a, b, r) => Math.log(r(a, b));
const POSES = {
  top: r => ({ pitch: r(0, 0.1), roll: 0, lf: lens(4, 8, r), lz: lens(0.72, 1.3, r) }),
  high: r => ({ pitch: r(0.32, 0.58), roll: r(-0.06, 0.06), lf: lens(2.6, 3.8, r), lz: lens(0.82, 1.2, r) }),
  mid: r => ({ pitch: r(0.72, 0.98), roll: r(-0.05, 0.05), lf: lens(1.9, 2.6, r), lz: lens(0.78, 1.05, r) }),
  low: r => ({ pitch: r(1.1, 1.28), roll: 0, lf: lens(1.4, 1.9, r), lz: lens(0.7, 0.92, r) }),
  tilted: r => ({ pitch: r(0.55, 1), roll: (r(0, 1) < 0.5 ? -1 : 1) * r(0.14, 0.3), lf: lens(1.9, 2.8, r), lz: lens(0.8, 1.05, r) }),
};
// one pose leads to the next: it keeps swinging between looking down and looking out to the horizon
const NEXT = { top: ['high', 'mid', 'tilted', 'low'], high: ['low', 'tilted', 'top', 'mid'], mid: ['top', 'low', 'high'], low: ['mid', 'high', 'top', 'tilted'], tilted: ['top', 'high', 'low'] };
// a quiet passage stays up high and turns; a big one uses the whole range
const CALM = { top: ['high', 'top'], high: ['top', 'high', 'mid'], mid: ['high', 'top'], low: ['mid', 'high'], tilted: ['high', 'top'] };
const FLY = r => ({ pitch: r(-0.05, 0.26), roll: r(-0.5, 0.5), lf: lens(0.9, 1.4, r), lz: 0 });
const OBJECT = r => ({ pitch: r(0, 0.85), roll: r(-0.12, 0.12), lf: lens(2.6, 4, r), lz: lens(0.9, 1.2, r) });

export class Director {
  constructor() {
    this.mix = 0; this.mixA = 0;  // 0 = the look's own camera, 1 = the director's
    this.keys = null;             // four poses: the one before, the two this stretch runs between, the one after
    this.len = [1, 1, 1];         // seconds between them
    this.t = 0;                   // seconds into the stretch
    this.pose = null;             // where the camera is now
    this.name = 'top';
    this.turn = 1;                // which way it's slowly turning
    this.heading = 0.4;
    this.passed = false;          // a key was reached this frame
    this.bankV = 0;
    this.rate = 0;
    this.insideA = 0;
    this.inside = 0;              // 1 inside a world you fly through: that has its own camera, and we only turn it
    this.shots = 0;
  }

  due(m, cfg) { return cfg.on && this.passed; }

  // v: this frame's values (the look's camera); group: the kind of camera the look wants; m: music;
  // cfg: { on, speed, kind (the section's character), ahead(seconds) => what's coming then, if anyone knows }
  update(dt, v, group, m, cfg) {
    this.passed = false;
    // these two ease in two stages, so they set off from a standstill rather than with a kick
    const k1 = 1 - Math.exp(-dt * 1.3), k2 = 1 - Math.exp(-dt * 1.1);
    this.mixA += ((cfg.on || cfg.keep ? 1 : 0) - this.mixA) * k1; this.mix += (this.mixA - this.mix) * k1;
    this.rate += ((cfg.on ? 1 : 0) - this.rate) * (1 - Math.exp(-dt * 1.6));      // told to stop, it slows to a rest where it is (keep), rather than swinging back
    this.insideA += ((group === 'fly' ? 1 : 0) - this.insideA) * k2; this.inside += (this.insideA - this.inside) * k2;
    if (!this.keys || this.mix < 0.002) {
      // follow the look while off, so switching on starts from exactly what you see
      if (cfg.on || !this.keys) this.start(v, group, m, cfg);
      if (!cfg.on) return;
    }
    if (!cfg.on && !cfg.keep) return;                                       // easing off: hold where it got to
    this.t += dt * this.rate;
    while (this.t >= this.len[1]) {
      this.t -= this.len[1];
      this.keys.shift(); this.len.shift();
      const after = this.len[1];
      const [key, secs] = this.next(this.keys[2], group, m, cfg, after);
      this.keys.push(key); this.len.push(secs);
      this.passed = cfg.on;
      this.shots++;
    }
    this.pose = this.at(this.t);
    // bank into the turn, a little, the way anything flying does (only when it's looking along the ground)
    const yv = this.lastYaw === undefined ? 0 : (this.pose.yaw - this.lastYaw) / Math.max(dt, 1e-3);
    this.lastYaw = this.pose.yaw;
    this.bankV += (clamp(-yv * 1.1, -0.28, 0.28) * clamp(this.pose.pitch, 0, 1) - this.bankV) * (1 - Math.exp(-dt * 1.2));
  }

  start(v, group, m, cfg) {
    const here = { pitch: v.pitch, yaw: 0, roll: v.roll, lf: Math.log(Math.max(v.focal, 0.1)), lz: 0, tx: 0, ty: 0 };
    this.keys = [{ ...here }, { ...here }];
    const [a, la] = this.next(here, group, m, cfg, 0);
    const [b, lb] = this.next(a, group, m, cfg, la);
    this.keys.push(a, b);
    this.len = [la, la, lb];
    this.t = 0;
    this.pose = { ...here };
    this.lastYaw = 0;
  }

  // the next pose, `after` seconds beyond the end of the stretch it's being added to
  next(prev, group, m, cfg, after) {
    const r = (a, b) => a + Math.random() * (b - a);
    const coming = cfg.ahead?.(after);
    const g = coming?.group || group, kind = coming?.kind || cfg.kind || 'flow';
    const s = clamp(cfg.speed ?? 0.5, 0, 1);
    const big = kind === 'peak' || kind === 'swell' || coming?.fresh;
    let k;
    if (g === 'fly') k = FLY(r);
    else if (g === 'object') k = OBJECT(r);
    else {
      const from = coming?.fresh && prev.pitch < 0.5 ? ['mid', 'low', 'tilted'] : coming?.fresh ? ['top', 'high'] : kind === 'hush' ? CALM[this.name] : NEXT[this.name];
      this.name = from[Math.floor(Math.random() * from.length)] || 'top';
      k = POSES[this.name](r);
    }
    // a stretch: whole bars, shorter when it's sweeping
    const barLen = m.barLen || 2;
    const bars = Math.max(2, Math.round(lerp(12, 4, s) * (big ? 0.85 : 1)));
    const secs = clamp(bars * barLen, 4, 26);
    // it keeps turning the same way for a while
    if (Math.random() < 0.22) this.turn *= -1;
    k.yaw = prev.yaw + this.turn * r(0.22, 0.85) * (0.45 + s) * (secs / 14);
    // where it's looking (in frames, so a zoomed-out look moves as far on screen): across for ever, or around the middle
    if (g === 'open') {
      const d = Math.hypot(prev.tx, prev.ty), lim = 5;
      // heading wanders, and past a certain distance curves home, so a look with a middle is never miles off
      this.heading += r(-0.8, 0.8);
      if (d > lim) this.heading += Math.atan2(Math.sin(Math.atan2(-prev.ty, -prev.tx) - this.heading), Math.cos(Math.atan2(-prev.ty, -prev.tx) - this.heading)) * 0.8;
      const go = lerp(0.1, 0.42, s) * secs * 0.6;
      k.tx = prev.tx + Math.cos(this.heading) * go;
      k.ty = prev.ty + Math.sin(this.heading) * go;
    } else if (g === 'center') {
      const a = r(0, 6.283), R = r(0.05, 0.5) * 0.6;
      k.tx = Math.cos(a) * R; k.ty = Math.sin(a) * R;
    } else { k.tx = 0; k.ty = 0; }
    return [k, secs];
  }

  // a curve through the poses: its speed at each is set by the ones either side, so it never stops dead at
  // one; only something that's turning round (a tilt going back up) slows to turn
  at(t) {
    const [K0, K1, K2, K3] = this.keys, [a, b, c] = this.len;
    const u = clamp(t / b, 0, 1), u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const c1 = {};
    for (const f of FIELDS) {
      let m1 = (K2[f] - K0[f]) / (a + b), m2 = (K3[f] - K1[f]) / (b + c);
      if (TURNING.has(f)) {
        if ((K2[f] - K1[f]) * (K1[f] - K0[f]) <= 0) m1 = 0;
        if ((K3[f] - K2[f]) * (K2[f] - K1[f]) <= 0) m2 = 0;
      }
      c1[f] = h00 * K1[f] + h10 * b * m1 + h01 * K2[f] + h11 * b * m2;
    }
    return c1;
  }

  apply(v) {
    if (this.mix < 0.002 || !this.pose) return;
    // while the walls of a tunnel are still there, the camera stays pointing down it (tipped over, it would
    // be staring at one wall, one flat color); it takes up the next pose only as they go
    const w = clamp((v.gyro + v.sponge + v.hall - 0.3) / 0.35, 0, 1);
    const c = this.pose, k = this.mix, out = k * (1 - Math.max(this.inside, w * w * (3 - 2 * w)));
    v.pitch = lerp(v.pitch, clamp(c.pitch, -0.3, 1.36), out);
    v.roll = lerp(v.roll, c.roll + this.bankV, k);
    v.yaw += c.yaw * k;
    v.focal = lerp(v.focal, Math.exp(c.lf), out);
    v.frame *= Math.exp(c.lz * out);
    v.tx += c.tx * v.frame * out;
    v.ty += c.ty * v.frame * out;
  }
}
