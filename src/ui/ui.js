// Modal stack manager (inventory, notebook, problem book, lessons, notes, menus). Calculator is a side panel.
import { el } from '../core/util.js';

export class UI {
  constructor(game, root) {
    this.g = game; this.root = root;
    this.modal = el('div', { id: 'modal', class: 'interactive' });
    root.append(this.modal);
    this.stack = [];
    this.modal.addEventListener('mousedown', e => { if (e.target === this.modal && this.top?.closeOnBackdrop) this.close(); });
  }
  get top() { return this.stack[this.stack.length - 1]; }
  get anyOpen() { return this.stack.length > 0 || !!this.g.calc?.open; }
  isOpen(id) { return this.stack.some(s => s.id === id); }
  open(id, node, opts = {}) {
    if (!opts.stack) [...this.stack].forEach(s => this.close(s.id, true));
    const wrap = el('div', { class: 'mwrap', 'data-id': id, style: { position: 'absolute', inset: '0' } }, node);
    this.stack.push({ id, el: wrap, node, ...opts });
    this.modal.append(wrap);
    this.modal.classList.add('on');
    this.applyTop();
    this.g.audio.sfx('open');
    this.g.onUIChange();
    return wrap;
  }
  close(id, silent = false) {
    const i = id ? this.stack.findIndex(s => s.id === id) : this.stack.length - 1;
    if (i < 0) return false;
    const [s] = this.stack.splice(i, 1);
    s.el.remove();
    try { s.onClose && s.onClose(); } catch (e) { console.error(e); }
    if (!this.stack.length) this.modal.classList.remove('on');
    else this.applyTop();
    if (!silent) this.g.audio.sfx('close');
    this.g.onUIChange();
    return true;
  }
  applyTop() {
    const t = this.top; if (!t) return;
    this.modal.style.background = t.dim === false ? 'transparent' : '';
    this.modal.classList.toggle('interactive', !t.passthrough);
  }
  closeAll() { [...this.stack].reverse().forEach(s => this.close(s.id, true)); }
  toggle(id, make) { if (this.isOpen(id)) { this.close(id); return false; } make(); return true; }
}

// helper: standard panel with header
export function panel({ title, sub = '', cls = '', style = {}, closeKey = 'Esc', onClose = null }, ...children) {
  const x = el('span', { class: 'x' }, closeKey ? `[${closeKey}] закрыть` : '');
  const head = el('div', { class: 'ph' }, el('span', {}, title), sub ? el('span', { class: 'sub' }, sub) : null, x);
  if (onClose) { x.style.cursor = 'pointer'; x.addEventListener('click', onClose); }
  return el('div', { class: 'panel ' + cls, style }, el('div', { class: 'scan' }), head, ...children);
}
