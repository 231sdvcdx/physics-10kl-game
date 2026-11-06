import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import fs from 'fs';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DIST = process.env.DIST || new URL('../dist/index.html', import.meta.url).href;
export const SHOTS = process.env.SHOTS || ROOT + 'shots';
fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = process.env.CHROME || (fs.existsSync('/usr/local/bin/chromium') ? '/usr/local/bin/chromium' : undefined);
export async function launch({ w = 960, h = 540 } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const logs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
  await page.goto(DIST);
  return { browser, page, logs };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function shot(page, name) { await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 120000 }); }
export function dump(logs, max = 40) { const u = [...new Set(logs)]; console.log(`--- logs (${u.length} unique)`); for (const l of u.slice(0, max)) console.log(l.slice(0, 600)); }
export async function fps(page, ms = 3000) { return page.evaluate(ms => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }), ms); }
export async function freezeHook(page) {
  await page.evaluate(() => { window.__dtMax = 0.3; const st = document.createElement('style'); st.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.append(st); const e = window.__game.engine; if (e._r) return; e._r = e.render; e.render = function (dt) { if (!window.__freeze) this._r(dt); }; });
}
export async function snap(page, name) {
  await page.evaluate(() => new Promise(r => { window.__freeze = false; requestAnimationFrame(() => requestAnimationFrame(() => { window.__freeze = true; r(); })); }));
  try { await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 60000 }); } catch (e) { console.log('snap failed', name, e.message.split('\n')[0]); }
  await page.evaluate(() => { window.__freeze = false; });
}
