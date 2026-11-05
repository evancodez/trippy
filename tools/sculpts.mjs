// The figures, as solids. Each is sdf(x, y, z) in head or body units, posed lying on its back under the sheet.
import { clamp, mix, sstep, smin, smax, ball, ell, limb, rot } from './relief.mjs';

// ------------------------------------------------------------------------------- a head, face up
// Head units: chin at y = -0.5, crown at y = +0.5, the face looks along +z. o: mouth (0 shut … 1 wide),
// sunk (how deep the sockets go), lids (1 shut … 0 no lids, an empty socket), gaunt (0 … 1), brow (lifted)
export function head(x, y, z, o) {
  const m = o.mouth ?? 0, sunk = o.sunk ?? 1, lids = o.lids ?? 1, gaunt = o.gaunt ?? 0, brow = o.brow ?? 0;
  const X = Math.abs(x);
  const drop = m * 0.075;                                  // how far the jaw has dropped
  if (ell(x, y, z, 0.62, 1.05, 0.68) > 0.25) return ell(x, y, z, 0.62, 1.05, 0.68);
  // the skull and the mask of the face
  let d = ell(x, y - 0.1, z + 0.02, 0.352, 0.4, 0.365);
  d = smin(d, ell(x, y + 0.13, z - 0.055, 0.285 - gaunt * 0.02, 0.36, 0.262), 0.1);
  // the jaw and chin come down with the mouth
  const yj = y + drop;
  d = smin(d, ell(X - 0.158 + gaunt * 0.012, yj + 0.3, z - 0.075, 0.112, 0.13, 0.19), 0.08);
  d = smin(d, ell(x, yj + 0.442, z - 0.242, 0.085, 0.058, 0.074), 0.055);
  // temples hollow, cheeks hollow under the bone
  if (gaunt > 0) {
    d = smax(d, -ell(X - 0.31, y - 0.1, z - 0.2, 0.05, 0.1, 0.1), 0.05 + gaunt * 0.02);
    d = smax(d, -ell(X - 0.24, y + 0.185, z - 0.31, 0.09 * gaunt, 0.1 * gaunt, 0.1), 0.09);
  }
  // cheekbones, brow
  d = smin(d, ell(X - 0.215, y + 0.042, z - 0.208, 0.085, 0.05, 0.085), 0.075);
  const yb = y - 0.105 - brow * 0.022;
  d = smin(d, ell(X - 0.108, yb + (X - 0.1) * 0.12, z - 0.292, 0.128, 0.03, 0.05), 0.05);
  d = smin(d, ell(x, yb + 0.012, z - 0.318, 0.04, 0.028, 0.028), 0.04);
  // the sockets, and the eyes lying in them
  const ex = X - 0.126, ey = y - 0.034;
  d = smax(d, -ell(ex, ey, z - 0.37, 0.1, 0.058 + brow * 0.01, 0.075 + 0.06 * sunk), 0.05);
  if (lids > 0.01) {
    d = smin(d, ball(ex, ey + 0.002, z - 0.205 + (1 - lids) * 0.07, 0.072), 0.012);
    // the line where the lids meet: a shallow crease across the eye, curving down at the outer end
    const ly = ey + 0.012 + (ex * ex) * 1.2;
    d = smax(d, -ell(ex, ly, z - 0.278, 0.062, 0.0045, 0.012), 0.006);
  }
  // the nose
  d = smin(d, limb(x, y, z, 0, 0.075, 0.283, 0, -0.115, 0.392, 0.022, 0.033), 0.032);
  d = smin(d, ell(x, y + 0.138, z - 0.398, 0.036, 0.034, 0.036), 0.024);
  d = smin(d, ell(X - 0.047, y + 0.168, z - 0.338, 0.028, 0.024, 0.034), 0.018);
  d = smax(d, -ell(X - 0.023, y + 0.186, z - 0.372, 0.015, 0.0085, 0.03), 0.008);       // nostrils
  // the mouth's mound, the groove under the nose
  d = smin(d, ell(x, y + 0.272, z - 0.228, 0.122, 0.1, 0.085), 0.06);
  d = smax(d, -ell(x, y + 0.222, z - 0.345, 0.0105, 0.03, 0.02), 0.012);
  // the lips
  const yl = y + 0.264;
  d = smin(d, ell(x, yl, z - 0.319, 0.083, 0.018, 0.027), 0.013);
  d = smin(d, ell(X - 0.02, yl - 0.008, z - 0.327, 0.028, 0.012, 0.017), 0.009);
  const yk = y + 0.314 + drop * 1.15;
  d = smin(d, ell(x, yk, z - 0.316 + drop * 0.25, 0.066 + m * 0.004, 0.025, 0.029), 0.013);
  // between them: a line when shut, a dark hole going down when open
  const my = y + 0.287 + drop * 0.55, mw = 0.086 - m * 0.012, mh = 0.003 + m * 0.052;
  d = smax(d, -ell(x, my, z - 0.335, mw, mh, 0.03 + m * 0.2), 0.005 + m * 0.012);
  d = smax(d, -ell(X - 0.094, y + 0.289 + drop * 0.5, z - 0.3, 0.012, 0.012, 0.022), 0.012);   // the corners
  d = smax(d, -ell(x, yk + 0.05, z - 0.335 + drop * 0.25, 0.066, 0.012, 0.02), 0.028);          // under the lower lip
  // the folds from nose to mouth
  d = smax(d, -limb(X, y, z, 0.07, -0.175, 0.335, 0.115, -0.285, 0.305, 0.0065), 0.018);
  // an ear each side (mostly under the sheet)
  d = smin(d, ell(X - 0.352, y + 0.02, z - 0.01, 0.024, 0.085, 0.055), 0.02);
  // the neck, going away beyond the chin
  d = smin(d, ell(x, y + 0.66, z + 0.07, 0.185, 0.32, 0.19), 0.09);
  return d;
}

// A head placed in figure space, with a turn: s how big, pitch chin-up, yaw and roll, sink how far it's under
const placedHead = (o, { s = 1.35, cy = 0.12, sink = 0.08, pitch = 0, yaw = 0, roll = 0 } = {}) => (x, y, z) => {
  let X = x / s, Y = (y - cy * s) / s, Z = z / s + sink;
  [X, Y] = rot(X, Y, -roll);
  [X, Z] = rot(X, Z, -yaw);
  [Y, Z] = rot(Y, Z, -pitch);
  return head(X, Y, Z, o) * s;
};

// ------------------------------------------------------------------------------- a skull, face up
export function skull(x, y, z, o) {
  const X = Math.abs(x), jaw = o.jaw ?? 0, drop = jaw * 0.13;
  if (ell(x, y, z, 0.62, 1.0, 0.68) > 0.25) return ell(x, y, z, 0.62, 1.0, 0.68);
  let d = ell(x, y - 0.13, z + 0.03, 0.352, 0.385, 0.37);                         // the dome
  d = smin(d, ell(x, y + 0.1, z - 0.085, 0.235, 0.215, 0.215), 0.07);             // the face
  d = smin(d, ell(X - 0.118, y - 0.052 + (X - 0.1) * 0.25, z - 0.285, 0.122, 0.034, 0.052), 0.04);   // the brow
  d = smin(d, ell(x, y - 0.03, z - 0.3, 0.05, 0.03, 0.03), 0.03);
  d = smin(d, ell(X - 0.222, y + 0.085, z - 0.165, 0.07, 0.046, 0.075), 0.04);    // the cheekbone
  d = smin(d, limb(X, y, z, 0.27, -0.085, 0.13, 0.335, -0.06, -0.06, 0.024, 0.018), 0.025);   // and its arch, going back
  d = smax(d, -ell(X - 0.345, y - 0.02, z - 0.12, 0.072, 0.1, 0.16), 0.05);       // hollow at the temple
  d = smax(d, -ell(X - 0.205, y + 0.2, z - 0.2, 0.06, 0.065, 0.13), 0.04);        // hollow under the cheek
  // the holes
  const ox = X - 0.122, oy = y + 0.032 + (X - 0.122) * 0.1;
  d = smax(d, -ell(ox, oy, z - 0.33, 0.092, 0.08, 0.2), 0.022);
  d = smax(d, -ell(X - 0.02, y + 0.158 - X * 0.5, z - 0.31, 0.032, 0.066, 0.15), 0.012);
  d = smin(d, limb(x, y, z, 0, -0.1, 0.29, 0, -0.195, 0.3, 0.008), 0.008);        // the bone between the nostrils
  // the upper jaw and its teeth, on a curve
  d = smin(d, ell(x, y + 0.235, z - 0.195, 0.115, 0.05, 0.085), 0.03);
  const tooth = (px, py, pz, r) => {
    const n = 0.0355, i = Math.round(px / n), tx = px - i * n;
    const tz = pz + 0.0042 * i * i;
    return i > 6 ? 1 : ell(tx, py, tz, 0.0155, r, 0.018);
  };
  d = smin(d, tooth(X, y + 0.282, z - 0.262, 0.029), 0.0045);
  // the lower jaw: a U, its chin, and teeth; it comes down
  const yj = y + drop, zj = z + drop * 0.35;
  let m = ell(x, yj + 0.46, zj - 0.17, 0.11, 0.062, 0.075);
  m = smin(m, limb(X, yj, zj, 0.055, -0.44, 0.19, 0.205, -0.36, 0.02, 0.046, 0.042), 0.04);
  m = smin(m, limb(X, yj, zj, 0.205, -0.36, 0.02, 0.245, -0.14, -0.05, 0.042, 0.036), 0.03);
  m = smin(m, tooth(X, yj + 0.348, zj - 0.238, 0.026), 0.0045);
  d = smin(d, m, 0.006);
  return d;
}

// ------------------------------------------------------------------------------- a whole body, on its back
// Body units: about 2 long, head at +y. Hands folded on the chest; o.breath lifts the ribs, o.knee a knee.
export function body(x, y, z, o) {
  const X = Math.abs(x), b = o.breath ?? 0, k = o.knee ?? 0;
  if (ell(x, y, z, 0.66, 1.15, 0.55) > 0.2) return ell(x, y, z, 0.66, 1.15, 0.55);
  const s = 0.3;                                                       // the head
  let d = head(x / s, (y - 0.735) / s, z / s - 0.12, { sunk: 0.6, lids: 1, gaunt: 0.1 }) * s;
  d = smin(d, limb(x, y, z, 0, 0.62, 0.03, 0, 0.5, 0.03, 0.075, 0.09), 0.05);       // neck
  d = smin(d, ell(x, y - 0.41, z - 0.03, 0.285, 0.085, 0.105), 0.08);               // shoulders
  d = smin(d, ell(x, y - 0.23, z - 0.035 - b * 0.018, 0.235, 0.22, 0.17 + b * 0.02), 0.12);   // the chest
  d = smin(d, ell(x, y - 0.0, z - 0.02, 0.19, 0.2, 0.125), 0.12);                   // the belly
  d = smin(d, ell(x, y + 0.2, z - 0.02, 0.225, 0.15, 0.135), 0.12);                 // the hips
  // the arms, close in, and the forearms folded on the belly
  d = smin(d, limb(X, y, z, 0.285, 0.39, 0.03, 0.315, 0.13, 0.05, 0.07, 0.056), 0.05);
  d = smin(d, limb(X, y, z, 0.315, 0.13, 0.05, 0.1, 0.07, 0.165, 0.056, 0.043), 0.05);
  d = smin(d, ell(x - 0.02, y - 0.055, z - 0.185, 0.082, 0.05, 0.03), 0.03);        // one hand
  d = smin(d, ell(x + 0.035, y - 0.1, z - 0.19, 0.082, 0.05, 0.03), 0.03);          // on the other
  // the legs: one straight, one a little raised at the knee
  const kn = x < 0 ? k : 0;
  d = smin(d, limb(X, y, z, 0.115, -0.28, 0.03, 0.13, -0.57, 0.05 + kn * 0.14, 0.125, 0.075), 0.07);
  d = smin(d, ball(X - 0.13, y + 0.585, z - 0.062 - kn * 0.14, 0.078), 0.03);       // the knees
  d = smin(d, limb(X, y, z, 0.13, -0.6, 0.05 + kn * 0.14, 0.135, -0.88, 0.02, 0.07, 0.048), 0.04);
  d = smin(d, limb(X, y, z, 0.135, -0.9, 0.03, 0.17, -0.95, 0.15, 0.06, 0.05), 0.05);   // the feet, toes up
  return d;
}

// ------------------------------------------------------------------------------- a heart
// Anatomical: o.squeeze 0 full … 1 clenched
export function heart(x, y, z, o) {
  const q = o.squeeze ?? 0;
  if (ell(x, y, z, 1.0, 1.1, 0.75) > 0.2) return ell(x, y, z, 1.0, 1.1, 0.75);
  const sq = 1 - q * 0.1;
  let [u, v] = rot(x - 0.03, y + 0.24, 0.5);
  let d = ell(u, v, z, 0.36 * sq, 0.5 * sq, 0.33 * sq);                         // the left ventricle, its point down and left
  const [u2, v2] = rot(x + 0.13, y + 0.1, 0.22);
  d = smin(d, ell(u2, v2, z - 0.06, 0.31 * sq, 0.41 * sq, 0.27 * sq), 0.1);     // the right
  d = smax(d, -limb(x, y, z, -0.09, 0.2, 0.36, 0.19, -0.56, 0.3, 0.012), 0.05);   // the groove between them
  d = smin(d, ball(x + 0.29, y - 0.22, z + 0.0, 0.2 + q * 0.012), 0.08);        // the right atrium
  d = smin(d, ball(x - 0.27, y - 0.23, z + 0.08, 0.165 + q * 0.012), 0.07);     // the left, behind
  // the aorta: up, over, and away; three vessels off the top of the arch
  const tube = (pts, r0, r1) => { let t = 1e3; for (let i = 0; i + 1 < pts.length; i++) { const f = i / (pts.length - 1), g = (i + 1) / (pts.length - 1), a = pts[i], b = pts[i + 1]; t = smin(t, limb(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r0 + (r1 - r0) * f, r0 + (r1 - r0) * g), 0.025); } return t; };
  d = smin(d, tube([[0.03, 0.14, 0.1], [0.0, 0.42, 0.1], [0.05, 0.6, 0.06], [0.2, 0.68, 0.0], [0.36, 0.6, -0.08], [0.42, 0.38, -0.16]], 0.098, 0.074), 0.05);
  d = smin(d, tube([[0.02, 0.62, 0.05], [-0.03, 0.8, 0.03], [-0.05, 0.95, 0.0]], 0.042, 0.03), 0.02);
  d = smin(d, tube([[0.15, 0.68, 0.02], [0.15, 0.84, 0.0], [0.17, 0.97, -0.03]], 0.038, 0.027), 0.02);
  d = smin(d, tube([[0.29, 0.65, -0.03], [0.34, 0.8, -0.05], [0.38, 0.93, -0.07]], 0.035, 0.025), 0.02);
  d = smin(d, tube([[-0.11, 0.1, 0.2], [-0.13, 0.36, 0.2], [-0.24, 0.5, 0.12], [-0.46, 0.55, 0.02], [-0.66, 0.52, -0.05]], 0.092, 0.05), 0.04);   // the pulmonary trunk across the front
  d = smin(d, tube([[-0.33, 0.28, -0.03], [-0.36, 0.56, -0.08], [-0.37, 0.86, -0.12]], 0.076, 0.06), 0.03);   // the vena cava
  return d;
}
// the vessels lying on it, as ridges added to its height
const line2 = (x, y, ax, ay, bx, by) => { const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay, t = clamp((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1), qx = px - dx * t, qy = py - dy * t; return Math.sqrt(qx * qx + qy * qy); };
const path2 = (x, y, P, w0, w1) => { let h = 0; for (let i = 0; i + 1 < P.length; i++) { const f = (i + 0.5) / (P.length - 1), w = w0 + (w1 - w0) * f, l = line2(x, y, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]); h = Math.max(h, Math.exp(-(l * l) / (w * w))); } return h; };
const CORONARY = [
  [[[-0.02, 0.1], [0.08, -0.12], [0.16, -0.36], [0.19, -0.56]], 0.022, 0.012],
  [[[0.08, -0.12], [0.26, -0.2], [0.34, -0.38]], 0.016, 0.009],
  [[[0.16, -0.36], [0.05, -0.5], [0.0, -0.58]], 0.014, 0.008],
  [[[-0.12, 0.08], [-0.2, -0.1], [-0.2, -0.32], [-0.08, -0.48]], 0.018, 0.009],
  [[[-0.2, -0.1], [-0.33, -0.16], [-0.38, -0.3]], 0.013, 0.008],
];

// ------------------------------------------------------------------------------- a rib cage, and the spine under it
export function ribcage(x, y, z, o) {
  const X = Math.abs(x), b = o.breath ?? 0;
  if (ell(x, y, z, 0.9, 1.15, 0.6) > 0.2) return ell(x, y, z, 0.9, 1.15, 0.6);
  let d = 1e3;
  // the ribs: hoops that leave the breastbone and fall away as they go round
  const N = 11;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const y0 = 0.62 - f * 1.22;
    const R = (0.36 + 0.34 * Math.sin(Math.min(f * 1.25 + 0.1, 1) * Math.PI * 0.62)) * (1 + b * 0.06);
    const py = y - y0 + X * (0.42 + f * 0.25) - (X > 0 ? 0 : 0);
    const r = Math.sqrt(X * X + (z * 1.25) * (z * 1.25));
    const wob = 0.034 - f * 0.009;
    d = smin(d, Math.sqrt((r - R) * (r - R) + py * py * 1.15) - wob, 0.016);
  }
  // cut away what's behind: they only press up from the front
  d = Math.max(d, -z - 0.28);
  // the breastbone, between the upper ribs
  d = smin(d, ell(x, y - 0.32, z - 0.455 - b * 0.03, 0.058, 0.38, 0.036), 0.05);
  d = smin(d, ell(x, y - 0.68, z - 0.42, 0.095, 0.05, 0.035), 0.03);
  // the collarbones
  d = smin(d, limb(X, y, z, 0.07, 0.73, 0.4, 0.52, 0.84, 0.13, 0.03, 0.026), 0.03);
  // what lies under: a soft chest to keep the ribs apart, and the spine showing below them
  d = smin(d, ell(x, y - 0.1, z + 0.12, 0.5 + b * 0.02, 0.72, 0.34 + b * 0.03), 0.06);
  for (let i = 0; i < 7; i++) {
    const yy = -0.5 - i * 0.082;
    d = smin(d, ell(x, y - yy, z - 0.14, 0.058, 0.032, 0.05), 0.022);
    d = smin(d, ell(X - 0.06, y - yy, z - 0.09, 0.05, 0.016, 0.03), 0.018);
  }
  return d;
}

// ------------------------------------------------------------------------------- an octopus, from above
const KRAKEN_ARMS = (() => {
  const arms = [];
  for (let a = 0; a < 8; a++) {
    const base = (a + 0.5) / 8 * Math.PI * 2 + Math.PI * 0.5;
    const curl = (a % 2 ? 1 : -1) * (0.55 + 0.3 * Math.sin(a * 2.3)), P = [];
    const L = 0.82 + 0.1 * Math.sin(a * 1.7 + 0.4);
    for (let i = 0; i <= 16; i++) {
      const s = i / 16, th = base + curl * (s * s * 1.5 + 0.35 * Math.sin(s * 6.5 + a) * s);
      const r = 0.14 + L * s;
      const w = 0.112 * Math.pow(1 - s, 1.1) + 0.018;
      P.push([r * Math.cos(th), r * Math.sin(th) - 0.04, 0.09 * (1 - s) * (1 - s) + w * 0.55 + 0.018 * Math.sin(s * 6 + a) * s, w]);
    }
    arms.push(P);
  }
  return arms;
})();
export function kraken(x, y, z, o) {
  let d = ell(x, y - 0.245, z - 0.09, 0.225, 0.36, 0.29);                        // the mantle
  d = smin(d, ell(x, y + 0.04, z - 0.07, 0.19, 0.165, 0.19), 0.09);              // the head
  const X = Math.abs(x);
  d = smin(d, ball(X - 0.14, y + 0.03, z - 0.2, 0.05), 0.03);                    // the eyes
  d = smax(d, -ell(X - 0.152, y + 0.035, z - 0.25, 0.032, 0.0105, 0.018), 0.008);
  for (const P of KRAKEN_ARMS) {
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1];
      d = smin(d, limb(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], a[3], b[3]), 0.016 + 0.03 * a[3] / 0.1);
    }
  }
  return d;
}

// ------------------------------------------------------------------------------- a manta ray, nose at +y
const polyD = (x, y, P) => {                                                     // signed distance to a closed polygon (< 0 inside)
  let d = 1e9, sign = 1;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], wx = x - P[i][0], wy = y - P[i][1];
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = y >= P[i][1], c2 = y < P[j][1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sign = -sign;
  }
  return sign * Math.sqrt(d);
};
// half the outline: from the nose along the leading edge to the tip, back along the trailing edge
const WING = [[0, 0.52], [0.2, 0.47], [0.42, 0.33], [0.68, 0.14], [0.97, -0.06], [0.72, -0.1], [0.46, -0.2], [0.27, -0.36], [0.13, -0.5], [0, -0.52], [-0.2, -0.3], [-0.2, 0.3]];
export const mantaH = (x, y, o) => {
  const X = Math.abs(x), flap = o.flap ?? 0;
  const e = -polyD(X, y, WING);                                                  // how far inside the outline
  const thick = 0.165 * Math.exp(-((X / 0.27) ** 2)) + 0.04 * (1 - X);           // thick down the middle, thin at the tip
  let h = e > 0 ? thick * Math.sqrt(clamp(e / 0.09, 0, 1)) : -0.1;
  // the horns, the ridge and eyes on top, the tail behind
  const horn = line2(X, y, 0.125, 0.45, 0.135, 0.76);
  h = Math.max(h, 0.07 * Math.sqrt(Math.max(1 - (horn / (0.052 - 0.1 * Math.max(y - 0.45, 0))) ** 2, 0)) - 0.0);
  const tail = line2(x, y, 0, -0.45, 0, -0.98);
  h = Math.max(h, 0.05 * Math.exp(-((tail / (0.024 - (Math.max(-y - 0.45, 0)) * 0.03)) ** 2)));
  if (e > 0) {
    h += 0.018 * Math.exp(-((x / 0.015) ** 2)) * sstep(0.28, 0.18, Math.abs(y + 0.1));
    h += 0.05 * Math.exp(-(((X - 0.15) ** 2 + (y - 0.36) ** 2) / 0.0009));
    for (let i = 0; i < 5; i++) h -= 0.014 * Math.exp(-((line2(X, y, 0.065, 0.14 - i * 0.052, 0.145, 0.15 - i * 0.05)) ** 2) / 0.00005);
    // and the long folds across the wing
    h += 0.006 * Math.sin(Math.atan2(y - 0.1, X) * 26) * sstep(0.2, 0.42, X) * sstep(0, 0.06, e);
  }
  return h + flap * 0.32 * Math.max(X - 0.12, 0) * Math.max(X - 0.12, 0) * (e > -0.15 ? 1 : 0);
};

// ------------------------------------------------------------------------------- a moth, wings flat, head at +y
const wingVeins = (X, y) => {
  let h = 0;
  for (let i = 0; i < 7; i++) {
    const a = 0.3 + i * 0.235;                                                   // fore wing, fanning from the root
    const ex = 0.1 + Math.cos(a - 0.25) * 0.86, ey = 0.1 + Math.sin(a - 0.25) * 0.72 * (a > 1.2 ? 0.75 : 1);
    h = Math.max(h, Math.exp(-(line2(X, y, 0.08, 0.14, ex, ey) ** 2) / 0.00009));
  }
  for (let i = 0; i < 5; i++) {
    const a = -0.3 - i * 0.27;
    h = Math.max(h, Math.exp(-(line2(X, y, 0.07, -0.1, 0.07 + Math.cos(a) * 0.62, -0.1 + Math.sin(a) * 0.62) ** 2) / 0.00008));
  }
  return h;
};
export function moth(x, y, z, o) {
  const X = Math.abs(x), beat = o.beat ?? 0;
  const lift = beat * (X * X * 0.7);
  const zw = z - lift;
  let d = ell(x, y - 0.14, z - 0.1, 0.085, 0.11, 0.09);                          // the thorax
  d = smin(d, ball(x, y - 0.27, z - 0.08, 0.05), 0.02);                          // the head
  d = smin(d, ball(X - 0.038, y - 0.298, z - 0.105, 0.021), 0.006);              // its eyes
  for (let i = 0; i < 7; i++) {                                                  // the ringed body
    const f = i / 6, yy = 0.02 - f * 0.52, r = 0.076 * (1 - f * f * 0.75) + 0.008;
    d = smin(d, ell(x, y - yy, z - 0.07, r, 0.05, r * 0.9), 0.012);
  }
  // the feelers: a feather each side
  d = smin(d, limb(X, y, z, 0.022, 0.31, 0.1, 0.25, 0.62, 0.05, 0.0085, 0.004), 0.008);
  for (let i = 1; i < 11; i++) {
    const f = i / 11, ax = 0.022 + 0.228 * f, ay = 0.31 + 0.31 * f;
    const l = 0.05 * Math.sin(f * Math.PI);
    d = smin(d, limb(X, y, z, ax, ay, 0.09 - f * 0.04, ax + l * 0.9, ay - l * 0.15, 0.08 - f * 0.04, 0.0035), 0.002);
    d = smin(d, limb(X, y, z, ax, ay, 0.09 - f * 0.04, ax - l * 0.3, ay + l, 0.08 - f * 0.04, 0.0035), 0.002);
  }
  // the wings: thin, soft-edged plates
  let [u, v] = rot(X - 0.48, y - 0.22, -0.2);
  const fore = ell(u, v, zw - 0.045, 0.47, 0.235 - 0.09 * clamp(u / 0.47, -1, 1), 0.032);
  [u, v] = rot(X - 0.33, y + 0.16, 0.42);
  const hind = ell(u, v, zw - 0.018, 0.34, 0.255 - 0.05 * clamp(u / 0.34, -1, 1), 0.03);
  d = smin(d, smin(fore, hind, 0.012), 0.028);
  return d;
}
// the moth's wings carry a raised vein pattern and eye spots
const mothDetail = (x, y, h) => {
  const X = Math.abs(x);
  if (X < 0.08 || h < 0.01) return h;
  let e = wingVeins(X, y) * 0.018;
  const ring = (cx, cy, r, w, a) => { const l = Math.hypot(X - cx, y - cy); return a * Math.exp(-((l - r) ** 2) / (w * w)); };
  e += ring(0.6, 0.27, 0.078, 0.016, 0.045) + ring(0.6, 0.27, 0.0, 0.03, -0.035);
  e += ring(0.42, -0.26, 0.095, 0.02, 0.05) + ring(0.42, -0.26, 0.0, 0.04, -0.04);
  return h + e;
};

// ------------------------------------------------------------------------------- an ammonite: its height, straight
const ammonite = (x, y) => {
  const r = Math.hypot(x, y), th = Math.atan2(y, x);
  const a = 0.018, b = 0.0985;                                                   // r = a·e^(b·θ)
  const Tmax = Math.log(0.97 / a) / b - Math.PI * 2;                             // where the last coil ends
  const u = Math.log(Math.max(r, 0.002) / a) / b / (Math.PI * 2) - th / (Math.PI * 2);
  const n = Math.floor(u), f = u - n;
  const total = n * Math.PI * 2 + th;
  if (total > Tmax) return -0.12;
  const rIn = a * Math.exp(b * total), rOut = a * Math.exp(b * (total + Math.PI * 2)), w = rOut - rIn;
  const c = (r - (rIn + rOut) / 2) / (w * 0.5);                                  // -1 … 1 across this coil
  const dome = Math.sqrt(Math.max(1 - c * c, 0));
  // ribs across the coil, swept forward at the outer edge, splitting toward the outside
  const k = total * 4.6 + 1.1 * c * c - c * 0.6;
  const rib = Math.pow(0.5 + 0.5 * Math.cos(k), 1.4);
  const R = w * 0.5, flare = 1 + 0.1 * rib * sstep(-0.8, 0.2, c);
  return (R * 0.78 * Math.pow(dome, 0.8) + R * 0.1 * rib * dome) * flare + 0.012;
};

// ------------------------------------------------------------------------------- an eye, lying open, looking up
const eyeH = (x, y, o) => {
  const open = o.open ?? 1;
  const X = x;
  const R = 0.82, r2 = x * x + y * y;
  const ballZ = Math.sqrt(Math.max(R * R - r2 * 1.15, 0)) - R * 0.5;              // the ball under everything
  // the opening: an almond, with a fall at the outer corner
  const w = 0.68, s = clamp(1 - (X * X) / (w * w), 0, 1);
  const top = 0.31 * open * Math.pow(s, 0.8) + (-0.012 * (1 - s)) , bot = -0.2 * open * Math.pow(s, 0.9) - 0.012;
  const yy = y + X * 0.06 + 0.02;
  const inA = sstep(0.018, -0.018, yy - top) * sstep(-0.018, 0.018, yy - bot) * (Math.abs(X) < w ? 1 : 0);
  // lids: a thick fold standing proud of the ball
  const dTop = yy - top, dBot = bot - yy;
  const lidThick = 0.05;
  const lidT = Math.exp(-Math.pow((dTop - 0.03) / 0.055, 2)) * (dTop > -0.03 ? 1 : 0.2);
  const lidB = Math.exp(-Math.pow((dBot - 0.024) / 0.04, 2)) * (dBot > -0.03 ? 1 : 0.2);
  // the crease over the upper lid, the skin round it
  const crease = Math.exp(-Math.pow((dTop - 0.17) / 0.024, 2)) * sstep(1, 0.6, Math.abs(X) / w);
  const brow = 0.1 * Math.exp(-Math.pow((yy - 0.62 - 0.14 * (1 - X * X)) / 0.11, 2)) * sstep(1.0, 0.55, Math.abs(X));
  const skin = ballZ + lidThick + 0.035 * lidT + 0.03 * lidB - 0.022 * crease + brow;
  // the iris, a shallow bowl with fine spokes, and the deep hole in the middle of it
  const ix = x, iy = y - 0.03, ir = Math.hypot(ix, iy), ang = Math.atan2(iy, ix);
  const IR = 0.235;
  const limbal = Math.exp(-Math.pow((ir - IR) / 0.012, 2));
  const inside = sstep(IR + 0.006, IR - 0.006, ir);
  const spokes = (0.5 + 0.5 * Math.sin(ang * 42 + 3 * Math.sin(ang * 5))) * sstep(0.07, 0.11, ir);
  const pupil = sstep(0.085, 0.07, ir);
  const iris = -0.025 * inside - 0.012 * limbal + 0.009 * inside * spokes - 0.16 * pupil;
  const eye = ballZ + 0.022 + iris;
  return mix(skin, eye, inA);
};

// ------------------------------------------------------------------------------- the lovers: two heads, nose to nose
const lovers = o => {
  const near = o.near ?? 0, s = 0.86;
  return (x, y, z) => {
    const place = (side) => {
      const gap = 0.3 - near * 0.03;
      let X = (x - side * gap * s * 1.28) / s, Y = (y - 0.06 + side * 0.03) / s, Z = z / s + 0.06;
      [X, Y] = rot(X, Y, side * 0.2 - near * side * 0.02);
      [X, Z] = rot(X, Z, side * -0.5);                 // turned toward each other
      [Y, Z] = rot(Y, Z, -0.08);
      return head(X, Y, Z, { sunk: 0.9, lids: 1, gaunt: 0.15 }) * s;
    };
    return smin(place(1), place(-1), 0.03);
  };
};

// Each: make(o) gives the solid, or height(x, y, o) the surface straight; drape how the sheet sits on it;
// shapes the poses baked as blend shapes (at most four); detail(x, y, h) anything added on top.
export const SCULPTS = {
  // flat on its back, a little turned, eyes shut and sunk, just under the skin of the sheet
  sleeper: {
    make: o => placedHead({ sunk: 1, lids: 1, gaunt: 0.25, ...o }, { s: 1.34, cy: 0.1, sink: 0.04, pitch: 0.1, yaw: -0.12, roll: 0.07 }),
    drape: { suction: 10, bed: 30 },
    shapes: { mouth: { mouth: 0.75 }, wake: { lids: 0.72, brow: 1 } },
  },
  // chin up, eyes gone, mouth a hole going down
  cry: {
    make: o => placedHead({ sunk: 1.5, lids: 0, gaunt: 0.75, mouth: 0.55, ...o }, { s: 1.36, cy: 0.1, sink: 0.05, pitch: 0.22, yaw: 0.1, roll: -0.05 }),
    drape: { suction: 16, bed: 34 },
    shapes: { mouth: { mouth: 1.05 }, brow: { brow: 1.4 } },
  },
  skull: {
    make: o => { const s = 1.42; return (x, y, z) => { let X = x / s, Y = (y - 0.06) / s, Z = z / s + 0.05; [X, Y] = rot(X, Y, 0.05); [X, Z] = rot(X, Z, 0.1); [Y, Z] = rot(Y, Z, -0.1); return skull(X, Y, Z, o) * s; }; },
    drape: { suction: 30, bed: 40 },
    shapes: { jaw: { jaw: 1 } },
  },
  veil: {
    fit: 0.86,
    make: o => (x, y, z) => { const [X, Y] = rot(x, y, Math.PI / 2 - 0.05); return body(X, Y + 0.02, z * 0.62 + 0.0, o) * 0.62; },   // across the view: a range of hills that turns out to be someone
    drape: { suction: 2.5, bed: 18, reach: 0.14 },
    shapes: { breath: { breath: 1 }, knee: { knee: 1 } },
  },
  lovers: {
    make: lovers,
    drape: { suction: 7, bed: 30 },
    shapes: { near: { near: 1 } },
  },
  heart: {
    fit: 0.88,
    make: o => { const s = 0.98; return (x, y, z) => heart(x / s, (y + 0.02) / s, z / s + 0.03, o) * s; },
    detail: (x, y, h) => { if (h < 0.03) return h; let e = 0; for (const [P, a, b] of CORONARY) e = Math.max(e, path2(x, y, P, a, b)); return h + e * 0.022; },
    drape: { suction: 16, bed: 34 },
    shapes: { squeeze: { squeeze: 1 } },
  },
  ribs: {
    fit: 0.92,
    make: o => { const s = 0.8; return (x, y, z) => ribcage(x / s, (y + 0.03) / s, z / s + 0.16, o) * s; },
    drape: { suction: 26, bed: 36 },
    shapes: { breath: { breath: 1 } },
  },
  kraken: {
    fit: 0.86,
    make: o => { const s = 0.98; return (x, y, z) => kraken(x / s, y / s, z / s + 0.03, o) * s; },
    drape: { suction: 16, bed: 44 },
  },
  manta: {
    fit: 0.86,
    height: mantaH,
    drape: { suction: 8, bed: 44 },
    shapes: { flap: { flap: 1 } },
  },
  moth: {
    fit: 0.88,
    make: o => { const s = 1.05; return (x, y, z) => moth(x / s, (y + 0.02) / s, z / s, o) * s; },
    detail: mothDetail,
    drape: { suction: 14, bed: 60 },
    shapes: { beat: { beat: 1 } },
  },
  ammonite: {
    fit: 0.84,
    height: (x, y) => ammonite(x, y),
    drape: { suction: 40, bed: 50 },
  },
  eye: {
    fit: 0.86,
    height: (x, y, o) => eyeH(x, y, o),
    drape: { suction: 26, bed: 42 },
    shapes: { blink: { open: 0.02 } },
  },
};
