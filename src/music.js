// What the music is doing right now, in one place, whatever it's coming from.
//   · a song that's been listened to (listen.js): read straight off the analysis at the playhead, so it's
//     exactly in time, even a little ahead of it
//   · a live input, or a song still being listened to: worked out as it comes (audio.js)
// Everything else asks this: the picture, the figures, the director.
export const MELODY_W = 512;
const MELODY_AGE = 5;                 // seconds of the tune's past across the melody row

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const at = (arr, x) => {
  const i = Math.floor(x);
  if (i < 0) return arr[0] || 0;
  if (i >= arr.length - 1) return arr[arr.length - 1] || 0;
  return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
};

export class Music {
  constructor() {
    this.an = null;                   // the analysis, when the song playing has one
    this.row = new Uint8Array(MELODY_W * 2).fill(128);     // two rows of the sound texture: the tune's curve, and the same taken slowly
    this.raw = new Float32Array(MELODY_W);
    this.tmp = new Float32Array(MELODY_W);
    this.liveRow = new Float32Array(MELODY_W);
    this.liveT = 0;
    this.bar = 0;
    this.hit = 0; this.kick = 0; this.snare = 0; this.hat = 0; this.glideS = 0; this.slide = 0; this.voice = 0;
    this.heightS = 0; this.swayS = 0; this.harmS = 0;
    this.noteI = 0; this.beatI = 0; this.lastT = -1;
    this.liveMid = 66; this.liveLast = 66;
    this.chord = 0;
    this.m = { on: false, beat: false, note: false, bar: 0, barLen: 2, loud: 0.5, bass: 0, mid: 0, high: 0, hit: 0, time: 0, harm: 0, perc: 0, kick: 0, snare: 0, hat: 0, voice: 0, height: 0, sway: 0, glide: 0, slide: 0, chord: 0, chordRoot: 0, swell: 0, tilt: 0, section: null, known: false };
  }

  setAnalysis(an) {
    this.an = an;
    this.noteI = 0; this.beatI = 0; this.lastT = -1;
  }

  // the curve into the texture: softened a little so a jump between notes doesn't cut a notch in every line,
  // and a lot for the second row (a long swell for the sheet to rise on)
  packRows() {
    const R = this.row, n = MELODY_W;
    const box = (src, dst, r) => {
      let s = 0, c = 0;
      for (let i = 0; i < n + r; i++) {
        if (i < n) { s += src[i]; c++; }
        if (i - 2 * r - 1 >= 0) { s -= src[i - 2 * r - 1]; c--; }
        if (i - r >= 0 && i - r < n) dst[i - r] = s / c;
      }
    };
    const a = this.tmp, b = this.tmp2 ||= new Float32Array(n), d = this.tmp3 ||= new Float32Array(n);
    box(this.raw, a, 7); box(a, b, 7);
    for (let i = 0; i < n; i++) R[i] = 128 + b[i] * 105;
    box(b, a, 34); box(a, d, 34);
    for (let i = 0; i < n; i++) R[n + i] = 128 + d[i] * 105;
  }

  // the section at time t
  sectionAt(t) {
    const S = this.an?.sections;
    if (!S) return null;
    for (const x of S) if (t < x.end) return x;
    return S[S.length - 1] || null;
  }

  // beat position at time t: how many beats in, with a fraction, from the song's own beats
  beatPos(t) {
    const B = this.an.beats;
    if (!B.length) return t * this.an.bpm / 60;
    if (t <= B[0]) return (t - B[0]) * this.an.bpm / 60;
    let lo = 0, hi = B.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (B[mid] <= t) lo = mid; else hi = mid; }
    if (t >= B[B.length - 1]) return B.length - 1 + (t - B[B.length - 1]) * this.an.bpm / 60;
    return lo + (t - B[lo]) / Math.max(B[lo + 1] - B[lo], 1e-3);
  }

  // one frame. a: the audio engine; tempo: { bpm, beatsPerBar }; drumDecay: how fast a drum's push lets go
  read(dt, time, a, tempo, paused, drumDecay = 7) {
    const m = this.m, an = this.an;
    const known = !!an && a.mode === 'file' && a.el;
    const on = a.mode !== 'off' && a.playing;
    const barLen = (60 / tempo.bpm) * tempo.beatsPerBar;
    m.on = on; m.time = time; m.barLen = barLen; m.known = known && on;
    m.beat = false; m.note = false;
    const up = (cur, x, rate) => cur + (x - cur) * (1 - Math.exp(-dt * rate));
    let kick = 0, snare = 0, hat = 0, harm = 0, perc = 0, voice = 0, height = 0, sway = 0, glide = 0;
    if (known) {
      // a little ahead of the playhead: what you see should land with what you hear, not after it
      const t = a.el.currentTime + (a.ctx?.outputLatency || a.ctx?.baseLatency || 0.02) * 0 + 0.015;
      const x = t * an.fps;
      harm = at(an.harm, x); perc = at(an.perc, x);
      kick = at(an.kick, x); snare = at(an.snare, x); hat = at(an.hat, x);
      voice = at(an.voiced, x) * (0.35 + 0.65 * harm);
      height = at(an.height, x); sway = at(an.sway, x); glide = at(an.glide, x);
      m.loud = on ? 0.55 * at(an.loud, x) + 0.45 * harm : 0.5;
      m.bass = on ? at(an.bass, x) : 0; m.mid = on ? at(an.mid, x) : 0; m.high = on ? at(an.high, x) : 0;
      m.swell = at(an.arc, x);
      const beats = this.beatPos(t);
      this.bar = (beats - an.down) / tempo.beatsPerBar;
      const wrapped = t < this.lastT - 0.2 || t > this.lastT + 1;              // it was moved
      if (wrapped) {
        this.noteI = lowerBound(an.noteOn, t);
        this.beatI = lowerBound(an.beats, t);
      }
      while (this.noteI < an.noteOn.length && an.noteOn[this.noteI] <= t) { m.note = on; this.noteI++; }
      while (this.beatI < an.beats.length && an.beats[this.beatI] <= t) { m.beat = on; this.beatI++; }
      this.lastT = t;
      m.section = this.sectionAt(t);
      const ci = clamp(Math.floor(t * an.fps / an.chordStep), 0, an.chord.length - 1);
      m.chord = an.chord[ci];
      // the tune's past, across a row of the sound texture: each sample how high it was, fading where nothing sang
      const R = this.raw, fps = an.fps, H = an.height, V = an.voiced;
      for (let j = 0; j < MELODY_W; j++) {
        const xx = (t - (j / (MELODY_W - 1)) * MELODY_AGE) * fps;
        R[j] = xx < 0 ? 0 : clamp(H[Math.min(H.length - 1, xx | 0)] * Math.min(1, V[Math.min(V.length - 1, xx | 0)] * 1.4), -1.15, 1.15);
      }
      this.packRows();
    } else {
      // live, or a song not yet worked out
      if (on) {
        harm = clamp(a.mid * 0.7 + a.bass * 0.3, 0, 1);
        perc = a.hitEnv ?? 0;
        kick = a.bass * (a.beat ? 1 : 0.5); snare = a.beat ? 0.6 : 0; hat = a.high;
        m.loud = a.level; m.bass = a.bass; m.mid = a.mid; m.high = a.high;
        m.beat = a.beat;
        const conf = a.pitchConf ?? 0, midi = a.pitchMidi ?? this.liveLast;
        voice = conf * clamp(a.level * 1.6, 0, 1);
        if (conf > 0.55) {
          this.liveMid += (midi - this.liveMid) * (1 - Math.exp(-dt * 0.35));
          const h = clamp((midi - this.liveMid) / 7, -1.2, 1.2);
          glide = clamp((midi - this.liveLast) / Math.max(dt, 1e-3), -60, 60);
          if (Math.abs(midi - this.liveLast) > 1.2) m.note = true;
          this.liveLast = midi;
          height = h;
        } else height = this.heightS * 0.98;
        sway = height;
      } else { m.loud = 0.5; m.bass = 0; m.mid = 0; m.high = 0; }
      m.section = null;
      if (!paused) this.bar += dt / barLen;
      m.swell = 0.4;
      // the row scrolls
      this.liveT += dt;
      const step = MELODY_AGE / MELODY_W;
      if (this.liveT >= step) {
        const n = Math.min(MELODY_W, Math.floor(this.liveT / step));
        this.liveT -= n * step;
        this.liveRow.copyWithin(n, 0, MELODY_W - n);
        for (let j = 0; j < n; j++) this.liveRow[j] = clamp(this.heightS * Math.min(1, voice * 2), -1.15, 1.15);
        this.raw.set(this.liveRow);
        this.packRows();
      }
    }
    if (!on) { harm = perc = kick = snare = hat = voice = glide = 0; height = sway = 0; }
    // drums: a push with a soft front, and a long way down: nothing here ever jumps
    const fall = Math.exp(-dt * drumDecay);
    this.kick = Math.max(this.kick * fall, up(this.kick, kick * kick, 60));
    this.snare = Math.max(this.snare * fall, up(this.snare, snare * snare, 60));
    this.hat = Math.max(this.hat * Math.exp(-dt * 12), up(this.hat, hat, 50));
    this.harmS = up(this.harmS, harm, 9);
    this.heightS = up(this.heightS, height, 16);
    this.swayS = up(this.swayS, sway, 5);
    this.voice = up(this.voice, voice, 10);
    const gn = clamp(glide / 22, -1, 1);
    this.glideS = up(this.glideS, gn, 9);
    this.slide = up(this.slide, Math.min(1, Math.abs(glide) / 14), Math.abs(glide) / 14 > this.slide ? 14 : 1.2);
    this.hit = m.beat ? 1 : this.hit * Math.exp(-dt * 7);
    Object.assign(m, {
      bar: this.bar, hit: this.hit, harm: this.harmS, perc, kick: this.kick, snare: this.snare, hat: this.hat,
      voice: this.voice, height: this.heightS, sway: this.swayS, glide: this.glideS, slide: this.slide,
      chordRoot: m.chord >> 1, tilt: this.swayS,
    });
    return m;
  }
}

function lowerBound(a, t) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < t) lo = mid + 1; else hi = mid; }
  return lo;
}
