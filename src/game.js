// Game: owns engine, systems and UI; runs the main loop, game state and the player-facing API used by levels
import * as THREE from 'three';
import { Engine, QUALITY } from './core/engine.js';
import { Input } from './core/input.js';
import { AudioSys } from './core/audio.js';
import { Physics } from './core/physics.js';
import { Player } from './core/player.js';
import { Dialogue } from './core/dialogue.js';
import { loadSettings, saveSettings, newSave, loadSave, writeSave, loadLibrary, saveLibrary } from './core/save.js';
import { Emitter, Rng, hashStr, el, damp, wait, clamp } from './core/util.js';
import { HUD } from './ui/hud.js';
import { UI } from './ui/ui.js';
import { Calculator } from './ui/calculator.js';
import { Notebook } from './ui/notebook.js';
import { ProblemBook } from './ui/problembook.js';
import { Inventory } from './ui/inventory.js';
import { LessonPlayer } from './ui/lesson.js';
import { Menu } from './ui/menu.js';
import { showNote, showCard } from './ui/viewers.js';
import { tex } from './ui/tex.js';
import { Interactor } from './systems/interact.js';
import { Cutscene } from './systems/cutscene.js';
import { Tools } from './systems/tools.js';
import { Vision } from './systems/vision.js';
import { fxTime, Particles } from './fx/fx.js';
import { FORMULAS } from './content/formulas.js';
import { CONSTANTS, CONST_BY_ID } from './content/constants.js';
import { ITEMS, CARDS } from './content/items.js';
import { ALL_PROBLEMS, ALL_LESSONS, ALL_NOTES } from './content/registry.js';
import { PrologueLevel } from './levels/prologue.js';
import { MenuScene, HoloVoid } from './levels/menuscene.js';

const FIXED = 1 / 60;

export class Game extends Emitter {
  constructor(canvas, uiRoot) {
    super();
    this.canvas = canvas; this.uiRoot = uiRoot;
    this.settings = loadSettings();
    this.state = 'boot'; this.save = null; this.level = null; this.paused = false; this.busy = false;
    this.timeScale = 1; this.timeScaleTarget = 1; this.acc = 0; this.autoT = 0; this._pv = {};
    this.problemDefs = { ...ALL_PROBLEMS };
    this.lessonDefs = { ...ALL_LESSONS };
    this.noteDefs = { ...ALL_NOTES };
    this.engine = new Engine(canvas);
    this.engine.onResize = h => { Particles.scaleH = h; };
    this.engine.resize();
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.hud = new HUD(this, uiRoot);
    this.dialogue = new Dialogue(this, uiRoot);
    this.menu = new Menu(this, uiRoot);
    this.ui = new UI(this, uiRoot);
    this.calc = new Calculator(this, uiRoot);
    this.notebook = new Notebook(this);
    this.problems = new ProblemBook(this);
    this.inventory = new Inventory(this);
    this.lesson = new LessonPlayer(this);
    this.interact = new Interactor(this);
    this.cut = new Cutscene(this);
    this.physics = new Physics();
    this.player = new Player(this);
    this.tools = new Tools(this);
    this.vision = new Vision(this);
    this.saveIcon = el('div', { id: 'saveicon', style: { position: 'absolute', left: '50%', top: '14px', transform: 'translateX(-50%)', fontFamily: 'var(--f-mono)', fontSize: '12px', color: 'var(--holo2)', opacity: 0, transition: 'opacity .4s', letterSpacing: '.1em' } }, '◈ сохранение');
    uiRoot.append(this.saveIcon);
    this.engine.setQuality(this.settings.quality);
    this.applySettings();
    this.bindInput();
    this._clickHint = null;
    this._loop = t => this.loop(t);
    requestAnimationFrame(this._loop);
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const inp = this.input;
    inp.on('action', (a, e) => this.onAction(a, e));
    inp.on('lock', () => this.setClickHint(false));
    inp.on('unlock', () => {
      if (this.wantsLock() && performance.now() - (this._intentUnlock || 0) > 400) this.menu.showPause();
    });
    inp.on('lockerror', () => { /* click hint is shown by the loop */ });
    addEventListener('mousedown', () => this.audio.init(), { capture: true });
    addEventListener('keydown', () => this.audio.init(), { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.paused && !this.lesson.active) this.menu.showPause(); });
  }
  wantsLock() { return this.state === 'play' && !this.paused && !this.ui.anyOpen && !this.lesson.active; }
  onUIChange() {
    const lock = this.wantsLock();
    this.input.enabled = lock && !this.cut.active;
    if (lock) { if (!this.input.locked) this.input.lock(); }
    else { this._intentUnlock = performance.now(); this.input.unlock(); }
    if (!this.input.enabled) this.input.down.forEach(c => { if (!/^Mouse/.test(c) && c !== 'Space') this.input.down.delete(c); });
  }
  setClickHint(on) { if (on === this._clickHint) return; this._clickHint = on; this.hud.showClickHint(on); }
  canInteract() { return this.state === 'play' && !this.paused && !this.ui.anyOpen && !this.cut.active && !this.lesson.active && !this.busy; }
  onAction(a, e) {
    if (this.state === 'boot' || this.state === 'loading') return;
    if (a === 'pause') { this.onEsc(); return; }
    if (this.state !== 'play' || this.paused || this.cut.active || this.lesson.active) return;
    const typing = e && this.input.isTyping(e);
    switch (a) {
      case 'interact':
        if (this.calc.open) return;
        if (this.ui.top && this.ui.top.closeOnUse) { this.ui.close(); return; }
        if (!this.ui.anyOpen && !this.busy) this.interact.use();
        break;
      case 'inventory': if (!typing && !this.busy) this.inventory.toggle(); break;
      case 'notebook': if (!this.busy) this.notebook.toggle(); break;
      case 'problems': if (!this.busy) this.problems.toggle(); break;
      case 'calculator': if (!this.busy) this.calc.toggle(); break;
      case 'tool': if (!this.ui.anyOpen && !this.busy) this.tools.cycle(1); break;
      case 'vision': if (!this.ui.anyOpen) this.vision.toggle(); break;
      case 'flashlight': if (!this.ui.anyOpen) this.tools.toggleFlashlight(); break;
      case 'use': if (this.input.locked && !this.ui.anyOpen && !this.busy) this.tools.use(); break;
      case 'alt': if (this.input.locked && !this.ui.anyOpen && !this.busy) this.tools.alt(); break;
      case 'jump': if (!this.ui.anyOpen) this.player.jumpQueued = true; break;
    }
  }
  onEsc() {
    const ui = this.ui;
    if (this.state === 'menu' || this.state === 'replay') {
      const top = ui.top; if (top && top.id !== 'lesson') ui.close(); else if (top && top.id === 'lesson' && this.lesson.replay) ui.close();
      return;
    }
    if (this.state !== 'play') return;
    const top = ui.top;
    if (top) {
      if (top.id === 'lesson') { this.menu.showPause(); return; }
      ui.close(); return;
    }
    if (this.calc.open) { this.calc.toggle(false); return; }
    this.menu.showPause();
  }
  resume() {
    if (this.ui.isOpen('pause')) this.ui.close('pause');
    this.paused = false; this.dialogue.setPaused(false); this.onUIChange();
  }

  // ---------------------------------------------------------------- loop
  loop(now) {
    requestAnimationFrame(this._loop);
    const last = this.last ?? now; this.last = now;
    const dt = Math.min(window.__dtMax || 0.05, Math.max(0, (now - last) / 1000));
    const eng = this.engine, cam = eng.camera;
    try {
      this.timeScale = damp(this.timeScale, this.timeScaleTarget, 6, dt);
      if (this.state === 'play' && this.level) {
        if (!this.paused) {
          const [mx, my] = this.input.consumeMouse();
          if (this.input.locked && !this.player.frozen && !this.ui.anyOpen && !this.lesson.active) this.player.look(mx, this.settings.invertY ? -my : my, 0.0021 * this.settings.sens);
          const w = this.input.consumeWheel();
          if (w && this.input.locked && this.canInteract()) this.tools.cycle(w > 0 ? 1 : -1);
          const sdt = dt * this.timeScale;
          fxTime.value += sdt;
          this.physics.world.timestep = FIXED * this.timeScale;
          this.acc += dt; let n = 0;
          while (this.acc >= FIXED && n < 4) {
            this.level.fixedUpdate && this.level.fixedUpdate(FIXED * this.timeScale, FIXED);
            this.player.fixedUpdate(FIXED, this.input);
            this.physics.step();
            this.acc -= FIXED; n++;
          }
          if (n >= 4) this.acc = 0;
          this.cut.update(dt);
          if (this.lesson.active) this.lesson.update(dt);
          else if (!this.cut.active) { this.player.updateCamera(cam, dt, clamp(this.acc / FIXED, 0, 1), this.settings.bob); }
          this.level.update(sdt, dt);
          this.interact.update();
          this.tools.update(dt);
          this.vision.update(dt);
          if (this.save) { this.save.playTime += dt; this.autoT += dt; if (this.autoT > 60) { this.autoT = 0; this.autosave(); } }
        } else this.input.consumeMouse();
        this.setClickHint(this.wantsLock() && !this.cut.active && !this.input.locked);
      } else if (this.state === 'menu') {
        fxTime.value += dt; this.input.consumeMouse(); this.input.consumeWheel();
        this.menuScene && this.menuScene.update(dt);
        this.setClickHint(false);
      } else if (this.state === 'replay') {
        fxTime.value += dt;
        this.voidScene && this.voidScene.update(dt);
        this.lesson.update(dt);
        this.setClickHint(false);
      }
      this.audio.updateListener(cam);
      eng.render(dt);
      this.perfWatch(now);
      this.hud.tickFps(dt);
    } catch (e) { console.error(e); if (!this._errShown) { this._errShown = true; this.hud.toast('Ошибка', String(e && e.message || e), 'red', 8); } }
  }

  // automatic quality step-down when the machine cannot hold a smooth frame rate (until the player picks a preset by hand)
  perfWatch(now) {
    if (this.settings.qualityLocked || this._perfDone || this.state !== 'play' || this.paused || this.ui.anyOpen || document.hidden) { if (this._perf) this._perf.last = null; return; }
    const P = this._perf ||= { t: 0, n: 0, skip: 4, last: null };
    const dt = P.last === null ? 0 : (now - P.last) / 1000; P.last = now;
    if (dt <= 0 || dt > 0.5) return;
    if (P.skip > 0) { P.skip -= dt; return; }
    P.t += dt; P.n++;
    if (P.t < 6) return;
    const fps = P.n / P.t; this._perf = { t: 0, n: 0, skip: 3, last: null };
    const order = ['low', 'medium', 'high', 'ultra'], i = order.indexOf(this.settings.quality);
    if (fps < 40 && i > 0) {
      this.settings.quality = order[i - 1]; this.applySettings('quality');
      this.hud.toast('Графика', `Средняя частота кадров ${Math.round(fps)} FPS — качество снижено до «${QUALITY[order[i - 1]].label}». Изменить можно в настройках (Esc → Настройки).`, '', 6);
      if (i - 1 === 0) this._perfDone = true;
    } else this._perfDone = true;
  }

  // ---------------------------------------------------------------- state transitions
  disposeWorld() {
    this.cut.active && this.cut.end();
    this.dialogue.stop();
    this.audio.stopAllLoops();
    this.interact.clear(); this.vision.reset(); this.tools.reset();
    if (this.level) { try { this.level.dispose(); } catch (e) { console.error(e); } this.level = null; }
    if (this.menuScene) { this.menuScene.dispose(); this.menuScene = null; }
    if (this.voidScene) { this.voidScene.dispose(); this.voidScene = null; }
    this.engine.outline.selection.clear();
    this.engine.scene.fog = null;
    this.timeScale = this.timeScaleTarget = 1;
    this.engine.setChromatic(0); this.engine.setDof(false);
    this.engine.setFov(this.settings.fov);
  }
  showMenu() {
    this.disposeWorld();
    this.state = 'menu'; this.paused = false; this.busy = false;
    this.save = loadSave();
    this.hud.show(false); this.hud.setObjective('', ''); this.hud.setPrompt(''); this.hud.tool(null);
    this.menuScene = new MenuScene(this); this.menuScene.build();
    this.onUIChange();
    this.menu.showMain();
    this.hud.fade(0, 1.2);
  }
  async newGame(difficulty = 'student') {
    this.save = newSave(difficulty);
    writeSave(this.save);
    await this.startLevel('start');
  }
  async continueGame() {
    const s = loadSave(); if (!s) return this.newGame();
    this.save = s;
    await this.startLevel(s.checkpoint || 'start');
  }
  async startLevel(cp) {
    this.state = 'loading';
    this.ui.closeAll(); if (this.calc.open) this.calc.toggle(false);
    this.audio.init();
    await this.hud.fade(1, 0.5);
    this.menu.hide();
    this.disposeWorld();
    this.hud.show(false);
    this.physics.dispose();
    this.physics = new Physics();
    this.player = new Player(this);
    this._pv = {};
    this.level = new PrologueLevel(this);
    try { await this.level.build(); }
    catch (e) { console.error(e); this.hud.toast('Ошибка загрузки уровня', String(e.message || e), 'red', 10); }
    this.engine.setQuality(this.settings.quality);
    this.engine.setFov(this.settings.fov);
    try { this.engine.renderer.compile(this.engine.scene, this.engine.camera); } catch (e) { }
    this.state = 'play'; this.paused = false; this.busy = false; this.acc = 0;
    this.hud.show(true);
    this.onUIChange();
    this.autoT = 0;
    await this.level.start(cp);
  }
  toMenu() {
    if (this.state === 'play' && this.save) this.autosave();
    this.ui.closeAll(); if (this.calc.open) this.calc.toggle(false);
    if (this.lesson.active) this.lesson.finish(true);
    this.state = 'loading';
    this.hud.fade(1, 0.4).then(() => this.showMenu());
  }
  async replayLesson(id) {
    const def = this.lessonDefs[id]; if (!def || this.lesson.active) return;
    const fromState = this.state;
    this.ui.closeAll();
    if (fromState === 'play') { this.paused = false; this.dialogue.setPaused(false); }
    await this.hud.fade(1, 0.35);
    const prevCam = { p: this.engine.camera.position.clone(), q: this.engine.camera.quaternion.clone() };
    this.menu.hide();
    if (this.level) this.level.root.visible = false;
    if (this.menuScene) this.menuScene.root.visible = false;
    this.voidScene = new HoloVoid(this); this.voidScene.build();
    const prevState = this.state; this.state = 'replay';
    this.hud.show(false);
    this.onUIChange();
    this.audio.playMusic('holo');
    this.hud.fade(0, 0.6);
    await this.lesson.play(def, { anchor: this.voidScene.anchor, view: { target: new THREE.Vector3(0, 0.6, 0), yaw: 0.4, pitch: 0.32, dist: 3.8 }, replay: true });
    await this.hud.fade(1, 0.35);
    this.voidScene.dispose(); this.voidScene = null;
    if (fromState === 'play' && this.level) {
      this.level.root.visible = true;
      this.engine.camera.position.copy(prevCam.p); this.engine.camera.quaternion.copy(prevCam.q);
      this.state = 'play'; this.hud.show(true); this.onUIChange();
      this.level.onResume && this.level.onResume();
      this.hud.fade(0, 0.5);
    } else {
      this.showMenu();
    }
  }
  applySettings(key) {
    const S = this.settings;
    if (!this.cut.active) this.engine.setFov(S.fov);
    this.audio.setVolumes({ master: S.master, music: S.music, sfx: S.sfx, voice: S.voice });
    if (key === 'quality' || this.engine.quality !== S.quality) this.engine.setQuality(S.quality);
    this.hud.setFps(S.showFps);
    document.documentElement.style.setProperty('--ui-scale', S.uiScale);
    if (key === 'tts' && !S.tts) { try { speechSynthesis.cancel(); } catch (e) { } }
    saveSettings(S);
  }

  // ---------------------------------------------------------------- persistent progress
  autosave() {
    if (!this.save) return;
    writeSave(this.save);
    const lib = loadLibrary(); lib.lessons ||= []; lib.cards ||= [];
    for (const id of Object.keys(this.save.lessons)) if (!lib.lessons.includes(id)) lib.lessons.push(id);
    for (const c of this.save.cards) if (!lib.cards.includes(c)) lib.cards.push(c);
    saveLibrary(lib);
    this.saveIcon.style.opacity = 1; clearTimeout(this._saveT); this._saveT = setTimeout(() => { this.saveIcon.style.opacity = 0; }, 1400);
  }
  checkpoint(name) { if (!this.save) return; this.save.checkpoint = name; this.autosave(); }
  flag(k, v) { if (!this.save) return undefined; if (v !== undefined) this.save.flags[k] = v; return this.save.flags[k]; }
  setObjective(text, sub = '', zone = '') { this.hud.setObjective('Задача', text, sub, zone || (this.level && this.level.zoneName) || ''); }

  giveItem(id, o = {}) {
    if (!this.save.items.includes(id)) this.save.items.push(id);
    const it = ITEMS[id];
    if (!o.silent && it) { this.audio.sfx('pickup'); this.hud.toast('Получено', `<b>${it.name}</b>${it.key ? ` · клавиша <span class="k">${it.key}</span>` : ''}`, 'amber', 5); }
    this.emit('item', id);
  }
  giveTool(id, o = {}) {
    if (!this.save.tools.includes(id)) this.save.tools.push(id);
    this.giveItem(id, o);
    if (id !== 'flashlight' && !o.noSelect) this.tools.select(id);
  }
  addFormula(id, silent = false) {
    const f = FORMULAS[id]; if (!f || !this.save || this.save.formulas.includes(id)) return;
    this.save.formulas.push(id);
    if (!silent) this.hud.formulaWrite(f.name, tex(f.tex, true));
  }
  addNote(id, o = {}) {
    const n = this.noteDefs[id]; if (!n) return;
    if (!this.save.notes.includes(id)) { this.save.notes.push(id); this.hud.toast(n.audio ? 'Аудиожурнал' : 'Записка', `«${n.title}» — сохранено в рюкзаке (Tab)`, '', 4); }
    if (o.open !== false) showNote(this, n);
    this.emit('note', id);
  }
  addCard(id) {
    if (!CARDS[id]) return;
    const isNew = !this.save.cards.includes(id);
    if (isNew) this.save.cards.push(id);
    showCard(this, id, isNew);
    this.autosave();
  }
  unlockConstant(id) {
    if (!this.save || this.state !== 'play') return;
    const L = (this.save.flags.consts ||= []); if (L.includes(id)) return;
    L.push(id); const c = CONST_BY_ID[id];
    if (c) this.hud.toast('Новая константа', `${tex(c.tex)} — ${c.name}. Записана в блокнот (N → Константы) и в калькулятор.`, 'amber', 5);
  }
  unlockedConstants() { const L = this.save?.flags?.consts || []; return CONSTANTS.filter(c => L.includes(c.id)); }
  recordMeasurement(src, m) {
    if (!this.save) return;
    const list = this.save.measurements; const i = list.findIndex(x => x.src === src);
    const rec = { src, ...m, at: Date.now() };
    const isNew = i < 0;
    if (i >= 0) list[i] = rec; else list.push(rec);
    this.hud.toast(isNew ? 'Журнал измерений' : 'Измерение обновлено', `${tex(m.sym)} — ${m.name}: <b>${m.text}</b><br><small>${m.where || ''}${m.tool ? ' · ' + m.tool : ''}</small>`, 'amber', 4.5);
    this.audio.sfx('write');
    if (this.ui.isOpen('problems')) this.problems.render();
    this.emit('measured', src);
  }
  hasMeasurement(src) { return !!this.save?.measurements?.some(x => x.src === src); }
  problemVars(id) {
    const d = this.problemDefs[id]; if (!d || !this.save) return {};
    return (this._pv[id] ||= d.gen(new Rng(((this.save.seed ^ hashStr(id)) >>> 0) || 1)));
  }
  discoverProblem(id, silent = false) {
    if (!this.save || !this.problemDefs[id]) return;
    const isNew = !this.save.problems[id];
    this.problems.st(id);
    if (isNew && !silent) { this.hud.toast('Новая задача', `«${this.problemDefs[id].title}» — в тетради задач (T)`, '', 4); this.audio.sfx('page'); }
  }
  openProblem(id, atPanel = true) { this.discoverProblem(id, true); this.problems.open(id, atPanel ? id : null); }
  isSolved(id) { return this.save?.problems?.[id]?.status === 'solved'; }
  async runMechanism(id, x, info) {
    const m = this.level && this.level.mechanisms && this.level.mechanisms[id];
    if (!m) return {};
    this.busy = true;
    try { return (await m(x, info)) || {}; }
    catch (e) { console.error(e); return {}; }
    finally { this.busy = false; this.onUIChange(); }
  }
  onProblemSolved(id, stars) {
    this.save.stars = Object.values(this.save.problems).reduce((a, p) => a + (p.stars || 0), 0);
    this.audio.sfx('star');
    const d = this.problemDefs[id];
    this.hud.toast('Задача решена', `${d ? d.title : ''} · <span class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></span>`, 'green', 5);
    this.emit('solved', id, stars);
  }
  wait(sec) { return this.cut.active ? this.cut.wait(sec) : wait(sec * 1000); }
}
