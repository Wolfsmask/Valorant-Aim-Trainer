// Search ranking helper: improves every search, filter and match in the app.
// It starts quietly in the background; until it is ready (or if the browser can't run it)
// every screen works exactly as before with the built-in keyword matching.
(function () {
  const QPRE = "Represent this sentence for searching relevant passages: ";
  const X = window.PFX = { state: "idle", error: "", ready: null, cache: new Map(), index: null };
  const assetEl = k => document.querySelector('script[data-pfx="' + k + '"]');
  const assetKeys = () => Array.from(document.querySelectorAll("script[data-pfx]")).map(s => s.getAttribute("data-pfx"));
  const fix = q => (typeof fzCorrectQuery === "function" ? fzCorrectQuery(q) : q);

  async function gunzipB64(b64) {
    const bin = atob(b64.trim());
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function load() {
    if (X.ready) return X.ready;
    X.ready = (async () => {
      X.state = "loading";
      if (typeof DecompressionStream === "undefined" || typeof WebAssembly === "undefined") throw new Error("unsupported browser");
      const lib = await gunzipB64(assetEl("lib").textContent);
      const T = await import(URL.createObjectURL(new Blob([lib], { type: "text/javascript" })));
      const wasm = await gunzipB64(assetEl("wasm").textContent);
      const glue = await gunzipB64(assetEl("mjs").textContent);
      const keys = assetKeys().filter(k => k !== "lib" && k !== "wasm" && k !== "mjs");
      T.env.allowLocalModels = false;
      T.env.allowRemoteModels = true; // every request is answered from the copies stored in this file
      T.env.useBrowserCache = false;
      T.env.useCustomCache = true;
      T.env.customCache = {
        match: async name => {
          const key = keys.find(k => String(name).endsWith(k));
          if (!key) return undefined;
          const bytes = await gunzipB64(assetEl(key).textContent);
          return new Response(bytes, { status: 200, headers: { "content-type": key.endsWith(".json") ? "application/json" : "application/octet-stream", "content-length": String(bytes.length) } });
        },
        put: async () => {}
      };
      T.env.backends.onnx.wasm.wasmPaths = { wasm: URL.createObjectURL(new Blob([wasm], { type: "application/wasm" })), mjs: URL.createObjectURL(new Blob([glue], { type: "text/javascript" })) };
      T.env.backends.onnx.wasm.numThreads = 1;
      T.env.backends.onnx.wasm.proxy = false;
      try { T.env.backends.onnx.logLevel = "fatal"; } catch (e) {}
      X.embed = await T.pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { dtype: "q8", device: "wasm" });
      X.tok = await T.AutoTokenizer.from_pretrained("Xenova/ms-marco-MiniLM-L-6-v2");
      X.rr = await T.AutoModelForSequenceClassification.from_pretrained("Xenova/ms-marco-MiniLM-L-6-v2", { dtype: "q8", device: "wasm" });
      const raw = JSON.parse(document.getElementById("pfx-index").textContent);
      X.index = {};
      Object.entries(raw).forEach(([g, v]) => {
        const bin = atob(v.q); const n = v.ids.length, dim = v.dim; const f = new Float32Array(n * dim);
        for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) { let b = bin.charCodeAt(i * dim + k); if (b > 127) b -= 256; f[i * dim + k] = b * v.scales[i]; }
        X.index[g] = { ids: v.ids, texts: v.texts, dim, vecs: f };
      });
      await rank("warm up", "PRO", "blocks");
      X.state = "ready";
      try { document.dispatchEvent(new CustomEvent("pfx-ready")); } catch (e) {}
      return true;
    })().catch(e => { X.state = "failed"; X.error = String(e && e.message || e); return false; });
    return X.ready;
  }

  // ranking: [{id, score, logit, cos}] best first
  async function rank(query, side, kind) {
    const q = String(query || "").trim();
    if (!q || !X.embed) return [];
    const g = kind === "cards" ? X.index.cards : X.index[side + ":" + kind];
    if (!g) return [];
    const ck = kind + "|" + side + "|" + q.toLowerCase();
    if (X.cache.has(ck)) return X.cache.get(ck);
    const qv = (await X.embed(QPRE + q, { pooling: "cls", normalize: true })).data;
    const n = g.ids.length, dim = g.dim, sims = [];
    for (let i = 0; i < n; i++) { let d = 0; for (let k = 0; k < dim; k++) d += qv[k] * g.vecs[i * dim + k]; sims.push([i, d]); }
    sims.sort((a, b) => b[1] - a[1]);
    const top = sims.slice(0, 12);
    const inp = X.tok(new Array(top.length).fill(q), { text_pair: top.map(t => g.texts[t[0]]), padding: true, truncation: true });
    const lg = Array.from((await X.rr(inp)).logits.data);
    const out = top.map((t, j) => ({ id: g.ids[t[0]], cos: t[1], logit: lg[j], score: lg[j] + 8 * t[1] })).sort((a, b) => b.score - a.score);
    if (X.cache.size > 600) X.cache.clear();
    X.cache.set(ck, out);
    return out;
  }
  X.rank = rank;
  X.load = load;

  // weighted reciprocal-rank merge of the keyword ranking and this ranking
  function fuse(lexList, aiList, keyFn, wLex, wAi, k) {
    const sc = new Map(), obj = new Map();
    lexList.forEach((x, i) => { const id = keyFn(x); sc.set(id, (sc.get(id) || 0) + wLex / (k + i)); obj.set(id, x); });
    aiList.forEach((x, i) => { const id = keyFn(x); sc.set(id, (sc.get(id) || 0) + wAi / (k + i)); if (!obj.has(id)) obj.set(id, x); });
    return [...sc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => obj.get(id)).filter(Boolean);
  }
  X.weights = { wLex: 1, wAi: 1, k: 4, typoDamp: 0.8 };
  X.th = { crossfire: 4, crossfireAlt: 6, siphon: -3, filter: -1 };

  const blocksOf = side => { const d = DEBATE_DATA[side] || {}; return [...(d.rebuttals || []), ...(d.frontlines || []), ...(d.counterDefenses || [])]; };
  const blockById = (side, id) => blocksOf(side).find(b => b.id === id);
  const typoWeight = (query, fixed) => {
    const words = String(query).toLowerCase().match(/[a-z']{3,}/g) || [], fw = String(fixed).toLowerCase().match(/[a-z']{3,}/g) || [];
    const share = words.length ? words.filter((x, i) => x !== fw[i]).length / words.length : 0;
    return X.weights.wAi * (1 - X.weights.typoDamp * share);
  };

  // 1. Contention & defense finder boxes
  async function fusedBlocks(query, side) {
    const lex = aiSemanticRankAllBlocksForSide(query, side);
    const fixed = fix(query);
    const ai = (await rank(fixed, side, "blocks")).map(r => blockById(side, r.id)).filter(Boolean);
    return { conceptLabel: lex.conceptLabel, results: fuse(lex.results, ai, b => b.id, X.weights.wLex, typoWeight(query, fixed), X.weights.k), ai };
  }
  X.fusedBlocks = fusedBlocks;
  function hookBox(fnName, inputId, boxId, ctx) {
    const orig = window[fnName];
    if (typeof orig !== "function") return;
    let timer = null;
    window[fnName] = function (val) {
      orig.apply(this, arguments);
      clearTimeout(timer);
      const q = String(val || "").trim();
      if (!q || X.state !== "ready") return;
      timer = setTimeout(async () => {
        try {
          const side = state.side;
          const res = await fusedBlocks(q, side);
          const inp = document.getElementById(inputId);
          if (!inp || inp.value.trim() !== q || state.side !== side) return;
          const box = document.getElementById(boxId);
          if (!box) return;
          box.classList.remove("hidden");
          box.innerHTML = renderAiInstantMatchCardsHtml(res.results, res.conceptLabel, ctx);
        } catch (e) {}
      }, 140);
    };
  }

  // 2. Source cards (full list and quick lookup)
  async function fusedCards(query) {
    const lex = filterSourceCardsByQuery(query);
    const all = DEBATE_DATA.SOURCE_CARDS || [];
    const lexMatched = lex.length === all.length ? [] : lex;
    const fixed = fix(query);
    const ai = (await rank(fixed, "", "cards")).map(r => all.find(c => c.short === r.id)).filter(Boolean);
    const merged = fuse(lexMatched, ai, c => c.short, X.weights.wLex, typoWeight(query, fixed), X.weights.k);
    return merged.length ? merged : lex;
  }
  X.fusedCards = fusedCards;
  function hookCardRender(fnName, inputId) {
    const orig = window[fnName];
    if (typeof orig !== "function") return;
    let t = null;
    window[fnName] = function () {
      orig.apply(this, arguments);
      clearTimeout(t);
      const inp = document.getElementById(inputId);
      const q = inp ? inp.value.trim() : "";
      if (!q || X.state !== "ready") return;
      t = setTimeout(async () => {
        try {
          const order = await fusedCards(q);
          if (!inp || inp.value.trim() !== q) return;
          const saved = window.filterSourceCardsByQuery;
          window.filterSourceCardsByQuery = () => order;
          try { orig.apply(this, []); } finally { window.filterSourceCardsByQuery = saved; }
        } catch (e) {}
      }, 160);
    };
  }

  // 3. Crossfire and Grand Crossfire: answer only when the keyword matcher has nothing (or just a "closest" guess)
  //    and this ranking is very sure; also offer a very sure different answer as an extra choice.
  async function crossfirePick(q, side, minLogit) {
    const a = await rank(fix(q), side, "prefires");
    if (!a.length || a[0].logit < minLogit) return null;
    return (DEBATE_DATA[side].prefires || []).find(p => p.id === a[0].id) || null;
  }
  X.crossfireAssist = (q, side) => crossfirePick(q, side, X.th.crossfire);
  function answerHtml(pf, q, label) {
    const ans = ensureDirectCrossfireVoice(buildTailoredSpokenAnswer(pf, q, null));
    return `
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#3D6B58] text-white">${label}</span>
          <span class="text-xs font-bold text-[#3D6B58]">${escapeHtml(pf.topicLabel)}</span>
        </div>
        <div class="serif-podium text-lg leading-relaxed text-[#2A2421] bg-[#FFFDF9] p-4 rounded-xl border border-[#E6DEC8]">${highlightSpokenCitations(ans)}${renderCompactSourceFooterHtml(ans, pf.citation)}</div>
      </div>`;
  }
  function hookCrossfire() {
    const orig = window.matchCrossfirePrefire;
    if (typeof orig !== "function") return;
    let t = null;
    window.matchCrossfirePrefire = function (rankIndex) {
      orig.apply(this, arguments);
      clearTimeout(t);
      if (X.state !== "ready" || (typeof rankIndex === "number" && rankIndex > 0)) return;
      const inp = document.getElementById("crossfireQuestionInput"), box = document.getElementById("crossfirePrefireResult");
      const q = inp ? inp.value.trim() : "";
      if (!q || !box) return;
      const txt = box.textContent || "";
      const noAnswer = /NO PREFIRED ANSWER/.test(txt), soft = /Closest Answer — check it fits/.test(txt);
      t = setTimeout(async () => {
        try {
          const side = state.side;
          if (noAnswer || soft) {
            const pf = await crossfirePick(q, side, X.th.crossfire);
            if (!pf || inp.value.trim() !== q || state.side !== side) return;
            box.className = "flex-1 flex flex-col justify-between rounded-2xl border-2 border-[#3D6B58] bg-[#EFF6F3] p-5 text-left shadow-sm";
            box.innerHTML = answerHtml(pf, q, "★ Best Match");
            return;
          }
          // a matched answer is showing: add a very sure different answer as one more choice
          const pf = await crossfirePick(q, side, X.th.crossfireAlt);
          if (!pf || inp.value.trim() !== q || state.side !== side) return;
          if ((box.textContent || "").includes(pf.topicLabel)) return;
          const row = box.querySelector("div.flex.flex-wrap.items-center.gap-1\\.5.pt-2");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "text-[11px] px-2.5 py-0.5 rounded-lg border transition cursor-pointer bg-[#FFFDF9] text-[#2A2421] border-[#D5CBB8] hover:bg-[#EDE6D8]";
          btn.textContent = "+ " + (pf.chip || pf.topicLabel);
          btn.onclick = () => { box.innerHTML = answerHtml(pf, q, "★ Match"); };
          if (row) row.appendChild(btn);
          else { const wrap = document.createElement("div"); wrap.className = "flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#3D6B58]/20"; wrap.innerHTML = '<span class="text-[10px] font-extrabold uppercase tracking-wider text-[#6E6259]">Also:</span>'; wrap.appendChild(btn); box.appendChild(wrap); }
        } catch (e) {}
      }, 120);
    };
  }
  function hookGrandCx() {
    const orig = window.matchGrandCxQuick;
    if (typeof orig !== "function") return;
    let t = null;
    window.matchGrandCxQuick = function (val) {
      orig.apply(this, arguments);
      clearTimeout(t);
      const q = String(val || "").trim();
      const out = document.getElementById("grandCxQuickOutput");
      if (!q || !out || X.state !== "ready") return;
      const txt = out.textContent || "";
      if (!/No prefire match|Closest answer/i.test(txt)) return;
      t = setTimeout(async () => {
        try {
          const side = state.side;
          const pf = await crossfirePick(q, side, X.th.crossfire);
          const inp = document.getElementById("grandCxInput");
          if (!pf || (inp && inp.value.trim() !== q) || state.side !== side) return;
          const ans = buildTailoredSpokenAnswer(pf, q);
          out.innerHTML = `<div class="serif-podium text-base font-medium text-[#2A2421] bg-[#FFFDF9] p-3.5 rounded-xl border-2 border-[#3D6B58]/40">${highlightSpokenCitations(ans)}${renderCompactSourceFooterHtml(ans, pf.citation)}</div>`;
        } catch (e) {}
      }, 140);
    };
  }

  // 4. Opponent speech: for each sentence, add the one counter this ranking is very sure about
  //    (after the keyword matches, never replacing them)
  const siphonExtra = new Map(); // sentence -> {id, kind}
  let siphonJob = null, siphonBusy = false;
  function sentencesOf(text) { return (typeof splitIntoSentences === "function" ? splitIntoSentences(text) : String(text).split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(s => (s.match(/[A-Za-z]{2,}/g) || []).length >= 4); }
  function applySiphonExtras(text) {
    const reb = state.autoMatchedRebuttalIds || [], fl = state.autoMatchedFrontlineIds || [], cd = state.autoMatchedCounterDefenseIds || [];
    sentencesOf(text).forEach(s => {
      const e = siphonExtra.get(s + "|" + state.side);
      if (!e || !e.id) return;
      const list = e.id.includes("_fl_") ? fl : e.id.includes("_cd_") ? cd : reb;
      if (![...reb, ...fl, ...cd].includes(e.id)) list.push(e.id);
    });
  }
  function hookSiphon() {
    const orig = window.siphonRebuttalsFromText;
    if (typeof orig !== "function") return;
    window.siphonRebuttalsFromText = function (liveText, loggedText) {
      const r = orig.apply(this, arguments);
      try {
        if (X.state === "ready") {
          const text = (liveText || "") + " " + (loggedText || "");
          applySiphonExtras(text);
          const missing = sentencesOf(text).filter(s => !siphonExtra.has(s + "|" + state.side));
          if (missing.length) scheduleSiphon();
        }
      } catch (e) {}
      return r;
    };
  }
  function scheduleSiphon() {
    clearTimeout(siphonJob);
    siphonJob = setTimeout(async () => {
      if (siphonBusy) { scheduleSiphon(); return; }
      siphonBusy = true;
      try {
        const side = state.side;
        const inp = document.getElementById("opponentTranscriptInput");
        const text = (inp ? inp.value : "") + " " + (state.loggedQuotes || []).map(q => q.text).join(" ");
        let added = false;
        for (const s of sentencesOf(text)) {
          const key = s + "|" + side;
          if (siphonExtra.has(key)) continue;
          const a = await rank(fix(s), side, "blocks");
          const top = a[0];
          siphonExtra.set(key, top && top.logit >= X.th.siphon ? { id: top.id } : { id: "" });
          if (top && top.logit >= X.th.siphon) added = true;
        }
        if (siphonExtra.size > 800) siphonExtra.clear();
        if (added && state.side === side && typeof runLiveTranscriptSiphon === "function") runLiveTranscriptSiphon(true);
      } catch (e) {} finally { siphonBusy = false; }
    }, 700);
  }

  // 5. List filters (trap list, rebuttal list): also show items that clearly mean what you typed
  const filterHits = new Map(); // query|side -> Set of item labels
  const pendingFilter = new Set();
  function hookFilter() {
    const orig = window.matchesSearchFilterTokens;
    if (typeof orig !== "function") return;
    window.matchesSearchFilterTokens = function (hay, q) {
      if (orig.apply(this, arguments)) return true;
      try {
        const query = String(q || "").trim();
        if (!query || X.state !== "ready" || query.split(/\s+/).length < 2) return false;
        const key = query.toLowerCase() + "|" + state.side;
        const set = filterHits.get(key);
        if (!set) { computeFilter(query, state.side, key); return false; }
        const h = String(hay || "");
        for (const label of set) if (label && h.startsWith(label)) return true;
      } catch (e) {}
      return false;
    };
  }
  function computeFilter(query, side, key) {
    if (pendingFilter.has(key)) return;
    pendingFilter.add(key);
    setTimeout(async () => {
      try {
        const fixed = fix(query);
        const [bl, tr] = [await rank(fixed, side, "blocks"), await rank(fixed, side, "traps")];
        const set = new Set();
        bl.filter(r => r.logit >= X.th.filter).forEach(r => { const b = blockById(side, r.id); if (b) set.add(b.chipLabel); });
        tr.filter(r => r.logit >= X.th.filter).forEach(r => { const t = (DEBATE_DATA[side].crossfireTraps || [])[+r.id]; if (t) set.add(t.trigger); });
        filterHits.set(key, set);
        if (filterHits.size > 200) filterHits.delete(filterHits.keys().next().value);
        if (set.size && state.side === side) ["trapFilterInput", "rebuttalFilterInput"].forEach(id => { const el = document.getElementById(id); if (el && el.value.trim().toLowerCase() === query.toLowerCase()) el.dispatchEvent(new Event("input", { bubbles: true })); });
      } catch (e) {} finally { pendingFilter.delete(key); }
    }, 200);
  }

  function start() {
    hookBox("handleSiphonAiSearchInput", "siphonQuickFilterInput", "siphonAiInstantMatchBox", "siphon");
    hookBox("handleRebuttalAiSearchInput", "rebuttalQuickFilterInput", "rebuttalAiInstantMatchBox", "rebuttal");
    hookCardRender("renderSourceCards", "sourceCardsSearchInput");
    hookCardRender("renderQuickSourceModalResults", "quickSourceModalInput");
    hookCrossfire();
    hookGrandCx();
    hookSiphon();
    hookFilter();
    setTimeout(load, 900);
    // once ready, refresh whatever is already on screen
    document.addEventListener("pfx-ready", () => {
      try {
        [["siphonQuickFilterInput", "handleSiphonAiSearchInput"], ["rebuttalQuickFilterInput", "handleRebuttalAiSearchInput"]].forEach(([id, fn]) => { const el = document.getElementById(id); if (el && el.value.trim() && typeof window[fn] === "function") window[fn](el.value); });
        const opp = document.getElementById("opponentTranscriptInput");
        if (opp && opp.value.trim() && typeof runLiveTranscriptSiphon === "function") runLiveTranscriptSiphon(true);
        const cf = document.getElementById("crossfireQuestionInput");
        if (cf && cf.value.trim()) window.matchCrossfirePrefire(0);
      } catch (e) {}
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
