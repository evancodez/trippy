// Figures pressing up through the sheet. Each one is a solid 3D shape — like the hands — that the
// fabric drapes over (a soft union with the sheet), so what you see is its silhouette in the lines:
// a face, a skull, someone trapped behind the sheet, the Lovers under their veils, a raven, antlers…
// Figure space: about a half-unit across, +y up, +z toward you (out of the sheet). `lift` brings the
// flatter ones (bodies, wings) further forward so every figure comes through the fabric about as much.
// The order here is the id the shader switches on.

export const FIGURES = [
  // presences
  { id: 'face', lift: 0, name: 'Face', group: 'Presences', blurb: 'a face pressing through, like a ghost in the shell' },
  { id: 'skull', lift: 0.02, name: 'Skull', group: 'Presences', blurb: 'memento mori — its jaw moves with the music' },
  { id: 'trapped', lift: 0.12, name: 'Trapped', group: 'Presences', blurb: 'someone behind the sheet, palms flat against it' },
  { id: 'reach', lift: 0.04, name: 'Reaching', group: 'Presences', blurb: 'an arm reaching out at you' },
  { id: 'lovers', lift: 0.1, name: 'The Lovers', group: 'Presences', blurb: 'two heads kissing under a sheet, after Magritte' },
  { id: 'bust', lift: 0.06, name: 'Bust', group: 'Presences', blurb: 'a statue, head and shoulders' },
  { id: 'vitruvian', lift: 0.13, name: 'Vitruvian', group: 'Presences', blurb: 'arms out, inside the circle' },
  { id: 'meditator', lift: 0.11, name: 'Meditator', group: 'Presences', blurb: 'sitting very still, a halo behind' },
  { id: 'praying', lift: 0.08, name: 'Praying hands', group: 'Presences', blurb: 'two hands pressed together' },
  // creatures
  { id: 'raven', lift: 0.13, name: 'Raven', group: 'Creatures', blurb: 'wings open, beating with the music' },
  { id: 'moth', lift: 0.15, name: 'Moth', group: 'Creatures', blurb: 'drawn to the light' },
  { id: 'cobra', lift: 0.1, name: 'Cobra', group: 'Creatures', blurb: 'rearing up, hood open, swaying' },
  { id: 'stag', lift: 0.12, name: 'Stag skull', group: 'Creatures', blurb: 'antlers' },
  { id: 'cat', lift: 0.08, name: 'Cat', group: 'Creatures', blurb: 'sitting, watching' },
  // symbols
  { id: 'eye', lift: 0.02, name: 'The Eye', group: 'Symbols', blurb: 'an eye the size of a head, following you' },
  { id: 'merkaba', lift: 0.06, name: 'Merkaba', group: 'Symbols', blurb: 'two pyramids through each other, turning' },
  { id: 'ouroboros', lift: 0.1, name: 'Ouroboros', group: 'Symbols', blurb: 'the serpent eating its tail' },
];
export const FIGURE_INDEX = Object.fromEntries(FIGURES.map((f, i) => [f.id, i]));
export const FIGURE_GROUPS = [...new Set(FIGURES.map(f => f.group))];

// needs from the shader: smin, rot, sdCapsule, sdBox, sdRoundBox, faceH, handSDF, PI/TAU,
// and the figure values: FIGT (its clock), FIGLX/FIGLY (where eyes look), FIGSING (the music)
export const FIGURES_GLSL = `
// ---------------------------------------------------------------- figures pressing up through the sheet
float smaxF(float a, float b, float k) { return -smin(-a, -b, k); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdRing(vec3 p, float R, float r) { return length(vec2(length(p.xy) - R, p.z)) - r; }   // a ring facing you
float sdTetra(vec3 p, float r) { float m = max(max(-p.x - p.y - p.z, p.x + p.y - p.z), max(-p.x + p.y + p.z, p.x - p.y + p.z)); return (m - r) * 0.57735; }
vec3 mx(vec3 p) { return vec3(abs(p.x), p.yz); }

// a smooth head whose front is the ghost face: features softened, as if pressed into latex
float figFace(vec3 p) {
  float d = sdEll(p - vec3(0.0, 0.0, -0.08), vec3(0.25, 0.33, 0.25));
  float front = smoothstep(-0.04, 0.14, p.z);
  d -= faceH(p.xy * vec2(1.3, 1.35), 0.0) * 0.16 * front;
  return d * 0.75;
}

float figSkull(vec3 p, float jaw) {
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.08, -0.04), vec3(0.24, 0.25, 0.26));                       // cranium
  d = smin(d, sdEll(p - vec3(0.0, -0.1, 0.04), vec3(0.17, 0.13, 0.17)), 0.07);              // face
  d = smin(d, sdEll(m - vec3(0.14, -0.06, 0.07), vec3(0.06, 0.05, 0.08)), 0.04);            // cheekbones
  float jy = -0.25 - jaw * 0.045;
  d = smin(d, sdEll(p - vec3(0.0, jy, 0.05), vec3(0.13, 0.07, 0.12)), 0.04);                // jaw
  float teeth = sdRoundBox(p - vec3(0.0, -0.19 - jaw * 0.02, 0.15), vec3(0.085, 0.028, 0.022), 0.008);
  teeth += 0.004 * abs(sin(p.x * 75.0));
  d = smin(d, teeth, 0.015);
  d = smaxF(d, -(length(m - vec3(0.085, 0.0, 0.17)) - 0.068), 0.02);                         // sockets
  d = smaxF(d, -sdEll(p - vec3(0.0, -0.09, 0.2), vec3(0.028, 0.045, 0.06)), 0.015);          // nose
  d = smaxF(d, -(length(m - vec3(0.245, -0.03, -0.02)) - 0.05), 0.03);                        // temples
  return d * 0.9;
}

// someone behind the sheet, palms flat against it
float figTrapped(vec3 p, float t) {
  vec3 m = mx(p);
  float br = 0.008 * sin(t * 1.2);
  float d = sdEll(p - vec3(0.0, 0.3, 0.04), vec3(0.085, 0.105, 0.095));                      // head
  d = smin(d, sdCapsule(p, vec3(0.0, 0.17, 0.0), vec3(0.0, 0.24, 0.02), 0.038), 0.03);       // neck
  d = smin(d, sdEll(p - vec3(0.0, 0.04, 0.0), vec3(0.15 + br, 0.15, 0.075)), 0.06);           // chest
  d = smin(d, sdEll(p - vec3(0.0, -0.16, -0.01), vec3(0.11, 0.12, 0.065)), 0.07);             // waist
  d = smin(d, sdEll(p - vec3(0.0, -0.3, -0.02), vec3(0.13, 0.08, 0.07)), 0.06);              // hips
  vec3 sh = vec3(0.14, 0.14, 0.0), el = vec3(0.25, 0.29, 0.03), wr = vec3(0.2, 0.43, 0.07);
  d = smin(d, sdCapsule(m, sh, el, 0.038), 0.04);
  d = smin(d, sdCapsule(m, el, wr, 0.032), 0.03);
  d = smin(d, sdEll(m - vec3(0.205, 0.5, 0.085), vec3(0.042, 0.065, 0.016)), 0.025);         // palms
  d = smin(d, sdCapsule(m, vec3(0.07, -0.34, -0.02), vec3(0.09, -0.65, 0.0), 0.05), 0.05);   // legs
  return d;
}

// an arm reaching out of the sheet at you, the shoulder and head just behind
float figReach(vec3 p, float t) {
  float d = sdEll(p - vec3(-0.17, 0.2, -0.1), vec3(0.085, 0.105, 0.09));                    // head
  d = smin(d, sdEll(p - vec3(-0.12, -0.06, -0.14), vec3(0.17, 0.15, 0.08)), 0.07);           // shoulders
  vec3 sh = vec3(0.0, 0.0, -0.1), el = vec3(0.09, 0.06, 0.04), wr = vec3(0.13, 0.11, 0.17);
  d = smin(d, sdCapsule(p, sh, el, 0.045), 0.04);
  d = smin(d, sdCapsule(p, el, wr, 0.037), 0.03);
  vec3 hq = (p - (wr + vec3(0.02, 0.07, 0.02))) / 0.6;
  hq.yz = rot(0.5) * hq.yz;
  d = smin(d, handSDF(hq, 0.2 + 0.25 * (0.5 + 0.5 * sin(t * 0.9)), 0.75, 10) * 0.6, 0.02);
  return d;
}

// a head in profile, facing +x
float headProfile(vec3 p) {
  float d = sdEll(p - vec3(-0.03, 0.03, 0.0), vec3(0.11, 0.13, 0.1));
  d = smin(d, sdEll(p - vec3(0.055, -0.04, 0.0), vec3(0.06, 0.085, 0.075)), 0.04);
  d = smin(d, sdCapsule(p, vec3(0.085, 0.035, 0.0), vec3(0.125, -0.005, 0.0), 0.02), 0.02);   // nose
  d = smin(d, sdEll(p - vec3(0.1, -0.062, 0.0), vec3(0.024, 0.03, 0.04)), 0.015);             // lips
  d = smin(d, sdEll(p - vec3(0.08, -0.105, 0.0), vec3(0.032, 0.026, 0.045)), 0.02);           // chin
  d = smin(d, sdCapsule(p, vec3(-0.02, -0.08, -0.02), vec3(-0.04, -0.34, -0.04), 0.058), 0.04);   // neck
  return d;
}
// Magritte's lovers: two veiled heads, kissing
float figLovers(vec3 p, float t) {
  float k = 0.006 * sin(t * 0.8);
  vec3 a = p - vec3(-0.13 - k, 0.0, 0.0), b = (p - vec3(0.13 + k, 0.0, 0.0)) * vec3(-1.0, 1.0, 1.0);
  a.xy = rot(0.14) * a.xy; b.xy = rot(0.14) * b.xy;
  return smin(headProfile(a), headProfile(b), 0.02);
}

float figBust(vec3 p) {
  float d = figFace((p - vec3(0.0, 0.17, 0.02)) / 0.66) * 0.66;
  d = smin(d, sdCapsule(p, vec3(0.0, -0.02, -0.05), vec3(0.0, 0.08, -0.03), 0.075), 0.05);
  d = smin(d, sdEll(p - vec3(0.0, -0.17, -0.07), vec3(0.37, 0.12, 0.12)), 0.08);
  d = smin(d, sdEll(p - vec3(0.0, -0.33, -0.07), vec3(0.3, 0.17, 0.11)), 0.06);
  return d;
}

float figVitruvian(vec3 p, float t) {
  vec3 m = mx(p);
  float lift = 0.04 * sin(t * 0.6);
  float d = sdEll(p - vec3(0.0, 0.31, 0.02), vec3(0.062, 0.078, 0.068));
  d = smin(d, sdEll(p - vec3(0.0, 0.08, 0.0), vec3(0.105, 0.13, 0.065)), 0.05);
  d = smin(d, sdEll(p - vec3(0.0, -0.1, -0.01), vec3(0.085, 0.09, 0.055)), 0.05);
  d = smin(d, sdCapsule(m, vec3(0.08, 0.17, 0.0), vec3(0.43, 0.19 + lift, 0.02), 0.03), 0.03);
  d = smin(d, sdCapsule(m, vec3(0.05, -0.17, -0.01), vec3(0.21, -0.46, 0.01), 0.037), 0.03);
  d = min(d, sdRing(p - vec3(0.0, -0.02, -0.03), 0.48, 0.016));
  return d;
}

float figMeditator(vec3 p, float t) {
  vec3 m = mx(p);
  float b = 0.006 * sin(t * 0.8);
  float d = sdEll(p - vec3(0.0, 0.25, 0.03), vec3(0.07, 0.085, 0.075));
  d = smin(d, sdEll(p - vec3(0.0, 0.06 + b, 0.0), vec3(0.12, 0.14, 0.07)), 0.06);
  d = smin(d, sdEll(p - vec3(0.0, -0.16, 0.0), vec3(0.27, 0.07, 0.12)), 0.06);
  d = smin(d, sdCapsule(m, vec3(0.11, 0.14, 0.0), vec3(0.16, -0.01, 0.03), 0.03), 0.03);
  d = smin(d, sdCapsule(m, vec3(0.16, -0.01, 0.03), vec3(0.17, -0.12, 0.06), 0.026), 0.02);
  d = min(d, sdRing(p - vec3(0.0, 0.26, -0.07), 0.13 + 0.01 * sin(t), 0.012));
  return d;
}

// two of the hands, palm to palm, thumbs toward you
float figPraying(vec3 p) {
  vec3 m = mx(p) - vec3(0.022, -0.02, 0.0);
  vec3 q = vec3(m.z, m.y, -m.x) / 0.9;
  return handSDF(q, 0.08, 0.12, 10) * 0.9;
}

float figRaven(vec3 p, float t, float beat) {
  vec3 m = mx(p);
  float flap = 0.1 * sin(t * 1.6) + 0.12 * beat;
  float d = sdEll(p - vec3(0.0, 0.0, 0.0), vec3(0.07, 0.15, 0.07));
  d = smin(d, sdEll(p - vec3(0.0, 0.17, 0.03), vec3(0.055, 0.055, 0.055)), 0.03);
  d = smin(d, sdCapsule(p, vec3(0.0, 0.16, 0.07), vec3(0.0, 0.12, 0.15), 0.014), 0.01);
  vec3 w = m - vec3(0.05, 0.05, 0.0);
  w.xy = rot(-0.35 - flap) * w.xy;
  d = smin(d, sdEll(w - vec3(0.19, 0.0, -0.01), vec3(0.19, 0.055, 0.02)), 0.03);
  for (int i = 0; i < 5; i++) {
    float a = -0.55 + float(i) * 0.24;
    vec3 f0 = vec3(0.3, 0.0, -0.01);
    d = smin(d, sdCapsule(w, f0, f0 + vec3(cos(a), sin(a), 0.0) * (0.18 - float(i) * 0.014), 0.017), 0.02);
  }
  d = smin(d, sdEll(p - vec3(0.0, -0.21, -0.02), vec3(0.06, 0.08, 0.015)), 0.03);
  return d;
}

float figMoth(vec3 p, float t, float beat) {
  vec3 m = mx(p);
  float flap = 0.25 + 0.2 * sin(t * 2.2) + 0.2 * beat;
  float d = sdCapsule(p, vec3(0.0, 0.1, 0.03), vec3(0.0, -0.2, 0.0), 0.035);
  d = smin(d, sdEll(p - vec3(0.0, 0.13, 0.04), vec3(0.045, 0.04, 0.04)), 0.02);
  vec3 w = m; w.xz = rot(flap) * w.xz;
  vec3 w1 = w; w1.xy = rot(-0.45) * w1.xy;
  d = smin(d, sdEll(w1 - vec3(0.2, 0.0, 0.0), vec3(0.21, 0.1, 0.013)), 0.025);
  vec3 w2 = w; w2.xy = rot(0.45) * w2.xy;
  d = smin(d, sdEll(w2 - vec3(0.14, 0.0, 0.0), vec3(0.14, 0.085, 0.013)), 0.025);
  d = min(d, sdCapsule(m, vec3(0.02, 0.16, 0.04), vec3(0.1, 0.32, 0.03), 0.009));
  return d;
}

float figCobra(vec3 p, float t) {
  float s = 0.035 * sin(t * 1.3);
  vec3 c = p - vec3(0.0, -0.32, 0.0);
  float d = length(vec2(length(c.xz) - 0.17, c.y)) - 0.045;                                   // coils
  vec3 c2 = p - vec3(0.0, -0.24, 0.0);
  d = smin(d, length(vec2(length(c2.xz) - 0.12, c2.y)) - 0.042, 0.03);
  d = smin(d, sdCapsule(p, vec3(0.12, -0.25, 0.0), vec3(s * 0.4, -0.05, 0.03), 0.045), 0.04);
  d = smin(d, sdCapsule(p, vec3(s * 0.4, -0.05, 0.03), vec3(s, 0.12, 0.05), 0.043), 0.03);
  d = smin(d, sdEll(p - vec3(s, 0.16, 0.03), vec3(0.13, 0.12, 0.018)), 0.04);                // hood
  d = smin(d, sdEll(p - vec3(s, 0.22, 0.07), vec3(0.04, 0.05, 0.04)), 0.02);                 // head
  return d;
}

float figStag(vec3 p) {
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, -0.06, 0.02), vec3(0.075, 0.2, 0.07));
  d = smin(d, sdEll(p - vec3(0.0, 0.07, 0.0), vec3(0.1, 0.08, 0.08)), 0.04);
  d = smaxF(d, -(length(m - vec3(0.06, 0.04, 0.06)) - 0.03), 0.01);
  vec3 a0 = vec3(0.06, 0.12, 0.0), a1 = vec3(0.16, 0.26, 0.01), a2 = vec3(0.25, 0.42, 0.0), a3 = vec3(0.27, 0.6, -0.02);
  d = smin(d, sdCapsule(m, a0, a1, 0.022), 0.02);
  d = min(d, sdCapsule(m, a1, a2, 0.019));
  d = min(d, sdCapsule(m, a2, a3, 0.016));
  d = min(d, sdCapsule(m, a1, a1 + vec3(-0.03, 0.13, 0.02), 0.013));
  vec3 mid = mix(a1, a2, 0.6);
  d = min(d, sdCapsule(m, mid, mid + vec3(0.11, 0.06, 0.01), 0.013));
  d = min(d, sdCapsule(m, a2, a2 + vec3(-0.07, 0.11, 0.0), 0.012));
  d = min(d, sdCapsule(m, a3 - vec3(0.0, 0.06, 0.0), a3 + vec3(0.08, 0.02, 0.0), 0.011));
  return d;
}

float figCat(vec3 p, float t) {
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, -0.14, -0.02), vec3(0.13, 0.17, 0.1));                       // body
  d = smin(d, sdEll(p - vec3(0.0, 0.1, 0.01), vec3(0.095, 0.08, 0.08)), 0.05);               // head
  d = smin(d, sdCapsule(m, vec3(0.05, 0.15, 0.0), vec3(0.08, 0.25, -0.01), 0.02), 0.02);      // ears
  d = smin(d, sdCapsule(m, vec3(0.05, -0.06, 0.06), vec3(0.05, -0.3, 0.07), 0.026), 0.03);    // front legs
  float sw = 0.04 * sin(t);
  d = smin(d, sdCapsule(p, vec3(0.1, -0.28, -0.02), vec3(0.24, -0.22 + sw, 0.0), 0.022), 0.03);   // tail
  d = smaxF(d, -(length(m - vec3(0.035, 0.11, 0.085)) - 0.018), 0.01);                        // eyes
  return d;
}

// a big eyeball, its iris turning to find you
float figEye(vec3 p, vec2 look) {
  vec3 dir = normalize(vec3(look.x * 0.6, look.y * 0.6, 1.0));
  float d = length(p) - 0.22;
  float c = dot(normalize(p + 1e-5), dir);
  d += 0.014 * smoothstep(0.86, 0.9, c) * (1.0 - smoothstep(0.96, 0.99, c));
  d -= 0.022 * smoothstep(0.95, 1.0, c);
  d = smin(d, sdEll(p - vec3(0.0, 0.0, -0.04), vec3(0.34, 0.15, 0.2)) + 0.03, 0.08);         // the lids around it
  return d;
}

float figMerkaba(vec3 p, float t) {
  vec3 q = p;
  q.xz = rot(t * 0.35) * q.xz;
  q.yz = rot(0.62) * q.yz;
  return min(sdTetra(q, 0.17), sdTetra(-q, 0.17));
}

float figOuroboros(vec3 p, float t) {
  vec3 q = p;
  q.xy = rot(-t * 0.35) * q.xy;
  float a = atan(q.y, q.x), u = fract(a / TAU);
  float r = 0.055 * mix(0.3, 1.0, 1.0 - smoothstep(0.55, 0.97, u));
  float d = length(vec2(length(q.xy) - 0.3, q.z)) - r;
  d = smin(d, sdEll(q - vec3(0.3, 0.0, 0.015), vec3(0.075, 0.06, 0.05)), 0.03);
  return d * 0.9;
}

float figure3D(int id, vec3 p) {
  float t = FIGT, sing = FIGSING;
  vec2 look = vec2(FIGLX, FIGLY);
  switch (id) {
    case 0: return figFace(p);
    case 1: return figSkull(p, sing);
    case 2: return figTrapped(p, t);
    case 3: return figReach(p, t);
    case 4: return figLovers(p, t);
    case 5: return figBust(p);
    case 6: return figVitruvian(p, t);
    case 7: return figMeditator(p, t);
    case 8: return figPraying(p);
    case 9: return figRaven(p, t, sing);
    case 10: return figMoth(p, t, sing);
    case 11: return figCobra(p, t);
    case 12: return figStag(p);
    case 13: return figCat(p, t);
    case 14: return figEye(p, look);
    case 15: return figMerkaba(p, t);
    case 16: return figOuroboros(p, t);
  }
  return 1e3;
}

// one placed figure: pos (z comes up from far behind as it comes on), size S, turned by a, maybe
// re-forming a → b, maybe repeated across the sheet
float figPlaced(vec3 p, int ia, int ib, float mixAB, vec3 pos, float S, float a, float rep) {
  vec3 q = p - pos;
  q.xy = rot(-a) * q.xy;
  if (rep > 0.5) { float sp = 1.15 * S; q.xy = mod(q.xy + sp * 0.5, sp) - sp * 0.5; }
  q /= S;
  float bound = length(q) - 0.72;
  if (bound * S > 0.3) return bound * S;
  float d = figure3D(ia, q);
  if (mixAB > 0.001) d = mix(d, figure3D(ib, q), mixAB);
  return d * S;
}

// the Figures add-on, and the figure under your cursor when one is the tool
float figuresSDF(vec3 p) {
  float d = 1e3;
  if (FIG > 0.001) d = figPlaced(p, int(FIGA + 0.5), int(FIGB + 0.5), FIGMIX, vec3(FIGX, FIGY, mix(-0.75 * FIGS, FIGZ, FIG)), FIGS, FIGROT, FIGREP);
  if (FTON > 0.001) d = min(d, figPlaced(p, int(FTID + 0.5), 0, 0.0, vec3(FTX, FTY, mix(-0.75 * FTS, FTZ, FTON)), FTS, 0.0, 0.0));
  return d;
}
`;
