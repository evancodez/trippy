# trippy

A world of black-and-white op-art lines you can warp, ripple, twist and play music into. It can be flat or 3D.

No build step and no dependencies: plain HTML, ES modules and WebGL2.

## How it's laid out

The side panel has four tabs.

- **Looks**: every look, grouped by kind. Click one and everything glides there; the equation re-forms instead of cutting.
  - **Lines**: Op Stripes, Squeeze, Lightning.
  - **Rings & tunnels**: Ghost Rings, Tunnel, Square Tunnel, Diamonds, Spiral, Whirlpool.
  - **Tiles**: Triangle Vortex, Vasarely, Dot Tunnel, Mandala.
  - **3D sheets**: Silk, Chrome Silk, Line Landscape, Checker Hills, Triangle Floor, Endless Road, Dot Field, Orb Field.
  - **Fly through**: Hallway, Triangle Shaft, Ring Tunnel, Lattice, Menger Sponge, Fractal Crystals, Colonnade.
  - **Objects**: Striped Ball, Lumpy Blob, Impossible (Penrose), Möbius, Gyroscope.
- **Tweak**: change the look you're on.
  - Three feel knobs that work on every look: Calm ↔ Wild, Still ↔ Moving, Thin ↔ Bold.
  - The four sliders that matter most for this look.
  - Lines and motion: line count, weight, angle, turn, spin, flow.
  - Color: palettes, your own colors, a second ink on every other line, a color cycle, glow.
  - Everything else, folded away by group.
  - Tweaks stay with their look until you **Reset** it. A pink dot marks what you changed; double-click a slider to put just that one back. **Save** keeps a tweaked look in Looks.
- **Add**: things you can put into any look. None is on until you add it, and you can pin any of them to the toolbar.
  - **You (camera)**, with quick setups: Just me, Playing guitar, Hands & guitar, Lines over me, My face, Movement. Everything is worked out in the browser; no picture leaves your computer.
  - **Hands**: a mirrored pair pressing through, or a copy of yours, finger by finger.
  - **Face**: a ghost face, or a copy of yours.
  - **Ball**: a chrome ball the lines part around, with a turbulent wake (after Tame Impala's *Currents*). With music it hops on the beat and ripples where it lands.
  - **Orbs** rising through the sheet.
  - **Picture**: an image, a video or words.
- **Sound**: your songs and how they move the picture.
  - Songs you add are kept in this browser (IndexedDB) so you can flip between them. Nothing is uploaded.
  - **How hard it hits**: Off, Subtle, Lively (the default) or Wild.
  - **The sound itself**: the waveform runs through the lines like an oscilloscope, rings spike with the spectrum, and the sheet can rise into a landscape of it.
  - What the music does to things you've added (the ball hops, the hands grab, the orbs swell).
  - **Ties**: any slider can follow the bass, mids, highs, loudness, the beat or the bar (its ∿ button).
  - Tempo, and changing look by itself (off unless you turn it on).

**The toolbar:**
- The left button uses the chosen tool:
  - **Ripple**.
  - **Twist**: hold it and it keeps winding, round and round; Alt or Option winds the other way.
  - **Bulge**, **Pinch** and **Smear**.
  - **Hand**: your cursor presses through from behind.
  - **Move**.
- Right-drag moves the view with any tool. Scroll zooms; double-click puts the view back.
- *Size*, *Strength* and *Spring back* shape the tools.
- Add-ons you pin show up as switches.

**Top bar:** Surprise and Explore (breed 8 variations of what you're looking at; pick one, repeat), then pause, picture, record (with the song), link, fullscreen and what's on screen. `H` hides everything.

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

- **One ray-marched world** (`src/engine/shader.js`):
  - A sheet of lines with a height field: folds, ripples, the face, the picture and the sound's landscape.
  - Things that push through it: hands, orbs, objects, the ball. Soft unions stretch the lines over them like fabric.
  - Spaces the sheet can melt into: a lattice, a Menger sponge, fractal crystals, a corridor. The floor can also drop away and leave objects floating.
  - Flat looks are the same world seen straight on.
- **One line equation**, painted on every surface:
  - Straight lines, rings (round, square or diamond), a 1/r tunnel, spirals, checkers, triangles, moiré and contours are all weighted terms of one formula.
  - On top go twist, vortex, bulge, waves or zigzags, melt, a squeeze band and a kaleidoscope.
  - The lines are projected onto the world, or *wrapped* round walls and objects.
- **A look is ~150 numbers** (`src/engine/params.js`, `src/engine/looks.js`).
  - The world glides between them (`src/engine/world.js`).
  - Speeds are added up per bar, so spins and flight stay smooth and settle back to rest.
- **The music** arrives two ways:
  - As levels: bass, mids, highs, loudness, beats and a bar clock (`src/audio.js`; the tempo comes from `src/analysis.js`).
  - As the sound itself: a texture holding the live waveform (triggered so it stands still) and ~2.7 s of log-spaced spectrum, which both bend the line equation.

## Files

| File | What's in it |
| --- | --- |
| `src/engine/shader.js` | The world: ray-marched sheet, hands, objects, spaces, the ball, the line equation, lighting, color |
| `src/engine/params.js` | Every value of the world: ranges, groups, shader slots |
| `src/engine/looks.js` | The looks (grouped, with their key sliders) and the color palettes |
| `src/engine/world.js` | Gliding between looks, speeds, the music applied every frame |
| `src/engine/feel.js` | The three feel knobs and breeding (Explore) |
| `src/adds.js` | Add-ons: the ball's motion, the pair of hands, the face, orbs |
| `src/media.js`, `src/tracking.js` | The camera, pictures, video and words; face / hand / body / motion tracking (MediaPipe) |
| `src/audio.js`, `src/analysis.js`, `src/songs.js` | Live audio (levels, beat, waveform, spectrum); tempo from a song; your song library |
| `src/gl/renderer.js`, `src/gl/passes.js` | WebGL2: the world pass, brush distortion, picture relief, finishing pass |
| `src/ui/ui.js`, `src/ui/kit.js` | The interface |
| `src/main.js` | App state, looks and tweaks, tools, frame loop, songs, camera, recording, links |
