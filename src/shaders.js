// GLSL for the render passes:
//   1. DISP  – a low-res "distortion map" the mouse brushes paint into (smear, bulge, pinch, twist)
//   2. SCENE – the pattern itself: position → ripples → warps → pattern(s) → black/white → shading
//   3. COMP  – mixes up to two scenes (music-video transitions) and adds the film look:
//              halation glow, color split, flicker, gate weave, letterbox, grain, vignette
// The scene shader is a template so Smart-mode formulas can be spliced in as GLSL.

export const MAX_WARPS = 8;
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

// second pattern layer, merged with the first
uniform int uP2Type;
uniform vec4 uP2;          // density, param, angle, phase
uniform int uP2Mode;       // 0 off, 1 xor, 2 and, 3 or, 4 add, 5 inside 3D shapes
uniform float uP2Flat;     // 1 = layer 2 ignores the warps

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
uniform vec3 uFog;
uniform vec4 uAudio;                     // bass, mid, high, level
uniform vec2 uFaceCtl;                   // mouth open, eyes open
uniform float uPulse;
uniform float uWobble;
uniform float uNum[${MAX_NUMS}];         // every number typed into a formula

${COMMON}

// 3D-ish warps leave notes here for the shading step
float gShade;   // light (1 = untouched)
float gThick;   // extra ink (halftone shading)
float gMask;    // 1 inside a 3D shape (sphere, face)
float gFlip;    // 1 = invert black/white here

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

const vec3 LIGHT = vec3(-0.42, 0.58, 0.70);

// ---------- the ghost: an abstract face as a height field (eyes + mouth are hollows) ----------
float g2(vec2 q, vec2 c, vec2 s) { vec2 d = (q - c) / s; return exp(-dot(d, d)); }
float faceH(vec2 q) {
  float mouth = uFaceCtl.x, eyes = max(uFaceCtl.y, 0.08);
  float h = 0.55 * g2(q, vec2(0.0, 0.02), vec2(0.36, 0.48));                      // skull / dome
  h += 0.16 * g2(q, vec2(0.0, 0.13), vec2(0.30, 0.05));                            // brow ridge
  h -= 0.46 * (g2(q, vec2(-0.15, 0.045), vec2(0.085, 0.06 * eyes))
             + g2(q, vec2(0.15, 0.045), vec2(0.085, 0.06 * eyes)));                // eye hollows
  h += 0.10 * (g2(q, vec2(-0.15, 0.045), vec2(0.03, 0.022 * eyes))
             + g2(q, vec2(0.15, 0.045), vec2(0.03, 0.022 * eyes)));                // a glint of eye
  h += 0.32 * g2(q, vec2(0.0, -0.035), vec2(0.035, 0.11));                         // nose bridge
  h += 0.16 * g2(q, vec2(0.0, -0.13), vec2(0.06, 0.045));                          // nose tip
  h += 0.12 * (g2(q, vec2(-0.2, -0.08), vec2(0.09, 0.07)) + g2(q, vec2(0.2, -0.08), vec2(0.09, 0.07))); // cheekbones
  h -= 0.30 * g2(q, vec2(0.0, -0.265), vec2(0.12, 0.016 + 0.055 * mouth));         // mouth hollow
  h += 0.09 * g2(q, vec2(0.0, -0.225 + 0.02 * mouth), vec2(0.13, 0.025));          // upper lip
  h += 0.09 * g2(q, vec2(0.0, -0.31 - 0.03 * mouth), vec2(0.11, 0.028));           // lower lip
  h += 0.16 * g2(q, vec2(0.0, -0.43), vec2(0.13, 0.075));                          // chin
  return h;
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
  if (type == 12) {                                  // sway: a pendulum swing, one cycle per unit of phase
    vec2 pivot = vec2(0.0, sc * 1.6);
    vec2 q = rot(amt * 0.35 * sin(ph * TAU)) * (p - pivot);
    q.x += ex * 0.12 * sin(ph * TAU - q.y * 3.0);
    return q + pivot;
  }
  if (type == 13) {                                  // cloth: silky folds, lit from the top-left
    float f = mix(4.0, 22.0, sc);
    vec2 g = vec2(0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float ang = fi * 1.7 + 0.4;
      vec2 k = vec2(cos(ang), sin(ang)) * f * (0.6 + 0.25 * fi);
      float a = 1.0 / (1.0 + fi * 0.7);
      g += a * cos(dot(p, k) + ph * (1.0 + 0.3 * fi) + fi * 2.1) * k;
    }
    vec3 n = normalize(vec3(-g * amt * 0.06, 1.0));
    gShade *= mix(1.0, 0.2 + 1.05 * max(dot(n, normalize(LIGHT)), 0.0), ex);
    return p + g * amt * 0.007;
  }
  if (type == 14) {                                  // sphere: a real 3D ball wearing the pattern
    float R = mix(0.15, 0.95, sc);
    float r = length(p);
    float inside = smoothstep(R + 1.5 / uRes.y, R - 1.5 / uRes.y, r);
    gMask = max(gMask, inside);
    gFlip = mix(ex, gFlip, inside);
    if (r >= R) return p;
    vec3 nrm = vec3(p, sqrt(R * R - r * r)) / R;
    float cy = cos(ph), sy = sin(ph);
    vec3 o = vec3(cy * nrm.x + sy * nrm.z, nrm.y, -sy * nrm.x + cy * nrm.z);
    o = vec3(o.x, 0.94 * o.y - 0.34 * o.z, 0.34 * o.y + 0.94 * o.z);
    float segs = max(2.0, floor(uDensity * R * 1.2));
    float light = max(dot(nrm, normalize(LIGHT)), 0.0);
    gShade *= mix(1.0, 0.15 + 0.95 * light + pow(light, 30.0) * 0.7, amt);
    return vec2(atan(o.x, o.z) / PI * segs / max(uDensity, 0.01), asin(clamp(o.y, -1.0, 1.0)) * R * 1.3);
  }
  if (type == 15) {                                  // tilt: the whole sheet as a plane in 3D
    float pit = amt * 1.35 + 0.22 * sin(ph);
    float f = mix(0.8, 3.0, sc);
    float cp = cos(pit), sp = sin(pit);
    vec3 U = vec3(1.0, 0.0, 0.0), V = vec3(0.0, cp, sp), N = vec3(0.0, -sp, cp);
    mat2 ry = rot(ex * PI);
    U.xy = ry * U.xy; V.xy = ry * V.xy; N.xy = ry * N.xy;
    vec3 d = vec3(p, f);
    float dn = dot(d, N);
    float t = f * N.z / dn;
    if (t <= 0.0 || abs(dn) < 1e-4) { gShade = 0.0; return p * 60.0; }
    vec3 hit = vec3(0.0, 0.0, -f) + t * d;
    gShade *= exp(-max(t - 1.0, 0.0) * 0.12);
    return vec2(dot(hit, U), dot(hit, V));
  }
  if (type == 16) {                                  // face: the ghost pressing through the pattern
    float S = mix(0.45, 2.4, sc);
    vec2 q = rot(0.13 * sin(ph * TAU)) * p / S;
    q.y -= 0.015 * sin(ph * TAU * 2.0);
    float e = 0.006;
    float h = faceH(q), hx = faceH(q + vec2(e, 0.0)), hy = faceH(q + vec2(0.0, e));
    vec2 g = vec2(hx - h, hy - h) / e;
    vec3 n = normalize(vec3(-g * amt * 0.55, 1.0));
    float light = dot(n, normalize(LIGHT));
    float head = smoothstep(1.25, 0.75, length(q / vec2(0.40, 0.52)));
    gMask = max(gMask, head);
    gShade *= mix(1.0, 0.4 + 0.8 * light, min(abs(amt), 1.0) * 0.8);
    gThick += ((0.78 - light) * 1.3 - h * 0.25 * sign(amt)) * ex * min(abs(amt), 1.0) * head;
    return p + g * amt * 0.0065 * S;
  }
  if (type == 17) {                                  // lenses: a grid of glass balls
    float n = mix(1.5, 10.0, sc);
    vec2 g = p * n;
    vec2 id = floor(g + 0.5);
    vec2 q = g - id;
    float s = length(q) * 2.0;
    if (s < 1.0) {
      float a = amt * 0.92 * (0.65 + 0.35 * sin(ph * 2.0 + id.x * 0.9 + id.y * 1.3));
      float u = 1.0 - s * s;
      vec3 nrm = normalize(vec3(q * 2.0, sqrt(u)));
      gShade *= mix(1.0, 0.25 + 0.95 * max(dot(nrm, normalize(LIGHT)), 0.0), ex);
      q *= 1.0 - a * u * u;
    } else gShade *= 1.0 - 0.5 * ex;
    return (id + q) / n;
  }
  if (type == 18) {                                  // glitch: tearing scan lines
    float fr = floor(ph * 6.0);
    float row = floor(p.y * mix(6.0, 80.0, sc));
    float on = step(1.0 - amt * 0.6, hash12(vec2(row, fr)));
    p.x += on * (hash12(vec2(row * 1.7, fr + 3.1)) - 0.5) * 0.4 * (0.3 + ex);
    float blk = step(1.0 - amt * 0.25, hash12(vec2(floor(p.y * 3.0), fr * 1.3 + 7.0)));
    return p + blk * vec2(0.12 * (hash12(vec2(fr, 2.0)) - 0.5), 0.0);
  }
  return p;
}

// ---------- base patterns: return >0 for ink, <0 for paper ----------
float patternValue(int type, vec2 p, float dens, float k, float ang, float ph, out float band) {
  p = rot(ang) * p;
  vec2 q = p * dens;
  band = 0.0;
  if (type == 0) {                                   // stripes
    float x = q.x - ph;
    band = floor(x * 0.5);
    return sin(x * PI) + k * 0.95 * sin(p.y * 4.0);
  }
  if (type == 1) {                                   // checkers
    q.y *= exp((k - 0.5) * 2.4);
    float x = q.x - ph;
    band = floor((floor(x) + floor(q.y)) * 0.5);
    return sin(x * PI) * sin(q.y * PI);
  }
  if (type == 2) {                                   // rings: diamond → circle → square
    float n = k < 0.5 ? mix(1.0, 2.0, k * 2.0) : mix(2.0, 12.0, pow((k - 0.5) * 2.0, 1.5));
    vec2 aq = abs(q) + 1e-6;
    float m = max(aq.x, aq.y);
    float x = m * pow(pow(aq.x / m, n) + pow(aq.y / m, n), 1.0 / n) - ph;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (type == 3) {                                   // spiral
    float arms = floor(1.0 + k * 7.99);
    float x = length(q) - ph + atan(q.y, q.x) * arms / PI;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (type == 4) {                                   // rays
    float n = max(2.0, floor(dens * 1.5));
    float x = (atan(p.y, p.x) * n + length(p) * k * 30.0) / PI - ph;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (type == 5) {                                   // dots
    vec2 c = q - vec2(ph, 0.0);
    vec2 id = floor(c + 0.5);
    band = id.x + id.y * 2.0;
    return (mix(0.08, 0.72, k) - length(c - id)) * 3.0;
  }
  if (type == 6) {                                   // grid
    q.x += q.y * (k - 0.5) * 2.0;
    float x = q.x - ph;
    band = floor(x * 0.5 + 0.5) + floor(q.y * 0.5 + 0.5);
    return (max(cos(x * PI), cos(q.y * PI)) - 0.6) * 2.0;
  }
  if (type == 7) {                                   // moiré
    vec2 o = mix(0.02, 0.6, k) * vec2(cos(ph * 0.5), sin(ph * 0.5));
    float r1 = length(p - o) * dens, r2 = length(p + o) * dens;
    band = floor(r1 * 0.5) + floor(r2 * 0.5);
    return sin(r1 * PI) * sin(r2 * PI) * 1.3;
  }
  if (type == 8) {                                   // zebra
    float x = fbm(p * mix(0.4, 3.0, k) + vec2(3.1, 7.7)) * dens * 1.2 - ph;
    band = floor(x * 0.5);
    return sin(x * PI);
  }
  if (type == 9) {                                   // triangles
    vec2 t = q - vec2(ph, 0.0);
    float a1 = t.y, a2 = dot(t, vec2(0.8660254, -0.5)), a3 = dot(t, vec2(-0.8660254, -0.5));
    band = floor(a1 * 0.5) + floor(a2 * 0.5);
    return sin(a1 * PI) * sin(a2 * PI) * sin(a3 * PI + k * PI) * 2.2;
  }
  if (type == 11) {                                  // static: TV snow with a slow rolling bar
    vec2 cell = floor(q * mix(3.0, 0.5, k));
    float frame = floor(uTime * 18.0);
    band = 0.0;
    return (hash12(cell + frame * vec2(17.31, 41.7)) - 0.5) * 2.0 + 0.25 * sin(p.y * 2.5 - uTime * 1.3) + ph * 0.0;
  }
  if (type == 12) {                                  // cells: contour rings around drifting seeds
    vec2 g = floor(q * 0.25), f = fract(q * 0.25);
    float d1 = 9.0;
    vec2 best = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = hash22(g + o);
      vec2 pt = o + 0.5 + 0.38 * sin(ph * 0.5 + h * TAU);
      float d = length(pt - f);
      if (d < d1) { d1 = d; best = g + o; }
    }
    float x = d1 * mix(3.0, 9.0, k) - ph;
    band = floor(hash12(best) * 7.0);
    return sin(x * PI);
  }
  if (type == 13) {                                  // hex: honeycomb of concentric hexagons
    vec2 s = vec2(1.0, 1.7320508);
    vec2 h = q * 0.35;
    vec4 hc = floor(vec4(h, h - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 hl = vec4(h - hc.xy * s, h - (hc.zw + 0.5) * s);
    bool first = dot(hl.xy, hl.xy) < dot(hl.zw, hl.zw);
    vec2 hp = first ? hl.xy : hl.zw;
    vec2 id = first ? hc.xy : hc.zw + 0.5;
    vec2 ap = abs(hp);
    float hd = max(dot(ap, s * 0.5), ap.x);
    float x = hd * mix(2.0, 10.0, k) * 2.0 - ph;
    band = floor(hash12(id * 7.1) * 7.0);
    return sin(x * PI);
  }
  band = floor(length(p) * dens * 0.25);             // formula
  return fx_value(p);
}

// Where does this screen pixel land in pattern-space, and what's the pattern value there?
float field(vec2 px, out float band, out vec2 pw) {
  gShade = 1.0; gThick = 0.0; gMask = 0.0; gFlip = 0.0;
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
  vec2 flatP = p;
  if (uWobble > 0.0) p.x += uWobble * 0.06 * sin(p.y * 9.0 + uTime * 4.0);
  for (int i = 0; i < ${MAX_WARPS}; i++) {
    if (i >= uWarpCount) break;
    p = warp(uWarpType[i], uWarpParam[i], p);
  }
  if (uPattern == 10) p += fx_bend(p);
  pw = p;
  float v = patternValue(uPattern, p, uDensity, uParam, uPatAngle, uPhase, band);
  if (uP2Mode > 0) {
    float b2;
    float v2 = patternValue(uP2Type, mix(p, flatP, uP2Flat), uP2.x, uP2.y, uP2.z, uP2.w, b2);
    if (uP2Mode == 1) v = v * v2 * 1.5;
    else if (uP2Mode == 2) v = min(v, v2);
    else if (uP2Mode == 3) v = max(v, v2);
    else if (uP2Mode == 4) v = (v + v2) * 0.7;
    else { v = mix(v, v2, gMask); band = gMask > 0.5 ? b2 + 1.0 : band; }
  }
  return v - uThickness + gThick;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float band; vec2 pw;
  float v = field(px, band, pw);
  float shade = gShade, flip = gFlip;

  // crisp, anti-aliased black/white edge (softness blurs it into a gradient)
  float w = (uPattern == 11 ? 0.02 : fwidth(v) * 0.75) + uSoft * uSoft * 1.5 + 1e-4;
  float ink = smoothstep(-w, w, v);
  ink = mix(ink, 1.0 - ink, abs(uInvert - flip));

  int bi = clamp(int(mod(band + floor(uCycle), float(uInkCount))), 0, 4);
  vec3 col = mix(uPaper, uInks[bi], ink);
  col = mix(uFog, col, clamp(shade, 0.0, 1.0)) * max(shade, 1.0);

  // fake depth: where the pattern is squeezed tight it reads as "far away", so fade it into the fog
  if (uDepth > 0.0) {
    float comp = min(length(dFdx(pw)), length(dFdy(pw))) * uRes.y * uZoom;
    col = mix(uFog, col, exp(-max(log2(max(comp, 1e-4)), 0.0) * uDepth * 0.9));
  }

  // fake 3D relief: treat ink as raised and light it from the top-left
  if (uRelief > 0.0) {
    float b2; vec2 p2;
    float vx = field(px + vec2(1.0, 0.0), b2, p2);
    float vy = field(px + vec2(0.0, 1.0), b2, p2);
    float bw = 0.3 + 0.7 * uRelief + uSoft;
    float h0 = smoothstep(-bw, bw, v), hx = smoothstep(-bw, bw, vx), hy = smoothstep(-bw, bw, vy);
    if (abs(uInvert - flip) > 0.5) { h0 = 1.0 - h0; hx = 1.0 - hx; hy = 1.0 - hy; }
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

// A separable gaussian blur, run in floating point: it turns an 8-bit picture into a smooth relief.
export const BLUR_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec2 uRes;
uniform float uSigma;
void main() {
  vec2 st = gl_FragCoord.xy / uRes;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  float stride = max(1.0, uSigma / 4.0);
  for (int i = -12; i <= 12; i++) {
    float x = float(i) * stride;
    float w = exp(-x * x / (2.0 * uSigma * uSigma));
    acc += texture(uSrc, st + uDir * x / uRes) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}
`;

// Mixes scene A and B with a transition, then adds the film look.
export const COMP_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uHasB;
uniform float uMix;
uniform int uTrans;          // 0 dissolve, 1 iris, 2 rings, 3 blinds, 4 flash, 5 ink, 6 cut
uniform vec3 uFlashCol;
uniform vec2 uRes;
uniform float uSeed;
uniform float uGrain;
uniform float uVignette;
uniform float uGlow;
uniform vec3 uGlowTint;
uniform float uAberr;
uniform float uFlicker;
uniform float uWeave;
uniform float uLetterbox;
${COMMON}

vec3 scene(sampler2D t, vec2 st) {
  if (uAberr <= 0.0) return texture(t, st).rgb;
  vec2 off = (st - 0.5) * uAberr * 0.012;
  return vec3(texture(t, st + off).r, texture(t, st).g, texture(t, st - off).b);
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 st = gl_FragCoord.xy / uRes;
  st += (vec2(hash12(vec2(uSeed * 91.0, 1.0)), hash12(vec2(uSeed * 57.0, 2.0))) - 0.5) * uWeave * 0.006;
  vec2 c = (st - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 a = scene(uA, st);
  vec3 col = a;
  vec3 glow = textureLod(uA, st, 5.0).rgb + textureLod(uA, st, 3.5).rgb * 0.5;
  if (uHasB > 0.5) {
    vec3 b = scene(uB, st);
    float m = uMix, len = length(c);
    if (uTrans == 1) m = smoothstep(uMix * 1.25, uMix * 1.25 - 0.06, len);
    else if (uTrans == 2) m = smoothstep(0.0, 0.06, uMix * 1.7 - len * 0.95 - (0.5 + 0.5 * sin(len * 46.0)) * 0.45);
    else if (uTrans == 3) m = step(fract(st.y * 14.0 + st.x * 0.0), uMix * 1.02);
    else if (uTrans == 4 || uTrans == 6) m = step(0.5, uMix);
    else if (uTrans == 5) m = smoothstep(lum(a) * 0.8 - 0.1, lum(a) * 0.8 + 0.1, uMix * 1.2 - 0.1);
    col = mix(a, b, m);
    glow = mix(glow, textureLod(uB, st, 5.0).rgb + textureLod(uB, st, 3.5).rgb * 0.5, m);
    if (uTrans == 4) col += uFlashCol * pow(1.0 - abs(uMix * 2.0 - 1.0), 3.0) * 1.4;
  }
  // halation: the bright parts bleed a soft, tinted glow (red, like film)
  col += pow(glow, vec3(1.8)) * uGlowTint * uGlow * 0.6;
  col *= 1.0 + (hash12(vec2(uSeed * 13.0, 5.0)) - 0.5) * uFlicker * 0.22;
  col *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(c) * 1.35);
  col += (hash12(gl_FragCoord.xy + uSeed * 137.0) - 0.5) * uGrain * 0.22;
  float bar = 0.5 - uLetterbox * 0.13;
  col *= smoothstep(bar + 0.002, bar - 0.002, abs(st.y - 0.5));
  outColor = vec4(col, 1.0);
}
`;
