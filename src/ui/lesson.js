// Holographic lesson player: 3D interactive stage + textbook text + controls + live graph + quiz
import * as THREE from 'three';
import { el, escapeHtml, clamp, damp, wait } from '../core/util.js';
import { topicStats } from '../core/save.js';
import { panel } from './ui.js';
import { rich, tex } from './tex.js';
import { holoMaterial } from '../fx/fx.js';

export function labelSprite(text, { color = '#dff8ff', size = 0.22, bg = 'rgba(2,14,22,0.72)', border = '#62e6ff', font = 'JetBrains Mono', weight = '400', pad = 18 } = {}) {
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  const fs = 64; x.font = `${weight} ${fs}px '${font}'`;
  const lines = String(text).split('\n');
  const w = Math.ceil(Math.max(...lines.map(l => x.measureText(l).width)) + pad * 2); const h = Math.ceil(lines.length * fs * 1.2 + pad * 1.4);
  c.width = w; c.height = h;
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  if (border) { x.strokeStyle = border; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3); }
  x.font = `${weight} ${fs}px '${font}'`; x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = 'center';
  lines.forEach((l, i) => x.fillText(l, w / 2, pad * 0.7 + fs * 0.6 + i * fs * 1.2));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, color: new THREE.Color(1.4, 1.4, 1.4) });
  const s = new THREE.Sprite(m); s.scale.set(size * w / h, size, 1); s.renderOrder = 30;
  s.userData.dispose = () => { t.dispose(); m.dispose(); };
  return s;
}

class Graph {
  constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.series = []; this.xl = 't, с'; this.yl = ''; this.xmax = 10; this.ymax = 10; this.ymin = 0; }
  config({ xl = 't, с', yl = '', xmax = 10, ymax = 10, ymin = 0, series = [] }) { Object.assign(this, { xl, yl, xmax, ymax, ymin }); this.series = series.map(s => ({ ...s, pts: [] })); }
  push(i, t, y) { const s = this.series[i]; if (!s) return; const last = s.pts[s.pts.length - 1]; if (last && t - last[0] < 0.03) return; s.pts.push([t, y]); if (s.pts.length > 800) s.pts.shift(); }
  clear() { this.series.forEach(s => s.pts = []); }
  draw() {
    const c = this.c, x = this.x; const W = c.clientWidth * 2, H = c.clientHeight * 2; if (!W) return;
    if (c.width !== W) { c.width = W; c.height = H; }
    x.clearRect(0, 0, W, H);
    const L = 64, B = 40, R = 16, T = 16; const pw = W - L - R, ph = H - T - B;
    x.strokeStyle = 'rgba(98,230,255,.12)'; x.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { const yy = T + ph * i / 5; x.beginPath(); x.moveTo(L, yy); x.lineTo(L + pw, yy); x.stroke(); const xx = L + pw * i / 5; x.beginPath(); x.moveTo(xx, T); x.lineTo(xx, T + ph); x.stroke(); }
    x.strokeStyle = 'rgba(98,230,255,.6)'; x.beginPath(); x.moveTo(L, T); x.lineTo(L, T + ph); x.lineTo(L + pw, T + ph); x.stroke();
    x.fillStyle = '#9fc4d0'; x.font = '20px JetBrains Mono'; x.textAlign = 'right';
    for (let i = 0; i <= 5; i++) { const v = this.ymin + (this.ymax - this.ymin) * (1 - i / 5); x.fillText(String(+v.toPrecision(3)).replace('.', ','), L - 6, T + ph * i / 5 + 6); }
    x.textAlign = 'center';
    for (let i = 0; i <= 5; i++) x.fillText(String(+(this.xmax * i / 5).toPrecision(3)).replace('.', ','), L + pw * i / 5, T + ph + 26);
    x.textAlign = 'left'; x.fillStyle = '#ffb547'; x.fillText(this.yl, L + 6, T + 18); x.textAlign = 'right'; x.fillText(this.xl, L + pw - 4, T + ph - 8);
    for (const s of this.series) {
      x.strokeStyle = s.color || '#62e6ff'; x.lineWidth = 3; x.beginPath();
      s.pts.forEach(([t, y], i) => { const px = L + pw * clamp(t / this.xmax, 0, 1), py = T + ph * (1 - clamp((y - this.ymin) / (this.ymax - this.ymin), 0, 1)); i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.stroke();
    }
  }
}

export class LessonPlayer {
  constructor(game) { this.g = game; this.active = false; }
  async play(def, { anchor, view, replay = false }) {
    const g = this.g;
    this.def = def; this.replay = replay; this.anchor = anchor; this.active = true;
    this.stage = new THREE.Group(); anchor.add(this.stage);
    this.idx = 0; this.answers = {}; this.quizFirst = {};
    this.orbit = { yaw: view.yaw ?? 0, pitch: view.pitch ?? 0.25, dist: view.dist ?? 4, target: view.target.clone(), tyaw: view.yaw ?? 0, tpitch: view.pitch ?? 0.25, tdist: view.dist ?? 4 };
    this.paused = false; this.slow = 1; this.params = {}; this.time = 0;
    this.buildUI();
    document.body.classList.add('lesson-on');
    this.bindOrbit(true);
    g.emit('lessonstart', def.id);
    this.showStep(0);
    return new Promise(res => { this.resolve = res; });
  }
  buildUI() {
    const g = this.g;
    this.bodyEl = el('div', { class: 'body scroll' });
    this.dots = el('div', { class: 'dots' });
    this.prevBtn = el('button', { class: 'btn small ghost', onclick: () => this.go(-1) }, '◀ Назад');
    this.nextBtn = el('button', { class: 'btn small primary', onclick: () => this.go(1) }, 'Далее ▶');
    this.left = panel({ title: this.def.title, sub: this.def.ref, closeKey: this.replay ? 'Esc' : '', onClose: this.replay ? () => this.finish(true) : null }, this.bodyEl, el('div', { class: 'nav' }, this.prevBtn, this.dots, this.nextBtn));
    this.left.id = 'lesson-l'; this.left.classList.add('interactive');
    this.ctlEl = el('div', { class: 'ctl scroll' });
    this.right = panel({ title: 'Голостенд', sub: 'тяните мышью — вращать, колесо — приблизить', closeKey: '' }, this.ctlEl);
    this.right.id = 'lesson-r'; this.right.classList.add('interactive');
    const wrap = el('div', {}, this.left, this.right);
    g.ui.open('lesson', wrap, { dim: false, passthrough: true, onClose: () => { if (this.active) this.finish(true, true); } });
  }
  bindOrbit(on) {
    const cv = this.g.engine.canvas;
    if (on) {
      let drag = null;
      this._md = e => { drag = [e.clientX, e.clientY]; };
      this._mm = e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY]; this.orbit.tyaw -= dx * 0.006; this.orbit.tpitch = clamp(this.orbit.tpitch + dy * 0.004, -0.2, 1.2); };
      this._mu = () => { drag = null; };
      this._wh = e => { this.orbit.tdist = clamp(this.orbit.tdist * (1 + Math.sign(e.deltaY) * 0.1), 1.5, 12); };
      cv.addEventListener('mousedown', this._md); addEventListener('mousemove', this._mm); addEventListener('mouseup', this._mu); cv.addEventListener('wheel', this._wh, { passive: true });
    } else {
      cv.removeEventListener('mousedown', this._md); removeEventListener('mousemove', this._mm); removeEventListener('mouseup', this._mu); cv.removeEventListener('wheel', this._wh);
    }
  }
  get steps() { return [...this.def.steps, ...(this.def.quiz?.length ? [{ quiz: true, title: 'Проверка понимания' }] : [])]; }
  go(d) {
    const steps = this.steps;
    if (d > 0 && this.idx === steps.length - 1) { if (this.quizDone()) this.finish(false); return; }
    this.showStep(clamp(this.idx + d, 0, steps.length - 1));
  }
  quizDone() { return (this.def.quiz || []).every((q, i) => this.answers[i] === q.right); }
  ctxBase() {
    const g = this.g;
    return {
      THREE, stage: this.stage, game: g, params: this.params, time: 0,
      holo: (color = 0x62e6ff, o = {}) => holoMaterial(color, o),
      label: (text, o) => labelSprite(text, o),
      basic: (color, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: op < 1, opacity: op, depthWrite: op >= 1 }),
      line: (pts, color = 0x62e6ff, op = 1) => { const geo = new THREE.BufferGeometry().setFromPoints(pts); return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: op })); },
      graph: this.graph, setReadout: rows => this.setReadout(rows),
      say: text => g.dialogue.say([{ who: 'isaac', text }]),
    };
  }
  clearStage() {
    if (this.scene && this.scene.dispose) try { this.scene.dispose(); } catch (e) { console.error(e); }
    this.scene = null;
    this.stage.traverse(o => { if (o.userData.dispose) o.userData.dispose(); if (o.geometry) o.geometry.dispose(); });
    this.stage.clear();
  }
  showStep(i) {
    const g = this.g; const steps = this.steps; this.idx = i;
    const st = steps[i];
    g.dialogue.stop();
    this.clearStage();
    this.dots.innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('');
    this.prevBtn.disabled = i === 0;
    const last = i === steps.length - 1;
    this.nextBtn.textContent = last ? 'Завершить урок ✓' : 'Далее ▶';
    this.ctlEl.innerHTML = '';
    this.params = {}; this.time = 0; this.paused = false; this.slow = 1;
    if (st.quiz) { this.renderQuiz(); return; }
    this.bodyEl.innerHTML = `<h3 style="font-family:var(--f-head);margin:0 0 10px;letter-spacing:.04em">${escapeHtml(st.title)}</h3>` + rich(typeof st.html === 'function' ? st.html() : st.html);
    this.bodyEl.scrollTop = 0;
    // controls
    const ctx = this.ctx = this.ctxBase();
    for (const c of st.controls || []) this.ctlEl.append(this.makeControl(c, ctx));
    if (st.sim) {
      const bt = el('div', { class: 'ctrlbtns' },
        this.playBtn = el('button', { class: 'btn small', onclick: () => { this.paused = !this.paused; this.playBtn.textContent = this.paused ? '▶ Пуск' : '❚❚ Пауза'; } }, '❚❚ Пауза'),
        this.slowBtn = el('button', { class: 'btn small', onclick: () => { this.slow = this.slow === 1 ? 0.25 : 1; this.slowBtn.classList.toggle('primary', this.slow < 1); } }, 'Замедление ×0,25'),
        el('button', { class: 'btn small ghost', onclick: () => { this.time = 0; this.graph && this.graph.clear(); this.scene && this.scene.reset && this.scene.reset(); } }, '⟲ Сначала'));
      this.ctlEl.append(bt);
    }
    this.readoutEl = el('div', { class: 'readout' }); this.ctlEl.append(this.readoutEl);
    if (st.graph) {
      const cv = el('canvas', { class: 'graph' }); this.ctlEl.append(cv);
      this.graph = new Graph(cv); this.graph.config(st.graph); ctx.graph = this.graph;
    } else this.graph = null;
    if (st.setup) this.scene = st.setup(ctx) || null;
    if (st.view) { Object.assign(this.orbit, { tyaw: st.view.yaw ?? this.orbit.tyaw, tpitch: st.view.pitch ?? this.orbit.tpitch, tdist: st.view.dist ?? this.orbit.tdist }); }
    if (st.say && !this.replaySilent) g.dialogue.say(st.say.map ? st.say.map(t => ({ who: 'isaac', text: t })) : [{ who: 'isaac', text: st.say }]);
    g.audio.sfx('holo', { vol: 0.4 });
    this.stage.scale.setScalar(0.001);
    this.popT = 0;
  }
  makeControl(c, ctx) {
    if (c.type === 'slider') {
      const val = el('b', {}, '');
      const inp = el('input', { type: 'range', min: c.min, max: c.max, step: c.step, value: c.value });
      const upd = () => { const v = +inp.value; this.params[c.id] = v; val.textContent = c.fmt ? c.fmt(v) : String(v).replace('.', ','); inp.style.setProperty('--p', ((v - c.min) / (c.max - c.min) * 100) + '%'); c.onChange && c.onChange(v, ctx); };
      inp.addEventListener('input', upd); upd();
      return el('div', { class: 'ctrl' }, el('div', { class: 'lb' }, el('span', {}, c.label), val), inp);
    }
    if (c.type === 'toggle') {
      this.params[c.id] = !!c.value;
      const b = el('button', { class: 'btn small' + (c.value ? ' primary' : '') }, c.label);
      b.addEventListener('click', () => { this.params[c.id] = !this.params[c.id]; b.classList.toggle('primary', this.params[c.id]); c.onChange && c.onChange(this.params[c.id], ctx); });
      return el('div', { class: 'ctrlbtns' }, b);
    }
    if (c.type === 'choice') {
      this.params[c.id] = c.value;
      const wrap = el('div', { class: 'seg' });
      const bs = c.options.map(([v, l]) => { const b = el('button', { class: v === c.value ? 'on' : '' }, l); b.addEventListener('click', () => { this.params[c.id] = v; bs.forEach(x => x.classList.remove('on')); b.classList.add('on'); c.onChange && c.onChange(v, ctx); }); return b; });
      wrap.append(...bs);
      return el('div', { class: 'ctrl' }, el('div', { class: 'lb' }, el('span', {}, c.label)), wrap);
    }
    if (c.type === 'note') return el('div', { class: 'muted', style: { fontSize: '.84em', margin: '6px 0 10px', lineHeight: 1.5 }, html: rich(c.html) });
    return el('div');
  }
  setReadout(rows) { if (!this.readoutEl) return; this.readoutEl.innerHTML = rows.map(([a, b]) => `<span>${a.includes('$') ? rich(a) : escapeHtml(a)}</span><span>${String(b).includes('$') ? rich(b) : escapeHtml(String(b))}</span>`).join(''); }
  renderQuiz() {
    const q = this.def.quiz; const g = this.g;
    this.bodyEl.innerHTML = `<h3 style="font-family:var(--f-head);margin:0 0 4px">Проверка понимания</h3><div class="muted" style="font-size:.85em;margin-bottom:12px">Ответьте на все вопросы, чтобы записать формулы в блокнот.</div>`;
    const quiz = el('div', { class: 'quiz' });
    q.forEach((item, i) => {
      const box = el('div', { style: { marginBottom: '18px' } });
      box.append(el('div', { class: 'q', html: `${i + 1}. ${rich(item.q)}` }));
      const opts = el('div', { class: 'opts' }); const ex = el('div', { class: 'ex' });
      item.opts.forEach((o, k) => {
        const b = el('div', { class: 'opt' + (this.answers[i] === k ? (k === item.right ? ' right' : ' wrong') : ''), html: rich(o) });
        b.addEventListener('click', () => {
          if (this.answers[i] === item.right) return;
          this.answers[i] = k;
          const ok = k === item.right;
          if (this.quizFirst[i] === undefined) { this.quizFirst[i] = ok; if (!this.replay) { const ts = topicStats(g.save, this.def.topic); ok ? ts.quizRight++ : ts.quizWrong++; } }
          b.className = 'opt ' + (ok ? 'right' : 'wrong');
          ex.innerHTML = (ok ? '<b style="color:var(--green)">Верно.</b> ' : '<b style="color:#ff9d96">Не совсем.</b> ') + rich(ok ? item.ex : (item.why?.[k] || item.ex));
          g.audio.sfx(ok ? 'chime' : 'fail', { vol: 0.6 });
          this.nextBtn.disabled = !this.quizDone();
        });
        opts.append(b);
      });
      box.append(opts, ex); quiz.append(box);
    });
    this.bodyEl.append(quiz);
    this.nextBtn.disabled = !this.quizDone();
    this.ctlEl.append(el('div', { class: 'muted', style: { lineHeight: 1.6, fontSize: '.9em' }, html: rich(this.def.summary || '') }));
    g.dialogue.say([{ who: 'isaac', text: 'Проверим, что ты понял. Ответь на вопросы — потом я запишу формулы в твой блокнот.' }]);
  }
  update(dt) {
    if (!this.active) return;
    const o = this.orbit, cam = this.g.engine.camera;
    o.yaw = damp(o.yaw, o.tyaw, 6, dt); o.pitch = damp(o.pitch, o.tpitch, 6, dt); o.dist = damp(o.dist, o.tdist, 6, dt);
    const wt = this.anchor.localToWorld(o.target.clone());
    cam.position.set(wt.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, wt.y + Math.sin(o.pitch) * o.dist, wt.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    cam.lookAt(wt);
    this.popT = Math.min(1, (this.popT || 0) + dt * 2.2);
    const s = this.popT < 1 ? 1 - Math.pow(1 - this.popT, 3) * Math.cos(this.popT * 6) * 1 : 1;
    this.stage.scale.setScalar(Math.max(0.001, s));
    const sdt = this.paused ? 0 : dt * this.slow;
    this.time += sdt;
    if (this.scene && this.scene.update) { try { this.scene.update(sdt, this.time, this.params, dt); } catch (e) { console.error(e); this.scene.update = null; } }
    if (this.graph) { this.gAcc = (this.gAcc || 0) + dt; if (this.gAcc > 0.06) { this.gAcc = 0; this.graph.draw(); } }
  }
  async finish(aborted = false, fromClose = false) {
    if (!this.active) return;
    this.active = false;
    const g = this.g;
    document.body.classList.remove('lesson-on');
    g.dialogue.stop();
    this.clearStage(); this.stage.removeFromParent();
    this.bindOrbit(false);
    if (!fromClose) g.ui.close('lesson', true);
    const res = { aborted, def: this.def };
    if (!aborted && !this.replay) {
      g.save.lessons[this.def.id] = { done: true, at: Date.now(), quiz: { ...this.quizFirst } };
    }
    g.emit('lessonend', this.def.id, res);
    this.resolve && this.resolve(res);
  }
}
