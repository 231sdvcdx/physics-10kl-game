// Utilities: RNG, math, formatting, events, DOM helpers
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const DEG = Math.PI / 180;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export class Rng {
  constructor(seed) { this.r = mulberry32(seed); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  // value in [a,b] with step
  step(a, b, st) { const n = Math.round((b - a) / st); return +(a + st * Math.floor(this.r() * (n + 1))).toFixed(10); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.r()); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
}

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '' };
export const sup = s => String(s).split('').map(c => SUP[c] ?? c).join('');

// Russian number formatting with decimal comma
export function fmt(x, maxDigits = 4) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  const ax = Math.abs(x);
  if (ax !== 0 && (ax >= 1e6 || ax < 1e-3)) return fmtSci(x, maxDigits);
  let s = (+x.toPrecision(Math.max(1, maxDigits + (ax >= 1 ? Math.floor(Math.log10(ax)) : 0)))).toString();
  if (s.includes('e')) return fmtSci(x, maxDigits);
  // limit decimals
  const p = s.split('.');
  if (p[1] && p[1].length > maxDigits) s = (+x).toFixed(maxDigits).replace(/\.?0+$/, '');
  return s.replace('-', '−').replace('.', ',');
}
export function fmtFixed(x, d = 2) { return (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace('-', '−').replace('.', ','); }
export function fmtSci(x, digits = 3) {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  m = +m.toPrecision(digits);
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  const ms = String(m).replace('.', ',').replace('-', '−');
  return `${ms}·10${sup(e)}`;
}
// TeX number: 6,02\cdot10^{23}
export function texNum(x, digits = 3) {
  const ax = Math.abs(x);
  if (ax !== 0 && (ax >= 1e5 || ax < 1e-3)) {
    let e = Math.floor(Math.log10(ax)); let m = +(x / 10 ** e).toPrecision(digits);
    if (Math.abs(m) >= 10) { m /= 10; e++; }
    return `${String(m).replace('.', '{,}')}\\cdot10^{${e}}`;
  }
  return fmt(x, digits + 1).replace('−', '-').replace(',', '{,}');
}
// parse number typed by user: supports "6,02e23", "6,02·10^23", "6,02·10²³", "6.02*10^23", spaces
const SUPMAP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9, '⁻': '-', '⁺': '+' };
export function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  let t = String(s).trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/,/g, '.');
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, m => '^' + m.split('').map(c => SUPMAP[c]).join(''));
  t = t.replace(/^([+-]?(?:\d+\.?\d*|\.\d+))[×xх*·]10\^\(?([+-]?\d+)\)?$/i, '$1e$2');
  t = t.replace(/^([+-]?)10\^\(?([+-]?\d+)\)?$/, '$11e$2');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
  return parseFloat(t);
}
export const approxEq = (a, b, tol = 0.02) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (b === 0) return Math.abs(a) < 1e-9;
  return Math.abs(a - b) <= Math.abs(b) * tol;
};

export class Emitter {
  constructor() { this.h = {}; }
  on(e, f) { (this.h[e] ||= []).push(f); return () => this.off(e, f); }
  off(e, f) { this.h[e] = (this.h[e] || []).filter(x => x !== f); }
  emit(e, ...a) { (this.h[e] || []).slice().forEach(f => { try { f(...a); } catch (err) { console.error(err); } }); }
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) { if (c === null || c === undefined || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const wait = ms => new Promise(r => setTimeout(r, ms));
export function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
