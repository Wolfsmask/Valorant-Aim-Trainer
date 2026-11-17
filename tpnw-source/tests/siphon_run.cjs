// node siphon_run.cjs <file.html> <tests.json> [reb|fl|any] → per-sentence siphon accuracy
// reb: top rebuttal must be one of `want`; fl: top frontline; any: `want` [null] means nothing should match
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const FILE = path.resolve(process.argv[2]); const T = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8'));
  const KIND = process.argv[4] || 'reb';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE); await p.waitForTimeout(500);
  let ok = 0, tot = 0, none = 0; const fails = [];
  for (const side of ['PRO', 'CON']) {
    if (!T[side] || !T[side].length) continue;
    const res = await p.evaluate(([side, tests, kind]) => {
      state.side = side;
      return tests.map(([s, want]) => {
        siphonRebuttalsFromText(s, '');
        const got = kind === 'fl' ? [...state.autoMatchedFrontlineIds] : kind === 'any' ? [...state.autoMatchedRebuttalIds, ...state.autoMatchedFrontlineIds] : [...state.autoMatchedRebuttalIds];
        return { s, want, got };
      });
    }, [side, T[side], KIND]);
    for (const r of res) {
      tot++; const top = r.got.length ? r.got[0] : null; if (!top) none++;
      const good = r.want[0] === null ? r.got.length === 0 : r.want.includes(top);
      if (good) ok++; else fails.push(`${side} | ${r.s.slice(0, 95)} | want ${r.want.join('/') || 'nothing'} | got ${r.got.join(',') || 'NONE'}`);
    }
  }
  console.log(`correct: ${ok}/${tot}  (no match: ${none})`); fails.forEach(f => console.log('  ✗ ' + f));
  if (errs.length) console.log('page errors:', errs.slice(0, 3));
  await b.close();
})();
