const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ offline: true })).newPage();
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForFunction(() => window.PFX && PFX.state === 'ready', null, { timeout: 180000 });
  const rows = [];
  for (const f of ['xf_offtopic.json', 'xf_heldout.json', 'xf_third.json', 'xf_fourth.json', 'xf_new.json']) {
    const T = JSON.parse(fs.readFileSync(path.join(__dirname, f)));
    for (const side of Object.keys(T)) {
      const r = await p.evaluate(async ([side, qs]) => { state.side = side; const out = []; for (const [q, want] of qs) { const a = await PFX.rank(fzCorrectQuery(q), side, 'prefires'); out.push({ q, want, top: a[0].id, logit: a[0].logit, ok: want.includes(a[0].id), none: want[0] === 'NONE' }); } return out; }, [side, T[side]]);
      rows.push(...r.map(x => ({ ...x, f })));
    }
  }
  const off = rows.filter(r => r.none).map(r => r.logit).sort((a, b) => b - a), good = rows.filter(r => !r.none && r.ok).map(r => r.logit).sort((a, b) => a - b), bad = rows.filter(r => !r.none && !r.ok).map(r => r.logit).sort((a, b) => b - a);
  console.log('off-topic top logits (highest first):', off.slice(0, 6).map(x => x.toFixed(1)).join(' '));
  console.log('correct AI answers, lowest logits:', good.slice(0, 8).map(x => x.toFixed(1)).join(' '), '| count', good.length);
  console.log('wrong AI answers, highest logits:', bad.slice(0, 8).map(x => x.toFixed(1)).join(' '), '| count', bad.length);
  for (const th of [2, 3, 4, 5, 6]) console.log(`threshold ${th}: off-topic answered ${off.filter(x => x >= th).length}/${off.length}, correct kept ${good.filter(x => x >= th).length}, wrong kept ${bad.filter(x => x >= th).length}`);
  await b.close();
})();
