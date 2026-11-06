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
import { shaderDefines, SHADER_VEC4S, SHADER_SLOTS, SWITCH_KEYS } from './params.js';
import { FORM_GLSL } from './forms.js';

const HAND_BASE = SHADER_SLOTS.findIndex(s => s.name === 'h0on');

// the world's shader
export const worldFrag = () => `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform vec4 uV[${SHADER_VEC4S}];
uniform sampler2D uPrev;
uniform sampler2D uDisp;
uniform sampler2D uMedia;      // relief source, blurred: rgb = picture, a = mask (body / face / hands / a box)
uniform sampler2D uMediaSharp; // the same picture unblurred at full size: the photo and the engraving
uniform sampler2D uSound;      // row 0: the live waveform (0.5 = silence); rows 1–64: the spectrum's past; 65–128: the waveform's past; 129–130: the melody's past
uniform sampler2D uLiving;     // the reaction-diffusion field (the living labyrinth)
uniform float uMediaAspect;
uniform vec4 uRipples[16];
uniform float uRipplesOn;      // skip the mouse-ripple loop when nothing was dropped recently
uniform float uStepK;          // how boldly the ray marcher may step (smaller when the membrane is steep)
uniform float uRealTime;
uniform float uFinger[15];     // per-finger curl offsets, 5 per hand (thumb, index, middle, ring, pinky)
uniform float uHandMirror[3];  // 1 or -1: left or right hand
uniform vec4 uTwists[4];       // the endless twist: centre (screen), angle (keeps growing while held), radius
uniform vec2 uSw[${SWITCH_KEYS.length}];        // the patterns that aren't lines: where each is coming from and going to
uniform float uMorph;          // how far the world has got between them
uniform float uCrys[7];        // the crystal: how far each family of lines has slid
uniform vec4 uDrops[32];       // the marbling, oldest first: x, y, radius, what (0 a drop; 1… a stroke through it, its angle; 3… a comb, its angle)
uniform float uDropN;
uniform vec4 uRings[4];        // waves going out from the drum: x, y, how far they've got, how strong
uniform float uRingsOn;

${shaderDefines()}
#define HAND_BASE ${HAND_BASE}
${SWITCH_KEYS.map((k, i) => `#define SW_${k.toUpperCase()} ${i}`).join('\n')}
#define PI 3.14159265359
#define TAU 6.28318530718

uniform vec3 gRight, gUp, gBack;   // the camera's frame, worked out on the CPU (renderer.js); the impossible triangle is built from it
float gCalm = 1.0;             // 0 inside you when "keep it still inside" is on: the warps leave you alone
float gAura = 0.0;             // how far the lines are pushed around you
float gBand = 0.0;             // 0 / 1: which ink this line gets (every other line in the second ink)
float gBallH = 0.0;            // the sheet's height under the ball (once per pixel)
float gConf = 0.0;             // the conformal warp: on or off (between looks, the two patterns crossfade: a partial warp would show its seam)

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
float soundWave(float x) { return (texture(uSound, vec2(x, 0.5 / 131.0)).r - 0.5) * 2.0; }
float soundWaveAt(float x, float age) { return (texture(uSound, vec2(x, (65.5 + clamp(age, 0.0, 1.0) * 63.0) / 131.0)).r - 0.5) * 2.0; }
float soundSpec(float f, float age) { return texture(uSound, vec2(f, (1.5 + clamp(age, 0.0, 1.0) * 63.0) / 131.0)).r; }
// the melody's curve: how high the tune was, age ago (0 now .. 1 ≈ 5 s), -1..1, fading out where nothing sings
float melodyAt(float age) { return (texture(uSound, vec2(clamp(age, 0.0, 1.0), 129.5 / 131.0)).r - 0.5) * 2.0; }
float swellAt(float age) { return (texture(uSound, vec2(clamp(age, 0.0, 1.0), 130.5 / 131.0)).r - 0.5) * 2.0; }
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
  if (PINS > 0.0) q = mix(q, (floor(q * PINF) + 0.5) / PINF, PINS);   // a bed of pins: the height of one point holds across a whole pin
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
  if (ORI > 0.0) {                           // Miura pleats: a zigzag fold, folded again
    vec2 g = q * ORIF;
    float zig = abs(fract(g.y) - 0.5) * 2.0;
    h += ORI * 0.14 / ORIF * abs(fract(g.x + zig * 0.6) - 0.5) * 2.0;
  }
  if (STUD > 0.0) {                          // a grid of hard little pyramids
    vec2 g = abs(fract(q * ORIF) - 0.5);
    h += STUD * 0.18 / ORIF * (0.5 - max(g.x, g.y)) * 2.0;
  }
  if (MLAND > 0.0) {                         // the melody rolling out across the sheet, like a swell
    float rm = length(q - vec2(TX, TY)) / (FRAME * 2.2);
    h += calm * MLAND * 0.1 * FRAME * swellAt(rm);
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
  return smin(d, sdCapsule(p, vec3(0.0, -0.1, -0.01), vec3(0.0, -0.3, -0.42), 0.058), 0.05);   // the forearm, sloping down into the sheet
}

float hands(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < 2; i++) {
    int b = HAND_BASE + i * 8;
    float on = UP(b);
    if (on <= 0.001) continue;
    float s = UP(b + 4);
    vec3 pos = vec3(UP(b + 1), UP(b + 2), mix(-0.75 * s, UP(b + 3), on));
    vec3 q = (p - pos) / s;
    float bound = length(q - vec3(0.0, 0.03, -0.12)) - 0.42;
    if (bound * s > HANDSOFT + 0.06 * s) { d = min(d, bound * s); continue; }   // far away: the cheap bound is enough
    q.xy = rot(-UP(b + 5)) * q.xy;
    q.yz = rot(-0.3) * q.yz;
    q.x *= uHandMirror[i];
    d = smin(d, handSDF(q, UP(b + 6), UP(b + 7), i * 5) * s, 0.06 * s);   // soft, so a pair never creases where they meet
  }
  return d;
}

${FORM_GLSL}
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
// ---------------------------------------------------------------- objects pushing through the membrane
float mobius(vec3 p) {
  float a = atan(p.y, p.x);
  vec2 c = rot(a * 0.5) * vec2(length(p.xy) - 0.55, p.z);
  vec2 d = abs(c) - vec2(0.2, 0.022);
  return (length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)) * 0.6;
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

float objWeights() { return PENROSE + MOBIUS + BLOB; }

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

float mapSheet(vec3 p) {
  float he = p.z - heightField(p.xy) + DROP * DROP * 40.0, d = he * uStepK;
  float sw = GYRO + SPONGE + HALL;
  if (sw > 0.001) {
    float ds = 0.0;
    if (GYRO > 0.001) ds += GYRO * gyroid(p);
    if (SPONGE > 0.001) ds += SPONGE * sponge(p);
    if (HALL > 0.001) ds += HALL * hallSDF(p);
    d = mix(d, ds / sw, min(sw, 1.0));
  }
  if (ORBS > 0.001) d = smin(d, orbsSDF(p), 0.04);
  if (COLUMNS > 0.001) d = smin(d, columnsSDF(p), 0.03);
  d = smin(d, objects(p), OBJSOFT);
  if (BALL > 0.001) d = smin(d, ballSDF(p), 0.02);
  return smin(d, hands(p), HANDSOFT);
}
float mapForm(vec3 p) {
  float f = formD(p), d = smin(mapSheet(p), f, FORMSOFT);
  return gPit < 1e2 ? smaxF(d, min(-gPit, f), 0.035 * FORMS) : d;       // inside a pit there's no sheet, only the form
}

float normalEps(float t) {
  // a picture relief comes in 8-bit steps: look a little wider so the steps don't read as noise
  return (0.0006 * max(1.0, t) + (MEDIA > 0.0 ? 0.006 * MEDIAS : 0.0)) * 1.732;
}
vec3 normalDir(int i) { return 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0); }
vec3 calcNormal(vec3 p, float t) {
  float h = normalEps(t);
  vec3 n = vec3(0.0);
  int m = 4 + int(min(uStepK, 0.0));        // a loop the compiler can't unroll: the sheet's compiled in once here, not four times
  for (int i = 0; i < m; i++) { vec3 e = normalDir(i); n += e * mapSheet(p + e * h); }
  return normalize(n);
}
vec3 calcNormalForm(vec3 p, float t) {
  float h = normalEps(t);
  if (FORMBAKED > 0.0) h = max(h, 0.008 * FORMS);               // a baked solid is sampled from a grid: look across a cell or so
  vec3 n = vec3(0.0);
  int m = 4 + int(min(uStepK, 0.0));
  for (int i = 0; i < m; i++) { vec3 e = normalDir(i); n += e * mapForm(p + e * h); }
  return normalize(n);
}

// ---------------------------------------------------------------- patterns that aren't lines
// Each gives a value that crosses zero at its edges, so the same sharp threshold draws them all.

// Escher's Circle Limit: a tiling of the hyperbolic plane by triangles, in the Poincaré disk. The disk is
// folded by reflection into one triangle, and the parity of the folds is the color. It flies forward by a
// Möbius translation along the axis, looping exactly on the tiling's own period.
float hyperField(vec2 z) {
  float p = floor(HYPERP + 0.5), m = floor(HYPERQ + 0.5);
  float sp = sin(PI / p), cp = cos(PI / p), cq = cos(PI / m);
  float rc2 = 1.0 / max(cq * cq / (sp * sp) - 1.0, 1e-3), rc = sqrt(rc2), c = rc * cq / sp;
  if (dot(z, z) >= 0.9995) return 1.0;
  float L = 4.0 * atanh(clamp(c - rc, 0.0, 0.999));
  float a = tanh(mod(PHASE * 0.12, L) * 0.5);
  vec2 num = vec2(z.x + a, z.y), den = vec2(1.0 + a * z.x, a * z.y);
  z = vec2(dot(num, den), num.y * den.x - num.x * den.y) / dot(den, den);
  vec2 n = vec2(-sp, cp), C = vec2(c, 0.0);
  float par = 1.0;
  for (int i = 0; i < 32; i++) {
    bool done = true;
    if (z.y < 0.0) { z.y = -z.y; par = -par; done = false; }
    float dn = dot(z, n);
    if (dn > 0.0) { z -= 2.0 * dn * n; par = -par; done = false; }
    vec2 dc = z - C;
    float l2 = dot(dc, dc);
    if (l2 < rc2) { z = C + dc * rc2 / l2; par = -par; done = false; }
    if (done) break;
  }
  return par * min(min(z.y, -dot(z, n)), length(z - C) - rc) * 6.0;
}

// tumbling blocks: a hexagon cut into three rhombi reads as a cube: one face paper, one ink, one hatched.
// Sliding the point where they meet makes each cube push out and sink back in.
float cubeField(vec2 q) {
  vec2 s = vec2(1.0, 1.7320508), p = q * FREQ * 0.32;
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 rz = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  bool first = dot(rz.xy, rz.xy) < dot(rz.zw, rz.zw);
  vec2 g = first ? rz.xy : rz.zw, id = first ? hc.xy : hc.zw + 0.5;
  float hexd = 0.5 - max(abs(g.x), dot(abs(g), vec2(0.5, 0.8660254)));
  vec2 o = vec2(0.0, 0.2 * CUBESHIFT * sin(PHASE * 0.6 + hash12(id * 7.3) * TAU) * smoothstep(0.0, 0.42, hexd + 0.2));
  vec2 c = g - o * smoothstep(0.0, 0.3, hexd);
  float a = mod(atan(c.y, c.x) + PI * 0.5, TAU);
  float sect = floor(a / (TAU / 3.0));
  float da = abs(mod(a, TAU / 3.0) - TAU / 6.0);                                             // from this face's middle
  float edge = min(hexd, length(c) * sin(max(TAU / 6.0 - da, 0.0)));
  float val = sect < 0.5 ? 1.0 : sect < 1.5 ? -1.0 : sin((c.x + c.y * 0.577) * 44.0) * 1.2;
  return val * min(edge * 9.0, 1.0);
}

// Truchet tiles: quarter circles round opposite corners, flipped at random, make a maze with no ends. Two
// colors work out exactly, by the parity of the corner each circle is round. Tiles flip as the music goes.
float truchetAt(vec2 id, vec2 f, float seed) {
  float flip = step(0.5, hash12(id + seed * 13.7));
  vec2 g = f; if (flip > 0.5) g.x = -g.x;
  float d = min(length(g - 0.5) - 0.5, length(g + 0.5) - 0.5);
  float par = mod(id.x + id.y + flip, 2.0) * 2.0 - 1.0;
  return mix(par * d, 0.12 - abs(d), TRUCHETLINE);
}
float truchetField(vec2 q) {
  vec2 g = q * FREQ * 0.32, id = floor(g), f = g - id - 0.5;
  float T = TRUCHETT + hash12(id * 3.1) * 2.0, s0 = floor(T);
  return mix(truchetAt(id, f, s0), truchetAt(id, f, s0 + 1.0), smoothstep(0.72, 1.0, T - s0)) * 3.0;
}

// a Chladni plate: sand gathers on the lines that stay still when the plate sings. Square or round; the
// modes come from the melody, and when a note slides, the figure slides with it.
float cymField(vec2 q, float r, float ang) {
  vec2 c = q * 1.15;
  float n = CYMN, m = CYMM;
  float a = cos(n * PI * c.x) * cos(m * PI * c.y) - cos(m * PI * c.x) * cos(n * PI * c.y);
  float rr = r * 1.15;
  float b = sin(floor(n + 0.5) * ang + PHASE * 0.2) * sin(m * PI * rr * 1.1) / (0.45 + rr);
  float f = mix(a, b, CYMROUND);
  return mix(f * 6.0, (0.075 - abs(f)) * 12.0, CYMSAND);
}

// a Julia set: how fast each point escapes, as bands. The constant walks round as the tune moves.
float juliaField(vec2 q) {
  vec2 z = q * 2.35, c = JULIAR * vec2(cos(JULIAA), sin(JULIAA));
  float i = 0.0;
  for (int n = 0; n < 56; n++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 256.0) break;
    i += 1.0;
  }
  if (i > 55.5) return sin(length(z) * 8.0 - PHASE * 0.3) * 0.6;
  float mu = i - log2(log2(dot(z, z))) + 4.0;
  return sin(mu * FREQ * 0.035 * PI - PHASE * 0.4);
}

// agate: noise folded into itself, read as contour lines
float agateField(vec2 q) {
  vec2 p = q * 1.3;
  float a = fbm(p + vec2(1.7, 9.2) + PHASE * 0.025), b = fbm(p + vec2(8.3, 2.8) - PHASE * 0.02);
  return sin(fbm(p + 1.5 * vec2(a, b)) * FREQ * PI * 1.25 - PHASE * 0.3);
}

// a ripple tank: rings from a few sources, adding up; the sources wander with the music
float wellField(vec2 q) {
  float s = 0.0;
  int n = int(WELLN + 0.5);
  for (int k = 0; k < n; k++) {
    float a = float(k) * TAU / float(n) + WELLT;
    s += sin(length(q - WELLR * vec2(cos(a), sin(a))) * FREQ * PI - PHASE);
  }
  return s;
}

// a few families of parallel lines: each point is one color or the other by how many it has crossed. All
// straight edges, nothing repeating, and as each family slides the whole thing re-forms.
float crystalField(vec2 q) {
  int n = int(CRYSN + 0.5);
  float s = 1.0;
  for (int k = 0; k < n; k++) {
    float a = float(k) * PI / float(n) + CRYST;
    s *= sin((dot(q, vec2(cos(a), sin(a))) * FREQ * 0.5 + uCrys[k]) * PI);
  }
  return sign(s) * pow(abs(s), 1.0 / float(n)) * 1.5;
}

// marbling, by the true formula: a drop pushes everything before it outward, so a point today is traced back
// through every drop since, newest first, until it lands inside one. Strokes and combs drag what's there.
float sumiField(vec2 q) {
  vec2 p = q;
  int n = int(uDropN + 0.5);
  for (int i = n - 1; i >= 0; i--) {
    vec4 d = uDrops[i];
    if (d.w < 0.5) {
      vec2 c = p - d.xy;
      float l2 = dot(c, c), r2 = d.z * d.z;
      if (l2 < r2) return d.w > 0.1 ? 1.0 : -1.0;
      if (r2 > 0.0) p = d.xy + c * sqrt(1.0 - r2 / l2);
    } else if (d.w < 2.5) {
      float a = (d.w - 1.0) * PI;                                                   // one stroke through the ink
      vec2 m = vec2(cos(a), sin(a));
      p -= m * d.z * exp(-abs(dot(p - d.xy, vec2(-m.y, m.x))) * 9.0);
    } else {
      float a = (d.w - 3.0) * PI;                                                   // a comb: strokes side by side, alternating
      vec2 m = vec2(cos(a), sin(a));
      p -= m * d.z * sin(dot(p - d.xy, vec2(-m.y, m.x)) * 15.0);
    }
  }
  return sin(dot(p, vec2(cos(LINA), sin(LINA))) * FREQ * PI - PHASE) * 1.3;           // and the water has lines in it, which all this pushes about
}

// a checkerboard with its edges bent the same way on both sides: what one square loses the next one gains, so
// they go on fitting together however far it goes. The bend comes and goes across the sheet.
float lockField(vec2 q) {
  vec2 p = q * FREQ * 0.28;
  float a = LOCKA * (0.55 + 0.45 * sin(dot(q, vec2(1.5, 0.9)) * 1.2 - PHASE * 0.15));
  p.x += a * (0.26 * sin(TAU * p.y) + 0.09 * sin(2.0 * TAU * p.y + 1.1));
  p.y += a * (0.26 * sin(TAU * p.x + 0.7) + 0.09 * sin(2.0 * TAU * p.x + 2.3));
  return sin(PI * p.x) * sin(PI * p.y) * 1.8;
}

// a grid where every dot is the opposite of its neighbours, and how big each is comes from a wave going out
// and from the sound: low notes in the middle, the past further out
float cellField(vec2 q) {
  float F = FREQ * 0.2;
  vec2 g = q * F, id = floor(g), f = g - id - 0.5;
  float par = mod(id.x + id.y, 2.0) * 2.0 - 1.0;
  float d = mix(length(f), max(abs(f.x), abs(f.y)) * 0.94, CELLSQ);
  float l = length((id + 0.5) / F) / FRAME;
  float R = 0.08 + 0.36 * (0.5 + 0.5 * sin(l * 4.6 - PHASE * 0.8)) + 0.3 * soundSpec(clamp(l * 0.45, 0.0, 1.0), clamp(l * 0.3, 0.0, 1.0));
  return par * (R - d) * 6.0;
}

// the star lattice: every cell folded down to a wedge, a line from the middle of the cell's edge at this angle,
// and rings of that line's distance. Sharpen the angle and every star in the sheet sharpens.
float starField(vec2 q) {
  vec2 g = q * FREQ * 0.1, p;
  if (STARHEX > 0.5) {
    vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(g, g - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 rz = vec4(g - hc.xy * s, g - (hc.zw + 0.5) * s);
    p = dot(rz.xy, rz.xy) < dot(rz.zw, rz.zw) ? rz.xy : rz.zw;
    float a = abs(mod(atan(p.y, p.x) + PI / 6.0, PI / 3.0) - PI / 6.0), r = length(p);
    p = r * vec2(cos(a), sin(a));
  } else {
    p = abs(fract(g) - 0.5);
    if (p.y > p.x) p = p.yx;
  }
  float d = dot(p - vec2(0.5, 0.0), vec2(sin(STARA), cos(STARA)));
  return sin(PI * (d * STARB * 2.0 - PHASE * 0.25)) * 1.3;
}

// circles folded into circles (an Apollonian gasket): bands of how deep each point has fallen
float laceField(vec2 q) {
  vec2 p = q * 2.1 + vec2(0.31, 0.17);
  float sc = 1.0;
  for (int i = 0; i < 7; i++) {
    p = -1.0 + 2.0 * fract(0.5 * p + 0.5);
    float k = LACEK / max(dot(p, p), 1e-3);
    p *= k; sc *= k;
  }
  float d = abs(p.y) / sc + 0.0006;
  return sin(log(d) * LACEB - PHASE * 0.5) * 1.4;
}

// ribbons of fine lines going over and under
float weaveField(vec2 q) {
  vec2 g = q * FREQ * 0.11, id = floor(g), f = g - id - 0.5;
  bool across = mod(id.x + id.y, 2.0) > 0.5;
  float a = across ? f.y : f.x, b = across ? f.x : f.y;                             // a: across the ribbon on top; b: along it
  const float W = 0.43;
  if (abs(a) < W) return sin(a * 56.0 + (across ? PHASE : -PHASE) * 0.0) * 1.2 + 0.35 * smoothstep(0.34, 0.5, abs(b));   // it darkens going under
  if (abs(b) < W) return 1.0;                                                       // the shadow beside it
  return -1.0;
}

// rows of waves, each row lying over the one behind
float seigField(vec2 q) {
  vec2 g = q * FREQ * 0.075;
  const float R = 0.62;
  float r0 = ceil((g.y - R) * 2.0);
  for (int i = 0; i < 6; i++) {
    float row = r0 + float(i), cy = row * 0.5;
    float off = mod(row, 2.0) * 0.5;
    float cx = floor(g.x - off + 0.5) + off;
    float l = length(g - vec2(cx, cy));
    if (l < R) return sin(l * 24.0 - PHASE * 1.1) * 1.2 + (l > R - 0.05 ? 1.2 : 0.0);
  }
  return 1.0;
}

// bricks, and over them discs of the same bricks turned a quarter: they seem to come loose and float
float ouchiBricks(vec2 p) {
  vec2 g = p * FREQ * vec2(0.26, 0.78);
  g.x += floor(g.y) * 0.5;
  return sin(PI * g.x) * sin(PI * g.y) * 1.8;
}
float ouchiField(vec2 q) {
  for (int i = 0; i < 3; i++) {
    float t = OUCHIT * (0.5 + float(i) * 0.21) + float(i) * 2.1;
    vec2 c = FRAME * vec2(0.62 * cos(t) * (1.0 + 0.5 * float(i)), 0.48 * sin(t * 1.3 + 0.7));
    float R = FRAME * (0.42 - float(i) * 0.09);
    if (length(q - c) < R) return ouchiBricks((q - c).yx * vec2(1.0, -1.0));
  }
  return ouchiBricks(q);
}

// a new pattern doesn't fade in over the old one (two patterns half-mixed are just blotches): it opens out from
// the middle of the view with a wandering edge, the old one giving way in front of it. gMk: how far that's got here.
float gMk = 1.0;
#define SWK(i) mix(uSw[i].x, uSw[i].y, gMk)

// ---------------------------------------------------------------- the line equation
// qw returns the warped coordinates, so a picture can be bent by the same warps as the lines
float lines(vec2 q, float z, out float rr, out vec2 qw) {
  vec2 qv = rot(FROT) * (q - vec2(TX, TY));                  // the same point, measured from the middle of the view
  q = rot(FROT) * q;
  float r = length(q);
  float c = gCalm;
  if (PLANES > 0.0) {                                        // a floor and a ceiling, meeting on the horizon
    float yy = max(abs(q.y), 0.012);
    q = mix(q, vec2(q.x / yy, 1.0 / yy) * 0.16, PLANES);
    r = length(q);
  }
  if (gConf > 0.0) {                                         // the tiles wound into a spiral with their shapes kept (conformal): they just get smaller, for ever
    float b = floor(SPOKES + 0.5), a = floor(CONFA + 0.5), u, w;
    if (CONFP != 0.0) {                                      // with a second pole: one source and one sink, or two whirlpools
      vec2 z1 = q - vec2(CONFX, 0.0), z2 = q + vec2(CONFX, 0.0);
      u = log(max(length(z1), 1e-4)) + CONFP * log(max(length(z2), 1e-4));
      w = atan(z1.y, z1.x) + CONFP * atan(z2.y, z2.x);
    } else { u = log(max(r, 1e-4)); w = atan(q.y, q.x); }
    q = mix(q, vec2(b * u + a * w, b * w - a * u) / (PI * FREQ), gConf);
    r = length(q);
  }
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
  if (MWAVE > 0.0) {
    // the melody bends the pattern. The tune's curve flows out from the middle, so a line carries what you
    // heard a moment ago, further out what you heard before that: a slide draws itself across the picture.
    vec2 d = vec2(cos(LINA), sin(LINA));
    float along = dot(qv, vec2(-d.y, d.x));
    float rq = length(qv) / (FRAME * 2.0);
    float lin = WLIN + CONTOUR * 0.5 + CHECK * 0.5, rad = WRAD + WANG * 0.5;
    float m0 = melodyAt(abs(along) / (FRAME * 2.6)), m1 = melodyAt(rq);
    q += d * c * MWAVE * 0.13 * FRAME * m0 * lin;
    q *= 1.0 - c * MWAVE * 0.1 * m1 * rad;
    if (lin + rad < 0.1) q += normalize(qv + 1e-4) * c * MWAVE * 0.09 * FRAME * m1;       // patterns with neither: it just breathes outward
  }
  qw = rot(-FROT) * q;
  r = length(q);
  rr = r;
  float ang = atan(q.y, q.x);
  float L = dot(q, vec2(cos(LINA), sin(LINA)));
  vec2 aq = abs(q);
  float rs = mix(r, SQUARE > 0.0 ? max(aq.x, aq.y) : (aq.x + aq.y) * 0.7071, abs(SQUARE));   // rings → squares or diamonds
  if (BLAZE > 0.0) rs += BLAZE * 0.8 / FREQ * asin(sin(ang * floor(BLAZEN + 0.5) + rs * FREQ * PI * 0.5)) * 0.6366;   // Riley's Blaze: rings that zigzag, each a little out of step
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
  float kk;
  kk = SWK(SW_HYPER); if (kk > 0.0) v = mix(v, hyperField(q / HYPERS), kk);
  kk = SWK(SW_CUBE); if (kk > 0.0) v = mix(v, cubeField(q), kk);
  kk = SWK(SW_TRUCHET); if (kk > 0.0) v = mix(v, truchetField(q), kk);
  kk = SWK(SW_CYM); if (kk > 0.0) v = mix(v, cymField(q, r, ang), kk);
  kk = SWK(SW_JULIA); if (kk > 0.0) v = mix(v, juliaField(q), kk);
  kk = SWK(SW_AGATE); if (kk > 0.0) v = mix(v, agateField(q), kk);
  kk = SWK(SW_WELLS); if (kk > 0.0) v = mix(v, wellField(q), kk);
  kk = SWK(SW_CRYS); if (kk > 0.0) v = mix(v, crystalField(q), kk);
  kk = SWK(SW_SUMI); if (kk > 0.0) v = mix(v, sumiField(q), kk);
  kk = SWK(SW_LOCK); if (kk > 0.0) v = mix(v, lockField(q), kk);
  kk = SWK(SW_CELLS); if (kk > 0.0) v = mix(v, cellField(q), kk);
  kk = SWK(SW_STAR); if (kk > 0.0) v = mix(v, starField(q), kk);
  kk = SWK(SW_LACE); if (kk > 0.0) v = mix(v, laceField(q), kk);
  kk = SWK(SW_WEAVE); if (kk > 0.0) v = mix(v, weaveField(q), kk);
  kk = SWK(SW_SEIG); if (kk > 0.0) v = mix(v, seigField(q), kk);
  kk = SWK(SW_OUCHI); if (kk > 0.0) v = mix(v, ouchiField(q), kk);
  kk = SWK(SW_QUASI);
  if (kk > 0.0) {                                            // a quasicrystal: plane waves that never quite repeat
    float s = 0.0;
    int n = int(QUASIN + 0.5);
    for (int k = 0; k < n; k++) {
      float a = float(k) * PI / float(n);
      s += cos(dot(q, vec2(cos(a), sin(a))) * FREQ * PI + (mod(float(k), 2.0) * 2.0 - 1.0) * PHASE * 0.5);
    }
    v = mix(v, s, kk);
  }
  kk = SWK(SW_LIVING); if (kk > 0.0) v = mix(v, (texture(uLiving, q * 0.45 + 0.5).g - 0.2) * 8.0, kk);
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

  if (uMorph > 0.0 && uMorph < 1.0) {
    float front = clamp(length(uv) * 0.82 + 0.26 * fbm(uv * 2.4 + 3.7), 0.0, 1.0);
    gMk = smoothstep(front - 0.06, front + 0.06, uMorph * 1.12 - 0.06);
  }

  // camera: orbit around the target (its frame comes in as uniforms); FRAME keeps the sheet the same size whatever the lens
  float dist = 2.0 * FRAME * FOCAL;
  vec3 target = vec3(TX, TY, 0.0);
  vec3 ro = target + gBack * (dist - FLY);
  vec3 rd = normalize(gRight * uv.x + gUp * uv.y - gBack * FOCAL);
  // never under the sheet: in a low shot a loud crest (or a figure) can rise past the camera, and from
  // inside the fabric the whole screen would flash one solid color. Spaces you fly through are exempt.
  if (GYRO + SPONGE + HALL < 0.5) {
    float floorZ = heightField(ro.xy) + 0.05 + 0.18 * FRAME;
    ro.z = max(ro.z, floorZ);
  }
  if (BALL > 0.001) gBallH = heightField(vec2(BALLX, BALLY));

  float t = 0.0, d = 1.0;
  float far = dist * 3.0 + 14.0;
  bool hit = false;
  float tLast = 0.0;
  // Rays that pass nowhere near the form get a loop without it in. Code in a loop costs every step, whether it
  // runs or not, so this is what keeps the pattern as quick as if nothing were there.
  bool nearForm = false;
  if (FORMON > 0.001) {
    if (FORMFIELD > 0.0) nearForm = true;
    else {
      vec3 oc = vec3(FORMX, FORMY, FORMZ) - ro;
      nearForm = length(oc - rd * max(dot(oc, rd), 0.0)) < (FORMBOUND + 0.15) * FORMS + 1.8 * FORMSOFT;
    }
  }
  if (nearForm) {
    if (FORMBAKED > 0.0) gFormGround = FORMBAKED * heightField(vec2(FORMX, FORMY));
    for (int i = 0; i < 140; i++) {
      d = mapForm(ro + rd * t);
      if (i == 0 && d < 0.0) { nearForm = false; break; }     // the camera's inside it: look out through it, rather than at a screen of one color
      if (d < 0.0005 * t + 0.0003) {
        hit = true;
        if (d < -0.002) {                                    // it stepped through: go back and find where
          float a = tLast, b = t;
          for (int j = 0; j < 5; j++) { float c = 0.5 * (a + b); if (mapForm(ro + rd * c) < 0.0) b = c; else a = c; }
          t = b;
        }
        // right onto the surface: a form's own stripes would show every place the march stopped a little short
        for (int j = 0; j < 2; j++) t += mapForm(ro + rd * t);
        break;
      }
      tLast = t;
      t += d;
      if (t > far) break;
    }
  }
  if (!nearForm) {
    for (int i = 0; i < 140; i++) {
      d = mapSheet(ro + rd * t);
      if (d < 0.0005 * t + 0.0003) {
        hit = true;
        if (d < -0.002) {
          float a = tLast, b = t;
          for (int j = 0; j < 5; j++) { float c = 0.5 * (a + b); if (mapSheet(ro + rd * c) < 0.0) b = c; else a = c; }
          t = b;
        }
        break;
      }
      tLast = t;
      t += d;
      if (t > far) break;
    }
  }
  if (!hit && t < far) hit = true;   // ran out of steps grazing a surface: close enough

  float hs = HUE * TAU;                                      // the color cycle turns the palette (grays stay gray)
  vec3 paper = hueShift(vec3(PAPER_R, PAPER_G, PAPER_B), hs), fog = hueShift(vec3(FOG_R, FOG_G, FOG_B), hs);
  vec3 ink1 = hueShift(vec3(INK_R, INK_G, INK_B), hs), ink2 = hueShift(vec3(INK2_R, INK2_G, INK2_B), hs);
  vec3 col = fog;
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = nearForm ? calcNormalForm(p, t) : calcNormal(p, t);
    bool onBall = BALL > 0.001 && ballSDF(p) < 0.004 + 0.001 * t;
    if (MEDIACALM > 0.0) gCalm = 1.0 - MEDIACALM * mediaMaskSoft(p.xy, 1.5);
    if (AURA > 0.0) gAura = AURA * 2.0 * mediaMaskSoft(p.xy, log2(float(textureSize(uMedia, 0).y) / 22.0));
    // on a form: the same pattern runs straight across it, its outline cutting against what's behind
    float dForm = 1e3, shutIn = 1.0;
    if (FORMON > 0.001 && (nearForm || FORMAURA > 0.0)) {
      // and how shut in this point is: how far from the form you get, going a little way straight out
      gFormFull = true;
      float out_ = 0.11 * FORMS;
      int m = (FORMSHADE > 0.0 && nearForm ? 2 : 1) + int(min(uStepK, 0.0));
      for (int j = 0; j < m; j++) {
        float dj = formD(j == 0 ? p : p + n * out_);
        if (j == 0) dForm = dj; else shutIn = smoothstep(0.0, 0.55, dj / out_);    // (only a real hollow: on an open surface this is well over that)
      }
      gFormFull = false;
    }
    float dSolid = min(dForm, UP(HAND_BASE) + UP(HAND_BASE + 8) > 0.0 ? hands(p) : 1e3);
    float formK = 1.0 - smoothstep(0.004, 0.03 * FRAME, dSolid);
    float formHard = 1.0 - smoothstep(0.0015 * FRAME, 0.006 * FRAME, dForm);
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
      // over a form the lines also bend the way the surface leans, like lines seen through thick glass
      vec2 sq0 = p.xy + n.xy * (FORMON > 0.001 ? FORMS * 0.095 : FRAME * 0.12) * FORMLENS * formK, nn = n.xy * REFRACT;
      // seen from straight above, a shape under the sheet would hardly show: lean the pattern over it by its
      // height, the way lines lie over a form on a tilted page (a low camera does this by itself)
      if (RELIEF > 0.0) sq0 -= rot(YAW) * vec2(0.62, 0.78) * p.z * RELIEF;
      if (uRingsOn > 0.5) for (int i = 0; i < 4; i++) {               // waves going out from the drum, through the pattern
        vec4 g = uRings[i];
        if (g.w <= 0.0) continue;
        vec2 o = sq0 - g.xy;
        float r = max(length(o), 1e-3), e = (r - g.z) / (FRAME * 0.2);
        sq0 += o / r * g.w * FRAME * 0.06 * exp(-e * e);
      }
      if (PINS > 0.0) sq0 = mix(sq0, (floor(sq0 * PINF) + 0.5) / PINF, PINS * 0.0);
      sq0 = ballFlow(sq0 + nn * 0.12 * (1.0 - formK));   // (a look's own refraction would turn a form's steep sides to liquid metal)
      if (FORMAURA > 0.0) {                                           // the outline goes out across the sheet, ring after ring
        vec2 o = p.xy - vec2(FORMX, FORMY);
        if (FORMFIELD > 0.0) o -= FORMFIELD * FORMS * floor(o / (FORMFIELD * FORMS) + 0.5);
        float ds = max(dForm, 0.0) / FORMS;
        sq0 += o / max(length(o), 1e-3) * FORMAURA * FRAME * 0.16 * (1.0 - formK) * sin(ds * 7.0 - FORMAURAT) * exp(-ds * 0.55);
      }
      if (FORMFINE != 1.0) sq0 = mix(sq0, vec2(FORMX, FORMY) + (sq0 - vec2(FORMX, FORMY)) * FORMFINE, formHard);
      if (WRAP < 0.999) {                                // lines bend over the relief
        float confK = SWK(SW_CONF);
        bool fade = confK > 0.001 && confK < 0.999;
        int passes = (fade ? 2 : 1) + int(min(uStepK, 0.0));
        for (int i = 0; i < passes; i++) {
          gConf = fade ? float(i) : step(0.5, confK);
          float vi = lines(sq0, p.z, rr, qw);
          v = i == 0 ? vi : mix(v, vi, confK);
        }
      }
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
    float diff = max(dot(n, L), 0.0);
    float amb = 0.5 + 0.5 * n.z;
    if (!onBall) v -= (diff - 0.6) * ENGRAVE * 1.4 * (1.0 - formK);          // light thins the ink: form drawn with lines
    if (PINS > 0.0) v += PINS * (1.0 - n.z) * 3.0;            // the sides of a pin go dark
    v -= THICK;
    if (formK > 0.0) {
      // light thins the ink: a light that goes where you go, and a little to one side, so you never look at a
      // form's unlit half, and it only goes black where the surface turns away from you
      float inkDark = dot(ink1, vec3(1.0)) < dot(paper, vec3(1.0)) ? 1.0 : -1.0;
      float sideK = inkDark * (1.0 - 2.0 * step(0.5, INVERT));
      vec3 Lf = normalize(gBack + vec3(-0.62, 0.5, 0.15));
      float lit = dot(n, Lf) - Lf.z, edge = 1.0 - max(dot(n, -rd), 0.0);             // lit: against the flat sheet, so only its slopes change
      v += sideK * (1.0 - 0.5 * CHECK) * formK * (edge * FORMRIM - lit * FORMLIT);
      if (FORMCONTOUR > 0.0) {                                                       // its own stripes: a stack of planes cutting through it, so every curve of it shows
        vec3 rel = (p - vec3(FORMX, FORMY, FORMZ)) / FORMS;
        rel.xy = rot(-FORMYAW) * rel.xy;
        rel.yz = rot(-FORMLEAN) * rel.yz;
        float soft = 1.0 - smoothstep(0.0, 0.16 * FORMS, dForm);                     // the sheet's pattern draws out into them as it climbs
        v = mix(v, sideK * (sin(dot(rel, vec3(0.0, sin(FORMSTRIPEA), cos(FORMSTRIPEA))) * FORMSTRIPEF + FORMRINGT * 40.0) + FORMSTRIPEW) * 1.2, FORMCONTOUR * soft * soft);
      }
      if (FORMNEG > 0.0) v = mix(v, -v, FORMNEG * formHard);                         // the pattern's negative, so its outline's everywhere the lines cross it
      if (FORMFILL != 0.0) v = mix(v, sideK * sign(FORMFILL), abs(FORMFILL) * formHard);   // just the silhouette
    }
    float w = fwidth(v) * 0.8 + 1e-3;
    float k = smoothstep(-w, w, v);
    float flip = INVERT;
    if (flip > 0.001 && flip < 0.999) {                                                  // on its way: the negative spreads out from the middle, its edge rippling
      float ra = length(uv), ang = atan(uv.y, uv.x);
      float reach = smoothstep(0.15, 0.85, flip) * (length(vec2(uRes.x / uRes.y, 1.0)) * 0.5 + 0.16);
      flip = smoothstep(-0.004, 0.004, reach - ra * (1.0 + 0.09 * sin(ang * 5.0 + reach * 6.0) + 0.05 * sin(ang * 11.0 - reach * 9.0)));
    }
    k = mix(k, 1.0 - k, flip);
    col = mix(paper, ink, k);
    if (FORMSHADE > 0.0 && (formK > 0.0 || shutIn < 1.0)) {    // the shape itself: the pattern stays as sharp as it was, and goes into shadow
      col *= 1.0 - FORMSHADE * (1.0 - shutIn);                 // only in hollows and round its foot: gray gradients over sharp ink read as chrome
    }
    float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 40.0);
    if (onBall) {
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
      col = col * (0.55 + 0.45 * diff) * (1.0 - 0.55 * fres) + pow(max(dot(reflect(-L, n), -rd), 0.0), 60.0) * 0.9;
    } else {
      col = mix(col, col * (0.25 + 0.55 * amb + 0.55 * diff) + spec * 0.3 * (1.0 - formK), LIGHT * (1.0 - 0.7 * formK));
    }
    if (MEDIAPHOTO > 0.0) {                                    // shown as a photo: a duotone in the palette, or true color
      bool pd = dot(paper, vec3(1.0)) < dot(ink1, vec3(1.0));
      vec3 duo = mix(pd ? paper : ink1, pd ? ink1 : paper, smoothstep(0.03, 0.97, photo.a));
      col = mix(col, mix(duo, photo.rgb, PHOTOCOLOR), MEDIAPHOTO * photoA);
    }
    if (DROP > 0.0) col = mix(col, fog, DROP * smoothstep(-0.3, -4.0, p.z));   // the floor falling away into the dark
    col = mix(fog, col, exp(-max(t - dist * 1.02, 0.0) * FOGD));
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
