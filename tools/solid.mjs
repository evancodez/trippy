// The workshop: soft shapes to sculpt with, and how a solid gets baked. A solid is its distance to the surface
// on a 3D grid. In the shader that's one texture read per step, however many shapes went into it, and the
// surface can do anything a real solid can: overhang, cut against what's behind it, have holes.
import fs from 'node:fs';
import zlib from 'node:zlib';

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
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

// the grid covers -box..box in y and z, and 0..box in x (a solid mirrored left to right needs only half)
export function sample(sdf, { box, nx, n }, near = 0.3) {
  const out = new Float32Array(nx * n * n);
  let a = 0;
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < nx; i++, a++) {
    const d = sdf((i + 0.5) / nx * box, ((j + 0.5) / n * 2 - 1) * box, ((k + 0.5) / n * 2 - 1) * box);
    out[a] = clamp(d, -near, near);
  }
  return out;
}

// the file: 4-byte header length, JSON { nx, n, box, ranges }, then the channels deflated: 14-bit values, each
// as its difference from what its neighbours predict, split into low and high bytes. Distances are smooth, so
// nearly all of those differences are tiny.
export function writeSolid(path, meta, channels) {
  const { nx, n } = meta, N = nx * n * n, ranges = [], bytes = new Uint8Array(N * 2 * channels.length);
  channels.forEach((c, ch) => {
    let lo = Infinity, hi = -Infinity;
    for (const x of c) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (hi <= lo) hi = lo + 1e-6;
    ranges.push([+lo.toFixed(6), +hi.toFixed(6)]);
    const q = new Int32Array(N), o = ch * N * 2;
    for (let a = 0; a < N; a++) q[a] = Math.round((c[a] - ranges[ch][0]) / (ranges[ch][1] - ranges[ch][0]) * 16383);
    const X = 1, Y = nx, Z = nx * n;
    let a = 0;
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < nx; i++, a++) {
      const g = (x, y, z) => (i >= x && j >= y && k >= z ? q[a - x * X - y * Y - z * Z] : 0);
      const e = q[a] - (g(1, 0, 0) + g(0, 1, 0) + g(0, 0, 1) - g(1, 1, 0) - g(1, 0, 1) - g(0, 1, 1) + g(1, 1, 1));
      const r = (e << 1) ^ (e >> 31);
      bytes[o + a] = r & 255;
      bytes[o + N + a] = (r >> 8) & 255;
    }
  });
  const head = Buffer.from(JSON.stringify({ ...meta, ranges }));
  const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
  const body = zlib.deflateSync(Buffer.from(bytes), { level: 9 });
  fs.writeFileSync(path, Buffer.concat([len, head, body]));
  return 4 + head.length + body.length;
}
