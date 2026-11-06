// CPU profile of the game loop with rendering frozen (finds JS hotspots), plus loop rate measurement
import { launch, sleep, dump, freezeHook } from './lib.mjs';
const { browser, page, logs } = await launch({ w: 960, h: 540 });
const ev = (f, a) => page.evaluate(f, a);
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 90000, polling: 250 });
await freezeHook(page); await ev(() => { window.__freeze = true; });
const rate = () => ev(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / 3).toFixed(1)); }; requestAnimationFrame(f); }));
console.log('menu loop rate (frozen)', await rate());
await ev(() => { window.__game.newGame('student'); });
await page.waitForFunction(() => window.__game.state === 'play' && window.__game.cut.active, null, { timeout: 90000, polling: 250 });
await ev(() => window.__game.cut.skipNow());
await page.waitForFunction(() => !window.__game.cut.active, null, { timeout: 30000, polling: 250 });
await sleep(3000);
console.log('gallery loop rate (frozen)', await rate());
await ev(() => { const g = window.__game; g.player.teleport(17.5, 0, 26, -Math.PI / 2, 0); });
await sleep(2000);
console.log('airlock loop rate (frozen)', await rate());
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start'); await sleep(4000);
const { profile } = await cdp.send('Profiler.stop');
// self time per function
const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
const dtc = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dtc[i] || 0)));
for (const [id, t] of counts) { const n = byId.get(id); const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}`; self.set(k, (self.get(k) || 0) + t); }
const tot = [...self.values()].reduce((a, b) => a + b, 0);
console.log('total sampled ms', (tot / 1000).toFixed(0));
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, t]) => console.log((t / 1000).toFixed(1).padStart(8), 'ms', (100 * t / tot).toFixed(1).padStart(5) + '%', k));
dump(logs);
await browser.close();
