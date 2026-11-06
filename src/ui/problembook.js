// Problem notebook (T): school format Дано → СИ → Найти → Формулы → Решение → Ответ; hints; typical errors; stars; PDF export
import { el, escapeHtml, parseNum, approxEq, fmt } from '../core/util.js';
import { topicStats } from '../core/save.js';
import { panel } from './ui.js';
import { tex, rich } from './tex.js';
import { FORMULAS } from '../content/formulas.js';

const near = (a, b, tol = 0.02) => approxEq(a, b, tol);
const DIFF = {
  novice: { tol: 0.02, siRequired: true, siHint: true, distract: 1, maxHint: 3, hintCost: 0 },
  student: { tol: 0.02, siRequired: true, siHint: false, distract: 3, maxHint: 3, hintCost: 1 },
  olymp: { tol: 0.01, siRequired: false, siHint: false, distract: 99, maxHint: 2, hintCost: 1 },
};

export class ProblemBook {
  constructor(game) { this.g = game; this.sel = null; this.atPanel = null; this.answerInput = null; }
  get defs() { return this.g.problemDefs || {}; }
  diff() { return DIFF[this.g.save?.difficulty] || DIFF.student; }
  st(id) { return (this.g.save.problems[id] ||= { status: 'open', attempts: 0, wrong: 0, hints: 0, si: {}, chips: [], draft: '', answer: '', unit: '', log: [] }); }
  vars(id) { return this.g.problemVars(id); }
  toggle() {
    const ui = this.g.ui;
    if (ui.isOpen('problems')) { ui.close('problems'); return; }
    if (this.g.state === 'play' && !this.g.save.items.includes('problems')) { this.g.hud.toast('Тетрадь задач', 'Тетрадь лежит в рюкзаке — сначала найдите рюкзак.', 'red', 2.5); return; }
    this.open(null, null);
  }
  open(id = null, panelId = null) {
    this.atPanel = panelId ? id : null;
    const list = this.list();
    if (id) this.sel = id; else if (!this.sel || !list.includes(this.sel)) this.sel = list.find(i => this.st(i).status !== 'solved') || list[list.length - 1] || null;
    this.root = el('div', { class: 'pb' });
    const p = panel({ title: 'Тетрадь задач', sub: 'физический протокол комплекса', style: { left: '2.5vw', top: '50%', transform: 'translateY(-50%)', width: this.g.calc.open ? 'calc(95vw - 380px)' : 'min(1180px,95vw)', height: 'min(800px,92vh)', display: 'flex', flexDirection: 'column' }, closeKey: 'T/Esc', onClose: () => this.g.ui.close('problems') }, this.root);
    this.panelEl = p;
    this.g.ui.open('problems', p, { onClose: () => { this.answerInput = null; this.atPanel = null; this.g.calc.render(); } });
    this.render();
  }
  list() { return Object.keys(this.g.save?.problems || {}).filter(id => this.defs[id] && this.g.save.problems[id].status !== 'locked'); }
  render() {
    const r = this.root; if (!r) return; r.innerHTML = '';
    const list = el('div', { class: 'list scroll' });
    const ids = this.list();
    for (const id of ids) {
      const d = this.defs[id], s = this.st(id);
      list.append(el('div', { class: 'it' + (id === this.sel ? ' on' : ''), onclick: () => { this.sel = id; this.g.audio.sfx('page'); this.render(); } },
        el('div', { class: 't' }, d.title), el('div', { class: 's' }, el('span', {}, d.where || ''), el('span', { html: s.status === 'solved' ? this.starsHtml(s.stars) : (s.attempts ? `попыток: ${s.attempts}` : 'не решена') }))));
    }
    list.append(el('div', { style: { padding: '12px 14px' } }, el('button', { class: 'btn small ghost', onclick: () => this.exportPdf() }, 'Экспорт решённых в PDF')));
    const sheet = el('div', { class: 'sheet scroll' });
    r.append(list, sheet);
    if (!this.sel) { sheet.append(el('div', { class: 'muted', style: { padding: '40px', textAlign: 'center' } }, 'Задач пока нет. Они появляются у механизмов с физическим протоколом.')); return; }
    this.renderSheet(sheet, this.sel);
  }
  starsHtml(n = 0) { return `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`; }
  givenKnown(g) { return !g.src || this.g.hasMeasurement(g.src); }
  renderSheet(sh, id) {
    const d = this.defs[id], s = this.st(id), v = this.vars(id), D = this.diff();
    const solved = s.status === 'solved';
    const given = d.given(v);
    const allKnown = given.every(g => this.givenKnown(g));
    sh.append(el('h2', {}, d.title), el('div', { style: { marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
      el('span', { class: 'tag amber' }, d.ref), el('span', { class: 'tag' }, d.where || ''), solved ? el('span', { html: this.starsHtml(s.stars) }) : null, d.bonus ? el('span', { class: 'tag green' }, 'бонус') : null));
    sh.append(el('div', { class: 'cond', html: rich(d.text(v)) }));
    // ---- school grid
    const left = el('div', { class: 'col' }), right = el('div', { class: 'col' });
    left.append(el('div', { class: 'lab' }, 'Дано'));
    for (const g of given) {
      const known = this.givenKnown(g);
      left.append(el('div', { class: 'gv' }, el('span', { class: 'eq', html: tex(`${g.sym} = ${known ? texVal(g.value) + '\\ \\text{' + g.unit + '}' : '\\ ?'}`) }),
        known ? (g.src ? el('span', { class: 'meas' }, g.srcLabel || 'измерено') : null) : el('span', { class: 'meas' }, g.howTo || 'нужно измерить')));
    }
    // SI conversion
    const needSI = given.filter(g => g.unit !== g.siUnit);
    left.append(el('div', { class: 'sep' }), el('div', { class: 'lab' }, 'СИ'));
    const siInputs = [];
    if (!needSI.length) left.append(el('div', { class: 'muted', style: { fontSize: '.86em' } }, 'Все величины уже в СИ.'));
    for (const g of needSI) {
      const known = this.givenKnown(g);
      const inp = el('input', { class: 'txt', placeholder: D.siHint ? `×${g.factorHint || ''}` : '', value: s.si[g.sym] ?? '', disabled: !known || solved });
      const mark = el('span', {});
      const msg = el('div', { class: 'muted', style: { fontSize: '.78em', width: '100%' } });
      const check = (count) => {
        const x = parseNum(inp.value); s.si[g.sym] = inp.value;
        if (!inp.value.trim()) { mark.className = ''; mark.textContent = ''; msg.textContent = ''; return false; }
        const ok = near(x, g.si, 0.005);
        mark.className = ok ? 'ok' : 'bad'; mark.textContent = ok ? '✓' : '✗';
        if (!ok) {
          const r = x / g.si; let m = 'Проверьте перевод.';
          if (Number.isFinite(r) && r > 0) { const k = Math.round(Math.log10(r)); if (k !== 0 && near(r, 10 ** k, 0.005)) m = `Ошибка в ${Math.abs(k)} ${Math.abs(k) === 1 ? 'порядок' : Math.abs(k) < 5 ? 'порядка' : 'порядков'}: ${g.convHint || 'замените приставку множителем'}.`; else if (near(r, 3.6) || near(r, 1 / 3.6)) m = 'км/ч → м/с: делим на 3,6.'; else if (near(r, 60) || near(r, 1 / 60)) m = 'В минуте 60 секунд.'; }
          msg.textContent = m;
          if (count) { const ts = topicStats(this.g.save, d.topic); ts.errorTypes.si = (ts.errorTypes.si || 0) + 1; ts.errors++; }
        } else msg.textContent = '';
        this.updateGate();
        return ok;
      };
      inp.addEventListener('change', () => check(true));
      inp.addEventListener('input', () => { s.si[g.sym] = inp.value; if (near(parseNum(inp.value), g.si, 0.005)) check(false); else { mark.textContent = ''; this.updateGate(); } });
      siInputs.push({ g, inp, ok: () => near(parseNum(inp.value), g.si, 0.005) });
      left.append(el('div', { class: 'gv' }, el('span', { class: 'eq', html: tex(`${g.sym} =`) }), inp, el('span', { html: tex(`\\text{${g.siUnit}}`) }), mark, msg));
      if (inp.value) setTimeout(() => check(false), 0);
    }
    for (const g of given.filter(g => g.unit === g.siUnit)) left.append(el('div', { class: 'gv muted' }, el('span', { class: 'eq', html: tex(`${g.sym} = ${this.givenKnown(g) ? texVal(g.si) + '\\ \\text{' + g.siUnit + '}' : '?'}`) })));
    left.append(el('div', { class: 'sep' }), el('div', { class: 'lab' }, 'Найти'), el('div', { class: 'gv', html: tex(`${d.find.sym}\\ —\\ ?`) + `<span class="muted" style="font-size:.85em">${escapeHtml(d.find.name)}</span>` }));
    // formulas
    right.append(el('div', { class: 'lab' }, 'Формулы — выберите нужные'));
    const chips = el('div', { class: 'fchips' });
    const known = (this.g.save.formulas || []).filter(f => FORMULAS[f]);
    let pool = known.filter(f => d.formulas.includes(f) || (d.distract || []).includes(f));
    if (D.distract >= 99) pool = known; else pool = [...d.formulas.filter(f => known.includes(f)), ...(d.distract || []).filter(f => known.includes(f)).slice(0, D.distract)];
    pool = shuffleStable(pool, id);
    const chipMsg = el('div', { class: 'muted', style: { fontSize: '.82em', marginTop: '6px', minHeight: '1.2em' } });
    for (const f of pool) {
      const c = el('div', { class: 'fchip' + (s.chips.includes(f) ? (d.formulas.includes(f) ? ' sel' : ' wrong') : ''), title: FORMULAS[f].name, html: tex(FORMULAS[f].tex) });
      c.addEventListener('click', () => {
        if (solved) return;
        this.g.audio.sfx('click');
        if (s.chips.includes(f)) { s.chips = s.chips.filter(x => x !== f); c.className = 'fchip'; chipMsg.textContent = ''; }
        else {
          s.chips.push(f);
          const ok = d.formulas.includes(f);
          c.className = 'fchip ' + (ok ? 'sel' : 'wrong');
          chipMsg.innerHTML = ok ? `<span style="color:var(--green)">Верно: ${escapeHtml(FORMULAS[f].name)}.</span>` : `<span style="color:#ff9d96">${escapeHtml((d.chipWhy && d.chipWhy[f]) || 'Эта формула здесь не поможет — подумайте, какие величины даны и что нужно найти.')}</span>`;
          if (!ok) { const ts = topicStats(this.g.save, d.topic); ts.errorTypes.formula = (ts.errorTypes.formula || 0) + 1; }
        }
        this.updateGate();
      });
      chips.append(c);
    }
    if (!pool.length) chips.append(el('div', { class: 'muted' }, 'В блокноте нет подходящих формул — пройдите урок.'));
    right.append(chips, chipMsg);
    right.append(el('div', { class: 'sep' }), el('div', { class: 'lab' }, 'Решение (черновик)'));
    const draft = el('textarea', { class: 'txt draft', placeholder: 'Запишите ход решения… Считать удобно на калькуляторе [C].' });
    draft.value = s.draft || ''; draft.addEventListener('input', () => { s.draft = draft.value; });
    right.append(draft);
    right.append(el('div', { class: 'lab', style: { marginTop: '12px' } }, 'Ответ'));
    const ans = el('input', { class: 'txt', placeholder: 'число', value: solved ? fmt(s.final) : (s.answer || '') });
    const unit = el('select', { class: 'txt' }, el('option', { value: '' }, 'единица…'), ...d.units.map(u => el('option', { value: u, selected: (solved ? d.unit : s.unit) === u }, u)));
    ans.addEventListener('input', () => { s.answer = ans.value; });
    unit.addEventListener('change', () => { s.unit = unit.value; });
    ans.addEventListener('keydown', e => { if (e.code === 'Enter') { e.preventDefault(); this.submit(); } });
    this.answerInput = solved ? null : ans; this.unitSel = unit;
    const runBtn = el('button', { class: 'btn primary', onclick: () => this.submit() }, d.runLabel || 'Ввести в механизм');
    const calcBtn = el('button', { class: 'btn ghost', onclick: () => { this.g.calc.toggle(); this.reflow(); } }, 'Калькулятор [C]');
    right.append(el('div', { class: 'answer' }, el('span', { html: tex(d.find.sym + ' =') }), ans, unit, runBtn, calcBtn));
    const gate = el('div', { class: 'muted', style: { fontSize: '.82em', marginTop: '6px' } });
    right.append(gate);
    sh.append(el('div', { class: 'school' }, left, right));
    // feedback + hints
    this.fb = el('div', { class: 'fb' });
    if (s.lastFb) { this.fb.className = 'fb on ' + s.lastFb.cls; this.fb.innerHTML = rich(s.lastFb.html); }
    sh.append(this.fb);
    const acts = el('div', { class: 'pbactions' });
    const hintNames = ['Намёк', 'Формула', 'Разбор'];
    for (let i = 0; i < D.maxHint; i++) {
      const used = s.hints > i;
      acts.append(el('button', { class: 'btn small amber' + (used ? ' primary' : ''), disabled: solved || (!used && s.hints < i), onclick: () => this.hint(i) }, `Подсказка ${i + 1}: ${hintNames[i]}`));
    }
    sh.append(acts);
    if (s.hints > 0 && !solved) {
      for (let i = 0; i < s.hints; i++) sh.append(el('div', { class: 'fb on hint', html: `<b>${hintNames[i]}.</b> ` + rich(i === 2 ? this.solutionHtml(d, v) : d.hints[i]) }));
    }
    if (solved) sh.append(el('div', { class: 'solution', html: `<div class="lab" style="font-family:var(--f-head);letter-spacing:.2em;color:var(--green);font-size:.75em">РЕШЕНИЕ ЗАПИСАНО</div>${this.solutionHtml(d, v)}<div class="step">Ответ: ${tex(`${d.find.sym} = ${texVal(d.answer(v))}\\ \\text{${d.unit}}`)}</div>` }));
    this.gateEl = gate; this.runBtn = runBtn; this.siInputs = siInputs; this.ansEl = ans; this.unitEl = unit; this.curAllKnown = allKnown; this.curSolved = solved;
    this.updateGate();
    this.g.calc.render();
  }
  reflow() { if (this.panelEl) this.panelEl.style.width = this.g.calc.open ? 'calc(95vw - 380px)' : 'min(1180px,95vw)'; }
  updateGate() {
    if (!this.gateEl) return;
    const id = this.sel, d = this.defs[id], s = this.st(id), D = this.diff();
    let reason = '';
    if (this.curSolved) reason = 'Задача решена.';
    else if (!this.curAllKnown) reason = 'Не все данные известны: найдите таблички или выполните измерения.';
    else if (D.siRequired && this.siInputs.some(x => !x.ok())) reason = 'Сначала переведите все данные в СИ (левая колонка).';
    else if (!s.chips.some(f => d.formulas.includes(f)) || s.chips.some(f => !d.formulas.includes(f))) reason = 'Выберите верную формулу (и снимите неверные).';
    else if (this.atPanel !== id) reason = 'Ответ вводится в пульт механизма: подойдите к нему и нажмите E.';
    this.gateEl.textContent = reason;
    const can = !reason;
    this.runBtn.disabled = !can; this.ansEl.disabled = this.curSolved || !!(reason && reason !== 'Ответ вводится в пульт механизма: подойдите к нему и нажмите E.');
    this.unitEl.disabled = this.ansEl.disabled;
    this.g.calc.render();
  }
  canReceiveAnswer() { return !!(this.g.ui.isOpen('problems') && this.answerInput && !this.answerInput.disabled); }
  receiveAnswer(str) { if (!this.canReceiveAnswer()) return; this.answerInput.value = str; this.st(this.sel).answer = str; this.answerInput.animate([{ boxShadow: '0 0 24px #62e6ff' }, { boxShadow: 'none' }], { duration: 700 }); }
  hint(i) {
    const id = this.sel, s = this.st(id), d = this.defs[id];
    if (s.hints > i) return;
    s.hints = i + 1;
    const ts = topicStats(this.g.save, d.topic); ts.hints++;
    this.g.audio.sfx('holo', { vol: 0.5 });
    if (i < 2) this.g.dialogue.say([{ who: 'isaac', text: stripTex(d.hints[i]) }]);
    this.render();
  }
  solutionHtml(d, v) { return d.solution(v).map(x => `<div class="step">${x.startsWith('$') || x.includes('<') ? rich(x) : tex(x)}</div>`).join(''); }
  feedback(cls, html) { const s = this.st(this.sel); s.lastFb = { cls, html }; if (this.fb) { this.fb.className = 'fb on ' + cls; this.fb.innerHTML = rich(html); } }
  async submit() {
    const id = this.sel, d = this.defs[id], s = this.st(id), v = this.vars(id), D = this.diff();
    if (this.runBtn.disabled) { this.g.audio.sfx('error'); return; }
    const x = parseNum(this.ansEl.value); const u = this.unitEl.value;
    if (!Number.isFinite(x)) { this.feedback('bad', 'Введите число. Дробную часть отделяйте запятой, порядок — «·10^» или EXP в калькуляторе (6,02·10^23).'); this.g.audio.sfx('error'); return; }
    if (!u) { this.feedback('bad', 'Выберите единицу измерения ответа: число без единицы — не физическая величина.'); this.g.audio.sfx('error'); return; }
    const correct = d.answer(v);
    if (u !== d.unit) {
      const k = d.unitConv[u];
      const inSI = x * k;
      if (k && near(inSI, correct, D.tol)) this.feedback('hint', `Значение верное: ${escapeHtml(fmt(x))} ${escapeHtml(u)} = ${escapeHtml(fmt(correct))} ${escapeHtml(d.unit)}. Но пульт протокола принимает только единицы СИ — введите ответ в ${escapeHtml(d.unit)}.`);
      else this.feedback('bad', `Механизм принимает величину только в единицах СИ: ${escapeHtml(d.unit)}. Переведите ответ.`);
      this.g.audio.sfx('error'); return;
    }
    s.attempts++; const ts = topicStats(this.g.save, d.topic); ts.attempts++;
    const ok = near(x, correct, D.tol);
    let err = null;
    if (!ok) {
      s.wrong++; ts.errors++;
      err = this.detectError(d, v, x, correct);
      ts.errorTypes[err.id] = (ts.errorTypes[err.id] || 0) + 1;
      s.log.push({ x, u, err: err.id, t: Date.now() });
    }
    this.g.ui.close('problems', true);
    if (this.g.calc.open) this.g.calc.toggle(false);
    const res = await this.g.runMechanism(id, x, { ok, err, correct });
    if (ok) {
      s.status = 'solved'; s.final = x; s.solvedAt = Date.now(); ts.solved++;
      const pen = s.wrong + (D.hintCost ? s.hints + (s.hints >= 3 ? 1 : 0) : 0);
      s.stars = pen === 0 ? 3 : pen <= 2 ? 2 : 1;
      s.lastFb = { cls: 'ok', html: `Верно! ${res && res.msg ? res.msg : ''}` };
      this.g.onProblemSolved(id, s.stars);
    } else {
      s.lastFb = { cls: 'bad', html: `<b>Неверно.</b> ${res && res.what ? res.what + '<br>' : ''}${err.msg}` };
      // after the mechanism has shown the consequence, bring the panel back with the analysis of the error
      setTimeout(() => { const g = this.g; if (g.state === 'play' && !g.paused && !g.ui.anyOpen && !g.lesson.active && !g.cut.active && !g.busy) this.open(id, id); }, 450);
    }
    this.g.autosave();
  }
  detectError(d, v, x, correct) {
    for (const e of d.errors || []) { try { if (near(x, e.value(v), 0.02)) return { id: e.id, msg: e.msg }; } catch (er) { } }
    if (near(x, -correct, 0.02)) return { id: 'sign', msg: 'Модуль верный, но знак противоположный. Проверьте направление осей и знаки величин.' };
    const r = x / correct;
    if (Number.isFinite(r) && r > 0) {
      const k = Math.round(Math.log10(r));
      if (k !== 0 && near(r, 10 ** k, 0.02)) return { id: 'pow10', msg: `Ответ отличается от верного ровно в 10${k > 0 ? '' : '⁻'}${['', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'][Math.min(9, Math.abs(k))] || Math.abs(k)} раз. Скорее всего, данные не переведены в СИ (приставки см, мм, км…).` };
      if (near(r, 3.6) || near(r, 1 / 3.6)) return { id: 'kmh', msg: 'Ответ отличается в 3,6 раза: похоже, перепутан перевод км/ч ↔ м/с.' };
      if (near(r, 60) || near(r, 1 / 60)) return { id: 'min', msg: 'Ответ отличается в 60 раз: проверьте перевод минут в секунды.' };
      if (near(r, 2) || near(r, 0.5)) return { id: 'half', msg: 'Ответ отличается ровно в 2 раза. Возможно, забыт множитель 2 (например, путь «туда и обратно»).' };
    }
    return { id: 'other', msg: 'Проверьте формулу и вычисления. Можно взять подсказку.' };
  }
  // ---------- PDF export via print dialog ----------
  exportPdf() {
    const ids = Object.keys(this.g.save.problems).filter(id => this.defs[id] && this.g.save.problems[id].status === 'solved');
    const styles = [...document.querySelectorAll('style')].map(s => s.textContent).filter(t => t.includes('.katex')).join('\n');
    const fontCss = [...document.querySelectorAll('style')].map(s => s.textContent).filter(t => t.includes('@font-face') && t.includes('IBM Plex')).join('\n');
    const blocks = ids.map(id => {
      const d = this.defs[id], v = this.vars(id), s = this.st(id);
      const given = d.given(v);
      const giv = given.map(g => `<div>${tex(`${g.sym} = ${texVal(g.value)}\\ \\text{${g.unit}}`)}</div>`).join('');
      const si = given.filter(g => g.unit !== g.siUnit).map(g => `<div>${tex(`${g.sym} = ${texVal(g.si)}\\ \\text{${g.siUnit}}`)}</div>`).join('') || '<div>—</div>';
      return `<section><h2>${escapeHtml(d.title)} <small>${escapeHtml(d.ref)} · ${'★'.repeat(s.stars || 0)}</small></h2><p>${rich(d.text(v))}</p>
        <table><tr><td class="l"><b>Дано:</b>${giv}<hr><b>СИ:</b>${si}<hr><b>Найти:</b><div>${tex(d.find.sym + '\\ —\\ ?')}</div></td>
        <td><b>Решение:</b>${this.solutionHtml(d, v)}<p><b>Ответ:</b> ${tex(`${d.find.sym} = ${texVal(d.answer(v))}\\ \\text{${d.unit}}`)}</p>${s.draft ? `<p class="dr"><b>Черновик ученика:</b><br>${escapeHtml(s.draft).replace(/\n/g, '<br>')}</p>` : ''}</td></tr></table></section>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>КОНСТАНТА — тетрадь задач</title><style>${fontCss}\n${styles}
      body{font-family:'IBM Plex Sans',sans-serif;color:#111;margin:28px;font-size:13px}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px}h2 small{font-weight:400;color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse}td{vertical-align:top;border:1px solid #999;padding:8px 10px}td.l{width:34%}hr{border:none;border-top:1px solid #999;margin:6px -10px}.step{margin:3px 0}.dr{color:#444;font-size:12px}section{page-break-inside:avoid}</style></head>
      <body><h1>Научный комплекс «Константа» — тетрадь задач</h1><div style="color:#555">Ученик: победитель олимпиады · сложность: ${escapeHtml({ novice: 'Новичок', student: 'Ученик', olymp: 'Олимпиадник' }[this.g.save.difficulty] || '')} · ${new Date().toLocaleString('ru-RU')}</div>
      ${blocks || '<p>Пока нет решённых задач.</p>'}</body></html>`;
    const fr = el('iframe', { style: { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0' } });
    document.body.append(fr);
    const doc = fr.contentDocument; doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { console.warn(e); } setTimeout(() => fr.remove(), 60000); }, 400);
    this.g.hud.toast('Экспорт', 'Откроется окно печати — выберите «Сохранить как PDF».', '', 4);
  }
}

export function texVal(x) {
  if (typeof x === 'string') return x;
  const ax = Math.abs(x);
  if (ax !== 0 && (ax >= 1e6 || ax < 1e-3)) { let e = Math.floor(Math.log10(ax)); let m = +(x / 10 ** e).toPrecision(3); if (Math.abs(m) >= 10) { m /= 10; e++; } return `${String(m).replace('.', '{,}')}\\cdot10^{${e}}`; }
  return String(+x.toPrecision(6)).replace('.', '{,}').replace('-', '-');
}
function stripTex(s) { return String(s || '').replace(/\$([^$]+)\$/g, (_, t) => t.replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1 делить на $2').replace(/\\Delta\s*/g, 'Δ').replace(/\\[a-z]+/g, '').replace(/[{}]/g, '')).replace(/<[^>]+>/g, ''); }
function shuffleStable(arr, seed) { const a = arr.slice(); let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; for (let i = a.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; }
