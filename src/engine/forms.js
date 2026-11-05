// Forms: shapes that come up through the sheet under your cursor, the way the hand does. A form is only a shape:
// what you see on it is whatever pattern is showing, thrown across its surface and bent by it, so it looks
// different on every pattern. Its outline cuts hard against what's behind it. And every one can be shifted live:
// folded round into a wheel, grown into smaller copies of itself, twisted, sliced into plates, eaten into a lattice.
//
//   base    which solid (BASES); one that's baked comes from assets/solids/
//   shift   what's done to it, on top of the settings in SHIFT_DEFAULTS
export const BASES = ['hand', 'face', 'coral', 'rope', 'knot', 'bloom', 'star', 'egg'];
export const BAKED = { face: 'face' };

// how big each comes up for the same size setting, how far it reaches from its middle in the hand's units (rays
// further off than that never read it), and how far its surface bends the pattern (thin parts less, or the
// pattern gets squeezed to gray)
export const BASE_WARP = { hand: 0.6, face: 1, coral: 0.3, rope: 0.22, knot: 0.25, bloom: 0.4, star: 0.55, egg: 0.45 };
export const BASE_SCALE = { hand: 1, face: 0.62, coral: 0.6, rope: 0.72, knot: 0.72, bloom: 0.7, star: 0.62, egg: 0.62 };
export const BASE_REACH = { hand: 0.56, face: 0.72, coral: 0.82, rope: 0.46, knot: 0.46, bloom: 0.56, star: 0.56, egg: 0.5 };

export const SHIFT_DEFAULTS = {
  fold: 1, spread: 0.2, spin: 0,                   // copies round the middle
  echo: 0, echoTurn: 0.8, echoSize: 0.68,          // smaller copies growing out of it
  field: 0,                                        // a whole field of them
  twist: 0, bend: 0, wave: 0,
  slice: 0, layers: 11, sliceTilt: 0.5,            // cut into plates
  rings: 0,                                        // cut into shells inside each other
  holes: 0, bumps: 0, blocks: 0, swell: 0,
  rise: 0, turn: 0, lean: 0, melt: 0.3,            // how it sits
  warp: 1, throw: 1, shade: 0.75, neg: 0, fill: 0, fine: 1, contour: 0, stripes: 130, stripeTilt: 0.9, stripeInk: 0, aura: 0,   // how it's drawn
};

// the controls for all that: [key, label, min, max, step], grouped. The Shift tool can put any of them on your mouse.
export const SHIFT_GROUPS = [
  ['Copies of itself', [['fold', 'Fold it round', 1, 12, 1], ['spread', 'How far out', 0, 0.9, 0.01], ['spin', 'Turn the wheel', -3.14, 3.14, 0.01], ['echo', 'Grow smaller ones', 0, 3, 1], ['echoSize', 'How much smaller', 0.4, 0.8, 0.01], ['echoTurn', 'How far they splay', -1.6, 1.6, 0.01], ['field', 'A field of them', 0, 1.2, 0.01]]],
  ['Bend it', [['twist', 'Twist', -8, 8, 0.01], ['bend', 'Bend', -3.5, 3.5, 0.01], ['wave', 'Sway', 0, 2, 0.01], ['swell', 'Thin ↔ fat', -0.05, 0.1, 0.001]]],
  ['Cut it', [['slice', 'Plates', 0, 1, 0.01], ['layers', 'How many plates', 4, 40, 0.5], ['sliceTilt', 'Which way they’re cut', -1.57, 1.57, 0.01], ['rings', 'Shells inside shells', 0, 1, 0.01], ['holes', 'Eaten through', 0, 1, 0.01], ['blocks', 'Made of cubes', 0, 1, 0.01], ['bumps', 'Bumps', 0, 1, 0.01]]],
  ['How it sits', [['rise', 'Sunk ↔ out of the sheet', -0.7, 0.9, 0.01], ['turn', 'Turn it', -3.14, 3.14, 0.01], ['lean', 'Lean it', -1.4, 1.4, 0.01], ['melt', 'Cut out ↔ melted in', 0, 1, 0.01]]],
  ['How the pattern lies on it', [['warp', 'How far the shape bends the pattern', 0, 3, 0.01], ['throw', 'How far it’s thrown across', 0, 4, 0.01], ['fine', 'The pattern on it: bigger ↔ finer', 0.3, 3, 0.01], ['shade', 'Flat ↔ shadowed', 0, 1, 0.01], ['aura', 'Its outline ripples out', 0, 2, 0.01]]],
  ['Instead of the pattern', [['neg', 'The pattern’s negative', 0, 1, 0.01], ['fill', 'White ↔ black', -1, 1, 0.01], ['contour', 'Its own stripes', 0, 1, 0.01], ['stripes', 'How many stripes', 15, 320, 1], ['stripeTilt', 'Which way they run', -1.57, 1.57, 0.01], ['stripeInk', 'Stripes: pale ↔ dark', -1, 1, 0.01]]],
];
export const SHIFT_CONTROLS = Object.fromEntries(SHIFT_GROUPS.flatMap(([, c]) => c.map(x => [x[0], x])));
// the Shift tool's first settings: left-right, then up-down
export const SHIFT_AXES = ['twist', 'bend'];

// a new shift, picked at random from combinations that work. Ranges stay where a form still reads.
export function surpriseShift(base, rand = Math.random) {
  const S = {}, pick = a => a[Math.floor(rand() * a.length)], r = (a, b) => a + (b - a) * rand();
  const moves = [
    () => { S.fold = pick([3, 4, 5, 6, 7, 8]); S.spread = r(0.18, 0.42); },
    () => { S.echo = pick([1, 2]); S.echoSize = r(0.55, 0.7); S.echoTurn = r(0.3, 0.9); },
    () => { S.twist = r(1.5, 5) * pick([-1, 1]); },
    () => { S.bend = r(0.8, 2.4) * pick([-1, 1]); },
    () => { S.wave = r(0.4, 1.2); },
    () => { S.slice = r(0.35, 0.7); S.layers = r(8, 24); S.sliceTilt = r(-1.2, 1.2); },
    () => { S.rings = r(0.5, 0.9); S.sliceTilt = r(-0.9, 0.9); },
    () => { S.holes = r(0.35, 0.8); },
    () => { S.blocks = r(0.15, 0.6); },
    () => { S.bumps = r(0.3, 0.8); },
  ];
  const n = 1 + Math.floor(rand() * 2.4), used = new Set();
  for (let i = 0; i < n; i++) { let m; do m = pick(moves); while (used.has(m)); used.add(m); m(); }
  // nearly always the pattern itself, bent one way or another
  S.warp = r(0.6, 2.2); S.throw = r(0.5, 2.5);
  if (rand() < 0.3) S.fine = r(1.3, 2.4);
  const skin = rand();
  if (skin < 0.1) S.neg = 1;
  else if (skin < 0.15) S.fill = pick([-1, 1]);
  if (rand() < 0.3) S.aura = r(0.5, 1.4);
  if (rand() < 0.35) S.lean = r(-0.6, 0.6);
  return { ...SHIFT_DEFAULTS, ...S };
}

export const FORMS = [
  { id: 'hand', name: 'Hand', base: 'hand', shift: { melt: 0.57 }, blurb: 'your cursor is the wrist. Hold: it makes a fist' },
  { id: 'face', name: 'The Face', base: 'face', shift: { rise: -0.12, aura: 0.5 }, blurb: 'on its back, coming up through the sheet. Hold: the mouth opens' },
  { id: 'wheel', name: 'Hand Wheel', base: 'hand', shift: { fold: 6, spread: 0.16, melt: 0.57 }, blurb: 'one hand folded round itself. Hold: every fist at once' },
  { id: 'handtree', name: 'Hand Tree', base: 'hand', shift: { echo: 2, echoTurn: 0.9, echoSize: 0.72, melt: 0.57 }, blurb: 'each hand grows two smaller hands' },
  { id: 'masks', name: 'Ring of Faces', base: 'face', shift: { fold: 5, spread: 0.36 }, blurb: 'the same face, looking every way' },
  { id: 'plates', name: 'Cut Face', base: 'face', shift: { rise: -0.12, slice: 0.55, layers: 15, sliceTilt: 1.57 }, blurb: 'cut into plates you can see between' },
  { id: 'coral', name: 'Coral', base: 'coral', blurb: 'each branch splits in two, six times over. Hold: it closes up' },
  { id: 'rope', name: 'Rope', base: 'rope', blurb: 'a rope made of ropes, always twisting. Hold: it loosens' },
  { id: 'knot', name: 'Knot', base: 'knot', blurb: 'the same rope, tied. Hold: it loosens' },
  { id: 'bloom', name: 'Bloom', base: 'bloom', blurb: 'petals in layers. Hold: it shuts' },
  { id: 'star', name: 'Star', base: 'star', blurb: 'twelve points, sharp facets. Hold: the points grow' },
  { id: 'sponge', name: 'Sponge', base: 'egg', shift: { holes: 0.7 }, blurb: 'a ball eaten through, the pattern showing in the holes' },
];
export const FORM_INDEX = Object.fromEntries(FORMS.map((f, i) => [f.id, i]));

// a baked solid (see tools/solid.mjs)
export async function loadSolid(id) {
  const res = await fetch(`assets/solids/${id}.bin`);
  if (!res.ok) throw new Error(`no solid for ${id}`);
  const buf = await res.arrayBuffer();
  const headLen = new DataView(buf).getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen)));
  const stream = new Blob([new Uint8Array(buf, 4 + headLen)]).stream().pipeThrough(new DecompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const { nx, n } = meta, N = nx * n * n, data = new Float32Array(N * 2), q = new Int32Array(N);
  const Y = nx, Z = nx * n;
  meta.ranges.forEach(([lo, hi], ch) => {
    const o = ch * N * 2, k = (hi - lo) / 16383;
    let a = 0;
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < nx; x++, a++) {
      const r = bytes[o + a] | (bytes[o + N + a] << 8), e = (r >>> 1) ^ -(r & 1);
      let p = e;
      if (x) p += q[a - 1];
      if (y) p += q[a - Y];
      if (z) p += q[a - Z];
      if (x && y) p -= q[a - 1 - Y];
      if (x && z) p -= q[a - 1 - Z];
      if (y && z) p -= q[a - Y - Z];
      if (x && y && z) p += q[a - 1 - Y - Z];
      q[a] = p;
      data[a * 2 + ch] = lo + p * k;
    }
  });
  return { id, meta, data };
}

export const FORM_GLSL = `
// ---------------------------------------------------------------- the form under your cursor
uniform highp sampler3D uSolid;   // a baked solid: its distance, and how the distance changes when it moves
uniform float uSolidBox;
bool gFormFull = false;           // the shading point wants the real distance, not the cheap bound

float sdEll(vec3 p, vec3 r) { float k0 = length(p / r), k1 = length(p / (r * r)); return k1 < 1e-6 ? -min(r.x, min(r.y, r.z)) : k0 * (k0 - 1.0) / k1; }
float smaxF(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return max(a, b) + h * h * k * 0.25; }

float baseFace(vec3 q, float open) {
  float B = uSolidBox;
  vec3 c = clamp(q, -B, B);                         // outside the grid: the distance to it, plus what's at its edge
  vec2 t = textureLod(uSolid, vec3(abs(c.x) / B, c.yz / (2.0 * B) + 0.5), 0.0).rg;
  return t.r + t.g * open + length(q - c);
}

// each branch splits in two, turned a little each time, so what you get is a whole tree for the price of six capsules
float baseCoral(vec3 p, float open) {
  float a = mix(0.72, 0.28, open), d = 1e3, s = 1.0;
  p.z += 0.24;
  for (int i = 0; i < 6; i++) {
    const float L = 0.21;
    float h = clamp(p.z / L, 0.0, 1.0);
    d = smin(d, (length(p - vec3(0.0, 0.0, h * L)) - mix(0.066, 0.05, h)) * s, 0.03 * s);
    p.z -= L;
    p.x = abs(p.x);
    p.xz = rot(a) * p.xz;
    p.xy = rot(1.15) * p.xy;
    p /= 0.76; s *= 0.76;
  }
  return d;
}

// strands of strands: go round the ring, turn, fold into n, step out; do it again inside that
float braid(vec3 p, float R, float n1, float k1, float r1, float n2, float k2, float r2, float tube, float t) {
  float th = atan(p.y, p.x);
  vec2 q = vec2(length(p.xy) - R, p.z);
  q = rot(th * k1 + t) * q;
  float sec = TAU / n1, a = atan(q.y, q.x);
  a = mod(a + sec * 0.5, sec) - sec * 0.5;
  q = length(q) * vec2(cos(a), sin(a));
  q.x -= r1;
  q = rot(th * k2 - t * 2.0) * q;
  sec = TAU / n2; a = atan(q.y, q.x);
  a = mod(a + sec * 0.5, sec) - sec * 0.5;
  q = length(q) * vec2(cos(a), sin(a));
  q.x -= r2;
  return (length(q) - tube) * 0.62;
}

float baseBloom(vec3 p, float open) {
  float d = length(p - vec3(0.0, 0.0, 0.05)) - 0.06, close = mix(1.0, 0.25, open), r0 = length(p.xy), th = atan(p.y, p.x);
  for (int l = 0; l < 4; l++) {
    float fl = float(l), n = 5.0 + fl * 2.0, sec = TAU / n, a = th + fl * 0.7;
    a = mod(a + sec * 0.5, sec) - sec * 0.5;
    vec3 q = vec3(r0 * cos(a), r0 * sin(a), p.z);
    q.x -= (0.05 + fl * 0.065) * close;
    q.z -= 0.075 - fl * 0.035;
    q.xz = rot(-mix(1.05, 0.28, (fl + 0.2) / 3.2) * mix(1.0, 1.55, open)) * q.xz;
    q.x -= 0.1 + fl * 0.025;
    d = smin(d, sdEll(q, vec3(0.115 + fl * 0.02, 0.085 + fl * 0.012, 0.024)), 0.012);
  }
  return d;
}

// space folded down to one triangular wedge of an icosahedron; inside it, one flat facet. Twelve points.
float baseStar(vec3 p, float open) {
  const float cp = 0.809017, scp = 0.3568221;
  const vec3 nc = vec3(-0.5, -cp, scp);
  p.xz = rot(0.5) * p.xz;
  p.yz = rot(0.35) * p.yz;
  for (int i = 0; i < 5; i++) { p.xy = abs(p.xy); p -= 2.0 * min(0.0, dot(p, nc)) * nc; }
  vec3 A = vec3(0.0, 0.0, 1.0), B = normalize(vec3(scp, 0.0, 0.5)), C = normalize(vec3(0.0, scp, cp));
  A *= mix(0.52, 0.66, open); B *= 0.17; C *= 0.17;
  vec3 n = normalize(cross(B - A, C - A));
  if (dot(n, A) < 0.0) n = -n;
  return max(dot(p - A, n), length(p) - length(A));   // a flat facet stops at the tip: past it, don't tell the sheet it's near
}

float formBase(int k, vec3 q, float open) {
  if (k == 0) {
    float far_ = length(q - vec3(0.0, 0.03, -0.12)) - 0.42;     // away from this hand, the cheap bound is enough (there may be a lot of hands)
    if (far_ > 0.06 + 1.8 * FORMSOFT / FORMS) return far_;
    q.yz = rot(-0.3) * q.yz;
    return handSDF(q, 0.15 + open * 0.9, 0.6 - open * 0.3, 10);
  }
  if (k == 1) return baseFace(q, open);
  if (k == 2) return baseCoral(q, open);
  if (k == 3) return braid(q, 0.3, 3.0, 4.0 / 3.0, 0.074, 3.0, 11.0 / 3.0, 0.03, 0.027 + open * 0.004, FORMROPET);
  if (k == 4) return braid(q, 0.26, 2.0, 1.5, 0.098 + open * 0.02, 3.0, 8.0 / 3.0, 0.026, 0.024, FORMROPET);
  if (k == 5) return baseBloom(q, open);
  if (k == 6) return baseStar(q, open);
  return sdEll(q - vec3(0.0, 0.0, 0.03), vec3(0.34, 0.34, 0.3) * (1.0 + open * 0.12));
}

// where a smaller copy grows from
vec3 echoFrom(int k) {
  if (k == 0) return vec3(0.0, 0.37, 0.03);
  if (k == 1) return vec3(0.0, 0.42, 0.16);
  if (k == 2) return vec3(0.0, 0.1, 0.34);
  return vec3(0.0, 0.2, 0.22);
}

float formCopies(int k, float fold, float echo, vec3 q, float open) {
  if (fold > 1.5) {                                 // round the middle, each facing out
    float sec = TAU / fold, a = atan(q.x, q.y) + FORMSPIN;
    a = mod(a + sec * 0.5, sec) - sec * 0.5;
    q.xy = length(q.xy) * vec2(sin(a), cos(a));
    q.y -= FORMSPREAD;
  }
  // and it grows smaller copies of itself: twice as many each generation, for one more reading
  float d = 1e3, s = 1.0;
  vec3 from = echoFrom(k);
  int gens = int(echo + 0.5);
  for (int i = 0; i <= gens; i++) {
    d = min(d, formBase(k, q, open) * s);
    q -= from;
    q.x = abs(q.x);
    q.xy = rot(FORMECHOT) * q.xy;
    q /= FORMECHOS; s *= FORMECHOS;
  }
  return d;
}

float formShape(vec3 q) {
  float open = FORMOPEN, dA, dB = 0.0;
  int m = FORMMIX > 0.0 ? 2 : 1;                    // a loop the compiler can't unroll: it's all compiled in once
  for (int i = 0; i < m; i++) {
    float di = formCopies(int((i == 0 ? FORMA : FORMB) + 0.5), i == 0 ? FORMFA : FORMFB, i == 0 ? FORMEA : FORMEB, q, open);
    if (i == 0) dA = di; else dB = di;
  }
  return m > 1 ? mix(dA, dB, FORMMIX) : dA;
}

float formD(vec3 p) {
  if (FORMON <= 0.001) return 1e3;
  float S = FORMS;
  vec3 q = (p - vec3(FORMX, FORMY, mix(-1.2 * S, FORMZ, FORMON))) / S;
  if (FORMFIELD > 0.0) q.xy -= FORMFIELD * floor(q.xy / FORMFIELD + 0.5);
  if (!gFormFull) {
    float b = length(q) - FORMBOUND;
    if (b * S > 1.8 * FORMSOFT + 0.15 * S) return b * S;
  }
  q.xy = rot(-FORMYAW) * q.xy;
  q.yz = rot(-FORMLEAN) * q.yz;
  float lip = 1.0;
  if (FORMWAVE != 0.0) {                            // it sways, like something under water
    q.x += FORMWAVE * 0.1 * sin(q.y * 9.0 + FORMWAVET);
    q.z += FORMWAVE * 0.08 * sin(q.y * 7.0 - FORMWAVET * 0.8 + 1.0);
    lip /= 1.0 + abs(FORMWAVE) * 0.9;
  }
  if (FORMBEND != 0.0) {
    q.yz = rot(FORMBEND * q.y) * q.yz;
    lip /= 1.0 + abs(FORMBEND) * 0.4;
  }
  if (FORMTWIST != 0.0) {
    q.xz = rot(FORMTWIST * q.y) * q.xz;
    lip /= 1.0 + abs(FORMTWIST) * 0.3;
  }
  // built of cubes: a cube wherever its middle is inside
  float g = FORMBLOCKS;
  vec3 cell = g > 0.0 ? (floor(q / g) + 0.5) * g : q;
  float d = formShape(cell);
  if (g > 0.0) d = d < 0.0 ? sdBox(q - cell, vec3(g * 0.47)) : max(d - g * 0.87, g * 0.5);
  if (FORMSWELL != 0.0) d -= FORMSWELL;
  if (FORMBUMPS > 0.0) {
    d -= FORMBUMPS * 0.03 * sin(q.x * 44.0) * sin(q.y * 44.0) * sin(q.z * 44.0) * (1.0 - smoothstep(0.0, 0.1, d));
    lip /= 1.0 + FORMBUMPS * 1.3;
  }
  if (FORMHOLES > 0.0) {                            // eaten through, a sponge of tunnels
    vec3 g = q * 13.0 + FORMWAVET * 0.15;
    float gy = dot(sin(g), cos(g.yzx)) / 13.0;
    d = smaxF(d, abs(gy) - mix(0.13, 0.012, FORMHOLES), 0.01);
    lip *= 0.7;
  }
  if (FORMRINGS > 0.0) {                            // shells inside each other, showing where a plane cuts them
    const float g = 0.075;
    d = max(d, abs(mod(d - FORMRINGT, g) - g * 0.5) - g * mix(0.5, 0.2, FORMRINGS));
    d = max(d, dot(q, vec3(0.0, sin(FORMSLICEA), cos(FORMSLICEA))) - mix(0.7, 0.06, FORMRINGS));
    lip *= 0.85;
  }
  if (FORMSLICE > 0.0) {                            // into plates
    vec3 dir = vec3(0.0, sin(FORMSLICEA), cos(FORMSLICEA));
    float f = FORMSLICEF, h = dot(q, dir) * f + FORMSLICEP;
    d = max(d, (abs(fract(h) - 0.5) - mix(0.5, 0.2, FORMSLICE)) / f);
  }
  return d * S * lip;
}
`;
