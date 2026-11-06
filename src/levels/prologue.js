// ПРОЛОГ «Сбой»: обзорная галерея → коридор А (фонарь, пар, архив) → голокласс (урок L0) → шлюз П-1 → грузовой лифт → ворота сектора 1
// layout (metres). North = −z (towards the Core hall), south = +z
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
import { PrologueWorldA } from './prologue_world.js';
import { PrologueWorldB } from './prologue_world2.js';
import { PrologueScript } from './prologue_script.js';

export class PrologueLevel {
  constructor(game) {
    this.g = game; this.root = new THREE.Group(); this.root.name = 'prologue';
    this.B = new Builder(game, this.root);
    this.zoneName = 'Сектор 0 · Обзорная галерея';
    this.triggers = []; this.anims = []; this.loops = []; this.offs = []; this.screens = [];
    this.platforms = []; this.movers = [];
    this.t = 0; this.objT = 0; this.shake = 0; this.state = 'normal';
    this.mechanisms = { p1_door: (x, i) => this.runDoor(x, i), p2_lift: (x, i) => this.runLift(x, i), p3_radar: (x, i) => this.runRadar(x, i) };
  }
  get save() { return this.g.save; }
  get F() { return this.g.save.flags; }
  // ------------------------------------------------------------------ helpers
  use(obj, prompt, fn, o = {}) { return this.g.interact.add(obj, { prompt, sub: o.sub, key: o.key, range: o.range ?? 2.4, enabled: o.enabled, use: fn, outline: o.outline }); }
  trigger(box, fn, o = {}) { const t = { box, fn, once: o.once !== false, inside: false, enabled: o.enabled || null, exit: o.exit || null }; this.triggers.push(t); return t; }
  say(key, extra) { const F = this.F; if (F['l_' + key]) return Promise.resolve(); F['l_' + key] = true; return this.g.dialogue.say(extra || LINES[key], { flush: true }); }
  light(kind, color, i, x, y, z, o) { return this.B.light(kind, color, i, x, y, z, o); }
  loop(kind, o) { const l = this.g.audio.loop(kind, o); this.loops.push(l); return l; }
  vis(obj, name, html, o = {}) { return this.g.vision.add(obj, { layer: 'quant', name, html, ...o }); }
  tween(dur, fn, ease = easeInOut) { return new Promise(res => { this.anims.push({ t: 0, dur, fn, ease, res }); }); }
  plate(o, x, y, z, ry, src, meas, pw = 0.42, ph = 0.21) {
    const m = plateMesh(o, pw, ph); m.position.set(x, y, z); m.rotation.y = ry; this.root.add(m);
    this.use(m, () => this.g.hasMeasurement(src) ? 'Табличка (данные уже в журнале)' : 'Прочитать табличку', () => { this.g.recordMeasurement(src, meas()); this.updateObjective(); }, { sub: o.head, range: 2.6 });
    return m;
  }
  sign(lines, w, h, x, y, z, ry = 0, o = {}) { const m = this.B.sign(lines, w, h, x, y, z, ry, { bg: o.bg ?? '#1d2226', fg: o.fg ?? '#e9e1c8', size: o.size ?? 110, border: o.border ?? '#e0a91c', ...o }); m.userData.ownMat = true; return m; }
  poster(draw, w, h, x, y, z, ry) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textTexture(draw, 512, Math.round(512 * h / w)), roughness: 0.8 })); m.position.set(x, y, z); m.rotation.y = ry; m.userData.ownMat = true; this.root.add(m); return m; }
  vars(id) { return this.g.problemVars(id); }

  // ------------------------------------------------------------------ build
  async build() {
    const g = this.g, S = g.engine.scene;
    S.add(this.root);
    this.prevFog = S.fog; this.prevBg = S.background; this.prevEnvI = S.environmentIntensity;
    S.fog = new THREE.FogExp2(0x0a0c0e, 0.018); S.background = new THREE.Color(0x020304);
    S.environmentIntensity = 0.35;
    this.envTarget = 0.35;
    this.vDoor = this.vars('p1_door'); this.vLift = this.vars('p2_lift'); this.vRadar = this.vars('p3_radar');
    this.buildCoreHall(); await wait(0);
    this.buildGallery(); await wait(0);
    this.buildCorridor(); await wait(0);
    this.buildArchive(); await wait(0);
    this.buildClassroom(); await wait(0);
    this.buildAirlock(); await wait(0);
    this.buildLift(); await wait(0);
    this.buildExit();
    this.offs.push(g.on('measure', e => this.onMeasure(e)));
    this.offs.push(g.on('line', l => { if (l.who === 'isaac') this.isaacTalk = true; }));
    this.offs.push(g.on('lineend', l => { if (l.who === 'isaac') this.isaacTalk = false; }));
    this.offs.push(g.on('solved', () => this.updateObjective()));
    this.offs.push(g.on('item', () => this.updateObjective()));
  }
  // ------------------------------------------------------------------ helpers for scripted sequences
  run(step) { return new Promise(res => this.anims.push({ step, res })); }
  camAt(p, l) {
    const cam = this.g.engine.camera, s = this.g.cut.shakeAmt || 0;
    cam.position.copy(p); if (s > 0) { cam.position.x += (Math.random() - .5) * s * 0.12; cam.position.y += (Math.random() - .5) * s * 0.12; }
    cam.up.set(0, 1, 0); cam.lookAt(l);
    this.g.cut.lastP = p.clone(); this.g.cut.lastL = l.clone();
  }
  syncPlayerToCamera(feetY) {
    const cam = this.g.engine.camera, e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    this.g.player.teleport(cam.position.x, feetY ?? 0, cam.position.z, e.y, clamp(e.x, -1.2, 1.2));
  }
  sparkBurst(p, n = 40, spread = 2.5) {
    for (let i = 0; i < n; i++) this.sparks.spawn(p.x, p.y, p.z, (Math.random() - .5) * spread, Math.random() * spread * 0.8, (Math.random() - .5) * spread, 0.4 + Math.random() * 0.7, 0.025 + Math.random() * 0.03, 1, 0.75 + Math.random() * 0.25, 0.4);
  }
  // ------------------------------------------------------------------ world state
  setState(st) {
    this.state = st; const acc = st === 'accident', S = this.g.engine.scene;
    this.debris.visible = acc;
    this.cracks.material.opacity = acc ? 0.9 : 0;
    this.galTubes.forEach((t, i) => { t.material = !acc || i === 2 ? this.tubeOn : this.tubeOff; });
    this.galL[0].intensity = acc ? 0 : this.galL[0].userData.base;
    this.galL[1].intensity = acc ? this.galL[1].userData.base * 0.35 : this.galL[1].userData.base;
    this.galDoor.rotation.y = acc ? -1.75 : 0;
    if (acc) { this.backpack.position.set(3.05, 0.1, 0.7); this.backpack.rotation.set(-1.35, 0.6, 0, 'YXZ'); }
    else { this.backpack.position.set(2.35, 0.49, 1.66); this.backpack.rotation.set(0, -0.3, 0); }
    if (acc) { this.calcMesh.position.set(3.6, 0.009, -2.05); this.calcMesh.rotation.set(0, 2.2, 0); }
    if (!this.glint) {
      const gt = textTexture((x, W, H) => { const gr = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,240,200,.5)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(W * 0.48, 0, W * 0.04, H); x.fillRect(0, H * 0.48, W, H * 0.04); }, 64, 64);
      this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(3, 3, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.glint.userData.ownMat = true; this.glint.scale.setScalar(0.22); this.root.add(this.glint);
    }
    this.glint.position.copy(this.calcMesh.position).add(V(0, 0.05, 0));
    this.glint.visible = acc && !this.save.items.includes('calculator');
    this.coreMat.uniforms.uStab.value = acc ? 0.02 : 0.45; this.heat = acc ? 0.75 : 0.3;
    if (S.fog) S.fog.density = acc ? 0.022 : 0.011;
    this.emLamps.forEach(m => m.material.color.setRGB(acc ? 6 : 0.5, acc ? 0.5 : 0.05, acc ? 0.3 : 0.03));
  }
  restore() {
    const F = this.F, S = this.save, g = this.g;
    if (S.items.includes('backpack')) this.backpack.visible = false;
    if (S.items.includes('calculator')) this.calcMesh.visible = false;
    if (F.lockerOpen) this.locker.pivot.rotation.y = -1.9;
    if (S.tools.includes('flashlight')) this.flashMesh.visible = false;
    this.steamOn = !F.valve;
    if (F.valve) { this.steamOff(true); this.valve.wheel.rotation.z = PI * 3; }
    if (F.archive) this.openArchive(true);
    if (F.card) this.cardMesh.visible = false;
    if (F.classroom) this.isaac.group.visible = true;
    if (S.lessons.L0) { this.removeBarrier(true); this.isaac.group.position.copy(this.isaacAside); }
    if (F.cabinetOpen) this.cabinet.pivot.rotation.y = -1.9;
    if (S.tools.includes('laser')) this.laserMesh.visible = false;
    if (g.isSolved('p1_door')) { this.leafX = this.doorS; this.beaconOk(); }
    if (g.isSolved('p2_lift')) { this.platY = this.liftH; this.shaftDoor.off.y = 0; this.eastGate.off.y = 2.5; } else this.shaftDoor.off.y = 2.5;
    if (g.isSolved('p3_radar')) this.radarDone();
  }
  spawnPoint(cp) {
    const h = this.liftH;
    return ({ start: [2.2, 0, 1.0, 0.3], gallery: [2.2, 0, 1.0, 0.3], classroom: [6, 0, 21.6, PI], door1: [20.2, 0, 26, -PI / 2], lift_top: [35.0, h, 26, -PI / 2], end: [37.6, h, 26, -PI / 2] })[cp] || [2.2, 0, 1.0, 0.3];
  }
  zoneFor(cp) { return ({ classroom: 'Сектор 0 · Голографический класс', door1: 'Сектор 0 · Шлюз П-1', lift_top: 'Сектор 0 · Лифтовой зал', end: 'Сектор 0 · Ворота сектора 1' })[cp] || 'Сектор 0 · Обзорная галерея'; }
  respawn() { const p = this.spawnPoint(this.save.checkpoint); this.g.player.teleport(p[0], p[1], p[2], p[3], 0); this.g.hud.toast('Возврат', 'Вы вернулись к последней контрольной точке.', '', 2.5); }
  async start(cp) {
    const g = this.g, F = this.F;
    this.restore();
    if (!F.intro) { this.setState('normal'); await this.intro(); return; }
    this.setState('accident');
    const p = this.spawnPoint(cp); g.player.teleport(p[0], p[1], p[2], p[3], 0);
    this.zoneName = this.zoneFor(cp);
    g.audio.playMusic(cp === 'classroom' ? 'holo' : (cp === 'door1' || cp === 'lift_top' || cp === 'end') ? 'mech' : 'tension');
    this.startAmbience();
    if (this.save.tools.includes('flashlight') && (cp === 'gallery' || cp === 'start')) g.tools.setFlash(true, true);
    this.updateObjective(true);
    await g.hud.fade(0, 1.0);
  }
  startAmbience() {
    if (this.ambOn) return; this.ambOn = true;
    this.coreHum ||= this.loop('core', { vol: 0.4, pos: CORE, ref: 22 });
    if (this.steamOn) this.steamLoop = this.loop('steam', { vol: 0.3, pos: this.steamPos, ref: 2.5 });
    this.sparkLoop = this.loop('sparks', { vol: 0.2, pos: this.sparkPos, ref: 2 });
    if (this.F.classroom) this.holoLoop ||= this.loop('holo', { vol: 0.07, pos: V(CLS.cx, 1.5, CLS.cz), ref: 4 });
    this.loop('wind', { vol: 0.05 });
    this.loop('hum', { vol: 0.05, pos: V(32, 6, 26), ref: 6 });
  }
  // ------------------------------------------------------------------ objective + key hints
  keyhints() {
    const S = this.save, L = [];
    if (S.items.includes('backpack')) L.push(['Tab', 'рюкзак'], ['N', 'формулы'], ['T', 'задачи']);
    if (S.items.includes('calculator')) L.push(['C', 'калькулятор']);
    if (S.tools.includes('flashlight')) L.push(['F', 'фонарь']);
    if (S.tools.includes('laser')) L.push(['Q', 'рулетка']);
    if (S.flags.vision) L.push(['V', 'физ. зрение']);
    return L;
  }
  updateObjective(force) {
    const g = this.g, S = this.save, F = this.F; if (!S || !F.intro) return;
    const has = id => S.items.includes(id), tool = id => S.tools.includes(id), m = src => g.hasMeasurement(src), ok = '✓';
    let o;
    if (!has('backpack')) o = ['Найдите свой рюкзак', 'он где-то у скамеек галереи'];
    else if (!has('calculator')) o = ['Подберите калькулятор', 'у окна галереи что-то блестит'];
    else if (!F.corridor) o = ['Выйдите в коридор А', 'открытая дверь в задней стене галереи'];
    else if (!tool('flashlight')) o = ['Найдите фонарь', 'красный аварийный шкаф в коридоре'];
    else if (!F.valve) o = ['Перекройте пар', 'вентиль В-3 на стене коридора, перед утечкой'];
    else if (!F.classroom) o = ['Дойдите до голографического класса', 'в конце коридора А'];
    else if (!S.lessons.L0) o = ['Пройдите урок у голопроектора', 'центр класса · клавиша E'];
    else if (!tool('laser')) o = ['Заберите лазерную рулетку', 'шкаф «ПРИБОРЫ» у стены класса'];
    else if (!g.isSolved('p1_door')) o = F.airlock ? ['Откройте гермодверь П-1', `ход створки ${m('plate_s') ? ok : '— табличка'} · время цикла ${m('plate_t') ? ok : '— табличка'} · затем пульт`] : ['Идите к шлюзу П-1', 'восточный выход из класса'];
    else if (!g.isSolved('p2_lift')) o = F.liftHall ? ['Поднимитесь на грузовом лифте', `высота h ${m('h_lift') ? ok : '— рулеткой, метки A и B'} · скорость ${m('plate_vlift') ? ok : '— табличка мотора'} · пульт на платформе`] : ['Идите к грузовому лифту', 'за гермодверью П-1'];
    else o = ['Пройдите к воротам сектора 1', 'коридор за площадкой лифта'];
    const key = o.join('|') + this.zoneName;
    if (key !== this._objKey || force) { this._objKey = key; g.setObjective(o[0], o[1], this.zoneName); }
    const kh = this.keyhints(), kk = JSON.stringify(kh); if (kk !== this._khKey || force) { this._khKey = kk; g.hud.setKeyhints(kh); }
  }
  // ------------------------------------------------------------------ per-frame
  fixedUpdate() {
    if (this.leaf) this.leaf.off.z = this.leafX;
    if (this.platK) { this.platK.off.y = this.platY; this.snapA.y = this.platY; }
    let moved = false;
    for (const m of this.movers) {
      const x = m.base.x + m.off.x, y = m.base.y + m.off.y, z = m.base.z + m.off.z;
      m.k.delta.set(x - m.last.x, y - m.last.y, z - m.last.z);
      if (m.k.delta.lengthSq() > 0) { m.k.body.setTranslation({ x, y, z }, true); m.last.set(x, y, z); moved = true; }
    }
    if (moved) this.g.physics.world.propagateModifiedBodyPositionsToColliders();
  }
  // shadow maps of lights far from the camera stop re-rendering (static rooms) — big saving with several shadowed spots
  shadowLod(dt) {
    this.shT = (this.shT || 0) - dt; if (this.shT > 0) return; this.shT = 0.35;
    const p = this.g.engine.camera.position;
    for (const L of this.B.lights) {
      if (!L.castShadow) continue;
      const near = L.position.distanceTo(p) < (L.distance || 20) + 2;
      if (near && !L.shadow.autoUpdate) L.shadow.needsUpdate = true;
      L.shadow.autoUpdate = near;
    }
  }
  update(sdt, dt) {
    this.shadowLod(dt);
    const g = this.g, cam = g.engine.camera, t = (this.t += dt), acc = this.state === 'accident', S = g.engine.scene;
    // scripted animations (real time)
    const skipping = g.cut.skipping;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i]; let done;
      if (a.step) done = a.step(dt);
      else { a.t = skipping ? a.dur : a.t + dt; const u = Math.min(1, a.t / a.dur); a.fn(a.ease(u)); done = u >= 1; }
      if (done) { this.anims.splice(i, 1); a.res(); }
    }
    // triggers (by the player's feet)
    if (!g.cut.active && !g.lesson.active) {
      const f = g.player.feet;
      for (const tr of this.triggers) {
        if (tr.dead) continue;
        const b = tr.box, inside = f.x > b[0] && f.y > b[1] && f.z > b[2] && f.x < b[3] && f.y < b[4] && f.z < b[5] && (!tr.enabled || tr.enabled());
        if (inside && !tr.inside) { tr.inside = true; try { tr.fn(); } catch (e) { console.error(e); } if (tr.once) tr.dead = true; }
        else if (!inside && tr.inside) { tr.inside = false; tr.exit && tr.exit(); }
      }
    }
    for (const sc of this.screens) sc.update(dt);
    for (const m of this.movers) if (m.mesh) m.mesh.position.copy(m.last);
    // countdown on the gallery screens
    if (this.counting) { this.countT = Math.max(0, this.countT - dt); const s = Math.ceil(this.countT); this.countText = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
    // the Core
    const heat = this.heat ?? 0.3, cm = this.coreMat.uniforms;
    cm.uHeat.value = heat * (acc ? 0.85 + Math.sin(t * 7.3) * 0.08 + (Math.random() < 0.015 ? 0.35 : 0) : 1);
    if (acc) cm.uStab.value = 0.02 + Math.max(0, Math.sin(t * 0.37)) * 0.05;
    this.rings.forEach((r, i) => {
      r.tilt ??= r.pivot.rotation.x;
      const k = this.launching ? 1 + heat * 7 : acc ? 1.6 + Math.sin(t * 0.7 + i) * 0.9 : 1;
      r.pivot.rotation.y += r.sp * k * dt;
      r.pivot.rotation.x = r.tilt + (acc ? Math.sin(t * 1.3 + i * 2) * 0.06 : this.launching ? (Math.random() - .5) * 0.02 * heat : 0);
    });
    this.coreHalo.scale.setScalar(1 + Math.sin(t * 2.1) * 0.02 + (this.launching ? heat * 0.15 : 0));
    this.coreLight.intensity = this.coreLight.userData.base * (0.55 + heat * 0.6) * (acc && Math.random() < 0.03 ? 0.6 : 1);
    this.arcT = (this.arcT ?? 0) - dt;
    if (this.arcT <= 0) {
      this.arcT = (this.launching ? 0.06 : acc ? 0.55 : 2.6) * (0.5 + Math.random());
      const a = this.arcs.find(a => a.life <= 0);
      if (a) {
        const d = new THREE.Vector3().randomDirection(); a.from = CORE.clone().addScaledVector(d, 2.9);
        const d2 = d.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.6)).normalize(); a.to = CORE.clone().addScaledVector(d2, 4.4 + Math.random() * 2.4);
        a.life = 0.1 + Math.random() * 0.22; a.line.visible = true;
      }
    }
    for (const a of this.arcs) if (a.life > 0) { a.life -= dt; a.set(a.from, a.to, 0.9); if (a.life <= 0) a.line.visible = false; }
    // Lomov in the cabin
    if (this.lomovSil) { const ag = this.lomovAgitated && !acc ? 1 : 0; this.lomovSil.position.x = 0.6 + Math.sin(t * (0.6 + ag * 2.2)) * (0.25 + ag * 0.5); this.lomovHead.position.x = this.lomovSil.position.x; }
    // gallery after the accident: flicker, red emergency lamps, sparks, dust
    if (acc) {
      this.flk = (this.flk ?? 0) - dt;
      if (this.flk <= 0) { this.flkOn = !this.flkOn || Math.random() < 0.3; this.flk = this.flkOn ? 0.1 + Math.random() * 2.2 : 0.03 + Math.random() * 0.15; this.galTubes[2].material = this.flkOn ? this.tubeOn : this.tubeOff; this.galL[1].intensity = this.galL[1].userData.base * (this.flkOn ? 0.35 : 0.04); }
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
      this.emLamps.forEach(m => m.material.color.setRGB(1 + pulse * 6, 0.12 + pulse * 0.5, 0.08 + pulse * 0.3));
      this.sparkT = (this.sparkT ?? 1) - dt;
      if (this.sparkT <= 0) { this.sparkT = 0.4 + Math.random() * 2.4; this.sparkBurst(this.sparkPos, 10 + Math.random() * 25 | 0, 2.2); const d = cam.position.distanceTo(this.sparkPos); if (d < 14) g.audio.sfx('spark', { vol: clamp(1 - d / 14, 0, 1) * 0.7 }); }
      if (cam.position.z < 3.2 && Math.random() < dt * 14) this.dust.spawn(-7 + Math.random() * 14, 0.2 + Math.random() * 3.5, -2.6 + Math.random() * 5.4, (Math.random() - .5) * 0.06, (Math.random() - .3) * 0.04, (Math.random() - .5) * 0.06, 6 + Math.random() * 4, 0.02 + Math.random() * 0.03);
      if (this.glint && this.glint.visible) this.glint.material.opacity = Math.max(0, Math.sin(t * 2.2)) ** 8;
      // corridor lamp
      this.cflk = (this.cflk ?? 0) - dt;
      if (this.cflk <= 0) { this.cOn = !this.cOn; this.cflk = this.cOn ? 0.05 + Math.random() * 0.25 : 0.6 + Math.random() * 3; this.flickTube.material = this.cOn ? this.flickOn : this.tubeOff; }
    }
    this.sparks.update(dt); this.dust.update(dt);
    // steam leak
    if (this.steamOn && cam.position.z > 4 && cam.position.z < 21) {
      const n = Math.min(12, Math.round(dt * 70) + (Math.random() < (dt * 70) % 1 ? 1 : 0));
      for (let i = 0; i < n; i++) this.steam.spawn(this.steamPos.x, this.steamPos.y + (Math.random() - .5) * 0.05, this.steamPos.z + (Math.random() - .5) * 0.05, -1.8 - Math.random() * 1.2, (Math.random() - .3) * 0.5, (Math.random() - .5) * 0.7, 1.2 + Math.random() * 0.8, 0.12 + Math.random() * 0.1);
    }
    this.steam.update(dt);
    // archive tape reels
    if (this.reelSpin > 0) { this.reelSpin -= dt; this.reels.forEach((r, i) => { r.rotation.y += dt * (i ? 5 : 4); }); }
    // ISAAC
    if (this.isaac.group.visible) this.isaac.update(dt, this.isaacTalk, cam.position);
    // airlock beacon + lift cable + sector gate ring
    if (this.beacon && !this.beaconGreen) { const p = Math.max(0, Math.sin(t * 5)); this.beacon.intensity = this.beacon.userData.base * p; this.beaconM.material.color.setRGB(0.6 + p * 5, 0.1 + p * 0.5, 0.05); }
    if (this.cable) { const top = LFT.H - 0.85, bot = this.platY + 2.99; const len = Math.max(0.1, top - bot); this.cable.scale.y = len; this.cable.position.y = bot + len / 2; }
    if (this.pulley) { this.pulley.rotation.order = 'ZYX'; this.pulley.rotation.y = -this.platY / 0.36; }
    if (this.drum) { this.drum.rotation.order = 'ZYX'; this.drum.rotation.y = this.platY / 0.3; }
    if (this.gateRing) { const p = 0.5 + 0.5 * Math.sin(t * (this.gateOk ? 5 : 2)); if (this.gateOk) this.gateRing.material.color.setRGB(0.3, 2 + p * 3, 1 + p); else this.gateRing.material.color.setRGB(2 + p * 3, 1 + p * 1.6, 0.2); }
    // post effects: chromatic glitch, environment
    this.chroma = damp(this.chroma || 0, acc ? 0.0006 : 0, 1.5, dt);
    g.engine.setChromatic(this.chroma);
    if (S.environmentIntensity !== undefined) S.environmentIntensity = damp(S.environmentIntensity, this.envTarget, 2, dt);
    this.objT += dt; if (this.objT > 0.5) { this.objT = 0; this.updateObjective(); }
  }
  dispose() {
    this.disposed = true;
    this.offs.forEach(f => { try { f(); } catch (e) { } }); this.offs = [];
    this.loops.forEach(l => { try { l.stop(0.2); } catch (e) { } }); this.loops = [];
    const S = this.g.engine.scene;
    S.remove(this.root);
    const geos = new Set(), mats = new Set();
    this.root.traverse(o => { if (o.geometry) geos.add(o.geometry); if (o.material && o.userData.ownMat) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose(); });
    geos.forEach(x => x.dispose()); mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    this.screens.forEach(s => { s.tex.dispose(); s.mat.dispose(); });
    [this.sparks, this.dust, this.steam].forEach(p => { if (p) { p.geo.dispose(); p.mat.dispose(); } });
    S.fog = this.prevFog || null; S.background = this.prevBg || null; S.environmentIntensity = this.prevEnvI ?? 1;
    this.g.hud.tool(null); this.g.hud.setKeyhints([]);
  }
}
Object.assign(PrologueLevel.prototype, PrologueWorldA, PrologueWorldB, PrologueScript);
