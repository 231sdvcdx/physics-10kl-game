// Engineering calculator: token editor, safe recursive-descent evaluator, deg/rad, EXP, history, keyboard
import { el, escapeHtml } from '../core/util.js';
import { CONSTANTS } from '../content/constants.js';

const FN = { 'sin(': 'sin', 'cos(': 'cos', 'tg(': 'tg', 'arcsin(': 'arcsin', 'arccos(': 'arccos', 'arctg(': 'arctg', '√(': 'sqrt', '∛(': 'cbrt', 'lg(': 'lg', 'ln(': 'ln', '10^(': 'pow10' };
const isDigit = t => /^[0-9.]$/.test(t);

export function calcFormat(x) {
  if (!Number.isFinite(x)) return null;
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e9 || ax < 1e-4) {
    let e = Math.floor(Math.log10(ax)); let m = +(x / 10 ** e).toPrecision(7);
    if (Math.abs(m) >= 10) { m /= 10; e++; }
    return `${String(m).replace('.', ',').replace('-', '−')}·10^${e}`;
  }
  return String(+x.toPrecision(10)).replace('.', ',').replace('-', '−');
}
export function calcHtml(s) { return escapeHtml(s).replace(/·10\^(−?-?\d+)/, (_, e) => `·10<sup>${e.replace('-', '−')}</sup>`); }

class Parser {
  constructor(tokens, deg, ans) { this.t = tokens; this.i = 0; this.deg = deg; this.ans = ans; }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
  err(m) { throw new Error(m); }
  parse() { const v = this.expr(); if (this.i < this.t.length) { if (this.peek() === ')') this.err('Лишняя скобка «)»'); this.err('Ошибка в выражении'); } return v; }
  expr() {
    let v = this.term();
    while (this.peek() === '+' || this.peek() === '−') { const o = this.next(); const r = this.term(); v = o === '+' ? v + r : v - r; }
    return v;
  }
  startsPrimary(t) { return t !== undefined && (isDigit(t) || t === '(' || t === 'π' || t === 'e' || t === 'Ans' || FN[t] || t.startsWith('c:')); }
  term() {
    let v = this.unary();
    for (; ;) {
      const p = this.peek();
      if (p === '×' || p === '÷') { this.next(); const r = this.unary(); if (p === '÷' && r === 0) this.err('Деление на ноль'); v = p === '×' ? v * r : v / r; }
      else if (this.startsPrimary(p)) { v *= this.power(); } // implicit multiplication: 2π, 3(4+1)
      else break;
    }
    return v;
  }
  unary() { const p = this.peek(); if (p === '−') { this.next(); return -this.unary(); } if (p === '+') { this.next(); return this.unary(); } return this.power(); }
  power() {
    const b = this.postfix();
    if (this.peek() === '^') { this.next(); const e = this.unary(); return Math.pow(b, e); }
    return b;
  }
  postfix() {
    let v = this.primary();
    for (; ;) { const p = this.peek(); if (p === '²') { this.next(); v = v * v; } else if (p === '³') { this.next(); v = v * v * v; } else if (p === '⁻¹') { this.next(); if (v === 0) this.err('Деление на ноль'); v = 1 / v; } else break; }
    return v;
  }
  number() {
    let s = '';
    while (this.peek() !== undefined && isDigit(this.peek())) s += this.next();
    if (this.peek() === 'E') {
      this.next(); let es = '';
      if (this.peek() === '−') { this.next(); es = '-'; } else if (this.peek() === '+') this.next();
      let d = ''; while (this.peek() !== undefined && /^[0-9]$/.test(this.peek())) d += this.next();
      if (!d) this.err('После EXP нужен порядок');
      s += 'e' + es + d;
    }
    if ((s.match(/\./g) || []).length > 1) this.err('Две запятые в числе');
    const v = parseFloat(s.startsWith('.') ? '0' + s : s); if (Number.isNaN(v)) this.err('Ошибка в числе'); return v;
  }
  primary() {
    const p = this.peek();
    if (p === undefined) this.err('Выражение не закончено');
    if (isDigit(p)) return this.number();
    if (p === 'E') { this.next(); this.i--; this.t.splice(this.i, 0, '1'); return this.number(); }
    if (p === 'π') { this.next(); return Math.PI; }
    if (p === 'e') { this.next(); return Math.E; }
    if (p === 'Ans') { this.next(); return this.ans; }
    if (p.startsWith('c:')) { this.next(); return +p.slice(2); }
    if (p === '(') { this.next(); const v = this.expr(); if (this.peek() === ')') this.next(); return v; }
    if (FN[p]) {
      this.next(); const a = this.expr(); if (this.peek() === ')') this.next();
      const k = this.deg ? Math.PI / 180 : 1;
      const r = { sin: () => Math.sin(a * k), cos: () => Math.cos(a * k), tg: () => { const c = Math.cos(a * k); if (Math.abs(c) < 1e-12) this.err('tg не определён'); return Math.tan(a * k); },
        arcsin: () => Math.asin(a) / k, arccos: () => Math.acos(a) / k, arctg: () => Math.atan(a) / k, sqrt: () => { if (a < 0) this.err('Корень из отрицательного числа'); return Math.sqrt(a); },
        cbrt: () => Math.cbrt(a), lg: () => Math.log10(a), ln: () => Math.log(a), pow10: () => Math.pow(10, a) }[FN[p]]();
      // clean float noise: sin(180°) = 0
      return Math.abs(r) < 1e-13 ? 0 : r;
    }
    this.err('Ошибка в выражении');
  }
}

export function evaluate(tokens, deg = true, ans = 0) {
  const toks = tokens.slice();
  // auto-close parentheses
  let bal = 0; for (const t of toks) { if (t === '(' || FN[t]) bal++; if (t === ')') bal--; }
  while (bal-- > 0) toks.push(')');
  const v = new Parser(toks, deg, ans).parse();
  if (Number.isNaN(v)) throw new Error('Вне области определения');
  if (!Number.isFinite(v)) throw new Error('Слишком большое число');
  return v;
}

const KEYS = [
  ['mode', 'DEG', 'fn'], ['sin(', 'sin', 'fn'], ['cos(', 'cos', 'fn'], ['tg(', 'tg', 'fn'], ['π', 'π', 'fn'], ['AC', 'AC', 'op'],
  ['arcsin(', 'arcsin', 'fn'], ['arccos(', 'arccos', 'fn'], ['arctg(', 'arctg', 'fn'], ['lg(', 'lg', 'fn'], ['ln(', 'ln', 'fn'], ['DEL', 'DEL', 'op'],
  ['²', 'x²', 'fn'], ['³', 'x³', 'fn'], ['^', 'xʸ', 'fn'], ['√(', '√x', 'fn'], ['∛(', '∛x', 'fn'], ['⁻¹', 'x⁻¹', 'fn'],
  ['7', '7', 'n'], ['8', '8', 'n'], ['9', '9', 'n'], ['(', '(', 'op'], [')', ')', 'op'], ['÷', '÷', 'op'],
  ['4', '4', 'n'], ['5', '5', 'n'], ['6', '6', 'n'], ['E', 'EXP', 'fn'], ['Ans', 'Ans', 'fn'], ['×', '×', 'op'],
  ['1', '1', 'n'], ['2', '2', 'n'], ['3', '3', 'n'], ['10^(', '10ˣ', 'fn'], ['const', 'конст', 'fn'], ['−', '−', 'op'],
  ['0', '0', 'n'], ['.', ',', 'n'], ['left', '◀', 'op'], ['right', '▶', 'op'], ['e', 'e', 'fn'], ['+', '+', 'op'],
];

export class Calculator {
  constructor(game, root) {
    this.g = game; this.open = false;
    this.tokens = []; this.cur = 0; this.deg = true; this.ans = 0; this.last = null; this.hist = [];
    this.el = el('div', { id: 'calc', class: 'panel interactive hidden' });
    root.append(this.el);
    this.build();
    addEventListener('keydown', e => this.onKey(e), { capture: true });
  }
  build() {
    const e = this.el; e.innerHTML = '';
    const head = el('div', { class: 'ph' }, el('span', {}, 'Калькулятор'), el('span', { class: 'sub' }, 'инженерный'), el('span', { class: 'x', style: { cursor: 'pointer' }, onclick: () => this.toggle(false) }, '[C] закрыть'));
    this.exprEl = el('div', { class: 'expr' }); this.resEl = el('div', { class: 'res' });
    this.modeEl = el('div', { class: 'mode' });
    const keys = el('div', { class: 'keys' });
    for (const [k, label, cls] of KEYS) {
      const b = el('button', { class: cls, 'data-k': k, onmousedown: ev => { ev.preventDefault(); this.press(k); b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 120); } }, label);
      if (k === 'mode') this.modeBtn = b;
      keys.append(b);
    }
    const eq = el('button', { class: 'eq', style: { gridColumn: 'span 4' }, onmousedown: ev => { ev.preventDefault(); this.press('='); } }, '=');
    this.toAns = el('button', { class: 'fn', style: { gridColumn: 'span 2' }, title: 'Вставить результат в поле ответа задачи', onmousedown: ev => { ev.preventDefault(); this.sendToAnswer(); } }, '→ в ответ');
    keys.append(eq, this.toAns);
    this.constMenu = el('div', { class: 'panel hidden', style: { right: '100%', bottom: '0', width: '300px', marginRight: '8px', padding: '8px', maxHeight: '60vh', overflow: 'auto' } });
    this.histEl = el('div', { class: 'hist scroll' });
    e.append(el('div', { class: 'scan' }), head, el('div', { class: 'disp' }, this.exprEl, this.resEl), this.modeEl, keys, this.histEl, this.constMenu);
    this.render();
  }
  toggle(on = !this.open) {
    if (on === this.open) return;
    if (on && !this.g.save?.items?.includes('calculator') && this.g.state === 'play') { this.g.hud.toast('Калькулятор', 'Калькулятора пока нет — найдите его.', 'red', 2.5); return; }
    this.open = on; this.el.classList.toggle('hidden', !on);
    this.constMenu.classList.add('hidden');
    this.g.audio.sfx(on ? 'open' : 'close');
    if (on) this.el.animate([{ opacity: 0, transform: 'translateY(-50%) translateX(30px)' }, { opacity: 1, transform: 'translateY(-50%)' }], { duration: 220, easing: 'ease-out' });
    this.g.onUIChange();
    this.render();
  }
  insert(tok) { this.tokens.splice(this.cur, 0, tok); this.cur++; }
  press(k) {
    this.g.audio.sfx('click', { vol: 0.6 });
    if (k === 'mode') { this.deg = !this.deg; this.render(); return; }
    if (k === 'AC') { this.tokens = []; this.cur = 0; this.last = null; this.error = null; this.render(); return; }
    if (k === 'DEL') { if (this.cur > 0) { this.tokens.splice(this.cur - 1, 1); this.cur--; } this.error = null; this.render(); return; }
    if (k === 'left') { this.cur = Math.max(0, this.cur - 1); this.render(); return; }
    if (k === 'right') { this.cur = Math.min(this.tokens.length, this.cur + 1); this.render(); return; }
    if (k === 'const') { this.showConsts(); return; }
    if (k === '=') { this.compute(); return; }
    // after a result, typing an operator continues from Ans; typing a number starts fresh
    if (this.justComputed) {
      this.justComputed = false;
      if (['+', '−', '×', '÷', '^', '²', '³', '⁻¹'].includes(k)) { this.tokens = ['Ans']; this.cur = 1; }
      else { this.tokens = []; this.cur = 0; }
    }
    this.error = null;
    this.insert(k); this.render();
  }
  compute() {
    if (!this.tokens.length) return;
    try {
      const v = evaluate(this.tokens, this.deg, this.ans);
      this.ans = v; this.last = v; this.error = null;
      this.hist.unshift({ expr: this.display(this.tokens), v, deg: this.deg });
      this.hist = this.hist.slice(0, 30);
      this.justComputed = true;
      this.g.emit('calc', v);
    } catch (e) { this.error = e.message; this.g.audio.sfx('error'); }
    this.render();
  }
  display(tokens, cursor = -1) {
    let out = ''; let inExp = false;
    const closeExp = () => { if (inExp) { out += '</sup>'; inExp = false; } };
    tokens.forEach((t, i) => {
      if (i === cursor) out += '<span class="cur"></span>';
      if (inExp && !(/^[0-9]$/.test(t) || (t === '−' && tokens[i - 1] === 'E'))) closeExp();
      if (t === 'E') { out += '·10<sup>'; inExp = true; return; }
      if (t.startsWith('c:')) { const c = CONSTANTS.find(c => String(c.num) === t.slice(2)); out += escapeHtml(c ? c.tex.replace(/\\/g, '').replace(/_\{?([^}]*)\}?/, '$1') : 'конст'); return; }
      const map = { '.': ',', '×': '×', '÷': '÷', '−': '−', '^': '^' };
      out += escapeHtml(map[t] ?? t);
    });
    closeExp();
    if (cursor === tokens.length) out += '<span class="cur"></span>';
    return out;
  }
  render() {
    if (!this.exprEl) return;
    this.exprEl.innerHTML = this.display(this.tokens, this.open ? this.cur : -1) || '<span class="muted">введите выражение</span>';
    this.resEl.classList.toggle('err', !!this.error);
    this.resEl.innerHTML = this.error ? escapeHtml(this.error) : (this.last !== null ? '= ' + calcHtml(calcFormat(this.last)) : '');
    this.modeEl.innerHTML = `<span>углы: <b>${this.deg ? 'градусы' : 'радианы'}</b></span><span>Ans = ${calcHtml(calcFormat(this.ans) || '0')}</span>`;
    if (this.modeBtn) this.modeBtn.textContent = this.deg ? 'DEG' : 'RAD';
    this.histEl.innerHTML = '';
    for (const h of this.hist) {
      this.histEl.append(el('div', { class: 'h', title: 'Вставить значение в выражение', onclick: () => this.insertValue(h.v) }, el('span', { html: h.expr }), el('span', { html: '= ' + calcHtml(calcFormat(h.v)) })));
    }
    const pb = this.g.problems;
    this.toAns.disabled = !(pb && pb.canReceiveAnswer && pb.canReceiveAnswer()) || this.last === null;
  }
  insertValue(v) {
    if (this.justComputed) { this.tokens = []; this.cur = 0; this.justComputed = false; }
    const s = calcFormat(v).replace('−', '-');
    const m = s.match(/^(-?[\d,]+)(?:·10\^(-?\d+))?$/);
    if (!m) return;
    if (m[1].startsWith('-')) this.insert('−');
    for (const ch of m[1].replace('-', '')) this.insert(ch === ',' ? '.' : ch);
    if (m[2]) { this.insert('E'); for (const ch of m[2]) this.insert(ch === '-' ? '−' : ch); }
    this.g.audio.sfx('click'); this.render();
  }
  showConsts() {
    const m = this.constMenu; m.innerHTML = '';
    const known = this.g.save ? this.g.unlockedConstants() : CONSTANTS;
    m.append(el('div', { class: 'muted', style: { fontSize: '.8em', margin: '2px 4px 6px' } }, 'Вставить константу (открытые в блокноте):'));
    for (const c of CONSTANTS) {
      const ok = known.includes(c);
      m.append(el('div', { class: 'fchip', style: { margin: '4px', opacity: ok ? 1 : 0.35, cursor: ok ? 'pointer' : 'default' }, onclick: () => { if (!ok) return; this.insertValue(c.num); m.classList.add('hidden'); } }, ok ? `${c.name}: ${calcFormat(c.num)} ${c.unit}` : `??? (${c.ref})`));
    }
    m.classList.toggle('hidden');
  }
  sendToAnswer() {
    if (this.last === null) return;
    const pb = this.g.problems; if (!pb || !pb.receiveAnswer) return;
    pb.receiveAnswer(calcFormat(this.last).replace('−', '-'));
    this.g.audio.sfx('pickup', { vol: 0.5 });
  }
  onKey(e) {
    if (!this.open) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const c = e.code, k = e.key;
    let tok = null;
    if (/^Digit[0-9]$/.test(c) && !e.shiftKey) tok = c.slice(5);
    else if (/^Numpad[0-9]$/.test(c)) tok = c.slice(6);
    else if (c === 'Period' || c === 'Comma' || c === 'NumpadDecimal' || k === ',' || k === '.') tok = '.';
    else if (k === '+' || c === 'NumpadAdd') tok = '+';
    else if (k === '-' || c === 'Minus' || c === 'NumpadSubtract') tok = '−';
    else if (k === '*' || c === 'NumpadMultiply') tok = '×';
    else if (k === '/' || c === 'Slash' || c === 'NumpadDivide') tok = '÷';
    else if (k === '^') tok = '^';
    else if (k === '(') tok = '('; else if (k === ')') tok = ')';
    else if (c === 'Enter' || c === 'NumpadEnter' || k === '=') tok = '=';
    else if (c === 'Backspace') tok = 'DEL'; else if (c === 'Delete') tok = 'AC';
    else if (c === 'ArrowLeft') tok = 'left'; else if (c === 'ArrowRight') tok = 'right';
    else if (c === 'KeyE') tok = 'E'; else if (c === 'KeyP') tok = 'π'; else if (c === 'KeyR') tok = '√(';
    else if (c === 'KeyS') tok = 'sin('; else if (c === 'KeyO') tok = 'cos(';
    if (tok) { e.preventDefault(); e.stopPropagation(); this.press(tok); const b = this.el.querySelector(`button[data-k="${CSS.escape(tok)}"]`); if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 120); } }
  }
}
