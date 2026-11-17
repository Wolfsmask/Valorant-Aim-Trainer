const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ offline: true, viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + require('path').resolve(process.argv[2]));
await p.click('#btnSidePro'); await p.click('#btnOrderFirst'); await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound');
await p.waitForFunction(() => PFAI.state === 'ready', null, { timeout: 180000 });
const idx = await p.evaluate(() => getRoundSteps().findIndex(s => s.panel === 'opponentSiphon')); await p.evaluate(i => jumpToStep(i), idx); await p.waitForTimeout(300);
const vis = await p.isVisible('#siphonQuickFilterInput'); console.log('AI box visible', vis);
if (vis) { await p.fill('#siphonQuickFilterInput', 'you cant even tell if someone is hiding warheads'); await p.dispatchEvent('#siphonQuickFilterInput', 'input'); await p.waitForTimeout(2500);
  console.log('status:', await p.textContent('#siphonAiSearchStatus').catch(() => '?'));
  console.log('shown:', (await p.$$eval('#siphonAiInstantMatchBox .text-xs.font-extrabold', els => els.map(e => e.textContent.trim()).slice(0, 4))).join(' | '));
  await p.screenshot({ path: 'ai/ai_box.png' }); }
console.log('badge:', await p.textContent('#pfAiBadge')); console.log('errors', errs); await b.close(); })();
