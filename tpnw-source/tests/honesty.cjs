const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(400);
  await p.click('#btnSidePro'); await p.click('#btnOrderSecond'); await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound');
  const i = await p.evaluate(() => getRoundSteps().findIndex(s => s.panel === 'opponentSiphon'));
  await p.evaluate(i => jumpToStep(i), i);
  const CASES = [
    ['no source named, just normal debate words', 'Nuclear deterrence has kept the peace for eighty years and Russia will never sign this treaty. It always comes back to deterrence.'],
    ['source named with an absolute claim', 'Shlapak, 16 guarantees that NATO loses the Baltics in sixty hours, which is inevitable.'],
    ['our own card being discussed', 'Your Lewis, 14 card never proves deterrence failed, it is impossible to show that.']
  ];
  for (const [label, txt] of CASES) {
    await p.fill('#opponentTranscriptInput', txt); await p.dispatchEvent('#opponentTranscriptInput', 'input'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ fired: !!state.activeViolations.v3_powerTag, det: state.detectedPowerTag, script: buildPowerTaggingScript() }));
    console.log(`\n## ${label}\n   fires: ${r.fired} | author: ${r.det ? r.det.authorName : '-'} | word: ${r.det ? r.det.triggerWord : '-'}`);
    console.log('   says: ' + r.script.slice(0, 230));
  }
  console.log('\nerrors', errs);
  await b.close();
})();
