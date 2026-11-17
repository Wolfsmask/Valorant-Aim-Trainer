const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(400);
  const qs = JSON.parse(process.argv[3]);
  const r = await p.evaluate(qs => qs.map(([side, q]) => { state.side = side; const fixed = fzCorrectQuery(q); const fz = fzRank(fzSideIndex(side), q).slice(0, 6).map(x => x.key + ':' + x.score.toFixed(1) + '/' + x.coverage.toFixed(2)); const toks = fzQueryTokens(q).map(t => t + '→' + fzMatchToken(t).slice(0, 4).map(m => m.stem + m.sim.toFixed(2)).join(',')); const all = aiSemanticRankAllBlocksForSide(q, side).results.slice(0, 6).map(x => x.id); return { q, fixed, toks, fz, all }; }), qs);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
