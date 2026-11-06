// Readers for notes / audio logs / physicist cards / keypad terminals
import { el, escapeHtml } from '../core/util.js';
import { panel } from './ui.js';
import { rich } from './tex.js';
import { CARDS, cardArt } from '../content/items.js';

export function showNote(game, note) {
  if (note.audio) return playAudioLog(game, note);
  const paper = el('div', { class: 'note-paper interactive' },
    note.stamp ? el('div', { class: 'stamp' }, note.stamp) : null,
    el('h3', {}, note.title),
    el('div', { html: rich(note.html) }),
    note.sig ? el('div', { class: 'sig' }, note.sig) : null,
    el('div', { style: { marginTop: '18px', fontSize: '.8em', color: '#6b604c', textAlign: 'center' } }, '[E / Esc] закрыть · записка сохранена в рюкзаке (Tab)'));
  game.ui.open('note', paper, { closeOnBackdrop: true, closeOnUse: true });
  game.audio.sfx('page');
}
export function playAudioLog(game, note) {
  const box = panel({ title: 'Аудиожурнал', sub: note.title, style: { left: '50%', bottom: '24vh', transform: 'translateX(-50%)', width: 'min(640px,92vw)' }, closeKey: 'Esc', onClose: () => game.ui.close('note') },
    el('div', { style: { padding: '14px 18px', lineHeight: 1.6 } }, el('div', { class: 'muted', style: { fontSize: '.85em' } }, note.date || ''), el('div', { html: note.lines.map(l => `<p><b style="color:${l.who === 'lomov' ? 'var(--amber)' : l.who === 'director' ? '#ff8a7a' : 'var(--holo2)'}">${l.who === 'lomov' ? 'Ломов' : l.who === 'director' ? 'Корнеев' : 'Запись'}:</b> ${escapeHtml(l.text)}</p>`).join('') })));
  game.ui.open('note', box, { dim: false, onClose: () => game.dialogue.stop() });
  game.audio.sfx('click');
  game.dialogue.say(note.lines.map(l => ({ ...l, glitch: false })));
}
export function showCard(game, id, isNew = false) {
  const c = CARDS[id]; if (!c) return;
  const card = el('div', { class: 'panel card-phys interactive' }, el('div', { class: 'scan' }),
    el('div', { class: 'art', html: cardArt(c.art) }),
    el('div', { class: 'txt' }, isNew ? el('div', { class: 'tag amber', style: { marginBottom: '10px' } }, 'Новая карточка учёного') : null,
      el('h2', {}, c.name), el('div', { class: 'yrs' }, `${c.yrs} · ${c.field}`), el('blockquote', {}, '«' + c.quote + '»'), el('div', { html: c.text }),
      el('div', { class: 'muted', style: { marginTop: '14px', fontSize: '.8em' } }, '[Esc] закрыть · коллекция — в рюкзаке (Tab)')));
  game.ui.open('card', card, { closeOnBackdrop: true, closeOnUse: true });
  game.audio.sfx(isNew ? 'success' : 'page');
}
// numeric keypad terminal; resolves code via callback
export function showKeypad(game, { title, sub, len = 6, hint = '', onCode }) {
  let code = '';
  const disp = el('div', { class: 'codedisp' }, '');
  const msg = el('div', { class: 'muted', style: { marginTop: '8px', fontSize: '.85em', minHeight: '1.3em' } }, hint);
  const upd = () => { disp.textContent = code.padEnd(len, '·'); };
  const press = k => {
    game.audio.sfx('beep', { f: 1200 + Math.random() * 300 });
    if (k === '⌫') code = code.slice(0, -1); else if (k === 'OK') { const r = onCode(code); if (r === true) { game.ui.close('keypad'); return; } msg.textContent = r || 'Неверный код'; msg.style.color = '#ff9d96'; game.audio.sfx('fail'); code = ''; } else if (code.length < len) code += k;
    upd();
  };
  const pad = el('div', { class: 'codepad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map(k => el('button', { onmousedown: e => { e.preventDefault(); press(k); } }, k)));
  const box = panel({ title, sub, cls: 'terminal interactive', closeKey: 'Esc', onClose: () => game.ui.close('keypad') }, el('div', { class: 'scr' }, disp, msg, pad));
  const onKey = e => { if (/^(Digit|Numpad)[0-9]$/.test(e.code)) { press(e.code.slice(-1)); e.preventDefault(); } else if (e.code === 'Backspace') press('⌫'); else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK'); };
  addEventListener('keydown', onKey);
  game.ui.open('keypad', box, { onClose: () => removeEventListener('keydown', onKey) });
  upd();
}
