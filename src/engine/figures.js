// Figures that rise up under the sheet: a face peering through, a skull, the Shadow, a mandala, an
// ouroboros… Each is a relief (mostly 0..1, hollows below 0) in figure space, where the figure fits
// in a circle of radius ~1 with +y up. They're built from the tops of spheres and capsules, or from
// 2D shapes pressed up like a stamp through cloth, so the stripes drape over them.
// The order here is the id the shader switches on.

export const FIGURES = [
  // presences
  { id: 'face', name: 'Face', group: 'Presences', blurb: 'someone peering up through the lines' },
  { id: 'twins', name: 'Twins', group: 'Presences', blurb: 'the face and its double' },
  { id: 'skull', name: 'Skull', group: 'Presences', blurb: 'memento mori' },
  { id: 'shadow', name: 'The Shadow', group: 'Presences', blurb: 'the one who stands behind you' },
  { id: 'vase', name: 'Two faces', group: 'Presences', blurb: 'a vase — or two faces about to kiss' },
  { id: 'mask', name: 'The Persona', group: 'Presences', blurb: 'the mask, the face you show' },
  { id: 'praying', name: 'Praying hands', group: 'Presences', blurb: 'two hands pressed together' },
  { id: 'moth', name: 'Moth', group: 'Presences', blurb: 'drawn to the light' },
  // symbols
  { id: 'eye', name: 'The Eye', group: 'Symbols', blurb: 'the eye in the triangle, watching' },
  { id: 'hamsa', name: 'Hamsa', group: 'Symbols', blurb: 'the hand with an eye in its palm' },
  { id: 'ouroboros', name: 'Ouroboros', group: 'Symbols', blurb: 'the serpent eating its tail: endless return' },
  { id: 'serpent', name: 'Serpent', group: 'Symbols', blurb: 'the serpent, rising' },
  { id: 'yinyang', name: 'Opposites', group: 'Symbols', blurb: 'the union of opposites' },
  { id: 'lotus', name: 'Lotus', group: 'Symbols', blurb: 'opening out of the dark water' },
  { id: 'sun', name: 'Sol', group: 'Symbols', blurb: 'the alchemists’ sun: gold, the waking day' },
  { id: 'moon', name: 'Luna', group: 'Symbols', blurb: 'the alchemists’ moon: silver, the dreaming night' },
  { id: 'star', name: 'The Star', group: 'Symbols', blurb: 'hope, after the tower falls' },
  { id: 'triskele', name: 'Triskele', group: 'Symbols', blurb: 'three spirals turning as one' },
  { id: 'hourglass', name: 'Hourglass', group: 'Symbols', blurb: 'the sand runs' },
  { id: 'keyhole', name: 'Keyhole', group: 'Symbols', blurb: 'look through' },
  { id: 'door', name: 'The Threshold', group: 'Symbols', blurb: 'a door into the dark' },
  // sacred geometry
  { id: 'mandala', name: 'Mandala', group: 'Sacred geometry', blurb: 'the Self: Jung’s circle of wholeness' },
  { id: 'flower', name: 'Flower of Life', group: 'Sacred geometry', blurb: 'nineteen circles, one pattern' },
  { id: 'metatron', name: 'Metatron’s Cube', group: 'Sacred geometry', blurb: 'thirteen circles, every line between them' },
  { id: 'sriyantra', name: 'Sri Yantra', group: 'Sacred geometry', blurb: 'nine triangles around a point' },
  { id: 'vesica', name: 'Vesica Piscis', group: 'Sacred geometry', blurb: 'where two circles meet' },
  { id: 'tree', name: 'Tree of Life', group: 'Sacred geometry', blurb: 'ten spheres, twenty-two paths' },
  { id: 'labyrinth', name: 'Labyrinth', group: 'Sacred geometry', blurb: 'the way in is the way out' },
  { id: 'hexagram', name: 'Seal of Solomon', group: 'Sacred geometry', blurb: 'fire and water, interlaced' },
];
export const FIGURE_INDEX = Object.fromEntries(FIGURES.map((f, i) => [f.id, i]));
export const FIGURE_GROUPS = [...new Set(FIGURES.map(f => f.group))];

// needs from the shader: smin, rot, PI/TAU, and FIGT (a clock), FIGLX/FIGLY (where eyes look), FIGSING (the music)
export const FIGURES_GLSL = `
// ---------------------------------------------------------------- figures rising under the sheet
float smaxF(float a, float b, float k) { return -smin(-a, -b, k); }
float sphTop(vec2 p, vec2 c, float cy, float r) { float d2 = dot(p - c, p - c); return d2 > r * r ? -9.0 : cy + sqrt(r * r - d2); }
float sphBot(vec2 p, vec2 c, float cy, float r) { float d2 = dot(p - c, p - c); return d2 > r * r ? 9.0 : cy - sqrt(r * r - d2); }
float ellTop(vec2 p, vec2 c, float cy, vec3 r) { vec2 q = (p - c) / r.xz; float d2 = dot(q, q); return d2 > 1.0 ? -9.0 : cy + r.y * sqrt(1.0 - d2); }
float capTop(vec2 p, vec2 a, vec2 b, float r, float ya, float yb) {
  vec2 ab = b - a, ap = p - a;
  float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  vec2 q = ap - ab * t;
  float d2 = dot(q, q);
  return d2 > r * r ? -9.0 : mix(ya, yb, t) + sqrt(r * r - d2);
}
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdEqTri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
float sdHexagram(vec2 p, float r) {
  const vec4 k = vec4(-0.5, 0.8660254038, 0.5773502692, 1.7320508076);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= 2.0 * min(dot(k.yx, p), 0.0) * k.yx;
  p -= vec2(clamp(p.x, r * k.z, r * k.w), r);
  return length(p) * sign(p.y);
}
float sdMoon(vec2 p, float d, float ra, float rb) {
  p.y = abs(p.y);
  float a = (ra * ra - rb * rb + d * d) / (2.0 * d), b = sqrt(max(ra * ra - a * a, 0.0));
  if (d * (p.x * b - p.y * a) > d * d * max(b - p.y, 0.0)) return length(p - vec2(a, b));
  return max(length(p) - ra, -(length(p - vec2(d, 0.0)) - rb));
}
// a lens, pointed at the top and bottom: two circles of radius r, d either side of the middle
float sdVesica(vec2 p, float r, float d) {
  p = abs(p);
  float b = sqrt(max(r * r - d * d, 0.0));
  return ((p.y - b) * d > p.x * b) ? length(p - vec2(0.0, b)) : length(p - vec2(-d, 0.0)) - r;
}
// the same, as half-length × half-width
float sdLens(vec2 p, float len, float wid) { float rpd = len * len / wid; return sdVesica(p, (rpd + wid) * 0.5, (rpd - wid) * 0.5); }
float sdStar(vec2 p, float r, float n, float m) {
  float an = PI / n, en = PI / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
// profiles: a filled shape pressed up, rounded at its edge; a raised line
float pillow(float d, float w) { float s = clamp(-d / w, 0.0, 1.0); return s * (2.0 - s); }
float ridge(float d, float w) { float x = clamp(abs(d) / (w * 1.4), 0.0, 1.0); x = 1.0 - x * x; return x * x; }
float gau1(float y, float c, float s) { float d = (y - c) / s; return exp(-d * d); }

// an almond eye: lids, an iris that looks, a pupil
float eyeR(vec2 e, vec2 look, float len, float wid, float lid) {
  float d = sdLens(e.yx, len, wid);
  float h = ridge(d, 0.05 * len / 0.3) * 0.5 * lid;
  float inside = 1.0 - smoothstep(-0.01, 0.01, d);
  vec2 ic = e - look * vec2(len * 0.35, wid * 0.3);
  float iris = pillow(length(ic) - wid * 0.85, wid * 0.5);
  float pupil = 1.0 - smoothstep(wid * 0.28, wid * 0.36, length(ic));
  return h + inside * (0.25 + iris * 0.4 - pupil * 0.35);
}

// the face peering up through the lines (after trippi's), eyes on you, mouth moving with the music
float figFace(vec2 p, vec2 look, float sing) {
  vec2 s = vec2(p.x, -p.y) * 1.3;
  float y0 = -0.08, k = 0.07;
  float h = ellTop(s, vec2(0.0), y0, vec3(0.62, 0.5, 0.74));
  h = smaxF(h, capTop(s, vec2(0.0, -0.06), vec2(0.0, 0.24), 0.085, y0 + 0.5, y0 + 0.59), k);
  h = smaxF(h, capTop(s, vec2(-0.1, -0.2), vec2(-0.33, -0.15), 0.06, y0 + 0.5, y0 + 0.47), k);
  h = smaxF(h, capTop(s, vec2(0.1, -0.2), vec2(0.33, -0.15), 0.06, y0 + 0.5, y0 + 0.47), k);
  float mo = sing * 0.06;
  h = smaxF(h, capTop(s, vec2(-0.16, 0.39 - mo), vec2(0.16, 0.39 - mo), 0.06, y0 + 0.44, y0 + 0.44), k);
  h = smaxF(h, capTop(s, vec2(-0.13, 0.44 + mo), vec2(0.13, 0.44 + mo), 0.055, y0 + 0.43, y0 + 0.43), k);
  if (sing > 0.02) { float e = length((s - vec2(0.0, 0.415)) / vec2(0.13, 0.006 + mo)); h -= 0.14 * (1.0 - smoothstep(0.6, 1.0, e)); }
  h = smaxF(h, sphTop(s, vec2(0.0, 0.58 + mo * 0.6), y0 + 0.3, 0.19), k);
  h = smaxF(h, sphTop(s, vec2(-0.31, 0.13), y0 + 0.33, 0.19), k * 1.5);
  h = smaxF(h, sphTop(s, vec2(0.31, 0.13), y0 + 0.33, 0.19), k * 1.5);
  for (int i = 0; i < 2; i++) {
    vec2 ec = vec2(i == 0 ? -0.21 : 0.21, -0.04);
    h = smin(h, sphBot(s, ec, y0 + 0.6, 0.135), k);
    h = smaxF(h, sphTop(s, ec + vec2(look.x, -look.y) * 0.035, y0 + 0.41, 0.075), k * 0.7);
  }
  return smaxF(h, 0.0, 0.05) * 1.6;
}

float figSkull(vec2 p, float sing) {
  vec2 s = vec2(p.x, -p.y) * 1.2;
  float k = 0.06;
  float h = ellTop(s, vec2(0.0, -0.2), -0.04, vec3(0.6, 0.55, 0.58));
  h = smaxF(h, ellTop(s, vec2(0.0, 0.26), -0.12, vec3(0.42, 0.42, 0.3)), k * 2.0);
  h = smaxF(h, sphTop(s, vec2(-0.32, 0.14), 0.13, 0.17), k);
  h = smaxF(h, sphTop(s, vec2(0.32, 0.14), 0.13, 0.17), k);
  float jy = 0.56 + sing * 0.1;
  h = smaxF(h, ellTop(s, vec2(0.0, jy), -0.12, vec3(0.3, 0.32, 0.19)), k);
  for (int i = 0; i < 7; i++) {
    float x = -0.18 + float(i) * 0.06;
    h = smaxF(h, ellTop(s, vec2(x, 0.43), 0.14, vec3(0.025, 0.12, 0.05)), 0.012);
    h = smaxF(h, ellTop(s, vec2(x, jy - 0.05), 0.1, vec3(0.025, 0.1, 0.045)), 0.012);
  }
  for (int i = 0; i < 2; i++) h = smin(h, sphBot(s, vec2(i == 0 ? -0.2 : 0.2, 0.0), 0.44, 0.165), 0.04);
  h = smin(h, sphBot(s, vec2(0.0, 0.25), 0.34, 0.075), 0.03);
  return smaxF(h, 0.0, 0.05) * 1.7;
}

float figShadow(vec2 p, float t) {
  p.x += 0.03 * sin(t * 0.7) * (p.y + 1.0);
  float d = length(p - vec2(0.0, 0.6)) - 0.19;
  d = smin(d, sdSeg(p, vec2(0.0, 0.42), vec2(0.0, 0.3)) - 0.08, 0.06);
  vec2 q = p - vec2(0.0, -0.25);
  float body = sdBox2(vec2(q.x, q.y), vec2(0.27 + 0.05 * clamp(q.y, -0.6, 0.5), 0.5)) - 0.1;
  d = smin(d, body, 0.12);
  d = smin(d, sdSeg(vec2(abs(p.x), p.y), vec2(0.36, 0.22), vec2(0.44, -0.62)) - 0.075, 0.08);
  d = max(d, -p.y - 0.95);
  return pillow(d, 0.22) * 0.95;
}

// Rubin's vase: the vase is raised; the two faces are the shape of the air either side of it
float figVase(vec2 p) {
  float y = p.y;
  float prof = 0.05 + 0.13 * gau1(y, 0.66, 0.2) + 0.25 * gau1(y, 0.12, 0.07) + 0.13 * gau1(y, -0.08, 0.035)
             + 0.12 * gau1(y, -0.22, 0.035) + 0.18 * gau1(y, -0.4, 0.07) + 0.04 * gau1(y, 0.36, 0.05);
  float d = max(abs(p.x) - (0.6 - prof), abs(y) - 0.9);
  return pillow(d, 0.14) * 0.9;
}

float figMask(vec2 p) {
  vec2 q = p - vec2(0.0, 0.08);
  float d = (length(q / vec2(0.82, 0.4)) - 1.0) * 0.36;
  d = smin(d, sdSeg(vec2(abs(q.x), q.y), vec2(0.55, 0.12), vec2(0.92, 0.5)) - 0.06, 0.12);
  d = smin(d, sdSeg(q, vec2(0.0, 0.0), vec2(0.0, -0.32)) - 0.1, 0.12);
  float h = pillow(d, 0.16) * 0.75;
  h += ridge(q.y - 0.17 + 0.25 * q.x * q.x, 0.05) * 0.15 * step(d, 0.0);
  float eyes = min(sdLens((q - vec2(-0.32, 0.03)).yx, 0.2, 0.08), sdLens((q - vec2(0.32, 0.03)).yx, 0.2, 0.08));
  return mix(h, -0.45, 1.0 - smoothstep(-0.01, 0.02, eyes));
}

float figPraying(vec2 p) {
  vec2 s = vec2(abs(p.x), p.y);
  float k = 0.035;
  float h = ellTop(s, vec2(0.12, -0.18), 0.0, vec3(0.15, 0.3, 0.4));
  float tops[4] = float[](0.8, 0.88, 0.82, 0.66);
  for (int i = 0; i < 4; i++) {
    float x = 0.035 + float(i) * 0.06;
    h = smaxF(h, capTop(s, vec2(x, 0.05), vec2(x, tops[i]), 0.04, 0.26 - float(i) * 0.03, 0.22 - float(i) * 0.03), k);
  }
  h = smaxF(h, capTop(s, vec2(0.06, -0.22), vec2(0.03, 0.18), 0.05, 0.33, 0.34), k);
  h = smaxF(h, capTop(s, vec2(0.13, -0.45), vec2(0.17, -1.0), 0.12, 0.24, 0.18), k * 2.0);
  return smaxF(h, 0.0, 0.04) * 2.3;
}

float figMoth(vec2 p, float flap) {
  vec2 s = vec2(abs(p.x), p.y);
  float f = 0.86 + 0.14 * flap;
  float h = capTop(s, vec2(0.0, 0.22), vec2(0.0, -0.55), 0.085, 0.3, 0.22);
  h = smaxF(h, sphTop(s, vec2(0.0, 0.32), 0.18, 0.12), 0.03);
  float w1 = (length((rot(-0.55) * (s - vec2(0.42 * f, 0.2))) / vec2(0.5 * f, 0.21)) - 1.0) * 0.2;
  float w2 = (length((rot(0.5) * (s - vec2(0.3 * f, -0.26))) / vec2(0.33 * f, 0.21)) - 1.0) * 0.18;
  float wing = pillow(min(w1, w2), 0.07) * 0.4;
  wing += ridge(length(s - vec2(0.48 * f, 0.18)) - 0.09, 0.025) * 0.18 * step(w1, 0.0);
  wing += ridge(length(s - vec2(0.3 * f, -0.28)) - 0.06, 0.02) * 0.15 * step(w2, 0.0);
  h = max(h, wing);
  h = max(h, capTop(s, vec2(0.04, 0.42), vec2(0.2, 0.8), 0.022, 0.25, 0.3));
  return smaxF(h, 0.0, 0.03) * 1.7;
}

float figEye(vec2 p, vec2 look, float t) {
  vec2 c = p - vec2(0.0, -0.1);
  float h = ridge(sdEqTri(c, 0.62), 0.06) * 0.6;
  float r = length(p), a = atan(p.y, p.x);
  float k = 16.0, ar = abs(fract(a * k / TAU + 0.5) - 0.5) * TAU / k * r;
  float rays = ridge(ar, 0.03) * smoothstep(0.78, 0.84, r) * (1.0 - smoothstep(0.95, 1.05, r + 0.04 * sin(a * k * 0.5 + t)));
  h = max(h, rays * 0.45);
  float blink = smoothstep(0.0, 0.08, abs(fract(t * 0.11) - 0.5) - 0.02) * 0.9 + 0.1;
  return h + eyeR(c - vec2(0.0, -0.1), look, 0.3, 0.13 * blink, 1.0) * step(sdEqTri(c, 0.6), 0.0);
}

float figHamsa(vec2 p, vec2 look) {
  vec2 s = vec2(abs(p.x), p.y);
  float d = (length((s - vec2(0.0, -0.18)) / vec2(0.48, 0.46)) - 1.0) * 0.42;
  d = smin(d, sdSeg(s, vec2(0.0, 0.2), vec2(0.0, 0.84)) - 0.12, 0.06);
  d = smin(d, sdSeg(s, vec2(0.24, 0.16), vec2(0.27, 0.72)) - 0.11, 0.06);
  d = smin(d, sdSeg(s, vec2(0.42, -0.1), vec2(0.66, 0.3)) - 0.11, 0.08);
  float h = pillow(d, 0.14) * 0.7;
  h += ridge(d + 0.07, 0.025) * 0.15;
  return h + eyeR(p - vec2(0.0, -0.2), look, 0.26, 0.11, 0.8);
}

float figOuroboros(vec2 p, float t) {
  float r = length(p), a = atan(p.y, p.x) - t * 0.4;
  float u = fract(a / TAU);
  float w = 0.13 * mix(0.25, 1.0, 1.0 - smoothstep(0.55, 0.97, u));
  float body = abs(r - 0.66) - w;
  float h = pillow(body, w + 0.02) * 0.7;
  h += 0.05 * sin(u * 140.0) * sin((r - 0.66) / max(w, 0.01) * 3.0) * step(body, 0.0);
  vec2 hc = 0.66 * vec2(cos(t * 0.4), sin(t * 0.4));
  vec2 hp = rot(-t * 0.4) * (p - hc);
  float head = (length(hp / vec2(0.2, 0.17)) - 1.0) * 0.17;
  h = max(h, pillow(head, 0.12) * 0.85);
  h -= 0.25 * (1.0 - smoothstep(0.03, 0.05, length(hp - vec2(0.02, 0.08))));
  return h;
}

float figSerpent(vec2 p, float t) {
  float x = p.x, ph = x * 5.0 - t * 2.0, env = smoothstep(-1.0, -0.3, x) * 0.8 + 0.2;
  float f = 0.2 * sin(ph) * env, df = 0.2 * 5.0 * cos(ph) * env;
  float w = 0.03 + 0.09 * smoothstep(-1.0, -0.1, x);
  float d = max(abs(p.y - f) / sqrt(1.0 + df * df) - w, abs(x + 0.08) - 0.84);
  float hx = 0.8, hy = 0.2 * sin(hx * 5.0 - t * 2.0) * 0.8;
  float head = (length((p - vec2(hx, hy)) / vec2(0.19, 0.13)) - 1.0) * 0.13;
  d = smin(d, head, 0.05);
  float h = pillow(d, 0.1) * 0.7;
  h += 0.06 * sin(x * 60.0) * step(d, 0.0);
  h -= 0.2 * (1.0 - smoothstep(0.02, 0.035, length(p - vec2(hx + 0.07, hy + 0.05))));
  return h;
}

float figYinYang(vec2 p, float t) {
  p = rot(t * 0.25) * p;
  float R = 0.85, r = length(p);
  float top = length(p - vec2(0.0, R * 0.5)) - R * 0.5, bot = length(p + vec2(0.0, R * 0.5)) - R * 0.5;
  float light = min(max(-p.x, -bot), top);
  float side = 1.0 - smoothstep(-0.015, 0.015, light);
  side = mix(side, 0.0, 1.0 - smoothstep(0.1, 0.12, length(p - vec2(0.0, R * 0.5))));
  side = mix(side, 1.0, 1.0 - smoothstep(0.1, 0.12, length(p + vec2(0.0, R * 0.5))));
  return pillow(r - R, 0.12) * (0.3 + 0.55 * side) + ridge(r - R - 0.04, 0.03) * 0.3;
}

float figLotus(vec2 p) {
  vec2 q = p - vec2(0.0, -0.55);
  float h = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i) - 3.0, L = 0.5 - 0.06 * abs(fi) - 0.025 * fi * fi;
    vec2 r = rot(fi * 0.34) * q;
    float d = sdLens(r - vec2(0.0, L), L, 0.15);
    h = max(h, pillow(d, 0.08) * (0.85 - 0.08 * abs(fi)) + ridge(r.x, 0.012) * 0.08 * step(d, 0.0));
  }
  h = max(h, pillow((length((p - vec2(0.0, -0.62)) / vec2(0.62, 0.13)) - 1.0) * 0.13, 0.06) * 0.45);
  return h;
}

float figSun(vec2 p, float t) {
  float r = length(p), a = atan(p.y, p.x);
  float h = max(ridge(r - 0.46, 0.06) * 0.7, pillow(r - 0.11, 0.11) * 0.9);
  float aa = a + 0.07 * sin(r * 16.0 - t * 2.5);
  float ar = abs(fract(aa * 12.0 / TAU + 0.5) - 0.5) * TAU / 12.0 * r;
  h = max(h, ridge(ar, 0.045 * (1.1 - r)) * smoothstep(0.56, 0.62, r) * (1.0 - smoothstep(0.86, 0.98, r)) * 0.6);
  return h;
}

float figMoon(vec2 p, float t) {
  float d = sdMoon(rot(0.35) * p, 0.34, 0.78, 0.7);
  float h = pillow(d, 0.16) * 0.8;
  for (int i = 0; i < 3; i++) {
    vec2 c = vec2(0.52 + float(i) * 0.12, 0.55 - float(i) * 0.42);
    h = max(h, pillow(sdStar(p - c, 0.07, 4.0, 2.4), 0.04) * (0.5 + 0.2 * sin(t * 2.0 + float(i) * 2.0)));
  }
  return h;
}

float figStar(vec2 p, float t) {
  float h = pillow(sdStar(rot(t * 0.1) * p, 0.6, 8.0, 3.2), 0.18) * 0.85;
  for (int i = 0; i < 7; i++) {
    float a = float(i) / 7.0 * TAU + 0.4;
    vec2 c = 0.84 * vec2(cos(a), sin(a));
    h = max(h, pillow(sdStar(p - c, 0.09, 8.0, 3.0), 0.05) * 0.5);
  }
  return h - 0.2 * (1.0 - smoothstep(0.06, 0.09, length(p)));
}

float figTriskele(vec2 p, float t) {
  float r = length(p), a = atan(p.y, p.x);
  float v = sin(3.0 * a + log(max(r, 0.02)) * 9.0 - t * 0.8);
  float h = (1.0 - smoothstep(0.0, 0.4, abs(v))) * pillow(r - 0.86, 0.12) * 0.7;
  return max(h, pillow(r - 0.1, 0.1) * 0.7) + ridge(r - 0.92, 0.03) * 0.35;
}

float figHourglass(vec2 p, float t) {
  vec2 q = abs(p);
  float glass = q.x - (0.05 + 0.4 * smoothstep(0.02, 0.75, q.y));
  float d = max(glass, q.y - 0.76);
  float h = ridge(d, 0.035) * 0.55;
  h = max(h, pillow(sdBox2(vec2(p.x, q.y - 0.84), vec2(0.56, 0.06)), 0.05) * 0.7);
  h = max(h, ridge(q.x - 0.6, 0.03) * 0.5 * step(q.y, 0.84));
  float lvl = fract(t * 0.03);
  float sandB = max(d, p.y + 0.76 - 0.55 * lvl - 0.08 * (1.0 - abs(p.x) * 3.0));
  float sandT = max(d, -(p.y - 0.02 - 0.7 * (1.0 - lvl)) );
  h = max(h, pillow(min(sandB, max(sandT, -p.y)), 0.05) * 0.35);
  h = max(h, ridge(p.x, 0.012) * 0.3 * step(abs(p.y + 0.35), 0.35));
  return h;
}

float figKeyhole(vec2 p) {
  float plate = sdBox2(p, vec2(0.42, 0.75)) - 0.12;
  float h = pillow(plate, 0.12) * 0.6 + ridge(plate + 0.08, 0.025) * 0.15;
  float hole = min(length(p - vec2(0.0, 0.18)) - 0.16, sdBox2(p - vec2(0.0, -0.12), vec2(0.06 + 0.06 * clamp(-(p.y + 0.0) * 2.0, 0.0, 1.0), 0.28)));
  return mix(h, -0.9, 1.0 - smoothstep(-0.01, 0.015, hole));
}

float figDoor(vec2 p) {
  vec2 q = p - vec2(0.0, -0.08);
  float arch = min(sdBox2(q - vec2(0.0, -0.28), vec2(0.34, 0.55)), length(q - vec2(0.0, 0.27)) - 0.34);
  float h = ridge(arch - 0.08, 0.07) * 0.6 + ridge(arch - 0.2, 0.03) * 0.2;
  return mix(h, -1.0, 1.0 - smoothstep(-0.02, 0.02, arch));
}

float figMandala(vec2 p, float t) {
  float r = length(p), a = atan(p.y, p.x) + t * 0.15;
  float h = ridge(r - 0.92, 0.035) * 0.45 + ridge(r - 0.56, 0.03) * 0.5 + ridge(r - 0.3, 0.03) * 0.5;
  float a8 = mod(a, TAU / 8.0) - TAU / 16.0;
  vec2 q = r * vec2(cos(a8), sin(a8));
  h = max(h, pillow(sdLens((q - vec2(0.43, 0.0)).yx, 0.12, 0.06), 0.05) * 0.75);
  float a16 = mod(a + TAU / 32.0, TAU / 16.0) - TAU / 32.0;
  vec2 q2 = r * vec2(cos(a16), sin(a16));
  h = max(h, pillow(sdLens((q2 - vec2(0.74, 0.0)).yx, 0.15, 0.05), 0.04) * 0.6);
  h = max(h, pillow(length(q2 - vec2(0.59, 0.0)) - 0.025, 0.025) * 0.5);
  return max(h, pillow(r - 0.18, 0.18) * 0.85 - 0.25 * (1.0 - smoothstep(0.04, 0.06, r)));
}

float figFlower(vec2 p) {
  float r0 = 0.28, d = abs(length(p) - 3.0 * r0);
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    if (abs(i + j) > 2) continue;
    vec2 c = r0 * (float(i) * vec2(1.0, 0.0) + float(j) * vec2(0.5, 0.8660254));
    d = min(d, abs(length(p - c) - r0));
  }
  return ridge(d, 0.035) * 0.75 * (1.0 - smoothstep(0.86, 0.9, length(p)));
}

float figMetatron(vec2 p) {
  float d = 1e3;
  vec2 O[6], I[6];
  for (int k = 0; k < 6; k++) {
    float a = float(k) * TAU / 6.0 + PI * 0.5;
    O[k] = 0.84 * vec2(cos(a), sin(a)); I[k] = 0.42 * vec2(cos(a), sin(a));
    d = min(d, abs(length(p - O[k]) - 0.12));
    d = min(d, abs(length(p - I[k]) - 0.12));
  }
  d = min(d, abs(length(p) - 0.12));
  for (int k = 0; k < 6; k++) {
    d = min(d, sdSeg(p, O[k], O[(k + 1) % 6]));
    d = min(d, sdSeg(p, O[k], O[(k + 2) % 6]));
    d = min(d, sdSeg(p, I[k], I[(k + 2) % 6]));
    d = min(d, sdSeg(p, O[k], vec2(0.0)));
    d = min(d, sdSeg(p, O[k], I[(k + 1) % 6]));
  }
  return ridge(d, 0.025) * 0.7;
}

float figSriYantra(vec2 p) {
  float d = abs(length(p) - 0.76);
  d = min(d, abs(length(p) - 0.82));
  float up[4] = float[](0.6, 0.47, 0.33, 0.2), uo[4] = float[](-0.04, -0.12, 0.05, -0.05);
  float dn[5] = float[](0.64, 0.5, 0.38, 0.26, 0.15), dO[5] = float[](0.05, -0.06, 0.1, -0.08, 0.04);
  for (int i = 0; i < 4; i++) d = min(d, abs(sdEqTri(p - vec2(0.0, uo[i]), up[i])));
  for (int i = 0; i < 5; i++) d = min(d, abs(sdEqTri(vec2(p.x, -(p.y - dO[i])), dn[i])));
  float gate = abs(sdBox2(p, vec2(0.95)));
  gate = max(gate, -sdBox2(vec2(min(abs(p.x), abs(p.y)), max(abs(p.x), abs(p.y)) - 0.95), vec2(0.14, 0.04)));
  d = min(d, gate);
  return ridge(d, 0.022) * 0.7 + pillow(length(p) - 0.04, 0.04) * 0.6;
}

float figVesica(vec2 p) {
  float d = min(abs(length(p - vec2(-0.3, 0.0)) - 0.6), abs(length(p + vec2(-0.3, 0.0)) - 0.6));
  float lens = sdVesica(p, 0.6, 0.3);
  return max(ridge(d, 0.03) * 0.6, pillow(lens, 0.2) * 0.5) + ridge(sdLens(p.yx, 0.25, 0.1), 0.02) * 0.2;
}

float figTree(vec2 p) {
  vec2 S[10] = vec2[](vec2(0.0, 0.92), vec2(0.42, 0.66), vec2(-0.42, 0.66), vec2(0.42, 0.2), vec2(-0.42, 0.2),
                      vec2(0.0, 0.02), vec2(0.42, -0.44), vec2(-0.42, -0.44), vec2(0.0, -0.64), vec2(0.0, -0.92));
  ivec2 P[22] = ivec2[](ivec2(0, 1), ivec2(0, 2), ivec2(0, 5), ivec2(1, 2), ivec2(1, 5), ivec2(2, 5), ivec2(1, 3), ivec2(2, 4),
                        ivec2(3, 4), ivec2(3, 5), ivec2(4, 5), ivec2(3, 6), ivec2(4, 7), ivec2(5, 6), ivec2(5, 7), ivec2(5, 8),
                        ivec2(6, 7), ivec2(6, 8), ivec2(7, 8), ivec2(8, 9), ivec2(6, 9), ivec2(7, 9));
  float d = 1e3, c = 1e3;
  for (int i = 0; i < 22; i++) d = min(d, sdSeg(p, S[P[i].x], S[P[i].y]));
  for (int i = 0; i < 10; i++) c = min(c, length(p - S[i]) - 0.09);
  return max(ridge(d, 0.025) * 0.45, pillow(c, 0.08) * 0.85);
}

float figLabyrinth(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  float sp = 0.115, ri = r / sp, k = floor(ri + 0.5);
  float dr = abs(ri - k) * sp;
  float ga = -1.5708 + k * 2.4;
  float da = abs(mod(a - ga + PI, TAU) - PI) * r;
  float rings = (k >= 1.0 && k <= 7.0) ? ridge(dr, 0.022) * smoothstep(0.07, 0.1, da) : 0.0;
  float kk = floor(ri);
  float wa = -1.5708 + kk * 2.4 + 0.5;
  float wall = (kk >= 1.0 && kk <= 6.0) ? ridge(abs(mod(a - wa + PI, TAU) - PI) * r, 0.022) : 0.0;
  return max(rings, wall) * 0.7 + pillow(r - 0.07, 0.07) * 0.6;
}

float figHexagram(vec2 p, float t) {
  vec2 q = rot(t * 0.1) * p;
  float d = abs(sdHexagram(q, 0.38));
  d = min(d, abs(length(p) - 0.9));
  return ridge(d, 0.035) * 0.7 + pillow(sdHexagram(q, 0.36), 0.15) * 0.25;
}

float figureRelief(int id, vec2 p, vec2 look, float sing, float t) {
  if (dot(p, p) > 2.4) return 0.0;
  switch (id) {
    case 0: return figFace(p, look, sing);
    case 1: return max(figFace((p - vec2(-0.5, 0.0)) / 0.55, vec2(0.8, look.y), sing), figFace((p - vec2(0.5, 0.0)) / 0.55 * vec2(-1.0, 1.0), vec2(0.8, look.y), sing));
    case 2: return figSkull(p, sing);
    case 3: return figShadow(p, t);
    case 4: return figVase(p);
    case 5: return figMask(p);
    case 6: return figPraying(p);
    case 7: return figMoth(p, sing);
    case 8: return figEye(p, look, t);
    case 9: return figHamsa(p, look);
    case 10: return figOuroboros(p, t);
    case 11: return figSerpent(p, t);
    case 12: return figYinYang(p, t);
    case 13: return figLotus(p);
    case 14: return figSun(p, t);
    case 15: return figMoon(p, t);
    case 16: return figStar(p, t);
    case 17: return figTriskele(p, t);
    case 18: return figHourglass(p, t);
    case 19: return figKeyhole(p);
    case 20: return figDoor(p);
    case 21: return figMandala(p, t);
    case 22: return figFlower(p);
    case 23: return figMetatron(p);
    case 24: return figSriYantra(p);
    case 25: return figVesica(p);
    case 26: return figTree(p);
    case 27: return figLabyrinth(p);
    case 28: return figHexagram(p, t);
  }
  return 0.0;
}

// the figure's height in the sheet at q. Rising, its highest parts break through first; changing, one
// figure re-forms into the next. Repeated, they cover the sheet like wallpaper.
float figureH(vec2 q) {
  vec2 p = rot(-FIGROT) * (q - vec2(FIGX, FIGY)) / FIGS;
  if (FIGREP > 0.5) { float sp = 2.25; p = mod(p + sp * 0.5, sp) - sp * 0.5; }
  vec2 look = vec2(FIGLX, FIGLY);
  float r = figureRelief(int(FIGA + 0.5), p, look, FIGSING, FIGT);
  if (FIGMIX > 0.001) r = mix(r, figureRelief(int(FIGB + 0.5), p, look, FIGSING, FIGT), FIGMIX);
  float rise = clamp(FIG, 0.0, 1.0);
  float h = max(r - (1.0 - rise) * 1.05, 0.0) + min(r, 0.0) * rise;
  return h * FIGS * 0.3 * FIGD;
}
`;
