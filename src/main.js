// trippi — the app: state, the frame loop, the tools, songs, the camera, recording and links.
//
// One world (src/engine) renders every look, flat or 3D. You pick a look, tweak it (tweaks are kept per
// look for this session, and Reset puts the look back), add things to it, and choose how the sound moves it.
import { Renderer, MAX_RIPPLES } from './gl/renderer.js';
import { World, defaultValues, cloneValues, stepFactor, mulberry32 } from './engine/world.js';
import { LOOKS, GROUPS, NEUTRAL, look, PALETTES, COLOR_KEYS, camKind } from './engine/looks.js';
import { PARAM_BY_NAME, hexToRgb, rgbToHex, isColorParam, DEFAULTS } from './engine/params.js';
import { applyFeel, defaultFeel, breed } from './engine/feel.js';
import { ADDS, defaultAdds, Ball, Figures, applyHands, applyFace, applyOrbs } from './adds.js';
import { FIGURES, FIGURE_INDEX, figureBank } from './engine/figures.js';
import { rayOnSheet } from './engine/camera.js';
import { Director } from './director.js';
import { AudioEngine } from './audio.js';
import { SongLibrary, isSong, loadListened, saveListened } from './songs.js';
import { Music } from './music.js';
import { buildScore, defaultOptions, paletteSet, sceneAt } from './score.js';
import { Media } from './media.js';
import { Tracker } from './tracking.js';
import { createUI, TOOLS } from './ui/ui.js';

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  const f = document.getElementById('fatal');
  f.hidden = false;
  f.textContent = `Your browser couldn’t start WebGL2 (${e.message}). Try a recent Chrome, Edge, Firefox or Safari.`;
  throw e;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-dt * rate));
const SAVE_KEY = 'trippy.saves.v2';

// what the picture follows. Melody: how much it rides the tune (sway, slides, the melody's curve through
// the pattern); drums: how much a hit moves it; scope: the raw waveform and spectrum in the lines
const MOODS = {
  flow: { name: 'Flow', blurb: 'it rides the tune: slides, swells, sway. The drums barely touch it', melody: 1, drums: 0.12, scope: 0, decay: 5 },
  even: { name: 'Even', blurb: 'the tune and the beat together', melody: 0.75, drums: 0.45, scope: 0.12, decay: 6 },
  hit: { name: 'Hit', blurb: 'the drums lead, and the lines carry the waveform', melody: 0.45, drums: 1, scope: 0.6, decay: 8 },
  off: { name: 'Off', blurb: 'the music changes nothing', melody: 0, drums: 0, scope: 0, decay: 7 },
};

const app = {
  renderer, canvas,
  world: new World(),
  lookId: 'trivortex',
  tweaks: {},               // per look, this session: { trivortex: { vortex: 3, … } }. Reset clears a look's.
  keepColors: false,        // carry your colors from look to look
  colors: null,             //   …the colors being carried
  feel: defaultFeel(),
  adds: defaultAdds(),
  // the camera: what counts as you, and how it (or a picture) shows
  cam: { subject: 'body', feather: 6, box: { x: 0.5, y: 0.55, w: 0.6, h: 0.7 }, look: false, motion: false, setup: 'me' },
  show: { photo: 0.9, relief: 0.4, engrave: 0, photoColor: 0, detail: 0.85, soft: 2.4, calm: 1, aura: 0.7, size: 1, x: 0, y: 0, invert: 0, warp: 0 },
  // the sound
  MOODS,
  music: new Music(),
  sound: { ballBounce: 0.5, handsGrab: 0.5, orbsBass: 0.8, amount: 1, spectrum: 0, land: 0 },
  // the song, directed: scenes picked from what it was heard to do
  film: { ...defaultOptions(), score: null, listening: 0, scene: -1, held: -1, status: '' },
  devices: { inputs: [], outputs: [] },    // audio inputs and outputs, once the browser lets us name them
  ties: {},                 // a value → a music source: { bulge: { src: 'bass', amt: 0.3 } }
  tempo: { bpm: 70, beatsPerBar: 2, fromSong: false },
  // the cinematic camera: glides from shot to shot on the bar; can change the look as it goes
  cine: { on: false, speed: 0.6, looks: true, every: 2, groups: GROUPS.map(g => g[0]), waves: 0.6 },
  director: new Director(),
  // tools, and your own camera moves (on top of the look's, or the director's)
  tool: 'ripple',
  brush: { size: 0.16, strength: 0.7, spring: 0.35 },
  view: { panX: 0, panY: 0, zoom: 1, yaw: 0, pitch: 0 },
  glide: 2.5,               // seconds to glide to a new look
  paused: false,
  recording: null,
  saves: loadSaves(),
  thumbs: {},
  explore: { open: false, parent: null, kids: [], history: [], strength: 0.5, locks: { colors: false, camera: false, shapes: false, lines: false } },
  audio: new AudioEngine(),
  songs: new SongLibrary(),
  media: new Media(),
  tracker: new Tracker(),
  ball: new Ball(),
};
let ui = null;

// everything that moves every frame
const rt = {
  realTime: 0, stepK: 0.6,
  ripples: new Float32Array(MAX_RIPPLES * 4),
  twists: new Float32Array(16),
  fingers: new Float32Array(15),
  handMirror: new Float32Array([1, -1, 1]),
  brush: { x: 0, y: 0, vx: 0, vy: 0, size: 0.16, strength: 0.7, mode: 0, relax: 0.97 },
  snareT: 0, livingEnergy: 0, livingSpot: null, livingSteps: 8,
};
let rippleIdx = 0;
function spawnRipple(x, y, strength) {
  rt.ripples.set([x, y, rt.realTime, strength], rippleIdx * 4);
  rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
}

// ------------------------------------------------------------------ looks and tweaks
// the values a look starts from: its own, then your tweaks to it (and your carried colors)
function lookValues(id) {
  const set = look(id);
  Object.assign(set, app.tweaks[id]);
  if (app.keepColors && app.colors) Object.assign(set, app.colors);
  return set;
}

app.pickLook = (id, seconds = app.glide) => {
  if (!LOOKS[id]) return;
  app.lookId = id;
  if (app.film?.score) app.film.held = app.film.scene;        // you chose: the film carries on from the next scene
  app.world.morphTo(lookValues(id), seconds);
  ui?.lookChanged();
};
app.isEdited = id => Object.keys(app.tweaks[id] || {}).length > 0;
app.lookValue = key => {
  const x = app.world.to[key];
  return Array.isArray(x) ? rgbToHex(x) : x;
};
// a slider: change this look, now, and remember it for this look
app.tweak = (key, value, { glide = 0 } = {}) => {
  (app.tweaks[app.lookId] ||= {})[key] = value;
  if (app.keepColors && COLOR_KEYS.includes(key)) (app.colors ||= {})[key] = value;
  if (glide) app.world.morphTo({ [key]: value }, glide);
  else app.world.set(key, value);
  ui?.lookEdited();
};
app.applyPalette = pal => {
  const set = {};
  for (const k of COLOR_KEYS) set[k] = pal[k] ?? NEUTRAL[k];
  Object.assign((app.tweaks[app.lookId] ||= {}), set);
  if (app.keepColors) app.colors = { ...set };
  app.world.morphTo(set, 0.8);
  ui?.lookEdited(true);
};
app.setKeepColors = on => {
  app.keepColors = on;
  app.colors = on ? Object.fromEntries(COLOR_KEYS.map(k => [k, app.lookValue(k)])) : null;
};
app.resetLook = () => {
  delete app.tweaks[app.lookId];
  app.keepColors = false;
  app.colors = null;
  app.world.morphTo(look(app.lookId), 1.2);
  ui?.lookEdited(true);
  ui?.toast(`${LOOKS[app.lookId].name} is back to how it starts`);
};
app.resetFeel = () => { app.feel = defaultFeel(); };

app.surprise = () => {
  const ids = Object.keys(LOOKS).filter(k => k !== app.lookId);
  const r = Math.random;
  const id = ids[Math.floor(r() * ids.length)];
  if (r() < 0.35) app.tweaks[id] = { ...app.tweaks[id], ...Object.fromEntries(COLOR_KEYS.map(k => [k, PALETTES[Math.floor(r() * PALETTES.length)][k] ?? NEUTRAL[k]])) };
  app.pickLook(id);
};
app.stepLook = d => {
  const ids = Object.keys(LOOKS), i = ids.indexOf(app.lookId);
  app.pickLook(ids[(i + d + ids.length) % ids.length]);
};

// the tweaks that make `values` out of the look's own (for Explore and saves)
function tweaksFrom(values, id) {
  const base = look(id), out = {};
  for (const [k, x] of Object.entries(values)) {
    if (!PARAM_BY_NAME[k] || !PARAM_BY_NAME[k].group) continue;
    const b = base[k] ?? DEFAULTS[k];
    const xv = Array.isArray(x) ? rgbToHex(x) : x;
    if (isColorParam(k) ? String(xv).toLowerCase() !== String(b).toLowerCase() : Math.abs(xv - b) > 1e-4) out[k] = xv;
  }
  return out;
}

// ------------------------------------------------------------------ Explore: 8 children of what you're looking at
app.exploreBreed = (parent = app.explore.parent) => {
  const X = app.explore;
  X.parent = parent;
  X.kids = Array.from({ length: 8 }, () => ({ set: breed(parent, X.strength, X.locks, (Math.random() * 1e9) | 0), img: null }));
  X.parentImg = still(parent);
  ui.renderExplore();
  X.kids.forEach((k, i) => setTimeout(() => {
    if (X.kids[i] !== k) return;
    k.img = still(k.set);
    ui.renderExplore();
  }, 30 * (i + 1)));
};
app.exploreOpen = () => {
  app.explore.open = true;
  app.explore.history = [];
  app.exploreBreed(cloneValues(app.world.to));
};
app.explorePick = i => {
  const X = app.explore, kid = X.kids[i];
  if (!kid) return;
  X.history.push(X.parent);
  app.tweaks[app.lookId] = tweaksFrom(kid.set, app.lookId);
  app.world.morphTo(kid.set, 1.5);
  ui.lookEdited(true);
  app.exploreBreed(kid.set);
};
app.exploreBack = () => {
  const X = app.explore, prev = X.history.pop();
  if (!prev) return;
  app.tweaks[app.lookId] = tweaksFrom(prev, app.lookId);
  app.world.morphTo(prev, 1);
  ui.lookEdited(true);
  app.exploreBreed(prev);
};
app.exploreClose = () => { app.explore.open = false; ui.renderExplore(); };

// ------------------------------------------------------------------ stills (thumbnails, Explore)
let stillR = null;
const quietMusic = { on: false, beat: false, bar: 0.3, barLen: 1.7, loud: 0.5, bass: 0, mid: 0.2, high: 0, hit: 0, time: 2 };
function still(set, w = 320, h = 200) {
  if (!stillR) stillR = new Renderer(document.createElement('canvas'), { preserve: true });
  stillR.resize(w, h);
  const W = new World();
  W.morphTo(set, 0.05);
  const stillRt = { realTime: 0, ripples: new Float32Array(MAX_RIPPLES * 4), twists: new Float32Array(16), fingers: new Float32Array(15), handMirror: rt.handMirror, stepK: 0.6, livingSteps: 900 };
  const { P, post } = W.frame(1, quietMusic);
  stillRt.stepK = stepFactor(W.current);
  stillR.clearEcho();
  stillR.render(P, stillRt, { ...post, grain: 0.03 });
  return stillR.canvas.toDataURL('image/jpeg', 0.82);
}
app.thumb = id => (app.thumbs[id] ||= still(look(id)));

// ------------------------------------------------------------------ the music clock
const clock = { tapTimes: [] };
const liveMusic = dt => {
  const mood = MOODS[app.film.mood] || MOODS.flow;
  const m = app.music.read(dt, rt.realTime, app.audio, app.tempo, app.paused, mood.decay);
  m.M = mood.melody; m.D = mood.drums; m.S = mood.scope;
  return m;
};
app.tapTempo = () => {
  const now = performance.now() / 1000, taps = clock.tapTimes;
  if (taps.length && now - taps[taps.length - 1] > 2) taps.length = 0;
  taps.push(now);
  if (taps.length > 6) taps.shift();
  if (taps.length >= 3) {
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    app.tempo.bpm = Math.round(60 / (gaps.reduce((x, y) => x + y, 0) / gaps.length));
    app.tempo.fromSong = false;
    app.music.bar = Math.round(app.music.bar);
  }
  return app.tempo.bpm;
};

// ------------------------------------------------------------------ the sound → the picture
app.SOURCES = { melody: 'Melody', sway: 'Sway', slide: 'Slides', voice: 'Voice', sustain: 'Sustain', kick: 'Kick', snare: 'Snare', hat: 'Hats', loud: 'Loudness', bar: 'Bar', slow: 'Slow wave' };
function sourceValue(src, m) {
  switch (src) {
    case 'melody': return m.height;
    case 'sway': return m.sway;
    case 'slide': return m.slide;
    case 'voice': return m.voice;
    case 'sustain': return m.harm;
    case 'kick': return m.kick;
    case 'snare': return m.snare;
    case 'hat': return m.hat;
    case 'loud': return m.on ? m.loud : 0;      // silence shouldn't nudge anything
    case 'bar': return 0.5 + 0.5 * Math.sin(m.bar * Math.PI * 2);
    case 'slow': return 0.5 + 0.5 * Math.sin(m.bar * Math.PI / 4);
    default: return 0;
  }
}
app.setTie = (key, src, amt) => {
  if (!src) delete app.ties[key];
  else app.ties[key] = { src, amt: amt ?? app.ties[key]?.amt ?? 0.4 };
};
// before speeds add up, so a speed tied to the music really speeds up with it
function applySound(v, m) {
  const S = app.sound, k = S.amount * Math.max(m.M, m.D * 0.8), on = m.on ? 1 : 0;
  // the look's own music settings: the bar's sway is the fallback for silence, the thump and the flash belong to the drums
  v.pulse *= m.D; v.hitFlash *= m.D * m.D; v.react *= k;
  v.breathe *= k; v.sway *= m.known ? 0.3 : k; v.swayX *= k;
  const M = m.M * S.amount * on, D = m.D * S.amount * on;
  // the tune: the world leans with it, the pattern slides as the note slides, its curve runs out through the lines
  const ride = LOOKS[app.lookId].ride || RIDE;
  for (const key in ride) {
    const p = PARAM_BY_NAME[key];
    if (p && typeof v[key] === 'number') v[key] = clamp(v[key] + ride[key] * m.sway * M, p.min, p.max);
  }
  v.flow += m.glide * 1.3 * M;
  v.roll += m.sway * 0.05 * M;
  v.tx += m.sway * 0.025 * M * v.frame;
  v.mwave = M * (0.55 + 0.75 * m.voice);
  v.mland = M * 0.7 * clamp((v.pitch - 0.25) * 1.2, 0, 1);
  // looks that take their whole shape from the tune
  const mel = LOOKS[app.lookId].melody;
  if (mel === 'cym') {
    const f = app.film.cym ||= { n: v.cymN, m: v.cymM };
    if (m.on) { f.n = ease(f.n, 2 + 5 * (m.height * 0.5 + 0.5) * 1.3, 3.5, track.dt); f.m = ease(f.m, 2 + (m.chordRoot % 7) + 2.5 * m.sway, 1.5, track.dt); }
    v.cymN = m.on ? f.n : v.cymN; v.cymM = m.on ? f.m : v.cymM;
  } else if (mel === 'julia') {
    v.juliaA += (m.sway * 1.4 + m.chordRoot * 0.52) * M; v.juliaR = clamp(v.juliaR + m.height * 0.035 * M, 0.3, 1);
  } else if (mel === 'wells') {
    v.wellT = (app.film.wellT = (app.film.wellT || 0) + track.dt * (0.1 + m.glide * 1.5 * M)); v.wellR = clamp(v.wellR + m.height * 0.1 * M, 0, 1.2);
  }
  v.truchetT = (app.film.tru = (app.film.tru || 0) + (m.note ? 0.12 * M : 0) + (m.beat ? 0.3 * D : 0) + track.dt * 0.03);
  // the drums: a soft swell, a ripple, a shimmer on the thinnest lines. They never move the camera.
  if (D > 0) {
    v.bulge += m.kick * 0.1 * D;
    v.height *= 1 + m.kick * 0.25 * D;
    v.thick = clamp(v.thick - m.hat * 0.05 * D, -0.9, 0.9);
    if (m.snare > 0.55 && rt.realTime - rt.snareT > 0.2) { rt.snareT = rt.realTime; spawnRipple((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.7, 0.45 * D); }
  }
  rt.livingEnergy = clamp(m.harm * M + m.kick * D, 0, 1);
  rt.livingSpot = m.beat && m.on ? [Math.random(), Math.random(), 0.012] : null;
  // the scope: the raw sound in the lines, if you want it
  v.swave = m.S * S.amount * on; v.sspec = (S.spectrum + m.S * 0.4) * S.amount * on; v.sland = S.land * S.amount * on;
  for (const [key, { src, amt }] of Object.entries(app.ties)) {
    const p = PARAM_BY_NAME[key];
    if (!p || typeof v[key] !== 'number') continue;
    v[key] = clamp(v[key] + sourceValue(src, m) * amt * (p.max - p.min) * 0.6, p.min, p.max);
  }
}
const RIDE = { twist: 0.4, bulge: 0.14, frot: 0.12 };
app.setMood = id => { if (MOODS[id]) app.film.mood = id; };

// the cinematic camera, before speeds and music (so the bar's sway and the bass thump still ride on top)
app.setCinema = on => {
  app.cine.on = on;
  ui.cinemaChanged();
};
function applyCinema(v, m, dt) {
  const C = app.cine, D = app.director;
  if (D.due(m, C) && C.looks && (D.shots + 1) % C.every === 0) {
    const ids = Object.keys(LOOKS).filter(k => k !== app.lookId && C.groups.includes(LOOKS[k].group));
    if (ids.length) app.pickLook(ids[Math.floor(Math.random() * ids.length)], Math.max(2, Math.round(12 - 10 * C.speed)) * m.barLen * 0.75);
  }
  D.update(dt, v, camKind(app.lookId), m, C);
  D.apply(v);
  v.swell = Math.max(v.swell, C.waves * D.mix);
}

// the film: as the song plays, move to the scene the score has for this moment. A scene lands on its beat:
// the glide starts a little before it. Pick a look yourself and it stays until the next section.
const GLIDE_BARS = 2.2;
function applyFilm(m) {
  const F = app.film;
  if (!F.auto || !F.score || !m.known || !app.audio.el) return;
  const barLen = m.barLen, t = app.audio.el.currentTime, glide = Math.min(5, Math.max(1.4, barLen * GLIDE_BARS));
  const i = sceneAt(F.score, t + glide * 0.55);
  if (i === F.scene) return;
  F.scene = i;
  if (i <= F.held) return;
  F.held = -1;
  const S = F.score.scenes[i];
  app.tweaks[S.look] = { ...paletteSet(S.palette) };
  app.lookId = S.look;
  app.world.morphTo(lookValues(S.look), glide);
  app.cine.on = S.cine;
  app.cine.looks = false;
  app.cine.speed = S.cineSpeed;
  const A = app.adds.figures;
  if (S.figure) {
    A.style = S.style;
    A.size = S.figure === 'monolith' ? 1 : 1.15;
    A.repeat = !!S.crowd;
    app.figures.home = S.home;
    app.figures.parked = false;
    A.follow = false;
    app.pickFigure(S.figure, { drive: false });
  } else if (A.on) {
    A.on = false;
  }
  ui?.lookChanged();
  ui?.renderDock();
}
app.rebuildScore = () => {
  const F = app.film, an = app.music.an;
  F.score = an ? buildScore(app.audio.file ? `${app.audio.file.name}|${app.audio.file.size}` : 'song', an, F) : null;
  F.scene = -1; F.held = -1;
  ui?.soundChanged();
};
app.setFilmOption = (key, value) => {
  app.film[key] = value;
  if (['color', 'figures', 'worlds', 'pace', 'seed'].includes(key)) app.rebuildScore();
  ui?.soundChanged();
};
app.seek = frac => { const el = app.audio.el; if (el && isFinite(el.duration)) el.currentTime = frac * el.duration; };

// ------------------------------------------------------------------ songs (kept in this browser) and the mic
app.audio.onchange = () => ui?.soundChanged();
app.songs.onchange = () => ui?.soundChanged();
// listen to the whole song, off the main thread; what's heard is kept, so it's instant next time
let worker = null, listenJob = 0;
async function decodeMono(file) {
  const buf = await file.arrayBuffer();
  const tmp = new OfflineAudioContext(1, 1, 44100);
  const dec = await tmp.decodeAudioData(buf);
  const off = new OfflineAudioContext(1, Math.ceil(dec.duration * 22050), 22050);
  const src = off.createBufferSource();
  src.buffer = dec;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}
function runListen(samples, onProgress) {
  return new Promise((ok, fail) => {
    worker?.terminate();
    worker = new Worker(new URL('./listen.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => {
      if (e.data.progress != null) onProgress(e.data.progress);
      else if (e.data.result) ok(e.data.result);
      else fail(new Error(e.data.error));
    };
    worker.onerror = e => fail(new Error(e.message));
    worker.postMessage(samples, [samples.buffer]);
  });
}
const LISTEN_VERSION = 3;
async function listenTo(file) {
  const job = ++listenJob, F = app.film, id = `${file.name}|${file.size}`;
  app.music.setAnalysis(null);
  F.score = null; F.listening = 0.001; F.scene = -1; F.held = -1;
  ui?.soundChanged();
  try {
    let an = await loadListened(id);
    if (!an || an.version !== LISTEN_VERSION) {
      const samples = await decodeMono(file);
      if (job !== listenJob) return;
      an = await runListen(samples, p => {
        if (job !== listenJob) return;
        F.listening = Math.max(0.001, p);
        ui?.listenProgress();
      });
      saveListened(id, an);
    }
    if (job !== listenJob) return;
    F.listening = 0;
    app.tempo = { bpm: Math.round(an.bpm * 10) / 10, beatsPerBar: an.meter, fromSong: true };
    app.music.setAnalysis(an);
    app.rebuildScore();
  } catch (e) {
    console.warn('listening failed', e);
    F.listening = 0;
    ui?.soundChanged();
  }
}
app.loadSong = async (file, { keep = true } = {}) => {
  try {
    if (keep) app.songs.add(file);
    await app.audio.loadFile(file);
    listenTo(file);
  } catch (e) {
    console.warn(e);
    ui.toast('Could not play that file');
  }
};
app.currentSongId = () => (app.audio.mode === 'file' && app.audio.file ? `${app.audio.file.name}|${app.audio.file.size}` : null);
app.playSongId = async id => {
  const file = await app.songs.get(id).catch(() => null);
  if (!file) { app.songs.remove(id); return ui.toast('That song is gone from this browser'); }
  return app.loadSong(file, { keep: false });
};
app.addSongs = files => {
  const songs = files.filter(isSong);
  if (!songs.length) return ui.toast('Those aren’t songs');
  songs.slice(1).forEach(f => app.songs.add(f));
  app.loadSong(songs[0]);
  if (songs.length > 1) ui.toast(`${songs.length} songs added`);
};
app.nextSong = () => {
  const L = app.songs.list;
  if (!L.length) return;
  const i = L.findIndex(x => x.id === app.currentSongId());
  app.playSongId(L[(i + 1) % L.length].id);
};
// live input: a guitar through an audio interface, a headset mic… heard through the speakers if you like
app.refreshDevices = async () => {
  try { app.devices = await AudioEngine.devices(); } catch { app.devices = { inputs: [], outputs: [] }; }
  ui?.soundChanged();
};
app.useInput = async (deviceId = app.audio.input.deviceId) => {
  try {
    await app.audio.useInput(deviceId);
    await app.refreshDevices();
    ui.toast(`Listening to ${app.audio.name}${app.audio.input.monitor ? ' — and playing it through the speakers' : ''}`);
  } catch (e) {
    console.warn(e);
    ui.toast(e.name === 'NotAllowedError' ? 'The browser wasn’t allowed to use that input' : 'Couldn’t open that input');
  }
};
app.useMic = () => app.useInput();
app.audio.wantPitch = true;
app.setMonitor = on => {
  app.audio.setMonitor(on);
  if (on) ui.toast('You’ll hear the input through the speakers. With a mic near speakers, use headphones — it’ll howl.');
  ui.soundChanged();
};
app.setOutput = async id => {
  if (!(await app.audio.setOutput(id))) ui.toast('This browser can’t choose where the sound comes out');
  ui.soundChanged();
};
navigator.mediaDevices?.addEventListener?.('devicechange', () => app.refreshDevices());
app.stopAudio = () => app.audio.stop();

// ------------------------------------------------------------------ add-ons
const pres = { hands: 0, face: 0, orbs: 0, figures: 0 };
app.figures = new Figures();
// pick a figure: the one showing goes under, then this one comes up, and your mouse has it
app.pickFigure = (id, { drive = true } = {}) => {
  app.adds.figures.pick = id;
  if (id !== 'hand') app.figures.pick(id);
  if (pres.figures < 0.01 && id !== 'hand') { app.figures.a = FIGURE_INDEX[id] ?? 0; app.figures.swap = null; app.figures.placed = false; }   // nothing showing yet: straight up
  app.adds.figures.on = true;
  if (drive) { app.tool = 'figure'; app.adds.figures.follow = true; app.adds.figures.size = 1; app.figures.home = null; app.figures.parked = false; updateRing(); }
  ui?.renderDock();
  ui?.addsChanged();
};
app.setAdd = async (id, on) => {
  const A = app.adds[id];
  A.on = on;
  if (id === 'camera') {
    if (on) await app.cameraOn();
    else app.cameraOff();
  }
  if (id === 'picture' && !on && ['image', 'video', 'text'].includes(media.kind)) media.clear();
  syncTrackerWants();
  ui.addsChanged();
};
app.setAddOption = (id, key, value) => {
  app.adds[id][key] = value;
  if (key === 'copy' && value && !tracker.on) app.setAdd('camera', true);
  syncTrackerWants();
};
app.pinAdd = (id, on) => { app.adds[id].pinned = on; ui.addsChanged(); };

// ------------------------------------------------------------------ you: the camera, pictures, words
const media = app.media, tracker = app.tracker;
const track = {
  hands: [0, 1].map(() => ({ on: 0, x: 0, y: 0, s: 1, a: 0, curls: [0, 0, 0, 0, 0], spread: 0.5, mirror: 1 })),
  face: { on: 0, x: 0, y: 0, s: 0.6, roll: 0, turn: 0, mouth: 0, eyes: 1 },
  lastRipple: 0, sigma: 0, dt: 1 / 60,
};

function syncTrackerWants() {
  const c = app.cam, sub = c.subject, camOn = app.adds.camera.on;
  tracker.setWant('face', (app.adds.face.copy && app.adds.face.on) || c.look || (camOn && sub === 'face'));
  tracker.setWant('hands', (app.adds.hands.copy && app.adds.hands.on) || (camOn && (sub === 'hands' || sub === 'bodyhands')));
  tracker.setWant('body', camOn && (sub === 'body' || sub === 'bodyhands'));
  tracker.setWant('motion', c.motion || (camOn && sub === 'motion'));
  media.cam.subject = camOn ? sub : 'none';
}
tracker.onchange = () => ui?.addsChanged();

app.cameraOn = async () => {
  try {
    await tracker.start();
    media.attachCamera(tracker.video);
    app.adds.camera.on = true;
    syncTrackerWants();
    ui.toast('Camera on — it stays on this computer');
  } catch {
    app.adds.camera.on = false;
    ui.toast('Camera access was blocked');
  }
  ui.addsChanged();
};
app.cameraOff = () => {
  tracker.stop();
  media.detachCamera();
  rt.fingers.fill(0);
  app.adds.camera.on = false;
  ui.addsChanged();
};
app.setCam = (key, value) => {
  app.cam[key] = value;
  if (key === 'subject') app.cam.setup = null;
  syncTrackerWants();
  ui.addsChanged();
};

// one-click camera setups: what counts as you, and how it shows
app.SETUPS = [
  { id: 'me', name: 'Just me', blurb: 'you, clear, the pattern moving round you',
    cam: { subject: 'body' }, show: { photo: 0.9, relief: 0.4, engrave: 0, calm: 1, aura: 0.7, detail: 0.85 } },
  { id: 'guitar', name: 'Playing guitar', blurb: 'body, arms and guitar clear; your playing (mic) moves the rest',
    cam: { subject: 'bodyhands' }, show: { photo: 1, relief: 0.25, engrave: 0, calm: 1, aura: 1, detail: 0.95 }, mic: true },
  { id: 'hands', name: 'Hands & guitar', blurb: 'only your hands and what they hold, sharp',
    cam: { subject: 'hands' }, show: { photo: 1, relief: 0.2, engrave: 0, calm: 1, aura: 1.2, detail: 1 }, mic: true },
  { id: 'lines', name: 'Lines over me', blurb: 'the whole picture pressing up through the lines',
    cam: { subject: 'scene' }, show: { photo: 0, relief: 1.2, engrave: 0.6, calm: 0, aura: 0, detail: 0.6 } },
  { id: 'face', name: 'My face', blurb: 'your face engraved into the lines',
    cam: { subject: 'face' }, show: { photo: 0.35, relief: 1, engrave: 0.9, calm: 1, aura: 0.6, detail: 0.85 } },
  { id: 'trails', name: 'Movement', blurb: 'only what moves leaves a trail',
    cam: { subject: 'motion' }, show: { photo: 0, relief: 1.6, engrave: 0.4, calm: 0, aura: 0 } },
];
app.quickSetup = async id => {
  const S = app.SETUPS.find(x => x.id === id);
  if (!S) return;
  Object.assign(app.cam, S.cam, { setup: id });
  Object.assign(app.show, S.show);
  if (!tracker.on) await app.cameraOn();
  else { app.adds.camera.on = true; syncTrackerWants(); }
  if (S.mic && app.audio.mode === 'off') await app.useMic();
  ui.addsChanged();
};

app.loadPicture = async file => {
  try {
    if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) await media.setVideo(file);
    else await media.setImage(file);
    app.adds.picture.on = true;
    if (app.show.photo === 0 && app.show.relief === 0 && app.show.engrave === 0) app.show.relief = 1.2;
    ui.toast(`“${file.name}” is in the world now`);
  } catch (e) {
    console.warn(e);
    ui.toast('Could not open that file');
  }
  ui.addsChanged();
};
app.setWords = (text, font) => {
  media.setText(text, font);
  app.adds.picture.on = !!text.trim() || ['image', 'video'].includes(media.kind);
};
app.clearPicture = () => { media.clear(); app.adds.picture.on = false; ui.addsChanged(); };

function updateInputs(dt) {
  track.dt = dt;
  const S = app.show;
  if (tracker.on) tracker.update();
  const masks = { motion: tracker.motion.canvas };
  if (tracker.on && media.kind === 'camera' && media.masked) masks.canvas = tracker.drawMasks(app.cam.subject, { box: app.cam.box, feather: app.cam.feather });
  media.setBlur(0);
  media.cam.detail = S.detail;
  // the relief's blur is in the blurred copy's own pixels: a sharper camera picture needs a wider blur to stay smooth
  const sigma = (0.8 + S.soft * 1.4) * (media.kind === 'camera' ? (media.canvas.width / 480) * (1.15 - 0.5 * S.detail) : 1);
  if (media.update(rt.realTime, masks) || Math.abs(sigma - track.sigma) > 0.05) {
    track.sigma = sigma;
    renderer.setMedia(media.output, media.aspect, sigma);
  }
}

// the camera / picture, and your tracked hands and face, into the world's values
function applyInputs(v, m) {
  const S = app.show, c = app.cam, dt = track.dt;
  const picture = app.adds.picture.on && ['image', 'video', 'text'].includes(media.kind);
  const camera = app.adds.camera.on && media.kind === 'camera' && c.subject !== 'none';
  const hh = v.frame * S.size, cx = v.tx + S.x * v.frame, cy = v.ty + S.y * v.frame;
  if (picture || camera) {
    const pump = 0.5 + 0.9 * (m.on ? m.loud : 0.5) + 0.6 * m.hit;   // the aura breathes with the sound
    Object.assign(v, {
      media: S.relief, mediaInk: S.engrave, mediaPhoto: S.photo, photoColor: S.photoColor, mediaInv: S.invert, mediaWarp: S.warp,
      mediaS: hh, mediaX: cx, mediaY: cy, mediaMask: media.masked ? 1 : 0, mediaLift: media.masked ? 0.45 : 0,
      mediaCalm: S.calm, aura: S.aura * pump,
    });
  }
  if (!tracker.on) return;
  const A = tracker.aspect;
  const toSheet = (u, vv) => [cx + (u - 0.5) * 2 * hh * A, cy + (0.5 - vv) * 2 * hh];

  // your hands → the 3D hands, finger by finger
  const copyHands = app.adds.hands.on && app.adds.hands.copy;
  for (let i = 0; i < 2; i++) {
    const T = track.hands[i], H = copyHands ? tracker.hands[i] : null;
    T.on = ease(T.on, H ? 1 : 0, 6, dt);
    if (H) {
      const [x, yy] = toSheet(H.u, H.v);
      T.x = ease(T.x, x, 18, dt); T.y = ease(T.y, yy, 18, dt);
      T.s = ease(T.s, (H.size * 2 * hh) / 0.2 * app.adds.hands.size, 10, dt);
      T.a = ease(T.a, H.angle, 14, dt);
      T.curls = T.curls.map((cv, j) => ease(cv, H.curls[j], 16, dt));
      T.spread = ease(T.spread, H.spread, 10, dt);
      T.mirror = H.mirror;
    }
    if (copyHands && T.on > 0.01) {
      Object.assign(v, {
        [`h${i}on`]: T.on, [`h${i}x`]: T.x, [`h${i}y`]: T.y - 0.12 * T.s, [`h${i}s`]: T.s, [`h${i}a`]: T.a,
        [`h${i}z`]: clamp(0.05 + (T.s - 1) * 0.18, 0.03, 0.45), [`h${i}curl`]: 0, [`h${i}spread`]: T.spread,
      });
      T.curls.forEach((cv, j) => { rt.fingers[i * 5 + j] = cv * 1.1; });
      rt.handMirror[i] = T.mirror;
    }
  }

  // your face → the ghost face copies it; and/or the view moves as your head moves
  const F = track.face, f = tracker.face;
  F.on = ease(F.on, f ? 1 : 0, 5, dt);
  if (f) {
    const [x, yy] = toSheet(f.u, f.v);
    F.x = ease(F.x, x, 14, dt); F.y = ease(F.y, yy, 14, dt);
    F.s = ease(F.s, f.height * 2 * hh * 0.95, 8, dt);
    F.roll = ease(F.roll, f.roll, 12, dt); F.turn = ease(F.turn, f.turn, 12, dt);
    F.mouth = ease(F.mouth, f.mouth, 20, dt); F.eyes = ease(F.eyes, f.eyes, 25, dt);
    F.u = f.u; F.v = f.v;
  }
  if (app.adds.face.on && app.adds.face.copy && F.on > 0.01) {
    Object.assign(v, { face: Math.max(v.face, 1.1 * F.on), faceX: F.x, faceY: F.y, faceS: F.s, faceRoll: F.roll, faceTurn: F.turn, mouth: F.mouth, eyes: F.eyes });
  }
  if (c.look && F.on > 0.01 && F.u != null) {
    const hx = (F.u - 0.5) * 2 * F.on, hy = (0.5 - F.v) * 2 * F.on;
    v.yaw -= hx * 0.35;
    v.pitch = clamp(v.pitch - hy * 0.25, -0.25, 1.35);
    v.tx += hx * 0.25 * v.frame;
    v.ty += hy * 0.2 * v.frame;
  }
  // movement → ripples where you moved
  const mo = tracker.motion;
  if (c.motion && mo.energy > 0.015 && rt.realTime - track.lastRipple > 0.28) {
    spawnRipple((mo.u - 0.5) * A * S.size + S.x * 0.5, (0.5 - mo.v) * S.size + S.y * 0.5, Math.min(1.6, mo.energy * 25));
    track.lastRipple = rt.realTime;
  }
}

// add-ons and the view, after the look and the music
const handTool = { on: 0, x: 0, y: 0, press: 0 };
function applyAdds(v, m, dt) {
  const A = app.adds;
  const V = app.view;
  v.tx -= V.panX * 2 * v.frame;
  v.ty -= V.panY * 2 * v.frame;
  v.frame *= V.zoom;
  v.yaw += V.yaw;
  v.pitch = clamp(v.pitch + V.pitch, -0.35, 1.42);
  // tilted back, a long lens would push the camera miles away: widen it as it tilts
  if (v.focal > 2.2) v.focal += (2.0 - v.focal) * clamp((v.pitch - 0.12) / 0.7, 0, 1);
  // the figure on screen: the world's shader is rebuilt with just it (in the background, the first time),
  // and it comes up once that's in. The hand is its own thing, always in the shader.
  const F = app.figures, pickHand = A.figures.pick === 'hand';
  const drawn = FIGURES[F.a].id;
  renderer.useFigures(figureBank(A.figures.on || pres.figures > 0.01 ? [F.swap != null && pres.figures < 0.02 ? FIGURES[F.swap].id : drawn] : []));
  if (F.swap != null && pres.figures < 0.02 && renderer.hasFigure(FIGURES[F.swap].id)) { F.a = F.swap; F.swap = null; }   // the old one has gone: the next one comes up
  for (const k of ['hands', 'face', 'orbs', 'figures']) {
    const on = A[k].on && (k !== 'figures' || (!pickHand && F.swap == null && renderer.hasFigure(FIGURES[F.a].id)));
    pres[k] = ease(pres[k], on ? 1 : 0, k === 'figures' ? (on ? 1.5 : 2.6) : 3, dt);
  }
  const copying = A.hands.copy && tracker.on && tracker.hands.length;
  if (!copying) { rt.handMirror[0] = 1; rt.handMirror[1] = -1; rt.fingers.fill(0); }
  applyHands(v, A.hands, copying ? 0 : pres.hands, m, app.sound);
  applyFace(v, A.face, A.face.copy && tracker.face ? 0 : pres.face);
  applyOrbs(v, A.orbs, pres.orbs, m, app.sound);
  const driving = app.tool === 'figure' && pointer.inside && A.figures.follow;
  if (A.figures.on || pres.figures > 0.01) {
    F.pointer = pointer.inside ? [...rayOnSheet(v, pointer.x, pointer.y, 0)] : null;
    const aim = driving ? z => rayOnSheet(v, pointer.x, pointer.y, z) : null;
    if (driving) F.parked = true;
    const home = F.parked ? [F.x, F.y] : F.home ? rayOnSheet(v, F.home[0], F.home[1], 0) : rayOnSheet(v, 0, -0.2 * Math.sin(Math.max(v.pitch, 0)), 0);
    if (F.step(dt, A.figures, m, aim, home, pointer.down && app.tool === 'figure', v)) ui.addsChanged();
    F.apply(v, A.figures, pres.figures);
    rt.figFrame = F.frame;
  }
  app.ball.apply(v, A.ball);
  // the hand: your cursor pressing through from behind, wherever the camera is
  const handSize = 1.25 * v.frame / 0.6 * (A.figures.size || 1);
  const wantHand = A.figures.on && pickHand;
  if (wantHand && (app.tool === 'figure' && pointer.inside && A.figures.follow)) {
    const zh = 0.04 + handTool.press * 0.32 + 0.12 * handSize;
    const on = rayOnSheet(v, pointer.x, pointer.y, zh);
    handTool.x = ease(handTool.x, on[0], 26, dt);
    handTool.y = ease(handTool.y, on[1] - 0.1 * handSize, 26, dt);
  } else if (handTool.on < 0.01) { handTool.x = v.tx; handTool.y = v.ty - 0.1 * handSize; }
  handTool.on = ease(handTool.on, wantHand ? 1 : 0, 4, dt);
  handTool.press = ease(handTool.press, pointer.down && pickHand && app.tool === 'figure' ? 1 : 0, 6, dt);
  if (handTool.on > 0.001) {
    Object.assign(v, {
      h2on: handTool.on, h2x: handTool.x, h2y: handTool.y, h2z: 0.04 + handTool.press * 0.32, h2s: handSize, h2a: 0.15,
      h2curl: 0.15 + handTool.press * 0.9, h2spread: 0.6 - handTool.press * 0.3,
    });
    v.handSoft = Math.min(v.handSoft, 0.2);
  }
  applyInputs(v, m);
  // never a screen of one solid color, whatever the music, the ties or the cinematic camera do:
  // keep at least a few lines in view however far it zooms in, and never let the ink flood the frame
  v.frame = Math.max(v.frame, 2.6 / Math.max(v.freq, 1));
  v.thick = clamp(v.thick, -0.72, 0.72);
}

// ------------------------------------------------------------------ pictures, clips, links, saves
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
let afterRender = [];   // things that need the canvas right after a frame is drawn
app.snapshot = () => {
  afterRender.push(() => canvas.toBlob(b => { download(b, `trippi-${stamp()}.png`); ui.toast('Picture saved'); }, 'image/png'));
};
app.toggleRecord = () => {
  if (app.recording) { app.recording.stop(); return; }
  if (!window.MediaRecorder || !canvas.captureStream) return ui.toast('Recording is not supported in this browser');
  const stream = canvas.captureStream(60);
  const withAudio = app.audio.mode === 'file' && app.audio.recDest;
  if (withAudio) app.audio.recDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const types = withAudio
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
  const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16e6 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    const type = rec.mimeType || mimeType || 'video/webm';
    download(new Blob(chunks, { type }), `trippi-${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
    app.recording = null;
    ui.refreshTop();
    ui.toast('Clip saved');
  };
  rec.start(250);
  app.recording = rec;
  app.recordStart = performance.now();
  ui.refreshTop();
  ui.toast(withAudio ? 'Recording (with the song) — click again to stop' : 'Recording — click again to stop');
};

// links: the look, your tweaks to it and the feel knobs, in the address
const encode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
app.share = async () => {
  const code = encode({ l: app.lookId, t: app.tweaks[app.lookId] || {}, f: app.feel });
  history.replaceState(null, '', `#v2=${code}`);
  try {
    await navigator.clipboard.writeText(location.href);
    ui.toast('Link copied — whoever opens it sees this look');
  } catch {
    ui.toast('The link is in the address bar — copy it from there');
  }
};

function loadSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; }
}
function persistSaves() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(app.saves)); } catch { ui.toast('Could not save — browser storage is full or blocked'); }
}
app.saveLook = name => {
  const sv = { id: Date.now().toString(36), name, look: app.lookId, tweaks: { ...app.tweaks[app.lookId] }, feel: { ...app.feel } };
  sv.thumb = still(lookValues(app.lookId), 240, 150);
  app.saves.unshift(sv);
  persistSaves();
  ui.toast(`Saved “${name}”`);
  ui.refresh();
};
app.openSave = id => {
  const sv = app.saves.find(x => x.id === id);
  if (!sv || !LOOKS[sv.look]) return;
  app.tweaks[sv.look] = { ...sv.tweaks };
  app.feel = { ...defaultFeel(), ...sv.feel };
  app.pickLook(sv.look);
};
app.deleteSave = id => { app.saves = app.saves.filter(x => x.id !== id); persistSaves(); ui.refresh(); };

app.togglePause = () => { app.paused = !app.paused; ui.refreshTop(); };
app.toggleUI = () => {
  const hidden = document.body.classList.toggle('ui-hidden');
  if (hidden) ui.toast('H brings it back');
};
app.toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => ui.toast('Fullscreen is not allowed here'));
};
app.resetView = () => {
  app.view = { panX: 0, panY: 0, zoom: 1, yaw: 0, pitch: 0 };
  rt.twists.fill(0);
  twists.forEach(t => { t.angle = 0; });
  renderer.clearDisp = true;
  rt.ripples.fill(0);
};

// ------------------------------------------------------------------ dropping files anywhere
const dropEl = document.getElementById('drop');
let dragDepth = 0;
addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; dropEl.classList.add('show'); } });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropEl.classList.remove('show'); } });
// only files drop on the page (a figure dragged anywhere but the toolbar is just let go)
addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
addEventListener('drop', e => {
  if (![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault();
  dragDepth = 0;
  dropEl.classList.remove('show');
  const files = [...e.dataTransfer.files];
  const pic = files.find(x => /^(image|video)\//.test(x.type) || /\.(png|jpe?g|gif|webp|avif|mp4|mov|webm|m4v)$/i.test(x.name));
  if (pic) return app.loadPicture(pic);
  if (!files.some(isSong)) return ui.toast('Drop songs, a picture or a video');
  app.addSongs(files);
});

// ------------------------------------------------------------------ the tools: left button = the chosen tool,
// right button = turn and tilt the camera (shift: slide it), wheel = zoom, double-click = put the view back
const pointer = { down: false, move: false, inside: false, x: 0, y: 0, lastX: 0, lastY: 0, lastRipple: 0, alt: false };
const ring = document.getElementById('brush');
// the endless twist: up to 4 twists, each winding while you hold it and (if Spring back is up) unwinding after
const twists = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, angle: 0, r: 0.2, held: false }));
let twistNext = 0, twistCur = null;

function toUV(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left - r.width / 2) / r.height, (r.height / 2 - (e.clientY - r.top)) / r.height];
}
function updateRing(e) {
  if (e) { ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`; }
  const show = !['camera', 'figure'].includes(app.tool) && !matchMedia('(pointer: coarse)').matches;
  ring.classList.toggle('show', show && pointer.inside && !pointer.move);
  const d = app.brush.size * 2 * canvas.getBoundingClientRect().height * (app.tool === 'ripple' ? 0.6 : 1);
  ring.style.width = ring.style.height = `${d}px`;
  ring.classList.toggle('down', pointer.down);
}
app.updateRing = updateRing;

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  [pointer.x, pointer.y] = toUV(e);
  [pointer.lastX, pointer.lastY] = [pointer.x, pointer.y];
  pointer.move = e.button === 2 || e.button === 1 || e.shiftKey || app.tool === 'camera';
  pointer.slide = e.shiftKey || e.button === 1;
  pointer.down = !pointer.move || app.tool === 'camera';
  pointer.alt = e.altKey;
  rt.brush.x = pointer.x; rt.brush.y = pointer.y;
  if (!pointer.move && app.tool === 'ripple') {
    spawnRipple(pointer.x, pointer.y, app.brush.strength * 1.6);
    pointer.lastRipple = rt.realTime;
  }
  if (!pointer.move && app.tool === 'twist') {
    // keep winding a twist you click back on; otherwise start a new one
    const near = twists.find(t => t.angle !== 0 && Math.hypot(t.x - pointer.x, t.y - pointer.y) < t.r * 0.6);
    twistCur = near || twists[twistNext];
    if (!near) { twistNext = (twistNext + 1) % twists.length; Object.assign(twistCur, { x: pointer.x, y: pointer.y, angle: 0 }); }
    twistCur.held = true;
  }
  ui.dismissHint();
  updateRing(e);
});
canvas.addEventListener('pointermove', e => {
  const [x, y] = toUV(e);
  pointer.inside = true;
  if (pointer.move && (e.buttons & 7)) {
    const V = app.view;
    if (pointer.slide) {
      V.panX += (x - pointer.x) * V.zoom;
      V.panY += (y - pointer.y) * V.zoom;
    } else {
      // drag sideways to turn, up and down to tilt toward the horizon
      V.yaw -= (x - pointer.x) * 3;
      V.pitch = clamp(V.pitch + (y - pointer.y) * 2.2, -0.4, 1.4);
      if (app.cine.on) { app.setCinema(false); ui.toast('Cinematic off — you’ve got the camera'); }
    }
    ui.viewChanged();
  }
  pointer.x = x; pointer.y = y;
  if (pointer.down && !pointer.move && app.tool === 'ripple' && rt.realTime - pointer.lastRipple > 0.08 && Math.hypot(x - pointer.lastX, y - pointer.lastY) > 0.03) {
    spawnRipple(x, y, app.brush.strength * 1.1);
    pointer.lastRipple = rt.realTime;
    pointer.lastX = x; pointer.lastY = y;
  }
  updateRing(e);
});
const release = () => {
  pointer.down = false;
  pointer.move = false;
  if (twistCur) twistCur.held = false;
  twistCur = null;
  updateRing();
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { pointer.inside = false; updateRing(); });
canvas.addEventListener('dblclick', () => app.resetView());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  app.view.zoom = clamp(app.view.zoom * Math.exp(e.deltaY * 0.0015), 0.15, 5);
  ui.viewChanged();
}, { passive: false });
document.getElementById('unhide').addEventListener('click', () => { if (document.body.classList.contains('ui-hidden')) app.toggleUI(); });

function updateTools(dt) {
  const b = rt.brush, br = app.brush;
  const brushing = pointer.down && !pointer.move;
  b.mode = brushing ? { smear: 1, bulge: 2, pinch: 3 }[app.tool] || 0 : 0;
  b.vx = brushing ? pointer.x - b.x : 0;
  b.vy = brushing ? pointer.y - b.y : 0;
  b.x = pointer.x; b.y = pointer.y;
  b.size = br.size; b.strength = br.strength;
  b.relax = Math.pow(1 - (0.004 + br.spring * 0.07), dt * 60);
  // twists: wind while held (Alt/Option winds the other way), follow the cursor, unwind by Spring back
  twists.forEach((t, i) => {
    if (t.held) {
      t.angle += (pointer.alt ? -1 : 1) * br.strength * 4 * dt;
      t.x = ease(t.x, pointer.x, 6, dt); t.y = ease(t.y, pointer.y, 6, dt);
      t.r = br.size * 1.6;
    } else t.angle *= Math.exp(-dt * br.spring * 0.8);
    if (Math.abs(t.angle) < 1e-3 && !t.held) t.angle = 0;
    rt.twists.set([t.x, t.y, t.angle, t.r], i * 4);
  });
}

// ------------------------------------------------------------------ keyboard
addEventListener('keydown', e => {
  if (e.target.closest('textarea, input[type="text"], input[type="color"], select') || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  const act = {
    ' ': app.togglePause, h: app.toggleUI, f: app.toggleFullscreen, e: app.exploreOpen, d: app.surprise, s: app.snapshot,
    c: () => app.setCinema(!app.cine.on),
    p: () => ui.openTab('patterns'), g: () => ui.openTab('figures'), m: () => ui.openTab('sound'), t: () => ui.openTab('tweak'),
    arrowright: () => app.stepLook(1), arrowleft: () => app.stepLook(-1),
    '[': () => { app.brush.size = Math.max(0.04, app.brush.size * 0.85); ui.renderDock(); updateRing(); },
    ']': () => { app.brush.size = Math.min(0.5, app.brush.size * 1.18); ui.renderDock(); updateRing(); },
    escape: () => (app.explore.open ? app.exploreClose() : ui.tab && ui.openTab(ui.tab)),
  }[k];
  if (act) {
    if (e.target.matches('input[type="range"]') && k.startsWith('arrow')) return;
    e.preventDefault();
    act();
    return;
  }
  const n = parseInt(k, 10);
  if (app.explore.open && n >= 1 && n <= 8) return app.explorePick(n - 1);
  if (n >= 1 && n <= TOOLS.length) app.setTool(TOOLS[n - 1].id);
});
// the figure tool with nothing up brings the hand; leaving it, the hand goes, and anything else stays where you left it
app.setTool = id => {
  const A = app.adds.figures;
  if (id === 'figure' && !A.on) return app.pickFigure('hand');
  if (app.tool === 'figure' && id !== 'figure' && A.pick === 'hand' && A.on) { A.on = false; ui.addsChanged(); }
  app.tool = id;
  updateRing();
  ui.renderDock();
};

// ------------------------------------------------------------------ the frame loop
let scale = 1;
const maxScale = () => Math.min(window.devicePixelRatio || 1, 1);
function resize() {
  scale = Math.min(scale, maxScale());
  renderer.resize(innerWidth * scale, innerHeight * scale);
}
addEventListener('resize', resize);

// drop resolution if the GPU can't keep up; creep back up once it's smooth again
let perfAcc = 0, perfN = 0, perfGrace = 3, smoothSecs = 0;
function adapt(dt) {
  if ((perfGrace -= dt) > 0 || document.hidden) return;
  perfAcc += dt; perfN++;
  if (perfAcc < 1) return;
  const avg = perfAcc / perfN;
  perfAcc = 0; perfN = 0;
  if (avg > 1 / 38 && avg < 0.2 && scale > 0.55) {          // (very long frames are the browser throttling us)
    scale = Math.max(0.55, scale * 0.82);
    resize();
    perfGrace = 1.5;
    smoothSecs = 0;
  } else if (avg < 1 / 55 && scale < maxScale()) {
    if (++smoothSecs >= 4) { scale = Math.min(maxScale(), scale * 1.12); resize(); perfGrace = 1.5; smoothSecs = 0; }
  } else smoothSecs = 0;
}

// 60 frames a second is all this needs. On a 120 Hz screen, drawing every refresh doubles the GPU's work
// (heat, fans, battery) for motion this slow, so by default every other refresh is skipped there.
const PERF_KEY = 'trippy.perf.v1';
app.perf = { cap60: true };
try { Object.assign(app.perf, JSON.parse(localStorage.getItem(PERF_KEY) || '{}')); } catch {}
app.setCap60 = on => { app.perf.cap60 = !!on; try { localStorage.setItem(PERF_KEY, JSON.stringify(app.perf)); } catch {} };

let last = performance.now(), lastRaw = last, refresh = 16.7;
const t0 = last;
function frame(now) {
  const raw = now - lastRaw;
  lastRaw = now;
  if (raw > 2 && raw < 40) refresh += (raw - refresh) * 0.1;                                                 // how often the screen refreshes (a smoothed guess)
  if (app.perf.cap60 && now - last < 1000 / 60 - refresh * 0.5) { requestAnimationFrame(frame); return; }   // skip this refresh: the next lands nearer 60 a second
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  rt.realTime = (now - t0) / 1000;
  const a = app.audio;
  a.update(dt, rt.realTime);
  updateInputs(dt);
  const m = liveMusic(dt);
  renderer.setSound(a.wave, a.hist, a.waveHist, app.music.row);
  applyFilm(m);
  const w = app.world, cur = w.current || w.values();
  updateTools(dt);
  // the ball: wander (or follow the mouse), hop on the beat, ripple when it lands
  const B = app.adds.ball;
  const target = B.follow && pointer.inside ? [cur.tx + pointer.x * 2 * cur.frame, cur.ty + pointer.y * 2 * cur.frame] : null;
  const cut = document.body.classList.contains('panel-closed') || innerWidth <= 760 ? 0 : 356 / innerWidth;   // keep it out from under the panel
  if (app.ball.step(app.paused ? 0 : dt, B, { tx: cur.tx, ty: cur.ty, frame: cur.frame, aspect: canvas.width / canvas.height, cut }, m, app.sound, target)) {
    spawnRipple((app.ball.x - cur.tx) / (2 * cur.frame), (app.ball.y - cur.ty) / (2 * cur.frame), 0.9 * app.sound.ballBounce);
  }
  const { P, post } = w.frame(app.paused ? 0 : dt, m, {
    pre: v => { applyFeel(v, app.feel); applySound(v, m); applyCinema(v, m, app.paused ? 0 : dt); },
    post: v => applyAdds(v, m, dt),
  });
  const rippling = rt.ripples.some((x, i) => i % 4 === 3 && x > 0 && rt.realTime - rt.ripples[i - 1] < 5);
  rt.stepK = stepFactor(w.current) * (rippling ? 0.7 : 1);
  renderer.updateDisp(rt.brush);
  renderer.render(P, rt, post);
  if (afterRender.length) { const fns = afterRender; afterRender = []; fns.forEach(f => f()); }
  ui.tick(dt);
  adapt(dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
function boot() {
  let shared = null;
  if (location.hash.startsWith('#v2=')) {
    try { shared = decode(location.hash.slice(4)); } catch (e) { console.warn('bad link', e); }
  }
  if (shared && LOOKS[shared.l]) {
    app.lookId = shared.l;
    app.tweaks[shared.l] = shared.t || {};
    app.feel = { ...defaultFeel(), ...shared.f };
  }
  app.world.morphTo(lookValues(app.lookId), 0.05);
  ui = createUI(app);
  app.songs.load();
  app.refreshDevices();
  resize();
  requestAnimationFrame(frame);
}
boot();

window.trippy = Object.assign(app, { rt, _pointer: pointer, _twists: twists, _frame: frame, _renderer: renderer });   // handy for poking around in the console
