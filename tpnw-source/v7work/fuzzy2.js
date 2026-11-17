    // =========================================================================
    // FUZZY FINDER: finds what you mean even with bad spelling or different wording.
    // It runs fully offline. Each typed word is matched to words the app actually contains
    // by exact word, word family, sound-alike, typo distance, letter pairs or a partial word,
    // and then by synonyms. Items are ranked by how many of your important words they cover.
    // =========================================================================
    const FZ_STOP = new Set(("a an the of to in on at by for and or but so if is are was were be been being do does did doing have has had " +
      "not no yes this that these those it its they them their there we our us you your he she his her i me my as with from into about " +
      "than then when while which who whom what why how where will would could should can may might must just only even also very more most " +
      "much many any all some such own same other each every one ones say says said get got make made really actually basically literally like " +
      "isn't doesn't don't didn't won't can't wouldn't aren't wasn't hasn't haven't shouldn't couldn't isnt doesnt dont didnt wont cant wouldnt arent " +
      "wasnt hasnt havent shouldnt couldnt im i'm youre you're theyre they're thats that's whats what's well ok okay um uh pls please thing things " +
      "stuff tell show find give card cards about regarding").split(/\s+/));
    const FZ_SHORT_KEEP = new Set(["uk", "us", "eu", "un", "ai", "p5", "mad", "npt", "npg", "fas", "iaea", "rand", "csis", "rusi", "ppp", "dca", "esg", "gru", "nac", "f35"]);
    const FZ_SYNONYMS = [
      ["nuke", "nukes", "nuclear", "atomic", "warhead", "warheads", "bomb", "bombs", "arsenal", "weapons"],
      ["b61", "bombs", "gravity", "sharing", "hosting", "stationed", "buchel", "incirlik", "aviano", "kleine", "volkel", "ghedi"],
      ["russia", "russian", "putin", "moscow", "kremlin"],
      ["us", "america", "american", "united", "washington", "trump", "pentagon"],
      ["umbrella", "extended", "protection", "guarantee", "shield", "article"],
      ["accident", "accidental", "false", "alarm", "glitch", "near", "miss", "misses", "luck", "lucky", "petrov", "1983", "collision"],
      ["verify", "verification", "inspection", "inspect", "inspectors", "safeguards", "iaea", "protocol", "cheat", "cheating", "cheaters", "check", "checks", "catch", "hide", "hidden", "secret", "secretly"],
      ["blackmail", "coercion", "coerce", "threaten", "threatens", "threat", "bully", "bullying", "intimidate", "ultimatum", "extortion", "monopoly", "surrender"],
      ["ppp", "purchasing", "parity", "cheap", "cheaper", "cheapest", "prices", "ammo", "ammunition", "shells", "munitions", "artillery"],
      ["poll", "polls", "polling", "survey", "surveys", "voters", "public", "opinion", "yougov", "citizens", "people"],
      ["sabotage", "grey", "gray", "zone", "hybrid", "cables"],
      ["escalate", "escalation", "escalating", "ladder", "spiral"],
      ["leave", "withdraw", "withdrawal", "exit", "quit", "article", "17"],
      ["ukraine", "ukrainian", "budapest", "1994", "kyiv", "crimea"],
      ["poland", "polish", "warsaw", "tusk", "duda"],
      ["germany", "german", "berlin", "merz", "lingen"],
      ["turkey", "turkiye", "incirlik", "erdogan"],
      ["uk", "britain", "british", "trident", "london", "england"],
      ["france", "french", "macron", "paris"],
      ["money", "spending", "spend", "budget", "cost", "costs", "billion", "trillion", "sipri", "afford", "pay"],
      ["bank", "banks", "divest", "divestment", "financing", "finance", "investors", "investment", "funds"],
      ["war", "invade", "invasion", "attack", "attacks", "conflict", "fight"],
      ["proliferation", "proliferate", "spread", "cascade", "own"],
      ["symbolic", "pointless", "useless", "meaningless", "nothing", "virtue"],
      ["treaty", "tpnw", "ban", "prohibition", "ratify", "ratifying", "ratification", "sign", "join"],
      ["nato", "alliance", "allies", "ally"],
      ["deterrence", "deter", "deterrent", "mad", "assured", "destruction", "peace"],
      ["conventional", "army", "troops", "tanks", "military", "forces", "brigades"],
      ["sabotage", "hybrid", "cables", "drones", "arson", "gru"],
      ["winter", "famine", "soot", "extinction", "climate", "starve"],
      ["china", "chinese", "beijing", "korea", "pyongyang"],
      ["rosatom", "uranium", "fuel", "enriched", "tvel"],
      ["moral", "immoral", "ethics", "evil", "wrong", "humanitarian"]
    ];
    function fzFold(s) {
      return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    }
    function fzWords(s) {
      return fzFold(s).replace(/(\d),(\d)/g, "$1$2").replace(/[^a-z0-9\s'-]/g, " ").split(/[\s-]+/)
        .map(w => w.replace(/^'+|'+$/g, "").replace(/'s$/, "")).filter(Boolean);
    }
    function fzStem(w) {
      if (/^\d/.test(w)) return w.replace(/[^0-9.]/g, "") || w;
      if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
      else if (w.length > 4 && /ied$/.test(w)) w = w.slice(0, -3) + "y";
      else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
      else if (w.length > 4 && /ly$/.test(w)) w = w.slice(0, -2);
      else if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + "y";
      if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
      return w.length > 6 ? w.slice(0, 6) : w;
    }
    // Sound-alike key: "nucular" = "nuclear", "rosatum" = "rosatom", "deturence" = "deterrence"
    function fzPhonetic(w) {
      w = fzFold(w).replace(/[^a-z]/g, "");
      if (!w) return "";
      w = w.replace(/^(kn|gn|pn)/, "n").replace(/^wr/, "r").replace(/^ps/, "s").replace(/^x/, "s").replace(/^chr/, "kr");
      w = w.replace(/ph/g, "f").replace(/gh/g, "").replace(/ck/g, "k").replace(/tch/g, "ch").replace(/sch/g, "sk")
        .replace(/(ch|sh)/g, "X").replace(/ti(?=[ao])/g, "X").replace(/th/g, "0").replace(/dg/g, "j")
        .replace(/c(?=[iey])/g, "s").replace(/[cqk]/g, "k").replace(/x/g, "ks").replace(/z/g, "s").replace(/v/g, "f")
        .replace(/wh/g, "w").replace(/g(?=[iey])/g, "j");
      const first = /[aeiou]/.test(w[0]) ? "A" : w[0];
      let rest = w.slice(1).replace(/[aeiouywh]/g, "");
      let out = first + rest;
      return out.replace(/(.)\1+/g, "$1");
    }
    function fzBigrams(w) {
      const s = " " + w + " "; const out = new Set();
      for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
      return out;
    }
    function fzDice(a, b) {
      const A = fzBigrams(a), B = fzBigrams(b); let inter = 0;
      A.forEach(x => { if (B.has(x)) inter++; });
      return (2 * inter) / (A.size + B.size);
    }
    let FZ_VOCAB = null, FZ_VOCAB_KEY = "", FZ_SYN = null;
    function fzAllText() {
      const parts = [];
      const walk = o => { if (typeof o === "string") parts.push(o); else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") Object.keys(o).forEach(k => { if (k !== "id" && k !== "url") walk(o[k]); }); };
      walk(DEBATE_DATA);
      if (typeof SEMANTIC_CONCEPT_GRAPH !== "undefined") walk(SEMANTIC_CONCEPT_GRAPH.map(n => [n.label, n.phrases, n.tokens]));
      if (typeof CLOSING_SNIPPETS !== "undefined") walk(CLOSING_SNIPPETS);
      FZ_SYNONYMS.forEach(g => parts.push(g.join(" ")));
      if (typeof QUERY_SYNONYM_EXPANSIONS !== "undefined") QUERY_SYNONYM_EXPANSIONS.forEach(g => { parts.push(g.triggers.join(" ")); parts.push(g.inject); });
      if (typeof COMMON_MISSPELLING_GROUPS !== "undefined") parts.push(Object.keys(COMMON_MISSPELLING_GROUPS).join(" "));
      return parts;
    }
    function fzVocab() {
      const key = ["PRO", "CON"].map(s => DEBATE_DATA[s] ? Object.values(DEBATE_DATA[s]).map(v => Array.isArray(v) ? v.length : 1).join(".") : "").join("|") + "|" + (DEBATE_DATA.SOURCE_CARDS || []).length;
      if (FZ_VOCAB && FZ_VOCAB_KEY === key) return FZ_VOCAB;
      const counts = new Map();
      const add = w => { if (!w || w.length < 2) return; counts.set(w, (counts.get(w) || 0) + 1); };
      fzAllText().forEach(t => {
        fzFold(t).replace(/(\d),(\d)/g, "$1$2").replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).forEach(raw => {
          const w = raw.replace(/^['-]+|['-]+$/g, "").replace(/'s$/, ""); if (!w) return;
          if (w.includes("-")) { add(w.replace(/-/g, "")); w.split("-").forEach(add); } else add(w);
        });
      });
      const vocab = new Map();
      counts.forEach((c, w) => vocab.set(w, { c, stem: fzStem(w), ph: fzPhonetic(w) }));
      FZ_SYN = new Map();
      FZ_SYNONYMS.forEach(g => g.forEach(w => { const st = fzStem(w); FZ_SYN.set(st, [...new Set([...(FZ_SYN.get(st) || []), ...g.map(fzStem)])]); }));
      FZ_VOCAB = vocab; FZ_VOCAB_KEY = key; FZ_TOKEN_CACHE.clear(); FZ_INDEX_CACHE.clear();
      return vocab;
    }
    const FZ_TOKEN_CACHE = new Map();
    // Returns [{stem, sim}] for one typed word: the app words it most likely means
    function fzMatchToken(qt) {
      if (FZ_TOKEN_CACHE.has(qt)) return FZ_TOKEN_CACHE.get(qt);
      const vocab = fzVocab();
      const best = new Map();
      const put = (stem, sim) => { if (sim > (best.get(stem) || 0)) best.set(stem, sim); };
      const isNum = /^\d/.test(qt);
      if (vocab.has(qt)) put(vocab.get(qt).stem, 1);
      put(fzStem(qt), 0.97);
      if (isNum) {
        const digits = qt.replace(/[^0-9.]/g, "");
        vocab.forEach((v, w) => { if (/^\d/.test(w) && w.replace(/[^0-9.]/g, "") === digits) put(v.stem, 0.95); });
      } else if (qt.length >= 3) {
        const qph = fzPhonetic(qt), ql = qt.length;
        const maxD = ql <= 4 ? 1 : ql <= 7 ? 2 : 3;
        vocab.forEach((v, w) => {
          if (/^\d/.test(w)) return;
          let sim = 0;
          if (w.length >= ql + 1 && w.startsWith(qt)) sim = Math.max(sim, ql >= 4 ? 0.82 : 0.7);
          if (v.ph === qph && Math.abs(w.length - ql) <= 3) { if (qph.length >= 4) sim = Math.max(sim, 0.86); else if (qph.length === 3) sim = Math.max(sim, 0.76); else if (w[0] === qt[0] && damerauLevenshtein(qt, w, 2) <= 2) sim = Math.max(sim, 0.62); }
          else if (qph.length >= 5 && Math.abs(v.ph.length - qph.length) <= 1 && v.ph[0] === qph[0] && damerauLevenshtein(qph, v.ph, 1) <= 1 && fzDice(qt, w) >= 0.3) sim = Math.max(sim, 0.7);
          if (Math.abs(w.length - ql) <= maxD && (w[0] === qt[0] || v.ph[0] === qph[0] || ql >= 7)) {
            const d = damerauLevenshtein(qt, w, maxD);
            if (d <= maxD) {
              const dice = fzDice(qt, w);
              if (dice >= 0.25 || d === 1) sim = Math.max(sim, d === 0 ? 1 : d === 1 ? 0.8 : d === 2 ? 0.66 : 0.52);
            }
          }
          if (sim < 0.5 && ql >= 5 && Math.abs(w.length - ql) <= 4) {
            const dice = fzDice(qt, w);
            if (dice >= 0.62) sim = Math.max(sim, dice * 0.8);
          }
          if (sim > 0) put(v.stem, sim);
        });
      }
      // synonyms of strong matches, at reduced weight
      [...best.entries()].filter(([, s]) => s >= 0.8).forEach(([st, s]) => (FZ_SYN.get(st) || []).forEach(sy => put(sy, s * 0.55)));
      const out = [...best.entries()].map(([stem, sim]) => ({ stem, sim })).sort((a, b) => b.sim - a.sim).slice(0, 12);
      FZ_TOKEN_CACHE.set(qt, out);
      return out;
    }
    function fzQueryTokens(query) {
      const vocab = fzVocab();
      let words = fzWords(query).filter(w => !FZ_STOP.has(w) && (w.length >= 3 || FZ_SHORT_KEEP.has(w) || /^\d/.test(w)));
      const out = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i], nx = words[i + 1];
        // "b 61" → "b61", "f 35" → "f35", "new start" kept as words
        if (nx && vocab.has(w + nx) && !vocab.has(w)) { out.push(w + nx); i++; continue; }
        // "nuclearwinter" → "nuclear" + "winter"
        if (!vocab.has(w) && w.length >= 8) {
          let split = null;
          for (let k = 3; k <= w.length - 3; k++) { if (vocab.has(w.slice(0, k)) && vocab.has(w.slice(k))) { split = [w.slice(0, k), w.slice(k)]; break; } }
          if (split) { out.push(...split); continue; }
        }
        out.push(w);
      }
      return [...new Set(out)];
    }
    const FZ_INDEX_CACHE = new Map();
    // items: [{key, strong: string, weak: string, obj}]
    function fzBuildIndex(cacheKey, items) {
      fzVocab();
      if (FZ_INDEX_CACHE.has(cacheKey)) return FZ_INDEX_CACHE.get(cacheKey);
      const entries = items.map(it => {
        const sw = fzWords(it.strong).map(fzStem), ww = fzWords(it.weak).map(fzStem);
        const pairs = new Set(); for (let i = 0; i + 1 < sw.length; i++) pairs.add(sw[i] + " " + sw[i + 1]);
        return { it, strong: new Set(sw), weak: new Set(ww), pairs };
      });
      const df = new Map();
      entries.forEach(e => new Set([...e.strong, ...e.weak]).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
      const N = Math.max(1, entries.length);
      const idx = { entries, idf: t => Math.max(0.2, Math.log((N + 1) / ((df.get(t) || 0) + 0.5))) };
      FZ_INDEX_CACHE.set(cacheKey, idx);
      return idx;
    }
    // Rank index entries for a query: [{obj, key, score, coverage}]
    function fzRank(idx, query) {
      const qts = fzQueryTokens(query);
      if (!qts.length) return [];
      const cands = qts.map(fzMatchToken);
      return idx.entries.map(e => {
        let score = 0, covered = 0; const hitStems = [];
        cands.forEach(list => {
          let bestHere = 0, bestStem = null;
          list.forEach(({ stem, sim }) => {
            const w = idx.idf(stem);
            const v = e.strong.has(stem) ? sim * w : e.weak.has(stem) ? sim * w * 0.35 : 0;
            if (v > bestHere) { bestHere = v; bestStem = stem; }
          });
          if (bestHere > 0) { score += bestHere; covered++; hitStems.push(bestStem); } else hitStems.push(null);
        });
        for (let i = 0; i + 1 < hitStems.length; i++) if (hitStems[i] && hitStems[i + 1] && e.pairs.has(hitStems[i] + " " + hitStems[i + 1])) score += 0.6 * (idx.idf(hitStems[i]) + idx.idf(hitStems[i + 1]));
        const coverage = covered / cands.length;
        return { obj: e.it.obj, key: e.it.key, score: score * (0.55 + 0.45 * coverage), coverage };
      }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    }
    // Merge two ranked id lists (reciprocal rank fusion): items both methods like rise to the top
    function fzFuse(listA, listB, keyFn, k) {
      const sc = new Map(), obj = new Map(); k = k || 8;
      [listA, listB].forEach(list => list.forEach((x, i) => { const id = keyFn(x); sc.set(id, (sc.get(id) || 0) + 1 / (k + i)); if (!obj.has(id)) obj.set(id, x); }));
      return [...sc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => obj.get(id));
    }
    // Spell-fix a typed word to the app word it most likely means (only for words the app doesn't contain)
    function fzCorrectWord(w) {
      const vocab = fzVocab();
      if (!w || w.length < 4 || vocab.has(w) || FZ_STOP.has(w) || /^\d/.test(w)) return w;
      if (typeof PROTECTED_COMMON_WORDS !== "undefined" && PROTECTED_COMMON_WORDS.has(w)) return w;
      const qph = fzPhonetic(w), maxD = w.length <= 5 ? 1 : w.length <= 8 ? 2 : 3;
      let best = w, bestScore = 0;
      vocab.forEach((v, cand) => {
        if (/^\d/.test(cand) || cand.length < 4 || Math.abs(cand.length - w.length) > maxD) return;
        const d = damerauLevenshtein(w, cand, maxD); const same = v.ph === qph && qph.length >= 3;
        if (d > maxD && !same) return;
        const s = (same ? 0.5 : 0) + (d <= maxD ? (1 - d / (maxD + 1)) : 0) + Math.min(0.15, Math.log(1 + v.c) / 40) + (cand[0] === w[0] ? 0.1 : 0);
        if (s > bestScore) { bestScore = s; best = cand; }
      });
      return bestScore >= 0.6 ? best : w;
    }
    // Spell-fix a whole typed query, keeping words the app already knows
    function fzCorrectQuery(q) {
      try {
        return String(q || "").replace(/[A-Za-z][A-Za-z']{3,}/g, m => { const low = m.toLowerCase(); const fixed = fzCorrectWord(low); return fixed === low ? m : fixed; });
      } catch (e) { return q; }
    }
    // One fuzzy index per side over every rebuttal, defense and crossfire answer
    function fzSideIndex(side) {
      const d = DEBATE_DATA[side] || {};
      const items = [];
      [...(d.rebuttals || []), ...(d.frontlines || []), ...(d.counterDefenses || [])].forEach(b => items.push({
        key: b.id, obj: b,
        strong: [b.chipLabel, b.trigger || "", b.contention || "", (b.keywords || []).join(" "), (typeof getShortFiveWordLabel === "function" ? getShortFiveWordLabel(b) : "")].join(" "),
        weak: (b.response || "") + " " + (b.citation || "")
      }));
      (d.prefires || []).forEach(pf => items.push({
        key: pf.id, obj: pf, isPrefire: true,
        strong: [pf.topicLabel, pf.chip || "", (pf.phrases || []).join(" "), (pf.keywords || []).join(" ")].join(" "),
        weak: (pf.coreAnswer || "") + " " + (pf.citation || "")
      }));
      fzVocab();
      return fzBuildIndex("side:" + side + ":" + FZ_VOCAB_KEY, items);
    }

