import { Renderer } from './renderer.js';
import { compileFormula, replaceNumber } from './formula.js';
import { PRESETS } from './presets.js';
import { PATTERN_BY_ID, PATTERNS, WARPS } from './catalog.js';
import { makeState, cloneState, mutateState, randomState, encodeShare, decodeShare } from './state.js';
import { AudioEngine } from './audio.js';
import { createUI, TOOLS } from './ui.js';
import { MAX_RIPPLES } from './shaders.js';
import { analyzeAudio, sample } from './analysis.js';
import { Timeline, applyMusic, toShader, toPost } from './film/timeline.js';
import { SHADER_COUNT } from './film/params.js';
import { PPP_FILM } from './film/ppp.js';
import { generateFilm } from './film/auto.js';
import { LOOKS, look } from './film/looks.js';
import { World } from './world.js';
import { RANGES } from './state.js';
import { WARP_BY_ID } from './catalog.js';

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
  audioCfg: { pulse: 0.45, ripples: 0.15, intensity: 0.6, wobble: 0.2 },
  paused: false,
  thumbs: { presets: {}, patterns: {}, warps: {}, worlds: {} },
  history: [],
  saves: loadSaves(),
  recording: null,
  recordStart: 0,
  mode: 'patterns',         // patterns | worlds | films
  world: new World(),
  tempo: { bpm: 70, beatsPerBar: 2, fromSong: false },
  songAnalysis: null,       // analysis of the song loaded in the Sound panel (gives the bar clock)
  mods: {},                 // Patterns: slider → music source, e.g. { density: { src: 'bass', amt: 0.4 } }
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
app.audio.onchange = () => { if (ui.tab === 'sound') ui.refresh(); };

app.loadSong = async file => {
  try {
    await app.audio.loadFile(file);
    ui.toast(`Playing “${app.audio.name}” — finding the beat…`);
    analyseLoadedSong(file);
  } catch (e) {
    console.warn(e);
    ui.toast('Could not play that file');
  }
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
  return { bar: clock.bar, barLen: barLen(), loud: on ? a.level : 0.5, bass: on ? a.bass : 0, mid: on ? a.mid : 0, high: on ? a.high : 0, hit: clock.hit, time: rt.realTime };
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
    case 'loud': return m.loud;
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

// ------------------------------------------------------------------ modes
app.setMode = mode => {
  if (app.mode === mode) return;
  if (app.mode === 'films') app.filmStop();
  app.mode = mode;
  document.body.dataset.mode = mode;
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

function renderFilmFrame(dt) {
  const t = filmTime(dt);
  const tl = film.tl, A = film.analysis;
  if (film.hitIdx < 0) film.hitIdx = film.hits.length;
  while (film.hitIdx < film.hits.length && film.hits[film.hitIdx] <= t) { film.hit = 1; film.hitIdx++; }
  film.hit *= Math.exp(-dt * 7);
  const v = tl.values(t);
  applyMusic(v, {
    bar: (t - tl.barZero) / tl.barLen, barLen: tl.barLen,
    loud: sample(A.rms, t), bass: sample(A.bass, t), mid: sample(A.mid, t), high: sample(A.high, t),
    hit: film.hit, time: t,
  });
  film.lastValues = v;
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

function renderWorldFrame(dt) {
  const w = app.world;
  const m = liveMusic(dt);
  const named = w.tickAuto(m.bar, m.barLen);
  if (named) { app.presetName = `Auto · ${named}`; ui.renderName(); }
  const h = w.hand;
  const want = app.tool === 'hand' && pointer.inside ? 1 : 0;
  h.on += (want - h.on) * (1 - Math.exp(-dt * 4));
  h.press += ((pointer.down && app.tool === 'hand' ? 1 : 0) - h.press) * (1 - Math.exp(-dt * 6));
  const cur = w.current || w.values();
  h.x += (cur.tx + pointer.x * 2 * cur.frame - h.x) * (1 - Math.exp(-dt * 10));
  h.y += (cur.ty + pointer.y * 2 * cur.frame - 0.12 - h.y) * (1 - Math.exp(-dt * 10));
  const { P, post } = w.frame(app.paused ? 0 : dt, m);
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
  const f = [...e.dataTransfer.files].find(x => x.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(x.name));
  if (!f) return ui.toast('That is not an audio file');
  if (app.mode === 'films') app.loadFilmFile(f);
  else app.loadSong(f);
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
    ' ': app.togglePause, h: app.toggleUI, f: app.toggleFullscreen, r: app.reset, m: app.mutate,
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
  const tools = TOOLS.filter(t => !t.modes || t.modes.includes(app.mode));
  if (n >= 1 && n <= tools.length) app.setTool(tools[n - 1].id);
});

// ------------------------------------------------------------------ the frame loop
let scale = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  renderer.resize(innerWidth * scale, innerHeight * scale);
}
addEventListener('resize', resize);

// drop resolution if the GPU can't keep up; creep back up once it's smooth again
const maxScale = Math.min(window.devicePixelRatio || 1, 2);
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
  } else if (avg < 1 / 55 && scale < maxScale) {
    if (++smoothSecs >= 4) {
      scale = Math.min(maxScale, scale * 1.12);
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
  else renderer.render(modulated(s, liveMusic(dt)), rt);
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
  document.body.dataset.mode = app.mode;
  ui = createUI(app);
  resize();
  requestAnimationFrame(frame);
  setTimeout(makeThumbs, 300);
}
boot();

window.trippy = Object.assign(app, { rt }); // handy for poking around in the console
