# trippi

Op-art patterns you can warp, drown figures in, and play music into. Give it a song: it listens to the whole thing and directs it.

No build step and no dependencies: plain HTML, ES modules and WebGL2.

## Using it

Everything fades away when you stop moving the mouse. At the bottom:

- **Patterns** (`P`): every look. Click one and the whole equation glides there.
  - **Solid**: flat, hard-edged black and white. Triangle Vortex, Endless Triangles (conformal: tiles keep their shape as they fall in for ever), Two Poles, Twin Whirlpools, Circle Limit (a real hyperbolic tiling, after Escher), Tumbling Blocks, Truchet, Blaze (after Riley), Stargate, Op Stripes, Squeeze, Vasarely…
  - **Strange**: patterns out of mathematics and sound. Cymatics and Chladni Sand (the note decides the figure), Julia (a fractal walking with the tune), Quasicrystal, Agate, Ripple Tank, Living Labyrinth (reaction-diffusion: it grows by itself)…
  - **Worlds**: the pattern as a place. Triangle Floor, Checker Hills, Line Landscape, Silk, Origami, Hobnail, Hallway, Menger Sponge…
- **Figures** (`G`): things going under, or coming up. All silhouette, posed at an angle with the sheet cutting across them.
  - *People*: the Hand, Not Waving, Creation, Skull, Ophelia, Icarus, Medusa, The Scream, The Lovers, Son of Man, Praying, Wanderer.
  - *Beasts*: The Fluke, Sea Serpent, Kraken, Dalí's Elephant, Stag, Goya's Dog.
  - *Monuments*: The Liner, Liberty, Moai, Steeple, Isle of the Dead, Providence, The Moon, The Eye, Monolith.
  - Pick one and it comes up under your cursor and follows it exactly, leaning into the move and leaving a wake. Hold the mouse to bring it further out. Pick it again to let it sink.
  - **Contours** draws it in its own sounding lines; **Silhouette** makes it a solid shape with a line of paper round it; **Draped** pours the pattern over it like the hand. **A crowd of them** makes a sea.
  - *Other things to add* (in the same panel): a pair of hands, a ghost face, the chrome ball, orbs, you (the camera), a picture or words.
- **Sound** (`M`): pick a song (or drop one anywhere). It's listened to once and remembered; nothing is uploaded.
  - **Direct it for me** changes scenes with the song, landing them on its sections. Choose the **color** (B&W, one color, full), how many **figures**, **flat or 3D**, the **pace**, or **another take**.
  - **It follows**: *Flow* rides the tune (slides, swells, sway) and the drums barely touch it. *Even* mixes them. *Hit* lets the drums lead.
  - **Play live**: a guitar through an interface, or any mic. It tracks the note as you play.
  - The bar above the dock is the song's map: its loudness with the tune's line through it. Click to go there.
- **Tweak** (`T`): colors, this look's sliders, motion and camera; the rest folded away. Any slider can follow the music (its ∿ button), now including the melody, slides and sustain.

**Tools**, right of those: Ripple, Twist, Bulge, Pinch, Smear, Figure, Camera (`1`–`7`). Click the current one for its size and strength. Right-drag turns the camera with any tool; scroll zooms; double-click puts it back. The film icon (`C`) is the cinematic camera.

**Top right**: Surprise (`D`), and behind `···`: Breed this look (`E`), pause, picture, record (with the song), link, fullscreen, hide everything (`H`), and 60 fps.

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
- **A figure** (`src/engine/figures.js`) is a signed distance function with a pose, a waterline, and a bounding sphere. The fabric melts into it at the waterline and lets go higher up; rays that miss its sphere never evaluate it; a shader is compiled with only the figure on screen. The cursor is cast as a real ray onto the sheet (`src/engine/camera.js`), so it holds at any camera angle.
- **Listening to a song** (`src/listen.js`, in a worker):
  - harmonic/percussive separation by median-filtering the spectrogram, so drums and sustained sound are two signals;
  - the melody: peaks of a long FFT → harmonic salience → a Viterbi path that prefers to move smoothly, fine enough to follow a slide guitar through its bends;
  - chords and key; dynamic-programming beats; sections from a self-similarity novelty curve, each given a character (hush, flow, swell, pulse, peak).
- **What it does with that** (`src/music.js`, `src/main.js`): the tune's curve is a row of a texture and flows out through the lines; the world leans with a slow version of it; a slide pushes the pattern along as the note moves. Drums are soft pushes that never touch the camera.
- **The film** (`src/score.js`): scenes chosen per section, seeded by the song, so it can be rewound.

## Files

| File | What's in it |
| --- | --- |
| `src/engine/shader.js` | The world, the line equation, the other patterns, color |
| `src/engine/figures.js` | The figure library, each with its pose and waterline |
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
