// «Физическое зрение» (V): slow time, cyan grade, labelled quantities/vectors by unlocked layers
import * as THREE from 'three';
import { el, damp } from '../core/util.js';
import { Arrow } from '../fx/fx.js';

export const LAYERS = [
  { id: 'quant', name: 'Величины' }, { id: 'vec', name: 'Векторы' }, { id: 'mass', name: 'Массы и силы' },
  { id: 'energy', name: 'Энергия' }, { id: 'temp', name: 'Температура' }, { id: 'charge', name: 'Заряды' },
];
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
export class Vision {
  constructor(game) { this.g = game; this.on = false; this.amount = 0; this.targets = []; this.arrows = new THREE.Group(); game.engine.scene.add(this.arrows); this.occT = 0; }
  get unlocked() { return !!this.g.save?.flags?.vision; }
  layers() { return this.g.save?.vision || []; }
  reset() { this.on = false; this.amount = 0; this.clear(); this.g.hud.visionEl.classList.remove('on'); if (this.arrows.parent !== this.g.engine.scene) this.g.engine.scene.add(this.arrows); }
  clear() { this.targets.forEach(t => t.el && t.el.remove()); this.targets = []; this.arrows.clear(); }
  add(obj, { layer = 'quant', name = '', html, offset = [0, 0.4, 0], range = 16, vec = null, color = 0xffb547 }) {
    const t = { obj, layer, name, html, offset: new THREE.Vector3(...offset), range, vec, el: el('div', { class: 'plabel hidden' }), visible: false, occluded: false };
    if (vec) { t.arrow = new Arrow(color, 0.02); t.arrow.visible = false; this.arrows.add(t.arrow); }
    this.g.hud.labels.append(t.el);
    this.targets.push(t); return t;
  }
  toggle() {
    if (!this.unlocked) { this.g.hud.toast('Физическое зрение', 'Визор ещё не подключён.', 'red', 2); return; }
    this.on = !this.on;
    this.g.audio.sfx(this.on ? 'holo' : 'close', { vol: 0.6 });
    const ly = this.g.hud.visionEl.querySelector('.layers');
    const have = this.layers();
    ly.innerHTML = LAYERS.map(l => `<span class="${have.includes(l.id) ? 'on' : 'lock'}">${have.includes(l.id) ? l.name : '🔒 ' + l.name}</span>`).join('');
    this.g.hud.visionEl.classList.toggle('on', this.on);
    this.g.emit('vision', this.on);
  }
  update(dt) {
    const g = this.g;
    this.amount = damp(this.amount, this.on ? 1 : 0, 6, dt);
    g.engine.vision.uniforms.get('amount').value = this.amount;
    g.timeScaleTarget = this.on ? 0.3 : 1;
    const cam = g.engine.camera; const W = innerWidth, H = innerHeight;
    const have = this.layers();
    this.occT -= dt; const doOcc = this.occT <= 0; if (doOcc) this.occT = 0.25;
    cam.getWorldDirection(_d);
    for (const t of this.targets) {
      let show = this.amount > 0.5 && have.includes(t.layer) && t.obj.parent && t.obj.visible !== false;
      if (show) {
        t.obj.getWorldPosition(_v); _v.add(t.offset);
        const dist = _v.distanceTo(cam.position);
        if (dist > t.range) show = false;
        else {
          if (doOcc) { const dir = _v.clone().sub(cam.position).normalize(); const r = g.physics.ray(cam.position, dir, dist, { excludeCollider: g.player.collider }); t.occluded = !!(r && r.toi < dist - 0.6); }
          if (t.occluded) show = false;
          const p = _v.clone().project(cam);
          if (p.z > 1 || p.z < -1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) show = false;
          else {
            t.el.style.left = ((p.x + 1) / 2 * W) + 'px'; t.el.style.top = ((1 - p.y) / 2 * H) + 'px';
            const html = `<div class="nm">${t.name}</div>${typeof t.html === 'function' ? t.html() : t.html}`;
            if (html !== t.last) { t.el.innerHTML = html; t.last = html; }
            t.el.style.opacity = Math.min(1, (this.amount - 0.5) * 2) * (dist > t.range * 0.8 ? (t.range - dist) / (t.range * 0.2) : 1);
          }
        }
      }
      if (show !== t.visible) { t.visible = show; t.el.classList.toggle('hidden', !show); }
      if (t.arrow) {
        const vs = this.amount > 0.5 && have.includes(t.layer) && t.vec;
        if (vs) { t.obj.getWorldPosition(_v); const vec = t.vec(); if (vec) { t.arrow.setVec(_v, vec); } else t.arrow.visible = false; }
        else t.arrow.visible = false;
      }
    }
  }
}
