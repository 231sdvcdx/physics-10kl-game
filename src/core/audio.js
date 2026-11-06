// Procedural audio: generative music per sector, synthesized SFX, positional loops
import * as THREE from 'three';

const NOTE = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3();

export class AudioSys {
  constructor() { this.ctx = null; this.vol = { master: 0.8, music: 0.55, sfx: 0.8, voice: 1 }; this.loops = new Set(); this.theme = null; this.themeName = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5;
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.sfxBus);
    this.reverb = c.createConvolver(); this.reverb.buffer = this.makeIR(3.2, 2.6);
    this.wet = c.createGain(); this.wet.gain.value = 0.55; this.reverb.connect(this.wet); this.wet.connect(this.master);
    this.musicSend = c.createGain(); this.musicSend.gain.value = 0.7; this.music.connect(this.musicSend); this.musicSend.connect(this.reverb);
    this.sfxSend = c.createGain(); this.sfxSend.gain.value = 0.25; this.sfxBus.connect(this.sfxSend); this.sfxSend.connect(this.reverb);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.scheduler = setInterval(() => this.tick(), 90);
    if (this.pendingTheme) { const t = this.pendingTheme; this.pendingTheme = null; this.playMusic(t); }
  }
  makeIR(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  setVolumes(v) { Object.assign(this.vol, v); this.apply(); }
  apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(this.vol.master, t, 0.05); this.music.gain.setTargetAtTime(this.vol.music * 0.9, t, 0.3); this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05); }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  // ---------- primitives ----------
  osc(type, f, t0, dur, vol, dest, { attack = 0.005, release = null, f2 = null, detune = 0 } = {}) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (detune) o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (release ?? dur));
    o.connect(g); g.connect(dest || this.sfxBus); o.start(t0); o.stop(t0 + (release ?? dur) + 0.05);
    return { o, g };
  }
  noise(t0, dur, vol, { type = 'lowpass', f = 1000, f2 = null, q = 0.8, attack = 0.005, dest = null } = {}) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfxBus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
    return { s, fl, g };
  }
  metal(t0, base, vol, decay = 0.5, dest) { [1, 2.76, 5.4, 8.93].forEach((m, i) => this.osc('sine', base * m * (1 + (Math.random() - .5) * 0.02), t0, decay / (1 + i * 0.6), vol / (1 + i), dest)); }
  // ---------- named SFX ----------
  sfx(name, opts = {}) {
    if (!this.ctx) return; const t = this.t + (opts.delay || 0); const v = opts.vol ?? 1;
    switch (name) {
      case 'click': this.osc('sine', 1250, t, 0.05, 0.12 * v); break;
      case 'hover': this.osc('sine', 880, t, 0.03, 0.04 * v); break;
      case 'open': this.osc('sine', 520, t, 0.09, 0.08 * v, null, { f2: 900 }); this.noise(t, 0.12, 0.03 * v, { type: 'highpass', f: 3000 }); break;
      case 'close': this.osc('sine', 800, t, 0.09, 0.07 * v, null, { f2: 450 }); break;
      case 'pickup': [0, 4, 7, 12].forEach((n, i) => this.osc('triangle', NOTE(74 + n), t + i * 0.06, 0.5, 0.09 * v)); this.noise(t, 0.4, 0.03 * v, { type: 'highpass', f: 6000 }); break;
      case 'write': for (let i = 0; i < 14; i++) this.noise(t + i * 0.085 + Math.random() * 0.03, 0.07, 0.05 * v, { type: 'bandpass', f: 2500 + Math.random() * 2500, q: 2 }); break;
      case 'success': [0, 4, 7, 12, 16].forEach((n, i) => { this.osc('sine', NOTE(72 + n), t + i * 0.09, 1.2, 0.1 * v); this.osc('triangle', NOTE(60 + n), t + i * 0.09, 0.8, 0.04 * v); }); break;
      case 'star': [0, 7, 12].forEach((n, i) => this.osc('sine', NOTE(84 + n), t + i * 0.07, 0.9, 0.07 * v)); break;
      case 'fail': this.osc('square', 196, t, 0.22, 0.06 * v, null, { f2: 150 }); this.osc('square', 147, t + 0.22, 0.32, 0.06 * v, null, { f2: 110 }); break;
      case 'error': this.osc('sawtooth', 110, t, 0.25, 0.05 * v); break;
      case 'laser': this.osc('sine', 2400, t, 0.08, 0.06 * v); this.osc('sine', 3600, t + 0.05, 0.05, 0.03 * v); break;
      case 'beep': this.osc('sine', opts.f || 1500, t, 0.06, 0.05 * v); break;
      case 'clank': this.metal(t, 180 + Math.random() * 60, 0.12 * v, 0.7); this.noise(t, 0.05, 0.1 * v, { f: 3000 }); break;
      case 'thud': this.osc('sine', 70, t, 0.25, 0.25 * v, null, { f2: 40 }); this.noise(t, 0.12, 0.08 * v, { f: 400 }); break;
      case 'jump': this.noise(t, 0.18, 0.025 * v, { type: 'bandpass', f: 700, q: 0.6 }); break;
      case 'steam': this.noise(t, opts.dur || 1.6, 0.12 * v, { type: 'highpass', f: 1800, attack: 0.05 }); break;
      case 'servo': this.osc('sawtooth', 110, t, opts.dur || 2, 0.035 * v, null, { f2: 240, attack: 0.15 }); this.noise(t, opts.dur || 2, 0.03 * v, { type: 'bandpass', f: 600, q: 1.5, attack: 0.2 }); break;
      case 'door': this.sfx('servo', { dur: opts.dur || 2.4, vol: v }); this.sfx('steam', { delay: 0.1, dur: 1.2, vol: 0.6 * v }); this.sfx('thud', { delay: (opts.dur || 2.4), vol: v }); break;
      case 'spark': for (let i = 0; i < 6; i++) this.noise(t + Math.random() * 0.25, 0.02 + Math.random() * 0.03, (0.05 + Math.random() * 0.1) * v, { type: 'highpass', f: 2500 + Math.random() * 3000 }); break;
      case 'holo': this.osc('sine', 300, t, 1.0, 0.06 * v, null, { f2: 1400, attack: 0.3 }); this.osc('sine', 450, t, 1.0, 0.04 * v, null, { f2: 2100, attack: 0.3 }); this.noise(t, 0.9, 0.02 * v, { type: 'highpass', f: 5000, attack: 0.3 }); break;
      case 'glitch': for (let i = 0; i < 5; i++) this.osc('square', 200 + Math.random() * 1800, t + i * 0.035, 0.03, 0.03 * v); break;
      case 'boom': this.noise(t, 3.5, 0.9 * v, { f: 2500, f2: 60, attack: 0.01 }); this.osc('sine', 60, t, 3, 0.7 * v, null, { f2: 22 }); this.osc('sine', 38, t + 0.05, 2.5, 0.5 * v); break;
      case 'whine': this.osc('sine', 1800, t, opts.dur || 2.5, 0.05 * v, null, { f2: 7000, attack: opts.dur || 2.0 }); break;
      case 'tinnitus': { const o = this.osc('sine', 4300, t, 7, 0.035 * v, null, { attack: 0.05 }); break; }
      case 'heart': [0, 0.28].forEach(d => { this.osc('sine', 52, t + d, 0.16, 0.35 * v, null, { f2: 38 }); }); break;
      case 'chime': [0, 5, 9].forEach((n, i) => this.osc('sine', NOTE(79 + n), t + i * 0.12, 1.4, 0.06 * v)); break;
      case 'lift_stop': this.metal(t, 90, 0.2 * v, 1.2); this.osc('sine', 55, t, 0.4, 0.3 * v); this.noise(t, 0.3, 0.1 * v, { f: 900 }); break;
      case 'alarm1': [0, 0.5].forEach((d, i) => this.osc('square', i ? 660 : 880, t + d, 0.45, 0.025 * v, null, { attack: 0.02 })); break;
      case 'type': this.osc('square', 2000 + Math.random() * 600, t, 0.012, 0.012 * v); break;
      case 'page': this.noise(t, 0.25, 0.06 * v, { type: 'bandpass', f: 1800, f2: 700, q: 0.7, attack: 0.02 }); break;
      case 'tick': this.osc('square', 3000, t, 0.01, 0.03 * v); break;
    }
  }
  footstep(surface = 'concrete', k = 1) {
    if (!this.ctx) return; const t = this.t; const r = 0.85 + Math.random() * 0.3;
    if (surface === 'metal' || surface === 'plate') {
      this.noise(t, 0.09, 0.08 * k, { type: 'bandpass', f: 1800 * r, q: 1.2 });
      this.metal(t, 340 * r, 0.025 * k, 0.25);
      this.osc('sine', 85 * r, t, 0.08, 0.08 * k);
    } else if (surface === 'tile') {
      this.noise(t, 0.05, 0.07 * k, { type: 'bandpass', f: 2600 * r, q: 1.5 });
      this.osc('sine', 120 * r, t, 0.05, 0.06 * k);
    } else {
      this.noise(t, 0.1, 0.09 * k, { type: 'lowpass', f: 900 * r, q: 0.7 });
      this.noise(t, 0.04, 0.03 * k, { type: 'highpass', f: 3500 * r });
      this.osc('sine', 75 * r, t, 0.07, 0.09 * k);
    }
  }
  // ---------- loops (optionally positional) ----------
  loop(kind, { vol = 0.3, pos = null, ref = 3, rate = 1 } = {}) {
    if (!this.ctx) return { stop() { }, set() { }, setPos() { } };
    const c = this.ctx; const out = c.createGain(); out.gain.value = 0;
    let dest = this.amb; let panner = null;
    if (pos) { panner = c.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = ref; panner.rolloffFactor = 1.2; panner.maxDistance = 80; out.connect(panner); panner.connect(this.amb); panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z; }
    else out.connect(dest);
    const nodes = [];
    const src = () => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(0, Math.random()); nodes.push(s); return s; };
    const flt = (type, f, q = 0.7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const os = (type, f, g) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = g; o.connect(gg); o.start(); nodes.push(o); return { o, gg }; };
    const ctl = { rate: null };
    if (kind === 'hum') { [50, 100, 150, 250].forEach((f, i) => { const { gg } = os(i ? 'sine' : 'sawtooth', f, [0.25, 0.4, 0.15, 0.08][i]); const l = flt('lowpass', 600); gg.connect(l); l.connect(out); }); }
    else if (kind === 'steam') { const s = src(); const f = flt('highpass', 1500); s.connect(f); const f2 = flt('peaking', 4000, 0.5); f2.gain.value = 6; f.connect(f2); f2.connect(out); }
    else if (kind === 'wind') { const s = src(); const f = flt('bandpass', 400, 0.5); s.connect(f); f.connect(out); const lfo = os('sine', 0.08, 250); lfo.gg.connect(f.frequency); }
    else if (kind === 'motor') { const a = os('sawtooth', 62, 0.3); const b = os('square', 124, 0.08); const l = flt('lowpass', 500); a.gg.connect(l); b.gg.connect(l); const s = src(); const nf = flt('bandpass', 900, 1); const ng = c.createGain(); ng.gain.value = 0.25; s.connect(nf); nf.connect(ng); ng.connect(l); l.connect(out); ctl.rate = v => { a.o.frequency.setTargetAtTime(62 * v, c.currentTime, 0.2); b.o.frequency.setTargetAtTime(124 * v, c.currentTime, 0.2); }; }
    else if (kind === 'sparks') { const s = src(); const f = flt('highpass', 3000); const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); const iv = setInterval(() => { const t = c.currentTime; for (let i = 0; i < 3; i++) { const tt = t + Math.random() * 0.3; g.gain.setValueAtTime(Math.random() * 0.9, tt); g.gain.setValueAtTime(0, tt + 0.02 + Math.random() * 0.04); } }, 300); ctl.iv = iv; }
    else if (kind === 'core') { [36.7, 55, 73.4].forEach((f, i) => { const { o, gg } = os(i === 1 ? 'sawtooth' : 'sine', f, [0.5, 0.12, 0.25][i]); const l = flt('lowpass', 220); gg.connect(l); l.connect(out); }); const s = src(); const f = flt('bandpass', 180, 0.6); const g = c.createGain(); g.gain.value = 0.25; s.connect(f); f.connect(g); g.connect(out); }
    else if (kind === 'alarm') { const { o, gg } = os('square', 700, 0.12); const l = flt('lowpass', 1800); gg.connect(l); l.connect(out); const lfo = os('square', 0.9, 160); lfo.gg.connect(o.frequency); }
    else if (kind === 'holo') { [220, 330.5, 440.3].forEach((f, i) => { const { gg } = os('sine', f, 0.08); gg.connect(out); }); const lfo = os('sine', 5.5, 0.03); lfo.gg.connect(out.gain); }
    out.gain.setTargetAtTime(vol, c.currentTime, 0.3);
    const h = {
      stop: (fade = 0.6) => { out.gain.setTargetAtTime(0, c.currentTime, fade / 3); setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (e) { } }); if (ctl.iv) clearInterval(ctl.iv); out.disconnect(); }, fade * 1000 + 300); this.loops.delete(h); },
      set: (v, tc = 0.2) => out.gain.setTargetAtTime(v, c.currentTime, tc),
      setPos: p => { if (panner) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; } },
      rate: v => ctl.rate && ctl.rate(v),
    };
    this.loops.add(h);
    return h;
  }
  stopAllLoops() { [...this.loops].forEach(l => l.stop(0.3)); }
  updateListener(cam) {
    if (!this.ctx) return; const L = this.ctx.listener;
    cam.getWorldPosition(_p); _f.set(0, 0, -1).applyQuaternion(cam.quaternion); _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { const t = this.ctx.currentTime; L.positionX.setTargetAtTime(_p.x, t, 0.02); L.positionY.setTargetAtTime(_p.y, t, 0.02); L.positionZ.setTargetAtTime(_p.z, t, 0.02); L.forwardX.setTargetAtTime(_f.x, t, 0.02); L.forwardY.setTargetAtTime(_f.y, t, 0.02); L.forwardZ.setTargetAtTime(_f.z, t, 0.02); L.upX.setTargetAtTime(_u.x, t, 0.02); L.upY.setTargetAtTime(_u.y, t, 0.02); L.upZ.setTargetAtTime(_u.z, t, 0.02); }
    else { L.setPosition(_p.x, _p.y, _p.z); L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); }
  }
  // ---------- generative music ----------
  playMusic(name) {
    if (!this.ctx) { this.pendingTheme = name; return; }
    if (this.themeName === name) return;
    if (this.theme) { const old = this.theme; old.g.gain.setTargetAtTime(0, this.t, 1.2); setTimeout(() => { old.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); old.g.disconnect(); }, 5000); }
    this.themeName = name; this.theme = null;
    if (!name || !THEMES[name]) return;
    const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.music); g.gain.setTargetAtTime(1, this.t, 1.5);
    this.theme = { name, g, nodes: [], next: this.t + 0.2, step: 0, def: THEMES[name], state: {} };
    THEMES[name].start?.(this, this.theme);
  }
  tick() {
    const th = this.theme; if (!th || !this.ctx) return;
    while (th.next < this.t + 0.5) { th.def.step(this, th, th.next, th.step++); th.next += th.def.stepDur; }
  }
  // musical helpers
  pad(th, t, notes, dur, vol = 0.05, cutoff = 900, type = 'sawtooth') {
    const c = this.ctx; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.4;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(th.g);
    for (const n of notes) for (const dt of [-7, 7]) { const o = c.createOscillator(); o.type = type; o.frequency.value = NOTE(n); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.1); }
  }
  bell(th, t, n, vol = 0.05, dec = 3) { this.osc('sine', NOTE(n), t, dec, vol, th.g, { attack: 0.004 }); this.osc('sine', NOTE(n) * 2.01, t, dec * 0.4, vol * 0.3, th.g, { attack: 0.004 }); this.osc('sine', NOTE(n) * 3.02, t, dec * 0.2, vol * 0.12, th.g); }
  pluck(th, t, n, vol = 0.04, cutoff = 2200) {
    const c = this.ctx; const o = c.createOscillator(); o.type = 'square'; o.frequency.value = NOTE(n);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(f); f.connect(g); g.connect(th.g); o.start(t); o.stop(t + 0.6);
  }
  drone(th, notes, vol = 0.05, cutoff = 400) {
    const c = this.ctx; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 2;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const lg = c.createGain(); lg.gain.value = cutoff * 0.5; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); th.nodes.push(lfo);
    const g = c.createGain(); g.gain.value = vol; f.connect(g); g.connect(th.g);
    for (const n of notes) for (const d of [-6, 5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = d; o.connect(f); o.start(); th.nodes.push(o); }
  }
}

const DMIN = [62, 65, 69, 72, 74, 77, 81]; // D F A C D F A
const THEMES = {
  menu: {
    stepDur: 0.5,
    start(a, th) { a.drone(th, [38, 45], 0.035, 300); },
    step(a, th, t, i) {
      const bar = i % 32;
      if (bar === 0) a.pad(th, t, [50, 57, 62, 65], 15, 0.028, 700);
      if (bar === 16) a.pad(th, t, [46, 53, 58, 62], 15, 0.028, 700);
      if (i % 4 === 2 && Math.random() < 0.55) a.bell(th, t, DMIN[Math.floor(Math.random() * DMIN.length)] + 12, 0.035, 4);
    },
  },
  prologue: {
    stepDur: 0.5,
    start(a, th) { a.drone(th, [26, 33, 38], 0.03, 220); },
    step(a, th, t, i) {
      const bar = i % 40;
      if (bar === 0) a.pad(th, t, [50, 53, 57], 19, 0.022, 500);
      if (bar === 20) a.pad(th, t, [48, 51, 55, 58], 19, 0.022, 500);
      if (i % 6 === 3 && Math.random() < 0.35) a.bell(th, t, DMIN[Math.floor(Math.random() * 4)] + (Math.random() < 0.5 ? 0 : 12), 0.03, 5);
      if (i % 16 === 0) a.osc('sine', 36.7, t, 1.4, 0.06, th.g, { attack: 0.3 });
    },
  },
  holo: {
    stepDur: 0.25,
    start(a, th) { a.drone(th, [38, 50], 0.022, 500); },
    step(a, th, t, i) {
      const arp = [62, 69, 74, 77, 81, 77, 74, 69]; const arp2 = [60, 67, 72, 76, 79, 76, 72, 67];
      const sec = Math.floor(i / 32) % 2; const n = (sec ? arp2 : arp)[i % 8];
      if (i % 2 === 0) a.pluck(th, t, n, 0.022, 1800);
      if (i % 32 === 0) a.pad(th, t, sec ? [48, 55, 60, 64] : [50, 57, 62, 65], 8, 0.025, 900, 'triangle');
      if (i % 16 === 8 && Math.random() < 0.5) a.bell(th, t, n + 12, 0.025, 3);
    },
  },
  tension: {
    stepDur: 0.25,
    start(a, th) { a.drone(th, [26, 27], 0.04, 260); },
    step(a, th, t, i) {
      if (i % 4 === 0) a.osc('sine', 41.2, t, 0.35, 0.12, th.g, { f2: 30 });
      if (i % 8 === 6) a.noise(t, 0.08, 0.04, { type: 'highpass', f: 6000, dest: th.g });
      if (i % 32 === 0) a.pad(th, t, [50, 51, 57], 8, 0.02, 600);
    },
  },
  mech: {
    stepDur: 0.25,
    start(a, th) { a.drone(th, [33, 40], 0.03, 350); },
    step(a, th, t, i) {
      if (i % 4 === 0) a.osc('sine', 55, t, 0.2, 0.1, th.g, { f2: 40 });
      if (i % 4 === 2) a.noise(t, 0.05, 0.03, { type: 'bandpass', f: 3000, q: 3, dest: th.g });
      if (i % 2 === 1) a.metal(t, 220 + (i % 8) * 20, 0.006, 0.3, th.g);
      if (i % 32 === 0) a.pad(th, t, [45, 52, 57, 60], 8, 0.022, 800);
    },
  },
};
