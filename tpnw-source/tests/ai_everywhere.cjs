// node tests/ai_everywhere.cjs file.html → speech finder + list filters + Grand Crossfire with the ranking helper, and a scan for visible "AI" text
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await (await b.newContext({ offline: true, viewport: { width: 1280, height: 860 } })).newPage();
  const errs = [], logs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 120)));
  await p.goto('file://' + require('path').resolve(process.argv[2]));
  await p.click('#btnSidePro'); await p.click('#btnOrderSecond'); await p.click('#btnConsentNo').catch(() => {}); await p.click('#btnLaunchRound');
  await p.waitForFunction(() => window.PFX && PFX.state === 'ready', null, { timeout: 180000 });
  const go = async re => { const i = await p.evaluate(r => getRoundSteps().findIndex(s => new RegExp(r, 'i').test(s.title) && !/Our/i.test(s.title.split('—')[0]) ), re); await p.evaluate(i => jumpToStep(i), i); await p.waitForTimeout(250); };
  // speech finder: sentences worded with none of the cards' keywords
  await go('Opponent Case');
  const fs = require('fs'), path = require('path');
  const fresh = JSON.parse(fs.readFileSync(path.join(__dirname, 'search_fresh.json'))).filter(x => x[0] === 'PRO').map(([s, q, w]) => [q.charAt(0).toUpperCase() + q.slice(1) + '.', String(w).split('|')]);
  const neg = JSON.parse(fs.readFileSync(path.join(__dirname, 'siphon_neg.json'))).PRO.map(([q]) => [q, []]);
  let rescued = 0, wrongAdd = 0, negFire = 0, kwHit = 0;
  for (const [s, want] of [...fresh, ...neg]) {
    await p.evaluate(() => { state.loggedQuotes = []; });
    await p.fill('#opponentTranscriptInput', s); await p.dispatchEvent('#opponentTranscriptInput', 'input');
    const before = await p.evaluate(() => [...state.autoMatchedRebuttalIds, ...state.autoMatchedFrontlineIds, ...state.autoMatchedCounterDefenseIds]);
    await p.waitForTimeout(1600);
    const after = await p.evaluate(() => [...state.autoMatchedRebuttalIds, ...state.autoMatchedFrontlineIds, ...state.autoMatchedCounterDefenseIds]);
    const added = after.filter(x => !before.includes(x));
    if (!want.length) { if (after.length) { negFire++; console.log('  ✗ fired on', s, after); } continue; }
    if (before.some(x => want.includes(x))) kwHit++;
    else if (added.some(x => want.includes(x))) { rescued++; console.log('  + rescued:', s.slice(0, 70), '→', added.join(',')); }
    if (added.length && !added.some(x => want.includes(x))) wrongAdd++;
  }
  console.log(`speech finder: keyword already right ${kwHit}/${fresh.length}, rescued by ranking ${rescued}, extra-but-not-target adds ${wrongAdd}, harmless sentences firing ${negFire}/${neg.length}`);
  // filters
  await p.evaluate(() => { const el = document.getElementById('trapFilterInput'); });
  const trapRes = await p.evaluate(async () => { const q = 'russia keeps breaking its treaties'; const items = DEBATE_DATA.PRO.crossfireTraps; const f1 = items.filter(t => matchesSearchFilterTokens(t.trigger + ' ' + t.question, q)).length; await new Promise(r => setTimeout(r, 3000)); const hits = items.filter(t => matchesSearchFilterTokens(t.trigger + ' ' + t.question, q)); return [f1, hits.length, hits.slice(0, 3).map(t => t.trigger)]; });
  console.log('trap filter "russia keeps breaking its treaties": keyword', trapRes[0], '→ final', trapRes[1], trapRes[2]);
  const junk = await p.evaluate(async () => { const q = 'pizza party tonight'; DEBATE_DATA.PRO.crossfireTraps.filter(t => matchesSearchFilterTokens(t.trigger + ' ' + t.question, q)); await new Promise(r => setTimeout(r, 3000)); return DEBATE_DATA.PRO.crossfireTraps.filter(t => matchesSearchFilterTokens(t.trigger + ' ' + t.question, q)).length; });
  console.log('trap filter junk query matches (want 0):', junk);
  // grand crossfire (called directly)
  const g = await p.evaluate(async () => { const inp = document.getElementById('grandCxInput'); const out = document.getElementById('grandCxQuickOutput'); if (!out) return 'no output box'; const q = 'arent europeans ready to protect themselves without america'; if (inp) inp.value = q; matchGrandCxQuick(q); const a = out.textContent.replace(/\s+/g, ' ').slice(0, 90); await new Promise(r => setTimeout(r, 2500)); return a + ' ⇒ ' + out.textContent.replace(/\s+/g, ' ').slice(0, 110); });
  console.log('grand cx:', g);
  // visible text scan
  const vis = await p.evaluate(() => { const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const n = w.currentNode; const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName)) continue; const t = n.textContent; if (/\bAI\b|🧠|artificial intelligence|neural|model/i.test(t) && el.offsetParent !== null) out.add(t.trim().slice(0, 90)); } document.querySelectorAll('[placeholder],[title]').forEach(e => { const t = (e.getAttribute('placeholder') || '') + ' ' + (e.getAttribute('title') || ''); if (/\bAI\b|🧠/.test(t)) out.add('attr: ' + t.slice(0, 90)); }); return [...out]; });
  console.log('visible AI-ish text on this screen:', vis);
  console.log('console messages:', logs.filter(l => !/^(log|debug)/.test(l)).slice(0, 5)); console.log('errors:', errs);
  await b.close();
})();
