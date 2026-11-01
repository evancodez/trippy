// The cinematic camera. It sweeps from shot to shot — straight down, high, low across the lines out to
// the horizon, tilted — each move landing on the bar, and in between it keeps flying: over open looks
// (lines, sheets) it travels forward across them like a drone over a landscape, banking into its turns;
// around looks with a middle (rings, tiles, objects) it circles. `speed` runs from drifting to sweeping.
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => x * x * (3 - 2 * x);
const KEYS = ['pitch', 'yaw', 'roll', 'focal', 'frame', 'tx', 'ty'];

const PLANAR = {
  top: r => ({ pitch: r(0, 0.12), roll: 0, focal: r(4, 8), frame: r(0.45, 0.8) }),
  high: r => ({ pitch: r(0.35, 0.6), roll: 0, focal: r(2.4, 3.6), frame: r(0.5, 0.7) }),
  mid: r => ({ pitch: r(0.7, 0.95), roll: 0, focal: r(1.7, 2.4), frame: r(0.45, 0.6) }),
  low: r => ({ pitch: r(1.12, 1.3), roll: 0, focal: r(1.3, 1.8), frame: r(0.4, 0.55) }),
  tilted: r => ({ pitch: r(0.55, 1.0), roll: (r(0, 1) < 0.5 ? -1 : 1) * r(0.2, 0.36), focal: r(1.8, 2.8), frame: r(0.45, 0.65) }),
};
// it keeps swinging between looking down and looking out to the horizon
const NEXT = { top: ['mid', 'low', 'tilted'], high: ['low', 'tilted'], mid: ['top', 'low'], low: ['top', 'high', 'mid', 'low'], tilted: ['top', 'high', 'low'] };
const FLY = r => ({ pitch: r(-0.05, 0.3), roll: r(-0.5, 0.5), focal: r(0.9, 1.4), frame: 0.6 });
const OBJECT = r => ({ pitch: r(0, 0.85), roll: r(-0.12, 0.12), focal: r(2.6, 4), frame: r(0.55, 0.8) });
// looks you can fly across forever; the others have a middle worth keeping in view
const OPEN = new Set(['lines', 'sheets']);

export class Director {
  constructor() {
    this.mix = 0;                        // 0 = the look's own camera, 1 = the director's
    this.base = null;                    // the shot glide (from → to)
    this.from = null; this.to = null;
    this.t = 1; this.dur = 1;
    this.travel = { x: 0, y: 0, yaw: 0, angle: 0, bank: 0 };   // the continuous flight on top
    this.turnRate = 0.05;
    this.kind = 'top';
    this.nextBar = 0;
    this.shots = 0;
  }

  due(m, cfg) { return cfg.on && this.base && m.bar >= this.nextBar; }

  // v: this frame's values (the look's camera); group: the look's group; m: music; cfg: { on, speed }
  update(dt, v, group, m, cfg) {
    this.mix += ((cfg.on ? 1 : 0) - this.mix) * (1 - Math.exp(-dt * 0.9));
    if (!this.base || this.mix < 0.002) {
      // follow the look while off, so switching on starts from exactly what you see
      this.base = Object.fromEntries(KEYS.map(k => [k, v[k]]));
      this.from = this.to = null;
      this.travel = { x: 0, y: 0, yaw: 0, angle: 0, bank: 0 };
      this.nextBar = Math.ceil(m.bar);
      if (!cfg.on) return;
    }
    if (this.due(m, cfg)) this.shot(v, group, m, cfg);
    this.t += dt;
    if (this.from) {
      const k = smooth(Math.min(1, this.t / this.dur));
      for (const key of KEYS) this.base[key] = lerp(this.from[key], this.to[key], k);
    }
    // keep flying: across open looks, forward like a drone over a landscape, turning and banking;
    // around a look with a middle, circling it; down a corridor, rolling
    const s = cfg.speed, T = this.travel, frame = this.base.frame;
    const loud = m.on ? 0.75 + 0.5 * m.loud : 1;
    const turn = this.turnRate * lerp(0.4, 3, s);
    T.bank += (-turn * 1.6 - T.bank) * (1 - Math.exp(-dt * 1.5));   // lean into the turn
    if (OPEN.has(group)) {
      T.yaw += turn * dt;
      const yaw = this.base.yaw + T.yaw, v0 = lerp(0.05, 1.4, s * s) * frame * loud;   // up to more than a screen a second
      T.x += -Math.sin(yaw) * v0 * dt;
      T.y += Math.cos(yaw) * v0 * dt;
    } else if (group === 'fly') {
      T.yaw += turn * dt;
    } else {
      T.angle += lerp(0.05, 0.6, s) * Math.sign(this.turnRate || 1) * loud * dt;
      const R = frame * 0.35;
      T.x = Math.cos(T.angle) * R - R;
      T.y = Math.sin(T.angle) * R;
      T.yaw = T.angle * 0.6;
    }
  }

  shot(v, group, m, cfg) {
    const r = (a, b) => a + Math.random() * (b - a);
    // the new move starts from exactly where the camera is (the flight so far folded in); the bank carries on
    const now = this.current();
    now.roll -= this.bank();
    let to;
    if (group === 'fly') to = FLY(r);
    else if (group === 'dark') to = OBJECT(r);
    else {
      const opts = NEXT[this.kind] || ['top'];
      this.kind = opts[Math.floor(Math.random() * opts.length)];
      to = PLANAR[this.kind](r);
    }
    to.yaw = now.yaw + r(-1.4, 1.4) * (0.5 + cfg.speed);
    if (OPEN.has(group)) { to.tx = now.tx; to.ty = now.ty; } else { to.tx = v.tx; to.ty = v.ty; }
    this.from = now;
    this.to = to;
    this.base = { ...now };
    this.travel = { x: 0, y: 0, yaw: 0, angle: 0, bank: this.travel.bank };
    this.turnRate = r(0.03, 0.12) * (Math.random() < 0.5 ? -1 : 1);
    // a shot lasts 12 bars (drifting) down to 2 (sweeping); most of it is the glide
    const bars = Math.max(2, Math.round(lerp(12, 2, cfg.speed)));
    this.t = 0;
    this.dur = bars * m.barLen * 0.75;
    this.nextBar = Math.floor(m.bar) + bars;
    this.shots++;
  }

  bank() { return Math.max(-0.35, Math.min(0.35, this.travel.bank)); }

  current() {
    const c = { ...this.base }, T = this.travel;
    c.yaw += T.yaw; c.tx += T.x; c.ty += T.y;
    c.roll += this.bank();
    return c;
  }

  apply(v) {
    if (this.mix < 0.002 || !this.base) return;
    const c = this.current();
    for (const k of KEYS) v[k] = lerp(v[k], c[k], this.mix);
  }
}
