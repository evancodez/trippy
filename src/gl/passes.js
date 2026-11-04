// The small render passes around the world shader:
//   DISP  – a low-res distortion map the brushes paint into (smear, bulge, pinch); it springs back
//   BLUR  – a separable gaussian in floating point (turns a picture into a smooth relief)
//   COMP  – the finishing pass: glow, color split, grain, vignette

export const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const HASH = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

export const DISP_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uPrevDisp;
uniform vec2 uDispRes;
uniform vec2 uBrushPos;
uniform vec2 uBrushVel;
uniform float uBrushSize;
uniform float uBrushStrength;
uniform int uBrushMode;      // 0 none, 1 smear, 2 bulge, 3 pinch
uniform float uRelax;
uniform float uAspect;
uniform int uClear;
void main() {
  if (uClear == 1) { outColor = vec4(0.0); return; }
  vec2 st = gl_FragCoord.xy / uDispRes;
  vec2 tx = 1.0 / uDispRes;
  vec2 d = texture(uPrevDisp, st).xy;
  vec2 avg = 0.25 * (texture(uPrevDisp, st + vec2(tx.x, 0.0)).xy + texture(uPrevDisp, st - vec2(tx.x, 0.0)).xy
                   + texture(uPrevDisp, st + vec2(0.0, tx.y)).xy + texture(uPrevDisp, st - vec2(0.0, tx.y)).xy);
  d = mix(d, avg, 0.3) * uRelax;
  vec2 rel = (st - 0.5) * vec2(uAspect, 1.0) - uBrushPos;
  float g = exp(-dot(rel, rel) / (uBrushSize * uBrushSize));
  float s = uBrushStrength;
  if (uBrushMode == 1) d -= uBrushVel * g * s * 1.1;
  else if (uBrushMode == 2) d = mix(d, -rel * 0.75 * s, g * 0.12);
  else if (uBrushMode == 3) d = mix(d, rel * 0.75 * s, g * 0.12);
  float m = length(d);
  if (m > 0.9) d *= 0.9 / m;
  outColor = vec4(d, 0.0, 1.0);
}
`;

export const BLUR_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec2 uRes;
uniform float uSigma;
void main() {
  vec2 st = gl_FragCoord.xy / uRes;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  float stride = max(1.0, uSigma / 4.0);
  for (int i = -12; i <= 12; i++) {
    float x = float(i) * stride;
    float w = exp(-x * x / (2.0 * uSigma * uSigma));
    acc += texture(uSrc, st + uDir * x / uRes) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}
`;

export const COMP_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uA;
uniform vec2 uRes;
uniform float uSeed;
uniform float uGrain;
uniform float uVignette;
uniform float uGlow;
uniform vec3 uGlowTint;
uniform float uAberr;
${HASH}
void main() {
  vec2 st = gl_FragCoord.xy / uRes;
  vec2 c = (st - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = texture(uA, st).rgb;
  if (uAberr > 0.0) {
    vec2 off = (st - 0.5) * uAberr * 0.012;
    col = vec3(texture(uA, st + off).r, col.g, texture(uA, st - off).b);
  }
  // halation: the bright parts bleed a soft, tinted glow
  vec3 glow = textureLod(uA, st, 5.0).rgb + textureLod(uA, st, 3.5).rgb * 0.5;
  col += pow(glow, vec3(1.8)) * uGlowTint * uGlow * 0.6;
  col *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(c) * 1.35);
  col += (hash12(gl_FragCoord.xy + uSeed * 137.0) - 0.5) * uGrain * 0.22;
  outColor = vec4(col, 1.0);
}
`;

// the living labyrinth: a reaction-diffusion field (Gray-Scott). Two chemicals feed on each other, and the
// pattern that comes out by itself is the same one on a zebra or in a fingerprint. r = A, g = B.
export const LIVING_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform vec2 uFK;           // feed, kill
uniform vec4 uSpot;         // x, y (0..1), radius, on: a drop of B
uniform float uClear;
void main() {
  vec2 st = gl_FragCoord.xy / uRes, px = 1.0 / uRes;
  if (uClear > 0.5) {
    // start from a scatter of drops
    vec2 g = floor(st * 14.0);
    float h = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453);
    float d = length(fract(st * 14.0) - 0.5);
    outColor = vec4(1.0, h > 0.6 && d < 0.3 ? 1.0 : 0.0, 0.0, 1.0);
    return;
  }
  vec2 c = texture(uPrev, st).rg;
  vec2 l = (texture(uPrev, st + vec2(px.x, 0.0)).rg + texture(uPrev, st - vec2(px.x, 0.0)).rg + texture(uPrev, st + vec2(0.0, px.y)).rg + texture(uPrev, st - vec2(0.0, px.y)).rg) * 0.2
         + (texture(uPrev, st + px).rg + texture(uPrev, st - px).rg + texture(uPrev, st + vec2(px.x, -px.y)).rg + texture(uPrev, st + vec2(-px.x, px.y)).rg) * 0.05 - c;
  float r = c.r * c.g * c.g;
  vec2 n = c + vec2(1.0 * l.r - r + uFK.x * (1.0 - c.r), 0.5 * l.g + r - (uFK.y + uFK.x) * c.g);
  if (uSpot.w > 0.5 && distance(st, uSpot.xy) < uSpot.z) n.g = 1.0;
  outColor = vec4(clamp(n, 0.0, 1.0), 0.0, 1.0);
}`;
