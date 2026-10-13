/* ============================================================
   DebateBrain — fully offline matching + generation engine.
   No network, no model download. Runs instantly in any browser.
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------------- text utils ---------------- */
  const STOP = new Set(('a an the and or but if then so of to in on at by for with from as is are was were be been being am do does did done doing have has had having it its it\'s this that these those there here i me my we us our you your yours he she they them their his her what which who whom whose when where why how not no nor than too very can could should would will shall may might must just also only about into over under again further once more most some such own same both each few other any all out up down off own s t don isn aren wasn weren hasn haven hadn doesn didn won wouldn shouldn couldn mightn mustn let lets let\'s gonna wanna yeah okay ok um uh like really actually basically literally kind sort thing things get got going go say said says tell told know think thought mean means true question ask asking just make makes made would could should will need needs').split(/\s+/));

  function stripHtml(html) {
    return String(html || '')
      .replace(/<cite[^>]*>(.*?)<\/cite>/gi, ' ($1)')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|li|h\d|div)>/gi, '. ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').replace(/([.:!?…])\s*\.(\s|$)/g, '$1$2').replace(/(\.\s*){2,}/g, '. ').replace(/^\.\s*/, '').trim();
  }

  const NORM_RULES = [
    [/[’‘`]/g, "'"], [/[“”]/g, '"'], [/[–—]/g, ' - '],
    [/\bhyper[\s-]*scal(e|er|ers)\b/g, 'hyperscale$1'], [/\bhyperscalee\b/g, 'hyperscale'],
    [/\bdata[\s-]*cent(er|re)s?\b/g, 'datacenter'],
    [/\bp\.?\s?p\.?\s?a\.?s?\b/g, ' ppa '], [/\bpower purchase agreements?\b/g, ' ppa '],
    [/\bartificial intelligence\b/g, ' ai '], [/\ba\.\s?i\.?(?=\s|$)/g, ' ai '], [/\ba i\b/g, ' ai '], [/\bai's\b/g, 'ai'],
    [/\bmega\s*watts?\b/g, ' megawatt '], [/\bgiga\s*watts?\b/g, ' gigawatt '], [/\b(\d+)\s*mw\b/g, '$1 megawatt'], [/\b(\d+)\s*gw\b/g, '$1 gigawatt'],
    [/\bnon[\s-]*disclosure\b/g, 'nondisclosure'], [/\bn\.?d\.?a\.?s?\b/g, ' nda '],
    [/\bclosed[\s-]*loop\b/g, 'closedloop'], [/\bzero[\s-]*water\b/g, 'zerowater'], [/\bmicro[\s-]*grids?\b/g, 'microgrid'],
    [/\bthree mile island\b/g, 'threemileisland'], [/\btmi\b/g, 'threemileisland'], [/\bnukes?\b/g, 'nuclear'], [/\bhugging\s*face\b/g, 'huggingface'], [/\bopen\s*ai\b/g, 'openai'],
    [/\bdeep\s*seek\b/g, 'deepseek'], [/\bsmall modular reactors?\b/g, ' smr '], [/\bs\.?m\.?r\.?s?\b/g, ' smr '],
    [/\bu\.?s\.?a?\.?(?=\s|$)/g, ' us '], [/\bunited states\b/g, ' us '], [/\bamerica(n|ns)?\b/g, ' us '],
    [/\bpjm\b/g, ' pjm '], [/\bnerc\b/g, ' nerc '], [/\bgdp\b/g, ' gdp '], [/\bu\.?a\.?e\.?\b/g, ' uae '],
    [/\bmoratoria\b/g, 'moratorium'], [/\bcon side\b/g, 'con'], [/\bpro side\b/g, 'pro']
  ];
  function normalize(s) {
    let t = ' ' + String(s || '').toLowerCase() + ' ';
    for (const [re, rep] of NORM_RULES) t = t.replace(re, rep);
    return t.replace(/\s+/g, ' ').trim();
  }

  /* light Porter-style stemmer (good enough for matching) */
  function stem(w) {
    if (w.length <= 3) return w;
    let s = w;
    if (/ies$/.test(s) && s.length > 4) s = s.slice(0, -3) + 'y';
    else if (/sses$/.test(s)) s = s.slice(0, -2);
    else if (/([^s])s$/.test(s) && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
    if (/eed$/.test(s)) { /* keep */ }
    else if (/(ing|ed)$/.test(s)) {
      const base = s.replace(/(ing|ed)$/, '');
      if (/[aeiouy]/.test(base) && base.length >= 3) {
        s = base;
        if (/(at|bl|iz)$/.test(s)) s += 'e';
        else if (/([^aeiouylsz])\1$/.test(s)) s = s.slice(0, -1);
      }
    }
    s = s.replace(/(ational)$/, 'ate').replace(/(ization)$/, 'ize').replace(/(fulness|ousness|iveness)$/, m => m.slice(0, -4))
      .replace(/(ation)$/, 'ate');
    const cut = (suf, min) => { if (s.endsWith(suf) && s.length - suf.length >= min) s = s.slice(0, -suf.length); };
    cut('ment', 4); cut('ness', 4); cut('ly', 5); cut('ity', 4);
    if (s.length > 4) s = s.replace(/e$/, '');
    return s.length >= 2 ? s : w;
  }

  function tokens(s, keepStop) {
    const n = normalize(s).replace(/[^a-z0-9$%' ]+/g, ' ');
    const out = [];
    for (let w of n.split(' ')) {
      w = w.replace(/^'+|'+$/g, '').replace(/'s$/, '');
      if (!w) continue;
      if (!keepStop && STOP.has(w)) continue;
      out.push(stem(w));
    }
    return out;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ---------------- concept lexicon ---------------- */
  const CONCEPTS = {
    bills:      { label: 'Electric bills', color: '#e8590c', terms: ['bill', 'electric bill', 'power bill', 'utility bill', 'ratepayer', 'rate hike', 'rates', 'price', 'prices', 'afford', 'household', 'famil', 'consumer', 'customer', 'pjm', 'capacity price', 'capacity market', 'cost of electricity', 'electricity cost', 'energy cost', 'expensive'] },
    stranded:   { label: 'Stranded assets', color: '#d9480f', terms: ['stranded', 'abandon', 'bankrupt', 'downsiz', 'walk away', 'left holding', 'pull out', 'leave early', 'burst'] },
    ppa:        { label: 'Contracts / PPAs', color: '#c2255c', terms: ['ppa', 'contract', 'agreement', 'tariff', 'large load', 'fair share', 'discount', 'special contract', 'cost shift', 'sweetheart', 'pay for upgrade', 'pay their own', 'pay for their own', 'grid upgrade', 'cover the cost'] },
    grid:       { label: 'Grid reliability', color: '#1971c2', terms: ['grid', 'reliab', 'blackout', 'brownout', 'outage', 'shortfall', 'capacity', 'transmission', 'power plant', 'nerc', 'load growth', 'electricity', 'power use', 'energy use', 'consum', 'peak', 'electricity demand', 'power demand', 'energy demand', 'gigawatt', 'megawatt'] },
    microgrid:  { label: 'Microgrids / backup', color: '#1864ab', terms: ['microgrid', 'battery', 'backup', 'diesel', 'generator', 'storm', 'extreme weather', 'winter storm', 'hurricane', 'feed power back', 'emergency power'] },
    water:      { label: 'Water', color: '#0c8599', terms: ['water', 'gallon', 'aquifer', 'drought', 'drink', 'potable', 'evaporat', 'water stress', 'thirst', 'river', 'lake', 'reservoir'] },
    cooling:    { label: 'Cooling tech', color: '#0b7285', terms: ['cool', 'closedloop', 'immersion', 'zerowater', 'liquid cool', 'chiller', 'recycle water'] },
    clean:      { label: 'Clean energy', color: '#2f9e44', terms: ['clean energy', 'renewable', 'solar', 'wind', 'green', 'carbon free', 'carbon-free', 'green transition', 'anchor tenant', 'geothermal'] },
    coal:       { label: 'Coal / gas / climate', color: '#495057', terms: ['coal', 'gas plant', 'natural gas', 'fossil', 'emission', 'carbon', 'climate', 'greenhouse', 'methane', 'turbine'] },
    nuclear:    { label: 'Nuclear', color: '#5c940d', terms: ['nuclear', 'reactor', 'threemileisland', 'smr', 'fission', 'fusion', 'constellation'] },
    china:      { label: 'China / AI race', color: '#c92a2a', terms: ['china', 'chinese', 'beijing', 'ccp', 'ai race', 'arms race', 'adversar', 'rival', 'deepseek', 'huawei', 'dominat', 'win the race', 'lose the race', 'fall behind'] },
    offshore:   { label: 'Offshoring', color: '#a61e4d', terms: ['offshore', 'overseas', 'abroad', 'foreign', 'europe', 'uae', 'emirates', 'saudi', 'middle east', 'stargate', 'another country', 'other countr', 'relocat', 'move to', 'pack up', 'leave the us', 'canada', 'mexico', 'india'] },
    security:   { label: 'National security', color: '#862e9c', terms: ['national security', 'defense', 'defence', 'military', 'pentagon', 'sovereign', 'government data', 'intelligence', 'dod', 'warfare', 'cyber defense', 'homeland'] },
    ai:         { label: 'AI risk', color: '#5f3dc4', terms: ['ai', 'model', 'agent', 'autonom', 'rogue', 'escape', 'sandbox', 'hack', 'breach', 'superintelligen', 'frontier', 'openai', 'anthropic', 'huggingface', 'alignment', 'chatbot', 'llm', 'gpt', 'claude'] },
    safety:     { label: 'Safety', color: '#7048e8', terms: ['safety', 'safe', 'danger', 'threat', 'catastroph', 'guardrail', 'control', 'uncontrol', 'existential', 'misuse'] },
    software:   { label: 'Software rules', color: '#6741d9', terms: ['software', 'regulat', 'code', 'algorithm', 'oversight', 'legislation', 'ai law', 'ai rule', 'license', 'audit', 'testing requirement'] },
    hardware:   { label: 'Compute / hardware', color: '#5f3dc4', terms: ['hardware', 'compute', 'chip', 'gpu', 'server', 'nvidia', 'physical', 'lever', 'bottleneck', 'blackwell', 'h200', 'semiconductor'] },
    local:      { label: 'Local control', color: '#e67700', terms: ['local', 'zoning', 'town', 'city council', 'county', 'communit', 'municipal', 'federalism', 'states right', 'state right', 'tenth amendment', 'let states', 'state government', 'governor'] },
    legal:      { label: 'Legal authority', color: '#f08c00', terms: ['constitution', 'unconstitutional', 'commerce clause', 'authority', 'legal', 'court', 'lawsuit', 'overreach', 'jurisdiction', 'power to'] },
    enforce:    { label: 'Enforcement', color: '#f59f00', terms: ['enforce', 'enforcement', 'agency', 'who would', 'implement', 'loophole', 'police', 'monitor'] },
    nda:        { label: 'NDAs / secrecy', color: '#d6336c', terms: ['nda', 'nondisclosure', 'secret', 'shell compan', 'code name', 'hide', 'hidden', 'transparen', 'disclos'] },
    monopoly:   { label: 'Big Tech power', color: '#a61e4d', terms: ['monopol', 'trillion', 'big tech', 'google', 'amazon', 'microsoft', 'corporat', 'conglomerat', 'tech giant', 'billionaire', 'shareholder', 'profit'] },
    leakage:    { label: 'Smaller DCs / leakage', color: '#0b7285', terms: ['smaller', 'small datacenter', 'leakage', 'distributed', 'decentraliz', 'split', 'many sites', 'less efficient', 'hundreds of', 'multiple site', 'multi site', 'workaround', 'dodge'] },
    efficiency: { label: 'Efficiency', color: '#2b8a3e', terms: ['efficien', 'optimiz', 'jevons', 'per query', 'moore', 'innovat', 'less energy', 'less power', 'better chips'] },
    benefits:   { label: 'AI benefits', color: '#37b24d', terms: ['cure', 'cancer', 'medic', 'healthcare', 'science', 'research', 'discover', 'drug', 'protein', 'educat', 'benefit', 'disease', 'doctor', 'patient'] },
    health:     { label: 'Health / pollution', color: '#868e96', terms: ['asthma', 'pollut', 'air quality', 'smog', 'particulate', 'health cost', 'lung', 'formaldehyde', 'toxic', 'exhaust', 'memphis', 'xai', 'environmental justice'] },
    jobs:       { label: 'Jobs', color: '#f76707', terms: ['job', 'employ', 'worker', 'hire', 'union', 'labor', 'labour', 'construction', 'unemploy', 'career', 'workforce', 'electrician', 'paycheck', 'wage'] },
    economy:    { label: 'Economy', color: '#fd7e14', terms: ['economy', 'economic', 'gdp', 'growth', 'recession', 'invest', 'capital', 'market', 'stock', 'prosper', 'competitiv', 'competition', 'rural', 'productiv', 'supply chain', 'billion'] },
    tax:        { label: 'Tax revenue', color: '#e8590c', terms: ['tax', 'revenue', 'school', 'property tax', 'incentive', 'subsid', 'exemption', 'abatement', 'loudoun', 'budget', 'public service'] },
    bubble:     { label: 'AI bubble', color: '#d9480f', terms: ['bubble', 'overexcit', 'hype', 'speculat', 'crash', 'boom', 'overbuil', 'overinvest', 'altman', 'speculation'] },
    flexibility:{ label: 'Flexible load', color: '#1c7ed6', terms: ['flexib', 'curtail', 'demand response', 'duke', 'headroom', 'interruptible', 'load shed', 'ramp down', 'turn down', 'off peak'] },
    policy:     { label: 'Other policies', color: '#868e96', terms: ['ratepayer protection act', 'congress', 'legislat', 'already solv', 'already being', 'executive order', 'new york', 'maine', 'state law', 'senate', 'house passed', 'sb 6', 'texas law', 'pause'] },
    definition: { label: 'Definitions', color: '#495057', terms: ['define', 'definition', 'threshold', 'what count', 'how big', 'how long', 'temporary', 'permanent', 'indefinite', 'how many megawatt', 'what do you mean', 'last', 'grandfather', 'under construction', 'existing'] },
    precedent:  { label: 'Precedent', color: '#2f9e44', terms: ['singapore', 'ireland', 'dublin', 'amsterdam', 'netherland', 'precedent', 'worked before', 'tried before', 'other countries have'] },
    cloud:      { label: 'Cloud / services', color: '#1971c2', terms: ['cloud', 'small business', 'startup', 'aws', 'azure', 'website', 'email', 'streaming', 'hospital', 'bank', 'payment', '911', 'emergency service', 'internet'] },
    evidence:   { label: 'Evidence request', color: '#343a40', terms: ['evidence', 'source', 'card', 'study', 'who says', 'cite', 'citation', 'proof', 'prove', 'data show', 'statistic', 'where did you get'] }
  };
  // map card tags → concepts
  const TAG_ALIASES = { tax: 'tax', ratepayers: 'bills', blackouts: 'grid', drought: 'water', pollution: 'health', justice: 'health', bubble: 'bubble', nda: 'nda', cloud: 'cloud', enforce: 'enforce' };

  const CONCEPT_INDEX = []; // [{concept, phrase(normalized), stems[]}]
  for (const [c, def] of Object.entries(CONCEPTS)) {
    for (const t of def.terms) {
      const n = normalize(t);
      const st = n.split(' ').filter(Boolean).map(stem);
      CONCEPT_INDEX.push({ c, n, st, multi: st.length > 1 });
    }
  }

  function detectConcepts(text) {
    const n = ' ' + normalize(text).replace(/[^a-z0-9$%' ]+/g, ' ') + ' ';
    const toks = n.trim().split(' ').map(w => stem(w.replace(/'s$/, '')));
    const tokset = new Set(toks);
    const out = {};
    for (const e of CONCEPT_INDEX) {
      let hit = false;
      if (e.multi) { if (n.includes(' ' + e.n)) hit = true; }
      else {
        const s = e.st[0];
        if (tokset.has(s)) hit = true;
        else if (s.length >= 4) { for (const t of tokset) { if (t.startsWith(s)) { hit = true; break; } } }
      }
      if (hit) out[e.c] = (out[e.c] || 0) + (e.multi ? 1.6 : 1);
    }
    return out;
  }

  /* ---------------- index ---------------- */
  function sentencesOf(text) {
    return String(text).split(/(?<=[.!?])\s+(?=[A-Z"“(])/).map(s => s.trim()).filter(s => s.length > 3);
  }

  class Index {
    constructor() { this.docs = []; this.df = new Map(); this.N = 0; this.avgLen = 1; this.vocab = []; }
    build(sideData, evidence, side) {
      this.side = side || 'pro';
      this.docs = [];
      this.ev = []; this.evById = {};
      for (const e of evidence || []) {
        const text = e.tag + '. ' + e.text + ' ' + (e.tags || []).join(' ');
        const cc = detectConcepts(text);
        for (const tg of e.tags || []) { const c = CONCEPTS[tg] ? tg : TAG_ALIASES[tg]; if (c) cc[c] = (cc[c] || 0) + 2; }
        const rec = { e, tok: new Set(tokens(e.tag + ' ' + e.text)), head: new Set(tokens(e.tag)), cc };
        this.ev.push(rec); this.evById[e.id] = e;
      }
      for (const sec of sideData.sections) {
        if (sec.kind !== 'cards') continue;
        for (const it of sec.items || []) {
          const head = sec.cardType === 'qa' ? it.q : sec.cardType === 'askq' ? (it.label + '. ' + stripHtml(it.q)) : stripHtml(it.trigger);
          const alts = (it.alts || []).join('. ');
          const body = stripHtml(it.html || '') + ' ' + (it.goal || '') + ' ' + (it.follow || '') + ' ' + (it.turn || '');
          const tags = (it.tags || []).join(' ');
          const d = { id: it.id, sec: sec.id, type: sec.cardType, item: it, head: stripHtml(head), body };
          const tf = new Map();
          const add = (arr, w) => { for (const t of arr) tf.set(t, (tf.get(t) || 0) + w); };
          add(tokens(head), 3); add(tokens(alts), 2.4); add(tokens(body), 1); add(tokens(tags), 1.5);
          d.tf = tf; d.len = [...tf.values()].reduce((a, b) => a + b, 0);
          // concepts: tags strong, head strong, body weaker
          const cc = {};
          for (const tg of it.tags || []) { const c = CONCEPTS[tg] ? tg : TAG_ALIASES[tg]; if (c) cc[c] = (cc[c] || 0) + 2; }
          for (const [c, v] of Object.entries(detectConcepts(head + ' ' + alts))) cc[c] = (cc[c] || 0) + v * 1.2;
          for (const [c, v] of Object.entries(detectConcepts(body))) cc[c] = (cc[c] || 0) + Math.min(v, 2) * 0.4;
          d.concepts = cc;
          d.sents = sentencesOf(stripHtml(it.html || ''));
          this.docs.push(d);
        }
      }
      this.N = this.docs.length || 1;
      this.df = new Map();
      for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
      this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / this.N || 1;
      this.vocab = [...this.df.keys()].filter(t => t.length >= 5);
      this.raw = new Set(); const addRaw = t => normalize(t).replace(/[^a-z' ]+/g, ' ').split(' ').forEach(w => { if (w.length >= 4) this.raw.add(w.replace(/'s$/, '')); });
      for (const d of this.docs) addRaw(d.head + ' ' + (d.item.alts || []).join(' ') + ' ' + d.body);
      for (const r of this.ev) addRaw(r.e.tag + ' ' + r.e.text);
      for (const def of Object.values(CONCEPTS)) addRaw(def.terms.join(' '));
      return this;
    }
    searchEvidence(q, n) {
      const qt = tokens(q); const qc = detectConcepts(q);
      const res = this.ev.map(r => {
        let s = 0; for (const t of qt) { if (r.head.has(t)) s += 0.5; else if (r.tok.has(t)) s += 0.25; }
        for (const [c, v] of Object.entries(qc)) if (r.cc[c] && c !== 'evidence') s += 0.6 * Math.min(r.cc[c], 2);
        if (/^\(CON/.test(r.e.tag)) s *= 0.5;
        return { e: r.e, s };
      }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
      return res.slice(0, n || 3);
    }
    idf(t) { const df = this.df.get(t) || 0; return Math.log(1 + (this.N - df + 0.5) / (df + 0.5)); }
    expand(qt) {
      // fuzzy-map unknown tokens (speech-recognition typos) onto vocabulary
      const out = [];
      for (const t of qt) {
        if (this.df.has(t)) { out.push([t, 1]); continue; }
        if (t.length < 5) { out.push([t, 1]); continue; }
        let best = null, bd = 9;
        const max = t.length >= 8 ? 2 : 1;
        for (const v of this.vocab) { if (Math.abs(v.length - t.length) > max) continue; const d = lev(t, v, max); if (d < bd) { bd = d; best = v; if (d === 1) break; } }
        out.push(best && bd <= max ? [best, 0.7] : [t, 1]);
      }
      return out;
    }
    search(query, opts = {}) {
      const qt = this.expand(tokens(query));
      const caps = new Set();
      String(query).replace(/(?:^|[^.?!]\s)([A-Z][A-Za-z]{1,}|[A-Z]{2,})/g, (m, w) => { if (!/^(I|AI|US|Isn|Aren|Doesn|Don|Won|Wouldn|If|What|Why|How|The|So|And|But)$/.test(w)) caps.add(stem(normalize(w))); return m; });
      const qc = detectConcepts(query);
      const k1 = 1.4, b = 0.7;
      const res = [];
      const qcTotal = Object.values(qc).reduce((a, v) => a + v, 0) || 1;
      for (const d of this.docs) {
        if (opts.types && !opts.types.includes(d.type)) continue;
        let s = 0;
        for (const [t, w] of qt) {
          const f = d.tf.get(t); if (!f) continue;
          s += w * (caps.has(t) ? 1.8 : 1) * this.idf(t) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / this.avgLen));
        }
        let cs = 0;
        for (const [c, v] of Object.entries(qc)) if (d.concepts[c]) cs += Math.min(v, 2) * Math.min(d.concepts[c], 3);
        cs = cs / (qcTotal * 3);
        const boost = (opts.boost && opts.boost[d.type]) || 1;
        const score = (s * 0.11 + cs * 1.1) * boost;
        if (score > 0) res.push({ doc: d, score, bm: s, cs });
      }
      res.sort((a, b2) => b2.score - a.score);
      return { results: res.slice(0, opts.limit || 6), qc, qt };
    }
  }

  /* ---------------- question analysis ---------------- */
  const NEG_AUX = { "isn't": 'is', "aren't": 'are', "doesn't": 'does', "don't": 'do', "won't": 'will', "wouldn't": 'would', "can't": 'can', "couldn't": 'could', "shouldn't": 'should', "hasn't": 'has', "haven't": 'have', "didn't": 'did', "wasn't": 'was', "weren't": 'were' };
  const POS_AUX = { is: "isn't", are: "aren't", does: "doesn't", do: "don't", will: "won't", would: "wouldn't", can: "can't", could: "couldn't", should: "shouldn't", has: "hasn't", have: "haven't", did: "didn't", was: "wasn't", were: "weren't" };
  // only echo-deny predictions/opinions — never past facts (has/did/was) where "No" could be false
  const MODAL = new Set(["won't", "wouldn't", "can't", "couldn't", "shouldn't", 'will', 'would', 'can', 'could', 'should']);
  const OUR_PLAN = /^(a|the|your|this|that|our)?\s*(federal\s+|national\s+)?(moratorium|pause|ban|plan|policy|case|proposal|it|this|that)\b/i;
  const REPORTED = /\b(say|says|said|find|finds|found|show|shows|showed|claim|claims|report|reports|estimate|estimates|predict|predicts|admit|admits)\b|\d/i;
  function auxSubj(q) { const m = cleanQ(q).match(/^(isn't|aren't|doesn't|don't|won't|wouldn't|can't|couldn't|shouldn't|hasn't|haven't|didn't|wasn't|weren't|is|are|does|do|will|would|can|could|should|has|have|did|was|were)\s+(.*)$/i); return m ? { aux: m[1].toLowerCase(), rest: m[2] } : null; }
  function denyOK(q) { const a = auxSubj(q); if (!a) return false; if (REPORTED.test(a.rest)) return false; return MODAL.has(a.aux) || OUR_PLAN.test(a.rest); }
  const ECHO_OK = new Set(["won't", "wouldn't", "doesn't", "don't", "can't", "couldn't", "shouldn't", "isn't", "aren't", 'will', 'would', 'does', 'do', 'can', 'could', 'should', 'is', 'are']);
  const VERBS = new Set(('force forces hurt hurts kill kills cause causes create creates make makes mean means raise raises increase increases destroy destroys push pushes help helps protect protects need needs use uses lead leads require requires put puts give gives take takes bring brings let lets stop stops harm harms cost costs drive drives send sends move moves endanger endangers violate violates compromise compromises undermine undermines slow slows prevent prevents reduce reduces lower lowers have has be become becomes allow allows risk risks threaten threatens affect affects damage damages hand hands lose loses win wins benefit benefits fund funds pay pays build builds invest invests provide provides generate generates support supports solve solves fix fixes work works matter matters apply applies block blocks ban bans shift shifts devastate devastates cripple cripples scare scares chase chases delay delays hinder hinders hamper hampers result results end ends leave leaves go goes get gets stay stays keep keeps feed feeds care cares agree think believe want wants deserve deserves').split(' '));
  const ADVERBS = new Set('just really still also actually simply already basically even ultimately necessarily'.split(' '));

  function swapPronouns(s) {
    const map = { you: 'we', your: 'our', yours: 'ours', "you're": "we're", yourself: 'ourselves', yourselves: 'ourselves', we: 'you', our: 'your', ours: 'yours', us: 'you', "we're": "you're" };
    return s.replace(/\b(you're|we're|yourselves|yourself|yours|your|you|ours|our|us|we)\b/gi, (m, _1, off, str) => (m === 'US' || m === 'U.S' || str[off + m.length] === '.' && m.toLowerCase() === 'us' && str[off - 1] === '.') ? m : (map[m.toLowerCase()] || m));
  }

  const FILLER = /^\s*(okay|ok|so|well|um+|uh+|alright|and|but|right|yeah|my question is|question|quick question|next question|i want to ask|i'd like to ask|let me ask)[,:\s]+/i;
  const CONTRACT = /\b(isnt|arent|doesnt|dont|wont|wouldnt|cant|couldnt|shouldnt|hasnt|havent|didnt|wasnt|werent|youre|theyre|thats|whats|its)\b/gi;
  const CONTRACT_MAP = { isnt: "isn't", arent: "aren't", doesnt: "doesn't", dont: "don't", wont: "won't", wouldnt: "wouldn't", cant: "can't", couldnt: "couldn't", shouldnt: "shouldn't", hasnt: "hasn't", havent: "haven't", didnt: "didn't", wasnt: "wasn't", werent: "weren't", youre: "you're", theyre: "they're", thats: "that's", whats: "what's", its: "its" };
  const SHORTHAND = [[/\b(dosent|dosnt|dsnt)\b/gi, "doesn't"], [/\bu\b(?!\.)/gi, 'you'], [/\bur\b/gi, 'your'], [/\br\b/gi, 'are'], [/^y\b/i, 'why'], [/\by not\b/gi, 'why not'], [/\bhw\b/gi, 'how'], [/\b(wat|wht|wut)\b/gi, 'what'], [/\babt\b/gi, 'about'], [/\bppl\b/gi, 'people'], [/\bgovt\b/gi, 'government'], [/\bfed\b/gi, 'federal'], [/\btho\b/gi, 'though'], [/\bdcs\b/gi, 'data centers'], [/\bdc\b/gi, 'data center'], [/\bnukes?\b/gi, 'nuclear'], [/\btmi\b/gi, 'Three Mile Island'], [/\bthere (jobs|fair share|power|bills?|water)\b/gi, 'their $1']];
  function cleanQ(q) { let s = String(q || '').replace(/[’‘]/g, "'"); for (const [re, r] of SHORTHAND) s = s.replace(re, r); s = s.replace(CONTRACT, m => { const r = CONTRACT_MAP[m.toLowerCase()]; return m[0] === m[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r; }).trim(); for (let i = 0; i < 3; i++) s = s.replace(FILLER, ''); return s.trim(); }
  function normalizeQ(q) { return cleanQ(q).toLowerCase(); }

  function classify(q) {
    const s = normalizeQ(q);
    if (/\b(what('s| is) (your|the) (evidence|source|card|study|proof|warrant)|what (evidence|proof|source|data|study)|(do|did) you have (any |a )?(evidence|proof|card|source|study|data)|can (i|we) see (the|your|that) (card|evidence|source)|who says|what study|source for that|cite that|where('s| is| did you get) (that|the|your)? ?(evidence|number|stat|statistic|data|proof)?)\b/.test(s)) return 'evidence';
    if (/^(so )?(you|you're|you are) (admit|conced|agree)|^(you're|you are) saying|^(you'd|you would) rather|^do you (concede|admit)|^so you('re| are) saying|^so you agree/.test(s)) return 'concession';
    if (/^(what|which) (is|are|'s) (your )?(definition|threshold)|^(how|what) do you (define|mean)|^what do you mean|^how long|^how big|^how many|^how much|^what (percent|percentage|share|number)|^what counts|^define/.test(s)) return 'clarify';
    if (/^(isn't|aren't|doesn't|don't|won't|wouldn't|can't|couldn't|shouldn't|hasn't|haven't|didn't|wasn't|weren't)\b/.test(s) || /isn't it true|don't you (think|agree)|wouldn't you (agree|say)|(right|correct|true)\??$/.test(s)) return 'leading';
    if (/^why\b/.test(s)) return 'why';
    if (/^how\b/.test(s)) return 'how';
    if (/^(is|are|does|do|did|will|would|can|could|should|has|have|was|were)\b/.test(s)) return 'yesno';
    if (/^(what|which|who|where|when)\b/.test(s)) return 'what';
    if (/^(if|given|since|considering|assuming)\b/.test(s)) return /\b(why|how)\b/.test(s) ? 'why' : 'leading';
    if (/\?\s*$/.test(String(q))) return 'yesno';
    return 'statement';
  }

  // pro-friendly framing detector → decide yes/no stance for generated answers
  const PRO_FRIENDLY = ['afford', 'protect famil', 'protect communit', 'protect taxpayer', 'safe', 'clean water', 'drinking water', 'reliab', 'transparen', 'accountab', 'fair', 'consent', 'should pay', 'pay their fair', 'conserv', 'public health', 'regulate ai', 'risk of ai', 'deserve'];
  const CON_FRIENDLY = ['job', 'economy', 'econom', 'china', 'innovat', 'growth', 'recession', 'national security', 'tax revenue', 'cure', 'efficien', 'local control', 'states right', 'overreach', 'unenforce', 'smaller', 'leakage', 'offshore', 'overseas', 'hurt', 'kill', 'destroy', 'harm', 'lose', 'block', 'scare', 'unconstitution', 'backfire', 'worse'];
const AGREE = /^(do|don't|wouldn't|would|won't|will) you (agree|think|believe|accept)|^(do|did|don't) you (use|want|support|care|like|value)\b|\b(important|deserve|deserves|matter|matters)\b/i;
  const HARM = /\b(hurt|kill|destroy|harm|lose|worse|backfire|unconstitutional|recession|overreach|fail|ban|stop|block|raise|pointless|wrong|scare|tank)/i;
  function stanceFor(q) {
    if (AGREE.test(cleanQ(q)) && !HARM.test(q)) return 'yes';
    const n = normalize(q);
    let p = 0, c = 0;
    for (const w of PRO_FRIENDLY) if (n.includes(w)) p++;
    for (const w of CON_FRIENDLY) if (n.includes(w)) c++;
    return p > c ? 'yes' : 'no';
  }

  /* echo-rephrase: "Won't a moratorium kill jobs?" → "No — a moratorium won't kill jobs." */
  function echo(q, stance) {
    const orig = cleanQ(q).replace(/\?+\s*$/, '').replace(/\s+/g, ' ').trim();
    if (!orig) return '';
    const m = orig.match(/^(isn't|aren't|doesn't|don't|won't|wouldn't|can't|couldn't|shouldn't|hasn't|haven't|didn't|wasn't|weren't|is|are|does|do|will|would|can|could|should|has|have|did|was|were)\s+(.*)$/i);
    if (!m) return '';
    const aux = m[1].toLowerCase(); const rest = m[2];
    if (!ECHO_OK.has(aux)) return '';
    if (/^it true/i.test(rest)) return '';
    if (/^(you|we) (agree|think|believe)/i.test(rest)) {
      const clause = rest.replace(/^(you|we) (agree|think|believe)( that)?\s*/i, '');
      if (!clause || stance !== 'yes') return '';
      return trimClause('Yes — we agree ' + swapPronouns(clause));
    }
    const words = rest.split(' ');
    let vi = -1;
    for (let i = 0; i < Math.min(words.length, 8); i++) { const w = words[i].toLowerCase(); if (ADVERBS.has(w) || VERBS.has(w)) { vi = i; break; } }
    if (vi <= 0 || vi > 6) return '';
    const subj = swapPronouns(words.slice(0, vi).join(' '));
    const pred = swapPronouns(words.slice(vi).join(' '));
    if (REPORTED.test(subj) || !(MODAL.has(aux) || OUR_PLAN.test(subj))) return '';
    const negAux = NEG_AUX[aux] ? aux : POS_AUX[aux];
    if (!negAux || stance !== 'no') return '';
    return trimClause(('No — ' + subj + ' ' + negAux + ' ' + pred).replace(/\s+/g, ' '));
  }
  function trimClause(s) {
    const words = s.split(' ');
    if (words.length > 18) {
      const cut = s.search(/,| which | because | when | while | if | so that /);
      if (cut > 25 && cut < 140) s = s.slice(0, cut);
      else s = words.slice(0, 16).join(' ') + '…';
    }
    s = s.replace(/[,;:\s]+$/, '');
    return s.charAt(0).toUpperCase() + s.slice(1) + (/[.…!?]$/.test(s) ? '' : '.');
  }

  /* ---------------- concept voice lines (team's tone) ---------------- */
  const VOICE = {
    bills:     { impact: 'That cost lands on local families\' monthly electric bills.', punch: 'Big Tech gets the profits; families get the bill.', weigh: 'Their benefits go to a handful of shareholders; our costs land on every household\'s bill — 65 million people in PJM alone.' },
    stranded:  { impact: 'When the bubble pops, ratepayers are left holding the power plants.', punch: 'Either way, families lose.', weigh: 'A pause can be lifted tomorrow; a power plant built for a bubble sits on families\' bills for 30 years.' },
    ppa:       { impact: 'A contract is only as good as the company\'s balance sheet.', punch: 'When the contract dies, the ratepayer pays.', weigh: 'Contracts expire; stranded plants don\'t.' },
    grid:      { impact: 'That\'s the threat of blackouts for the neighborhoods next door.', punch: 'Don\'t plug in gigawatts of demand faster than we can build supply.', weigh: 'Reliability is the precondition for every economic benefit they claim.' },
    microgrid: { impact: 'Their backup protects their servers, not your house.', punch: 'They protect their own profits, not the community.', weigh: 'Their backup systems help them; the public grid carries the risk.' },
    water:     { impact: 'That\'s a whole town\'s drinking water, every single day.', punch: 'Water is local — you can\'t import a drought.', weigh: 'Water lost from an aquifer doesn\'t come back on any timeline that matters.' },
    cooling:   { impact: 'The promise is future tense; the water use is present tense.', punch: 'That is a marketing promise, not the reality on the ground.', weigh: 'Judge the facilities that exist, not the press releases.' },
    clean:     { impact: 'Meanwhile, coal plants that were supposed to close keep running.', punch: 'They are the disease trying to sell us the cure.', weigh: 'Delayed coal retirements are happening now; their clean-energy promises are years away.' },
    coal:      { impact: 'Delayed coal retirements mean dirtier air for the people next door.', punch: 'It\'s corporate greenwashing.', weigh: 'Emissions are irreversible — once released, they stay.' },
    nuclear:   { impact: 'The reactors are years away; the demand is here now.', punch: 'A pause lets clean power catch up.', weigh: 'Their solution arrives in the 2030s; our harm is today.' },
    china:     { impact: 'Our lead is chips China can\'t make, not concrete buildings.', punch: 'The U.S. controls the chips, so the U.S. controls the pace.', weigh: 'Racing to build AI we can\'t control isn\'t winning — this summer\'s hacks prove the danger is the AI itself.' },
    offshore:  { impact: 'Every advanced chip still needs a U.S. export license.', punch: 'You can\'t move a 500-megawatt facility overnight.', weigh: 'Offshoring is a guess; higher bills at home are a fact.' },
    security:  { impact: 'Existing secure facilities keep running, and a moratorium can exempt national security.', punch: 'The biggest security threat is AI we can\'t control.', weigh: 'With a security exemption, their impact disappears; ours doesn\'t.' },
    ai:        { impact: 'This summer, models hacked real companies during tests.', punch: 'You can\'t regulate what you can\'t see — but you can see a 500-megawatt building.', weigh: 'AI risk is the one impact that can\'t be undone after the fact.' },
    safety:    { impact: 'Compute is the most effective lever we have.', punch: 'A moratorium is an emergency brake, not a ban.', weigh: 'Safety first is reversible; catastrophe isn\'t.' },
    software:  { impact: 'Code is invisible; a 500-megawatt building isn\'t.', punch: 'The pause buys the time to write the software rules.', weigh: 'Software rules need years; the brake works now.' },
    hardware:  { impact: 'You cannot train a frontier model without massive physical hardware.', punch: 'Compute is the lever — pull it.', weigh: 'Hardware is the only part of AI regulators can actually see.' },
    local:     { impact: 'Small towns are outgunned by trillion-dollar companies.', punch: 'Only a federal moratorium levels the playing field.', weigh: 'Costs cross state lines, so the decision has to as well.' },
    legal:     { impact: 'Hyperscalers run on interstate grids — that\'s interstate commerce.', punch: 'Congress already regulates the grid, the chips and the permits.', weigh: 'Legality isn\'t a reason to prefer their world; it\'s a reason Congress can act.' },
    enforce:   { impact: 'You can\'t hide a 500-megawatt construction site.', punch: 'Federal agencies already permit every one of these projects.', weigh: 'Physical buildings are the easiest thing in AI to enforce.' },
    nda:       { impact: 'Residents don\'t even get to see the water and power numbers.', punch: 'Secret deals aren\'t local control.', weigh: 'You can\'t consent to a deal you\'re not allowed to see.' },
    monopoly:  { impact: 'A few trillion-dollar companies capture the profits.', punch: 'What\'s good for Silicon Valley isn\'t automatically good for America.', weigh: 'Concentrated gains for them, spread-out costs for everyone else.' },
    leakage:   { impact: 'Frontier training links giant campuses, not small server rooms.', punch: 'A moratorium caps frontier compute — it doesn\'t just split it up.', weigh: 'Their leakage story has no example; our cap is guaranteed.' },
    efficiency:{ impact: 'Cheaper AI means more AI — total demand keeps tripling.', punch: 'Efficiency is exactly what a moratorium forces.', weigh: 'Efficiency without a cap just grows the pie of demand.' },
    benefits:  { impact: 'Every existing data center keeps running.', punch: 'We\'re pausing the build-out, not the research.', weigh: 'Their benefits continue under a pause; our harms stop.' },
    health:    { impact: 'Diesel and gas turbines pollute the neighborhoods next door.', punch: 'The pollution has a body count.', weigh: 'Health harms fall on the people with the least power to say no.' },
    jobs:      { impact: 'A few dozen to a couple hundred permanent jobs for a multi-billion-dollar building.', punch: 'That\'s not a jobs program; it\'s a subsidy.', weigh: 'A few hundred jobs don\'t outweigh higher bills for millions.' },
    economy:   { impact: 'Much of that "growth" is imported chips.', punch: 'A pause is a soft landing, not a crash.', weigh: 'Their growth is concentrated and fragile; our costs are broad and certain.' },
    tax:       { impact: 'Most states give the tax revenue right back in exemptions.', punch: 'Families pay it back on their power bills.', weigh: 'Tax revenue that comes with higher bills is a wash for families.' },
    bubble:    { impact: 'Even OpenAI\'s CEO says investors are "overexcited."', punch: 'If it\'s a bubble, building more is the risk.', weigh: 'In a bubble world we win big; in a boom world bills still spike — we win both.' },
    flexibility:{ impact: 'Flexibility only exists when it\'s required — Texas had to pass a law.', punch: 'Voluntary flexibility isn\'t a plan.', weigh: 'Their solution depends on rules that don\'t exist yet; the pause buys time to write them.' },
    policy:    { impact: 'Voluntary standards and a state-by-state patchwork don\'t stop construction.', punch: 'It proves the harm is real — not that it\'s solved.', weigh: 'Patchworks get routed around; a federal pause doesn\'t.' },
    definition:{ impact: 'It\'s a pause until federal safeguards exist, counted by whole campus.', punch: 'A pause, not a ban.', weigh: 'Temporary and reversible beats permanent and locked-in.' },
    precedent: { impact: 'Singapore paused and came back stronger.', punch: 'Pauses work.', weigh: 'Real-world precedent beats their predictions.' },
    cloud:     { impact: 'Existing cloud capacity keeps running.', punch: 'Your email doesn\'t need a new 500-megawatt building.', weigh: 'No existing service shuts off under a moratorium.' },
    evidence:  { impact: 'Here\'s the source.', punch: 'What\'s the date on yours?', weigh: 'Prefer recent, specific evidence.' }
  };
  const NEUTRAL_VOICE = { impact: '', punch: '', weigh: 'Prefer our impacts on probability and magnitude — weigh them against what they actually proved.' };
  const voiceFor = (c, idx) => (idx && idx.side === 'con') ? NEUTRAL_VOICE : (VOICE[c] || DEFAULT_VOICE);
  const DEFAULT_VOICE = { impact: 'And families are already paying for it — $9.3 billion in PJM alone.', punch: 'A moratorium is an emergency brake, not a ban.', weigh: 'Our harms are happening now; theirs depend on "if."' };

  /* ---------------- answer builder (crossfire) ---------------- */
  function topConcepts(qc, n) { return Object.entries(qc).filter(([c]) => c !== 'evidence').sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]); }
  const CITE_RE = /\((?:[A-Z][^)]{1,40}?)(?:'\d{2})?\)/;

  function pickSentences(docs, query, n, avoid) {
    const qtok = new Set(tokens(query));
    const qc = detectConcepts(query);
    const cand = [];
    for (const r of docs) {
      r.doc.sents.forEach((s, i) => {
        if (avoid && avoid.has(s)) return;
        const st = tokens(s); let ov = 0; for (const t of st) if (qtok.has(t)) ov++;
        const sc = detectConcepts(s); let cv = 0; for (const c of Object.keys(qc)) if (sc[c]) cv++;
        const hasCite = CITE_RE.test(s);
        const score = ov * 1.0 + cv * 1.3 + (hasCite ? 0.8 : 0) + r.score * 2 - i * 0.15 - (s.length > 260 ? 1 : 0);
        cand.push({ s, score, id: r.doc.id, hasCite });
      });
    }
    cand.sort((a, b) => b.score - a.score);
    const out = []; const seen = new Set();
    for (const c of cand) {
      const key = c.s.slice(0, 40);
      if (seen.has(key)) continue; seen.add(key); out.push(c);
      if (out.length >= n) break;
    }
    return out;
  }

  const ANSWER_START = /^(no|yes|not|some|partly|absolutely|nationally|great|good|sure|exactly|only|because|either way|both|that's|we don't|we aren't|we do|until|facilities of|expanding|existing|temporary|the companies|our lead|every|most states|much of|that headroom|loudoun|a moratorium|they buy|their microgrids|ppas only|hyperscale facilities|software rules|current u\.s\.|absolutely)\b/i;
  function stripLeadingConj(s) { return String(s).replace(/^(and|but|so|also|meanwhile|however|plus|even so)[,\s]+/i, '').replace(/^./, c => c.toUpperCase()); }
  function stripLeadingAnswerWord(s) {
    return String(s).replace(/^(No|Yes|Not at all|Not quite)[,.—\s-]+(because\s+)?/i, (m, w, bec) => bec ? 'Because ' : '').replace(/^./, c => c.toUpperCase());
  }

  const QUANT = /^\s*(how (many|much)|what (percent|percentage|share|number|fraction))/i;
  function whoOf(e) { return e.who || String(e.cite).split(/[;,]/)[0].slice(0, 60); }
  function chooseOpener(type, stance, q, doc) {
    const it = doc.item; const short = (it.short || '').trim();
    const body = stripHtml(it.html || '');
    if (type === 'evidence') return 'Sure — here\'s our source:';
    if (stance === 'yes' && AGREE.test(q) && (type === 'leading' || type === 'yesno' || type === 'concession')) return echo(q, 'yes') || 'Yes.';
    if (short) {
      const yn = type === 'leading' || type === 'yesno' || type === 'concession';
      if (/^(no|not at all)\.?$/i.test(short) && yn) return (stance === 'no' && echo(q, 'no')) || (denyOK(q) ? short : '');
      if (/^(no|not at all)\b[\s—,.-]+\S/i.test(short) && !(yn && (denyOK(q) || type === 'concession'))) { const s2 = short.replace(/^(no|not at all)\b[\s—,.-]+/i, ''); return s2.charAt(0).toUpperCase() + s2.slice(1); }
      return /[.!?…]$/.test(short) ? short : short + '.';
    }
    if (ANSWER_START.test(body)) return '';
    if (type === 'leading' || type === 'yesno') return echo(q, stance) || (stance === 'yes' ? 'Yes — but here\'s the catch.' : (stance === 'no' && denyOK(q)) ? 'No.' : '');
    if (type === 'concession') return stance === 'yes' ? 'Yes — and that\'s exactly our point.' : 'No — that\'s not what we said.';
    return '';
  }

  function evidenceFor(q, idx, doc, n) {
    const out = []; const seen = new Set();
    const push = e => { if (e && !seen.has(e.id)) { seen.add(e.id); out.push(e); } };
    const es = idx.searchEvidence(q, 4);
    // prefer evidence the card already cites, ranked by relevance
    if (doc && doc.item.ev && doc.item.ev.length) {
      const ranked = doc.item.ev.map(id => idx.evById[id]).filter(Boolean)
        .map((e, i) => ({ e, s: (es.find(x => x.e.id === e.id) || { s: 0 }).s + (i === 0 ? 0.35 : i === 1 ? 0.15 : 0) })).sort((a, b) => b.s - a.s);
      ranked.forEach(r => push(r.e));
    }
    es.forEach(x => { if (x.s > 0.35) push(x.e); });
    return out.slice(0, n || 2);
  }

  /**
   * answer(question, idx) → { mode: 'prefire'|'adapted'|'generated', confidence 0..1, opener, body, turn, bridge, cards, evidence, concepts, type }
   */
  function correct(q, idx) {
    if (!idx.raw) return q;
    return q.replace(/[A-Za-z']{4,}/g, w => {
      const lw = w.toLowerCase(); if (idx.raw.has(lw) || STOP.has(lw) || /'/.test(lw)) return w;
      const max = lw.length >= 8 ? 2 : 1; let best = null, bd = 9;
      for (const v of idx.raw) { if (Math.abs(v.length - lw.length) > max || v[0] !== lw[0]) continue; const d = lev(lw, v, max); if (d < bd) { bd = d; best = v; if (d === 1) break; } }
      return best && bd <= max ? best : w;
    });
  }
  function answer(query, idx, opts = {}) {
    const q = cleanQ(query);
    const qs = correct(q, idx);   // typo-corrected copy: used ONLY for matching, never shown
    if (q.length < 3) return null;
    const type = classify(q);
    let stance = stanceFor(q);
    if (idx.side === 'con' && stance !== 'yes') stance = 'neutral';  // engine's yes/no heuristics are tuned for PRO
    const { results, qc } = idx.search(qs, { boost: { qa: 1.15, rebuttal: 1.0, counter: 0.95, askq: 0.3 }, limit: 8 });
    // the generic "can I see your card" entry only wins when no topic is given
    const topical = topConcepts(qc, 3);
    let ranked = results.filter(r => r.doc.type !== 'askq' && !(r.doc.item.generic && topical.length));
    const top = ranked[0], second = ranked[1];
    const concepts = topical;
    // confidence: absolute strength + margin over runner-up
    let conf = 0;
    if (top) {
      let abs = Math.min(1, top.bm / 10) * 0.5 + Math.min(1, top.cs * 1.6) * 0.5;
      if (topical.length && top.cs < 0.15) abs *= 0.6;
      if (!topical.length) abs = Math.min(abs, 0.6);
      const margin = second ? Math.min(1, (top.score - second.score) / (top.score + 1e-6) * 3) : 1;
      conf = Math.max(0, Math.min(1, abs * 0.8 + margin * 0.2));
    }
    const out = { type, stance, concepts, confidence: conf, cards: ranked.slice(0, 4), query: q };
    const askq = idx.search(qs, { types: ['askq'], limit: 1 }).results[0];
    const voice = voiceFor(concepts[0], idx);

    if (top && conf >= 0.5) {
      const it = top.doc.item;
      out.mode = conf >= 0.72 ? 'prefire' : 'adapted';
      out.card = top;
      out.opener = chooseOpener(type, stance, q, top.doc);
      const bodyText = stripHtml(it.html || '');
      out.body = /^(No|Yes)\b/.test(out.opener) ? stripLeadingAnswerWord(bodyText) : bodyText;
      if (out.opener && out.body.toLowerCase().startsWith(out.opener.toLowerCase().replace(/[.!]$/, ''))) out.opener = '';
      out.body = dedupeLead(out.opener, out.body);
      out.bodyHtml = it.html;
      out.turn = it.turn || it.follow || '';
      if (!out.turn && voice.punch) out.turn = '';
      out.evidence = evidenceFor(qs, idx, top.doc, type === 'evidence' || type === 'clarify' ? 2 : 1);
      if (type === 'evidence' && out.evidence[0]) { const e0 = out.evidence[0]; out.opener = 'Sure — ' + whoOf(e0) + ':'; out.body = e0.tag + '. ' + (sentencesOf(e0.text)[0] || ''); }
      if (type === 'clarify' && QUANT.test(q) && out.evidence[0]) out.opener = out.evidence[0].tag + ' (' + whoOf(out.evidence[0]) + ').';
      if (out.mode === 'adapted') {
        const novel = novelTerms(q, bodyText);
        if (novel && voice.impact) out.bridge = 'On ' + novel + ' specifically: ' + tidyImpact(voice.impact);
      }
      return out;
    }

    // ---------- generate a fresh counter in the team's format ----------
    out.mode = 'generated';
    out.card = top || null;
    const pool = ranked.slice(0, 5);
    const picked = pickSentences(pool, qs, 3);
    let opener = '';
    if (type === 'evidence') opener = 'Sure — here\'s our source:';
    else if (type === 'leading' || type === 'yesno') opener = echo(q, stance) || (stance === 'yes' ? 'Yes — and that\'s exactly our point.' : (concepts.length && stance === 'no' && denyOK(q) ? 'No.' : ''));
    else if (type === 'concession') opener = stance === 'yes' ? (idx.side === 'con' ? 'Yes.' : 'Yes — and that\'s exactly our point.') : 'No — that\'s not what we said.';
    else if (type === 'clarify') opener = 'Good question.';
    else if (!concepts.length) opener = '';

    const parts = [];
    if (picked.length && concepts.length) {
      const claim = picked.find(p => !p.hasCite) || picked[0];
      const cited = picked.find(p => p.hasCite && p !== claim);
      parts.push(stripLeadingConj(claim.s));
      if (cited) parts.push(stripLeadingConj(cited.s));
    }
    if (!parts.length && !concepts.length && conf < 0.3) parts.push('(No prepared card for this — answer honestly in one sentence, then pivot to our case.)'); if (!parts.length) parts.push(idx.side === 'con' ? '(No prepared card for this — answer honestly in one sentence, then pivot to our case.)' : 'Families are already paying for this build-out — PJM\'s market monitor tied $9.3 billion in higher costs to data centers (PJM IMM).');
    let body = parts.join(' ');
    if (type === 'why') body = 'Because ' + body.charAt(0).toLowerCase() + body.slice(1);
    else if (/^(No|Yes)\b/.test(opener)) body = stripLeadingAnswerWord(body);
    if (!/[.!?][)"']?$/.test(body)) body += '.';
    if (voice.punch) body += ' ' + voice.punch;
    out.opener = opener;
    out.body = body.replace(/\s+/g, ' ').trim();
    out.turn = (top && conf >= 0.3 && (top.doc.item.turn || top.doc.item.follow)) || 'What\'s your evidence for that — and what\'s the date on it?';
    out.evidence = evidenceFor(qs, idx, top && top.doc, 2);
    const novel = novelTerms(q, out.body);
    if (novel && concepts.length && voice.impact) out.bridge = 'On ' + novel + ': ' + tidyImpact(voice.impact);
    out.confidence = Math.min(conf, 0.49);
    return out;
  }

  function tidyImpact(s) { s = String(s).replace(/^and\s+/i, ''); return s.charAt(0).toLowerCase() + s.slice(1); }
  function dedupeLead(opener, body) {
    if (!opener || !body) return body;
    const w = x => (String(x).toLowerCase().match(/[a-z']+/) || [''])[0];
    if (w(opener) && w(opener) === w(body)) {
      const cut = body.search(/ — |\. /);
      if (cut > 0 && cut < 90) { const rest = body.slice(cut).replace(/^( — |\. )/, ''); return rest.charAt(0).toUpperCase() + rest.slice(1); }
    }
    return body;
  }
  function novelTerms(q, body) {
    // proper nouns / numbers the opponent named that our answer doesn't mention
    const raw = String(q).match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*|\d[\d,.]*\s*(?:%|percent|megawatts?|gigawatts?|billion|million|gallons|jobs)?)\b/g) || [];
    const skip = /^(Isn|Aren|Doesn|Don|Won|Wouldn|Can|Couldn|Shouldn|If|What|Why|How|When|Where|Who|Which|Is|Are|Do|Does|Will|Would|Should|So|And|But|The|A|An|You|Your|We|Our|They|Their|It|This|That|I|Okay|Ok|Well|Since|Given|Pro|Con|Judge|Yes|No|Hasn|Haven|Didn|Wasn|Weren|Has|Have|Did|Was|Were|AI|US|U)$/;
    const b = body.toLowerCase();
    const digits = b.replace(/[^0-9]/g, ' ');
    const found = raw.map(s => s.trim()).filter(s => s.length > 2 && !skip.test(s.split(' ')[0]) && !b.includes(s.toLowerCase()) && !(/^\d/.test(s) && digits.includes(s.replace(/[^0-9]/g, '').slice(0, 2))));
    return found.length ? found.slice(0, 2).join(' and ') : '';
  }

  /* ---------------- opponent case summarizer ---------------- */
  const SIGNPOST = /\b(c ?[1-4]\b|contention ?(one|two|three|four|1|2|3|4)|(our|my) (first|second|third|fourth|final|last|next) (argument|point|contention|reason|impact)|first(ly)?,?|second(ly)?,?|third(ly)?,?|finally,?|lastly,?|sub ?point [abc]|framework|we (will|would) define|definition|the impact (is|of)|to weigh|weighing)\b/i;

  function splitUnits(text) {
    // speech often lacks punctuation: split on punctuation AND on signposts
    const raw = String(text || '').trim();
    if (!raw) return [];
    // typed notes: each line is a unit; long lines get split on punctuation
    let parts = raw.split(/\n+|(?<=[.!?;])\s+|\s+[-–—]{1,2}\s+|\s*\|\s*/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const words = p.split(' ');
      if (words.length <= 40) { out.push(p); continue; }
      // chunk long unpunctuated speech into ~22-word windows, breaking at signposts / conjunctions
      let buf = [];
      for (const w of words) {
        buf.push(w);
        const joined = buf.join(' ');
        if (buf.length >= 14 && (/^(and|but|because|so|which|meaning|that's why|this means)$/i.test(w) || buf.length >= 26)) { out.push(joined); buf = []; }
        else if (buf.length > 4 && SIGNPOST.test(w + ' ' + '')) { /* noop */ }
      }
      if (buf.length) out.push(buf.join(' '));
    }
    return out.map(s => s.trim()).filter(s => s.split(' ').length >= 2);
  }

  function hasEvidence(s) {
    return /\b(according to|study|report|survey|found that|finds that|estimates?|analysis|data from|researchers?|percent|%|\$\s?\d|\d+(\.\d+)?\s*(billion|million|trillion|thousand|gigawatts?|megawatts?|gallons|jobs)|\b(19|20)\d{2}\b)/i.test(s);
  }

  function summarizeCase(text, idx) {
    const units = splitUnits(text);
    if (!units.length) return { blocks: [], evidence: [], themes: [] };
    // assign blocks by signposts; else by concept continuity
    const blocks = []; let cur = null;
    units.forEach((u, i) => {
      const sp = u.match(SIGNPOST);
      const cc = detectConcepts(u);
      const topc = topConcepts(cc, 1)[0];
      const startNew = !cur || (sp && /contention|^c ?[1-4]$|first|second|third|finally|lastly|next|framework|definition/i.test(sp[0].trim()))
        || (!sp && cur && topc && cur.units.length >= 4 && !cur.concepts[topc] && topConcepts(cur.concepts, 2).indexOf(topc) < 0);
      if (startNew) { cur = { units: [], concepts: {}, signpost: sp ? sp[0] : '' }; blocks.push(cur); }
      cur.units.push(u);
      for (const [c, v] of Object.entries(cc)) cur.concepts[c] = (cur.concepts[c] || 0) + v;
    });
    // merge tiny blocks
    const merged = [];
    for (const b of blocks) {
      if (merged.length && b.units.length < 2 && !/contention|^c ?[1-4]$|first|second|third|finally/i.test(b.signpost.trim())) {
        const p = merged[merged.length - 1]; p.units.push(...b.units); for (const [c, v] of Object.entries(b.concepts)) p.concepts[c] = (p.concepts[c] || 0) + v;
      } else merged.push(b);
    }
    const out = merged.map((b, i) => {
      const tc = topConcepts(b.concepts, 3);
      const label = /framework|definition/i.test(b.signpost) ? 'Framework / definitions' : (tc.length ? tc.slice(0, 2).map(c => CONCEPTS[c].label).join(' + ') : 'General');
      // key sentence: most concept-dense, prefer early
      let best = b.units[0], bs = -1;
      for (let j = 0; j < b.units.length; j++) {
        const u = b.units[j]; const cc = detectConcepts(u);
        const signOnly = SIGNPOST.test(u) && u.split(' ').length <= 9;
        const sc = Object.entries(cc).reduce((a, [c, v]) => a + (tc.includes(c) ? v : 0.2 * v), 0) + (hasEvidence(u) ? 0.5 : 0) - j * 0.1 - (signOnly ? 3 : 0);
        if (sc > bs) { bs = sc; best = u; }
      }
      best = String(best).replace(/^\s*(c ?[1-4]|contention ?(one|two|three|four|[1-4])|first(ly)?|second(ly)?|third(ly)?|finally|lastly)\b[\s:,.-]*/i, '') || best;
      const blockText = b.units.join(' ');
      const reb = idx.search(blockText, { types: ['rebuttal', 'counter'], limit: 3, boost: { rebuttal: 1.1 } }).results.filter(r => r.score > 0.2);
      const ask = idx.search(blockText, { types: ['askq'], limit: 2 }).results.filter(r => r.score > 0.15);
      const prep = idx.search(blockText, { types: ['qa'], limit: 2 }).results.filter(r => r.score > 0.2);
      return {
        n: i + 1, label, concepts: tc, key: best, text: blockText,
        evidence: b.units.filter(hasEvidence).slice(0, 3),
        rebuttals: reb, ask, prep,
        weigh: voiceFor(tc[0], idx).weigh
      };
    }).filter(b => b.text.split(' ').length >= 3 && b.concepts.length);
    out.forEach((b, i) => { b.n = i + 1; });
    const themes = {};
    for (const b of out) for (const c of b.concepts) themes[c] = (themes[c] || 0) + 1;
    return { blocks: out, evidence: out.flatMap(b => b.evidence), themes };
  }

  /* ---------------- speech builders (summary / final focus) ---------------- */
  function oppThemes(roundLog, idx) {
    // roundLog: [{section, text}] — later speeches weigh more
    const weights = { opening: 1, rebuttal: 1.3, counter: 1.3, crossfire: 0.5, predictions: 0.5, summary: 1.6, closing: 1.2 };
    const score = {}; const lines = {};
    for (const seg of roundLog || []) {
      for (const u of splitUnits(seg.text)) {
        const cc = detectConcepts(u);
        for (const [c, v] of Object.entries(cc)) {
          if (c === 'evidence' || c === 'definition') continue;
          score[c] = (score[c] || 0) + v * (weights[seg.section] || 1);
          const isQ = /\?\s*$/.test(u) || /^(isn't|aren't|doesn't|don't|won't|wouldn't|can't|why|how|what|who|do|does|is|are|will|would|can|should)\b/i.test(u.trim());
          const claimy = isQ ? 0.15 : /\b(will|would|can|could|is|are|means|causes?|hurts?|kills?|helps?|outweighs?)\b/i.test(u) ? 1.2 : 1;
          const evi = /^(according to|a study|the .* (institute|report)|\d)/i.test(u) ? 0.6 : 1;
          (lines[c] = lines[c] || []).push({ u, w: v * (weights[seg.section] || 1) * claimy * evi });
        }
      }
    }
    return Object.entries(score).sort((a, b) => b[1] - a[1]).map(([c, s]) => ({ c, s, label: CONCEPTS[c].label, line: (lines[c] || []).sort((a, b) => b.w - a.w)[0].u }));
  }

  function shortQuote(u, n) {
    const w = String(u).replace(/^[\s,]*(and|but|so|because|also|um|uh)\b[\s,]*/i, '').split(' ');
    let s = w.slice(0, n || 14).join(' ');
    return s.replace(/[,;:]$/, '') + (w.length > (n || 14) ? '…' : '');
  }

  function counterFor(concept, line, idx) {
    const q = line + ' ' + (CONCEPTS[concept] ? CONCEPTS[concept].label : '');
    const res = idx.search(q, { types: ['rebuttal', 'counter', 'qa'], limit: 4, boost: { counter: 1.1, rebuttal: 1.05 } }).results;
    const picked = pickSentences(res, q, 2);
    const claim = picked.find(p => !p.hasCite) || picked[0];
    const cited = picked.find(p => p.hasCite && p !== claim);
    return { claim: claim ? claim.s : '', cited: cited ? cited.s : '', card: res[0] };
  }

  function buildFinalFocus(baseHtml, roundLog, idx, opts = {}) {
    const themes = oppThemes(roundLog, idx).slice(0, 3);
    const base = stripHtml(String(baseHtml || '').replace(/<h\d[^>]*>[\s\S]*?<\/h\d>/gi, '').replace(/<ul[\s\S]*?<\/ul>/gi, ''));
    const sents = sentencesOf(base);
    const openLine = sents.slice(0, 2).join(' ');
    const closeLine = (sents.find(s => /vote (pro|con)|urge a (pro|con)|(pro|con) ballot/i.test(s)) || (idx.side === 'con' ? 'For these reasons, we urge a Con ballot.' : 'Vote Pro to protect our communities and our infrastructure.'));
    const counters = themes.map(t => {
      const ct = counterFor(t.c, t.line, idx);
      const body = [ct.claim, ct.cited].filter(Boolean).join(' ') || voiceFor(t.c, idx).impact || 'our evidence answers this directly.';
      return { concept: t.c, label: t.label, theyQuote: shortQuote(t.line, 14), counter: stripLeadingConj(compress(body, 48)), card: ct.card };
    });
    const weighLines = [];
    for (const t of themes.slice(0, 2)) { const w = voiceFor(t.c, idx).weigh; if (!weighLines.includes(w)) weighLines.push(w); }
    if (idx.side !== 'con') weighLines.push('Reversibility: a pause can be lifted tomorrow; a power plant built for a bubble sits on families\' bills for 30 years.');
    const text = [
      openLine,
      ...(counters.length ? ['Here\'s where their case breaks down.'] : []),
      ...counters.map(c => `They told you "${c.theyQuote}" — but ${lowerFirst(c.counter)}`),
      'Why we win: ' + weighLines.join(' '),
      closeLine
    ].join(' ');
    const html = [
      `<p>${escapeHtml(openLine)}</p>`,
      counters.length ? `<p><b>Here's where their case breaks down:</b></p><ul>${counters.map(c => `<li><b>${escapeHtml(c.label)}.</b> They told you "<i>${escapeHtml(c.theyQuote)}</i>" — but ${escapeHtml(lowerFirst(c.counter))}</li>`).join('')}</ul>` : '',
      `<p><b>Why we win:</b> ${escapeHtml(weighLines.join(' '))}</p>`,
      `<p>${escapeHtml(closeLine)}</p>`
    ].join('');
    const words = text.split(/\s+/).length;
    return { html, text, words, seconds: Math.round(words / 2.6), counters, themes };
  }

  function buildSummary(roundLog, sideData, idx) {
    if (idx.side === 'con') return buildSummaryGeneric(roundLog, sideData, idx);
    const themes = oppThemes(roundLog, idx).slice(0, 3);
    // what they attacked on OUR case → frontlines from counter section
    const attackText = (roundLog || []).filter(s => s.section !== 'opening').map(s => s.text).join(' ');
    const front = attackText ? idx.search(attackText, { types: ['counter'], limit: 3 }).results.filter(r => r.score > 0.25) : [];
    const html = [
      `<p><b>Roadmap:</b> I'll extend our first and third contentions, answer what they said, then weigh.</p>`,
      `<p><b>Extend Contention 1 — families pay.</b> Data centers caused 63% of PJM's record capacity spike — $9.3 billion passed to customers (PJM IMM). Either way families lose: if AI demand is real, prices spike; if it's a bubble, they pay for stranded plants (Altman '25).</p>`,
      front.length ? `<p><b>Their responses → our frontlines:</b></p><ul>${front.map(r => `<li><b>${escapeHtml(r.doc.head)}</b> → ${escapeHtml(compress(stripHtml(r.doc.item.html), 45))}</li>`).join('')}</ul>` : '',
      `<p><b>Extend Contention 3 — AI safety.</b> This summer, models from OpenAI and Anthropic hacked real companies during testing (CNN / AP '26). Compute is the most effective lever we have (Sastry et al.).</p>`,
      themes.length ? `<p><b>Their case doesn't stand:</b></p><ul>${themes.map(t => { const ct = counterFor(t.c, t.line, idx); return `<li><b>${escapeHtml(t.label)}:</b> ${escapeHtml(stripLeadingConj(compress(ct.claim || voiceFor(t.c, idx).impact, 32)))}</li>`; }).join('')}</ul>` : '',
      `<p><b>Weigh:</b> ${escapeHtml(themes.slice(0, 2).map(t => voiceFor(t.c, idx).weigh).join(' ') || DEFAULT_VOICE.weigh)} Prefer us on probability — our harms are already happening — and reversibility.</p>`
    ].join('');
    return { html, themes, frontlines: front };
  }

  function buildSummaryGeneric(roundLog, sideData, idx) {
    const themes = oppThemes(roundLog, idx).slice(0, 3);
    const attackText = (roundLog || []).filter(s => s.section !== 'opening').map(s => s.text).join(' ');
    const front = attackText ? idx.search(attackText, { types: ['counter'], limit: 3 }).results.filter(r => r.score > 0.25) : [];
    const html = [
      `<p><b>Roadmap:</b> I'll extend our case, answer what they said, then weigh.</p>`,
      `<p><b>Extend our case:</b> [your strongest contention + its evidence]</p>`,
      front.length ? `<p><b>Their responses → our frontlines:</b></p><ul>${front.map(r => `<li><b>${escapeHtml(r.doc.head)}</b> → ${escapeHtml(compress(stripHtml(r.doc.item.html), 45))}</li>`).join('')}</ul>` : '',
      themes.length ? `<p><b>Their case doesn't stand:</b></p><ul>${themes.map(t => { const ct = counterFor(t.c, t.line, idx); return `<li><b>${escapeHtml(t.label)}:</b> ${escapeHtml(compress(ct.claim || '[your answer]', 32))}</li>`; }).join('')}</ul>` : '',
      `<p><b>Weigh:</b> ${escapeHtml(NEUTRAL_VOICE.weigh)}</p>`
    ].join('');
    return { html, themes, frontlines: front };
  }
  function compress(s, maxWords) {
    const w = String(s).split(/\s+/);
    if (w.length <= maxWords) return s;
    const sents = sentencesOf(s); let out = '';
    for (const x of sents) { if ((out + ' ' + x).split(/\s+/).length > maxWords) break; out += (out ? ' ' : '') + x; }
    return out || w.slice(0, maxWords).join(' ') + '…';
  }
  function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  /* ---------------- word highlighter (for live transcripts) ---------------- */
  function highlightWords(text) {
    // returns HTML with concept words wrapped
    return String(text).split(/(\s+)/).map(w => {
      if (!w.trim()) return w;
      const cc = detectConcepts(w);
      const c = topConcepts(cc, 1)[0];
      if (!c) return escapeHtml(w);
      return `<span class="kw" data-concept="${c}" style="--kc:${CONCEPTS[c].color}" title="${escapeHtml(CONCEPTS[c].label)}">${escapeHtml(w)}</span>`;
    }).join('');
  }

  /* ---------------- paste-import parser ---------------- */
  function parsePastedDoc(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n').map(l => l.replace(/^[\s☐☑✓•●○◦▪\-*]+/, '').trim()).filter(Boolean);
    const out = { opening: [], rebuttal: [], counter: [], crossfire: [], predictions: [], summary: [], closing: [] };
    let sec = 'opening'; let pending = null;
    const heading = l => {
      const s = l.toLowerCase();
      if (s.length > 60) return null;
      if (/^(opening|starting argument|constructive)/.test(s)) return 'opening';
      if (/^counter/.test(s)) return 'counter';
      if (/^rebut/.test(s)) return 'rebuttal';
      if (/^crossfire predic|^predict/.test(s)) return 'predictions';
      if (/^crossfire|^cross-?ex|^questions/.test(s)) return 'crossfire';
      if (/^summary/.test(s)) return 'summary';
      if (/^(ending|closing|final focus)/.test(s)) return 'closing';
      return null;
    };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const h = heading(l); if (h) { sec = h; pending = null; continue; }
      let m;
      if ((m = l.match(/^when (?:the )?(?:con|pro|they|opponents?|the other (?:side|team)) (?:says?|argues?|claims?)[:\s]*["“](.+?)["”][:.]?\s*(.*)$/i))) {
        pending = { trigger: m[1], html: '' }; out.rebuttal.push(pending);
        if (m[2]) pending.html = m[2].replace(/^rebuttal\s*:\s*/i, ''); continue;
      }
      if ((m = l.match(/^rebuttal\s*:\s*(.+)$/i)) && pending) { pending.html += (pending.html ? ' ' : '') + m[1]; continue; }
      if ((m = l.match(/^opponents? (?:said|says|argued)[:\s]*["“](.+?)["”]\s*(.*)$/i))) { pending = { trigger: m[1], html: m[2] }; out.counter.push(pending); continue; }
      if ((m = l.match(/^(?:con|pro|opponents?|they) (?:will )?asks?[:\s]*["“](.+?)["”]\s*(?:your answer\s*:\s*)?["“]?(.*?)["”]?$/i))) {
        pending = { q: m[1], html: m[2] || '' }; out.predictions.push(pending); continue;
      }
      if ((m = l.match(/^your answer\s*:\s*["“]?(.+?)["”]?$/i)) && pending) { pending.html += (pending.html ? ' ' : '') + m[1]; continue; }
      if ((m = l.match(/^([A-Z][\w '\-]{1,40}):\s*["“](.+?)["”]$/)) && (sec === 'crossfire')) { out.crossfire.push({ label: m[1].trim(), q: m[2] }); pending = null; continue; }
      if (sec === 'crossfire' && /\?["”]?$/.test(l)) { out.crossfire.push({ label: 'Question', q: l.replace(/^["“]|["”]$/g, '') }); continue; }
      if (pending && /^(rebuttal|counter)/.test(sec) && !/^when /i.test(l)) { pending.html += (pending.html ? ' ' : '') + l; continue; }
      if (pending && sec === 'predictions') { pending.html += (pending.html ? ' ' : '') + l; continue; }
      out[sec === 'rebuttal' || sec === 'counter' || sec === 'predictions' || sec === 'crossfire' ? 'opening' : sec].push(l);
    }
    return out;
  }

  /* ---------------- LLM prompt helpers ---------------- */
  function llmPrompt(kind, payload, side, topic) {
    const sideName = side === 'con' ? 'CON (against)' : 'PRO (for)';
    const sys = `You are the debate partner for a high-school Public Forum team on the ${sideName} side of: "${topic}". Write in the team's voice: confident, punchy, plain words, short sentences, like "The reality is..." and "They protect their own profits, not the community." Use ONLY facts in the NOTES. Never invent numbers, studies or sources. Keep source tags in parentheses exactly as written.`;
    if (kind === 'crossfire') {
      const notes = payload.cards.map((c, i) => `- ${c}`).join('\n');
      const user = `NOTES:\n${notes}\n\nOpponent's crossfire question: "${payload.q}"\n\nWrite our spoken answer in 2-3 sentences (under 60 words). Start with a direct answer (No / Yes / Not quite). Then on a new line write "Ask back:" followed by one short question to turn it on them. Output only the answer.`;
      return { sys, user, max: 140 };
    }
    if (kind === 'polish') {
      const user = `Here is a draft ${payload.speech} (about ${payload.seconds} seconds). Rewrite it so it flows naturally when spoken aloud, keeping every fact and source tag, the same structure, and about the same length. Output only the speech.\n\nDRAFT:\n${payload.text}`;
      return { sys, user, max: 520 };
    }
    if (kind === 'summarize') {
      const user = `Here is a transcript of the opponent's speech. List their arguments as short bullets (max 6), each starting with "C1:", "C2:" etc., and note any evidence they cited. Output only the bullets.\n\nTRANSCRIPT:\n${payload.text.slice(0, 4000)}`;
      return { sys, user, max: 300 };
    }
    return { sys, user: payload.text, max: 200 };
  }

  const Brain = {
    CONCEPTS, VOICE, normalize, tokens, stem, stripHtml, detectConcepts, classify, echo, stanceFor,
    Index, answer, summarizeCase, buildFinalFocus, buildSummary, highlightWords, parsePastedDoc,
    splitUnits, oppThemes, llmPrompt, cleanQ, whoOf, sentencesOf, compress, escapeHtml, topConcepts
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Brain;
  root.Brain = Brain;
})(typeof window !== 'undefined' ? window : globalThis);
