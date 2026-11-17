// Offline UI test for the v3 app: node test/v3_ui.cjs <file.html> <shotsDir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]); const SHOTS = path.resolve(process.argv[3] || 'v3shots');
fs.mkdirSync(SHOTS, { recursive: true });
const problems = []; const net = [];
function watch(p, tag) {
  p.on('pageerror', e => problems.push(`[${tag}] pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') problems.push(`[${tag}] console.error: ${m.text()}`); });
  p.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) net.push(`[${tag}] ${u}`); });
  p.on('dialog', d => d.accept());
}
async function vis(p, sel) { try { return await p.isVisible(sel); } catch (e) { return false; } }
async function type(p, sel, text) { if (await vis(p, sel)) { await p.fill(sel, text); await p.dispatchEvent(sel, 'input'); await p.waitForTimeout(150); return true; } return false; }
async function click(p, sel) { if (await vis(p, sel)) { await p.click(sel, { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(80); return true; } return false; }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const report = {};
  for (const side of ['PRO', 'CON']) for (const order of ['First', 'Second']) {
    const tag = side + '-' + order;
    const c = await b.newContext({ viewport: { width: 1366, height: 900 }, offline: true });
    await c.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const p = await c.newPage(); watch(p, tag);
    await p.goto('file://' + FILE); await p.waitForTimeout(600);
    await click(p, side === 'PRO' ? '#btnSidePro' : '#btnSideCon'); await click(p, '#btnOrder' + order); await click(p, '#btnConsentNo'); await click(p, '#btnLaunchRound');
    await p.waitForTimeout(300);
    const nSteps = await p.$$eval('#stepPillsContainer button', bs => bs.length);
    const stepsSeen = [];
    for (let i = 0; i < nSteps; i++) {
      const title = (await p.textContent('#stepTitleLabel')).trim(); stepsSeen.push(title);
      const opp = side === 'PRO'
        ? 'Nuclear deterrence has kept the peace for 80 years. The TPNW is unverifiable and Russia will never join. Poland will build its own bomb without the umbrella.'
        : 'Petrov in 1983 shows we survived by luck. NATO outspends Russia 8 to 1. Europe pays Rosatom 781 million euros a year.';
      if (await type(p, '#opponentTranscriptInput', opp)) {
        await p.keyboard.press('Control+Enter').catch(() => {});
        for (const m of ['#btnModeFrontlines', '#btnModeCounterDefenses', '#btnModeAllBlocks', '#btnModeRebuttals', '#btnToggleMatchedOnly', '#btnToggleMatchedOnly', '#btnFilterDroppedOnly', '#btnFilterDroppedOnly']) await click(p, m);
        await type(p, '#rebuttalFilterInput', 'russia'); await type(p, '#rebuttalFilterInput', '');
      }
      if (await type(p, '#crossfireQuestionInput', side === 'PRO' ? "doesn't deterrence keep the peace?" : 'werent we just lucky to avoid nuclear war')) {
        report[tag + ' crossfire'] = (await p.textContent('#crossfirePrefireResult')).replace(/\s+/g, ' ').trim().slice(0, 160);
        await click(p, '#btnCfClear'); await type(p, '#trapFilterInput', 'b61'); await type(p, '#trapFilterInput', ''); await click(p, '#btnToggleHideDoneTraps'); await click(p, '#btnToggleHideDoneTraps');
      }
      for (const ed of ['#summaryLiveEditor', '#finalFocusLiveEditor', '#closingLiveEditor', '#rebuttalCustomNotes']) if (await vis(p, ed)) { await p.focus(ed); await p.keyboard.type(' test'); await p.waitForTimeout(80); }
      if (await type(p, '#grandCxInput', 'what about china')) report[tag + ' grandcx'] = (await p.textContent('#grandCxQuickOutput')).replace(/\s+/g, ' ').trim().slice(0, 120);
      // click every visible button in the main round view once (monkey test), except navigation/reset/export/setup
      const btns = await p.$$('#viewRound button:not(#stepPillsContainer button)');
      let clicked = 0;
      for (const bt of btns) {
        const id = (await bt.getAttribute('id')) || ''; const txt = ((await bt.textContent()) || '').trim();
        if (/btnNextStep|btnPrevStep|btnResetRound|btnExportRound|btnOpenSetup|btnOpenCards/.test(id) || /Reset Round|Export/.test(txt)) continue;
        if (!(await bt.isVisible().catch(() => false))) continue;
        await bt.click({ timeout: 1500 }).catch(() => {}); clicked++;
        if (clicked > 60) break;
      }
      await p.keyboard.press('Escape').catch(() => {});
      for (const modal of ['#prefireContentionModal', '#quickSourceModal', '#partnerSyncModal']) if (await vis(p, modal)) { problems.push(`[${tag}] ${modal} left open on step ${i + 1}`); await p.evaluate(sel => { const m = document.querySelector(sel); if (m) m.classList.add('hidden'); }, modal); }
      if (i === 0 || i === nSteps - 1 || /Crossfire|Rebuttal|Summary|Final/i.test(title)) await p.screenshot({ path: `${SHOTS}/${tag}-step${i + 1}.png` });
      if (i < nSteps - 1) { await p.click('#btnNextStep', { timeout: 5000 }).catch(e => problems.push(`[${tag}] next: ${e.message}`)); await p.waitForTimeout(200); }
    }
    report[tag + ' steps'] = stepsSeen.join(' → ');
    // timers, hotkeys, font, cards, export, reset, reload
    for (const s of ['#btnMainTimerToggle', '#btnMainTimerToggle', '#btnMainTimerReset', '#btnOurPrepToggle', '#btnOurPrepToggle', '#btnOurPrepReset', '#btnOppPrepToggle', '#btnOppPrepToggle', '#btnOppPrepReset', '#btnFontUp', '#btnFontDown']) await click(p, s);
    await p.click('body').catch(() => {}); for (const k of ['ArrowLeft', 'ArrowRight', '[', ']', 'Escape']) await p.keyboard.press(k);
    await click(p, '#btnOpenCards'); await p.waitForTimeout(250); await p.screenshot({ path: `${SHOTS}/${tag}-cards.png`, fullPage: true });
    const copy = await p.$('#sourceCardsGrid button'); if (copy) await copy.click().catch(() => {});
    await click(p, '#btnBackToRound');
    await click(p, '#btnExportRound'); await click(p, '#btnResetRound'); await click(p, '#btnResetRound');
    await p.reload(); await p.waitForTimeout(400);
    await c.close();
  }
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, offline: true, isMobile: true, hasTouch: true });
  const mp = await m.newPage(); watch(mp, 'mobile');
  await mp.goto('file://' + FILE); await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${SHOTS}/mobile-setup.png` });
  await click(mp, '#btnConsentNo'); await click(mp, '#btnLaunchRound'); await mp.waitForTimeout(300);
  let maxOverflow = 0;
  const n = await mp.$$eval('#stepPillsContainer button', bs => bs.length);
  for (let i = 0; i < n; i++) { maxOverflow = Math.max(maxOverflow, await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)); if (i === 0 || i === 2) await mp.screenshot({ path: `${SHOTS}/mobile-step${i + 1}.png` }); await mp.evaluate(() => changeStep(1)); await mp.waitForTimeout(150); }
  await b.close();
  for (const [k, v] of Object.entries(report)) console.log(k, ':', v);
  console.log('mobile max horizontal overflow px:', maxOverflow);
  console.log('network requests:', net.length, net.slice(0, 5));
  console.log('problems:', problems.length); [...new Set(problems)].slice(0, 40).forEach(x => console.log('  ' + x));
})();
