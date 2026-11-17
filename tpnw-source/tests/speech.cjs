const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  for (const file of process.argv.slice(2)) {
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const p = await (await b.newContext({ offline: true })).newPage();
    await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const out = {}; for (const side of ['PRO', 'CON']) { state.side = side; const opp = side === 'PRO' ? 'CON' : 'PRO';
      siphonRebuttalsFromText(DEBATE_DATA[opp].constructiveParagraphs.join(' '), '');
      const lab = id => { const blk = [...DEBATE_DATA[side].rebuttals, ...DEBATE_DATA[side].frontlines].find(x => x.id === id); return id + ' (' + (blk ? blk.chipLabel : '?') + ')'; };
      out[side] = { reb: state.autoMatchedRebuttalIds.map(lab), fl: state.autoMatchedFrontlineIds.map(lab) }; } return out; });
    console.log('==', path.basename(file)); for (const s of ['PRO', 'CON']) console.log(' ', s, 'user vs opponent constructive →\n    rebuttals:', r[s].reb.join(' | ') || '-', '\n    frontlines:', r[s].fl.join(' | ') || '-');
    await b.close();
  }
})();