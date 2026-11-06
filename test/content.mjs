// Проверка данных всех задач без браузера: генератор → ответ → разбор → типичные ошибки → формулы.
// Запуск: node test/content.mjs   (код выхода 1 при ошибках)
import { Rng } from '../src/core/util.js';
import { FORMULAS } from '../src/content/formulas.js';
import { ALL_PROBLEMS } from '../src/content/registry.js';

const RUNS = +process.env.RUNS || 300;
let bad = 0, warn = 0, checked = 0;
const fail = (id, m) => { bad++; console.log(`✗ ${id}: ${m}`); };
const note = (id, m) => { warn++; if (process.env.VERBOSE) console.log(`△ ${id}: ${m}`); };

for (const [id, d] of Object.entries(ALL_PROBLEMS)) {
  for (const k of ['title', 'text', 'given', 'find', 'answer', 'unit', 'formulas', 'hints', 'solution']) if (!d[k]) fail(id, `нет поля ${k}`);
  for (const f of [...(d.formulas || []), ...(d.distract || [])]) if (!FORMULAS[f]) fail(id, `формула «${f}» не найдена в блокноте`);
  if (d.unitConv && d.unitConv[d.unit] !== 1) fail(id, `unitConv[${d.unit}] должен быть 1`);
  let coincide = {};
  for (let s = 1; s <= RUNS; s++) {
    const v = d.gen(new Rng(s * 7919 + 13));
    let a;
    try { a = d.answer(v); } catch (e) { fail(id, `answer бросил исключение: ${e.message}`); break; }
    if (!Number.isFinite(a)) { fail(id, `ответ не число (seed ${s}): ${a} ${JSON.stringify(v)}`); break; }
    try {
      const t = d.text(v), g = d.given(v), sol = d.solution(v);
      if (typeof t !== 'string' || !Array.isArray(g) || !Array.isArray(sol)) throw new Error('text/given/solution: неверный тип');
      for (const it of g) if (it.si !== undefined && typeof it.si === 'number' && !Number.isFinite(it.si)) throw new Error(`Дано ${it.sym}: SI не число`);
      if (sol.some(x => /NaN|undefined|Infinity/.test(String(x)))) throw new Error('в разборе NaN/undefined');
      if (/NaN|undefined/.test(t)) throw new Error('в условии NaN/undefined');
    } catch (e) { fail(id, `${e.message} (seed ${s})`); break; }
    if (d.check) { const r = d.check(v, a); if (r !== true) { fail(id, `самопроверка: ${r} (seed ${s}) ${JSON.stringify(v)}`); break; } }
    for (const e of d.errors || []) {
      let x; try { x = e.value(v); } catch (er) { continue; }
      if (Number.isFinite(x) && Math.abs(x - a) <= Math.abs(a) * 0.025) coincide[e.id] = (coincide[e.id] || 0) + 1;
    }
    checked++;
  }
  for (const [eid, n] of Object.entries(coincide)) {
    if (n > RUNS * 0.02) fail(id, `типичная ошибка «${eid}» совпадает с верным ответом в ${n} из ${RUNS} вариантов`);
    else note(id, `ошибка «${eid}» изредка совпадает с ответом (${n}/${RUNS})`);
  }
}
console.log(`Задач: ${Object.keys(ALL_PROBLEMS).length}, вариантов проверено: ${checked}, ошибок: ${bad}, предупреждений: ${warn}`);
process.exit(bad ? 1 : 0);
