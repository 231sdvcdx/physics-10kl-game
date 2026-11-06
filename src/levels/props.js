// Reusable procedural props: plates, benches, consoles, lockers, valves, desks, shelves, ISAAC hologram, glass cracks
import * as THREE from 'three';
import { mat, glow, solid, boxGeo, cylGeo, torusGeo } from '../core/materials.js';
import { holoMaterial, coneLight, fxTime } from '../fx/fx.js';

// riveted aluminium nameplate texture: header / big value / footnote
export function plateTexture({ head = '', value = '', foot = '', w = 768, h = 384, bg = '#c8c1ab', fg = '#1d1d1b', accent = '#8a2a1a' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, bg); gr.addColorStop(0.5, '#ddd6c0'); gr.addColorStop(1, '#a9a28c');
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(60,50,30,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 40, 1); }
  x.strokeStyle = '#3a372f'; x.lineWidth = 6; x.strokeRect(16, 16, w - 32, h - 32);
  for (const [px, py] of [[34, 34], [w - 34, 34], [34, h - 34], [w - 34, h - 34]]) { const rg = x.createRadialGradient(px - 3, py - 3, 1, px, py, 11); rg.addColorStop(0, '#f4f0e2'); rg.addColorStop(1, '#55503f'); x.fillStyle = rg; x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill(); }
  x.fillStyle = accent; x.fillRect(34, 58, w - 68, 6);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `600 ${Math.round(h * 0.085)}px 'Exo 2'`; x.fillText(head.toUpperCase(), w / 2, 100);
  x.font = `${Math.round(h * 0.2)}px 'Russo One'`; x.fillText(value, w / 2, h * 0.56);
  x.font = `500 ${Math.round(h * 0.07)}px 'IBM Plex Sans'`; x.fillStyle = '#3d3a31'; x.fillText(foot, w / 2, h * 0.82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function plateMesh(o, pw = 0.42, ph = 0.21) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: plateTexture(o), roughness: 0.45, metalness: 0.55, envMapIntensity: 0.8 }));
  m.userData.ownMat = true; m.castShadow = false; return m;
}
// generic canvas poster / label
export function textTexture(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function bench(B, x, z, ry = 0, len = 2.4) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; B.root.add(g);
  const seat = B.mesh(boxGeo(len, 0.06, 0.42, 1), 'wood', 0, 0.46, 0, { parent: g });
  B.mesh(boxGeo(len, 0.36, 0.05, 1), 'wood', 0, 0.78, 0.2, { parent: g, rx: -0.12 });
  for (const sx of [-len / 2 + 0.15, len / 2 - 0.15]) { B.mesh(boxGeo(0.06, 0.46, 0.4, 1), 'darkmetal', sx, 0.23, 0, { parent: g }); B.mesh(boxGeo(0.05, 0.5, 0.05, 1), 'darkmetal', sx, 0.7, 0.2, { parent: g }); }
  g.updateWorldMatrix(true, true);
  B.ph.boxFromMesh(seat, { surface: 'wood' });
  const c = new THREE.Vector3(0, 0.25, 0).applyMatrix4(g.matrixWorld);
  B.collider(c.x, 0.25, c.z, Math.abs(Math.cos(ry)) * len / 2 + Math.abs(Math.sin(ry)) * 0.22, 0.25, Math.abs(Math.sin(ry)) * len / 2 + Math.abs(Math.cos(ry)) * 0.22);
  return g;
}

// sloped control console with buttons and an optional screen material
export function consoleDesk(B, x, z, ry = 0, { w = 1.6, screen = null, color = 'panelCream', lamps = true } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; B.root.add(g);
  B.mesh(boxGeo(w, 0.82, 0.62, 1), 'darkmetal', 0, 0.41, 0, { parent: g });
  const top = B.mesh(boxGeo(w + 0.04, 0.06, 0.66, 1), color, 0, 0.92, -0.02, { parent: g, rx: 0.32 });
  if (lamps) {
    const cols = [0xff5a3a, 0x72ffa8, 0xffb547, 0x62e6ff];
    for (let i = 0; i < Math.floor(w / 0.16); i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), glow(cols[i % 4], 3)); b.position.set(-w / 2 + 0.12 + i * 0.16, 0.975, 0.1); b.rotation.x = 0.32; g.add(b); }
    for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16), mat('blackmetal')); k.position.set(-w / 2 + 0.2 + i * 0.22, 0.93, -0.12); k.rotation.x = 0.32; g.add(k); }
  }
  let scr = null;
  if (screen) {
    const frame = B.mesh(boxGeo(0.72, 0.5, 0.08, 1), 'darkmetal', w / 2 - 0.45, 1.32, -0.26, { parent: g });
    scr = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.42), screen); scr.position.set(w / 2 - 0.45, 1.32, -0.215); g.add(scr);
    B.mesh(boxGeo(0.06, 0.3, 0.06, 1), 'darkmetal', w / 2 - 0.45, 1.02, -0.27, { parent: g });
  }
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3(0, 0.5, 0).applyMatrix4(g.matrixWorld);
  const hw = Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * 0.34, hd = Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * 0.34;
  B.collider(p.x, 0.5, p.z, hw, 0.5, hd, { data: { surface: 'metal', interactObj: g } });
  return { group: g, top, screen: scr };
}

// wall cabinet with hinged door; returns pivot to animate
export function locker(B, x, y, z, ry = 0, { w = 0.8, h = 1.5, d = 0.38, color = 'pipeRed', label = null } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; B.root.add(g);
  B.mesh(boxGeo(w, h, 0.03, 1), color, 0, h / 2, -d / 2 + 0.015, { parent: g });
  B.mesh(boxGeo(0.03, h, d, 1), color, -w / 2 + 0.015, h / 2, 0, { parent: g });
  B.mesh(boxGeo(0.03, h, d, 1), color, w / 2 - 0.015, h / 2, 0, { parent: g });
  B.mesh(boxGeo(w, 0.03, d, 1), color, 0, 0.015, 0, { parent: g });
  B.mesh(boxGeo(w, 0.03, d, 1), color, 0, h - 0.015, 0, { parent: g });
  B.mesh(boxGeo(w - 0.06, 0.025, d - 0.05, 1), 'steel', 0, h * 0.45, 0, { parent: g });
  const pivot = new THREE.Group(); pivot.position.set(-w / 2, 0, d / 2); g.add(pivot);
  const door = B.mesh(boxGeo(w, h, 0.03, 1), color, w / 2, h / 2, 0.015, { parent: pivot });
  B.mesh(boxGeo(0.04, 0.18, 0.04, 1), 'steel', w - 0.08, h / 2, 0.05, { parent: pivot });
  if (label) { const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.2), new THREE.MeshStandardMaterial({ map: textTexture((c, W, H) => { c.fillStyle = '#efe7cf'; c.fillRect(0, 0, W, H); c.fillStyle = '#9a1a10'; c.font = `${H * 0.5}px 'Russo One'`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, W / 2, H / 2); }, 512, 128), roughness: 0.6 })); s.position.set(w / 2, h * 0.78, 0.035); s.userData.ownMat = true; pivot.add(s); }
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3(0, h / 2, 0).applyMatrix4(g.matrixWorld);
  B.collider(p.x, p.y, p.z, Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * d / 2, h / 2, Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * d / 2, { data: { surface: 'metal', interactObj: g } });
  return { group: g, pivot, door };
}

export function valveWheel(B, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; B.root.add(g);
  B.mesh(cylGeo(0.07, 0.07, 0.3, 14, 0.5), 'pipeGrey', 0, 0, 0.15, { parent: g, rx: Math.PI / 2 });
  const wheel = new THREE.Group(); wheel.position.z = 0.32; g.add(wheel);
  const rim = new THREE.Mesh(torusGeo(0.2, 0.022, 10, 36, 0.5), mat('pipeRed')); wheel.add(rim);
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(boxGeo(0.4, 0.025, 0.025, 1), mat('pipeRed')); s.rotation.z = i * Math.PI / 4; wheel.add(s); }
  const hub = new THREE.Mesh(cylGeo(0.05, 0.05, 0.06, 12, 0.3), mat('steel')); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  return { group: g, wheel };
}

export function studentDesk(B, x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; B.root.add(g);
  const top = B.mesh(boxGeo(1.1, 0.05, 0.55, 1), 'wood', 0, 0.74, 0, { parent: g });
  for (const [sx, sz] of [[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]]) B.mesh(boxGeo(0.04, 0.72, 0.04, 1), 'darkmetal', sx, 0.36, sz, { parent: g });
  B.mesh(boxGeo(1.0, 0.25, 0.02, 1), 'panelGreen', 0, 0.55, -0.24, { parent: g });
  // chair
  B.mesh(boxGeo(0.42, 0.04, 0.4, 1), 'wood', 0, 0.45, 0.55, { parent: g });
  B.mesh(boxGeo(0.42, 0.34, 0.03, 1), 'wood', 0, 0.68, 0.76, { parent: g });
  for (const [sx, sz] of [[-0.18, 0.38], [0.18, 0.38], [-0.18, 0.72], [0.18, 0.72]]) B.mesh(boxGeo(0.03, 0.45, 0.03, 1), 'darkmetal', sx, 0.225, sz, { parent: g });
  g.updateWorldMatrix(true, true);
  B.ph.boxFromMesh(top, { surface: 'wood' });
  const p = new THREE.Vector3(0, 0.4, 0.1).applyMatrix4(g.matrixWorld);
  B.collider(p.x, 0.4, p.z, Math.abs(Math.cos(ry)) * 0.55 + Math.abs(Math.sin(ry)) * 0.45, 0.4, Math.abs(Math.sin(ry)) * 0.55 + Math.abs(Math.cos(ry)) * 0.45);
  return g;
}

export function shelf(B, x, z, ry = 0, { w = 1.8, h = 2.2, d = 0.45, seed = 1 } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; B.root.add(g);
  for (const sx of [-w / 2, w / 2]) B.mesh(boxGeo(0.04, h, d, 1), 'darkmetal', sx, h / 2, 0, { parent: g });
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const cols = [0x6b2a1c, 0x2e4a5e, 0x5a5a3a, 0x7a6a4a, 0x3a3a3a, 0x8a7a5a];
  for (let k = 0; k < 5; k++) {
    const y = 0.08 + k * (h - 0.1) / 4.6;
    B.mesh(boxGeo(w, 0.03, d, 1), 'steel', 0, y, 0, { parent: g, cast: false });
    let xx = -w / 2 + 0.05;
    while (xx < w / 2 - 0.12) { const bw = 0.05 + rnd() * 0.07, bh = 0.24 + rnd() * 0.12; if (rnd() < 0.12) { xx += 0.1; continue; } const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d * 0.75), solid(cols[Math.floor(rnd() * cols.length)], 0.8)); b.position.set(xx + bw / 2, y + 0.015 + bh / 2, 0); b.rotation.z = rnd() < 0.1 ? 0.2 : 0; g.add(b); xx += bw + 0.005; }
  }
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3(0, h / 2, 0).applyMatrix4(g.matrixWorld);
  B.collider(p.x, p.y, p.z, Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * d / 2, h / 2, Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * d / 2);
  return g;
}

// ISAAC: retro-futurist holographic head with a single eye, halo ring and orbiting memory fragments
export class IsaacHolo {
  constructor() {
    const g = this.group = new THREE.Group();
    this.mHead = holoMaterial(0x62e6ff, { opacity: 0.9, rim: 1.4, intensity: 2.2 });
    this.mRing = holoMaterial(0xffb547, { opacity: 0.8, rim: 1.0, intensity: 2.0 });
    this.mFrag = holoMaterial(0x62e6ff, { opacity: 0.7, rim: 1.0, intensity: 1.8 });
    const head = this.head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 20), this.mHead); g.add(head);
    const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.14, 24, 1, true), this.mHead); jaw.position.y = -0.22; g.add(jaw);
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.03, 8, 48, Math.PI * 0.9), this.mRing); visor.rotation.set(0, Math.PI * 0.05 - Math.PI / 2 + Math.PI, 0); visor.rotation.x = Math.PI / 2; visor.position.y = 0.02; head.add(visor);
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb547).multiplyScalar(6) })); this.eye.position.set(0, 0.03, 0.225); head.add(this.eye);
    const halo = this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 6, 80), this.mRing); halo.rotation.x = Math.PI / 2; halo.position.y = 0.05; g.add(halo);
    const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.2, 32, 1, true), this.mHead); shoulders.position.y = -0.42; g.add(shoulders);
    this.frags = [];
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.05 + Math.random() * 0.06, 0.012, 0.05 + Math.random() * 0.05), this.mFrag); f.userData = { a: Math.random() * 6.28, r: 0.45 + Math.random() * 0.25, y: -0.4 + Math.random() * 0.8, s: 0.3 + Math.random() * 0.8 }; g.add(f); this.frags.push(f); }
    this.beam = coneLight(0x62e6ff, { length: 1.25, radius: 0.42, intensity: 0.55 }); this.beam.rotation.x = Math.PI; this.beam.position.y = -1.35; g.add(this.beam);
    this.integrity = 0.07; this.speak = 0; this.t = 0; this.look = new THREE.Vector3();
    this.group.traverse(o => { o.castShadow = false; o.userData.noOutline = true; });
  }
  setIntegrity(v) { this.integrity = v; }
  update(dt, speaking, lookAt) {
    this.t += dt; const t = this.t, I = this.integrity;
    this.speak += ((speaking ? 1 : 0) - this.speak) * Math.min(1, dt * 8);
    const gl = (1 - I) * 0.9 * (Math.sin(t * 13.1) > 0.7 ? 1 : 0.15);
    for (const m of [this.mHead, this.mRing, this.mFrag]) m.uniforms.uGlitch.value = gl;
    this.mHead.uniforms.uOpacity.value = 0.55 + I * 0.4 + (Math.random() < (1 - I) * 0.08 ? -0.4 : 0);
    this.head.position.y = Math.sin(t * 1.3) * 0.03;
    this.halo.rotation.z = t * 0.6; this.halo.scale.setScalar(1 + this.speak * 0.08 * Math.sin(t * 22));
    this.eye.scale.setScalar(0.8 + this.speak * (0.4 + 0.3 * Math.sin(t * 30)));
    this.frags.forEach((f, i) => { const u = f.userData; u.a += dt * u.s; const vis = i / this.frags.length < 0.35 + I; f.visible = vis && Math.random() > (1 - I) * 0.05; f.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t + i) * 0.05, Math.sin(u.a) * u.r); f.rotation.y = -u.a; });
    if (lookAt) { this.look.lerp(lookAt, Math.min(1, dt * 3)); const p = new THREE.Vector3(); this.group.getWorldPosition(p); const yaw = Math.atan2(this.look.x - p.x, this.look.z - p.z); this.head.rotation.y = yaw - this.group.rotation.y; }
  }
}

// procedural crack decal for the gallery glass
export function crackTexture(w = 2048, h = 512, seeds = [[0.42, 0.45], [0.74, 0.62], [0.2, 0.3]]) {
  return textTexture((x, W, H) => {
    x.clearRect(0, 0, W, H); x.lineCap = 'round';
    const branch = (px, py, ang, len, width, depth) => {
      let cx = px, cy = py;
      const steps = 6 + Math.floor(Math.random() * 6);
      x.beginPath(); x.moveTo(cx, cy);
      for (let i = 0; i < steps; i++) { ang += (Math.random() - .5) * 0.6; cx += Math.cos(ang) * len / steps; cy += Math.sin(ang) * len / steps; x.lineTo(cx, cy); if (depth > 0 && Math.random() < 0.18) branch(cx, cy, ang + (Math.random() - .5) * 1.6, len * 0.45, width * 0.6, depth - 1); }
      x.strokeStyle = `rgba(230,245,255,${0.35 + width * 0.08})`; x.lineWidth = width; x.stroke();
    };
    for (const [sx, sy] of seeds) {
      const px = sx * W, py = sy * H;
      for (let k = 0; k < 14; k++) branch(px, py, k / 14 * Math.PI * 2 + Math.random() * 0.3, 140 + Math.random() * 380, 2.6, 2);
      for (let r = 18; r < 120; r += 22 + Math.random() * 20) { x.beginPath(); for (let a = 0; a <= 6.4; a += 0.35) { const rr = r * (0.8 + Math.random() * 0.4); a === 0 ? x.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.strokeStyle = 'rgba(230,245,255,.35)'; x.lineWidth = 1.4; x.stroke(); }
      const rg = x.createRadialGradient(px, py, 0, px, py, 30); rg.addColorStop(0, 'rgba(255,255,255,.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.beginPath(); x.arc(px, py, 30, 0, 7); x.fill();
    }
  }, w, h);
}
