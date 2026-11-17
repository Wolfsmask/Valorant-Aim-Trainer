import sys
src, out = sys.argv[1], sys.argv[2]
h = open(src).read()
fz = open('fuzzy2.js').read()
def rep(old, new, count=1):
    global h
    n = h.count(old)
    assert n == count, (n, old[:80])
    h = h.replace(old, new)
rep("    function aiDetectSemanticConcepts(rawQuery) {", fz + "\n    function aiDetectSemanticConcepts(rawQuery) {")
rep("""      const sideData = DEBATE_DATA[s];
      if (!sideData) return { conceptLabel: "", directQa: null, results: [] };
      const sem = aiDetectSemanticConcepts(rawQuery);""", """      const sideData = DEBATE_DATA[s];
      if (!sideData) return { conceptLabel: "", directQa: null, results: [] };
      const typedQuery = rawQuery;
      rawQuery = fzCorrectQuery(rawQuery);
      const sem = aiDetectSemanticConcepts(rawQuery);""")
rep("""      return {
        conceptLabel: sem.conceptHits[0] ? sem.conceptHits[0].node.label : (topPrefire ? topPrefire.topicLabel : ""),
        results
      };""", """      // Fuzzy finder: catches bad spelling and different wording, then merges with the ranking above
      let merged = results;
      try {
        let pfTaken = 0;
        const fzList = fzRank(fzSideIndex(s), typedQuery).filter(r => r.coverage >= 0.5 || r.score >= 4).slice(0, 12)
          .filter(r => !r.obj.coreAnswer || (pfTaken++ === 0))
          .map(r => r.obj.coreAnswer != null ? { id: r.obj.id, chipLabel: r.obj.topicLabel, trigger: r.obj.topicLabel, response: ensureDirectCrossfireVoice(r.obj.coreAnswer), citation: r.obj.citation || "Verified Source", keywords: r.obj.keywords || [], isDirectQaPrefire: true } : r.obj);
        if (fzList.length) merged = fzFuse(results, fzList, x => x.id, 6);
      } catch (e) { merged = results; }

      return {
        conceptLabel: sem.conceptHits[0] ? sem.conceptHits[0].node.label : (topPrefire ? topPrefire.topicLabel : ""),
        results: merged
      };""")
open(out, 'w').write(h)
print("ok")
h = open(out).read()
def rep2(old, new):
    global h
    n = h.count(old); assert n == 1, (n, old[:80]); h = h.replace(old, new)
# Source cards: spell-fix + fuzzy merge
rep2("""      const cards = DEBATE_DATA.SOURCE_CARDS || [];
      if (!q) return cards;

      const sem = aiDetectSemanticConcepts(q);""", """      const cards = DEBATE_DATA.SOURCE_CARDS || [];
      if (!q) return cards;
      const typedQ = q;
      let fzCards = [];
      try {
        fzVocab();
        const cIdx = fzBuildIndex("cards:" + FZ_VOCAB_KEY, cards.map(c => ({ key: c.short, obj: c, strong: [c.short, c.title, c.citation].join(" "), weak: [c.takeaway, c.verbatim || ""].join(" ") })));
        fzCards = fzRank(cIdx, typedQ).filter(r => r.coverage >= 0.5 || r.score >= 4).slice(0, 12).map(r => r.obj);
      } catch (e) { fzCards = []; }
      return (function (q) {
      const sem = aiDetectSemanticConcepts(q);""")
rep2("""      scored.sort((a, b) => b.sc - a.sc);
      return scored.length > 0 ? scored.map(x => x.card) : cards;
    }""", """      scored.sort((a, b) => b.sc - a.sc);
      const geminiOrder = scored.map(x => x.card);
      if (fzCards.length) {
        const fused = fzFuse(geminiOrder, fzCards, c => c.short, 6);
        return fused;
      }
      return scored.length > 0 ? geminiOrder : cards;
      })(fzCorrectQuery(q));
    }""")
# Filters (rebuttal list filter, trap filter): every typed word must match, now also by typo / sound-alike
rep2("    function matchesSearchFilterTokens(rawHaystack, rawFilterQuery) {", """    function matchesSearchFilterTokens(rawHaystack, rawFilterQuery) {
      if (matchesSearchFilterTokensStrict(rawHaystack, rawFilterQuery)) return true;
      try {
        const qts = fzQueryTokens(rawFilterQuery);
        if (!qts.length) return false;
        const hay = new Set(fzWords(rawHaystack).map(fzStem));
        return qts.every(t => fzMatchToken(t).some(m => m.sim >= 0.66 && hay.has(m.stem)));
      } catch (e) { return false; }
    }
    function matchesSearchFilterTokensStrict(rawHaystack, rawFilterQuery) {""")
# Show up to 6 matches in the AI boxes (scrollable), not 4
rep2("          ${blocks.slice(0, 4).map(blk => {", "          ${blocks.slice(0, 6).map(blk => {")
open(out, 'w').write(h)
print("ok2")
