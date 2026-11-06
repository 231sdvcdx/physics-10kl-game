// Player tools: flashlight (F), laser tape measure (two-point, Δh, snapping to markers), stopwatch
import * as THREE from 'three';
import { fmt, fmtFixed, damp } from '../core/util.js';
import { labelSprite } from '../ui/lesson.js';
import { ITEMS } from '../content/items.js';
import { RAPIER } from '../core/physics.js';
const _fd = new THREE.Vector3();

function cookieTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#fffbe8'); g.addColorStop(0.32, '#cfc6ae'); g.addColorStop(0.4, '#f4ecd6'); g.addColorStop(0.62, '#8b836f'); g.addColorStop(0.8, '#2a2822'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); x.arc(128, 128, 20 + Math.random() * 100, 0, Math.PI * 2); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Tools {
  constructor(game) {
    this.g = game; this.active = null; this.flashOn = false;
    const cam = game.engine.camera;
    // flashlight
    const fl = this.flash = new THREE.SpotLight(0xfff0d8, 0, 30, 0.46, 0.55, 1.4);
    fl.position.set(0.16, -0.14, 0.05); fl.target.position.set(0.04, -0.06, -4);
    fl.userData.shadowCandidate = true; fl.shadow.mapSize.set(1024, 1024); fl.shadow.bias = -0.0004; fl.shadow.normalBias = 0.02; fl.shadow.camera.near = 0.2; fl.shadow.camera.far = 30;
    fl.map = cookieTexture();
    cam.add(fl, fl.target);
    this.flashI = 0;
    // viewmodel for handheld devices
    this.vm = new THREE.Group(); this.vm.position.set(0.24, -0.22, -0.46); cam.add(this.vm); this.vm.visible = false;
    this.buildLaserModel(); this.buildStopwatchModel();
    // laser beam + dot
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), beamMat);
    this.beam.frustumCulled = false; this.beam.renderOrder = 8; this.beam.visible = false;
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 0.6, 0.4), depthTest: true }));
    this.dot.visible = false;
    this.marks = new THREE.Group();
    game.engine.scene.add(this.beam, this.dot, this.marks);
    this.A = null; this.B = null; this.aim = null;
    this.sw = { run: false, t: 0, laps: [] };
    this.bob = 0;
  }
  reset() {
    this.active = null; this.setFlash(false, true); this.vm.visible = false; this.clearMarks(); this.beam.visible = false; this.dot.visible = false; this.g.hud.tool(null);
    if (this.beam.parent !== this.g.engine.scene) this.g.engine.scene.add(this.beam, this.dot, this.marks);
  }
  has(id) { return this.g.save && this.g.save.tools.includes(id); }
  buildLaserModel() {
    const g = this.laserModel = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.13), new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.45, metalness: 0.1 }));
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.02, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })); grip.position.set(0, -0.022, 0.03);
    this.scr = document.createElement('canvas'); this.scr.width = 256; this.scr.height = 128; this.scrTex = new THREE.CanvasTexture(this.scr); this.scrTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.0275), new THREE.MeshBasicMaterial({ map: this.scrTex, color: new THREE.Color(1.5, 1.5, 1.5) }));
    screen.rotation.x = -Math.PI / 2; screen.position.set(0, 0.0181, 0.02);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.004, -0.066);
    g.add(body, grip, screen, lens); g.rotation.set(0.12, -0.08, 0);
    this.lensPos = new THREE.Vector3(0, 0.004, -0.07);
    this.vm.add(g);
  }
  buildStopwatchModel() {
    const g = this.swModel = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 32), new THREE.MeshStandardMaterial({ color: 0xb7bcc2, roughness: 0.3, metalness: 0.9 }));
    body.rotation.x = Math.PI / 2 - 0.5;
    this.swc = document.createElement('canvas'); this.swc.width = this.swc.height = 256; this.swTex = new THREE.CanvasTexture(this.swc); this.swTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshBasicMaterial({ map: this.swTex, color: new THREE.Color(1.3, 1.3, 1.3) }));
    face.position.set(0, 0.0045, 0.0078); face.rotation.x = -0.5;
    g.add(body, face); g.visible = false; this.vm.add(g);
  }
  setFlash(on, silent = false) {
    if (on && !this.has('flashlight')) return;
    this.flashOn = on; if (!silent) this.g.audio.sfx('click', { vol: 1.2 });
  }
  toggleFlashlight() {
    if (!this.has('flashlight')) { this.g.hud.toast('Фонарик', 'Фонарика нет. Поищите аварийный шкаф.', 'red', 2); return; }
    this.setFlash(!this.flashOn);
  }
  available() { return ['laser', 'stopwatch'].filter(t => this.has(t)); }
  select(id) {
    if (id && !this.has(id)) return;
    this.active = id; this.clearMarks();
    this.vm.visible = !!id; this.laserModel.visible = id === 'laser'; this.swModel.visible = id === 'stopwatch';
    this.vm.position.y = -0.5; // raise animation
    this.g.audio.sfx('clank', { vol: 0.3 });
    if (!id) this.g.hud.tool(null);
    this.g.emit('tool', id);
  }
  cycle(dir = 1) {
    const av = [null, ...this.available()]; if (av.length < 2) { this.g.hud.toast('Инструменты', 'Инструментов пока нет. Они находятся по ходу игры.', '', 2); return; }
    const i = av.indexOf(this.active); this.select(av[(i + dir + av.length) % av.length]);
  }
  clearMarks() { this.A = null; this.B = null; this.marks.children.forEach(m => m.userData.dispose && m.userData.dispose()); this.marks.clear(); }
  addMark(p, name) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 1.2, 0.6) })); s.position.copy(p);
    const l = labelSprite(name, { size: 0.12, color: '#ffd0c8', border: '#ff5a4f' }); l.position.copy(p).add(new THREE.Vector3(0, 0.14, 0));
    this.marks.add(s, l);
  }
  use() {
    if (this.active === 'laser') {
      if (!this.aim) { this.g.audio.sfx('error'); return; }
      const p = this.aim.point.clone(); const mk = this.aim.marker;
      if (!this.A || this.B) { this.clearMarks(); this.A = { p, mk }; this.addMark(p, 'A'); this.g.audio.sfx('laser'); }
      else {
        this.B = { p, mk }; this.addMark(p, 'B'); this.g.audio.sfx('laser');
        const pts = [this.A.p, this.B.p];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: new THREE.Color(4, 0.6, 0.4), dashSize: 0.08, gapSize: 0.05, transparent: true, depthTest: false }));
        line.computeLineDistances(); line.renderOrder = 25; this.marks.add(line);
        const dh = Math.abs(this.B.p.y - this.A.p.y);
        this.g.emit('measure', { a: this.A, b: this.B, dist: this.A.p.distanceTo(this.B.p), dh });
      }
    } else if (this.active === 'stopwatch') {
      this.sw.run = !this.sw.run; this.g.audio.sfx('tick'); this.g.emit('stopwatch', this.sw);
    }
  }
  alt() {
    if (this.active === 'laser') { this.clearMarks(); this.g.audio.sfx('beep', { f: 600 }); }
    else if (this.active === 'stopwatch') { this.sw.run = false; this.sw.t = 0; this.g.audio.sfx('tick'); }
  }
  drawLaserScreen(text, sub) {
    const x = this.scr.getContext('2d'); x.fillStyle = '#10200f'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#9dff8a'; x.font = "bold 54px 'JetBrains Mono'"; x.textAlign = 'right'; x.fillText(text, 244, 70);
    x.font = "22px 'JetBrains Mono'"; x.fillStyle = '#6fbf60'; x.textAlign = 'left'; x.fillText(sub, 12, 112);
    this.scrTex.needsUpdate = true;
  }
  update(dt) {
    const g = this.g, cam = g.engine.camera;
    // near-field compensation: a wall right in front of the lens must not blow out the image
    if (this.flashOn && g.physics && g.player && g.player.body && (this._nfT = (this._nfT || 0) + 1) % 3 === 0) {
      cam.getWorldDirection(_fd);
      let hit = null; try { hit = g.physics.ray(cam.position, _fd, 6, { excludeBody: g.player.body, flags: RAPIER.QueryFilterFlags.EXCLUDE_SENSORS }); } catch (e) { }
      const d = hit ? hit.toi : 6;
      this.nearK = Math.min(1, Math.pow(Math.max(0.15, d) / 2.2, 1.4));
    }
    const want = this.flashOn ? 9 * (g.engine.q.lights ?? 1) * (this.nearK ?? 1) : 0;
    this.flashI = damp(this.flashI, want, 25, dt);
    // tiny flicker when battery is "old"
    this.flash.intensity = this.flashI * (this.flashOn && Math.random() < 0.01 ? 0.6 : 1);
    // the light stays in the scene (toggling visibility would recompile every lit material); only its shadow map stops updating
    this.flash.visible = true;
    this.flash.shadow.autoUpdate = this.flashI > 0.05;
    const busy = !g.canInteract();
    this.vm.position.y = damp(this.vm.position.y, busy ? -0.5 : -0.22 + Math.sin(this.bob) * 0.004, 10, dt);
    this.bob += dt * (g.player.hspeed > 0.4 ? 8 : 1.5);
    this.beam.visible = false; this.dot.visible = false; this.aim = null;
    if (this.active === 'laser' && !busy) {
      const o = cam.position.clone(); const d = new THREE.Vector3(); cam.getWorldDirection(d);
      const hit = g.physics.ray(o, d, 40, { excludeCollider: g.player.collider });
      let txt = '-.-- м', sub = this.A && !this.B ? 'точка A задана' : 'ЛКМ: точка A';
      if (hit) {
        let p = hit.point; let mk = null;
        if (hit.data && hit.data.marker) { mk = hit.data.marker; if (hit.data.snap) p = hit.data.snap.clone(); }
        this.aim = { point: p, marker: mk };
        const lens = this.lensPos.clone(); this.laserModel.localToWorld(lens);
        const dir = p.clone().sub(lens); const L = dir.length();
        this.beam.position.copy(lens); this.beam.scale.set(1, 1, L); this.beam.lookAt(p); this.beam.visible = true;
        this.dot.position.copy(p).addScaledVector(d, -0.01); this.dot.visible = true;
        txt = fmtFixed(hit.toi, 2) + ' м';
        if (this.A && !this.B) { const ab = this.A.p.distanceTo(p); txt = fmtFixed(ab, 2) + ' м'; sub = `Δh ${fmtFixed(Math.abs(p.y - this.A.p.y), 2)} м`; }
        if (mk) sub = '◎ метка: ' + (hit.data.markerName || mk);
      }
      if (this.A && this.B) {
        const ab = this.A.p.distanceTo(this.B.p), dh = Math.abs(this.B.p.y - this.A.p.y), hz = Math.hypot(this.B.p.x - this.A.p.x, this.B.p.z - this.A.p.z);
        g.hud.tool(ITEMS.laser.name, `AB = ${fmtFixed(ab, 2)} м`, `Δh = <b>${fmtFixed(dh, 2)} м</b> · по горизонтали ${fmtFixed(hz, 2)} м<br>ЛКМ — новое измерение · ПКМ — сброс`);
        this.drawLaserScreen(fmtFixed(dh, 2), 'Δh, м  (A→B)');
      } else {
        g.hud.tool(ITEMS.laser.name, txt, this.A ? 'ЛКМ — поставить точку B · ПКМ — сброс' : 'ЛКМ — точка A, затем точка B: расстояние и перепад высот Δh', [!!this.A, !!this.B]);
        this.drawLaserScreen(txt.replace(' м', ''), sub);
      }
    } else if (this.active === 'stopwatch') {
      if (this.sw.run) this.sw.t += dt;
      const s = this.sw.t;
      g.hud.tool(ITEMS.stopwatch.name, fmtFixed(s, 2) + ' с', 'ЛКМ — старт/стоп · ПКМ — сброс');
      this.swAcc = (this.swAcc || 0) + dt;
      if (this.swAcc > 0.05) { this.swAcc = 0; const x = this.swc.getContext('2d'); x.fillStyle = '#f3efe4'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#222'; x.lineWidth = 4; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; const r1 = i % 5 ? 110 : 96; x.beginPath(); x.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1); x.lineTo(128 + Math.sin(a) * 120, 128 - Math.cos(a) * 120); x.stroke(); } const a = (s % 60) / 60 * Math.PI * 2; x.strokeStyle = '#c0281c'; x.lineWidth = 5; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104); x.stroke(); x.fillStyle = '#222'; x.font = "28px 'JetBrains Mono'"; x.textAlign = 'center'; x.fillText(fmtFixed(s, 1), 128, 180); this.swTex.needsUpdate = true; }
    }
  }
}
