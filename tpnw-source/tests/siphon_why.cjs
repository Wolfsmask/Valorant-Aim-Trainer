const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ offline: true })).newPage();
await p.goto('file://' + require('path').resolve(process.argv[2])); await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(([s, t]) => { state.side = s; siphonRebuttalsFromText(t, ''); return { reb: state.autoMatchedRebuttalIds, fl: state.autoMatchedFrontlineIds, kw: state.siphonMatchedKeywords }; }, [process.argv[3], process.argv[4]]), null, 1)); await b.close(); })();
