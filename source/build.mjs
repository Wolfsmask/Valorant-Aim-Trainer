// Build PF Debate Hub into ONE self-contained, offline HTML file.
// Usage: node build.mjs [--no-ai]   (run from this folder; needs npm for the AI engine)
import fs from 'fs'; import zlib from 'zlib'; import path from 'path'; import { execSync } from 'child_process';
const here = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) || path.join(here, 'dist', 'index.html');
const noAI = process.argv.includes('--no-ai');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const gzb64 = buf => zlib.gzipSync(buf, { level: 9 }).toString('base64');

let ai = '';
if (!noAI) {
  const vend = path.join(here, '.vendor');
  const need = ['wllama/package/esm/index.min.js', 'wllama/package/esm/wasm/wllama.wasm', 'compat/package/wasm/wllama.wasm', 'compat/package/wasm/wllama.js'];
  if (!need.every(f => fs.existsSync(path.join(vend, f)))) {
    fs.mkdirSync(vend, { recursive: true });
    for (const [pkg, dir] of [['@wllama/wllama@3.8.1', 'wllama'], ['@wllama/wllama-compat@3.8.1', 'compat']]) {
      const tgz = execSync(`npm pack ${pkg} --silent`, { cwd: vend }).toString().trim().split('\n').pop();
      fs.mkdirSync(path.join(vend, dir), { recursive: true });
      execSync(`tar xzf ${tgz} -C ${dir}`, { cwd: vend });
    }
  }
  let lib = fs.readFileSync(path.join(vend, need[0]), 'utf8');
  lib = lib.replace(/export\{([^}]*)\};?\s*$/, (m, g) => 'window.WllamaLib={' + g.split(',').map(s => { const p = s.trim().split(/\s+as\s+/); return p.length === 2 ? `${p[1]}:${p[0]}` : p[0]; }).join(',') + '};');
  if (!/window\.WllamaLib=/.test(lib)) throw new Error('could not rewrite wllama exports');
  ai = [
    `<script id="pf-wllama" type="application/octet-stream" data-keep>${gzb64(Buffer.from(lib))}</script>`,
    `<script id="pf-wasm-main" type="application/octet-stream" data-keep>${gzb64(fs.readFileSync(path.join(vend, need[1])))}</script>`,
    `<script id="pf-wasm-compat" type="application/octet-stream" data-keep>${gzb64(fs.readFileSync(path.join(vend, need[2])))}</script>`,
    `<script id="pf-compat-js" type="application/octet-stream" data-keep>${gzb64(fs.readFileSync(path.join(vend, need[3])))}</script>`
  ].join('\n');
}
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PF Debate Hub — Data Center Moratorium</title>
<style id="pf-style">${read('app.css')}</style>
</head>
<body>
<div id="app"></div>
<script id="pf-data" type="application/json" data-keep>null</script>
<script id="pf-content" data-keep>${safe(read('content.js'))}</script>
<script id="pf-engine" data-keep>${safe(read('engine.js'))}</script>
${ai}
<script id="pf-app" data-keep>${safe(read('app.js'))}</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1e6).toFixed(2) + ' MB', noAI ? '(no AI engine)' : '(with offline AI engine)');
