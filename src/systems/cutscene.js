// Scripted camera paths with letterbox, DOF and hold-to-skip
import * as THREE from 'three';
import { clamp, easeInOut, wait } from '../core/util.js';

const V = a => a && a.isVector3 ? a.clone() : new THREE.Vector3(...a);
export class Cutscene {
  constructor(game) { this.g = game; this.active = false; this.skipping = false; this.job = null; this.hold = 0; this.waits = new Set(); this.shakeAmt = 0; this.lastP = null; this.lastL = null; }
  begin({ letterbox = true, skippable = true } = {}) {
    const g = this.g; this.active = true; this.skippable = skippable; this.skipping = false; this.hold = 0;
    g.hud.show(false); g.hud.setLetterbox(letterbox); g.hud.showSkip(skippable);
    g.player.frozen = true; g.onUIChange();
  }
  end() {
    const g = this.g; this.active = false; this.job = null; this.shakeAmt = 0; this._shook = false; this.lastP = null;
    g.hud.show(true); g.hud.setLetterbox(false); g.hud.showSkip(false);
    g.engine.setDof(false); g.player.frozen = false;
    this.skipping = false;
    // sync player look with the camera direction so control resumes smoothly
    g.onUIChange();
  }
  // keys: [{p, l, fov}] ; Catmull-Rom on positions and look targets
  path(keys, dur, { ease = easeInOut, dof = null } = {}) {
    const ps = keys.map(k => V(k.p)), ls = keys.map(k => V(k.l));
    const cp = ps.length > 1 ? new THREE.CatmullRomCurve3(ps, false, 'centripetal') : null;
    const cl = ls.length > 1 ? new THREE.CatmullRomCurve3(ls, false, 'centripetal') : null;
    const fovs = keys.map(k => k.fov ?? null);
    return new Promise(res => {
      this.job = { t: 0, dur, cp, cl, p0: ps[0], l0: ls[0], ease, fovs, dof, res };
      if (this.skipping) this.finishJob();
    });
  }
  finishJob() { const j = this.job; if (!j) return; j.t = j.dur; this.apply(j, 1); this.job = null; j.res(); }
  apply(j, u) {
    const cam = this.g.engine.camera; const e = j.ease(clamp(u, 0, 1));
    const p = j.cp ? j.cp.getPoint(e) : j.p0; const l = j.cl ? j.cl.getPoint(e) : j.l0;
    cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(l); this.lastP = p.clone(); this.lastL = l.clone();
    const f = j.fovs.filter(x => x !== null);
    if (f.length) { const fi = e * (j.fovs.length - 1); const a = j.fovs[Math.floor(fi)] ?? f[0], b = j.fovs[Math.min(j.fovs.length - 1, Math.ceil(fi))] ?? a; cam.fov = a + (b - a) * (fi % 1); cam.updateProjectionMatrix(); }
    if (j.dof) this.g.engine.setDof(true, p.distanceTo(l), j.dof.range ?? 2, j.dof.bokeh ?? 3);
  }
  wait(sec) {
    if (this.skipping) return Promise.resolve();
    return new Promise(res => { const w = { left: sec, res }; this.waits.add(w); });
  }
  skipNow() {
    if (!this.active || this.skipping) return;
    this.skipping = true; this.g.dialogue.stop();
    this.finishJob();
    this.waits.forEach(w => w.res()); this.waits.clear();
    this.g.emit('cutskip');
  }
  update(dt) {
    for (const w of [...this.waits]) { w.left -= dt; if (w.left <= 0) { this.waits.delete(w); w.res(); } }
    if (!this.active) return;
    if (this.skippable && this.g.input.down.has('Space')) { this.hold += dt; if (this.hold > 0.7) this.skipNow(); } else this.hold = 0;
    const j = this.job;
    if (j) { j.t += dt; const u = j.t / j.dur; this.apply(j, u); if (u >= 1) { this.job = null; j.res(); } }
    // camera shake on top of the scripted pose
    if (this.lastP && (this.shakeAmt > 0 || this._shook)) {
      const cam = this.g.engine.camera, s = this.shakeAmt;
      cam.position.copy(this.lastP);
      if (s > 0) { cam.position.x += (Math.random() - .5) * s * 0.12; cam.position.y += (Math.random() - .5) * s * 0.12; cam.position.z += (Math.random() - .5) * s * 0.06; }
      cam.lookAt(this.lastL);
      this._shook = s > 0; this.shakeAmt = Math.max(0, s - dt * 0.9);
    }
  }
}
export const cwait = wait;
