// Probe crossfire output for given queries: node tests/xf_probe.cjs <file> <side> "q1" "q2" ...
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const [file, side, ...qs] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(400);
  for (const q of qs) {
    const r = await p.evaluate(([side, q]) => { state.side = side; const inp = document.getElementById('crossfireQuestionInput'); inp.value = q; try { matchCrossfirePrefire(0); } catch (e) { return 'THROWS: ' + e.message; }
      const qNorm = normalizeForMatch(q); const u = typeof universalRankAllPrefiresAndBlocks === 'function' ? universalRankAllPrefiresAndBlocks(q, qNorm).slice(0, 2).map(x => x.pf.id + ':' + Math.round(x.score)).join(' ') : '';
      return document.getElementById('crossfirePrefireResult').textContent.replace(/\s+/g, ' ').trim().slice(0, 110) + '  || universal: ' + u; }, [side, q]);
    console.log(side, '|', q.padEnd(40), '→', r);
  }
  if (errs.length) console.log('PAGE ERRORS', errs);
  await b.close();
})();
