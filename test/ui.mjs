// UI screens: main menu pages, in-game panels (backpack, notebook, problems, calculator, pause/settings)
import { launch, sleep, snap, dump, freezeHook } from './lib.mjs';
const W = +process.env.W || 1366, H = +process.env.H || 680;
const { browser, page, logs } = await launch({ w: W, h: H });
const ev = (f, a) => page.evaluate(f, a);
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 90000, polling: 250 });
await freezeHook(page); await ev(() => { window.__freeze = true; });
const clickText = async (t) => { const ok = await ev(t => { const els = [...document.querySelectorAll('#menu .mi, button, .btn, .tab, .mi')]; const e = els.find(x => x.offsetParent && x.textContent.trim().toLowerCase().startsWith(t.toLowerCase())); if (e) { e.click(); return true; } return false; }, t); if (!ok) log('no element', t); await sleep(700); };
try {
  await sleep(1200); await snap(page, 'u_menu');
  await clickText('Новая игра'); await snap(page, 'u_newgame'); await ev(() => window.__game.ui.closeAll ? window.__game.ui.closeAll() : 0); await ev(() => window.__game.menu.showMain()); await sleep(500);
  await clickText('Главы'); await snap(page, 'u_chapters'); await ev(() => window.__game.menu.showMain()); await sleep(400);
  await clickText('Уроки'); await snap(page, 'u_lessons'); await ev(() => window.__game.menu.showMain()); await sleep(400);
  await clickText('Статистика'); await snap(page, 'u_stats'); await ev(() => window.__game.menu.showMain()); await sleep(400);
  await clickText('Настройки'); await snap(page, 'u_settings'); await ev(() => window.__game.menu.showMain()); await sleep(400);
  await clickText('Об игре'); await snap(page, 'u_about'); await ev(() => window.__game.menu.showMain()); await sleep(400);
  log('menu pages done');
  await ev(() => { window.__game.newGame('olymp'); });
  await page.waitForFunction(() => window.__game.state === 'play' && window.__game.cut.active, null, { timeout: 90000, polling: 250 });
  await ev(() => window.__game.cut.skipNow());
  await page.waitForFunction(() => !window.__game.cut.active, null, { timeout: 30000, polling: 250 });
  await ev(() => { const g = window.__game, l = g.level; g.dialogue.stop(); l.takeBackpack(); l.takeCalc(); g.dialogue.stop(); g.save.lessons.L0 = { done: true }; l.onLessonDone(); g.dialogue.stop(); g.discoverProblem('p1_door', true); g.recordMeasurement('s_door', { sym: 's', name: 'ход створки', text: '230 см', where: 'шлюз П-1', tool: 'табличка' }); });
  await sleep(5000);
  await ev(() => window.__game.inventory.toggle()); await sleep(800); await snap(page, 'u_inventory'); await ev(() => window.__game.ui.closeAll()); await sleep(300);
  await ev(() => window.__game.notebook.toggle()); await sleep(800); await snap(page, 'u_notebook'); await ev(() => window.__game.ui.closeAll()); await sleep(300);
  await ev(() => window.__game.problems.toggle()); await sleep(800); await snap(page, 'u_problems');
  await ev(() => { const pb = window.__game.problems; const b = [...document.querySelectorAll('button')].find(x => /подсказ/i.test(x.textContent)); if (b) b.click(); }); await sleep(600); await snap(page, 'u_problems_hint');
  await ev(() => window.__game.ui.closeAll()); await sleep(300);
  await ev(() => window.__game.calc.toggle()); await sleep(600);
  await ev(() => { const c = window.__game.calc; for (const k of ['2', '3', '0', '÷', '1', '0', '0', '÷', '3']) c.press(k); c.press('='); }); await sleep(400); await snap(page, 'u_calc');
  await ev(() => window.__game.calc.toggle(false)); await sleep(300);
  await ev(() => window.__game.menu.showPause()); await sleep(700); await snap(page, 'u_pause');
  log('ui done');
} catch (e) { log('TEST ERROR', e.message); await snap(page, 'zz_uierror'); }
dump(logs, 60);
await browser.close();
