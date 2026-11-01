// Turns a friendly formula like "sin(x*d + t) * sin(r*8)" into GLSL for the pattern shader.
// - accepts ^ for powers, implicit multiplication ("2x", "3(x+y)"), case-insensitive names
// - every number becomes a uniform (uNum[i]) so each one can get its own knob without recompiling
// - errors come back as plain-English messages with a position

import { MAX_NUMS } from './shaders.js';

export const VARIABLES = {
  x: 'left ↔ right position',
  y: 'down ↕ up position',
  r: 'distance from the center (makes rings)',
  a: 'angle around the center (makes spokes)',
  t: 'time (makes things move)',
  d: 'the Density slider (×π)',
  k: 'the magic knob slider (0–1)',
  bass: 'music bass level (0–1)',
  mid: 'music mid level (0–1)',
  high: 'music treble level (0–1)',
  mx: 'mouse left ↔ right',
  my: 'mouse down ↕ up',
};

const CONSTS = { pi: 'PI', tau: 'TAU', e: '2.7182818' };

// name: [allowed arg counts, emit(args)]
const FUNCS = {
  sin: [[1], a => `sin(${a[0]})`],
  cos: [[1], a => `cos(${a[0]})`],
  tan: [[1], a => `tan(${a[0]})`],
  asin: [[1], a => `asin(clamp(${a[0]}, -1.0, 1.0))`],
  acos: [[1], a => `acos(clamp(${a[0]}, -1.0, 1.0))`],
  atan: [[1, 2], a => (a.length === 2 ? `atan(${a[0]}, ${a[1]})` : `atan(${a[0]})`)],
  abs: [[1], a => `abs(${a[0]})`],
  sign: [[1], a => `sign(${a[0]})`],
  floor: [[1], a => `floor(${a[0]})`],
  ceil: [[1], a => `ceil(${a[0]})`],
  round: [[1], a => `floor(${a[0]} + 0.5)`],
  fract: [[1], a => `fract(${a[0]})`],
  sqrt: [[1], a => `sqrt(abs(${a[0]}))`],
  exp: [[1], a => `exp(min(${a[0]}, 80.0))`],
  log: [[1], a => `log(max(abs(${a[0]}), 1e-6))`],
  mod: [[2], a => `mod(${a[0]}, ${a[1]})`],
  pow: [[2], a => `f_pow(${a[0]}, ${a[1]})`],
  min: [[2, 3, 4], a => a.reduce((x, y) => `min(${x}, ${y})`)],
  max: [[2, 3, 4], a => a.reduce((x, y) => `max(${x}, ${y})`)],
  clamp: [[3], a => `clamp(${a[0]}, ${a[1]}, ${a[2]})`],
  mix: [[3], a => `mix(${a[0]}, ${a[1]}, ${a[2]})`],
  step: [[2], a => `step(${a[0]}, ${a[1]})`],
  smoothstep: [[3], a => `smoothstep(${a[0]}, ${a[1]}, ${a[2]})`],
  hypot: [[2], a => `length(vec2(${a[0]}, ${a[1]}))`],
  noise: [[2], a => `gnoise(vec2(${a[0]}, ${a[1]}))`],
  fbm: [[2], a => `fbm(vec2(${a[0]}, ${a[1]}))`],
  tri: [[1], a => `f_tri(${a[0]})`],
  saw: [[1], a => `f_saw(${a[0]})`],
  square: [[1], a => `f_sq(${a[0]})`],
};

export const FUNCTION_HELP = {
  'sin, cos': 'smooth waves (the heart of every stripe)',
  'tri, saw, square': 'sharper waves: triangle, sawtooth, on/off',
  abs: 'flip negatives positive (mirrors things)',
  'floor, fract, round, mod': 'chop into steps / repeat',
  'noise(x, y), fbm(x, y)': 'smooth random blobs / cloudier blobs',
  'hypot(x, y)': 'distance — hypot(x−0.3, y) is distance from a point',
  'min, max, clamp, mix': 'combine or limit values',
  'pow or ^, sqrt, exp, log': 'curves and powers',
  'atan(y, x)': 'angle of any point',
};

class FormulaError extends Error {
  constructor(message, pos) { super(message); this.pos = pos; }
}

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new FormulaError('That number looks broken', i);
      toks.push({ t: 'num', v: parseFloat(m[0]), s: i, e: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if (/[a-z_]/i.test(c)) {
      const m = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i));
      toks.push({ t: 'id', v: m[0].toLowerCase(), s: i, e: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if ('+-*/^%(),'.includes(c)) { toks.push({ t: c, s: i, e: i + 1 }); i++; continue; }
    throw new FormulaError(`I don't know the symbol "${c}"`, i);
  }
  // implicit multiplication: 2x, 3(x+1), (x)(y), x y
  const out = [];
  for (const tk of toks) {
    const p = out[out.length - 1];
    const leftOk = p && (p.t === 'num' || p.t === ')' || (p.t === 'id' && !FUNCS[p.v]));
    const rightOk = tk.t === 'id' || tk.t === '(' || (tk.t === 'num' && p && p.t !== 'num');
    if (leftOk && rightOk) out.push({ t: '*', s: tk.s, e: tk.s });
    out.push(tk);
  }
  out.push({ t: 'end', s: src.length, e: src.length });
  return out;
}

// Recursive-descent parser that emits GLSL directly.
function parse(src, nums, used) {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const expect = (t, msg) => {
    if (peek().t !== t) throw new FormulaError(msg, peek().s);
    return next();
  };

  function expr() {
    let left = term();
    while (peek().t === '+' || peek().t === '-') {
      const op = next().t;
      left = `(${left} ${op} ${term()})`;
    }
    return left;
  }
  function term() {
    let left = unary();
    while (peek().t === '*' || peek().t === '/' || peek().t === '%') {
      const op = next().t;
      const right = unary();
      left = op === '%' ? `mod(${left}, ${right})` : `(${left} ${op} ${right})`;
    }
    return left;
  }
  function unary() {
    if (peek().t === '-') { next(); return `(-${unary()})`; }
    if (peek().t === '+') { next(); return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (peek().t === '^') { next(); return `f_pow(${base}, ${unary()})`; }
    return base;
  }
  function primary() {
    const tk = next();
    if (tk.t === 'num') {
      if (nums.length < MAX_NUMS) {
        nums.push({ v: tk.v, s: tk.s, e: tk.e });
        return `uNum[${nums.length - 1}]`;
      }
      const s = String(tk.v);
      return /[.e]/.test(s) ? s : `${s}.0`;
    }
    if (tk.t === '(') {
      const inner = expr();
      expect(')', 'Missing a closing “)”');
      return `(${inner})`;
    }
    if (tk.t === 'id') {
      if (FUNCS[tk.v]) {
        const [counts, emit] = FUNCS[tk.v];
        if (peek().t !== '(') throw new FormulaError(`“${tk.v}” needs parentheses, like ${tk.v}(x)`, tk.e);
        next();
        const args = [];
        if (peek().t !== ')') {
          args.push(expr());
          while (peek().t === ',') { next(); args.push(expr()); }
        }
        expect(')', `Missing a closing “)” for ${tk.v}(…)`);
        if (!counts.includes(args.length)) {
          const want = counts.length === 1 ? counts[0] : counts.join(' or ');
          throw new FormulaError(`${tk.v}() takes ${want} input${want === 1 ? '' : 's'}, you gave ${args.length}`, tk.s);
        }
        used.add(tk.v);
        return emit(args);
      }
      if (tk.v in VARIABLES) { used.add(tk.v); return tk.v; }
      if (tk.v in CONSTS) return CONSTS[tk.v];
      throw new FormulaError(`Unknown word “${tk.v}”. Try x, y, r, a, t, d, k…`, tk.s);
    }
    if (tk.t === 'end') throw new FormulaError('The formula ends too early', tk.s);
    throw new FormulaError(`Didn't expect “${tk.t}” here`, tk.s);
  }

  if (!src.trim()) throw new FormulaError('Type something!', 0);
  const out = expr();
  if (peek().t !== 'end') throw new FormulaError(`Didn't expect “${peek().t === 'num' || peek().t === 'id' ? src.slice(peek().s, peek().e) : peek().t}” here`, peek().s);
  return out;
}

// Returns { ok, glsl: {value, bendX, bendY}, nums: [{v, s, e, field}], used: Set } or { ok: false, error: {field, message, pos} }.
export function compileFormula(value, bendX = '0', bendY = '0') {
  const nums = [];
  const used = new Set();
  const glsl = {};
  const fields = { value, bendX: bendX || '0', bendY: bendY || '0' };
  for (const [field, src] of Object.entries(fields)) {
    const start = nums.length;
    try {
      glsl[field] = parse(src, nums, used);
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e;
      return { ok: false, error: { field, message: e.message, pos: e.pos } };
    }
    for (let j = start; j < nums.length; j++) nums[j].field = field;
  }
  return { ok: true, glsl, nums, used, sources: fields };
}

// Pretty-print a knob value back into formula text.
export function formatNumber(v) {
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return String(+v.toFixed(Math.abs(v) >= 10 ? 1 : 3));
}

// Replace the i-th number in a compiled formula with a new value; returns the new source text for that field.
export function replaceNumber(compiled, index, value) {
  const n = compiled.nums[index];
  const src = compiled.sources[n.field];
  return { field: n.field, text: src.slice(0, n.s) + formatNumber(value) + src.slice(n.e) };
}
