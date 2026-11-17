// node tests/timer_draft.cjs file.html → per-step clocks keep running; drafts survive step switches and reloads
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const c = await b.newContext({ offline: true }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + path.resolve(process.argv[2]);
  await p.goto(url); await p.waitForTimeout(500);
  await p.click('#btnSidePro'); await p.click('#btnOrderFirst'); await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound'); await p.waitForTimeout(300);
  const clock = () => p.evaluate(() => ({ step: state.currentStepIndex, sec: state.mainTimerSec, run: state.mainTimerRunning, dur: getRoundSteps()[state.currentStepIndex].duration }));
  const out = [];
  await p.click('#btnMainTimerToggle'); await p.waitForTimeout(2300);
  out.push(['step1 after 2.3s', await clock()]);
  await p.click('#btnNextStep'); await p.waitForTimeout(1200);
  out.push(['step2 fresh', await clock()]);
  // background tab: open another page and bring it front
  const p2 = await c.newPage(); await p2.goto('about:blank'); await p2.bringToFront(); await p2.waitForTimeout(2000); await p.bringToFront();
  await p.click('#btnPrevStep'); await p.waitForTimeout(300);
  out.push(['step1 back (should be ~5.5s less, still running)', await clock()]);
  // drafts: find summary step
  const sumIdx = await p.evaluate(() => getRoundSteps().findIndex(s => s.panel === 'summary' || /summary/i.test(s.title)));
  const rebIdx = await p.evaluate(() => getRoundSteps().findIndex(s => /rebuttal/i.test(s.title) && /our/i.test(s.badge)));
  await p.evaluate(i => jumpToStep(i), sumIdx); await p.waitForTimeout(200);
  await p.evaluate(() => { state.composerOpen.summary = true; rerenderSpeechTypePanel('summary'); });
  await p.fill('#summaryCustomBoxTextarea', 'MY DRAFT ABOUT PETROV'); await p.dispatchEvent('#summaryCustomBoxTextarea', 'input');
  // edit an existing box too
  const boxId = await p.evaluate(() => { const ids = getOrderedIdsForSpeechType('summary'); state.editingSpeechBoxIds[ids[0]] = true; rerenderSpeechTypePanel('summary'); return ids[0]; });
  await p.fill('#editBody_' + boxId, 'EDITED BOX TEXT'); await p.dispatchEvent('#editBody_' + boxId, 'input');
  await p.evaluate(i => jumpToStep(i), rebIdx); await p.waitForTimeout(200);
  await p.evaluate(i => jumpToStep(i), sumIdx); await p.waitForTimeout(300);
  out.push(['composer draft after step switch', await p.inputValue('#summaryCustomBoxTextarea').catch(e => 'MISSING')]);
  out.push(['box edit after step switch', await p.inputValue('#editBody_' + boxId).catch(e => 'MISSING')]);
  // add the custom box, check it persists after reload
  await p.evaluate(() => addCustomBoxToSpeech('summary')); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(600);
  out.push(['custom box after reload', await p.evaluate(() => JSON.stringify(state.customSpeechBoxes.PRO.summary.map(x => x.text)))]);
  out.push(['edit draft after reload', await p.evaluate(id => PF_DRAFTS['PRO:editBody_' + id] || 'none', boxId)]);
  console.log(out.map(x => x[0] + ': ' + JSON.stringify(x[1])).join('\n'));
  console.log('errors', errs);
  await b.close();
})();
