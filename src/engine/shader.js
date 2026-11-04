// The world: one ray-marched scene that can lie flat (2D op art) or open up into 3D.
//   · a sheet of lines with a height field: folds, ripples, a ghost face, the sound's landscape, and a
//     picture (camera, image, video, words) pressing up from underneath
//   · things pushing through it: jointed hands (a mirrored pair, or yours), rising orbs, objects, and a
//     chrome ball the lines part around — soft unions, so the lines stretch over them like fabric
//   · spaces the sheet can melt into and the camera can fly through: a lattice, a Menger sponge, fractal
//     crystals, a corridor; a colonnade; or the floor drops away and shapes float in the dark
//   · one line equation painted on every surface: straight lines + rings + tunnel + spiral + checkers +
//     triangles + moiré + contours, all weighted, so one look re-forms into the next
// Lighting can thin the ink where it's bright (engraving), so 3D form is drawn with lines alone.
import { shaderDefines, SHADER_COUNT, SHADER_SLOTS } from './params.js';
import { figuresGLSL } from './figures.js';

const HAND_BASE = SHADER_SLOTS.findIndex(s => s.name === 'h0on');

// the world's shader, able to draw these figures (only the ones on screen are compiled in)
export const worldFrag = (figures = []) => `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uP[${SHADER_COUNT}];
uniform sampler2D uPrev;
uniform sampler2D uDisp;
uniform sampler2D uMedia;      // relief source, blurred: rgb = picture, a = mask (body / face / hands / a box)
uniform sampler2D uMediaSharp; // the same picture unblurred at full size: the photo and the engraving
uniform sampler2D uSound;      // row 0: the live waveform (0.5 = silence); rows 1–64: the spectrum's past; 65–128: the waveform's past
uniform float uMediaAspect;
uniform vec4 uRipples[16];
uniform float uRipplesOn;      // skip the mouse-ripple loop when nothing was dropped recently
uniform float uStepK;          // how boldly the ray marcher may step (smaller when the membrane is steep)
uniform float uRealTime;
uniform float uFinger[15];     // per-finger curl offsets, 5 per hand (thumb, index, middle, ring, pinky)
uniform float uHandMirror[3];  // 1 or -1: left or right hand
uniform vec4 uTwists[4];       // the endless twist: centre (screen), angle (keeps growing while held), radius

${shaderDefines()}
#define HAND_BASE ${HAND_BASE}
#define PI 3.14159265359
#define TAU 6.28318530718

uniform vec3 gRight, gUp, gBack;   // the camera's frame, worked out on the CPU (renderer.js); the impossible triangle is built from it
float gCalm = 1.0;             // 0 inside you when "keep it still inside" is on: the warps leave you alone
float gAura = 0.0;             // how far the lines are pushed around you
float gBand = 0.0;             // 0 / 1: which ink this line gets (every other line in the second ink)
float gBallH = 0.0;            // the sheet's height under the ball (once per pixel)

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0; }
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash22(i), f), dot(hash22(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash22(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash22(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y) * 1.6;
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * gnoise(p); p = rot(0.5) * p * 2.03 + 17.1; a *= 0.5; } return s; }
// the sound: x 0..1 along the waveform → −1..1, now or some time ago (0 now .. 1 ≈ 2 s); the spectrum at
// f 0..1 (bass → treble), age 0 (now) .. 1 (2.7 s ago); and how loud it was, age ago
float soundWave(float x) { return (texture(uSound, vec2(x, 0.5 / 129.0)).r - 0.5) * 2.0; }
float soundWaveAt(float x, float age) { return (texture(uSound, vec2(x, (65.5 + clamp(age, 0.0, 1.0) * 63.0) / 129.0)).r - 0.5) * 2.0; }
float soundSpec(float f, float age) { return texture(uSound, vec2(f, (1.5 + clamp(age, 0.0, 1.0) * 63.0) / 129.0)).r; }
float soundLevel(float age) { return (soundSpec(0.08, age) + soundSpec(0.3, age) + soundSpec(0.55, age)) * 0.5; }

float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / max(k, 1e-5); return min(a, b) - h * h * k * 0.25; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { return sdBox(p, b) - r; }
float g2(vec2 q, vec2 c, vec2 s) { vec2 d = (q - c) / s; return exp(-dot(d, d)); }

// ---------------------------------------------------------------- the ghost face (a relief: eyes and mouth are hollows)
// turn slides the features sideways over the skull, like a head turning
float faceH(vec2 q, float turn) {
  float m = MOUTH, e = max(EYES, 0.08);
  float h = 0.55 * g2(q, vec2(0.0, 0.02), vec2(0.36, 0.48));
  q.x -= turn * 0.13 * (1.0 - q.y * q.y * 2.0);
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

// ---------------------------------------------------------------- media (camera, picture, video, words) as relief
// a cubic B-spline sample (4 bilinear taps): smooth in value *and* slope, so a relief made from
// pixels has smooth normals instead of a staircase
vec4 texBicubic(sampler2D t, vec2 uv, float lod) {
  int L = int(lod);
  vec2 res = vec2(textureSize(t, L));
  uv = uv * res - 0.5;
  vec2 i = floor(uv), f = uv - i, f2 = f * f, f3 = f2 * f;
  vec2 w0 = (-f3 + 3.0 * f2 - 3.0 * f + 1.0) / 6.0, w1 = (3.0 * f3 - 6.0 * f2 + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 p0 = (i - 0.5 + w1 / g0) / res, p1 = (i + 1.5 + w3 / g1) / res;
  float fl = float(L);
  return g0.y * (g0.x * textureLod(t, vec2(p0.x, p0.y), fl) + g1.x * textureLod(t, vec2(p1.x, p0.y), fl))
       + g1.y * (g0.x * textureLod(t, vec2(p0.x, p1.y), fl) + g1.x * textureLod(t, vec2(p1.x, p1.y), fl));
}

vec2 mediaUV(vec2 q) { return (q - vec2(MEDIAX, MEDIAY)) / (2.0 * MEDIAS * vec2(uMediaAspect, 1.0)) + 0.5; }
float mediaEdge(vec2 uv, float w) { vec2 e = smoothstep(0.0, w, uv) * smoothstep(0.0, w, 1.0 - uv); return e.x * e.y; }

// the relief: returns (brightness, weight); weight is the mask × the soft edge of the picture.
// A masked subject (body, hands…) is lifted a little so its silhouette stands up, with its detail on top.
vec2 mediaAt(vec2 q, float lod) {
  vec2 uv = mediaUV(q);
  vec4 m = lod > 0.5 ? texBicubic(uMedia, uv, 0.0) : textureLod(uMedia, uv, 0.0);
  float l = dot(m.rgb, vec3(0.299, 0.587, 0.114));
  l = mix(l, 1.0 - l, MEDIAINV);
  l = mix(l, 1.0, MEDIALIFT);
  return vec2(l, mix(1.0, m.a, MEDIAMASK) * mediaEdge(uv, 0.05));
}

// how much of "you" is at q, very soft (lod picks the blur): for keeping you still, and for the aura
float mediaMaskSoft(vec2 q, float lod) {
  vec2 uv = mediaUV(q);
  return mix(1.0, textureLod(uMedia, uv, lod).a, MEDIAMASK) * mediaEdge(uv, 0.08);
}

// ---------------------------------------------------------------- the membrane's height
float heightField(vec2 q) {
  float h = 0.0;
  float calm = MEDIACALM > 0.0 ? 1.0 - MEDIACALM * mediaMaskSoft(q, 1.5) : 1.0;
  if (SWELL > 0.0) {                         // long waves rolling across the sheet
    float env = 1.0 + 2.2 * soundSpec(0.15, clamp(dot(q - vec2(TX, TY), vec2(0.8, 0.6)) / (FRAME * 2.4) + 0.5, 0.0, 1.0));   // louder → bigger
    h += calm * SWELL * 0.06 * env * (sin(dot(q, vec2(0.8, 0.6)) * SWELLF - SWELLPH) + 0.45 * sin(dot(q, vec2(-0.45, 0.89)) * SWELLF * 1.7 - SWELLPH * 2.0));
  }
  if (FOLDS > 0.0) {
    float f = FOLDF;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float a = fi * 1.7 + 0.4;
      h += sin(dot(q, vec2(cos(a), sin(a))) * f * (0.6 + 0.25 * fi) + PHASE * (0.35 + 0.1 * fi) + fi * 2.1) / (1.0 + fi * 0.7);
    }
    h *= FOLDS * 0.045 * calm;
  }
  if (RIPPLE > 0.0) {
    float r = length(q);
    h += calm * RIPPLE * 0.035 * sin(r * 26.0 - RIPPHASE) * exp(-r * 1.2) * smoothstep(0.0, 0.1, r);
  }
  for (int i = 0; i < 16; i++) {                       // ripples dropped with the mouse (or by your movement)
    if (uRipplesOn < 0.5) break;
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = uRealTime - rp.z;
    if (age < 0.0 || age > 5.0) continue;
    vec2 c = vec2(TX, TY) + rp.xy * 2.0 * FRAME;
    float d = length(q - c), front = age * 0.6 * FRAME;
    h += rp.w * 0.03 * FRAME * sin((d - front) * 40.0 / FRAME) * exp(-pow((d - front) / (0.08 * FRAME + age * 0.1 * FRAME), 2.0)) * exp(-age * 0.9);
  }
  if (FACE > 0.0) h += FACE * faceH(rot(-FACEROLL) * (q - vec2(FACEX, FACEY)) / FACES, FACETURN) * FACES * 0.32;
  if (MEDIA > 0.0) { vec2 m = mediaAt(q, 1.0); h += MEDIA * 0.22 * m.x * m.y * MEDIAS; }
  if (SLAND > 0.0) {                         // the sheet rises into the spectrum: bass in the middle, the past rolling away
    vec2 u = (q - vec2(TX, TY)) / (2.0 * FRAME);
    float age = 0.45 - u.y * 0.5, f = abs(u.x) * 0.7;
    h += calm * SLAND * 0.11 * FRAME * (soundSpec(f, age) + soundSpec(f, age + 0.03));
  }
  return h * HEIGHT;
}

// ---------------------------------------------------------------- hands, reaching (fingers: pinky → index, then the thumb)
float handSDF(vec3 p, float curl, float spread, int hb) {
  float d = sdRoundBox(p - vec3(0.0, -0.01, 0.0), vec3(0.068, 0.08, 0.017), 0.03);
  d = smin(d, sdCapsule(p, vec3(-0.035, -0.08, 0.0), vec3(0.04, -0.085, 0.0), 0.045), 0.04);   // heel of the palm
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float len = (i == 0 ? 0.78 : i == 1 ? 0.99 : i == 2 ? 1.06 : 0.95) * 0.245;
    float c = (curl + uFinger[hb + 4 - i]) * (1.0 + 0.12 * (1.5 - fi));
    vec3 a = vec3(-0.066 + fi * 0.044, 0.085, 0.0);
    vec3 dir = normalize(vec3((fi - 1.5) * spread * 0.2, 1.0, 0.0));
    float r = 0.0205 + fi * 0.0013;
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
  float r = 0.028, tc = curl + uFinger[hb];
  for (int j = 0; j < 2; j++) {
    dir.xy = rot(tc * 0.6) * dir.xy;
    dir.yz = rot(tc * 0.35) * dir.yz;
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
    q.x *= uHandMirror[i];
    d = smin(d, handSDF(q, uP[b + 6], uP[b + 7], i * 5) * s, 0.06 * s);   // soft, so a pair never creases where they meet
  }
  return d;
}

${figuresGLSL(figures)}

// ---------------------------------------------------------------- orbs, columns
float orbsSDF(vec3 p) {
  float n = ORBN;
  vec2 g = p.xy * n, id = floor(g + 0.5);
  vec2 f = (g - id) / n;
  float R = 0.36 / n;
  float rise = ORBS * (0.55 + 0.45 * sin(PHASE * 0.9 + id.x * 0.75 + id.y * 0.55));
  return length(vec3(f, p.z - R * (rise * 1.6 - 1.0))) - R;
}
float columnsSDF(vec3 p) {
  float c = COLN;
  vec2 g = mod(p.xy, c) - 0.5 * c;   // columns either side of a clear aisle down the middle
  float h = COLUMNS * COLH;
  float shaft = max(length(g) - 0.075 * c * (1.0 - 0.15 * smoothstep(0.0, h, p.z)), abs(p.z - h * 0.5 + 0.05) - h * 0.5);
  float cap = sdRoundBox(vec3(g, p.z - h), vec3(0.12 * c, 0.12 * c, 0.018 * c), 0.012 * c);
  float base = sdRoundBox(vec3(g, p.z), vec3(0.11 * c, 0.11 * c, 0.02 * c), 0.01 * c);
  return min(shaft, min(cap, base));
}

// ---------------------------------------------------------------- spaces to fly through
// gyroid (organic) ↔ Schwarz-P (round portals with open channels you can fly down)
float gyroid(vec3 p) {
  vec3 q = p * GYROS + vec3(0.0, 1.5708, 0.0);
  float g = abs(dot(sin(q), cos(q.yzx))) - 0.22;
  vec3 s = p * GYROS;
  float pp = abs(cos(s.x) + cos(s.y) + cos(s.z)) - 0.35;
  return mix(g, pp * 0.8, GYROTYPE) / GYROS * 0.7;
}
// an infinite Menger sponge; the z axis runs down an open tunnel
float sponge(vec3 p) {
  vec3 q = p * SPACES;
  float d = -1e3, s = 1.0;
  for (int m = 0; m < 4; m++) {
    vec3 a = mod(q * s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0 * abs(a));
    float c = (min(max(r.x, r.y), min(max(r.y, r.z), max(r.z, r.x))) - 1.0) / s;
    d = max(d, c);
  }
  return d / SPACES;
}
// a field of twisting Sierpinski tetrahedra (a folding fractal), one per cell; the axes between them are clear
float crystal(vec3 p) {
  vec3 z = mod(p * SPACES, 4.0) - 2.0;
  z.xy = rot(KIFSA * 0.5) * z.xy;
  for (int n = 0; n < 7; n++) {
    if (z.x + z.y < 0.0) z.xy = -z.yx;
    if (z.x + z.z < 0.0) z.xz = -z.zx;
    if (z.y + z.z < 0.0) z.zy = -z.yz;
    z.xz = rot(KIFSA * 0.12) * z.xz;
    z = z * 2.0 - vec3(1.0);
  }
  return (length(z) - 1.6) * pow(2.0, -7.0) / SPACES;
}

// ---------------------------------------------------------------- objects pushing through the membrane
float sdTorus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }

float mobius(vec3 p) {
  float a = atan(p.y, p.x);
  vec2 c = rot(a * 0.5) * vec2(length(p.xy) - 0.55, p.z);
  vec2 d = abs(c) - vec2(0.2, 0.022);
  return (length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)) * 0.6;
}

float rings(vec3 p) {
  float t = OBJROT;
  vec3 a = p; a.yz = rot(t + 1.57) * a.yz;
  vec3 b = p; b.xy = rot(t * 2.0 + 1.0) * b.xy; b.yz = rot(1.2) * b.yz;
  vec3 c = p; c.xz = rot(t * 3.0) * c.xz; c.xy = rot(0.7) * c.xy;
  return min(sdTorus(a, 0.7, 0.07), min(sdTorus(b, 0.53, 0.07), sdTorus(c, 0.36, 0.07)));
}

// Penrose's impossible triangle: three beams that only close up seen from the "magic" direction.
// It is built in the camera's own frame so it always looks impossible — REVEAL turns it away to show the trick.
float penrose(vec3 p) {
  vec3 bk = gBack, rt = gRight;
  vec2 rb = rot(REVEAL) * vec2(1.0, 0.0);
  vec3 r2 = rt * rb.x + bk * rb.y, b2 = -rt * rb.y + bk * rb.x;
  float k = 0.8164966, c3 = 0.5773503;
  vec3 ex = k * (0.8660254 * r2 - 0.5 * gUp) + c3 * b2;
  vec3 ey = k * gUp + c3 * b2;
  vec3 ez = k * (-0.8660254 * r2 - 0.5 * gUp) + c3 * b2;
  float L = 0.95, w = 0.09;
  // beam space: the path runs (0,0,0) → (L,0,0) → (L,L,0) → (L,L,L); its two ends line up on screen
  vec3 q = vec3(dot(p, ex), dot(p, ey), dot(p, ez)) + vec3(L * 0.8333, L * 0.5, L * 0.1667);   // centred on screen and in depth
  float a = sdBox(q - vec3(L * 0.5, 0.0, 0.0), vec3(L * 0.5 + w, w, w));
  float b = sdBox(q - vec3(L, L * 0.5, 0.0), vec3(w, L * 0.5 + w, w));
  float c = sdBox(q - vec3(L, L, L * 0.5 - w * 0.5), vec3(w, w, L * 0.5 - w * 0.5));
  return min(a, min(b, c));
}

// a soft lump that turns in the dark: a sphere, or two lobes twisted round each other
float blobSDF(vec3 s) {
  float l = BLOBLUMP;
  s.xz = rot(s.y * 1.3 * l + 0.25 * l * sin(OBJROT * 2.0)) * s.xz;
  vec3 o = vec3(0.3 * l, 0.06 * l, 0.0);
  float r = 0.78 - 0.16 * min(l, 1.0);
  vec3 k = vec3(1.0, 1.0, 1.0 + 0.25 * l);
  float d = smin(length((s - o) * k) - r, length((s + o) * k) - r, 0.35);
  d += l * 0.035 * sin(s.x * 6.0 + OBJROT) * sin(s.y * 5.0 - OBJROT * 0.7);
  return d * 0.72;
}

float objWeights() { return PENROSE + MOBIUS + RINGS + BLOB; }

// object space: centred, scaled, and (for the strip and the blob) turned and tilted
vec3 objPos() { return vec3(OBJX, OBJY, mix(-1.3 * OBJS, OBJZ, min(objWeights(), 1.0))); }
vec3 objSpin(vec3 q) { q.xz = rot(OBJROT) * q.xz; q.yz = rot(OBJTILT) * q.yz; return q; }

float objects(vec3 p) {
  float wsum = objWeights();
  if (wsum < 0.001) return 1e3;
  vec3 q = (p - objPos()) / OBJS;
  float bound = length(q) - 1.35;
  if (bound * OBJS > OBJSOFT + 0.1) return bound * OBJS;
  float d = 0.0;
  if (PENROSE > 0.001) d += PENROSE * penrose(q);
  vec3 s = objSpin(q);
  if (MOBIUS > 0.001) d += MOBIUS * mobius(s);
  if (RINGS > 0.001) d += RINGS * rings(q);
  if (BLOB > 0.001) d += BLOB * blobSDF(s);
  return d / wsum * OBJS;
}

// ---------------------------------------------------------------- a corridor to fly down
// square ↔ round, a closed box ↔ walls and a floor open to the dark; its walls can ripple
float hallSDF(vec3 p) {
  float w = HALLW * (1.0 + HALLWAVE * 0.22 * sin(p.z * 2.3 + PHASE * 0.35) * sin(p.z * 0.71 - 1.3));
  vec2 q = p.xy;
  float h = w * 0.72;
  float box = mix(min(w - abs(q.x), h - abs(q.y)), min(w - abs(q.x), h + q.y), HALLOPEN);
  return mix(box, w - length(q), HALLROUND);
}

// ---------------------------------------------------------------- the ball (after Tame Impala's Currents)
// a chrome ball resting in the sheet; the lines part around it like water round a stone, and a turbulent
// wake trails behind it. Lifted off (a bounce), it lets go of the lines.
vec3 ballC() { return vec3(BALLX, BALLY, gBallH + BALLZ + BALLR * 0.3); }
float ballSDF(vec3 p) { return length(p - ballC()) - BALLR * BALL; }

vec2 ballFlow(vec2 q) {
  if (BALL <= 0.001) return q;
  vec2 c = vec2(BALLX, BALLY), o = q - c;
  float R = BALLR * BALL * clamp(1.0 - BALLZ / (BALLR * 1.6), 0.25, 1.0) * 1.2;
  vec2 rel = o * (1.0 - BALLFLOW * R * R / max(dot(o, o), R * R));   // flow round a cylinder
  vec2 v = vec2(BALLVX, BALLVY);
  float sp = length(v);
  if (BALLWAKE > 0.0 && sp > 1e-3) {
    vec2 dir = v / sp;
    float behind = -dot(o, dir), side = dot(o, vec2(-dir.y, dir.x));
    float b = max(behind, 0.0);
    float w = smoothstep(0.0, R, behind) * exp(-b / (R * 8.0)) * exp(-side * side / (R * R * (1.5 + b / R)));
    rel += w * BALLWAKE * R * 0.9 * vec2(fbm(o / R * 0.8 + vec2(TIME * 0.9, 0.0)), fbm(o / R * 0.8 + vec2(5.2, -TIME * 0.9)));
  }
  return c + rel;
}

float gFD = 1e3;               // the figures' distance the last time map() looked (the march's last look is at the hit)
float map(vec3 p) {
  float d = (p.z - heightField(p.xy) + DROP * DROP * 40.0) * uStepK;
  float sw = GYRO + SPONGE + KIFS + HALL;
  if (sw > 0.001) {
    float ds = 0.0;
    if (GYRO > 0.001) ds += GYRO * gyroid(p);
    if (SPONGE > 0.001) ds += SPONGE * sponge(p);
    if (KIFS > 0.001) ds += KIFS * crystal(p);
    if (HALL > 0.001) ds += HALL * hallSDF(p);
    d = mix(d, ds / sw, min(sw, 1.0));
  }
  if (ORBS > 0.001) d = smin(d, orbsSDF(p), 0.04);
  if (COLUMNS > 0.001) d = smin(d, columnsSDF(p), 0.03);
  d = smin(d, objects(p), OBJSOFT);
  if (BALL > 0.001) d = smin(d, ballSDF(p), 0.02);
  if ((FIG > 0.001 || FTON > 0.001) && gFigNear) {
    // figures, joined to the sheet like the hands; their hollows go through both
    float fd = figuresSDF(p);
    gFD = fd;
    d = smin(d, fd, FIGSOFT);
    if (gFHole < 0.3 * gFS) d = smaxF(d, -gFHole, 0.01 * gFS);
  }
  return smin(d, hands(p), HANDSOFT);
}

vec3 calcNormal(vec3 p, float t) {
  // a picture relief comes in 8-bit steps: look a little wider so the steps don't read as noise
  float h = (0.0006 * max(1.0, t) + (MEDIA > 0.0 ? 0.006 * MEDIAS : 0.0)) * 1.732;
  vec3 n = vec3(0.0);
  int m = 4 + int(min(uStepK, 0.0));        // a loop the compiler can't unroll: map() is compiled in once here, not four times
  for (int i = 0; i < m; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * map(p + e * h);
  }
  return normalize(n);
}

// ---------------------------------------------------------------- the line equation
// qw returns the warped coordinates, so a picture can be bent by the same warps as the lines
float lines(vec2 q, float z, out float rr, out vec2 qw) {
  vec2 qv = rot(FROT) * (q - vec2(TX, TY));                  // the same point, measured from the middle of the view
  q = rot(FROT) * q;
  float r = length(q);
  float c = gCalm;
  if (SWELL > 0.0) {                                         // waves running along the lines, bigger when it's loud
    vec2 d = vec2(cos(LINA), sin(LINA));
    float env = 1.0 + 2.2 * soundSpec(0.15, clamp(dot(qv, vec2(0.8, 0.6)) / (FRAME * 2.4) + 0.5, 0.0, 1.0));
    q += d * c * SWELL * 0.05 * env * sin(dot(q, vec2(-d.y, d.x)) * SWELLF * 1.3 - SWELLPH);
  }
  if (PINCH > 0.0) q.x += c * PINCH * 0.24 * tanh((q.x - PINCHX) / 0.035);   // a band the lines squeeze through
  if (VORTEX != 0.0) q = rot(c * VORTEX * 0.55 * log(max(r, 0.015))) * q;     // wound into the center, forever
  if (TWIST != 0.0) q = rot(c * TWIST * exp(-r * r * 1.6)) * q;
  if (BULGE != 0.0) q *= 1.0 - c * clamp(BULGE, -1.0, 1.0) * 0.85 * exp(-r * r * 3.5);
  if (WAVE != 0.0) {
    float wv = q.y * WAVEF + PHASE * 0.6;
    q.x += c * WAVE * 0.06 * mix(sin(wv), asin(sin(wv)) * 0.6366, ZIG);   // smooth waves ↔ zigzags
  }
  if (WARPN > 0.0) q += c * WARPN * 0.22 * vec2(fbm(q * 1.8 + vec2(0.0, PHASE * 0.05)), fbm(q * 1.8 + vec2(7.3, -PHASE * 0.05)));
  if (KALEIDO > 0.0) {
    float seg = TAU / floor(KALEIDON + 0.5);
    float af = abs(mod(atan(q.y, q.x), seg) - seg * 0.5);
    q = mix(q, length(q) * vec2(cos(af), sin(af)), KALEIDO * c);
  }
  if (SWAVE > 0.0 || SSPEC > 0.0) {
    // the sound bends the lines. Each line carries the waveform from a slightly different moment: the
    // newest through the middle of the view, older ones further out, mirrored left and right, so the
    // lines ripple outward with what you're hearing. Rings carry it round the circle, the past further out.
    vec2 d = vec2(cos(LINA), sin(LINA));
    float along = dot(qv, vec2(-d.y, d.x)), across = dot(qv, d);
    float x = clamp(abs(along) / (FRAME * 2.2), 0.0, 1.0), age = clamp(abs(across) / (FRAME * 1.3), 0.0, 1.0);
    float a = abs(atan(q.y, q.x)) / PI, rq = length(q);
    float lin = WLIN + CONTOUR * 0.5, rad = WRAD + WANG * 0.5;
    if (SWAVE > 0.0) {
      q += d * c * SWAVE * 0.16 * (1.0 - 0.35 * age) * soundWaveAt(x, age) * lin;
      q *= 1.0 - c * SWAVE * 0.16 * soundWaveAt(a, rq / (FRAME * 1.6)) * rad;
    }
    if (SSPEC > 0.0) {
      q -= d * c * SSPEC * 0.14 * soundSpec(x, age) * lin;
      q *= 1.0 - c * SSPEC * 0.28 * soundSpec(a, rq * 0.7) * rad;
    }
  }
  qw = rot(-FROT) * q;
  r = length(q);
  rr = r;
  float ang = atan(q.y, q.x);
  float L = dot(q, vec2(cos(LINA), sin(LINA)));
  vec2 aq = abs(q);
  float rs = mix(r, SQUARE > 0.0 ? max(aq.x, aq.y) : (aq.x + aq.y) * 0.7071, abs(SQUARE));   // rings → squares or diamonds
  float R = mix(rs, -log(max(rs, 1e-4)) * 0.3, RADLOG);
  R = mix(R, 0.09 / max(rs, 2e-3), RADINV);
  float base = (WLIN * L + WRAD * R + CONTOUR * z * 2.5) * FREQ - PHASE + gAura;
  float v = sin(base * PI);
  gBand = mod(floor(base * 0.5), 2.0);
  if (WANG > 0.0) v = mix(v, sin(base * PI + ang * floor(SPOKES + 0.5)), WANG);
  if (CHECK > 0.0) {
    float a2 = dot(q, vec2(cos(LINA + CHECKA), sin(LINA + CHECKA))) * FREQ - PHASE * 0.5;
    float p2 = (ang * floor(SPOKES + 0.5) + PHASE * 0.3) / PI;
    v *= mix(1.0, mix(sin(a2 * PI), sin(p2 * PI), CHECKPOLAR), CHECK);
    // a third family through every crossing cuts each square into two triangles
    if (TRI > 0.0) v *= mix(1.0, sin((base + mix(a2, p2, CHECKPOLAR)) * PI), TRI * CHECK);
  }
  if (MOIRE > 0.0) {
    vec2 o = MOIREOFF * 0.5 * vec2(cos(PHASE * 0.15), sin(PHASE * 0.15));
    v *= mix(1.0, sin(length(q - o) * FREQ * PI), MOIRE);
  }
  return v;
}

// "wrap": the lines follow the surface instead of being projected onto it. Walls (a corridor) use
// (depth, along the wall); the shapes use their own turning frame, so stripes go round them as they spin.
vec2 surfaceUV(vec3 p, vec3 n) {
  if (length(n.xy) < 0.7) return p.xy;                       // facing the camera: as projected
  vec2 nn = normalize(n.xy);
  float along = mix(dot(p.xy, vec2(-nn.y, nn.x)), atan(nn.x, -nn.y) * HALLW, HALLROUND);
  return vec2(p.z, along);
}

// on a shape: longitude and height, like a globe — stripes become meridians that curve round it.
// The longitude is scaled so a whole number of stripes fits around, so there is no seam at the back.
vec2 objectUV(vec3 s) {
  float n = max(1.0, floor(0.8 * PI * FREQ * OBJS + 0.5));
  return vec2(atan(s.x, s.z) * n / (PI * FREQ), s.y * 0.8 * OBJS);
}

vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = (px - 0.5 * uRes) / uRes.y;
  uv += texture(uDisp, px / uRes).xy;
  for (int i = 0; i < 4; i++) {                              // the endless twist: it can wind round as often as you like
    vec4 tw = uTwists[i];
    if (tw.z == 0.0) continue;
    vec2 dd = uv - tw.xy;
    uv = tw.xy + rot(tw.z * exp(-dot(dd, dd) / (tw.w * tw.w))) * dd;
  }

  // camera: orbit around the target (its frame comes in as uniforms); FRAME keeps the sheet the same size whatever the lens
  float dist = 2.0 * FRAME * FOCAL;
  vec3 target = vec3(TX, TY, 0.0);
  vec3 ro = target + gBack * (dist - FLY);
  vec3 rd = normalize(gRight * uv.x + gUp * uv.y - gBack * FOCAL);
  // never under the sheet: in a low shot a loud crest (or a figure) can rise past the camera, and from
  // inside the fabric the whole screen would flash one solid color. Spaces you fly through are exempt.
  if (GYRO + SPONGE + KIFS + HALL < 0.5) {
    float floorZ = heightField(ro.xy) + 0.05 + 0.18 * FRAME;
    ro.z = max(ro.z, floorZ);
  }
  if (BALL > 0.001) gBallH = heightField(vec2(BALLX, BALLY));
  if (FIG > 0.001 || FTON > 0.001) gFigNear = figNear(ro, rd);

  float t = 0.0, d = 1.0;
  float far = dist * 3.0 + 14.0;
  bool hit = false, exact = false;
  for (int i = 0; i < 140; i++) {
    vec3 p = ro + rd * t;
    d = map(p);
    if (d < 0.0005 * t + 0.0003) { hit = true; exact = true; break; }
    t += d;
    if (t > far) break;
  }
  if (!hit && t < far) hit = true;   // ran out of steps grazing a surface: close enough

  float hs = HUE * TAU;                                      // the color cycle turns the palette (grays stay gray)
  vec3 paper = hueShift(vec3(PAPER_R, PAPER_G, PAPER_B), hs), fog = hueShift(vec3(FOG_R, FOG_G, FOG_B), hs);
  vec3 ink1 = hueShift(vec3(INK_R, INK_G, INK_B), hs), ink2 = hueShift(vec3(INK2_R, INK2_G, INK2_B), hs);
  vec3 col = fog;
  if (hit) {
    vec3 p = ro + rd * t;
    // the figures at the hit, as the march's last step saw them (the normal's own looks would overwrite
    // them); beyond their reach, neither the normal nor the shading needs to ask about them again
    float fdH = gFD, hH = gFHole, sH = gFS;
    vec3 qH = gFQ, cH = gFC;
    if (gFigNear) {
      if (!exact) { fdH = figuresSDF(p); hH = gFHole; sH = gFS; qH = gFQ; cH = gFC; }
      if (fdH > 1.4 * FIGSOFT + 0.06 * sH + 0.01) gFigNear = false;
    }
    vec3 n = calcNormal(p, t);
    bool onBall = BALL > 0.001 && ballSDF(p) < 0.004 + 0.001 * t;
    if (MEDIACALM > 0.0) gCalm = 1.0 - MEDIACALM * mediaMaskSoft(p.xy, 1.5);
    if (AURA > 0.0) gAura = AURA * 2.0 * mediaMaskSoft(p.xy, log2(float(textureSize(uMedia, 0).y) / 22.0));
    // near a figure? It's drawn by the sheet's own lines, like the hands; it's lit from over your shoulder
    // (so the side facing you is never lost in shadow), and its hollows dim as they go in
    // (figM: on it and the fabric clinging to it; figL: on it, give or take)
    float figM = 0.0, figL = 0.0, deep = 0.0;
    if ((FIG > 0.001 || FTON > 0.001) && gFigNear) {
      float fd = fdH, s = sH, on = max(FIG, FTON);
      figM = on * (1.0 - smoothstep(0.0, FIGSOFT + 0.04 * s, max(min(fd, abs(hH)), 0.0)));
      figL = on * (1.0 - smoothstep(0.0, 0.05 * s, max(fd, 0.0)));   // (within its bounding ball's margin, so no seam)
      deep = (1.0 - smoothstep(0.0, 0.012 * s, abs(hH))) * smoothstep(0.05, -0.35, qH.z);
    }
    float rr = 1.0;
    vec2 qw = p.xy;
    float v = 0.0;
    if (onBall) {
      // chrome: the ball mirrors the lines around it
      vec3 nb = normalize(p - ballC());
      vec3 rf = reflect(rd, nb);
      v = lines(ballFlow(p.xy + rf.xy * BALLR * 3.0 / (0.35 + abs(rf.z))), 0.0, rr, qw);
      rr = 1.0;
    } else {
      // on a figure, the sheet's lines are laid flat toward you (at the figure) and bent over its form: seen
      // from above that's just the sheet, as with the hands; standing up to a low camera, its face is drawn
      // by the same lines face-on instead of having them stretched up it
      vec2 sq0 = p.xy, nn = n.xy;
      if (figM > 0.001) {
        vec2 Rh = normalize(gRight.xy + vec2(1e-5, 0.0)), Uh = vec2(-Rh.y, Rh.x);
        vec3 d = p - cH;
        sq0 = mix(sq0, cH.xy + Rh * dot(d, gRight) + Uh * dot(d, gUp), figM);
        nn = mix(nn, Rh * dot(n, gRight) + Uh * dot(n, gUp), figM);
      }
      sq0 = ballFlow(sq0 + nn * REFRACT * 0.12);
      if (FIG > 0.001 || FTON > 0.001) sq0 = figFlow(sq0);
      if (WRAP < 0.999) v = lines(sq0, p.z, rr, qw);   // lines bend over the relief
      if (WRAP > 0.001) {
        vec2 sq = surfaceUV(p, n);
        if (length(n.xy) < 0.7) sq = ballFlow(sq);
        float o = objWeights() > 0.001 ? objects(p) : 1e3;
        float wo = 1.0 - smoothstep(0.003, 0.04 * OBJS, o);
        if (wo > 0.001) sq = mix(sq, objectUV(objSpin((p - objPos()) / OBJS)), wo);
        float rr2;
        vec2 qw2;
        float vw = lines(sq, p.z, rr2, qw2);
        if (WRAP >= 0.999) { v = vw; rr = rr2; } else v = mix(v, vw, WRAP);
      }
    }
    vec3 ink = mix(ink1, ink2, BANDS * gBand);
    vec4 photo = vec4(0.0);
    float photoA = 0.0;
    if (!onBall && (MEDIAINK > 0.0 || MEDIAPHOTO > 0.0)) {     // the picture itself, sharp: engraved and/or shown
      vec2 muv = mediaUV(mix(p.xy, qw, MEDIAWARP));
      photo = texture(uMediaSharp, muv);
      photoA = mix(1.0, photo.a, MEDIAMASK) * mediaEdge(muv, 0.03);
      photo.a = mix(dot(photo.rgb, vec3(0.299, 0.587, 0.114)), 1.0 - dot(photo.rgb, vec3(0.299, 0.587, 0.114)), MEDIAINV);
      v += (0.55 - photo.a) * photoA * MEDIAINK * 2.2;         // drawn by line thickness (engraving)
    }
    vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
    // a figure is lit from over your shoulder, so the side facing you is never in its own shadow
    if (figL > 0.001) L = normalize(mix(L, normalize(-0.45 * gRight + 0.55 * gUp + 0.75 * gBack), figL));
    float diff = max(dot(n, L), 0.0);
    float amb = 0.5 + 0.5 * n.z;
    if (!onBall) v -= (diff - 0.6) * ENGRAVE * 1.4;          // light thins the ink: form drawn with lines
    v -= THICK;
    float w = fwidth(v) * 0.8 + 1e-3;
    float k = smoothstep(-w, w, v);
    k = mix(k, 1.0 - k, INVERT);
    col = mix(paper, ink, k);
    float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 40.0);
    if (onBall) {
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
      col = col * (0.55 + 0.45 * diff) * (1.0 - 0.55 * fres) + pow(max(dot(reflect(-L, n), -rd), 0.0), 60.0) * 0.9;
    } else {
      col = mix(col, col * (0.25 + 0.55 * amb + 0.55 * diff) + spec * 0.3, LIGHT);
      col *= 1.0 - 0.45 * deep;
    }
    if (MEDIAPHOTO > 0.0) {                                    // shown as a photo: a duotone in the palette, or true color
      bool pd = dot(paper, vec3(1.0)) < dot(ink1, vec3(1.0));
      vec3 duo = mix(pd ? paper : ink1, pd ? ink1 : paper, smoothstep(0.03, 0.97, photo.a));
      col = mix(col, mix(duo, photo.rgb, PHOTOCOLOR), MEDIAPHOTO * photoA);
    }
    if (DROP > 0.0) col = mix(col, fog, DROP * smoothstep(-0.3, -4.0, p.z));   // the floor falling away into the dark
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
