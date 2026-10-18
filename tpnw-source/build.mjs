// Build the offline, fact-corrected TPNW app from Gemini's original HTML.
// Rebuild: cd tpnw-source && npm install && node build.mjs
// (defaults: gemini-original.html -> ../tpnw.html using fact-edits.json, code-fixes.json, label-fixes.json)
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const arg = (i, d) => process.argv[i] || path.join(HERE, d);
const [SRC, OUT, EDITS, FIXES, LABELS] = [arg(2, 'gemini-original.html'), arg(3, '../tpnw.html'), arg(4, 'fact-edits.json'), arg(5, 'code-fixes.json'), arg(6, 'label-fixes.json')];
const TW = HERE;
let html = fs.readFileSync(SRC, 'utf8');
const report = { dataEdits: 0, dataEditsFailed: [], codeFixes: 0, codeFixesFailed: [], labels: 0 };

/* ---------- 1. data edits ---------- */
function blockRange(name, endMarker) {
  const a = html.indexOf('const ' + name + ' = ') + ('const ' + name + ' = ').length;
  const b = html.indexOf(endMarker, a);
  const body = html.slice(a, b); const end = body.lastIndexOf('}') + 1;
  return [a, a + end];
}
function getPath(obj, p) {
  const parts = p.replace(/^[A-Z_]+\.?/, '').match(/[^.[\]]+/g) || [];
  let o = obj; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  return { parent: o, key: parts[parts.length - 1] };
}
if (EDITS && fs.existsSync(EDITS)) {
  const edits = JSON.parse(fs.readFileSync(EDITS, 'utf8'));
  // DEBATE_DATA is exact JSON.stringify(…,2) → parse, edit, re-serialize (zero diff elsewhere)
  let [a, b] = blockRange('DEBATE_DATA', '// ====');
  const D = JSON.parse(html.slice(a, b));
  // closing objects are JS literals → evaluate, edit, then replace string literals textually
  const lit = {};
  for (const [name, endM] of [['DEFAULT_CLOSING_SCRIPTS', 'const CLOSING_SNIPPETS'], ['CLOSING_SNIPPETS', 'const state']]) {
    const [x, y] = blockRange(name, endM); lit[name] = { src: html.slice(x, y), obj: eval('(' + html.slice(x, y) + ')') };
  }
  for (const e of edits) {
    const root = e.path.startsWith('DEBATE_DATA') ? D : e.path.startsWith('DEFAULT_CLOSING_SCRIPTS') ? lit.DEFAULT_CLOSING_SCRIPTS.obj : e.path.startsWith('CLOSING_SNIPPETS') ? lit.CLOSING_SNIPPETS.obj : null;
    if (!root) { report.dataEditsFailed.push({ ...e, why: 'bad root' }); continue; }
    let ref; try { ref = getPath(root, e.path); } catch (err) { report.dataEditsFailed.push({ ...e, why: 'bad path' }); continue; }
    const cur = ref.parent && ref.parent[ref.key];
    if (typeof cur !== 'string' || !cur.includes(e.find)) { report.dataEditsFailed.push({ path: e.path, find: e.find, why: 'find not in string' }); continue; }
    if (!e.path.startsWith('DEBATE_DATA')) {
      const L = lit[e.path.split('.')[0]];
      const oldLit = JSON.stringify(cur), newText = cur.split(e.find).join(e.replace), newLit = JSON.stringify(newText);
      if (!L.src.includes(oldLit)) { report.dataEditsFailed.push({ path: e.path, why: 'literal not found' }); continue; }
      L.src = L.src.replace(oldLit, newLit);
    }
    ref.parent[ref.key] = cur.split(e.find).join(e.replace);
    report.dataEdits++;
  }
  // write back (do closing literals first: they come after DEBATE_DATA, so offsets of DEBATE_DATA unaffected)
  for (const [name, endM] of [['CLOSING_SNIPPETS', 'const state'], ['DEFAULT_CLOSING_SCRIPTS', 'const CLOSING_SNIPPETS']]) {
    const [x, y] = blockRange(name, endM); html = html.slice(0, x) + lit[name].src + html.slice(y);
  }
  [a, b] = blockRange('DEBATE_DATA', '// ====');
  html = html.slice(0, a) + JSON.stringify(D, null, 2) + html.slice(b);
}

/* ---------- 2. code fixes + UI label fixes (exact, unique find/replace) ---------- */
for (const [file, kind] of [[FIXES, 'codeFixes'], [LABELS, 'labels']]) {
  if (!file || !fs.existsSync(file)) continue;
  for (const f of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const n = html.split(f.find).length - 1;
    if (n !== 1 && !(f.all && n > 0)) { (report[kind + 'Failed'] = report[kind + 'Failed'] || []).push({ title: f.title, n }); continue; }
    html = f.all ? html.split(f.find).join(f.replace) : html.replace(f.find, () => f.replace);
    report[kind]++;
  }
}

/* ---------- 3. offline: inline Tailwind (compiled, same v3.4.17) + fonts ---------- */
fs.writeFileSync(path.join(TW, '.content.html'), html);
fs.writeFileSync(path.join(TW, '.in.css'), '@tailwind base; @tailwind components; @tailwind utilities;');
execSync(`npx tailwindcss -i .in.css --content .content.html -o .tw.css --minify`, { cwd: TW, stdio: 'pipe' });
const tw = fs.readFileSync(path.join(TW, '.tw.css'), 'utf8');
for (const f of ['.content.html', '.in.css', '.tw.css']) fs.unlinkSync(path.join(TW, f));
const cdn = '<script src="https://cdn.tailwindcss.com/3.4.17"></script>';
if (!html.includes(cdn)) throw new Error('tailwind CDN tag not found');
html = html.replace(cdn, () => '<style id="tw-offline">' + tw + '</style>');
const F = path.join(TW, 'node_modules/@fontsource');
const face = (fam, file, w, st) => `@font-face{font-family:'${fam}';font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(F, file)).toString('base64')}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`;
const fonts = [400, 500, 600, 700].map(w => face('Inter', `inter/files/inter-latin-${w}-normal.woff2`, w, 'normal')).join('') +
  [500, 600, 700].map(w => face('Lora', `lora/files/lora-latin-${w}-normal.woff2`, w, 'normal')).join('') + face('Lora', 'lora/files/lora-latin-400-italic.woff2', 400, 'italic');
const linkRe = /\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/;
if (!linkRe.test(html)) throw new Error('google fonts links not found');
html = html.replace(linkRe, () => '\n  <style id="fonts-offline">' + fonts + '</style>');
if (/https:\/\/(cdn\.tailwindcss|fonts\.g)/.test(html)) throw new Error('online dependency left');

fs.writeFileSync(OUT, html);
/* syntax check of the app script */
const s1 = html.lastIndexOf('<script>') + 8, s2 = html.lastIndexOf('</script>');
new Function(html.slice(s1, s2));
console.log(JSON.stringify(report, null, 1)); console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB');
