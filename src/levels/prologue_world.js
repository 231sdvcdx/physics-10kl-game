// Пролог «Сбой» — часть уровня (PrologueWorldA); методы подмешиваются в PrologueLevel
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

export const PrologueWorldA = {
  // ------------------------------------------------------------------ the Core hall (seen through the gallery window)
  buildCoreHall() {
    const B = this.B, R = this.root;
    const H = new THREE.Group(); R.add(H); this.hallG = H;
    const wallM = mat('concreteDk').clone(); wallM.side = THREE.BackSide;
    const cyl = new THREE.Mesh(cylGeo(HALL.r, HALL.r, 36, 72, 0.5, true), wallM); cyl.position.set(HALL.cx, 2, HALL.cz); cyl.userData.ownMat = true; cyl.receiveShadow = true; H.add(cyl);
    const disk = (y, m, up) => { const cg = new THREE.CircleGeometry(HALL.r, 72); const uv = cg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * HALL.r / 3, uv.getY(i) * HALL.r / 3); const d = new THREE.Mesh(cg, mat(m)); d.rotation.x = up ? -PI / 2 : PI / 2; d.position.set(HALL.cx, y, HALL.cz); H.add(d); return d; };
    disk(-16, 'floor', true); disk(20, 'darkmetal', false);
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * PI * 2; const x = HALL.cx + Math.cos(a) * (HALL.r - 0.4), z = HALL.cz + Math.sin(a) * (HALL.r - 0.4);
      if (z > -12 && Math.abs(x) < 10) continue;
      const rib = new THREE.Mesh(boxGeo(0.9, 36, 0.9, 1), mat('darkmetal')); rib.position.set(x, 2, z); rib.lookAt(HALL.cx, 2, HALL.cz); H.add(rib);
      if (i % 2 === 0) for (const y of [-9, -1, 7, 14]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.8, 0.1), glow(i % 6 === 0 ? 0xff7a3a : 0xffd2a0, i % 6 === 0 ? 4 : 2.2)); const aa = a + PI / 36; s.position.set(HALL.cx + Math.cos(aa) * (HALL.r - 0.15), y, HALL.cz + Math.sin(aa) * (HALL.r - 0.15)); s.lookAt(HALL.cx, y, HALL.cz); H.add(s); }
    }
    // gallery rings of balconies
    for (const y of [-7.5, 9.5]) { const ring = new THREE.Mesh(torusGeo(HALL.r - 1.6, 0.12, 8, 120, 1), mat('pipeYellow')); ring.rotation.x = PI / 2; ring.position.set(HALL.cx, y + 1, HALL.cz); H.add(ring); const deck = new THREE.Mesh(new THREE.RingGeometry(HALL.r - 1.8, HALL.r, 96, 1), mat('plate')); deck.rotation.x = -PI / 2; deck.position.set(HALL.cx, y, HALL.cz); H.add(deck); }
    // the Core
    const cm = this.coreMat = coreMaterial(); cm.uniforms.uHeat.value = 0.35;
    const core = this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0, 24), cm); core.position.copy(CORE); core.userData.ownMat = true; H.add(core);
    this.coreHalo = new THREE.Mesh(new THREE.SphereGeometry(4.0, 32, 20), holoMaterial(0xff8a3a, { opacity: 0.3, rim: 3.5, intensity: 1.5, scan: 0.25 })); this.coreHalo.position.copy(CORE); this.coreHalo.userData.ownMat = true; H.add(this.coreHalo);
    this.rings = [];
    for (const [Rr, tilt, sp] of [[4.6, 0.35, 0.22], [5.6, -0.6, -0.15], [6.6, 1.2, 0.09]]) {
      const pivot = new THREE.Group(); pivot.position.copy(CORE); pivot.rotation.set(tilt, 0, tilt * 0.6); H.add(pivot);
      const ring = new THREE.Mesh(torusGeo(Rr, 0.15, 12, 120, 2), mat('brass')); ring.rotation.x = PI / 2; pivot.add(ring);
      for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; const n = new THREE.Mesh(boxGeo(0.45, 0.45, 0.45, 1), mat('darkmetal')); n.position.set(Math.cos(a) * Rr, 0, Math.sin(a) * Rr); pivot.add(n); const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.47), glow(0x62e6ff, 6)); l.position.copy(n.position); pivot.add(l); }
      this.rings.push({ pivot, sp, base: sp });
    }
    this.arcs = []; for (let i = 0; i < 5; i++) { const a = new Arc(0xffd0a0, 22); a.line.visible = false; a.life = 0; H.add(a.line); this.arcs.push(a); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; const arm = new THREE.Mesh(boxGeo(0.6, 0.6, 14.5, 1), mat('steel')); arm.position.set(CORE.x + Math.cos(a) * 14, CORE.y + (i % 2 ? 4 : -4), CORE.z + Math.sin(a) * 14); arm.lookAt(CORE); H.add(arm); }
    this.coreLight = this.light('point', 0xff9a50, 1600, CORE.x, CORE.y, CORE.z, { distance: 40, decay: 1.35 });
    // Lomov's control cabin on the far wall
    const cab = new THREE.Group(); cab.position.set(-6, 3.0, -45.6); H.add(cab);
    cab.add(at(new THREE.Mesh(boxGeo(4.4, 0.25, 3, 1), mat('darkmetal')), 0, -1.4, 0));
    cab.add(at(new THREE.Mesh(boxGeo(4.4, 0.25, 3, 1), mat('darkmetal')), 0, 1.4, 0));
    for (const x of [-2.1, 2.1]) cab.add(at(new THREE.Mesh(boxGeo(0.2, 2.8, 3, 1), mat('darkmetal')), x, 0, 0));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), glow(0xffc890, 1.6)); back.position.set(0, 0, -1.3); cab.add(back);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), glassMat()); glass.position.z = 1.45; cab.add(glass);
    const sil = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.9, 6, 12), solid(0x050505, 1)); sil.position.set(0.6, -0.55, 0.3); cab.add(sil); this.lomovSil = sil;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), solid(0x050505, 1)); head.position.set(0.6, 0.18, 0.3); cab.add(head); this.lomovHead = head;
    const desk = new THREE.Mesh(boxGeo(3, 0.9, 0.6, 1), solid(0x0a0a0a, 1)); desk.position.set(0, -0.9, 0.9); cab.add(desk);
    this.cabSign = signMesh(['ПУЛЬТ УПРАВЛЕНИЯ ЯДРОМ'], 3.6, 0.42, { bg: '#151a1d', fg: '#ffcf8a', size: 90, emissive: 2.2 }); this.cabSign.position.set(0, 1.85, 1.5); cab.add(this.cabSign); this.cabSign.userData.ownMat = true;
    this.cabin = cab;
    // catwalk from the cabin towards the Core (broken after the accident)
    const cw = new THREE.Group(); cw.position.set(-6, -0.4, -38.5); H.add(cw);
    cw.add(new THREE.Mesh(boxGeo(1.8, 0.15, 11, 1), mat('plate')));
    for (const x of [-0.85, 0.85]) { const r = new THREE.Mesh(boxGeo(0.05, 0.05, 11, 1), mat('pipeYellow')); r.position.set(x, 1, 0); cw.add(r); }
    this.catwalk = cw;
    // big feed pipes
    for (const x of [-12, 12]) B.pipe([[x, -16, -36], [x, 3, -36], [x * 0.35, 3, -30]], 0.45, 'pipeRed', { parent: H, cast: false });
  },

  // ------------------------------------------------------------------ gallery
  buildGallery() {
    const B = this.B, R = this.root;
    B.floor(GAL.x0, GAL.z0, GAL.x1, GAL.z1, 0, 'floorLt', { surface: 'tile', tile: 1.2 });
    B.ceil(GAL.x0, GAL.z0, GAL.x1, GAL.z1, GAL.H, 'panelCream');
    B.wall(GAL.x0, GAL.z0, GAL.x1, GAL.z0, 0, GAL.H, 'panelCream', { openings: [{ c: 8, w: 13.2, h: 2.85, y: 0.85 }] });
    B.wall(GAL.x0, GAL.z1, GAL.x1, GAL.z1, 0, GAL.H, 'panelCream', { openings: [{ c: 14, w: 1.5, h: 2.5 }] });
    B.wall(GAL.x0, GAL.z0, GAL.x0, GAL.z1, 0, GAL.H, 'panelCream');
    B.wall(GAL.x1, GAL.z0, GAL.x1, GAL.z1, 0, GAL.H, 'panelCream');
    // wood wainscot + ceiling beams
    for (const [x0, z0, x1, z1] of [[-7.84, -2.84, -7.84, 2.84], [7.84, -2.84, 7.84, 2.84]]) B.mesh(boxGeo(0.04, 1.0, Math.abs(z1 - z0), 1), 'wood', x0, 0.5, 0, { cast: false });
    B.mesh(boxGeo(13.6, 1.0, 0.04, 1), 'wood', -1.2, 0.5, 2.84, { cast: false });
    for (const x of [-6, -2, 2, 6]) B.mesh(boxGeo(0.3, 0.25, 6, 1), 'darkmetal', x, GAL.H - 0.12, 0, { cast: false });
    // window: sill, mullions, glass, cracks, bay
    B.box(13.4, 0.06, 0.5, 'darkmetal', 0, 0.86, -2.66, { surface: 'metal' });
    for (let k = 0; k <= 6; k++) B.box(0.12, 2.85, 0.16, 'steel', -6.6 + k * 2.2, 2.275, -3.0, { cast: false });
    B.box(13.2, 0.1, 0.16, 'steel', 0, 2.95, -3.0, { cast: false });
    const glass = this.galGlass = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 2.85), glassMat()); glass.position.set(0, 2.275, -3.0); glass.castShadow = false; R.add(glass);
    B.collider(0, 2.3, -3.0, 6.6, 1.45, 0.04, { surface: 'glass' });
    const crackM = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(1.3, 1.4, 1.5) });
    const cracks = this.cracks = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 2.85), crackM); cracks.position.set(0, 2.275, -2.985); cracks.userData.ownMat = true; R.add(cracks);
    B.box(13.6, 0.12, 2.4, 'darkmetal', 0, 0.8, -4.3, { collide: false });
    B.box(13.6, 0.12, 2.4, 'darkmetal', 0, 3.78, -4.3, { collide: false });
    for (const x of [-6.75, 6.75]) B.box(0.12, 3.0, 2.4, 'darkmetal', x, 2.3, -4.3, { collide: false });
    this.vis(glass, 'Стекло галереи', 'толщина d = 12 мм = <b>0,012 м</b>', { offset: [-4.6, -0.4, 0], range: 9 });
    this.vis(this.core, 'Ядро «Константы»', 'R = 3,0 м · P = 4,8 ГВт = <b>4,8·10⁹ Вт</b>', { offset: [0, 3.6, 0], range: 70 });
    // benches
    for (const z of [0.2, 1.7]) for (const x of [-4.4, -1.5, 1.5, 4.4]) bench(B, x, z, 0, 2.4);
    // Lomov's console + memo
    this.galScreen = new Screen(512, 320, (x, w, h, t) => this.drawGalScreen(x, w, h, t)); this.screens.push(this.galScreen);
    const con = consoleDesk(B, -7.25, -1.0, PI / 2, { w: 1.5, screen: this.galScreen.mat });
    const memo = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshStandardMaterial({ map: textTexture((x, W, H) => { x.fillStyle = '#eee6cf'; x.fillRect(0, 0, W, H); x.fillStyle = '#9a1a10'; x.font = `${W * 0.09}px 'Russo One'`; x.fillText('СРОЧНО', W * 0.08, H * 0.12); x.fillStyle = '#333'; for (let i = 0; i < 14; i++) x.fillRect(W * 0.08, H * (0.2 + i * 0.05), W * (0.5 + Math.random() * 0.35), 3); }, 256, 352), roughness: 0.9 }));
    memo.userData.ownMat = true; memo.position.set(-0.38, 0.924, 0.085); memo.rotation.set(-PI / 2 + 0.32, 0, 0.22); con.group.add(memo);
    this.use(memo, 'Прочитать служебную записку', () => this.g.addNote('memo_lomov'), { range: 2.2 });
    this.use(con.group, 'Терминал галереи', () => this.g.hud.toast('Терминал', this.state === 'normal' ? 'Идёт трансляция запуска.' : 'ОШИБКА ПОЛЯ. Связь с пультом Ядра потеряна. Записи в журнале: расхождение расчётов ×1000.', '', 4), { range: 2.2 });
    // broadcast TV on the east wall
    this.tv = new Screen(640, 360, (x, w, h, t) => this.drawTV(x, w, h, t)); this.screens.push(this.tv);
    B.box(2.3, 1.36, 0.12, 'darkmetal', 7.78, 2.55, -0.6, { collide: false });
    const tvm = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.22), this.tv.mat); tvm.position.set(7.71, 2.55, -0.6); tvm.rotation.y = -PI / 2; R.add(tvm); this.tvMesh = tvm;
    // lamps & lights
    this.galTubes = [];
    for (const x of [-4.5, 0, 4.5]) { const l = B.lamp(x, GAL.H - 0.26, 1.0, { w: 2.4, emissive: 3.2 }); this.galTubes.push(l.tube); }
    this.tubeOn = this.galTubes[0].material; this.tubeOff = solid(0x2a2a28, 0.5, 0.2);
    this.galL = [this.light('point', 0xfff1dc, 40, -3.5, 3.5, 0.6, { distance: 16 }), this.light('point', 0xfff1dc, 40, 3.5, 3.5, 0.6, { distance: 16 })];
    this.emLamps = [];
    for (const [x, z, ry] of [[-7.78, 2.2, PI / 2], [7.78, -2.2, -PI / 2]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.14), glow(0xff2a1a, 0.6)); m.position.set(x, 3.45, z); m.rotation.y = ry; R.add(m); m.material = m.material.clone(); m.userData.ownMat = true; this.emLamps.push(m); B.box(0.34, 0.06, 0.2, 'darkmetal', x, 3.55, z, { collide: false }); }
    // signs & posters
    this.sign(['ОБЗОРНАЯ ГАЛЕРЕЯ'], 3.2, 0.45, -1.5, 3.55, 2.83, PI, { size: 120 });
    this.sign(['ВЫХОД · КОРИДОР А'], 1.6, 0.3, 6, 2.78, 2.83, PI, { size: 100, bg: '#0f3a22', fg: '#d9ffe6', border: '#3fbf73' });
    this.poster((x, W, H) => { x.fillStyle = '#b8342a'; x.fillRect(0, 0, W, H); x.fillStyle = '#f1e6c8'; x.font = `${W * 0.11}px 'Russo One'`; x.textAlign = 'center'; x.fillText('ТОЧНОСТЬ —', W / 2, H * 0.3); x.fillText('ВЕЖЛИВОСТЬ', W / 2, H * 0.45); x.fillText('УЧЁНОГО', W / 2, H * 0.6); x.beginPath(); x.strokeStyle = '#f1e6c8'; x.lineWidth = 8; x.arc(W / 2, H * 0.8, W * 0.1, 0, 7); x.stroke(); x.beginPath(); x.ellipse(W / 2, H * 0.8, W * 0.22, W * 0.07, 0.4, 0, 7); x.stroke(); }, 1.0, 1.4, -5.4, 2.1, 2.83, PI);
    this.poster((x, W, H) => { x.fillStyle = '#1f3c5a'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffb547'; x.font = `${W * 0.1}px 'Russo One'`; x.textAlign = 'center'; x.fillText('ПЕРЕД РАСЧЁТОМ —', W / 2, H * 0.32); x.fillStyle = '#e8f6ff'; x.font = `${W * 0.2}px 'Russo One'`; x.fillText('В СИ!', W / 2, H * 0.55); x.font = `${W * 0.07}px 'IBM Plex Sans'`; x.fillText('м · кг · с · А · К · моль · кд', W / 2, H * 0.75); }, 1.0, 1.4, 2.6, 2.1, 2.83, PI);
    // backpack (on the bench before the accident, thrown on the floor after)
    const bp = this.backpack = new THREE.Group();
    const bm = solid(0x3d4a32, 0.85);
    bp.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), bm), 0, 0.21, 0));
    bp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 16, 1, false, 0, PI).rotateZ(PI / 2), bm), 0, 0.42, 0));
    bp.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), solid(0x2f3a27, 0.9)), 0, 0.16, 0.12));
    for (const x of [-0.1, 0.1]) bp.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.03), solid(0x222, 0.9)), x, 0.24, -0.115));
    bp.traverse(o => { o.castShadow = true; }); R.add(bp);
    this.use(bp, 'Взять рюкзак', () => this.takeBackpack(), { enabled: () => this.state === 'accident' });
    // calculator on the window sill
    const calc = this.calcMesh = new THREE.Group();
    calc.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.16), solid(0x2b2d30, 0.6, 0.2)));
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), glow(0x9dff8a, 1.6)); cs.rotation.x = -PI / 2; cs.position.set(0, 0.009, -0.05); calc.add(cs);
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.012), solid(i % 4 === 3 ? 0xd86a2a : 0xd8d2c0, 0.5)); b.position.set(-0.024 + (i % 4) * 0.016, 0.01, -0.012 + Math.floor(i / 4) * 0.022); calc.add(b); }
    calc.position.set(3.4, 0.9, -2.6); calc.rotation.y = 0.5; R.add(calc);
    this.use(calc, 'Взять калькулятор', () => this.takeCalc(), { enabled: () => this.state === 'accident', range: 2.2 });
    // exit door leaf (blown open)
    B.box(0.12, 2.5, 0.2, 'steel', 5.2, 1.25, 3.0, { collide: false }); B.box(0.12, 2.5, 0.2, 'steel', 6.8, 1.25, 3.0, { collide: false });
    const hinge = this.galDoor = new THREE.Group(); hinge.position.set(5.3, 0, 3.12); R.add(hinge);
    const leaf = B.mesh(boxGeo(1.45, 2.42, 0.06, 1), 'panelGreen', 0.725, 1.21, 0, { parent: hinge });
    B.mesh(boxGeo(0.3, 0.45, 0.07, 1), glassMat(), 0.95, 1.65, 0, { parent: hinge, cast: false });
    B.mesh(boxGeo(0.05, 0.16, 0.1, 1), 'steel', 1.3, 1.05, 0, { parent: hinge });
    this.galDoorCol = B.collider(5.24, 1.21, 3.47, 0.05, 1.21, 0.36, { surface: 'metal' });
    // debris (visible after the accident)
    const D = this.debris = new THREE.Group(); D.visible = false; R.add(D);
    for (const [x, z, rx, rz] of [[-0.8, -0.6, 0.12, 0.5], [5.2, 0.9, -0.3, 0.2], [-5.6, 2.3, 0.05, -0.15]]) { const p = new THREE.Mesh(boxGeo(1.2, 0.04, 1.2, 1), mat('panelCream')); p.position.set(x, 0.1, z); p.rotation.set(rx, Math.random() * 3, rz); p.castShadow = true; D.add(p); }
    const fl = new THREE.Group(); fl.position.set(0, GAL.H - 0.05, 1.0); D.add(fl);
    const fall = new THREE.Mesh(boxGeo(2.4, 0.1, 0.34, 1), mat('darkmetal')); fall.position.set(0.95, -1.2, 0); fall.rotation.z = -1.1; fl.add(fall);
    B.cable([0, GAL.H - 0.05, 1.0], [0.45, 2.3, 1.0], 0.15, 0.012, 0x111111, { parent: D });
    this.sparkPos = V(1.45, 1.35, 1.0);
    for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06 + Math.random() * 0.12, 0.05 + Math.random() * 0.1), glassMat()); s.rotation.set(-PI / 2, 0, Math.random() * 6); s.position.set(-6 + Math.random() * 12, 0.012, -2.6 + Math.random() * 1.6); D.add(s); }
    for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), solid(0xe8e0c8, 0.95)); s.rotation.set(-PI / 2, 0, Math.random() * 6); s.position.set(-7 + Math.random() * 13, 0.01 + i * 0.0005, -2 + Math.random() * 4.5); D.add(s); }
    // particles: sparks + dust
    const q = this.g.engine.q.particles || 1;
    this.sparks = new Particles(Math.round(220 * q), { size: 0.03, gravity: 9.8, drag: 0.4, color: 0xffc070 }); R.add(this.sparks.points);
    this.dust = new Particles(Math.round(260 * q), { size: 0.035, color: 0xffe0c0, fadeIn: 0.4, opacity: 0.55 }); R.add(this.dust.points);
    this.trigger([-8, -1, -3, 8, 4, -1.2], () => { if (this.state === 'accident' && this.save.items.includes('backpack')) this.say('window'); }, { once: false });
  },
  drawGalScreen(x, w, h, t) {
    if (this.state === 'normal') drawTerminal(x, w, h, t, { title: 'ЗАПУСК ЯДРА · СВОДКА', lines: ['РЕЖИМ: ПОДГОТОВКА', 'ОТЧЁТ ДИРЕКЦИИ:', '  поле стабилиз. E = 4,8 кВ/м', '!ЛАБ. ЯДРА: E = 4,8 МВ/м', '!расхождение ×1000 — не проверено', `ДО ЗАПУСКА: ${this.countText || '02:00'}`] });
    else drawTerminal(x, w, h, t, { title: 'ОШИБКА ПОЛЯ', warn: true, glitch: 0.06, lines: ['СВЯЗЬ С ПУЛЬТОМ: НЕТ', 'ПРОТОКОЛ «КОНСТАНТА»: АКТИВЕН', 'механизмы: физ. протокол', '!ЖУРНАЛ: расхождение ×1000', '!(см. записку № 47)', 'ИСААК: память 7%'] });
  },
  drawTV(x, w, h, t) {
    x.fillStyle = '#05080a'; x.fillRect(0, 0, w, h);
    if (this.state !== 'normal') {
      const img = x.createImageData(160, 90); for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      const c2 = this._noiseC ||= document.createElement('canvas'); c2.width = 160; c2.height = 90; c2.getContext('2d').putImageData(img, 0, 0); x.imageSmoothingEnabled = false; x.drawImage(c2, 0, 0, w, h);
      x.fillStyle = '#ff6a5a'; x.font = `${h * 0.1}px 'Russo One'`; x.textAlign = 'center'; x.fillText('НЕТ СИГНАЛА', w / 2, h / 2); return;
    }
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b3c48'); gr.addColorStop(1, '#0d151b'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    // stylised director portrait
    x.fillStyle = '#c9a27e'; x.beginPath(); x.ellipse(w * 0.3, h * 0.42, w * 0.07, h * 0.17, 0, 0, 7); x.fill();
    x.fillStyle = '#2a2a2a'; x.beginPath(); x.ellipse(w * 0.3, h * 0.3, w * 0.075, h * 0.07, 0, PI, 0); x.fill();
    x.fillStyle = '#1b2430'; x.beginPath(); x.moveTo(w * 0.14, h); x.lineTo(w * 0.2, h * 0.64); x.lineTo(w * 0.4, h * 0.64); x.lineTo(w * 0.46, h); x.fill();
    x.fillStyle = '#e9e1c8'; x.beginPath(); x.moveTo(w * 0.27, h * 0.64); x.lineTo(w * 0.3, h * 0.8); x.lineTo(w * 0.33, h * 0.64); x.fill();
    x.fillStyle = '#9a1a10'; x.fillRect(w * 0.295, h * 0.66, w * 0.01, h * 0.2);
    x.fillStyle = '#e9e1c8'; x.textAlign = 'left'; x.font = `${h * 0.075}px 'Russo One'`; x.fillText('В. П. КОРНЕЕВ', w * 0.52, h * 0.38);
    x.font = `${h * 0.05}px 'IBM Plex Sans'`; x.fillStyle = '#b9c6cf'; x.fillText('директор комплекса «Константа»', w * 0.52, h * 0.47);
    x.fillStyle = '#ffb547'; x.font = `${h * 0.12}px 'JetBrains Mono'`; x.fillText(this.countText || '02:00', w * 0.52, h * 0.68);
    x.fillStyle = Math.floor(t * 2) % 2 ? '#ff4030' : '#601010'; x.beginPath(); x.arc(w * 0.06, h * 0.08, h * 0.025, 0, 7); x.fill(); x.fillStyle = '#e9e1c8'; x.font = `${h * 0.045}px 'IBM Plex Sans'`; x.fillText('ПРЯМОЙ ЭФИР', w * 0.09, h * 0.095);
    for (let y = 0; y < h; y += 3) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, w, 1); }
  },
  // ------------------------------------------------------------------ corridor A (dark), locker, steam + valve, archive door
  buildCorridor() {
    const B = this.B, R = this.root, C = COR;
    B.floor(C.x0, C.z0, C.x1, C.z1, 0, 'floor', { tile: 1.5 });
    B.ceil(C.x0, C.z0, C.x1, C.z1, C.H, 'concreteDk');
    B.wall(C.x0, C.z0, C.x0, C.z1, 0, C.H, 'panelGreen');
    B.wall(C.x1, C.z0, C.x1, C.z1, 0, C.H, 'panelGreen', { openings: [{ c: 16 - C.z0, w: 1.3, h: 2.25 }] });
    for (const x of [4.97, 7.03]) B.mesh(boxGeo(0.02, 0.08, C.z1 - C.z0, 1), 'pipeYellow', x, 1.0, (C.z0 + C.z1) / 2, { cast: false });
    B.pipe([[6.95, 2.92, 3.3], [6.95, 2.92, 20.2]], 0.09, 'pipeRed');
    B.pipe([[6.62, 3.04, 3.3], [6.62, 3.04, 20.2]], 0.06, 'pipeGrey');
    B.pipe([[5.08, 2.95, 3.3], [5.08, 2.95, 20.2]], 0.05, 'pipeBlue');
    // dead ceiling lamps, one flickering
    this.corTubes = [];
    for (const z of [5, 8.5, 12, 15.5, 19]) { const l = B.lamp(6, C.H - 0.12, z, { w: 1.3, emissive: 3 }); l.tube.material = this.tubeOff; this.corTubes.push(l.tube); }
    this.flickTube = this.corTubes[3]; this.flickOn = glow(0xfff1dc, 2.6);
    // emergency lights
    this.corL = [this.light('point', 0xff2a1a, 7, 6.0, 2.85, 8.5, { distance: 9 }), this.light('point', 0xff7a2a, 5, 6.0, 2.85, 17.2, { distance: 8 })];
    for (const z of [8.5, 17.2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.14), glow(z < 10 ? 0xff2a1a : 0xff7a2a, 3)); m.position.set(6, C.H - 0.08, z); R.add(m); }
    // locker with the flashlight
    const lk = this.locker = locker(B, 5.17, 0.5, 5.2, PI / 2, { label: 'АВАРИЙНЫЙ ЗАПАС', color: 'pipeRed' });
    const fl = this.flashMesh = new THREE.Group();
    fl.add(new THREE.Mesh(cylGeo(0.03, 0.03, 0.2, 14, 0.2), mat('blackmetal')));
    const hd = new THREE.Mesh(cylGeo(0.048, 0.034, 0.07, 16, 0.2), mat('steel')); hd.position.y = 0.13; fl.add(hd);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16), glow(0xfff6d0, 1.2)); lens.rotation.x = -PI / 2; lens.position.y = 0.166; fl.add(lens);
    fl.rotation.z = PI / 2; fl.rotation.y = PI / 2; fl.position.set(5.12, 1.22, 5.2); R.add(fl);
    this.use(lk.group, () => this.F.lockerOpen ? 'Аварийный шкаф (открыт)' : 'Открыть аварийный шкаф', () => this.openLocker(), { enabled: () => !this.F.lockerOpen });
    this.use(fl, 'Взять фонарь', () => this.takeFlashlight(), { enabled: () => !!this.F.lockerOpen, range: 2.2 });
    // steam leak + valve
    B.pipe([[6.95, 2.92, 12.0], [6.95, 1.5, 12.0]], 0.09, 'pipeRed', { flanges: false });
    B.mesh(cylGeo(0.14, 0.12, 0.08, 14, 0.3), 'steel', 6.95, 1.48, 12.0);
    this.steamPos = V(6.92, 1.42, 12.0);
    this.steam = new Particles(Math.round(420 * (this.g.engine.q.particles || 1)), { size: 0.35, additive: false, color: 0xdde4e8, opacity: 0.32, sizeGrow: 3.5, drag: 1.4, fadeIn: 0.15, gravity: -0.4 });
    R.add(this.steam.points);
    this.steamCol = B.collider(6.0, 1.6, 12.0, 1.2, 1.6, 0.45, { surface: 'concrete' });
    const vv = this.valve = valveWheel(B, 4.97, 1.3, 10.3, PI / 2);
    B.pipe([[4.97, 1.3, 10.3], [4.97, 3.0, 10.3], [6.9, 3.0, 10.3], [6.9, 3.0, 11.6]], 0.055, 'pipeRed', { flanges: false });
    this.sign(['ВЕНТИЛЬ В-3', 'ПАРОПРОВОД'], 0.5, 0.22, 4.97, 1.85, 10.3, PI / 2, { size: 80, bg: '#d8cfb6', fg: '#9a1a10', border: '#9a1a10' });
    this.sign(['ОСТОРОЖНО! ПАР'], 0.9, 0.24, 7.04, 2.2, 11.0, -PI / 2, { size: 100, bg: '#e0a91c', fg: '#121212', border: '#121212' });
    this.use(vv.group, 'Перекрыть вентиль', () => this.closeValve(), { enabled: () => !this.F.valve, range: 2.2 });
    this.vis(vv.group, 'Пар в магистрали', 't = 120 °C → T = t + 273 = <b>393 K</b> · p = 0,2 МПа = <b>2·10⁵ Па</b>', { offset: [0.6, 0.5, 1.6], range: 10 });
    this.trigger([4.8, -1, 10.4, 7.2, 4, 11.7], () => { if (!this.F.valve) { this.g.hud.toast('Горячий пар', 'Температура около 120 °C. Пройти нельзя — перекройте вентиль.', 'red', 3.5); this.say('steamWarn', [{ who: 'isaac', text: 'Стой! Это пар под давлением — больше ста градусов Цельсия. Рядом на стене должен быть вентиль.' }]); } }, { once: false });
    this.trigger([4.8, -1, 3.2, 7.2, 4, 6.5], () => { this.F.corridor = true; this.zoneName = 'Сектор 0 · Коридор А'; this.say('dark'); this.updateObjective(); });
    this.vis(this.flickTube, 'Коридор А', 'длина l = 17 м · высота h = 320 см = <b>3,2 м</b>', { offset: [0, -0.4, 0], range: 8 });
    // archive door (east wall, z = 16) + keypad
    const ad = this.archDoor = B.box(0.14, 2.25, 1.3, 'darkmetal', 7.2, 1.125, 16, { surface: 'metal' });
    B.box(0.2, 0.12, 1.5, 'hazard', 7.2, 2.31, 16, { collide: false });
    this.sign(['АРХИВ ЛАБОРАТОРИИ ЯДРА'], 1.4, 0.2, 7.03, 2.55, 16, -PI / 2, { size: 80 });
    const kp = new THREE.Group(); kp.position.set(7.03, 1.35, 14.95); kp.rotation.y = -PI / 2; R.add(kp);
    kp.add(new THREE.Mesh(boxGeo(0.22, 0.3, 0.05, 1), mat('steel')));
    const kscr = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), glow(0x9dff8a, 1.4)); kscr.position.set(0, 0.09, 0.027); kp.add(kscr); this.kpScreen = kscr;
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.01), solid(0xcfc8b4, 0.5)); b.position.set(-0.05 + (i % 3) * 0.05, 0.02 - Math.floor(i / 3) * 0.042, 0.03); kp.add(b); }
    this.use(kp, () => this.F.archive ? 'Архив открыт' : 'Кодовый замок архива', () => this.keypad(), { enabled: () => !this.F.archive, range: 2.2 });
  },
  // ------------------------------------------------------------------ secret archive
  buildArchive() {
    const B = this.B, R = this.root, A = ARC_;
    B.floor(A.x0, A.z0, A.x1, A.z1, 0, 'wood', { tile: 1, surface: 'wood' });
    B.ceil(A.x0, A.z0, A.x1, A.z1, A.H, 'concrete');
    B.wall(A.x0, A.z0, A.x1, A.z0, 0, A.H, 'panelCream');
    B.wall(A.x0, A.z1, A.x1, A.z1, 0, A.H, 'panelCream');
    B.wall(A.x1, A.z0, A.x1, A.z1, 0, A.H, 'panelCream');
    shelf(B, 11.6, 15.6, PI / 2, { w: 2.6, seed: 3 });
    shelf(B, 10.7, 13.88, 0, { w: 1.6, seed: 7 });
    // desk with the tape recorder (audio log)
    B.box(1.4, 0.06, 0.7, 'wood', 9.4, 0.75, 17.95, { surface: 'wood' });
    for (const [x, z] of [[8.75, 17.65], [10.05, 17.65], [8.75, 18.25], [10.05, 18.25]]) B.box(0.05, 0.72, 0.05, 'darkmetal', x, 0.36, z, { collide: false });
    const rec = new THREE.Group(); rec.position.set(9.3, 0.78, 17.9); R.add(rec);
    rec.add(at(new THREE.Mesh(boxGeo(0.46, 0.12, 0.3, 1), solid(0x6b5a44, 0.6)), 0, 0.06, 0));
    this.reels = [];
    for (const x of [-0.11, 0.11]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 24), solid(0x222222, 0.4, 0.3)); r.position.set(x, 0.13, -0.02); rec.add(r); this.reels.push(r); }
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.02), glow(0xff3a2a, 4)); rl.position.set(0.17, 0.125, 0.1); rec.add(rl);
    this.use(rec, 'Прослушать аудиожурнал Ломова', () => { this.g.addNote('log_lomov1'); this.reelSpin = 14; }, { range: 2.2 });
    const lampM = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 20, 1, true), mat('pipeGreen' in {} ? 'pipeGrey' : 'pipeGrey')); lampM.position.set(9.9, 1.2, 18.1); R.add(lampM);
    B.mesh(cylGeo(0.012, 0.012, 0.42, 6, 0.2), 'steel', 9.9, 0.99, 18.1);
    this.archL = this.light('point', 0xffc890, 12, 9.9, 1.15, 18.0, { distance: 9 });
    // display case with the Galileo card
    B.box(0.6, 0.9, 0.6, 'darkmetal', 11.4, 0.45, 17.7, { surface: 'metal' });
    const caseG = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.56), glassMat()); caseG.position.set(11.4, 1.15, 17.7); R.add(caseG);
    const ct = textTexture((x, W, H) => { x.fillStyle = '#132029'; x.fillRect(0, 0, W, H); x.strokeStyle = '#ffb547'; x.lineWidth = 8; x.strokeRect(10, 10, W - 20, H - 20); x.fillStyle = '#ffb547'; x.font = `${W * 0.09}px 'Russo One'`; x.textAlign = 'center'; x.fillText('ГАЛИЛЕЙ', W / 2, H * 0.88); x.strokeStyle = '#62e6ff'; x.lineWidth = 5; x.beginPath(); x.moveTo(W * 0.25, H * 0.7); x.lineTo(W * 0.72, H * 0.25); x.stroke(); x.beginPath(); x.arc(W * 0.74, H * 0.23, W * 0.06, 0, 7); x.stroke(); }, 256, 352);
    const card = this.cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.275), new THREE.MeshBasicMaterial({ map: ct, color: new THREE.Color(1.3, 1.3, 1.3) })); card.userData.ownMat = true;
    card.position.set(11.4, 1.12, 17.7); card.rotation.set(-0.5, -PI / 2, 0, 'YXZ'); R.add(card);
    this.use(card, 'Взять карточку учёного', () => { this.g.addCard('galileo'); card.visible = false; this.F.card = true; this.say('card'); }, { enabled: () => !this.F.card, range: 2.4 });
    // lunar radio-rangefinder (bonus problem)
    this.radarScr = new Screen(512, 320, (x, w, h, t) => drawTerminal(x, w, h, t, { title: 'РАДИОДАЛЬНОМЕР «ЛУНА»', lines: this.radarLines || ['импульс: готов', `эхо: Δt = ${fmtFixed(this.vRadar.t, 2)} с`, 'расстояние: ???', '!ввод — через тетрадь задач'] })); this.screens.push(this.radarScr);
    const rc = consoleDesk(B, 8.35, 14.15, 0, { w: 1.3, screen: this.radarScr.mat, color: 'panelBlue' });
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 10, 0, PI * 2, 0, PI / 3.2), mat('steel')); dish.material = dish.material; dish.position.set(7.85, 1.12, 14.05); dish.rotation.x = -0.9; R.add(dish);
    const moon = this.moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), holoMaterial(0xdfe8ff, { opacity: 0.7, rim: 1.2, intensity: 1.4 })); moon.position.set(8.9, 2.25, 14.25); moon.userData.ownMat = true; R.add(moon);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), holoMaterial(0x62e6ff, { opacity: 0.8 })); earth.position.set(7.75, 1.55, 14.25); earth.userData.ownMat = true; R.add(earth);
    this.pulse = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glow(0xff5a4f, 8)); this.pulse.visible = false; R.add(this.pulse);
    this.radarPath = [earth.position.clone(), moon.position.clone()];
    this.vis(moon, 'Луна (модель)', 'R = 1737 км = <b>1,737·10⁶ м</b>', { offset: [0, 0.35, 0], range: 7 });
    this.use(rc.group, 'Радиодальномер: найти расстояние до Луны', () => { this.g.discoverProblem('p3_radar', true); this.g.openProblem('p3_radar', true); }, { range: 2.4, enabled: () => !this.g.isSolved('p3_radar') });
    this.trigger([7.3, -1, 13.5, 12, 4, 18.5], () => { this.F.archiveVisited = true; this.say('archive'); });
  },
};
