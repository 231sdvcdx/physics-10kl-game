// Level construction helpers: boxes with colliders, walls with openings, pipes, lamps, signs, cables
import * as THREE from 'three';
import { mat, boxGeo, cylGeo, glow, signMesh } from '../core/materials.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();
export class Builder {
  constructor(game, root) { this.g = game; this.root = root; this.ph = game.physics; this.lights = []; this.anim = []; }
  M(m) { return typeof m === 'string' ? mat(m) : m; }
  mesh(geo, m, x = 0, y = 0, z = 0, o = {}) {
    const mesh = new THREE.Mesh(geo, this.M(m));
    mesh.position.set(x, y, z); if (o.rx || o.ry || o.rz) mesh.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    mesh.castShadow = o.cast ?? true; mesh.receiveShadow = o.receive ?? true;
    (o.parent || this.root).add(mesh);
    return mesh;
  }
  // box with optional collider; y is the CENTER unless o.base (then y = bottom)
  box(w, h, d, m, x, y, z, o = {}) {
    if (o.base) y += h / 2;
    const mesh = this.mesh(boxGeo(w, h, d, o.tile ?? 2), m, x, y, z, o);
    if (o.collide !== false) { const c = this.ph.boxFromMesh(mesh, { surface: o.surface || surfOf(m), data: o.data }); mesh.userData.collider = c; if (o.data && o.data.interactObj === true) o.data.interactObj = mesh; }
    return mesh;
  }
  collider(x, y, z, hx, hy, hz, o = {}) { return this.ph.box(x, y, z, hx, hy, hz, o); }
  cyl(rt, rb, h, m, x, y, z, o = {}) {
    const mesh = this.mesh(cylGeo(rt, rb, h, o.seg || 24, o.tile ?? 1, o.open), m, x, y, z, o);
    if (o.collide) { mesh.updateWorldMatrix(true, false); mesh.getWorldQuaternion(_q); this.ph.cylinder(x, y, z, Math.max(rt, rb), h, { quat: _q.clone(), surface: 'metal' }); }
    return mesh;
  }
  floor(x0, z0, x1, z1, y, m, o = {}) { const t = o.thick ?? 0.3; return this.box(Math.abs(x1 - x0), t, Math.abs(z1 - z0), m, (x0 + x1) / 2, y - t / 2, (z0 + z1) / 2, { tile: o.tile ?? 2, surface: o.surface, cast: false, ...o }); }
  ceil(x0, z0, x1, z1, y, m, o = {}) { const t = o.thick ?? 0.3; return this.box(Math.abs(x1 - x0), t, Math.abs(z1 - z0), m, (x0 + x1) / 2, y + t / 2, (z0 + z1) / 2, { cast: false, ...o }); }
  // axis-aligned wall from (x0,z0) to (x1,z1); openings: [{c: offset of center from start, w, h, y: sill}]
  wall(x0, z0, x1, z1, y0, H, m, o = {}) {
    const t = o.thick ?? 0.3; const alongX = Math.abs(z1 - z0) < 1e-6;
    const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sx = alongX ? Math.sign(x1 - x0) || 1 : 0, sz = alongX ? 0 : Math.sign(z1 - z0) || 1;
    const ops = (o.openings || []).slice().sort((a, b) => a.c - b.c);
    const seg = (a, b, ya, yb) => {
      const len = b - a, h = yb - ya; if (len <= 0.001 || h <= 0.001) return;
      const mid = (a + b) / 2; const cx = x0 + sx * mid, cz = z0 + sz * mid;
      if (alongX) this.box(len, h, t, m, cx, y0 + (ya + yb) / 2, cz, { tile: o.tile, cast: o.cast ?? false, surface: o.surface });
      else this.box(t, h, len, m, cx, y0 + (ya + yb) / 2, cz, { tile: o.tile, cast: o.cast ?? false, surface: o.surface });
    };
    let cur = 0;
    for (const op of ops) {
      const a = op.c - op.w / 2, b = op.c + op.w / 2;
      seg(cur, a, 0, H);
      seg(a, b, (op.y || 0) + op.h, H); // lintel
      if (op.y) seg(a, b, 0, op.y); // sill
      cur = b;
    }
    seg(cur, L, 0, H);
  }
  // pipe along polyline points [[x,y,z],...]
  pipe(pts, r, m, o = {}) {
    const P = pts.map(p => new THREE.Vector3(...p));
    const g = new THREE.Group(); (o.parent || this.root).add(g);
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1]; const L = a.distanceTo(b);
      const mesh = new THREE.Mesh(cylGeo(r, r, L, 14, 0.6), this.M(m));
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.copy(b).sub(a).normalize());
      mesh.castShadow = o.cast ?? true; mesh.receiveShadow = true; g.add(mesh);
      // flanges
      if (o.flanges !== false) for (const t of [0.08, 0.92]) { if (L < 1.2) continue; const f = new THREE.Mesh(cylGeo(r * 1.35, r * 1.35, 0.06, 14, 0.3), mat('steel')); f.position.lerpVectors(a, b, t); f.quaternion.copy(mesh.quaternion); g.add(f); }
    }
    for (let i = 1; i < P.length - 1; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 14, 10), this.M(m)); s.position.copy(P[i]); g.add(s); }
    return g;
  }
  // hanging cable (catenary-like sag)
  cable(a, b, sag = 0.4, r = 0.015, color = 0x111111, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const mid = A.clone().add(B).multiplyScalar(0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, r, 6, false), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    m.castShadow = true; (o.parent || this.root).add(m); return m;
  }
  light(kind, color, intensity, x, y, z, o = {}) {
    let L;
    const q = this.g.engine.q;
    if (kind === 'point') L = new THREE.PointLight(color, intensity * (q.lights ?? 1), o.distance ?? 12, o.decay ?? 1.6);
    else if (kind === 'spot') { L = new THREE.SpotLight(color, intensity * (q.lights ?? 1), o.distance ?? 20, o.angle ?? 0.7, o.penumbra ?? 0.6, o.decay ?? 1.4); L.target.position.set(...(o.target || [x, 0, z])); (o.parent || this.root).add(L.target); }
    L.position.set(x, y, z);
    if (o.shadow) { L.userData.shadowCandidate = o.shadow; L.castShadow = q.shadows && (o.shadow !== 'high' || this.g.engine.quality === 'high' || this.g.engine.quality === 'ultra'); L.shadow.mapSize.set(q.shadowSize, q.shadowSize); L.shadow.bias = o.bias ?? -0.0005; L.shadow.normalBias = 0.03; L.shadow.camera.near = 0.3; L.shadow.camera.far = o.distance ?? 20; }
    L.userData.base = intensity * (q.lights ?? 1);
    (o.parent || this.root).add(L); this.lights.push(L);
    return L;
  }
  // ceiling lamp fixture (emissive strip) with optional light
  lamp(x, y, z, { color = 0xfff1dc, w = 1.4, d = 0.22, intensity = 0, distance = 9, ry = 0, emissive = 3.5, light = 'point', shadow = false } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.root.add(g);
    const house = new THREE.Mesh(boxGeo(w + 0.12, 0.1, d + 0.12, 1), mat('darkmetal')); house.position.y = 0.05; g.add(house);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), glow(color, emissive)); tube.position.y = -0.01; g.add(tube);
    let L = null;
    if (intensity > 0) { L = light === 'spot' ? this.light('spot', color, intensity, x, y - 0.1, z, { target: [x, y - 5, z], angle: 1.1, penumbra: 0.8, distance, shadow }) : this.light('point', color, intensity, x, y - 0.25, z, { distance }); }
    return { group: g, tube, light: L };
  }
  sign(lines, w, h, x, y, z, ry = 0, opts = {}) {
    const m = signMesh(lines, w, h, opts); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; (opts.parent || this.root).add(m); return m;
  }
}
function surfOf(m) {
  if (typeof m !== 'string') return 'concrete';
  if (/steel|plate|darkmetal|blackmetal|brass|copper|hazard/.test(m)) return 'metal';
  if (/tiles/.test(m)) return 'tile';
  return 'concrete';
}
