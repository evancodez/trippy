// The film world: one ray-marched scene.
//   · a membrane (the screen is a sheet of lines) with a height field: silk folds, ripples, a ghost face
//   · things pushing through it from behind: jointed hands, rising orbs — blended with a soft union,
//     so the lines stretch over them like fabric, or with a hard one so they break through
//   · a gyroid lattice the membrane can melt into and the camera can fly through
//   · the line equation painted on every surface: straight lines + rings + tunnel + spiral + cross lines
//     + moiré + contour slices, all weighted, so one equation morphs into the next
// Lighting can thin the ink in bright places (engraving), so 3D form is drawn with lines alone.
import { shaderDefines, SHADER_COUNT, SHADER_SLOTS } from './params.js';

const HAND_BASE = SHADER_SLOTS.findIndex(s => s.name === 'h0on');

export const FILM_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uP[${SHADER_COUNT}];
uniform sampler2D uPrev;
uniform sampler2D uDisp;
uniform vec4 uRipples[16];
uniform float uRipplesOn;   // skip the mouse-ripple loop when nothing was dropped recently
uniform float uStepK;       // how boldly the ray marcher may step (smaller when the membrane is steep)
uniform float uRealTime;

${shaderDefines()}
#define HAND_BASE ${HAND_BASE}
#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0; }
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash22(i), f), dot(hash22(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash22(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash22(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y) * 1.6;
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * gnoise(p); p = rot(0.5) * p * 2.03 + 17.1; a *= 0.5; } return s; }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / max(k, 1e-5); return min(a, b) - h * h * k * 0.25; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float g2(vec2 q, vec2 c, vec2 s) { vec2 d = (q - c) / s; return exp(-dot(d, d)); }

// ---------------------------------------------------------------- the ghost face (a relief: eyes and mouth are hollows)
float faceH(vec2 q) {
  float m = MOUTH, e = max(EYES, 0.08);
  float h = 0.55 * g2(q, vec2(0.0, 0.02), vec2(0.36, 0.48));
  h += 0.16 * g2(q, vec2(0.0, 0.13), vec2(0.30, 0.05));
  h -= 0.46 * (g2(q, vec2(-0.15, 0.045), vec2(0.085, 0.06 * e)) + g2(q, vec2(0.15, 0.045), vec2(0.085, 0.06 * e)));
  h += 0.32 * g2(q, vec2(0.0, -0.035), vec2(0.035, 0.11));
  h += 0.16 * g2(q, vec2(0.0, -0.13), vec2(0.06, 0.045));
  h += 0.12 * (g2(q, vec2(-0.2, -0.08), vec2(0.09, 0.07)) + g2(q, vec2(0.2, -0.08), vec2(0.09, 0.07)));
  h -= 0.30 * g2(q, vec2(0.0, -0.265), vec2(0.12, 0.016 + 0.055 * m));
  h += 0.09 * g2(q, vec2(0.0, -0.225 + 0.02 * m), vec2(0.13, 0.025));
  h += 0.09 * g2(q, vec2(0.0, -0.31 - 0.03 * m), vec2(0.11, 0.028));
  h += 0.16 * g2(q, vec2(0.0, -0.43), vec2(0.13, 0.075));
  return h;
}

// ---------------------------------------------------------------- the membrane's height
float heightField(vec2 q) {
  float h = 0.0;
  if (FOLDS > 0.0) {
    float f = FOLDF;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float a = fi * 1.7 + 0.4;
      h += sin(dot(q, vec2(cos(a), sin(a))) * f * (0.6 + 0.25 * fi) + PHASE * (0.35 + 0.1 * fi) + fi * 2.1) / (1.0 + fi * 0.7);
    }
    h *= FOLDS * 0.045;
  }
  if (RIPPLE > 0.0) {
    float r = length(q);
    h += RIPPLE * 0.035 * sin(r * 26.0 - RIPPHASE) * exp(-r * 1.2) * smoothstep(0.0, 0.1, r);
  }
  for (int i = 0; i < 16; i++) {                       // ripples dropped with the mouse
    if (uRipplesOn < 0.5) break;
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = uRealTime - rp.z;
    if (age < 0.0 || age > 5.0) continue;
    vec2 c = vec2(TX, TY) + rp.xy * 2.0 * FRAME;
    float d = length(q - c), front = age * 0.6 * FRAME;
    h += rp.w * 0.03 * FRAME * sin((d - front) * 40.0 / FRAME) * exp(-pow((d - front) / (0.08 * FRAME + age * 0.1 * FRAME), 2.0)) * exp(-age * 0.9);
  }
  if (FACE > 0.0) h += FACE * faceH((q - vec2(FACEX, FACEY)) / FACES) * FACES * 0.32;
  return h * HEIGHT;
}

// ---------------------------------------------------------------- hands, reaching
float handSDF(vec3 p, float curl, float spread) {
  float d = sdRoundBox(p - vec3(0.0, -0.01, 0.0), vec3(0.068, 0.08, 0.017), 0.03);
  d = smin(d, sdCapsule(p, vec3(-0.035, -0.08, 0.0), vec3(0.04, -0.085, 0.0), 0.045), 0.04);   // heel of the palm
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float len = (i == 0 ? 0.95 : i == 1 ? 1.06 : i == 2 ? 0.99 : 0.78) * 0.245;
    float c = curl * (1.0 + 0.12 * (fi - 1.5));
    vec3 a = vec3(-0.066 + fi * 0.044, 0.085, 0.0);
    vec3 dir = normalize(vec3((fi - 1.5) * spread * 0.2, 1.0, 0.0));
    float r = 0.0235 - fi * 0.0013;
    float seg = 0.46;
    for (int j = 0; j < 3; j++) {
      dir.yz = rot(c * (j == 0 ? 0.55 : 0.95)) * dir.yz;
      vec3 b = a + dir * len * seg;
      d = smin(d, sdCapsule(p, a, b, r), 0.016);
      a = b; r *= 0.9; seg = j == 0 ? 0.32 : 0.23;
    }
  }
  vec3 a = vec3(0.07, -0.055, 0.012);
  vec3 dir = normalize(vec3(0.85, 0.6, 0.3));
  float r = 0.028;
  for (int j = 0; j < 2; j++) {
    dir.xy = rot(curl * 0.6) * dir.xy;
    dir.yz = rot(curl * 0.35) * dir.yz;
    vec3 b = a + dir * (j == 0 ? 0.095 : 0.075);
    d = smin(d, sdCapsule(p, a, b, r), 0.018);
    a = b; r *= 0.85;
  }
  return smin(d, sdCapsule(p, vec3(0.0, -0.1, -0.01), vec3(0.0, -0.32, -0.42), 0.058), 0.05);
}

float hands(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < 3; i++) {
    int b = HAND_BASE + i * 8;
    float on = uP[b];
    if (on <= 0.001) continue;
    float s = uP[b + 4];
    vec3 pos = vec3(uP[b + 1], uP[b + 2], mix(-0.75 * s, uP[b + 3], on));
    vec3 q = (p - pos) / s;
    float bound = length(q - vec3(0.0, 0.03, -0.12)) - 0.42;
    if (bound * s > HANDSOFT + 0.06 * s) { d = min(d, bound * s); continue; }   // far away: the cheap bound is enough
    q.xy = rot(-uP[b + 5]) * q.xy;
    q.yz = rot(-0.3) * q.yz;
    d = min(d, handSDF(q, uP[b + 6], uP[b + 7]) * s);
  }
  return d;
}

// ---------------------------------------------------------------- orbs and the lattice
float orbsSDF(vec3 p) {
  float n = ORBN;
  vec2 g = p.xy * n, id = floor(g + 0.5);
  vec2 f = (g - id) / n;
  float R = 0.36 / n;
  float rise = ORBS * (0.55 + 0.45 * sin(PHASE * 0.9 + id.x * 0.75 + id.y * 0.55));
  return length(vec3(f, p.z - R * (rise * 1.6 - 1.0))) - R;
}
// gyroid (organic) ↔ Schwarz-P (round portals with open channels you can fly down)
float gyroid(vec3 p) {
  vec3 q = p * GYROS + vec3(0.0, 1.5708, 0.0);
  float g = abs(dot(sin(q), cos(q.yzx))) - 0.22;
  vec3 s = p * GYROS;
  float pp = abs(cos(s.x) + cos(s.y) + cos(s.z)) - 0.35;
  return mix(g, pp * 0.8, GYROTYPE) / GYROS * 0.7;
}

float map(vec3 p) {
  float d = (p.z - heightField(p.xy)) * uStepK;
  if (GYRO > 0.001) d = mix(d, gyroid(p), GYRO);
  if (ORBS > 0.001) d = smin(d, orbsSDF(p), 0.04);
  return smin(d, hands(p), HANDSOFT);
}

vec3 calcNormal(vec3 p, float t) {
  vec2 e = vec2(1.0, -1.0) * 0.0006 * max(1.0, t);
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// ---------------------------------------------------------------- the line equation
float lines(vec2 q, float z, out float rr) {
  q = rot(FROT) * q;
  float r = length(q);
  if (TWIST != 0.0) q = rot(TWIST * exp(-r * r * 1.6)) * q;
  if (BULGE != 0.0) q *= 1.0 - clamp(BULGE, -1.0, 1.0) * 0.85 * exp(-r * r * 3.5);
  if (WAVE != 0.0) q.x += WAVE * 0.06 * sin(q.y * WAVEF + PHASE * 0.6);
  if (WARPN > 0.0) q += WARPN * 0.22 * vec2(fbm(q * 1.8 + vec2(0.0, PHASE * 0.05)), fbm(q * 1.8 + vec2(7.3, -PHASE * 0.05)));
  if (KALEIDO > 0.0) {
    float seg = TAU / floor(KALEIDON + 0.5);
    float af = abs(mod(atan(q.y, q.x), seg) - seg * 0.5);
    q = mix(q, length(q) * vec2(cos(af), sin(af)), KALEIDO);
  }
  r = length(q);
  rr = r;
  float ang = atan(q.y, q.x);
  float L = dot(q, vec2(cos(LINA), sin(LINA)));
  float R = mix(r, -log(max(r, 1e-4)) * 0.3, RADLOG);
  R = mix(R, 0.09 / max(r, 2e-3), RADINV);
  float base = (WLIN * L + WRAD * R + CONTOUR * z * 2.5) * FREQ - PHASE;
  float v = sin(base * PI);
  if (WANG > 0.0) v = mix(v, sin(base * PI + ang * floor(SPOKES + 0.5)), WANG);
  if (CHECK > 0.0) {
    float lin2 = sin((dot(q, vec2(cos(LINA + CHECKA), sin(LINA + CHECKA))) * FREQ - PHASE * 0.5) * PI);
    float pol2 = sin(ang * floor(SPOKES + 0.5) + PHASE * 0.3);
    v *= mix(1.0, mix(lin2, pol2, CHECKPOLAR), CHECK);
  }
  if (MOIRE > 0.0) {
    vec2 o = MOIREOFF * 0.5 * vec2(cos(PHASE * 0.15), sin(PHASE * 0.15));
    v *= mix(1.0, sin(length(q - o) * FREQ * PI), MOIRE);
  }
  return v;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = (px - 0.5 * uRes) / uRes.y;
  uv += texture(uDisp, px / uRes).xy;

  // camera: orbit around the target; FRAME keeps the membrane the same size whatever the lens
  mat3 M = mat3(1.0);
  float cp = cos(PITCH), sp = sin(PITCH), cy = cos(YAW), sy = sin(YAW);
  vec3 right = vec3(cy, sy, 0.0);
  vec3 up = vec3(-sy * cp, cy * cp, sp);
  vec3 back = vec3(sy * sp, -cy * sp, cp);
  vec2 ru = rot(ROLL) * vec2(1.0, 0.0);
  vec3 r2 = right * ru.x + up * ru.y, u2 = -right * ru.y + up * ru.x;
  float dist = 2.0 * FRAME * FOCAL;
  vec3 target = vec3(TX, TY, 0.0);
  vec3 ro = target + back * dist - back * FLY;
  vec3 rd = normalize(r2 * uv.x + u2 * uv.y - back * FOCAL);

  float t = 0.0, d = 1.0;
  float far = dist * 3.0 + 14.0;
  bool hit = false;
  for (int i = 0; i < 140; i++) {
    vec3 p = ro + rd * t;
    d = map(p);
    if (d < 0.0005 * t + 0.0003) { hit = true; break; }
    t += d;
    if (t > far) break;
  }
  if (!hit && t < far) hit = true;   // ran out of steps grazing a surface: close enough

  vec3 paper = vec3(PAPER_R, PAPER_G, PAPER_B), ink = vec3(INK_R, INK_G, INK_B), fog = vec3(FOG_R, FOG_G, FOG_B);
  vec3 col = fog;
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p, t);
    float rr;
    float v = lines(p.xy + n.xy * REFRACT * 0.12, p.z, rr);   // refraction: lines bend over the relief
    if (STAT > 0.0) {
      float sn = (hash12(floor(px / 2.0) + floor(TIME * 20.0) * vec2(17.31, 41.7)) - 0.5) * 2.6 + 0.3 * sin(px.y / uRes.y * 7.0 - TIME * 2.0);
      v = mix(v, sn, STAT);
    }
    vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
    float diff = max(dot(n, L), 0.0);
    float amb = 0.5 + 0.5 * n.z;
    v -= (diff - 0.6) * ENGRAVE * 1.4;                       // light thins the ink: form drawn with lines
    v -= THICK;
    float w = (STAT > 0.5 ? 0.04 : fwidth(v) * 0.8) + 1e-3;
    float k = smoothstep(-w, w, v);
    k = mix(k, 1.0 - k, INVERT);
    col = mix(paper, ink, k);
    float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 40.0);
    col = mix(col, col * (0.25 + 0.55 * amb + 0.55 * diff) + spec * 0.3, LIGHT);
    col = mix(fog, col, exp(-max(t - dist * 0.8, 0.0) * FOGD));
    col = mix(fog, col, mix(1.0, smoothstep(0.0, 0.5, rr), CFOG));
  }

  col *= 1.0 + EXPOSURE;
  if (ECHO > 0.0) {
    vec2 c = px / uRes - 0.5;
    col = mix(col, texture(uPrev, c * (1.0 - 0.012 * ECHO) + 0.5).rgb, ECHO * 0.93);
  }
  outColor = vec4(max(col, 0.0), 1.0);
}
`;
