// ============================================================================
// OFFLINE AI SEARCH (real neural models, no internet)
//  1. BGE-small turns your words into a "meaning vector" and finds the cards that mean the same thing.
//  2. An MS-MARCO cross-encoder re-reads the top 12 next to your words and re-ranks them.
//  3. The result is merged with the typo-proof keyword search, so spelling AND meaning both count.
// The page works instantly without it; the AI switches on a few seconds after the page opens.
// ============================================================================
(function () {
  const QPRE = "Represent this sentence for searching relevant passages: ";
  const PFAI = window.PFAI = { state: "idle", error: "", ready: null, cache: new Map(), index: null };
  const assetEl = k => document.querySelector('script[data-pfai="' + k + '"]');
  const assetKeys = () => Array.from(document.querySelectorAll("script[data-pfai]")).map(s => s.getAttribute("data-pfai"));

  async function gunzipB64(b64) {
    const bin = atob(b64.trim());
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function setBadge() {
    let b = document.getElementById("pfAiBadge");
    if (!b) {
      b = document.createElement("div");
      b.id = "pfAiBadge";
      b.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:60;font:600 11px/1.2 Inter,system-ui,sans-serif;padding:5px 9px;border-radius:999px;border:1px solid #D5CBB8;background:#FFFDF9;color:#6E6259;box-shadow:0 1px 3px rgba(0,0,0,.08);pointer-events:none";
      document.body.appendChild(b);
    }
    const txt = { idle: "🧠 Offline AI: starting…", loading: "🧠 Offline AI: loading…", ready: "🧠 Offline AI: ready", failed: "🧠 Offline AI off (keyword search still works)" }[PFAI.state];
    b.textContent = txt;
    b.style.color = PFAI.state === "ready" ? "#3D6B58" : PFAI.state === "failed" ? "#C86D3B" : "#6E6259";
    b.title = PFAI.error || "";
    if (PFAI.state === "ready") setTimeout(() => { if (PFAI.state === "ready") b.style.opacity = "0.55"; }, 4000);
  }

  function load() {
    if (PFAI.ready) return PFAI.ready;
    PFAI.ready = (async () => {
      PFAI.state = "loading"; setBadge();
      if (typeof DecompressionStream === "undefined" || typeof WebAssembly === "undefined") throw new Error("This browser is too old for the offline AI (use Chrome, Edge, or Safari 16.4+)");
      const lib = await gunzipB64(assetEl("lib").textContent);
      const T = await import(URL.createObjectURL(new Blob([lib], { type: "text/javascript" })));
      const wasm = await gunzipB64(assetEl("wasm").textContent);
      const glue = await gunzipB64(assetEl("mjs").textContent);
      const keys = assetKeys().filter(k => k !== "lib" && k !== "wasm" && k !== "mjs");
      T.env.allowLocalModels = false;
      T.env.allowRemoteModels = true; // requests are answered from the copies inside this file (custom cache)
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
      PFAI.embed = await T.pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { dtype: "q8", device: "wasm" });
      PFAI.tok = await T.AutoTokenizer.from_pretrained("Xenova/ms-marco-MiniLM-L-6-v2");
      PFAI.rr = await T.AutoModelForSequenceClassification.from_pretrained("Xenova/ms-marco-MiniLM-L-6-v2", { dtype: "q8", device: "wasm" });
      const raw = JSON.parse(document.getElementById("pfai-index").textContent);
      PFAI.index = {};
      Object.entries(raw).forEach(([g, v]) => {
        const bin = atob(v.q); const n = v.ids.length, dim = v.dim; const f = new Float32Array(n * dim);
        for (let i = 0; i < n; i++) for (let k = 0; k < dim; k++) { let b = bin.charCodeAt(i * dim + k); if (b > 127) b -= 256; f[i * dim + k] = b * v.scales[i]; }
        PFAI.index[g] = { ids: v.ids, texts: v.texts, dim, vecs: f };
      });
      await rank("warm up", "PRO", "blocks");
      PFAI.state = "ready"; setBadge();
      try { document.dispatchEvent(new CustomEvent("pfai-ready")); } catch (e) {}
      return true;
    })().catch(e => { PFAI.state = "failed"; PFAI.error = String(e && e.message || e); setBadge(); try { console.warn("Offline AI unavailable:", PFAI.error); } catch (x) {} return false; });
    return PFAI.ready;
  }

  // AI ranking: [{id, score, logit, cos}] best first
  async function rank(query, side, kind) {
    const q = String(query || "").trim();
    if (!q || !PFAI.embed) return [];
    const g = kind === "cards" ? PFAI.index.cards : PFAI.index[side + ":" + kind];
    if (!g) return [];
    const ck = kind + "|" + side + "|" + q.toLowerCase();
    if (PFAI.cache.has(ck)) return PFAI.cache.get(ck);
    const qv = (await PFAI.embed(QPRE + q, { pooling: "cls", normalize: true })).data;
    const n = g.ids.length, dim = g.dim, sims = [];
    for (let i = 0; i < n; i++) { let d = 0; for (let k = 0; k < dim; k++) d += qv[k] * g.vecs[i * dim + k]; sims.push([i, d]); }
    sims.sort((a, b) => b[1] - a[1]);
    const top = sims.slice(0, 12);
    const inp = PFAI.tok(new Array(top.length).fill(q), { text_pair: top.map(t => g.texts[t[0]]), padding: true, truncation: true });
    const lg = Array.from((await PFAI.rr(inp)).logits.data);
    const out = top.map((t, j) => ({ id: g.ids[t[0]], cos: t[1], logit: lg[j], score: lg[j] + 8 * t[1] })).sort((a, b) => b.score - a.score);
    if (PFAI.cache.size > 400) PFAI.cache.clear();
    PFAI.cache.set(ck, out);
    return out;
  }
  PFAI.rank = rank;
  PFAI.load = load;

  // Weighted reciprocal-rank merge of the keyword ranking and the AI ranking
  function fuse(lexList, aiList, keyFn, wLex, wAi, k) {
    const sc = new Map(), obj = new Map();
    lexList.forEach((x, i) => { const id = keyFn(x); sc.set(id, (sc.get(id) || 0) + wLex / (k + i)); obj.set(id, x); });
    aiList.forEach((x, i) => { const id = keyFn(x); sc.set(id, (sc.get(id) || 0) + wAi / (k + i)); if (!obj.has(id)) obj.set(id, x); });
    return [...sc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => obj.get(id)).filter(Boolean);
  }
  PFAI.weights = { wLex: 1, wAi: 1, k: 4, typoDamp: 0.8 };

  function blockById(side, id) {
    const d = DEBATE_DATA[side] || {};
    return [...(d.rebuttals || []), ...(d.frontlines || []), ...(d.counterDefenses || [])].find(b => b.id === id);
  }
  // Rebuttal / defense finder: keyword results + AI results merged
  async function fusedBlocks(query, side) {
    const lex = aiSemanticRankAllBlocksForSide(query, side);
    // the AI reads the spell-fixed words; if many words were misspelled, trust the typo-proof keyword search more
    const fixed = typeof fzCorrectQuery === "function" ? fzCorrectQuery(query) : query;
    const ai = (await rank(fixed, side, "blocks")).map(r => blockById(side, r.id)).filter(Boolean);
    const w = PFAI.weights;
    const words = String(query).toLowerCase().match(/[a-z']{3,}/g) || [];
    const fixedWords = String(fixed).toLowerCase().match(/[a-z']{3,}/g) || [];
    const typoShare = words.length ? words.filter((x, i) => x !== fixedWords[i]).length / words.length : 0;
    const wAi = w.wAi * (1 - w.typoDamp * typoShare);
    return { conceptLabel: lex.conceptLabel, results: fuse(lex.results, ai, b => b.id, w.wLex, wAi, w.k), ai };
  }
  PFAI.fusedBlocks = fusedBlocks;

  // Source cards: keyword results + AI results merged
  async function fusedCards(query) {
    const lex = filterSourceCardsByQuery(query);
    const all = DEBATE_DATA.SOURCE_CARDS || [];
    const lexMatched = lex.length === all.length ? [] : lex;
    const ai = (await rank(typeof fzCorrectQuery === "function" ? fzCorrectQuery(query) : query, "", "cards")).map(r => all.find(c => c.short === r.id)).filter(Boolean);
    const w = PFAI.weights;
    const merged = fuse(lexMatched, ai, c => c.short, w.wLex, w.wAi, w.k);
    return merged.length ? merged : lex;
  }
  PFAI.fusedCards = fusedCards;

  // ---- hook the AI into the search boxes (instant keyword results first, AI re-ranks a moment later) ----
  function hookBox(fnName, inputId, boxId, ctx, statusId) {
    const orig = window[fnName];
    if (typeof orig !== "function") return;
    let timer = null;
    window[fnName] = function (val) {
      orig.apply(this, arguments);
      clearTimeout(timer);
      const q = String(val || "").trim();
      if (!q || PFAI.state !== "ready") return;
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
          const st = statusId && document.getElementById(statusId);
          if (st) st.textContent = "🧠 AI-ranked: " + (res.conceptLabel || "best matches for what you typed");
        } catch (e) {}
      }, 140);
    };
  }
  function hookCards() {
    const origRender = window.renderSourceCards;
    if (typeof origRender === "function") {
      let t = null;
      window.renderSourceCards = function () {
        origRender.apply(this, arguments);
        clearTimeout(t);
        const inp = document.getElementById("sourceCardsSearchInput");
        const q = inp ? inp.value.trim() : "";
        if (!q || PFAI.state !== "ready") return;
        t = setTimeout(async () => {
          try {
            const order = await fusedCards(q);
            if (!inp || inp.value.trim() !== q) return;
            const saved = window.filterSourceCardsByQuery;
            window.filterSourceCardsByQuery = () => order;
            try { origRender.apply(this, []); } finally { window.filterSourceCardsByQuery = saved; }
          } catch (e) {}
        }, 160);
      };
    }
    const origQuick = window.renderQuickSourceModalResults;
    if (typeof origQuick === "function") {
      let t2 = null;
      window.renderQuickSourceModalResults = function () {
        origQuick.apply(this, arguments);
        clearTimeout(t2);
        const inp = document.getElementById("quickSourceModalInput");
        const q = inp ? inp.value.trim() : "";
        if (!q || PFAI.state !== "ready") return;
        t2 = setTimeout(async () => {
          try {
            const order = await fusedCards(q);
            if (!inp || inp.value.trim() !== q) return;
            const saved = window.filterSourceCardsByQuery;
            window.filterSourceCardsByQuery = () => order;
            try { origQuick.apply(this, []); } finally { window.filterSourceCardsByQuery = saved; }
          } catch (e) {}
        }, 160);
      };
    }
  }
  // ---- Crossfire: the AI speaks up only when the keyword matcher has no answer (or only a "closest" guess)
  //      AND the AI is very confident (re-ranker score >= 4: in testing that was never wrong and never fired on off-topic questions)
  PFAI.xfThreshold = 4;
  async function crossfireAssist(q, side) {
    const a = await rank(typeof fzCorrectQuery === "function" ? fzCorrectQuery(q) : q, side, "prefires");
    if (!a.length || a[0].logit < PFAI.xfThreshold) return null;
    return (DEBATE_DATA[side].prefires || []).find(p => p.id === a[0].id) || null;
  }
  PFAI.crossfireAssist = crossfireAssist;
  function hookCrossfire() {
    const orig = window.matchCrossfirePrefire;
    if (typeof orig !== "function") return;
    let t = null;
    window.matchCrossfirePrefire = function (rankIndex) {
      orig.apply(this, arguments);
      clearTimeout(t);
      if (PFAI.state !== "ready" || (typeof rankIndex === "number" && rankIndex > 0)) return;
      const inp = document.getElementById("crossfireQuestionInput"), box = document.getElementById("crossfirePrefireResult");
      const q = inp ? inp.value.trim() : "";
      if (!q || !box) return;
      const txt = box.textContent || "";
      const noAnswer = /NO PREFIRED ANSWER/.test(txt), soft = /Closest Answer — check it fits/.test(txt);
      if (!noAnswer && !soft) return;
      t = setTimeout(async () => {
        try {
          const side = state.side;
          const pf = await crossfireAssist(q, side);
          if (!pf || inp.value.trim() !== q || state.side !== side) return;
          const ans = ensureDirectCrossfireVoice(buildTailoredSpokenAnswer(pf, q, null));
          box.className = "flex-1 flex flex-col justify-between rounded-2xl border-2 border-[#3D6B58] bg-[#EFF6F3] p-5 text-left shadow-sm";
          box.innerHTML = `
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#3D6B58] text-white">🧠 AI Match — check it fits</span>
                <span class="text-xs font-bold text-[#3D6B58]">${escapeHtml(pf.topicLabel)}</span>
              </div>
              <div class="serif-podium text-lg leading-relaxed text-[#2A2421] bg-[#FFFDF9] p-4 rounded-xl border border-[#E6DEC8]">${highlightSpokenCitations(ans)}${renderCompactSourceFooterHtml(ans, pf.citation)}</div>
            </div>`;
        } catch (e) {}
      }, 120);
    };
  }

  function start() {
    hookCrossfire();
    hookBox("handleSiphonAiSearchInput", "siphonQuickFilterInput", "siphonAiInstantMatchBox", "siphon", "siphonAiSearchStatus");
    hookBox("handleRebuttalAiSearchInput", "rebuttalQuickFilterInput", "rebuttalAiInstantMatchBox", "rebuttal", null);
    hookCards();
    setBadge();
    setTimeout(load, 900);
    // when the AI finishes loading, re-run whatever is already typed in the AI boxes
    document.addEventListener("pfai-ready", () => {
      [["siphonQuickFilterInput", "handleSiphonAiSearchInput"], ["rebuttalQuickFilterInput", "handleRebuttalAiSearchInput"]].forEach(([id, fn]) => { const el = document.getElementById(id); if (el && el.value.trim() && typeof window[fn] === "function") window[fn](el.value); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
