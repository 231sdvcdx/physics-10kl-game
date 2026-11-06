// Main-menu backdrop (the Core hall) and the holographic void used to replay lessons
import * as THREE from 'three';
import { mat, glow, boxGeo, cylGeo, torusGeo } from '../core/materials.js';
import { coreMaterial, coneLight, Particles, Arc, holoMaterial, fxTime } from '../fx/fx.js';

function disposeTree(root) {
  root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.userData.ownMat) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
  root.removeFromParent();
}

export class MenuScene {
  constructor(game) { this.g = game; this.root = new THREE.Group(); this.t = 0; this.arcs = []; }
  build() {
    const g = this.g, S = g.engine.scene, R = this.root; S.add(R);
    this.prevFog = S.fog; this.prevBg = S.background;
    S.fog = new THREE.FogExp2(0x07090c, 0.022); S.background = new THREE.Color(0x020304);
    // hall
    const wallM = mat('concreteDk').clone(); wallM.side = THREE.BackSide;
    const hall = new THREE.Mesh(cylGeo(26, 26, 40, 48, 0.25, true), wallM); hall.position.y = 4; R.add(hall); hall.userData.ownMat = true;
    const floor = new THREE.Mesh(cylGeo(26, 26, 0.4, 48, 0.25), mat('floor')); floor.position.y = -14; R.add(floor);
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      for (const y of [-6, 2, 10]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.12), glow(i % 6 === 0 ? 0xff7a3a : 0xffd7a8, i % 6 === 0 ? 5 : 2.4));
        strip.position.set(Math.cos(a) * 25.6, y, Math.sin(a) * 25.6); strip.lookAt(0, y, 0); R.add(strip);
      }
      const rib = new THREE.Mesh(boxGeo(0.8, 40, 1.2, 1), mat('darkmetal')); rib.position.set(Math.cos(a + 0.13) * 25.4, 4, Math.sin(a + 0.13) * 25.4); rib.lookAt(0, 4, 0); R.add(rib);
    }
    // core
    this.coreMat = coreMaterial(); this.coreMat.uniforms.uHeat.value = 0.55;
    const core = this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 24), this.coreMat); R.add(core); core.userData.ownMat = true;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(4.4, 32, 20), holoMaterial(0xff8a3a, { opacity: 0.35, rim: 3.5, intensity: 1.6, scan: 0.3 })); R.add(halo); halo.userData.ownMat = true;
    this.rings = [];
    for (const [Rr, tilt, sp] of [[5.2, 0.35, 0.22], [6.3, -0.6, -0.15], [7.5, 1.2, 0.09]]) {
      const pivot = new THREE.Group(); pivot.rotation.set(tilt, 0, tilt * 0.6); R.add(pivot);
      const ring = new THREE.Mesh(torusGeo(Rr, 0.16, 12, 120, 2), mat('brass')); ring.rotation.x = Math.PI / 2; pivot.add(ring);
      for (let k = 0; k < 6; k++) { const n = new THREE.Mesh(boxGeo(0.5, 0.5, 0.5, 1), mat('darkmetal')); const a = k / 6 * Math.PI * 2; n.position.set(Math.cos(a) * Rr, 0, Math.sin(a) * Rr); pivot.add(n); const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.52), glow(0x62e6ff, 6)); l.position.copy(n.position); pivot.add(l); }
      this.rings.push({ pivot, sp });
    }
    for (let i = 0; i < 4; i++) { const a = new Arc(0xffc890, 22); R.add(a.line); this.arcs.push(a); }
    // supports
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.4;
      const arm = new THREE.Mesh(boxGeo(0.7, 0.7, 17, 1), mat('steel')); arm.position.set(Math.cos(a) * 16, -8 + i % 2 * 16, Math.sin(a) * 16); arm.lookAt(0, 0, 0); R.add(arm);
    }
    // catwalk
    const cw = new THREE.Group(); cw.position.set(0, -2.2, 12); R.add(cw);
    cw.add(new THREE.Mesh(boxGeo(2.6, 0.18, 14, 1), mat('plate')));
    for (const x of [-1.25, 1.25]) {
      const rail = new THREE.Mesh(boxGeo(0.06, 0.06, 14, 1), mat('pipeYellow')); rail.position.set(x, 1.05, 0); cw.add(rail);
      for (let z = -6.5; z <= 6.5; z += 1.3) { const p = new THREE.Mesh(boxGeo(0.05, 1.05, 0.05, 1), mat('steel')); p.position.set(x, 0.52, z); cw.add(p); }
      for (let z = -6; z <= 6; z += 3) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.5), glow(0xffd7a8, 4)); l.position.set(x, 0.12, z); cw.add(l); }
    }
    cw.position.z = 14.5;
    // volumetric cones
    for (let i = 0; i < 5; i++) { const c = coneLight(0xffc68a, { length: 26, radius: 4, intensity: 0.12 }); const a = i / 5 * Math.PI * 2; c.position.set(Math.cos(a) * 13, 22, Math.sin(a) * 13); c.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); R.add(c); c.userData.ownMat = true; }
    // lights
    const L = (c, i, x, y, z, d) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); R.add(l); return l; };
    this.coreLight = L(0xff9a50, 900, 0, 0, 0, 60);
    L(0x62c8ff, 120, -14, 6, 10, 40); L(0x62c8ff, 80, 14, -4, -8, 40);
    R.add(new THREE.HemisphereLight(0x5a6878, 0x120b08, 0.35));
    // dust
    this.dust = new Particles(Math.round(500 * (g.engine.q.particles || 1)), { size: 0.06, color: 0xffd9b0, fadeIn: 0.3 }); R.add(this.dust.points);
    for (let i = 0; i < this.dust.max; i++) this.spawnDust(true);
    this.t = 0;
  }
  spawnDust(init = false) {
    const r = 3.5 + Math.random() * 18, a = Math.random() * Math.PI * 2;
    this.dust.spawn(Math.cos(a) * r, -10 + Math.random() * (init ? 24 : 4), Math.sin(a) * r, (Math.random() - .5) * 0.2, 0.25 + Math.random() * 0.5, (Math.random() - .5) * 0.2, 8 + Math.random() * 10, 0.03 + Math.random() * 0.06, 1, 0.8 + Math.random() * 0.2, 0.6);
  }
  update(dt) {
    this.t += dt; const t = this.t;
    const cam = this.g.engine.camera;
    const a = t * 0.045 + 0.3;
    cam.position.set(Math.sin(a) * 15.5, 0.6 + Math.sin(t * 0.21) * 0.8, Math.cos(a) * 15.5);
    const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    cam.lookAt(side.multiplyScalar(-3.2).add(new THREE.Vector3(0, 0.3, 0)));
    cam.fov = 58; cam.updateProjectionMatrix();
    this.core.rotation.y += dt * 0.15;
    this.coreMat.uniforms.uHeat.value = 0.55 + Math.sin(t * 1.7) * 0.08;
    this.coreLight.intensity = 900 * (0.9 + Math.sin(t * 7) * 0.05 + Math.random() * 0.05);
    for (const r of this.rings) r.pivot.rotation.y += r.sp * dt;
    for (const arc of this.arcs) {
      if (Math.random() < 0.08) {
        const d1 = new THREE.Vector3().randomDirection().multiplyScalar(3.1); const d2 = d1.clone().normalize().multiplyScalar(5 + Math.random() * 2.4).add(new THREE.Vector3().randomDirection().multiplyScalar(0.8));
        arc.set(d1, d2, 0.9); arc.line.visible = true; arc.life = 0.06 + Math.random() * 0.1;
      }
      arc.life -= dt; if (arc.life <= 0) arc.line.visible = false;
    }
    this.dust.update(dt);
    while (this.dust.n < this.dust.max) this.spawnDust();
  }
  dispose() {
    const S = this.g.engine.scene; S.fog = this.prevFog || null; S.background = this.prevBg || null;
    disposeTree(this.root);
    this.g.engine.setFov(this.g.settings.fov);
  }
}

// lesson replay: a holographic void with a projector pedestal
export class HoloVoid {
  constructor(game) { this.g = game; this.root = new THREE.Group(); this.anchor = new THREE.Group(); }
  build() {
    const S = this.g.engine.scene; this.prevFog = S.fog; this.prevBg = S.background;
    S.fog = new THREE.FogExp2(0x02080c, 0.06); S.background = new THREE.Color(0x010406);
    this.root.position.set(0, 300, 0); S.add(this.root);
    const R = this.root;
    const grid = new THREE.GridHelper(60, 120, 0x1d6f80, 0x0b3540); grid.material.transparent = true; grid.material.opacity = 0.6; R.add(grid); grid.userData.ownMat = true;
    const ped = new THREE.Mesh(cylGeo(0.9, 1.1, 0.8, 40, 1), mat('darkmetal')); ped.position.y = 0.4; R.add(ped);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.03, 40), glow(0x62e6ff, 3)); top.position.y = 0.815; R.add(top);
    const ringM = holoMaterial(0x62e6ff, { opacity: 0.6, rim: 1, intensity: 1.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.01, 6, 120), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; R.add(ring); ring.userData.ownMat = true;
    this.anchor.position.set(0, 0.85, 0); R.add(this.anchor);
    R.add(new THREE.HemisphereLight(0x7fdfff, 0x05080a, 0.8));
    const l = new THREE.PointLight(0x62e6ff, 30, 12, 1.6); l.position.set(0, 3, 1); R.add(l);
    this.dust = new Particles(300, { size: 0.04, color: 0x9fefff, fadeIn: 0.3 }); R.add(this.dust.points);
  }
  update(dt) {
    this.dust.update(dt);
    while (this.dust.n < this.dust.max) { const r = Math.random() * 6, a = Math.random() * 6.28; this.dust.spawn(Math.cos(a) * r, Math.random() * 4, Math.sin(a) * r, 0, 0.05 + Math.random() * 0.1, 0, 4 + Math.random() * 6, 0.02 + Math.random() * 0.04); }
  }
  dispose() { const S = this.g.engine.scene; S.fog = this.prevFog || null; S.background = this.prevBg || null; disposeTree(this.root); }
}
