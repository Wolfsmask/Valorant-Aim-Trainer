// node tests/card_eval.cjs file.html → source-card search and filter accuracy with misspellings
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const src = require('fs').readFileSync(path.join(__dirname, 'search_eval.cjs'), 'utf8');
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
eval(src.slice(src.indexOf('function typo'), src.indexOf('(async () =>')).replace(/^function makeQuery[\s\S]*$/m, ''));
const STOP = new Set('the a an of to in on at by for and or but if is are was were be it its with from into about than that this not no can will would could should does did do has have had what why how all any more most very just only also so our their there over after before because while says said report press release annual'.split(' '));
function q(text, n) { const ws = [...new Set(String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)))].sort((a, b) => b.length - a.length).slice(0, n); return ws.map(w => w.length >= 9 ? typo(w, 2) : w.length >= 6 ? typo(w, 1) : typo(w, 1)).join(' '); }
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(400);
  const cards = await p.evaluate(() => DEBATE_DATA.SOURCE_CARDS.map(c => ({ short: c.short, title: c.title })));
  const qs = []; cards.forEach(c => { qs.push({ want: c.short, q: q(c.short + ' ' + c.title, 2) }); qs.push({ want: c.short, q: q(c.title, 3) }); });
  const res = await p.evaluate(qs => qs.map(x => { let r; try { r = filterSourceCardsByQuery(x.q).map(c => c.short); } catch (e) { r = ['ERR ' + e.message]; } return { ...x, got: r.slice(0, 4) }; }), qs);
  let ok = 0; const fails = []; res.forEach(r => { if (r.got.includes(r.want)) ok++; else fails.push(`${r.want} ← "${r.q}" got ${r.got.join(' | ')}`); });
  console.log(`source cards in top 4: ${ok}/${res.length}`); fails.slice(0, 8).forEach(f => console.log('  ✗ ' + f));
  // filter test: trap list filter with a misspelled word that IS in the trap
  const fl = await p.evaluate(() => { const out = []; ['PRO', 'CON'].forEach(s => (DEBATE_DATA[s].crossfireTraps || []).forEach(t => { const w = (t.trigger + ' ' + t.question).toLowerCase().match(/[a-z]{7,}/g) || []; if (w.length) out.push([t.trigger + ' ' + t.question, w[0]]); })); return out; });
  seed = 5; const flq = fl.map(([hay, w]) => [hay, typo(w, 2)]);
  const fr = await p.evaluate(list => list.map(([hay, q]) => [q, matchesSearchFilterTokens(hay, q)]), flq);
  console.log(`trap filter finds misspelled word: ${fr.filter(x => x[1]).length}/${fr.length}`, fr.filter(x => !x[1]).slice(0, 6).map(x => x[0]).join(', '));
  // false positives: random unrelated words should not match
  const neg = await p.evaluate(() => { const hay = DEBATE_DATA.PRO.crossfireTraps.map(t => t.trigger + ' ' + t.question); const words = ['pizza', 'basketball', 'giraffe', 'homework', 'minecraft', 'umbrellaz', 'zzzz']; return words.map(w => [w, hay.filter(h => matchesSearchFilterTokens(h, w)).length]); });
  console.log('unrelated-word matches (want 0 or small):', JSON.stringify(neg));
  if (errs.length) console.log('page errors', errs.slice(0, 3));
  await b.close();
})();
