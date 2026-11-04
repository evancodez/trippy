// The sound: a song, or a live input (a guitar through an audio interface, a mic) — and what the picture
// needs from it: smooth bass, mid, high and level values (0–1), beats and note onsets, a steady waveform
// (like an oscilloscope), the waveform's last couple of seconds, and the spectrum's last few seconds.
// A live input can be heard through the speakers (like an amp) and the output device can be chosen.
export const SOUND_W = 512, SOUND_ROWS = 64, WAVE_ROWS = 64;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.el = null;            // <audio> for songs
    this.source = null;
    this.micStream = null;
    this.recDest = null;       // lets recordings include the sound
    this.mode = 'off';         // 'off' | 'file' | 'mic' (any live input)
    this.name = '';
    // live input: which device, how loud into the analysis, and whether (and how loud) you hear it
    this.input = { deviceId: '', level: 1, monitor: false, volume: 0.8, outputId: '' };
    this.bass = 0; this.mid = 0; this.high = 0; this.level = 0;
    this.peaks = { bass: 0.2, mid: 0.2, high: 0.2 };
    this.avgs = { bass: 0, mid: 0, high: 0 };
    this.bassAvg = 0; this.fluxAvg = 0;
    this.lastBeat = 0;
    this.beat = false;
    this.wave = new Uint8Array(SOUND_W).fill(128);                 // the waveform, 128 = silence
    this.wavePeak = 8;
    this.spec = new Float32Array(SOUND_W);                         // the spectrum now, 0–1, log-spaced 30 Hz → 16 kHz, softened
    this.specRaw = new Float32Array(SOUND_W);
    this.hist = new Uint8Array(SOUND_W * SOUND_ROWS).fill(0);      // the spectrum's past, newest row first
    this.waveHist = new Uint8Array(SOUND_W * WAVE_ROWS).fill(128); // the waveform's past, newest row first
    this.histT = 0; this.waveT = 0;
    this.onchange = () => {};
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.prev = new Uint8Array(this.analyser.frequencyBinCount);
    this.td = new Uint8Array(this.analyser.fftSize);
    this.recDest = this.ctx.createMediaStreamDestination();
    if (this.input.outputId) this.setOutput(this.input.outputId);
  }

  disconnect() {
    for (const n of [this.source, this.analyser, this.inGain, this.monGain]) try { n?.disconnect(); } catch {}
    this.source = this.inGain = this.monGain = null;
    if (this.el) { this.el.pause(); URL.revokeObjectURL(this.el.src); this.el = null; }
    if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; }
  }

  async loadFile(file, { autoplay = true, loop = true } = {}) {
    this.ensure();
    this.disconnect();
    const el = new Audio();
    el.src = URL.createObjectURL(file);
    el.loop = loop;
    el.crossOrigin = 'anonymous';
    this.el = el;
    this.file = file;
    this.source = this.ctx.createMediaElementSource(el);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.source.connect(this.recDest);
    this.mode = 'file';
    this.name = file.name.replace(/\.[^.]+$/, '');
    el.onplay = el.onpause = () => this.onchange();
    if (autoplay) {
      await this.ctx.resume();
      await el.play();
    }
    this.onchange();
  }

  // a live input. Instruments want the raw signal: no echo cancelling, noise gating or auto gain.
  // It's mixed to mono (a guitar in input 1 of an interface is only the left channel) and, if
  // monitoring is on, sent to the speakers — the analyser itself never is, so it can't double up.
  async useInput(deviceId = this.input.deviceId) {
    this.ensure();
    this.disconnect();
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio });
    const track = this.micStream.getAudioTracks()[0];
    this.input.deviceId = track?.getSettings?.().deviceId || deviceId || '';
    this.source = this.ctx.createMediaStreamSource(this.micStream);
    this.inGain = this.ctx.createGain();
    this.inGain.channelCount = 1;
    this.inGain.channelCountMode = 'explicit';
    this.inGain.gain.value = this.input.level;
    this.monGain = this.ctx.createGain();
    this.monGain.gain.value = this.input.monitor ? this.input.volume : 0;
    this.source.connect(this.inGain);
    this.inGain.connect(this.analyser);
    this.inGain.connect(this.monGain);
    this.monGain.connect(this.ctx.destination);
    this.inGain.connect(this.recDest);
    this.mode = 'mic';
    this.name = track?.label?.replace(/\s*\(.*?\)\s*$/, '') || 'Live input';
    await this.ctx.resume();
    this.onchange();
  }
  async useMic() { return this.useInput(); }

  setInputLevel(x) {
    this.input.level = x;
    this.inGain?.gain.setTargetAtTime(x, this.ctx.currentTime, 0.02);
  }

  setMonitor(on, volume = this.input.volume) {
    this.input.monitor = on;
    this.input.volume = volume;
    this.monGain?.gain.setTargetAtTime(on ? volume : 0, this.ctx.currentTime, 0.03);
  }

  // where the sound comes out (Chrome / Edge); false if this browser can't choose
  async setOutput(id) {
    this.input.outputId = id;
    if (!this.ctx) return true;
    if (!this.ctx.setSinkId) return false;
    try { await this.ctx.setSinkId(id || ''); return true; } catch (e) { console.warn(e); return false; }
  }
  get canChooseOutput() { return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype; }

  // the inputs and outputs (their names only show up once the browser has been allowed one input)
  static async devices() {
    const list = await navigator.mediaDevices?.enumerateDevices?.() || [];
    const name = (d, i, what) => d.label || `${what} ${i + 1}`;
    return {
      inputs: list.filter(d => d.kind === 'audioinput').map((d, i) => ({ id: d.deviceId, label: name(d, i, 'Input') })),
      outputs: list.filter(d => d.kind === 'audiooutput').map((d, i) => ({ id: d.deviceId, label: name(d, i, 'Output') })),
    };
  }

  stop() {
    this.disconnect();
    this.mode = 'off';
    this.name = '';
    this.onchange();
  }

  togglePlay() {
    if (!this.el) return;
    if (this.el.paused) { this.ctx.resume(); this.el.play(); } else this.el.pause();
  }

  get playing() { return this.mode === 'mic' || (this.el && !this.el.paused); }

  // the waveform, triggered on a rising zero crossing so it stands still like an oscilloscope's, and
  // auto-gained so a quiet guitar draws as big a wave as a loud song; the spectrum on a log scale, so the
  // bass gets as much room as the treble
  readShape(dt) {
    const td = this.td, n = SOUND_W;
    this.analyser.getByteTimeDomainData(td);
    let t0 = 0, peak = 0;
    for (let i = 1; i < td.length - n * 2; i++) if (td[i - 1] < 128 && td[i] >= 128) { t0 = i; break; }
    for (let j = 0; j < n; j++) peak = Math.max(peak, Math.abs(td[t0 + j * 2] - 128));
    this.wavePeak = Math.max(peak, this.wavePeak * Math.exp(-dt * 0.6), 6);
    const g = 110 / this.wavePeak;
    for (let j = 0; j < n; j++) {
      const x = 128 + (td[t0 + j * 2] - 128) * g;
      this.wave[j] = (this.wave[j] + Math.max(0, Math.min(255, x))) >> 1;
    }
    const hz = this.ctx.sampleRate / this.analyser.fftSize, d = this.data;
    for (let j = 0; j < n; j++) {
      const f = 30 * Math.pow(16000 / 30, j / (n - 1));
      const b = Math.min(d.length - 1, Math.floor(f / hz));
      const v = Math.max(0, Math.min(1, (d[b] / 255 - 0.3) / 0.62));
      this.specRaw[j] += (v - this.specRaw[j]) * (v > this.specRaw[j] ? 0.5 : 0.18);
    }
    // soften it across frequency (two wide box passes): a landscape needs hills, not 512 needles
    const tmp = this.tmp ||= new Float32Array(n);
    let src = this.specRaw;
    for (let pass = 0; pass < 2; pass++) {
      const dst = pass ? this.spec : tmp;
      for (let j = 0; j < n; j++) {
        let sum = 0, cnt = 0;
        for (let k = Math.max(0, j - 10); k <= Math.min(n - 1, j + 10); k++) { sum += src[k]; cnt++; }
        dst[j] = sum / cnt;
      }
      src = dst;
    }
  }

  // a live pitch, for a guitar or a voice: YIN on the newest 2048 samples at half rate, every other frame
  readPitch() {
    if ((this.pitchTick = (this.pitchTick || 0) + 1) % 2) return;
    const fl = this.fl ||= new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(fl);
    const x = this.pdown ||= new Float32Array(1024), n = 1024;
    for (let i = 0; i < n; i++) x[i] = fl[i * 2];
    const sr = this.ctx.sampleRate / 2, W = 512, tauMax = Math.min(W - 1, Math.floor(sr / 80)), tauMin = Math.floor(sr / 1500);
    const d = this.pd ||= new Float32Array(W);
    let run = 0, best = -1, bestV = 1;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const e = x[i] - x[i + tau]; s += e * e; }
      run += s;
      d[tau] = run > 0 ? (s * tau) / run : 1;
    }
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (d[tau] < 0.2 && d[tau] <= d[tau + 1]) { best = tau; bestV = d[tau]; break; }
      if (d[tau] < bestV) { bestV = d[tau]; best = tau; }
    }
    if (best > 1 && best < tauMax) {
      const a = d[best - 1], b = d[best], c = d[best + 1], t = best + 0.5 * (a - c) / (a - 2 * b + c || 1);
      this.pitchMidi = 69 + 12 * Math.log2(sr / t / 440);
      this.pitchConf = Math.max(0, 1 - bestV * 1.5);
    } else this.pitchConf = 0;
  }

  // history: a spectrum row 24 times a second (≈ 2.7 s), a waveform row 30 times a second (≈ 2.1 s)
  pushHistory(dt) {
    if ((this.histT += dt) >= 1 / 24) {
      this.histT = 0;
      this.hist.copyWithin(SOUND_W, 0, SOUND_W * (SOUND_ROWS - 1));
      for (let j = 0; j < SOUND_W; j++) this.hist[j] = this.spec[j] * 255;
    }
    if ((this.waveT += dt) >= 1 / 30) {
      this.waveT = 0;
      this.waveHist.copyWithin(SOUND_W, 0, SOUND_W * (WAVE_ROWS - 1));
      this.waveHist.set(this.wave, 0);
    }
  }

  band(lo, hi) {
    const hz = this.ctx.sampleRate / this.analyser.fftSize;
    const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(this.data.length - 1, Math.ceil(hi / hz));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += this.data[i];
    return sum / ((b - a + 1) * 255);
  }

  update(dt, now) {
    this.beat = false;
    if (this.mode === 'off' || !this.playing) {
      const k = Math.exp(-dt * 6);
      this.bass *= k; this.mid *= k; this.high *= k; this.level *= k;
      for (let i = 0; i < SOUND_W; i++) { this.wave[i] = 128 + (this.wave[i] - 128) * k; this.spec[i] *= k; this.specRaw[i] *= k; }
      this.pushHistory(dt);
      return;
    }
    this.analyser.getByteFrequencyData(this.data);
    this.readShape(dt);
    this.pushHistory(dt);
    if (this.wantPitch) this.readPitch();
    const raw = { bass: this.band(30, 140), mid: this.band(400, 2000), high: this.band(4000, 12000) };
    // auto-gain: scale each band between its recent average and its slowly-decaying peak,
    // so quiet songs still move things and loud songs don't just sit at 1.0
    for (const key of ['bass', 'mid', 'high']) {
      this.peaks[key] = Math.max(raw[key], this.peaks[key] * Math.exp(-dt * 0.25), 0.08);
      this.avgs[key] += (raw[key] - this.avgs[key]) * Math.min(1, dt * 0.7);
      const floor = this.avgs[key] * 0.75;
      const v = Math.min(1, Math.max(0, (raw[key] - floor) / Math.max(this.peaks[key] - floor, 0.04)));
      const attack = v > this[key] ? 0.55 : 0.12;
      this[key] += (v - this[key]) * attack;
    }
    this.level = (this.bass * 0.5 + this.mid * 0.3 + this.high * 0.2);
    // a beat: the bass jumps well above its recent average — or any note starts (spectral flux), which
    // is what a strummed guitar gives you
    let flux = 0;
    for (let i = 2; i < this.data.length; i++) { const dd = this.data[i] - this.prev[i]; if (dd > 0) flux += dd; }
    this.prev.set(this.data);
    flux /= this.data.length * 255;
    this.bassAvg += (raw.bass - this.bassAvg) * Math.min(1, dt * 3);
    const bassHit = raw.bass > this.bassAvg * 1.25 && raw.bass > 0.25;
    const onset = flux > this.fluxAvg * 2.2 + 0.006;
    this.fluxAvg += (flux - this.fluxAvg) * Math.min(1, dt * 4);
    if ((bassHit || onset) && now - this.lastBeat > 0.2) {
      this.beat = true;
      this.lastBeat = now;
    }
  }
}
