// The cinematic camera. It glides from shot to shot: straight down, high, low across the lines out to the
// horizon, tilted. Each move lands on the bar, and between moves it never quite stops, turning and panning
// slowly over the lines. Its shots suit the look: flat looks and sheets get the full range, corridors get
// rolls and gentle tilts, objects get circled.
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => x * x * (3 - 2 * x);
const KEYS = ['pitch', 'yaw', 'roll', 'focal', 'frame', 'tx', 'ty'];

const PLANAR = {
  top: r => ({ pitch: r(0, 0.12), roll: 0, focal: r(4, 8), frame: r(0.45, 0.8) }),
  high: r => ({ pitch: r(0.35, 0.6), roll: r(-0.05, 0.05), focal: r(2.4, 3.6), frame: r(0.5, 0.7) }),
  mid: r => ({ pitch: r(0.7, 0.95), roll: r(-0.08, 0.08), focal: r(1.7, 2.4), frame: r(0.45, 0.6) }),
  low: r => ({ pitch: r(1.12, 1.3), roll: r(-0.06, 0.06), focal: r(1.3, 1.8), frame: r(0.4, 0.55) }),
  tilted: r => ({ pitch: r(0.55, 1.0), roll: (r(0, 1) < 0.5 ? -1 : 1) * r(0.2, 0.36), focal: r(1.8, 2.8), frame: r(0.45, 0.65) }),
};
// it keeps swinging between looking down and looking out to the horizon
const NEXT = { top: ['mid', 'low', 'tilted'], high: ['low', 'tilted'], mid: ['top', 'low'], low: ['top', 'high', 'mid'], tilted: ['top', 'high', 'low'] };
const FLY = r => ({ pitch: r(-0.05, 0.3), roll: r(-0.5, 0.5), focal: r(0.9, 1.4), frame: 0.6 });
const OBJECT = r => ({ pitch: r(0, 0.85), roll: r(-0.12, 0.12), focal: r(2.6, 4), frame: r(0.55, 0.8) });

export class Director {
  constructor() {
    this.mix = 0;                        // 0 = the look's own camera, 1 = the director's
    this.base = null;                    // where the current move is (from → to)
    this.from = null; this.to = null;
    this.t = 1; this.dur = 1;
    this.extra = { yaw: 0, tx: 0, ty: 0 };   // the slow drift on top
    this.drift = { yaw: 0.03, tx: 0, ty: 0 };
    this.kind = 'top';
    this.nextBar = 0;
    this.shots = 0;
  }

  // is a new shot due? (main can change the look first, so the shot suits it)
  due(m, cfg) { return cfg.on && this.base && m.bar >= this.nextBar; }

  // v: this frame's values (the look's camera); group: the look's group; m: music; cfg: { on, pace }
  update(dt, v, group, m, cfg) {
    this.mix += ((cfg.on ? 1 : 0) - this.mix) * (1 - Math.exp(-dt * 0.9));
    if (!this.base || this.mix < 0.002) {
      // follow the look while off, so switching on starts from exactly what you see
      this.base = Object.fromEntries(KEYS.map(k => [k, v[k]]));
      this.from = this.to = null;
      this.extra = { yaw: 0, tx: 0, ty: 0 };
      this.nextBar = Math.ceil(m.bar);
      if (!cfg.on) return;
    }
    if (this.due(m, cfg)) this.shot(v, group, m, cfg);
    this.t += dt;
    if (this.from) {
      const k = smooth(Math.min(1, this.t / this.dur));
      for (const key of KEYS) this.base[key] = lerp(this.from[key], this.to[key], k);
    }
    const pace = 0.5 + cfg.pace * 1.5;
    this.extra.yaw += this.drift.yaw * pace * dt;
    this.extra.tx += this.drift.tx * pace * dt;
    this.extra.ty += this.drift.ty * pace * dt;
  }

  shot(v, group, m, cfg) {
    const r = (a, b) => a + Math.random() * (b - a);
    const now = this.current();
    let to;
    if (group === 'fly') to = FLY(r);
    else if (group === 'dark') to = OBJECT(r);
    else {
      const opts = NEXT[this.kind] || ['top'];
      this.kind = opts[Math.floor(Math.random() * opts.length)];
      to = PLANAR[this.kind](r);
    }
    to.yaw = now.yaw + r(-1.2, 1.2);
    const pan = group === 'fly' ? 0 : 0.45;
    to.tx = v.tx + r(-pan, pan) * to.frame;
    to.ty = v.ty + r(-pan, pan) * to.frame * 0.7;
    this.from = now;
    this.to = to;
    this.base = { ...now };
    this.extra = { yaw: 0, tx: 0, ty: 0 };
    const a = Math.random() * Math.PI * 2;
    this.drift = { yaw: r(0.015, 0.05) * (Math.random() < 0.5 ? -1 : 1), tx: Math.cos(a) * 0.03 * to.frame, ty: Math.sin(a) * 0.03 * to.frame };
    // a shot lasts 16 bars (slow) to 4 (fast); most of it is the glide
    const bars = Math.round(lerp(16, 4, cfg.pace));
    this.t = 0;
    this.dur = bars * m.barLen * 0.65;
    this.nextBar = Math.floor(m.bar) + bars;
    this.shots++;
  }

  current() {
    const c = { ...this.base };
    c.yaw += this.extra.yaw; c.tx += this.extra.tx; c.ty += this.extra.ty;
    return c;
  }

  get shotSeconds() { return this.dur; }

  apply(v) {
    if (this.mix < 0.002 || !this.base) return;
    const c = this.current();
    for (const k of KEYS) v[k] = lerp(v[k], c[k], this.mix);
  }
}
