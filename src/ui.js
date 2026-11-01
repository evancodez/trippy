// All the DOM: top bar, side panel, tool dock, toasts.
// The panel has three modes — Patterns (flat op-art: Presets / Build / Math / Sound), Worlds (the 3D film
// engine, live) and Films (music videos). Sliders write straight into the state; anything that changes
// structure re-renders the open view.
import { PATTERNS, WARPS, PALETTES, PATTERN_BY_ID, WARP_BY_ID, MAX_INKS, MIX_MODES } from './catalog.js';
import { PPP_FILM } from './film/ppp.js';
import { LOOKS, LOOK_CATS } from './film/looks.js';
import { PARAMS, PARAM_BY_NAME, rgbToHex } from './film/params.js';
import { MACROS } from './macros.js';
import { FONTS } from './media.js';
import { PRESETS, FORMULA_PRESETS, BLOCKS } from './presets.js';
import { RANGES, DEFAULTS, warpDefaults } from './state.js';
import { VARIABLES, FUNCTION_HELP, formatNumber } from './formula.js';
import { MAX_WARPS } from './shaders.js';
import { icon } from './icons.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const TOOLS = [
  { id: 'move', icon: 'move', name: 'Move', modes: ['patterns'], tip: 'Drag to slide the pattern around · scroll to zoom · double-click to recenter' },
  { id: 'hand', icon: 'hand', name: 'Hand', modes: ['worlds'], tip: 'Your cursor is a hand pressing through the fabric from behind — hold to push and grab' },
  { id: 'ripple', icon: 'ripple', name: 'Ripple', tip: 'Click or drag to drop ripples, like a stone in a pond' },
  { id: 'smear', icon: 'smear', name: 'Smear', tip: 'Drag to push the pattern like wet paint — it slowly springs back' },
  { id: 'bulge', icon: 'bulge', name: 'Bulge', tip: 'Hold down to puff it up under your cursor' },
  { id: 'pinch', icon: 'pinch', name: 'Pinch', tip: 'Hold down to suck it inward' },
  { id: 'twist', icon: 'twist', name: 'Twist', tip: 'Hold and wiggle to wind it up' },
];

export function createUI(app) {
  const body = document.getElementById('panelBody');
  const tabsEl = document.getElementById('tabs');
  const actionsEl = document.getElementById('actions');
  const dock = document.getElementById('dock');
  const toastEl = document.getElementById('toast');
  const nameEl = document.getElementById('presetName');
  const hintEl = document.getElementById('hint');
  let tab = 'presets';
  let meters = null;
  let runEls = null;
  let toastTimer = 0;

  // ---------------------------------------------------------------- building blocks
  function slider(label, { min, max, step = 0.01, get, set, fmt = fmt2, reset, hint, mod, modStore }) {
    const input = h('input', { type: 'range', min, max, step, 'aria-label': typeof label === 'string' ? label : null });
    const out = h('output');
    const paint = () => {
      const v = +input.value;
      out.textContent = fmt(v);
      input.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
    };
    input.value = get();
    input.addEventListener('input', () => { set(+input.value); paint(); });
    const top = h('div', { class: 'slider-top' }, h('span', { class: 'slider-label' }, label), out);
    const row = h('div', { class: 'slider', title: hint || (reset ? 'Double-click to reset' : null) }, top, input);
    if (reset) row.addEventListener('dblclick', e => { if (e.target.closest('.modrow, .mod-btn')) return; input.value = reset(); set(+input.value); paint(); });
    if (mod) attachMod(row, top, mod, modStore);
    row.sync = () => { input.value = get(); paint(); };
    paint();
    return row;
  }

  // ∿ — tie a slider to the music: a source (bass, beat, bar…) and a depth.
  // A store is where the ties live: Patterns' sliders or Worlds' film values.
  const MOD_LABELS = { bass: 'Bass', mid: 'Mids', high: 'Highs', loud: 'Loudness', beat: 'Beat', bar: 'Bar sway', slow: 'Slow wave' };
  const patternMods = { list: () => app.mods, set: (k, src) => app.setMod(k, src) };
  const worldMods = { list: () => app.worldMods, set: (k, src) => { app.setWorldMod(k, src); renderRoutes(); } };
  function attachMod(row, top, key, store = patternMods) {
    const btn = h('button', { class: 'mod-btn', 'aria-label': 'Follow the music', 'data-tip': 'Follow the music', html: '∿' });
    top.insertBefore(btn, top.lastChild);
    let open = false, panel = null;
    const paint = () => {
      const m = store.list()[key];
      row.classList.toggle('modded', !!m);
      btn.textContent = m ? `∿ ${MOD_LABELS[m.src]}` : '∿';
    };
    const build = () => {
      const m = store.list()[key];
      panel = h('div', { class: 'modrow' },
        h('div', { class: 'chips' },
          h('button', { class: `chip${!m ? ' on' : ''}`, onclick: () => { store.set(key, null); rebuild(); } }, 'Off'),
          Object.entries(MOD_LABELS).map(([src, name]) => h('button', { class: `chip${m?.src === src ? ' on' : ''}`, onclick: () => { store.set(key, src); rebuild(); } }, name))),
        m ? slider('Depth (− flips it)', { min: -1, max: 1, get: () => store.list()[key]?.amt ?? 0.4, set: v => { if (store.list()[key]) store.list()[key].amt = v; } }) : null);
      row.append(panel);
    };
    const rebuild = () => { panel?.remove(); panel = null; if (open) build(); paint(); };
    btn.addEventListener('click', e => { e.stopPropagation(); open = !open; rebuild(); });
    paint();
  }

  function stateSlider(key, label, opts = {}) {
    return slider(label, {
      mod: RANGES[key] && !['angle', 'rotate', 'mixAngle', 'speed'].includes(key) ? key : null,
      ...RANGES[key], ...opts,
      get: () => app.state[key],
      set: v => { app.state[key] = v; app.touch(); opts.after?.(v); },
      reset: () => app.base?.[key] ?? DEFAULTS[key],
    });
  }

  function toggle(label, get, set) {
    const btn = h('button', { class: 'toggle', role: 'switch' }, h('span', { class: 'switch' }), h('span', {}, label));
    const paint = () => { btn.classList.toggle('on', !!get()); btn.setAttribute('aria-checked', String(!!get())); };
    btn.addEventListener('click', () => { set(!get()); paint(); });
    paint();
    return btn;
  }

  const iconBtn = (name, tip, onclick, disabled) =>
    h('button', { class: 'icon-btn', 'data-tip': tip, 'aria-label': tip, onclick, disabled, html: icon(name) });

  const section = (title, sub, ...kids) =>
    h('section', { class: 'sec' }, h('div', { class: 'sec-head' }, h('h3', {}, title), sub ? h('small', {}, sub) : null), ...kids);

  const thumbImg = (kind, id, cls = '') =>
    h('img', { class: `thumb ${cls}`, src: app.thumbs[kind][id] || BLANK, 'data-thumb': `${kind}:${id}`, alt: '', loading: 'lazy' });

  // ---------------------------------------------------------------- top bar
  const ACTIONS = [
    { id: 'undo', icon: 'undo', tip: 'Undo (Z)', run: () => app.undo() },
    { id: 'reset', icon: 'reset', tip: 'Reset to the base mode (R)', run: () => app.reset() },
    { id: 'mutate', icon: 'sparkle', tip: 'Nudge everything a little (M)', run: () => app.mutate(), text: 'Mutate' },
    { id: 'surprise', icon: 'dice', tip: 'Brand-new random look (D)', run: () => app.surprise(), text: 'Surprise' },
    { id: 'explore', icon: 'grid', tip: 'Breed it: 8 variations, pick one, repeat (E)', run: () => app.exploreOpen(), text: 'Explore' },
    'sep',
    { id: 'pause', icon: () => (app.paused ? 'play' : 'pause'), tip: 'Pause / play (Space)', run: () => app.togglePause() },
    { id: 'snap', icon: 'camera', tip: 'Save a picture (S)', run: () => app.snapshot() },
    { id: 'rec', icon: 'record', tip: 'Record a video clip', run: () => app.toggleRecord() },
    { id: 'share', icon: 'link', tip: 'Copy a link to this exact look', run: () => app.share() },
    { id: 'full', icon: 'expand', tip: 'Fullscreen (F)', run: () => app.toggleFullscreen() },
    { id: 'panel', icon: 'panel', tip: 'Show / hide the menu', run: () => togglePanel() },
    { id: 'view', icon: 'eye', tip: 'Choose what’s on screen (H hides everything)', run: e => toggleViewMenu(e.currentTarget) },
  ];

  // ---------------------------------------------------------------- what's on screen
  const VIEW_KEY = 'trippy.view.v1';
  const VIEW_ITEMS = [['topbar', 'Top bar'], ['panel', 'Side panel'], ['dock', 'Tool dock'], ['ring', 'Brush ring (cursor circle)'], ['name', 'Preset name'], ['hint', 'Tips']];
  const view = { topbar: true, panel: true, dock: true, ring: true, name: true, hint: true };
  try { Object.assign(view, JSON.parse(localStorage.getItem(VIEW_KEY) || '{}')); } catch {}
  function applyView(save = true) {
    const b = document.body.classList;
    b.toggle('no-topbar', !view.topbar);
    b.toggle('panel-closed', !view.panel);
    b.toggle('no-dock', !view.dock);
    b.toggle('no-ring', !view.ring);
    b.toggle('no-name', !view.name);
    b.toggle('no-hint', !view.hint);
    if (save) try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {}
  }
  function setView(k, v) {
    view[k] = v;
    applyView();
    if (k === 'ring') renderDock();
  }
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

  function renderTop() {
    actionsEl.replaceChildren(...ACTIONS.map(a => {
      if (a === 'sep') return h('span', { class: 'sep' });
      const ic = typeof a.icon === 'function' ? a.icon() : a.icon;
      const b = h('button', {
        class: `act act-${a.id}${a.text ? ' has-text' : ''}${a.id === 'rec' && app.recording ? ' live' : ''}`,
        'data-tip': a.tip, 'aria-label': a.tip, onclick: a.run,
        html: icon(ic) + (a.text ? `<span>${a.text}</span>` : '') + (a.id === 'rec' && app.recording ? '<span class="rec-time">0:00</span>' : ''),
      });
      return b;
    }));
    renderName();
  }

  function renderName() {
    nameEl.textContent = app.presetName || 'Custom';
    nameEl.classList.toggle('dirty', !!app.dirty);
  }

  function togglePanel(closed) {
    setView('panel', closed == null ? !view.panel : !closed);
  }

  // ---------------------------------------------------------------- tool dock
  function renderDock() {
    const list = TOOLS.filter(t => !t.modes || t.modes.includes(app.mode));
    if (!list.some(t => t.id === app.tool)) app.tool = list[0].id;
    const tools = h('div', { class: 'tools' }, list.map((t, i) =>
      h('button', {
        class: `tool${app.tool === t.id ? ' on' : ''}`, 'data-tip': `${t.tip} (${i + 1})`, 'aria-label': t.name,
        onclick: () => app.setTool(t.id),
        html: `${icon(t.icon)}<span>${t.name}</span>`,
      })));
    const b = app.brush;
    const mini = (label, key, min, max) => {
      const s = slider(label, { min, max, get: () => b[key], set: v => { b[key] = v; } });
      s.classList.add('mini');
      return s;
    };
    const opts = h('div', { class: 'tool-opts' },
      mini('Size', 'size', 0.04, 0.5),
      mini('Strength', 'strength', 0.1, 1),
      ['ripple', 'move', 'hand'].includes(app.tool) ? null : mini('Spring back', 'spring', 0, 1),
      h('button', {
        class: `icon-btn${view.ring ? ' on' : ''}`, 'data-tip': view.ring ? 'Hide the brush ring' : 'Show the brush ring',
        'aria-label': 'Brush ring', html: icon(view.ring ? 'ring' : 'ringOff'), onclick: () => setView('ring', !view.ring),
      }),
      iconBtn('wipe', 'Smooth out all brush marks', () => app.clearDistortion()));
    dock.replaceChildren(tools, opts);
  }

  // ---------------------------------------------------------------- tabs
  const MODES = [
    { id: 'patterns', name: 'Patterns', blurb: 'flat op-art' },
    { id: 'worlds', name: 'Worlds', blurb: '3D & morphing' },
    { id: 'films', name: 'Films', blurb: 'music videos' },
  ];
  const TABS = [
    { id: 'presets', name: 'Presets' },
    { id: 'play', name: 'Build' },
    { id: 'smart', name: 'Math' },
    { id: 'sound', name: 'Sound' },
  ];

  function renderTabs() {
    const modes = h('div', { class: 'modes' }, MODES.map(m =>
      h('button', { class: `mode${app.mode === m.id ? ' on' : ''}`, onclick: () => app.setMode(m.id) }, h('b', {}, m.name), h('small', {}, m.blurb))));
    const sub = app.mode === 'patterns'
      ? h('div', { class: 'tabs-row' }, TABS.map(t => h('button', { class: `tab${tab === t.id ? ' on' : ''}`, onclick: () => setTab(t.id) }, t.name)))
      : null;
    tabsEl.replaceChildren(modes, sub || '');
  }

  function setTab(id) {
    tab = id;
    renderTabs();
    renderBody();
    body.scrollTop = 0;
  }

  function renderBody() {
    const keep = body.scrollTop;
    meters = null;
    runEls = null;
    const view = app.mode === 'worlds' ? renderWorlds()
      : app.mode === 'films' ? renderFilms()
        : { presets: renderPresets, play: renderPlay, smart: renderSmart, sound: renderSound }[tab]();
    body.replaceChildren(...[view].flat(3).filter(Boolean));
    body.scrollTop = keep;
  }

  // ---------------------------------------------------------------- Presets tab
  function renderPresets() {
    const cards = h('div', { class: 'cards' }, PRESETS.map(p =>
      h('button', { class: `card${app.presetId === p.id ? ' on' : ''}`, onclick: () => { app.loadPreset(p.id); } },
        thumbImg('presets', p.id), h('span', {}, p.name))));

    const saves = app.saves.length
      ? h('div', { class: 'cards' }, app.saves.map(sv =>
        h('div', { class: `card save${app.presetId === `save:${sv.id}` ? ' on' : ''}` },
          h('button', { class: 'card-hit', onclick: () => app.loadSave(sv.id) },
            h('img', { class: 'thumb', src: sv.thumb || BLANK, alt: '' }), h('span', {}, sv.name)),
          h('button', { class: 'card-x', 'aria-label': `Delete ${sv.name}`, html: icon('x'), onclick: () => { app.deleteSave(sv.id); renderBody(); } }))))
      : h('p', { class: 'muted small' }, 'Nothing saved yet. Saves live in this browser only.');

    return [
      knobStrip('patterns'),
      h('p', { class: 'lead' }, 'Pick a starting point. Then drag on it, try the tools at the bottom, hit ', h('b', {}, 'Mutate'), ', or breed it with ', h('b', {}, 'Explore'), '.'),
      cards,
      section('Your saves', null,
        h('button', { class: 'btn wide', html: `${icon('save')}<span>Save the current look</span>`, onclick: () => promptSave() }),
        saves),
      h('p', { class: 'muted small keys' }, keysHelp()),
    ];
  }

  function promptSave() {
    const name = prompt('Name this look:', app.presetName ? `${app.presetName} remix` : 'My look');
    if (!name) return;
    app.saveCurrent(name.slice(0, 40), () => { if (tab === 'presets') renderBody(); });
  }

  const keysHelp = () => h('span', { html:
    '<b>Keys</b> · <kbd>Space</kbd> pause · <kbd>M</kbd> mutate · <kbd>D</kbd> surprise · <kbd>R</kbd> reset · <kbd>Z</kbd> undo · ' +
    '<kbd>1</kbd>–<kbd>6</kbd> tools · <kbd>[</kbd> <kbd>]</kbd> brush size · <kbd>←</kbd> <kbd>→</kbd> presets · <kbd>S</kbd> picture · <kbd>H</kbd> hide · <kbd>F</kbd> fullscreen' });

  // ---------------------------------------------------------------- Freeplay tab
  function recipeHTML(s) {
    const pat = PATTERN_BY_ID[s.pattern];
    const start = s.pattern === 'formula' ? `your formula <code>${esc(s.formula)}</code>` : `<b>${pat.blurb}</b>`;
    const steps = s.warps.filter(w => w.on).map(w => `<b>${WARP_BY_ID[w.type].verb(w)}</b>`);
    const pal = PALETTES.find(p => p.paper === s.paper && p.inks.join() === s.inks.join());
    const colors = pal ? pal.name : `${s.inks.length > 1 ? `${s.inks.length} custom inks` : 'custom colors'}`;
    return `Take ${start}${steps.length ? `, then ${steps.join(', then ')}` : ''}. Colors: <b>${esc(colors)}</b>.`;
  }

  function renderPlay() {
    const s = app.state;
    const recipe = h('div', { class: 'recipe', html: recipeHTML(s) });
    const refreshRecipe = () => { recipe.innerHTML = recipeHTML(s); };
    const pat = PATTERN_BY_ID[s.pattern];

    const patterns = h('div', { class: 'pats' }, PATTERNS.map(p =>
      h('button', {
        class: `pat${s.pattern === p.id ? ' on' : ''}`,
        onclick: () => {
          if (p.id === 'formula') { app.setPattern('formula'); setTab('smart'); return; }
          app.setPattern(p.id);
          renderBody();
        },
      }, thumbImg('patterns', p.id), h('span', {}, p.name))));

    const patSliders = [
      stateSlider('density', 'Density', { fmt: v => v.toFixed(1) }),
      stateSlider('thickness', 'Ink thickness'),
      slider(pat.param.label, {
        min: 0, max: 1, fmt: pat.param.fmt || fmt2,
        get: () => s.param, set: v => { s.param = v; app.touch(); }, reset: () => pat.param.def,
      }),
      stateSlider('angle', 'Angle', { fmt: v => `${Math.round(v)}°` }),
      stateSlider('flow', 'Flow (pattern drifts)'),
    ];

    // warps
    const warps = h('div', { class: 'warps' }, s.warps.map((w, i) => warpCard(w, i, refreshRecipe)));
    const addMenu = h('div', { class: 'add-menu', hidden: true }, WARPS.map(w =>
      h('button', {
        class: 'add-item',
        onclick: () => {
          if (s.warps.length >= MAX_WARPS) return toast(`Max ${MAX_WARPS} warps — remove one first`);
          s.warps.push(warpDefaults(w.id));
          app.touch();
          renderBody();
        },
      }, thumbImg('warps', w.id), h('span', {}, h('b', {}, w.name), h('small', {}, w.blurb)))));
    const addBtn = h('button', {
      class: 'btn wide', html: `${icon('plus')}<span>Add a warp</span>`,
      onclick: () => { addMenu.hidden = !addMenu.hidden; },
    });

    const palettes = h('div', { class: 'palettes' }, PALETTES.map(p => {
      const on = p.paper === s.paper && p.inks.join() === s.inks.join();
      const stripes = p.inks.map((c, i) => `${c} ${(i / p.inks.length) * 100}% ${((i + 1) / p.inks.length) * 100}%`).join(',');
      return h('button', {
        class: `swatch${on ? ' on' : ''}`, 'data-tip': p.name, 'aria-label': p.name,
        style: `--paper:${p.paper};--inks:linear-gradient(90deg,${stripes})`,
        onclick: () => { s.paper = p.paper; s.inks = [...p.inks]; app.touch(); renderBody(); },
      });
    }));

    const colorInput = (get, set, label) => {
      const inp = h('input', { type: 'color', value: get(), 'aria-label': label });
      inp.addEventListener('input', () => { set(inp.value); app.touch(); refreshRecipe(); });
      inp.addEventListener('change', () => renderBody());
      return h('label', { class: 'color' }, inp, h('span', {}, label));
    };
    const colorRow = h('div', { class: 'color-row' },
      colorInput(() => s.paper, v => { s.paper = v; }, 'Paper'),
      s.inks.map((c, i) => colorInput(() => s.inks[i], v => { s.inks[i] = v; }, s.inks.length > 1 ? `Ink ${i + 1}` : 'Ink')),
      s.inks.length < MAX_INKS ? iconBtn('plus', 'Add an ink color (stripes take turns)', () => {
        s.inks.push(['#e2463a', '#1f6fb2', '#2f9a5f', '#ffcf26', '#7b5cff'][s.inks.length % 5]);
        app.touch(); renderBody();
      }) : null,
      s.inks.length > 1 ? iconBtn('minus', 'Remove last ink', () => { s.inks.pop(); app.touch(); renderBody(); }) : null);

    const mixChips = h('div', { class: 'chips' }, MIX_MODES.map(m =>
      h('button', {
        class: `chip${s.mixMode === m.id ? ' on' : ''}`, 'data-tip': m.blurb || null,
        onclick: () => { s.mixMode = m.id; app.touch(); renderBody(); },
      }, m.name)));
    const layer2 = s.mixMode === 'off'
      ? [h('p', { class: 'muted small' }, 'Overlay a second pattern. Try XOR with two stripe sets a few degrees apart — instant moiré. “Inside 3D” paints it onto spheres and ghost faces.')]
      : [
        h('div', { class: 'pats' }, PATTERNS.filter(p => p.id !== 'formula').map(p =>
          h('button', {
            class: `pat${s.mixPattern === p.id ? ' on' : ''}`,
            onclick: () => { s.mixPattern = p.id; s.mixParam = p.param.def; app.touch(); renderBody(); },
          }, thumbImg('patterns', p.id), h('span', {}, p.name)))),
        stateSlider('mixDensity', 'Density', { fmt: v => v.toFixed(1) }),
        stateSlider('mixAngle', 'Angle', { fmt: v => `${v.toFixed(1)}°` }),
        stateSlider('mixParam', PATTERN_BY_ID[s.mixPattern].param.label),
        stateSlider('mixFlow', 'Flow'),
        toggle('Stay flat (ignore the warps)', () => s.mixFlat, v => { s.mixFlat = v; app.touch(); }),
      ];

    return [
      knobStrip('patterns'),
      recipe,
      section('Pattern', 'the thing being warped', patterns, ...patSliders),
      section('Warps', 'applied top → bottom', warps,
        s.warps.length ? null : h('p', { class: 'muted small' }, 'No warps — the pattern is flat. Add one!'),
        addBtn, addMenu),
      section('Layer 2', 'merge a second pattern', mixChips, ...layer2),
      section('Motion', null,
        stateSlider('speed', 'Speed'),
        stateSlider('zoom', 'Zoom'),
        stateSlider('spin', 'Spin'),
        stateSlider('rotate', 'Rotate', { fmt: v => `${Math.round(v)}°` }),
        toggle('Center follows the mouse', () => s.follow, v => { s.follow = v; app.touch(); })),
      section('3D look', 'the illusion lives here',
        stateSlider('depth', '3D depth shading', { hint: 'Where the pattern is squeezed it fades into shadow, like it is far away' }),
        stateSlider('relief', 'Chrome relief', { hint: 'Lights the ink like raised, shiny metal' }),
        stateSlider('soft', 'Softness'),
        stateSlider('echo', 'Echo trails'),
        toggle('Invert', () => s.invert, v => { s.invert = v; app.touch(); })),
      section('Film look', 'post effects',
        stateSlider('glow', 'Halation glow', { hint: 'Bright areas bleed a soft colored glow, like old film' }),
        h('div', { class: 'color-row' },
          colorInput(() => s.glowColor, v => { s.glowColor = v; }, 'Glow color'),
          colorInput(() => s.fog, v => { s.fog = v; }, 'Shadow / fog color')),
        stateSlider('aberr', 'Color split'),
        stateSlider('flicker', 'Flicker'),
        stateSlider('weave', 'Gate weave'),
        stateSlider('letterbox', 'Letterbox'),
        stateSlider('grain', 'Film grain'),
        stateSlider('vignette', 'Vignette')),
      section('Color', 'black & white by default', palettes, colorRow,
        s.inks.length > 1 ? stateSlider('cycle', 'Color cycling') : h('p', { class: 'muted small' }, 'Add a second ink and the stripes take turns. Then try color cycling.')),
    ];
  }

  function warpCard(w, i, refreshRecipe) {
    const s = app.state;
    const meta = WARP_BY_ID[w.type];
    const sliders = ['amount', 'scale', 'speed', 'extra'].filter(k => meta.params[k]).map(k => {
      const p = meta.params[k];
      return slider(p.label, {
        min: p.min, max: p.max, mod: k === 'speed' ? null : `w${i}.${k}`,
        get: () => w[k], set: v => { w[k] = v; app.touch(); if (k === 'amount' || k === 'speed') refreshRecipe(); },
        reset: () => p.def,
      });
    });
    const move = d => { const [x] = s.warps.splice(i, 1); s.warps.splice(i + d, 0, x); app.touch(); renderBody(); };
    const onBtn = h('button', {
      class: `toggle tiny${w.on ? ' on' : ''}`, 'data-tip': w.on ? 'Turn off' : 'Turn on', 'aria-label': 'On/off',
      onclick: () => { w.on = !w.on; app.touch(); renderBody(); },
    }, h('span', { class: 'switch' }));
    return h('div', { class: `warp${w.on ? '' : ' off'}` },
      h('div', { class: 'warp-head' },
        thumbImg('warps', w.type, 'warp-thumb'),
        h('div', { class: 'warp-title' }, h('b', {}, meta.name), h('small', {}, meta.blurb)),
        h('div', { class: 'warp-btns' },
          iconBtn('up', 'Move up', () => move(-1), i === 0),
          iconBtn('down', 'Move down', () => move(1), i === s.warps.length - 1),
          onBtn,
          iconBtn('x', 'Remove', () => { s.warps.splice(i, 1); app.touch(); renderBody(); }))),
      h('div', { class: 'warp-body' }, sliders));
  }

  // ---------------------------------------------------------------- Smart tab
  function renderSmart() {
    const s = app.state;
    const isFormula = s.pattern === 'formula';
    const match = FORMULA_PRESETS.find(f => f.formula === s.formula && (f.bendX || '0') === s.bendX && (f.bendY || '0') === s.bendY);

    const recipes = h('div', { class: 'chips' }, FORMULA_PRESETS.map(f =>
      h('button', { class: `chip${isFormula && match === f ? ' on' : ''}`, onclick: () => { app.applyFormulaPreset(f); renderBody(); } }, f.name)));

    const why = h('div', { class: 'why' }, match ? match.why : 'Your own recipe. Every number in it has a knob below.');

    const ta = h('textarea', { class: 'code', rows: 3, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Formula' });
    ta.value = s.formula;
    const err = h('div', { class: 'err' });
    const knobs = h('div', { class: 'knobs' });
    const explain = h('ul', { class: 'explain' });
    const bx = h('input', { type: 'text', class: 'code', value: s.bendX, spellcheck: 'false', 'aria-label': 'Bend x by' });
    const by = h('input', { type: 'text', class: 'code', value: s.bendY, spellcheck: 'false', 'aria-label': 'Bend y by' });
    const fieldEls = { formula: ta, bendX: bx, bendY: by };

    const showStatus = () => {
      const e = app.formulaError;
      err.textContent = e ? `${e.field === 'value' ? '' : e.field === 'bendX' ? 'Bend x: ' : 'Bend y: '}${e.message}` : '';
      err.classList.toggle('show', !!e);
      ta.classList.toggle('bad', !!e && e.field === 'value');
      bx.classList.toggle('bad', !!e && e.field === 'bendX');
      by.classList.toggle('bad', !!e && e.field === 'bendY');
    };

    const renderKnobs = () => {
      const c = app.compiled;
      knobs.replaceChildren();
      const shown = c ? c.nums.filter(n => !(n.field !== 'value' && c.sources[n.field].trim() === '0')) : [];
      if (!shown.length) {
        knobs.append(h('p', { class: 'muted small' }, 'No numbers in this formula yet — type one (like ', h('code', {}, 'sin(x*d*2)'), ') and it gets a knob.'));
        return;
      }
      c.nums.forEach((n, i) => {
        if (!shown.includes(n)) return;
        const src = c.sources[n.field];
        const label = h('span', { class: 'knob-label', html:
          `${n.field !== 'value' ? `<i>${n.field === 'bendX' ? 'bend x' : 'bend y'}</i> ` : ''}` +
          `${n.s > 10 ? '…' : ''}${esc(src.slice(Math.max(0, n.s - 10), n.s))}<b>${esc(src.slice(n.s, n.e))}</b>${esc(src.slice(n.e, n.e + 8))}${n.e + 8 < src.length ? '…' : ''}` });
        const max = n.v === 0 ? 1 : Math.abs(n.v) * 2.5;
        knobs.append(slider(label, {
          min: 0, max, step: max / 500, fmt: formatNumber,
          get: () => n.v,
          set: v => {
            const r = app.setFormulaNumber(i, v);
            if (r) fieldEls[r.key].value = r.text;
            refreshExplain();
          },
        }));
      });
    };

    const refreshExplain = () => {
      const used = app.compiled?.used || new Set();
      const items = Object.entries(VARIABLES).filter(([k]) => used.has(k)).map(([k, v]) => h('li', {}, h('code', {}, k), ` — ${v}`));
      if (used.has('noise') || used.has('fbm')) items.push(h('li', {}, h('code', {}, 'noise'), ' — smooth random blobs'));
      if (!isFormulaNow()) items.unshift(h('li', { class: 'muted' }, 'Formula mode is off — pick a recipe or type to turn it on.'));
      explain.replaceChildren(...items);
    };
    const isFormulaNow = () => app.state.pattern === 'formula';

    let lastShape = app.renderer.formulaKey;
    let timer = 0;
    const onEdit = (key, el) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!isFormulaNow()) { app.setPattern('formula'); banner.remove(); }
        app.setFormulaText(key, el.value);
        showStatus();
        if (!app.formulaError) {
          if (app.renderer.formulaKey !== lastShape) { lastShape = app.renderer.formulaKey; renderKnobs(); }
          refreshExplain();
          why.textContent = 'Your own recipe. Every number in it has a knob below.';
        }
      }, 140);
    };
    ta.addEventListener('input', () => onEdit('formula', ta));
    bx.addEventListener('input', () => onEdit('bendX', bx));
    by.addEventListener('input', () => onEdit('bendY', by));

    const insert = blk => {
      const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
      const mid = blk.close ? ta.value.slice(a, b) : '';
      ta.value = ta.value.slice(0, a) + blk.text + mid + (blk.close || '') + ta.value.slice(b);
      const caret = a + blk.text.length + mid.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
      onEdit('formula', ta);
    };

    const banner = isFormula ? h('span') : h('div', { class: 'banner' },
      h('span', {}, `You're looking at the built-in “${PATTERN_BY_ID[s.pattern].name}” pattern. Pick a recipe or start typing to switch to formula mode.`),
      h('button', { class: 'btn', onclick: () => { app.setPattern('formula'); renderBody(); } }, 'Use formula'));

    showStatus();
    renderKnobs();
    refreshExplain();

    return [
      h('div', { class: 'lead', html:
        'Every pixel plugs its position into your formula and gets a number back. <b>Above zero → ink. Below zero → paper.</b> ' +
        'Sine waves make stripes; bending the inputs makes the warps.' }),
      banner,
      section('Recipes', 'tap one, then tweak', recipes, why),
      section('Formula', null, ta, err,
        h('div', { class: 'chips blocks' }, h('span', { class: 'muted small' }, 'Insert:'), BLOCKS.map(b => h('button', { class: 'chip ghost', onclick: () => insert(b) }, b.label)))),
      section('Number knobs', 'every number gets one', knobs),
      section('Built-in knobs', null,
        stateSlider('density', 'd · Density', { fmt: v => v.toFixed(1) }),
        slider('k · magic knob', { min: 0, max: 1, get: () => app.state.param, set: v => { app.state.param = v; app.touch(); }, reset: () => 0.5 })),
      section("What's in your formula", null, explain),
      h('details', { class: 'sec details' },
        h('summary', {}, 'Bend space (advanced)'),
        h('p', { class: 'muted small' }, 'Push every point sideways before it is drawn. Try ', h('code', {}, '0.2*sin(y*4 + t)'), '.'),
        h('label', { class: 'field' }, h('span', {}, 'Move x by'), bx),
        h('label', { class: 'field' }, h('span', {}, 'Move y by'), by)),
      h('details', { class: 'sec details' },
        h('summary', {}, 'Cheat sheet'),
        h('ul', { class: 'explain' }, Object.entries(VARIABLES).map(([k, v]) => h('li', {}, h('code', {}, k), ` — ${v}`))),
        h('ul', { class: 'explain' }, Object.entries(FUNCTION_HELP).map(([k, v]) => h('li', {}, h('code', {}, k), ` — ${v}`))),
        h('p', { class: 'muted small' }, 'Also: pi, ^ for powers, % for remainder. “2x” means 2*x. Warps from Freeplay still apply on top of formulas.')),
    ];
  }

  // ---------------------------------------------------------------- Sound tab
  function renderSound() {
    const a = app.audio;
    const cfg = app.audioCfg;

    const bar = label => {
      const fill = h('i');
      const el = h('div', { class: 'meter' }, h('span', {}, label), h('div', { class: 'meter-bar' }, fill));
      el.fill = fill;
      return el;
    };
    meters = { bass: bar('Bass'), mid: bar('Mids'), high: bar('Highs'), beat: h('div', { class: 'beat' }, 'BEAT') };

    const cfgSlider = (key, label, hint, max = 1) => slider(label, { min: 0, max, get: () => cfg[key], set: v => { cfg[key] = v; }, hint });

    return [
      h('p', { class: 'lead' }, 'Make the pattern dance. Songs stay on your computer — nothing gets uploaded. The same song keeps playing in Worlds.'),
      songsBlock(),
      a.mode === 'file' ? h('button', { class: 'btn wide primary', html: `${icon('film')}<span>Make a music video from this song</span>`, onclick: () => app.autoFromCurrentSong() }) : null,
      section('How hard it hits', 'Patterns and Worlds', reactivityBlock()),
      section('What reacts', null,
        cfgSlider('wave', 'Sound wave', 'Like an oscilloscope: the live waveform bends the pattern across the screen', 2),
        cfgSlider('spectrum', 'Spectrum spikes', 'Bass to treble around the circle; the last few seconds ripple outward', 2),
        cfgSlider('pulse', 'Bass → zoom thump'),
        cfgSlider('ripples', 'Beats → ripples'),
        cfgSlider('intensity', 'Loudness → intensity', 'Louder music pushes the warps harder (not faster)'),
        cfgSlider('wobble', 'Mids → wobble')),
      section('Levels', null, h('div', { class: 'meters' }, meters.bass, meters.mid, meters.high, meters.beat)),
      section('Tempo', 'drives the bar-synced ∿ sources', tempoControls()),
      h('p', { class: 'muted small' }, 'Any slider in Build can follow the music too: click its ', h('b', {}, '∿'), '. Formulas can use ', h('code', {}, 'bass'), ', ', h('code', {}, 'mid'), ' and ', h('code', {}, 'high'), '.'),
    ];
  }

  // ---------------------------------------------------------------- shared: song controls + tempo
  const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function songPicker(label, sub, onFile) {
    const file = h('input', { type: 'file', accept: 'audio/*', hidden: true });
    file.addEventListener('change', () => { if (file.files[0]) onFile(file.files[0]); });
    return [h('button', { class: 'dropzone', onclick: () => file.click() },
      h('span', { html: icon('music') }), h('b', {}, label), h('small', {}, sub)), file];
  }

  // your songs: add (several at once), play any of them, next, the mic. Shared by every mode.
  function songsBlock({ pickLabel = null, mic = true } = {}) {
    const a = app.audio, cur = app.currentSongId();
    const file = h('input', { type: 'file', accept: 'audio/*', multiple: true, hidden: true });
    file.addEventListener('change', () => { if (file.files.length) app.addSongs([...file.files]); });
    const list = app.songs.list;
    return h('div', { class: 'songs' },
      h('div', { class: 'run-actions' },
        h('button', { class: 'dropzone slim', onclick: () => file.click() }, h('span', { html: icon('music') }), h('b', {}, 'Add songs')),
        mic ? h('button', { class: 'btn', html: `${icon('mic')}<span>Mic</span>`, onclick: () => app.useMic() }) : null,
        mic && a.mode !== 'off' ? h('button', { class: 'btn', html: `${icon('stop')}<span>Stop</span>`, onclick: () => app.stopAudio() }) : null),
      file,
      list.length
        ? h('div', { class: 'song-list' }, list.map(sg => h('div', { class: `song${sg.id === cur ? ' on' : ''}` },
          h('button', {
            class: 'song-name', title: pickLabel || 'Play',
            onclick: () => (!pickLabel && sg.id === cur ? (a.togglePlay(), setTimeout(renderBody, 60)) : app.playSongId(sg.id)),
          }, h('span', { html: icon(sg.id === cur && a.playing ? 'pause' : 'play') }), h('span', {}, sg.name)),
          h('button', { class: 'song-x', 'aria-label': `Forget ${sg.name}`, html: icon('x'), onclick: () => app.songs.remove(sg.id) }))))
        : h('p', { class: 'muted small' }, 'Drop songs anywhere on the page (several at once is fine). They stay in this browser so you can flip between them — nothing is uploaded.'));
  }

  // how hard the music hits: one choice for Patterns and Worlds
  function reactivityBlock() {
    return [
      h('div', { class: 'chips' }, Object.entries(app.LEVELS).map(([id, L]) =>
        h('button', { class: `chip${app.reactivity === id ? ' on' : ''}`, onclick: () => { app.setReactivity(id); renderBody(); } }, L.name))),
      h('p', { class: 'muted small' }, app.LEVELS[app.reactivity]?.blurb),
    ];
  }

  // the top bar's now-playing pill
  const nowEl = document.getElementById('nowPlaying');
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

  function tempoControls() {
    const t = app.tempo;
    return h('div', { class: 'tempo' },
      slider(t.fromSong ? 'Tempo (from the song)' : 'Tempo', {
        min: 40, max: 180, step: 0.5, fmt: v => `${v.toFixed(1)} bpm`,
        get: () => t.bpm, set: v => { t.bpm = v; t.fromSong = false; },
      }),
      h('div', { class: 'tempo-row' },
        h('button', { class: 'btn', onclick: e => { const bpm = app.tapTempo(); e.currentTarget.textContent = `Tap · ${bpm}`; } }, 'Tap the beat'),
        h('span', { class: 'muted small' }, 'Beats per bar'),
        [2, 3, 4].map(n => h('button', { class: `chip${t.beatsPerBar === n ? ' on' : ''}`, onclick: () => { t.beatsPerBar = n; renderBody(); } }, String(n)))));
  }

  // ---------------------------------------------------------------- the four big knobs
  function knob(mac, get, set) {
    const R = 22, C = 2 * Math.PI * R * 0.75;
    const svg = h('div', { class: 'knob-dial', html:
      `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="${R}" class="k-track" stroke-dasharray="${C} 999" transform="rotate(135 30 30)"/>` +
      `<circle cx="30" cy="30" r="${R}" class="k-val" transform="rotate(135 30 30)"/><line x1="30" y1="30" x2="30" y2="12" class="k-tick"/></svg>` });
    const val = svg.querySelector('.k-val'), tick = svg.querySelector('.k-tick');
    const paint = () => {
      const x = get();
      val.setAttribute('stroke-dasharray', `${C * x} 999`);
      tick.setAttribute('transform', `rotate(${-135 + x * 270} 30 30)`);
      el.classList.toggle('moved', Math.abs(x - 0.5) > 0.02);
    };
    let start = null;
    svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); start = { y: e.clientY, x: e.clientX, v: get() }; });
    svg.addEventListener('pointermove', e => {
      if (!start) return;
      set(Math.min(1, Math.max(0, start.v + ((start.y - e.clientY) + (e.clientX - start.x)) / 180)));
      paint();
    });
    svg.addEventListener('pointerup', () => { start = null; });
    svg.addEventListener('dblclick', () => { set(0.5); paint(); });
    svg.addEventListener('wheel', e => { e.preventDefault(); set(Math.min(1, Math.max(0, get() - e.deltaY / 800))); paint(); }, { passive: false });
    const el = h('div', { class: 'knob', title: 'Drag up/down · double-click to reset' }, svg,
      h('div', { class: 'knob-labels' }, h('span', {}, mac.left), h('span', {}, mac.right)));
    paint();
    return el;
  }

  function knobStrip(which) {
    const M = app.macros[which];
    const acc = h('input', { type: 'color', value: M.accent, 'aria-label': 'Accent color', 'data-tip': 'The color the Color knob brings in' });
    acc.addEventListener('input', () => { M.accent = acc.value; });
    return h('div', { class: 'knobs-strip' },
      MACROS.map(mac => knob(mac, () => M[mac.id], x => { M[mac.id] = x; })),
      h('label', { class: 'knob-accent' }, acc, h('span', {}, 'accent')));
  }

  // ---------------------------------------------------------------- you: the camera
  const SUBJECTS = [
    ['scene', 'Whole picture'], ['body', 'My body'], ['face', 'My face'], ['hands', 'Hands & what they hold'],
    ['bodyhands', 'Body + what I hold'], ['box', 'A frame I set'], ['motion', 'Movement trails'], ['none', 'Nothing'],
  ];
  function youSection() {
    const tr = app.tracker, y = app.you;
    const st = tr.status;
    const label = { loading: 'loading…', on: 'on', error: 'didn’t load', off: '' };
    const status = ['face', 'hands', 'body'].filter(k => tr.want[k] && st[k] !== 'off').map(k => `${{ face: 'Face tracking', hands: 'Hand tracking', body: 'Body outline' }[k]}: ${label[st[k]]}`).join(' · ');
    const setups = h('div', { class: 'setups' }, app.SETUPS.map(S =>
      h('button', { class: `setup${y.setup === S.id ? ' on' : ''}`, onclick: () => app.quickSetup(S.id) }, h('b', {}, S.name), h('small', {}, S.blurb))));
    const subject = h('div', { class: 'chips' }, SUBJECTS.map(([id, name]) =>
      h('button', { class: `chip${y.subject === id ? ' on' : ''}`, onclick: () => { y.setup = null; app.setYou('subject', id); } }, name)));
    const b = y.box;
    const boxSliders = y.subject === 'box' ? [
      slider('Frame ↔', { min: 0, max: 1, get: () => b.x, set: v => { b.x = v; } }),
      slider('Frame ↕', { min: 0, max: 1, get: () => b.y, set: v => { b.y = v; } }),
      slider('Frame width', { min: 0.1, max: 1, get: () => b.w, set: v => { b.w = v; } }),
      slider('Frame height', { min: 0.1, max: 1, get: () => b.h, set: v => { b.h = v; } }),
    ] : null;
    const masked = ['body', 'face', 'hands', 'bodyhands', 'box'].includes(y.subject);
    return section('You', tr.on ? '● camera on' : 'your camera, right here',
      tr.on
        ? h('button', { class: 'btn wide', html: `${icon('stop')}<span>Turn the camera off</span>`, onclick: () => app.cameraOff() })
        : h('button', { class: 'btn wide primary', html: `${icon('camera')}<span>Turn on the camera</span>`, onclick: () => app.cameraOn() }),
      h('p', { class: 'muted small' }, 'Everything is worked out in this browser — no picture leaves your computer. Trackers download once (a few MB) the first time you use them.'),
      h('div', { class: 'sub-label' }, 'Quick setups'),
      setups,
      tr.on ? [
        h('div', { class: 'sub-label' }, 'What counts as you'),
        subject,
        boxSliders,
        masked ? slider('Edge softness', { min: 0, max: 24, step: 0.5, fmt: v => `${v} px`, get: () => y.feather, set: v => { y.feather = v; } }) : null,
        h('div', { class: 'sub-label' }, 'Extras'),
        toggle('Ghost puppet — the face in the lines copies yours', () => y.puppet, v => app.setYou('puppet', v)),
        toggle('3D hands — they copy yours, finger by finger', () => y.hands, v => app.setYou('hands', v)),
        toggle('Movement makes ripples', () => y.motion, v => app.setYou('motion', v)),
        toggle('Look around — move your head and the 3D shifts', () => y.look, v => app.setYou('look', v)),
        y.hands ? slider('Hand size', { min: 0.4, max: 2.5, get: () => y.handScale, set: v => { y.handScale = v; } }) : null,
      ] : null,
      status ? h('p', { class: 'muted small' }, status) : null);
  }

  // ---------------------------------------------------------------- pictures & words
  function pictureSection() {
    const md = app.media;
    const file = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true });
    file.addEventListener('change', () => { if (file.files[0]) app.loadPicture(file.files[0]); });
    const words = h('textarea', { class: 'code words', rows: 2, placeholder: 'Type words to press through the lines…', spellcheck: 'false' });
    words.value = md.kind === 'text' ? md.text.value : '';
    let timer = 0;
    words.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => app.setWords(words.value, md.text.font), 160); });
    const fonts = h('div', { class: 'chips' }, Object.keys(FONTS).map(f =>
      h('button', { class: `chip${md.text.font === f ? ' on' : ''}`, onclick: () => { md.text.font = f; if (words.value.trim()) app.setWords(words.value, f); renderBody(); } }, f)));
    const what = { none: 'nothing yet', image: `🖼 ${md.name}`, video: `🎞 ${md.name}`, text: '✎ words', camera: '● the camera' }[md.kind];
    return section('Pictures & words', what,
      h('div', { class: 'run-actions' },
        h('button', { class: 'btn', html: `${icon('image')}<span>Image or video</span>`, onclick: () => file.click() }),
        ['image', 'video', 'text'].includes(md.kind) ? h('button', { class: 'btn', html: `${icon('x')}<span>Remove</span>`, onclick: () => app.clearPicture() }) : null),
      file,
      h('p', { class: 'muted small' }, 'Or just drop one anywhere on the page. A picture takes the camera’s place until you remove it.'),
      words, fonts);
  }

  // ---------------------------------------------------------------- how the camera / picture shows
  function showSection() {
    const md = app.media, cfg = app.mediaCfg;
    if (md.kind === 'none') return null;
    const cam = md.kind === 'camera';
    const c = (key, label, min, max, opts = {}) => slider(label, { min, max, step: opts.step || 0.01, fmt: opts.fmt, hint: opts.hint, get: () => cfg[key], set: v => { cfg[key] = v; } });
    return section('How it shows', cam ? 'the camera' : 'your picture',
      c('photo', 'Photo — shown as the picture itself', 0, 1, { hint: 'Clear, like a photo, in the palette’s two colors (or true color)' }),
      cfg.photo > 0 ? toggle('True color (off: in the look’s two colors)', () => cfg.photoColor > 0.5, v => { cfg.photoColor = v ? 1 : 0; }) : null,
      c('amount', 'Relief — pushes the lines up', 0, 3),
      c('ink', 'Engraved — drawn in line thickness', 0, 2),
      cam ? c('detail', 'Detail', 0, 1, { fmt: v => `${Math.round(480 + v * 800)} px`, hint: 'How sharp the camera picture is. Higher is crisper and a little heavier.' }) : null,
      c('soft', 'Smooth the relief', 0, 6),
      h('div', { class: 'sub-label' }, cam ? 'Around you' : 'Around it'),
      toggle(cam ? 'Keep me still — the warps stay outside' : 'Keep it still — the warps stay outside', () => cfg.calm > 0.5, v => { cfg.calm = v ? 1 : 0; }),
      c('aura', 'Aura — the lines ripple off it with the sound', 0, 3),
      h('div', { class: 'sub-label' }, 'Place'),
      c('size', 'Size', 0.2, 3), c('x', 'Move ↔', -1.5, 1.5), c('y', 'Move ↕', -1.5, 1.5),
      c('warp', 'Bend it with the warps', 0, 1),
      toggle('Invert', () => cfg.invert > 0.5, v => { cfg.invert = v ? 1 : 0; }));
  }

  // ---------------------------------------------------------------- explore: breed variations
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
    const locks = app.mode === 'patterns' ? null : h('div', { class: 'chips' }, h('span', { class: 'muted small' }, 'Keep:'),
      Object.keys(X.locks).map(k => h('button', { class: `chip${X.locks[k] ? ' on' : ''}`, onclick: () => { X.locks[k] = !X.locks[k]; renderExplore(); } }, k)));
    exploreEl.replaceChildren(
      h('div', { class: 'ex-head' },
        h('div', {}, h('b', {}, 'Explore'), h('span', { class: 'muted small' }, 'Pick the one you like — it has 8 children. Keep going.')),
        h('div', { class: 'ex-ctrls' },
          slider('Mutation', { min: 0.05, max: 1, get: () => X.strength, set: v => { X.strength = v; }, fmt: v => (v < 0.35 ? 'gentle' : v < 0.7 ? 'medium' : 'wild') }),
          locks,
          iconBtn('undo', 'Back a generation', () => app.exploreBack(), !X.history.length),
          h('button', { class: 'btn primary', onclick: () => app.exploreClose() }, 'Done'))),
      h('div', { class: 'ex-grid' }, grid));
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && app.explore.open) app.exploreClose(); });

  // ---------------------------------------------------------------- Worlds (the film engine, live)
  const WORLD_GROUPS = [
    ['lines', 'Lines', 'the equation: lines, rings, squares, crossings, triangles'],
    ['bend', 'Bend', 'twist, vortex, squeeze, bulge, waves and mirrors'],
    ['shape', 'Shapes', 'folds, orbs, the lattice, the face, hands'],
    ['space', 'Space', 'corridors, fractals and columns to fly through'],
    ['objects', 'Objects', 'the blob, the impossible triangle, the Möbius strip, rings'],
    ['camera', 'Camera', 'lens, zoom and tilt'],
    ['motion', 'Motion', 'speeds, per bar'],
    ['music', 'Music reactions', 'sway, thump, loudness, flashes'],
    ['look', 'Look', 'colors, light and engraving'],
    ['film', 'Film', 'glow, grain, letterbox'],
  ];
  const openGroups = new Set();

  function worldSlider(p) {
    const w = app.world;
    if (typeof p.def === 'string') {
      const inp = h('input', { type: 'color', value: rgbToHex(w.to[p.name]), 'aria-label': p.label });
      inp.addEventListener('input', () => w.set(p.name, inp.value));
      return h('label', { class: 'color' }, inp, h('span', {}, p.label));
    }
    const step = p.max - p.min > 20 ? 0.1 : 0.01;
    return slider(p.label, { min: p.min, max: p.max, step, get: () => w.to[p.name], set: v => { w.set(p.name, v); app.touch(); }, reset: () => p.def, mod: p.name, modStore: worldMods });
  }

  // ---------------------------------------------------------------- the song → the visuals (Worlds)
  // one-click ties, and a list of every tie you've made (from here or from any slider's ∿)
  const RECIPES = [
    ['bulge', 'bass', 0.5, 'Bass bulges it'],
    ['height', 'bass', 0.4, 'Bass lifts the relief'],
    ['frame', 'beat', -0.08, 'Beat punches in'],
    ['freq', 'beat', 0.12, 'Beat jumps the scale'],
    ['twist', 'loud', 0.3, 'Loudness twists'],
    ['warpN', 'mid', 0.5, 'Mids melt it'],
    ['thick', 'high', 0.35, 'Highs thin the lines'],
    ['spinRate', 'bass', 0.25, 'Bass spins it'],
    ['vortex', 'loud', 0.25, 'Loudness winds the vortex'],
    ['flow', 'bass', 0.3, 'Bass pushes the lines'],
  ];
  const routesEl = h('div', { class: 'routes' });
  function renderRoutes() {
    const entries = Object.entries(app.worldMods);
    routesEl.replaceChildren(...entries.map(([key, m]) => {
      const p = PARAM_BY_NAME[key];
      const row = slider(`${MOD_LABELS[m.src]} → ${p?.label || key}`, { min: -1, max: 1, get: () => app.worldMods[key]?.amt ?? 0, set: v => { if (app.worldMods[key]) app.worldMods[key].amt = v; }, hint: 'Depth: how far the music pushes it (− flips it)' });
      row.querySelector('.slider-top').insertBefore(h('button', { class: 'mod-x', 'aria-label': 'Remove', html: icon('x'), onclick: () => { app.setWorldMod(key, null); renderBody(); } }), row.querySelector('output'));
      return row;
    }));
    return routesEl;
  }

  function songControls() {
    const isOn = ([key, src]) => app.worldMods[key]?.src === src;
    return [
      h('div', { class: 'sub-label' }, 'Ties'),
      slider('How much the music moves it', { min: 0, max: 2, step: 0.05, fmt: v => `${Math.round(v * 100)}%`, get: () => app.musicCfg.amount, set: v => { app.musicCfg.amount = v; }, hint: 'Scales the sway, the thump, loudness → intensity, the flashes and every ∿ tie. 0% = the music changes nothing.' }),
      h('div', { class: 'chips' }, RECIPES.map(r => h('button', { class: `chip${isOn(r) ? ' on' : ''}`, onclick: () => {
        const [key, src, amt] = r;
        app.setWorldMod(key, isOn(r) ? null : src, isOn(r) ? undefined : amt);
        renderBody();
      } }, r[3]))),
      renderRoutes(),
      h('p', { class: 'muted small' }, 'Or tie any slider under “Fine-tune everything” to the bass, mids, highs, loudness, the beat or the bar with its ', h('b', {}, '∿'), '. Ties stay when the look changes.'),
    ];
  }

  const AUTO_WHEN = [['off', 'Off'], ['song', 'While a song plays'], ['sound', 'With any sound'], ['always', 'Always']];

  function musicSection() {
    const a = app.audio, w = app.world, A = app.autoCfg;
    const live = app.autoActive();
    const chip = (on, label, onclick) => h('button', { class: `chip${on ? ' on' : ''}`, onclick }, label);
    const state = A.when === 'off' ? 'Off — the look only changes when you pick one.'
      : live ? `Morphing now — ${A.on === 'sections' && app.songAnalysis ? 'on each new section of the song' : `every ${A.every} bars`}.`
        : A.when === 'song' ? 'Waiting for a song to play.' : 'Waiting for sound — play a song or turn on the mic.';
    const C = app.musicCfg;
    const shape = (key, label, hint) => slider(label, { min: 0, max: 2, get: () => C[key], set: v => { C[key] = v; }, hint });
    return [section('Music', a.mode === 'off' ? 'nothing playing' : a.mode === 'mic' ? '● listening to the mic' : `♪ ${a.name}`,
      songsBlock(),
      h('div', { class: 'sub-label' }, 'How hard it hits'),
      reactivityBlock(),
      h('div', { class: 'sub-label' }, 'The sound itself'),
      shape('wave', 'Sound wave', 'Like an oscilloscope: straight lines become traces of the live waveform, rings ripple round'),
      shape('spectrum', 'Spectrum spikes', 'Bass in the middle, treble out to the sides; the last few seconds ride the lines further out'),
      shape('land', 'Sound landscape', 'The sheet rises into hills of the spectrum, rolling away from you — best with the camera tilted back (try Line Landscape)'),
      songControls(),
      h('div', { class: 'sub-label' }, 'Tempo'),
      tempoControls()),
    section('Auto-morph', 'glide to new looks by itself',
      h('div', { class: 'chips' }, AUTO_WHEN.map(([id, label]) => chip(A.when === id, label, () => { A.when = id; renderBody(); }))),
      A.when !== 'off' ? [
        h('div', { class: 'chips' },
          chip(A.on === 'bars', 'Every few bars', () => { A.on = 'bars'; renderBody(); }),
          chip(A.on === 'sections', 'When the song changes section', () => { A.on = 'sections'; renderBody(); })),
        A.on === 'bars' || !app.songAnalysis ? slider('Every', { min: 2, max: 32, step: 1, fmt: v => `${v} bars`, get: () => A.every, set: v => { A.every = v; } }) : null,
        h('div', { class: 'sub-label' }, 'It picks from'),
        h('div', { class: 'chips' },
          chip(A.variations, 'Variations of this look', () => { A.variations = !A.variations; renderBody(); }),
          A.variations ? null : LOOK_CATS.map(([id, label]) => chip(A.cats.includes(id), label, () => {
            A.cats = A.cats.includes(id) ? A.cats.filter(c => c !== id) : [...A.cats, id];
            if (!A.cats.length) A.cats = [id];
            renderBody();
          }))),
      ] : null,
      h('p', { class: 'muted small' }, state),
      slider('Glide length', { min: 0.25, max: 8, step: 0.25, fmt: v => `${v} bars`, get: () => w.morphBars, set: v => { w.morphBars = v; } }))];
  }

  function renderWorlds() {
    const w = app.world;
    const card = ([id, L]) => h('button', { class: `card${w.lookId === id ? ' on' : ''}`, title: L.blurb, onclick: () => { app.worldLook(id); renderBody(); } },
      thumbImg('worlds', id), h('span', {}, L.name));
    const looks = LOOK_CATS.map(([cat, name]) => [
      h('div', { class: 'sub-label' }, name),
      h('div', { class: 'cards' }, Object.entries(LOOKS).filter(([, L]) => L.cat === cat).map(card)),
    ]);
    const groups = WORLD_GROUPS.map(([g, name, blurb]) => {
      const params = PARAMS.filter(p => p.group === g && p.label);
      const colors = params.filter(p => typeof p.def === 'string');
      const el = h('details', { class: 'sec details' },
        h('summary', {}, name, h('small', {}, blurb)),
        colors.length ? h('div', { class: 'color-row' }, colors.map(worldSlider)) : null,
        params.filter(p => typeof p.def !== 'string').map(worldSlider));
      el.open = openGroups.has(g);
      el.addEventListener('toggle', () => { if (el.open) openGroups.add(g); else openGroups.delete(g); });
      return el;
    });
    return [
      knobStrip('worlds'),
      h('p', { class: 'lead' }, 'One world made of lines. Pick a look and ', h('b', {}, 'everything glides there'), ' — the equation re-forms instead of cutting. ', h('b', {}, 'Explore'), ' (up top) breeds new ones.'),
      looks,
      musicSection(),
      youSection(),
      pictureSection(),
      showSection(),
      h('div', { class: 'sub-label' }, 'Fine-tune everything'),
      groups,
    ];
  }

  // ---------------------------------------------------------------- Films (music videos)
  function renderFilms() {
    const f = app.film, tl = f.tl, def = f.def;
    const playing = app.filmPlaying();
    const status = f.status === 'loading'
      ? h('div', { class: 'status' }, h('span', { class: 'spinner' }), f.message)
      : f.status === 'error' ? h('div', { class: 'status bad' }, f.message) : null;

    const pppCard = h('div', { class: `film${f.kind === 'ppp' ? ' on' : ''}` },
      h('div', { class: 'film-art' }),
      h('div', { class: 'film-text' },
        h('b', {}, PPP_FILM.title),
        h('small', {}, `${PPP_FILM.artist} · 6:09 · 6/8 at ${PPP_FILM.bpm} bpm`),
        h('p', {}, PPP_FILM.logline)),
      f.kind === 'ppp' ? null : h('button', { class: 'btn primary', onclick: () => app.loadPPP() }, 'Load'));

    const need = f.status === 'need-song'
      ? [h('p', { class: 'muted small' }, f.message), ...songPicker('Choose the PPP mp3', 'it stays on your computer', file => app.loadFilmFile(file))]
      : [];

    let player = null, chapters = null;
    if (tl) {
      const dur = tl.duration;
      const time = h('span', { class: 'run-time' }, `${fmtT(f.clock)} / ${fmtT(dur)}`);
      const scrub = h('input', { type: 'range', min: 0, max: dur, step: 0.01, 'aria-label': 'Song position' });
      scrub.value = f.clock;
      scrub.style.setProperty('--p', `${(f.clock / dur) * 100}%`);
      let dragging = false;
      scrub.addEventListener('pointerdown', () => { dragging = true; });
      scrub.addEventListener('pointerup', () => { dragging = false; });
      scrub.addEventListener('input', () => { app.filmSeek(+scrub.value); scrub.style.setProperty('--p', `${(scrub.value / dur) * 100}%`); });
      const ticks = h('div', { class: 'ticks' }, tl.chapters.map(c => h('i', { style: `left:${(c.at / dur) * 100}%` })));
      const chapterEls = tl.chapters.map((c, i) => h('button', { class: `scene${i === f.chapter ? ' on' : ''}`, onclick: () => app.filmSeek(c.at + 0.02) },
        h('span', { class: 'scene-time' }, fmtT(Math.max(0, c.at)), h('i', {}, `bar ${Math.round(c.bar)}`)),
        h('span', { class: 'scene-body' }, h('b', {}, c.name), h('span', {}, c.story), h('small', {}, c.how))));
      runEls = { time, scrub, dur, sceneEls: chapterEls, isDragging: () => dragging };

      player = h('div', { class: 'player' },
        h('div', { class: 'transport' },
          h('button', { class: 'play', 'aria-label': playing ? 'Pause' : 'Play', html: icon(playing ? 'pause' : 'play'), onclick: () => (playing ? app.filmPause() : app.filmPlay()) }),
          h('div', { class: 'transport-mid' }, h('b', {}, def.title), time),
          iconBtn('stop', 'Stop', () => app.filmStop())),
        h('div', { class: 'scrub' }, ticks, scrub),
        h('div', { class: 'run-actions' },
          h('button', { class: 'btn', html: `${icon('record')}<span>Record the whole film</span>`, onclick: () => app.recordRun() }),
          h('button', { class: 'btn', html: `${icon('save')}<span>Play with this look</span>`, 'data-tip': 'Take whatever is on screen into Worlds', onclick: () => app.filmStop({ keepLook: true }) }),
          f.kind === 'auto' ? h('button', { class: 'btn', html: `${icon('dice')}<span>Write another</span>`, onclick: () => app.reshuffle() }) : null),
        toggle('Cinema mode (hide controls while it plays)', () => f.cinema, v => { f.cinema = v; }),
        h('p', { class: 'muted small' }, f.kind === 'auto' ? def.logline : 'Your mouse tools still work while it plays.'));
      chapters = section(f.kind === 'ppp' ? 'The story, and how it was made' : 'The film', 'tap a chapter to jump', h('div', { class: 'scenes' }, chapterEls));
    }

    return [
      h('p', { class: 'lead' }, 'Music videos made of one world of lines. Nothing cuts — every chapter is the equation re-forming, landing on the song’s bar lines; loudness changes how ', h('b', {}, 'intense'), ' it gets, never how fast.'),
      pppCard, ...need, status, player, chapters,
      section('Smart music mode', 'a new film for any song',
        h('p', { class: 'muted small' }, 'It finds the tempo, the bars and the sections, then writes a film with the same rules as PPP — different every time.'),
        ...songPicker('Make a film for a song', 'drop it on the page or click to choose', file => app.loadFilmFile(file, { forceAuto: true })),
        app.songs.list.length ? [h('div', { class: 'sub-label' }, 'Or pick one of your songs'), songsBlock({ pickLabel: 'Make a film for this song', mic: false })] : null,
        h('p', { class: 'muted small' }, 'Turned the camera on in Worlds? Your face, hands and movement show up in the films too.'),
        f.analysis && f.kind === 'ppp' ? h('button', { class: 'btn wide', html: `${icon('dice')}<span>Let the machine direct PPP instead</span>`, onclick: () => app.reshuffle() }) : null),
    ];
  }

  function runTick(t) {
    if (!runEls) return;
    runEls.time.textContent = `${fmtT(t)} / ${fmtT(runEls.dur)}`;
    if (!runEls.isDragging()) {
      runEls.scrub.value = t;
      runEls.scrub.style.setProperty('--p', `${(t / runEls.dur) * 100}%`);
    }
  }
  function runScene(i) {
    const c = app.film.tl?.chapters[i];
    if (c) { nameEl.textContent = `▶ ${c.name}`; nameEl.classList.remove('dirty'); }
    if (!runEls) return;
    runEls.sceneEls.forEach((el, k) => el.classList.toggle('on', k === i));
    runEls.sceneEls[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- toasts, hint, per-frame
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function showHint() {
    try { if (localStorage.getItem('trippy.hint.v2')) return; } catch {}
    hintEl.replaceChildren(
      h('span', { html: '<b>Move your mouse over it</b> — the Hand presses through. <b>Worlds</b>, <b>Patterns</b> and <b>Films</b> are up in the panel. <kbd>H</kbd> hides everything.' }),
      h('button', { class: 'icon-btn', 'aria-label': 'Got it', html: icon('x'), onclick: dismissHint }));
    hintEl.hidden = false;
  }
  function dismissHint() {
    if (hintEl.hidden) return;
    hintEl.hidden = true;
    try { localStorage.setItem('trippy.hint.v2', '1'); } catch {}
  }

  function tick() {
    if (meters) {
      const a = app.audio;
      meters.bass.fill.style.width = `${a.bass * 100}%`;
      meters.mid.fill.style.width = `${a.mid * 100}%`;
      meters.high.fill.style.width = `${a.high * 100}%`;
      if (a.beat) { meters.beat.classList.remove('hit'); void meters.beat.offsetWidth; meters.beat.classList.add('hit'); }
    }
    if (app.recording) {
      const el = actionsEl.querySelector('.rec-time');
      const sec = Math.floor((performance.now() - app.recordStart) / 1000);
      if (el) el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    }
  }

  function setThumb(kind, id, url) {
    for (const img of document.querySelectorAll(`img[data-thumb="${kind}:${id}"]`)) img.src = url;
  }

  // ---------------------------------------------------------------- boot
  applyView(false);
  renderTop();
  renderDock();
  renderTabs();
  renderBody();
  if (matchMedia('(max-width: 760px)').matches) document.body.classList.add('panel-closed');   // not saved
  showHint();

  return {
    refresh() { renderTop(); renderTabs(); renderBody(); },
    refreshYou() { if (app.mode === 'worlds') renderBody(); },
    renderNow,
    renderExplore,
    refreshRun() { if (app.mode === 'films') renderBody(); },
    runTick, runScene,
    refreshTop: renderTop,
    renderName,
    renderDock,
    setTab,
    get tab() { return tab; },
    toast, tick, setThumb, dismissHint, togglePanel, setView,
  };
}
