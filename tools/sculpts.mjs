// What gets baked: solids sculpted out of soft shapes. Each is sdf(x, y, z), lying on its back with +z coming up out of the sheet.
import { clamp, smax, ell } from './solid.mjs';

// The face: a mask lying in the sheet rather than a head on top of it. z = 0 is the sheet: brow, nose, cheekbones,
// lips and chin stand above it, and the sockets, temples, hollow cheeks and the mouth go below. All soft swellings
// and hollows. Chin toward -y, crown toward +y, looking along +z.
const g2 = (x, y, cx, cy, sx, sy) => { const a = (x - cx) / sx, b = (y - cy) / sy; return Math.exp(-(a * a + b * b)); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function faceHeight(x, y, m) {
  const X = Math.abs(x);
  // the outline: wide at the temples, in at the jaw, a narrow chin; not an egg
  const wx = 0.168 + 0.062 * sstep(-0.3, -0.02, y) - 0.012 * sstep(0.12, 0.34, y);
  const r2 = (x / wx) ** 2 + ((y - 0.005) / 0.345) ** 2;
  // only a shallow curve across it, with the forehead lying back into the sheet
  let h = r2 < 1 ? 0.062 * Math.sqrt(1 - r2) - 0.012 : -0.012 - (Math.sqrt(r2) - 1) * 0.8;
  h -= 0.04 * sstep(0.12, 0.34, y);
  h += 0.032 * g2(X, y, 0.095, 0.098, 0.1, 0.03);                 // the brow
  h -= 0.1 * g2(X, y, 0.108, 0.03, 0.068, 0.042);                 // the sockets, down below the sheet
  h += 0.042 * g2(X, y, 0.108, 0.026, 0.045, 0.022);              // a shut eye lying in each
  h -= 0.012 * g2(X, y - (X - 0.108) ** 2 * 1.5, 0.108, 0.02, 0.05, 0.005);   // where the lids meet
  h += 0.078 * g2(x, y, 0, 0.0, 0.021, 0.09);                     // the nose, a long straight line
  h += 0.06 * g2(x, y, 0, -0.092, 0.036, 0.03);                   // its tip
  h += 0.026 * g2(X, y, 0.034, -0.102, 0.022, 0.018);             // its wings
  h += 0.036 * g2(X, y, 0.15, -0.05, 0.062, 0.04);                // the cheekbones
  h -= 0.06 * g2(X, y, 0.145, -0.165, 0.055, 0.07);               // the hollow under them
  h -= 0.05 * g2(X, y, 0.205, 0.075, 0.04, 0.09);                 // the temples
  h += 0.022 * g2(x, y, 0, -0.18, 0.085, 0.05);                   // the mouth's mound
  h -= 0.008 * g2(x, y, 0, -0.135, 0.012, 0.025);                 // the groove above the lip
  h -= (0.03 + 0.07 * m) * g2(x, y + 0.012 * m, 0, -0.191, 0.075 - 0.01 * m, 0.006 + 0.036 * m);   // between the lips, going down when it opens
  h += 0.03 * g2(X, y, 0.022, -0.176 + 0.008 * m, 0.05, 0.014);   // the upper lip, two curves
  h += 0.032 * g2(x, y, 0, -0.209 - 0.03 * m, 0.058, 0.017);      // the lower
  h -= 0.014 * g2(x, y + 0.03 * m, 0, -0.238, 0.05, 0.012);       // under it
  h += 0.042 * g2(x, y + 0.012 * m, 0, -0.288, 0.066, 0.042);     // the chin
  return h * 1.3 + 0.022;          // and all of it taller, so more stands clear
}
export function face(x, y, z, { mouth = 0 } = {}) {
  const e = 0.003, H = faceHeight(x, y, mouth);
  const gx = (faceHeight(x + e, y, mouth) - faceHeight(x - e, y, mouth)) / (2 * e), gy = (faceHeight(x, y + e, mouth) - faceHeight(x, y - e, mouth)) / (2 * e);
  return smax((z - H) / Math.sqrt(1 + gx * gx + gy * gy), -(z + 0.2), 0.02);
}

// What's shipped. Local units are the same as the hand's: about half a unit from the middle to the edge.
//   rest   the shape when it's still; moved  the same with the mouth open (the shader mixes them)
const K = 1.39;        // the same size in the frame as the hand's other solids
const BOX = 0.62;
// nothing reaches the edge of the grid: what's outside it is simply empty
const inGrid = d => (x, y, z) => { const a = Math.abs(x) - BOX * 0.9, b = Math.abs(y) - BOX * 0.9, c = Math.abs(z) - BOX * 0.9, o = Math.max(a, b, c); return smax(d(x, y, z), o > 0 ? Math.hypot(Math.max(a, 0), Math.max(b, 0), Math.max(c, 0)) : o, 0.03); };
const posed = o => inGrid((x, y, z) => face(x / K, y / K, z / K, o) * K);
export const SOLIDS = {
  face: { box: BOX, nx: 64, n: 128, rest: posed({ mouth: 0 }), moved: posed({ mouth: 1 }) },
};
