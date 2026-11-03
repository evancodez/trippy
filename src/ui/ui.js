// The interface: a top bar, a side panel with four tabs, and the tool dock.
//   Looks  – every look, grouped; click one and everything glides there
//   Tweak  – this look's best sliders, color, the feel knobs, and everything else folded away; one Reset
//   Add    – you (the camera), hands, a face, the ball, orbs, a picture — none on until you add it
//   Sound  – your songs, how hard the music hits, the sound's own shapes, ties, changing look by itself
// Sliders write straight into the app; anything that changes structure re-renders the open tab.
import { h, slider, toggle, chips, iconBtn, section, fold, knob, fmt2, BLANK } from './kit.js';
import { icon } from '../icons.js';
import { LOOKS, GROUPS, PALETTES, look } from '../engine/looks.js';
import { PARAMS, PARAM_BY_NAME, rgbToHex } from '../engine/params.js';
import { KNOBS, feelMoved } from '../engine/feel.js';
import { ADDS } from '../adds.js';
import { FIGURES, FIGURE_GROUPS } from '../engine/figures.js';
import { FONTS } from '../media.js';

export const TOOLS = [
  { id: 'ripple', icon: 'ripple', name: 'Ripple', tip: 'Click or drag to drop ripples' },
  { id: 'twist', icon: 'twist', name: 'Twist', tip: 'Hold to keep twisting, round and round (Alt/Option: the other way)' },
  { id: 'bulge', icon: 'bulge', name: 'Bulge', tip: 'Hold to puff it up' },
  { id: 'pinch', icon: 'pinch', name: 'Pinch', tip: 'Hold to suck it in' },
  { id: 'smear', icon: 'smear', name: 'Smear', tip: 'Drag to push it like wet paint' },
  { id: 'hand', icon: 'hand', name: 'Hand', tip: 'Your cursor is a hand pressing through from behind — hold to push' },
  { id: 'camera', icon: 'orbit', name: 'Camera', tip: 'Drag to turn and tilt the view (or right-drag with any tool) · Shift-drag slides it · scroll zooms' },
];

// friendlier names for the sliders people reach for most
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
const SOURCES = { bass: 'Bass', mid: 'Mids', high: 'Highs', loud: 'Loudness', beat: 'Beat', bar: 'Bar sway', slow: 'Slow wave' };

export function createUI(app) {
  const body = document.getElementById('panelBody');
  const tabsEl = document.getElementById('tabs');
  const actionsEl = document.getElementById('actions');
  const dock = document.getElementById('dock');
  const toastEl = document.getElementById('toast');
  const nameEl = document.getElementById('presetName');
  const hintEl = document.getElementById('hint');
  const nowEl = document.getElementById('nowPlaying');
  let tab = 'looks';
  let meters = null;
  let toastTimer = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- ∿: tie any value to the music
  function tieButton(row, key) {
    const btn = h('button', { class: 'mod-btn', 'aria-label': 'Follow the music', 'data-tip': 'Follow the music', html: '∿' });
    row.top.insertBefore(btn, row.top.lastChild);
    let open = false, panel = null;
    const paint = () => {
      const t = app.ties[key];
      row.classList.toggle('tied', !!t);
      btn.textContent = t ? `∿ ${SOURCES[t.src]}` : '∿';
    };
    const build = () => {
      const t = app.ties[key];
      panel = h('div', { class: 'modrow' },
        chips([['', 'Off'], ...Object.entries(SOURCES)], id => (id ? t?.src === id : !t), id => { app.setTie(key, id || null); rebuild(); }, 'small'),
        t ? slider('How much (− flips it)', { min: -1, max: 1, get: () => app.ties[key]?.amt ?? 0.4, set: v => { if (app.ties[key]) app.ties[key].amt = v; } }) : null);
      row.append(panel);
    };
    const rebuild = () => { panel?.remove(); panel = null; if (open) build(); paint(); };
    btn.addEventListener('click', e => { e.stopPropagation(); open = !open; rebuild(); });
    paint();
    return row;
  }

  // a slider for one of the look's values: remembered for this look, double-click puts it back, ∿ ties it to the music
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

  // ---------------------------------------------------------------- top bar
  const ACTIONS = [
    { id: 'surprise', icon: 'dice', tip: 'A random look (D)', run: () => app.surprise(), text: 'Surprise' },
    { id: 'explore', icon: 'grid', tip: 'Breed this look: 8 variations, pick one, repeat (E)', run: () => app.exploreOpen(), text: 'Explore' },
    'sep',
    { id: 'pause', icon: () => (app.paused ? 'play' : 'pause'), tip: 'Pause / play (Space)', run: () => app.togglePause() },
    { id: 'snap', icon: 'camera', tip: 'Save a picture (S)', run: () => app.snapshot() },
    { id: 'rec', icon: 'record', tip: 'Record a clip', run: () => app.toggleRecord() },
    { id: 'share', icon: 'link', tip: 'Copy a link to this look', run: () => app.share() },
    { id: 'full', icon: 'expand', tip: 'Fullscreen (F)', run: () => app.toggleFullscreen() },
    { id: 'panel', icon: 'panel', tip: 'Show / hide the menu', run: () => setView('panel', !view.panel) },
    { id: 'view', icon: 'eye', tip: 'What’s on screen (H hides everything)', run: e => toggleViewMenu(e.currentTarget) },
  ];
  function renderTop() {
    actionsEl.replaceChildren(...ACTIONS.map(a => {
      if (a === 'sep') return h('span', { class: 'sep' });
      const ic = typeof a.icon === 'function' ? a.icon() : a.icon;
      return h('button', {
        class: `act act-${a.id}${a.text ? ' has-text' : ''}${a.id === 'rec' && app.recording ? ' live' : ''}`,
        'data-tip': a.tip, 'aria-label': a.tip, onclick: a.run,
        html: icon(ic) + (a.text ? `<span>${a.text}</span>` : '') + (a.id === 'rec' && app.recording ? '<span class="rec-time">0:00</span>' : ''),
      });
    }));
    renderName();
  }
  function renderName() {
    nameEl.textContent = LOOKS[app.lookId]?.name || '';
    nameEl.classList.toggle('dirty', app.isEdited(app.lookId));
  }

  // the now-playing pill
  function renderNow() {
    const a = app.audio;
    nowEl.hidden = a.mode === 'off';
    if (nowEl.hidden) return;
    nowEl.replaceChildren(...[
      h('span', { class: 'now-pill-name', title: a.name }, a.mode === 'mic' ? '🎙 Mic' : `♪ ${a.name}`),
      a.mode === 'file' ? iconBtn(a.playing ? 'pause' : 'play', 'Play / pause', () => { a.togglePlay(); setTimeout(renderNow, 60); }) : null,
      a.mode === 'file' && app.songs.list.length > 1 ? iconBtn('next', 'Next song', () => app.nextSong()) : null,
      iconBtn('stop', 'Stop', () => app.stopAudio()),
    ].filter(Boolean));
  }

  // what's on screen
  const VIEW_KEY = 'trippy.view.v2';
  const VIEW_ITEMS = [['topbar', 'Top bar'], ['panel', 'Side panel'], ['dock', 'Tool dock'], ['ring', 'Brush ring'], ['hint', 'Tips']];
  const view = { topbar: true, panel: true, dock: true, ring: true, hint: true };
  try { Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY) || '{}')); } catch {}
  function applyView() {
    const b = document.body.classList;
    b.toggle('no-topbar', !view.topbar);
    b.toggle('panel-closed', !view.panel);
    b.toggle('no-dock', !view.dock);
    b.toggle('no-ring', !view.ring);
    b.toggle('no-hint', !view.hint);
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {}
  }
  function setView(k, v) { view[k] = v; applyView(); }
  const viewMenu = h('div', { class: 'view-menu glass chrome', hidden: true });
  document.body.append(viewMenu);
  function toggleViewMenu(anchor) {
    if (!viewMenu.hidden) { viewMenu.hidden = true; return; }
    viewMenu.replaceChildren(
      h('b', {}, 'Show on screen'),
      ...VIEW_ITEMS.map(([k, label]) => toggle(label, () => view[k], v => setView(k, v))),
      h('button', { class: 'btn wide', onclick: () => { viewMenu.hidden = true; app.toggleUI(); } }, 'Hide everything (H)'));
    const r = anchor.getBoundingClientRect();
    viewMenu.style.top = `${r.bottom + 8}px`;
    viewMenu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    viewMenu.hidden = false;
  }
  addEventListener('pointerdown', e => {
    if (!viewMenu.hidden && !viewMenu.contains(e.target) && !e.target.closest?.('.act-view')) viewMenu.hidden = true;
  });

  // ---------------------------------------------------------------- tool dock (+ add-ons you pinned)
  function renderDock() {
    const tools = h('div', { class: 'tools' }, TOOLS.map((t, i) =>
      h('button', {
        class: `tool${app.tool === t.id ? ' on' : ''}`, 'data-tip': `${t.tip} (${i + 1})`, 'aria-label': t.name,
        onclick: () => app.setTool(t.id), html: `${icon(t.icon)}<span>${t.name}</span>`,
      })));
    const b = app.brush;
    const mini = (label, key, min, max) => {
      const s = slider(label, { min, max, get: () => b[key], set: v => { b[key] = v; app.updateRing(); } });
      s.classList.add('mini');
      return s;
    };
    const pinned = ADDS.filter(a => app.adds[a.id].pinned);
    dock.replaceChildren(
      tools,
      h('button', {
        class: `tool cine${app.cine.on ? ' on' : ''}`, 'data-tip': 'Cinematic camera: it drifts from shot to shot on its own (C)',
        onclick: () => app.setCinema(!app.cine.on), html: `${icon('film')}<span>Cinematic</span>`,
      }),
      h('div', { class: 'tool-opts' },
        mini('Size', 'size', 0.04, 0.5), mini('Strength', 'strength', 0.05, 1.5),
        ['twist', 'bulge', 'pinch', 'smear'].includes(app.tool) ? mini('Spring back', 'spring', 0, 1) : null,
        iconBtn('wipe', 'Put the view back (double-click)', () => app.resetView())),
      h('div', { class: `dock-adds${pinned.length ? '' : ' empty'}` },
        pinned.map(a => h('button', {
          class: `tool add${app.adds[a.id].on ? ' on' : ''}`, 'data-tip': `${app.adds[a.id].on ? 'Take away' : 'Add'}: ${a.name.toLowerCase()}`,
          onclick: () => app.setAdd(a.id, !app.adds[a.id].on), html: `${icon(a.icon)}<span>${a.name}</span>`,
        })),
        h('button', { class: 'tool add-more', 'data-tip': 'Add things to the world', onclick: () => openTab('add'), html: `${icon('plus')}<span>Add</span>` })));
  }

  // ---------------------------------------------------------------- tabs
  const TABS = [
    { id: 'looks', name: 'Looks', icon: 'grid' },
    { id: 'tweak', name: 'Tweak', icon: 'sliders' },
    { id: 'add', name: 'Add', icon: 'plus' },
    { id: 'sound', name: 'Sound', icon: 'music' },
  ];
  function renderTabs() {
    tabsEl.replaceChildren(h('div', { class: 'tabbar' }, TABS.map(t =>
      h('button', { class: `tab${tab === t.id ? ' on' : ''}`, onclick: () => openTab(t.id), html: `${icon(t.icon)}<span>${t.name}</span>` }))));
  }
  function openTab(id) {
    tab = id;
    if (!view.panel) setView('panel', true);
    renderTabs();
    renderBody();
    body.scrollTop = 0;
  }
  function renderBody() {
    const keep = body.scrollTop;
    meters = null;
    const v = { looks: renderLooks, tweak: renderTweak, add: renderAdd, sound: renderSound }[tab]();
    body.replaceChildren(...[v].flat(4).filter(Boolean));
    body.scrollTop = keep;
  }

  // ---------------------------------------------------------------- Looks
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
      job[1].src = app.thumb(job[0]);
      setTimeout(next, 16);
    };
    setTimeout(next, 16);
  }

  function renderLooks() {
    const card = id => h('button', { class: `card${app.lookId === id ? ' on' : ''}`, title: LOOKS[id].blurb, onclick: () => { app.pickLook(id); } },
      thumb(id), h('span', {}, LOOKS[id].name, app.isEdited(id) ? h('i', { class: 'dot', title: 'You tweaked this one' }) : null));
    const saves = app.saves.length ? h('div', { class: 'group' },
      h('div', { class: 'group-head' }, h('b', {}, 'Saved'), h('small', {}, 'yours, kept in this browser')),
      h('div', { class: 'cards' }, app.saves.map(sv => h('div', { class: 'card save' },
        h('button', { class: 'card-hit', onclick: () => app.openSave(sv.id) }, h('img', { class: 'thumb', src: sv.thumb || BLANK, alt: '' }), h('span', {}, sv.name)),
        h('button', { class: 'card-x', 'aria-label': `Delete ${sv.name}`, html: icon('x'), onclick: () => app.deleteSave(sv.id) }))))) : null;
    return [
      saves,
      GROUPS.map(([g, name, blurb]) => h('div', { class: 'group' },
        h('div', { class: 'group-head' }, h('b', {}, name), h('small', {}, blurb)),
        h('div', { class: 'cards' }, Object.keys(LOOKS).filter(id => LOOKS[id].group === g).map(card)))),
      h('div', { class: 'foot' },
        slider('Glide to a new look', { min: 0.2, max: 8, step: 0.1, fmt: v => `${v.toFixed(1)} s`, get: () => app.glide, set: v => { app.glide = v; } }),
        h('p', { class: 'muted small' }, '← → step through the looks · D surprise · E explore')),
    ];
  }

  // ---------------------------------------------------------------- Tweak
  // most used first: color, this look's own sliders, lines & motion, the camera; then the feel knobs; the rest folded
  let resetBtn = null, feelReset = null, viewRows = [];
  function renderTweak() {
    const L = LOOKS[app.lookId], v = look(app.lookId);
    resetBtn = h('button', { class: 'btn', disabled: !app.isEdited(app.lookId), onclick: () => app.resetLook(), html: `${icon('reset')}<span>Reset</span>` });
    const has = k => Math.abs(v[k] || 0) > 0.001;
    const rate = has('flyRate') ? 'flyRate' : has('objSpin') ? 'objSpin' : has('orbitRate') ? 'orbitRate' : null;
    const shown = new Set([...L.tweaks, 'freq', 'thick', 'spinRate', 'flow', 'swell', rate,
      'paper', 'ink', 'ink2', 'fog', 'bands', 'hueRate', 'glow', 'glowColor']);
    const MORE = [['lines', 'Lines'], ['bend', 'Bend'], ['shape', 'Relief'], ['space', 'Space'], ['objects', 'Objects'], ['camera', 'The look’s own camera'], ['motion', 'Speeds'], ['look', 'Light & finish'], ['music', 'Music reactions']];
    const swatch = p => h('button', {
      class: 'swatch', title: p.name, 'aria-label': p.name,
      style: `--paper:${p.paper};--ink:${p.ink};--ink2:${p.ink2 || p.ink}`, onclick: () => { app.applyPalette(p); renderBody(); },
    });
    return [
      h('div', { class: 'tweak-head' },
        h('div', {}, h('b', {}, L.name), h('small', {}, L.blurb)),
        h('div', { class: 'tweak-btns' },
          resetBtn,
          iconBtn('save', 'Save it (it shows up in Looks)', () => { const n = prompt('Name it', `${L.name} (mine)`); if (n?.trim()) app.saveLook(n.trim().slice(0, 40)); }))),
      h('div', { class: 'swatches' }, PALETTES.map(swatch)),
      section('This look', null, L.tweaks.map(k => lookSlider(k))),
      section('Lines & motion', null,
        lookSlider('freq'), lookSlider('thick'), lookSlider('spinRate'), lookSlider('flow', { min: -3, max: 3 }),
        lookSlider('swell', { label: 'Waves rolling through' }),
        rate ? lookSlider(rate) : null),
      cameraSection(),
      section('Feel', 'works on every look',
        h('div', { class: 'knobs' },
          KNOBS.map(k => knob(k, () => app.feel[k.id], x => { app.feel[k.id] = x; feelReset.disabled = !feelMoved(app.feel); }))),
        h('div', { class: 'knobs-foot' },
          (feelReset = h('button', { class: 'link-btn', disabled: !feelMoved(app.feel), onclick: () => { app.resetFeel(); renderBody(); } }, 'Center them')))),
      h('div', { class: 'sub-label' }, 'More'),
      fold('more-color', 'Color', 'your own',
        h('div', { class: 'color-row' }, ['paper', 'ink', 'ink2', 'fog'].map(colorPick)),
        lookSlider('bands', { label: 'Every other line in the second ink' }),
        lookSlider('hueRate', { label: 'Color cycle' }),
        lookSlider('glow'),
        toggle('Keep these colors when I change look', () => app.keepColors, on => app.setKeepColors(on))),
      MORE.map(([g, name]) => {
        const ps = PARAMS.filter(p => p.group === g && p.label && !shown.has(p.name));
        return ps.length ? fold(`more-${g}`, name, `${ps.length}`, ps.map(p => lookSlider(p.name))) : null;
      }),
      h('p', { class: 'muted small foot' }, 'Your tweaks stay with this look until you Reset it. Double-click a slider to put just that one back. A pink ∿ means it follows the music.'),
    ];
  }

  // the camera is yours, across looks: turn, tilt and zoom it, or let the cinematic camera drive
  function cameraSection() {
    const C = app.cine, V = app.view;
    const deg = x => `${Math.round(x * 57.3)}°`;
    const wrap = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
    viewRows = [
      slider('Tilt toward the horizon', { min: -0.4, max: 1.4, get: () => V.pitch, set: x => { V.pitch = x; }, fmt: deg, reset: () => { V.pitch = 0; } }),
      slider('Turn', { min: -3.14, max: 3.14, get: () => wrap(V.yaw), set: x => { V.yaw = x; }, fmt: deg, reset: () => { V.yaw = 0; } }),
      slider('Zoom', { min: 0.25, max: 3, get: () => 1 / V.zoom, set: x => { V.zoom = 1 / x; }, fmt: x => `${x.toFixed(2)}×`, reset: () => { V.zoom = 1; } }),
    ];
    return section('Camera', 'right-drag turns it · scroll zooms',
      toggle('Cinematic', () => C.on, on => app.setCinema(on), 'sweeps from shot to shot on its own: top down, out to the horizon, tilted'),
      C.on ? h('div', { class: 'cine' },
        slider('Speed', { min: 0, max: 1, get: () => C.speed, set: x => { C.speed = x; }, fmt: x => (x < 0.25 ? 'drifting' : x < 0.5 ? 'cruising' : x < 0.8 ? 'sweeping' : 'racing') }),
        slider('Waves through the lines', { min: 0, max: 1.5, get: () => C.waves, set: x => { C.waves = x; } }),
        toggle('Change the look as it goes', () => C.looks, x => { C.looks = x; renderBody(); }),
        C.looks ? chips(GROUPS.map(([id, name]) => [id, name]), id => C.groups.includes(id), id => {
          C.groups = C.groups.includes(id) ? (C.groups.length > 1 ? C.groups.filter(x => x !== id) : C.groups) : [...C.groups, id];
          renderBody();
        }, 'small') : null) : null,
      viewRows,
      h('button', { class: 'link-btn', onclick: () => { app.resetView(); renderBody(); } }, 'Put the camera back'));
  }

  // ---------------------------------------------------------------- Add
  function addHead(a) {
    const A = app.adds[a.id];
    return h('div', { class: `add-head${A.on ? ' on' : ''}` },
      h('span', { class: 'add-icon', html: icon(a.icon) }),
      h('div', { class: 'add-title' }, h('b', {}, a.name), h('small', {}, a.blurb)),
      h('button', { class: `pin${A.pinned ? ' on' : ''}`, 'data-tip': A.pinned ? 'Unpin from the toolbar' : 'Pin to the toolbar', 'aria-label': 'Pin to the toolbar', html: icon('pin'), onclick: () => app.pinAdd(a.id, !A.pinned) }),
      toggle('', () => A.on, on => app.setAdd(a.id, on)));
  }
  function addSlider(id, key, label, min, max, opts = {}) {
    return slider(label, { min, max, step: opts.step || 0.01, fmt: opts.fmt, get: () => app.adds[id][key], set: x => app.setAddOption(id, key, x) });
  }
  const showSlider = (key, label, min, max, opts = {}) => slider(label, { min, max, step: 0.01, hint: opts.hint, fmt: opts.fmt, get: () => app.show[key], set: x => { app.show[key] = x; } });

  function showBlock(cam) {
    const S = app.show;
    return [
      h('div', { class: 'sub-label' }, cam ? 'How you show' : 'How it shows'),
      showSlider('photo', 'Photo — the picture itself', 0, 1),
      S.photo > 0 ? toggle('True color (off: the look’s two colors)', () => S.photoColor > 0.5, x => { S.photoColor = x ? 1 : 0; }) : null,
      showSlider('relief', 'Relief — pushes the lines up', 0, 3),
      showSlider('engrave', 'Engraved — drawn in line thickness', 0, 2),
      cam ? showSlider('detail', 'Detail', 0, 1, { fmt: x => `${Math.round(480 + x * 800)} px`, hint: 'How sharp the camera picture is' }) : null,
      toggle(cam ? 'Keep me still — the warps stay outside' : 'Keep it still — the warps stay outside', () => S.calm > 0.5, x => { S.calm = x ? 1 : 0; }),
      showSlider('aura', 'Aura — the lines ripple off it with the sound', 0, 3),
      fold(cam ? 'cam-place' : 'pic-place', 'Place it', null,
        showSlider('size', 'Size', 0.2, 3), showSlider('x', 'Move ↔', -1.5, 1.5), showSlider('y', 'Move ↕', -1.5, 1.5),
        showSlider('soft', 'Smooth the relief', 0, 6), showSlider('warp', 'Bend it with the look', 0, 1),
        toggle('Invert', () => S.invert > 0.5, x => { S.invert = x ? 1 : 0; })),
    ];
  }

  const SUBJECTS = [['body', 'My body'], ['bodyhands', 'Body + what I hold'], ['hands', 'Hands & what they hold'], ['face', 'My face'], ['scene', 'Whole picture'], ['box', 'A frame I set'], ['motion', 'Movement']];
  function cameraBody() {
    const tr = app.tracker, c = app.cam;
    const label = { loading: 'loading…', on: 'on', error: 'didn’t load', off: '' };
    const status = ['face', 'hands', 'body'].filter(k => tr.want[k] && tr.status[k] !== 'off').map(k => `${{ face: 'Face', hands: 'Hands', body: 'Body outline' }[k]}: ${label[tr.status[k]]}`).join(' · ');
    const b = c.box;
    return [
      h('p', { class: 'muted small' }, 'Worked out in this browser — no picture leaves your computer.'),
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
        toggle('Look around — move your head and the view shifts', () => c.look, x => app.setCam('look', x)),
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
      file,
      words,
      chips(Object.keys(FONTS).map(f => [f, f]), f => md.text.font === f, f => { md.text.font = f; if (words.value.trim()) app.setWords(words.value, f); renderBody(); }, 'small'),
      has ? showBlock(false) : h('p', { class: 'muted small' }, 'Or drop a picture or video anywhere on the page.'),
    ];
  }

  function renderAdd() {
    const A = app.adds;
    const bodies = {
      camera: cameraBody,
      hands: () => [
        h('p', { class: 'muted small' }, 'A mirrored pair — a left and a right, like someone behind the sheet pressing both palms toward you.'),
        addSlider('hands', 'size', 'Size', 0.4, 2.5), addSlider('hands', 'push', 'Push through', 0, 1), addSlider('hands', 'open', 'Fist ↔ open', 0, 1), addSlider('hands', 'apart', 'How far apart', 0.15, 1),
        toggle('Copy my hands (camera), finger by finger', () => A.hands.copy, x => { app.setAddOption('hands', 'copy', x); renderBody(); }),
      ],
      figures: () => {
        const F = A.figures, cur = FIGURES.find(f => f.id === F.pick) || FIGURES[0];
        return [
          h('p', { class: 'fig-now' }, h('b', {}, cur.name), h('span', {}, ` — ${cur.blurb}`)),
          FIGURE_GROUPS.map(g => [
            h('div', { class: 'sub-label' }, g),
            chips(FIGURES.filter(f => f.group === g).map(f => [f.id, f.name, f.blurb]), id => F.pick === id, id => { app.pickFigure(id); }, 'small'),
          ]),
          h('div', { class: 'run-actions' }, h('button', { class: 'btn', html: `${icon('dice')}<span>Another</span>`, onclick: () => app.pickFigure(app.figures.nextId(F.pick)) })),
          addSlider('figures', 'size', 'Size', 0.3, 2.5), addSlider('figures', 'depth', 'How far it rises', 0.2, 2.5),
          addSlider('figures', 'spin', 'Turning', -1, 1),
          toggle('Change with the music', () => F.cycle, x => { app.setAddOption('figures', 'cycle', x); renderBody(); }, 'a new figure every few bars, each re-forming out of the last'),
          F.cycle ? addSlider('figures', 'every', 'Every', 1, 16, { step: 1, fmt: x => `${x} bar${x > 1 ? 's' : ''}` }) : null,
          toggle('Repeat across the sheet', () => F.repeat, x => app.setAddOption('figures', 'repeat', x)),
          toggle('Follow my mouse', () => F.follow, x => app.setAddOption('figures', 'follow', x), 'its eyes follow you either way'),
        ];
      },
      face: () => [
        addSlider('face', 'size', 'Size', 0.4, 2.5), addSlider('face', 'depth', 'How deep it presses', 0.2, 1.5),
        toggle('Copy my face (camera): mouth, blinks, head turn', () => A.face.copy, x => { app.setAddOption('face', 'copy', x); renderBody(); }),
      ],
      ball: () => [
        h('p', { class: 'muted small' }, 'The lines part around it like water round a stone. With music it hops on the beat and ripples where it lands.'),
        addSlider('ball', 'size', 'Size', 0.04, 0.4), addSlider('ball', 'speed', 'Speed', 0, 1.5), addSlider('ball', 'flow', 'How much the lines part', 0, 2), addSlider('ball', 'wake', 'Wake behind it', 0, 2),
        toggle('Follow my mouse', () => A.ball.follow, x => app.setAddOption('ball', 'follow', x)),
      ],
      orbs: () => [addSlider('orbs', 'amount', 'How far they rise', 0.2, 1.5), addSlider('orbs', 'grid', 'Grid', 2, 12, { step: 1, fmt: x => `${x}×${x}` })],
      picture: pictureBody,
    };
    return [
      h('p', { class: 'lead' }, 'Add things to whatever look is on. Pin the ones you like (', h('span', { class: 'inline-icon', html: icon('pin') }), ') and they get a switch in the toolbar.'),
      ADDS.map(a => h('div', { class: `add-card${A[a.id].on ? ' on' : ''}` }, addHead(a), A[a.id].on || a.id === 'camera' || a.id === 'picture' ? h('div', { class: 'add-body' }, bodies[a.id]()) : null)),
    ];
  }

  // ---------------------------------------------------------------- Sound
  function songsBlock() {
    const a = app.audio, cur = app.currentSongId();
    const file = h('input', { type: 'file', accept: 'audio/*', multiple: true, hidden: true });
    file.addEventListener('change', () => { if (file.files.length) app.addSongs([...file.files]); });
    const list = app.songs.list;
    return [
      h('div', { class: 'run-actions' },
        h('button', { class: 'btn grow', html: `${icon('music')}<span>Add songs</span>`, onclick: () => file.click() }),
        h('button', { class: `btn${a.mode === 'mic' ? ' on' : ''}`, html: `${icon('mic')}<span>Live</span>`, 'data-tip': 'Listen to an input instead (set it up in Play live)', onclick: () => app.useMic() }),
        a.mode !== 'off' ? iconBtn('stop', 'Stop', () => app.stopAudio()) : null),
      file,
      list.length
        ? h('div', { class: 'song-list' }, list.map(sg => h('div', { class: `song${sg.id === cur ? ' on' : ''}` },
          h('button', { class: 'song-name', onclick: () => (sg.id === cur ? (a.togglePlay(), setTimeout(renderBody, 60)) : app.playSongId(sg.id)) },
            h('span', { html: icon(sg.id === cur && a.playing ? 'pause' : 'play') }), h('span', {}, sg.name)),
          h('button', { class: 'song-x', 'aria-label': `Forget ${sg.name}`, html: icon('x'), onclick: () => app.songs.remove(sg.id) }))))
        : h('p', { class: 'muted small' }, 'Drop songs anywhere on the page — several at once is fine. They stay in this browser so you can flip between them. Nothing is uploaded.'),
    ];
  }

  // play live: a guitar through an interface, a headset mic… optionally heard through the speakers
  function liveSection() {
    const a = app.audio, I = a.input, D = app.devices, live = a.mode === 'mic';
    const pick = (list, value, onchange) => {
      const el = h('select', { class: 'select' }, list.map(d => h('option', { value: d.id, selected: d.id === value ? true : null }, d.label)));
      el.addEventListener('change', () => onchange(el.value));
      return el;
    };
    const outputs = [{ id: '', label: 'System default' }, ...D.outputs.filter(o => o.id && o.id !== 'default')];
    return section('Play live', live ? `● ${a.name}` : 'a guitar, a mic, anything',
      h('p', { class: 'muted small' }, 'Plug a guitar into an audio interface (a Focusrite, say) or use any mic — the lines move with what you play.'),
      D.inputs.length ? h('label', { class: 'field' }, h('span', {}, 'Input'), pick(D.inputs, I.deviceId, id => app.useInput(id))) : null,
      h('div', { class: 'run-actions' },
        live
          ? h('button', { class: 'btn', html: `${icon('stop')}<span>Stop listening</span>`, onclick: () => app.stopAudio() })
          : h('button', { class: 'btn primary', html: `${icon('mic')}<span>Start listening</span>`, onclick: () => app.useInput() })),
      toggle('Hear it through the speakers, like an amp', () => I.monitor, on => app.setMonitor(on), 'with a mic, use headphones — or it’ll howl'),
      I.monitor ? slider('Volume', { min: 0, max: 1.5, get: () => I.volume, set: x => a.setMonitor(true, x) }) : null,
      slider('Input level', { min: 0.2, max: 4, get: () => I.level, set: x => a.setInputLevel(x), fmt: x => `${x.toFixed(1)}×`, hint: 'How hard the input drives the speakers (the picture adjusts itself)' }),
      a.canChooseOutput ? h('label', { class: 'field' }, h('span', {}, 'Sound comes out of'), pick(outputs, I.outputId, id => app.setOutput(id))) : null,
      h('p', { class: 'muted small' }, 'Going through the browser adds a little delay. For none at all, monitor on the interface itself and leave the speakers off here.'));
  }

  const RECIPES = [
    ['bulge', 'bass', 0.5, 'Bass bulges it'], ['frame', 'beat', -0.08, 'Beat punches in'], ['freq', 'beat', 0.12, 'Beat jumps the scale'],
    ['twist', 'loud', 0.3, 'Loudness twists'], ['warpN', 'mid', 0.5, 'Mids melt it'], ['thick', 'high', 0.35, 'Highs thin the lines'],
    ['spinRate', 'bass', 0.25, 'Bass spins it'], ['vortex', 'loud', 0.25, 'Loudness winds the vortex'], ['flow', 'bass', 0.3, 'Bass pushes the lines'],
  ];
  function renderSound() {
    const S = app.sound;
    const ss = (key, label, max, hint) => slider(label, { min: 0, max, hint, get: () => S[key], set: x => { S[key] = x; } });
    const bar = label => { const fill = h('i'); const el = h('div', { class: 'meter' }, h('span', {}, label), h('div', { class: 'meter-bar' }, fill)); el.fill = fill; return el; };
    meters = { bass: bar('Bass'), mid: bar('Mids'), high: bar('Highs') };
    const tieOn = ([key, src]) => app.ties[key]?.src === src;
    const t = app.tempo;
    return [
      section('Songs', app.audio.mode === 'file' ? `♪ ${app.audio.name}` : app.audio.mode === 'mic' ? 'listening live instead' : 'nothing playing', songsBlock(),
        h('div', { class: 'meters' }, meters.bass, meters.mid, meters.high)),
      liveSection(),
      section('How hard it hits', null,
        chips(Object.entries(app.LEVELS).map(([id, L]) => [id, L.name]), id => S.level === id, id => { app.setLevel(id); renderBody(); }),
        h('p', { class: 'muted small' }, app.LEVELS[S.level]?.blurb),
        ss('amount', 'How much the music moves it', 2, 'Scales the sway, the thump, loudness → intensity and every tie')),
      section('The sound itself', 'it bends the picture',
        ss('wave', 'Sound wave', 2, 'Like an oscilloscope: the lines become traces of the waveform'),
        ss('spectrum', 'Spectrum spikes', 2, 'Rings spike with the frequencies, bass to treble round the circle'),
        ss('land', 'Sound landscape', 2, 'The sheet rises into hills of the spectrum (best tilted back — try Line Landscape)')),
      section('Your things', 'when you’ve added them',
        ss('ballBounce', 'The ball hops on the beat', 1.5), ss('handsGrab', 'The hands grab on the bar', 1.5), ss('orbsBass', 'The orbs swell with the bass', 2)),
      section('Ties', 'a value follows the music',
        chips(RECIPES.map(r => [`${r[0]}|${r[1]}`, r[3]]), id => tieOn(id.split('|')), id => {
          const r = RECIPES.find(x => `${x[0]}|${x[1]}` === id);
          app.setTie(r[0], tieOn(r) ? null : r[1], tieOn(r) ? undefined : r[2]);
          renderBody();
        }, 'small'),
        Object.entries(app.ties).map(([key, tie]) => {
          const row = slider(`${SOURCES[tie.src]} → ${labelOf(key)}`, { min: -1, max: 1, get: () => app.ties[key]?.amt ?? 0, set: x => { if (app.ties[key]) app.ties[key].amt = x; } });
          row.classList.add('tie');
          row.top.insertBefore(h('button', { class: 'mod-x', 'aria-label': 'Remove', html: icon('x'), onclick: () => { app.setTie(key, null); renderBody(); } }), row.top.lastChild);
          return row;
        }),
        h('p', { class: 'muted small' }, 'Any slider in Tweak can follow the music too — click its ∿.')),
      section('Tempo', t.fromSong ? 'from the song' : 'for the bar sway',
        slider('Tempo', { min: 40, max: 180, step: 0.5, fmt: x => `${x.toFixed(1)} bpm`, get: () => t.bpm, set: x => { t.bpm = x; t.fromSong = false; } }),
        h('div', { class: 'tempo-row' },
          h('button', { class: 'btn', onclick: e => { e.currentTarget.textContent = `Tap · ${app.tapTempo()}`; } }, 'Tap the beat'),
          h('span', { class: 'muted small' }, 'Beats per bar'),
          chips([[2, '2'], [3, '3'], [4, '4']], n => t.beatsPerBar === n, n => { t.beatsPerBar = n; renderBody(); }, 'small'))),
      section('Change look by itself', null,
        chips([['off', 'Off'], ['song', 'While music plays'], ['always', 'Always']], id => app.auto.when === id, id => { app.auto.when = id; renderBody(); }),
        app.auto.when !== 'off' ? [
          slider('Every', { min: 2, max: 32, step: 1, fmt: x => `${x} bars`, get: () => app.auto.every, set: x => { app.auto.every = x; } }),
          chips(GROUPS.map(([id, name]) => [id, name]), id => app.auto.groups.includes(id), id => {
            const G = app.auto.groups;
            app.auto.groups = G.includes(id) ? (G.length > 1 ? G.filter(x => x !== id) : G) : [...G, id];
            renderBody();
          }, 'small'),
        ] : null),
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
    const grid = [...kids.slice(0, 4), cell(X.parentImg, 'now — shuffle', () => app.exploreBreed(), 'parent'), ...kids.slice(4)];
    exploreEl.replaceChildren(
      h('div', { class: 'ex-head' },
        h('div', {}, h('b', {}, 'Explore'), h('span', { class: 'muted small' }, 'Pick the one you like — it has 8 children. Keep going.')),
        h('div', { class: 'ex-ctrls' },
          slider('Mutation', { min: 0.05, max: 1, get: () => X.strength, set: x => { X.strength = x; }, fmt: x => (x < 0.35 ? 'gentle' : x < 0.7 ? 'medium' : 'wild') }),
          chips(Object.keys(X.locks).map(k => [k, `keep ${k}`]), k => X.locks[k], k => { X.locks[k] = !X.locks[k]; renderExplore(); }, 'small'),
          iconBtn('undo', 'Back a generation', () => app.exploreBack(), { disabled: !X.history.length }),
          h('button', { class: 'btn primary', onclick: () => app.exploreClose() }, 'Done'))),
      h('div', { class: 'ex-grid' }, grid));
  }

  // ---------------------------------------------------------------- the first-run hint
  const HINT_KEY = 'trippy.hint.v2';
  let hintShown = false;
  try { hintShown = !!localStorage.getItem(HINT_KEY); } catch {}
  function showHint() {
    if (hintShown) return;
    hintEl.replaceChildren(
      h('span', {}, h('b', {}, 'Drag'), ' to ripple · ', h('b', {}, 'right-drag'), ' to turn the camera · ', h('b', {}, 'scroll'), ' to zoom · ', h('b', {}, 'C'), ' for the cinematic camera.'),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', html: icon('x'), onclick: dismissHint }));
    hintEl.hidden = false;
  }
  function dismissHint() {
    if (hintEl.hidden) return;
    hintEl.hidden = true;
    hintShown = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch {}
  }

  // ---------------------------------------------------------------- live bits
  let recTick = 0;
  function tick(dt) {
    if (meters) {
      const a = app.audio;
      meters.bass.fill.style.width = `${a.bass * 100}%`;
      meters.mid.fill.style.width = `${a.mid * 100}%`;
      meters.high.fill.style.width = `${a.high * 100}%`;
    }
    if (app.recording && (recTick += dt) > 0.5) {
      recTick = 0;
      const el = actionsEl.querySelector('.rec-time');
      const s = Math.floor((performance.now() - app.recordStart) / 1000);
      if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  function lookEdited(full = false) {
    renderName();
    if (resetBtn) resetBtn.disabled = !app.isEdited(app.lookId);
    if (full && tab === 'tweak') renderBody();
    if (tab === 'looks') {
      const on = body.querySelector('.card.on span');
      if (on && !on.querySelector('.dot') && app.isEdited(app.lookId)) on.append(h('i', { class: 'dot' }));
    }
  }

  applyView();
  renderTop();
  renderTabs();
  renderBody();
  renderDock();
  renderNow();
  showHint();

  return {
    toast, renderDock, renderExplore, dismissHint, setView, tick, openTab,
    get tab() { return tab; },
    refresh() { renderTop(); renderTabs(); renderBody(); renderDock(); },
    refreshTop: renderTop,
    lookChanged() { renderName(); if (tab === 'looks' || tab === 'tweak') renderBody(); },
    lookEdited,
    soundChanged() { renderNow(); if (tab === 'sound') renderBody(); },
    addsChanged() { renderDock(); if (tab === 'add') renderBody(); },
    cinemaChanged() { renderDock(); if (tab === 'tweak') renderBody(); },
    viewChanged() { if (tab === 'tweak') viewRows.forEach(r => r.isConnected && r.sync()); },
  };
}
