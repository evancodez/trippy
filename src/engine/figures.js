// Figures coming up out of the sheet. Each one is a solid 3D shape, like the hands, joined to the fabric
// with a soft union, so what you see is the sheet's own lines bending over it: a shape emerging from
// the pattern, not an object sitting on it. So they're kept simple, all silhouette and big forms. Their
// hollows (eye sockets, a mouth, a pupil, a tunnel) are carved out of the figure and the sheet together,
// so they go deep.
// Figure space: about a half-unit across, +y up, +z toward you. A figure turns to face the camera.
// `stand` says how it does that:
//   · 0: it faces the lens head-on, standing up out of the floor as the camera tilts down to it
//     (faces, skulls).
//   · 1: it stays upright on the sheet (its +y is the sheet's up) and only turns round to you,
//     with its ground at y = -lift. Things that sit on the ground (a coiled snake, mushrooms) are
//     half-way: upright to a low camera, leaning back toward one looking down, so it sees them three-quarters.
// `lift` brings a figure further out of the sheet; `veil` is how much the fabric clings to it
// (1: draped like a ghost; small: it comes clean through).
// The order here is the id the shader switches on; `call` is how the shader draws it, `uses` the other
// figures' code it needs. The shader is built with only the groups on screen (see figureBank): all of
// them in one shader would make the GPU compiler give up and slow every look down, figures or not.

export const FIGURES = [
  // presences
  { id: 'skull', lift: 0.1, stand: 0, veil: 0.5, name: 'Skull', group: 'Presences', blurb: 'memento mori — sockets that go all the way down, its jaw moving with the music', call: 'figSkull(p, sing)' },
  { id: 'face', lift: 0.02, stand: 0, veil: 1, name: 'Face', group: 'Presences', blurb: 'a face pressing through, like a ghost in the shell', call: 'figFace(p)' },
  { id: 'mask', uses: ['face'], lift: 0.05, stand: 0, veil: 0.6, name: 'Hollow mask', group: 'Presences', blurb: 'the same face, with nothing behind its eyes', call: 'figMask(p, sing)' },
  { id: 'scream', lift: 0.08, stand: 0, veil: 0.55, name: 'The Scream', group: 'Presences', blurb: 'hands to its face, its mouth open into the dark', call: 'figScream(p, t, sing)' },
  { id: 'lips', lift: 0.1, stand: 0, veil: 0.55, name: 'Lips', group: 'Presences', blurb: 'a mouth the size of a head, singing along', call: 'figLips(p, sing)' },
  { id: 'ribs', lift: 0.1, stand: 0, veil: 0.45, name: 'Ribcage', group: 'Presences', blurb: 'breathing, over a pit', call: 'figRibs(p, t)' },
  { id: 'trapped', lift: 0.12, stand: 0, veil: 1, name: 'Trapped', group: 'Presences', blurb: 'someone behind the sheet, palms flat against it', call: 'figTrapped(p, t)' },
  { id: 'reach', lift: 0.04, stand: 0, veil: 0.8, name: 'Reaching', group: 'Presences', blurb: 'an arm reaching out at you', call: 'figReach(p, t)' },
  { id: 'lovers', lift: 0.1, stand: 0, veil: 1, name: 'The Lovers', group: 'Presences', blurb: 'two heads kissing under a sheet, after Magritte', call: 'figLovers(p, t)' },
  { id: 'vitruvian', lift: 0.13, stand: 0, veil: 0.6, name: 'Vitruvian', group: 'Presences', blurb: 'arms out, inside the circle', call: 'figVitruvian(p, t)' },
  { id: 'meditator', lift: 0.11, stand: 0, veil: 0.8, name: 'Meditator', group: 'Presences', blurb: 'sitting very still, a halo behind', call: 'figMeditator(p, t)' },
  { id: 'praying', lift: 0.08, stand: 0, veil: 0.6, name: 'Praying hands', group: 'Presences', blurb: 'two hands pressed together', call: 'figPraying(p)' },
  // creatures
  { id: 'serpent', lift: 0.3, stand: 0.5, veil: 0.4, name: 'Serpent', group: 'Creatures', blurb: 'coiled on the sheet, head up, tasting the air', call: 'figSerpent(p, t, 0.0)' },
  { id: 'cobra', uses: ['serpent'], lift: 0.3, stand: 0.5, veil: 0.4, name: 'Cobra', group: 'Creatures', blurb: 'rearing up out of its coil, hood open', call: 'figSerpent(p, t, 1.0)' },
  { id: 'tentacles', lift: 0.3, stand: 0.5, veil: 0.45, name: 'Tentacles', group: 'Creatures', blurb: 'something underneath, reaching up and curling', call: 'figTentacles(p, t)' },
  { id: 'jelly', lift: 0.2, stand: 0.5, veil: 0.45, name: 'Jellyfish', group: 'Creatures', blurb: 'a hollow bell, pulsing on the beat', call: 'figJelly(p, t, sing)' },
  { id: 'nautilus', lift: 0.05, stand: 0, veil: 0.35, name: 'Nautilus', group: 'Creatures', blurb: 'cut in half: a spiral of empty rooms', call: 'figNautilus(p)' },
  { id: 'shrooms', lift: 0.3, stand: 0.5, veil: 0.45, name: 'Mushrooms', group: 'Creatures', blurb: 'three of them, gills underneath', call: 'figShrooms(p, t)' },
  { id: 'raven', lift: 0.13, stand: 0, veil: 0.7, name: 'Raven', group: 'Creatures', blurb: 'wings open, beating with the music', call: 'figRaven(p, t, sing)' },
  { id: 'moth', lift: 0.15, stand: 0, veil: 0.7, name: 'Moth', group: 'Creatures', blurb: 'drawn to the light', call: 'figMoth(p, t, sing)' },
  { id: 'stag', lift: 0.12, stand: 0, veil: 0.5, name: 'Stag skull', group: 'Creatures', blurb: 'antlers, and deep holes for eyes', call: 'figStag(p)' },
  { id: 'cat', lift: 0.08, stand: 0, veil: 0.7, name: 'Cat', group: 'Creatures', blurb: 'sitting, watching', call: 'figCat(p, t)' },
  // symbols
  { id: 'eye', lift: 0.02, stand: 0, veil: 0.55, name: 'The Eye', group: 'Symbols', blurb: 'an eye the size of a head, following you — its pupil a hole', call: 'figEye(p, look)' },
  { id: 'portal', lift: 0, stand: 0, veil: 0.4, name: 'Portal', group: 'Symbols', blurb: 'a ring, and a tunnel down through the sheet', call: 'figPortal(p, t)' },
  { id: 'knot', lift: 0.16, stand: 0, veil: 0.4, name: 'Knot', group: 'Symbols', blurb: 'a trefoil, endlessly through itself', call: 'figKnot(p, t)' },
  { id: 'orb', lift: 0.18, stand: 0, veil: 0.35, name: 'Lattice orb', group: 'Symbols', blurb: 'a hollow ball of lattice, turning, something inside', call: 'figOrb(p, t)' },
  { id: 'tesseract', lift: 0.22, stand: 0, veil: 0.3, name: 'Tesseract', group: 'Symbols', blurb: 'a cube inside a cube, breathing with the music', call: 'figTesseract(p, t, sing)' },
  { id: 'merkaba', lift: 0.15, stand: 0, veil: 0.45, name: 'Merkaba', group: 'Symbols', blurb: 'two pyramids through each other, turning', call: 'figMerkaba(p, t)' },
  { id: 'ouroboros', lift: 0.1, stand: 0, veil: 0.45, name: 'Ouroboros', group: 'Symbols', blurb: 'the serpent eating its tail, round a hole', call: 'figOuroboros(p, t)' },
];
export const FIGURE_INDEX = Object.fromEntries(FIGURES.map((f, i) => [f.id, i]));
export const FIGURE_GROUPS = [...new Set(FIGURES.map(f => f.group))];
// a shader is built with whole groups (a group costs a frame very little; all of them at once, a lot),
// so a figure can re-form into any other in its group without a new shader: these are the figures that
// come along with ids
export const figureBank = ids => {
  const groups = new Set(ids.filter(id => id in FIGURE_INDEX).map(id => FIGURES[FIGURE_INDEX[id]].group));
  return FIGURES.filter(f => groups.has(f.group)).map(f => f.id);
};

// needs from the shader: smin, rot, sdCapsule, sdBox, sdRoundBox, faceH, handSDF, PI/TAU, uStepK, and the
// figure values: FIGT (its clock), FIGLX/FIGLY (where eyes look), FIGSING (the music), FIGCY/FIGCP (the
// way it faces), FIGSOFT
const HEAD = `// ---------------------------------------------------------------- figures coming up through the sheet
float smaxF(float a, float b, float k) { return -smin(-a, -b, k); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdRing(vec3 p, float R, float r) { return length(vec2(length(p.xy) - R, p.z)) - r; }   // a ring facing you
float sdTetra(vec3 p, float r) { float m = max(max(-p.x - p.y - p.z, p.x + p.y - p.z), max(-p.x + p.y + p.z, p.x - p.y + p.z)); return (m - r) * 0.57735; }
float sdBoxFrame(vec3 p, vec3 b, float e) {
  p = abs(p) - b; vec3 q = abs(p + e) - e;
  return min(min(length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
                 length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
                 length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));
}
vec3 mx(vec3 p) { return vec3(abs(p.x), p.yz); }
vec3 bez(vec3 a, vec3 b, vec3 c, vec3 d, float s) { float u = 1.0 - s; return u * u * u * a + 3.0 * u * u * s * b + 3.0 * u * s * s * c + s * s * s * d; }

// written by a figure as it is measured: its hollows (in figure units)
float gH = 1.0;
void hollow(float h) { gH = min(gH, h); }

`;

// each figure's own code, after a //@ id line
const LIB = `
//@ skull
float figSkull(vec3 p, float jaw) {
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.1, -0.07), vec3(0.25, 0.26, 0.29));                          // the dome
  d = smaxF(d, -sdEll(m - vec3(0.34, 0.0, -0.02), vec3(0.1, 0.13, 0.15)), 0.05);              // temples, pinched in
  d = smin(d, sdEll(p - vec3(0.0, -0.04, 0.05), vec3(0.2, 0.15, 0.16)), 0.05);                // brow and upper face
  d = smin(d, sdEll(m - vec3(0.145, -0.07, 0.08), vec3(0.06, 0.05, 0.07)), 0.03);             // cheekbones
  d = smin(d, sdCapsule(m, vec3(0.16, -0.075, 0.04), vec3(0.22, -0.06, -0.09), 0.022), 0.025);   // and their arches back to the ears
  d = smin(d, sdEll(p - vec3(0.0, -0.165, 0.04), vec3(0.115, 0.06, 0.09)), 0.04);             // where the top teeth sit
  float jy = -0.3 - jaw * 0.05;
  float j = sdEll(p - vec3(0.0, jy, 0.03), vec3(0.12, 0.045, 0.1));                          // the jaw, dropping as it sings
  j = smin(j, sdCapsule(m, vec3(0.1, jy, -0.01), vec3(0.16, -0.12, -0.08), 0.028), 0.03);
  d = smin(d, j, 0.02);
  vec3 tq = p - vec3(0.0, -0.205, -0.004);                                                  // the teeth: a row of six soft swells
  float ta = atan(tq.x, tq.z), ti = (clamp(floor(ta / 0.3), -3.0, 2.0) + 0.5) * 0.3;
  tq.xz = rot(ti) * tq.xz;
  d = smin(d, sdEll(tq - vec3(0.0, 0.0, 0.122), vec3(0.022, 0.034, 0.018)), 0.012);
  d = smaxF(d, -sdEll(p - vec3(0.0, -0.245 - jaw * 0.025, 0.1), vec3(0.12, 0.008 + jaw * 0.025, 0.09)), 0.012);   // the gap between the jaws
  vec3 e = m - vec3(0.088, 0.0, 0.17);
  e.xy = rot(0.15) * e.xy;
  hollow(sdEll(e, vec3(0.07, 0.06, 0.34)));                                                    // the sockets go deep: through bone and fabric
  hollow(sdEll(m - vec3(0.02, -0.1, 0.19), vec3(0.026, 0.048, 0.26)));                         // the nose: two lobes, a heart upside down
  return d * 0.85;
}
//@ face
// a smooth head whose front is the ghost face: features softened, as if pressed into latex
float figFace(vec3 p) {
  float d = sdEll(p - vec3(0.0, 0.0, -0.08), vec3(0.25, 0.33, 0.25));
  float front = smoothstep(-0.04, 0.14, p.z);
  d -= faceH(p.xy * vec2(1.3, 1.35), 0.0) * 0.16 * front;
  return d * 0.75;
}
//@ mask
// the ghost face with its eyes and mouth cut right through
float figMask(vec3 p, float sing) {
  vec3 e = mx(p) - vec3(0.112, 0.036, 0.12);
  e.xy = rot(0.12) * e.xy;
  hollow(sdEll(e, vec3(0.052, 0.03, 0.34)));
  hollow(sdEll(p - vec3(0.0, -0.196, 0.12), vec3(0.07, 0.01 + 0.035 * sing, 0.34)));
  return figFace(p);
}
//@ scream
// after Munch: the long head, hands to its cheeks, swaying
float figScream(vec3 p, float t, float sing) {
  p.x += 0.025 * sin(p.y * 7.0 + t * 0.9) * smoothstep(0.1, -0.4, p.y);
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.1, -0.01), vec3(0.14, 0.22, 0.14));                       // the long bald head
  d = smaxF(d, -sdEll(m - vec3(0.19, 0.02, 0.02), vec3(0.07, 0.1, 0.2)), 0.07);             // cheeks, squeezed in
  d = smin(d, sdCapsule(p, vec3(0.0, -0.08, -0.03), vec3(0.0, -0.3, -0.06), 0.06), 0.06);   // a thin neck, a narrow body
  d = smin(d, sdEll(p - vec3(0.0, -0.42, -0.08), vec3(0.17, 0.14, 0.09)), 0.07);
  vec3 h = m - vec3(0.125, 0.04, 0.02);
  float hb = length(h - vec3(0.08, 0.0, 0.0)) - 0.3;
  if (hb > d + 0.02) d = min(d, hb);                                                         // its hands, pressed to its cheeks
  else {
    vec3 hq = vec3(h.z, h.y, -h.x) / 0.72;
    hq.xy = rot(0.25) * hq.xy;
    d = smin(d, handSDF(hq, 0.12, 0.35, 10) * 0.72, 0.02);
  }
  hollow(sdEll(m - vec3(0.052, 0.13, 0.12), vec3(0.03, 0.036, 0.3)));
  hollow(sdEll(p - vec3(0.0, -0.01, 0.12), vec3(0.032 + 0.01 * sing, 0.05 + 0.025 * sing, 0.3)));   // the mouth, an O
  return d * 0.85;
}
//@ lips
float figLips(vec3 p, float sing) {
  vec3 m = mx(p);
  float o = 0.2 + 0.8 * sing;
  vec3 u = m - vec3(0.085, 0.05 + 0.015 * o, 0.05);
  u.xy = rot(0.22) * u.xy;
  float d = sdEll(u, vec3(0.14, 0.055, 0.09));                                                // the upper lip: two swells
  d = smin(d, sdEll(p - vec3(0.0, -0.06 - 0.04 * o, 0.05), vec3(0.2, 0.068, 0.1)), 0.03);    // the lower: one, fuller
  d = smaxF(d, -sdEll(m - vec3(0.26, -0.005, 0.08), vec3(0.05, 0.06, 0.12)), 0.035);          // tucked in at the corners
  d = smin(d, sdEll(p - vec3(0.0, -0.01, -0.12), vec3(0.36, 0.28, 0.12)), 0.08);              // a face round them
  hollow(sdEll(p - vec3(0.0, -0.004 - 0.015 * o, 0.09), vec3(0.16, 0.008 + 0.045 * o, 0.4)));  // and open into the dark
  return d * 0.85;
}
//@ ribs
float figRibs(vec3 p, float t) {
  vec3 m = mx(p);
  float br = 1.0 + 0.035 * sin(t * 1.4);
  float d = sdCapsule(p, vec3(0.0, -0.4, -0.14), vec3(0.0, 0.3, -0.12), 0.026);                 // the spine
  d = smin(d, max(length(vec3(p.x, mod(p.y + 0.4, 0.055) - 0.0275, p.z + 0.13)) - 0.034, abs(p.y + 0.05) - 0.35), 0.012);
  float fi = floor((p.y + 0.24) / 0.075 + 0.5);
  for (int k = -1; k <= 1; k++) {                                                              // seven pairs of ribs, sloping down to the front
    float i = clamp(fi + float(k), 0.0, 6.0);
    float s = sin((i + 0.6) / 7.0 * PI);
    vec2 R = vec2(0.11 + 0.08 * s, 0.1 + 0.05 * s) * br;
    vec3 q = m - vec3(0.0, -0.24 + i * 0.075, -0.035);
    q.y += 0.16 * (q.z + 0.1);
    float e = (length(q.xz / R) - 1.0) * min(R.x, R.y);
    float rib = max(length(vec2(e, q.y)) - 0.015, -max(m.x - 0.045, -q.z));                    // open at the front
    d = smin(d, rib, 0.01);
  }
  d = smin(d, sdRoundBox(p - vec3(0.0, -0.02, 0.105), vec3(0.016, 0.13, 0.005), 0.01), 0.02);  // the breastbone
  d = smin(d, sdCapsule(m, vec3(0.03, 0.17, 0.09), vec3(0.2, 0.21, -0.02), 0.016), 0.02);      // collarbones
  hollow(sdEll(p - vec3(0.0, -0.03, -0.02), vec3(0.1, 0.24, 0.075)));                          // and nothing inside, a pit
  return d * 0.85;
}
//@ trapped
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
//@ reach
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
//@ lovers
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
//@ vitruvian
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
//@ meditator
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
//@ praying
// two of the hands, palm to palm, thumbs toward you
float figPraying(vec3 p) {
  vec3 m = mx(p) - vec3(0.022, -0.02, 0.0);
  vec3 q = vec3(m.z, m.y, -m.x) / 0.9;
  return handSDF(q, 0.08, 0.12, 10) * 0.9;
}
//@ serpent
// a snake lying in a coil on the ground (y = -0.3), the tip of its tail at the heart of it, the rest
// rising in an S with its head held up and looking at you; a cobra rears higher and opens its hood
float figSerpent(vec3 p, float t, float hood) {
  float r = length(p.xz), t0 = atan(p.z, p.x) / TAU + 0.5;
  float k = floor((r - 0.04) / 0.105 - t0 + 0.5);
  float d = 1e3;
  for (int i = -1; i <= 1; i++) {                                                               // the coil: a flat spiral, the turns either side
    float u = clamp(t0 + k + float(i), 0.35, 2.25);
    float a = (u - 0.5) * TAU, R = 0.04 + 0.105 * u;
    float th = mix(0.008, 0.05, smoothstep(0.35, 1.6, u));
    d = min(d, length(p - vec3(cos(a) * R, -0.3 + th, sin(a) * R)) - th);
  }
  float sw = 0.03 * sin(t * 1.1), up = hood * 0.07;
  vec3 P0 = vec3(0.0, -0.25, -0.276), P1 = vec3(0.2, -0.25, -0.27), P2 = vec3(0.22 + sw, 0.06 + up, -0.2), P3 = vec3(0.07 + sw * 1.6, 0.1 + up, 0.04);
  vec3 a = P0;
  for (int i = 1; i <= 6; i++) {                                                                // the neck, rising out of it
    vec3 b = bez(P0, P1, P2, P3, float(i) / 6.0);
    d = smin(d, sdCapsule(p, a, b, mix(0.05, 0.04, float(i) / 6.0)), 0.012);
    a = b;
  }
  if (hood > 0.0) d = smin(d, sdEll(p - bez(P0, P1, P2, P3, 0.8) - vec3(0.0, -0.01, -0.02), vec3(0.13, 0.14, 0.022)), 0.03);
  vec3 hq = (p - P3) / 1.35;
  float yw = -0.35 + sw * 2.0, cy = cos(yw), sy = sin(yw);
  hq = vec3(cy * hq.x - sy * hq.z, hq.y, sy * hq.x + cy * hq.z);                                 // the head's own frame: +z where it looks
  float hd = sdEll(hq - vec3(0.0, 0.0, 0.045), vec3(0.05, 0.032, 0.075));                      // long and flat
  hd = smin(hd, sdEll(hq - vec3(0.0, -0.006, 0.105), vec3(0.03, 0.02, 0.04)), 0.025);          // the snout
  hd = smin(hd, length(mx(hq) - vec3(0.034, 0.013, 0.065)) - 0.016, 0.01);                  // its eyes
  hd *= 1.35;
  return smin(d, hd, 0.03) * 0.9;
}
//@ tentacles
// tentacles: from under the sheet, rising, leaning out, curling over at the tips
float figTentacles(vec3 p, float t) {
  float d = 1e3;
  for (int j = 0; j < 4; j++) {
    float fj = float(j), ang = fj * 1.62 + 0.4;
    vec2 cs = vec2(cos(ang), sin(ang));
    if (length(p - vec3(cs.x * 0.17, -0.1, cs.y * 0.17)) - 0.36 > d + 0.02) continue;          // this one's nowhere near
    vec3 a = vec3(cs.x * 0.07, -0.36, cs.y * 0.07);
    float r = 0.05 - fj * 0.004, bend = 0.0, len = 0.07 - fj * 0.005;
    float curl = 0.3 + 0.03 * fj + 0.1 * sin(t * 0.8 + fj * 1.7);
    for (int i = 0; i < 8; i++) {
      bend += curl * (0.25 + float(i) * 0.16);
      vec3 b = a + vec3(cs.x * sin(bend), cos(bend), cs.y * sin(bend)) * len;
      d = smin(d, sdCapsule(p, a, b, r), 0.015);
      a = b; r *= 0.84;
    }
  }
  return d * 0.9;
}
//@ jelly
// a jellyfish: a hollow bell (pulsing), arms trailing down into the sheet
float figJelly(vec3 p, float t, float beat) {
  float pu = max(0.5 + 0.5 * sin(t * 1.7), beat);
  vec3 c = p - vec3(0.0, 0.1, 0.0);
  vec3 R = vec3(0.21, 0.15, 0.21) * vec3(1.0 - 0.07 * pu, 1.0 + 0.06 * pu, 1.0 - 0.07 * pu);
  float a = atan(c.z, c.x);
  float d = sdEll(c, R);
  d = smaxF(d, -sdEll(c + vec3(0.0, 0.045, 0.0), R * vec3(0.86, 0.82, 0.86)), 0.01);          // hollow underneath
  d = max(d, -(c.y + 0.03 + 0.012 * cos(a * 8.0)));                                             // the rim, scalloped
  for (int i = 0; i < 4; i++) {
    float ai = float(i) * 1.5708 + 0.4;
    vec3 q = p - vec3(cos(ai) * 0.03, 0.08, sin(ai) * 0.03);
    q.xz += 0.035 * vec2(sin(q.y * 12.0 + t * 1.5 + ai), cos(q.y * 10.0 + t * 1.3 + ai));
    d = smin(d, sdCapsule(q, vec3(0.0), vec3(0.0, -0.4, 0.0), 0.02) * 0.8, 0.03);
  }
  return d;
}
//@ nautilus
// one turn of a nautilus' tube (n counts the turns), hollow, with the walls between its chambers
float nautTurn(float n, float th, float rho, float z) {
  float psi = th + TAU * n;                                    // how far round the spiral, unwound
  float R0 = 0.03 * exp(0.18 * psi), hw = R0 * 1.049;         // each turn ×3.1 wider than the last
  float tube = length(vec2(rho - R0 - hw, z * 0.95)) - hw;
  tube = max(tube, (psi - 8.1) * rho);                          // where it ends: open
  float wall = abs(tube) - 0.004 - 0.03 * hw;
  float j = min(floor(psi / 0.42 + 0.5), 16.0);
  return min(wall, max(abs(psi - j * 0.42) * rho - 0.003 - 0.025 * hw, tube));
}
// cut in half down its middle, so you look into the rooms
float figNautilus(vec3 p) {
  vec3 q = p - vec3(0.07, -0.02, 0.0);
  q.xy = rot(0.3) * q.xy;
  float rho = max(length(q.xy), 1e-4), th = atan(q.y, q.x);
  float n = floor((log(rho / 0.03) / 0.18 - th) / TAU);
  float d = min(nautTurn(n, th, rho, q.z), nautTurn(n - 1.0, th, rho, q.z));
  return max(d, q.z) * 0.7;
}
//@ shrooms
float shroom(vec3 p, float h, float cr, float lean) {
  p.xy = rot(lean) * p.xy;
  float d = sdCapsule(p, vec3(0.0, -0.05, 0.0), vec3(0.0, h, 0.0), cr * 0.2);                  // the stem
  vec3 c = p - vec3(0.0, h, 0.0);
  float cap = smaxF(sdEll(c, vec3(cr, cr * 0.62, cr)), -sdEll(c + vec3(0.0, cr * 0.22, 0.0), vec3(cr * 0.9, cr * 0.5, cr * 0.9)), 0.01);   // a dome, hollow underneath
  return smin(d, cap, 0.02);
}
float figShrooms(vec3 p, float t) {
  float sw = 0.03 * sin(t * 0.7);
  float d = shroom(p - vec3(-0.08, -0.3, -0.06), 0.34, 0.17, 0.1 + sw);
  d = min(d, shroom(p - vec3(0.18, -0.3, 0.0), 0.2, 0.11, -0.25 - sw));
  d = min(d, shroom(p - vec3(0.03, -0.3, 0.17), 0.1, 0.075, 0.3));
  return d * 0.85;
}
//@ raven
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
//@ moth
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
//@ stag
float figStag(vec3 p) {
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.07, -0.01), vec3(0.105, 0.085, 0.085));                    // the braincase
  d = smin(d, sdEll(p - vec3(0.0, -0.1, 0.02), vec3(0.068, 0.17, 0.06)), 0.05);              // the long face
  d = smin(d, sdEll(m - vec3(0.07, 0.03, 0.035), vec3(0.042, 0.04, 0.045)), 0.03);           // rims round the eyes
  d = smin(d, sdEll(p - vec3(0.0, -0.26, 0.03), vec3(0.04, 0.05, 0.04)), 0.03);              // the muzzle
  hollow(sdEll(m - vec3(0.072, 0.03, 0.07), vec3(0.028, 0.026, 0.25)));                       // eye sockets, deep
  hollow(sdEll(m - vec3(0.014, -0.17, 0.07), vec3(0.014, 0.075, 0.2)));                       // the long nose
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
//@ cat
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
//@ eye
// a big eyeball in its lids, the iris turning to find you; the pupil is a hole
float figEye(vec3 p, vec2 look) {
  vec3 dir = normalize(vec3(look.x * 0.6, look.y * 0.6, 1.0));
  float ball = length(p) - 0.2;
  float c = dot(p, dir) / max(length(p), 1e-4);
  ball += 0.012 * smoothstep(0.84, 0.9, c);                                                    // the iris, set in a little
  hollow(sdCapsule(p, dir * 0.4, -dir * 0.05, 0.05));
  float lids = sdEll(p - vec3(0.0, 0.0, -0.05), vec3(0.42, 0.27, 0.22));
  lids = smaxF(lids, -sdEll(p - vec3(0.0, 0.0, 0.1), vec3(0.3, 0.14, 0.4)), 0.04);
  return smin(ball, lids, 0.015) * 0.9;
}
//@ portal
float figPortal(vec3 p, float t) {
  float a = atan(p.y, p.x);
  float d = sdRing(p, 0.3, 0.048 + 0.01 * sin(a * 10.0 - t * 2.0));                          // a ring, rippling round
  d = min(d, sdRing(p - vec3(0.0, 0.0, -0.06), 0.37, 0.016));
  hollow(max(length(p.xy) - 0.235, -p.z - 0.6));                                               // the way through
  return d * 0.8;
}
//@ knot
// a (2,3) torus knot: round the ring twice, through the hole three times
float figKnot(vec3 p, float t) {
  vec3 q = p;
  q.xy = rot(t * 0.3) * q.xy;
  float a = atan(q.y, q.x);
  vec2 c = vec2(length(q.xy) - 0.24, q.z);
  float d = 1e3;
  for (int i = 0; i < 2; i++) { float b = 1.5 * (a + TAU * float(i)); d = min(d, length(c - 0.11 * vec2(cos(b), sin(b)))); }
  return (d - 0.055) * 0.7;
}
//@ orb
float figOrb(vec3 p, float t) {
  vec3 q = p;
  q.xz = rot(t * 0.3) * q.xz; q.xy = rot(t * 0.17) * q.xy;
  float r = length(p);
  float g = abs(dot(sin(q * 24.0), cos(q.yzx * 24.0))) / 24.0 - 0.011;                       // a gyroid lattice
  return min(max(abs(r - 0.235) - 0.035, g * 0.6), r - 0.09);                                  // a shell of it, a core floating inside
}
//@ tesseract
float figTesseract(vec3 p, float t, float sing) {
  vec3 q = p;
  q.xz = rot(t * 0.35) * q.xz; q.yz = rot(0.55) * q.yz;
  float s = 0.1 + 0.035 * sing;
  float d = min(sdBoxFrame(q, vec3(0.22), 0.016), sdBoxFrame(q, vec3(s), 0.012));
  return min(d, sdCapsule(abs(q), vec3(s), vec3(0.22), 0.01));                                // each corner joined to its twin
}
//@ merkaba
float figMerkaba(vec3 p, float t) {
  vec3 q = p;
  q.xz = rot(t * 0.35) * q.xz;
  q.yz = rot(0.62) * q.yz;
  return min(sdTetra(q, 0.17), sdTetra(-q, 0.17));
}
//@ ouroboros
float figOuroboros(vec3 p, float t) {
  vec3 q = p;
  q.xy = rot(-t * 0.35) * q.xy;
  float u = fract(atan(q.y, q.x) / TAU);
  float r = 0.072 * mix(0.35, 1.0, 1.0 - smoothstep(0.5, 0.98, u));                           // thinning to the tail
  float d = length(vec2(length(q.xy) - 0.29, q.z)) - r;
  vec3 h = q - vec3(0.29, -0.02, 0.0);                                                         // the head, jaws open round the tail
  d = smin(d, sdEll(h - vec3(0.0, -0.05, 0.035), vec3(0.065, 0.1, 0.035)), 0.03);
  d = smin(d, sdEll(h - vec3(0.0, -0.04, -0.035), vec3(0.055, 0.09, 0.03)), 0.03);
  d = smin(d, length(mx(h) - vec3(0.045, -0.01, 0.05)) - 0.016, 0.01);
  hollow(max(length(q.xy) - 0.19, -q.z - 0.5));                                                // round a hole
  return d * 0.9;
}
`;
const CHUNKS = Object.fromEntries(LIB.split(/^\/\/@ /m).slice(1).map(c => { const i = c.indexOf('\n'); return [c.slice(0, i).trim(), c.slice(i + 1)]; }));

const TAIL = `
// the sheet's lines part round a figure's foot and swirl, like water round a stone
vec2 flowRound(vec2 q, vec2 c, float R) {
  vec2 o = q - c;
  float k = R * R / (dot(o, o) + R * R);
  return c + rot(0.6 * k) * o * (1.0 - 0.3 * k);
}
vec2 figFlow(vec2 q) {
  if (FIG > 0.001 && FIGREP < 0.5) q = flowRound(q, vec2(FIGX, FIGY), 0.32 * FIGS * FIG);
  if (FTON > 0.001) q = flowRound(q, vec2(FTX, FTY), 0.32 * FTS * FTON);
  return q;
}

// which way a figure faces: the camera's turn and tilt (eased), tipped upright by its stand.
// Columns: its right, its up, its front.
mat3 figFrame(float stand) {
  float ph = mix(FIGCP, 1.5708, stand), cy = cos(FIGCY), sy = sin(FIGCY), cp = cos(ph), sp = sin(ph);
  return mat3(cy, sy, 0.0, -sy * cp, cy * cp, sp, sy * sp, -cy * sp, cp);
}
mat3 gFrameA, gFrameB, gFrameT;
void figSetup() { gFrameA = figFrame(FIGSTA); gFrameB = figFrame(FIGSTB); gFrameT = figFrame(FTST); }

// the nearest figure's: the point in its own frame, where it is, its size, and its hollows (world units,
// < 0 inside)
vec3 gFQ = vec3(0.0), gFC = vec3(0.0);
float gFS = 1.0, gFHole = 1e3;

// one figure, placed: at pos (it comes up from far below as it comes on), size S, facing by M,
// turned by spin, maybe repeated across the sheet. Returns its distance (figure units) and fills in
// its hollows, the point in its frame, and where it is (the copy nearest, when repeated).
float figPlaced(vec3 p, int id, vec3 pos, float S, mat3 M, float spin, float rep, out float h, out vec3 q, out vec3 c) {
  q = p - pos;
  if (rep > 0.5) { float sp = 1.15 * S; q.xy = mod(q.xy + sp * 0.5, sp) - sp * 0.5; }
  c = p - q;
  q = (q * M) / S;
  q.xz = rot(spin) * q.xz;
  float bound = length(q) - 0.72;
  h = 1.0;
  if (bound > 0.06 + FIGSOFT / S) return bound;                                              // far off (beyond the fabric's softness): its bounding ball will do
  gH = 1.0;
  float d = figure3D(id, q);
  h = max(gH, bound);                                                                        // hollows stay inside the figure
  return d;
}

// the Figures add-on (a, re-forming into b) and the figure under your cursor when one is the tool.
// One loop the compiler can't unroll, so the whole library is compiled once here, not three times.
float figuresSDF(vec3 p) {
  float dA = 1e3, hA = 1.0, dB = 1e3, hB = 1.0, dT = 1e3, hT = 1.0;
  vec3 qA = vec3(0.0), qB = vec3(0.0), qT = vec3(0.0), cA = vec3(0.0), cT = vec3(0.0);
  int n = 3 + int(min(uStepK, 0.0));
  for (int k = 0; k < n; k++) {
    if (k < 2 ? FIG < 0.001 || (k == 1 && FIGMIX < 0.001) : FTON < 0.001) continue;
    float h;
    vec3 q, c;
    bool tool = k == 2;
    float d = figPlaced(p, int((tool ? FTID : k == 0 ? FIGA : FIGB) + 0.5), tool ? vec3(FTX, FTY, mix(-0.75 * FTS, FTZ, FTON)) : vec3(FIGX, FIGY, mix(-0.75 * FIGS, FIGZ, FIG)),
                        tool ? FTS : FIGS, tool ? gFrameT : k == 0 ? gFrameA : gFrameB, tool ? 0.0 : FIGROT, tool ? 0.0 : FIGREP, h, q, c);
    if (k == 0) { dA = d; hA = h; qA = q; cA = c; }
    else if (k == 1) { dB = d; hB = h; qB = q; }
    else { dT = d; hT = h; qT = q; cT = c; }
  }
  float d = 1e3;
  gFHole = 1e3;
  if (FIG > 0.001) {
    float w = FIGMIX;
    d = mix(dA, dB, w) * FIGS;
    gFHole = mix(hA, hB, w) * FIGS;
    gFQ = w > 0.5 ? qB : qA; gFC = cA; gFS = FIGS;
  }
  if (FTON > 0.001) {
    float d2 = dT * FTS;
    gFHole = min(gFHole, hT * FTS);
    if (d2 < d) { d = d2; gFQ = qT; gFC = cT; gFS = FTS; }
  }
  return d;
}
`;

// the figure code for a shader that can draw these figures (ids), and only these
export function figuresGLSL(ids = []) {
  ids = [...new Set(ids)].filter(id => id in FIGURE_INDEX);
  const need = [];
  const add = id => { if (need.includes(id)) return; (FIGURES[FIGURE_INDEX[id]].uses || []).forEach(add); need.push(id); };
  ids.forEach(add);
  const cases = ids.map(id => `    case ${FIGURE_INDEX[id]}: return ${FIGURES[FIGURE_INDEX[id]].call};`).join('\n');
  return HEAD + need.map(id => CHUNKS[id] || '').join('\n') + `
float figure3D(int id, vec3 p) {
  float t = FIGT, sing = FIGSING;
  vec2 look = vec2(FIGLX, FIGLY);
  switch (id) {
${cases}
  }
  return 1e3;
}

` + TAIL;
}
