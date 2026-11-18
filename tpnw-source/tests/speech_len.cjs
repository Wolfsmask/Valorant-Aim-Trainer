// Measures the speech the app actually hands you at each step, after a realistic round
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(400);
  const side = process.argv[3] || 'PRO';
  await p.click(side === 'PRO' ? '#btnSidePro' : '#btnSideCon'); await p.click('#btnOrderSecond');
  await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound'); await p.waitForTimeout(300);
  // simulate the opponent's case so the siphon picks rebuttals
  const opp = side === 'PRO'
    ? 'Nuclear deterrence has kept the peace for eighty years. The treaty is unverifiable and Russia will never sign it. Poland will build its own bomb without the American umbrella. Britain and France would have to destroy 515 warheads. Deterrence stops a Russian invasion of the Baltics.'
    : 'Petrov in 1983 shows we survived by luck. NATO outspends Russia eight to one. Europe pays Rosatom 781 million euros a year. The bombs are useless against modern air defenses. Radiation cannot be contained within national borders.';
  const idx = await p.evaluate(() => getRoundSteps().findIndex(s => s.panel === 'opponentSiphon'));
  await p.evaluate(i => jumpToStep(i), idx); await p.waitForTimeout(200);
  await p.fill('#opponentTranscriptInput', opp); await p.dispatchEvent('#opponentTranscriptInput', 'input'); await p.waitForTimeout(2500);
  const matched = await p.evaluate(() => [...state.autoMatchedRebuttalIds, ...state.autoMatchedFrontlineIds].length);
  const steps = await p.evaluate(() => getRoundSteps().map((s, i) => ({ i, title: s.title, panel: s.panel, dur: s.duration })));
  for (const s of steps.filter(s => /summary|finalFocus|ourRebuttal|constructive/i.test(s.panel || ''))) {
    await p.evaluate(i => jumpToStep(i), s.i); await p.waitForTimeout(600);
    const txt = await p.evaluate(() => {
      const ids = ['panelSummary', 'panelFinalFocus', 'panelOurRebuttal', 'panelOurConstructive'];
      for (const id of ids) { const el = document.getElementById(id); if (el && !el.classList.contains('hidden')) return el.innerText; }
      return '';
    });
    const words = (txt.match(/[A-Za-z0-9'’-]+/g) || []).length;
    console.log(`${s.title} | limit ${Math.round(s.dur/60)}:${String(s.dur%60).padStart(2,'0')} | panel words ${words} | ~${(words/170).toFixed(1)} min of speakable text`);
  }
  console.log('rebuttals auto-matched from their case:', matched);
  console.log('errors', errs.slice(0,3));
  await b.close();
})();
