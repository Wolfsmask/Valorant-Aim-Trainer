import fs from 'fs';
import { pipeline } from '@huggingface/transformers';
const D = JSON.parse(fs.readFileSync('../v7/data7_final.json', 'utf8')).DEBATE_DATA;
const items = {}; for (const s of ['PRO', 'CON']) items[s] = [...D[s].rebuttals, ...D[s].frontlines, ...D[s].counterDefenses].map(b => ({ id: b.id, text: [b.chipLabel.replace(/^[^:]*?\d+[A-Z]?[.:]\s*/, ''), b.trigger || '', (b.keywords || []).join(', ')].join('. ') }));
const load = f => JSON.parse(fs.readFileSync('../tests/' + f)).map(([s, q, w]) => ({ s, q, want: String(w).split('|') }));
const sets = { fresh: load('search_fresh.json'), para: load('search_paraphrase.json'), held: load('search_heldout.json') };
const cos = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; };
const models = JSON.parse(process.argv[2]);
for (const [m, pool, qp, dp] of models) {
  try {
    const t0 = Date.now();
    const ext = await pipeline('feature-extraction', m, { dtype: 'q8' });
    const E = async ts => (await ext(ts, { pooling: pool, normalize: true })).tolist();
    const all = {}; for (const s of ['PRO', 'CON']) all[s] = await E(items[s].map(i => dp + i.text));
    const out = [];
    for (const [k, Q] of Object.entries(sets)) { const eq = await E(Q.map(x => qp + x.q)); let t1 = 0, t4 = 0; Q.forEach((x, i) => { const r = items[x.s].map((it, j) => [it.id, cos(eq[i], all[x.s][j])]).sort((a, b) => b[1] - a[1]).map(r => r[0]); if (x.want.includes(r[0])) t1++; if (r.slice(0, 4).some(id => x.want.includes(id))) t4++; }); out.push(`${k} ${t4}/${Q.length} (top1 ${t1})`); }
    console.log(m.padEnd(42), out.join(' | '), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  } catch (e) { console.log(m, 'FAILED', e.message.slice(0, 120)); }
}
