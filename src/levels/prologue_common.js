// Общие константы и хелперы пролога (используются частями уровня)
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

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PI = Math.PI;
export const GAL = { x0: -8, x1: 8, z0: -3, z1: 3, H: 4.2 };
export const COR = { x0: 4.8, x1: 7.2, z0: 3, z1: 20.4, H: 3.2 };
export const ARC_ = { x0: 7.2, x1: 12, z0: 13.5, z1: 18.5, H: 3.0 };
export const CLS = { cx: 6, cz: 26, r: 6, H: 4.6 };
export const AIR = { x0: 13, x1: 25, z0: 21, z1: 31, H: 4.4, dx: 18.5 };
export const LFT = { x0: 27, x1: 37, z0: 20, z1: 32, H: 12.5, sx0: 30.5, sx1: 33.5, sz0: 24.5, sz1: 27.5 };
export const HALL = { cx: 0, cz: -26, r: 22 };
export const CORE = V(0, 1.2, -26);
export const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };


// yellow target used as a laser marker
export function markerTexture(letter) {
  return textTexture((x, W, H) => {
    x.clearRect(0, 0, W, H); const c = 'rgba(255,196,40,0.97)';
    x.fillStyle = c; x.beginPath(); x.arc(W / 2, H / 2, W * 0.47, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(W / 2, H / 2, W * 0.36, 0, 7); x.fill();
    x.fillStyle = c; x.beginPath(); x.arc(W / 2, H / 2, W * 0.24, 0, 7); x.fill();
    x.strokeStyle = '#111'; x.lineWidth = W * 0.025; x.beginPath(); x.moveTo(W / 2, H * 0.03); x.lineTo(W / 2, H * 0.97); x.moveTo(W * 0.03, H / 2); x.lineTo(W * 0.97, H / 2); x.stroke();
    x.fillStyle = '#111'; x.font = `${W * 0.2}px 'Russo One'`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(letter, W * 0.66, H * 0.34);
  }, 256, 256);
}
