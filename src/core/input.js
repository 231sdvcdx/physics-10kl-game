// Keyboard (by physical key codes — works on any layout), mouse and pointer lock
import { Emitter } from './util.js';

export const BIND = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], interact: ['KeyE'], inventory: ['Tab'], notebook: ['KeyN'],
  problems: ['KeyT'], calculator: ['KeyC'], tool: ['KeyQ'], vision: ['KeyV'], flashlight: ['KeyF'], pause: ['Escape'],
  use: ['Mouse0'], alt: ['Mouse2'], skip: ['Space', 'Enter'],
};
const ACTION_OF = {};
for (const [a, codes] of Object.entries(BIND)) for (const c of codes) (ACTION_OF[c] ||= []).push(a);

export class Input extends Emitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.down = new Set();
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.locked = false;
    this.enabled = true; // gameplay input
    this.lockWanted = false;
    addEventListener('keydown', e => this.onKey(e, true), { capture: true });
    addEventListener('keyup', e => this.onKey(e, false), { capture: true });
    addEventListener('blur', () => this.down.clear());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked) this.emit('unlock');
      if (!was && this.locked) this.emit('lock');
    });
    document.addEventListener('pointerlockerror', () => this.emit('lockerror'));
    addEventListener('mousemove', e => { if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; } });
    canvas.addEventListener('mousedown', e => {
      if (!this.locked && this.lockWanted) { this.lock(); return; }
      if (this.locked) this.fire('Mouse' + e.button, true, e);
    });
    addEventListener('mouseup', e => { if (this.locked) this.fire('Mouse' + e.button, false, e); });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', e => { if (this.locked || e.target === canvas) e.preventDefault(); });
  }
  isTyping(e) {
    const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  onKey(e, isDown) {
    if (e.code === 'Tab') e.preventDefault();
    if (this.isTyping(e) && e.code !== 'Escape' && e.code !== 'Tab') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'Backquote'].includes(e.code) && !this.isTyping(e)) e.preventDefault();
    if (isDown && e.repeat) { this.emit('repeat', e.code, e); return; }
    this.fire(e.code, isDown, e);
  }
  fire(code, isDown, e) {
    if (isDown) this.down.add(code); else this.down.delete(code);
    const acts = ACTION_OF[code] || [];
    for (const a of acts) this.emit(isDown ? 'action' : 'actionup', a, e);
    this.emit(isDown ? 'key' : 'keyup', code, e);
  }
  is(action) { if (!this.enabled) return false; return BIND[action].some(c => this.down.has(c)); }
  consumeMouse() { const r = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return r; }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  lock() {
    this.lockWanted = true;
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { const p2 = this.canvas.requestPointerLock(); if (p2 && p2.catch) p2.catch(() => this.emit('lockerror')); } catch (e) { this.emit('lockerror'); } });
    } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) { this.emit('lockerror'); } }
  }
  unlock() { this.lockWanted = false; if (document.pointerLockElement) document.exitPointerLock(); }
}
