// Rapier world wrapper
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
export { RAPIER };
let ready = null;
export function initRapier() { return ready ||= RAPIER.init(); }

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _e = new THREE.Euler();
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.dynamics = []; // {body, mesh}
    this.data = new Map(); // collider handle -> userData
  }
  _fixedBody(x, y, z, quat) {
    const d = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    return this.world.createRigidBody(d);
  }
  tag(collider, data) { if (data) this.data.set(collider.handle, data); return collider; }
  box(x, y, z, hx, hy, hz, opts = {}) {
    const b = this._fixedBody(x, y, z, opts.quat);
    const c = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(opts.friction ?? 0.7), b);
    return this.tag(c, opts.data || { surface: opts.surface || 'concrete' });
  }
  // box from a THREE mesh with a BoxGeometry (uses world transform)
  boxFromMesh(mesh, opts = {}) {
    mesh.updateWorldMatrix(true, false);
    const p = mesh.geometry.parameters; mesh.getWorldPosition(_v); mesh.getWorldQuaternion(_q);
    const s = new THREE.Vector3(); mesh.getWorldScale(s);
    return this.box(_v.x, _v.y, _v.z, p.width * s.x / 2, p.height * s.y / 2, p.depth * s.z / 2, { ...opts, quat: _q.clone() });
  }
  cylinder(x, y, z, r, h, opts = {}) {
    const b = this._fixedBody(x, y, z, opts.quat);
    const c = this.world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, r).setFriction(0.7), b);
    return this.tag(c, opts.data || { surface: opts.surface || 'metal' });
  }
  trimeshFromMesh(mesh, opts = {}) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.index ? mesh.geometry : mesh.geometry;
    const pos = g.attributes.position; const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); verts.set([_v.x, _v.y, _v.z], i * 3); }
    let idx = g.index ? new Uint32Array(g.index.array) : new Uint32Array(pos.count).map((_, i) => i);
    const b = this._fixedBody(0, 0, 0);
    const c = this.world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx), b);
    return this.tag(c, opts.data || { surface: opts.surface || 'concrete' });
  }
  dynamicBox(mesh, hx, hy, hz, mass = 10, opts = {}) {
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldPosition(_v); mesh.getWorldQuaternion(_q);
    const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(_v.x, _v.y, _v.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
      .setLinearDamping(opts.linDamp ?? 0.15).setAngularDamping(opts.angDamp ?? 0.4).setCanSleep(true);
    const b = this.world.createRigidBody(d);
    const cd = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setMass(mass).setFriction(opts.friction ?? 0.6).setRestitution(opts.restitution ?? 0.1);
    const c = this.world.createCollider(cd, b);
    this.tag(c, { surface: opts.surface || 'metal', dynamic: true, mass, ...(opts.data || {}) });
    const rec = { body: b, mesh, collider: c };
    this.dynamics.push(rec);
    return rec;
  }
  kinematicBox(x, y, z, hx, hy, hz, opts = {}) {
    const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const c = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.9), b);
    this.tag(c, opts.data || { surface: 'metal', platform: true });
    return { body: b, collider: c, prev: new THREE.Vector3(x, y, z), cur: new THREE.Vector3(x, y, z), delta: new THREE.Vector3() };
  }
  addCollider(body, desc, data) { const c = this.world.createCollider(desc, body); return this.tag(c, data); }
  remove(collider) { try { const b = collider.parent(); this.world.removeCollider(collider, true); if (b && b.numColliders() === 0) this.world.removeRigidBody(b); } catch (e) { } }
  step() {
    this.world.step();
    for (const d of this.dynamics) {
      if (d.body.isSleeping()) continue;
      const t = d.body.translation(), r = d.body.rotation();
      d.mesh.position.set(t.x, t.y, t.z); d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
  ray(origin, dir, max = 50, opts = {}) {
    const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
    const h = this.world.castRayAndGetNormal(ray, max, true, opts.flags, undefined, opts.excludeCollider, opts.excludeBody, opts.predicate);
    if (!h) return null;
    const toi = h.timeOfImpact;
    return { toi, point: new THREE.Vector3(origin.x + dir.x * toi, origin.y + dir.y * toi, origin.z + dir.z * toi), normal: new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z), collider: h.collider, data: this.data.get(h.collider.handle) || {} };
  }
  dispose() { try { this.world.free(); } catch (e) { } this.dynamics = []; this.data.clear(); }
}
