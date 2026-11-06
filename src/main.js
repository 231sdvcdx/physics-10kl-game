// Entry point: boot sequence (fonts → physics → renderer → materials → environment → main menu)
import { Game } from './game.js';
import { initRapier } from './core/physics.js';
import { initMaterials } from './core/materials.js';
import { makeEnvironment } from './levels/env.js';
import { QUALITY } from './core/engine.js';

const $ = id => document.getElementById(id);
const boot = $('boot'), bar = $('bootbar'), msg = $('bootmsg');
const step = (p, t) => { if (bar) bar.style.width = Math.round(p * 100) + '%'; if (t && msg) msg.textContent = t; };
const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

function fail(e) {
  console.error(e);
  if (!boot) return;
  boot.classList.remove('hide');
  const d = document.createElement('div'); d.className = 'boot-err';
  d.textContent = 'Не удалось запустить игру.\n' + (e && e.message ? e.message : String(e)) +
    '\n\nОткройте файл в актуальной версии Chrome, Edge, Firefox или Яндекс.Браузера и проверьте, что включено аппаратное ускорение графики.';
  boot.append(d);
  if (msg) msg.textContent = 'Ошибка запуска';
}

async function main() {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) throw new Error('Браузер не поддерживает WebGL 2 (или отключено аппаратное ускорение).');
  step(0.06, 'Загрузка шрифтов…');
  const faces = ['400 40px "Russo One"', '400 40px "Exo 2"', '600 40px "Exo 2"', '800 40px "Exo 2"', '400 40px "IBM Plex Sans"', '500 40px "IBM Plex Sans"',
    '600 40px "IBM Plex Sans"', '400 40px "JetBrains Mono"', '700 40px "JetBrains Mono"'];
  await Promise.race([Promise.all(faces.map(f => document.fonts.load(f, 'АБВабв ABC 123').catch(() => null))), new Promise(r => setTimeout(r, 3000))]);
  step(0.22, 'Физический движок…');
  await frame();
  await initRapier();
  step(0.42, 'Графика и постобработка…');
  await frame();
  const game = new Game($('gl'), $('ui'));
  window.__game = game;
  step(0.6, 'Материалы…');
  await frame();
  initMaterials(game.engine.renderer, (QUALITY[game.settings.quality] || QUALITY.high).texSize);
  step(0.74, 'Освещение…');
  await frame();
  game.engine.scene.environment = makeEnvironment(game.engine.renderer);
  step(0.88, 'Главное меню…');
  await frame();
  game.showMenu();
  step(1, 'Готово');
  await frame();
  boot.classList.add('hide');
  setTimeout(() => boot.remove(), 1500);
}

window.addEventListener('error', e => { if (boot && boot.isConnected && !boot.classList.contains('hide')) fail(e.error || e.message); });
main().catch(fail);
