const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true, viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(400);
  await p.click('#btnSidePro'); await p.click('#btnOrderFirst'); await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound'); await p.waitForTimeout(300);
  // 1. evidence tests drawer
  await p.click('#btnToggleEvidenceTests'); await p.waitForTimeout(300);
  const tests = await p.$$eval('#evidenceTestsList > div', els => els.map(e => e.querySelector('div').textContent.trim()));
  console.log('drawer tests:', tests.length, tests.join(' | ').slice(0, 150));
  await p.screenshot({ path: 'v7/ev_drawer.png' });
  await p.click('#btnToggleEvidenceTests');
  // 2. live flag on opponent speech
  const idx = await p.evaluate(() => getRoundSteps().findIndex(s => s.panel === 'opponentSiphon'));
  await p.evaluate(i => jumpToStep(i), idx); await p.waitForTimeout(250);
  await p.fill('#opponentTranscriptInput', 'Shlapak, 16 found NATO loses the Baltics in 60 hours, and the New York Times says Europe cannot defend itself.');
  await p.dispatchEvent('#opponentTranscriptInput', 'input'); await p.waitForTimeout(800);
  console.log('flag box visible:', await p.isVisible('#evidenceIssueBox'));
  console.log('flags:', (await p.textContent('#evidenceIssueBox').catch(() => '')).replace(/\s+/g, ' ').slice(0, 260));
  await p.screenshot({ path: 'v7/ev_flag.png' });
  await p.fill('#opponentTranscriptInput', 'Russia invaded Ukraine in 2022 and keeps about 4,400 warheads today.');
  await p.dispatchEvent('#opponentTranscriptInput', 'input'); await p.waitForTimeout(800);
  console.log('no false flag on clean speech:', !(await p.isVisible('#evidenceIssueBox')));
  // 3. credentials on cards
  await p.click('#btnOpenCards'); await p.waitForTimeout(500);
  const cred = await p.$$eval('#sourceCardsGrid', els => els[0].textContent.includes('Why they are qualified'));
  const risk = await p.$$eval('#sourceCardsGrid', els => els[0].textContent.includes('If they attack this card'));
  console.log('cards show credentials:', cred, '| show own-card warning:', risk);
  await p.screenshot({ path: 'v7/ev_card.png' });
  // 4. constructive length + no inline definitions
  await p.click('#btnBackToRound').catch(() => {});
  const con = await p.evaluate(() => ({ pro: DEBATE_DATA.PRO.constructiveParagraphs.join(' '), con: DEBATE_DATA.CON.constructiveParagraphs.join(' ') }));
  for (const [k, v] of Object.entries(con)) console.log(k, 'constructive:', v.split(/\s+/).length, 'words | inline "—meaning":', (v.match(/—\s*meaning/g) || []).length);
  console.log('errors:', errs);
  await b.close();
})();
