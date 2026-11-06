// Scripted playthrough of the prologue with screenshots at key moments
import { launch, sleep, snap, dump, freezeHook } from './lib.mjs';
const W = +process.env.W || 960, H = +process.env.H || 540;
const only = process.env.ONLY || '';
const { browser, page, logs } = await launch({ w: W, h: H });
const ev = (f, a) => page.evaluate(f, a);
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const T0 = Date.now();
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 90000, polling: 250 });
await freezeHook(page); await ev(() => { window.__freeze = true; });
const st = () => ev(() => { const g = window.__game, L = g.level; return { state: g.state, cut: g.cut.active, busy: g.busy, obj: document.querySelector('#objective, .objective')?.innerText?.replace(/\s+/g, ' ').slice(0, 140), ui: g.ui.top && g.ui.top.id, pos: g.player.center && g.player.center.toArray().map(v => +v.toFixed(2)) }; });
const tp = (x, y, z, yaw, pitch = 0) => ev(a => window.__game.player.teleport(...a), [x, y, z, yaw, pitch]);
const L = (code, a) => ev(code, a);
const FAST = !!process.env.FAST;
try {
  await ev(() => { window.__game.newGame('student'); });
  await page.waitForFunction(() => window.__game.state === 'play' && window.__game.cut.active, null, { timeout: 60000, polling: 250 });
  log('intro started');
  if (!only || only.includes('intro')) {
    for (const [t, n] of [[4, 'i1_typer'], [12, 'i2_gallery'], [22, 'i3_director'], [32, 'i4_zoom'], [44, 'i5_launch']]) { await sleep(Math.max(0, t * 1000 - (Date.now() - T0 - 8000))); await snap(page, n); log('snap', n, JSON.stringify(await st())); }
  }
  await ev(() => window.__game.cut.skipNow());
  await page.waitForFunction(() => !window.__game.cut.active, null, { timeout: 30000, polling: 250 });
  await sleep(2500);
  await snap(page, 'g1_wake'); log('after intro', JSON.stringify(await st()));
  await L(() => { const l = window.__game.level; l.takeBackpack(); l.takeCalc(); l.openLocker(); });
  await sleep(1200); await L(() => window.__game.level.takeFlashlight());
  await sleep(800);
  await tp(4.2, 0, 2.6, Math.PI * 0.75, -0.05); await sleep(600); await snap(page, 'g2_gallery_look');
  await tp(6.5, 0, 6, Math.PI, 0); await sleep(800); await snap(page, 'g3_corridor'); log(JSON.stringify(await st()));
  await L(() => window.__game.level.closeValve()); await sleep(2500);
  await L(() => window.__game.level.openArchive()); await sleep(2000);
  await tp(6, 0, 16, Math.PI, 0); await sleep(800); await snap(page, 'g4_archive'); log(JSON.stringify(await st()));
  await L(() => window.__game.level.enterClassroom()); await sleep(2500);
  await tp(6, 0, 21.6, Math.PI, 0); await sleep(500); await snap(page, 'c1_classroom'); log(JSON.stringify(await st()));
  const stats = await L(() => { const g = window.__game, S = g.engine.scene; const c = { point: 0, spot: 0, dir: 0, hemi: 0, amb: 0, shadow: 0, meshes: 0, mats: new Set() }; S.traverse(o => { if (o.isPointLight) c.point++; if (o.isSpotLight) c.spot++; if (o.isDirectionalLight) c.dir++; if (o.isHemisphereLight) c.hemi++; if (o.isAmbientLight) c.amb++; if (o.isLight && o.castShadow) c.shadow++; if (o.isMesh) { c.meshes++; c.mats.add(o.material); } }); c.mats = c.mats.size; const r = g.engine.renderer; r.info.autoReset = false; r.info.reset(); g.engine._r(0.016); c.calls = r.info.render.calls; c.tris = r.info.render.triangles; c.programs = r.info.programs.length; c.textures = r.info.memory.textures; c.geoms = r.info.memory.geometries; r.info.autoReset = true; return c; });
  log('scene stats', JSON.stringify(stats));
  if (FAST) { await L(() => { const g = window.__game; g.dialogue.stop(); g.save.lessons.L0 = { done: true }; g.level.onLessonDone(); }); }
  else {
  await L(() => { window.__game.dialogue.stop(); window.__game.level.startLesson(); });
  await page.waitForFunction(() => window.__game.lesson.active, null, { timeout: 60000, polling: 250 });
  await sleep(2500); await snap(page, 'c2_lesson0'); log(JSON.stringify(await st()));
  for (let i = 1; i < 4; i++) { await L(() => window.__game.lesson.go(1)); await sleep(1500); await snap(page, 'c2_lesson' + i); }
  // answer quiz correctly and finish
  await L(() => { const ls = window.__game.lesson; (ls.def.quiz || []).forEach((q, i) => { ls.answers[i] = q.right; }); ls.finish(false); });
  }
  await sleep(6000); await snap(page, 'c3_after_lesson'); log(JSON.stringify(await st()));
  await L(() => { const l = window.__game.level; l.openCabinet(); }); await sleep(1200); await L(() => window.__game.level.takeLaser()); await sleep(800);
  // airlock
  await tp(17.5, 0, 26, -Math.PI / 2, 0); await sleep(1500); await snap(page, 'd1_airlock'); log(JSON.stringify(await st()));
  // read plates
  await L(() => { const g = window.__game; const ints = g.interact.items || g.interact.list || []; return ints.length; }).then(n => log('interactables', n));
  await L(() => window.__game.openProblem('p1_door')); await sleep(1200); await snap(page, 'd2_problem'); log(JSON.stringify(await st()));
  // wrong answer through UI (forgot cm→m)
  const vars = await L(() => { const g = window.__game; const v = g.problemVars('p1_door'); return { v, ans: g.problemDefs.p1_door.answer(v), unit: g.problemDefs.p1_door.unit }; });
  log('p1 vars', JSON.stringify(vars));
  await L(a => { const pb = window.__game.problems; pb.ansEl.value = String(a.v.s_cm / a.v.t).replace('.', ','); pb.unitEl.value = a.unit; pb.runBtn.disabled = false; pb.submit ? pb.submit() : pb.runBtn.click(); }, vars);
  await sleep(2500); await snap(page, 'd3_wrong_run'); log(JSON.stringify(await st()));
  await page.waitForFunction(() => !window.__game.busy, null, { timeout: 60000, polling: 250 }); await sleep(1500);
  await snap(page, 'd4_wrong_fb'); log(JSON.stringify(await st()));
  await L(a => { const g = window.__game; if (!g.ui.isOpen('problems')) g.openProblem('p1_door'); const pb = g.problems; pb.ansEl.value = String(a.ans).replace('.', ','); pb.unitEl.value = a.unit; pb.runBtn.disabled = false; pb.submit ? pb.submit() : pb.runBtn.click(); }, vars);
  await sleep(2500); await snap(page, 'd5_right_run');
  await page.waitForFunction(() => !window.__game.busy, null, { timeout: 60000, polling: 250 }); await sleep(1500);
  log('p1 solved', await L(() => window.__game.isSolved('p1_door')), JSON.stringify(await st()));
  // lift hall
  await tp(26, 0, 26, -Math.PI / 2, 0.1); await sleep(1500); await snap(page, 'e1_lifthall'); log(JSON.stringify(await st()));
  await L(() => { const g = window.__game; g.recordMeasurement('h_lift', { sym: 'h', name: 'высота подъёма платформы', text: `${g.level.liftH} м`, where: 'шахта', tool: 'рулетка' }); g.level.updateObjective(); });
  const v2 = await L(() => { const g = window.__game; const v = g.problemVars('p2_lift'); return { v, ans: g.problemDefs.p2_lift.answer(v), unit: g.problemDefs.p2_lift.unit }; });
  log('p2 vars', JSON.stringify(v2));
  await L(a => { const g = window.__game; g.openProblem('p2_lift'); }, v2); await sleep(1000); await snap(page, 'e2_problem');
  await L(a => { const pb = window.__game.problems; pb.ansEl.value = String(a.ans).replace('.', ','); pb.unitEl.value = a.unit; pb.runBtn.disabled = false; pb.submit ? pb.submit() : pb.runBtn.click(); }, v2);
  await sleep(3000); await snap(page, 'e3_lift_run');
  await sleep(3000); await snap(page, 'e4_lift_run2');
  await page.waitForFunction(() => !window.__game.busy, null, { timeout: 90000, polling: 250 }); await sleep(1500);
  await snap(page, 'e5_lift_top'); log('p2 solved', await L(() => window.__game.isSolved('p2_lift')), JSON.stringify(await st()));
  const v3 = await L(() => { const g = window.__game; const v = g.problemVars('p3_radar'); return { v, ans: g.problemDefs.p3_radar.answer(v), unit: g.problemDefs.p3_radar.unit }; });
  log('p3 vars', JSON.stringify(v3));
  await L(a => { const g = window.__game; g.openProblem('p3_radar'); }, v3); await sleep(1000); await snap(page, 'f1_problem');
  await L(a => { const pb = window.__game.problems; pb.ansEl.value = String(a.ans).replace('.', ','); pb.unitEl.value = a.unit; pb.runBtn.disabled = false; pb.submit ? pb.submit() : pb.runBtn.click(); }, v3);
  await sleep(3000); await snap(page, 'f2_radar_run');
  await page.waitForFunction(() => !window.__game.busy, null, { timeout: 90000, polling: 250 }); await sleep(1500);
  await snap(page, 'f3_radar_done'); log('p3 solved', await L(() => window.__game.isSolved('p3_radar')), JSON.stringify(await st()));
  await tp(37.6, await L(() => window.__game.level.liftH), 26, -Math.PI / 2, 0); await sleep(1500); await snap(page, 'f4_exit');
  await L(() => { window.__game.level.ending(); });
  await sleep(6000); await snap(page, 'f5_ending');
  await sleep(10000); await snap(page, 'f6_ending2'); log(JSON.stringify(await st()));
  await sleep(10000); await snap(page, 'f7_stats'); log(JSON.stringify(await st()));
} catch (e) { log('TEST ERROR', e.message); await snap(page, 'zz_error'); }
dump(logs, 60);
await browser.close();
