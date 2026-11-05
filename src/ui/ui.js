// The interface: as little as possible on top of the picture. A wordmark; a bar at the bottom with the four
// things you do (Patterns, Figures, Sound, Tweak), the tools and the transport; one panel at a time. It all
// fades away when you stop moving the mouse.
import { h, slider, toggle, chips, iconBtn, section, fold, knob, fmt2, BLANK } from './kit.js';
import { icon } from '../icons.js';
import { LOOKS, GROUPS, PALETTES, look } from '../engine/looks.js';
import { PARAMS, PARAM_BY_NAME } from '../engine/params.js';
import { KNOBS, feelMoved } from '../engine/feel.js';
import { ADDS } from '../adds.js';
import { FORMS, SHIFT_GROUPS, SHIFT_CONTROLS } from '../engine/forms.js';
import { FONTS } from '../media.js';

export const TOOLS = [
  { id: 'ripple', icon: 'ripple', name: 'Ripple', tip: 'Ripple: click or drag' },
  { id: 'twist', icon: 'twist', name: 'Twist', tip: 'Twist: hold and it keeps winding (Alt: the other way)' },
  { id: 'bulge', icon: 'bulge', name: 'Bulge', tip: 'Bulge: hold to puff it up' },
  { id: 'pinch', icon: 'pinch', name: 'Pinch', tip: 'Pinch: hold to suck it in' },
  { id: 'smear', icon: 'smear', name: 'Smear', tip: 'Smear: drag like wet paint' },
  { id: 'figure', icon: 'hand', name: 'Figure', tip: 'Your cursor has the figure: hold and it reacts, scroll to size it' },
  { id: 'shift', icon: 'shift', name: 'Shift', tip: 'Shift the figure: drag sideways and up and down. Click again to choose what each does' },
  { id: 'turn', icon: 'turn', name: 'Turn', tip: 'Turn the figure: drag sideways to spin it, up and down to lean it' },
  { id: 'camera', icon: 'orbit', name: 'Camera', tip: 'Camera: drag to turn and tilt, scroll to zoom (right-drag works with any tool)' },
];

const LABELS = {
  freq: 'Line count', thick: 'Line weight', frot: 'Turn', spinRate: 'Spin', flow: 'Flow', linA: 'Line angle',
  frame: 'Zoom out', pitch: 'Tilt back', focal: 'Lens: wide ↔ flat', tx: 'Off-centre',
  objS: 'Size', objTilt: 'Tilt', objSoft: 'Fabric over it', blobLump: 'Sphere ↔ lumpy', reveal: 'Turn it to see the trick',
  hallW: 'Width', hallWave: 'Walls ripple', hallOpen: 'Box ↔ open to the dark', hallRound: 'Square ↔ round',
  checkA: 'Tile angle', tri: 'Squares → triangles', check: 'Checkers', cfog: 'Dark center', spokes: 'Spokes',
  flyRate: 'Fly speed', orbitRate: 'Orbit', objSpin: 'Spin it', hueRate: 'Color cycle',
};
const flipped = new Set(['thick']);               // shown so that right = more ink
const labelOf = key => LABELS[key] || PARAM_BY_NAME[key]?.label || key;
const SKINS = [['pattern', 'The pattern'], ['stripes', 'Stripes'], ['dark', 'Dark stripes'], ['neg', 'Negative'], ['black', 'Black'], ['white', 'White']];
const SKIN_OFF = { contour: 0, stripeInk: 0, neg: 0, fill: 0 };
const SKIN_SET = {
  pattern: SKIN_OFF, stripes: { ...SKIN_OFF, contour: 1 }, dark: { ...SKIN_OFF, contour: 1, stripeInk: 0.8 },
  neg: { ...SKIN_OFF, neg: 1 }, black: { ...SKIN_OFF, fill: 1 }, white: { ...SKIN_OFF, fill: -1 },
};
const skinNow = S => (S.fill > 0.5 ? 'black' : S.fill < -0.5 ? 'white' : S.neg > 0.5 ? 'neg' : S.contour > 0.5 ? (S.stripeInk > 0.65 ? 'dark' : 'stripes') : 'pattern');
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function createUI(app) {
  const body = document.getElementById('panelBody');
  const panel = document.getElementById('panel');
  const panelHead = document.getElementById('panelHead');
  const corner = document.getElementById('corner');
  const dock = document.getElementById('dock');
  const transport = document.getElementById('transport');
  const toastEl = document.getElementById('toast');
  const nameEl = document.getElementById('lookName');
  const hintEl = document.getElementById('hint');
  let tab = null;
  let toastTimer = 0, nameTimer = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- the chrome fades when you stop moving
  let idleT = 0;
  const wake = () => { idleT = 0; document.body.classList.remove('idle'); };
  addEventListener('pointermove', wake, { passive: true });
  addEventListener('pointerdown', wake, { passive: true });
  addEventListener('keydown', wake);

  // the name of what's on screen: it shows for a moment when it changes, even with everything else away
  function renderName() {
    const L = LOOKS[app.lookId]?.name || '', F = app.adds.figures;
    const fig = F.on ? FORMS.find(f => f.id === F.pick)?.name : '';
    const text = fig ? `${L} · ${fig}` : L;
    if (text !== nameEl.textContent) {
      nameEl.textContent = text;
      nameEl.classList.add('flash');
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => nameEl.classList.remove('flash'), 2800);
    }
  }

  // ---------------------------------------------------------------- ∿: tie any value to the music
  const SOURCES = app.SOURCES;
  function tieButton(row, key) {
    const btn = h('button', { class: 'mod-btn', 'aria-label': 'Follow the music', 'data-tip': 'Follow the music', html: '∿' });
    row.top.insertBefore(btn, row.top.lastChild);
    let open = false, pn = null;
    const paint = () => {
      const t = app.ties[key];
      row.classList.toggle('tied', !!t);
      btn.textContent = t ? `∿ ${SOURCES[t.src]}` : '∿';
    };
    const build = () => {
      const t = app.ties[key];
      pn = h('div', { class: 'modrow' },
        chips([['', 'Off'], ...Object.entries(SOURCES)], id => (id ? t?.src === id : !t), id => { app.setTie(key, id || null); rebuild(); }, 'small'),
        t ? slider('How much (− flips it)', { min: -1, max: 1, get: () => app.ties[key]?.amt ?? 0.4, set: v => { if (app.ties[key]) app.ties[key].amt = v; } }) : null);
      row.append(pn);
    };
    const rebuild = () => { pn?.remove(); pn = null; if (open) build(); paint(); };
    btn.addEventListener('click', e => { e.stopPropagation(); open = !open; rebuild(); });
    paint();
    return row;
  }

  function lookSlider(key, opts = {}) {
    const p = PARAM_BY_NAME[key];
    if (!p) return null;
    if (typeof p.def === 'string') return colorPick(key);
    const f = flipped.has(key) ? -1 : 1;
    const lo = opts.min ?? (f < 0 ? -p.max : p.min), hi = opts.max ?? (f < 0 ? -p.min : p.max);
    const base = () => look(app.lookId)[key] ?? p.def;
    const row = slider(opts.label || labelOf(key), {
      min: lo, max: hi, step: hi - lo > 20 ? 0.1 : 0.01,
      get: () => f * app.lookValue(key),
      set: v => app.tweak(key, f * v),
      reset: () => { delete app.tweaks[app.lookId]?.[key]; app.world.morphTo({ [key]: base() }, 0.4); lookEdited(); },
      edited: () => key in (app.tweaks[app.lookId] || {}),
      fmt: p.kind === 'rate' ? v => `${v > 0 ? '+' : ''}${v.toFixed(2)}` : fmt2,
    });
    return p.kind === 'post' ? row : tieButton(row, key);
  }

  function colorPick(key) {
    const inp = h('input', { type: 'color', value: app.lookValue(key), 'aria-label': labelOf(key) });
    inp.addEventListener('input', () => app.tweak(key, inp.value));
    return h('label', { class: 'color' }, inp, h('span', {}, labelOf(key)));
  }

  // ---------------------------------------------------------------- the corner: surprise, and everything else behind one button
  const moreMenu = h('div', { class: 'more-menu glass', hidden: true });
  document.body.append(moreMenu);
  function renderCorner() {
    corner.replaceChildren(
      h('button', { class: 'round glass', 'data-tip': 'Surprise me (D)', 'aria-label': 'Surprise me', html: icon('dice'), onclick: () => app.surprise() }),
      h('button', { class: `round glass more-btn${app.recording ? ' live' : ''}`, 'data-tip': 'More', 'aria-label': 'More', html: icon(app.recording ? 'record' : 'dots'), onclick: toggleMore }));
  }
  function toggleMore(e) {
    if (!moreMenu.hidden) { moreMenu.hidden = true; return; }
    const row = (ic, label, run, key) => h('button', { class: 'menu-row', onclick: () => { moreMenu.hidden = true; run(); }, html: `${icon(ic)}<span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}` });
    moreMenu.replaceChildren(
      row('grid', 'Breed this look', () => app.exploreOpen(), 'E'),
      row(app.paused ? 'play' : 'pause', app.paused ? 'Play' : 'Pause', () => app.togglePause(), 'Space'),
      row('camera', 'Save a picture', () => app.snapshot(), 'S'),
      row('record', app.recording ? 'Stop recording' : 'Record a clip', () => app.toggleRecord()),
      row('link', 'Copy a link to this look', () => app.share()),
      row('expand', 'Fullscreen', () => app.toggleFullscreen(), 'F'),
      row('eye', 'Hide everything', () => app.toggleUI(), 'H'),
      h('div', { class: 'menu-gap' }),
      toggle('Ring around the cursor', () => app.perf.ring, v => app.setRing(v), 'shows a brush tool’s size'),
      toggle('Wander when left alone', () => app.perf.wander, v => app.setPref('wander', v), 'it drifts on to other looks'),
      toggle('60 frames a second', () => app.perf.cap60, v => app.setCap60(v), 'easier on the computer'));
    const r = e.currentTarget.getBoundingClientRect();
    moreMenu.style.top = `${r.bottom + 8}px`;
    moreMenu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    moreMenu.hidden = false;
  }
  addEventListener('pointerdown', e => {
    if (!moreMenu.hidden && !moreMenu.contains(e.target) && !e.target.closest?.('.more-btn')) moreMenu.hidden = true;
    if (toolPop.parentNode && !toolPop.contains(e.target) && !e.target.closest?.('.tool')) toolPop.remove();
  });

  // ---------------------------------------------------------------- the dock
  const TABS = [
    { id: 'patterns', name: 'Patterns', icon: 'grid' },
    { id: 'figures', name: 'Figures', icon: 'hand' },
    { id: 'sound', name: 'Sound', icon: 'music' },
    { id: 'tweak', name: 'Tweak', icon: 'sliders' },
  ];
  const toolPop = h('div', { class: 'tool-pop glass' });
  function toggleToolPop(anchor) {
    if (toolPop.parentNode) { toolPop.remove(); return; }
    const b = app.brush;
    const mini = (label, key, min, max) => slider(label, { min, max, get: () => b[key], set: v => { b[key] = v; app.updateRing(); } });
    if (app.tool === 'shift') {
      const options = Object.values(SHIFT_CONTROLS).map(c => h('option', { value: c[0] }, c[1]));
      const pickAxis = (label, i) => {
        const sel = h('select', { onchange: e => { app.shiftAxes[i] = e.target.value; } }, options.map(o => o.cloneNode(true)));
        sel.value = app.shiftAxes[i];
        return h('label', { class: 'axis-pick' }, h('span', {}, label), sel);
      };
      toolPop.replaceChildren(pickAxis('Sideways', 0), pickAxis('Up and down', 1));
    } else toolPop.replaceChildren(
      mini('Size', 'size', 0.04, 0.5), mini('Strength', 'strength', 0.05, 1.5),
      ['twist', 'bulge', 'pinch', 'smear'].includes(app.tool) ? mini('Springs back', 'spring', 0, 1) : null,
      toggle('Ring around the cursor', () => app.perf.ring, v => app.setRing(v)),
      h('button', { class: 'link-btn', onclick: () => { app.resetView(); toolPop.remove(); } }, 'Put everything back'));
    toolPop.querySelectorAll('.slider').forEach(s => s.sync?.());
    document.body.append(toolPop);
    const r = anchor.getBoundingClientRect();
    toolPop.style.left = `${Math.max(8, Math.min(innerWidth - 228, r.left + r.width / 2 - 110))}px`;
    toolPop.style.bottom = `${innerHeight - r.top + 10}px`;
  }
  function renderDock() {
    dock.replaceChildren(
      h('div', { class: 'tabs' }, TABS.map(t => h('button', {
        class: `tab${tab === t.id ? ' on' : ''}`, onclick: () => openTab(t.id), html: `${icon(t.icon)}<span>${t.name}</span>`,
      }))),
      h('span', { class: 'sep' }),
      h('div', { class: 'tools' }, TOOLS.map((t, i) => h('button', {
        class: `tool${app.tool === t.id ? ' on' : ''}`, 'data-tip': `${t.tip} (${i + 1})`, 'aria-label': t.name,
        onclick: e => { if (app.tool === t.id && t.id !== 'figure' && t.id !== 'camera' && t.id !== 'turn') toggleToolPop(e.currentTarget); else { toolPop.remove(); app.setTool(t.id); } }, html: icon(t.icon),
      }))),
      h('span', { class: 'sep' }),
      h('button', {
        class: `tool cine${app.cine.on ? ' on' : ''}`, 'data-tip': 'Cinematic camera: it flies from shot to shot by itself (C)', 'aria-label': 'Cinematic camera',
        onclick: () => app.setCinema(!app.cine.on), html: icon('film'),
      }));
  }

  // ---------------------------------------------------------------- the transport, and the song's map
  let map = null, mapFor = null, mapCanvas = null, mapCtx = null;
  function renderTransport() {
    const a = app.audio;
    transport.hidden = a.mode === 'off';
    if (transport.hidden) { mapCanvas = null; return; }
    if (a.mode === 'mic') {
      transport.replaceChildren(
        h('span', { class: 'live-dot' }), h('span', { class: 'tr-name' }, a.name || 'Live'),
        iconBtn('stop', 'Stop', () => app.stopAudio()));
      mapCanvas = null;
      return;
    }
    mapCanvas = h('canvas', { class: 'tr-map', title: 'Click to go there' });
    mapCanvas.addEventListener('pointerdown', e => {
      const r = mapCanvas.getBoundingClientRect();
      app.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    });
    mapCtx = null;
    transport.replaceChildren(...[
      iconBtn(a.playing ? 'pause' : 'play', 'Play / pause', () => { a.togglePlay(); setTimeout(renderTransport, 60); }),
      h('span', { class: 'tr-name', title: a.name }, a.name),
      mapCanvas,
      h('span', { class: 'tr-time' }, '0:00'),
      app.songs.list.length > 1 ? iconBtn('next', 'Next song', () => app.nextSong()) : null,
      iconBtn('stop', 'Stop', () => app.stopAudio()),
    ].filter(Boolean));
  }
  // the whole song at a glance: how loud it is, and the tune's line running through it
  function buildMap(W, H) {
    const an = app.music.an;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    if (!an) return c;
    const n = an.frames;
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = 0; x < W; x += 2) {
      const i = Math.floor(x / W * n), j = Math.floor((x + 2) / W * n);
      let s = 0; for (let f = i; f < j; f++) s += an.loud[f];
      const v = s / Math.max(j - i, 1), hh = Math.max(1, v * H * 0.8);
      g.fillRect(x, (H - hh) / 2, 1, hh);
    }
    const [lo, , hi] = an.range, span = Math.max(hi - lo, 4);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(1, W / 500);
    g.beginPath();
    let pen = false;
    for (let x = 0; x < W; x++) {
      const f = Math.floor(x / W * n);
      if (an.voiced[f] > 0.5) {
        const y = H * 0.84 - Math.max(0, Math.min(1, (an.pitch[f] - lo) / span)) * H * 0.68;
        if (pen) g.lineTo(x, y); else g.moveTo(x, y);
        pen = true;
      } else pen = false;
    }
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.75)';
    for (const S of an.sections) g.fillRect(S.start / an.duration * W, 0, Math.max(1, W / 500), H);
    return c;
  }
  function paintMap() {
    if (!mapCanvas || !mapCanvas.isConnected) return;
    const dpr = Math.min(2, devicePixelRatio || 1), r = mapCanvas.getBoundingClientRect();
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (!W || !H) return;
    if (mapCanvas.width !== W || mapCanvas.height !== H) { mapCanvas.width = W; mapCanvas.height = H; mapCtx = null; }
    mapCtx ||= mapCanvas.getContext('2d');
    if (mapFor !== app.music.an || !map || map.width !== W || map.height !== H) { map = buildMap(W, H); mapFor = app.music.an; }
    const a = app.audio, d = a.el?.duration || 1, t = a.el?.currentTime || 0, x = (t / d) * W;
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.globalAlpha = 0.45;
    mapCtx.drawImage(map, 0, 0);
    mapCtx.globalAlpha = 1;
    mapCtx.drawImage(map, 0, 0, x, H, 0, 0, x, H);
    if (app.film.listening > 0) {
      mapCtx.fillStyle = 'rgba(255,255,255,0.14)';
      mapCtx.fillRect(0, H - 2 * dpr, W * app.film.listening, 2 * dpr);
    }
    mapCtx.fillStyle = '#fff';
    mapCtx.fillRect(x - dpr * 0.5, 0, dpr, H);
    const te = transport.querySelector('.tr-time');
    if (te) te.textContent = fmtTime(t);
  }

  // ---------------------------------------------------------------- panels
  function openTab(id, force) {
    const closing = tab === id && !force;
    tab = closing ? null : id;
    panel.hidden = closing;
    document.body.classList.toggle('panel-closed', closing);
    renderDock();
    if (!closing) { renderBody(); body.scrollTop = 0; }
  }
  function renderBody() {
    if (!tab) return;
    const keep = body.scrollTop;
    const meta = TABS.find(t => t.id === tab);
    panelHead.replaceChildren(h('b', {}, meta.name), iconBtn('x', 'Close', () => openTab(tab)));
    const v = { patterns: renderPatterns, figures: renderFigures, sound: renderSound, tweak: renderTweak }[tab]();
    body.replaceChildren(...[v].flat(4).filter(Boolean));
    body.scrollTop = keep;
  }

  // ---------------------------------------------------------------- Patterns
  const thumbQueue = [];
  function thumb(id) {
    const img = h('img', { class: 'thumb', src: app.thumbs[id] || BLANK, alt: '' });
    if (!app.thumbs[id]) { thumbQueue.push([id, img]); pumpThumbs(); }
    return img;
  }
  let pumping = false;
  function pumpThumbs() {
    if (pumping) return;
    pumping = true;
    const next = () => {
      const job = thumbQueue.shift();
      if (!job) { pumping = false; return; }
      if (job[1].isConnected) job[1].src = app.thumb(job[0]);
      else if (tab === 'patterns') app.thumb(job[0]);
      setTimeout(next, 24);
    };
    setTimeout(next, 24);
  }

  let patternGroup = 'all';
  function renderPatterns() {
    const card = id => h('button', { class: `card${app.lookId === id ? ' on' : ''}`, 'data-look': id, title: LOOKS[id].blurb, onclick: () => app.pickLook(id) },
      thumb(id), h('span', {}, LOOKS[id].name, app.isEdited(id) ? h('i', { class: 'dot', title: 'You tweaked this one' }) : null));
    const saves = app.saves.length && patternGroup === 'all' ? h('div', { class: 'group' },
      h('div', { class: 'group-head' }, h('b', {}, 'Saved')),
      h('div', { class: 'cards' }, app.saves.map(sv => h('div', { class: 'card save' },
        h('button', { class: 'card-hit', onclick: () => app.openSave(sv.id) }, h('img', { class: 'thumb', src: sv.thumb || BLANK, alt: '' }), h('span', {}, sv.name)),
        h('button', { class: 'card-x', 'aria-label': `Delete ${sv.name}`, html: icon('x'), onclick: () => app.deleteSave(sv.id) }))))) : null;
    return [
      chips([['all', 'All'], ...GROUPS.map(([id, name]) => [id, name])], id => patternGroup === id, id => { patternGroup = id; renderBody(); body.scrollTop = 0; }, 'tabs-chips'),
      saves,
      GROUPS.filter(([g]) => patternGroup === 'all' || patternGroup === g).map(([g, name, blurb]) => h('div', { class: 'group' },
        h('div', { class: 'group-head' }, h('b', {}, name), h('small', {}, blurb)),
        h('div', { class: 'cards' }, Object.keys(LOOKS).filter(id => LOOKS[id].group === g).map(card)))),
    ];
  }

  // ---------------------------------------------------------------- Figures
  function figCard(f) {
    const A = app.adds.figures, on = A.on && A.pick === f.id;
    return h('button', {
      class: `fig-card${on ? ' on' : ''}`, title: f.blurb, onclick: () => { if (on) app.setAdd('figures', false); else app.pickFigure(f.id); },
    }, h('img', { src: `assets/figures/${f.id}.png`, alt: '', onerror: e => { e.target.style.visibility = 'hidden'; } }), h('span', {}, f.name));
  }
  const addSlider = (id, key, label, min, max, opts = {}) =>
    slider(label, { min, max, step: opts.step || 0.01, fmt: opts.fmt, get: () => app.adds[id][key], set: x => app.setAddOption(id, key, x) });
  const showSlider = (key, label, min, max, opts = {}) => slider(label, { min, max, step: 0.01, hint: opts.hint, fmt: opts.fmt, get: () => app.show[key], set: x => { app.show[key] = x; } });

  function showBlock(cam) {
    const S = app.show;
    return [
      showSlider('photo', 'Photo: the picture itself', 0, 1),
      S.photo > 0 ? toggle('True color', () => S.photoColor > 0.5, x => { S.photoColor = x ? 1 : 0; }) : null,
      showSlider('relief', 'Relief: pushes the lines up', 0, 3),
      showSlider('engrave', 'Engraved: drawn in line thickness', 0, 2),
      cam ? showSlider('detail', 'Detail', 0, 1, { fmt: x => `${Math.round(480 + x * 800)} px`, hint: 'How sharp the camera picture is' }) : null,
      toggle(cam ? 'Keep me still: the warps stay outside' : 'Keep it still: the warps stay outside', () => S.calm > 0.5, x => { S.calm = x ? 1 : 0; }),
      showSlider('aura', 'Aura: the lines ripple off it with the sound', 0, 3),
      fold(cam ? 'cam-place' : 'pic-place', 'Place it', null,
        showSlider('size', 'Size', 0.2, 3), showSlider('x', 'Move ↔', -1.5, 1.5), showSlider('y', 'Move ↕', -1.5, 1.5),
        showSlider('soft', 'Smooth the relief', 0, 6), showSlider('warp', 'Bend it with the look', 0, 1),
        toggle('Invert', () => S.invert > 0.5, x => { S.invert = x ? 1 : 0; })),
    ];
  }
  const SUBJECTS = [['body', 'My body'], ['bodyhands', 'Body + what I hold'], ['hands', 'Hands'], ['face', 'My face'], ['scene', 'Whole picture'], ['box', 'A frame'], ['motion', 'Movement']];
  function cameraBody() {
    const tr = app.tracker, c = app.cam;
    const label = { loading: 'loading…', on: 'on', error: 'didn’t load', off: '' };
    const status = ['face', 'hands', 'body'].filter(k => tr.want[k] && tr.status[k] !== 'off').map(k => `${{ face: 'Face', hands: 'Hands', body: 'Body outline' }[k]}: ${label[tr.status[k]]}`).join(' · ');
    const b = c.box;
    return [
      h('p', { class: 'muted small' }, 'Worked out in this browser: no picture leaves your computer.'),
      h('div', { class: 'setups' }, app.SETUPS.map(S => h('button', { class: `setup${c.setup === S.id && app.adds.camera.on ? ' on' : ''}`, onclick: () => app.quickSetup(S.id) }, h('b', {}, S.name), h('small', {}, S.blurb)))),
      app.adds.camera.on ? [
        h('div', { class: 'sub-label' }, 'What counts as you'),
        chips(SUBJECTS, id => c.subject === id, id => app.setCam('subject', id), 'small'),
        c.subject === 'box' ? [
          slider('Frame ↔', { min: 0, max: 1, get: () => b.x, set: x => { b.x = x; } }), slider('Frame ↕', { min: 0, max: 1, get: () => b.y, set: x => { b.y = x; } }),
          slider('Frame width', { min: 0.1, max: 1, get: () => b.w, set: x => { b.w = x; } }), slider('Frame height', { min: 0.1, max: 1, get: () => b.h, set: x => { b.h = x; } }),
        ] : null,
        ['body', 'face', 'hands', 'bodyhands', 'box'].includes(c.subject) ? slider('Edge softness', { min: 0, max: 24, step: 0.5, fmt: x => `${x} px`, get: () => c.feather, set: x => { c.feather = x; } }) : null,
        showBlock(true),
        toggle('Look around: move your head and the view shifts', () => c.look, x => app.setCam('look', x)),
        toggle('Movement makes ripples', () => c.motion, x => app.setCam('motion', x)),
        status ? h('p', { class: 'muted small' }, status) : null,
      ] : null,
    ];
  }
  function pictureBody() {
    const md = app.media;
    const file = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true });
    file.addEventListener('change', () => { if (file.files[0]) app.loadPicture(file.files[0]); });
    const words = h('textarea', { class: 'words', rows: 2, placeholder: 'Or type words…', spellcheck: 'false' });
    words.value = md.kind === 'text' ? md.text.value : '';
    let timer = 0;
    words.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => app.setWords(words.value, md.text.font), 160); });
    const has = ['image', 'video', 'text'].includes(md.kind);
    return [
      h('div', { class: 'run-actions' },
        h('button', { class: 'btn', html: `${icon('image')}<span>${has && md.kind !== 'text' ? 'Another' : 'Image or video'}</span>`, onclick: () => file.click() }),
        has ? h('button', { class: 'btn', html: `${icon('x')}<span>Remove</span>`, onclick: () => app.clearPicture() }) : null),
      file, words,
      chips(Object.keys(FONTS).map(f => [f, f]), f => md.text.font === f, f => { md.text.font = f; if (words.value.trim()) app.setWords(words.value, f); renderBody(); }, 'small'),
      has ? showBlock(false) : h('p', { class: 'muted small' }, 'Or drop a picture or video anywhere on the page.'),
    ];
  }
  function renderFigures() {
    const A = app.adds;
    const F = A.figures;
    const others = {
      hands: () => [
        addSlider('hands', 'size', 'Size', 0.4, 2.5), addSlider('hands', 'push', 'Push through', 0, 1), addSlider('hands', 'open', 'Fist ↔ open', 0, 1), addSlider('hands', 'apart', 'How far apart', 0.15, 1),
        toggle('Copy my hands (camera), finger by finger', () => A.hands.copy, x => { app.setAddOption('hands', 'copy', x); renderBody(); }),
      ],
      face: () => [
        addSlider('face', 'size', 'Size', 0.4, 2.5), addSlider('face', 'depth', 'How deep it presses', 0.2, 1.5),
        toggle('Copy my face (camera)', () => A.face.copy, x => { app.setAddOption('face', 'copy', x); renderBody(); }),
      ],
      ball: () => [
        addSlider('ball', 'size', 'Size', 0.04, 0.4), addSlider('ball', 'speed', 'Speed', 0, 1.5), addSlider('ball', 'flow', 'How much the lines part', 0, 2), addSlider('ball', 'wake', 'Wake behind it', 0, 2),
        toggle('Follow my mouse', () => A.ball.follow, x => app.setAddOption('ball', 'follow', x)),
      ],
      orbs: () => [addSlider('orbs', 'amount', 'How far they rise', 0.2, 1.5), addSlider('orbs', 'grid', 'Grid', 2, 12, { step: 1, fmt: x => `${x}×${x}` })],
      camera: cameraBody,
      picture: pictureBody,
    };
    const addHead = a => h('div', { class: `add-head${A[a.id].on ? ' on' : ''}` },
      h('span', { class: 'add-icon', html: icon(a.icon) }), h('div', { class: 'add-title' }, h('b', {}, a.name), h('small', {}, a.blurb)),
      toggle('', () => A[a.id].on, on => app.setAdd(a.id, on)));
    return [
      F.on ? [
        h('div', { class: 'run-actions' },
          h('button', { class: 'btn', html: `${icon('dice')}<span>Shift it for me</span>`, 'data-tip': 'X', onclick: () => app.surpriseForm() }),
          h('button', { class: 'btn', html: `${icon('reset')}<span>Put it back</span>`, 'data-tip': 'Z', onclick: () => app.resetForm() })),
        chips(SKINS, id => skinNow(F.shift) === id, id => { Object.assign(F.shift, SKIN_SET[id]); renderBody(); }, 'small'),
      ] : h('p', { class: 'lead' }, 'Pick one and it comes up through the sheet under your cursor. Hold the mouse and it reacts. Pick another and the first melts into it.'),
      h('div', { class: 'fig-grid' }, FORMS.map(figCard)),
      F.on ? [
        addSlider('figures', 'size', 'Size', 0.3, 3),
        addSlider('figures', 'drift', 'Keeps changing by itself', 0, 1.5),
        addSlider('figures', 'music', 'The song moves it', 0, 1.5),
        toggle('It follows my mouse', () => F.follow, x => { app.setAddOption('figures', 'follow', x); if (x) app.setTool('figure'); }),
        SHIFT_GROUPS.map(([title, controls], i) => fold(`shift-${i}`, title, null,
          controls.map(([key, label, min, max, step]) => slider(label, { min, max, step, get: () => F.shift[key], set: x => { F.shift[key] = x; } })))),
      ] : null,
      fold('more-things', 'Other things to add', null,
        ADDS.filter(a => a.id !== 'figures').map(a => h('div', { class: `add-card${A[a.id].on ? ' on' : ''}` }, addHead(a),
          A[a.id].on ? h('div', { class: 'add-body' }, others[a.id]()) : (a.id === 'camera' || a.id === 'picture') ? h('div', { class: 'add-body' }, others[a.id]()) : null))),
    ];
  }

  // ---------------------------------------------------------------- Sound
  function songsBlock() {
    const a = app.audio, cur = app.currentSongId();
    const file = h('input', { type: 'file', accept: 'audio/*', multiple: true, hidden: true });
    file.addEventListener('change', () => { if (file.files.length) app.addSongs([...file.files]); });
    const list = app.songs.list;
    return [
      list.length ? h('div', { class: 'song-list' }, list.map(sg => h('div', { class: `song${sg.id === cur ? ' on' : ''}` },
        h('button', { class: 'song-name', onclick: () => (sg.id === cur ? (a.togglePlay(), setTimeout(() => { renderBody(); renderTransport(); }, 60)) : app.playSongId(sg.id)) },
          h('span', { html: icon(sg.id === cur && a.playing ? 'pause' : 'play') }), h('span', {}, sg.name)),
        h('button', { class: 'song-x', 'aria-label': `Forget ${sg.name}`, html: icon('x'), onclick: () => app.songs.remove(sg.id) }))))
        : h('p', { class: 'lead' }, 'Drop a song anywhere, or add some here. It listens to the whole thing (the tune, the slides, the beat, the sections) and directs it. Nothing is uploaded.'),
      h('div', { class: 'run-actions' },
        h('button', { class: `btn grow${list.length ? '' : ' primary'}`, html: `${icon('music')}<span>Add songs</span>`, onclick: () => file.click() })),
      file,
    ];
  }
  function statusLine() {
    const F = app.film, an = app.music.an;
    if (F.listening > 0) return h('p', { class: 'status', id: 'listenStatus' }, `Listening… ${Math.round(F.listening * 100)}%`);
    if (!an || app.audio.mode !== 'file') return null;
    return h('p', { class: 'status' }, `${Math.round(an.bpm)} bpm · ${KEYS[an.key]} ${an.minor ? 'minor' : 'major'} · ${an.sections.length} sections${F.score ? ` · ${F.score.scenes.length} scenes` : ''}`);
  }
  function liveFold() {
    const a = app.audio, I = a.input, D = app.devices, live = a.mode === 'mic';
    const pick = (list, value, onchange) => {
      const el = h('select', { class: 'select' }, list.map(d => h('option', { value: d.id, selected: d.id === value ? true : null }, d.label)));
      el.addEventListener('change', () => onchange(el.value));
      return el;
    };
    const outputs = [{ id: '', label: 'System default' }, ...D.outputs.filter(o => o.id && o.id !== 'default')];
    return fold('play-live', 'Play live', live ? `● ${a.name}` : 'a guitar, a mic',
      h('p', { class: 'muted small' }, 'A guitar through an interface, or any mic. It tracks the note you’re playing as you play it.'),
      D.inputs.length ? h('label', { class: 'field' }, h('span', {}, 'Input'), pick(D.inputs, I.deviceId, id => app.useInput(id))) : null,
      h('div', { class: 'run-actions' },
        live
          ? h('button', { class: 'btn', html: `${icon('stop')}<span>Stop listening</span>`, onclick: () => app.stopAudio() })
          : h('button', { class: 'btn primary', html: `${icon('mic')}<span>Start listening</span>`, onclick: () => app.useInput() })),
      toggle('Hear it through the speakers', () => I.monitor, on => app.setMonitor(on), 'with a mic, use headphones or it’ll howl'),
      I.monitor ? slider('Volume', { min: 0, max: 1.5, get: () => I.volume, set: x => a.setMonitor(true, x) }) : null,
      slider('Input level', { min: 0.2, max: 4, get: () => I.level, set: x => a.setInputLevel(x), fmt: x => `${x.toFixed(1)}×` }),
      a.canChooseOutput ? h('label', { class: 'field' }, h('span', {}, 'Sound comes out of'), pick(outputs, I.outputId, id => app.setOutput(id))) : null);
  }
  function renderSound() {
    const F = app.film, S = app.sound, t = app.tempo;
    const row = (label, items, key) => h('div', { class: 'opt-row' }, h('span', {}, label), chips(items, id => F[key] === id, id => app.setFilmOption(key, id), 'seg'));
    return [
      songsBlock(),
      statusLine(),
      h('section', { class: 'sec' },
        toggle('Direct it for me', () => F.auto, on => app.setFilmOption('auto', on), 'scenes change with the song, on its sections'),
        F.auto ? h('div', { class: 'opts' },
          row('Color', [['bw', 'B&W'], ['accent', 'One color'], ['full', 'Full']], 'color'),
          row('Figures', [['none', 'None'], ['some', 'Some'], ['lots', 'Lots']], 'figures'),
          row('Places', [[false, 'Flat'], [true, 'Flat + 3D']], 'worlds'),
          row('Pace', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], 'pace'),
          h('button', { class: 'btn wide', html: `${icon('dice')}<span>Another take</span>`, onclick: () => app.setFilmOption('seed', F.seed + 1) })) : null),
      h('section', { class: 'sec' },
        h('div', { class: 'opt-row' }, h('span', {}, 'It follows'), chips(Object.entries(app.MOODS).map(([id, M]) => [id, M.name]), id => F.mood === id, id => { app.setMood(id); renderBody(); }, 'seg')),
        h('p', { class: 'muted small' }, app.MOODS[F.mood]?.blurb),
        slider('How much', { min: 0, max: 2, get: () => S.amount, set: x => { S.amount = x; } })),
      liveFold(),
      fold('sound-fine', 'Fine control', null,
        slider('Spectrum spikes', { min: 0, max: 2, get: () => S.spectrum, set: x => { S.spectrum = x; } }),
        slider('Landscape of the sound', { min: 0, max: 2, get: () => S.land, set: x => { S.land = x; } }),
        slider('The ball hops', { min: 0, max: 1.5, get: () => S.ballBounce, set: x => { S.ballBounce = x; } }),
        slider('The hands grab', { min: 0, max: 1.5, get: () => S.handsGrab, set: x => { S.handsGrab = x; } }),
        slider('The orbs swell', { min: 0, max: 2, get: () => S.orbsBass, set: x => { S.orbsBass = x; } }),
        slider('Tempo', { min: 40, max: 180, step: 0.5, fmt: x => `${x.toFixed(1)} bpm`, get: () => t.bpm, set: x => { t.bpm = x; t.fromSong = false; } }),
        h('div', { class: 'tempo-row' },
          h('button', { class: 'btn', onclick: e => { e.currentTarget.textContent = `Tap · ${app.tapTempo()}`; } }, 'Tap the beat'),
          chips([[2, '2'], [3, '3'], [4, '4']], n => t.beatsPerBar === n, n => { t.beatsPerBar = n; renderBody(); }, 'small')),
        Object.entries(app.ties).map(([key, tie]) => {
          const r = slider(`${SOURCES[tie.src]} → ${labelOf(key)}`, { min: -1, max: 1, get: () => app.ties[key]?.amt ?? 0, set: x => { if (app.ties[key]) app.ties[key].amt = x; } });
          r.classList.add('tie');
          r.top.insertBefore(h('button', { class: 'mod-x', 'aria-label': 'Remove', html: icon('x'), onclick: () => { app.setTie(key, null); renderBody(); } }), r.top.lastChild);
          return r;
        }),
        h('p', { class: 'muted small' }, 'Any slider in Tweak can follow the music too: click its ∿.')),
    ];
  }

  // ---------------------------------------------------------------- Tweak
  let resetBtn = null, feelReset = null, viewRows = [];
  function renderTweak() {
    const L = LOOKS[app.lookId], v = look(app.lookId);
    resetBtn = h('button', { class: 'btn', disabled: !app.isEdited(app.lookId), onclick: () => app.resetLook(), html: `${icon('reset')}<span>Reset</span>` });
    const has = k => Math.abs(v[k] || 0) > 0.001;
    const rate = has('flyRate') ? 'flyRate' : has('objSpin') ? 'objSpin' : has('orbitRate') ? 'orbitRate' : null;
    const shown = new Set([...L.tweaks, 'freq', 'thick', 'spinRate', 'flow', 'swell', rate, 'paper', 'ink', 'ink2', 'fog', 'bands', 'hueRate', 'glow', 'glowColor']);
    const MORE = [['lines', 'Lines'], ['strange', 'Strange'], ['bend', 'Bend'], ['shape', 'Relief'], ['space', 'Space'], ['objects', 'Objects'], ['camera', 'The look’s own camera'], ['motion', 'Speeds'], ['look', 'Light & finish'], ['music', 'Music reactions']];
    const swatch = p => h('button', {
      class: 'swatch', title: p.name, 'aria-label': p.name,
      style: `--paper:${p.paper};--ink:${p.ink};--ink2:${p.ink2 || p.ink}`, onclick: () => { app.applyPalette(p); renderBody(); },
    });
    const C = app.cine, V = app.view;
    const deg = x => `${Math.round(x * 57.3)}°`;
    const wrap = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
    viewRows = [
      slider('Tilt toward the horizon', { min: -0.4, max: 1.4, get: () => V.pitch, set: x => { V.pitch = x; }, fmt: deg, reset: () => { V.pitch = 0; } }),
      slider('Turn', { min: -3.14, max: 3.14, get: () => wrap(V.yaw), set: x => { V.yaw = x; }, fmt: deg, reset: () => { V.yaw = 0; } }),
      slider('Zoom', { min: 0.25, max: 3, get: () => 1 / V.zoom, set: x => { V.zoom = 1 / x; }, fmt: x => `${x.toFixed(2)}×`, reset: () => { V.zoom = 1; } }),
    ];
    return [
      h('div', { class: 'tweak-head' },
        h('div', {}, h('b', {}, L.name), h('small', {}, L.blurb)),
        h('div', { class: 'tweak-btns' }, resetBtn,
          iconBtn('save', 'Save it to Patterns', () => { const n = prompt('Name it', `${L.name} (mine)`); if (n?.trim()) app.saveLook(n.trim().slice(0, 40)); }))),
      h('div', { class: 'swatches' }, PALETTES.map(swatch)),
      L.tweaks.map(k => lookSlider(k)),
      section('Motion', null,
        ['freq', 'thick', 'spinRate'].filter(k => !L.tweaks.includes(k)).map(k => lookSlider(k)),
        L.tweaks.includes('flow') ? null : lookSlider('flow', { min: -3, max: 3 }),
        lookSlider('swell', { label: 'Waves rolling through' }), rate && !L.tweaks.includes(rate) ? lookSlider(rate) : null),
      section('Camera', null,
        toggle('Cinematic', () => C.on, on => app.setCinema(on), 'it flies from shot to shot by itself'),
        C.on ? slider('Speed', { min: 0, max: 1, get: () => C.speed, set: x => { C.speed = x; }, fmt: x => (x < 0.25 ? 'drifting' : x < 0.5 ? 'cruising' : x < 0.8 ? 'sweeping' : 'racing') }) : null,
        viewRows,
        h('button', { class: 'link-btn', onclick: () => { app.resetView(); renderBody(); } }, 'Put the camera back')),
      fold('tw-feel', 'Feel', 'calm, moving, bold',
        h('div', { class: 'knobs' }, KNOBS.map(k => knob(k, () => app.feel[k.id], x => { app.feel[k.id] = x; feelReset.disabled = !feelMoved(app.feel); }))),
        h('div', { class: 'knobs-foot' }, (feelReset = h('button', { class: 'link-btn', disabled: !feelMoved(app.feel), onclick: () => { app.resetFeel(); renderBody(); } }, 'Center them')))),
      fold('more-color', 'Your own colors', null,
        h('div', { class: 'color-row' }, ['paper', 'ink', 'ink2', 'fog'].map(colorPick)),
        lookSlider('bands', { label: 'Every other line in the second ink' }),
        lookSlider('hueRate', { label: 'Color cycle' }),
        lookSlider('glow'),
        toggle('Keep these colors when I change look', () => app.keepColors, on => app.setKeepColors(on))),
      fold('more-all', 'Everything else', null, MORE.map(([g, name]) => {
        const ps = PARAMS.filter(p => p.group === g && p.label && !shown.has(p.name));
        return ps.length ? fold(`more-${g}`, name, `${ps.length}`, ps.map(p => lookSlider(p.name))) : null;
      })),
      slider('Glide to a new look', { min: 0.2, max: 8, step: 0.1, fmt: x => `${x.toFixed(1)} s`, get: () => app.glide, set: x => { app.glide = x; } }),
    ];
  }

  // ---------------------------------------------------------------- Explore
  const exploreEl = h('div', { id: 'explore', class: 'explore', hidden: true });
  document.body.append(exploreEl);
  function renderExplore() {
    const X = app.explore;
    exploreEl.hidden = !X.open;
    if (!X.open) return;
    const cell = (img, label, onclick, cls = '') => h('button', { class: `ex-cell ${cls}`, onclick },
      img ? h('img', { src: img, alt: '' }) : h('span', { class: 'spinner' }), h('small', {}, label));
    const kids = X.kids.map((k, i) => cell(k.img, `#${i + 1}`, () => app.explorePick(i)));
    const grid = [...kids.slice(0, 4), cell(X.parentImg, 'now: shuffle', () => app.exploreBreed(), 'parent'), ...kids.slice(4)];
    exploreEl.replaceChildren(
      h('div', { class: 'ex-head' },
        h('div', {}, h('b', {}, 'Breed'), h('span', { class: 'muted small' }, ' Pick the one you like: it has 8 children. Keep going.')),
        h('div', { class: 'ex-ctrls' },
          slider('Mutation', { min: 0.05, max: 1, get: () => X.strength, set: x => { X.strength = x; }, fmt: x => (x < 0.35 ? 'gentle' : x < 0.7 ? 'medium' : 'wild') }),
          chips(Object.keys(X.locks).map(k => [k, `keep ${k}`]), k => X.locks[k], k => { X.locks[k] = !X.locks[k]; renderExplore(); }, 'small'),
          iconBtn('undo', 'Back a generation', () => app.exploreBack(), { disabled: !X.history.length }),
          h('button', { class: 'btn primary', onclick: () => app.exploreClose() }, 'Done'))),
      h('div', { class: 'ex-grid' }, grid));
  }

  // ---------------------------------------------------------------- the first-run hint
  const HINT_KEY = 'trippy.hint.v3';
  let hintShown = false;
  try { hintShown = !!localStorage.getItem(HINT_KEY); } catch {}
  function showHint() {
    if (hintShown) return;
    hintEl.textContent = 'Drag on it. Drop a song on it.';
    hintEl.hidden = false;
    setTimeout(dismissHint, 7000);
  }
  function dismissHint() {
    if (hintEl.hidden) return;
    hintEl.hidden = true;
    hintShown = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch {}
  }

  // ---------------------------------------------------------------- live bits
  let mapTick = 0, recTick = 0;
  function tick(dt) {
    idleT += dt;
    const cl = document.body.classList;
    if (idleT > 3 && !cl.contains('idle') && !tab && !app.explore.open && moreMenu.hidden && !document.querySelector('#bottom:hover, #corner:hover')) cl.add('idle');
    if ((mapTick += dt) > 1 / 20) { mapTick = 0; paintMap(); }
    if (app.recording && (recTick += dt) > 1) {
      recTick = 0;
      const s = Math.floor((performance.now() - app.recordStart) / 1000);
      toast(`Recording ${fmtTime(s)}`);
    }
  }

  function lookEdited(full = false) {
    renderName();
    if (resetBtn) resetBtn.disabled = !app.isEdited(app.lookId);
    if (full && tab === 'tweak') renderBody();
  }

  document.body.classList.add('panel-closed');
  renderCorner();
  renderDock();
  renderTransport();
  renderName();
  showHint();

  return {
    toast, renderDock, renderExplore, dismissHint, tick, openTab,
    get tab() { return tab; },
    refresh() { renderCorner(); renderBody(); renderDock(); },
    refreshTop: renderCorner,
    lookChanged() {
      renderName();
      if (tab === 'tweak') renderBody();
      if (tab === 'patterns') body.querySelectorAll('.card[data-look]').forEach(c => c.classList.toggle('on', c.dataset.look === app.lookId));
    },
    lookEdited,
    soundChanged() { renderTransport(); if (tab === 'sound') renderBody(); },
    listenProgress() { const el = document.getElementById('listenStatus'); if (el) el.textContent = `Listening… ${Math.round(app.film.listening * 100)}%`; },
    addsChanged() { renderName(); renderDock(); if (tab === 'figures') renderBody(); },
    syncFigures() { if (tab === 'figures') body.querySelectorAll('.slider').forEach(s => s.sync?.()); },
    cinemaChanged() { renderDock(); if (tab === 'tweak') renderBody(); },
    viewChanged() { if (tab === 'tweak') viewRows.forEach(r => r.isConnected && r.sync()); },
  };
}
