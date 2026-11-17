// node tests/room_link.cjs file.html → two separate browsers link with the same room code and sync live
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const url = 'file://' + path.resolve(process.argv[2]);
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const mk = async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy, args: ['--ignore-certificate-errors'] }); const c = await b.newContext({ ignoreHTTPSErrors: true }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); }); await p.goto(url); await p.waitForTimeout(500); await p.click('#btnSidePro'); await p.click('#btnOrderFirst'); await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound'); await p.waitForTimeout(200); return { b, p }; };
  const A = await mk(), B = await mk();
  for (const x of [A, B]) await x.p.evaluate(() => openPartnerSyncModal());
  await A.p.click('#btnWifiRoomNewCode');
  const code = await A.p.inputValue('#wifiRoomCodeInput');
  await B.p.fill('#wifiRoomCodeInput', code.toLowerCase().replace('-', ' '));
  await A.p.click('#btnWifiRoomConnect'); await A.p.waitForTimeout(2500);
  console.log('A badge:', await A.p.textContent('#wifiRoomBadge'));
  await B.p.click('#btnWifiRoomConnect');
  let linked = false;
  for (let i = 0; i < 40 && !linked; i++) { await B.p.waitForTimeout(500); linked = /Linked live/.test(await B.p.textContent('#wifiRoomBadge')); }
  console.log('B badge:', await B.p.textContent('#wifiRoomBadge'), '| A badge:', await A.p.textContent('#wifiRoomBadge'));
  if (linked) {
    await A.p.evaluate(() => closePartnerSyncModal());
    await A.p.evaluate(() => { state.customSpeechBoxes.PRO.summary.push({ id: 'custom_summary_x', label: 'X', text: 'SYNC TEST FROM A', sourceBlockId: null }); persistLiveEdits(); });
    await B.p.waitForTimeout(1500);
    console.log('B received:', await B.p.evaluate(() => JSON.stringify(state.customSpeechBoxes.PRO.summary.map(b => b.text))));
    await B.p.evaluate(() => { state.donePrefires.PRO['p_pf_1'] = true; persistLiveEdits(); });
    await A.p.waitForTimeout(1500);
    console.log('A received back:', await A.p.evaluate(() => JSON.stringify(state.donePrefires.PRO)));
  }
  console.log('errors A', A.p.errs.slice(0, 4), 'B', B.p.errs.slice(0, 4));
  await A.b.close(); await B.b.close();
})();
