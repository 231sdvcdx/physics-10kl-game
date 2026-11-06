// Holographic lesson L0 «Величины и СИ»: definitions, SI, prefixes, standard form, km/h ↔ m/s, worked example, quiz
import * as THREE from 'three';
import { fmt } from '../../core/util.js';
import { Arrow } from '../../fx/fx.js';

const CY = 0x62e6ff, AM = 0xffb547, GR = 0x72ffa8;
function relabel(ctx, holder, text, opts) {
  if (holder.text === text) return; holder.text = text;
  if (holder.s) { holder.s.removeFromParent(); holder.s.userData.dispose(); }
  holder.s = ctx.label(text, opts); holder.s.position.copy(holder.pos); ctx.stage.add(holder.s);
}
function track(ctx, len, ticks, labelEvery, unitLabel, y = 0.12) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.05), ctx.holo(CY, { opacity: 0.9 })); rail.position.y = y; g.add(rail);
  const rail2 = rail.clone(); rail2.position.z = 0.22; g.add(rail2);
  for (let i = 0; i <= ticks; i++) {
    const x = -len / 2 + len * i / ticks;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.3), ctx.holo(CY, { opacity: 0.5 })); t.position.set(x, y, 0.11); g.add(t);
    if (i % labelEvery === 0) { const l = ctx.label(unitLabel(i), { size: 0.07 }); l.position.set(x, y + 0.12, -0.12); g.add(l); }
  }
  return g;
}
function cart(ctx) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.2), ctx.holo(AM, { opacity: 1, intensity: 2.6 })); b.position.y = 0.2; g.add(b);
  for (const [x, z] of [[-0.09, -0.02], [0.09, -0.02], [-0.09, 0.24], [0.09, 0.24]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16).rotateX(Math.PI / 2), ctx.holo(AM)); w.position.set(x, 0.15, z - 0.01); g.add(w); }
  g.position.z = 0.0; ctx.stage.add(g); return g;
}

export const LESSON_L0 = {
  id: 'L0', title: 'Величины и единицы СИ', ref: 'вводная тема (станд. программа) · §3', topic: 'units', chapterName: 'Пролог',
  formulas: ['quantity', 'si_base', 'prefixes', 'sci', 'kmh', 'vavg'],
  summary: 'Итог урока: значение величины = число × единица; перед расчётом — всё в СИ; приставку заменяем множителем; большие и малые числа — в стандартном виде; км/ч : 3,6 = м/с; $v_{\\text{ср.п}} = s/\\Delta t$.',
  steps: [
    {
      title: 'Физическая величина = число × единица',
      html: `<p>Учебник открывает механику так: <i>«Механическим движением называют изменение положения тела или его частей в пространстве относительно других тел с течением времени»</i> (с. 3). Чтобы описать движение, его нужно <b>измерять</b>: длину, время, скорость.</p>
        <div class="def"><b>Физическая величина</b> — характеристика тела или явления, которую можно измерить. Её значение — это <b>число, умноженное на единицу</b>: $l = 1{,}2\\ \\text{м}$.</div>
        <p>Переключайте единицы справа: число меняется, а длина ящика — нет. Число без единицы ничего не говорит о мире.</p>
        <div class="fx">$A = \\{A\\}\\cdot[A]$</div>`,
      say: ['Любая величина — это число и единица. Переключай единицы: число меняется, а сам ящик остаётся тем же.'],
      controls: [{ type: 'choice', id: 'u', label: 'Единица длины', value: 'м', options: [['м', 'метры'], ['см', 'сантиметры'], ['мм', 'миллиметры'], ['км', 'километры']] }],
      view: { yaw: 0.5, pitch: 0.3, dist: 3.2 },
      setup(ctx) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), ctx.holo(CY, { opacity: 0.7 })); box.position.y = 0.55; ctx.stage.add(box);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(CY).multiplyScalar(3) })); edges.position.copy(box.position); ctx.stage.add(edges);
        const dl = ctx.line([new THREE.Vector3(-0.6, 0.12, 0.45), new THREE.Vector3(0.6, 0.12, 0.45)], AM); ctx.stage.add(dl);
        for (const x of [-0.6, 0.6]) ctx.stage.add(ctx.line([new THREE.Vector3(x, 0.05, 0.45), new THREE.Vector3(x, 0.25, 0.45)], AM));
        const lab = { pos: new THREE.Vector3(0, 0.32, 0.5) };
        const K = { 'м': 1, 'см': 100, 'мм': 1000, 'км': 0.001 };
        return {
          update(dt, t, p) {
            box.rotation.y = edges.rotation.y = Math.sin(t * 0.4) * 0.15;
            const u = p.u || 'м'; const num = 1.2 * K[u];
            relabel(ctx, lab, `l = ${fmt(num, 4)} ${u}`, { size: 0.16, color: '#ffe2b3', border: '#ffb547' });
            ctx.setReadout([['Число {l}', fmt(num, 4)], ['Единица [l]', u], ['В СИ', '1,2 м']]);
          },
        };
      },
    },
    {
      title: 'Международная система единиц (СИ)',
      html: `<p>Учёные всего мира договорились измерять в одних и тех же единицах — это <b>СИ</b>. В ней <b>7 основных единиц</b>:</p>
        <table><tr><th>Величина</th><th>Единица</th><th>Обозн.</th></tr><tr><td>длина</td><td>метр</td><td>м</td></tr><tr><td>масса</td><td>килограмм</td><td>кг</td></tr><tr><td>время</td><td>секунда</td><td>с</td></tr><tr><td>сила тока</td><td>ампер</td><td>А</td></tr><tr><td>температура</td><td>кельвин</td><td>К</td></tr><tr><td>количество вещества</td><td>моль</td><td>моль</td></tr><tr><td>сила света</td><td>кандела</td><td>кд</td></tr></table>
        <p>Остальные единицы — <b>производные</b>: скорость $[v] = \\text{м/с}$, ускорение $\\text{м/с}^2$, сила $\\text{Н} = \\text{кг·м/с}^2$. Учебник в §16 (с. 99) рассказывает об эталоне килограмма.</p>
        <div class="def">Правило протокола: <b>перед расчётом переведите все данные в СИ</b> — тогда и ответ получится в СИ.</div>`,
      say: ['Семь основных единиц СИ. Всё остальное складывается из них, как из кирпичиков.'],
      controls: [{ type: 'toggle', id: 'der', label: 'Показать производные единицы', value: false }],
      view: { yaw: 0, pitch: 0.35, dist: 3.6 },
      setup(ctx) {
        const units = [['м', 'длина'], ['кг', 'масса'], ['с', 'время'], ['А', 'сила тока'], ['К', 'температура'], ['моль', 'кол-во вещества'], ['кд', 'сила света']];
        const ring = new THREE.Group(); ring.position.y = 0.9; ctx.stage.add(ring);
        units.forEach(([u, n], i) => { const s = ctx.label(`${u}\n${n}`, { size: 0.2, color: '#ffffff' }); const a = i / units.length * Math.PI * 2; s.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25); ring.add(s); });
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), ctx.holo(AM, { opacity: 1 })); core.position.y = 0.9; ctx.stage.add(core);
        const cl = ctx.label('СИ', { size: 0.16, bg: null, border: null, color: '#ffe2b3' }); cl.position.y = 1.32; ctx.stage.add(cl);
        const der = new THREE.Group(); der.position.y = 0.9; ctx.stage.add(der);
        ['м/с', 'м/с²', 'Н', 'Дж', 'Па', 'Вт'].forEach((u, i) => { const s = ctx.label(u, { size: 0.13, color: '#b8ffd8', border: '#72ffa8' }); const a = i / 6 * Math.PI * 2; s.position.set(Math.cos(a) * 0.65, Math.sin(i) * 0.15, Math.sin(a) * 0.65); der.add(s); });
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.006, 6, 96), ctx.holo(CY)); orbit.rotation.x = Math.PI / 2; orbit.position.y = 0.9; ctx.stage.add(orbit);
        return { update(dt, t, p) { ring.rotation.y += dt * 0.25; der.rotation.y -= dt * 0.4; core.rotation.y += dt; core.rotation.x += dt * 0.6; der.visible = !!p.der; ctx.setReadout([['Основных единиц', '7'], ['Производные', p.der ? 'показаны' : 'скрыты']]); } };
      },
    },
    {
      title: 'Десятичные приставки',
      html: `<p>Приставка — это <b>множитель</b>, «приклеенный» к единице. Двигайте ползунок — голограмма покажет объект подходящего масштаба.</p>
        <table><tr><th>Приставка</th><th>Обозн.</th><th>Множитель</th></tr><tr><td>гига</td><td>Г</td><td>$10^{9}$</td></tr><tr><td>мега</td><td>М</td><td>$10^{6}$</td></tr><tr><td>кило</td><td>к</td><td>$10^{3}$</td></tr><tr><td>деци</td><td>д</td><td>$10^{-1}$</td></tr><tr><td>санти</td><td>с</td><td>$10^{-2}$</td></tr><tr><td>милли</td><td>м</td><td>$10^{-3}$</td></tr><tr><td>микро</td><td>мк</td><td>$10^{-6}$</td></tr><tr><td>нано</td><td>н</td><td>$10^{-9}$</td></tr></table>
        <div class="def">Чтобы перевести в СИ, <b>замените приставку множителем</b>: $240\\ \\text{см} = 240\\cdot10^{-2}\\ \\text{м} = 2{,}4\\ \\text{м}$.</div>`,
      say: ['Приставка — просто множитель. Сантиметр — это одна сотая метра, километр — тысяча метров.'],
      controls: [{ type: 'slider', id: 'k', label: 'Масштаб', min: 0, max: 8, step: 1, value: 5, fmt: v => ['нано', 'микро', 'милли', 'санти', 'деци', '— (1 м)', 'кило', 'мега', 'гига'][v] }],
      view: { yaw: 0.3, pitch: 0.25, dist: 3.2 },
      setup(ctx) {
        const P = [['н', -9, 'молекула воды ≈ 0,3 нм'], ['мк', -6, 'бактерия ≈ 2 мкм'], ['м', -3, 'песчинка ≈ 1 мм'], ['с', -2, 'монета ≈ 2 см'], ['д', -1, 'ладонь ≈ 1 дм'], ['', 0, 'шаг человека ≈ 0,7 м'], ['к', 3, 'высотная башня ≈ 0,5 км'], ['М', 6, 'Земля: диаметр ≈ 12,7 Мм'], ['Г', 9, 'Солнце: диаметр ≈ 1,39 Гм']];
        const objs = [];
        const H = (c, o) => ctx.holo(c, o);
        const mk = [
          () => { const g = new THREE.Group(); const o = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), H(0xff7a6a)); g.add(o); for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), H(CY)); h.position.set(s * 0.22, 0.14, 0); g.add(h); } return g; },
          () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 8, 16), H(GR)); c.rotation.z = Math.PI / 2; g.add(c); return g; },
          () => new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), H(AM)),
          () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 40), H(AM)); m.rotation.x = 1.1; return m; },
          () => new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.36), H(0xffc9a0)),
          () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 6, 12), H(CY)); b.position.y = 0.05; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), H(CY)); h.position.y = 0.42; g.add(h); return g; },
          () => { const g = new THREE.Group(); [[0.5, 0.36], [0.3, 0.28], [0.15, 0.2], [0.08, 0.1]].reduce((y, [h, w]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), H(CY)); b.position.y = y + h / 2; g.add(b); return y + h; }, -0.4); return g; },
          () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), H(0x5fb3ff))); const w = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(0.385, 16, 10)), new THREE.LineBasicMaterial({ color: new THREE.Color(GR).multiplyScalar(1.5), transparent: true, opacity: 0.35 })); g.add(w); return g; },
          () => new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 20), H(0xffb030, { intensity: 3.5, opacity: 1 })),
        ];
        P.forEach((_, i) => { const o = mk[i](); o.position.y = 0.85; o.visible = false; ctx.stage.add(o); objs.push(o); });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.02), ctx.basic(AM)); bar.position.set(0, 0.25, 0.4); ctx.stage.add(bar);
        for (const x of [-0.5, 0.5]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), ctx.basic(AM)); t.position.set(x, 0.25, 0.4); ctx.stage.add(t); }
        const lab = { pos: new THREE.Vector3(0, 0.4, 0.42) }, lab2 = { pos: new THREE.Vector3(0, 1.55, 0) };
        let cur = -1, pop = 1;
        return {
          update(dt, t, p) {
            const k = p.k ?? 5;
            if (k !== cur) { if (objs[cur]) objs[cur].visible = false; cur = k; objs[k].visible = true; pop = 0; }
            pop = Math.min(1, pop + dt * 3); const o = objs[cur]; o.scale.setScalar(0.3 + 0.7 * (1 - Math.pow(1 - pop, 3))); o.rotation.y += dt * 0.5;
            const [pre, e, desc] = P[k];
            relabel(ctx, lab, `1 ${pre}м = 10${['⁻⁹', '⁻⁶', '⁻³', '⁻²', '⁻¹', '⁰', '³', '⁶', '⁹'][k]} м`, { size: 0.12, color: '#ffe2b3', border: '#ffb547' });
            relabel(ctx, lab2, desc, { size: 0.13 });
            ctx.setReadout([['Приставка', pre ? `${pre} (${['нано', 'микро', 'милли', 'санти', 'деци', '', 'кило', 'мега', 'гига'][k]})` : 'нет'], ['Множитель', `10^${e}`.replace('^', '').replace(/(-?\d+)$/, m => '^' + m) && ('10' + ['⁻⁹', '⁻⁶', '⁻³', '⁻²', '⁻¹', '⁰', '³', '⁶', '⁹'][k])], ['Десятичная запись', fmt(10 ** e, 9)]]);
          },
        };
      },
    },
    {
      title: 'Стандартный вид числа',
      html: `<p>Скорость света — $300\\,000\\,000\\ \\text{м/с}$. Записывать столько нулей неудобно, поэтому пишут в <b>стандартном виде</b>:</p>
        <div class="fx">$x = a\\cdot10^{n},\\quad 1 \\le a < 10$</div>
        <p>$c = 3\\cdot10^{8}\\ \\text{м/с}$, постоянная Авогадро $N_A = 6{,}02\\cdot10^{23}\\ \\text{моль}^{-1}$ (её вы встретите в §44), а толщина волоса — около $7\\cdot10^{-5}\\ \\text{м}$.</p>
        <div class="def">В калькуляторе порядок вводится клавишей <b>EXP</b>: «6,02 EXP 23» — это $6{,}02\\cdot10^{23}$. В поле ответа можно писать «6,02·10^23».</div>
        <p class="muted">Скорость света $c$ добавлена на страницу констант блокнота.</p>`,
      say: ['Большие и маленькие числа удобно писать со степенью десяти. В калькуляторе для этого есть клавиша EXP.'],
      controls: [
        { type: 'slider', id: 'a', label: 'Мантисса a', min: 1, max: 9.9, step: 0.1, value: 3, fmt: v => fmt(v, 2) },
        { type: 'slider', id: 'n', label: 'Порядок n', min: -12, max: 24, step: 1, value: 8, fmt: v => String(v).replace('-', '−') },
      ],
      view: { yaw: 0, pitch: 0.18, dist: 3.6 },
      setup(ctx) {
        ctx.game.unlockConstant && ctx.game.unlockConstant('c');
        const L = 3.2, lo = -12, hi = 25; const X = lg => -L / 2 + L * (lg - lo) / (hi - lo);
        ctx.stage.add(ctx.line([new THREE.Vector3(-L / 2, 0.3, 0), new THREE.Vector3(L / 2, 0.3, 0)], CY));
        for (let e = lo; e <= 24; e += 3) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.01), ctx.basic(CY)); t.position.set(X(e), 0.3, 0); ctx.stage.add(t); const l = ctx.label('10' + String(e).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]), { size: 0.07, bg: null, border: null }); l.position.set(X(e), 0.2, 0); ctx.stage.add(l); }
        const marks = [[0, 'метр'], [8.477, 'c, м/с'], [23.78, 'N_A'], [-4.15, 'волос, м'], [-9.5, 'атом, м']];
        for (const [lg, n] of marks) { const l = ctx.label(n, { size: 0.065, color: '#b8ffd8', border: '#72ffa8' }); l.position.set(X(lg), 0.45, 0); ctx.stage.add(l); }
        const mk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 12), ctx.basic(AM)); mk.rotation.x = Math.PI; ctx.stage.add(mk);
        const lab = { pos: new THREE.Vector3(0, 1.05, 0) };
        return {
          update(dt, t, p) {
            const a = p.a ?? 3, n = p.n ?? 8; const x = a * 10 ** n; const lg = Math.log10(x);
            mk.position.set(X(lg), 0.62 + Math.sin(t * 3) * 0.02, 0);
            lab.pos.set(X(lg) * 0.6, 1.0, 0);
            relabel(ctx, lab, `${fmt(a, 2)} · 10${String(n).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`, { size: 0.26, color: '#ffffff', font: 'Russo One' });
            const full = Math.abs(n) <= 12 ? (x >= 1 ? Math.round(x).toLocaleString('ru-RU') : x.toFixed(Math.min(14, -n + 2)).replace('.', ',').replace(/0+$/, '')) : 'слишком длинно — для этого и нужен стандартный вид';
            ctx.setReadout([['a', fmt(a, 2)], ['n', String(n).replace('-', '−')], ['Обычная запись', full], ['Ввод в калькулятор', `${fmt(a, 2)} EXP ${String(n).replace('-', '−')}`]]);
          },
        };
      },
    },
    {
      title: 'Скорость: км/ч и м/с',
      html: `<p>Учебник, §3 (с. 16): <i>«Средней путевой скоростью тела называют физическую величину, равную отношению пути $s$, пройденного телом за рассматриваемый промежуток времени $\\Delta t$, к длительности этого промежутка»</i>:</p>
        <div class="fx">$v_{\\text{ср.п}} = \\dfrac{s}{\\Delta t}$</div>
        <p>В СИ скорость измеряют в м/с. На транспорте привычнее км/ч:</p>
        <div class="fx">$1\\ \\tfrac{\\text{км}}{\\text{ч}} = \\tfrac{1000\\ \\text{м}}{3600\\ \\text{с}} = \\tfrac{1}{3{,}6}\\ \\tfrac{\\text{м}}{\\text{с}}$</div>
        <p>Меняйте скорость вагонетки и следите за графиком $x(t)$: при постоянной скорости это прямая, и чем больше скорость — тем она круче. Включите замедление, чтобы рассмотреть движение.</p>`,
      say: ['Скорость показывает, какой путь тело проходит за единицу времени. Чтобы перевести километры в час в метры в секунду — раздели на три и шесть десятых.'],
      sim: true,
      controls: [{ type: 'slider', id: 'v', label: 'Скорость вагонетки', min: 3.6, max: 36, step: 0.9, value: 18, fmt: v => `${fmt(v, 3)} км/ч` }, { type: 'toggle', id: 'vec', label: 'Показать вектор скорости', value: true }],
      graph: { xl: 't, с', yl: 'x, м', xmax: 10, ymax: 10, series: [{ color: '#ffb547' }] },
      view: { yaw: 0.25, pitch: 0.42, dist: 3.4 },
      setup(ctx) {
        const S = 0.28; // 1 m of track = 0.28 visual units
        track(ctx, 10 * S, 10, 2, i => `${i} м`);
        const c = cart(ctx); const arrow = new Arrow(GR, 0.012); ctx.stage.add(arrow);
        let x = 0, tl = 0;
        const reset = () => { x = 0; tl = 0; ctx.graph && ctx.graph.clear(); };
        return {
          reset,
          update(dt, t, p) {
            const v = (p.v ?? 18) / 3.6;
            x += v * dt; tl += dt;
            if (x > 10) reset();
            c.position.x = -5 * S + x * S;
            arrow.visible = !!p.vec; if (p.vec) arrow.setVec(new THREE.Vector3(c.position.x, 0.42, 0.1), new THREE.Vector3(v * 0.06, 0, 0));
            ctx.graph && ctx.graph.push(0, tl, x);
            ctx.setReadout([['t', fmt(tl, 3) + ' с'], ['x', fmt(x, 3) + ' м'], ['v', fmt(p.v ?? 18, 3) + ' км/ч'], ['v в СИ', fmt(v, 3) + ' м/с']]);
          },
        };
      },
    },
    {
      title: 'Разбор задачи',
      html: `<p><b>Задача.</b> Вагонетка равномерно проезжает $1{,}5\\ \\text{км}$ за $2\\ \\text{мин}$. Найдите её скорость в единицах СИ.</p>
        <table><tr><th style="width:40%">Дано</th><th>Решение</th></tr><tr><td>$s = 1{,}5\\ \\text{км}$<br>$\\Delta t = 2\\ \\text{мин}$<hr style="border:none;border-top:1px solid rgba(98,230,255,.3)"><b>СИ:</b><br>$s = 1500\\ \\text{м}$<br>$\\Delta t = 120\\ \\text{с}$<hr style="border:none;border-top:1px solid rgba(98,230,255,.3)">Найти: $v$ — ?</td>
        <td>$v = \\dfrac{s}{\\Delta t}$<br><br>$v = \\dfrac{1500\\ \\text{м}}{120\\ \\text{с}} = 12{,}5\\ \\text{м/с}$<br><br><b>Ответ:</b> $v = 12{,}5\\ \\text{м/с}$ ($= 45\\ \\text{км/ч}$).</td></tr></table>
        <div class="def">Типичная ошибка: разделить $1{,}5$ на $2$ и получить «0,75». Это км/мин, а не м/с! Сначала — перевод в СИ.</div>`,
      say: ['Сначала переводим в СИ: полтора километра — это тысяча пятьсот метров, две минуты — сто двадцать секунд. Делим — получаем двенадцать с половиной метров в секунду.'],
      sim: true,
      graph: { xl: 't, с', yl: 's, м', xmax: 120, ymax: 1500, series: [{ color: '#72ffa8' }] },
      view: { yaw: -0.2, pitch: 0.45, dist: 3.6 },
      setup(ctx) {
        const S = 2.8 / 1500;
        track(ctx, 1500 * S, 15, 5, i => `${i * 100} м`);
        const c = cart(ctx);
        const lab = { pos: new THREE.Vector3(0, 0.9, 0) };
        let tl = 0;
        return {
          reset() { tl = 0; ctx.graph && ctx.graph.clear(); },
          update(dt, t) {
            tl = Math.min(120, tl + dt * 20);
            const s = 12.5 * tl;
            c.position.x = -1.4 + s * S;
            ctx.graph && ctx.graph.push(0, tl, s);
            lab.pos.set(c.position.x, 0.75, 0);
            relabel(ctx, lab, tl >= 120 ? 'v = 1500 м : 120 с = 12,5 м/с' : `s = ${Math.round(s)} м`, { size: 0.12, color: '#ffe2b3', border: '#ffb547' });
            ctx.setReadout([['Ускорение показа', '×20'], ['t', fmt(tl, 3) + ' с'], ['s', Math.round(s) + ' м'], ['v = s/t', tl > 0 ? fmt(s / tl, 3) + ' м/с' : '—']]);
          },
        };
      },
    },
  ],
  quiz: [
    { q: 'Сколько метров в $0{,}25\\ \\text{км}$?', opts: ['25 м', '250 м', '2500 м', '0,25 м'], right: 1, ex: '«кило» = $10^3$: $0{,}25\\cdot1000 = 250\\ \\text{м}$.' },
    { q: 'Как записать $0{,}00045$ в стандартном виде?', opts: ['$45\\cdot10^{-5}$', '$4{,}5\\cdot10^{-4}$', '$0{,}45\\cdot10^{-3}$', '$4{,}5\\cdot10^{4}$'], right: 1, ex: 'Мантисса должна быть от 1 до 10: $4{,}5$, а запятую сдвинули на 4 знака вправо — порядок $-4$.' },
    { q: 'Чему равна скорость $72\\ \\text{км/ч}$ в м/с?', opts: ['7,2 м/с', '20 м/с', '259,2 м/с', '72 м/с'], right: 1, ex: '$72 : 3{,}6 = 20\\ \\text{м/с}$.', why: { 2: 'Вы умножили на 3,6, а нужно делить: в часе 3600 с, в километре 1000 м.' } },
  ],
};
