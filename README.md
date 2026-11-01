# trippy — op-art machine

Warp, ripple, twist and melt black-and-white op-art patterns in real time, in the browser.

- **Presets**: 18 base modes (tunnels, spheres, moiré, whirlpools…). Reset always takes you back.
- **Mouse tools**: Move, Ripple, Smear, Bulge, Pinch, Twist. Bottom dock, or keys `1`–`6`.
- **Freeplay**: pick a pattern, stack up to 6 warps like effect pedals, tune motion, the 3D look and colors.
- **Smart**: write the pattern as a formula (`sin(r*d - t*3)`). Every number gets its own knob.
- **Sound**: drop in a song (or use the mic) and the pattern pulses, ripples and wobbles to it.
- **Mutate / Surprise / Undo**, save looks in the browser, share a link to the exact look, save a PNG, record a clip.

No build step and no dependencies: plain HTML + ES modules + WebGL2.

## Run it locally

ES modules need a web server (opening `index.html` as a file won't work). From this folder, run either of these:

```bash
npx serve .
```

```bash
python3 -m http.server 8000
```

## Deploy on Vercel

Import the GitHub repo in Vercel and keep the defaults: Framework Preset **Other**, no build command, and the root as the output directory. Every push to `main` redeploys.

## How the illusion works

Every pixel runs a tiny program on the GPU (`src/shaders.js`), 60 times a second:

1. **Where am I?** The pixel's position, nudged by mouse brushes and click ripples.
2. **Warp it.** Each warp pushes that position around: waves, twists, a bulge, noise, or polar math that turns flat space into a tunnel or a floor.
3. **Pattern.** A simple math shape at the warped position: `sin(x)` gives stripes, `sin(x)·sin(y)` gives checkers, `sin(distance)` gives rings.
4. **Black or white.** Above zero is ink and below zero is paper, with anti-aliased edges.
5. **Fake 3D.** Where the warp squeezes the pattern tight, it fades into shadow, so it reads as far away. The optional "chrome relief" lights the ink like raised metal.

## Files

| File | What's in it |
| --- | --- |
| `src/shaders.js` | All GLSL: warps, patterns, shading, brush distortion map, grain/vignette |
| `src/renderer.js` | WebGL2 setup and the three render passes |
| `src/catalog.js` | Pattern, warp and palette definitions (names, slider ranges) |
| `src/presets.js` | Base modes, formula recipes, formula building blocks |
| `src/state.js` | Default look, mutate/randomize, share-link encoding |
| `src/formula.js` | Friendly-math → GLSL compiler for Smart mode |
| `src/audio.js` | Song/mic analysis (bass, mids, highs, beats) |
| `src/ui.js` | Panel, tabs, sliders, tool dock |
| `src/main.js` | App state, frame loop, mouse/keyboard, saves, recording |

To add a preset, add an entry to `PRESETS` in `src/presets.js`. Only list what differs from `DEFAULTS` in `src/state.js`.
