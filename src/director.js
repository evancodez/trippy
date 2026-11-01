// The director plays a "show": a list of scenes laid against a song's clock.
// Every frame it works out which scene(s) are on screen, resets each one to its base look,
// applies music-driven modulation (loudness → intensity, bar-locked sway, onsets), and runs the
// scene's own update(). Everything is a pure function of song time, so seeking just works.
import { makeState, cloneState } from './state.js';
import { sample } from './analysis.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// copy every plain value from base onto the working state (warp phases survive)
function resetFrom(base, s) {
  for (const k in base) {
    const v = base[k];
    if (k === 'warps') {
      v.forEach((w, i) => { const t = s.warps[i]; for (const f in w) t[f] = w[f]; });
    } else if (Array.isArray(v)) s[k] = v.slice();
    else s[k] = v;
  }
}

const POST_KEYS = ['grain', 'vignette', 'glow', 'aberr', 'flicker', 'weave', 'letterbox'];

export class Director {
  // show = { title, bpm, offset (first beat, s), beatsPerBar, downbeat (0 or 1), scenes: [...] }
  // scene = { at, name, story, how, look, in: { type, beats|dur, lead }, react, update(s, c) }
  constructor(show, analysis) {
    this.show = show;
    this.A = analysis;
    this.beatLen = 60 / show.bpm;
    this.barLen = this.beatLen * (show.beatsPerBar || 2);
    this.barZero = show.offset + (show.downbeat || 0) * this.beatLen;
    this.duration = analysis.duration;
    this.scenes = [...show.scenes].sort((a, b) => a.at - b.at);
    this.scenes.forEach((sc, i) => {
      const tin = sc.in || { type: 'cut' };
      const dur = tin.type === 'cut' ? 0 : tin.dur ?? (tin.beats ?? 4) * this.beatLen;
      const lead = tin.lead ?? (tin.type === 'flash' || tin.type === 'cut' ? 0.5 : 0.15);
      sc._tIn = i === 0 ? 0 : sc.at - dur * lead;
      sc._dur = i === 0 ? 0 : dur;
      sc._type = tin.type;
      sc._flash = tin.color || '#ffffff';
    });
    this.scenes.forEach((sc, i) => { sc._end = this.scenes[i + 1] ? this.scenes[i + 1]._tIn + this.scenes[i + 1]._dur : this.duration + 1; });
    this.live = new Map();
    this.nextSlot = 0;
    this.lastT = -1;
    this.hits = this.findHits();
    this.hitIdx = 0;
    this.onNewSlot = () => {};
  }

  // onset peaks (strong attacks) as [{t, v}], used for ripples, flashes, glitches
  findHits() {
    const on = this.A.onset, fps = this.A.fps, out = [];
    for (let i = 2; i < on.length - 2; i++) {
      if (on[i] > 0.35 && on[i] >= on[i - 1] && on[i] >= on[i + 1] && on[i] >= on[i - 2] && on[i] >= on[i + 2]) {
        if (!out.length || i / fps - out[out.length - 1].t > 0.12) out.push({ t: i / fps, v: on[i] });
      }
    }
    return out;
  }

  sceneAt(t) {
    let i = 0;
    while (i + 1 < this.scenes.length && this.scenes[i + 1].at <= t) i++;
    return i;
  }

  instance(i) {
    if (!this.live.has(i)) {
      const sc = this.scenes[i];
      const state = makeState(sc.look || {});
      const inst = { i, sc, state, base: cloneState(state), slot: this.nextSlot, rt: {} };
      this.nextSlot = 1 - this.nextSlot;
      this.onNewSlot(inst.slot);
      this.live.set(i, inst);
    }
    return this.live.get(i);
  }

  context(t, inst, frameHit) {
    const sc = inst.sc, A = this.A;
    const end = this.scenes[inst.i + 1]?.at ?? this.duration;
    const st = t - sc.at, dur = Math.max(0.001, end - sc.at);
    const beat = (t - this.show.offset) / this.beatLen;
    const bar = (t - this.barZero) / this.barLen;
    const c = {
      t, st, dur, u: clamp(st / dur, 0, 1),
      beat, bar, barLen: this.barLen, beatLen: this.beatLen,
      beatPh: beat - Math.floor(beat), barPh: bar - Math.floor(bar),
      sway: Math.sin(bar * Math.PI * 2),          // one full rock per bar (in 6/8: left on 1, right on 2)
      sway2: Math.sin(bar * Math.PI),             // one rock every two bars
      loud: sample(A.rms, t), slow: sample(A.slow, t),
      bass: sample(A.bass, t), mid: sample(A.mid, t), high: sample(A.high, t),
      onset: sample(A.onset, t), bright: sample(A.centroid, t),
      hit: frameHit,
      ramp: (a, b) => smooth(a, b, st),          // 0→1 between a and b seconds into the scene
      rampBars: (a, b) => smooth(a * this.barLen, b * this.barLen, st),
      rampU: (a, b) => smooth(a, b, st / dur),
      rt: inst.rt,
      ripple: (x, y, s) => this.spawn?.(x, y, s),
    };
    // a decaying "tick" on each eighth note (three per beat in 6/8)
    const sub = beat * 3;
    c.tick = Math.exp(-(sub - Math.floor(sub)) * 5);
    c.downbeat = Math.exp(-c.barPh * 6);
    return c;
  }

  // Build the per-frame result. `base` is the app's shared rt (ripples, mouse, brush, audio…).
  frame(t, base) {
    // onset hits that happened since last frame (only while playing forward)
    let frameHit = 0;
    if (t < this.lastT || t - this.lastT > 0.5) this.hitIdx = this.hits.findIndex(h => h.t >= t);
    if (this.hitIdx < 0) this.hitIdx = this.hits.length;
    while (this.hitIdx < this.hits.length && this.hits[this.hitIdx].t <= t) frameHit = Math.max(frameHit, this.hits[this.hitIdx++].v);
    this.lastT = t;

    // every scene is visible from the start of its own transition until the next one's finishes
    const i = this.sceneAt(t);
    const vis = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(this.scenes.length - 1, i + 2); j++) {
      const sc = this.scenes[j];
      if (t >= sc._tIn && t < sc._end) vis.push(j);
    }
    const uniq = vis.length ? vis.slice(-2) : [i];
    for (const k of [...this.live.keys()]) if (!uniq.includes(k)) this.live.delete(k);

    const layers = uniq.map(k => this.step(this.instance(k), t, base, frameHit));
    if (layers.length === 1) {
      return { a: layers[0], b: null, mix: 0, transition: 'dissolve', post: this.post(layers[0].state), scene: this.scenes[uniq[0]], index: uniq[0] };
    }
    const into = this.scenes[uniq[1]];
    const m = into._dur > 0 ? clamp((t - into._tIn) / into._dur, 0, 1) : 1;
    const mix = into._type === 'dissolve' || into._type === 'ink' ? easeInOut(m) : m;
    const pa = this.post(layers[0].state), pb = this.post(layers[1].state), post = {};
    for (const k of POST_KEYS) post[k] = pa[k] + (pb[k] - pa[k]) * mix;
    post.glowColor = mix < 0.5 ? pa.glowColor : pb.glowColor;
    return { a: layers[0], b: layers[1], mix, transition: into._type, flash: into._flash, post, scene: into, index: uniq[1] };
  }

  post(s) {
    const p = {};
    for (const k of POST_KEYS) p[k] = s[k] ?? 0;
    p.glowColor = s.glowColor;
    return p;
  }

  step(inst, t, base, frameHit) {
    const { state: s, base: b, sc } = inst;
    resetFrom(b, s);
    const st = t - sc.at;
    s.warps.forEach(w => { w._ph = st * w.speed; });
    const c = this.context(t, inst, frameHit);
    const rt = Object.assign(inst.rt, base);
    const react = sc.react ?? 0.7;
    rt.time = t;
    rt.phase = st * s.flow;
    rt.phase2 = st * s.mixFlow;
    rt.spin = st * s.spin * 0.6;
    rt.cycle = st * s.cycle;
    rt.fade = 0;
    rt.center = [0, 0];
    rt.intensity = clamp(1 + (c.loud - 0.5) * react * 1.6, 0.2, 2.2);
    rt.pulse = 0;
    rt.wobble = 0;
    rt.face = { mouth: clamp(c.mid * 1.1 - 0.15, 0, 1), eyes: 1 };
    rt.audio = { bass: c.bass, mid: c.mid, high: c.high, level: c.loud };
    sc.update?.(s, c);
    return { state: s, rt, slot: inst.slot };
  }
}
