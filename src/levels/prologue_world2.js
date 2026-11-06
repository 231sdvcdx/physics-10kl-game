// Пролог «Сбой» — часть уровня (PrologueWorldB); методы подмешиваются в PrologueLevel
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

export const PrologueWorldB = {
  // ------------------------------------------------------------------ holographic classroom
  buildClassroom() {
    const B = this.B, R = this.root, C = CLS;
    const fm = B.cyl(C.r + 0.25, C.r + 0.25, 0.3, 'floorLt', C.cx, -0.15, C.cz, { seg: 48, tile: 1.4, cast: false });
    B.collider(C.cx, -0.15, C.cz, C.r + 0.25, 0.15, C.r + 0.25, { surface: 'tile' });
    B.cyl(C.r + 0.25, C.r + 0.25, 0.3, 'panelBlue', C.cx, C.H + 0.15, C.cz, { seg: 48, tile: 2, cast: false });
    const N = 40, ops = [-PI / 2, 0];
    for (let i = 0; i < N; i++) {
      const am = (i + 0.5) / N * PI * 2 - PI;
      const near = ops.some(o => Math.abs(Math.atan2(Math.sin(am - o), Math.cos(am - o))) < 0.2);
      const chord = 2 * C.r * Math.sin(PI / N) + 0.03, ry = Math.atan2(-Math.cos(am), -Math.sin(am));
      const x = C.cx + Math.cos(am) * (C.r + 0.15), z = C.cz + Math.sin(am) * (C.r + 0.15);
      if (near) { B.box(chord, C.H - 2.8, 0.3, 'panelBlue', x, 2.8 + (C.H - 2.8) / 2, z, { ry, cast: false }); continue; }
      B.box(chord, C.H, 0.3, 'panelBlue', x, C.H / 2, z, { ry, cast: false });
      B.mesh(boxGeo(chord, 1.0, 0.04, 1), 'wood', C.cx + Math.cos(am) * (C.r - 0.02), 0.5, C.cz + Math.sin(am) * (C.r - 0.02), { ry, cast: false });
    }
    // ceiling light ring + ribs
    const ringL = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.05, 8, 80), glow(0xbfefff, 2.2)); ringL.rotation.x = PI / 2; ringL.position.set(C.cx, C.H - 0.05, C.cz); R.add(ringL);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const rib = new THREE.Mesh(boxGeo(0.2, 0.18, C.r - 2.3, 1), mat('darkmetal')); rib.position.set(C.cx + Math.cos(a) * (2.2 + (C.r - 2.3) / 2), C.H - 0.1, C.cz + Math.sin(a) * (2.2 + (C.r - 2.3) / 2)); rib.rotation.y = -a + PI / 2; R.add(rib); }
    // projector pedestal
    B.cyl(0.72, 0.85, 0.9, 'darkmetal', C.cx, 0.45, C.cz, { collide: true, seg: 36 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.02, 36), glow(0x62e6ff, 2.4)); top.position.set(C.cx, 0.91, C.cz); R.add(top); this.projTop = top;
    const lensR = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 8, 60), glow(0x62e6ff, 4)); lensR.rotation.x = PI / 2; lensR.position.set(C.cx, 0.9, C.cz); R.add(lensR);
    const fr = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.56, 64), glow(0x62e6ff, 2)); fr.rotation.x = -PI / 2; fr.position.set(C.cx, 0.006, C.cz); R.add(fr);
    this.lessonAnchor = new THREE.Group(); this.lessonAnchor.position.set(C.cx, 0.93, C.cz); R.add(this.lessonAnchor);
    this.vis(top, 'Голопроектор', 'λ = 532 нм = <b>5,32·10⁻⁷ м</b>', { offset: [0, 0.3, 0], range: 8 });
    // ISAAC hologram
    this.isaac = new IsaacHolo(); this.isaac.group.position.set(C.cx, 2.05, C.cz); this.isaac.group.visible = false; R.add(this.isaac.group);
    this.isaacHome = V(C.cx, 2.05, C.cz); this.isaacAside = V(C.cx + 1.5, 2.1, C.cz - 1.6);
    // desks facing the projector
    const ring = (r, angs) => angs.forEach(d => { const a = d * PI / 180; studentDesk(B, C.cx + Math.cos(a) * r, C.cz + Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a))); });
    ring(2.9, [62, 90, 118, 146]); ring(4.25, [52, 74, 96, 118, 140, 162]);
    // chalkboard + lectern with notes
    const ab = -40 * PI / 180, bry = Math.atan2(-Math.cos(ab), -Math.sin(ab));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.25), new THREE.MeshStandardMaterial({ map: textTexture((x, W, H) => {
      x.fillStyle = '#1f3a2c'; x.fillRect(0, 0, W, H); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; x.fillRect(Math.random() * W, Math.random() * H, 30, 2); }
      x.fillStyle = '#e8efe6'; x.font = `${H * 0.085}px 'Exo 2'`; x.fillText('A = {A} · [A]   (число × единица)', W * 0.05, H * 0.17);
      x.fillText('СИ: м · кг · с · А · К · моль · кд', W * 0.05, H * 0.34); x.fillText('к = 10³   М = 10⁶   м = 10⁻³   мк = 10⁻⁶', W * 0.05, H * 0.51);
      x.fillText('1 км/ч = 1000 м / 3600 с = 1/3,6 м/с', W * 0.05, H * 0.68); x.fillStyle = '#ffd28a'; x.fillText('v = s / Δt   — перед расчётом всё в СИ!', W * 0.05, H * 0.86);
    }, 1024, 492), roughness: 0.95 }));
    board.userData.ownMat = true; board.position.set(C.cx + Math.cos(ab) * (C.r - 0.06), 1.75, C.cz + Math.sin(ab) * (C.r - 0.06)); board.rotation.y = bry; R.add(board);
    B.box(2.75, 1.4, 0.05, 'wood', C.cx + Math.cos(ab) * (C.r - 0.03), 1.75, C.cz + Math.sin(ab) * (C.r - 0.03), { ry: bry, collide: false });
    const al = -22 * PI / 180, lx = C.cx + Math.cos(al) * 3.9, lz = C.cz + Math.sin(al) * 3.9, lry = Math.atan2(-Math.cos(al), -Math.sin(al)) + PI;
    const lect = B.box(0.7, 1.05, 0.5, 'wood', lx, 0.525, lz, { ry: lry, surface: 'wood' });
    const lt = B.box(0.8, 0.05, 0.6, 'wood', lx, 1.08, lz, { ry: lry, collide: false });
    const paperM = (title) => new THREE.MeshStandardMaterial({ map: textTexture((x, W, H) => { x.fillStyle = '#eee6cf'; x.fillRect(0, 0, W, H); x.fillStyle = '#2a2a2a'; x.font = `${W * 0.08}px 'Russo One'`; x.fillText(title, W * 0.08, H * 0.12); for (let i = 0; i < 12; i++) x.fillRect(W * 0.08, H * (0.22 + i * 0.055), W * (0.45 + Math.random() * 0.4), 3); }, 256, 352), roughness: 0.9 });
    const n1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.27), paperM('Вере')); n1.rotation.set(-PI / 2, 0, lry + 0.2, 'XYZ'); n1.position.set(lx + 0.12, 1.11, lz); n1.userData.ownMat = true; R.add(n1);
    const n2 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.27), paperM('ПАМЯТКА')); n2.rotation.set(-PI / 2, 0, lry - 0.15, 'XYZ'); n2.position.set(lx - 0.16, 1.112, lz + 0.05); n2.userData.ownMat = true; R.add(n2);
    this.use(n1, 'Прочитать записку на кафедре', () => { this.g.addNote('code_hint'); this.updateObjective(); }, { range: 2.2 });
    this.use(n2, 'Прочитать памятку «Физический протокол»', () => this.g.addNote('protocol'), { range: 2.2 });
    // instrument cabinet with the laser tape measure
    const ac = -140 * PI / 180, cry = Math.atan2(-Math.cos(ac), -Math.sin(ac));
    const cab = this.cabinet = locker(B, C.cx + Math.cos(ac) * (C.r - 0.32), 0, C.cz + Math.sin(ac) * (C.r - 0.32), cry, { w: 0.9, h: 1.9, d: 0.45, color: 'panelCream', label: 'ПРИБОРЫ' });
    const lz2 = new THREE.Group(); lz2.add(new THREE.Mesh(boxGeo(0.13, 0.07, 0.05, 1), solid(0xe0b020, 0.5, 0.1)));
    const lw = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), glow(0x9dff8a, 1.4)); lw.position.set(0.01, 0.01, 0.026); lz2.add(lw);
    const lred = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), glow(0xff3a2a, 5)); lred.position.set(0.066, 0, 0); lred.rotation.y = PI / 2; lz2.add(lred);
    cab.group.add(lz2); lz2.position.set(0, 0.9, 0.02); this.laserMesh = lz2;
    this.use(cab.group, () => this.save.lessons.L0 ? 'Открыть шкаф с приборами' : 'Шкаф с приборами (заблокирован)', () => this.openCabinet(), { enabled: () => !this.F.cabinetOpen });
    this.use(lz2, 'Взять лазерную рулетку', () => this.takeLaser(), { enabled: () => !!this.F.cabinetOpen, range: 2.2 });
    // scientist portraits
    const names = [['Г. ГАЛИЛЕЙ', '1564–1642'], ['И. НЬЮТОН', '1643–1727'], ['М. В. ЛОМОНОСОВ', '1711–1765'], ['Д. И. МЕНДЕЛЕЕВ', '1834–1907']];
    names.forEach(([n, y], i) => {
      const a = (102 + i * 22) * PI / 180, ry = Math.atan2(-Math.cos(a), -Math.sin(a));
      this.poster((x, W, H) => { x.fillStyle = '#d8cfb6'; x.fillRect(0, 0, W, H); x.fillStyle = '#5a4a36'; x.fillRect(W * 0.08, H * 0.06, W * 0.84, H * 0.66); x.fillStyle = '#2b241b'; x.beginPath(); x.ellipse(W / 2, H * 0.32, W * 0.16, H * 0.14, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(W * 0.2, H * 0.72); x.quadraticCurveTo(W / 2, H * 0.38, W * 0.8, H * 0.72); x.fill(); x.fillStyle = '#1d1d1b'; x.font = `${W * 0.085}px 'Russo One'`; x.textAlign = 'center'; x.fillText(n, W / 2, H * 0.84); x.font = `${W * 0.06}px 'IBM Plex Sans'`; x.fillText(y, W / 2, H * 0.93); }, 0.62, 0.84, C.cx + Math.cos(a) * (C.r - 0.03), 2.55, C.cz + Math.sin(a) * (C.r - 0.03), ry);
    });
    this.sign(['ГОЛОГРАФИЧЕСКИЙ КЛАСС'], 2.4, 0.32, C.cx, 3.25, C.cz - C.r + 0.02, 0, { size: 100, bg: '#10232c', fg: '#bff3ff', border: '#62e6ff' });
    // holo barrier on the east exit
    const bm = holoMaterial(0xff6a3a, { opacity: 0.8, rim: 0.6, intensity: 1.8, side: THREE.DoubleSide }); 
    const bar = this.barrier = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.8), bm); bar.position.set(C.cx + C.r - 0.05, 1.4, C.cz); bar.rotation.y = -PI / 2; bar.userData.ownMat = true; R.add(bar);
    this.barrierCol = B.collider(C.cx + C.r - 0.05, 1.4, C.cz, 0.12, 1.4, 1.3, { surface: 'metal' });
    this.use(bar, 'Голобарьер', () => this.g.hud.toast('Голобарьер', 'Проход откроется после урока у проектора.', '', 2.5), { range: 3 });
    // lights
    this.clsSpot = this.light('spot', 0xbfefff, 70, C.cx, C.H - 0.2, C.cz, { target: [C.cx, 0, C.cz], angle: 0.8, penumbra: 0.7, distance: 9, shadow: 'high' });
    this.clsL = this.light('point', 0xffd2a0, 14, C.cx - 2.4, 3.6, C.cz + 2.4, { distance: 12 });
    // projector interaction
    this.use(top, () => this.save.lessons.L0 ? 'Голопроектор (урок пройден — повтор в меню паузы)' : 'Начать урок «Величины и единицы СИ»', () => this.startLesson(), { range: 2.6, enabled: () => !this.lessonRunning && !this.save.lessons.L0 && !!this.F.classroom, outline: lensR });
    this.trigger([4.8, -1, 20.7, 7.2, 5, 23], () => this.enterClassroom());
  },
  // ------------------------------------------------------------------ kinematic movers (doors, gates, platform)
  mover(x, y, z, hx, hy, hz, mesh, data) {
    const k = this.g.physics.kinematicBox(x, y, z, hx, hy, hz, { data: data || { surface: 'metal' } });
    const m = { k, mesh, base: V(x, y, z), off: V(0, 0, 0), last: V(x, y, z), delta: k.delta };
    if (mesh) mesh.position.copy(m.base);
    this.movers.push(m); return m;
  },
  // ------------------------------------------------------------------ airlock П-1 (problem 1: v = s/Δt)
  buildAirlock() {
    const B = this.B, R = this.root, A = AIR, v = this.vDoor, s = v.s_cm / 100;
    this.doorS = s;
    // link corridor from the classroom
    B.floor(12.2, 24.8, 13, 27.2, 0, 'floor', { tile: 1.5 });
    B.box(0.34, 0.016, 1.9, 'hazard', 12.32, 0.008, 26, { collide: false, cast: false });
    B.ceil(11.9, 24.8, 13, 27.2, 3.0, 'concreteDk');
    B.wall(11.95, 24.8, 13, 24.8, 0, 3.0, 'panelGreen');
    B.wall(11.95, 27.2, 13, 27.2, 0, 3.0, 'panelGreen');
    B.lamp(12.55, 2.88, 26, { w: 0.6, emissive: 2.6 });
    // hall
    B.floor(A.x0, A.z0, A.x1, A.z1, 0, 'floor', { tile: 1.5 });
    B.ceil(A.x0, A.z0, A.x1, A.z1, A.H, 'concreteDk');
    B.wall(A.x0, A.z0, A.x0, A.z1, 0, A.H, 'panelCream', { openings: [{ c: 5, w: 2.1, h: 2.8 }] });
    B.wall(A.x0, A.z0, A.x1, A.z0, 0, A.H, 'panelCream');
    B.wall(A.x0, A.z1, A.x1, A.z1, 0, A.H, 'panelCream');
    B.wall(A.x1, A.z0, A.x1, A.z1, 0, A.H, 'panelCream', { openings: [{ c: 5, w: 2.0, h: 2.6 }] });
    for (const z of [A.z0 + 0.17, A.z1 - 0.17]) B.mesh(boxGeo(A.x1 - A.x0 - 0.3, 1.0, 0.04, 1), 'panelGreen', (A.x0 + A.x1) / 2, 0.5, z, { cast: false });
    for (const x of [15.6, 22]) B.lamp(x, A.H - 0.12, 26, { w: 2.2, emissive: 3 });
    B.pipe([[13.3, 3.95, 21.42], [24.7, 3.95, 21.42]], 0.12, 'pipeYellow');
    B.pipe([[13.3, 3.62, 21.36], [24.7, 3.62, 21.36]], 0.07, 'pipeBlue');
    B.pipe([[13.3, 3.95, 30.6], [24.7, 3.95, 30.6]], 0.09, 'pipeRed');
    // the blast-door wall with a pocket for the sliding leaf
    const dz0 = 26 - s / 2, dz1 = 26 + s / 2;
    B.wall(A.dx, A.z0, A.dx, A.z1, 0, A.H, 'concrete', { thick: 0.8, openings: [{ c: 26 - A.z0, w: s, h: 2.8 }] });
    for (const z of [dz0 - 0.09, dz1 + 0.09]) B.box(0.86, 2.8, 0.18, 'hazard', A.dx, 1.4, z, { collide: false });
    B.box(0.86, 0.2, s + 0.36, 'hazard', A.dx, 2.9, 26, { collide: false });
    B.box(0.5, 0.012, s + 0.4, 'hazard', A.dx - 0.75, 0.006, 26, { collide: false, cast: false });
    // leaf
    const lw = s + 0.24;
    const lg = this.leafG = new THREE.Group(); R.add(lg);
    B.mesh(boxGeo(0.26, 2.86, lw, 1), 'steel', 0, 0, 0, { parent: lg });
    for (const sx of [-1, 1]) {
      B.mesh(boxGeo(0.012, 2.6, 0.24, 1), 'hazard', sx * 0.134, 0, -lw / 2 + 0.22, { parent: lg, cast: false });
      for (const y of [-0.95, 0.95]) B.mesh(boxGeo(0.03, 0.12, lw - 0.6, 1), 'darkmetal', sx * 0.14, y, 0.12, { parent: lg, cast: false });
      const sg = signMesh(['П-1'], 0.7, 0.36, { bg: '#2a2f33', fg: '#ffb547', size: 150, border: '#ffb547' });
      sg.position.set(sx * 0.137, 0.25, 0.25); sg.rotation.y = sx * PI / 2; sg.userData.ownMat = true; lg.add(sg);
    }
    this.leaf = this.mover(A.dx, 1.43, 26, 0.13, 1.43, lw / 2, lg);
    this.leafX = 0;
    // drive unit + data plates
    const dvz = dz1 + 0.9;
    const drive = this.driveG = new THREE.Group(); drive.position.set(A.dx - 0.56, 1.5, dvz); R.add(drive);
    B.mesh(boxGeo(0.3, 0.9, 0.8, 1), 'panelOrange', 0, 0, 0, { parent: drive });
    B.mesh(cylGeo(0.15, 0.15, 0.1, 24, 0.3), 'steel', -0.18, 0.22, 0.18, { parent: drive, rz: PI / 2 });
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), new THREE.MeshStandardMaterial({ map: textTexture((x, W, H) => { x.fillStyle = '#efe7cf'; x.beginPath(); x.arc(W / 2, H / 2, W / 2, 0, 7); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 4; for (let i = 0; i <= 10; i++) { const a = PI * 0.8 + i / 10 * PI * 1.4; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * W * 0.36, H / 2 + Math.sin(a) * H * 0.36); x.lineTo(W / 2 + Math.cos(a) * W * 0.46, H / 2 + Math.sin(a) * H * 0.46); x.stroke(); } x.fillStyle = '#9a1a10'; x.font = `${W * 0.12}px 'Russo One'`; x.textAlign = 'center'; x.fillText('кВт', W / 2, H * 0.75); }, 128, 128), roughness: 0.5 }));
    gauge.userData.ownMat = true; gauge.position.set(-0.235, 0.22, 0.18); gauge.rotation.y = -PI / 2; drive.add(gauge);
    this.needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.004), solid(0x9a1a10, 0.5)); this.needle.geometry.translate(0, 0.045, 0); this.needle.position.set(-0.24, 0.22, 0.18); this.needle.rotation.x = 1.9; drive.add(this.needle);
    B.collider(A.dx - 0.56, 1.5, dvz, 0.15, 0.45, 0.4, { surface: 'metal' });
    B.pipe([[A.dx - 0.56, 1.95, dvz], [A.dx - 0.56, 3.15, dvz], [A.dx - 0.56, 3.15, 26]], 0.05, 'pipeGrey', { flanges: false });
    this.plate({ head: 'ПРИВОД СТВОРКИ П-1', value: `Δt = ${fmt(v.t)} с`, foot: 'время цикла привода' }, A.dx - 0.715, 1.28, dvz - 0.12, -PI / 2, 'plate_t', () => ({ sym: '\\Delta t', name: 'время цикла привода', text: `${fmt(v.t)} с`, where: 'табличка привода П-1', tool: 'табличка' }), 0.4, 0.2);
    this.plate({ head: 'СТВОРКА П-1', value: `ход s = ${v.s_cm} см`, foot: 'полный ход створки' }, A.dx - 0.405, 1.5, dz0 - 0.55, -PI / 2, 'plate_s', () => ({ sym: 's', name: 'ход створки', text: `${v.s_cm} см`, where: 'табличка на раме двери П-1', tool: 'табличка' }), 0.4, 0.2);
    // beacon
    this.beaconM = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 16), glow(0xff3a1a, 3).clone()); this.beaconM.userData.ownMat = true; this.beaconM.position.set(A.dx - 0.47, 3.3, 26); R.add(this.beaconM);
    this.beacon = this.light('point', 0xff3a1a, 5, A.dx - 0.8, 3.2, 26, { distance: 7 });
    // console
    this.doorScr = new Screen(512, 320, (x, w, h, t) => this.drawDoorScreen(x, w, h, t)); this.screens.push(this.doorScr);
    const dc = this.doorConsole = consoleDesk(B, 16.3, 23.4, -PI / 2, { w: 1.4, screen: this.doorScr.mat, color: 'panelOrange' });
    this.use(dc.group, () => this.g.isSolved('p1_door') ? 'Пульт П-1 · дверь открыта' : 'Пульт гермодвери П-1', () => this.g.openProblem('p1_door', true), { sub: 'ввести скорость привода', enabled: () => !this.g.isSolved('p1_door') && !this.doorBusy });
    // signs
    this.sign(['ШЛЮЗ П-1'], 1.5, 0.34, A.dx - 0.41, 3.55, 26, -PI / 2, { size: 120 });
    this.sign(['ФИЗИЧЕСКИЙ ПРОТОКОЛ', 'ДВЕРЬ ОТКРОЕТСЯ ПО РАСЧЁТУ'], 1.6, 0.42, A.x0 + 0.17, 2.2, 23.2, PI / 2, { size: 70, bg: '#132029', fg: '#bff3ff', border: '#62e6ff' });
    this.sign(['ЛИФТ Л-2 →'], 1.2, 0.28, A.x1 - 0.17, 2.95, 26, -PI / 2, { size: 100, bg: '#0f3a22', fg: '#d9ffe6', border: '#3fbf73' });
    this.poster((x, W, H) => { x.fillStyle = '#e9dfc4'; x.fillRect(0, 0, W, H); x.fillStyle = '#1f3c5a'; x.font = `${W * 0.1}px 'Russo One'`; x.textAlign = 'center'; x.fillText('СКОРОСТЬ', W / 2, H * 0.2); x.font = `${W * 0.24}px 'Russo One'`; x.fillStyle = '#b8342a'; x.fillText('v = s/t', W / 2, H * 0.5); x.fillStyle = '#1f3c5a'; x.font = `${W * 0.065}px 'IBM Plex Sans'`; x.fillText('путь — в метрах,', W / 2, H * 0.7); x.fillText('время — в секундах', W / 2, H * 0.8); }, 0.9, 1.25, 14.6, 1.9, A.z1 - 0.17, PI);
    // lights
    this.airL = [this.light('point', 0xffe2bf, 26, 15.6, 3.9, 26, { distance: 13 }), this.light('point', 0xd8ecff, 18, 22, 3.9, 26, { distance: 12 })];
    this.light('spot', 0xfff0dc, 55, 15.2, 4.25, 26, { target: [A.dx, 1.2, 26], angle: 0.7, penumbra: 0.6, distance: 12, shadow: true });
    // vision
    this.vis(lg, 'Створка П-1', 'm = 1,8 т = <b>1,8·10³ кг</b>', { offset: [-0.4, 1.75, 0], range: 10 });
    this.vis(drive, 'Привод створки', 'P = 15 кВт = <b>1,5·10⁴ Вт</b>', { offset: [-0.3, 0.75, 0], range: 8 });
    this.trigger([13.3, -1, A.z0, A.dx - 0.5, 5, A.z1], () => { this.F.airlock = true; this.zoneName = 'Сектор 0 · Шлюз П-1'; this.g.discoverProblem('p1_door'); this.say('door1Intro'); this.g.audio.playMusic('mech'); this.updateObjective(); });
    this.trigger([A.dx + 0.6, -1, A.z0, A.x1, 5, A.z1], () => { this.zoneName = 'Сектор 0 · Шлюз П-1'; this.updateObjective(); });
    // corridor B to the lift hall
    B.floor(A.x1, 25, LFT.x0, 27, 0, 'floor', { tile: 1.5 });
    B.ceil(A.x1 - 0.15, 24.7, LFT.x0 + 0.15, 27.3, 3.0, 'concreteDk');
    B.wall(A.x1, 24.85, LFT.x0, 24.85, 0, 3.0, 'panelGreen');
    B.wall(A.x1, 27.15, LFT.x0, 27.15, 0, 3.0, 'panelGreen');
    B.lamp(26, 2.88, 26, { w: 0.8, emissive: 2.8 });
  },
  drawDoorScreen(x, w, h, t) {
    const s = this.doorS, ok = this.g.isSolved('p1_door');
    const known = (src) => this.g.hasMeasurement(src);
    drawTerminal(x, w, h, t, ok ? { title: 'ГЕРМОДВЕРЬ П-1', lines: ['СТВОРКА: ОТКРЫТА', `ход: ${fmt(s)} м из ${fmt(s)} м`, 'протокол: выполнен', 'путь свободен →'] }
      : { title: 'ГЕРМОДВЕРЬ П-1', warn: !!this.doorBusy, lines: [this.doorBusy ? 'ПРИВОД РАБОТАЕТ…' : 'СТВОРКА: ЗАКРЫТА', `ход s: ${known('plate_s') ? 'в журнале' : '? (табличка на раме)'}`, `цикл Δt: ${known('plate_t') ? 'в журнале' : '? (табличка привода)'}`, 'ВВОД: скорость v, м/с', '!равномерное движение створки'] });
  },
  // ------------------------------------------------------------------ freight lift Л-2 (problem 2: Δt = h/v, м/мин → м/с)
  buildLift() {
    const B = this.B, R = this.root, L = LFT, v = this.vLift, h = v.h, ph = this.g.physics;
    this.liftH = h;
    const X0 = L.sx0, X1 = L.sx1, Z0 = L.sz0, Z1 = L.sz1, CX = 31.975, CZ = 26;
    this.liftC = V(CX, 0, CZ);
    // hall shell
    B.floor(L.x0, L.z0, X0 - 0.1, L.z1, 0, 'floor', { tile: 1.5 });
    B.floor(X0 - 0.1, L.z0, L.x1, Z0 - 0.05, 0, 'floor', { tile: 1.5 });
    B.floor(X0 - 0.1, Z1 + 0.05, L.x1, L.z1, 0, 'floor', { tile: 1.5 });
    B.floor(X0 - 0.1, Z0 - 0.05, X1 + 0.15, Z1 + 0.05, -0.45, 'concreteDk', { tile: 1 });
    B.ceil(L.x0, L.z0, L.x1, L.z1, L.H, 'concreteDk');
    B.wall(L.x0, L.z0, L.x0, L.z1, 0, L.H, 'concrete', { openings: [{ c: 6, w: 2.0, h: 2.6 }] });
    B.wall(L.x0, L.z0, L.x1, L.z0, 0, L.H, 'concrete');
    B.wall(L.x0, L.z1, L.x1, L.z1, 0, L.H, 'concrete');
    B.wall(L.x1, L.z0, L.x1, L.z1, 0, L.H, 'concrete', { openings: [{ c: 6, w: 2.0, h: 2.6, y: h }] });
    for (const z of [L.z0 + 0.2, L.z1 - 0.2]) for (const x of [28.5, 31.9, 35.3]) B.box(0.4, L.H, 0.25, 'darkmetal', x, L.H / 2, z, { collide: false });
    for (const [z0, z1] of [[L.z0 + 0.16, L.z0 + 0.16], [L.z1 - 0.16, L.z1 - 0.16]]) B.mesh(boxGeo(L.x1 - L.x0 - 0.3, 0.12, 0.03, 1), 'hazard', (L.x0 + L.x1) / 2, 1.0, z0, { cast: false });
    // shaft
    const y0 = -0.45, SH = L.H - y0;
    B.wall(X0, Z0, X0, Z1, y0, SH, 'darkmetal', { thick: 0.2, openings: [{ c: 1.5, w: 1.4, h: 2.4, y: 0.45 }] });
    B.wall(X1, Z0, X1, Z1, y0, SH, 'darkmetal', { thick: 0.3, openings: [{ c: 1.5, w: 1.4, h: 2.4, y: h - y0 }] });
    for (const z of [Z0, Z1]) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, SH), glassMat()); gl.position.set((X0 + X1) / 2, y0 + SH / 2, z); R.add(gl);
      B.collider((X0 + X1) / 2, y0 + SH / 2, z, (X1 - X0) / 2, SH / 2, 0.05, { surface: 'glass' });
      for (let y = 0.06; y < L.H; y += 2.5) B.box(X1 - X0, 0.12, 0.14, 'steel', (X0 + X1) / 2, y, z, { collide: false, cast: false });
      for (const x of [X0, X1]) B.box(0.16, SH, 0.16, 'steel', x, y0 + SH / 2, z, { collide: false });
    }
    // level line + marker B on the inner face of the east wall
    B.box(0.01, 0.05, Z1 - Z0 - 0.1, 'hazard', X1 - 0.155, h - 0.025, CZ, { collide: false, cast: false });
    const tB = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: markerTexture('B'), transparent: true })); tB.userData.ownMat = true;
    tB.position.set(X1 - 0.157, h, CZ + 0.98); tB.rotation.y = -PI / 2; R.add(tB);
    this.snapB = V(X1 - 0.16, h, CZ + 0.98);
    ph.box(X1 - 0.17, h, CZ + 0.98, 0.015, 0.17, 0.17, { data: { marker: 'liftB', markerName: 'B · уровень площадки', snap: this.snapB, surface: 'metal' } });
    this.sign(['УРОВЕНЬ ПЛОЩАДКИ'], 0.9, 0.16, X1 - 0.157, h + 0.26, CZ + 0.98, -PI / 2, { size: 70, bg: '#e0a91c', fg: '#121212', border: '#121212' });
    // pit buffers, winch beam, pulley, top limit buffers
    for (const [x, z] of [[31.2, 25.2], [32.75, 25.2], [31.2, 26.8], [32.75, 26.8]]) B.cyl(0.12, 0.12, 0.1, 'hazard', x, -0.4, z, { seg: 16 });
    B.box(0.3, 0.4, Z1 - Z0, 'darkmetal', CX, L.H - 0.35, CZ, { collide: false });
    const pul = B.mesh(cylGeo(0.36, 0.36, 0.14, 28, 0.4), 'steel', CX, L.H - 0.85, CZ, { rz: PI / 2 }); this.pulley = pul;
    const yb = h + 0.6 + 2.92;
    for (const z of [25.25, 26.75]) {
      const len = L.H - 0.55 - yb;
      B.cyl(0.08, 0.08, len, 'steel', CX, yb + len / 2, z, { seg: 12 });
      B.cyl(0.13, 0.13, 0.22, 'hazard', CX, yb + 0.11, z, { seg: 18 });
    }
    // platform
    const pg = this.platG = new THREE.Group(); R.add(pg);
    B.mesh(boxGeo(2.66, 0.3, 2.84, 1), 'plate', 0, 0, 0, { parent: pg });
    for (const z of [-1.36, 1.36]) B.mesh(boxGeo(2.66, 0.012, 0.12, 1), 'hazard', 0, 0.156, z, { parent: pg, cast: false });
    for (const z of [-1.36, 1.36]) B.mesh(boxGeo(0.12, 2.75, 0.1, 1), 'pipeYellow', 0, 0.15 + 1.375, z, { parent: pg });
    B.mesh(boxGeo(0.18, 0.18, 2.84, 1), 'pipeYellow', 0, 0.15 + 2.84, 0, { parent: pg });
    const tA = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshBasicMaterial({ map: markerTexture('A'), transparent: true })); tA.userData.ownMat = true;
    tA.rotation.x = -PI / 2; tA.position.set(0.85, 0.153, 0.65); pg.add(tA);
    // control panel on the platform
    const pn = this.liftPanel = new THREE.Group(); pn.position.set(1.0, 0.15, -1.1); pn.rotation.y = -0.73; pg.add(pn);
    B.mesh(boxGeo(0.12, 1.05, 0.12, 1), 'darkmetal', 0, 0.525, 0, { parent: pn });
    const hd = new THREE.Group(); hd.position.set(0, 1.15, 0.03); hd.rotation.x = -0.55; pn.add(hd);
    B.mesh(boxGeo(0.52, 0.36, 0.08, 1), 'panelOrange', 0, 0, 0, { parent: hd });
    this.liftScr = new Screen(384, 256, (x, w, hh, t) => this.drawLiftScreen(x, w, hh, t)); this.screens.push(this.liftScr);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.29), this.liftScr.mat); sc.position.z = 0.041; hd.add(sc);
    const k = this.platK = this.mover(CX, -0.15, CZ, 1.33, 0.15, 1.42, pg, { surface: 'metal' });
    ph.data.get(k.k.collider.handle).platformRef = k;
    this.snapA = V(CX + 0.85, 0, CZ + 0.65);
    ph.addCollider(k.k.body, RAPIER.ColliderDesc.cuboid(0.15, 0.012, 0.15).setTranslation(0.85, 0.16, 0.65).setSensor(true), { marker: 'liftA', markerName: 'A · пол платформы', snap: this.snapA, platformRef: k, surface: 'metal' });
    ph.addCollider(k.k.body, RAPIER.ColliderDesc.cuboid(0.2, 0.7, 0.2).setTranslation(1.0, 0.85, -1.1), { surface: 'metal', interactObj: pn, platformRef: k });
    for (const z of [-1.36, 1.36]) ph.addCollider(k.k.body, RAPIER.ColliderDesc.cuboid(0.06, 1.375, 0.05).setTranslation(0, 0.15 + 1.375, z), { surface: 'metal', platformRef: k });
    this.platY = 0;
    this.cable = new THREE.Mesh(cylGeo(0.022, 0.022, 1, 8, 1), mat('steel')); this.cable.position.set(CX, 6, CZ); R.add(this.cable);
    this.use(pn, () => this.g.isSolved('p2_lift') ? 'Пульт лифта · подъём выполнен' : 'Пульт лифта Л-2', () => this.g.openProblem('p2_lift', true), { sub: 'ввести время работы мотора', enabled: () => !this.g.isSolved('p2_lift') && !this.liftBusy, range: 2.2 });
    // shaft door (vertical gate, west) and the safety gate at the landing (east)
    const sdg = new THREE.Group(); R.add(sdg);
    B.mesh(boxGeo(0.06, 2.45, 1.5, 1), 'steel', 0, 0, 0, { parent: sdg });
    B.mesh(boxGeo(0.07, 0.3, 1.5, 1), 'hazard', 0, -1.05, 0, { parent: sdg, cast: false });
    B.mesh(boxGeo(0.07, 0.6, 0.8, 1), glassMat(), 0, 0.45, 0, { parent: sdg, cast: false });
    this.shaftDoor = this.mover(X0 - 0.16, 1.225, CZ, 0.03, 1.225, 0.75, sdg);
    const egg = new THREE.Group(); R.add(egg);
    for (let i = 0; i < 7; i++) B.mesh(boxGeo(0.05, 2.4, 0.06, 1), 'pipeYellow', 0, 0, -0.66 + i * 0.22, { parent: egg });
    for (const y of [-1.1, 0, 1.1]) B.mesh(boxGeo(0.06, 0.1, 1.5, 1), 'hazard', 0, y, 0, { parent: egg });
    this.eastGate = this.mover(X1 + 0.19, h + 1.225, CZ, 0.03, 1.225, 0.75, egg);
    // landing (top) + exit
    B.box(L.x1 - 0.15 - (X1 + 0.15), h - 0.1, 5, 'concrete', (X1 + 0.15 + L.x1 - 0.15) / 2, (h - 0.1) / 2, CZ);
    B.floor(X1 + 0.15, CZ - 2.5, L.x1 - 0.15, CZ + 2.5, h, 'plate', { thick: 0.1, tile: 1 });
    const rail = (x0, z0, x1, z1) => {
      const alongX = Math.abs(z1 - z0) < 1e-6, len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      B.box(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len, 'pipeYellow', cx, h + 1.05, cz, { collide: false });
      B.box(alongX ? len : 0.04, 0.04, alongX ? 0.04 : len, 'pipeYellow', cx, h + 0.55, cz, { collide: false });
      const n = Math.max(2, Math.round(len / 1.1) + 1); for (let i = 0; i < n; i++) { const t = i / (n - 1); B.box(0.05, 1.05, 0.05, 'pipeYellow', x0 + (x1 - x0) * t, h + 0.525, z0 + (z1 - z0) * t, { collide: false }); }
      B.collider(cx, h + 0.6, cz, alongX ? len / 2 : 0.05, 0.6, alongX ? 0.05 : len / 2, { surface: 'metal' });
    };
    rail(X1 + 0.15, CZ - 2.45, L.x1 - 0.15, CZ - 2.45); rail(X1 + 0.15, CZ + 2.45, L.x1 - 0.15, CZ + 2.45);
    rail(X1 + 0.1, CZ - 2.5, X1 + 0.1, Z0 - 0.05); rail(X1 + 0.1, Z1 + 0.05, X1 + 0.1, CZ + 2.5);
    // winch motor with the speed plate
    const mot = this.motorG = new THREE.Group(); mot.position.set(28.9, 0, 23.0); R.add(mot);
    B.mesh(boxGeo(1.3, 0.25, 1.8, 1), 'darkmetal', 0, 0.125, 0, { parent: mot });
    B.mesh(boxGeo(0.9, 0.9, 1.0, 1), 'panelGreen', 0, 0.7, -0.3, { parent: mot });
    for (let i = 0; i < 6; i++) B.mesh(boxGeo(0.92, 0.04, 0.02, 1), 'darkmetal', 0, 0.35 + i * 0.12, 0.21, { parent: mot, cast: false });
    this.drum = B.mesh(cylGeo(0.3, 0.3, 0.8, 24, 0.5), 'steel', 0, 0.62, 0.55, { parent: mot, rz: PI / 2 });
    B.collider(28.9, 0.6, 23.0, 0.65, 0.6, 0.9, { surface: 'metal' });
    this.plate({ head: 'МОТОР ЛИФТА Л-2', value: `v = ${v.vm} м/мин`, foot: 'скорость подъёма платформы' }, 28.44, 0.86, 22.7, -PI / 2, 'plate_vlift', () => ({ sym: 'v', name: 'скорость подъёма', text: `${v.vm} м/мин`, where: 'табличка мотора лифта', tool: 'табличка' }), 0.4, 0.2);
    B.pipe([[28.9, 0.92, 23.55], [28.9, L.H - 0.5, 23.55], [CX, L.H - 0.5, 23.55], [CX, L.H - 0.5, CZ - 0.3]], 0.025, 'steel', { flanges: false, cast: false });
    // signs, lamps, lights
    this.sign(['ГРУЗОВОЙ ЛИФТ Л-2'], 1.7, 0.32, X0 - 0.12, 2.72, CZ, -PI / 2, { size: 110 });
    this.sign(['ВЫХОД · СЕКТОР 1'], 1.3, 0.28, L.x1 - 0.17, h + 2.95, CZ, -PI / 2, { size: 100, bg: '#0f3a22', fg: '#d9ffe6', border: '#3fbf73' });
    this.sign(['ГРУЗОПОДЪЁМНОСТЬ 2 т', 'ЛЮДЯМ — У ПУЛЬТА'], 1.1, 0.34, 28.9, 1.75, L.z0 + 0.17, 0, { size: 70, bg: '#d8cfb6', fg: '#1d1d1b', border: '#1d1d1b' });
    for (const [x, z] of [[28.6, 23], [28.6, 29], [35.3, 22], [35.3, 30]]) B.lamp(x, L.H - 0.12, z, { w: 1.8, emissive: 3.2 });
    this.liftL = [this.light('point', 0xffc48a, 70, 28.7, 7.5, 26, { distance: 20 }), this.light('point', 0xffc48a, 40, 35.3, h + 3.4, 26, { distance: 12 }), this.light('point', 0xd8e8ff, 20, 28.6, 3.0, 23.4, { distance: 8 })];
    this.light('spot', 0xfff0dc, 140, CX, L.H - 1.2, CZ, { target: [CX, 0, CZ], angle: 0.42, penumbra: 0.5, distance: 18, shadow: true });
    this.vis(pg, 'Платформа Л-2', 'грузоподъёмность 2 т = <b>2·10³ кг</b>', { offset: [0, 1.9, 0], range: 10 });
    this.vis(mot, 'Мотор лифта', 'P = 7,5 кВт = <b>7,5·10³ Вт</b>', { offset: [0, 1.6, 0], range: 8 });
    this.trigger([L.x0 + 0.2, -1, L.z0, L.x1, 4, L.z1], () => { this.F.liftHall = true; this.zoneName = 'Сектор 0 · Лифтовой зал'; this.g.discoverProblem('p2_lift'); this.say('liftIntro'); this.updateObjective(); });
  },
  drawLiftScreen(x, w, h, t) {
    const ok = this.g.isSolved('p2_lift');
    const known = (src) => this.g.hasMeasurement(src);
    drawTerminal(x, w, h, t, ok ? { title: 'ЛИФТ Л-2', lines: ['ПЛАТФОРМА: НАВЕРХУ', 'ворота: открыты', 'протокол: выполнен'] }
      : { title: 'ЛИФТ Л-2', warn: !!this.liftBusy, lines: [this.liftBusy ? `ПОДЪЁМ… ${fmtFixed(this.platY, 2)} м` : 'ПЛАТФОРМА: ВНИЗУ', `h: ${known('h_lift') ? 'в журнале' : '? (рулетка, A→B)'}`, `v: ${known('plate_vlift') ? 'в журнале' : '? (табличка мотора)'}`, 'ВВОД: время Δt, с'] });
  },
  // ------------------------------------------------------------------ exit to sector 1
  buildExit() {
    const B = this.B, R = this.root, h = this.liftH, x0 = LFT.x1 - 0.15, x1 = 42.5;
    B.floor(x0, 25, x1, 27, h, 'plate', { tile: 1 });
    B.ceil(x0, 24.7, x1, 27.3, h + 3.0, 'concreteDk');
    B.wall(x0, 24.85, x1, 24.85, h, 3.0, 'panelBlue');
    B.wall(x0, 27.15, x1, 27.15, h, 3.0, 'panelBlue');
    B.wall(x1, 24.7, x1, 27.3, h, 3.0, 'darkmetal', { thick: 0.4 });
    const gate = this.sectorGate = new THREE.Group(); gate.position.set(x1 - 0.22, h + 1.4, 26); gate.rotation.y = -PI / 2; R.add(gate);
    const disk = new THREE.Mesh(cylGeo(1.15, 1.15, 0.12, 48, 0.8), mat('steel')); disk.rotation.x = PI / 2; gate.add(disk);
    const ring = new THREE.Mesh(torusGeo(1.18, 0.08, 10, 64, 0.5), mat('brass')); gate.add(ring);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const b = new THREE.Mesh(boxGeo(0.12, 0.5, 0.1, 1), mat('darkmetal')); b.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.08); b.rotation.z = a + PI / 2; gate.add(b); }
    this.gateRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 48), glow(0xffb547, 4).clone()); this.gateRing.userData.ownMat = true; this.gateRing.position.z = 0.09; gate.add(this.gateRing);
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.36, 40), new THREE.MeshStandardMaterial({ map: textTexture((x, W, H) => { x.fillStyle = '#1b2228'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffb547'; x.font = `${W * 0.2}px 'Russo One'`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('1', W / 2, H * 0.42); x.font = `${W * 0.1}px 'Russo One'`; x.fillText('МЕХАНИКА', W / 2, H * 0.68); }, 256, 256), roughness: 0.5, metalness: 0.3, emissive: new THREE.Color(0x553300), emissiveIntensity: 0.6 }));
    em.userData.ownMat = true; em.position.z = 0.07; gate.add(em);
    this.sign(['СЕКТОР 1 · МЕХАНИКА'], 1.9, 0.3, x1 - 0.21, h + 2.75, 26, -PI / 2, { size: 110, bg: '#1d2226', fg: '#ffcf8a', border: '#e0a91c' });
    this.exitL = this.light('point', 0xffb070, 22, x1 - 1.4, h + 2.6, 26, { distance: 9 });
    B.lamp(39.5, h + 2.88, 26, { w: 1.2, emissive: 2.6 });
    this.exitEmitter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 24), glow(0x62e6ff, 2.5)); this.exitEmitter.position.set(40.4, h + 0.04, 26); R.add(this.exitEmitter);
    this.trigger([38.6, h - 1, 24.8, x1, h + 3, 27.2], () => this.ending());
  },
};
