# trippi

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
- **Tweak**: change the look you're on, most-used first.
  - Color palettes, one click each.
  - The four sliders that matter most for this look.
  - Lines and motion: line count, weight, spin, flow, waves rolling through.
  - **Camera**: tilt toward the horizon, turn and zoom, or switch on the **cinematic camera**.
    - It sweeps from shot to shot on the bar: straight down, high, low across the lines to the horizon, tilted.
    - In between it keeps flying: forward across open looks like a drone over a landscape, banking into its turns; around looks with a middle, circling them.
    - **Speed** runs from drifting to racing. It can change the look as it goes and send waves through the lines.
  - Three feel knobs that work on every look: Calm ↔ Wild, Still ↔ Moving, Thin ↔ Bold.
  - Folded away: your own colors (a second ink on every other line, a color cycle, glow) and everything else by group.
  - Tweaks stay with their look until you **Reset** it. A pink dot marks what you changed; double-click a slider to put just that one back. **Save** keeps a tweaked look in Looks.
- **Add**: things you can put into any look. None is on until you add it, and you can pin any of them to the toolbar.
  - **You (camera)**, with quick setups: Just me, Playing guitar, Hands & guitar, Lines over me, My face, Movement. Everything is worked out in the browser; no picture leaves your computer.
  - **Hands**: a mirrored pair pressing through, or a copy of yours, finger by finger.
  - **Figures**: shapes rising out of the sheet like the hands, drawn by the look's own lines bending over them. Their hollows (eye sockets, mouths, a pupil, a tunnel) go deep, through the fabric too. They turn to face the camera: from above they push up through the sheet; to a low camera they stand up out of the floor. Picking another in the same group makes the old one re-form into the new one; one from another group comes up after the old one sinks away. "Change with the music" moves on every few bars, within the group. They can also turn, follow your mouse, repeat across the sheet, sit tight or loose under the fabric, and push through more or less.
    - *Presences*: a skull (its jaw moves with the music), a smooth ghost-in-the-shell face, the same face as a hollow mask, the Scream, singing lips, a breathing ribcage over a pit, someone trapped behind the sheet with palms pressed flat, an arm reaching out, Magritte's veiled Lovers, a Vitruvian figure, a meditator with a halo, praying hands.
    - *Creatures*: a coiled serpent with its head up, a cobra, tentacles curling up from underneath, a pulsing jellyfish, a nautilus cut open to its chambers, mushrooms, a raven (wings beat with the music), a moth, a stag skull with antlers, a sitting cat.
    - *Symbols*: an eyeball that follows you (its pupil a hole), a portal with a tunnel through the sheet, a trefoil knot, a hollow lattice orb, a tesseract that breathes with the music, a turning Merkaba, an ouroboros round a hole.
    - **Drag any figure onto the toolbar** and it becomes a tool like the hand: it follows your cursor under the sheet and pushes through while you hold. Drag along the toolbar to reorder; right-click or drag off to remove.
  - **Ghost face**: a face in the lines, or a copy of yours.
  - **Ball**: a chrome ball the lines part around, with a turbulent wake (after Tame Impala's *Currents*). With music it hops on the beat and ripples where it lands.
  - **Orbs** rising through the sheet.
  - **Picture**: an image, a video or words.
- **Sound**: your songs and how they move the picture.
  - Songs you add are kept in this browser (IndexedDB) so you can flip between them. Nothing is uploaded.
  - **Play live**: pick an input (a guitar through an audio interface such as a Focusrite, a headset mic, any mic).
    - The browser's call processing (echo cancelling, noise suppression, auto gain) is off, and the input is mixed to mono so input 1 alone still fills both speakers.
    - **Hear it through the speakers, like an amp**, with a volume, an input level, and a choice of output device (Chrome / Edge).
    - Strums and plucks count as beats.
  - **How hard it hits**: Off, Subtle, Lively (the default) or Wild.
  - **The sound itself**:
    - Each line carries the waveform from a slightly different moment: the newest down the middle, older ones further out, mirrored. The lines ripple outward with what you hear, and the waveform is auto-gained so a quiet guitar still makes big waves.
    - Rings carry it round the circle and spike with the spectrum.
    - The sheet can rise into a landscape of the spectrum, and the rolling waves grow when it's loud.
  - What the music does to things you've added (the ball hops, the hands grab, the orbs swell).
  - **Ties**: any slider can follow the bass, mids, highs, loudness, the beat or the bar (its ∿ button).
  - Tempo, and changing look by itself (off unless you turn it on).

**The toolbar:**
- The left button uses the chosen tool:
  - **Ripple**.
  - **Twist**: hold it and it keeps winding, round and round; Alt or Option winds the other way.
  - **Bulge**, **Pinch** and **Smear**.
  - **Hand**: your cursor presses through from behind.
  - **Camera**: drag to turn and tilt (drag up to look out to the horizon); Shift-drag slides.
- Right-drag turns the camera with any tool. Scroll zooms; double-click puts the view back.
- **Cinematic** (or `C`) hands the camera to the cinematic director.
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
  - As the sound itself: a texture holding the live waveform (triggered so it stands still), its last ~2 s, and ~2.7 s of log-spaced spectrum, which all bend the line equation.

## Files

| File | What's in it |
| --- | --- |
| `src/engine/shader.js` | The world: ray-marched sheet, hands, objects, spaces, the ball, the line equation, lighting, color |
| `src/engine/params.js` | Every value of the world: ranges, groups, shader slots |
| `src/engine/looks.js` | The looks (grouped, with their key sliders) and the color palettes |
| `src/engine/world.js` | Gliding between looks, speeds, the music applied every frame |
| `src/engine/feel.js` | The three feel knobs and breeding (Explore) |
| `src/adds.js` | Add-ons: the ball's motion, the pair of hands, figures, the face, orbs |
| `src/engine/figures.js` | The figure library: each one a 3D shape in GLSL. The world's shader is built with just the groups on screen, in the background |
| `src/director.js` | The cinematic camera: shots, glides on the bar, drift |
| `src/media.js`, `src/tracking.js` | The camera, pictures, video and words; face / hand / body / motion tracking (MediaPipe) |
| `src/audio.js`, `src/analysis.js`, `src/songs.js` | Live audio (levels, beat, waveform, spectrum); tempo from a song; your song library |
| `src/gl/renderer.js`, `src/gl/passes.js` | WebGL2: the world pass, brush distortion, picture relief, finishing pass |
| `src/ui/ui.js`, `src/ui/kit.js` | The interface |
| `src/main.js` | App state, looks and tweaks, tools, frame loop, songs, camera, recording, links |
