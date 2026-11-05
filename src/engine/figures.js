// Figures: things lying under the sheet. Each was sculpted as a solid and then draped, once, in the workshop
// (tools/): a stretched skin vacuum-formed over the form, baked into a small file. So what's on screen is the
// sheet itself rising, its own pattern crowding up the slopes and thickening into the hollows. Nothing is
// pasted on, and since it's only a few texture reads it costs next to nothing, whichever figure it is.
//
//   shapes  blend shapes baked with it, and what moves each: 'voice' (the tune), 'press' (your mouse),
//           'breath' (slow, deeper when it's loud), 'kick' (a thump on the drum), 'cry' (the tune and your
//           mouse together), 'flutter' (a quick shiver on the high notes), 'blink'
//   scale   how big, for the same size setting
//   tall    how far it stands up, for the same setting
//   rise    how much further it comes up when you hold the mouse
//   ride    how much the song's arc lifts it
//   pulse   how much a kick lifts all of it
//   look    its middle moves, as a head turns or an eye looks: how far, how wide (bigger is tighter)
//   lookAt  'cursor': that's your pointer, else the tune
//   spin    it turns round slowly (radians a second), a little quicker when it's loud
//   writhe  its limbs move: how much, how tight, how quick
//   glide   it swims: goes after your cursor, circles there, faces where it's going
export const FIGURES = [
  { id: 'hand', name: 'Hand', group: 'People', blurb: 'your cursor is the wrist. Hold: it makes a fist', special: true },
  { id: 'sleeper', name: 'The Sleeper', group: 'People', blurb: 'a face asleep on its back under the sheet, its lips moving with the tune. Hold: it stirs', scale: 1.25, rise: 0.3, ride: 0.2, look: [0.09, 1.6], shapes: ['voice', 'press'] },
  { id: 'cry', name: 'The Cry', group: 'People', blurb: 'chin up, eyes gone, its mouth a hole going down with the tune. Hold: it goes wider', scale: 1.25, rise: 0.35, ride: 0.3, look: [0.06, 1.6], shapes: ['cry', 'press'] },
  { id: 'skull', name: 'Skull', group: 'People', blurb: 'bone under the skin of the sheet, sockets all the way down. Sings. Hold: the jaw drops', scale: 1.2, rise: 0.3, ride: 0.25, look: [0.05, 1.6], shapes: ['cry'] },
  { id: 'lovers', name: 'The Lovers', group: 'People', blurb: 'two heads under one sheet, turned to each other. Hold: they press together', scale: 1.3, tall: 1.3, rise: 0.25, ride: 0.2, shapes: ['press'] },
  { id: 'veil', name: 'The Veil', group: 'People', blurb: 'someone laid out under the sheet, chest rising with the song. Hold: a knee comes up', scale: 1.5, tall: 1.25, rise: 0.3, ride: 0.2, shapes: ['breath', 'press'] },
  { id: 'heart', name: 'The Heart', group: 'Inside', blurb: 'it beats on the kick drum. Hold: it clenches', scale: 1.3, tall: 1.3, rise: 0.2, ride: 0.2, pulse: 0.06, shapes: ['kick'] },
  { id: 'ribs', name: 'Ribs', group: 'Inside', blurb: 'a chest with nothing on it, breathing the song in. Hold: it lifts', scale: 1.3, tall: 1.2, rise: 0.3, ride: 0.25, shapes: ['breath'] },
  { id: 'kraken', name: 'Kraken', group: 'Creatures', blurb: 'eight arms under the sheet, never quite still. Hold: they thrash', scale: 1.4, tall: 1.3, rise: 0.25, ride: 0.2, writhe: [0.2, 7, 1.1] },
  { id: 'manta', name: 'Manta', group: 'Creatures', blurb: 'glides under the sheet after your cursor and circles there. Hold: its wings beat', scale: 1.34, tall: 1.9, rise: 0.15, ride: 0.2, glide: true, shapes: ['beat'] },
  { id: 'moth', name: 'Moth', group: 'Creatures', blurb: 'pressed flat, wings shivering on the high notes. Hold: they lift', scale: 1.36, tall: 1.8, rise: 0.2, ride: 0.2, shapes: ['flutter'] },
  { id: 'eye', name: 'The Eye', group: 'Signs', blurb: 'open under the sheet, and it watches your cursor. Hold: it shuts', scale: 1.28, tall: 1.05, rise: 0.2, ride: 0.2, look: [0.15, 5], lookAt: 'cursor', shapes: ['blink'] },
  { id: 'ammonite', name: 'Ammonite', group: 'Signs', blurb: 'an old spiral, turning with the song. Hold: it rises', scale: 1.37, tall: 1.8, rise: 0.3, ride: 0.3, spin: 0.22 },
];
export const FIGURE_INDEX = Object.fromEntries(FIGURES.map((f, i) => [f.id, i]));
export const FIGURE_GROUPS = [...new Set(FIGURES.map(f => f.group))];

// the file (see tools/relief.mjs): how big, the range of each plane, then the planes deflated and predicted
export async function loadRelief(id) {
  const res = await fetch(`assets/reliefs/${id}.bin`);
  if (!res.ok) throw new Error(`no relief for ${id}`);
  const buf = await res.arrayBuffer();
  const headLen = new DataView(buf).getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen)));
  const stream = new Blob([new Uint8Array(buf, 4 + headLen)]).stream().pipeThrough(new DecompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const N = meta.N, planes = [], q = new Int32Array(N * N);
  meta.ranges.forEach(([lo, hi], p) => {
    const o = p * N * N * 2, k = (hi - lo) / 16383, out = new Float32Array(N * N);
    for (let j = 0, a = 0; j < N; j++) for (let i = 0; i < N; i++, a++) {
      const r = bytes[o + a] | (bytes[o + N * N + a] << 8), e = (r >>> 1) ^ -(r & 1);
      q[a] = e + (i ? q[a - 1] : 0) + (j ? q[a - N] : 0) - (i && j ? q[a - N - 1] : 0);
      out[a] = lo + q[a] * k;
    }
    planes.push(out);
  });
  return { id, N, meta, planes };
}

// needs from the shader: rot, and FIG… values
export const FIGURE_GLSL = `
// ---------------------------------------------------------------- what's lying under the sheet
uniform sampler2D uRelief;     // height, pull x, pull y, shade
uniform sampler2D uReliefB;    // the same, of the one it's turning into
uniform sampler2D uReliefX;    // blend shapes: differences from the rest pose
uniform vec4 uFigW;            // how much of each

// where on the relief this point of the sheet lies, and how tall it stands there (a crowd varies)
vec2 reliefUV(vec2 q, out float amp) {
  vec2 o = q - vec2(FIGX, FIGY);
  amp = 1.0;
  if (FIGREP > 0.5) {
    float sp = FIGSP * FIGS;
    vec2 g = floor(o / sp + 0.5);
    o -= sp * g;
    float k = g.x * 1.7 + g.y * 2.9;
    amp = 0.74 + 0.26 * sin(FIGT * 0.9 + k * 3.7);
  }
  o = rot(-FIGROT) * o / FIGS;
  if (FIGWRITHE > 0.0) {                     // limbs: the far parts swing back and forth, each ring a little behind the last
    float r = length(o);
    o = rot(FIGWRITHE * smoothstep(0.1, 0.9, r) * sin(r * FIGWF - FIGWT + atan(o.y, o.x) * 2.0)) * o;
  }
  if (FIGLOOKX != 0.0 || FIGLOOKY != 0.0) o -= vec2(FIGLOOKX, FIGLOOKY) * exp(-dot(o, o) * FIGLOOKK);   // a head turning, an eye looking: the middle moves, the edges stay
  return o * 0.5 + 0.5;
}
float reliefH(vec2 q) {
  if (FIG < 0.001 || !gFigNear) return 0.0;
  float amp;
  vec2 uv = reliefUV(q, amp);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return 0.0;
  float h = textureLod(uRelief, uv, 0.0).r;
  if (FIGMIX > 0.0) h = mix(h, textureLod(uReliefB, uv, 0.0).r, FIGMIX);
  if (FIGSHAPES > 0.5) h += dot(textureLod(uReliefX, uv, 0.0), uFigW);
  return FIG * FIGAMP * FIGS * amp * h;
}
// the pattern's pull (world units), the shade, and the height in figure units
vec4 reliefAt(vec2 q) {
  if (FIG < 0.001) return vec4(0.0);
  float amp;
  vec2 uv = reliefUV(q, amp);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec4(0.0);
  vec4 t = textureLod(uRelief, uv, 0.0);
  if (FIGMIX > 0.0) t = mix(t, textureLod(uReliefB, uv, 0.0), FIGMIX);
  if (FIGSHAPES > 0.5) t.r += dot(textureLod(uReliefX, uv, 0.0), uFigW);
  float k = FIG * FIGAMP * amp;
  return vec4(rot(FIGROT) * t.gb * FIGS * k * k, t.a * k, t.r * k);
}

// a moving figure leaves a wake in the lines
vec2 figFlow(vec2 q) {
  if (FIG < 0.001 || FIGREP > 0.5) return q;
  vec2 o = q - vec2(FIGX, FIGY);
  float sp = length(vec2(FIGVX, FIGVY));
  if (sp > 0.001) {
    vec2 dir = vec2(FIGVX, FIGVY) / sp;
    float behind = -dot(o, dir), side = dot(o, vec2(-dir.y, dir.x));
    float b = max(behind, 0.0) / FIGS;
    float w = smoothstep(0.0, 0.2, behind / FIGS) * exp(-b * 2.2) * exp(-side * side / (FIGS * FIGS * (0.03 + 0.1 * b)));
    q += w * sp * FIGS * 0.2 * vec2(dir.x + 0.6 * sin(behind * 22.0 / FIGS), dir.y + 0.6 * cos(side * 26.0 / FIGS));
  }
  return q;
}

// does this ray come anywhere near the figure? Decided once per pixel: rays that don't never read the relief.
bool figNear(vec3 ro, vec3 rd) {
  if (FIGREP > 0.5) return true;
  vec3 oc = vec3(FIGX, FIGY, 0.2 * FIGS) - ro;
  return length(oc - rd * max(dot(oc, rd), 0.0)) < 1.45 * FIGS;
}
`;
