// For every opposing attack: does the app give a real answer?
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const O = JSON.parse(fs.readFileSync(path.join(__dirname, '../v7/opponent_cases.json'), 'utf8'));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(500);
  const out = { PRO: [], CON: [] };
  for (const [side, key] of [['PRO', 'vs_pro'], ['CON', 'vs_con']]) {
    const items = O[key].map(x => ({ name: x.name, attack: x.attack, freq: x.frequency }));
    const res = await p.evaluate(async ([side, items]) => {
      state.side = side; const r = [];
      for (const it of items) {
        // 1. siphon: does typing their argument surface a counter?
        siphonRebuttalsFromText(it.attack, '');
        const sip = [...state.autoMatchedRebuttalIds, ...state.autoMatchedFrontlineIds, ...state.autoMatchedCounterDefenseIds];
        // 2. crossfire: does the question matcher produce a confident prefire?
        const inp = document.getElementById('crossfireQuestionInput');
        const box = document.getElementById('crossfirePrefireResult');
        inp.value = it.attack; matchCrossfirePrefire(0);
        const txt = box.textContent.replace(/\s+/g, ' ');
        const pf = DEBATE_DATA[side].prefires.find(x => txt.includes(x.topicLabel));
        r.push({ name: it.name, freq: it.freq, siphon: sip.slice(0, 3), xf: pf ? pf.id : null, soft: /Closest Answer|NO PREFIRED/.test(txt) });
      }
      return r;
    }, [side, items]);
    out[side] = res;
  }
  for (const side of ['PRO', 'CON']) {
    const rows = out[side];
    const naked = rows.filter(r => r.siphon.length === 0 && (!r.xf || r.soft));
    const weak = rows.filter(r => !naked.includes(r) && (r.siphon.length === 0 || r.soft));
    console.log(`\n===== Playing ${side}: ${rows.length} attacks thrown at us`);
    console.log(`  covered well: ${rows.length - naked.length - weak.length} | thin: ${weak.length} | NO ANSWER: ${naked.length}`);
    naked.forEach(r => console.log(`   ✗ NO ANSWER [${r.freq}] ${r.name}`));
    weak.forEach(r => console.log(`   ~ thin [${r.freq}] ${r.name} (siphon ${r.siphon.join(',') || 'none'}${r.soft ? ', xf only closest' : ''})`));
  }
  fs.writeFileSync(path.join(__dirname, '../v7/coverage_out.json'), JSON.stringify(out, null, 1));
  await b.close();
})();
