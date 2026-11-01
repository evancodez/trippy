// GLSL for the three render passes:
//   1. DISP  – a low-res "distortion map" the mouse brushes paint into (smear, bulge, pinch, twist)
//   2. MAIN  – the pattern itself: position → ripples → warps → pattern → black/white → shading
//   3. BLIT  – copies to the screen with film grain + vignette
// The main shader is a template so Smart-mode formulas can be spliced in as GLSL.

export const MAX_WARPS = 6;
export const MAX_RIPPLES = 16;
export const MAX_NUMS = 24;

export const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const COMMON = `
#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// gradient noise, roughly -1..1
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(dot(hash22(i), f), dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  return n * 1.6;
}
float fbm(vec2 p) {
  float s = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) { s += amp * gnoise(p); p = rot(0.5) * p * 2.03 + 17.1; amp *= 0.5; }
  return s;
}
`;

// variables a formula can use (see formula.js)
const FX_PRELUDE = `float x = P.x, y = P.y, r = length(P), a = atan(P.y, P.x);
  float t = uTime, k = uParam, d = uDensity * PI;
  float bass = uAudio.x, mid = uAudio.y, high = uAudio.z, mx = uMouse.x, my = uMouse.y;`;

export function mainFrag({ value = 'sin(x * d)', bendX = '0.0', bendY = '0.0' } = {}) {
  return `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uRealTime;
uniform vec2 uMouse;
uniform vec2 uCenter;
uniform float uZoom;
uniform float uRot;

uniform int uPattern;
uniform float uDensity;
uniform float uThickness;
uniform float uParam;
uniform float uPatAngle;
uniform float uPhase;

uniform int uWarpCount;
uniform int uWarpType[${MAX_WARPS}];
uniform vec4 uWarpParam[${MAX_WARPS}];   // amount, scale, extra, phase

uniform sampler2D uDisp;
uniform vec4 uRipples[${MAX_RIPPLES}];   // x, y, startTime, strength
uniform float uRippleScale;

uniform float uSoft;
uniform float uDepth;
uniform float uRelief;
uniform float uEcho;
uniform float uFade;
uniform sampler2D uPrev;
uniform float uInvert;
uniform vec3 uPaper;
uniform vec3 uInks[5];
uniform int uInkCount;
uniform float uCycle;
uniform vec4 uAudio;                     // bass, mid, high, level
uniform float uPulse;
uniform float uWobble;
uniform float uNum[${MAX_NUMS}];         // every number typed into a formula

${COMMON}

// ---------- helpers available to formulas ----------
float f_pow(float a, float b) {
  float r = pow(abs(a), b);
  return (fract(b) == 0.0 && fract(b * 0.5) != 0.0) ? sign(a) * r : r;
}
float f_tri(float x) { return 1.0 - abs(fract(x / TAU + 0.25) - 0.5) * 4.0; }
float f_saw(float x) { return fract(x / TAU) * 2.0 - 1.0; }
float f_sq(float x) { return sin(x) >= 0.0 ? 1.0 : -1.0; }

float fx_value(vec2 P) {
  ${FX_PRELUDE}
  return (${value});
}
vec2 fx_bend(vec2 P) {
  ${FX_PRELUDE}
  return vec2(${bendX}, ${bendY});
}

// ---------- warps: each one pushes the sample position around ----------
vec2 warp(int type, vec4 w, vec2 p) {
  float amt = w.x, sc = w.y, ex = w.z, ph = w.w;
  if (type == 1) {                                   // wave
    float ang = ex * PI;
    vec2 dir = vec2(cos(ang), sin(ang));
    float f = mix(1.0, 26.0, sc * sc);
    return p + vec2(-dir.y, dir.x) * amt * 0.22 * sin(dot(p, dir) * f + ph * 2.5);
  }
  if (type == 2) {                                   // ripple
    float r = length(p);
    float f = mix(4.0, 70.0, sc * sc);
    float dd = amt * 0.07 * sin(r * f - ph * 4.0) * exp(-r * ex * 5.0) * smoothstep(0.0, 0.12, r);
    return p * (r + dd) / max(r, 1e-5);
  }
  if (type == 3) {                                   // twist
    float r = length(p);
    float R = mix(0.15, 1.6, sc);
    float f = mix(r / R, exp(-(r * r) / (R * R)), ex);
    return rot(amt * TAU * f * cos(ph * 1.2)) * p;
  }
  if (type == 4) {                                   // bulge
    vec2 c = ex * 0.55 * vec2(sin(ph * 0.71), sin(ph * 0.53 + 1.3));
    vec2 q = p - c;
    float R = mix(0.15, 1.3, sc);
    float s = length(q) / R;
    if (s >= 1.0) return p;
    float u = 1.0 - s * s;
    float breathe = 1.0 - 0.22 * (0.5 + 0.5 * sin(ph * 1.7));
    return c + q * (1.0 - clamp(amt * breathe, -1.0, 1.0) * 0.92 * u * u);
  }
  if (type == 5) {                                   // melt
    vec2 s = p * mix(0.6, 6.0, sc);
    vec2 o = vec2(fbm(s + vec2(0.0, ph * 0.35)), fbm(s + vec2(5.2, 1.3) - vec2(ph * 0.35, 0.0)));
    if (ex > 0.001) {
      vec2 o2 = vec2(fbm(s + o * 2.5 + vec2(1.7, 9.2)), fbm(s + o * 2.5 + vec2(8.3, 2.8)));
      o = mix(o, o2, ex);
    }
    return p + o * amt * 0.5;
  }
  if (type == 6) {                                   // tunnel
    float r = max(length(p), 1e-4);
    float ang = atan(p.y, p.x);
    float segs = floor(1.0 + sc * 15.99);
    float lr = -log(r) * 0.3;
    float depth = amt < 0.5 ? mix(r * 0.6, lr, amt * 2.0) : mix(lr, 0.12 / r, (amt - 0.5) * 2.0);
    vec2 o = vec2(ang / PI * segs / max(uDensity, 0.01), depth + ph * 0.2);
    o.x += o.y * ex;
    return o;
  }
  if (type == 7) {                                   // kaleidoscope
    float n = floor(2.0 + sc * 10.99);
    float r = length(p);
    float seg = TAU / n;
    float ang = mod(atan(p.y, p.x) + ph * 0.25, seg);
    ang = abs(ang - seg * 0.5);
    return r * vec2(cos(ang), sin(ang)) - vec2(amt * 0.5, 0.0);
  }
  if (type == 8) {                                   // fold
    float it = 1.0 + floor(ex * 4.99);
    mat2 m = rot(sc * PI + ph * 0.25);
    for (int i = 0; i < 5; i++) {
      if (float(i) >= it) break;
      p = m * (abs(p) - amt * 0.35);
    }
    return p;
  }
  if (type == 9) {                                   // floor
    float y = p.y - (sc - 0.5) * 0.9;
    float z = mix(0.04, 0.4, amt) / max(abs(y), 0.002);
    vec2 o = vec2(p.x * z, z + ph * 0.6);
    o.x += ex * z * z * 0.04;
    return o;
  }
  if (type == 10) {                                  // tiles
    float n = mix(1.0, 9.0, sc);
    vec2 g = p * n;
    vec2 id = floor(g + 0.5);
    vec2 f = g - id;
    float flip = mod(id.x + id.y, 2.0) * 2.0 - 1.0;
    f = rot(flip * (amt * PI * 0.5 + ph * 0.6)) * f;
    f *= 1.0 + ex * flip * 0.45;
    return f / n;
  }
  if (type == 11) {                                  // zigzag
    float ang = ex * PI;
    vec2 dir = vec2(cos(ang), sin(ang));
    float f = mix(1.0, 26.0, sc * sc);
    return p + vec2(-dir.y, dir.x) * amt * 0.22 * f_tri(dot(p, dir) * f + ph * 2.5);
  }
  return p;
}

// ---------- base patterns: return >0 for ink, <0 for paper ----------
float patternValue(vec2 p, out float band) {
  p = rot(uPatAngle) * p;
  vec2 q = p * uDensity;
  float ph = uPhase, k = uParam;
  band = 0.0;
  if (uPattern == 0) {                               // stripes
    float x = q.x - ph;
    band = floor(x * 0.5);
    return sin(x * PI) + k * 0.95 * sin(p.y * 4.0);
  }
  if (uPattern == 1) {                               // checkers
    q.y *= exp((k - 0.5) * 2.4);
    float x = q.x - ph;
    band = floor((floor(x) + floor(q.y)) * 0.5);
    return sin(x * PI) * sin(q.y * PI);
  }
  if (uPattern == 2) {                               // rings: diamond → circle → square
    float n = k < 0.5 ? mix(1.0, 2.0, k * 2.0) : mix(2.0, 12.0, pow((k - 0.5) * 2.0, 1.5));
    vec2 aq = abs(q) + 1e-6;
    float m = max(aq.x, aq.y);
    float x = m * pow(pow(aq.x / m, n) + pow(aq.y / m, n), 1.0 / n) - ph;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (uPattern == 3) {                               // spiral
    float arms = floor(1.0 + k * 7.99);
    float x = length(q) - ph + atan(q.y, q.x) * arms / PI;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (uPattern == 4) {                               // rays
    float n = max(2.0, floor(uDensity * 1.5));
    float x = (atan(p.y, p.x) * n + length(p) * k * 30.0) / PI - ph;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (uPattern == 5) {                               // dots
    vec2 c = q - vec2(ph, 0.0);
    vec2 id = floor(c + 0.5);
    band = id.x + id.y * 2.0;
    return (mix(0.08, 0.72, k) - length(c - id)) * 3.0;
  }
  if (uPattern == 6) {                               // grid
    q.x += q.y * (k - 0.5) * 2.0;
    float x = q.x - ph;
    band = floor(x * 0.5 + 0.5) + floor(q.y * 0.5 + 0.5);
    return (max(cos(x * PI), cos(q.y * PI)) - 0.6) * 2.0;
  }
  if (uPattern == 7) {                               // moiré
    vec2 o = mix(0.02, 0.6, k) * vec2(cos(ph * 0.5), sin(ph * 0.5));
    float r1 = length(p - o) * uDensity, r2 = length(p + o) * uDensity;
    band = floor(r1 * 0.5) + floor(r2 * 0.5);
    return sin(r1 * PI) * sin(r2 * PI) * 1.3;
  }
  if (uPattern == 8) {                               // zebra
    float x = fbm(p * mix(0.4, 3.0, k) + vec2(3.1, 7.7)) * uDensity * 1.2 - ph;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (uPattern == 9) {                               // triangles
    vec2 t = q - vec2(ph, 0.0);
    float a1 = t.y, a2 = dot(t, vec2(0.8660254, -0.5)), a3 = dot(t, vec2(-0.8660254, -0.5));
    band = floor(a1 * 0.5) + floor(a2 * 0.5);
    return sin(a1 * PI) * sin(a2 * PI) * sin(a3 * PI + k * PI) * 2.2;
  }
  band = floor(length(p) * uDensity * 0.25);         // formula
  return fx_value(p);
}

// Where does this screen pixel land in pattern-space, and what's the pattern value there?
float field(vec2 px, out float band, out vec2 pw) {
  vec2 uv = (px - 0.5 * uRes) / uRes.y;
  uv += texture(uDisp, px / uRes).xy;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = uRealTime - rp.z;
    if (age < 0.0 || age > 5.0) continue;
    vec2 rel = uv - rp.xy;
    float dist = length(rel);
    float front = age * 0.5;
    float width = 0.05 + age * 0.12;
    float env = exp(-pow((dist - front) / width, 2.0)) * exp(-age * 0.8);
    uv += rel / (dist + 1e-4) * sin((dist - front) / (0.025 * uRippleScale)) * env * rp.w * 0.045;
  }
  vec2 p = rot(uRot) * (uv - uCenter);
  p /= uZoom * (1.0 + uPulse);
  if (uWobble > 0.0) p.x += uWobble * 0.06 * sin(p.y * 9.0 + uTime * 4.0);
  for (int i = 0; i < ${MAX_WARPS}; i++) {
    if (i >= uWarpCount) break;
    p = warp(uWarpType[i], uWarpParam[i], p);
  }
  if (uPattern == 10) p += fx_bend(p);
  pw = p;
  return patternValue(p, band) - uThickness;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float band; vec2 pw;
  float v = field(px, band, pw);

  // crisp, anti-aliased black/white edge (softness blurs it into a gradient)
  float w = fwidth(v) * 0.75 + uSoft * uSoft * 1.5 + 1e-4;
  float ink = smoothstep(-w, w, v);
  ink = mix(ink, 1.0 - ink, uInvert);

  int bi = clamp(int(mod(band + floor(uCycle), float(uInkCount))), 0, 4);
  vec3 col = mix(uPaper, uInks[bi], ink);

  // fake depth: where the pattern is squeezed tight it reads as "far away", so fade it into shadow
  if (uDepth > 0.0) {
    float comp = min(length(dFdx(pw)), length(dFdy(pw))) * uRes.y * uZoom;
    float e = log2(max(comp, 1e-4));
    col *= exp(-max(e, 0.0) * uDepth * 0.9);
  }

  // fake 3D relief: treat ink as raised and light it from the top-left
  if (uRelief > 0.0) {
    float b2; vec2 p2;
    float vx = field(px + vec2(1.0, 0.0), b2, p2);
    float vy = field(px + vec2(0.0, 1.0), b2, p2);
    // more relief = rounder, tube-like ink instead of a thin bevel at the edges
    float bw = 0.3 + 0.7 * uRelief + uSoft;
    float h0 = smoothstep(-bw, bw, v), hx = smoothstep(-bw, bw, vx), hy = smoothstep(-bw, bw, vy);
    if (uInvert > 0.5) { h0 = 1.0 - h0; hx = 1.0 - hx; hy = 1.0 - hy; }
    float kk = uRes.y * 0.022 / bw;
    vec3 n = normalize(vec3((h0 - hx) * kk, (h0 - hy) * kk, 1.0));
    vec3 L = normalize(vec3(-0.5, 0.65, 0.75));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(reflect(-L, n).z, 0.0), 28.0);
    vec3 lit = col * (0.3 + 0.9 * diff) + vec3(spec) * 0.85 + pow(1.0 - n.z, 1.5) * 0.15;
    col = mix(col, lit, uRelief);
  }

  // echo trails: blend in the previous frame, slightly zoomed so trails stream outward
  float ech = max(uEcho, uFade);
  if (ech > 0.0) {
    vec2 c = px / uRes - 0.5;
    c = rot(0.003 * uEcho) * c * (1.0 - 0.012 * uEcho);
    col = mix(col, texture(uPrev, c + 0.5).rgb, ech * 0.93);
  }
  outColor = vec4(col, 1.0);
}
`;
}

export const DISP_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uPrevDisp;
uniform vec2 uDispRes;
uniform vec2 uBrushPos;
uniform vec2 uBrushVel;
uniform float uBrushSize;
uniform float uBrushStrength;
uniform int uBrushMode;      // 0 none, 1 smear, 2 bulge, 3 pinch, 4 twist
uniform float uRelax;
uniform float uAspect;
uniform int uClear;
void main() {
  if (uClear == 1) { outColor = vec4(0.0); return; }
  vec2 st = gl_FragCoord.xy / uDispRes;
  vec2 tx = 1.0 / uDispRes;
  vec2 d = texture(uPrevDisp, st).xy;
  vec2 avg = 0.25 * (texture(uPrevDisp, st + vec2(tx.x, 0.0)).xy + texture(uPrevDisp, st - vec2(tx.x, 0.0)).xy
                   + texture(uPrevDisp, st + vec2(0.0, tx.y)).xy + texture(uPrevDisp, st - vec2(0.0, tx.y)).xy);
  d = mix(d, avg, 0.3) * uRelax;
  vec2 rel = (st - 0.5) * vec2(uAspect, 1.0) - uBrushPos;
  float g = exp(-dot(rel, rel) / (uBrushSize * uBrushSize));
  float s = uBrushStrength;
  if (uBrushMode == 1) d -= uBrushVel * g * s * 1.1;
  else if (uBrushMode == 2) d = mix(d, -rel * 0.75 * s, g * 0.12);
  else if (uBrushMode == 3) d = mix(d, rel * 0.75 * s, g * 0.12);
  else if (uBrushMode == 4) d += vec2(-rel.y, rel.x) * g * s * 0.03;
  float m = length(d);
  if (m > 0.9) d *= 0.9 / m;
  outColor = vec4(d, 0.0, 1.0);
}
`;

export const BLIT_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uGrain;
uniform float uVignette;
uniform float uSeed;
${COMMON}
void main() {
  vec2 st = gl_FragCoord.xy / uRes;
  vec3 col = texture(uTex, st).rgb;
  vec2 c = (st - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(c) * 1.35);
  col += (hash12(gl_FragCoord.xy + uSeed * 137.0) - 0.5) * uGrain * 0.22;
  outColor = vec4(col, 1.0);
}
`;
