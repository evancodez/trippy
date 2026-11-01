import { VERT, mainFrag, DISP_FRAG, BLIT_FRAG, MAX_WARPS, MAX_NUMS } from './shaders.js';
import { PATTERN_BY_ID, WARP_BY_ID } from './catalog.js';

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Owns one WebGL2 context. render(state, rt) draws one frame:
// `state` is the look (pattern, warps, colors…), `rt` is the moving stuff (time, mouse, ripples, audio…).
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
    this.blitProg = this.program(BLIT_FRAG);
    this.mainProg = null;
    this.formulaKey = null;
    this.nums = new Float32Array(MAX_NUMS);
    this.warpTypes = new Int32Array(MAX_WARPS);
    this.warpParams = new Float32Array(MAX_WARPS * 4);
    this.inks = new Float32Array(15);
    this.w = 0; this.h = 0;
    this.frames = []; this.disps = [];
    this.fi = 0; this.di = 0;
    this.clearDisp = true;
    this.zeroTex = this.makeTexture(1, 1, false);
  }

  program(fragSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(log || 'shader failed to compile');
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
    const cache = new Map();
    const loc = name => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name));
      return cache.get(name);
    };
    return { prog, loc };
  }

  // compiled = output of compileFormula(); only rebuilds the shader when the formula's *shape* changed.
  setFormula(compiled) {
    this.nums.fill(0);
    compiled.nums.forEach((n, i) => { if (i < MAX_NUMS) this.nums[i] = n.v; });
    const g = compiled.glsl;
    const key = `${g.value}|${g.bendX}|${g.bendY}`;
    if (key === this.formulaKey && this.mainProg) return null;
    try {
      const prog = this.program(mainFrag(g));
      if (this.mainProg) this.gl.deleteProgram(this.mainProg.prog);
      this.mainProg = prog;
      this.formulaKey = key;
      return null;
    } catch (e) {
      return e.message;
    }
  }

  makeTexture(w, h, float) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  makeTarget(w, h, float) {
    const gl = this.gl;
    const tex = this.makeTexture(w, h, float);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
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
    this.frames = [this.makeTarget(w, h, false), this.makeTarget(w, h, false)];
    if (this.floatDisp) {
      const dw = Math.max(16, Math.ceil(w / 4)), dh = Math.max(16, Math.ceil(h / 4));
      this.disps = [this.makeTarget(dw, dh, true), this.makeTarget(dw, dh, true)];
    }
  }

  render(s, rt) {
    const gl = this.gl;
    if (!this.mainProg || !this.w) return;
    const aspect = this.w / this.h;

    // 1. distortion map (mouse brushes)
    let dispTex = this.zeroTex;
    if (this.floatDisp) {
      const src = this.disps[this.di], dst = this.disps[1 - this.di];
      const P = this.dispProg, b = rt.brush;
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
      gl.uniform1f(P.loc('uAspect'), aspect);
      gl.uniform1i(P.loc('uClear'), this.clearDisp ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.clearDisp = false;
      this.di = 1 - this.di;
      dispTex = dst.tex;
    }

    // 2. the pattern
    const prev = this.frames[this.fi], out = this.frames[1 - this.fi];
    const M = this.mainProg, u = n => M.loc(n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(M.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dispTex);
    gl.uniform1i(u('uDisp'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    gl.uniform1i(u('uPrev'), 1);

    gl.uniform2f(u('uRes'), this.w, this.h);
    gl.uniform1f(u('uTime'), rt.time);
    gl.uniform1f(u('uRealTime'), rt.realTime);
    gl.uniform2f(u('uMouse'), rt.mouse[0], rt.mouse[1]);
    gl.uniform2f(u('uCenter'), rt.center[0], rt.center[1]);
    gl.uniform1f(u('uZoom'), s.zoom);
    gl.uniform1f(u('uRot'), rt.spin);

    gl.uniform1i(u('uPattern'), PATTERN_BY_ID[s.pattern]?.code ?? 0);
    gl.uniform1f(u('uDensity'), s.density);
    gl.uniform1f(u('uThickness'), s.thickness);
    gl.uniform1f(u('uParam'), s.param);
    gl.uniform1f(u('uPatAngle'), (s.angle * Math.PI) / 180);
    gl.uniform1f(u('uPhase'), rt.phase);

    let n = 0;
    this.warpParams.fill(0);
    for (const w of s.warps) {
      if (!w.on || n >= MAX_WARPS || !WARP_BY_ID[w.type]) continue;
      this.warpTypes[n] = WARP_BY_ID[w.type].code;
      this.warpParams.set([w.amount, w.scale, w.extra, w._ph || 0], n * 4);
      n++;
    }
    gl.uniform1i(u('uWarpCount'), n);
    gl.uniform1iv(u('uWarpType'), this.warpTypes);
    gl.uniform4fv(u('uWarpParam'), this.warpParams);

    gl.uniform4fv(u('uRipples'), rt.ripples);
    gl.uniform1f(u('uRippleScale'), rt.rippleScale);

    gl.uniform1f(u('uSoft'), s.soft);
    gl.uniform1f(u('uDepth'), s.depth);
    gl.uniform1f(u('uRelief'), s.relief);
    gl.uniform1f(u('uEcho'), s.echo);
    gl.uniform1f(u('uFade'), rt.fade);
    gl.uniform1f(u('uInvert'), s.invert ? 1 : 0);
    gl.uniform3fv(u('uPaper'), hexToRgb(s.paper));
    const inks = s.inks.length ? s.inks.slice(0, 5) : ['#000000'];
    this.inks.fill(0);
    inks.forEach((c, i) => this.inks.set(hexToRgb(c), i * 3));
    gl.uniform3fv(u('uInks'), this.inks);
    gl.uniform1i(u('uInkCount'), inks.length);
    gl.uniform1f(u('uCycle'), rt.cycle);
    gl.uniform4f(u('uAudio'), rt.audio.bass, rt.audio.mid, rt.audio.high, rt.audio.level);
    gl.uniform1f(u('uPulse'), rt.pulse);
    gl.uniform1f(u('uWobble'), rt.wobble);
    gl.uniform1fv(u('uNum'), this.nums);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.fi = 1 - this.fi;

    // 3. to the screen, with grain + vignette
    const B = this.blitProg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(B.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, out.tex);
    gl.uniform1i(B.loc('uTex'), 0);
    gl.uniform2f(B.loc('uRes'), this.w, this.h);
    gl.uniform1f(B.loc('uGrain'), s.grain);
    gl.uniform1f(B.loc('uVignette'), s.vignette);
    gl.uniform1f(B.loc('uSeed'), Math.random());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
