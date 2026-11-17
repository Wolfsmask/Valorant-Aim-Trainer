const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ offline: true })).newPage();
await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(400);
const r = await p.evaluate(([side, q, ids]) => { state.side = side; const rq = fzCorrectQuery(q); const qn = normalizeForMatch(rq); const t = tokenizeNormalizedQuery(qn); return ids.map(id => { const pf = DEBATE_DATA[side].prefires.find(x => x.id === id); return id + ':' + scorePrefireAgainstQuery(pf, qn, t, rq); }); }, [process.argv[3], process.argv[4], process.argv.slice(5)]);
console.log(process.argv[4], r.join(' ')); await b.close(); })();
