import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const NM = 'node_modules';
const minify = !process.argv.includes('--dev');
const argv = process.argv; const ai = k => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : null; };
const ENTRY = ai('--entry') || 'src/main.js', OUT = ai('--out') || 'dist/index.html';

function b64(file){ return fs.readFileSync(file).toString('base64'); }

// ---------- fonts ----------
function fontsourceCSS(pkg, weights, subsets = ['latin','cyrillic']){
  let out = '';
  for (const w of weights){
    const cssFile = path.join(NM, '@fontsource', pkg, `${w}.css`);
    const css = fs.readFileSync(cssFile, 'utf8');
    const blocks = css.split('@font-face').slice(1);
    for (const blk of blocks){
      const m = blk.match(/files\/([^)'"]+?)-(latin|cyrillic|latin-ext|cyrillic-ext|greek|vietnamese|math|symbols)-(\d+)-(normal|italic)\.woff2/);
      if (!m) continue;
      const subset = m[2];
      if (!subsets.includes(subset)) continue;
      if (m[4] !== 'normal') continue;
      const fam = blk.match(/font-family:\s*'([^']+)'/)[1];
      const ur = (blk.match(/unicode-range:\s*([^;]+);/)||[])[1];
      const file = path.join(NM, '@fontsource', pkg, 'files', `${m[1]}-${subset}-${m[3]}-normal.woff2`);
      out += `@font-face{font-family:'${fam}';font-style:normal;font-display:block;font-weight:${m[3]};src:url(data:font/woff2;base64,${b64(file)}) format('woff2');${ur?`unicode-range:${ur};`:''}}\n`;
    }
  }
  return out;
}

function katexCSS(){
  let css = fs.readFileSync(path.join(NM, 'katex/dist/katex.min.css'), 'utf8');
  css = css.replace(/src:url\(fonts\/([^)]+?)\.woff2\) format\("woff2"\)(,url\([^)]+\) format\("[a-z]+"\))*/g, (all, name) => {
    const file = path.join(NM, 'katex/dist/fonts', name + '.woff2');
    return `src:url(data:font/woff2;base64,${b64(file)}) format("woff2")`;
  });
  return css;
}

const t0 = Date.now();
const result = await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  format: 'iife',
  minify,
  sourcemap: false,
  target: ['chrome100', 'edge100'],
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
let js = result.outputFiles[0].text;
js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

let fonts = '';
fonts += fontsourceCSS('russo-one', [400]);
fonts += fontsourceCSS('exo-2', [400, 600, 800]);
fonts += fontsourceCSS('ibm-plex-sans', [400, 500, 600]);
fonts += fontsourceCSS('jetbrains-mono', [400, 700]);

const css = fs.readFileSync('src/styles.css', 'utf8');
let html = fs.readFileSync('src/index.html', 'utf8');
html = html.replace('/*__FONTS__*/', () => fonts)
           .replace('/*__KATEX__*/', () => katexCSS())
           .replace('/*__STYLES__*/', () => css)
           .replace('/*__SCRIPT__*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`built ${OUT} ${(html.length/1024/1024).toFixed(2)} MB (js ${(js.length/1024).toFixed(0)} KB) in ${Date.now()-t0} ms`);
