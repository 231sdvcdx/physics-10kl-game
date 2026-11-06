// Пролог «Сбой» — часть уровня (PrologueScript); методы подмешиваются в PrologueLevel
import * as THREE from 'three';
import { Builder } from './builder.js';
import { mat, glow, solid, glassMat, boxGeo, cylGeo, planeGeo, torusGeo, signMesh } from '../core/materials.js';
import { coreMaterial, coneLight, Particles, Arc, holoMaterial, Screen, drawTerminal, fxTime } from '../fx/fx.js';
import { plateMesh, textTexture, bench, consoleDesk, locker, valveWheel, studentDesk, shelf, IsaacHolo, crackTexture } from './props.js';
import { LINES } from '../content/prologue/story.js';
import { LESSON_L0 } from '../content/prologue/lesson.js';
import { CARDS, cardArt } from '../content/items.js';
import { fmt, fmtFixed, fmtSci, clamp, lerp, damp, wait, el, easeInOut, easeOut, smooth } from '../core/util.js';
import { showKeypad } from '../ui/viewers.js';
import { panel } from '../ui/ui.js';
import { fmtTime, ERR_NAMES, diffName } from '../ui/menu.js';
import { tex } from '../ui/tex.js';
import { RAPIER } from '../core/physics.js';
import { ITEMS } from '../content/items.js';
import { V, PI, GAL, COR, ARC_, CLS, AIR, LFT, HALL, CORE, at, markerTexture } from './prologue_common.js';

export const PrologueScript = {
  // ------------------------------------------------------------------ the intro: launch day → accident → wake up
  async intro() {
    const g = this.g, cut = g.cut, hud = g.hud, A = g.audio;
    const sk = () => cut.skipping;
    const sayC = k => sk() ? Promise.resolve() : g.dialogue.say(LINES[k]);
    g.player.teleport(1.5, 0, 1.75, 0, 0);
    cut.begin({ letterbox: true, skippable: true });
    A.playMusic('prologue');
    this.coreHum = this.loop('core', { vol: 0.3, pos: CORE, ref: 22 });
    const eye = V(1.5, 1.18, 1.72);
    cut.path([{ p: eye, l: V(0.2, 1.8, -26), fov: 58 }], 0.01);
    this.countT = 120; this.counting = true;
    await hud.typer(LINES.intro1);
    await hud.typer(LINES.intro2);
    hud.fade(0, sk() ? 0.01 : 2.5);
    cut.path([{ p: eye, l: V(0.2, 1.8, -26), fov: 58 }, { p: V(1.46, 1.2, 1.6), l: V(0, 1.5, -26), fov: 50 }], 10, { dof: { range: 40, bokeh: 1.2 } });
    await cut.wait(1.2);
    await sayC('pa1');
    cut.path([{ p: V(1.46, 1.2, 1.6), l: V(0, 1.5, -26), fov: 50 }, { p: V(1.6, 1.2, 1.6), l: V(7.7, 2.5, -0.6), fov: 44 }], 2.0);
    await cut.wait(2.0);
    await sayC('director1');
    cut.path([{ p: V(1.6, 1.2, 1.6), l: V(7.7, 2.5, -0.6), fov: 44 }, { p: V(1.5, 1.2, 1.6), l: V(-5.4, 2.9, -45.0), fov: 50 }, { p: V(1.5, 1.2, 1.6), l: V(-5.4, 2.9, -45.0), fov: 7 }], 3.0, { dof: { range: 30, bokeh: 1 } });
    await cut.wait(1.6);
    A.sfx('alarm1');
    this.lomovAgitated = true;
    await sayC('lomov1');
    this.countT = 5.5;
    cut.path([{ p: V(1.5, 1.2, 1.6), l: V(-5.4, 2.9, -45.0), fov: 7 }, { p: V(1.5, 1.2, 1.5), l: V(0, 1.4, -26), fov: 52 }], 2.2);
    await sayC('countdown');
    // launch
    this.launching = true; this.counting = false; this.countText = '00:00';
    this.alarmLoop = this.loop('alarm', { vol: 0.1 });
    A.sfx('whine', { dur: 4.5 });
    this.tween(5, u => { this.heat = 0.3 + u * 0.9; this.coreMat.uniforms.uStab.value = 0.45 * (1 - u); cut.shakeAmt = Math.max(cut.shakeAmt, u * 0.7); }, x => x);
    cut.path([{ p: V(1.5, 1.2, 1.5), l: V(0, 1.4, -26), fov: 52 }, { p: V(1.5, 1.15, 1.3), l: V(0, 1.2, -26), fov: 40 }], 5.2);
    await sayC('launch');
    await cut.wait(0.8);
    hud.flash(2.4, 1); A.sfx('boom'); A.sfx('tinnitus');
    cut.shakeAmt = 3;
    this.chroma = 0.012;
    this.launching = false;
    this.setState('accident');
    this.sparkBurst(this.sparkPos, 120, 4);
    await hud.fade(1, sk() ? 0.01 : 0.9);
    cut.shakeAmt = 0;
    A.playMusic(null);
    await cut.wait(2.0);
    // wake up on the floor
    const lie = V(2.3, 0.3, 0.9);
    cut.path([{ p: lie, l: V(3.0, 4.2, -0.8), fov: 66 }], 0.01);
    if (!sk()) { hud.blink(true, 0.01); await wait(60); }
    hud.fade(0, 0.05);
    if (!sk()) { A.sfx('heart'); await hud.blink(false, 1.6); await hud.blink(true, 0.35); A.sfx('heart', { delay: 0.1 }); await hud.blink(false, 1.0); }
    else hud.blink(false, 0.01);
    const wakeLines = sayC('wake');
    await cut.wait(6.5);
    cut.path([{ p: lie, l: V(3.0, 4.2, -0.8), fov: 66 }, { p: V(2.25, 0.95, 1.0), l: V(1.4, 1.1, -1.5), fov: 62 }, { p: V(2.2, 1.62, 1.0), l: V(0.9, 1.5, -3), fov: g.settings.fov }], 3.4);
    await cut.wait(3.4);
    const skipped = sk();
    cut.end();
    g.engine.setFov(g.settings.fov);
    this.syncPlayerToCamera(0);
    this.F.intro = true; this.F.l_wake = true;
    g.checkpoint('gallery');
    A.playMusic('tension');
    this.startAmbience();
    if (this.alarmLoop) { const al = this.alarmLoop; setTimeout(() => al.stop(3), skipped ? 2000 : 14000); }
    this.updateObjective(true);
    if (skipped) g.dialogue.say([LINES.wake[1], LINES.wake[2], LINES.wake[3]]);
    else wakeLines.then(() => this.updateObjective());
  },
  // ------------------------------------------------------------------ interactions
  takeBackpack() {
    const g = this.g; this.backpack.visible = false;
    g.giveItem('backpack'); g.giveItem('notebook', { silent: true }); g.giveItem('problems', { silent: true });
    this.say('backpack'); this.updateObjective(); g.autosave();
  },
  takeCalc() {
    const g = this.g; this.calcMesh.visible = false; if (this.glint) this.glint.visible = false;
    g.giveItem('calculator'); this.say('calc'); this.updateObjective();
  },
  openLocker() {
    if (this.F.lockerOpen) return; this.F.lockerOpen = true;
    this.g.audio.sfx('clank'); this.g.audio.sfx('open');
    const p = this.locker.pivot; this.tween(0.9, u => { p.rotation.y = -1.9 * u; }, easeOut);
  },
  takeFlashlight() {
    this.flashMesh.visible = false; this.g.giveTool('flashlight'); this.g.tools.setFlash(true);
    this.say('flash'); this.updateObjective();
  },
  closeValve() {
    if (this.F.valve) return; this.F.valve = true; const g = this.g;
    g.audio.sfx('clank'); g.audio.sfx('servo', { dur: 1.4 });
    const w = this.valve.wheel, r0 = w.rotation.z;
    this.tween(1.8, u => { w.rotation.z = r0 + u * PI * 3; });
    setTimeout(() => { if (!this.disposed) this.steamOff(); }, 900);
    this.say('valve'); this.updateObjective(); g.autosave();
  },
  steamOff(instant) {
    this.steamOn = false;
    if (this.steamCol) { this.g.physics.remove(this.steamCol); this.steamCol = null; }
    if (this.steamLoop) { this.steamLoop.stop(instant ? 0.1 : 1.6); this.steamLoop = null; }
    if (!instant) this.g.audio.sfx('steam', { dur: 0.9, vol: 0.5 });
  },
  keypad() {
    showKeypad(this.g, { title: 'АРХИВ ЛАБОРАТОРИИ ЯДРА', sub: 'код доступа — 6 цифр', len: 6, hint: 'Ломов оставлял подсказки студентам… Может быть, в голоклассе?', onCode: c => {
      if (c === '300000' || c === '299792') { this.openArchive(); this.g.audio.sfx('success'); return true; }
      this.g.audio.sfx('fail'); return c.length < 6 ? 'Нужно 6 цифр.' : 'Неверный код. Доступ запрещён.';
    } });
  },
  openArchive(instant) {
    this.F.archive = true;
    const d = this.archDoor, col = d.userData.collider;
    if (col) { this.g.physics.remove(col); d.userData.collider = null; }
    this.kpScreen.material = glow(0x72ffa8, 1.6);
    if (instant) { d.position.y = 1.125 + 2.2; return; }
    this.g.audio.sfx('door', { dur: 1.6 });
    const y0 = d.position.y; this.tween(1.6, u => { d.position.y = y0 + u * 2.2; });
    this.g.autosave();
  },
  enterClassroom() {
    if (this.F.classroom) return;
    const g = this.g; this.F.classroom = true; this.zoneName = 'Сектор 0 · Голографический класс';
    g.audio.playMusic('holo'); this.holoLoop ||= this.loop('holo', { vol: 0.07, pos: V(CLS.cx, 1.5, CLS.cz), ref: 4 });
    g.audio.sfx('holo');
    const I = this.isaac; I.group.visible = true; I.group.scale.setScalar(0.01);
    this.tween(1.8, u => I.group.scale.setScalar(Math.max(0.01, u)), easeOut);
    this.say('classroom');
    g.checkpoint('classroom'); this.updateObjective();
  },
  async startLesson() {
    if (this.lessonRunning || this.save.lessons.L0) return;
    const g = this.g; this.lessonRunning = true;
    try {
      await this.say('protocolTalk');
      g.audio.sfx('holo');
      const I = this.isaac, p0 = I.group.position.clone();
      await this.tween(1.0, u => I.group.position.lerpVectors(p0, this.isaacAside, u));
      const res = await g.lesson.play(LESSON_L0, { anchor: this.lessonAnchor, view: { target: V(0, 0.55, 0), yaw: 0, pitch: 0.3, dist: 3.4 } });
      if (res && res.aborted) { g.hud.toast('Урок прерван', 'Подойдите к проектору, чтобы начать заново.', '', 3); return; }
      this.onLessonDone();
    } finally { this.lessonRunning = false; this.updateObjective(); }
  },
  onLessonDone() {
    const g = this.g;
    LESSON_L0.formulas.forEach((id, i) => setTimeout(() => { if (!this.disposed) g.addFormula(id); }, 500 + i * 850));
    g.giveItem('visor', { silent: true });
    this.F.vision = true; if (!this.save.vision.includes('quant')) this.save.vision.push('quant');
    setTimeout(() => { if (!this.disposed) g.hud.toast('Физическое зрение', 'Клавиша <span class="k">V</span> — замедление времени и подписи величин с переводом в СИ.', 'amber', 6); }, 700 + LESSON_L0.formulas.length * 850);
    this.removeBarrier();
    g.checkpoint('classroom');
    this.say('lessonDone');
  },
  removeBarrier(instant) {
    const b = this.barrier;
    if (this.barrierCol) { this.g.physics.remove(this.barrierCol); this.barrierCol = null; }
    if (instant) { b.visible = false; return; }
    this.g.audio.sfx('holo');
    this.tween(1.2, u => { b.material.uniforms.uOpacity.value = 0.8 * (1 - u); if (u >= 1) b.visible = false; });
  },
  openCabinet() {
    if (!this.save.lessons.L0) { this.g.hud.toast('Шкаф с приборами', 'Заблокирован протоколом. Откроется после урока у проектора.', 'red', 3); this.g.audio.sfx('error'); return; }
    this.F.cabinetOpen = true; this.g.audio.sfx('open');
    const p = this.cabinet.pivot; this.tween(0.9, u => { p.rotation.y = -1.9 * u; }, easeOut);
  },
  takeLaser() { this.laserMesh.visible = false; this.g.giveTool('laser'); this.say('laser'); this.updateObjective(); },
  onMeasure(e) {
    const ids = [e.a.mk, e.b.mk];
    if (ids.includes('liftA') && ids.includes('liftB')) {
      if (Math.abs(this.platY) > 0.01) { this.g.hud.toast('Рулетка', 'Платформа не внизу: метка A сместилась вместе с ней.', 'red', 3); return; }
      this.g.recordMeasurement('h_lift', { sym: 'h', name: 'высота подъёма платформы', text: `${fmt(e.dh, 3)} м`, where: 'шахта лифта Л-2', tool: 'лазерная рулетка' });
      this.updateObjective();
    } else if (this.F.liftHall && !this.g.hasMeasurement('h_lift') && (ids.includes('liftA') || ids.includes('liftB'))) {
      this.g.hud.toast('Рулетка', 'Для задачи нужны обе метки: A — на полу платформы, B — «уровень площадки» на стене шахты.', '', 4.5);
    }
  },
  beaconOk() { if (this.beaconM) { this.beaconM.material.color.setRGB(0.4, 4, 1.2); this.beacon.color.setHex(0x40ff80); this.beaconGreen = true; } },
  // ------------------------------------------------------------------ mechanisms (run exactly by the entered value)
  async runDoor(x, info) {
    const g = this.g, cut = g.cut, v = this.vDoor, s = this.doorS, T = v.t;
    const sp = Math.max(0, x), travel = sp * T, stop = s + 0.12;
    this.doorBusy = true;
    cut.begin({ letterbox: false, skippable: false }); g.hud.show(true); g.hud.setPrompt('');
    const camP = V(15.1, 2.05, 23.0), look = V(AIR.dx, 1.35, 26 + s * 0.25);
    this.camAt(camP, look);
    await wait(500);
    g.audio.sfx('servo', { dur: Math.min(T, stop / Math.max(sp, 1e-6)) });
    const motor = this.loop('motor', { vol: 0.22, pos: V(AIR.dx, 1.5, 26), ref: 4 });
    let tt = 0, hit = false, p = 0;
    await this.run(dt => {
      tt += dt; p = sp * Math.min(tt, T);
      if (p >= stop) { p = stop; hit = true; }
      this.leafX = p;
      this.camAt(camP, look);
      if (this.needle) this.needle.rotation.x = 1.9 - Math.min(2.6, sp * 0.8);
      g.hud.tool('Привод П-1', `ход ${fmtFixed(p, 2)} м`, `полный ход s = ${fmt(s)} м · привод: ${fmtFixed(Math.min(tt, T), 1)} из ${fmt(T)} с · v = ${fmt(sp)} м/с`);
      return hit || tt >= T;
    });
    motor.stop(0.3); if (this.needle) this.needle.rotation.x = 1.9;
    let what = '';
    if (info.ok) {
      const p0 = this.leafX; await this.tween(0.3, u => { this.leafX = lerp(p0, s, u); });
      g.audio.sfx('thud'); g.audio.sfx('success', { vol: 0.6 });
      this.F.door1 = true; this.beaconOk();
      await wait(900);
    } else {
      if (hit) {
        g.audio.sfx('clank'); g.audio.sfx('thud'); g.audio.sfx('spark'); cut.shakeAmt = 1.2;
        for (let i = 0; i < 3; i++) this.sparkBurst(V(AIR.dx - 0.3, 0.6 + i * 0.8, 26 + s / 2), 30, 3);
        what = `При скорости ${fmt(sp)} м/с за ${fmt(T)} с створка прошла бы ${fmt(travel)} м — больше полного хода ${fmt(s)} м. Створка с размаху ударилась в ограничитель, защита вернула её назад.`;
      } else {
        g.audio.sfx('thud', { vol: 0.6 });
        what = `При скорости ${fmt(sp)} м/с за ${fmt(T)} с створка прошла только ${fmt(travel)} м из ${fmt(s)} м — ${travel < 0.7 ? 'в такую щель не пройти' : 'проход открылся не полностью'}. Привод вернул створку назад.`;
      }
      g.hud.toast('Механизм П-1', what, 'red', 6);
      await wait(1600);
      const p0 = this.leafX; g.audio.sfx('servo', { dur: Math.max(0.8, p0 / 1.2) });
      await this.tween(Math.max(0.8, p0 / 1.2), u => { this.leafX = p0 * (1 - u); this.camAt(camP, look); }, x => x);
      g.audio.sfx('thud');
    }
    g.hud.tool(null); cut.end(); this.doorBusy = false;
    if (info.ok) { this.say('door1Ok'); g.checkpoint('door1'); }
    this.updateObjective();
    return { msg: info.ok ? `Створка прошла ровно ${fmt(s)} м — дверь открыта.` : '', what };
  },
  async runLift(x, info) {
    const g = this.g, cut = g.cut, v = this.vLift, h = this.liftH, sp = v.vm / 60;
    const T = Math.max(0, x), travel = sp * T, stop = h + 0.6;
    this.liftBusy = true;
    const c = g.player.center;
    if (!(c.x > LFT.sx0 + 0.15 && c.x < LFT.sx1 - 0.15 && c.z > LFT.sz0 + 0.1 && c.z < LFT.sz1 - 0.1)) g.player.teleport(this.liftC.x - 0.4, this.platY, this.liftC.z + 0.2, -PI / 2, 0);
    cut.begin({ letterbox: false, skippable: false }); g.hud.show(true); g.hud.setPrompt('');
    const camF = y => [V(28.3, y + 2.4, 29.7), V(32.2, y + 1.0, 26)];
    this.camAt(...camF(this.platY));
    g.audio.sfx('servo', { dur: 0.9 });
    await this.tween(0.9, u => { this.shaftDoor.off.y = 2.5 * (1 - u); this.camAt(...camF(this.platY)); });
    g.audio.sfx('thud', { vol: 0.7 });
    const motor = this.loop('motor', { vol: 0.32, pos: V(28.9, 0.8, 23), ref: 5 });
    let tt = 0, hit = false, y = 0;
    await this.run(dt => {
      tt += dt; y = sp * Math.min(tt, T);
      if (y >= stop) { y = stop; hit = true; }
      this.platY = y; this.camAt(...camF(y));
      g.hud.tool('Лифт Л-2', `подъём ${fmtFixed(y, 2)} м`, `площадка: h = ${fmt(h)} м · мотор: ${fmtFixed(Math.min(tt, T), 1)} из ${fmt(T, 4)} с · v = ${fmt(v.vm)} м/мин`);
      return hit || tt >= T;
    });
    motor.stop(0.4);
    let what = '';
    if (info.ok) {
      const y0 = this.platY; await this.tween(0.35, u => { this.platY = lerp(y0, h, u); this.camAt(...camF(this.platY)); });
      g.audio.sfx('lift_stop'); await wait(400);
      g.audio.sfx('door', { dur: 1.2 });
      await this.tween(1.3, u => { this.eastGate.off.y = 2.5 * u; this.camAt(...camF(h)); });
      g.audio.sfx('success', { vol: 0.6 });
      this.F.lift = true;
      await wait(500);
    } else {
      if (hit) {
        g.audio.sfx('lift_stop'); g.audio.sfx('clank'); g.audio.sfx('spark'); cut.shakeAmt = 1.6;
        for (const z of [25.25, 26.75]) this.sparkBurst(V(this.liftC.x, stop + 2.95, z), 40, 3);
        what = `За ${fmt(T, 4)} с при скорости ${fmt(sp, 3)} м/с платформа поднялась бы на ${fmt(travel)} м, а площадка — на высоте ${fmt(h)} м. Платформа проскочила уровень и ударилась в верхний ограничитель.`;
      } else {
        g.audio.sfx('lift_stop', { vol: 0.6 });
        what = `За ${fmt(T, 4)} с платформа поднялась лишь на ${fmt(travel)} м — до площадки (${fmt(h)} м) не хватило ${fmt(h - travel)} м.`;
      }
      g.hud.toast('Лифт Л-2', what, 'red', 6);
      await wait(1700);
      const y0 = this.platY;
      if (y0 > 0.001) {
        const dur = Math.max(1, y0 / (sp * 1.6)); const m2 = this.loop('motor', { vol: 0.25, pos: V(28.9, 0.8, 23), ref: 5 });
        await this.tween(dur, u => { this.platY = y0 * (1 - u); this.camAt(...camF(this.platY)); }, x => x);
        m2.stop(0.3); g.audio.sfx('thud');
      }
      g.audio.sfx('servo', { dur: 0.9 });
      await this.tween(0.9, u => { this.shaftDoor.off.y = 2.5 * u; this.camAt(...camF(0)); });
    }
    // keep the frozen player exactly on the platform deck (no sinking after the ride)
    { const pc = g.player.center; if (pc.x > LFT.sx0 && pc.x < LFT.sx1 && pc.z > LFT.sz0 && pc.z < LFT.sz1) g.player.teleport(pc.x, this.platY + 0.01, pc.z, g.player.yaw, g.player.pitch); }
    g.hud.tool(null); cut.end(); this.liftBusy = false;
    if (info.ok) { this.say('liftOk'); g.checkpoint('lift_top'); }
    this.updateObjective();
    return { msg: info.ok ? 'Платформа остановилась точно на уровне площадки.' : '', what };
  },
  async runRadar(x, info) {
    const g = this.g, cut = g.cut, T = this.vRadar.t, ratio = x / info.correct;
    cut.begin({ letterbox: false, skippable: false }); g.hud.show(true); g.hud.setPrompt('');
    const camP = V(8.3, 1.75, 15.75), look = V(8.35, 1.85, 14.2);
    this.camAt(camP, look);
    const [E, M] = this.radarPath;
    await wait(400);
    this.pulse.visible = true; g.audio.sfx('beep', { f: 2400 });
    let tt = 0;
    await this.run(dt => {
      tt += dt; const u = Math.min(1, tt / T), k = u < 0.5 ? u * 2 : 2 - u * 2;
      this.pulse.position.lerpVectors(E, M, k);
      this.radarLines = ['ИМПУЛЬС ПОСЛАН', `время: ${fmtFixed(Math.min(tt, T), 2)} с`, u < 0.5 ? '→ к Луне' : '← эхо', `введено: s = ${fmtSci(x)} м`];
      this.camAt(camP, look);
      return tt >= T;
    });
    this.pulse.visible = false; g.audio.sfx('beep', { f: 1700 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(info.ok ? 0x72ffa8 : 0xff5a4f).multiplyScalar(4) }));
    ring.position.lerpVectors(E, M, clamp(ratio, 0, 2.4)); ring.lookAt(camP); this.root.add(ring);
    let what = '';
    if (info.ok) this.radarLines = ['ЭХО ПРИНЯТО', `Δt = ${fmtFixed(T, 2)} с`, `s = ${fmtSci(x)} м`, 'СОВПАДЕНИЕ ✓'];
    else { what = `Если бы до Луны было ${fmtSci(x)} м, эхо вернулось бы через ${fmt(2 * x / 3e8, 3)} с, а пришло через ${fmt(T)} с.`; this.radarLines = ['!НЕ СОВПАДАЕТ', `эхо: ${fmtFixed(T, 2)} с`, `ваш расчёт: ${fmt(2 * x / 3e8, 3)} с`, 'пересчитайте']; g.hud.toast('Радиодальномер', what, 'red', 6); g.audio.sfx('fail'); }
    await wait(2600);
    ring.removeFromParent(); ring.geometry.dispose(); ring.material.dispose();
    cut.end();
    if (info.ok) { this.radarDone(); this.say('radarOk'); g.autosave(); }
    return { msg: info.ok ? 'Расчётная дальность совпала с эхом.' : '', what };
  },
  radarDone() { const t = this.vRadar.t; this.radarLines = ['КАЛИБРОВКА ✓', `эхо: Δt = ${fmtFixed(t, 2)} с`, `s = ${fmt(3e8 * t / 2 / 1e3, 6)} км`, 'Луна: дальность измерена']; },
  // ------------------------------------------------------------------ finale of the prologue
  async ending() {
    if (this.endingRunning) return; this.endingRunning = true;
    const g = this.g, cut = g.cut, h = this.liftH, hud = g.hud;
    g.ui.closeAll(); if (g.calc.open) g.calc.toggle(false);
    if (g.tools.active) g.tools.select(null);
    this.zoneName = 'Сектор 0 · Ворота сектора 1';
    const sk = () => cut.skipping;
    cut.begin({ letterbox: true, skippable: true });
    g.audio.playMusic('holo');
    const I = this.isaac; I.group.position.set(40.5, h + 1.6, 26); I.group.visible = true; I.setIntegrity(0.07); I.group.scale.setScalar(0.01);
    g.audio.sfx('holo');
    this.tween(1.4, u => I.group.scale.setScalar(Math.max(0.01, u)), easeOut);
    const cam = g.engine.camera;
    cut.path([{ p: cam.position.clone(), l: V(40.5, h + 1.5, 26), fov: g.settings.fov }, { p: V(38.6, h + 1.58, 26.5), l: V(40.5, h + 1.5, 26), fov: 50 }], 2.6, { dof: { range: 2, bokeh: 2 } });
    await cut.wait(1.2);
    if (!sk()) await g.dialogue.say([LINES.ending[0]]);
    I.setIntegrity(0.12); g.audio.sfx('chime');
    if (!sk()) hud.toast('ИСААК', 'Память восстановлена: <b>12%</b>', 'amber', 4);
    cut.path([{ p: V(38.6, h + 1.58, 26.5), l: V(40.5, h + 1.5, 26), fov: 50 }, { p: V(38.9, h + 1.6, 25.3), l: V(42.3, h + 1.4, 26), fov: 46 }], 4.5, { dof: { range: 4, bokeh: 1.5 } });
    if (!sk()) await g.dialogue.say([LINES.ending[1], LINES.ending[2]]);
    await cut.wait(1.0);
    this.gateOk = true; g.audio.sfx('success', { vol: 0.5 });
    await cut.wait(1.2);
    await hud.fade(1, sk() ? 0.01 : 1.2);
    this.save.completed.prologue = true; this.F.ending = true;
    g.checkpoint('end');
    if (!sk()) await hud.titleCard('ГЛАВА 1', 'ИНЕРЦИЯ', 'продолжение — в следующем обновлении', 3.4);
    cut.path([{ p: V(38.4, h + 1.7, 25.2), l: V(42.3, h + 1.3, 26), fov: 50 }], 0.01);
    cut.end();
    g.player.teleport(38.4, h, 26, -PI / 2, 0);
    hud.fade(0, 0.8);
    this.endingRunning = false;
    this.showStats();
  },
  showStats() {
    const g = this.g, S = this.save, probs = ['p1_door', 'p2_lift', 'p3_radar'];
    const P = id => S.problems[id] || {};
    const solved = probs.filter(id => g.isSolved(id)).length;
    const stars = probs.reduce((a, id) => a + (P(id).stars || 0), 0);
    const wrong = probs.reduce((a, id) => a + (P(id).wrong || 0), 0);
    const hints = probs.reduce((a, id) => a + (P(id).hints || 0), 0);
    const errs = {}; probs.forEach(id => (P(id).log || []).forEach(l => { if (l.err) errs[l.err] = (errs[l.err] || 0) + 1; }));
    const errList = Object.entries(errs).map(([k, n]) => `${ERR_NAMES[k] || k} — ${n}`);
    const rows = [
      ['Время', fmtTime(S.playTime)], ['Сложность', diffName(S.difficulty)],
      ['Задачи', `${solved} из 3 (третья — бонусная, в тайнике)`], ['Звёзды', `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 9 - stars))}  ${stars}/9`],
      ['Ошибок / подсказок', `${wrong} / ${hints}`], ['Формул в блокноте', String(S.formulas.length)],
      ['Карточки учёных', `${S.cards.length}`], ['Записки и аудиожурналы', String(S.notes.length)],
      ['Архив Ломова (секрет)', S.flags.archive ? 'найден' : 'не найден — ищите кодовый замок в коридоре А'],
    ];
    const body = el('div', { class: 'endstats', style: { padding: '6px 4px', minWidth: 'min(560px,86vw)' } },
      el('table', { class: 'stat', style: { width: '100%', borderCollapse: 'collapse' } }, ...rows.map(([a, b]) => el('tr', {}, el('td', { style: { padding: '5px 10px', opacity: .75 } }, a), el('td', { style: { padding: '5px 10px', textAlign: 'right' } }, b)))),
      el('div', { style: { margin: '12px 10px 4px', fontWeight: 600 } }, 'Типичные ошибки'),
      el('div', { style: { margin: '0 10px 10px', opacity: .85 } }, errList.length ? errList.join(' · ') : 'ни одной — отличная работа!'),
      el('div', { class: 'muted', style: { margin: '10px' } }, 'Прогресс сохранён. Глава 1 «Инерция» (кинематика, динамика, законы сохранения) — в следующем обновлении. Уроки можно повторить в меню «Уроки».'),
      el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end', margin: '10px' } },
        el('button', { class: 'btn', onclick: () => g.ui.close('endstats') }, 'Остаться'),
        el('button', { class: 'btn primary', onclick: () => { g.ui.close('endstats', true); g.toMenu(); } }, 'В главное меню')));
    const p = panel({ title: 'Пролог пройден', sub: 'Сектор 0 · «Сбой»', cls: 'interactive', style: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }, onClose: () => g.ui.close('endstats') }, body);
    g.ui.open('endstats', p, { dim: true });
    g.audio.sfx('success');
  },
};
