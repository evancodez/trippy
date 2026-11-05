// One WebGL2 context: the world pass (ray-marched, with echo trails), the brushes' distortion map, the
// picture under the sheet (sharp, plus a blurred copy for the relief), the live sound, and the finishing pass.
import { VERT, DISP_FRAG, COMP_FRAG, BLUR_FRAG, LIVING_FRAG } from './passes.js';
import { worldFrag } from '../engine/shader.js';
import { SOUND_W, SOUND_ROWS, WAVE_ROWS } from '../audio.js';
import { hexToRgb, SHADER_SLOTS } from '../engine/params.js';
import { cameraFrame } from '../engine/camera.js';

const SLOT = Object.fromEntries(SHADER_SLOTS.filter(s => s.channel == null).map((s, i) => [s.name, SHADER_SLOTS.indexOf(s)]));

export const MAX_RIPPLES = 16;
const NONE = new Float32Array(32 * 4);

export class Renderer {
  constructor(canvas, { preserve = false } = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      preserveDrawingBuffer: preserve, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.canvas = canvas;
    this.floatDisp = !!gl.getExtension('EXT_color_buffer_float');
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.dispProg = this.program(DISP_FRAG);
    this.compProg = this.program(COMP_FRAG);
    this.worldProg = this.program(worldFrag());
    this.w = 0; this.h = 0;
    this.frames = []; this.fi = 0;       // ping-pong, so echo trails can read the last frame
    this.disps = []; this.di = 0;
    this.clearDisp = true;
    this.dispIdle = 0;
    this.camFrame = new Float32Array(9);  // right, up, back
    this.zeroTex = this.makeTexture(1, 1, false);
    this.mediaTex = this.makeTexture(1, 1, false, true);
    this.mediaRaw = this.makeTexture(1, 1, false, true);
    this.mediaAspect = 1;
    this.setSound(new Uint8Array(SOUND_W).fill(128), new Uint8Array(SOUND_W * SOUND_ROWS), new Uint8Array(SOUND_W * WAVE_ROWS).fill(128));   // silence
  }

  // later: don't wait for it — P.done() says when it has finished compiling (in the background, where
  // the browser can), and P.ok whether it worked
  program(fragSrc, later = false) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    const cache = new Map();
    const loc = name => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name));
      return cache.get(name);
    };
    const P = { prog, loc, ok: null, error: '' };
    P.done = () => {
      if (P.ok != null) return true;
      if (later && this.parallel && !gl.getProgramParameter(prog, this.parallel.COMPLETION_STATUS_KHR)) return false;
      P.ok = gl.getProgramParameter(prog, gl.LINK_STATUS);
      if (!P.ok) P.error = (!gl.getShaderParameter(fs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(fs)) || gl.getProgramInfoLog(prog) || 'shader failed to compile';
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return true;
    };
    if (!later) { P.done(); if (!P.ok) throw new Error(P.error); }
    return P;
  }

  // a figure's relief, as textures: height, pull x, pull y, shade; and up to four blend shapes
  reliefTextures(rel) {
    const gl = this.gl, N = rel.N, P = rel.planes;
    const tex = (a, b, c, d) => {
      const data = new Float32Array(N * N * 4);
      for (let i = 0; i < N * N; i++) { data[i * 4] = a ? a[i] : 0; data[i * 4 + 1] = b ? b[i] : 0; data[i * 4 + 2] = c ? c[i] : 0; data[i * 4 + 3] = d ? d[i] : 0; }
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, N, N, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return t;
    };
    return { base: tex(P[0], P[1], P[2], P[3]), shapes: P.length > 4 ? tex(P[4], P[5], P[6], P[7]) : null };
  }

  makeTexture(w, h, float, mip = false) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  makeTarget(w, h, float, mip = false) {
    const gl = this.gl;
    const tex = this.makeTexture(w, h, float, mip);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (mip) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.generateMipmap(gl.TEXTURE_2D); }
    return { tex, fb, w, h };
  }

  freeTargets(list) {
    for (const t of list) { this.gl.deleteTexture(t.tex); this.gl.deleteFramebuffer(t.fb); }
  }

  resize(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.freeTargets(this.frames);
    this.freeTargets(this.disps);
    this.frames = [this.makeTarget(w, h, false, true), this.makeTarget(w, h, false, true)];
    this.disps = this.floatDisp ? [0, 1].map(() => this.makeTarget(Math.max(16, Math.ceil(w / 4)), Math.max(16, Math.ceil(h / 4)), true)) : [];
  }

  // forget the echo history (so a fresh view doesn't inherit old trails)
  clearEcho() {
    const gl = this.gl;
    for (const t of this.frames) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  // the live sound: row 0 the waveform (0.5 = silence), rows 1–64 the spectrum's past, rows 65–128 the
  // waveform's past, rows 129–130 the melody's past (quick and slow) — newest first
  setSound(wave, hist, waveHist, melody) {
    const gl = this.gl, W = wave.length, H = 1 + hist.length / W + waveHist.length / W + 2;
    if (!this.soundTex) {
      this.soundTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.soundTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, W, H, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.soundBuf = new Uint8Array(W * H);
    }
    this.soundBuf.set(wave, 0);
    this.soundBuf.set(hist, W);
    this.soundBuf.set(waveHist, W + hist.length);
    if (melody) this.soundBuf.set(melody, W + hist.length + waveHist.length);
    else this.soundBuf.fill(128, W + hist.length + waveHist.length);
    gl.bindTexture(gl.TEXTURE_2D, this.soundTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED, gl.UNSIGNED_BYTE, this.soundBuf);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  // a picture under the sheet (rgb = picture, a = mask). The upload stays sharp at full size (the photo and
  // the engraving read it); a copy is blurred in floating point at half size for the relief — a smooth
  // relief needs smooth slopes, which 8 bits can't give
  setMedia(source, aspect, sigma = 3) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.mediaRaw);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.mediaAspect = aspect || 1;
    const sw = source.videoWidth || source.naturalWidth || source.width, sh = source.videoHeight || source.naturalHeight || source.height;
    const w = Math.max(32, Math.round(sw / 2)), h = Math.max(32, Math.round(sh / 2));
    if (!this.mediaBlur || this.mediaBlur[0].w !== w || this.mediaBlur[0].h !== h) {
      if (this.mediaBlur) this.freeTargets(this.mediaBlur);
      this.mediaBlur = [this.makeTarget(w, h, this.floatDisp, true), this.makeTarget(w, h, this.floatDisp, true)];
    }
    if (!this.blurProg) this.blurProg = this.program(BLUR_FRAG);
    const B = this.blurProg, [A, C] = this.mediaBlur;
    gl.useProgram(B.prog);
    gl.uniform2f(B.loc('uRes'), w, h);
    gl.uniform1f(B.loc('uSigma'), Math.max(0.6, sigma));
    gl.uniform1i(B.loc('uSrc'), 0);
    gl.activeTexture(gl.TEXTURE0);
    const pass = (src, dst, dx, dy) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform2f(B.loc('uDir'), dx, dy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    pass(this.mediaRaw, A, 1, 0);
    pass(A.tex, C, 0, 1);
    gl.bindTexture(gl.TEXTURE_2D, C.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.mediaTex = C.tex;
  }

  // the camera's frame, from the shader values: worked out here once a frame instead of in every pixel,
  // and sent as uniforms, so the shader keeps its registers for marching
  setFrames(P) {
    cameraFrame(P[SLOT.pitch], P[SLOT.yaw], P[SLOT.roll], this.camFrame);
  }

  // the living labyrinth: a few steps of its chemistry each frame, only while a look is using it.
  // energy (0..1) pushes the feed, so loud passages grow new branches; a spot is a drop of B somewhere.
  updateLiving(steps = 8, energy = 0, spot = null) {
    const gl = this.gl;
    if (!this.floatDisp) return;
    if (!this.livingProg) {
      this.livingProg = this.program(LIVING_FRAG);
      this.livingT = [this.makeTarget(384, 384, true), this.makeTarget(384, 384, true)];
      this.livingT.forEach(t => {
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      });
      this.livingI = 0;
      this.livingClear = true;
    }
    const P = this.livingProg, f = 0.037 + 0.006 * energy, k = 0.06 - 0.0012 * energy;
    gl.useProgram(P.prog);
    gl.uniform1i(P.loc('uPrev'), 0);
    gl.uniform2f(P.loc('uRes'), 384, 384);
    gl.uniform2f(P.loc('uFK'), f, k);
    gl.viewport(0, 0, 384, 384);
    gl.activeTexture(gl.TEXTURE0);
    for (let i = 0; i < steps; i++) {
      const src = this.livingT[this.livingI], dst = this.livingT[1 - this.livingI];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1f(P.loc('uClear'), this.livingClear ? 1 : 0);
      gl.uniform4f(P.loc('uSpot'), spot ? spot[0] : 0, spot ? spot[1] : 0, spot ? spot[2] : 0, spot && i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.livingClear = false;
      this.livingI = 1 - this.livingI;
    }
    this.livingTex = this.livingT[this.livingI].tex;
  }

  // the brushes' distortion map. brush = { x, y, vx, vy, size, strength, mode, relax }
  updateDisp(b) {
    const gl = this.gl;
    if (!this.floatDisp) return;
    // nothing painting, and the map long since sprung back flat: leave it be
    if (b.mode === 0 && !this.clearDisp) { if (++this.dispIdle > 2400) return; } else this.dispIdle = 0;
    const src = this.disps[this.di], dst = this.disps[1 - this.di], P = this.dispProg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(P.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(P.loc('uPrevDisp'), 0);
    gl.uniform2f(P.loc('uDispRes'), dst.w, dst.h);
    gl.uniform2f(P.loc('uBrushPos'), b.x, b.y);
    gl.uniform2f(P.loc('uBrushVel'), b.vx, b.vy);
    gl.uniform1f(P.loc('uBrushSize'), b.size);
    gl.uniform1f(P.loc('uBrushStrength'), b.strength);
    gl.uniform1i(P.loc('uBrushMode'), b.mode);
    gl.uniform1f(P.loc('uRelax'), b.relax);
    gl.uniform1f(P.loc('uAspect'), this.w / this.h);
    gl.uniform1i(P.loc('uClear'), this.clearDisp ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.clearDisp = false;
    this.di = 1 - this.di;
  }

  // the world, then the finishing pass to the screen.
  // P = shader values (world.frame), rt = { realTime, ripples, stepK, fingers, handMirror, twists }, post = toPost()
  render(P, rt, post) {
    const gl = this.gl, W = this.worldProg, u = n => W.loc(n);
    const prev = this.frames[this.fi], out = this.frames[1 - this.fi];
    if (P[SLOT.living] > 0.001) this.updateLiving(rt.livingSteps ?? 8, rt.livingEnergy ?? 0, rt.livingSpot);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(W.prog);
    const bind = (unit, tex, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u(name), unit); };
    bind(0, this.floatDisp ? this.disps[this.di].tex : this.zeroTex, 'uDisp');
    bind(1, prev.tex, 'uPrev');
    bind(2, this.mediaTex, 'uMedia');
    bind(3, this.mediaRaw, 'uMediaSharp');
    bind(4, this.soundTex, 'uSound');
    bind(5, this.livingTex || this.zeroTex, 'uLiving');
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u('uMediaAspect'), this.mediaAspect);
    gl.uniform1fv(u('uFinger'), rt.fingers);
    gl.uniform1fv(u('uHandMirror'), rt.handMirror);
    gl.uniform4fv(u('uTwists'), rt.twists);
    gl.uniform2f(u('uRes'), this.w, this.h);
    gl.uniform4fv(u('uV'), P);
    this.setFrames(P);
    const F = this.camFrame;
    gl.uniform3f(u('gRight'), F[0], F[1], F[2]);
    gl.uniform3f(u('gUp'), F[3], F[4], F[5]);
    gl.uniform3f(u('gBack'), F[6], F[7], F[8]);
    bind(6, rt.reliefA?.base || this.zeroTex, 'uRelief');
    bind(7, rt.reliefB?.base || this.zeroTex, 'uReliefB');
    bind(8, rt.reliefA?.shapes || this.zeroTex, 'uReliefX');
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(u('uFigW'), rt.figW || NONE.subarray(0, 4));
    gl.uniform2fv(u('uSw'), rt.sw);
    gl.uniform1f(u('uMorph'), rt.morph ?? 1);
    gl.uniform1fv(u('uCrys'), rt.crys || NONE.subarray(0, 7));
    gl.uniform4fv(u('uDrops'), rt.drops || NONE);
    gl.uniform1f(u('uDropN'), rt.dropN || 0);
    gl.uniform4fv(u('uRings'), rt.rings || NONE.subarray(0, 16));
    gl.uniform1f(u('uRingsOn'), rt.ringsOn || 0);
    gl.uniform4fv(u('uRipples'), rt.ripples);
    let ripples = 0;
    for (let i = 0; i < rt.ripples.length; i += 4) if (rt.ripples[i + 3] > 0 && rt.realTime - rt.ripples[i + 2] < 5) ripples = 1;
    gl.uniform1f(u('uRipplesOn'), ripples);
    gl.uniform1f(u('uStepK'), rt.stepK ?? 0.6);
    gl.uniform1f(u('uRealTime'), rt.realTime);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, out.tex);
    if ((post.glow ?? 0) > 0.001) gl.generateMipmap(gl.TEXTURE_2D);   // feeds the glow (the levels exist from the start, so skipping is safe)
    this.fi = 1 - this.fi;

    const C = this.compProg, c = n => C.loc(n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(C.prog);
    gl.bindTexture(gl.TEXTURE_2D, out.tex);
    gl.uniform1i(c('uA'), 0);
    gl.uniform2f(c('uRes'), this.w, this.h);
    gl.uniform1f(c('uSeed'), Math.random());
    gl.uniform1f(c('uGrain'), post.grain ?? 0);
    gl.uniform1f(c('uVignette'), post.vignette ?? 0);
    gl.uniform1f(c('uGlow'), post.glow ?? 0);
    gl.uniform3fv(c('uGlowTint'), hexToRgb(post.glowColor || '#ffffff'));
    gl.uniform1f(c('uAberr'), post.aberr ?? 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
