// KaTeX helpers: render TeX strings and $...$ inside HTML
import katex from 'katex';
const cache = new Map();
export function tex(s, display = false) {
  const k = (display ? 'D|' : 'I|') + s;
  if (cache.has(k)) return cache.get(k);
  let h;
  try { h = katex.renderToString(s, { throwOnError: false, displayMode: display, strict: 'ignore', trust: false }); } catch (e) { h = s; }
  cache.set(k, h); return h;
}
// replace $$...$$ (display) and $...$ (inline) in html string
export function rich(html) {
  if (!html) return '';
  return String(html).replace(/\$\$([^$]+)\$\$/g, (_, t) => tex(t, true)).replace(/\$([^$]+)\$/g, (_, t) => tex(t, false));
}
