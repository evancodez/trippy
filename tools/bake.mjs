// node tools/bake.mjs [ids…] [--n=384] [--preview=dir] : bakes the figures into assets/reliefs/
import { SCULPTS } from './sculpts.mjs';
import { topOf, drape, pullOf, shadeOf, blur, writeRelief, clayView } from './relief.mjs';
import fs from 'node:fs';
const args = process.argv.slice(2);
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const N = +(opt('n') || 384), prev = opt('preview');
const ids = args.filter(a => !a.startsWith('--'));
fs.mkdirSync(new URL('../assets/reliefs/', import.meta.url), { recursive: true });
const skin = (F, o = {}) => {
  let O;
  const fit = F.fit ?? 1;                                // how much of the square it fills: the sheet needs room to come back down
  if (F.height) { O = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) O[j * N + i] = F.height(((i + 0.5) / N * 2 - 1) / fit, ((j + 0.5) / N * 2 - 1) / fit, o) * fit; }
  else { const s = F.make(o); O = topOf((x, y, z) => s(x / fit, y / fit, z / fit) * fit, N); }
  if (F.detail) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) O[j * N + i] = F.detail(((i + 0.5) / N * 2 - 1) / fit, ((j + 0.5) / N * 2 - 1) / fit, O[j * N + i] / fit) * fit;
  const h = blur(drape(O, N, F.drape), N, Math.max(1, N / 340));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {  // and it's all the way down by the edge of the square
    const e = Math.max(Math.abs((i + 0.5) / N * 2 - 1), Math.abs((j + 0.5) / N * 2 - 1)), t = Math.min(Math.max((1 - e) / 0.1, 0), 1);
    h[j * N + i] *= t * t * (3 - 2 * t);
  }
  return h;
};
for (const id of ids.length ? ids : Object.keys(SCULPTS)) {
  const F = SCULPTS[id], t0 = Date.now();
  const h = skin(F);
  const [dx, dy] = pullOf(h, N, F.pull);
  const cav = shadeOf(h, N);
  const planes = [h, dx, dy, cav];
  const names = Object.keys(F.shapes || {});
  for (const n of names) {
    const v = skin(F, F.shapes[n]);
    planes.push(v.map((x, a) => x - h[a]));
    if (prev) clayView(`${prev}/${id}_${n}.png`, v, N);
  }
  let slope = 0;
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const a = j * N + i, gx = (h[a + 1] - h[a - 1]) * N / 4, gy = (h[a + N] - h[a - N]) * N / 4;
    slope = Math.max(slope, gx * gx + gy * gy);
  }
  let top = 0; for (const x of h) top = Math.max(top, x);
  const size = writeRelief(new URL(`../assets/reliefs/${id}.bin`, import.meta.url), N, planes, { shapes: names, top: +top.toFixed(3), slope: +Math.sqrt(slope).toFixed(2) });
  if (prev) clayView(`${prev}/${id}.png`, h, N);
  console.log(id, `${N}px`, `${(size / 1024).toFixed(0)}KB`, `top ${top.toFixed(2)}`, `slope ${Math.sqrt(slope).toFixed(1)}`, `${Date.now() - t0}ms`);
}
