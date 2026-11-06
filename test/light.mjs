// Lighting probe: fixed viewpoints at a chosen quality preset, flashlight on/off
import { chromium } from 'playwright';
import { sleep, dump, DIST, SHOTS } from './lib.mjs';
const Q = process.env.Q || 'high';
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERR ' + e.message));
await page.addInitScript(q => { localStorage.setItem('konstanta.settings.v1', JSON.stringify({ quality: q, qualityLocked: true, tts: false })); }, Q);
await page.goto(DIST);
const ev = (f, a) => page.evaluate(f, a);
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 120000, polling: 250 });
await ev(() => { window.__dtMax = 0.3; const st = document.createElement('style'); st.textContent = '*{backdrop-filter:none!important}'; document.head.append(st); const e = window.__game.engine; e._r = e.render; e.render = function (dt) { if (window.__renderN > 0) { window.__renderN--; this._r(dt); } }; window.__renderN = 0; });
const snap = async (name) => { await ev(() => { window.__renderN = 2; }); await page.waitForFunction(() => window.__renderN === 0, null, { timeout: 120000, polling: 200 }); await sleep(300); await page.screenshot({ path: `${SHOTS}/L_${Q}_${name}.png`, timeout: 120000 }); console.log('snap', name); };
await ev(() => { window.__game.newGame('student'); });
await page.waitForFunction(() => window.__game.state === 'play' && window.__game.cut.active, null, { timeout: 120000, polling: 250 });
await ev(() => window.__game.cut.skipNow());
await page.waitForFunction(() => !window.__game.cut.active, null, { timeout: 60000, polling: 250 });
await ev(() => { const g = window.__game, l = g.level; g.dialogue.stop(); l.takeBackpack(); l.takeCalc(); l.openLocker(); l.takeFlashlight(); g.dialogue.stop(); document.getElementById('subs').style.display = 'none'; });
await sleep(1500);
const views = (process.env.VIEWS || 'gal,galwall,air,airdoor,lift,cls').split(',');
const V = { gal: [1.5, 0, 1.6, 0.25, 0.05], galwall: [4.2, 0, 2.6, Math.PI * 0.75, -0.05], air: [15.0, 0, 26.6, -Math.PI / 2, 0.05], airdoor: [17.5, 0, 26, -Math.PI / 2, 0], lift: [27.5, 0, 27.5, -Math.PI / 2 + 0.4, 0.15], cls: [6, 0, 23.5, Math.PI, -0.1], cor: [6.5, 0, 6, Math.PI, 0], galback: [0, 0, -2.2, Math.PI, 0.02], galback2: [-5, 0, -2.0, Math.PI * 0.8, 0.05] };
if (process.env.EVAL) await ev(src => { (0, eval)(src); }, process.env.EVAL);
for (const v of views) {
  await ev(a => { const g = window.__game; g.player.teleport(...a); }, V[v]);
  await sleep(600);
  await ev(() => window.__game.tools.setFlash(false, true)); await sleep(400); await snap(v + '_off');
  if (process.env.FL) { await ev(() => window.__game.tools.setFlash(true, true)); await sleep(500); await snap(v + '_on'); }
}
dump(logs);
await browser.close();
