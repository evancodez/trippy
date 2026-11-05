// The marbling look, painted by the song: each kick drops a ring of ink on the water, each sung note a small
// one along the line of the tune, and every few bars a comb is drawn through it all. Everything already there
// gets pushed out of the way, so the picture is a record of the song so far, and nothing ever jumps: a drop
// grows from nothing, a comb goes through slowly. The shader traces each point back through the list.
const MAX = 32;
const frac = x => x - Math.floor(x);
const easeOut = a => 1 - (1 - a) ** 3;

export class Ink {
  constructor() {
    this.list = [];                    // oldest first
    this.color = 0;
    this.t = 0; this.wait = 0; this.combAt = 0;
    this.lastBar4 = -1;
  }

  add(x, y, size, grow, kind = 0, angle = 0) {
    const color = kind === 0 ? (this.color = 1 - this.color) : 0;
    this.list.push({ x, y, size, grow, kind, angle, color, age: 0, dying: 0 });
    if (this.list.length > MAX - 1) {
      const old = this.list.find(d => !d.dying);
      if (old) old.dying = 1e-3;       // the oldest closes up instead of vanishing
    }
    if (this.list.length > MAX) this.list.shift();
  }

  step(dt, m, v, rt) {
    if (v.sumi < 0.01) { this.list.length = 0; rt.dropN = 0; return; }
    const F = v.frame, c = Math.cos(v.frot), s = Math.sin(v.frot);
    const cx = c * v.tx - s * v.ty, cy = s * v.tx + c * v.ty;
    this.t += dt;
    if (!this.list.length) {           // never a blank page: some ink already on the water
      for (let i = 0; i < 24; i++) {   // a few places, ring on ring
        const site = i >> 2, a = site * 2.399 + 0.7, r = F * 1.05 * Math.sqrt((site + 0.35) / 6);
        this.add(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 0.85, F * (0.17 + 0.09 * frac(i * 0.618)), 1e-3);
        this.list[this.list.length - 1].age = 1;
      }
    }
    // where the big drops land wanders about the middle of the view
    if (this.t > (this.siteAt ?? 0)) {  // and stays a while, so the drops build up rings
      this.siteAt = this.t + 3.5 + 3 * frac(this.t * 0.73);
      this.sx = F * 0.95 * Math.sin(this.t * 1.91); this.sy = F * 0.6 * Math.sin(this.t * 2.67 + 1);
    }
    const sx = cx + this.sx, sy = cy + this.sy;
    if (m.on) {
      if (m.beat) {
        const k = Math.max(m.kick ?? 0, 0.25);
        if (k > 0.3 || frac(m.bar * 2) < 0.1) this.add(sx, sy, F * (0.13 + 0.22 * k), 0.8);
      }
      if (m.note && (m.voice ?? 0) > 0.2) {
        const across = 2 * frac(m.bar / 4) - 1;
        this.add(cx + across * F * 1.25, cy + (m.height ?? 0) * F * 0.62, F * (0.045 + 0.07 * m.voice), 0.45);
      }
      const b4 = Math.floor(m.bar / 4);
      if (b4 !== this.lastBar4) {      // every four bars, a comb through it
        this.lastBar4 = b4;
        this.add(cx, cy, F * 0.05, 2.2, 3, frac(this.t * 0.137));
      } else if ((m.slide ?? 0) > 0.6 && this.t > this.wait) {   // a sliding note drags a stroke
        this.wait = this.t + 1.6;
        this.add(sx, sy, F * 0.22 * (m.glide > 0 ? 1 : -1), 1.4, 1, frac(this.t * 0.31) * 1.4);
      }
    } else {
      if (this.t > this.wait) {
        this.wait = this.t + 0.7 + 0.8 * frac(this.t * 3.7);
        this.add(sx, sy, F * (0.1 + 0.14 * frac(this.t * 1.618)), 1.1);
      }
      if (this.t > this.combAt) { this.combAt = this.t + 14; this.add(cx, cy, F * 0.04, 3, 3, frac(this.t * 0.137)); }
    }
    // how far each has got
    const D = rt.drops;
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const d = this.list[i];
      d.age += dt;
      let z = d.size * easeOut(Math.min(d.age / d.grow, 1));
      if (d.dying) { d.dying += dt / 0.8; z *= Math.max(1 - d.dying, 0); }
      if (d.dying >= 1) { this.list.splice(i--, 1); continue; }
      D[n * 4] = d.x; D[n * 4 + 1] = d.y; D[n * 4 + 2] = z;
      D[n * 4 + 3] = d.kind === 0 ? d.color * 0.25 : d.kind === 1 ? 1 + d.angle : 3 + d.angle;
      n++;
    }
    rt.dropN = n;
  }
}
