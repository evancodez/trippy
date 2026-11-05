// The workshop for the figures. A figure here is a solid sculpted out of soft shapes, lying under the sheet,
// and what ships is what the sheet does over it: a stretched, vacuum-formed skin baked into a small file.
//   height   how far the sheet rises at each point
//   pull     where the pattern on the sheet has come from: a sheet climbing a form is drawn in from all round,
//            so its pattern crowds up the slopes the way cloth really does
//   shade    how shut-in each point is: the shader thickens the ink there, so hollows go dark line by line
// plus any number of blend shapes (a mouth opening, a chest rising) as differences from the rest pose.
import fs from 'node:fs';
import zlib from 'node:zlib';

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
export const ball = (x, y, z, r) => Math.sqrt(x * x + y * y + z * z) - r;
export function ell(x, y, z, rx, ry, rz) {
  const ax = x / rx, ay = y / ry, az = z / rz, bx = ax / rx, by = ay / ry, bz = az / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
// a limb: a capsule that tapers from ra to rb
export function limb(x, y, z, ax, ay, az, bx, by, bz, ra, rb = ra) {
  const px = x - ax, py = y - ay, pz = z - az, dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = clamp((px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  const qx = px - dx * t, qy = py - dy * t, qz = pz - dz * t;
  return Math.sqrt(qx * qx + qy * qy + qz * qz) - (ra + (rb - ra) * t);
}
export const rot = (a, b, t) => { const c = Math.cos(t), s = Math.sin(t); return [a * c - b * s, a * s + b * c]; };

// ------------------------------------------------------------------------------- height of a solid from above
// sdf(x, y, z) in figure space, x y in -1..1. Returns N*N heights; floor where nothing's there.
export function topOf(sdf, N, zTop = 1.2, floor = -0.4) {
  const O = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const y = ((j + 0.5) / N) * 2 - 1;
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N) * 2 - 1;
      let z = zTop, n = 0;
      for (; n < 90; n++) {
        const d = sdf(x, y, z);
        if (d < 0.0006) break;
        z -= d * 0.85;
        if (z < floor) { z = floor; break; }
      }
      O[j * N + i] = z;
    }
  }
  return O;
}

// ------------------------------------------------------------------------------- the sheet over it
const down = (A, N) => {     // half size, keeping the tallest: a sheet can't pass through a peak because the grid got coarse
  const n = N >> 1, B = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * 2 * N + i * 2;
    B[j * n + i] = Math.max(A[a], A[a + 1], A[a + N], A[a + N + 1]);
  }
  return B;
};
const up = (A, n) => {        // double size, bilinear
  const N = n * 2, B = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const fy = clamp((j + 0.5) / 2 - 0.5, 0, n - 1.001), j0 = fy | 0, ty = fy - j0;
    for (let i = 0; i < N; i++) {
      const fx = clamp((i + 0.5) / 2 - 0.5, 0, n - 1.001), i0 = fx | 0, tx = fx - i0;
      const a = j0 * n + i0;
      B[j * N + i] = mix(mix(A[a], A[a + 1], tx), mix(A[a + n], A[a + n + 1], tx), ty);
    }
  }
  return B;
};

// A stretched skin resting on O: flat at the edges, with suction pulling it into hollows (more suction,
// closer it hugs them) and a springy bed holding it down (more bed, the sooner it lets go of the form).
export function drape(O, N, { suction = 6, bed = 40, sweeps = 260, reach = 0.12 } = {}) {
  const levels = [O];
  let n = N;
  while (n > 48) { levels.unshift(down(levels[0], n)); n >>= 1; }
  let h = new Float32Array(n * n);
  for (let l = 0; l < levels.length; l++) {
    const m = n << l, Ob = levels[l], dx = 2 / m;
    if (l > 0) h = up(h, m >> 1);
    // the suction only works near the form
    const P = suctionMask(Ob, m, reach);
    const denom = 4 + bed * dx * dx, w = 1.75;
    const its = l === levels.length - 1 ? sweeps : sweeps * 1.5;
    for (let it = 0; it < its; it++) {
      for (let c = 0; c < 2; c++) {
        for (let j = 1; j < m - 1; j++) {
          for (let i = 1 + ((j + c) & 1); i < m - 1; i += 2) {
            const a = j * m + i;
            const g = (h[a - 1] + h[a + 1] + h[a - m] + h[a + m] - suction * P[a] * dx * dx) / denom;
            const v = h[a] + w * (g - h[a]);
            h[a] = v > Ob[a] ? v : Ob[a];
          }
        }
      }
    }
  }
  return h;
}
function suctionMask(O, N, reach) {
  // how near each point is to something standing above the bed
  const M = new Float32Array(N * N);
  for (let a = 0; a < N * N; a++) M[a] = O[a] > 0 ? 1 : 0;
  const r = Math.max(1, Math.round((reach * N) / 2));
  return blur(blur(M, N, r), N, r).map(x => clamp(x * 2.4, 0, 1));
}

// box blur, three passes: close to a gaussian
export function blur(A, N, r) {
  r = Math.max(1, Math.round(r));
  let src = A.slice(), dst = new Float32Array(N * N);
  const f = 1 / (2 * r + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[j * N + clamp(k, 0, N - 1)];
      for (let i = 0; i < N; i++) {
        dst[j * N + i] = s * f;
        s += src[j * N + Math.min(i + r + 1, N - 1)] - src[j * N + Math.max(i - r, 0)];
      }
    }
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += dst[clamp(k, 0, N - 1) * N + i];
      for (let j = 0; j < N; j++) {
        src[j * N + i] = s * f;
        s += dst[Math.min(j + r + 1, N - 1) * N + i] - dst[Math.max(j - r, 0) * N + i];
      }
    }
  }
  return src;
}

// ------------------------------------------------------------------------------- where the pattern comes from
// The sheet has more surface over a slope than the flat picture has room for. Solve for a smooth map that
// makes up the difference (a Poisson equation, on a coarse grid: the answer's smooth), and it says where each
// point of the sheet came from. Screened, so it dies away; and it's made to reach zero at the edge.
export function pullOf(h, N, { gain = 1, screen = 3, slopeMax = 5 } = {}) {
  const dx = 2 / N, src = new Float32Array(N * N);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const a = j * N + i, gx = (h[a + 1] - h[a - 1]) / (2 * dx), gy = (h[a + N] - h[a - N]) / (2 * dx);
    src[a] = Math.sqrt(1 + Math.min(gx * gx + gy * gy, slopeMax * slopeMax)) - 1;
  }
  const n0 = N;
  // pyramid down by averaging
  const pyr = [src];
  let n = N;
  while (n > 32) {
    const m = n >> 1, S = new Float32Array(m * m), A = pyr[0];
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const a = j * 2 * n + i * 2;
      S[j * m + i] = (A[a] + A[a + 1] + A[a + n] + A[a + n + 1]) / 4;
    }
    pyr.unshift(S); n = m;
  }
  let P = new Float32Array(n * n);
  for (let l = 0; l < pyr.length; l++) {
    const m = n << l, S = pyr[l], d = 2 / m;
    if (l > 0) P = up(P, m >> 1);
    const denom = 4 + screen * screen * d * d, w = 1.8, its = l === pyr.length - 1 ? 60 : 300;
    for (let it = 0; it < its; it++) for (let c = 0; c < 2; c++) {
      for (let j = 1; j < m - 1; j++) for (let i = 1 + ((j + c) & 1); i < m - 1; i += 2) {
        const a = j * m + i;
        const g = (P[a - 1] + P[a + 1] + P[a - m] + P[a + m] - S[a] * d * d) / denom;
        P[a] += w * (g - P[a]);
      }
    }
  }
  const X = new Float32Array(N * N), Y = new Float32Array(N * N);
  for (let j = 1; j < n0 - 1; j++) for (let i = 1; i < n0 - 1; i++) {
    const a = j * N + i, x = ((i + 0.5) / N) * 2 - 1, y = ((j + 0.5) / N) * 2 - 1;
    const edge = sstep(1, 0.82, Math.max(Math.abs(x), Math.abs(y)));
    X[a] = gain * edge * (P[a + 1] - P[a - 1]) / (2 * dx);
    Y[a] = gain * edge * (P[a + N] - P[a - N]) / (2 * dx);
  }
  return [X, Y];
}

// ------------------------------------------------------------------------------- how shut-in each point is
// > 0 in a hollow, < 0 on a crest: how far it sits below (or above) its neighbourhood, at a few sizes
export function shadeOf(h, N, scales = [[0.02, 1.0], [0.05, 0.9], [0.13, 0.55]], gain = 9) {
  const S = new Float32Array(N * N);
  for (const [sigma, w] of scales) {
    const B = blur(h, N, (sigma * N) / 2);
    for (let a = 0; a < N * N; a++) S[a] += w * (B[a] - h[a]);
  }
  for (let a = 0; a < N * N; a++) S[a] = clamp(S[a] * gain, -1.5, 2.5);
  return S;
}

// ------------------------------------------------------------------------------- the file
// One deflated stream of 16-bit planes, each predicted from its neighbours so smooth data packs small.
export function writeRelief(path, N, planes, meta = {}) {
  const ranges = planes.map(p => {
    let lo = Infinity, hi = -Infinity;
    for (const x of p) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (hi - lo < 1e-6) hi = lo + 1e-6;
    return [lo, hi];
  });
  const bytes = Buffer.alloc(N * N * 2 * planes.length);
  let o = 0;
  const q = new Int32Array(N * N);
  planes.forEach((p, pi) => {
    const [lo, hi] = ranges[pi], k = 16383 / (hi - lo);       // 14 bits are plenty, and pack far smaller than 16
    for (let a = 0; a < N * N; a++) q[a] = Math.round((p[a] - lo) * k);
    const r = new Int32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * N + i, l = i ? q[a - 1] : 0, u = j ? q[a - N] : 0, c = i && j ? q[a - N - 1] : 0;
      const e = q[a] - (l + u - c);
      r[a] = (e << 1) ^ (e >> 31);                            // small either way
    }
    for (let a = 0; a < N * N; a++) bytes[o++] = r[a] & 255;
    for (let a = 0; a < N * N; a++) bytes[o++] = (r[a] >> 8) & 255;
  });
  const head = Buffer.from(JSON.stringify({ N, ranges: ranges.map(r => [+r[0].toFixed(5), +r[1].toFixed(5)]), ...meta }));
  const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
  const z = zlib.deflateSync(bytes, { level: 9 });
  fs.writeFileSync(path, Buffer.concat([len, head, z]));
  return 4 + head.length + z.length;
}

// ------------------------------------------------------------------------------- a look at it, without the app
export function writePNG(path, w, h, rgb) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const n = Buffer.alloc(4); n.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([n, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let j = 0; j < h; j++) { raw[j * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + j * w * 3, w * 3).copy(raw, j * (w * 3 + 1) + 1); }
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const sampler = (h, N) => (x, y) => {
  const fx = clamp((x * 0.5 + 0.5) * N - 0.5, 0, N - 1.001), fy = clamp((y * 0.5 + 0.5) * N - 0.5, 0, N - 1.001), i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, a = j * N + i;
  return mix(mix(h[a], h[a + 1], tx), mix(h[a + N], h[a + N + 1], tx), ty);
};
// clay, from above and from a low angle, side by side
export function clayView(path, h, N, S = 420) {
  const H = sampler(h, N), rgb = new Uint8Array(S * 2 * S * 3);
  const shadePt = (x, y) => {
    const e = 2.5 / N, nx = H(x - e, y) - H(x + e, y), ny = H(x, y - e) - H(x, y + e), nz = 2 * e, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const lx = -0.5, ly = 0.6, lz = 0.62;
    return clamp(0.1 + 0.92 * Math.max((nx * lx + ny * ly + nz * lz) / l, 0), 0, 1);
  };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i / S) * 2 - 1, y = 1 - (j / S) * 2, c = shadePt(x, y) * 255;
    const a = (j * S * 2 + i) * 3; rgb[a] = c; rgb[a + 1] = c * 0.97; rgb[a + 2] = c * 0.92;
    // a camera tilted back, looking from the chin
    const pitch = 1.05, cp = Math.cos(pitch), sp = Math.sin(pitch), D = 3.4, f = 2.1;
    const ro = [0, -D * sp, D * cp];
    let rx = x, ry = y * cp + f * sp, rz = y * sp - f * cp;
    const l = Math.sqrt(rx * rx + ry * ry + rz * rz); rx /= l; ry /= l; rz /= l;
    let t = 1.2, hit = false, px = 0, py = 0;
    for (let n = 0; n < 240; n++) {
      px = ro[0] + rx * t; py = ro[1] + ry * t; const pz = ro[2] + rz * t;
      const inside = Math.abs(px) < 1 && Math.abs(py) < 1;
      const hh = inside ? H(px, py) : 0;
      const g = pz - hh;
      if (g < 0.001) { hit = true; break; }
      t += Math.max(g * 0.25, 0.002);
      if (t > 8) break;
    }
    const b = (j * S * 2 + S + i) * 3;
    const cc = hit ? (Math.abs(px) < 1 && Math.abs(py) < 1 ? shadePt(px, py) : 0.8) * 255 : 20;
    rgb[b] = cc; rgb[b + 1] = cc * 0.97; rgb[b + 2] = cc * 0.92;
  }
  writePNG(path, S * 2, S, rgb);
}
