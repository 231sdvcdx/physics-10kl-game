// Crosshair interaction: raycast registered objects, outline highlight, prompt «[E] Взять калькулятор»
import * as THREE from 'three';

const _dir = new THREE.Vector3(), _c = new THREE.Vector2(0, 0);
export class Interactor {
  constructor(game) { this.g = game; this.list = []; this.ray = new THREE.Raycaster(); this.hover = null; this.ray.far = 6; }
  add(obj, def) { obj.userData.interact = def; def.obj = obj; this.list.push(obj); return def; }
  remove(obj) { this.list = this.list.filter(o => o !== obj); if (this.hover && this.hover.obj === obj) this.setHover(null); }
  clear() { this.list = []; this.setHover(null); }
  find(o) { while (o) { if (o.userData && o.userData.interact) return o.userData.interact; o = o.parent; } return null; }
  setHover(def) {
    if (def === this.hover) return;
    this.hover = def;
    const sel = this.g.engine.outline.selection;
    sel.clear();
    if (def) { const t = def.outline || def.obj; t.traverse(m => { if (m.isMesh && !m.userData.noOutline) sel.add(m); }); }
  }
  update() {
    const g = this.g;
    if (!g.canInteract()) { this.setHover(null); g.hud.setPrompt(''); return; }
    const cam = g.engine.camera;
    this.ray.setFromCamera(_c, cam);
    const vis = this.list.filter(o => o.visible && o.parent);
    const hits = this.ray.intersectObjects(vis, true);
    let def = null, dist = 0;
    for (const h of hits) {
      const d = this.find(h.object);
      if (!d) continue;
      if (h.distance > (d.range || 2.6)) break;
      if (d.enabled && !d.enabled()) break;
      def = d; dist = h.distance; break;
    }
    if (def) {
      // occlusion by world geometry
      cam.getWorldDirection(_dir);
      const r = g.physics.ray(cam.position, _dir, dist, { excludeCollider: g.player.collider });
      if (r && r.toi < dist - 0.25 && !(r.data && r.data.interactObj === def.obj)) def = null;
    }
    this.setHover(def);
    if (def) {
      const p = typeof def.prompt === 'function' ? def.prompt() : def.prompt;
      const sub = typeof def.sub === 'function' ? def.sub() : def.sub;
      g.hud.setPrompt(p, sub || '', def.key || 'E');
    } else g.hud.setPrompt('');
  }
  use() {
    const d = this.hover; if (!d) return false;
    if (d.enabled && !d.enabled()) return false;
    try { d.use(d); } catch (e) { console.error(e); }
    return true;
  }
}
