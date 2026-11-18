const fs=require('fs');const h=fs.readFileSync(process.argv[2],'utf8');
const s=h.slice(h.indexOf('    const EVIDENCE_TESTS = ['), h.indexOf('    function renderEvidenceIssueAlert'));
eval(s.replace(/function renderEvidenceTestsDrawer[\s\S]*?\n    }\n/,'').replace(/function toggleEvidenceTestsDrawer[\s\S]*?\n    }\n/,''));
const POS=[["Shlapak, 16 finds NATO loses the Baltics in 60 hours","recency"],
["According to a 2019 RAND study, escalation favors Russia","recency"],
["Lewis, 14 says the world has been lucky","recency"],
["The New York Times reported Europe cannot defend itself","expertise"],
["A Guardian piece argues the treaty is working","expertise"],
["ICAN says 122 countries back the ban","funding"],
["Their card basically says deterrence works","context"],
["Studies show that nukes keep the peace","context"]];
const NEG=["In 1983 Petrov stopped a false alarm that could have ended the world",
"Russia invaded Ukraine in 2022 and changed European security",
"Article 5 of the 1949 Washington Treaty is the core of NATO",
"Kristensen, 26 at FAS counts about 4,400 Russian warheads",
"AP, 25 reported Trump saying he would not defend them",
"Ukraine gave up the Soviet nukes on its soil in 1994",
"The Budapest Memorandum 1994 gave Ukraine assurances",
"In December, 2021 the talks collapsed",
"Trump said in 2016 that he would check whether they paid",
"SIPRI, 26 shows NATO outspends Russia 8.3 to 1",
"He said 'If they don't pay, I'm not going to defend them' and studies show he meant it",
"We have three main arguments today",
"Hiroshima and Nagasaki in 1945 showed the humanitarian cost"];
let bad=0;
POS.forEach(([t,k])=>{const r=detectEvidenceIssues(t).map(x=>x.test.key);if(!r.includes(k)){bad++;console.log(' MISS',k,'|',t,'| got',r.join(',')||'-')}});
NEG.forEach(t=>{const r=detectEvidenceIssues(t);if(r.length){bad++;console.log(' FALSE FLAG',r.map(x=>x.test.key+':'+x.quote).join(','),'|',t)}});
console.log(`positives ${POS.length}, negatives ${NEG.length}, errors ${bad}`);
