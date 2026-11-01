// Pictures under the membrane. Whatever is here gets drawn into a canvas (rgb = picture, a = mask)
// and uploaded as the film world's relief: a dropped image, a looping video, typed words, or the camera.
export const FONTS = {
  grotesk: '700 {s}px "Space Grotesk", system-ui, sans-serif',
  serif: 'italic 700 {s}px Georgia, "Times New Roman", serif',
  mono: '500 {s}px "JetBrains Mono", ui-monospace, monospace',
  condensed: '800 {s}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif',
};

export class Media {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.kind = 'none';        // none | image | video | text | camera
    this.name = '';
    this.el = null;
    this.aspect = 1;
    this.dirty = false;
    this.lastDraw = 0;
    this.text = { value: '', font: 'grotesk' };
    this.camera = null;        // { video, stream }
    this.cam = { relief: 'scene' };   // what of the camera presses through: none | scene | body | face | motion
    this.blurPx = 6;           // a smooth relief needs a softened picture (sharp pixels make crunchy lines)
    this.out = document.createElement('canvas');
    this.outCtx = this.out.getContext('2d');
    this.output = this.canvas;
    this.size(16, 16);
  }

  // the uploaded picture: the canvas, softened
  soften() {
    const px = this.blurPx * this.canvas.height / 480;
    if (px < 0.5) { this.output = this.canvas; return; }
    const o = this.out, g = this.outCtx;
    if (o.width !== this.canvas.width || o.height !== this.canvas.height) { o.width = this.canvas.width; o.height = this.canvas.height; }
    g.clearRect(0, 0, o.width, o.height);
    if ('filter' in g) {
      g.filter = `blur(${px.toFixed(1)}px)`;
      g.drawImage(this.canvas, 0, 0);
      g.filter = 'none';
    } else {                                  // no canvas filters (older Safari): shrink and grow back
      const s = Math.max(2, Math.round(px));
      g.imageSmoothingEnabled = true;
      g.drawImage(this.canvas, 0, 0, o.width / s, o.height / s);
      g.drawImage(o, 0, 0, o.width / s, o.height / s, 0, 0, o.width, o.height);
    }
    this.output = o;
  }

  setBlur(px) {
    if (Math.abs(px - this.blurPx) > 0.05) { this.blurPx = px; this.dirty = true; }
  }

  size(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.aspect = w / h;
  }

  clear() {
    if (this.el && this.kind === 'video') { this.el.pause(); URL.revokeObjectURL(this.el.src); }
    if (this.el && this.kind === 'image') URL.revokeObjectURL(this.el.src);
    this.kind = this.camera ? 'camera' : 'none';
    this.el = null;
    this.name = '';
    this.size(16, 16);
    this.ctx.clearRect(0, 0, 16, 16);
    this.dirty = true;
  }

  async setImage(file) {
    this.clear();
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    this.size(Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s));
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    this.el = img;
    this.kind = 'image';
    this.name = file.name;
    this.dirty = true;
  }

  async setVideo(file) {
    this.clear();
    const v = document.createElement('video');
    v.src = URL.createObjectURL(file);
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    await new Promise((ok, fail) => { v.onloadeddata = ok; v.onerror = fail; });
    await v.play().catch(() => {});
    const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    this.size(Math.round(v.videoWidth * s), Math.round(v.videoHeight * s));
    this.el = v;
    this.kind = 'video';
    this.name = file.name;
  }

  // words pressing through: white letters on black, fitted to the canvas
  setText(value, font = this.text.font) {
    if (this.kind !== 'text') this.clear();
    this.text = { value, font };
    this.kind = value.trim() ? 'text' : (this.camera ? 'camera' : 'none');
    if (this.kind !== 'text') { this.dirty = true; return; }
    this.size(1280, 640);
    const g = this.ctx, lines = value.split('\n').filter(l => l.trim()).slice(0, 4);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1280, 640);
    let px = 420;
    const fit = () => {
      g.font = FONTS[font].replace('{s}', px);
      return Math.max(...lines.map(l => g.measureText(l).width));
    };
    while (px > 40 && (fit() > 1180 || px * 1.05 * lines.length > 600)) px -= 8;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, 640, 320 + (i - (lines.length - 1) / 2) * px * 1.05));
    this.dirty = true;
  }

  attachCamera(video) {
    this.camera = { video };
    if (this.kind === 'none') this.kind = 'camera';
  }

  detachCamera() {
    this.camera = null;
    if (this.kind === 'camera') { this.kind = 'none'; this.size(16, 16); this.dirty = true; }
  }

  // camera frame → canvas, mirrored like a selfie; masks come from the tracker
  drawCamera(masks) {
    const v = this.camera.video;
    if (!v.videoWidth) return;
    const w = 480, h = Math.round(480 * v.videoHeight / v.videoWidth);
    this.size(w, h);
    const g = this.ctx, r = this.cam.relief;
    g.globalCompositeOperation = 'source-over';
    if (r === 'none') { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); this.dirty = true; return; }
    if (r === 'motion') {                     // where you moved, fading trails
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      if (masks.motion) { g.imageSmoothingEnabled = true; g.drawImage(masks.motion, 0, 0, w, h); }
      this.dirty = true;
      return;
    }
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(v, 0, 0, w, h);
    g.restore();
    if (r === 'body' && masks.body) {         // a silhouette that bulges, with your detail on top
      g.globalAlpha = 0.45;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    if ((r === 'body' && masks.body) || (r === 'face' && masks.face)) {
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(masks.canvas, 0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }
    this.dirty = true;
  }

  // called every frame; returns true when the canvas changed
  update(now, masks) {
    if (this.kind === 'video' && this.el && now - this.lastDraw > 1 / 30) {
      this.ctx.drawImage(this.el, 0, 0, this.canvas.width, this.canvas.height);
      this.lastDraw = now;
      this.dirty = true;
    } else if (this.kind === 'camera' && this.camera && now - this.lastDraw > 1 / 30) {
      this.drawCamera(masks || {});
      this.lastDraw = now;
    }
    const d = this.dirty;
    this.dirty = false;
    if (d) this.soften();
    return d;
  }

  // does the picture need its alpha channel used as a mask?
  get masked() {
    return this.kind === 'camera' && (this.cam.relief === 'body' || this.cam.relief === 'face');
  }
}
