// Listening to a whole song, once, when it's loaded. Not just when the drums hit: what the tune is doing.
//   · harmonic / percussive separation (median filtering the spectrogram), so sustained sound and drums
//     become two separate signals, and the drums can stop shouting over everything
//   · the melody: the strongest continuous pitch through the song, tracked finely enough to follow a slide
//     guitar through every bend (peaks of a long FFT → harmonic salience → a Viterbi path that prefers to
//     move smoothly); its height, how sure it is, how fast it's gliding
//   · harmony: chroma, the chord, the key
//   · beats that follow the song (dynamic programming), bars, and sections with a character each
// Pure maths on a Float32Array (mono, 22050 Hz); no DOM, so it runs in a worker (listen.worker.js).

export const SR = 22050;
const HOP = 512;
export const FPS = SR / HOP;       // ≈ 43 frames a second: every curve here is sampled at this rate

// ---------------------------------------------------------------- small tools
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
const hann = n => Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

// centred box smooth, r frames either side (repeat for a softer curve)
function smooth(a, r, passes = 1) {
  r = Math.max(1, Math.round(r));
  let src = a;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(src.length);
    let sum = 0, n = 0;
    for (let i = 0; i < src.length + r; i++) {
      if (i < src.length) { sum += src[i]; n++; }
      if (i - 2 * r - 1 >= 0) { sum -= src[i - 2 * r - 1]; n--; }
      if (i - r >= 0 && i - r < src.length) out[i - r] = sum / n;
    }
    src = out;
  }
  return src;
}
// scale to 0..1 between the quiet end and nearly the loudest, so one snare can't flatten the whole song
function norm(a, lo = 0.05, hi = 0.98) {
  const s = Float32Array.from(a).sort(), l = s[Math.floor(s.length * lo)] || 0, h = s[Math.floor(s.length * hi)] || 1;
  const out = new Float32Array(a.length), k = 1 / Math.max(h - l, 1e-9);
  for (let i = 0; i < a.length; i++) out[i] = Math.min(1, Math.max(0, (a[i] - l) * k));
  return out;
}
const pct = (a, p) => { const s = Float32Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * p))] || 0; };
const mean = a => { let s = 0; for (const x of a) s += x; return s / Math.max(a.length, 1); };
const yieldNow = () => new Promise(r => setTimeout(r, 0));

// a cheap median of a small window (the array is scratch)
function med(buf, n) {
  for (let i = 1; i < n; i++) { const x = buf[i]; let j = i - 1; while (j >= 0 && buf[j] > x) { buf[j + 1] = buf[j]; j--; } buf[j + 1] = x; }
  return buf[n >> 1];
}

// ---------------------------------------------------------------- 1. sustained sound and drums, apart
const BANDS = 64;
function bandEdges(win) {
  const mel = f => 2595 * Math.log10(1 + f / 700), inv = m => 700 * (Math.pow(10, m / 2595) - 1);
  const lo = mel(30), hi = mel(10500), hz = SR / win, e = [];
  for (let b = 0; b <= BANDS; b++) e.push(Math.max(1, Math.round(inv(lo + (hi - lo) * b / BANDS) / hz)));
  for (let b = 1; b <= BANDS; b++) if (e[b] <= e[b - 1]) e[b] = e[b - 1] + 1;
  return e;
}
async function separate(samples, tick) {
  const WIN = 1024, frames = Math.max(1, Math.floor((samples.length - WIN) / HOP) + 1), w = hann(WIN);
  const re = new Float32Array(WIN), im = new Float32Array(WIN), edges = bandEdges(WIN);
  const E = new Float32Array(frames * BANDS);
  const rms = new Float32Array(frames), centroid = new Float32Array(frames), flux = new Float32Array(frames);
  const prev = new Float32Array(WIN / 2);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    let e = 0;
    for (let i = 0; i < WIN; i++) { const s = samples[o + i]; e += s * s; re[i] = s * w[i]; im[i] = 0; }
    rms[f] = Math.sqrt(e / WIN);
    fft(re, im);
    let num = 0, den = 0, fl = 0;
    for (let k = 1; k < WIN / 2; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      num += k * m; den += m;
      const l = Math.log1p(m * 8), dl = l - prev[k];
      if (dl > 0) fl += dl;
      prev[k] = l;
      re[k] = m;
    }
    flux[f] = fl;
    centroid[f] = den > 0 ? (num / den) * (SR / WIN) : 0;
    for (let b = 0; b < BANDS; b++) {
      let s = 0;
      for (let k = edges[b]; k < edges[b + 1] && k < WIN / 2; k++) s += re[k];
      E[f * BANDS + b] = s / Math.max(edges[b + 1] - edges[b], 1);
    }
    if (f % 1500 === 0) { tick(0.3 * f / frames); await yieldNow(); }
  }
  // along time, the median keeps what's sustained; across frequency, what's a broadband hit
  const HW = 8, PW = 4, buf = new Float32Array(32);
  const harm = new Float32Array(frames), perc = new Float32Array(frames), kick = new Float32Array(frames), snare = new Float32Array(frames), hat = new Float32Array(frames);
  const bass = new Float32Array(frames), mid = new Float32Array(frames), high = new Float32Array(frames);
  const hzOf = b => (edges[b] + edges[b + 1]) * 0.5 * (SR / WIN);
  for (let f = 0; f < frames; f++) {
    for (let b = 0; b < BANDS; b++) {
      const x = E[f * BANDS + b];
      let n = 0;
      for (let t = Math.max(0, f - HW); t <= Math.min(frames - 1, f + HW); t++) buf[n++] = E[t * BANDS + b];
      const H = med(buf, n);
      n = 0;
      for (let q = Math.max(0, b - PW); q <= Math.min(BANDS - 1, b + PW); q++) buf[n++] = E[f * BANDS + q];
      const P = med(buf, n);
      const h2 = H * H, p2 = P * P, mask = h2 / Math.max(h2 + p2, 1e-12);
      const hx = x * mask, px = x * (1 - mask), hz = hzOf(b);
      harm[f] += hx; perc[f] += px;
      if (hz < 150) { kick[f] += px; bass[f] += x; }
      else if (hz < 5000) { snare[f] += px; if (hz > 300 && hz < 3000) mid[f] += x; }
      else { hat[f] += px; high[f] += x; }
    }
    if (f % 2000 === 0) { tick(0.3 + 0.12 * f / frames); await yieldNow(); }
  }
  return { frames, rms, centroid, flux, harm, perc, kick, snare, hat, bass, mid, high, E };
}

// ---------------------------------------------------------------- 2. the melody
const PMIN = 45, SEMI = 5, STATES = 48 * SEMI;      // MIDI 45 (110 Hz) up four octaves, a fifth of a semitone apart
const midiToState = m => (m - PMIN) * SEMI;

async function melody(samples, frames, tick) {
  // a long window at half the rate: 186 ms, 5.4 Hz a bin. A slide needs the resolution far more than the speed.
  const N = 2048, SR2 = SR / 2, half = Math.floor(samples.length / 2), low = new Float32Array(half);
  for (let i = 0; i < half; i++) low[i] = (samples[i * 2] + samples[i * 2 + 1]) * 0.5;
  const w = hann(N), re = new Float32Array(N), im = new Float32Array(N), hz = SR2 / N;
  const maxBin = Math.min(N / 2 - 2, Math.floor(3400 / hz)), H2 = HOP / 2;
  const sal = new Float32Array(frames * STATES), peakSum = new Float32Array(frames), chroma = new Float32Array(frames * 12);
  const mag = new Float32Array(maxBin + 2);
  const prior = Float32Array.from({ length: STATES }, (_, s) => { const m = PMIN + s / SEMI; return Math.exp(-0.5 * ((m - 68) / 17) ** 2); });
  const px = new Float32Array(24), pa = new Float32Array(24);
  for (let f = 0; f < frames; f++) {
    const o = f * H2 - N / 2 + H2;                                      // centred on this frame
    for (let i = 0; i < N; i++) { const j = o + i; re[i] = (j >= 0 && j < half ? low[j] : 0) * w[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= maxBin + 1; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    // peaks: real tones stand above their neighbours, a drum hit doesn't. Keep the 24 strongest.
    let np = 0, floor = 0;
    for (let k = 4; k <= maxBin; k++) floor += mag[k];
    floor = (floor / maxBin) * 1.4;
    for (let k = 4; k <= maxBin; k++) {
      const m = mag[k];
      if (m > floor && m >= mag[k - 1] && m > mag[k + 1] && m > mag[k - 2] * 1.05 && m > mag[k + 2] * 1.05) {
        const la = Math.log(mag[k - 1] + 1e-6), lb = Math.log(m + 1e-6), lc = Math.log(mag[k + 1] + 1e-6);
        const dk = 0.5 * (la - lc) / (la - 2 * lb + lc || 1), fr = (k + dk) * hz;
        if (np < 24) { px[np] = fr; pa[np] = m; np++; }
        else { let mi = 0; for (let q = 1; q < 24; q++) if (pa[q] < pa[mi]) mi = q; if (m > pa[mi]) { px[mi] = fr; pa[mi] = m; } }
      }
    }
    const base = f * STATES;
    let sum = 0;
    for (let i = 0; i < np; i++) {
      const a = Math.pow(pa[i], 0.7);
      sum += a;
      const midi = 69 + 12 * Math.log2(px[i] / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      if (midi > 40 && midi < 100) chroma[f * 12 + pc] += a;
      for (let h = 1; h <= 7; h++) {                                    // this partial might be harmonic h of something
        const m0 = midi - 12 * Math.log2(h), x = (m0 - PMIN) * SEMI, c = Math.round(x);
        if (c < 1 || c >= STATES - 1) continue;
        const wh = a * Math.pow(0.78, h - 1), d = x - c;
        sal[base + c] += wh * (1 - 0.5 * d * d);
        sal[base + c - 1] += wh * 0.42;
        sal[base + c + 1] += wh * 0.42;
      }
    }
    peakSum[f] = sum;
    for (let s = 0; s < STATES; s++) sal[base + s] *= prior[s];
    if (f % 1200 === 0) { tick(0.42 + 0.33 * f / frames); await yieldNow(); }
  }
  // normalise each frame against a slowly moving ceiling: quiet verses still count
  const best = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let m = 0; for (let s = 0; s < STATES; s++) { const v = sal[f * STATES + s]; if (v > m) m = v; } best[f] = m; }
  const ceil = smooth(best, FPS * 2, 2);
  for (let f = 0; f < frames; f++) { const k = 1 / Math.max(Math.max(best[f], ceil[f]), 1e-6); for (let s = 0; s < STATES; s++) sal[f * STATES + s] *= k; }

  // the path: stay on the pitch you're on, glide to one nearby almost for free, jump if it's worth it.
  const WINDOW = 14, JUMP = 2.6, STEP = 0.022;
  let score = new Float32Array(STATES), next = new Float32Array(STATES);
  const back = new Int16Array(frames * STATES);
  for (let f = 0; f < frames; f++) {
    let bi = 0, bv = -Infinity;
    for (let s = 0; s < STATES; s++) if (score[s] > bv) { bv = score[s]; bi = s; }
    const row = f * STATES;
    for (let s = 0; s < STATES; s++) {
      let v = bv - JUMP, from = bi;
      const a = Math.max(0, s - WINDOW), b = Math.min(STATES - 1, s + WINDOW);
      for (let q = a; q <= b; q++) { const c = score[q] - STEP * Math.abs(q - s); if (c > v) { v = c; from = q; } }
      next[s] = v + sal[row + s];
      back[row + s] = from;
    }
    [score, next] = [next, score];
    let mn = Infinity;
    for (let s = 0; s < STATES; s++) if (score[s] < mn) mn = score[s];
    for (let s = 0; s < STATES; s++) score[s] -= mn;
    if (f % 2000 === 0) { tick(0.75 + 0.1 * f / frames); await yieldNow(); }
  }
  let s = 0;
  for (let q = 1; q < STATES; q++) if (score[q] > score[s]) s = q;
  const path = new Int16Array(frames);
  for (let f = frames - 1; f >= 0; f--) { path[f] = s; s = back[f * STATES + s]; }
  // sub-state pitch (centroid of the salience round the path) and how sure it is
  const raw = new Float32Array(frames), conf = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const c = path[f], row = f * STATES;
    let num = 0, den = 0;
    for (let q = Math.max(0, c - 2); q <= Math.min(STATES - 1, c + 2); q++) { num += q * sal[row + q]; den += sal[row + q]; }
    raw[f] = PMIN + (den > 0 ? num / den : c) / SEMI;
    conf[f] = sal[row + c];
  }
  return { raw, conf, chroma, peakSum };
}

// ---------------------------------------------------------------- 3. harmony
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function harmony(chroma, frames) {
  const STEP = 4, n = Math.floor(frames / STEP);                        // about 11 a second
  const C = new Float32Array(n * 12);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < STEP * 3; k++) { const f = Math.min(frames - 1, Math.max(0, i * STEP + k - STEP)); for (let p = 0; p < 12; p++) C[i * 12 + p] += chroma[f * 12 + p]; }
    let m = 0; for (let p = 0; p < 12; p++) m = Math.max(m, C[i * 12 + p]);
    if (m > 0) for (let p = 0; p < 12; p++) C[i * 12 + p] /= m;
  }
  // the key
  const total = new Float32Array(12);
  for (let i = 0; i < n * 12; i++) total[i % 12] += C[i];
  let key = 0, minor = false, bk = -Infinity;
  for (let r = 0; r < 12; r++) for (const [prof, isMin] of [[MAJ, false], [MIN, true]]) {
    let s = 0; for (let p = 0; p < 12; p++) s += total[(p + r) % 12] * prof[p];
    if (s > bk) { bk = s; key = r; minor = isMin; }
  }
  // the chord: 24 triads, smoothed by a penalty for changing
  const T = [];
  for (let r = 0; r < 12; r++) for (let q = 0; q < 2; q++) T.push([r, (r + (q ? 3 : 4)) % 12, (r + 7) % 12]);
  let score = new Float32Array(24), next = new Float32Array(24);
  const back = new Uint8Array(n * 24), PEN = 2.2;
  for (let i = 0; i < n; i++) {
    let bi = 0; for (let t = 1; t < 24; t++) if (score[t] > score[bi]) bi = t;
    for (let t = 0; t < 24; t++) {
      const [a, b, c] = T[t];
      const obs = C[i * 12 + a] * 1.15 + C[i * 12 + b] + C[i * 12 + c];
      const stay = score[t], jump = score[bi] - PEN;
      next[t] = (stay >= jump ? stay : jump) + obs;
      back[i * 24 + t] = stay >= jump ? t : bi;
    }
    [score, next] = [next, score];
    const mn = Math.min(...score);
    for (let t = 0; t < 24; t++) score[t] -= mn;
  }
  let s = 0; for (let t = 1; t < 24; t++) if (score[t] > score[s]) s = t;
  const chord = new Uint8Array(n);
  for (let i = n - 1; i >= 0; i--) { chord[i] = s; s = back[i * 24 + s]; }
  return { C, chord, key, minor, step: STEP };
}

// ---------------------------------------------------------------- 4. beats
function tempoOf(onset) {
  const x = smooth(onset, 1), m = mean(x);
  for (let i = 0; i < x.length; i++) x[i] -= m;
  const minLag = Math.floor((60 / 200) * FPS), maxLag = Math.ceil((60 / 45) * FPS);
  let best = 0, bl = minLag;
  const ac = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i += 2) s += x[i] * x[i + lag];
    ac[lag] = s;
  }
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    const bpm = 60 * FPS / lag;
    const pr = Math.exp(-0.5 * (Math.log2(bpm / 105) / 0.95) ** 2);      // people tap near 100, and not at 200
    if (ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) {
      const v = (ac[lag] + 0.5 * ac[Math.min(maxLag, lag * 2)]) * pr;
      if (v > best) { best = v; bl = lag; }
    }
  }
  const a = ac[bl - 1], b = ac[bl], c = ac[bl + 1];
  return bl + 0.5 * (a - c) / (a - 2 * b + c || 1);
}
// Ellis's dynamic-programming tracker: each beat wants an onset under it and the last beat one period ago
function trackBeats(onset, period) {
  const n = onset.length, C = new Float32Array(n), B = new Int32Array(n).fill(-1), TIGHT = 80;
  const lo = Math.round(period * 0.6), hi = Math.round(period * 1.6);
  for (let t = 0; t < n; t++) {
    let bv = -Infinity, bp = -1;
    for (let p = Math.max(0, t - hi); p <= t - lo; p++) {
      const lg = Math.log((t - p) / period), v = C[p] - TIGHT * lg * lg * 0.08;
      if (v > bv) { bv = v; bp = p; }
    }
    C[t] = onset[t] + (bp >= 0 ? Math.max(bv, 0) : 0);
    B[t] = bv > 0 ? bp : -1;
  }
  let t = n - 1, mx = -1;
  for (let i = Math.max(0, n - Math.round(period * 2)); i < n; i++) if (C[i] > mx) { mx = C[i]; t = i; }
  const beats = [];
  for (; t >= 0; t = B[t]) beats.push(t / FPS);
  return Float32Array.from(beats.reverse());
}

// ---------------------------------------------------------------- 5. sections
// A section ends where the music stops resembling itself: a checkerboard kernel slid along the diagonal of
// its self-similarity matrix. Features at 2 Hz: chroma, timbre, energy, how drummy it is.
function sectionBounds(F, dims, n, duration) {
  const unit = new Float32Array(n * dims);
  for (let i = 0; i < n; i++) {
    let m = 0; for (let d = 0; d < dims; d++) m += F[i * dims + d] ** 2;
    m = Math.sqrt(m) || 1;
    for (let d = 0; d < dims; d++) unit[i * dims + d] = F[i * dims + d] / m;
  }
  const sim = (a, b) => { let s = 0; for (let d = 0; d < dims; d++) s += unit[a * dims + d] * unit[b * dims + d]; return s; };
  const W = 14, nov = new Float32Array(n);
  for (let c = W; c < n - W; c++) {
    let s = 0;
    for (let i = 1; i <= W; i++) for (let j = 1; j <= W; j += 2) {
      s += sim(c - i, c - j) + sim(c + i - 1, c + j - 1) - sim(c - i, c + j - 1) - sim(c + i - 1, c - j);
    }
    nov[c] = s;
  }
  const nv = smooth(nov, 2, 2), top = pct(nv, 0.9), res = [];
  const peaks = [];
  for (let i = 2; i < n - 2; i++) if (nv[i] > nv[i - 1] && nv[i] >= nv[i + 1] && nv[i] > top * 0.45) peaks.push([i, nv[i]]);
  peaks.sort((a, b) => b[1] - a[1]);
  const gap = 18, maxN = Math.max(3, Math.round(duration / 22));          // at 2 Hz: at least 9 s apart
  for (const [i] of peaks) {
    if (res.length >= maxN) break;
    if (res.every(r => Math.abs(r - i) >= gap)) res.push(i);
  }
  return { times: res.sort((a, b) => a - b).map(i => i / 2), nov: nv };
}

// ---------------------------------------------------------------- all of it
export async function listen(samples, onProgress = () => {}) {
  const duration = samples.length / SR;
  const S = await separate(samples, onProgress), frames = S.frames;
  const M = await melody(samples, frames, onProgress);
  onProgress(0.85);
  await yieldNow();
  const Hm = harmony(M.chroma, frames);
  onProgress(0.88);
  await yieldNow();

  const dbNorm = a => norm(a.map(x => Math.log1p(x * 30)));
  const loud = norm(smooth(S.rms, FPS * 0.12, 2));
  const harm = dbNorm(smooth(S.harm, 3, 2)), perc = dbNorm(smooth(S.perc, 1));
  const kick = norm(smooth(S.kick, 1), 0.1, 0.995), snare = norm(smooth(S.snare, 1), 0.1, 0.995), hat = norm(smooth(S.hat, 1), 0.1, 0.995);
  const bright = norm(smooth(S.centroid, FPS * 0.4));
  const arc = norm(smooth(S.rms, FPS * 3, 2));                            // the song's long shape

  // the melody: how sure, its height, its speed. Short drop-outs don't count: a held note carries through a hit.
  const presence = norm(smooth(M.peakSum, FPS * 0.15, 2), 0.1, 0.98);
  const conf = new Float32Array(frames);
  for (let i = 0; i < frames; i++) conf[i] = Math.min(1, M.conf[i] * 1.15) * Math.min(1, presence[i] * 1.6);
  const voiced = smooth(Float32Array.from(conf, x => (x > 0.26 ? 1 : 0)), FPS * 0.09, 2);
  const med5 = new Float32Array(frames), buf = new Float32Array(5);
  for (let i = 0; i < frames; i++) { let n = 0; for (let k = -2; k <= 2; k++) buf[n++] = M.raw[Math.min(frames - 1, Math.max(0, i + k))]; med5[i] = med(buf, 5); }
  const pitch = smooth(med5, 2, 2);                                        // about 100 ms
  const glide = new Float32Array(frames), noteOn = [];
  const span = 2;
  for (let i = 0; i < frames; i++) {
    const a = pitch[Math.max(0, i - span)], b = pitch[Math.min(frames - 1, i + span)];
    const d = (b - a) * FPS / (span * 2);                                  // semitones a second
    glide[i] = voiced[i] * (Math.abs(d) > 70 ? 0 : d);                     // that fast is a new note, not a slide
    if (i > 0 && voiced[i] > 0.4 && (Math.abs(med5[i] - med5[i - 1]) > 0.8 || voiced[i - 1] <= 0.4)) {
      if (!noteOn.length || i / FPS - noteOn[noteOn.length - 1] > 0.09) noteOn.push(i / FPS);
    }
  }
  // the song's own range: its 5th to 95th percentile is the height the picture moves through
  const pv = []; for (let i = 0; i < frames; i += 2) if (voiced[i] > 0.5) pv.push(pitch[i]);
  const pLow = pv.length ? pct(pv, 0.05) : 57, pHigh = pv.length ? pct(pv, 0.95) : 76, pMid = pv.length ? pct(pv, 0.5) : 66;
  // -1 .. 1: mostly how high this is for the passage it's in (so a passage that sits high still sways), partly for the song
  const held = new Float32Array(frames);
  let hp = pMid;
  for (let i = 0; i < frames; i++) { if (voiced[i] > 0.4) hp = pitch[i]; held[i] = hp; }
  const local = smooth(held, FPS * 3.5, 2);
  const height = new Float32Array(frames);
  let last = 0;
  const halfR = Math.max((pHigh - pLow) * 0.5, 2);
  for (let i = 0; i < frames; i++) {
    const h = Math.max(-1.25, Math.min(1.25, 0.7 * (pitch[i] - local[i]) / Math.min(halfR, 5) + 0.3 * (pitch[i] - pMid) / halfR));
    last += ((voiced[i] > 0.3 ? h : last * 0.995) - last) * (voiced[i] > 0.3 ? 0.4 : 0.02);
    height[i] = last;
  }
  // the sway: the tune's height with the fuss taken out, a slow lean (about a second either side)
  const sway = smooth(height, FPS * 0.5, 2);

  // tempo and beats, from onsets of drums and of new notes alike
  const fluxA = smooth(S.flux, FPS * 0.5), onset = new Float32Array(frames);
  for (let i = 0; i < frames; i++) onset[i] = Math.max(0, S.flux[i] - fluxA[i]);
  const on = norm(onset, 0.1, 0.99);
  let period = tempoOf(on);
  let bpm = 60 * FPS / period;
  while (bpm < 58) { bpm *= 2; period /= 2; }
  while (bpm > 165) { bpm /= 2; period *= 2; }
  const beats = trackBeats(on, period);
  onProgress(0.93);
  await yieldNow();

  // bars: which beat is the one? The one that lands on bass hits and chord changes.
  const chordAt = t => Hm.chord[Math.min(Hm.chord.length - 1, Math.floor(t * FPS / Hm.step))];
  const meter = 4;
  const dScore = new Float32Array(meter);
  for (let i = 1; i < beats.length; i++) {
    const f = Math.min(frames - 1, Math.round(beats[i] * FPS));
    dScore[i % meter] += kick[f] * 0.6 + (chordAt(beats[i] + 0.1) !== chordAt(beats[i - 1] + 0.1) ? 1.4 : 0);
  }
  let down = 0; for (let k = 1; k < meter; k++) if (dScore[k] > dScore[down]) down = k;

  // sections
  const N2 = Math.floor(duration * 2), DIMS = 12 + 8 + 4, F = new Float32Array(N2 * DIMS);
  const coarse = [0, 8, 16, 24, 32, 40, 48, 56];
  for (let i = 0; i < N2; i++) {
    const f0 = Math.floor(i / 2 * FPS), f1 = Math.min(frames, Math.floor((i + 1) / 2 * FPS)), cnt = Math.max(1, f1 - f0);
    const c0 = Math.min(Hm.chord.length - 1, Math.floor(f0 / Hm.step));
    for (let p = 0; p < 12; p++) F[i * DIMS + p] = Hm.C[c0 * 12 + p] * 0.7;
    for (let b = 0; b < 8; b++) { let s = 0; for (let f = f0; f < f1; f++) for (let q = 0; q < 8; q++) s += S.E[f * BANDS + coarse[b] + q]; F[i * DIMS + 12 + b] = Math.log1p(s / cnt * 40) * 0.5; }
    let e = 0, pr = 0, v = 0; for (let f = f0; f < f1; f++) { e += loud[f]; pr += perc[f]; v += voiced[f]; }
    F[i * DIMS + 20] = e / cnt * 2; F[i * DIMS + 21] = pr / cnt * 1.6; F[i * DIMS + 22] = v / cnt;
    F[i * DIMS + 23] = (local[Math.min(frames - 1, f0)] - pLow) / Math.max(pHigh - pLow, 2) * 1.8;     // what register the tune sits in
  }
  const B = sectionBounds(F, DIMS, N2, duration);
  // snap each boundary to the nearest downbeat
  const bars = []; for (let i = down; i < beats.length; i += meter) bars.push(beats[i]);
  const snap = t => { let b = t, bd = 1e9; for (const x of bars) { const d = Math.abs(x - t); if (d < bd) { bd = d; b = x; } } return bd < 3 ? b : t; };
  const edges = [0, ...B.times.map(snap), duration].filter((t, i, a) => i === 0 || t - a[i - 1] > 4);
  edges[edges.length - 1] = duration;

  const sectStats = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = Math.floor(edges[i] * FPS), b = Math.min(frames, Math.floor(edges[i + 1] * FPS));
    let e = 0, pr = 0, vc = 0, br = 0, sl = 0, gl = 0, hm = 0;
    for (let f = a; f < b; f++) {
      e += loud[f]; pr += perc[f]; vc += voiced[f]; br += bright[f]; hm += harm[f];
      const g = Math.abs(glide[f]);
      if (voiced[f] > 0.5 && g > 1.5 && g < 70) { sl += 1; gl += g; }
    }
    const n = Math.max(1, b - a);
    sectStats.push({ start: edges[i], end: edges[i + 1], energy: e / n, perc: pr / n, voiced: vc / n, bright: br / n, harm: hm / n, slide: sl / n, rise: arc[Math.min(frames - 1, b - 1)] - arc[a] });
  }
  const eMid = mean(sectStats.map(x => x.energy)), pMidS = mean(sectStats.map(x => x.perc)), slMid = mean(sectStats.map(x => x.slide));
  for (const X of sectStats) {
    X.kind = X.energy < eMid * 0.62 ? 'hush'
      : X.slide > Math.max(slMid * 1.05, 0.12) && X.voiced > 0.45 ? 'flow'
        : X.rise > 0.22 ? 'swell'
          : X.energy > eMid * 1.12 && X.perc > pMidS ? 'peak'
            : X.perc > pMidS * 1.05 ? 'pulse' : 'flow';
  }
  onProgress(1);

  return {
    version: 3, duration, fps: FPS, frames,
    loud, arc, harm, perc, kick, snare, hat, bright,
    bass: norm(smooth(S.bass, 1), 0.1, 0.99), mid: norm(smooth(S.mid, 1), 0.1, 0.99), high: norm(smooth(S.high, 1), 0.1, 0.99),
    pitch, height, sway, voiced, glide, noteOn: Float32Array.from(noteOn),
    range: [pLow, pMid, pHigh],
    chroma: Hm.C, chord: Hm.chord, chordStep: Hm.step, key: Hm.key, minor: Hm.minor,
    bpm, beats, meter, down, sections: sectStats,
  };
}
