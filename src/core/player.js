// First-person controller on Rapier KinematicCharacterController
import * as THREE from 'three';
import { RAPIER } from './physics.js';
import { clamp, damp, DEG } from './util.js';

const _v = new THREE.Vector3();
export class Player {
  constructor(game) {
    this.g = game;
    const ph = game.physics;
    this.radius = 0.32; this.halfH = 0.58; this.eye = 1.62;
    this.body = ph.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, this.halfH + this.radius, 0));
    this.collider = ph.world.createCollider(RAPIER.ColliderDesc.capsule(this.halfH, this.radius).setFriction(0), this.body);
    ph.tag(this.collider, { player: true });
    const cc = this.cc = ph.world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.enableAutostep(0.36, 0.18, false);
    cc.enableSnapToGround(0.3);
    cc.setMaxSlopeClimbAngle(50 * DEG);
    cc.setMinSlopeSlideAngle(40 * DEG);
    cc.setApplyImpulsesToDynamicBodies(true);
    cc.setCharacterMass(70);
    this.center = new THREE.Vector3(0, this.halfH + this.radius, 0);
    this.prevCenter = this.center.clone();
    this.vel = new THREE.Vector3(); this.vy = 0; this.grounded = false; this.wasGrounded = false;
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.phase = 0; this.bobY = 0; this.bobX = 0; this.landDip = 0; this.landV = 0;
    this.frozen = false; this.jumpQueued = false;
    this.speedWalk = 3.0; this.speedRun = 5.3; this.jumpV = 4.2;
    this.ground = null; this.platform = null;
    this.camOffset = new THREE.Vector3();
    this.shake = 0;
  }
  get feet() { return _v.copy(this.center).setY(this.center.y - this.halfH - this.radius); }
  teleport(x, y, z, yaw = this.yaw, pitch = 0) {
    this.center.set(x, y + this.halfH + this.radius, z); this.prevCenter.copy(this.center);
    this.body.setTranslation({ x: this.center.x, y: this.center.y, z: this.center.z }, true);
    this.body.setNextKinematicTranslation({ x: this.center.x, y: this.center.y, z: this.center.z });
    this.yaw = yaw; this.pitch = pitch; this.vel.set(0, 0, 0); this.vy = 0;
  }
  look(dx, dy, sens) {
    this.yaw -= dx * sens; this.pitch -= dy * sens;
    this.pitch = clamp(this.pitch, -1.52, 1.52);
  }
  fixedUpdate(dt, input) {
    const ph = this.g.physics;
    this.prevCenter.copy(this.center);
    // ride moving platforms: the level has already moved the platform this step (delta), carry the player with it
    const pd = this.platform && this.platform.delta;
    if (pd && pd.lengthSq() > 1e-12) {
      this.center.add(pd);
      this.body.setTranslation({ x: this.center.x, y: this.center.y, z: this.center.z }, true);
      ph.world.propagateModifiedBodyPositionsToColliders();
    }
    let f = 0, s = 0, run = false;
    if (!this.frozen) {
      f = (input.is('forward') ? 1 : 0) - (input.is('back') ? 1 : 0);
      s = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
      run = input.is('sprint');
    }
    const sp = run ? this.speedRun : this.speedWalk;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * f + cy * s, wz = -cy * f - sy * s;
    const len = Math.hypot(wx, wz); if (len > 1e-4) { wx = wx / len * sp; wz = wz / len * sp; }
    const acc = this.grounded ? 12 : 2.5;
    this.vel.x = damp(this.vel.x, wx, acc, dt); this.vel.z = damp(this.vel.z, wz, acc, dt);
    if (this.grounded) {
      if (this.jumpQueued && !this.frozen) { this.vy = this.jumpV; this.grounded = false; this.g.audio?.sfx('jump'); }
      else this.vy = -1.5;
    } else this.vy = Math.max(-30, this.vy - 9.81 * dt);
    this.jumpQueued = false;
    const desired = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = this.cc.computedMovement();
    this.center.x += m.x; this.center.y += m.y; this.center.z += m.z;
    this.body.setNextKinematicTranslation({ x: this.center.x, y: this.center.y, z: this.center.z });
    this.wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded();
    if (this.vy > 0 && m.y < desired.y * 0.3 && desired.y > 0.001) this.vy = 0; // bonk
    if (this.grounded && !this.wasGrounded && this.landV < -3.5) { this.landDip = Math.min(0.12, -this.landV * 0.02); this.g.audio?.footstep(this.ground?.surface, 1.4); }
    this.landV = this.vy;
    // ground probe
    const hit = ph.ray({ x: this.center.x, y: this.center.y, z: this.center.z }, { x: 0, y: -1, z: 0 }, this.halfH + this.radius + 0.25, { excludeCollider: this.collider });
    this.ground = hit ? hit.data : null;
    this.platform = hit && hit.data && hit.data.platformRef ? hit.data.platformRef : null;
    if (!this.grounded && !hit) this.platform = null;
    this.hspeed = Math.hypot(m.x, m.z) / dt;
    // safety: fell out of the world
    if (this.center.y < -40 && this.g.level && this.g.level.respawn) this.g.level.respawn();
  }
  updateCamera(cam, dt, alpha, bobScale = 1) {
    const c = _v.lerpVectors(this.prevCenter, this.center, alpha);
    const moving = this.grounded && this.hspeed > 0.4;
    const fr = (this.hspeed || 0);
    if (moving) {
      const prevPhase = this.phase;
      this.phase += dt * fr * 2.05;
      if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.phase / Math.PI)) this.g.audio?.footstep(this.ground?.surface, fr > 4 ? 1.15 : 0.8);
    }
    const amp = moving ? (fr > 4 ? 0.055 : 0.032) * bobScale : 0;
    this.bobY = damp(this.bobY, -Math.abs(Math.sin(this.phase)) * amp, 18, dt);
    this.bobX = damp(this.bobX, Math.cos(this.phase) * amp * 0.6, 18, dt);
    this.landDip = damp(this.landDip, 0, 6, dt);
    this.roll = damp(this.roll, moving ? Math.cos(this.phase) * 0.006 * bobScale : 0, 8, dt);
    const eyeY = c.y - this.halfH - this.radius + this.eye + this.bobY - this.landDip;
    cam.position.set(c.x, eyeY, c.z);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    cam.position.x += cy * this.bobX; cam.position.z += -sy * this.bobX;
    if (this.shake > 0) { cam.position.x += (Math.random() - .5) * this.shake * 0.08; cam.position.y += (Math.random() - .5) * this.shake * 0.08; this.shake = Math.max(0, this.shake - dt * 1.5); }
    cam.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }
}
