// node tools/bake.mjs [ids…] : bakes the sculpted solids into assets/solids/
import { SOLIDS } from './sculpts.mjs';
import { sample, writeSolid } from './solid.mjs';
import fs from 'node:fs';
const ids = process.argv.slice(2);
fs.mkdirSync(new URL('../assets/solids/', import.meta.url), { recursive: true });
for (const id of ids.length ? ids : Object.keys(SOLIDS)) {
  const F = SOLIDS[id], t0 = Date.now();
  const rest = sample(F.rest, F);
  const moved = F.moved ? sample(F.moved, F).map((x, a) => x - rest[a]) : new Float32Array(rest.length);
  const size = writeSolid(new URL(`../assets/solids/${id}.bin`, import.meta.url), { nx: F.nx, n: F.n, box: F.box }, [rest, moved]);
  console.log(id, `${F.nx}x${F.n}x${F.n}`, `${(size / 1024).toFixed(0)} KB`, `${Date.now() - t0} ms`);
}
