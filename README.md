# trippy — op-art machine

Warp, ripple, twist and melt black-and-white op-art patterns in real time, in the browser. It can also make music videos out of them.

- **Presets**: 18 base modes (tunnels, spheres, moiré, whirlpools…). Reset always takes you back.
- **Mouse tools**: Move, Ripple, Smear, Bulge, Pinch, Twist. Bottom dock, or keys `1`–`6`.
- **Freeplay**: pick a pattern and stack up to 8 warps like effect pedals.
  - Merge in a **second pattern layer**: XOR for instant moiré, or *Inside 3D*, which paints it onto spheres and faces.
  - Tune motion, the **3D look** and a **film look**: cherry halation glow, color split, flicker, gate weave, letterbox.
- **Smart**: write the pattern as a formula (`sin(r*d - t*3)`). Every number gets its own knob.
- **Sound**: drop in a song (or use the mic). Loudness raises the *intensity* of the warps, not their speed.
- **Run**: music videos made of geometry.
  - **PPP — a film in geometry**: a 23-scene film choreographed to Beach House's *PPP*, cut on its 6/8 bar lines.
  - **Smart music mode**: give it any song and an auto-director cuts a brand-new film to it, different every time.
- **View menu** (the eye button): turn the top bar, panel, tool dock, brush ring, preset name or tips on and off. `H` hides everything.
- Mutate, Surprise, Undo, saves, share links, PNG and clip export (record a whole film run with its audio).

No build step and no dependencies: plain HTML + ES modules + WebGL2.

## The song

Songs are never committed or deployed (`*.mp3` is in `.gitignore`). Locally, keep `Beach House - PPP.mp3` next to `index.html` and the Run tab loads it automatically. On the hosted site, drop the file onto the page; it stays in your browser.

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
2. **Warp it.** Each warp pushes that position around: waves, twists, a bulge, noise, polar math that makes a tunnel or a floor, a ray-traced sphere or tilted plane, or the **Ghost** (an abstract face as a height field, so the pattern bends over its brow, eyes and mouth).
3. **Pattern.** A simple math shape at the warped position: `sin(x)` gives stripes, `sin(x)·sin(y)` gives checkers, `sin(distance)` gives rings. Optionally a second pattern is merged in.
4. **Black or white.** Above zero is ink and below zero is paper, with anti-aliased edges. The Ghost also shifts this threshold, so a face can appear in TV static like a halftone photo.
5. **Fake 3D.** Where a warp squeezes the pattern tight, it fades into shadow, so it reads as far away. 3D warps add real lighting.
6. **Film look.** Two scenes can be mixed with a transition, then halation glow, grain and the rest are added.

## How the music videos work

- `src/analysis.js` decodes the song once and measures:
  - loudness, plus bass, mid and treble envelopes
  - note onsets
  - tempo (autocorrelation of the onsets) and the beat grid
  - meter
  - section changes (where the sound shifts most)
- `src/director.js` plays a list of scenes against the song clock. Sway, flight and spin follow the bar and beat counters, loudness drives intensity, and strong onsets fire ripples and glitches. Everything is a function of song time, so scrubbing works.
- `src/scenes.js` holds reusable scene building blocks: ghost in the static, silk, halftone face, tilted world, sphere, moiré, floor, tunnel, glass lenses, chrome cloth, mandala, red bloom, afterglow.
- `src/shows/ppp.js` is the hand-made PPP film. `src/shows/auto.js` is the smart music mode, which applies the same rules automatically with a random seed.

## Files

| File | What's in it |
| --- | --- |
| `src/shaders.js` | All GLSL: warps, patterns, the ghost face, shading, brush distortion map, compositing + film look |
| `src/renderer.js` | WebGL2 setup, two scene slots, compositing |
| `src/catalog.js` | Pattern, warp, mix-mode and palette definitions (incl. the Depression Cherry reds) |
| `src/presets.js` | Base modes, formula recipes, formula building blocks |
| `src/state.js` | Default look, mutate/randomize, share-link encoding |
| `src/formula.js` | Friendly-math → GLSL compiler for Smart mode |
| `src/audio.js` | Live song/mic analysis for the Sound tab |
| `src/analysis.js` | Whole-song analysis for the music videos |
| `src/director.js`, `src/scenes.js`, `src/shows/*` | The music-video system |
| `src/ui.js` | Panel, tabs, sliders, tool dock, Run tab, View menu |
| `src/main.js` | App state, frame loop, mouse/keyboard, saves, recording, film playback |
