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
//   grab  the point (figure y) that sits under your cursor: near the waterline for anything that rises from
//         it, so it stands up from your cursor the way the hand stands up from the wrist.
//   swim  it isn't placed, it swims under the sheet after your cursor: 'trail' a body dragged along like a
//         rope, 'glide' a flat thing that turns as it goes. See Figures.swim.
//   r, cy bounding sphere: radius and centre height. Rays that miss it never evaluate the figure.
//   ink   1: a solid black thing, not draped in the pattern (the monolith).
// The order here is the id the shader switches on; `call` is how it's drawn, `uses` other figures' code.
// The shader is built with only the figures on screen (see figureBank).

export const FIGURES = [
  // people, going under
  { id: 'hand', name: 'Hand', group: 'People', blurb: 'your cursor is the wrist. Hold: it makes a fist', special: true },
  { id: 'arm', scale: 0.95, name: 'Not Waving', group: 'People', blurb: 'one arm, straining up out of the water. Hold: the fingers close', call: 'figArm(p, t, sing, press)', pose: [0.2, 0.1, -0.16], water: -0.3, rise: 0.22, veil: 0.55, grab: -0.22, r: 0.95, cy: 0.05 },
  { id: 'singer', scale: 1.45, name: 'The Singer', group: 'People', blurb: 'a face pushing through the sheet, its mouth on the melody. Hold: it opens wide', call: 'figSinger(p, t, sing, press)', pose: [0.3, -0.42, 0.12], lean: 0.12, water: -0.2, rise: 0.1, veil: 0.8, grab: 0.0, r: 0.72, cy: -0.08 },
  { id: 'skull', lean: 0.1, name: 'Skull', group: 'People', blurb: 'sunk to the chin, sockets all the way down. Hold: the jaw drops', call: 'figSkull(p, max(sing * 0.5, press))', pose: [0.38, -0.08, -0.14], water: -0.36, rise: 0.14, veil: 0.4, grab: 0.0, r: 0.66, cy: -0.02 },
  { id: 'icarus', scale: 0.92, name: 'Icarus', group: 'People', blurb: 'two legs and a splash, after Bruegel. Hold: they kick', call: 'figIcarus(p, t, sing, press)', pose: [0.15, 0.08, 0.26], water: -0.26, rise: 0.2, veil: 0.4, grab: -0.2, r: 0.95, cy: 0.05 },
  // beasts
  { id: 'fluke', scale: 0.88, name: 'The Fluke', group: 'Beasts', blurb: 'a whale going down. Hold: the tail lifts and flexes', call: 'figFluke(p, t, sing, press)', pose: [0.3, 0.14, 0.22], water: -0.3, rise: 0.24, veil: 0.3, grab: -0.24, r: 0.95, cy: 0.02 },
  { id: 'kraken', scale: 0.88, name: 'Kraken', group: 'Beasts', blurb: 'arms from underneath that lean toward you. Hold: they coil', call: 'figKraken(p, t, sing, press, look)', pose: [0.0, 0.1, 0.0], water: -0.32, rise: 0.22, veil: 0.4, grab: -0.26, r: 0.98, cy: 0.05 },
  { id: 'serpent', swim: 'trail', scale: 1.0, name: 'Sea Serpent', group: 'Beasts', blurb: 'swims under the sheet after your cursor, its neck rising with the tune. Hold: it rears', call: 'figSerpent(p, t, sing, press)', veil: 0.5 },
  { id: 'manta', swim: 'glide', scale: 0.92, name: 'Manta', group: 'Beasts', blurb: 'glides under the sheet, circling your cursor. Hold: its wings beat', call: 'figManta(p, t, sing, press)', veil: 0.55, r: 1.3, cy: 0 },
  // signs
  { id: 'wings', scale: 0.8, name: 'Wings', group: 'Signs', blurb: 'something with wings, going under. Hold: they sweep forward', call: 'figWings(p, t, sing, press)', pose: [0.28, 0.06, 0.08], water: -0.34, rise: 0.2, veil: 0.4, grab: -0.3, r: 1.2, cy: 0.08 },
  { id: 'eye', lean: 0, name: 'The Eye', group: 'Signs', blurb: 'half under, and it watches your cursor, after Redon. Click: it blinks', call: 'figEye(p, t, look, press)', pose: [0, 0, 0], water: -0.1, rise: 0.1, veil: 0.7, grab: 0.0, r: 0.6, cy: 0.05 },
  { id: 'monolith', style: 'silhouette', scale: 0.72, name: 'Monolith', group: 'Signs', blurb: '1 : 4 : 9', call: 'figMonolith(p)', pose: [0.32, 0.08, 0.05], water: -0.42, rise: 0.25, veil: 0.1, grab: -0.3, ink: 1, r: 0.8, cy: -0.06 },
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
  float far = length(p - vec3(0.0, 0.1, 0.0)) - 0.34;
  if (far > 0.22) return min(d, far);                                                          // far enough that the fabric can't feel the difference
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
// one arm out of the water, the hand open as far as it goes, the fingers trying; hold and they close on nothing
float figArm(vec3 p, float t, float sing, float press) {
  p.x += 0.03 * sin(t * 0.7 + p.y * 1.6) * smoothstep(0.4, -0.5, p.y);
  float f = 0.5 + 0.5 * sin(t * 1.3);
  vec3 wr = vec3(0.03, 0.02, 0.0), el = vec3(-0.1, -0.5, -0.1);
  float d = sdLimb(p, el, wr, 0.1, 0.05);                                                     // the forearm
  d = smin(d, sdEll(p - mix(el, wr, 0.25) - vec3(-0.012, 0.0, 0.012), vec3(0.092, 0.2, 0.082)), 0.05);   // its muscle
  d = smin(d, sdLimb(p, vec3(-0.18, -0.95, -0.2), el, 0.13, 0.095), 0.04);                     // the upper arm, under
  vec3 q = (p - vec3(0.045, 0.1, 0.0)) / 1.25;
  q.xy = rot(-0.14) * q.xy;
  q.yz = rot(-0.2) * q.yz;
  float c = 0.06 + 0.2 * f + 0.25 * sing + press * 1.05;
  return smin(d, handPose(q, vec4(c, c * 0.8, c * 0.6, c * 0.4 + press * 0.3), 0.15 + press * 0.7, 1.15 - press * 0.7) * 1.25, 0.03) * 0.9;
}
//@ singer
// a face pressed up through the sheet, tipped back, eyes shut, in the proportions of a classical bust: the
// way the veiled marbles do it. Its jaw hangs from the hinge and goes with the tune.
float figSinger(vec3 p, float t, float sing, float press) {
  float open = clamp(sing * 0.75 + press + 0.08 + 0.04 * sin(t * 0.9), 0.0, 1.0);
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.1, -0.06), vec3(0.205, 0.24, 0.25));                         // the cranium
  d = smin(d, sdEll(p - vec3(0.0, 0.08, 0.085), vec3(0.17, 0.15, 0.105)), 0.06);               // the forehead
  d = smaxF(d, -sdEll(m - vec3(0.27, 0.05, 0.1), vec3(0.09, 0.12, 0.13)), 0.05);               // temples
  d = smin(d, sdEll(p - vec3(0.0, -0.05, 0.08), vec3(0.15, 0.125, 0.115)), 0.05);              // the mid-face
  d = smin(d, sdEll(m - vec3(0.108, -0.035, 0.122), vec3(0.052, 0.04, 0.05)), 0.06);           // cheekbones
  // the jaw, on its hinge
  vec3 j = p - vec3(0.0, -0.06, -0.02);
  j.yz = rot(-open * 0.42) * j.yz;
  float jd = sdEll(j - vec3(0.0, -0.09, 0.075), vec3(0.125, 0.09, 0.12));
  jd = smin(jd, sdEll(j - vec3(0.0, -0.172, 0.155), vec3(0.05, 0.04, 0.05)), 0.05);            // the chin
  jd = smin(jd, sdEll(j - vec3(0.0, -0.098, 0.195), vec3(0.04, 0.014, 0.024)), 0.02);          // the lower lip
  d = smin(d, jd, 0.04);
  d = smin(d, sdLimb(p, vec3(0.0, -0.16, -0.1), vec3(0.0, -0.62, -0.22), 0.1, 0.125), 0.07);   // the neck
  // the brow, and under it shallow sockets, a closed lid lying in each
  d = smin(d, sdEll(m - vec3(0.068, 0.082, 0.165), vec3(0.08, 0.02, 0.035)), 0.045);
  d = smaxF(d, -sdEll(m - vec3(0.074, 0.032, 0.2), vec3(0.056, 0.026, 0.04)), 0.035);
  d = smin(d, sdEll(m - vec3(0.074, 0.026, 0.155), vec3(0.042, 0.022, 0.026)), 0.022);
  // the nose: a long straight line from the brow, a small tip
  d = smin(d, sdLimb(p, vec3(0.0, 0.07, 0.175), vec3(0.0, -0.03, 0.222), 0.014, 0.019), 0.03);
  d = smin(d, length(p - vec3(0.0, -0.042, 0.226)) - 0.02, 0.022);
  d = smin(d, sdEll(m - vec3(0.022, -0.054, 0.204), vec3(0.014, 0.011, 0.015)), 0.016);
  // the upper lip, and the mouth behind it going all the way down
  d = smin(d, sdEll(p - vec3(0.0, -0.096, 0.198), vec3(0.042, 0.01, 0.017)), 0.02);
  float gape = 0.003 + open * 0.05;
  vec3 mo = p - vec3(0.0, -0.116 - open * 0.03, 0.17);
  float cav = sdEll(mo, vec3(0.034 + open * 0.008, gape, 0.1));
  d = smaxF(d, -cav, 0.006);
  hollow(cav + 0.002);
  return d * 0.85;
}
//@ skull
// bone, not a balloon: a long cranium pinched at the temples, a shelf of brow, cheekbones and their arches,
// and a jaw on a hinge that can drop. The sockets and the nose go all the way down.
float figSkull(vec3 p, float jaw) {
  vec3 m = mx(p);
  float d = sdEll(p - vec3(0.0, 0.11, -0.08), vec3(0.245, 0.255, 0.3));                        // the dome
  d = smaxF(d, -sdEll(m - vec3(0.32, -0.01, 0.03), vec3(0.1, 0.12, 0.16)), 0.05);              // temples, pinched in
  d = smin(d, sdEll(p - vec3(0.0, -0.035, 0.075), vec3(0.165, 0.125, 0.11)), 0.04);            // the upper face
  d = smin(d, sdEll(m - vec3(0.082, 0.052, 0.168), vec3(0.09, 0.028, 0.04)), 0.028);           // the brow
  d = smin(d, sdEll(m - vec3(0.14, -0.075, 0.105), vec3(0.052, 0.04, 0.055)), 0.02);           // cheekbones
  d = smin(d, sdCapsule(m, vec3(0.16, -0.08, 0.07), vec3(0.235, -0.055, -0.08), 0.015), 0.02);  // and their arches, back to the ears
  d = smin(d, sdEll(p - vec3(0.0, -0.165, 0.105), vec3(0.095, 0.05, 0.08)), 0.03);             // where the top teeth sit
  // the top teeth: a row of soft pegs round the arch
  vec2 ta = p.xz - vec2(0.0, 0.075);
  float ang = atan(ta.x, ta.y), ti = (clamp(floor(ang / 0.25), -4.0, 3.0) + 0.5) * 0.25;
  vec2 tq = rot(ti) * ta;
  float tooth = sdEll(vec3(tq.x, p.y + 0.205, tq.y - 0.094), vec3(0.0135, 0.03, 0.016));
  d = smin(d, tooth, 0.004);
  // the jaw, swinging from the hinge in front of the ear
  vec3 j = p - vec3(0.0, -0.09, -0.04);
  j.yz = rot(-jaw * 0.5) * j.yz;
  vec3 jm = mx(j);
  float jd = sdCapsule(jm, vec3(0.165, 0.0, 0.0), vec3(0.14, -0.155, 0.02), 0.026);            // the upright part
  jd = smin(jd, sdLimb(jm, vec3(0.14, -0.155, 0.02), vec3(0.05, -0.2, 0.18), 0.027, 0.03), 0.02);   // the bar forward
  jd = smin(jd, sdEll(j - vec3(0.0, -0.205, 0.195), vec3(0.058, 0.03, 0.03)), 0.022);          // the chin
  vec2 tb = j.xz - vec2(0.0, 0.1);
  float angB = atan(tb.x, tb.y), tiB = (clamp(floor(angB / 0.3), -3.0, 2.0) + 0.5) * 0.3;
  vec2 tqB = rot(tiB) * tb;
  jd = smin(jd, sdEll(vec3(tqB.x, j.y + 0.16, tqB.y - 0.082), vec3(0.0125, 0.026, 0.015)), 0.004);
  d = min(d, jd);
  vec3 e = m - vec3(0.092, 0.002, 0.17);
  e.xy = rot(0.2) * e.xy;
  float sock = sdEll(e, vec3(0.062, 0.054, 0.34));
  d = smaxF(d, -sock, 0.012);
  hollow(sock + 0.005);
  float nose = sdEll(m - vec3(0.018, -0.082, 0.2), vec3(0.021, 0.042, 0.26));
  d = smaxF(d, -nose, 0.008);
  hollow(nose + 0.004);
  return d * 0.85;
}
//@ icarus
// the moment nobody noticed: two legs, the knees bent, kicking
float figLeg(vec3 p, vec3 hip, vec3 knee, vec3 ankle, vec3 toe) {
  float d = sdLimb(p, hip, knee, 0.125, 0.07);
  d = smin(d, sdLimb(p, knee, ankle, 0.075, 0.034), 0.03);
  d = smin(d, sdEll(p - mix(knee, ankle, 0.3) - vec3(-0.028, 0.0, 0.0), vec3(0.058, 0.13, 0.062)), 0.04);   // the calf
  vec3 foot = normalize(toe - ankle);
  d = smin(d, sdLimb(p, ankle, toe, 0.042, 0.027), 0.025);                                   // the top of the foot
  d = smin(d, length(p - ankle + foot * 0.035) - 0.043, 0.025);                              // the heel
  d = smin(d, sdEll(p - toe - foot * 0.016, vec3(0.038, 0.03, 0.025)), 0.018);                // the toes
  return d;
}
float figIcarus(vec3 p, float t, float sing, float press) {
  float a = sin(t * 1.8) + press * 0.7 * sin(t * 7.3), b = sin(t * 1.8 + 2.2) + press * 0.7 * sin(t * 7.3 + 2.0);
  float d = figLeg(p, vec3(-0.08, -0.6, -0.04), vec3(-0.12 + 0.05 * a, -0.14, 0.02), vec3(-0.27 + 0.13 * a, 0.28, 0.0), vec3(-0.17 + 0.17 * a, 0.46, 0.0));
  d = min(d, figLeg(p, vec3(0.08, -0.6, -0.02), vec3(0.24 + 0.04 * b, -0.12, 0.0), vec3(0.1 + 0.14 * b, 0.34, 0.03), vec3(0.2 + 0.18 * b, 0.53, 0.03)));
  return d * 0.85;
}
//@ fluke
// a whale's tail going down, water coming off it; hold and it lifts and flexes
float figFluke(vec3 p, float t, float sing, float press) {
  p.xy = rot(0.05 * sin(t * 0.5)) * p.xy;
  vec3 m = mx(p);
  m.z -= (0.12 + 0.28 * press + 0.08 * sing) * m.x * m.x * (0.8 + 0.2 * sin(t * 1.2));           // the lobes curl forward
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
//@ kraken
// arms from underneath: thick at the water, thin as a whip at the tip, each curling tighter as it goes.
// They lean toward your cursor and coil when you hold.
float figKraken(vec3 p, float t, float sing, float press, vec2 look) {
  float d = 1e3;
  for (int j = 0; j < 3; j++) {
    float fj = float(j), side = fj == 1.0 ? -1.0 : 1.0;
    vec3 a = vec3(fj == 0.0 ? -0.03 : fj == 1.0 ? -0.33 : 0.34, -0.72, fj == 0.0 ? -0.05 : 0.08);
    float L = fj == 0.0 ? 0.24 : 0.17, r = fj == 0.0 ? 0.125 : 0.095, ang = side * -0.14 + look.x * 0.2;
    float curl = side * (0.1 + 0.04 * sin(t * 0.8 + fj * 2.1) + 0.015 * sing + 0.09 * press);
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
//@ serpent
// its whole body, a rope of points dragged along behind your cursor (worked out on the CPU, in the sheet's
// own axes, z up): only the humps and the neck come through. The head is built along the last link.
uniform vec3 uFigTrail[16];
float figSerpent(vec3 p, float t, float sing, float press) {
  float above = p.z - 0.85;
  if (above > 0.2) return above;                                                                 // nothing reaches this high
  float d = 1e3, rPrev = 0.006;
  for (int i = 15; i > 0; i--) {
    float s = float(i - 1) / 15.0;                                                             // 0 the head, 1 the tail
    float r = mix(0.058, 0.098, smoothstep(0.0, 0.22, s)) * (1.0 - 0.94 * smoothstep(0.42, 1.0, s));
    d = min(d, sdLimb(p, uFigTrail[i], uFigTrail[i - 1], rPrev, r));
    rPrev = r;
  }
  vec3 f = normalize(uFigTrail[0] - uFigTrail[1]);
  vec3 r = normalize(cross(f, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0)), u = cross(r, f);
  vec3 o = p - uFigTrail[0];
  if (dot(o, o) > 0.3) return d * 0.85;                                                       // too far for the head to matter
  vec3 q = vec3(dot(o, r), dot(o, u), dot(o, f));                                              // across, up, along the snout
  vec3 m = mx(q);
  float hd = sdEll(q - vec3(0.0, 0.012, 0.06), vec3(0.078, 0.048, 0.125));                     // the skull
  hd = smin(hd, sdEll(q - vec3(0.0, -0.002, 0.17), vec3(0.046, 0.03, 0.075)), 0.025);          // the snout
  hd = smin(hd, sdEll(m - vec3(0.044, 0.042, 0.075), vec3(0.026, 0.018, 0.045)), 0.012);       // the brow
  hd = smin(hd, sdLimb(m, vec3(0.03, 0.045, 0.0), vec3(0.068, 0.15, -0.16), 0.019, 0.003), 0.012);   // the horns, swept back
  float open = clamp(sing * 0.5 + press, 0.0, 1.0) * 0.6;
  vec3 j = q - vec3(0.0, -0.015, -0.02);
  j.yz = rot(open) * j.yz;
  hd = min(hd, sdEll(j - vec3(0.0, -0.016, 0.125), vec3(0.05, 0.016, 0.125)));                 // the jaw
  hollow(length(m - vec3(0.062, 0.026, 0.09)) - 0.012);                                        // the eye
  return min(d, hd) * 0.85;
}
//@ manta
// a ray under the sheet: flat, wide, its wings a wave running out to the tips, the tips breaking the surface.
// Across, up, forward (its frame turns as it swims).
float figManta(vec3 p, float t, float sing, float press) {
  float ax = abs(p.x), u = clamp(ax / 1.0, 0.0, 1.0);
  float amp = 0.1 + 0.05 * sing + 0.2 * press;
  p.y -= amp * sin(t * 2.0 - ax * 2.4) * ax * (0.5 + ax);                                       // the wave, stronger toward the tips
  p.z += 0.09 * ax * sin(t * 2.0 - ax * 2.4 - 1.2);                                             // and they trail behind it
  // the outline: a leading edge sweeping back to the tip, a trailing edge coming in to meet it
  float lead = mix(0.34, -0.26, pow(u, 0.72)), trail = mix(-0.5, -0.31, u);
  float zc = 0.5 * (lead + trail), hc = max(0.5 * (lead - trail), 0.005);
  float zz = clamp((p.z - zc) / hc, -1.0, 1.0);
  float th = (0.012 + 0.11 * (1.0 - u) * (1.0 - u)) * sqrt(max(1.0 - zz * zz, 0.0)) + 0.004;     // thick along the spine, thin at the edges
  float d = max(max(abs(p.y) - th, abs(p.z - zc) - hc), ax - 1.0) * 0.55;
  d = smin(d, sdEll(p - vec3(0.0, 0.03, 0.06), vec3(0.17, 0.072, 0.3)), 0.05);                  // the body
  vec3 m = vec3(ax, p.yz);
  d = smin(d, sdEll(m - vec3(0.14, 0.036, 0.25), vec3(0.03, 0.03, 0.05)), 0.03);                 // the eyes, on the corners of the head
  // the two horns at the front, curled in
  float cv = 0.02 * sin(t * 1.3);
  d = smin(d, sdLimb(m, vec3(0.145, 0.0, 0.3), vec3(0.17, -0.008, 0.42), 0.033, 0.024), 0.03);
  d = smin(d, sdLimb(m, vec3(0.17, -0.008, 0.42), vec3(0.115 + cv, -0.012, 0.53), 0.024, 0.01), 0.015);
  // the tail, a whip
  vec3 b0 = vec3(0.0, 0.0, -0.46), b1 = vec3(0.05 * sin(t * 1.6), 0.0, -0.78), b2 = vec3(0.11 * sin(t * 1.6 - 0.9), 0.0, -1.16);
  d = smin(d, sdLimb(p, b0, b1, 0.024, 0.012), 0.03);
  d = min(d, sdLimb(p, b1, b2, 0.012, 0.003));
  return d * 0.9;
}
//@ wings
// a wing is a hand: the feathers are its fingers, broad and overlapping, fanned from the bone with the long
// ones at the end. Something is going under with them still up. Hold and they sweep forward.
float figWings(vec3 p, float t, float sing, float press) {
  float body = sdEll(p - vec3(0.0, -0.56, -0.04), vec3(0.17, 0.3, 0.13));                       // a back, going down
  vec3 m = mx(p) - vec3(0.05, -0.36, 0.0);
  float flap = 0.12 * sin(t * 0.9) + 0.06 * sing + 0.75 * press;
  m.xz = rot(flap) * m.xz;
  float open = 1.0 + 0.08 * sing + 0.04 * sin(t * 0.9 + 0.8) - 0.16 * press;
  vec3 A = vec3(0.0), B = vec3(0.3, 0.22, -0.02), C = vec3(0.5, 0.5, 0.0);
  float d = sdLimb(m, A, B, 0.085, 0.06);
  d = smin(d, sdLimb(m, B, C, 0.06, 0.04), 0.04);
  for (int i = 0; i < 11; i++) {
    float f = float(i) / 10.0;
    vec3 r = mix(mix(A, B, min(f * 1.8, 1.0)), C, max((f - 0.555) / 0.445, 0.0));                 // where it grows from
    float ang = mix(-0.72, 1.15, pow(f, 1.25)) * open;                                           // out and down near the body, up at the end
    float L = mix(0.3, 0.62, smoothstep(0.0, 0.8, f));
    vec3 dir = vec3(cos(ang), sin(ang), -0.12 - 0.1 * f + 0.1 * f * sin(t * 1.1 + f * 3.0));
    vec3 e = r + dir * L;
    vec3 c = mix(r, e, 0.55) + vec3(-dir.y, dir.x, 0.0) * 0.035;                                 // each one bowed a little
    float fd = min(sdLimb(m, r, c, 0.048, 0.06), sdLimb(m, c, e, 0.06, 0.03));
    fd = max(fd, abs(m.z - mix(r.z, e.z, clamp(dot(m - r, dir) / L, 0.0, 1.0))) - 0.022);        // flat, a blade, not a sausage
    d = smin(d, fd, 0.004);
  }
  return smin(d, body, 0.08) * 0.8;
}
//@ eye
// an eye the size of a balloon, half under: a ball in a socket, an almond of lid, lashes along the top. The
// iris turns to find you, the pupil goes down for ever; it blinks now and then, and when you click.
float figEye(vec3 p, float t, vec2 look, float press) {
  vec3 dir = normalize(vec3(look.x * 0.6, look.y * 0.45, 1.0));
  float ball = length(p) - 0.36;
  float c = dot(p, dir) / max(length(p), 1e-4);
  ball -= 0.016 * smoothstep(0.8, 0.86, c) * (1.0 - smoothstep(0.93, 0.97, c));                 // the iris, standing proud
  float pupil = sdCapsule(p, dir * 0.6, dir * 0.05, 0.095);
  float lid0 = pow(0.5 + 0.5 * sin(t * 0.37 + sin(t * 0.13) * 3.0), 40.0);                       // now and then
  float shut = max(press, lid0);
  // the lids: a shell over the ball, open in an almond that closes
  float W = 0.34, k = clamp(1.0 - (p.x * p.x) / (W * W), 0.0, 1.0);
  float top = mix(0.215, -0.045, shut) * k - 0.02, bot = mix(-0.17, -0.05, shut) * k - 0.02;
  float gap = max(max(p.y - top, bot - p.y), abs(p.x) - W);
  float R = length(p), shell = abs(R - 0.385) - 0.027;
  float lid = smaxF(shell, -gap, 0.012);
  lid = max(lid, -p.z - 0.2);
  float d = smin(ball, lid, 0.006);
  // the brow, a fold above it
  d = smin(d, sdEll(p - vec3(0.0, 0.33, 0.13), vec3(0.42, 0.075, 0.17)), 0.09);
  // lashes, from the edge of the top lid, curling up and out
  vec3 m = mx(p);
  for (int i = 0; i < 4; i++) {
    float f = (float(i) + 0.5) / 4.0;
    float x = f * W * 0.92, y = mix(0.215, -0.045, shut) * (1.0 - x * x / (W * W)) - 0.02;
    vec3 a = vec3(x, y, sqrt(max(0.1482 - x * x - y * y, 0.0)));
    vec3 e = a + vec3(0.045 + f * 0.1, mix(0.15, -0.03, shut), 0.09);
    d = smin(d, sdLimb(m, a, e, 0.012, 0.002), 0.008);
  }
  if (shut < 0.92) hollow(pupil);
  return d * 0.85;
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
  float R = 0.3 * FIGS * FIG * FIGSWIRL, r2 = dot(o, o), k = R * R / (r2 + R * R);
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
  float t = FIGT + 0.6 * gFRow, sing = FIGSING, press = FIGP;
  vec2 look = vec2(FIGLX, FIGLY);
  switch (id) {
${cases}
  }
  return 1e3;
}

` + TAIL;
}
