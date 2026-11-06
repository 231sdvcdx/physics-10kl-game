// Material library + geometry helpers with world-scaled UVs
import * as THREE from 'three';
import { TexFactory } from './proctex.js';

let F = null; let SIZE = 1024;
const cache = {};
export function initMaterials(renderer, texSize = 1024) { F = new TexFactory(renderer); SIZE = texSize; }

function pbr(recipe, o = {}) {
  const t = F.make(recipe, { size: o.size || SIZE, color: o.color, color2: o.color2, seed: o.seed || 1, normal: o.normal || 4 });
  const m = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.orm, metalnessMap: t.orm, aoMap: t.orm,
    roughness: o.rough ?? 1, metalness: o.metal ?? 1, aoMapIntensity: o.ao ?? 1, envMapIntensity: o.env ?? 1,
    normalScale: new THREE.Vector2(o.ns ?? 1, o.ns ?? 1),
  });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
  return m;
}

const DEFS = {
  concrete:   () => pbr('concrete', { color: 0x8a8a86, normal: 3 }),
  concreteDk: () => pbr('concrete', { color: 0x5d5e5c, normal: 3, seed: 3 }),
  floor:      () => pbr('floor', { color: 0x575653, normal: 2 }),
  floorLt:    () => pbr('floor', { color: 0x7d7b75, normal: 2, seed: 5 }),
  panelGreen: () => pbr('panel', { color: 0x5c7469, normal: 5 }),
  panelBlue:  () => pbr('panel', { color: 0x4f6a7c, normal: 5, seed: 2 }),
  panelCream: () => pbr('panel', { color: 0xb9b19a, normal: 5, seed: 4 }),
  panelOrange:() => pbr('panel', { color: 0xb5622a, normal: 5, seed: 6 }),
  steel:      () => pbr('steel', { color: 0xa8acb0, normal: 2, env: 1.2 }),
  brass:      () => pbr('brass', { color: 0xd1a054, color2: 0x4a5a3c, normal: 2, env: 1.3 }),
  copper:     () => pbr('brass', { color: 0xd98a62, color2: 0x3d6b5c, normal: 2, seed: 7, env: 1.3 }),
  darkmetal:  () => pbr('darkmetal', { color: 0x2a2c2f, normal: 3 }),
  blackmetal: () => pbr('darkmetal', { color: 0x111214, normal: 3, seed: 9 }),
  tiles:      () => pbr('tiles', { color: 0xd8dcd2, color2: 0xa9c4c9, normal: 3 }),
  tilesBlue:  () => pbr('tiles', { color: 0x9fbcc4, color2: 0xd8dcd2, normal: 3, seed: 3 }),
  plate:      () => pbr('plate', { color: 0x6b6e72, normal: 3 }),
  hazard:     () => pbr('hazard', { color: 0xe0a91c, normal: 2 }),
  rubber:     () => pbr('rubber', { color: 0x161616, normal: 2 }),
  wood:       () => pbr('wood', { color: 0x6b4527, color2: 0x8a5d36, normal: 2 }),
  pipeRed:    () => pbr('paint', { color: 0x8f2a1d, normal: 3 }),
  pipeYellow: () => pbr('paint', { color: 0xb48a1e, normal: 3, seed: 3 }),
  pipeBlue:   () => pbr('paint', { color: 0x2c4f70, normal: 3, seed: 5 }),
  pipeGrey:   () => pbr('paint', { color: 0x6c6f6a, normal: 3, seed: 8 }),
};

export function mat(name) {
  if (cache[name]) return cache[name];
  if (DEFS[name]) return (cache[name] = DEFS[name]());
  throw new Error('unknown material ' + name);
}
export function glow(color, intensity = 4, opts = {}) {
  const key = `glow|${color}|${intensity}|${opts.transparent ? 1 : 0}|${opts.opacity ?? 1}`;
  if (cache[key]) return cache[key];
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return (cache[key] = new THREE.MeshBasicMaterial({ color: c, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: !opts.transparent, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: opts.side ?? THREE.FrontSide, fog: opts.fog ?? true }));
}
export function solid(color, rough = 0.6, metal = 0, extra = {}) {
  const key = `solid|${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (cache[key]) return cache[key];
  return (cache[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
}
export function glassMat() {
  if (cache.glass) return cache.glass;
  return (cache.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fc8d8, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1 }));
}

// ---- geometry with world-scaled UVs ----
export function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x,-x,+y,-y,+z,-z ; 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
  }
  uv.needsUpdate = true;
  return g;
}
export function cylGeo(rt, rb, h, seg = 24, tile = 1, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv; const circ = 2 * Math.PI * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile, uv.getY(i) * h / tile);
  uv.needsUpdate = true; return g;
}
export function planeGeo(w, h, tile = 2) {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  uv.needsUpdate = true; return g;
}
export function torusGeo(R, r, rs = 16, ts = 64, tile = 1) {
  const g = new THREE.TorusGeometry(R, r, rs, ts); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * R / tile, uv.getY(i) * 2 * Math.PI * r / tile);
  uv.needsUpdate = true; return g;
}

// Canvas text/sign texture
export function signTexture(lines, { w = 1024, h = 256, bg = '#1b1f22', fg = '#e8e2cf', font = 'Russo One', size = 120, border = null, align = 'center', glowColor = null, sub = null, subSize = 40 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  // subtle grime
  if (bg) { for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1 + Math.random() * 6); } }
  if (border) { x.strokeStyle = border; x.lineWidth = Math.max(4, h * 0.03); x.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); }
  x.fillStyle = fg; x.textAlign = align; x.textBaseline = 'middle';
  if (glowColor) { x.shadowColor = glowColor; x.shadowBlur = 24; }
  const arr = Array.isArray(lines) ? lines : [lines];
  const total = arr.length * size * 1.1 + (sub ? subSize * 1.4 : 0);
  let y = h / 2 - total / 2 + size * 0.55;
  for (const L of arr) { x.font = `${size}px '${font}'`; x.fillText(L, align === 'center' ? w / 2 : h * 0.15, y); y += size * 1.1; }
  if (sub) { x.font = `500 ${subSize}px 'IBM Plex Sans'`; x.globalAlpha = 0.8; x.fillText(sub, align === 'center' ? w / 2 : h * 0.15, y + subSize * 0.1); x.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function signMesh(lines, w, h, opts = {}) {
  const tex = signTexture(lines, { w: opts.pw || 1024, h: opts.ph || Math.round(1024 * h / w), ...opts });
  const m = opts.emissive ? new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(opts.emissive), transparent: !opts.bg, toneMapped: true })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1, transparent: !opts.bg });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  return mesh;
}
