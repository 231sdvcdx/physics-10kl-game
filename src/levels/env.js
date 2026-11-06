// Procedural HDR environment (PMREM) — gives PBR metals believable reflections without external HDRI files
import * as THREE from 'three';
export function makeEnvironment(renderer, { warm = 0xff8a4a, cool = 0x62e6ff, base = 0x0a0c0f, warmI = 2.4, coolI = 1.4, top = 2.2 } = {}) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: base, side: THREE.BackSide })));
  const panel = (color, k, w, h, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  for (let i = -2; i <= 2; i++) panel(0xfff2e0, top, 1.2, 9, i * 4, 5.9, 0, Math.PI / 2, 0);
  panel(warm, warmI, 10, 4, 0, 1.5, -11.9);
  panel(warm, warmI * 0.5, 4, 2, -11.9, 3, 4, 0, Math.PI / 2);
  panel(cool, coolI, 5, 2.5, 11.9, 2.4, -2, 0, -Math.PI / 2);
  panel(cool, coolI * 0.6, 6, 1, 0, 0.6, 11.9, 0, Math.PI);
  panel(0x30343a, 1, 24, 24, 0, -5.9, 0, -Math.PI / 2, 0);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035);
  pm.dispose();
  s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
