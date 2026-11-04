// Figures rising out of the sheet, or going under it. Each is a solid 3D shape joined to the fabric the
// way the hand is, so what you see is the look's own pattern pouring over it: the picture stays crisp and
// nothing is lit or painted. So every one lives or dies by its silhouette, and is posed at an angle with
// the sheet cutting across it: chin underwater, a stern in the air, two legs and nothing else.
//
// Figure space: y up out of the water, x across, z toward you; about a unit tall. Each figure says:
//   pose  [yaw, pitch, roll]: how it's turned. Never quite head-on: that's what makes a thing look like
//         an object peering through a hole.
//   water where its waterline is, on its own y axis: the sheet cuts it there at rest.
//   rise  how much further it comes up while you hold the mouse down (figure units).
//   veil  how much the fabric clings (0 comes clean through, 1 draped like a ghost).
//   grab  the point (figure y) that sits under your cursor.
//   r, cy bounding sphere: radius and centre height. Rays that miss it never evaluate the figure.
//   ink   1: a solid black thing, not draped in the pattern (the monolith).
// The order here is the id the shader switches on; `call` is how it's drawn, `uses` other figures' code.
// The shader is built with only the figures on screen (see figureBank).

export const FIGURES = [
  // people, going under
  { id: 'hand', name: 'Hand', group: 'People', blurb: 'your cursor, pressing through from behind', special: true, grab: 0.1 },
  { id: 'arm', scale: 0.95, name: 'Not Waving', group: 'People', blurb: 'one arm, straining up out of the water', call: 'figArm(p, t, sing)', pose: [0.2, 0.1, -0.16], water: -0.3, rise: 0.22, veil: 0.55, grab: 0.28, r: 0.95, cy: 0.05 },
  { id: 'creation', scale: 1.0, name: 'Creation', group: 'People', blurb: 'two hands that almost touch', call: 'figCreation(p, t, sing)', pose: [0, 0.02, -0.06], water: -0.42, rise: 0.18, veil: 0.5, grab: 0.1, r: 1.06, cy: -0.05 },
  { id: 'skull', lean: 0.1, name: 'Skull', group: 'People', blurb: 'sunk to the teeth, sockets all the way down', call: 'figSkull(p, sing)', pose: [0.38, -0.02, -0.16], water: -0.27, rise: 0.2, veil: 0.4, grab: 0.05, r: 0.62, cy: 0.0 },
  { id: 'ophelia', name: 'Ophelia', group: 'People', blurb: 'floating on her back, one hand still out, after Millais', call: 'figOphelia(p, t, sing)', pose: [0, 0.02, -0.06], water: -0.05, rise: 0.14, veil: 0.55, grab: 0.14, r: 1.05, cy: 0.02 },
  { id: 'icarus', scale: 0.92, name: 'Icarus', group: 'People', blurb: 'two legs and a splash, after Bruegel', call: 'figIcarus(p, t, sing)', pose: [0.15, 0.08, 0.26], water: -0.26, rise: 0.2, veil: 0.4, grab: 0.1, r: 0.92, cy: 0.05 },
  { id: 'medusa', scale: 0.88, name: 'Medusa', group: 'People', blurb: 'chin up, mouth open, her hair alive', call: 'figMedusa(p, t, sing)', pose: [-0.28, 0.3, 0.14], water: -0.26, rise: 0.2, veil: 0.35, grab: 0.05, r: 0.8, cy: 0.02 },
  { id: 'scream', scale: 0.88, name: 'The Scream', group: 'People', blurb: 'hands to its head, a mouth into the dark, after Munch', call: 'figScream(p, t, sing)', pose: [0.1, 0.22, 0.1], water: -0.36, rise: 0.22, veil: 0.4, grab: 0.1, r: 0.78, cy: -0.05 },
  { id: 'lovers', style: 'draped', name: 'The Lovers', group: 'People', blurb: 'two veiled heads, kissing through the sheet, after Magritte', call: 'figLovers(p, t)', pose: [0.05, 0.15, 0.0], water: -0.34, rise: 0.14, veil: 0.5, grab: 0.05, r: 0.74, cy: -0.02 },
  { id: 'bowler', name: 'Son of Man', group: 'People', blurb: 'a bowler hat, a green apple where the face should be, after Magritte', call: 'figBowler(p, t, sing)', pose: [0.08, 0.2, 0.0], water: -0.32, rise: 0.18, veil: 0.35, grab: 0.15, r: 0.82, cy: 0.05 },
  { id: 'praying', scale: 0.9, name: 'Praying', group: 'People', blurb: 'two hands pressed together, sleeves going under, after Dürer', call: 'figPraying(p, t)', pose: [0.8, 0.08, 0.14], water: -0.3, rise: 0.2, veil: 0.45, grab: 0.1, r: 0.85, cy: 0.0 },
  { id: 'wanderer', scale: 0.92, name: 'Wanderer', group: 'People', blurb: 'on a rock, looking out over the lines, after Friedrich', call: 'figWanderer(p, t)', pose: [0.2, 0.1, 0.0], water: -0.34, rise: 0.14, veil: 0.2, grab: 0.2, r: 0.9, cy: 0.02 },
  // beasts
  { id: 'fluke', scale: 0.88, name: 'The Fluke', group: 'Beasts', blurb: 'a whale going down', call: 'figFluke(p, t, sing)', pose: [0.3, 0.14, 0.22], water: -0.3, rise: 0.24, veil: 0.3, grab: 0.25, r: 0.95, cy: 0.02 },
  { id: 'serpent', scale: 0.8, name: 'Sea Serpent', group: 'Beasts', blurb: 'humps in the water and a long neck', call: 'figSerpent(p, t, sing)', pose: [0.12, 0.1, 0.0], water: -0.1, rise: 0.12, veil: 0.35, grab: 0.1, r: 1.05, cy: 0.1 },
  { id: 'kraken', scale: 0.88, name: 'Kraken', group: 'Beasts', blurb: 'arms coming up from underneath, curling', call: 'figKraken(p, t, sing)', pose: [0.0, 0.1, 0.0], water: -0.32, rise: 0.22, veil: 0.4, grab: 0.2, r: 0.98, cy: 0.05 },
  { id: 'elephant', scale: 0.7, name: 'Elephant', group: 'Beasts', blurb: 'on legs like a mosquito’s, after Dalí', call: 'figElephant(p, t)', pose: [0.28, 0.1, 0.0], water: -0.5, rise: 0.14, veil: 0.25, grab: 0.25, r: 1.0, cy: 0.05 },
  { id: 'stag', scale: 0.92, name: 'Stag', group: 'Beasts', blurb: 'antlers and a long skull, sunk to the eyes', call: 'figStag(p, t)', pose: [0.34, 0.3, -0.14], water: -0.22, rise: 0.2, veil: 0.3, grab: 0.2, r: 0.9, cy: 0.1 },
  { id: 'dog', name: 'The Dog', group: 'Beasts', blurb: 'just a head above the sand, looking up, after Goya', call: 'figDog(p, t)', pose: [0.1, 0.14, 0.0], water: -0.16, rise: 0.1, veil: 0.5, grab: 0.05, r: 0.72, cy: -0.05 },
  // monuments
  { id: 'liner', scale: 0.8, name: 'The Liner', group: 'Monuments', blurb: 'stern in the air, going down by the head', call: 'figLiner(p, t)', pose: [0.32, 0.1, 0.0], water: -0.2, rise: 0.12, veil: 0.2, grab: 0.2, r: 1.05, cy: 0.1 },
  { id: 'liberty', scale: 0.85, name: 'Liberty', group: 'Monuments', blurb: 'sunk to the lips, the torch still up', call: 'figLiberty(p, t)', pose: [0.25, 0.18, 0.12], water: -0.14, rise: 0.14, veil: 0.25, grab: 0.1, r: 0.98, cy: 0.08 },
  { id: 'moai', scale: 0.82, name: 'Moai', group: 'Monuments', blurb: 'two stone heads, buried to the chest', call: 'figMoai(p)', pose: [1.12, 0.1, 0.02], water: -0.34, rise: 0.12, veil: 0.25, grab: 0.1, r: 1.02, cy: 0.0 },
  { id: 'steeple', scale: 0.75, name: 'Steeple', group: 'Monuments', blurb: 'a drowned village, leaning', call: 'figSteeple(p)', pose: [0.45, 0.1, 0.12], water: -0.3, rise: 0.16, veil: 0.2, grab: 0.2, r: 1.0, cy: 0.12 },
  { id: 'isle', scale: 0.85, lens: 0.6, name: 'Isle of the Dead', group: 'Monuments', blurb: 'cliffs, cypresses and very little else, after Böcklin', call: 'figIsle(p, t)', pose: [0.1, 0.1, 0.0], water: -0.2, rise: 0.1, veil: 0.2, grab: 0.1, r: 1.0, cy: 0.0 },
  { id: 'providence', scale: 0.72, name: 'Providence', group: 'Monuments', blurb: 'a pyramid, its top floating, and the eye', call: 'figProvidence(p, t, look, sing)', pose: [0.0, 0.14, 0.0], water: -0.3, rise: 0.14, veil: 0.25, grab: 0.15, r: 0.95, cy: 0.08 },
  { id: 'moon', scale: 0.9, name: 'The Moon', group: 'Monuments', blurb: 'a crescent with a profile, rising', call: 'figMoon(p, t)', pose: [0.0, 0.12, 0.26], water: -0.42, rise: 0.24, veil: 0.3, grab: 0.0, r: 0.72, cy: 0.0 },
  { id: 'eye', lean: 0, name: 'The Eye', group: 'Monuments', blurb: 'half under, following you, after Redon', call: 'figEye(p, look)', pose: [0, 0, 0], water: -0.12, rise: 0.2, veil: 0.7, grab: 0.05, r: 0.5, cy: 0.0 },
  { id: 'monolith', style: 'silhouette', scale: 0.88, name: 'Monolith', group: 'Monuments', blurb: '1 : 4 : 9', call: 'figMonolith(p)', pose: [0.32, 0.08, 0.05], water: -0.42, rise: 0.25, veil: 0.1, grab: 0.15, ink: 1, r: 0.8, cy: -0.06 },
];
export const FIGURE_INDEX = Object.fromEntries(FIGURES.map((f, i) => [f.id, i]));
export const FIGURE_GROUPS = [...new Set(FIGURES.map(f => f.group))];
// the figures a shader should be built with: just the ones showing (every figure compiled in makes the
// whole shader slower, even the pixels nowhere near a figure, so the shader holds the fewest it can)
export const figureBank = ids => [...new Set(ids.filter(id => id in FIGURE_INDEX && !FIGURES[FIGURE_INDEX[id]].special))];

// the way a figure faces, for a camera at this (eased) turn and tilt: its pose, on top of leaning back to
// meet the camera, so a low camera sees it standing in the water and one overhead sees it three-quarters
// from above with the sheet cutting across it at an angle. Columns: its right, up, front. Written to out at i.
const LEAN = 0.24;
export function figureFrame(f, camYaw, camPitch, sway, out, i = 0) {
  const [py, pp, pr] = f.pose || [0, 0, 0];
  const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
  const ph = camPitch + (Math.PI / 2 - camPitch) * (f.lean ?? LEAN) + pp, cph = Math.cos(ph), sph = Math.sin(ph);
  const R = [cy, sy, 0], U = [-sy * cph, cy * cph, sph], B = [sy * sph, -cy * sph, cph];
  const a = py + sway[0], r = pr + sway[1];
  const ca = Math.cos(a), sa = Math.sin(a), cr = Math.cos(r), sr = Math.sin(r);
  // yaw about its own up, then roll about its own front
  const R1 = [0, 1, 2].map(k => R[k] * ca - B[k] * sa), B1 = [0, 1, 2].map(k => R[k] * sa + B[k] * ca);
  const R2 = [0, 1, 2].map(k => R1[k] * cr + U[k] * sr), U2 = [0, 1, 2].map(k => U[k] * cr - R1[k] * sr);
  out[i] = R2[0]; out[i + 1] = R2[1]; out[i + 2] = R2[2];
  out[i + 3] = U2[0]; out[i + 4] = U2[1]; out[i + 5] = U2[2];
  out[i + 6] = B1[0]; out[i + 7] = B1[1]; out[i + 8] = B1[2];
}

// needs from the shader: smin, rot, sdCapsule, sdBox, sdRoundBox, PI/TAU, uStepK and the figure values
const HEAD = `// ---------------------------------------------------------------- figures going under, and coming up
float smaxF(float a, float b, float k) { return -smin(-a, -b, k); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdLimb(vec3 p, vec3 a, vec3 b, float r1, float r2) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(r1, r2, h); }
vec3 mx(vec3 p) { return vec3(abs(p.x), p.yz); }

// written by a figure as it is measured: its hollows (in figure units)
float gH = 1.0;
void hollow(float h) { gH = min(gH, h); }
float gFRow = 0.0;              // repeated: this copy's own number, so a crowd isn't one thing moving together

// a hand with each finger set on its own: fc = curls of pinky, ring, middle, index; tc the thumb's.
// Fingers up +y, palm toward +z.
float handPose(vec3 p, vec4 fc, float tc, float spread) {
  float d = sdRoundBox(p - vec3(0.0, -0.01, 0.0), vec3(0.068, 0.08, 0.017), 0.03);
  d = smin(d, sdCapsule(p, vec3(-0.035, -0.08, 0.0), vec3(0.04, -0.085, 0.0), 0.045), 0.04);
  if (length(p - vec3(0.0, 0.1, 0.0)) - 0.34 > 0.04) return min(d, length(p - vec3(0.0, 0.1, 0.0)) - 0.32);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float len = (i == 0 ? 0.78 : i == 1 ? 0.99 : i == 2 ? 1.06 : 0.95) * 0.245;
    float c = fc[i];
    vec3 a = vec3(-0.066 + fi * 0.044, 0.085, 0.0);
    vec3 dir = normalize(vec3((fi - 1.5) * spread * 0.2, 1.0, 0.0));
    float r = 0.0205 + fi * 0.0013, seg = 0.46;
    for (int j = 0; j < 3; j++) {
      dir.yz = rot(c * (j == 0 ? 0.55 : 0.95)) * dir.yz;
      vec3 b = a + dir * len * seg;
      d = smin(d, sdCapsule(p, a, b, r), 0.014);
      a = b; r *= 0.9; seg = j == 0 ? 0.32 : 0.23;
    }
  }
  vec3 a = vec3(0.07, -0.055, 0.012), dir = normalize(vec3(0.85, 0.6, 0.3));
  float r = 0.028;
  for (int j = 0; j < 2; j++) {
    dir.xy = rot(tc * 0.6) * dir.xy;
    dir.yz = rot(tc * 0.35) * dir.yz;
    vec3 b = a + dir * (j == 0 ? 0.095 : 0.075);
    d = smin(d, sdCapsule(p, a, b, r), 0.016);
    a = b; r *= 0.85;
  }
  return d;
}

`;

// each figure's own code, after a //@ id line
const LIB = `
//@ arm
// one arm out of the water, the hand open as far as it goes, the fingers trying
float figArm(vec3 p, float t, float sing) {
  p.x += 0.03 * sin(t * 0.7 + p.y * 1.6) * smoothstep(0.4, -0.5, p.y);
  float f = 0.5 + 0.5 * sin(t * 1.3);
  vec3 wr = vec3(0.03, 0.02, 0.0), el = vec3(-0.1, -0.5, -0.1);
  float d = sdLimb(p, el, wr, 0.1, 0.052);                                                   // the forearm
  d = smin(d, sdLimb(p, vec3(-0.18, -0.95, -0.2), el, 0.13, 0.095), 0.04);                     // the upper arm, under
  vec3 q = (p - vec3(0.045, 0.1, 0.0)) / 1.25;
  q.xy = rot(-0.14) * q.xy;
  q.yz = rot(-0.2) * q.yz;
  float c = 0.06 + 0.2 * f + 0.25 * sing;
  return smin(d, handPose(q, vec4(c, c * 0.8, c * 0.6, c * 0.4), 0.15, 1.15) * 1.25, 0.03) * 0.9;
}
//@ creation
// the two arms of the Sistine ceiling: one limp from the left, the other reaching from the right
float figCreation(vec3 p, float t, float sing) {
  float gap = 0.016 + 0.02 * (0.5 + 0.5 * sin(t * 0.5)) - 0.012 * sing;
  // his: from the left, the wrist dropped, the finger only just lifted
  vec3 w1 = vec3(-0.43, 0.1, 0.0);
  float d = sdLimb(p, vec3(-1.02, -0.5, -0.06), vec3(-0.68, 0.05, -0.02), 0.078, 0.052);
  d = smin(d, sdLimb(p, vec3(-0.68, 0.05, -0.02), w1, 0.052, 0.034), 0.03);
  vec3 q = (p - (w1 + vec3(0.1, -0.035, 0.0))) / 1.2;
  q.xy = rot(1.86) * q.xy;
  d = smin(d, handPose(q, vec4(0.6, 0.5, 0.42, 0.05), 1.1, 0.95) * 1.2, 0.014);
  // the other: from the right, level, the finger out straight
  vec3 w2 = vec3(0.42, 0.14, 0.0);
  float e = sdLimb(p, vec3(1.02, -0.45, -0.05), vec3(0.72, 0.15, -0.02), 0.075, 0.05);
  e = smin(e, sdLimb(p, vec3(0.72, 0.15, -0.02), w2, 0.05, 0.034), 0.03);
  q = ((p - (w2 + vec3(-0.135 + gap, -0.014, 0.0))) * vec3(-1.0, 1.0, 1.0)) / 1.2;
  q.xy = rot(1.5) * q.xy;
  e = smin(e, handPose(q, vec4(0.8, 0.72, 0.6, -0.02), 1.1, 0.95) * 1.2, 0.014);
  return min(d, e) * 0.9;
}
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
  vec3 e = m - vec3(0.098, 0.012, 0.17);
  e.xy = rot(0.15) * e.xy;
  hollow(sdEll(e, vec3(0.066, 0.058, 0.34)));                                                  // the sockets go deep: through bone and fabric
  hollow(sdEll(m - vec3(0.019, -0.105, 0.19), vec3(0.022, 0.042, 0.26)));                      // the nose: two lobes, a heart upside down
  return d * 0.85;
}
//@ ophelia
// a head on its back in the water, a profile against the sky: forehead, nose, lips, chin. Her hair
// spreads out across the surface; one hand is still up.
float figOphelia(vec3 p, float t, float sing) {
  vec3 c = p - vec3(-0.14, 0.0, 0.0);
  vec3 h = c / 1.45;
  h.xy = rot(-1.42 + 0.03 * sin(t * 0.4)) * h.xy;                                               // lying back: her +x, up to the sky
  float d = sdEll(h - vec3(-0.05, 0.05, 0.0), vec3(0.11, 0.13, 0.11));
  d = smin(d, sdEll(h - vec3(0.05, 0.015, 0.0), vec3(0.055, 0.085, 0.075)), 0.03);
  d = smin(d, sdLimb(h, vec3(0.09, 0.055, 0.0), vec3(0.15, -0.005, 0.0), 0.022, 0.016), 0.018);   // the nose
  d = smin(d, sdEll(h - vec3(0.114, -0.052, 0.0), vec3(0.024, 0.024, 0.034)), 0.008);             // lips, parted
  d = smin(d, sdEll(h - vec3(0.083, -0.118, 0.0), vec3(0.036, 0.032, 0.042)), 0.016);             // the chin
  d = smin(d, sdLimb(h, vec3(-0.02, -0.08, -0.01), vec3(-0.08, -0.36, -0.02), 0.052, 0.07), 0.03);  // the throat, going under
  d *= 1.45;
  hollow(sdEll(h - vec3(0.052, 0.058, 0.07), vec3(0.03, 0.012, 0.05)) * 1.45);                    // a closed eye
  for (int k = 0; k < 3; k++) {                                                                   // the hair, adrift
    float fk = float(k), x = p.x + 0.3;
    float y = -0.02 + 0.08 * (fk - 1.0) + (0.03 + 0.06 * smoothstep(0.0, -0.6, x)) * sin(x * (8.0 + fk * 2.0) + t * 0.8 + fk * 2.0);
    float r = mix(0.006, 0.026, smoothstep(-0.72, -0.05, x));
    d = smin(d, max(length(vec2(p.y - y, p.z + 0.02)) - r, max(x - 0.05, -x - 0.72)) * 0.8, 0.018);
  }
  vec3 q = (p - vec3(0.62, 0.12, 0.08)) / 0.95;                                                    // and a hand, just out
  q.xy = rot(-0.34 + 0.05 * sin(t * 0.8)) * q.xy;
  float f = 0.3 + 0.08 * sin(t * 0.6);
  float hand = smin(handPose(q, vec4(f, f, f * 0.9, f * 0.7), 0.5, 0.95) * 0.95, sdLimb(p, vec3(0.5, -0.45, 0.05), vec3(0.62, 0.03, 0.08), 0.06, 0.04), 0.03);
  return min(d, hand) * 0.85;
}
//@ icarus
// the moment nobody noticed: two legs, the knees bent, kicking
float figLeg(vec3 p, vec3 hip, vec3 knee, vec3 ankle, vec3 toe) {
  float d = sdLimb(p, hip, knee, 0.12, 0.072);
  d = smin(d, sdLimb(p, knee, ankle, 0.078, 0.038), 0.03);
  d = smin(d, sdEll(p - mix(knee, ankle, 0.28) - vec3(-0.03, 0.0, 0.0), vec3(0.06, 0.13, 0.065)), 0.04);   // the calf
  d = smin(d, sdLimb(p, ankle, toe, 0.05, 0.026), 0.03);
  return d;
}
float figIcarus(vec3 p, float t, float sing) {
  float a = sin(t * 1.8), b = sin(t * 1.8 + 2.2);
  float d = figLeg(p, vec3(-0.08, -0.6, -0.04), vec3(-0.12 + 0.05 * a, -0.14, 0.02), vec3(-0.27 + 0.13 * a, 0.28, 0.0), vec3(-0.17 + 0.17 * a, 0.46, 0.0));
  d = min(d, figLeg(p, vec3(0.08, -0.6, -0.02), vec3(0.24 + 0.04 * b, -0.12, 0.0), vec3(0.1 + 0.14 * b, 0.34, 0.03), vec3(0.2 + 0.18 * b, 0.53, 0.03)));
  return d * 0.85;
}
//@ medusa
// a head thrown back, every strand of her hair a snake: one fold of the angle per snake, so all of them cost one
float figMedusa(vec3 p, float t, float sing) {
  vec3 q = p; q.y -= 0.02;
  float d = sdEll(q - vec3(0.0, 0.02, -0.02), vec3(0.165, 0.2, 0.165));                        // the head
  d = smin(d, sdEll(q - vec3(0.0, -0.13, 0.03), vec3(0.11, 0.1, 0.1)), 0.05);                  // the jaw
  d = smin(d, sdLimb(q, vec3(0.0, -0.1, -0.05), vec3(0.0, -0.46, -0.08), 0.085, 0.13), 0.05);  // the neck going under
  d = smin(d, sdEll(q - vec3(0.0, -0.01, 0.15), vec3(0.022, 0.058, 0.035)), 0.02);             // the nose
  vec3 m = mx(q);
  hollow(sdEll(m - vec3(0.066, 0.052, 0.14), vec3(0.036, 0.022, 0.2)));                        // eyes
  hollow(sdEll(q - vec3(0.0, -0.105, 0.13), vec3(0.058, 0.026 + 0.036 * sing, 0.22)));         // the scream
  float ang = atan(q.x, q.y);                                                                  // 0 straight up
  float N = 9.0, w = 4.2 / N;
  float idx = clamp(floor(ang / w + N * 0.5), 0.0, N - 1.0);
  for (int k = 0; k < 2; k++) {
    float i = clamp(idx + float(k), 0.0, N - 1.0);
    float a0 = (i - N * 0.5 + 0.5) * w;
    vec2 v = rot(a0) * q.xy;                                                                   // along this snake (+y), and across it
    float L = 0.3 + 0.09 * sin(i * 2.4 + 1.3), s = clamp((v.y - 0.15) / L, 0.0, 1.0);
    float lat = v.x - sin(s * 8.5 - t * 2.3 + i * 1.9) * (0.02 + 0.075 * s);
    float z = q.z + 0.03 + 0.05 * sin(i * 3.1) - 0.08 * s * s;
    float r = mix(0.05, 0.012, s * s);
    float e = length(vec3(lat, max(v.y - 0.15 - L, 0.0) + min(v.y - 0.15, 0.0), z)) - r;
    d = smin(d, e * 0.72, 0.016);
  }
  return d * 0.85;
}
//@ scream
// after Munch: the long head, narrowing to a jaw, hands to its temples, swaying
float figScream(vec3 p, float t, float sing) {
  p.x += 0.07 * sin(p.y * 4.5 + t * 0.9) * smoothstep(-0.02, -0.6, p.y);
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.17, -0.01), vec3(0.165, 0.2, 0.15));                       // the dome
  d = smin(d, sdEll(p - vec3(0.0, -0.05, 0.0), vec3(0.082, 0.15, 0.09)), 0.05);              // narrowing to the jaw
  d = smin(d, sdLimb(p, vec3(0.0, -0.16, -0.03), vec3(0.0, -0.8, -0.06), 0.04, 0.15), 0.04);  // a thin neck, widening down
  d = smin(d, sdLimb(m, vec3(0.1, -0.56, -0.05), vec3(0.19, -0.3, 0.0), 0.05, 0.034), 0.05);  // arms up, elbows in
  d = smin(d, sdLimb(m, vec3(0.19, -0.3, 0.0), vec3(0.135, -0.08, 0.03), 0.032, 0.024), 0.015);
  vec3 h = m - vec3(0.125, 0.0, 0.05);
  h.xy = rot(0.1) * h.xy;
  h.xz = rot(-0.5) * h.xz;
  d = smin(d, handPose(h / 0.62, vec4(0.1, 0.08, 0.06, 0.04), 0.5, 0.5) * 0.62, 0.012);       // long hands, flat to its jaw
  hollow(sdEll(m - vec3(0.062, 0.14, 0.11), vec3(0.042, 0.056, 0.3)));
  hollow(sdEll(p - vec3(0.0, -0.06, 0.1), vec3(0.04 + 0.012 * sing, 0.07 + 0.03 * sing, 0.3)));   // the mouth, an O
  return d * 0.85;
}
//@ lovers
// a head in profile, facing +x, its features a little past life so they read through the sheet
float headProfile(vec3 p) {
  float d = sdEll(p - vec3(-0.05, 0.06, 0.0), vec3(0.1, 0.12, 0.1));
  d = smin(d, sdEll(p - vec3(0.045, 0.01, 0.0), vec3(0.05, 0.085, 0.07)), 0.03);
  d = smin(d, sdLimb(p, vec3(0.09, 0.05, 0.0), vec3(0.15, -0.005, 0.0), 0.022, 0.015), 0.018);  // nose
  d = smin(d, sdEll(p - vec3(0.115, -0.05, 0.0), vec3(0.026, 0.024, 0.034)), 0.008);            // lips
  d = smin(d, sdEll(p - vec3(0.085, -0.115, 0.0), vec3(0.036, 0.03, 0.042)), 0.016);            // chin
  d = smin(d, sdLimb(p, vec3(-0.03, -0.06, -0.01), vec3(-0.08, -0.42, -0.03), 0.055, 0.075), 0.03);   // neck
  return d;
}
// Magritte's lovers: two veiled heads, lips together, foreheads apart
float figLovers(vec3 p, float t) {
  float k = 0.004 * sin(t * 0.8);
  p /= 1.2;
  p.y -= 0.03;
  vec3 a = p - vec3(-0.142 - k, 0.0, 0.0), b = (p - vec3(0.142 + k, 0.0, 0.0)) * vec3(-1.0, 1.0, 1.0);
  a.xy = rot(0.1) * a.xy; b.xy = rot(0.1) * b.xy;
  float d = smin(headProfile(a), headProfile(b), 0.008);
  d = smin(d, sdEll(p - vec3(0.0, -0.5, -0.03), vec3(0.42, 0.14, 0.12)), 0.06);                 // shoulders, under
  return d * 1.2;
}
//@ bowler
// a man in a bowler hat with a green apple where his face should be
float figBowler(vec3 p, float t, float sing) {
  float d = sdEll(p - vec3(0.0, 0.03, 0.0), vec3(0.125, 0.16, 0.13));                         // the head
  d = smin(d, sdLimb(p, vec3(0.0, -0.1, 0.0), vec3(0.0, -0.22, 0.0), 0.06, 0.08), 0.03);
  vec3 m = mx(p);
  d = smin(d, sdEll(p - vec3(0.0, -0.44, -0.02), vec3(0.3, 0.2, 0.13)), 0.1);                 // the shoulders of a coat
  d = smin(d, sdLimb(p, vec3(0.0, -0.2, 0.09), vec3(0.0, -0.4, 0.13), 0.03, 0.05), 0.02);      // a tie
  float crown = sdEll(p - vec3(0.0, 0.2, 0.0), vec3(0.135, 0.125, 0.14));
  crown = max(crown, 0.145 - p.y);
  vec2 bq = vec2(length((p.xz) * vec2(1.0, 1.1)) - 0.205, p.y - 0.14);
  float brim = length(max(abs(bq) - vec2(0.014, 0.0), 0.0)) - 0.012;
  brim = max(brim, -(length(p.xz) - 0.1));
  float hat = min(crown, brim);
  d = min(smin(d, hat, 0.008), 1e3);
  float bob = 0.006 * sin(t * 0.9) + 0.01 * sing;
  vec3 a = p - vec3(0.0, 0.015 + bob, 0.15);
  float ap = length(a.xy * vec2(1.0, 1.04)) - 0.098;                                           // the apple, hanging where the face should be
  ap = smin(ap, length(a.xy - vec2(0.03, -0.05)) - 0.085, 0.05);
  ap = smin(ap, length(a.xy - vec2(-0.03, -0.05)) - 0.085, 0.05);
  ap = smaxF(ap, -(length(a.xy - vec2(0.0, 0.115)) - 0.03), 0.02);
  ap = min(ap, sdLimb(vec3(a.xy, 0.0), vec3(0.0, 0.07, 0.0), vec3(0.018, 0.13, 0.0), 0.011, 0.009));
  ap = min(ap, sdEll(vec3(a.xy - vec2(0.058, 0.118), 0.0), vec3(0.044, 0.018, 0.1)));
  hollow(max(ap, abs(p.z - 0.05) - 0.3));
  return d * 0.85;
}
//@ praying
// a pair of hands, side on, palm to palm, the cuffs going under
float figPraying(vec3 p, float t) {
  p.xy = rot(0.02 * sin(t * 0.5)) * p.xy;
  float side = p.x > 0.0 ? 1.0 : -1.0;
  vec3 m = vec3(abs(p.x), p.yz);
  m.x -= 0.03;
  // each hand a palm against the middle, tilted so the fingertips meet and the heels stay apart
  m.xy = rot(0.09) * m.xy;
  vec3 q = vec3(m.z, m.y, -m.x);
  float c = 0.03;
  float d = handPose((q - vec3(0.0, 0.14, 0.0)) / 1.45, vec4(c, c, c, c), 0.4, 0.75) * 1.45;
  d = smin(d, sdLimb(m, vec3(0.03, -0.02, 0.0), vec3(0.1, -0.34, 0.03), 0.05, 0.07), 0.04);     // the wrists
  d = smin(d, sdLimb(m, vec3(0.11, -0.36, 0.03), vec3(0.2, -0.82, 0.05), 0.105, 0.145), 0.012);  // the cuffs, wider
  return d * 0.85;
}
//@ wanderer
// from behind, on a crag, the coat blowing, looking out over the lines
float figWanderer(vec3 p, float t) {
  // the rock: a profile cut out of a block, broken and uneven
  float x = p.x;
  float top = -0.14 - 0.55 * smoothstep(0.05, 0.75, abs(x + 0.03)) - 0.035 * abs(sin(x * 15.0 + 0.6)) - 0.018 * abs(sin(x * 41.0));
  float rock = max((p.y - top) * 0.62, length(p.xz * vec2(0.8, 1.6)) - 0.72);
  float sw = 0.012 * sin(t * 1.3);
  vec3 q = p - vec3(0.0, -0.14, 0.0);
  vec3 m = mx(q);
  float b = sdLimb(m, vec3(0.036, 0.0, 0.0), vec3(0.03, 0.2, 0.0), 0.024, 0.038);               // the legs, apart
  b = smin(b, sdLimb(q, vec3(0.0, 0.2, 0.0), vec3(-0.012 - sw, 0.3, 0.0), 0.078, 0.07), 0.018);  // the coat
  b = smin(b, sdLimb(q, vec3(-0.012, 0.28, 0.0), vec3(0.0, 0.47, 0.0), 0.07, 0.048), 0.015);
  b = smin(b, sdLimb(q, vec3(0.0, 0.48, 0.0), vec3(0.0, 0.52, 0.0), 0.022, 0.022), 0.006);
  b = smin(b, sdEll(q - vec3(0.0, 0.57, 0.0), vec3(0.036, 0.046, 0.04)), 0.006);                 // the head
  b = smin(b, sdEll(q - vec3(0.042 + sw, 0.585, 0.0), vec3(0.04, 0.016, 0.03)), 0.014);          // hair in the wind
  b = smin(b, sdLimb(q, vec3(-0.06, 0.44, 0.0), vec3(-0.112, 0.27, 0.0), 0.022, 0.018), 0.012);  // an arm, and the stick
  b = min(b, sdCapsule(q, vec3(-0.112, 0.27, 0.0), vec3(-0.17, 0.0, 0.0), 0.0085));
  return min(rock, b) * 0.9;
}
//@ fluke
// a whale's tail going down, water coming off it
float figFluke(vec3 p, float t, float sing) {
  p.xy = rot(0.05 * sin(t * 0.5)) * p.xy;
  vec3 m = mx(p);
  float d = sdLimb(p, vec3(0.0, -0.95, -0.2), vec3(0.0, 0.24, 0.0), 0.2, 0.038);                // the stock
  // each lobe swept back, thin, its trailing edge a long curve to a point
  vec3 a = m - vec3(0.27, 0.36, 0.0);
  a.xy = rot(-0.42) * a.xy;
  float x = a.x / 0.34;                                                                         // along it, -1 .. 1
  float chord = 0.105 * sqrt(max(1.0 - x * x, 0.0)) * (1.0 - 0.3 * x);
  float l = max(max(abs(a.x) - 0.34, abs(a.y + 0.012 * x) - chord), abs(a.z) - 0.018 * (1.0 - x * x * 0.6));
  d = smin(d, l * 0.75, 0.05);
  d = smaxF(d, -sdEll(p - vec3(0.0, 0.5, 0.0), vec3(0.028, 0.07, 0.2)), 0.012);                 // the notch
  for (int i = 0; i < 4; i++) {                                                                  // and it rains off the edge
    float fi = float(i), f = fract(t * 0.55 + fi * 0.27);
    vec3 c = vec3((fi < 2.0 ? -1.0 : 1.0) * (0.28 + 0.13 * mod(fi, 2.0)), 0.3 - f * f * 1.25, 0.04);
    d = min(d, length(p - c) - (0.016 - 0.005 * f));
  }
  return d * 0.85;
}
//@ serpent
// three humps out of the water, travelling, and a long neck at the front
float figSerpent(vec3 p, float t, float sing) {
  float x = p.x + 0.42;
  float s = clamp((x + 0.62) / 0.9, 0.0, 1.0);
  float y = -0.08 + (0.12 + 0.03 * sin(t * 0.4)) * sin(x * 13.0 + t * 1.4);                       // the humps
  float d = length(vec2(p.y - y, p.z)) - mix(0.03, 0.075, s);
  d = max(d, x - 0.32);
  d = max(d, -x - 0.62);
  float sw = 0.022 * sin(t * 0.9) + 0.012 * sing;
  vec3 A = vec3(-0.12, -0.22, 0.0), B = vec3(0.22, -0.28, 0.0), C = vec3(0.5, 0.1, 0.0), D = vec3(0.34 + sw, 0.42, 0.0), E = vec3(0.13 + sw * 1.5, 0.47, 0.0);
  float b = sdLimb(p, A, B, 0.075, 0.08);
  b = smin(b, sdLimb(p, B, C, 0.08, 0.058), 0.04);
  b = smin(b, sdLimb(p, C, D, 0.058, 0.04), 0.04);
  b = smin(b, sdLimb(p, D, E, 0.04, 0.036), 0.03);
  vec3 h = p - E;
  float hd = sdEll(h - vec3(-0.05, -0.012, 0.0), vec3(0.09, 0.038, 0.042));                       // the head, long and low
  hd = smin(hd, sdEll(h - vec3(-0.125, -0.024, 0.0), vec3(0.05, 0.022, 0.028)), 0.02);
  hd = smin(hd, sdLimb(h, vec3(0.005, 0.02, 0.0), vec3(0.075, 0.075, 0.0), 0.016, 0.003), 0.012);  // a horn
  hollow(length(h - vec3(-0.048, 0.003, 0.038)) - 0.012);                                         // the eye
  return smin(smin(d, b, 0.03), hd, 0.02) * 0.8;
}
//@ kraken
// arms from underneath: thick at the water, thin as a whip at the tip, each curling tighter as it goes
float figKraken(vec3 p, float t, float sing) {
  float d = 1e3;
  for (int j = 0; j < 3; j++) {
    float fj = float(j), side = fj == 1.0 ? -1.0 : 1.0;
    vec3 a = vec3(fj == 0.0 ? -0.03 : fj == 1.0 ? -0.33 : 0.34, -0.72, fj == 0.0 ? -0.05 : 0.08);
    float L = fj == 0.0 ? 0.24 : 0.17, r = fj == 0.0 ? 0.125 : 0.095, ang = side * -0.14;
    float curl = side * (0.1 + 0.04 * sin(t * 0.8 + fj * 2.1) + 0.015 * sing);
    for (int i = 0; i < 10; i++) {
      float fi = float(i);
      ang += curl * (0.25 + fi * fi * 0.13);
      vec3 b = a + vec3(sin(ang), cos(ang), 0.0) * L;
      float r2 = r * 0.83;
      d = smin(d, sdLimb(p, a, b, r, r2), 0.012);
      a = b; r = r2; L *= 0.86;
    }
  }
  return d * 0.82;
}
//@ elephant
// after Dalí: the great weight of it on legs that should snap, an obelisk on its back
float figElephant(vec3 p, float t) {
  float w = sin(t * 0.8);
  vec3 q = p - vec3(0.0, 0.3, 0.0);
  float d = sdEll(q, vec3(0.27, 0.15, 0.13));                                                    // the body
  d = smin(d, sdEll(q - vec3(0.27, 0.03, 0.0), vec3(0.1, 0.1, 0.09)), 0.05);                     // the head
  d = smin(d, sdEll(q - vec3(0.22, 0.04, 0.0), vec3(0.06, 0.09, 0.15)), 0.02);                   // ears
  vec3 T0 = vec3(0.34, 0.0, 0.0), T1 = vec3(0.42, -0.1, 0.0), T2 = vec3(0.42, -0.24, 0.0), T3 = vec3(0.5, -0.33 + 0.02 * w, 0.0);
  d = smin(d, sdLimb(q, T0, T1, 0.04, 0.028), 0.03);                                             // the trunk
  d = smin(d, sdLimb(q, T1, T2, 0.028, 0.02), 0.015);
  d = smin(d, sdLimb(q, T2, T3, 0.02, 0.012), 0.012);
  d = min(d, sdLimb(q, vec3(0.33, -0.03, 0.03), vec3(0.47, -0.12, 0.03), 0.014, 0.004));         // a tusk
  d = smin(d, sdLimb(q, vec3(-0.27, 0.03, 0.0), vec3(-0.35, -0.14, 0.0), 0.012, 0.005), 0.01);   // the tail
  // the obelisk
  vec3 ob = q - vec3(-0.02, 0.15, 0.0);
  float w0 = 0.055 - ob.y * 0.11;
  float o = max(abs(ob.x) - w0, abs(ob.z) - w0);
  o = max(o, dot(vec2(abs(ob.x), ob.y), vec2(0.8, 0.6)) - 0.26);
  o = max(o, -ob.y);
  d = smin(d, o * 0.8, 0.01);
  d = smin(d, sdEll(q - vec3(-0.02, 0.14, 0.0), vec3(0.12, 0.022, 0.1)), 0.012);
  // four legs: long, thin, knotted at the knee, the sway of a walk
  vec3 hips[2]; hips[0] = vec3(0.18, -0.08, 0.075); hips[1] = vec3(-0.18, -0.08, 0.075);
  vec3 m = vec3(q.x, q.y, abs(q.z));
  float sgn = q.z > 0.0 ? 1.0 : -1.0;
  for (int i = 0; i < 2; i++) {
    float ph = (i == 0 ? 0.0 : 3.14) + (sgn > 0.0 ? 0.0 : 1.57);
    vec3 h = hips[i], k = h + vec3(0.03 * sin(t * 0.8 + ph), -0.42, 0.012), f = k + vec3(0.05 * sin(t * 0.8 + ph), -0.55, 0.012);
    d = smin(d, sdLimb(m, h, k, 0.02, 0.008), 0.012);
    d = smin(d, sdLimb(m, k, f, 0.008, 0.004), 0.008);
    d = min(d, length(m - k) - 0.014);
  }
  return d * 0.85;
}
//@ stag
float figStag(vec3 p, float t) {
  p *= 1.25;
  p.y += 0.04;
  vec3 m = mx(p);
  vec3 k = p / 1.5, km = mx(k);
  float d = sdEll(k - vec3(0.0, 0.07, -0.01), vec3(0.105, 0.085, 0.085));                    // the braincase
  d = smin(d, sdEll(k - vec3(0.0, -0.1, 0.02), vec3(0.068, 0.17, 0.06)), 0.05);              // the long face
  d = smin(d, sdEll(km - vec3(0.07, 0.03, 0.035), vec3(0.042, 0.04, 0.045)), 0.03);          // rims round the eyes
  d = smin(d, sdEll(k - vec3(0.0, -0.26, 0.03), vec3(0.04, 0.05, 0.04)), 0.03);              // the muzzle
  d *= 1.5;
  hollow(sdEll(km - vec3(0.072, 0.03, 0.07), vec3(0.03, 0.03, 0.25)) * 1.2);                  // eye sockets, deep
  hollow(sdEll(km - vec3(0.016, -0.17, 0.07), vec3(0.016, 0.08, 0.2)) * 1.2);                 // the long nose
  vec3 a0 = vec3(0.06, 0.12, 0.0), a1 = vec3(0.19, 0.26, 0.0), a2 = vec3(0.32, 0.46, -0.02), a3 = vec3(0.32, 0.7, -0.06);
  d = smin(d, sdLimb(m, a0, a1, 0.03, 0.022), 0.02);
  d = smin(d, sdLimb(m, a1, a2, 0.022, 0.018), 0.008);
  d = smin(d, sdLimb(m, a2, a3, 0.018, 0.009), 0.006);
  d = min(d, sdLimb(m, a1, a1 + vec3(-0.07, 0.18, 0.04), 0.017, 0.006));                      // the tines
  vec3 md = mix(a1, a2, 0.55);
  d = min(d, sdLimb(m, md, md + vec3(0.16, 0.09, 0.0), 0.015, 0.005));
  d = min(d, sdLimb(m, a2, a2 + vec3(-0.11, 0.17, 0.0), 0.014, 0.005));
  d = min(d, sdLimb(m, a2 + vec3(0.0, 0.1, -0.02), a2 + vec3(0.14, 0.2, -0.02), 0.012, 0.004));
  return d * 0.8;
}
//@ dog
// Goya's dog: a head, small, looking up from behind a slope that fills the world
float figDog(vec3 p, float t) {
  float d = sdEll(p - vec3(-0.5, -0.62, -0.05), vec3(0.9, 0.56, 0.4));                           // the slope
  vec3 h = (p - vec3(0.14, 0.0 + 0.008 * sin(t * 0.7), 0.0)) / 1.5;
  h.xy = rot(-0.5) * h.xy;
  float e = sdEll(h, vec3(0.085, 0.078, 0.07));                                                 // the skull
  e = smin(e, sdLimb(h, vec3(0.05, -0.015, 0.0), vec3(0.135, -0.03, 0.0), 0.056, 0.04), 0.03);    // the muzzle
  e = smin(e, length(h - vec3(0.155, -0.012, 0.0)) - 0.022, 0.01);                              // the nose
  e = smin(e, sdEll(h - vec3(-0.075, -0.05, 0.0), vec3(0.058, 0.115, 0.024)), 0.012);           // the ear, hanging
  hollow((length(h - vec3(0.03, 0.03, 0.058)) - 0.014) * 1.5);                                   // the eye
  e *= 1.5;
  e = smin(e, sdLimb(p, vec3(0.14, -0.05, 0.0), vec3(0.04, -0.5, -0.03), 0.09, 0.15), 0.04);    // the neck
  return smin(d, e, 0.04) * 0.85;
}
//@ liner
// a liner going down by the head, her stern in the air, the screws turning on nothing
float figLiner(vec3 p, float t) {
  vec3 q = p - vec3(0.02, 0.0, 0.0);
  q.xy = rot(-0.68) * q.xy;
  float hw = 0.075 * (1.0 - 0.45 * smoothstep(0.3, 1.0, abs(q.x)));
  float hull = sdBox(q - vec3(0.0, -0.05, 0.0), vec3(0.72, 0.075, hw));
  float up = sdBox(q - vec3(0.08, 0.075, 0.0), vec3(0.5, 0.055, hw * 0.82));
  float top = sdBox(q - vec3(0.12, 0.15, 0.0), vec3(0.4, 0.024, hw * 0.7));
  float d = min(min(hull, up), top);
  d = smin(d, sdEll(q - vec3(-0.72, -0.03, 0.0), vec3(0.08, 0.1, hw)), 0.02);                    // the counter stern (she's up on the left)
  // the funnels, raked, the same way the hull goes
  for (int i = 0; i < 4; i++) {
    float x = -0.22 + float(i) * 0.19;
    vec3 f = q - vec3(x, 0.26, 0.0);
    f.x += f.y * 0.25;
    d = min(d, max(length(f.xz * vec2(1.0, 1.3)) - 0.038, abs(f.y) - 0.1));
  }
  d = min(d, sdCapsule(q, vec3(-0.5, 0.15, 0.0), vec3(-0.53, 0.46, 0.0), 0.009));                // masts
  d = min(d, sdCapsule(q, vec3(0.5, 0.15, 0.0), vec3(0.47, 0.42, 0.0), 0.009));
  vec3 sc = q - vec3(-0.8, -0.085, 0.0);                                                         // a rudder and the screws
  d = min(d, sdBox(sc + vec3(-0.02, 0.0, 0.0), vec3(0.012, 0.06, 0.006)));
  sc.yz = rot(t * 1.1) * sc.yz;
  d = min(d, max(length(sc.yz * vec2(1.0, 3.0)) - 0.06, abs(sc.x - 0.05) - 0.01));
  d = min(d, max(length(sc.zy * vec2(1.0, 3.0)) - 0.06, abs(sc.x - 0.05) - 0.01));
  return d * 0.9;
}
//@ liberty
// the crown, sunk to the lips, and the arm still holding it up
float figLiberty(vec3 p, float t) {
  vec3 q = p - vec3(-0.16, -0.05, 0.0);
  float d = sdEll(q, vec3(0.135, 0.17, 0.14));                                                   // the head, heavy
  d = smin(d, sdEll(q - vec3(0.0, -0.13, 0.02), vec3(0.1, 0.09, 0.1)), 0.04);
  d = smin(d, sdEll(q - vec3(0.0, -0.02, 0.135), vec3(0.018, 0.05, 0.03)), 0.02);                // the nose
  d = smin(d, sdEll(q - vec3(0.0, 0.065, 0.115), vec3(0.11, 0.018, 0.03)), 0.03);                // the brow
  vec3 m = mx(q);
  hollow(sdEll(m - vec3(0.052, 0.03, 0.125), vec3(0.026, 0.016, 0.1)));
  d = smin(d, sdEll(q - vec3(0.0, 0.125, -0.01), vec3(0.15, 0.03, 0.14)), 0.015);                // the diadem
  float a = atan(q.x, q.y + 0.08);                                                               // seven spikes, a fan
  float w = 0.42, i = clamp(floor(a / w + 0.5), -3.0, 3.0);
  vec2 v = rot(i * w) * vec2(q.x, q.y + 0.08);
  d = min(d, sdLimb(vec3(v, q.z + 0.005), vec3(0.0, 0.2, 0.0), vec3(0.0, 0.47, 0.0), 0.03, 0.002));
  // the arm, the robe's sleeve falling from it, and the torch
  vec3 sh = vec3(0.1, -0.4, -0.04), el = vec3(0.3, -0.04, 0.0), wr = vec3(0.35, 0.34, 0.0);
  float arm = sdLimb(p, sh, el, 0.1, 0.066);
  arm = smin(arm, sdLimb(p, el, wr, 0.066, 0.042), 0.03);
  arm = smin(arm, sdEll(p - vec3(0.35, 0.37, 0.0), vec3(0.05, 0.06, 0.05)), 0.02);               // the fist
  vec3 tq = p - vec3(0.37, 0.36, 0.0);
  float torch = sdLimb(tq, vec3(0.0, -0.06, 0.0), vec3(0.0, 0.18, 0.0), 0.022, 0.032);
  torch = smin(torch, max(length(tq.xz) - 0.085, abs(tq.y - 0.19) - 0.014), 0.008);              // the balcony
  float fl = 0.005 * sin(t * 2.3);
  torch = min(torch, sdLimb(tq, vec3(0.0, 0.2, 0.0), vec3(fl, 0.31, 0.0), 0.045, 0.002));         // the flame
  return min(min(d, arm), torch) * 0.85;
}
//@ moai
// one of the Easter Island heads, seen nearly side on: a flat top, a shelf of a brow, a long wedge of a
// nose, pursed lips, a jaw like a step
float moaiHead(vec3 p) {
  vec3 m = mx(p);
  float d = sdBox(p - vec3(0.0, 0.12, -0.04), vec3(0.11, 0.19, 0.1)) - 0.045;                    // the skull
  d = smin(d, sdBox(p - vec3(0.0, -0.3, -0.05), vec3(0.14, 0.22, 0.1)) - 0.05, 0.05);            // the neck and chest
  d = smin(d, sdBox(p - vec3(0.0, 0.17, 0.08), vec3(0.11, 0.025, 0.06)) - 0.012, 0.012);         // the brow, a shelf
  d = smin(d, sdLimb(p, vec3(0.0, 0.15, 0.12), vec3(0.0, -0.08, 0.21), 0.03, 0.05), 0.014);      // the nose
  d = smin(d, sdBox(p - vec3(0.0, -0.13, 0.11), vec3(0.075, 0.012, 0.055)) - 0.012, 0.014);      // the upper lip, out
  d = smin(d, sdBox(p - vec3(0.0, -0.18, 0.1), vec3(0.07, 0.012, 0.05)) - 0.01, 0.012);          // the lower lip, pursed
  d = smin(d, sdBox(p - vec3(0.0, -0.26, 0.085), vec3(0.08, 0.03, 0.06)) - 0.01, 0.014);         // the chin
  d = smin(d, sdBox(m - vec3(0.13, 0.03, -0.03), vec3(0.018, 0.14, 0.03)), 0.012);               // long ears
  hollow(sdEll(m - vec3(0.07, 0.1, 0.1), vec3(0.04, 0.03, 0.06)));                               // and no eyes, shadow under the shelf
  return d;
}
float figMoai(vec3 p) {
  float d = moaiHead((p - vec3(-0.12, 0.1, 0.0)) / 1.25) * 1.25;
  vec3 q = (p - vec3(0.5, -0.1, -0.2)) / 0.92;
  return min(d, moaiHead(q) * 0.9) * 0.9;
}
//@ steeple
// a church under water to its belfry, the spire leaning
float figSteeple(vec3 p) {
  vec3 q = p;
  q.y += 0.1;
  float tower = sdBox(q - vec3(0.0, -0.15, 0.0), vec3(0.13, 0.42, 0.13));
  float a = max(abs(q.x), abs(q.z));
  float spire = max(a - (0.135 - (q.y - 0.27) * 0.21), abs(q.y - 0.62) - 0.35);
  float d = min(tower, spire * 0.92);
  d = min(d, sdBox(mx(q) - vec3(0.148, 0.28, 0.148), vec3(0.018, 0.09, 0.018)));                  // pinnacles
  d = min(d, sdCapsule(q, vec3(0.0, 0.96, 0.0), vec3(0.0, 1.14, 0.0), 0.012));                    // the cross
  d = min(d, sdCapsule(q, vec3(-0.05, 1.07, 0.0), vec3(0.05, 1.07, 0.0), 0.011));
  vec3 n = q - vec3(-0.34, -0.15, -0.06);                                                         // the nave, its roof
  float nave = sdBox(n, vec3(0.22, 0.15, 0.1));
  float roof = dot(vec2(abs(n.z), n.y), vec2(0.75, 0.66)) - 0.17;
  nave = min(nave, max(max(roof, abs(n.x) - 0.23), -n.y));
  d = min(d, nave);
  // the belfry's arches and a clock, right through it
  vec3 b = vec3(abs(q.x), q.y, q.z) - vec3(0.0, 0.13, 0.13);
  float arch = min(max(abs(q.x) - 0.05, abs(q.y - 0.09) - 0.09), length(q.xy - vec2(0.0, 0.18)) - 0.05);
  hollow(max(arch, abs(q.z) - 0.3));
  hollow(max(length(q.xy - vec2(0.0, -0.1)) - 0.05, abs(q.z - 0.13) - 0.04));
  return d * 0.85;
}
//@ isle
// cliffs in a horseshoe with the middle fallen away, one dark door, and cypresses straight up out of it
float figIsle(vec3 p, float t) {
  float x = p.x, ax = abs(x);
  float crack = 0.03 * abs(sin(x * 26.0 + 1.0)) + 0.016 * abs(sin(x * 67.0)) + 0.008 * sin(p.y * 29.0);
  float top = mix(0.34 + 0.09 * sin(x * 2.0 + 0.4), -0.1, smoothstep(0.26, 0.11, ax)) - 0.72 * smoothstep(0.5, 0.86, ax) - crack;
  float block = max((p.y - top) * 0.7, abs(p.z + 0.04 * cos(x * 3.6)) - 0.15);
  float d = max(block, ax - 0.86);
  float c = 1e3;
  for (int i = 0; i < 5; i++) {                                                                  // the cypresses: narrow flames, tall
    float fi = float(i), xx = -0.17 + fi * 0.085;
    float h = 0.56 + 0.2 * sin(fi * 2.4 + 0.5);
    c = smin(c, sdEll(p - vec3(xx + 0.005 * sin(t * 0.6 + fi), -0.24 + h * 0.5, -0.04), vec3(0.052, h * 0.56, 0.05)), 0.01);
  }
  d = min(d, c);
  hollow(sdBox(p - vec3(-0.52, -0.1, 0.0), vec3(0.042, 0.09, 0.3)));                            // a door in the rock
  hollow(sdBox(p - vec3(0.5, -0.04, 0.0), vec3(0.034, 0.075, 0.3)));
  return d * 0.85;
}
//@ providence
// the pyramid on the dollar: its top floating free, an eye in it that finds you
float figProvidence(vec3 p, float t, vec2 look, float sing) {
  vec3 q = p; q.y += 0.1;
  float a = max(abs(q.x), abs(q.z));
  float slope = dot(vec2(a, q.y), vec2(0.8, 0.6));
  float py = max(max(slope - 0.3, -q.y - 0.8), q.y - 0.2);
  py += 0.003 * smoothstep(0.7, 0.95, sin(q.y * 58.0));                                          // the courses of stone
  float lift = 0.07 + 0.02 * sin(t * 0.7) + 0.05 * sing;
  vec3 c = q - vec3(0.0, lift, 0.0);
  float cap = max(dot(vec2(max(abs(c.x), abs(c.z)), c.y), vec2(0.8, 0.6)) - 0.3, 0.24 - c.y);
  float d = min(py, cap) * 0.9;
  vec3 e = c - vec3(0.0, 0.335, 0.0);                                                            // the eye, an almond right through it
  float alm = max(length(e.xy - vec2(0.0, -0.075)) - 0.1, length(e.xy - vec2(0.0, 0.075)) - 0.1);
  float ball = length(e.xy - vec2(look.x * 0.012, look.y * 0.008)) - 0.026;
  hollow(max(max(alm, -ball), abs(e.z) - 0.4));
  return d;
}
//@ moon
// a crescent with a profile in its inner curve
float figMoon(vec3 p, float t) {
  vec3 q = p;
  q.xy = rot(0.06 * sin(t * 0.3)) * q.xy;
  float d = length(q.xy) - 0.42;
  vec3 c = q - vec3(0.2, 0.05, 0.0);
  float bite = length(c.xy) - 0.34;
  d = smaxF(d, -bite, 0.012);
  float f = sdEll(q - vec3(-0.11, 0.09, 0.0), vec3(0.09, 0.1, 0.1));                            // a brow
  f = smin(f, sdLimb(q, vec3(-0.11, 0.06, 0.0), vec3(0.015, -0.02, 0.0), 0.05, 0.014), 0.03);    // the nose
  f = smin(f, sdEll(q - vec3(-0.08, -0.12, 0.0), vec3(0.06, 0.03, 0.05)), 0.03);                 // the lips
  f = smin(f, sdEll(q - vec3(-0.09, -0.21, 0.0), vec3(0.07, 0.05, 0.05)), 0.03);                 // the chin
  d = smin(d, f, 0.03);
  d = max(d, abs(q.z) - 0.09 * sqrt(max(1.0 - dot(q.xy, q.xy) / 0.2, 0.05)));                    // lens-thin
  hollow(max(length((q.xy - vec2(-0.085, 0.09)) * vec2(1.0, 2.2)) - 0.03, abs(q.z) - 0.2));
  return d * 0.85;
}
//@ eye
// an eye the size of a balloon, half under; the iris turns to find you, the pupil goes down for ever
float figEye(vec3 p, vec2 look) {
  vec3 dir = normalize(vec3(look.x * 0.75, look.y * 0.75, 1.0));
  float ball = length(p) - 0.36;
  float c = dot(p, dir) / max(length(p), 1e-4);
  ball += 0.012 * smoothstep(0.86, 0.9, c) - 0.006 * smoothstep(0.92, 0.95, c) * sin(atan(p.y, p.x) * 40.0);
  hollow(sdCapsule(p, dir * 0.6, dir * 0.05, 0.075));
  return ball * 0.9;
}
//@ monolith
float figMonolith(vec3 p) {
  return sdBox(p - vec3(0.0, -0.06, 0.0), vec3(0.16, 0.66, 0.036)) - 0.002;
}
`;
const CHUNKS = Object.fromEntries(LIB.split(/^\/\/@ /m).slice(1).map(c => { const i = c.indexOf('\n'); return [c.slice(0, i).trim(), c.slice(i + 1)]; }));

const TAIL = `
// the sheet round a figure: its pattern is pushed aside and swirled, like water round a stone, and pulled
// along behind one that's moving; rings go out from the waterline
vec2 figFlow(vec2 q) {
  if (FIG < 0.001 || FIGREP > 0.5) return q;
  vec2 c = vec2(FIGX, FIGY), o = q - c;
  float R = 0.3 * FIGS * FIG, r2 = dot(o, o), k = R * R / (r2 + R * R);
  q = c + rot(0.5 * k) * o * (1.0 - 0.28 * k);
  float r = sqrt(r2) / FIGS;
  q += o / max(sqrt(r2), 1e-4) * FIGS * 0.016 * FIG * FIGRING * sin(r * 30.0 - FIGT * 2.6) * exp(-r * 2.4) * smoothstep(0.03, 0.2, r);
  float sp = length(vec2(FIGVX, FIGVY));
  if (sp > 0.001) {                                                                           // the wake
    vec2 dir = vec2(FIGVX, FIGVY) / sp;
    float behind = -dot(o, dir), side = dot(o, vec2(-dir.y, dir.x));
    float b = max(behind, 0.0) / FIGS;
    float w = smoothstep(0.0, 0.2, behind / FIGS) * exp(-b * 2.2) * exp(-side * side / (FIGS * FIGS * (0.03 + 0.1 * b)));
    q += w * sp * FIGS * 0.2 * vec2(dir.x + 0.6 * sin(behind * 22.0 / FIGS), dir.y + 0.6 * cos(side * 26.0 / FIGS));
  }
  return q;
}

// the way the figure faces (worked out on the CPU, so it costs the shader no registers). Columns: its
// right, its up, its front.
uniform mat3 uFigFrame;

// the nearest figure's: the point in its own frame, where it is, its size, and its hollows (world units,
// < 0 inside)
vec3 gFQ = vec3(0.0), gFC = vec3(0.0);
float gFS = 1.0, gFHole = 1e3;

// one figure, placed: at pos (it comes up from far below as it comes on), size S, facing by M, maybe
// repeated across the sheet. Returns its distance (figure units) and fills in its hollows, the point in
// its frame, and where it is (the copy nearest, when repeated).
float figPlaced(vec3 p, int id, vec3 pos, float S, mat3 M, float rep, out float h, out vec3 q, out vec3 c) {
  q = p - pos;
  if (rep > 0.5) {
    float sp = FIGSP * S;
    vec2 g = floor(q.xy / sp + 0.5);
    gFRow = g.x * 1.7 + g.y * 2.9;
    q.xy -= sp * g;
    q.z -= S * (0.11 * sin(FIGT * 0.9 + gFRow) + 0.09 * sin(gFRow * 3.7));
  }
  c = p - q;
  q = (q * M) / S;
  float bound = length(q - vec3(0.0, FIGBY, 0.0)) - FIGBR;
  h = 1.0;
  float d = bound;                                                                           // far off (beyond the fabric's softness): its bounding ball will do
  if (bound <= 0.06 + FIGMELT * FIGSOFT / S) {
    gH = 1.0;
    d = figure3D(id, q);
    h = max(gH, d - 0.02);                                                                   // hollows stay inside the figure: they don't cut the sheet in front of it
  }
  return d;
}

// does this ray come anywhere near the figure? Decided once per pixel, so the march along a ray that
// passes nowhere near it never evaluates it at all (beyond the fabric's reach, it changes nothing).
// A figure repeated across the sheet is everywhere, so it always counts as near.
bool figNear(vec3 ro, vec3 rd) {
  if (FIGREP > 0.5) return true;
  vec3 oc = vec3(FIGX, FIGY, mix(-FIGSINK * FIGS, FIGZ, FIG)) - ro;
  float tc = max(dot(oc, rd), 0.0);                                                          // the nearest point of the ray (not behind the camera)
  float D = length(oc - rd * tc) - (FIGBR * 1.32 + abs(FIGBY)) * FIGS;                       // the fabric's dip reaches further than the shape
  return D < 1.4 * FIGMELT * FIGSOFT + 0.06 * FIGS;
}

float figuresSDF(vec3 p) {
  float h;
  vec3 q, c;
  float d = FIGS * figPlaced(p, int(FIGA + 0.5), vec3(FIGX, FIGY, mix(-FIGSINK * FIGS, FIGZ, FIG)), FIGS, uFigFrame, FIGREP, h, q, c);
  gFHole = h * FIGS; gFQ = q; gFC = c; gFS = FIGS;
  return d;
}
`;

// the figure code for a shader that can draw these figures (ids), and only these
export function figuresGLSL(ids = []) {
  ids = [...new Set(ids)].filter(id => id in FIGURE_INDEX && !FIGURES[FIGURE_INDEX[id]].special);
  const need = [];
  const add = id => { if (need.includes(id)) return; (FIGURES[FIGURE_INDEX[id]].uses || []).forEach(add); need.push(id); };
  ids.forEach(add);
  const cases = ids.map(id => `    case ${FIGURE_INDEX[id]}: return ${FIGURES[FIGURE_INDEX[id]].call};`).join('\n');
  return HEAD + need.map(id => CHUNKS[id] || '').join('\n') + `
float figure3D(int id, vec3 p) {
  float t = FIGT + 0.6 * gFRow, sing = FIGSING;
  vec2 look = vec2(FIGLX, FIGLY);
  switch (id) {
${cases}
  }
  return 1e3;
}

` + TAIL;
}
