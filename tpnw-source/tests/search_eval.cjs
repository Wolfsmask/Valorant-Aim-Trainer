// Evaluate the "AI search" boxes: node tests/search_eval.cjs <file.html> [paraphrases.json]
// Auto-generates badly misspelled queries from each card's own key words, then checks the card appears in the top 4 shown.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const STOP = new Set('the a an of to in on at by for and or but if is are was were be it its they them their we our you your he she his her as with from into about than then that this these those not no yes can will would could should does did do has have had what why how when who which all any some more most much many very just only also even so such our their there here over under after before because while if they say says claim claims argue argues when'.split(' '));
function typo(w, level) {
  const phon = [[/ph/, 'f'], [/ck/, 'k'], [/c(?=[aou])/, 'k'], [/tion/, 'shun'], [/ce/, 'se'], [/ea/, 'ee'], [/ou/, 'u'], [/ie/, 'ei'], [/ll/, 'l'], [/rr/, 'r'], [/ss/, 's'], [/tt/, 't'], [/nn/, 'n'], [/qu/, 'kw'], [/y$/, 'ie'], [/er$/, 'ur'], [/ence$/, 'ance'], [/ance$/, 'ence'], [/ar$/, 'er'], [/ism$/, 'isim'], [/x/, 'ks'], [/z/, 's']];
  let out = w;
  const edits = level;
  for (let e = 0; e < edits; e++) {
    const r = rnd();
    if (r < 0.35) { const cands = phon.filter(([re]) => re.test(out)); if (cands.length) { const [re, rep] = cands[Math.floor(rnd() * cands.length)]; out = out.replace(re, rep); continue; } }
    const i = 1 + Math.floor(rnd() * Math.max(1, out.length - 2));
    const t = rnd();
    if (t < 0.3 && out.length > 4) out = out.slice(0, i) + out.slice(i + 1); // drop
    else if (t < 0.55 && out.length > 3) out = out.slice(0, i) + out[i + 1] + out[i] + out.slice(i + 2); // swap
    else if (t < 0.75) out = out.slice(0, i) + out[i] + out.slice(i); // double
    else { const v = 'aeiou'; const j = out.split('').findIndex((c, k) => k >= i && v.includes(c)); if (j > 0) out = out.slice(0, j) + v[Math.floor(rnd() * 5)] + out.slice(j + 1); }
  }
  return out.replace(/undefined/g, '');
}
function makeQuery(text, nWords) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
  const uniq = [...new Set(words)];
  // prefer longer, more distinctive words
  const pick = uniq.sort((a, b) => b.length - a.length).slice(0, nWords);
  return pick.map(w => w.length >= 9 ? typo(w, 3) : w.length >= 6 ? typo(w, 2) : typo(w, 1)).join(' ');
}
(async () => {
  const FILE = path.resolve(process.argv[2]);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ offline: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE); await p.waitForTimeout(500);
  const items = await p.evaluate(() => { const out = []; for (const side of ['PRO', 'CON']) { const d = DEBATE_DATA[side]; [...d.rebuttals, ...d.frontlines, ...(d.counterDefenses || [])].forEach(bk => out.push({ side, id: bk.id, label: bk.chipLabel.replace(/^[^:]*?\d+[A-Z]?[.:]\s*/, ''), trigger: bk.trigger || '' })); } return out; });
  seed = 7;
  const queries = [];
  for (const it of items) {
    queries.push({ side: it.side, want: it.id, q: makeQuery(it.label, 3), kind: 'label' });
    queries.push({ side: it.side, want: it.id, q: makeQuery(it.trigger, 3), kind: 'trigger' });
  }
  if (process.argv[3]) JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8')).forEach(x => queries.push({ side: x[0], want: x[2], q: x[1], kind: 'paraphrase' }));
  const res = await p.evaluate(qs => qs.map(x => { state.side = x.side; let r; try { r = aiSemanticRankAllBlocksForSide(x.q, x.side).results.map(b => b.id); } catch (e) { r = ['ERR ' + e.message]; } return { ...x, got: r.slice(0, 4) }; }), queries);
  const by = {};
  for (const r of res) { const k = r.kind; by[k] = by[k] || { n: 0, top1: 0, top4: 0, fails: [] }; by[k].n++; const want = [].concat(r.want).flatMap(w => String(w).split("|")); if (want.includes(r.got[0])) by[k].top1++; if (r.got.some(g => want.includes(g))) by[k].top4++; else by[k].fails.push(`${r.side} ${[].concat(r.want).join('/')} ← "${r.q}" got ${r.got.join(',') || 'NOTHING'}`); }
  for (const [k, v] of Object.entries(by)) { console.log(`${k}: top-1 ${v.top1}/${v.n}, in shown top-4 ${v.top4}/${v.n}`); v.fails.slice(0, 6).forEach(f => console.log('   ✗ ' + f)); }
  if (errs.length) console.log('page errors', errs.slice(0, 3));
  await b.close();
})();
