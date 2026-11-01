# trippy — op-art machine

A browser playground for trippy black-and-white op art, from flat patterns to a 3D world of lines. It also makes music videos.

**Three modes** (switch at the top of the panel):

- **Worlds**: one 3D world made of lines.
  - Pick a look (silk, hands pressing through fabric, a line landscape, rising orbs, an endless road, a tunnel, chrome, a fly-through lattice, mandalas…) and *everything glides there*. The equation re-forms instead of cutting.
  - Auto-morph changes the look on the bar. Play a song or use the mic, and loudness drives intensity while the bar drives the sway.
  - The **Hand** tool turns your cursor into a hand pressing through the fabric from behind.
- **Patterns**: flat op art. Presets, mouse tools (ripple, smear, bulge, pinch, twist), a warp stack, a second pattern layer, formulas with a knob for every number, and a film look.
  - Every slider has a **∿** button that ties it to the music: bass, mids, highs, loudness, beat, bar or a slow wave.
- **Films**: music videos.
  - **PPP — a film in lines**: a 17-chapter film choreographed to Beach House's *PPP*, one continuous morph on its 6/8 bar lines.
  - **Smart music mode** writes a new film for any song, different every time.

Also: a View menu (the eye button) that toggles each piece of the interface including the brush ring, `H` to hide everything, saves, share links, PNG export and video recording (a whole film run with its audio).

No build step and no dependencies: plain HTML + ES modules + WebGL2.

## The song

Songs are never committed or deployed (`*.mp3` is in `.gitignore`). Locally, keep `Beach House - PPP.mp3` next to `index.html` and the Films mode loads it automatically. On the hosted site, drop the file onto the page; it stays in your browser.

## Run it locally

ES modules need a web server. From this folder, run either of these:

```bash
npx serve .
```

```bash
python3 -m http.server 8000
```

## Deploy on Vercel

Import the GitHub repo in Vercel and keep the defaults: Framework Preset **Other**, no build command, and the root as the output directory. Every push to `main` redeploys.

## How the film world works (`src/film`)

- **One ray-marched scene.** A membrane of lines with a height field (silk folds, ripples, the ghost face).
  - Things push through it from behind: jointed 3D hands whose fingers curl on the bar, and a grid of rising orbs.
  - A soft union stretches the lines over them like fabric; a hard union lets them break through.
  - The membrane can melt into a gyroid / Schwarz-P lattice, because the distance fields are blended rather than swapped.
- **One line equation, painted on every surface.** Straight lines, rings, a 1/r tunnel, spirals, crossing lines, moiré and contour slices are all weighted terms of a single formula. Change the weights and one pattern becomes another.
- **Lighting can thin the ink** where light hits (engraving), so 3D form is drawn with lines alone.
- **Every look is ~100 numbers** (`params.js`, `looks.js`).
  - A film is a list of keyframes: "from bar N, glide these numbers to here over M bars" (`timeline.js`).
  - Speeds are integrated, and spins and orbits settle back to rest, so nothing jumps.
  - Music is applied every frame: the bar drives the sway, loudness the intensity, bass the thump, mids the face's mouth, and onsets a flash.
- **Song analysis** (`src/analysis.js`) runs once per song and measures:
  - loudness, plus bass, mid and treble envelopes
  - note onsets
  - tempo (autocorrelation of the onsets) and the beat grid
  - meter
  - section changes
- **`ppp.js`** is the hand-made PPP film. **`auto.js`** writes films for any song with the same rules.

## Files

| File | What's in it |
| --- | --- |
| `src/film/shader.js` | The film world: ray-marched membrane, hands, orbs, lattice, the line equation, lighting |
| `src/film/params.js` | Every film-world knob: ranges, groups, shader slots |
| `src/film/looks.js` | Looks (shared by the films, the smart films and Worlds) |
| `src/film/timeline.js` | Keyframes → per-parameter tracks, integrated speeds, music modulation |
| `src/film/ppp.js`, `src/film/auto.js` | The PPP film; the smart film writer |
| `src/world.js` | Worlds mode: the film engine live, glides, auto-morph, the hand tool |
| `src/shaders.js`, `src/renderer.js` | Patterns-mode GLSL; WebGL2 setup, film pass, compositing + film look |
| `src/catalog.js`, `src/presets.js`, `src/state.js` | Patterns: patterns, warps, palettes (incl. the Depression Cherry reds), presets, state |
| `src/formula.js` | Friendly-math → GLSL compiler for the Math tab |
| `src/audio.js`, `src/analysis.js` | Live audio analysis; whole-song analysis |
| `src/ui.js`, `src/main.js` | Interface; app state, frame loop, input, film playback, recording |
