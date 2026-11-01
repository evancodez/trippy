import { Renderer } from './renderer.js';
import { compileFormula, replaceNumber } from './formula.js';
import { PRESETS } from './presets.js';
import { PATTERN_BY_ID, PATTERNS, WARPS } from './catalog.js';
import { makeState, cloneState, mutateState, randomState, encodeShare, decodeShare } from './state.js';
import { AudioEngine } from './audio.js';
import { createUI, TOOLS } from './ui.js';
import { MAX_RIPPLES } from './shaders.js';
import { analyzeAudio, sample } from './analysis.js';
import { Timeline, applyMusic, toShader, toPost, stepFactor } from './film/timeline.js';
import { SHADER_COUNT, PARAM_BY_NAME } from './film/params.js';
import { PPP_FILM } from './film/ppp.js';
import { generateFilm } from './film/auto.js';
import { LOOKS, look } from './film/looks.js';
import { World } from './world.js';
import { RANGES } from './state.js';
import { WARP_BY_ID } from './catalog.js';
import { Media } from './media.js';
import { Tracker } from './tracking.js';
import { SongLibrary, isSong } from './songs.js';
import { applyMacrosWorld, applyMacrosPatterns, defaultMacros, breedWorld, breedPatterns } from './macros.js';
import { defaultValues, expand } from './film/timeline.js';
import { hexToRgb } from './film/params.js';

const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  const f = document.getElementById('fatal');
  f.hidden = false;
  f.textContent = 'This needs WebGL2, which this browser doesn’t seem to have. Try a recent Chrome, Firefox, Safari or Edge.';
  throw e;
}

const SAVE_KEY = 'trippy.saves.v1';
const BRUSH_MODES = { smear: 1, bulge: 2, pinch: 3, twist: 4 };

const app = {
  renderer,
  audio: new AudioEngine(),
  state: null,
  base: null,          // what Reset goes back to
  presetId: null,
  presetName: '',
  dirty: false,
  compiled: null,
  formulaError: null,
  tool: 'ripple',
  brush: { size: 0.16, strength: 0.7, spring: 0.35 },
  audioCfg: { pulse: 0.6, ripples: 0.3, intensity: 0.9, wobble: 0.3, wave: 0.45, spectrum: 0.3 },   // Patterns (set by the reactivity level)
  reactivity: 'lively',     // subtle | lively | wild — one choice for Patterns and Worlds, then fine-tune
  paused: false,
  thumbs: { presets: {}, patterns: {}, warps: {}, worlds: {} },
  history: [],
  saves: loadSaves(),
  recording: null,
  recordStart: 0,
  mode: 'worlds',           // patterns | worlds | films
  world: new World(),
  tempo: { bpm: 70, beatsPerBar: 2, fromSong: false },
  songAnalysis: null,       // analysis of the song loaded in the Sound panel (gives the bar clock)
  mods: {},                 // Patterns: slider → music source, e.g. { density: { src: 'bass', amt: 0.4 } }
  worldMods: {},            // Worlds: the same, by film parameter, e.g. { bulge: { src: 'bass', amt: 0.5 } } — kept across looks
  // Worlds: how much the music moves things overall (the built-in reactions and every ∿), and the sound's
  // own shapes: the waveform bending the lines, the spectrum spiking them, a landscape of the spectrum
  musicCfg: { amount: 1.4, wave: 0.45, spectrum: 0.3, land: 0 },
  macros: { worlds: defaultMacros(), patterns: defaultMacros() },
  media: new Media(),       // a picture under the membrane: camera / image / video / words
  tracker: new Tracker(),   // your face, hands, body and movement through the camera
  songs: new SongLibrary(), // your songs, kept in this browser
  // the camera. subject = what counts as you: none | scene | body | face | hands (and what they hold) |
  // bodyhands (both) | box (a frame you set) | motion. The rest are extras.
  you: { subject: 'scene', puppet: false, hands: false, motion: false, look: false, handScale: 1, feather: 6, box: { x: 0.5, y: 0.55, w: 0.6, h: 0.7 } },
  // how the camera / picture shows: pushed up as relief, drawn in line thickness, shown as a photo
  mediaCfg: { amount: 1.2, ink: 0.6, photo: 0, photoColor: 0, size: 1, x: 0, y: 0, invert: 0, soft: 2.4, warp: 0, detail: 0.6, calm: 0, aura: 0 },
  // auto-morph in Worlds. when: off | song (a song is playing) | sound (a song or the mic) | always;
  // on: bars (every N) | sections (when the song changes section); cats: kinds of look it may pick
  autoCfg: { when: 'song', on: 'bars', every: 8, cats: ['flat', 'deep', 'space', 'objects', 'bodies'], variations: false },
  explore: { open: false, parent: null, kids: [], history: [], strength: 0.5, locks: { colors: false, camera: false, shapes: false, lines: false } },
};

// Everything that moves every frame.
const rt = {
  time: 0, phase: 0, phase2: 0, spin: 0, cycle: 0, realTime: 0, fade: 0, intensity: 1,
  face: { mouth: 0, eyes: 1 },
  center: [0, 0], pan: [0, 0], mouse: [0, 0],
  ripples: new Float32Array(MAX_RIPPLES * 4), rippleScale: 1,
  pulse: 0, wobble: 0,
  audio: app.audio,
  brush: { x: 0, y: 0, vx: 0, vy: 0, size: 0.16, strength: 0.7, mode: 0, relax: 0.97 },
};
let rippleIdx = 0;

// ------------------------------------------------------------------ state changes
function pushHistory() {
  if (!app.state) return;
  app.history.push(cloneState(app.state));
  if (app.history.length > 50) app.history.shift();
}

function setState(s, { fade = 0.9 } = {}) {
  const old = app.state;
  // keep each warp's animation phase when the same warp sits in the same slot, so nothing jumps
  if (old) s.warps.forEach((w, i) => { if (old.warps[i]?.type === w.type) w._ph = old.warps[i]._ph; });
  app.state = s;
  rt.fade = Math.max(rt.fade, fade);
  refreshFormula();
  ui?.refresh();
}

function refreshFormula() {
  const s = app.state;
  const c = compileFormula(s.formula, s.bendX, s.bendY);
  if (!c.ok) { app.formulaError = c.error; return; }
  const glErr = renderer.setFormula(c);
  if (glErr) {
    console.warn(glErr);
    app.formulaError = { field: 'value', message: 'The graphics card rejected that formula', pos: 0 };
    return;
  }
  app.formulaError = null;
  app.compiled = c;
}

app.touch = () => {
  if (!app.dirty) { app.dirty = true; ui.renderName(); }
};

app.loadPreset = id => {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;
  pushHistory();
  app.presetId = id;
  app.presetName = p.name;
  app.dirty = false;
  app.base = makeState(p.state);
  rt.pan = [0, 0];
  renderer.clearDisp = true;
  setState(makeState(p.state));
};

app.reset = () => {
  pushHistory();
  app.dirty = false;
  rt.pan = [0, 0];
  renderer.clearDisp = true;
  setState(makeState(cloneState(app.base)));
  ui.toast('Back to the base mode');
};

app.mutate = () => {
  pushHistory();
  app.dirty = true;
  setState(mutateState(app.state), { fade: 0.45 });
};

app.surprise = () => {
  pushHistory();
  const s = randomState();
  app.base = makeState(cloneState(s));
  app.presetId = null;
  app.presetName = 'Surprise';
  app.dirty = false;
  setState(s);
};

app.undo = () => {
  const s = app.history.pop();
  if (!s) return ui.toast('Nothing to undo');
  setState(makeState(s), { fade: 0.4 });
};

// in Worlds the same buttons drive the film engine
for (const [name, worldsVersion] of Object.entries({
  mutate: () => { app.world.mutate(barLen() * 1.5); app.dirty = true; ui.renderName(); },
  surprise: () => { app.presetName = app.world.surprise(app.world.morphBars * barLen()); app.dirty = false; ui.renderName(); },
  reset: () => { app.world.goLook(app.world.lookId || 'silk', barLen() * 2); app.dirty = false; ui.renderName(); },
})) {
  const patternsVersion = app[name];
  app[name] = () => (app.mode === 'worlds' ? worldsVersion() : app.mode === 'patterns' ? patternsVersion() : null);
}

app.setPattern = id => {
  const s = app.state;
  if (s.pattern === id) return;
  s.pattern = id;
  s.param = PATTERN_BY_ID[id].param.def;
  rt.fade = Math.max(rt.fade, 0.5);
  app.touch();
};

app.setFormulaText = (key, text) => {
  app.state[key] = text;
  refreshFormula();
  app.touch();
};

app.setFormulaNumber = (i, v) => {
  if (!app.compiled?.nums[i]) return null;
  const { field, text } = replaceNumber(app.compiled, i, v);
  const key = field === 'value' ? 'formula' : field;
  app.state[key] = text;
  refreshFormula();
  app.touch();
  return { key, text };
};

app.applyFormulaPreset = f => {
  pushHistory();
  const s = app.state;
  Object.assign(s, { pattern: 'formula', formula: f.formula, bendX: f.bendX || '0', bendY: f.bendY || '0', param: 0.5, density: 10 });
  s.warps = [];
  rt.fade = Math.max(rt.fade, 0.6);
  refreshFormula();
  app.base = makeState(cloneState(s));
  app.presetId = null;
  app.presetName = `${f.name} · formula`;
  app.dirty = false;
  ui.renderName();
};

app.setTool = id => {
  app.tool = id;
  updateBrushRing();
  ui.renderDock();
};

app.clearDistortion = () => {
  renderer.clearDisp = true;
  rt.ripples.fill(0);
};

app.togglePause = () => {
  app.paused = !app.paused;
  ui.refreshTop();
};

app.toggleUI = () => {
  const hidden = document.body.classList.toggle('ui-hidden');
  if (hidden) ui.toast('Press H (or tap the corner) to bring the menu back');
};

app.toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => ui.toast('Fullscreen is not allowed here'));
};

// ------------------------------------------------------------------ pictures, clips, links, saves
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

let afterRender = []; // callbacks that need the canvas right after a frame is drawn
app.snapshot = () => {
  afterRender.push(() => canvas.toBlob(b => { download(b, `trippy-${stamp()}.png`); ui.toast('Picture saved'); }, 'image/png'));
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
    download(new Blob(chunks, { type }), `trippy-${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
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

app.share = async () => {
  const code = await encodeShare(app.state);
  const url = `${location.origin}${location.pathname}#s=${code}`;
  history.replaceState(null, '', `#s=${code}`);
  try {
    await navigator.clipboard.writeText(url);
    ui.toast('Link copied — whoever opens it sees this exact look');
  } catch {
    ui.toast('Link is in the address bar — copy it from there');
  }
};

function loadSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; }
}
function persistSaves() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(app.saves)); } catch { ui.toast('Could not save — browser storage is full or blocked'); }
}

app.saveCurrent = (name, done) => {
  afterRender.push(() => {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 150;
    const g = c.getContext('2d');
    const sw = canvas.width, sh = canvas.height, aspect = 240 / 150;
    const cw = Math.min(sw, sh * aspect), ch = cw / aspect;
    g.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 240, 150);
    const sv = { id: Date.now().toString(36), name, state: cloneState(app.state), thumb: c.toDataURL('image/jpeg', 0.8) };
    app.saves.unshift(sv);
    persistSaves();
    app.presetId = `save:${sv.id}`;
    app.presetName = name;
    app.base = makeState(cloneState(sv.state));
    app.dirty = false;
    ui.renderName();
    ui.toast(`Saved “${name}”`);
    done?.();
  });
};

app.loadSave = id => {
  const sv = app.saves.find(x => x.id === id);
  if (!sv) return;
  pushHistory();
  app.presetId = `save:${id}`;
  app.presetName = sv.name;
  app.dirty = false;
  app.base = makeState(cloneState(sv.state));
  setState(makeState(cloneState(sv.state)));
};

app.deleteSave = id => {
  app.saves = app.saves.filter(x => x.id !== id);
  persistSaves();
};

// ------------------------------------------------------------------ audio
app.audio.onchange = () => { ui.renderNow(); if (ui.tab === 'sound' || app.mode === 'worlds') ui.refresh(); };
app.songs.onchange = () => { if (app.mode !== 'patterns' || ui.tab === 'sound') ui.refresh(); };

// the same song keeps playing whichever mode you're in; every song you play is kept for next time
app.loadSong = async (file, { keep = true } = {}) => {
  try {
    if (keep) app.songs.add(file);
    await app.audio.loadFile(file);
    ui.toast(`Playing “${app.audio.name}” — finding the beat…`);
    analyseLoadedSong(file);
  } catch (e) {
    console.warn(e);
    ui.toast('Could not play that file');
  }
};
app.currentSongId = () => (app.audio.mode === 'file' && app.audio.file ? `${app.audio.file.name}|${app.audio.file.size}` : null);
app.playSongId = async id => {
  const file = await app.songs.get(id).catch(() => null);
  if (!file) { app.songs.remove(id); return ui.toast('That song is gone from this browser'); }
  if (app.mode === 'films') return app.loadFilmFile(file, { forceAuto: true });
  return app.loadSong(file, { keep: false });
};
app.addSongs = files => {
  const songs = files.filter(isSong);
  if (!songs.length) return ui.toast('Those aren’t songs');
  songs.slice(1).forEach(f => app.songs.add(f));
  if (app.mode === 'films') app.loadFilmFile(songs[0]);
  else app.loadSong(songs[0]);
  if (songs.length > 1) ui.toast(`${songs.length} songs added — playing “${songs[0].name.replace(/\.[^.]+$/, '')}”`);
};
app.nextSong = () => {
  const L = app.songs.list;
  if (!L.length) return;
  const i = L.findIndex(x => x.id === app.currentSongId());
  app.playSongId(L[(i + 1) % L.length].id);
};
app.useMic = async () => {
  try {
    await app.audio.useMic();
    ui.toast('Listening — make some noise');
  } catch {
    ui.toast('Microphone access was blocked');
  }
};
app.stopAudio = () => app.audio.stop();

// ------------------------------------------------------------------ the live music clock
// With a song loaded (and analysed) the bar count follows the song; otherwise it free-runs at app.tempo.
const clock = { bar: 0, hit: 0, tapTimes: [] };
function barLen() { return (60 / app.tempo.bpm) * app.tempo.beatsPerBar; }

function liveMusic(dt) {
  const a = app.audio, an = app.songAnalysis;
  if (an && a.mode === 'file' && a.el && an._file === a.file) clock.bar = (a.el.currentTime - an.beatOffset) / barLen();
  else if (!app.paused) clock.bar += dt / barLen();
  clock.hit = a.beat ? 1 : clock.hit * Math.exp(-dt * 7);
  const on = a.mode !== 'off';
  return { on, bar: clock.bar, barLen: barLen(), loud: on ? a.level : 0.5, bass: on ? a.bass : 0, mid: on ? a.mid : 0, high: on ? a.high : 0, hit: clock.hit, time: rt.realTime };
}

app.tapTempo = () => {
  const now = performance.now() / 1000, taps = clock.tapTimes;
  if (taps.length && now - taps[taps.length - 1] > 2) taps.length = 0;
  taps.push(now);
  if (taps.length > 6) taps.shift();
  if (taps.length >= 3) {
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    app.tempo.bpm = Math.round(60 / (gaps.reduce((x, y) => x + y, 0) / gaps.length));
    app.tempo.fromSong = false;
    clock.bar = Math.round(clock.bar);
  }
  return app.tempo.bpm;
};

async function analyseLoadedSong(file) {
  try {
    const an = await analyzeAudio(await file.arrayBuffer());
    an._file = file;
    let bpm = an.bpm;
    while (bpm < 55) bpm *= 2;
    while (bpm > 150) bpm /= 2;
    app.tempo = { bpm: Math.round(bpm * 10) / 10, beatsPerBar: bpm < 85 ? 2 : an.meter || 4, fromSong: true };
    app.songAnalysis = an;
    ui.refresh();
  } catch (e) { console.warn('analysis failed', e); }
}

// ------------------------------------------------------------------ Patterns: let any slider follow the music
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
app.modSources = ['bass', 'mid', 'high', 'loud', 'beat', 'bar', 'slow'];
function sourceValue(src, m) {
  switch (src) {
    case 'bass': return m.bass;
    case 'mid': return m.mid;
    case 'high': return m.high;
    case 'loud': return m.on === false ? 0 : m.loud;   // silence shouldn't nudge anything
    case 'beat': return m.hit;
    case 'bar': return 0.5 + 0.5 * Math.sin(m.bar * Math.PI * 2);
    case 'slow': return 0.5 + 0.5 * Math.sin(m.bar * Math.PI / 4);
    default: return 0;
  }
}
function modulated(s, m) {
  const entries = Object.entries(app.mods);
  if (!entries.length) return s;
  const out = { ...s, warps: s.warps.map(w => ({ ...w })) };
  for (const [key, { src, amt }] of entries) {
    const x = sourceValue(src, m) * amt;
    if (key.startsWith('w')) {
      const [wi, f] = key.slice(1).split('.');
      const w = out.warps[+wi];
      const meta = w && WARP_BY_ID[w.type].params[f];
      if (meta) w[f] = clampN(w[f] + x * (meta.max - meta.min) * 0.6, meta.min, meta.max);
    } else if (RANGES[key]) out[key] = clampN(out[key] + x * (RANGES[key].max - RANGES[key].min) * 0.6, RANGES[key].min, RANGES[key].max);
  }
  return out;
}
app.setMod = (key, src, amt = 0.4) => {
  if (!src) delete app.mods[key];
  else app.mods[key] = { src, amt: app.mods[key]?.amt ?? amt };
};

// ------------------------------------------------------------------ Worlds: the song → the visuals
app.setWorldMod = (key, src, amt) => {
  if (!src) delete app.worldMods[key];
  else app.worldMods[key] = { src, amt: amt ?? app.worldMods[key]?.amt ?? 0.4 };
};
// Reactivity: one choice for how hard the music hits, in Patterns and Worlds. Its ties are marked so
// switching level swaps only them — ties you made yourself stay.
app.LEVELS = {
  subtle: { name: 'Subtle', blurb: 'sways and breathes with the music',
    worlds: { amount: 0.8, wave: 0, spectrum: 0, land: 0 }, ties: {},
    patterns: { pulse: 0.3, ripples: 0.1, intensity: 0.4, wobble: 0.1, wave: 0, spectrum: 0 } },
  lively: { name: 'Lively', blurb: 'the lines carry the sound wave; the beat punches in',
    worlds: { amount: 1.4, wave: 0.45, spectrum: 0.3, land: 0 }, ties: { frame: ['beat', -0.05], bulge: ['bass', 0.3] },
    patterns: { pulse: 0.6, ripples: 0.3, intensity: 0.9, wobble: 0.3, wave: 0.45, spectrum: 0.3 } },
  wild: { name: 'Wild', blurb: 'everything follows the song — waves, spikes, a landscape of sound',
    worlds: { amount: 2, wave: 1.1, spectrum: 0.8, land: 0.8 },
    ties: { frame: ['beat', -0.09], freq: ['beat', 0.1], twist: ['loud', 0.3], warpN: ['mid', 0.45], bulge: ['bass', 0.5] },
    patterns: { pulse: 1, ripples: 0.6, intensity: 1, wobble: 0.6, wave: 1, spectrum: 0.7 } },
};
app.setReactivity = id => {
  const L = app.LEVELS[id];
  if (!L) return;
  app.reactivity = id;
  Object.assign(app.musicCfg, L.worlds);
  Object.assign(app.audioCfg, L.patterns);
  for (const [key, t] of Object.entries(app.worldMods)) if (t.level) delete app.worldMods[key];
  for (const [key, [src, amt]] of Object.entries(L.ties)) if (!app.worldMods[key]) app.worldMods[key] = { src, amt, level: true };
};
app.setReactivity('lively');

// runs before speeds are integrated, so a speed tied to the bass really speeds up with it
function applyWorldMods(v, m) {
  const C = app.musicCfg, k = C.amount, s = Math.min(1, k);
  for (const key of ['sway', 'swayX', 'pulse', 'react', 'breathe', 'grab', 'hitFlash']) v[key] *= k;
  v.swave = C.wave * s; v.sspec = C.spectrum * s; v.sland = C.land * s;
  for (const [key, { src, amt }] of Object.entries(app.worldMods)) {
    const p = PARAM_BY_NAME[key];
    if (!p || typeof v[key] !== 'number') continue;
    v[key] = clampN(v[key] + sourceValue(src, m) * amt * k * (p.max - p.min) * 0.6, p.min, p.max);
  }
}

// ------------------------------------------------------------------ modes
app.setMode = mode => {
  if (app.mode === mode) return;
  if (app.mode === 'films') app.filmStop();
  if (app.mode === 'patterns') app.patternsName = app.presetName;
  app.mode = mode;
  if (mode === 'patterns') app.presetName = app.patternsName || PRESETS[0].name;
  if (mode === 'worlds') app.presetName = LOOKS[app.world.lookId || 'silk'].name;
  if (mode === 'films') app.presetName = film.def?.title || 'Films';
  document.body.dataset.mode = mode;
  if (mode === 'patterns') scale = modeMaxScale();
  resize();
  if (mode === 'worlds' && !app.world.lookId) app.world.goLook('silk', 0.01);
  if (mode === 'films' && !film.def && film.status === 'idle') app.loadPPP();
  renderer.clearSlot(0);
  ui.refresh();
  ui.renderDock();
};

// ------------------------------------------------------------------ Worlds (the film engine, live)
app.worldLook = id => {
  app.world.goLook(id, app.world.morphBars * barLen());
  app.presetName = LOOKS[id].name;
  app.dirty = false;
  ui.renderName();
};

// ------------------------------------------------------------------ Films
const PPP_FILE = 'Beach House - PPP.mp3';
const film = app.film = {
  kind: null,           // 'ppp' | 'auto'
  def: null,            // the film: keyframes laid against the song
  tl: null,
  analysis: null,
  file: null,
  active: false,
  clock: 0,
  status: 'idle',       // idle | loading | ready | need-song | error
  message: '',
  seed: 0,
  cinema: true,
  recordRun: false,
  chapter: -1,
  hits: [],
  hitIdx: 0,
  hit: 0,
  lastValues: null,
  P: new Float32Array(SHADER_COUNT),
};

async function prepareSong(file) {
  film.status = 'loading';
  film.message = 'Listening to the song…';
  ui.refreshRun();
  const analysis = await analyzeAudio(await file.arrayBuffer(), msg => { film.message = `${msg}…`; ui.refreshRun(); });
  await app.audio.loadFile(file, { autoplay: false, loop: false });
  const el = app.audio.el;
  if (el.readyState < 1) await new Promise(r => el.addEventListener('loadedmetadata', r, { once: true }));
  el.addEventListener('ended', onFilmEnded);
  film.file = file;
  film.analysis = analysis;
  // strong onsets, for flashes
  const on = analysis.onset;
  film.hits = [];
  for (let i = 2; i < on.length - 2; i++) {
    if (on[i] > 0.45 && on[i] >= on[i - 1] && on[i] >= on[i + 1] && on[i] >= on[i - 2] && on[i] >= on[i + 2]) film.hits.push(i / analysis.fps);
  }
  return analysis;
}

function useFilm(def) {
  film.def = def;
  film.tl = new Timeline(def);
  film.kind = def.id;
  film.status = 'ready';
  film.message = '';
  film.chapter = -1;
  film.active = true;
  renderer.clearSlot(0);
}

const songName = () => film.file?.name.replace(/\.[^.]+$/, '') || 'your song';

app.loadFilmFile = async (file, { forceAuto = false } = {}) => {
  try {
    app.filmStop();
    app.songs.add(file);
    const an = await prepareSong(file);
    const ppp = !forceAuto && /ppp/i.test(file.name) && Math.abs(an.duration - PPP_FILM.duration) < 4;
    if (ppp) useFilm(PPP_FILM);
    else {
      film.seed = (Math.random() * 2 ** 31) | 0;
      useFilm(generateFilm(an, film.seed, songName()));
    }
    ui.refreshRun();
    ui.toast(ppp ? 'PPP is ready — press play' : 'Your film is written — press play');
  } catch (e) {
    console.warn(e);
    film.status = 'error';
    film.message = 'Could not read that song.';
    ui.refreshRun();
  }
};

// The PPP film uses the MP3 sitting next to the app when there is one; otherwise it asks for it.
app.loadPPP = async () => {
  if (film.kind === 'ppp' && film.analysis) return;
  try {
    const res = await fetch(encodeURI(PPP_FILE));
    if (!res.ok || /text\/html/.test(res.headers.get('content-type') || '')) throw new Error('missing');
    await app.loadFilmFile(new File([await res.blob()], PPP_FILE, { type: 'audio/mpeg' }));
  } catch {
    film.status = 'need-song';
    film.message = 'Drop “Beach House - PPP.mp3” onto the page — the song isn’t hosted with the app.';
    ui.refreshRun();
  }
};

app.reshuffle = () => {
  if (!film.analysis) return;
  film.seed = (Math.random() * 2 ** 31) | 0;
  useFilm(generateFilm(film.analysis, film.seed, songName()));
  ui.refreshRun();
  ui.toast(`New film · seed ${film.seed}`);
};

app.autoFromCurrentSong = () => {
  const f = app.audio.file;
  if (!f) return ui.toast('Load a song first');
  app.setMode('films');
  app.loadFilmFile(f, { forceAuto: true });
};

app.filmPlaying = () => !!(film.active && app.audio.el && !app.audio.el.paused && film.file === app.audio.file);

app.filmPlay = async () => {
  if (!film.tl || !app.audio.el) return;
  if (app.mode !== 'films') app.setMode('films');
  film.active = true;
  await app.audio.ctx.resume();
  if (app.audio.el.ended) app.audio.el.currentTime = 0;
  await app.audio.el.play();
  film.clock = app.audio.el.currentTime;
  if (film.cinema) {
    document.body.classList.add('ui-hidden');
    ui.toast('H shows the controls · Space pauses · Esc stops');
  }
  ui.refreshRun();
};

app.filmPause = () => {
  app.audio.el?.pause();
  ui.refreshRun();
};

app.filmSeek = t => {
  if (!app.audio.el || !film.tl) return;
  app.audio.el.currentTime = Math.max(0, Math.min(film.tl.duration - 0.05, t));
  film.clock = app.audio.el.currentTime;
  film.hitIdx = film.hits.findIndex(h => h >= film.clock);
  film.active = true;
};

// stop the film; optionally carry the look on screen into Worlds to keep playing with it
app.filmStop = ({ keepLook = false } = {}) => {
  if (film.recordRun && app.recording) app.recording.stop();
  film.recordRun = false;
  if (film.file && app.audio.file === film.file) app.audio.el?.pause();
  document.body.classList.remove('ui-hidden');
  if (keepLook && film.lastValues) {
    const v = film.lastValues;
    const set = {};
    for (const [k, x] of Object.entries(v)) set[k] = x;
    app.world.morphTo(set, 0.01);
    app.presetName = film.tl?.chapters[film.chapter]?.name || 'From the film';
    app.setMode('worlds');
  }
  ui.renderName();
  ui.refreshRun();
};

app.recordRun = async () => {
  if (!film.tl) return;
  app.filmSeek(0);
  await app.filmPlay();
  if (!app.recording) app.toggleRecord();
  film.recordRun = true;
};

function onFilmEnded() {
  if (film.recordRun && app.recording) app.recording.stop();
  film.recordRun = false;
  document.body.classList.remove('ui-hidden');
  ui.refreshRun();
}

// a smooth song clock: advances with the frame, gently pulled toward the audio element's time
function filmTime(dt) {
  const el = app.audio.el;
  if (!el || film.file !== app.audio.file) return film.clock;
  if (!el.paused) {
    film.clock += dt;
    const ct = el.currentTime;
    if (Math.abs(ct - film.clock) > 0.08) film.clock = ct;
    else film.clock += (ct - film.clock) * 0.1;
  } else film.clock = el.currentTime;
  return Math.max(0, film.clock - (app.audio.ctx?.outputLatency || 0));
}

// ------------------------------------------------------------------ you: camera, pictures, words
const media = app.media, tracker = app.tracker;
rt.fingers = new Float32Array(15);
rt.handMirror = new Float32Array([1, 1, 1]);
const track = { hands: [0, 1].map(() => ({ on: 0, x: 0, y: 0, s: 1, a: 0, curls: [0, 0, 0, 0, 0], spread: 0.5, mirror: 1 })), face: { on: 0, x: 0, y: 0, s: 0.6, roll: 0, turn: 0, mouth: 0, eyes: 1 }, lastRipple: 0, dt: 1 / 60 };

function syncTrackerWants() {
  const y = app.you, sub = y.subject;
  tracker.setWant('face', y.puppet || y.look || sub === 'face');
  tracker.setWant('hands', y.hands || sub === 'hands' || sub === 'bodyhands');
  tracker.setWant('body', sub === 'body' || sub === 'bodyhands');
  tracker.setWant('motion', y.motion || sub === 'motion');
  media.cam.subject = sub;
}
tracker.onchange = () => ui?.refreshYou();

app.cameraOn = async () => {
  try {
    await tracker.start();
    media.attachCamera(tracker.video);
    syncTrackerWants();
    if (app.mode === 'patterns') app.setMode('worlds');
    ui.toast('Camera on — it stays on this computer');
  } catch {
    ui.toast('Camera access was blocked');
  }
  ui.refreshYou();
};
app.cameraOff = () => {
  tracker.stop();
  media.detachCamera();
  rt.fingers.fill(0);
  ui.refreshYou();
};
app.setYou = (key, value) => {
  app.you[key] = value;
  syncTrackerWants();
  ui.refreshYou();
};

// one-click camera setups: what counts as you, and how it shows
app.SETUPS = [
  { id: 'lines', name: 'Lines over me', blurb: 'the whole picture pressing up through the lines',
    you: { subject: 'scene' }, cfg: { photo: 0, amount: 1.2, ink: 0.6, calm: 0, aura: 0, detail: 0.6 } },
  { id: 'me', name: 'Just me', blurb: 'you, clear, with the pattern moving around you',
    you: { subject: 'body' }, cfg: { photo: 0.9, amount: 0.4, ink: 0, calm: 1, aura: 0.7, detail: 0.85 } },
  { id: 'guitar', name: 'Playing guitar', blurb: 'body, arms and guitar clear; your playing (mic) moves everything else',
    you: { subject: 'bodyhands' }, cfg: { photo: 1, amount: 0.25, ink: 0, calm: 1, aura: 1, detail: 0.95 }, mic: true },
  { id: 'hands', name: 'Just hands & guitar', blurb: 'only your hands and what they hold, sharp — the rest reacts to the sound',
    you: { subject: 'hands' }, cfg: { photo: 1, amount: 0.2, ink: 0, calm: 1, aura: 1.2, detail: 1 }, mic: true },
  { id: 'face', name: 'My face', blurb: 'your face engraved into the lines',
    you: { subject: 'face' }, cfg: { photo: 0.35, amount: 1, ink: 0.9, calm: 1, aura: 0.6, detail: 0.85 } },
  { id: 'ghost', name: 'Ghost puppet', blurb: 'no picture — the face in the lines copies yours',
    you: { subject: 'none', puppet: true }, cfg: { photo: 0, amount: 0, ink: 0, calm: 0, aura: 0 } },
  { id: 'trails', name: 'Movement', blurb: 'only what moves leaves a trail in the lines',
    you: { subject: 'motion', motion: true }, cfg: { photo: 0, amount: 1.6, ink: 0.4, calm: 0, aura: 0 } },
];
app.quickSetup = async id => {
  const S = app.SETUPS.find(x => x.id === id);
  if (!S) return;
  Object.assign(app.you, { puppet: false, motion: false }, S.you, { setup: id });
  Object.assign(app.mediaCfg, S.cfg);
  if (['image', 'video', 'text'].includes(media.kind)) media.clear();
  if (!tracker.on) await app.cameraOn();
  else syncTrackerWants();
  if (S.mic && app.audio.mode === 'off') await app.useMic();
  ui.refreshYou();
};

app.loadPicture = async file => {
  try {
    if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) await media.setVideo(file);
    else await media.setImage(file);
    if (app.mode === 'patterns') app.setMode('worlds');
    ui.toast(`“${file.name}” is under the lines now`);
  } catch (e) {
    console.warn(e);
    ui.toast('Could not open that file');
  }
  ui.refreshYou();
};
app.setWords = (text, font) => {
  media.setText(text, font);
  if (text.trim() && app.mode === 'patterns') app.setMode('worlds');
};
app.clearPicture = () => { media.clear(); ui.refreshYou(); };

function updateInputs(dt) {
  track.dt = dt;
  const cfg = app.mediaCfg;
  if (tracker.on) tracker.update();
  const masks = { motion: tracker.motion.canvas };
  if (tracker.on && media.kind === 'camera' && media.masked) masks.canvas = tracker.drawMasks(app.you.subject, { box: app.you.box, feather: app.you.feather });
  media.setBlur(0);
  media.cam.detail = cfg.detail;
  // the relief's blur is in the blurred copy's own pixels: a sharper camera picture needs a wider blur
  // to stay as smooth (Detail lets a little more of it through)
  const sigma = (0.8 + cfg.soft * 1.4) * (media.kind === 'camera' ? (media.canvas.width / 480) * (1.15 - 0.5 * cfg.detail) : 1);
  if (app.mode !== 'patterns' && (media.update(rt.realTime, masks) || Math.abs(sigma - (track.sigma || 0)) > 0.05)) {
    track.sigma = sigma;
    renderer.setMedia(media.output, media.aspect, sigma);
  }
}

const ease = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-track.dt * rate));

// write the camera / picture into the film values (Worlds and Films)
function applyInputs(v, still = false) {
  const cfg = app.mediaCfg, y = app.you;
  const picture = ['image', 'video', 'text'].includes(media.kind);
  const camRelief = media.kind === 'camera' && y.subject !== 'none';
  const hh = v.frame * cfg.size, cx = v.tx + cfg.x * v.frame, cy = v.ty + cfg.y * v.frame;
  if (picture || camRelief) {
    // the aura breathes with the sound: louder pushes the lines further out, hits kick it
    const mu = track.music || neutralMusic;
    const pump = 0.5 + 0.9 * mu.loud + 0.6 * mu.hit;
    Object.assign(v, {
      media: cfg.amount, mediaInk: cfg.ink, mediaPhoto: cfg.photo, photoColor: cfg.photoColor, mediaInv: cfg.invert, mediaSoft: 0, mediaWarp: cfg.warp,
      mediaS: hh, mediaX: cx, mediaY: cy, mediaMask: media.masked ? 1 : 0, mediaLift: media.masked ? 0.45 : 0,
      mediaCalm: cfg.calm, aura: cfg.aura * pump,
    });
  } else Object.assign(v, { media: 0, mediaInk: 0, mediaPhoto: 0, mediaCalm: 0, aura: 0 });
  if (!tracker.on) { rt.fingers.fill(0); return; }
  const A = tracker.aspect;
  const toSheet = (u, vv) => [cx + (u - 0.5) * 2 * hh * A, cy + (0.5 - vv) * 2 * hh];

  // your hands → the 3D hands, finger by finger
  for (let i = 0; i < 2; i++) {
    const T = track.hands[i], H = y.hands ? tracker.hands[i] : null;
    T.on = ease(T.on, H ? 1 : 0, 6);
    if (H) {
      const [x, yy] = toSheet(H.u, H.v);
      T.x = ease(T.x, x, 18); T.y = ease(T.y, yy, 18);
      T.s = ease(T.s, (H.size * 2 * hh) / 0.2 * y.handScale, 10);
      T.a = ease(T.a, H.angle, 14);
      T.curls = T.curls.map((c, j) => ease(c, H.curls[j], 16));
      T.spread = ease(T.spread, H.spread, 10);
      T.mirror = H.mirror;
    }
    if (T.on > 0.01) {
      Object.assign(v, {
        [`h${i}on`]: T.on, [`h${i}x`]: T.x, [`h${i}y`]: T.y - 0.12 * T.s, [`h${i}s`]: T.s, [`h${i}a`]: T.a,
        [`h${i}z`]: Math.min(0.45, Math.max(0.03, 0.05 + (T.s - 1) * 0.18)), [`h${i}curl`]: 0, [`h${i}spread`]: T.spread,
      });
      T.curls.forEach((c, j) => { rt.fingers[i * 5 + j] = c * 1.1; });
      rt.handMirror[i] = T.mirror;
    } else for (let j = 0; j < 5; j++) rt.fingers[i * 5 + j] = 0;
  }

  // your face → the ghost puppet, and/or the camera moves as your head moves
  const F = track.face, f = tracker.face;
  F.on = ease(F.on, f ? 1 : 0, 5);
  if (f) {
    const [x, yy] = toSheet(f.u, f.v);
    F.x = ease(F.x, x, 14); F.y = ease(F.y, yy, 14);
    F.s = ease(F.s, f.height * 2 * hh * 0.95, 8);
    F.roll = ease(F.roll, f.roll, 12); F.turn = ease(F.turn, f.turn, 12);
    F.mouth = ease(F.mouth, f.mouth, 20); F.eyes = ease(F.eyes, f.eyes, 25);
    F.u = f.u; F.v = f.v;
  }
  if (y.puppet && F.on > 0.01) {
    Object.assign(v, { face: Math.max(v.face, 1.1 * F.on), faceX: F.x, faceY: F.y, faceS: F.s, faceRoll: F.roll, faceTurn: F.turn, mouth: F.mouth, eyes: F.eyes });
  }
  if (y.look && F.on > 0.01 && F.u != null) {
    const hx = (F.u - 0.5) * 2 * F.on, hy = (0.5 - F.v) * 2 * F.on;
    v.yaw -= hx * 0.35;
    v.pitch = Math.min(1.35, Math.max(-0.25, v.pitch - hy * 0.25));
    v.tx += hx * 0.25 * v.frame;
    v.ty += hy * 0.2 * v.frame;
  }

  // movement → ripples in the fabric where you moved
  const m = tracker.motion;
  if (!still && y.motion && m.energy > 0.015 && rt.realTime - track.lastRipple > 0.28) {
    spawnRipple((m.u - 0.5) * A * cfg.size + cfg.x * 0.5, (0.5 - m.v) * cfg.size + cfg.y * 0.5, Math.min(1.6, m.energy * 25));
    track.lastRipple = rt.realTime;
  }
}

// ------------------------------------------------------------------ breeding: 9 children of what you're looking at
let thumbR = null;
function thumbRenderer() {
  if (!thumbR) { thumbR = new Renderer(document.createElement('canvas'), { preserve: true }); thumbR.setFormula(compileFormula('sin(x*d)')); }
  return thumbR;
}
const neutralMusic = { bar: 0.3, barLen: 1.7, loud: 0.5, bass: 0.2, mid: 0.2, high: 0.2, hit: 0, time: 2 };
function worldStill(set, w = 320, h = 180) {
  const tr = thumbRenderer();
  tr.resize(w, h);
  if (media.kind !== 'none') tr.setMedia(media.output, media.aspect, track.sigma || 3);
  const v = defaultValues();
  for (const [k, x] of Object.entries(expand(set))) if (k in v) v[k] = Array.isArray(v[k]) ? (Array.isArray(x) ? x : hexToRgb(x)) : x;
  applyMacrosWorld(v, app.macros.worlds);
  applyMusic(v, neutralMusic);
  applyInputs(v, true);
  const P = new Float32Array(SHADER_COUNT);
  tr.clearSlot(0);
  tr.renderFilm(toShader(v, P), { realTime: 0, ripples: new Float32Array(MAX_RIPPLES * 4), stepK: stepFactor(v), fingers: rt.fingers, handMirror: rt.handMirror }, 0);
  tr.composite({ a: 0, post: { ...toPost(v), grain: 0.05 } });
  return tr.canvas.toDataURL('image/jpeg', 0.8);
}
function patternStill(state, w = 320, h = 180) {
  const tr = thumbRenderer();
  tr.resize(w, h);
  const s = applyMacrosPatterns(state, app.macros.patterns);
  s.warps.forEach(x => { x._ph = 2.5 * x.speed; });
  const c = compileFormula(s.formula, s.bendX, s.bendY);
  if (c.ok) tr.setFormula(c);
  tr.clearDisp = true;
  tr.render({ ...s, echo: 0 }, {
    time: 2.5, phase: 2.5 * s.flow, phase2: 0, spin: 0, cycle: 0, realTime: 0, fade: 0, intensity: 1, face: { mouth: 0.2, eyes: 1 },
    center: [0, 0], mouse: [0, 0], ripples: new Float32Array(MAX_RIPPLES * 4), rippleScale: 1, pulse: 0, wobble: 0,
    audio: { bass: 0, mid: 0, high: 0, level: 0 }, brush: { x: 0, y: 0, vx: 0, vy: 0, size: 0.1, strength: 0, mode: 0, relax: 0 },
  });
  return tr.canvas.toDataURL('image/jpeg', 0.8);
}

function currentParent() {
  if (app.mode === 'patterns') return cloneState(app.state);
  // mid-glide, breed from where it's going (the look you picked), not from the halfway point
  const w = app.world;
  return Object.fromEntries(Object.entries(w.to).map(([k, x]) => [k, Array.isArray(x) ? x.slice() : x]));
}
app.exploreBreed = (parent = app.explore.parent) => {
  const X = app.explore;
  X.parent = parent;
  X.kids = [];
  for (let i = 0; i < 8; i++) {
    const seed = (Math.random() * 1e9) | 0;
    const set = app.mode === 'patterns'
      ? breedPatterns(parent, X.strength, mutateState, randomState, seed)
      : breedWorld(parent, X.strength, X.locks, seed);
    X.kids.push({ set, img: null });
  }
  X.parentImg = app.mode === 'patterns' ? patternStill(parent) : worldStill(parent);
  ui.renderExplore();
  // render the stills one at a time so the grid fills in without a freeze
  X.kids.forEach((k, i) => setTimeout(() => {
    if (X.kids[i] !== k) return;
    k.img = app.mode === 'patterns' ? patternStill(k.set) : worldStill(k.set);
    ui.renderExplore();
  }, 30 * (i + 1)));
};
app.exploreOpen = () => {
  if (app.mode === 'films') return ui.toast('Explore works in Worlds and Patterns');
  app.explore.open = true;
  app.explore.history = [];
  app.exploreBreed(currentParent());
};
app.explorePick = i => {
  const X = app.explore, kid = X.kids[i];
  if (!kid) return;
  X.history.push(X.parent);
  if (app.mode === 'patterns') {
    pushHistory();
    app.presetName = 'Bred';
    setState(makeState(cloneState(kid.set)), { fade: 0.6 });
  } else {
    app.world.morphTo(kid.set, app.world.morphBars * barLen() * 0.6);
    app.presetName = 'Bred';
    ui.renderName();
  }
  app.exploreBreed(kid.set);
};
app.exploreBack = () => {
  const X = app.explore, prev = X.history.pop();
  if (!prev) return;
  if (app.mode === 'patterns') setState(makeState(cloneState(prev)), { fade: 0.5 });
  else app.world.morphTo(prev, 1);
  app.exploreBreed(prev);
};
app.exploreClose = () => { app.explore.open = false; ui.renderExplore(); };

function renderFilmFrame(dt) {
  const t = filmTime(dt);
  const tl = film.tl, A = film.analysis;
  if (film.hitIdx < 0) film.hitIdx = film.hits.length;
  while (film.hitIdx < film.hits.length && film.hits[film.hitIdx] <= t) { film.hit = 1; film.hitIdx++; }
  film.hit *= Math.exp(-dt * 7);
  const v = tl.values(t);
  track.music = {
    bar: (t - tl.barZero) / tl.barLen, barLen: tl.barLen,
    loud: sample(A.rms, t), bass: sample(A.bass, t), mid: sample(A.mid, t), high: sample(A.high, t),
    hit: film.hit, time: t,
  };
  applyMusic(v, track.music);
  applyInputs(v);
  film.lastValues = v;
  rt.stepK = stepFactor(v) * (rt.ripples.some((x, i) => i % 4 === 3 && x > 0 && rt.realTime - rt.ripples[i - 1] < 5) ? 0.7 : 1);
  renderer.updateDisp(rt);
  renderer.renderFilm(toShader(v, film.P), rt, 0);
  renderer.composite({ a: 0, post: toPost(v) });
  const ci = tl.chapterAt(t);
  if (ci !== film.chapter) {
    film.chapter = ci;
    ui.runScene(ci);
  }
  ui.runTick(t);
}

// is auto-morph running right now? (by default only while a song plays)
app.autoActive = () => {
  const a = app.audio, when = app.autoCfg.when;
  if (when === 'always') return true;
  if (when === 'song') return a.mode === 'file' && a.playing;
  if (when === 'sound') return a.mode !== 'off' && a.playing;
  return false;
};
let sectionIdx = -1;
function renderWorldFrame(dt) {
  const w = app.world, A = app.autoCfg;
  const m = liveMusic(dt);
  track.music = m;
  // "on the song's sections" needs an analysed song playing; otherwise it falls back to every N bars
  const an = app.songAnalysis, a = app.audio;
  const bySection = A.on === 'sections' && an && a.mode === 'file' && a.el && an._file === a.file;
  let force = false;
  if (bySection) {
    const idx = an.boundaries.filter(b => b <= a.el.currentTime).length;
    force = sectionIdx >= 0 && idx !== sectionIdx;
    sectionIdx = idx;
  } else sectionIdx = -1;
  w.auto = app.autoActive();
  w.autoBars = bySection ? 1e9 : A.every;
  const named = w.tickAuto(m.bar, m.barLen, { cats: A.cats, variations: A.variations }, force && w.auto);
  if (named) { app.presetName = `Auto · ${named}`; ui.renderName(); }
  const h = w.hand;
  const want = app.tool === 'hand' && pointer.inside ? 1 : 0;
  h.on += (want - h.on) * (1 - Math.exp(-dt * 4));
  h.press += ((pointer.down && app.tool === 'hand' ? 1 : 0) - h.press) * (1 - Math.exp(-dt * 6));
  const cur = w.current || w.values();
  h.x += (cur.tx + pointer.x * 2 * cur.frame - h.x) * (1 - Math.exp(-dt * 10));
  h.y += (cur.ty + pointer.y * 2 * cur.frame - 0.12 - h.y) * (1 - Math.exp(-dt * 10));
  const { P, post } = w.frame(app.paused ? 0 : dt, m, { pre: v => { applyMacrosWorld(v, app.macros.worlds); applyWorldMods(v, m); }, post: applyInputs });
  rt.stepK = stepFactor(w.current) * (rt.ripples.some((x, i) => i % 4 === 3 && x > 0 && rt.realTime - rt.ripples[i - 1] < 5) ? 0.7 : 1);
  renderer.updateDisp(rt);
  renderer.renderFilm(P, rt, 0);
  renderer.composite({ a: 0, post });
}

// drag a song anywhere onto the page
const dropEl = document.getElementById('drop');
let dragDepth = 0;
addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; dropEl.classList.add('show'); } });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropEl.classList.remove('show'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  dropEl.classList.remove('show');
  const files = [...e.dataTransfer.files];
  const pic = files.find(x => /^(image|video)\//.test(x.type) || /\.(png|jpe?g|gif|webp|avif|mp4|mov|webm|m4v)$/i.test(x.name));
  if (pic) return app.loadPicture(pic);
  if (!files.some(isSong)) return ui.toast('Drop a song, a picture or a video');
  app.addSongs(files);
});

// ------------------------------------------------------------------ mouse / touch
const pointer = { down: false, x: 0, y: 0, lastRipple: 0, lastX: 0, lastY: 0 };
const ring = document.getElementById('brush');

function toUV(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left - r.width / 2) / r.height, (r.height / 2 - (e.clientY - r.top)) / r.height];
}

function spawnRipple(x, y, strength) {
  rt.ripples.set([x, y, rt.realTime, strength], rippleIdx * 4);
  rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
}

function updateBrushRing(e) {
  if (e) { ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`; }
  const show = !['move', 'hand'].includes(app.tool) && !matchMedia('(pointer: coarse)').matches;
  ring.classList.toggle('show', show && pointer.inside);
  const d = app.brush.size * 2 * canvas.getBoundingClientRect().height * (app.tool === 'ripple' ? 0.6 : 1);
  ring.style.width = ring.style.height = `${d}px`;
  ring.classList.toggle('down', pointer.down);
}

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointer.down = true;
  [pointer.x, pointer.y] = toUV(e);
  [pointer.lastX, pointer.lastY] = [pointer.x, pointer.y];
  rt.brush.x = pointer.x; rt.brush.y = pointer.y;
  rt.mouse = [pointer.x, pointer.y];
  if (app.tool === 'ripple') {
    spawnRipple(pointer.x, pointer.y, app.brush.strength * 1.6);
    pointer.lastRipple = rt.realTime;
  }
  ui.dismissHint();
  updateBrushRing(e);
});

canvas.addEventListener('pointermove', e => {
  const [x, y] = toUV(e);
  pointer.inside = true;
  if (pointer.down && app.tool === 'move') {
    rt.pan[0] += x - pointer.x;
    rt.pan[1] += y - pointer.y;
  }
  pointer.x = x; pointer.y = y;
  rt.mouse = [x, y];
  if (pointer.down && app.tool === 'ripple' && rt.realTime - pointer.lastRipple > 0.08 && Math.hypot(x - pointer.lastX, y - pointer.lastY) > 0.03) {
    spawnRipple(x, y, app.brush.strength * 1.1);
    pointer.lastRipple = rt.realTime;
    pointer.lastX = x; pointer.lastY = y;
  }
  updateBrushRing(e);
});

const release = () => { pointer.down = false; updateBrushRing(); };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => { pointer.inside = false; updateBrushRing(); });
canvas.addEventListener('dblclick', () => { if (app.tool === 'move') rt.pan = [0, 0]; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (app.mode === 'worlds') {
    app.world.set('frame', Math.min(3, Math.max(0.05, app.world.get('frame') * Math.exp(e.deltaY * 0.0015))));
  } else if (app.mode === 'patterns') {
    app.state.zoom = Math.min(4, Math.max(0.2, app.state.zoom * Math.exp(-e.deltaY * 0.0015)));
  }
  app.touch();
}, { passive: false });

// the faint corner button that brings the UI back when it's hidden (for touch screens)
document.getElementById('unhide').addEventListener('click', () => (document.body.classList.contains('ui-hidden') ? app.toggleUI() : ui.setView('topbar', true)));

// ------------------------------------------------------------------ keyboard
addEventListener('keydown', e => {
  if (e.target.closest('textarea, input[type="text"], input[type="color"], select')) return;
  if (e.metaKey || e.ctrlKey) {
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); app.undo(); }
    return;
  }
  const k = e.key.toLowerCase();
  if (app.mode === 'films' && film.tl) {
    const filmKeys = {
      ' ': () => (app.filmPlaying() ? app.filmPause() : app.filmPlay()),
      escape: () => app.filmStop(),
      arrowright: () => app.filmSeek(film.clock + 5),
      arrowleft: () => app.filmSeek(film.clock - 5),
    };
    if (filmKeys[k]) { e.preventDefault(); filmKeys[k](); return; }
  }
  const presetStep = d => {
    if (app.mode === 'worlds') {
      const ids = Object.keys(LOOKS), i = ids.indexOf(app.world.lookId);
      return app.worldLook(ids[(i + d + ids.length) % ids.length]);
    }
    const i = PRESETS.findIndex(p => p.id === app.presetId);
    app.loadPreset(PRESETS[(i + d + PRESETS.length) % PRESETS.length].id);
  };
  const act = {
    ' ': app.togglePause, h: app.toggleUI, f: app.toggleFullscreen, r: app.reset, m: app.mutate, e: app.exploreOpen,
    d: app.surprise, s: app.snapshot, z: app.undo,
    arrowright: () => presetStep(1), arrowleft: () => presetStep(-1),
    '[': () => { app.brush.size = Math.max(0.04, app.brush.size * 0.85); ui.renderDock(); updateBrushRing(); },
    ']': () => { app.brush.size = Math.min(0.5, app.brush.size * 1.18); ui.renderDock(); updateBrushRing(); },
  }[k];
  if (act) {
    if (e.target.matches('input[type="range"]') && k.startsWith('arrow')) return;
    e.preventDefault();
    act();
    return;
  }
  const n = parseInt(k, 10);
  if (app.explore.open && n >= 1 && n <= 8) return app.explorePick(n - 1);
  const tools = TOOLS.filter(t => !t.modes || t.modes.includes(app.mode));
  if (n >= 1 && n <= tools.length) app.setTool(tools[n - 1].id);
});

// ------------------------------------------------------------------ the frame loop
let scale = Math.min(window.devicePixelRatio || 1, 2);
const modeMaxScale = () => (app.mode === 'patterns' ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio || 1, 1));
function resize() {
  scale = Math.min(scale, modeMaxScale());
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
  // (very long frames mean the browser is throttling us, not that the GPU is struggling)
  if (avg > 1 / 38 && avg < 0.2 && scale > 0.55) {
    scale = Math.max(0.55, scale * 0.82);
    resize();
    perfGrace = 1.5;
    smoothSecs = 0;
  } else if (avg < 1 / 55 && scale < modeMaxScale()) {
    if (++smoothSecs >= 4) {
      scale = Math.min(modeMaxScale(), scale * 1.12);
      resize();
      perfGrace = 1.5;
      smoothSecs = 0;
    }
  } else smoothSecs = 0;
}

let last = performance.now();
const t0 = last;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  rt.realTime = (now - t0) / 1000;
  const s = app.state;
  const a = app.audio, cfg = app.audioCfg;
  a.update(dt, rt.realTime);
  renderer.setSound(a.wave, a.hist);
  updateInputs(dt);

  if (!app.paused) {
    const sdt = dt * s.speed;
    rt.time += sdt;
    rt.phase += sdt * s.flow;
    rt.phase2 += sdt * s.mixFlow;
    rt.spin += sdt * s.spin * 0.6;
    rt.cycle += sdt * s.cycle;
    for (const w of s.warps) w._ph = (w._ph || 0) + sdt * w.speed;
  }
  // loudness turns up the *intensity* of the warps; the tempo stays the song's own
  rt.intensity = a.mode === 'off' ? 1 : 1 + (a.level - 0.35) * cfg.intensity * 1.6;
  rt.pulse = Math.pow(a.bass, 1.6) * cfg.pulse * 0.35;
  rt.wobble = a.mid * cfg.wobble;
  rt.sWave = cfg.wave;
  rt.sSpec = cfg.spectrum;
  rt.face.mouth = Math.min(1, a.mid * 1.2);
  if (a.beat && cfg.ripples > 0 && app.mode === 'patterns') {
    const aspect = canvas.width / canvas.height;
    spawnRipple((Math.random() - 0.5) * aspect * 0.8, (Math.random() - 0.5) * 0.8, cfg.ripples * 1.5);
  }
  rt.fade = Math.max(0, rt.fade - dt * 1.6);

  const tx = s.follow ? rt.mouse[0] * 0.8 + rt.pan[0] : rt.pan[0];
  const ty = s.follow ? rt.mouse[1] * 0.8 + rt.pan[1] : rt.pan[1];
  const ease = 1 - Math.exp(-dt * (s.follow ? 4 : 30));
  rt.center[0] += (tx - rt.center[0]) * ease;
  rt.center[1] += (ty - rt.center[1]) * ease;

  const b = rt.brush;
  const active = pointer.down && BRUSH_MODES[app.tool];
  b.mode = active ? BRUSH_MODES[app.tool] : 0;
  b.vx = active ? pointer.x - b.x : 0;
  b.vy = active ? pointer.y - b.y : 0;
  b.x = pointer.x; b.y = pointer.y;
  b.size = app.brush.size;
  b.strength = app.brush.strength;
  b.relax = Math.pow(1 - (0.004 + app.brush.spring * 0.07), dt * 60);
  rt.rippleScale = app.brush.size / 0.16;

  if (app.mode === 'films' && film.active && film.tl) renderFilmFrame(dt);
  else if (app.mode === 'worlds') renderWorldFrame(dt);
  else renderer.render(applyMacrosPatterns(modulated(s, liveMusic(dt)), app.macros.patterns), rt);
  if (afterRender.length) { const fns = afterRender; afterRender = []; fns.forEach(f => f()); }
  ui.tick(dt);
  adapt(dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ thumbnails (rendered once, off-screen)
async function makeThumbs() {
  let tr;
  try { tr = new Renderer(document.createElement('canvas'), { preserve: true }); } catch { return; }
  const T = 2.5;
  const fakeRt = s => ({
    time: T, phase: T * s.flow, phase2: T * s.mixFlow, spin: 0, cycle: 0, realTime: 0, fade: 0, intensity: 1,
    face: { mouth: 0.2, eyes: 1 },
    center: [0, 0], mouse: [0, 0], ripples: new Float32Array(MAX_RIPPLES * 4), rippleScale: 1,
    pulse: 0, wobble: 0, audio: { bass: 0, mid: 0, high: 0, level: 0 },
    brush: { x: 0, y: 0, vx: 0, vy: 0, size: 0.1, strength: 0, mode: 0, relax: 0 },
  });
  const shot = (s, w, h) => {
    s.warps.forEach(x => { x._ph = T * x.speed; });
    s.echo = 0;
    tr.resize(w, h);
    tr.clearDisp = true;
    const c = compileFormula(s.formula, s.bendX, s.bendY);
    if (c.ok) tr.setFormula(c);
    tr.render(s, fakeRt(s));
    return tr.canvas.toDataURL('image/jpeg', 0.82);
  };
  const jobs = [
    ...PRESETS.map(p => ['presets', p.id, () => makeState({ ...p.state, grain: 0.04, vignette: 0.2 }), 240, 150]),
    ...PATTERNS.map(p => ['patterns', p.id, () => makeState({
      pattern: p.id, density: p.id === 'rays' ? 8 : 6, depth: 0, grain: 0, vignette: 0,
      formula: 'sin(x*d + 2*sin(y*6))',
    }), 96, 96]),
    ...WARPS.map(w => ['warps', w.id, () => {
      const a = w.params.amount;
      const amount = Math.min(a.max, a.def * (['wave', 'ripple', 'zigzag'].includes(w.id) ? 1.8 : 1));
      return makeState({ pattern: 'checker', density: 7, warps: [{ type: w.id, amount }], depth: 0.3, grain: 0, vignette: 0 });
    }, 96, 96]),
  ];
  for (const [i, [kind, id, make, w, h]] of jobs.entries()) {
    const url = shot(make(), w, h);
    app.thumbs[kind][id] = url;
    ui.setThumb(kind, id, url);
    if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
  }
  // the film-world looks, rendered with the film engine
  const P = new Float32Array(SHADER_COUNT);
  const still = { realTime: 0, ripples: new Float32Array(MAX_RIPPLES * 4) };
  tr.resize(240, 150);
  for (const id of Object.keys(LOOKS)) {
    const w = new World();
    w.goLook(id, 0.001);
    const { P: params, post } = w.frame(1, { bar: 0.3, barLen: 1.7, loud: 0.5, bass: 0.2, mid: 0.2, high: 0.2, hit: 0, time: 2 });
    P.set(params);
    tr.clearSlot(0);
    tr.renderFilm(P, still, 0);
    tr.composite({ a: 0, post: { ...post, grain: 0.04 } });
    app.thumbs.worlds[id] = tr.canvas.toDataURL('image/jpeg', 0.82);
    ui.setThumb('worlds', id, app.thumbs.worlds[id]);
    await new Promise(r => setTimeout(r, 0));
  }
  tr.destroy();
}

// ------------------------------------------------------------------ boot
let ui = null;
async function boot() {
  let shared = null;
  if (location.hash.startsWith('#s=')) {
    try { shared = await decodeShare(location.hash.slice(3)); } catch (e) { console.warn('bad share link', e); }
  }
  if (shared) {
    app.state = shared;
    app.base = makeState(cloneState(shared));
    app.presetName = 'Shared look';
  } else {
    const p = PRESETS[0];
    app.state = makeState(p.state);
    app.base = makeState(p.state);
    app.presetId = p.id;
    app.presetName = p.name;
  }
  refreshFormula();
  if (!app.compiled) { // a broken formula in a share link shouldn't leave a black screen
    app.state.formula = 'sin(x*d)';
    refreshFormula();
  }
  if (shared) app.mode = 'patterns';
  document.body.dataset.mode = app.mode;
  app.world.goLook('silk', 0.01);
  app.patternsName = app.presetName;
  if (app.mode === 'worlds') app.presetName = 'Silk';
  app.tool = app.mode === 'worlds' ? 'hand' : 'ripple';
  ui = createUI(app);
  app.songs.load();
  resize();
  requestAnimationFrame(frame);
  setTimeout(makeThumbs, 300);
}
boot();

window.trippy = Object.assign(app, { rt }); // handy for poking around in the console
