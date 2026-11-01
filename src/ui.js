// All the DOM: top bar, side panel, tool dock, toasts.
// The panel has three modes — Patterns (flat op-art: Presets / Build / Math / Sound), Worlds (the 3D film
// engine, live) and Films (music videos). Sliders write straight into the state; anything that changes
// structure re-renders the open view.
import { PATTERNS, WARPS, PALETTES, PATTERN_BY_ID, WARP_BY_ID, MAX_INKS, MIX_MODES } from './catalog.js';
import { PPP_FILM } from './film/ppp.js';
import { LOOKS } from './film/looks.js';
import { PARAMS, rgbToHex } from './film/params.js';
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
  function slider(label, { min, max, step = 0.01, get, set, fmt = fmt2, reset, hint, mod }) {
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
    if (mod) attachMod(row, top, mod);
    row.sync = () => { input.value = get(); paint(); };
    paint();
    return row;
  }

  // ∿ — tie a slider to the music: a source (bass, beat, bar…) and a depth
  const MOD_LABELS = { bass: 'Bass', mid: 'Mids', high: 'Highs', loud: 'Loudness', beat: 'Beat', bar: 'Bar sway', slow: 'Slow wave' };
  function attachMod(row, top, key) {
    const btn = h('button', { class: 'mod-btn', 'aria-label': 'Follow the music', 'data-tip': 'Follow the music', html: '∿' });
    top.insertBefore(btn, top.lastChild);
    let open = false, panel = null;
    const paint = () => {
      const m = app.mods[key];
      row.classList.toggle('modded', !!m);
      btn.textContent = m ? `∿ ${MOD_LABELS[m.src]}` : '∿';
    };
    const build = () => {
      const m = app.mods[key];
      panel = h('div', { class: 'modrow' },
        h('div', { class: 'chips' },
          h('button', { class: `chip${!m ? ' on' : ''}`, onclick: () => { app.setMod(key, null); rebuild(); } }, 'Off'),
          Object.entries(MOD_LABELS).map(([src, name]) => h('button', { class: `chip${m?.src === src ? ' on' : ''}`, onclick: () => { app.setMod(key, src); rebuild(); } }, name))),
        m ? slider('Depth (− flips it)', { min: -1, max: 1, get: () => app.mods[key]?.amt ?? 0.4, set: v => { if (app.mods[key]) app.mods[key].amt = v; } }) : null);
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
    meters = null;
    runEls = null;
    const view = app.mode === 'worlds' ? renderWorlds()
      : app.mode === 'films' ? renderFilms()
        : { presets: renderPresets, play: renderPlay, smart: renderSmart, sound: renderSound }[tab]();
    body.replaceChildren(...[view].flat(3).filter(Boolean));
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
      h('p', { class: 'lead' }, 'Pick a starting point. Then drag on it, try the tools at the bottom, or hit ', h('b', {}, 'Mutate'), ' a few times.'),
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
    const file = h('input', { type: 'file', accept: 'audio/*', hidden: true });
    file.addEventListener('change', () => { if (file.files[0]) app.loadSong(file.files[0]); });
    const drop = h('button', { class: 'dropzone', onclick: () => file.click() },
      h('span', { html: icon('music') }), h('b', {}, 'Drop a song here'), h('small', {}, 'or click to choose an audio file'));

    const now = a.mode === 'off' ? null : h('div', { class: 'now' },
      h('span', { class: 'now-name' }, a.mode === 'mic' ? '🎙 Listening to the microphone' : `♪ ${a.name}`),
      a.mode === 'file' ? iconBtn(a.playing ? 'pause' : 'play', 'Play / pause', () => { a.togglePlay(); setTimeout(renderBody, 50); }) : null,
      iconBtn('stop', 'Stop', () => app.stopAudio()));

    const bar = label => {
      const fill = h('i');
      const el = h('div', { class: 'meter' }, h('span', {}, label), h('div', { class: 'meter-bar' }, fill));
      el.fill = fill;
      return el;
    };
    meters = { bass: bar('Bass'), mid: bar('Mids'), high: bar('Highs'), beat: h('div', { class: 'beat' }, 'BEAT') };

    const cfgSlider = (key, label, hint) => slider(label, { min: 0, max: 1, get: () => cfg[key], set: v => { cfg[key] = v; }, hint });

    return [
      h('p', { class: 'lead' }, 'Make the pattern dance. Songs stay on your computer — nothing gets uploaded.'),
      drop, file,
      h('button', { class: 'btn wide', html: `${icon('mic')}<span>Use the microphone instead</span>`, onclick: () => app.useMic() }),
      now,
      a.mode === 'file' ? h('button', { class: 'btn wide primary', html: `${icon('film')}<span>Make a music video from this song</span>`, onclick: () => app.autoFromCurrentSong() }) : null,
      section('Tempo', 'drives the bar-synced ∿ sources', tempoControls()),
      section('Levels', null, h('div', { class: 'meters' }, meters.bass, meters.mid, meters.high, meters.beat)),
      section('What reacts', null,
        cfgSlider('pulse', 'Bass → zoom thump'),
        cfgSlider('ripples', 'Beats → ripples'),
        cfgSlider('intensity', 'Loudness → intensity', 'Louder music pushes the warps harder (not faster)'),
        cfgSlider('wobble', 'Mids → wobble')),
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

  // ---------------------------------------------------------------- Worlds (the film engine, live)
  const WORLD_GROUPS = [
    ['lines', 'Lines', 'the equation: straight lines, rings, tunnel, spiral, crossings'],
    ['bend', 'Bend', 'twist, bulge, waves and mirrors'],
    ['shape', 'Shapes', 'folds, orbs, the lattice, the face, hands'],
    ['camera', 'Camera', 'lens, zoom and tilt'],
    ['motion', 'Motion', 'speeds, per bar'],
    ['look', 'Look', 'colors, light and engraving'],
    ['film', 'Film', 'glow, grain, letterbox'],
  ];

  function worldSlider(p) {
    const w = app.world;
    if (typeof p.def === 'string') {
      const inp = h('input', { type: 'color', value: rgbToHex(w.to[p.name]), 'aria-label': p.label });
      inp.addEventListener('input', () => w.set(p.name, inp.value));
      return h('label', { class: 'color' }, inp, h('span', {}, p.label));
    }
    const step = p.max - p.min > 20 ? 0.1 : 0.01;
    return slider(p.label, { min: p.min, max: p.max, step, get: () => w.to[p.name], set: v => { w.set(p.name, v); app.touch(); }, reset: () => p.def });
  }

  function renderWorlds() {
    const w = app.world;
    const cards = h('div', { class: 'cards' }, Object.entries(LOOKS).map(([id, L]) =>
      h('button', { class: `card${w.lookId === id ? ' on' : ''}`, title: L.blurb, onclick: () => { app.worldLook(id); renderBody(); } },
        thumbImg('worlds', id), h('span', {}, L.name))));
    const a = app.audio;
    const groups = WORLD_GROUPS.map(([g, name, blurb]) => {
      const params = PARAMS.filter(p => p.group === g && p.label);
      const colors = params.filter(p => typeof p.def === 'string');
      return h('details', { class: 'sec details' },
        h('summary', {}, name, h('small', {}, blurb)),
        colors.length ? h('div', { class: 'color-row' }, colors.map(worldSlider)) : null,
        params.filter(p => typeof p.def !== 'string').map(worldSlider));
    });
    return [
      h('p', { class: 'lead' }, 'One world made of lines. Pick a look and ', h('b', {}, 'everything glides there'), ' — the equation re-forms instead of cutting. Use the ', h('b', {}, 'Hand'), ' tool to press through it.'),
      cards,
      section('Morph', 'how the glide feels',
        slider('Glide length', { min: 0.25, max: 8, step: 0.25, fmt: v => `${v} bars`, get: () => w.morphBars, set: v => { w.morphBars = v; } }),
        toggle('Auto-morph to a new look on the bar', () => w.auto, v => { w.auto = v; w.lastAutoBar = -1e9; }),
        slider('Every', { min: 2, max: 32, step: 1, fmt: v => `${v} bars`, get: () => w.autoBars, set: v => { w.autoBars = v; } })),
      section('Music', a.mode === 'off' ? 'nothing playing' : a.mode === 'mic' ? 'listening to the mic' : `♪ ${a.name}`,
        h('div', { class: 'run-actions' },
          ...songPicker('Play a song', 'it finds the beat, then everything moves with it', f => app.loadSong(f)).map(el => { if (el.classList) el.classList.add('slim'); return el; }),
          h('button', { class: 'btn', html: `${icon('mic')}<span>Mic</span>`, onclick: () => app.useMic() }),
          a.mode !== 'off' ? h('button', { class: 'btn', html: `${icon('stop')}<span>Stop</span>`, onclick: () => app.stopAudio() }) : null),
        tempoControls(),
        PARAMS.filter(p => p.group === 'music').map(worldSlider)),
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
    try { if (localStorage.getItem('trippy.hint.v1')) return; } catch {}
    hintEl.replaceChildren(
      h('span', { html: '<b>Drag across the pattern.</b> Pick a tool below, or press <b>Mutate</b>. <kbd>H</kbd> hides everything.' }),
      h('button', { class: 'icon-btn', 'aria-label': 'Got it', html: icon('x'), onclick: dismissHint }));
    hintEl.hidden = false;
  }
  function dismissHint() {
    if (hintEl.hidden) return;
    hintEl.hidden = true;
    try { localStorage.setItem('trippy.hint.v1', '1'); } catch {}
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
