// The camera: your face, hands, body and movement, read locally in the browser (MediaPipe, loaded on demand).
// Nothing leaves the computer. Results are in "mirror" coordinates (like a selfie): u 0..1 left→right, v 0..1 top→bottom.
const VERSION = '0.10.14';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  hands: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  body: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
};
const FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = a => Math.sqrt(dot(a, a)) || 1e-6;
const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b)))));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Tracker {
  constructor() {
    this.video = null;
    this.stream = null;
    this.aspect = 4 / 3;
    this.want = { face: false, hands: false, body: false, motion: false };
    this.status = { camera: 'off', face: 'off', hands: 'off', body: 'off' };
    this.tasks = {};
    this.lib = null;
    this.face = null;          // { u, v, height, roll, turn, mouth, eyes }
    this.hands = [];           // [{ u, v, size, angle, curls[5], spread, mirror }]
    this.bodyMask = null;
    this.motion = { energy: 0, u: 0.5, v: 0.5, canvas: null };
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = 256;
    this.maskCanvas.height = 192;
    this.turn = 0;
    this.ts = 0;
    this.onchange = () => {};
    this._motion = null;
  }

  get on() { return !!this.stream; }

  async start() {
    if (this.stream) return;
    this.status.camera = 'loading';
    this.onchange();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    } catch (e) {
      this.status.camera = 'error';
      this.onchange();
      throw e;
    }
    const v = document.createElement('video');
    v.srcObject = this.stream;
    v.muted = true;
    v.playsInline = true;
    await v.play();
    this.video = v;
    this.aspect = v.videoWidth / v.videoHeight || 4 / 3;
    this.status.camera = 'on';
    for (const k of ['face', 'hands', 'body']) if (this.want[k]) this.ensure(k);
    this.onchange();
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video = null;
    this.face = null;
    this.hands = [];
    this.bodyMask = null;
    this.status.camera = 'off';
    this.onchange();
  }

  setWant(kind, on) {
    this.want[kind] = on;
    if (on && this.stream && kind !== 'motion') this.ensure(kind);
    if (!on) { if (kind === 'face') this.face = null; if (kind === 'hands') this.hands = []; if (kind === 'body') this.bodyMask = null; }
    this.onchange();
  }

  async ensure(kind) {
    if (this.tasks[kind] || this.status[kind] === 'loading') return;
    this.status[kind] = 'loading';
    this.onchange();
    try {
      if (!this.lib) {
        const mod = await import(`${BASE}/vision_bundle.mjs`);
        this.lib = { mod, files: await mod.FilesetResolver.forVisionTasks(`${BASE}/wasm`) };
      }
      const { mod, files } = this.lib;
      const make = async delegate => {
        const baseOptions = { modelAssetPath: MODELS[kind], delegate };
        if (kind === 'face') return mod.FaceLandmarker.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
        if (kind === 'hands') return mod.HandLandmarker.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', numHands: 2 });
        return mod.ImageSegmenter.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
      };
      try { this.tasks[kind] = await make('GPU'); } catch { this.tasks[kind] = await make('CPU'); }
      this.status[kind] = 'on';
    } catch (e) {
      console.warn('tracker failed', kind, e);
      this.status[kind] = 'error';
    }
    this.onchange();
  }

  // run the trackers on the newest camera frame (round-robin, so the frame rate stays smooth)
  update() {
    const v = this.video;
    if (!v || v.readyState < 2) return;
    this.ts = Math.max(this.ts + 1, performance.now());
    const order = ['hands', 'face', 'body'].filter(k => this.want[k] && this.tasks[k]);
    this.turn = (this.turn + 1) % Math.max(1, order.length);
    const kind = order[this.turn];
    try {
      if (kind === 'face') this.readFace(this.tasks.face.detectForVideo(v, this.ts));
      else if (kind === 'hands') this.readHands(this.tasks.hands.detectForVideo(v, this.ts));
      else if (kind === 'body') this.tasks.body.segmentForVideo(v, this.ts, r => this.readBody(r));
    } catch (e) { console.warn(e); }
    if (this.want.motion) this.readMotion();
    this.drawMasks();
  }

  readFace(r) {
    const lm = r.faceLandmarks?.[0];
    if (!lm) { this.face = null; return; }
    const A = this.aspect;
    const m = p => ({ x: (1 - p.x) * A, y: p.y });        // mirrored, aspect-correct
    const L = m(lm[234]), R = m(lm[454]), top = m(lm[10]), chin = m(lm[152]), nose = m(lm[1]);
    const eL = m(lm[33]), eR = m(lm[263]);
    const cx = (L.x + R.x) / 2, cy = (top.y + chin.y) / 2;
    const half = Math.max(1e-3, Math.abs(R.x - L.x) / 2);
    const bs = Object.fromEntries((r.faceBlendshapes?.[0]?.categories || []).map(c => [c.categoryName, c.score]));
    this.face = {
      u: cx / A, v: cy,
      height: Math.hypot(chin.x - top.x, chin.y - top.y),
      roll: -Math.atan2(eR.y - eL.y, eR.x - eL.x) + (eR.x < eL.x ? Math.PI : 0),
      turn: clamp((nose.x - cx) / half, -1, 1),
      mouth: clamp((bs.jawOpen || 0) * 1.6, 0, 1),
      eyes: 1 - clamp(((bs.eyeBlinkLeft || 0) + (bs.eyeBlinkRight || 0)) * 0.6, 0, 1),
    };
  }

  readHands(r) {
    const A = this.aspect;
    this.hands = (r.landmarks || []).map(lm => {
      const m = p => ({ x: (1 - p.x) * A, y: 1 - p.y, z: -(p.z || 0) * A });   // mirrored, y up
      const P = lm.map(m);
      const palm = [0, 5, 9, 13, 17].reduce((s, i) => ({ x: s.x + P[i].x / 5, y: s.y + P[i].y / 5 }), { x: 0, y: 0 });
      const axis = sub(P[9], P[0]);
      const size = Math.hypot(axis.x, axis.y);
      const angle = Math.atan2(-axis.x, axis.y);
      // which way round is the hand? (our model has the index finger on the +x side)
      const across = sub(P[5], P[17]);
      const localX = across.x * Math.cos(-angle) - across.y * Math.sin(-angle);
      const curls = FINGERS.map(([a, b, , d]) => clamp((angleBetween(sub(P[b], P[a]), sub(P[d], P[b])) - 0.15) / 1.5, 0, 1.4));
      const spread = clamp(angleBetween(sub(P[8], P[5]), sub(P[20], P[17])) / 0.9, 0, 1.4);
      return { u: palm.x / A, v: 1 - palm.y, size, angle, curls, spread, mirror: localX >= 0 ? 1 : -1 };
    });
  }

  readBody(r) {
    const mask = r.confidenceMasks?.[0];
    if (!mask) return;
    this.bodyMask = { w: mask.width, h: mask.height, data: mask.getAsFloat32Array() };
    mask.close?.();
  }

  // a small difference image of the camera: where things moved, and how much
  readMotion() {
    const W = 80, H = Math.round(80 / this.aspect);
    if (!this._motion) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const out = document.createElement('canvas');
      out.width = W; out.height = H;
      this._motion = { c, g: c.getContext('2d', { willReadFrequently: true }), out, og: out.getContext('2d'), prev: null, trail: new Float32Array(W * H) };
      this.motion.canvas = out;
    }
    const M = this._motion;
    M.g.save();
    M.g.translate(W, 0);
    M.g.scale(-1, 1);
    M.g.drawImage(this.video, 0, 0, W, H);
    M.g.restore();
    const px = M.g.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 765;
    if (M.prev) {
      let e = 0, sx = 0, sy = 0;
      const img = M.og.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const d = Math.abs(gray[i] - M.prev[i]);
        const m = d > 0.06 ? Math.min(1, d * 4) : 0;
        M.trail[i] = Math.max(M.trail[i] * 0.9, m);
        e += m; sx += m * (i % W); sy += m * Math.floor(i / W);
        const g = M.trail[i] * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
        img.data[i * 4 + 3] = 255;
      }
      M.og.putImageData(img, 0, 0);
      this.motion.energy = e / (W * H);
      if (e > 1) { this.motion.u = sx / e / W; this.motion.v = sy / e / H; }
    }
    M.prev = gray;
  }

  // the alpha masks for "only my body" / "only my face"
  drawMasks() {
    const c = this.maskCanvas, g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const b = this.bodyMask;
    if (b && this.want.body) {
      const img = g.createImageData(b.w, b.h);
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        const a = b.data[y * b.w + (b.w - 1 - x)];       // mirror it
        const o = (y * b.w + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = Math.max(0, Math.min(255, (a - 0.2) * 320));
      }
      if (!this._bodyCanvas) this._bodyCanvas = document.createElement('canvas');
      this._bodyCanvas.width = b.w;
      this._bodyCanvas.height = b.h;
      this._bodyCanvas.getContext('2d').putImageData(img, 0, 0);
      g.drawImage(this._bodyCanvas, 0, 0, W, H);
    }
    const f = this.face;
    if (f && this.want.faceMask) {
      g.save();
      g.translate(f.u * W, f.v * H);
      g.rotate(-f.roll);
      g.scale(1, 1.3);
      const r = f.height * H * 0.48;
      const grad = g.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}
