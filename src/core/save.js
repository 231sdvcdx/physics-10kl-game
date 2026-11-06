// Persistent state in localStorage (autosave)
const KEY = 'konstanta.save.v1';
const SKEY = 'konstanta.settings.v1';
const LKEY = 'konstanta.library.v1'; // lessons unlocked across playthroughs

export function defaultSettings() {
  let q = 'high';
  try { const c = document.createElement('canvas').getContext('webgl2'); const dbg = c && c.getExtension('WEBGL_debug_renderer_info'); const r = dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ''; if (/Intel|UHD|Iris|Mali|Adreno|SwiftShader|llvmpipe/i.test(r)) q = 'medium'; if (/SwiftShader|llvmpipe/i.test(r)) q = 'low'; } catch (e) { }
  return { sens: 1, fov: 75, master: 0.8, music: 0.55, sfx: 0.8, voice: 1, tts: true, subs: true, subSize: 1, quality: q, showFps: false, invertY: false, bob: 1, uiScale: 1 };
}
export function loadSettings() {
  try { return { ...defaultSettings(), ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch (e) { return defaultSettings(); }
}
export function saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { } }

export function newSave(difficulty = 'student') {
  return {
    v: 1, difficulty, seed: (Math.random() * 2 ** 31) | 0, created: Date.now(), updated: Date.now(), playTime: 0,
    chapter: 'prologue', checkpoint: 'start', pos: null, flags: {}, items: [], tools: [], activeTool: null,
    formulas: [], lessons: {}, problems: {}, cards: [], notes: [], measurements: [], vision: [],
    stats: { topics: {} }, stars: 0, completed: {},
  };
}
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) { }
  return null;
}
export function writeSave(s) { if (!s) return; s.updated = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('save failed', e); } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { } }
export function loadLibrary() { try { return JSON.parse(localStorage.getItem(LKEY) || '{"lessons":[],"cards":[]}'); } catch (e) { return { lessons: [], cards: [] }; } }
export function saveLibrary(l) { try { localStorage.setItem(LKEY, JSON.stringify(l)); } catch (e) { } }

export function topicStats(save, topic) {
  return (save.stats.topics[topic] ||= { attempts: 0, errors: 0, hints: 0, errorTypes: {}, quizRight: 0, quizWrong: 0, solved: 0, time: 0 });
}
