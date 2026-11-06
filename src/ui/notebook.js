// Formula notebook (N): formulas with meanings/units/explanations/schemes/§ refs, constants page, measurement journal, search
import { el, escapeHtml } from '../core/util.js';
import { panel } from './ui.js';
import { tex, rich } from './tex.js';
import { FORMULAS } from '../content/formulas.js';
import { CONSTANTS } from '../content/constants.js';
import { GAME_CHAPTERS } from '../content/course.js';

export class Notebook {
  constructor(game) { this.g = game; this.tab = 'f'; this.sel = null; this.q = ''; }
  toggle() {
    const ui = this.g.ui;
    if (ui.isOpen('notebook')) { ui.close('notebook'); return; }
    if (this.g.state === 'play' && !this.g.save.items.includes('notebook')) { this.g.hud.toast('Блокнот', 'Блокнот формул лежит в рюкзаке — сначала найдите рюкзак.', 'red', 2.5); return; }
    this.openAt();
  }
  openAt(id = null, tab = null) {
    if (id) { this.sel = id; this.tab = 'f'; }
    if (tab) this.tab = tab;
    const body = el('div', { class: 'nb' });
    this.body = body;
    const p = panel({ title: 'Блокнот формул', sub: 'автоматически пополняется после уроков', style: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(1120px,94vw)', height: 'min(760px,90vh)', display: 'flex', flexDirection: 'column' }, closeKey: 'N/Esc', onClose: () => this.g.ui.close('notebook') }, body);
    this.g.ui.open('notebook', p, { closeOnBackdrop: true });
    this.render();
  }
  render() {
    const b = this.body; b.innerHTML = '';
    const tabs = el('div', { class: 'tabs' });
    for (const [k, n] of [['f', 'Формулы'], ['c', 'Константы'], ['m', 'Журнал измерений']]) tabs.append(el('button', { class: this.tab === k ? 'on' : '', onclick: () => { this.tab = k; this.g.audio.sfx('page'); this.render(); } }, n));
    b.append(tabs);
    if (this.tab === 'f') this.renderFormulas(b);
    else if (this.tab === 'c') this.renderConsts(b);
    else this.renderMeas(b);
  }
  known() { return (this.g.save?.formulas || []).filter(id => FORMULAS[id]); }
  renderFormulas(b) {
    const ids = this.known();
    const search = el('input', { class: 'txt', placeholder: 'Поиск: «скорость», «СИ», «км/ч»…', value: this.q, style: { flex: 1 } });
    search.addEventListener('input', () => { this.q = search.value; this.fillToc(toc, ids); });
    b.append(el('div', { class: 'tools' }, search, el('span', { class: 'muted', style: { fontSize: '.85em' } }, `записей: ${ids.length}`)));
    const toc = el('div', { class: 'toc scroll' }); const page = el('div', { class: 'page scroll' });
    this.page = page;
    b.append(el('div', { class: 'spread' }, toc, page));
    if (!ids.length) { page.append(el('div', { class: 'muted', style: { padding: '30px', textAlign: 'center' } }, 'Пока пусто. Формулы появятся после первого голографического урока.')); return; }
    if (!this.sel || !ids.includes(this.sel)) this.sel = ids[ids.length - 1];
    this.fillToc(toc, ids);
    this.showEntry(this.sel);
  }
  match(id) {
    if (!this.q.trim()) return true;
    const f = FORMULAS[id]; const q = this.q.toLowerCase().trim();
    return [f.name, f.group, f.expl, f.ref, f.tex, ...f.vars.flat()].join(' ').toLowerCase().includes(q);
  }
  fillToc(toc, ids) {
    toc.innerHTML = '';
    let grp = null; let n = 0;
    for (const id of ids) {
      if (!this.match(id)) continue; n++;
      const f = FORMULAS[id];
      if (f.group !== grp) { grp = f.group; toc.append(el('div', { class: 'grp' }, grp)); }
      const isNew = !this.g.save.flags['seen_f_' + id];
      toc.append(el('div', { class: 'it' + (id === this.sel ? ' on' : ''), onclick: () => { this.sel = id; this.g.audio.sfx('page'); this.fillToc(toc, ids); this.showEntry(id); } }, el('div', {}, f.name, isNew ? el('span', { class: 'tag amber', style: { marginLeft: '6px' } }, 'новое') : null), el('div', { class: 'r' }, f.ref)));
    }
    if (!n) toc.append(el('div', { class: 'muted', style: { padding: '16px' } }, 'Ничего не найдено'));
  }
  showEntry(id) {
    const f = FORMULAS[id]; const page = this.page; if (!f || !page) return;
    const isNew = !this.g.save.flags['seen_f_' + id];
    this.g.save.flags['seen_f_' + id] = true;
    const rows = f.vars.map(([s, d, u]) => `<tr><td>${tex(s)}</td><td>${escapeHtml(d)}</td><td>${escapeHtml(u)}</td></tr>`).join('');
    page.innerHTML = `<div class="fentry"><h2>${escapeHtml(f.name)}</h2><div class="ref">Учебник: ${escapeHtml(f.ref)}</div>
      <div class="big ${isNew ? 'writing' : ''}">${tex(f.tex, true)}</div>
      <table class="vars"><tr><td class="muted" style="font-size:.8em">символ</td><td class="muted" style="font-size:.8em">что обозначает</td><td class="muted" style="font-size:.8em">единица СИ</td></tr>${rows}</table>
      <div class="expl">${rich(f.expl)}</div>${f.scheme ? `<div class="scheme">${f.scheme}</div>` : ''}
      <div class="note">Совет: в задаче выберите эту формулу в разделе «Формулы», переведите данные в СИ и посчитайте на калькуляторе [C].</div></div>`;
    if (isNew) this.g.audio.sfx('write');
  }
  renderConsts(b) {
    const known = this.g.unlockedConstants();
    const t = el('table', { class: 'consts' });
    for (const c of CONSTANTS) {
      const ok = known.includes(c);
      const ch = GAME_CHAPTERS.find(x => x.id === c.chapter);
      t.append(el('tr', {}, el('td', { html: ok ? escapeHtml(c.name) : '<span class="muted">??? — ещё не открыта</span>' }), el('td', { class: 'v', html: ok ? tex(c.value) : `<span class="muted">откроется: ${escapeHtml(ch ? ch.n + ' «' + ch.title + '»' : '')}</span>` }), el('td', { class: 'r' }, ok ? c.ref : '')));
    }
    b.append(el('div', { class: 'page scroll', style: { flex: 1 } }, el('div', { class: 'fentry' }, el('h2', {}, 'Физические постоянные'), el('div', { class: 'ref' }, 'Страница констант пополняется по мере прохождения тем'), el('div', { style: { height: '14px' } }), t)));
  }
  renderMeas(b) {
    const ms = this.g.save?.measurements || [];
    const t = el('table', { class: 'sttable' });
    t.append(el('tr', {}, el('th', {}, 'Величина'), el('th', {}, 'Значение'), el('th', {}, 'Где измерено'), el('th', {}, 'Прибор')));
    for (const m of ms) t.append(el('tr', {}, el('td', { html: tex(m.sym) + ' — ' + escapeHtml(m.name) }), el('td', { html: `<b>${escapeHtml(m.text)}</b>` }), el('td', {}, m.where || ''), el('td', { class: 'muted' }, m.tool || '')));
    b.append(el('div', { class: 'page scroll', style: { flex: 1 } }, el('div', { class: 'fentry' }, el('h2', {}, 'Журнал измерений'), el('div', { class: 'ref' }, 'Данные, добытые приборами и с табличек механизмов. Они автоматически подставляются в задачи.'), el('div', { style: { height: '14px' } }), ms.length ? t : el('div', { class: 'muted' }, 'Пока нет измерений.'))));
  }
}
