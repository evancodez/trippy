// Small DOM building blocks shared by the whole interface.
import { icon } from '../icons.js';

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

export const fmt2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// a labelled range. opts: { min, max, step, get, set, fmt, hint, reset (double-click), edited (), extra (node in the label row) }
export function slider(label, { min, max, step = 0.01, get, set, fmt = fmt2, hint, reset, edited, extra }) {
  const input = h('input', { type: 'range', min, max, step, 'aria-label': label });
  const out = h('output');
  const row = h('div', { class: 'slider', title: hint || (reset ? 'Double-click to put it back' : null) });
  const paint = () => {
    const v = +input.value;
    out.textContent = fmt(v);
    input.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
    row.classList.toggle('edited', !!edited?.());
  };
  input.value = get();
  input.addEventListener('input', () => { set(+input.value); paint(); });
  const top = h('div', { class: 'slider-top' }, h('span', { class: 'slider-label' }, label), extra, out);
  row.append(top, input);
  if (reset) row.addEventListener('dblclick', e => { if (e.target.closest('.modrow, .mod-btn')) return; reset(); input.value = get(); paint(); });
  row.sync = () => { input.value = get(); paint(); };
  row.top = top;
  paint();
  return row;
}

export function toggle(label, get, set, sub) {
  const btn = h('button', { class: 'toggle', role: 'switch' }, h('span', { class: 'switch' }), h('span', { class: 'toggle-text' }, label, sub ? h('small', {}, sub) : null));
  const paint = () => { btn.classList.toggle('on', !!get()); btn.setAttribute('aria-checked', String(!!get())); };
  btn.addEventListener('click', () => { set(!get()); paint(); });
  paint();
  return btn;
}

export const chips = (items, isOn, pick, cls = '') =>
  h('div', { class: `chips ${cls}` }, items.map(([id, label, tip]) =>
    h('button', { class: `chip${isOn(id) ? ' on' : ''}`, title: tip, onclick: () => pick(id) }, label)));

export const iconBtn = (name, tip, onclick, { disabled, cls = '' } = {}) =>
  h('button', { class: `icon-btn ${cls}`, 'data-tip': tip, 'aria-label': tip, onclick, disabled, html: icon(name) });

export const section = (title, sub, ...kids) =>
  h('section', { class: 'sec' }, h('div', { class: 'sec-head' }, h('h3', {}, title), sub ? h('small', {}, sub) : null), ...kids);

// a details group that remembers whether it was open across re-renders
const openGroups = new Set();
export function fold(id, title, sub, ...kids) {
  const el = h('details', { class: 'fold' }, h('summary', {}, h('span', {}, title), sub ? h('small', {}, sub) : null), ...kids);
  el.open = openGroups.has(id);
  el.addEventListener('toggle', () => { if (el.open) openGroups.add(id); else openGroups.delete(id); });
  return el;
}

// a big rotary knob, 0..1, 0.5 in the middle. Drag up/down (or sideways), scroll, double-click to center.
export function knob({ left, right }, get, set) {
  const R = 22, C = 2 * Math.PI * R * 0.75;
  const dial = h('div', { class: 'knob-dial', html:
    `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="${R}" class="k-track" stroke-dasharray="${C} 999" transform="rotate(135 30 30)"/>` +
    `<circle cx="30" cy="30" r="${R}" class="k-val" transform="rotate(135 30 30)"/><line x1="30" y1="30" x2="30" y2="12" class="k-tick"/></svg>` });
  const val = dial.querySelector('.k-val'), tick = dial.querySelector('.k-tick');
  const el = h('div', { class: 'knob', title: 'Drag up or down · double-click for the middle' }, dial,
    h('div', { class: 'knob-labels' }, h('span', {}, left), h('span', {}, right)));
  const paint = () => {
    const x = get();
    val.setAttribute('stroke-dasharray', `${C * x} 999`);
    tick.setAttribute('transform', `rotate(${-135 + x * 270} 30 30)`);
    el.classList.toggle('moved', Math.abs(x - 0.5) > 0.02);
  };
  let start = null;
  dial.addEventListener('pointerdown', e => { dial.setPointerCapture(e.pointerId); start = { y: e.clientY, x: e.clientX, v: get() }; });
  dial.addEventListener('pointermove', e => {
    if (!start) return;
    set(Math.min(1, Math.max(0, start.v + ((start.y - e.clientY) + (e.clientX - start.x)) / 180)));
    paint();
  });
  dial.addEventListener('pointerup', () => { start = null; });
  dial.addEventListener('dblclick', () => { set(0.5); paint(); });
  dial.addEventListener('wheel', e => { e.preventDefault(); set(Math.min(1, Math.max(0, get() - e.deltaY / 800))); paint(); }, { passive: false });
  el.sync = paint;
  paint();
  return el;
}
