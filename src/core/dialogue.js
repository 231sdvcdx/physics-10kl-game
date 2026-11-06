// Subtitles + browser speech synthesis for ISAAC, the professor and others
import { el, wait } from './util.js';

export const SPEAKERS = {
  isaac:    { name: 'ИСААК', color: '#62e6ff', pitch: 0.82, rate: 1.08, prefer: ['Dmitry', 'Pavel', 'Yuri', 'Google русский', 'Russian'] },
  lomov:    { name: 'Проф. Ломов', color: '#ffb547', pitch: 0.62, rate: 0.93, prefer: ['Dmitry', 'Pavel', 'Google русский'] },
  director: { name: 'Директор Корнеев', color: '#ff8a7a', pitch: 1.0, rate: 1.04, prefer: ['Pavel', 'Dmitry', 'Google русский'] },
  pa:       { name: 'Оповещение', color: '#b9c7cc', pitch: 1.1, rate: 1.0, prefer: ['Svetlana', 'Irina', 'Dariya', 'Milena', 'Google русский'] },
  you:      { name: 'Вы', color: '#e8e2cf', pitch: 1.1, rate: 1.05, prefer: [] },
  system:   { name: 'Система', color: '#9fc4d0', pitch: 1, rate: 1, prefer: [] },
};
const GL = '█▓▒░#%&@$*!?<>/\\|=+';

export class Dialogue {
  constructor(game, root) {
    this.g = game; this.root = root; this.queue = []; this.busy = false; this.voices = [];
    this.box = el('div', { id: 'subs' }); root.append(this.box);
    this.skipFlag = false; this.paused = false; this.speaking = null;
    const load = () => { try { this.voices = speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang)); } catch (e) { } };
    try { load(); speechSynthesis.onvoiceschanged = load; } catch (e) { }
  }
  voiceFor(sp) {
    if (!this.voices.length) return null;
    for (const p of sp.prefer || []) { const v = this.voices.find(v => v.name.includes(p)); if (v) return v; }
    return this.voices[0];
  }
  get ttsOn() { return this.g.settings.tts && 'speechSynthesis' in window && this.voices.length > 0; }
  // lines: [{who, text, glitch, pause}] ; returns promise when all lines finished
  say(lines, opts = {}) {
    if (!Array.isArray(lines)) lines = [lines];
    lines = lines.map(l => typeof l === 'string' ? { who: 'isaac', text: l } : l);
    // flush: drop lines that are still waiting in the queue (stale chatter) so the new event is voiced right after the current line
    if (opts.flush && this.queue.length) { this.queue.forEach(j => j.res()); this.queue = []; }
    return new Promise(res => { this.queue.push({ lines, res, opts }); this.pump(); });
  }
  async pump() {
    if (this.busy) return; const job = this.queue.shift(); if (!job) return;
    this.busy = true;
    for (const l of job.lines) { if (this.cancelled) break; await this.playLine(l); if (l.pause) await wait(l.pause * 1000); }
    this.cancelled = false;
    this.busy = false; job.res(); this.pump();
  }
  stop() { this.cancelled = this.busy; this.queue.forEach(j => j.res()); this.queue = []; this.skipFlag = true; try { speechSynthesis.cancel(); } catch (e) { } }
  skip() { this.skipFlag = true; try { speechSynthesis.cancel(); } catch (e) { } }
  async playLine(l) {
    const sp = SPEAKERS[l.who] || SPEAKERS.system;
    const text = l.text;
    this.skipFlag = false;
    this.g.emit('line', l);
    const showSubs = this.g.settings.subs || !this.ttsOn;
    const line = el('div', { class: 'line' + (l.glitch ? ' glitch' : '') });
    const who = el('span', { class: 'who', style: { color: sp.color } }, sp.name);
    const tx = el('span', {});
    line.append(who, tx);
    this.box.innerHTML = ''; if (showSubs) this.box.append(line);
    this.box.style.fontSize = (this.g.settings.subSize || 1) + 'em';
    const baseDur = 1.1 + text.length * 0.058;
    let ended = false; let ttsDone = !this.ttsOn;
    if (this.ttsOn && !l.silent) {
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, '').replace(/—/g, ','));
        const v = this.voiceFor(sp); if (v) u.voice = v; u.lang = 'ru-RU';
        u.pitch = l.pitch ?? sp.pitch; u.rate = l.rate ?? sp.rate; u.volume = this.g.settings.voice ?? 1;
        u.onend = () => { ttsDone = true; }; u.onerror = () => { ttsDone = true; };
        speechSynthesis.cancel(); speechSynthesis.speak(u); this.speaking = u;
      } catch (e) { ttsDone = true; }
    } else if (l.who === 'isaac' && !l.silent) {
      for (let i = 0; i < Math.min(6, 2 + text.length / 25); i++) this.g.audio.sfx('beep', { delay: i * 0.09, f: 900 + Math.random() * 900, vol: 0.5 });
    }
    // typewriter
    const t0 = performance.now(); const typeDur = Math.min(1600, text.length * 22);
    let glitchT = l.glitch ? 900 : 0;
    await new Promise(res => {
      const step = () => {
        if (this.skipFlag) { res(); return; }
        if (this.paused) { requestAnimationFrame(step); return; }
        const e = performance.now() - t0;
        const n = Math.min(text.length, Math.floor(text.length * e / typeDur));
        let shown = text.slice(0, n);
        if (glitchT && e < glitchT) shown = shown.split('').map(c => c !== ' ' && Math.random() < 0.35 * (1 - e / glitchT) ? GL[Math.floor(Math.random() * GL.length)] : c).join('');
        tx.textContent = shown;
        const minDone = e > baseDur * 1000 * (this.ttsOn ? 0.5 : 1);
        if (minDone && ttsDone && e > typeDur + 300) { res(); return; }
        if (e > baseDur * 1000 * 3 + 4000) { res(); return; } // safety
        requestAnimationFrame(step);
      };
      step();
    });
    tx.textContent = text;
    line.classList.remove('glitch');
    await wait(this.skipFlag ? 50 : 350);
    if (this.box.contains(line)) this.box.innerHTML = '';
    this.g.emit('lineend', l);
  }
  setPaused(p) { this.paused = p; try { p ? speechSynthesis.pause() : speechSynthesis.resume(); } catch (e) { } }
}
