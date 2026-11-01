import { Renderer } from './renderer.js';
import { compileFormula, replaceNumber } from './formula.js';
import { PRESETS } from './presets.js';
import { PATTERN_BY_ID, PATTERNS, WARPS } from './catalog.js';
import { makeState, cloneState, mutateState, randomState, encodeShare, decodeShare } from './state.js';
import { AudioEngine } from './audio.js';
import { createUI, TOOLS } from './ui.js';
import { MAX_RIPPLES } from './shaders.js';

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
  audioCfg: { pulse: 0.5, ripples: 0.5, boost: 0.3, wobble: 0.25 },
  paused: false,
  thumbs: { presets: {}, patterns: {}, warps: {} },
  history: [],
  saves: loadSaves(),
  recording: null,
  recordStart: 0,
};

// Everything that moves every frame.
const rt = {
  time: 0, phase: 0, spin: 0, cycle: 0, realTime: 0, fade: 0,
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
    ui.toast(`Playing “${app.audio.name}”`);
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
  if (f) { app.loadSong(f); ui.setTab('sound'); } else ui.toast('That is not an audio file');
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
  const show = app.tool !== 'move' && !matchMedia('(pointer: coarse)').matches;
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
  app.state.zoom = Math.min(4, Math.max(0.2, app.state.zoom * Math.exp(-e.deltaY * 0.0015)));
  app.touch();
}, { passive: false });

// the faint corner button that brings the UI back when it's hidden (for touch screens)
document.getElementById('unhide').addEventListener('click', () => app.toggleUI());

// ------------------------------------------------------------------ keyboard
addEventListener('keydown', e => {
  if (e.target.closest('textarea, input[type="text"], input[type="color"], select')) return;
  if (e.metaKey || e.ctrlKey) {
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); app.undo(); }
    return;
  }
  const k = e.key.toLowerCase();
  const presetStep = d => {
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
  if (n >= 1 && n <= TOOLS.length) app.setTool(TOOLS[n - 1].id);
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
    const sdt = dt * s.speed * (1 + a.level * cfg.boost * 2);
    rt.time += sdt;
    rt.phase += sdt * s.flow;
    rt.spin += sdt * s.spin * 0.6;
    rt.cycle += sdt * s.cycle;
    for (const w of s.warps) w._ph = (w._ph || 0) + sdt * w.speed;
  }
  rt.pulse = Math.pow(a.bass, 1.6) * cfg.pulse * 0.35;
  rt.wobble = a.mid * cfg.wobble;
  if (a.beat && cfg.ripples > 0) {
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

  renderer.render(s, rt);
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
    time: T, phase: T * s.flow, spin: 0, cycle: 0, realTime: 0, fade: 0,
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
  ui = createUI(app);
  resize();
  requestAnimationFrame(frame);
  setTimeout(makeThumbs, 300);
}
boot();

window.trippy = Object.assign(app, { rt }); // handy for poking around in the console
