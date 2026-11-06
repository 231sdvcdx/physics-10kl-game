// Backpack (Tab): items & tools, notes & audio logs, physicist cards
import { el, escapeHtml } from '../core/util.js';
import { panel } from './ui.js';
import { ITEMS, ICONS, CARDS } from '../content/items.js';
import { showNote, showCard } from './viewers.js';

export class Inventory {
  constructor(game) { this.g = game; this.tab = 'items'; this.sel = null; }
  toggle() {
    const ui = this.g.ui;
    if (ui.isOpen('inventory')) { ui.close('inventory'); return; }
    if (this.g.state === 'play' && !this.g.save.items.includes('backpack')) { this.g.hud.toast('Рюкзак', 'Рюкзака у вас пока нет.', 'red', 2.5); return; }
    this.body = el('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } });
    const p = panel({ title: 'Рюкзак', sub: 'предметы · записки · карточки учёных', style: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(1000px,94vw)', height: 'min(640px,86vh)', display: 'flex', flexDirection: 'column' }, closeKey: 'Tab/Esc', onClose: () => this.g.ui.close('inventory') }, this.body);
    ui.open('inventory', p, { closeOnBackdrop: true });
    this.render();
  }
  owned() {
    const s = this.g.save; const ids = [...s.items.filter(i => i !== 'backpack'), ...s.tools];
    if (this.g.vision?.unlocked) ids.push('visor');
    return [...new Set(ids)].filter(i => ITEMS[i]);
  }
  render() {
    const b = this.body; b.innerHTML = '';
    const tabs = el('div', { class: 'tabs' });
    const counts = { items: this.owned().length, notes: this.g.save.notes.length, cards: this.g.save.cards.length };
    for (const [k, n] of [['items', 'Предметы'], ['notes', 'Записки и аудио'], ['cards', 'Карточки учёных']]) tabs.append(el('button', { class: this.tab === k ? 'on' : '', onclick: () => { this.tab = k; this.sel = null; this.g.audio.sfx('page'); this.render(); } }, `${n} (${counts[k]})`));
    b.append(tabs);
    const grid = el('div', { class: 'grid scroll' }); const det = el('div', { class: 'det' });
    b.append(el('div', { class: 'inv', style: { flex: 1, minHeight: 0 } }, grid, det));
    let entries = [];
    if (this.tab === 'items') entries = this.owned().map(id => ({ id, name: ITEMS[id].name, icon: ICONS[ITEMS[id].icon] }));
    else if (this.tab === 'notes') entries = this.g.save.notes.map(id => this.g.noteDefs[id]).filter(Boolean).map(n => ({ id: n.id, name: n.title, icon: ICONS[n.audio ? 'audio' : 'note'] }));
    else entries = Object.keys(CARDS).map(id => ({ id, name: this.g.save.cards.includes(id) ? CARDS[id].name : '???', icon: ICONS.card, locked: !this.g.save.cards.includes(id) }));
    const slots = Math.max(12, Math.ceil(entries.length / 6) * 6);
    for (let i = 0; i < slots; i++) {
      const e = entries[i];
      if (!e) { grid.append(el('div', { class: 'slot empty' })); continue; }
      const s = el('div', { class: 'slot' + (this.sel === e.id ? ' on' : '') + (e.locked ? ' empty' : ''), onclick: () => { if (e.locked) return; this.sel = e.id; this.g.audio.sfx('hover'); this.render(); } }, el('div', { html: e.icon }), el('div', { class: 'nm' }, e.name));
      grid.append(s);
    }
    if (!this.sel && entries.length && !entries[0].locked) this.sel = entries[0].id;
    this.detail(det);
    const s = this.g.save;
    b.append(el('div', { style: { padding: '8px 16px', borderTop: '1px solid var(--holo-faint)', fontSize: '.8em', display: 'flex', gap: '18px' }, class: 'muted' },
      el('span', { html: `Звёзды: <b class="stars">★ ${s.stars}</b>` }), el('span', {}, `Формул в блокноте: ${s.formulas.length}`), el('span', {}, `Измерений: ${s.measurements.length}`)));
  }
  detail(det) {
    const id = this.sel; if (!id) { det.append(el('div', { class: 'muted' }, 'Выберите предмет')); return; }
    if (this.tab === 'items') {
      const it = ITEMS[id];
      det.append(el('div', { html: ICONS[it.icon], style: { width: '96px', height: '96px' } }), el('h3', {}, it.name), el('div', { class: 'tag' }, 'клавиша ' + it.key), el('p', {}, it.desc));
      const act = { notebook: ['Открыть блокнот', () => { this.g.ui.close('inventory'); this.g.notebook.openAt(); }], problems: ['Открыть тетрадь', () => { this.g.ui.close('inventory'); this.g.problems.open(); }], calculator: ['Открыть калькулятор', () => { this.g.ui.close('inventory'); this.g.calc.toggle(true); }], laser: ['Взять в руки', () => { this.g.ui.close('inventory'); this.g.tools.select('laser'); }], stopwatch: ['Взять в руки', () => { this.g.ui.close('inventory'); this.g.tools.select('stopwatch'); }], flashlight: ['Включить / выключить', () => { this.g.ui.close('inventory'); this.g.tools.toggleFlashlight(); }] }[id];
      if (act) det.append(el('button', { class: 'btn', onclick: act[1] }, act[0]));
    } else if (this.tab === 'notes') {
      const n = this.g.noteDefs[id]; if (!n) return;
      det.append(el('div', { html: ICONS[n.audio ? 'audio' : 'note'], style: { width: '80px', height: '80px' } }), el('h3', {}, n.title), el('p', {}, n.where || ''), el('button', { class: 'btn', onclick: () => { this.g.ui.close('inventory'); showNote(this.g, n); } }, n.audio ? 'Прослушать' : 'Прочитать'));
    } else {
      const c = CARDS[id]; if (!c) return;
      det.append(el('h3', {}, c.name), el('div', { class: 'tag amber' }, c.yrs), el('p', {}, c.field), el('button', { class: 'btn', onclick: () => { this.g.ui.close('inventory'); showCard(this.g, id); } }, 'Открыть карточку'));
    }
  }
}
