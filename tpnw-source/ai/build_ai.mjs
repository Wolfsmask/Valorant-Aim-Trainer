// Build the offline AI search block for PF.html.
// usage: node build_ai.mjs <data.json> <out-snippet.html>
// Bundles: BGE-small-en-v1.5 (q8, embeddings), MS-MARCO MiniLM-L-6-v2 (q8, re-ranker),
// transformers.js 3.5.2 + ONNX Runtime Web wasm, and precomputed embeddings for every card.
import fs from 'fs'; import zlib from 'zlib'; import path from 'path';
import { pipeline } from '@huggingface/transformers';
const [DATA, OUT] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(DATA, 'utf8')).DEBATE_DATA;
const C = 'node_modules/@huggingface/transformers/.cache';
const EMB = 'Xenova/bge-small-en-v1.5', RR = 'Xenova/ms-marco-MiniLM-L-6-v2';
const QPRE = 'Represent this sentence for searching relevant passages: ';

// --- item texts (same recipe used in the evaluation) ---
const blockText = b => [b.chipLabel.replace(/^[^:]*?\d+[A-Z]?[.:]\s*/, ''), b.trigger || '', (b.keywords || []).join(', ')].join('. ');
const pfText = p => [p.topicLabel, (p.phrases || []).join(', '), (p.keywords || []).join(', ')].join('. ');
const cardText = c => [c.short, c.title, String(c.takeaway || '').slice(0, 400)].join('. ');
const groups = {};
for (const s of ['PRO', 'CON']) {
  groups[s + ':blocks'] = [...D[s].rebuttals, ...D[s].frontlines, ...(D[s].counterDefenses || [])].map(b => [b.id, blockText(b)]);
  groups[s + ':prefires'] = D[s].prefires.map(p => [p.id, pfText(p)]);
}
groups['cards'] = D.SOURCE_CARDS.map(c => [c.short, cardText(c)]);

const ext = await pipeline('feature-extraction', EMB, { dtype: 'q8' });
const index = {};
for (const [g, list] of Object.entries(groups)) {
  const vecs = (await ext(list.map(x => x[1]), { pooling: 'cls', normalize: true })).tolist();
  // int8 quantization with one scale per vector
  const dim = vecs[0].length; const q = new Int8Array(vecs.length * dim); const scales = [];
  vecs.forEach((v, i) => { const m = Math.max(...v.map(Math.abs)) || 1; scales.push(+(m / 127).toPrecision(7)); v.forEach((x, k) => { q[i * dim + k] = Math.round(x / m * 127); }); });
  index[g] = { ids: list.map(x => x[0]), texts: list.map(x => x[1]), dim, scales, q: Buffer.from(q.buffer).toString('base64') };
}

const gzb64 = buf => zlib.gzipSync(buf, { level: 9 }).toString('base64');
const assets = {
  'lib': 'node_modules/@huggingface/transformers/dist/transformers.min.js',
  'wasm': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
  'mjs': 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
};
for (const m of [EMB, RR]) for (const f of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']) assets[m + '/resolve/main/' + f] = path.join(C, m, f);
let html = '\n<!-- ================= OFFLINE AI SEARCH ================= -->\n';
html += '<!-- AI models: BGE-small-en-v1.5 (MIT, BAAI) and ms-marco-MiniLM-L-6-v2 (Apache-2.0); runtime: transformers.js 3.5.2 (Apache-2.0) + ONNX Runtime Web (MIT). Stored gzip+base64 so the file works with no internet. -->\n';
for (const [k, f] of Object.entries(assets)) html += `<script type="application/octet-stream" data-pfai="${k}">${gzb64(fs.readFileSync(f))}</script>\n`;
html += `<script type="application/json" id="pfai-index">${JSON.stringify(index).replace(/</g, '\\u003c')}</script>\n`;
html += `<script>\n${fs.readFileSync('pfai_runtime.js', 'utf8')}\n</script>\n`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1e6).toFixed(1), 'MB', Object.fromEntries(Object.entries(index).map(([g, v]) => [g, v.ids.length])));
