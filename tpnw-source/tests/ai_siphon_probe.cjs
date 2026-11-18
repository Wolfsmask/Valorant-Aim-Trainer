const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ offline: true })).newPage();
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForFunction(() => window.PFX && PFX.state === 'ready', null, { timeout: 180000 });
  const rows = [];
  const fresh = { PRO: [], CON: [] }; JSON.parse(fs.readFileSync(path.join(__dirname, 'search_fresh.json'))).forEach(([s, q, w]) => fresh[s].push([q, String(w).split('|')]));
  const off = JSON.parse(fs.readFileSync(path.join(__dirname, 'xf_offtopic.json'))); for (const s in off) off[s] = off[s].map(([q]) => [q, [null]]);
  for (const f of ['siphon_tests.json', 'siphon_heldout.json', 'siphon_new.json', 'siphon_neg.json', 'FRESH', 'OFF']) {
    const T = f === 'FRESH' ? fresh : f === 'OFF' ? off : JSON.parse(fs.readFileSync(path.join(__dirname, f)));
    for (const side of Object.keys(T)) {
      const r = await p.evaluate(async ([side, qs]) => { state.side = side; const out = []; for (const [q, want] of qs) { const a = await PFX.rank(fzCorrectQuery(q), side, 'blocks'); siphonRebuttalsFromText(q, ''); const lexHit = state.autoMatchedRebuttalIds.length + state.autoMatchedFrontlineIds.length > 0; out.push({ q, want, top: a[0].id, logit: a[0].logit, lexHit }); } return out; }, [side, T[side]]);
      rows.push(...r.map(x => ({ ...x, f, neg: x.want[0] === null })));
    }
  }
  for (const th of [-5, -4, -3, -2, -1, 0, 2, 4]) {
    const neg = rows.filter(r => r.neg && r.logit >= th).length;
    const pos = rows.filter(r => !r.neg && r.logit >= th);
    console.log(`T=${th}: negatives firing ${neg}/${rows.filter(r => r.neg).length} | positives above T ${pos.length}, correct ${pos.filter(r => r.want.includes(r.top)).length}, wrong ${pos.filter(r => !r.want.includes(r.top)).length} | lexical-miss rescued ${pos.filter(r => !r.lexHit && r.want.includes(r.top)).length}, lexical-miss wrong ${pos.filter(r => !r.lexHit && !r.want.includes(r.top)).length}`);
  }
  rows.filter(r => r.neg).sort((a, b) => b.logit - a.logit).slice(0, 4).forEach(r => console.log('  neg', r.logit.toFixed(1), r.q));
  await b.close();
})();
