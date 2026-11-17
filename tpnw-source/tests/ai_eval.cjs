// node tests/ai_eval.cjs file.html [wLex wAi k] → loads the offline AI (no network) and scores fused search
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ offline: true }); const p = await ctx.newPage();
  const errs = [], net = []; p.on('pageerror', e => errs.push(e.message)); p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  const t0 = Date.now(); await p.goto('file://' + path.resolve(process.argv[2]), { timeout: 120000 });
  const tLoad = Date.now() - t0;
  await p.waitForFunction(() => window.PFAI && (PFAI.state === 'ready' || PFAI.state === 'failed'), null, { timeout: 180000 });
  console.log('page load', tLoad, 'ms; AI ready after', Date.now() - t0, 'ms; state', await p.evaluate(() => PFAI.state + ' ' + PFAI.error));
  if (process.argv[3]) await p.evaluate(w => { PFAI.weights = { wLex: +w[0], wAi: +w[1], k: +w[2], typoDamp: +(w[3] || 0.6) }; }, process.argv.slice(3, 7));
  const load = f => JSON.parse(fs.readFileSync(path.join(__dirname, f))).map(([s, q, w]) => ({ s, q, want: String(w).split('|') }));
  for (const f of ['search_fresh.json', 'search_paraphrase.json', 'search_heldout.json']) {
    const Q = load(f);
    const res = await p.evaluate(async Q => { const out = []; for (const x of Q) { state.side = x.s; const t = performance.now(); const r = await PFAI.fusedBlocks(x.q, x.s); out.push({ ...x, got: r.results.slice(0, 4).map(b => b.id), ai: r.ai.slice(0, 4).map(b => b.id), ms: performance.now() - t }); } return out; }, Q);
    let t1 = 0, t4 = 0, a4 = 0; const fails = []; let ms = 0;
    res.forEach(r => { ms += r.ms; if (r.want.includes(r.got[0])) t1++; if (r.got.some(g => r.want.includes(g))) t4++; else fails.push(`${r.q} → ${r.got.join(',')}`); if (r.ai.some(g => r.want.includes(g))) a4++; });
    console.log(`${f}: fused top4 ${t4}/${Q.length} top1 ${t1} | AI-only top4 ${a4} | avg ${(ms / Q.length).toFixed(0)} ms`); fails.forEach(x => console.log('   ✗', x));
  }
  // misspelled queries (label/trigger) through fused
  const items = await p.evaluate(() => { const out = []; for (const side of ['PRO', 'CON']) { const d = DEBATE_DATA[side]; [...d.rebuttals, ...d.frontlines, ...(d.counterDefenses || [])].forEach(bk => out.push({ side, id: bk.id, label: bk.chipLabel.replace(/^[^:]*?\d+[A-Z]?[.:]\s*/, ''), trigger: bk.trigger || '' })); } return out; });
  const src = fs.readFileSync(path.join(__dirname, 'search_eval.cjs'), 'utf8'); let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  eval(src.slice(src.indexOf('const STOP'), src.indexOf('(async () =>')));
  const TQ = []; items.forEach(it => { TQ.push({ s: it.side, want: [it.id], q: makeQuery(it.label, 3) }); TQ.push({ s: it.side, want: [it.id], q: makeQuery(it.trigger, 3) }); });
  const tr = await p.evaluate(async Q => { const out = []; for (const x of Q) { state.side = x.s; const r = await PFAI.fusedBlocks(x.q, x.s); out.push(r.results.slice(0, 4).map(b => b.id).some(g => x.want.includes(g))); } return out; }, TQ);
  console.log(`misspelled: fused top4 ${tr.filter(Boolean).length}/${TQ.length}`);
  console.log('network requests:', net.length, net.slice(0, 3)); console.log('errors:', errs.slice(0, 5));
  await b.close();
})();
