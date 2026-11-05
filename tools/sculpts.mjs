// What gets baked: solids sculpted out of soft shapes. Each is sdf(x, y, z), lying on its back with +z coming up out of the sheet.
import { smin, smax, ball, ell, limb } from './solid.mjs';

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
  // the neck, going straight down into the sheet
  d = smin(d, ell(x, y + 0.34, z + 0.2, 0.2, 0.2, 0.36), 0.1);
  return d;
}

// What's shipped. Local units are the same as the hand's: about half a unit from the middle to the edge.
//   rest   the shape when it's still; moved  the same with the mouth open and the brow up (the shader mixes them)
const S = 0.92, SINK = 0.05;
const BOX = 0.62;
// nothing reaches the edge of the grid: what's outside it is simply empty
const inGrid = d => (x, y, z) => { const a = Math.abs(x) - BOX * 0.9, b = Math.abs(y) - BOX * 0.9, c = Math.abs(z) - BOX * 0.9, o = Math.max(a, b, c); return smax(d(x, y, z), o > 0 ? Math.hypot(Math.max(a, 0), Math.max(b, 0), Math.max(c, 0)) : o, 0.03); };
const posed = o => inGrid((x, y, z) => head(x / S, y / S, z / S + SINK, o) * S);
export const SOLIDS = {
  face: { box: BOX, nx: 64, n: 128, rest: posed({ sunk: 1, lids: 1 }), moved: posed({ mouth: 0.9, brow: 1, sunk: 1, lids: 1 }) },
};
