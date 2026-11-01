// Song / microphone analysis → smooth bass, mid, high and level values (0–1) plus beat detection.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.el = null;            // <audio> for dropped songs
    this.source = null;
    this.micStream = null;
    this.recDest = null;       // lets screen recordings include the song
    this.mode = 'off';         // 'off' | 'file' | 'mic'
    this.name = '';
    this.bass = 0; this.mid = 0; this.high = 0; this.level = 0;
    this.peaks = { bass: 0.2, mid: 0.2, high: 0.2 };
    this.avgs = { bass: 0, mid: 0, high: 0 };
    this.bassAvg = 0;
    this.lastBeat = 0;
    this.beat = false;
    this.onchange = () => {};
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.recDest = this.ctx.createMediaStreamDestination();
  }

  disconnect() {
    try { this.source?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    this.source = null;
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

  async useMic() {
    this.ensure();
    this.disconnect();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    this.source = this.ctx.createMediaStreamSource(this.micStream);
    this.source.connect(this.analyser);   // not to the speakers — that would feed back
    this.mode = 'mic';
    this.name = 'Microphone';
    await this.ctx.resume();
    this.onchange();
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
      return;
    }
    this.analyser.getByteFrequencyData(this.data);
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
    // beat = bass jumps well above its recent average
    this.bassAvg += (raw.bass - this.bassAvg) * Math.min(1, dt * 3);
    if (raw.bass > this.bassAvg * 1.25 && raw.bass > 0.25 && now - this.lastBeat > 0.28) {
      this.beat = true;
      this.lastBeat = now;
    }
  }
}
