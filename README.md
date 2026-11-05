# trippi

Op-art patterns you can warp, raise figures through, and play music into. Give it a song: it listens to the whole thing and directs it.

No build step and no dependencies: plain HTML, ES modules and WebGL2.

## Using it

Everything fades away when you stop moving the mouse. At the bottom:

- **Patterns** (`P`): every look. Click one and the whole equation glides there.
  - **Solid**: flat, hard-edged black and white. Triangle Vortex, Endless Triangles (conformal: tiles keep their shape as they fall in for ever), Two Poles, Twin Whirlpools, Circle Limit (a real hyperbolic tiling, after Escher), Tumbling Blocks, Truchet, Blaze (after Riley), Stargate, Op Stripes, Squeeze, Vasarely…
  - **Strange**: patterns out of mathematics and sound. Cymatics and Chladni Sand (the note decides the figure), Crystal (families of straight lines, each sliding to its own part of the sound), Ink (real marbling: every kick and sung note drops ink on the water and pushes everything aside), Metamorphosis (squares melting into interlocking creatures), Planets, Khatam and Rosette (star lattices the tune sharpens), Lace, Julia (a fractal walking with the tune), Quasicrystal, Agate, Ripple Tank, Living Labyrinth (reaction-diffusion: it grows by itself)…
  - **Worlds**: the pattern as a place. Triangle Floor, Checker Hills, Line Landscape, Silk, Origami, Pulsar (the sound rolling away through thin lines), Pin Art (a bed of pins, pushed up by the sound), Hallway, Menger Sponge…
- **Figures** (`G`): shapes that come up through the sheet under your cursor, each cut hard against what's behind it. A figure is only a shape: it wears whatever pattern is showing, thrown across its surface and bent by it, so the same face looks different on every pattern. The Hand and The Face (lying in the sheet, its brow, nose, lips and chin above it and its sockets and hollows sunk below), and things grown and cut: Coral, Rope, Knot, Bloom, Star, Sponge. Hold the mouse and it reacts. Pick another and the first melts into it. Move the camera and you see it from another side.
- **Shifting a figure**: fold it round into a wheel, grow smaller copies out of it, cover the sheet with a field of them, twist and bend it, cut it into plates or shells, eat holes through it, build it out of cubes, send its outline rippling across the sheet. You can also change how far it bends the pattern, or swap the pattern on it for the negative, plain black or white, or stripes of its own. The **Shift** tool puts any two of those on your mouse (click it again to choose which); **Turn** spins and leans it; scroll sizes it; `[` and `]` fold it; `X` shifts it at random, `Z` puts it back. A song leaves figures out unless you ask for them in Sound.
  - *Other things to add* (in the same panel): a pair of hands, a ghost face, the chrome ball, orbs, you (the camera), a picture or words.
- **Sound** (`M`): pick a song (or drop one anywhere). It's listened to once and remembered; nothing is uploaded.
  - **Direct it for me** keeps the picture travelling with the song: a new scene every eight bars or so, each a slow morph out of the last that peaks on the beat where it lands, and a camera that never stops, turning, tilting from straight down to the horizon and back. Choose the **color** (B&W, one color, full), **figures** (none by default), **flat or 3D**, the **pace**, or **another take**.
  - **It follows**: *Flow* rides the tune (slides, swells, sway) and the drums barely touch it. *Even* mixes them. *Hit* lets the drums lead.
  - **Play live**: a guitar through an interface, or any mic. It tracks the note as you play.
  - The bar above the dock is the song's map: its loudness with the tune's line through it. Click to go there.
- **Tweak** (`T`): colors, this look's sliders, motion and camera; the rest folded away. Any slider can follow the music (its ∿ button), now including the melody, slides and sustain.

**Tools**, right of those: Ripple, Twist, Bulge, Pinch, Smear, Figure, Shift, Turn, Camera (`1`–`9`). Click the current one for its settings. Right-drag turns the camera with any tool; scroll zooms (with a figure's tools, it sizes the figure); double-click puts it back. The film icon (`C`) is the cinematic camera.

**Top right**: Surprise (`D`), and behind `···`: Breed this look (`E`), pause, picture, record (with the song), link, fullscreen, hide everything (`H`), and three switches: the ring around the cursor, wandering (left alone for a while with no song, the camera sets off and the looks turn slowly into each other), and 60 fps.

To go back to the version before this revamp: `git checkout before-revamp`.

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

## How it works

- **One ray-marched world** (`src/engine/shader.js`): a sheet with a height field, and things joined to it with soft unions so the pattern pours over them. Flat looks are the same world seen straight on.
- **One equation painted on every surface**: lines, rings, tunnels, spirals, checkers and triangles are weighted terms of one formula, with warps on top (twist, vortex, conformal maps, a floor and ceiling). Patterns that aren't lines (hyperbolic tiles, Truchet, cymatics, Julia, quasicrystal, reaction-diffusion) each give a value that crosses zero at its edges, so one threshold draws them all and they crossfade.
- **A figure** (`src/engine/forms.js`) is a real solid, a distance function joined softly to the sheet, so its outline cuts against what's behind it. Most are short formulas where space is folded rather than shapes added: Coral is six capsules, each generation mirroring space, and comes out as a whole tree; Star folds space into one wedge of an icosahedron and has one facet. The Face is sculpted in `tools/` and baked into a 3D distance grid, so it's one texture read per step however many shapes went into it. The shifts are the same trick, done live to any of them. Rays that pass nowhere near the figure use a separate loop without it in, since on a GPU code in a loop costs time on every step whether it runs or not. `node tools/bake.mjs` rebuilds the grid.
- **New patterns open out through the old one**: a pattern that isn't lines takes over from a wandering front spreading from the middle of the view, instead of fading across it, because two patterns half mixed are only blotches.
- **Ink** (`src/ink.js`) is marbling by the exact formula: each drop is a list entry, and each pixel is traced back through the list, newest first, until it lands inside one.
- **Listening to a song** (`src/listen.js`, in a worker):
  - harmonic/percussive separation by median-filtering the spectrogram, so drums and sustained sound are two signals;
  - the melody: peaks of a long FFT → harmonic salience → a Viterbi path that prefers to move smoothly, fine enough to follow a slide guitar through its bends;
  - chords and key; dynamic-programming beats; sections from a self-similarity novelty curve, each given a character (hush, flow, swell, pulse, peak).
- **What it does with that** (`src/music.js`, `src/main.js`): the tune's curve is a row of a texture and flows out through the lines; the world leans with a slow version of it; a slide pushes the pattern along as the note moves. Drums are soft pushes that never touch the camera.
- **The film** (`src/score.js`): scenes chosen per section, seeded by the song, so it can be rewound.
- **The camera** (`src/director.js`): a curve through a series of poses, so it arrives at each still moving and never stops dead or cuts. It knows what the score has coming, so the pose it's heading for suits what will be showing when it gets there. Going from black-on-white to white-on-black doesn't fade through gray: the negative spreads out from the middle.

## Files

| File | What's in it |
| --- | --- |
| `src/engine/shader.js` | The world, the line equation, the other patterns, color |
| `src/engine/forms.js` | The figures, their shifts, and the shader code for all of it |
| `tools/` | The workshop: `sculpts.mjs` (the solids), `solid.mjs` (baking a distance grid), `bake.mjs` |
| `src/ink.js` | The marbling, painted by the song |
| `src/engine/params.js`, `looks.js`, `world.js`, `feel.js` | Every value; the looks and palettes; gliding between them; breeding |
| `src/engine/camera.js` | The camera on the CPU; a point on the screen → a point on the sheet |
| `src/listen.js`, `listen.worker.js` | Listening to a whole song |
| `src/music.js` | What the music is doing right now, from the analysis or live |
| `src/score.js` | Scenes for a song |
| `src/adds.js`, `src/director.js` | The figure's motion and the other add-ons; the cinematic camera |
| `src/media.js`, `src/tracking.js` | The camera, pictures, video, words; face / hand / body tracking |
| `src/audio.js`, `src/songs.js` | Live audio, live pitch; your song library and what was heard |
| `src/gl/renderer.js`, `src/gl/passes.js` | WebGL2: the world pass, brushes, reaction-diffusion, finishing |
| `src/ui/ui.js`, `src/ui/kit.js`, `styles.css` | The interface |
| `src/main.js` | App state, tools, frame loop, songs, recording, links |
| `assets/figures/` | The gallery's thumbnails |
| `assets/solids/` | The baked solids |
