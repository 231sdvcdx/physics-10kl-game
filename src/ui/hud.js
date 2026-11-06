// In-game HUD: crosshair, prompts, objective, toasts, tool readout, overlays (fade/flash/blink/letterbox/titles)
import { el, wait, escapeHtml } from '../core/util.js';

export class HUD {
  constructor(game, root) {
    this.g = game;
    this.root = el('div', { id: 'hud' });
    this.xhair = el('div', { id: 'xhair' });
    this.prompt = el('div', { id: 'prompt' });
    this.objective = el('div', { id: 'objective' });
    this.toasts = el('div', { id: 'toasts' });
    this.keyhints = el('div', { id: 'keyhints' });
    this.toolhud = el('div', { id: 'toolhud' });
    this.fps = el('div', { id: 'fps', class: 'hidden' });
    this.labels = el('div', { id: 'labels' });
    this.visionEl = el('div', { id: 'vision' }, el('div', { class: 'frame' }), el('div', { class: 'lbl' }, 'ФИЗИЧЕСКОЕ ЗРЕНИЕ'), el('div', { class: 'layers' }));
    this.root.append(this.labels, this.visionEl, this.xhair, this.prompt, this.objective, this.toasts, this.keyhints, this.toolhud, this.fps);
    this.letterbox = el('div', { id: 'letterbox' });
    this.fadeEl = el('div', { id: 'fade' });
    this.flashEl = el('div', { id: 'flash' });
    this.blinkEl = el('div', { id: 'blink' });
    this.title = el('div', { id: 'titlecard' }, el('div', { class: 'a' }), el('div', { class: 'b' }), el('div', { class: 'c' }));
    this.typerEl = el('div', { id: 'typer' });
    this.skipEl = el('div', { id: 'skip' }, el('span', { class: 'k' }, 'Пробел'), ' удерживайте — пропустить');
    this.clickHint = el('div', { id: 'clickhint', class: 'hidden' }, 'Кликните по экрану, чтобы продолжить');
    this.writeIn = el('div', { class: 'panel hidden', style: { right: '26px', top: '38%', width: '340px', padding: '14px 16px' } });
    root.append(this.root, this.letterbox, this.blinkEl, this.fadeEl, this.flashEl, this.title, this.typerEl, this.skipEl, this.clickHint, this.writeIn);
    this.promptKey = '';
    this.fpsAcc = 0; this.fpsN = 0;
    this.writeQueue = []; this.writing = false;
  }
  show(on) { this.root.classList.toggle('off', !on); }
  setPrompt(text, sub = '', key = 'E') {
    const k = text ? key + '|' + text + '|' + sub : '';
    if (k === this.promptKey) return;
    this.promptKey = k;
    if (!text) { this.prompt.classList.remove('on'); this.xhair.classList.remove('on'); return; }
    this.prompt.innerHTML = `<span class="k">${escapeHtml(key)}</span>${escapeHtml(text)}${sub ? `<span class="sub">${escapeHtml(sub)}</span>` : ''}`;
    this.prompt.classList.add('on'); this.xhair.classList.add('on');
  }
  setObjective(title, text, sub = '', zone = '') {
    if (!text) { this.objective.innerHTML = ''; return; }
    const changed = this.objective.dataset.k !== text;
    this.objective.dataset.k = text;
    this.objective.innerHTML = `<div class="t">${escapeHtml(title || 'Задача')}</div><div class="o">${escapeHtml(text)}${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</div>${zone ? `<div class="z">${escapeHtml(zone)}</div>` : ''}`;
    if (changed) { this.objective.animate([{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' }); }
  }
  toast(head, body, cls = '', dur = 4.5) {
    const t = el('div', { class: 'toast ' + cls }, el('div', { class: 'h' }, head), el('div', { class: 'b', html: body }));
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, dur * 1000);
  }
  setKeyhints(list) {
    this.keyhints.innerHTML = list.map(([k, t]) => `<span><span class="k">${escapeHtml(k)}</span> ${escapeHtml(t)}</span>`).join('');
  }
  tool(name, value, sub = '', ticks = null) {
    if (!name) { this.toolhud.classList.remove('on'); return; }
    this.toolhud.classList.add('on');
    this.toolhud.innerHTML = `<div class="n">${escapeHtml(name)}</div><div class="v">${value}</div><div class="s">${sub}</div>${ticks ? `<div class="tl">${ticks.map(t => `<i class="${t ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
  }
  setFps(show) { this.fps.classList.toggle('hidden', !show); }
  tickFps(dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps.textContent = `${Math.round(this.fpsN / this.fpsAcc)} FPS · ${this.g.engine.quality}`; this.fpsAcc = 0; this.fpsN = 0; }
  }
  fade(to, dur = 1) { this.fadeEl.style.transition = `opacity ${dur}s`; this.fadeEl.style.opacity = to; return wait(dur * 1000); }
  flash(dur = 1.2, peak = 1) {
    const f = this.flashEl; f.style.transition = 'none'; f.style.opacity = peak; void f.offsetWidth;
    f.style.transition = `opacity ${dur}s ease-out`; f.style.opacity = 0;
  }
  blink(closed, dur = 1.2) { this.blinkEl.querySelectorAll; this.blinkEl.style.setProperty('--d', dur + 's'); this.blinkEl.classList.toggle('closed', closed); return wait(dur * 1000); }
  setLetterbox(on) { this.letterbox.classList.toggle('on', on); }
  async titleCard(a, b, c = '', hold = 3.2) {
    const [ea, eb, ec] = this.title.children; ea.textContent = a; eb.textContent = b; ec.textContent = c;
    this.title.classList.add('on'); await wait(hold * 1000); this.title.classList.remove('on'); await wait(1200);
  }
  async typer(text, { speed = 38, hold = 2.2, sound = true } = {}) {
    this.typerEl.getAnimations().forEach(a => a.cancel()); this.typerEl.textContent = ''; this.typerEl.style.opacity = 1;
    for (let i = 0; i < text.length; i++) {
      if (this.g.cut?.skipping) break;
      this.typerEl.textContent = text.slice(0, i + 1);
      if (sound && text[i] !== ' ' && i % 2 === 0) this.g.audio.sfx('type');
      await wait(text[i] === '\n' ? 380 : speed);
    }
    this.typerEl.textContent = text;
    if (!this.g.cut?.skipping) await wait(hold * 1000);
    this.typerEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    await wait(this.g.cut?.skipping ? 50 : 600);
    this.typerEl.textContent = '';
  }
  showSkip(on) { this.skipEl.classList.toggle('on', on); }
  showClickHint(on) { this.clickHint.classList.toggle('hidden', !on); }
  // animated "formula is being written into the notebook"
  formulaWrite(name, html) { this.writeQueue.push({ name, html }); if (!this.writing) this.pumpWrite(); }
  async pumpWrite() {
    const it = this.writeQueue.shift(); if (!it) { this.writing = false; return; }
    this.writing = true;
    const w = this.writeIn;
    w.innerHTML = `<div class="scan"></div><div style="font-family:var(--f-head);font-weight:800;font-size:.72em;letter-spacing:.25em;color:var(--amber);text-transform:uppercase">Запись в блокнот формул</div><div style="margin-top:4px;font-weight:600">${escapeHtml(it.name)}</div><div class="writing" style="margin-top:10px;font-size:1.35em;text-align:center;padding:8px 0">${it.html}</div><div class="muted" style="font-size:.78em;text-align:right"><span class="k">N</span> открыть блокнот</div>`;
    w.classList.remove('hidden');
    w.animate([{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease-out' });
    this.g.audio.sfx('write');
    await wait(2600);
    await w.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(30px)' }], { duration: 350 }).finished.catch(() => { });
    w.classList.add('hidden');
    this.pumpWrite();
  }
}
