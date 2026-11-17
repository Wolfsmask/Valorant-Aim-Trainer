// Crossfire accuracy through the app's real matchCrossfirePrefire(): node test/xf_ui_recall.cjs <file.html> <questions.json>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const Q = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8'));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(400);
  let ok = 0, tot = 0, soft = 0; const fails = [];
  for (const side of ['PRO', 'CON']) {
    const res = await p.evaluate(([side, qs]) => { state.side = side; const inp = document.getElementById('crossfireQuestionInput'); const box = document.getElementById('crossfirePrefireResult');
      return qs.map(([q, want]) => { inp.value = q; matchCrossfirePrefire(0); const txt = box.textContent.replace(/\s+/g, ' ');
        const pf = DEBATE_DATA[side].prefires.find(x => txt.includes(x.topicLabel)); return { q, want, got: pf ? pf.id : null, soft: /Closest Answer/.test(txt) }; }); }, [side, Q[side]]);
    for (const r of res) { tot++; if (r.soft) soft++; const good = r.want.includes(r.got) || (r.want[0] === 'NONE' && !r.got); if (good) ok++; else fails.push(`${side} | ${r.q} | want ${r.want.join('/')} | got ${r.got || 'NONE'}${r.soft ? ' (closest)' : ''}`); }
  }
  console.log(`correct ${ok}/${tot} (closest-answer used ${soft})`); fails.slice(0, 6).forEach(f => console.log('  ✗ ' + f)); if (errs.length) console.log('errors', errs.slice(0, 3));
  await b.close();
})();