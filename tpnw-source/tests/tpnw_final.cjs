// Full offline test of the TPNW app: node test/tpnw_final.cjs <file.html> <shotsDir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]); const SHOTS = path.resolve(process.argv[3] || 'tshots');
fs.mkdirSync(SHOTS, { recursive: true });
const problems = []; const net = [];
function watch(p, tag) {
  p.on('pageerror', e => problems.push(`[${tag}] pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${tag}] console.${m.type()}: ${m.text()}`); });
  p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) net.push(`[${tag}] ${r.url()}`); });
  p.on('dialog', d => d.accept());
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const xfResults = {};
  for (const side of ['PRO', 'CON']) for (const order of ['First', 'Second']) {
    const tag = side + '-' + order;
    const c = await b.newContext({ viewport: { width: 1280, height: 860 }, offline: true });
    await c.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const p = await c.newPage(); watch(p, tag);
    await p.goto('file://' + FILE); await p.waitForTimeout(500);
    await p.click(side === 'PRO' ? '#btnSidePro' : '#btnSideCon');
    await p.click('#btnOrder' + order);
    await p.click('#btnConsentNo');
    await p.click('#btnLaunchRound'); await p.waitForTimeout(300);
    const nSteps = await p.$$eval('#stepPillsContainer button', bs => bs.length);
    for (let i = 0; i < nSteps; i++) {
      const title = await p.textContent('#stepTitleLabel');
      // interact with whatever panel is showing
      if (await p.isVisible('#opponentTranscriptInput')) {
        const txt = side === 'PRO'
          ? 'Nuclear deterrence has kept the peace in Europe for 80 years. The TPNW is unverifiable and Russia will never join. NATO says it will remain a nuclear alliance.'
          : 'The world survived nuclear near misses by luck. B61 bombs in Europe are useless. Europe pays Rosatom millions. NATO outspends Russia 8 to 1 conventionally.';
        await p.fill('#opponentTranscriptInput', txt); await p.dispatchEvent('#opponentTranscriptInput', 'input'); await p.waitForTimeout(250);
        await p.click('#btnSaveStatement').catch(e => problems.push(`[${tag}] save stmt: ${e.message}`));
        await p.click('#btnToggleMatchedOnly').catch(() => {}); await p.click('#btnToggleMatchedOnly').catch(() => {});
        await p.click('#btnModeFrontlines').catch(() => {}); await p.click('#btnModeAllBlocks').catch(() => {}); await p.click('#btnModeRebuttals').catch(() => {});
        await p.fill('#rebuttalFilterInput', 'russia'); await p.dispatchEvent('#rebuttalFilterInput', 'input'); await p.waitForTimeout(150);
        await p.click('#btnClearRebuttalFilter').catch(() => {});
        // open a quote drawer
        const qb = await p.$('#rebuttalCardsContainer button:has-text("📜 Quote")'); if (qb) { await qb.click(); await p.waitForTimeout(150); }
      }
      if (await p.isVisible('#crossfireQuestionInput')) {
        const qs = side === 'PRO'
          ? ["doesn't deterrence keep the peace?", 'isnt the TPNW unverifiable', 'what about china', 'how does germany ratifying make russia disarm', 'how many b61s are in europe', 'wont ratifying break article 5']
          : ['werent we just lucky to avoid nuclear war', 'isnt europe funding rosatom', 'dont the b61s take days to use', 'doesnt NATO outspend russia', 'isnt the TPNW legally binding disarmament', 'what does the NPT article VI require'];
        xfResults[tag] = [];
        for (const q of qs) {
          await p.fill('#crossfireQuestionInput', q); await p.dispatchEvent('#crossfireQuestionInput', 'input'); await p.waitForTimeout(250);
          xfResults[tag].push([q, (await p.textContent('#crossfirePrefireResult')).replace(/\s+/g, ' ').trim().slice(0, 260)]);
        }
        await p.click('#btnCfClear').catch(() => {});
        await p.fill('#trapFilterInput', 'b61'); await p.dispatchEvent('#trapFilterInput', 'input'); await p.waitForTimeout(100);
        await p.click('#btnClearTrapFilter').catch(() => {});
      }
      if (await p.isVisible('#closingLiveEditor')) {
        await p.fill('#closingLiveEditor', (await p.inputValue('#closingLiveEditor')) + ' test edit');
        await p.dispatchEvent('#closingLiveEditor', 'input');
        if (await p.isVisible('#grandCxInput')) { await p.fill('#grandCxInput', 'isnt deterrence working'); await p.dispatchEvent('#grandCxInput', 'input'); await p.waitForTimeout(200); }
      }
      if (await p.isVisible('#podiumScriptContainer')) {
        const para = await p.$('#podiumScriptContainer p, #podiumScriptContainer div[onclick]'); if (para) await para.click().catch(() => {});
      }
      if (i === 0 || i === nSteps - 1 || /Crossfire|Rebuttal Speech/.test(title)) await p.screenshot({ path: `${SHOTS}/${tag}-step${i + 1}.png` });
      if (i < nSteps - 1) { await p.click('#btnNextStep'); await p.waitForTimeout(200); }
    }
    // timers + hotkeys
    await p.click('#btnMainTimerToggle'); await p.waitForTimeout(1200); await p.click('#btnMainTimerToggle'); await p.click('#btnMainTimerReset');
    await p.click('#btnOurPrepToggle'); await p.waitForTimeout(1100); await p.click('#btnOurPrepToggle'); await p.click('#btnOurPrepReset');
    await p.click('#btnOppPrepToggle'); await p.click('#btnOppPrepToggle'); await p.click('#btnOppPrepReset');
    await p.click('body'); for (const k of ['ArrowLeft', 'ArrowRight', '[', ']', 'Escape']) await p.keyboard.press(k);
    await p.click('#btnFontUp'); await p.click('#btnFontDown');
    // source cards view
    await p.click('#btnOpenCards'); await p.waitForTimeout(250);
    await p.screenshot({ path: `${SHOTS}/${tag}-cards.png`, fullPage: true });
    const firstCopy = await p.$('#sourceCardsGrid button'); if (firstCopy) await firstCopy.click();
    await p.click('#btnBackToRound');
    // persistence
    await p.reload(); await p.waitForTimeout(400);
    const after = await p.textContent('#stepCounterLabel').catch(() => '?');
    await p.click('#btnExportRound').catch(e => problems.push(`[${tag}] export: ${e.message}`));
    await c.close();
    console.log(tag, 'steps:', nSteps, 'after reload label:', after);
  }
  // mobile
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, offline: true, isMobile: true, hasTouch: true });
  const mp = await m.newPage(); watch(mp, 'mobile');
  await mp.goto('file://' + FILE); await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${SHOTS}/mobile-setup.png` });
  await mp.click('#btnConsentNo'); await mp.click('#btnLaunchRound'); await mp.waitForTimeout(300);
  await mp.screenshot({ path: `${SHOTS}/mobile-step1.png` });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await b.close();
  fs.writeFileSync(path.join(SHOTS, 'xf.json'), JSON.stringify(xfResults, null, 1));
  console.log('mobile horizontal overflow px:', overflow);
  console.log('network requests:', net.length, net.slice(0, 5));
  console.log('problems:', problems.length); [...new Set(problems)].slice(0, 40).forEach(x => console.log('  ' + x));
})();
