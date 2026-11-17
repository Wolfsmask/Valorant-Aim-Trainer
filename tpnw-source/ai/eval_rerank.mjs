import fs from 'fs';
import { pipeline, AutoTokenizer, AutoModelForSequenceClassification } from '@huggingface/transformers';
const D = JSON.parse(fs.readFileSync('../v7/data7_final.json', 'utf8')).DEBATE_DATA;
const items = {}; for (const s of ['PRO', 'CON']) items[s] = [...D[s].rebuttals, ...D[s].frontlines, ...D[s].counterDefenses].map(b => ({ id: b.id, text: [b.chipLabel.replace(/^[^:]*?\d+[A-Z]?[.:]\s*/, ''), b.trigger || '', (b.keywords || []).join(', ')].join('. ') }));
const load = f => JSON.parse(fs.readFileSync('../tests/' + f)).map(([s, q, w]) => ({ s, q, want: String(w).split('|') }));
const sets = { fresh: load('search_fresh.json'), para: load('search_paraphrase.json'), held: load('search_heldout.json') };
const cos = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; };
const ext = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' });
const E = async ts => (await ext(ts, { pooling: 'cls', normalize: true })).tolist();
const all = {}; for (const s of ['PRO', 'CON']) all[s] = await E(items[s].map(i => i.text));
for (const rm of JSON.parse(process.argv[2])) {
  const tok = await AutoTokenizer.from_pretrained(rm); const model = await AutoModelForSequenceClassification.from_pretrained(rm, { dtype: 'q8' });
  const out = [];
  for (const [k, Q] of Object.entries(sets)) {
    const eq = await E(Q.map(x => 'Represent this sentence for searching relevant passages: ' + x.q)); let t1 = 0, t4 = 0, b1 = 0, b4 = 0;
    for (let i = 0; i < Q.length; i++) { const x = Q[i];
      const base = items[x.s].map((it, j) => [it, cos(eq[i], all[x.s][j])]).sort((a, b) => b[1] - a[1]).slice(0, 12);
      if (x.want.includes(base[0][0].id)) b1++; if (base.slice(0, 4).some(r => x.want.includes(r[0].id))) b4++;
      const inp = tok(new Array(base.length).fill(x.q), { text_pair: base.map(r => r[0].text), padding: true, truncation: true });
      const logits = (await model(inp)).logits.tolist().map(l => l[0]);
      // blend reranker with embedding rank so neither alone decides
      const r = base.map((b, j) => [b[0].id, logits[j] + 8 * b[1]]).sort((a, b) => b[1] - a[1]).map(r => r[0]);
      if (x.want.includes(r[0])) t1++; if (r.slice(0, 4).some(id => x.want.includes(id))) t4++; }
    out.push(`${k} ${b4}->${t4}/${Q.length} (top1 ${b1}->${t1})`);
  }
  console.log(rm.padEnd(38), out.join(' | '));
}
