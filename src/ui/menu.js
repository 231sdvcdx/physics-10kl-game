// Main menu, pause menu, settings, chapters + course map, lessons replay, statistics, about
import { el, escapeHtml, fmt } from '../core/util.js';
import { panel } from './ui.js';
import { GAME_CHAPTERS, COURSE } from '../content/course.js';
import { QUALITY } from '../core/engine.js';
import { loadSave, loadLibrary, saveSettings } from '../core/save.js';

const DIFFS = [
  ['novice', 'Новичок', 'Подсказки не снижают звёзды, перевод в СИ с подсказкой множителя, меньше лишних формул. ИСААК объясняет подробнее.'],
  ['student', 'Ученик', 'Стандартный режим: точность ответа ±2 %, подсказки снижают звёзды, лишние формулы среди вариантов.'],
  ['olymp', 'Олимпиадник', 'Точность ±1 %, все формулы блокнота в выборе, нет полного разбора — только намёк и формула.'],
];
export const TOPICS = { units: 'Величины и единицы СИ', kin: 'Кинематика', dyn: 'Динамика', cons: 'Законы сохранения', stat: 'Статика и гидростатика', rot: 'Вращение', mkt: 'МКТ и газы', thermo: 'Термодинамика', phase: 'Агрегатные состояния', estat: 'Электростатика' };
export const ERR_NAMES = { si: 'перевод в СИ', pow10: 'порядок / приставки', no_si: 'не переведены единицы', kmh: 'км/ч ↔ м/с', min: 'минуты ↔ секунды', sign: 'знак величины', formula: 'выбор формулы', inverse: 'перевёрнутая формула', mult: 'умножение вместо деления', half: 'пропущен множитель 2', deg: 'градусы / радианы', other: 'вычисления' };

export class Menu {
  constructor(game, root) {
    this.g = game;
    this.root = el('div', { id: 'menu', class: 'interactive hidden' });
    root.append(this.root);
  }
  showMain() {
    const g = this.g; const r = this.root; r.innerHTML = ''; r.classList.remove('hidden');
    const save = loadSave();
    const items = el('div', { class: 'items' });
    const mi = (t, sub, fn, dis = false) => { const e = el('div', { class: 'mi' + (dis ? ' dis' : ''), onclick: () => { g.audio.init(); g.audio.sfx('click'); fn(); }, onmouseenter: () => g.audio.sfx('hover') }, t, sub ? el('small', {}, sub) : null); items.append(e); return e; };
    if (save) mi('Продолжить', `${GAME_CHAPTERS.find(c => c.id === save.chapter)?.n || ''} · ${diffName(save.difficulty)} · ★ ${save.stars} · ${new Date(save.updated).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, () => g.continueGame());
    mi('Новая игра', 'выбор сложности', () => this.showNewGame());
    mi('Главы', 'выбор главы и карта курса по параграфам', () => this.showChapters());
    mi('Уроки', 'повторить пройденные голографические уроки', () => this.showLessons());
    mi('Статистика', 'ошибки по темам и слабые места', () => this.showStats());
    mi('Настройки', 'управление, графика, звук, субтитры', () => this.showSettings());
    mi('Об игре', 'учебник, управление', () => this.showAbout());
    r.append(el('div', { class: 'brand' }, el('div', { class: 'logo', html: 'КОН<span>С</span>ТАНТА' }), el('div', { class: 'tag2' }, 'физика · 10 класс · научный комплекс')), items,
      el('div', { class: 'foot', html: 'По учебнику: <b>Грачёв А.В., Погожев В.А., Салецкий А.М., Боков П.Ю. «Физика. 10 класс»</b> (2019) · версия: пролог' }));
    g.audio.playMusic('menu');
  }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }
  screen(title, sub, body, foot = []) {
    const close = () => this.g.ui.close('screen');
    if (this.g.ui.isOpen('screen')) this.g.ui.close('screen', true);
    const p = panel({ title, sub, cls: 'screen', closeKey: 'Esc', onClose: close }, el('div', { class: 'body scroll' }, body), foot.length ? el('div', { class: 'foot' }, ...foot) : null);
    this.g.ui.open('screen', p, { stack: true, closeOnBackdrop: true });
    return p;
  }
  showNewGame() {
    const g = this.g; let pick = 'student';
    const box = el('div', { class: 'diffs' });
    const cards = DIFFS.map(([id, t, d]) => { const c = el('div', { class: 'diff' + (id === pick ? ' on' : ''), onclick: () => { pick = id; cards.forEach(x => x.classList.remove('on')); c.classList.add('on'); g.audio.sfx('click'); } }, el('div', { class: 't' }, t), el('div', { class: 'd' }, d)); return c; });
    box.append(...cards);
    const warn = loadSave() ? el('div', { class: 'fb on hint', style: { marginTop: '16px' } }, 'Текущее сохранение будет заменено новым прохождением (пройденные уроки останутся в библиотеке «Уроки»).') : null;
    this.screen('Новая игра', 'выберите сложность', el('div', {}, box, warn), [el('button', { class: 'btn ghost', onclick: () => g.ui.close('screen') }, 'Отмена'), el('button', { class: 'btn primary', onclick: () => { g.ui.close('screen'); g.newGame(pick); } }, 'Начать пролог')]);
  }
  showChapters() {
    const g = this.g; const save = loadSave();
    const grid = el('div', { class: 'chgrid' });
    for (const c of GAME_CHAPTERS) {
      const avail = c.id === 'prologue';
      const done = save && save.completed && save.completed[c.id];
      grid.append(el('div', { class: 'chcard' + (avail ? '' : ' lock'), onclick: () => { if (!avail) return; g.ui.close('screen'); if (save && save.chapter === 'prologue' && !done) g.continueGame(); else g.newGame(save?.difficulty || 'student'); } },
        el('div', { class: 'n' }, c.n), el('div', { class: 't' }, c.title), el('div', { class: 'd' }, c.sector), el('div', { class: 'd' }, c.desc),
        el('div', { class: 'st' }, avail ? (done ? el('span', { class: 'tag green' }, 'пройдено') : el('span', { class: 'tag amber' }, 'доступно')) : el('span', { class: 'tag' }, 'в следующем обновлении'))));
    }
    this.screen('Главы', 'сюжет и темы', el('div', {}, grid, this.courseMap()));
  }
  courseMap() {
    const box = el('div', { class: 'course' });
    box.append(el('h4', {}, 'Карта курса: каждый параграф учебника → место в игре'));
    for (const ch of COURSE) {
      box.append(el('h4', {}, `${ch.part} · ${ch.chapter}`));
      for (const it of ch.items) {
        const gc = GAME_CHAPTERS.find(c => c.id === it.stage);
        const status = it.stage === 'prologue' ? el('span', { class: 'tag green' }, 'в игре') : el('span', { class: 'tag' }, 'план');
        box.append(el('div', { class: 'row' }, el('span', { class: 'p' }, it.n), el('span', {}, it.t, it.std ? el('span', { class: 'tag amber', style: { marginLeft: '6px' } }, 'станд. программа') : null, el('span', { class: 'muted', style: { marginLeft: '6px', fontSize: '.85em' } }, it.p !== '—' ? `с. ${it.p}` : '')), el('span', { class: 'w' }, `${gc ? gc.n : ''}: ${it.place}`), status));
      }
    }
    return box;
  }
  showLessons() {
    const g = this.g; const lib = loadLibrary(); const save = loadSave();
    const ids = [...new Set([...(lib.lessons || []), ...Object.keys(save?.lessons || {})])];
    const list = el('div', { class: 'chgrid' });
    for (const [id, L] of Object.entries(g.lessonDefs)) {
      const ok = ids.includes(id);
      list.append(el('div', { class: 'chcard' + (ok ? '' : ' lock'), onclick: () => { if (!ok) return; g.ui.close('screen'); g.replayLesson(id); } }, el('div', { class: 'n' }, L.chapterName || ''), el('div', { class: 't', style: { fontSize: '1.2em' } }, L.title), el('div', { class: 'd' }, L.ref), el('div', { class: 'st' }, ok ? el('span', { class: 'tag green' }, 'повторить') : el('span', { class: 'tag' }, 'ещё не пройден'))));
    }
    this.screen('Уроки', 'голографические уроки можно пройти повторно', list);
  }
  showStats() {
    const g = this.g; const s = g.save || loadSave();
    if (!s) { this.screen('Статистика', '', el('div', { class: 'muted' }, 'Статистика появится после начала игры.')); return; }
    const probs = Object.entries(s.problems || {}).filter(([id]) => g.problemDefs[id]);
    const solved = probs.filter(([, p]) => p.status === 'solved');
    const top = el('div', { class: 'readout', style: { gridTemplateColumns: 'repeat(4, 1fr auto)', fontSize: '.95em' } });
    const kv = [['Время в игре', fmtTime(s.playTime)], ['Звёзды', '★ ' + s.stars], ['Задач решено', `${solved.length} / ${probs.length}`], ['Уроков', Object.keys(s.lessons).length], ['Формул', s.formulas.length], ['Карточек', s.cards.length], ['Сложность', diffName(s.difficulty)], ['Тайников', Object.keys(s.flags).filter(k => k.startsWith('secret_')).length]];
    top.innerHTML = kv.map(([a, b]) => `<span>${escapeHtml(a)}</span><span>${escapeHtml(String(b))}</span>`).join('');
    const t = el('table', { class: 'sttable' });
    t.append(el('tr', {}, ...['Тема', 'Попытки', 'Ошибки', 'Подсказки', 'Тест: верно/неверно', 'Точность'].map(h => el('th', {}, h))));
    const errAll = {};
    for (const [tp, st] of Object.entries(s.stats.topics || {})) {
      const acc = st.attempts ? Math.round((st.attempts - Math.min(st.attempts, st.errors)) / st.attempts * 100) : null;
      for (const [k, v] of Object.entries(st.errorTypes || {})) errAll[k] = (errAll[k] || 0) + v;
      const bar = el('div', { class: 'statbar', style: { width: '120px', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' } }, el('i', { class: acc !== null && acc < 60 ? 'bad' : '', style: { width: (acc ?? 0) + '%' } }));
      t.append(el('tr', {}, el('td', {}, TOPICS[tp] || tp), el('td', {}, st.attempts), el('td', {}, st.errors), el('td', {}, st.hints), el('td', {}, `${st.quizRight} / ${st.quizWrong}`), el('td', {}, bar, acc === null ? '—' : acc + '%')));
    }
    const weak = Object.entries(errAll).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const advice = { si: 'Повторите урок «Величины и СИ», шаги 2–3: замена приставки множителем.', pow10: 'Следите за приставками (см, мм, км) и порядком числа.', no_si: 'Перед расчётом переводите все данные в СИ.', kmh: 'км/ч → м/с: делим на 3,6.', min: 'В минуте 60 с, в часе 3600 с.', formula: 'Перед выбором формулы выпишите, что дано и что найти.', inverse: 'Проверяйте размерность: м/с — это метры, делённые на секунды.', mult: 'Проверяйте размерность ответа.', half: 'Перечитайте условие: путь «туда и обратно».', sign: 'Следите за направлением осей.', other: 'Пересчитайте на калькуляторе, сверяйтесь с историей вычислений.' };
    const weakBox = el('div', { style: { marginTop: '18px' } }, el('h4', { style: { fontFamily: 'var(--f-head)', letterSpacing: '.14em', color: 'var(--holo2)', textTransform: 'uppercase', fontSize: '.9em' } }, 'Слабые места'),
      weak.length ? el('div', {}, ...weak.map(([k, v]) => el('div', { class: 'fb on hint', style: { marginTop: '6px' } }, el('b', {}, `${ERR_NAMES[k] || k}: ${v} раз. `), advice[k] || ''))) : el('div', { class: 'muted' }, 'Ошибок пока нет — так держать!'));
    this.screen('Статистика', 'по темам курса', el('div', {}, top, el('div', { style: { height: '12px' } }), Object.keys(s.stats.topics || {}).length ? t : el('div', { class: 'muted' }, 'Пока нет данных по темам.'), weakBox));
  }
  showSettings() {
    const g = this.g; const S = g.settings;
    const grid = el('div', { class: 'setgrid' });
    const slider = (label, key, min, max, step, f = v => fmt(v, 2)) => {
      const val = el('span', { class: 'v' }, f(S[key]));
      const inp = el('input', { type: 'range', min, max, step, value: S[key] });
      const upd = () => { S[key] = +inp.value; val.textContent = f(S[key]); inp.style.setProperty('--p', ((S[key] - min) / (max - min) * 100) + '%'); g.applySettings(); };
      inp.addEventListener('input', upd); inp.style.setProperty('--p', ((S[key] - min) / (max - min) * 100) + '%');
      grid.append(el('span', { class: 'l' }, label), inp, val);
    };
    const seg = (label, key, opts) => {
      const w = el('div', { class: 'seg' });
      const bs = opts.map(([v, l]) => { const b = el('button', { class: S[key] === v ? 'on' : '' }, l); b.addEventListener('click', () => { S[key] = v; if (key === 'quality') S.qualityLocked = true; bs.forEach(x => x.classList.remove('on')); b.classList.add('on'); g.applySettings(key); g.audio.sfx('click'); }); return b; });
      w.append(...bs); grid.append(el('span', { class: 'l' }, label), w, el('span'));
    };
    const h = t => grid.append(el('span', { class: 'l', style: { gridColumn: '1 / -1', fontFamily: 'var(--f-head)', color: 'var(--amber)', letterSpacing: '.2em', fontSize: '.75em', textTransform: 'uppercase', marginTop: '8px' } }, t));
    h('Управление');
    slider('Чувствительность мыши', 'sens', 0.2, 3, 0.05);
    seg('Инверсия оси Y', 'invertY', [[false, 'Нет'], [true, 'Да']]);
    slider('Поле зрения (FOV)', 'fov', 60, 100, 1, v => Math.round(v) + '°');
    slider('Покачивание камеры', 'bob', 0, 1.5, 0.05);
    h('Графика');
    seg('Качество', 'quality', Object.entries(QUALITY).map(([k, q]) => [k, q.label]));
    seg('Показывать FPS', 'showFps', [[false, 'Нет'], [true, 'Да']]);
    slider('Масштаб интерфейса', 'uiScale', 0.8, 1.4, 0.05);
    h('Звук');
    slider('Общая громкость', 'master', 0, 1, 0.01, v => Math.round(v * 100) + '%');
    slider('Музыка', 'music', 0, 1, 0.01, v => Math.round(v * 100) + '%');
    slider('Эффекты', 'sfx', 0, 1, 0.01, v => Math.round(v * 100) + '%');
    slider('Голос (озвучка)', 'voice', 0, 1, 0.01, v => Math.round(v * 100) + '%');
    seg('Озвучка браузером (TTS)', 'tts', [[true, 'Вкл'], [false, 'Выкл']]);
    h('Субтитры');
    seg('Субтитры', 'subs', [[true, 'Вкл'], [false, 'Выкл']]);
    slider('Размер субтитров', 'subSize', 0.8, 1.6, 0.05);
    const tts = el('div', { class: 'muted', style: { marginTop: '14px', fontSize: '.82em' } }, (g.dialogue.voices.length ? `Голоса TTS: ${g.dialogue.voices.map(v => v.name).slice(0, 3).join(', ')}` : 'Русский голос TTS в браузере не найден — реплики показываются субтитрами со звуковыми сигналами.'));
    this.screen('Настройки', 'сохраняются автоматически', el('div', {}, grid, tts), [el('button', { class: 'btn primary', onclick: () => { saveSettings(S); g.ui.close('screen'); } }, 'Готово')]);
  }
  showAbout() {
    const keys = [['W A S D', 'движение'], ['Shift', 'бег'], ['Пробел', 'прыжок / пропуск сцены (удерживать)'], ['E', 'взаимодействие'], ['Tab', 'рюкзак'], ['N', 'блокнот формул'], ['T', 'тетрадь задач'], ['C', 'калькулятор'], ['Q / колесо', 'смена инструмента'], ['ЛКМ / ПКМ', 'использовать инструмент / сброс'], ['F', 'фонарик'], ['V', 'физическое зрение'], ['Esc', 'пауза / закрыть окно']];
    const body = el('div', { style: { lineHeight: 1.6 } },
      el('p', {}, '«Константа» — сюжетная головоломка от первого лица по курсу физики 10 класса. Каждая дверь, лифт и механизм комплекса работают по «физическому протоколу»: чтобы пройти, нужно добыть данные в мире, решить задачу и ввести ответ — механизм сработает ровно по введённому значению.'),
      el('p', { html: 'Учебник: <b>Грачёв А.В., Погожев В.А., Салецкий А.М., Боков П.Ю. «Физика. 10 класс»</b>, 2019. Темы, которых нет в PDF (введение о СИ, конденсаторы в конце главы 10), даны по стандартной программе и отмечены в карте курса.' }),
      el('div', { class: 'setgrid', style: { gridTemplateColumns: '200px 1fr' } }, ...keys.flatMap(([k, t]) => [el('span', {}, ...k.split(' / ').map(x => el('span', { class: 'k' }, x))), el('span', { class: 'muted' }, t)])),
      el('p', { class: 'muted', style: { marginTop: '14px', fontSize: '.85em' } }, 'Управление по физическим клавишам — работает в русской раскладке. Прогресс сохраняется автоматически в браузере.'));
    this.screen('Об игре', '', body);
  }
  // ---------------- pause ----------------
  showPause() {
    const g = this.g;
    const btn = (t, fn, cls = '') => el('button', { class: 'btn ' + cls, style: { width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }, onclick: () => { g.audio.sfx('click'); fn(); } }, t);
    const box = panel({ title: 'Пауза', sub: g.save ? `${GAME_CHAPTERS.find(c => c.id === g.save.chapter)?.n || ''} · ★ ${g.save.stars}` : '', style: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '380px' }, closeKey: 'Esc', onClose: () => g.resume() },
      el('div', { style: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' } },
        btn('Продолжить', () => g.resume(), 'primary'),
        btn('Рюкзак [Tab]', () => { g.ui.close('pause'); g.inventory.toggle(); }),
        btn('Блокнот формул [N]', () => { g.ui.close('pause'); g.notebook.toggle(); }),
        btn('Тетрадь задач [T]', () => { g.ui.close('pause'); g.problems.toggle(); }),
        btn('Повторить урок', () => this.showLessons()),
        btn('Статистика', () => this.showStats()),
        btn('Настройки', () => this.showSettings()),
        btn('Карта курса', () => this.screen('Карта курса', 'параграфы учебника', this.courseMap())),
        btn('Выйти в главное меню', () => g.toMenu(), 'amber')));
    g.ui.open('pause', box, { stack: true, onClose: () => { g.paused = false; g.dialogue.setPaused(false); g.onUIChange(); } });
    g.dialogue.setPaused(true);
    g.paused = true;
  }
}
export function diffName(d) { return { novice: 'Новичок', student: 'Ученик', olymp: 'Олимпиадник' }[d] || d; }
export function fmtTime(sec = 0) { const m = Math.floor(sec / 60), h = Math.floor(m / 60); return h ? `${h} ч ${m % 60} мин` : `${m} мин ${Math.floor(sec % 60)} с`; }
