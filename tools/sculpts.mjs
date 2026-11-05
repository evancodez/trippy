// What gets baked: solids sculpted out of soft shapes. Each is sdf(x, y, z), lying on its back with +z coming up out of the sheet.
import { clamp, smax, ell } from './solid.mjs';

// The face: a plain egg of a head, and the features as soft swellings and hollows pushed out of its front.
// Chin toward -y, crown toward +y, looking along +z, its back under the sheet.
const g2 = (x, y, cx, cy, sx, sy) => { const a = (x - cx) / sx, b = (y - cy) / sy; return Math.exp(-(a * a + b * b)); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function features(x, y, m, e) {
  let h = 0.55 * g2(x, y, 0, 0.02, 0.36, 0.48);
  h += 0.16 * g2(x, y, 0, 0.13, 0.3, 0.05);                                                    // the brow
  h -= 0.46 * (g2(x, y, -0.15, 0.045, 0.085, 0.06 * e) + g2(x, y, 0.15, 0.045, 0.085, 0.06 * e));   // the eyes, hollow
  h += 0.32 * g2(x, y, 0, -0.035, 0.035, 0.11);                                                // the nose
  h += 0.16 * g2(x, y, 0, -0.13, 0.06, 0.045);                                                 // its tip
  h += 0.12 * (g2(x, y, -0.2, -0.08, 0.09, 0.07) + g2(x, y, 0.2, -0.08, 0.09, 0.07));          // the cheeks
  h -= 0.3 * g2(x, y, 0, -0.265, 0.12, 0.016 + 0.055 * m);                                     // the mouth
  h += 0.09 * g2(x, y, 0, -0.225 + 0.02 * m, 0.13, 0.025);                                     // the lips
  h += 0.09 * g2(x, y, 0, -0.31 - 0.03 * m, 0.11, 0.028);
  h += 0.16 * g2(x, y, 0, -0.43, 0.13, 0.075);                                                 // the chin
  return h;
}
export function firstFace(x, y, z, { mouth = 0, eyes = 1 } = {}) {
  const d = ell(x, y, z + 0.08, 0.25, 0.33, 0.25);
  return (d - features(x * 1.3, y * 1.35, mouth, eyes) * 0.16 * sstep(-0.04, 0.14, z)) * 0.75;
}

// What's shipped. Local units are the same as the hand's: about half a unit from the middle to the edge.
//   rest   the shape when it's still; moved  the same with the mouth open (the shader mixes them)
const K = 1.39;        // the same size in the frame as the hand's other solids
const BOX = 0.62;
// nothing reaches the edge of the grid: what's outside it is simply empty
const inGrid = d => (x, y, z) => { const a = Math.abs(x) - BOX * 0.9, b = Math.abs(y) - BOX * 0.9, c = Math.abs(z) - BOX * 0.9, o = Math.max(a, b, c); return smax(d(x, y, z), o > 0 ? Math.hypot(Math.max(a, 0), Math.max(b, 0), Math.max(c, 0)) : o, 0.03); };
const posed = o => inGrid((x, y, z) => firstFace(x / K, y / K, z / K, o) * K);
export const SOLIDS = {
  face: { box: BOX, nx: 64, n: 128, rest: posed({ mouth: 0 }), moved: posed({ mouth: 1 }) },
};
