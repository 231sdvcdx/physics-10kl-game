// Items, tools and physicist cards
const I = body => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#62e6ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICONS = {
  backpack: I('<path d="M20 22c0-7 5-12 12-12s12 5 12 12v28a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z"/><path d="M26 10V7h12v3"/><rect x="25" y="32" width="14" height="10" rx="2"/><path d="M20 30h24"/>'),
  calculator: I('<rect x="16" y="8" width="32" height="48" rx="4"/><rect x="21" y="13" width="22" height="10" rx="1" stroke="#ffb547"/><g stroke-width="2.6"><path d="M23 31h2M31 31h2M39 31h2M23 38h2M31 38h2M39 38h2M23 45h2M31 45h2M23 51h2M31 51h2"/></g><path d="M40 43v8" stroke="#ffb547"/>'),
  notebook: I('<path d="M18 8h26a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H18z"/><path d="M18 8v48M13 16h8M13 26h8M13 36h8M13 46h8"/><text x="34" y="38" fill="#ffb547" stroke="none" font-size="15" font-family="serif" text-anchor="middle" font-style="italic">f(x)</text>'),
  problems: I('<rect x="14" y="8" width="36" height="48" rx="3"/><path d="M20 18h24M20 26h16M20 34h24"/><path d="M30 8v48" stroke-dasharray="2 3" stroke="#62e6ff88"/><path d="M22 46l4 4 8-9" stroke="#72ffa8"/>'),
  flashlight: I('<path d="M14 26h22l10-8v28l-10-8H14z"/><path d="M50 22l6-4M51 32h7M50 42l6 4" stroke="#ffb547"/><path d="M20 26v12"/>'),
  laser: I('<rect x="10" y="22" width="30" height="22" rx="4"/><circle cx="20" cy="33" r="5"/><path d="M40 30h18" stroke="#ff5a4f"/><circle cx="58" cy="30" r="2" fill="#ff5a4f" stroke="#ff5a4f"/><path d="M28 28h8M28 34h8"/>'),
  stopwatch: I('<circle cx="32" cy="36" r="18"/><path d="M28 10h8M32 10v8M32 36l7-8" /><path d="M47 18l4-4"/>'),
  visor: I('<path d="M8 30c6-10 42-10 48 0v8c-4 6-14 8-24 2-10 6-20 4-24-2z"/><path d="M14 32h12M38 32h12" stroke="#ffb547"/>'),
  card: I('<rect x="14" y="8" width="36" height="48" rx="3"/><circle cx="32" cy="28" r="8"/><path d="M20 48c3-6 7-9 12-9s9 3 12 9"/>'),
  note: I('<path d="M16 8h24l8 8v40H16z"/><path d="M40 8v8h8M22 26h20M22 34h20M22 42h12"/>'),
  audio: I('<rect x="12" y="16" width="40" height="32" rx="3"/><circle cx="24" cy="32" r="6"/><circle cx="40" cy="32" r="6"/><path d="M24 32h16" stroke="#ffb547"/>'),
};

export const ITEMS = {
  backpack: { name: 'Рюкзак', icon: 'backpack', key: 'Tab', desc: 'Ваш школьный рюкзак. Внутри — тетради, которые вы взяли на олимпиадную экскурсию. Откройте клавишей Tab, чтобы посмотреть предметы, записки и карточки учёных.' },
  notebook: { name: 'Блокнот формул', icon: 'notebook', key: 'N', desc: 'Сюда автоматически записываются формулы после каждого голографического урока: смысл букв, единицы СИ, пояснение, схема и ссылка на параграф учебника. Есть поиск и страница констант.' },
  problems: { name: 'Тетрадь задач', icon: 'problems', key: 'T', desc: 'Школьное оформление: Дано → СИ → Найти → Формулы → Решение → Ответ. Решённые задачи сохраняются, их можно выгрузить в PDF.' },
  calculator: { name: 'Инженерный калькулятор', icon: 'calculator', key: 'C', desc: 'sin, cos, tg (градусы/радианы), корни, степени, π, ввод порядка EXP (6,02·10²³), история вычислений. Результат можно сразу отправить в поле ответа.' },
  flashlight: { name: 'Фонарик', icon: 'flashlight', key: 'F', desc: 'Аварийный фонарь из шкафа гражданской обороны. Включение — F.' },
  laser: { name: 'Лазерная рулетка', icon: 'laser', key: 'Q', desc: 'Измеряет расстояния. ЛКМ — поставить точку A, ещё раз ЛКМ — точку B: прибор покажет расстояние AB и перепад высот Δh. ПКМ — сброс. Измерения у меток автоматически попадают в журнал.' },
  stopwatch: { name: 'Секундомер', icon: 'stopwatch', key: 'Q', desc: 'ЛКМ — старт/стоп, ПКМ — сброс.' },
  visor: { name: 'Визор «Физическое зрение»', icon: 'visor', key: 'V', desc: 'ИСААК подключил его к своим датчикам. V — замедление времени и слои: величины, векторы, массы, энергия, температура, заряды. Новые слои открываются с темами.' },
};
export const TOOL_IDS = ['laser', 'stopwatch'];

export const CARDS = {
  galileo: {
    name: 'Галилео Галилей', yrs: '1564–1642', field: 'механика, астрономия',
    quote: 'Измеряй всё, что измеримо, и делай измеримым то, что пока не измеримо.',
    text: 'Одним из первых стал систематически <b>измерять</b> движение: время — по водяным часам и пульсу, путь — по делениям на наклонном жёлобе. Сформулировал принцип относительности и закон инерции (в главе 1 их встретим в §14 и §27). Пытался измерить скорость света с помощью фонарей на холмах — но она оказалась слишком велика для такого опыта.',
    art: 'telescope',
  },
};
export function cardArt(kind) {
  const base = '<svg viewBox="0 0 220 260" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#62e6ff" stroke-width="2" stroke-linecap="round">';
  const ring = '<circle cx="110" cy="120" r="92" stroke="#62e6ff55"/><circle cx="110" cy="120" r="100" stroke="#ffb54755" stroke-dasharray="3 6"/>';
  const arts = {
    telescope: '<path d="M60 150 L150 90 L160 104 L70 164 Z"/><path d="M150 90 l18 -12 l10 14 l-18 12" stroke="#ffb547"/><path d="M105 130 L80 210 M105 130 L130 210 M105 130 L106 210"/><circle cx="160" cy="58" r="10" stroke="#ffb547"/><path d="M40 70 l4 0 M44 66 l0 8 M180 170 l4 0 M182 168 l0 4"/>',
  };
  return base + ring + (arts[kind] || '') + `<text x="110" y="248" fill="#ffb547" stroke="none" text-anchor="middle" font-family="Russo One" font-size="14">КАРТОЧКА УЧЁНОГО</text></svg>`;
}
