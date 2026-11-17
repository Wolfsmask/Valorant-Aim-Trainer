import json
F=[]
def add(t,f,r): F.append({"title":t,"find":f,"replace":r})
add("False-fact detector: patterns for common false claims (Russia/China/Ukraine 'in NATO', 'TPNW bans nuclear power')",
"""    function runLiveTranscriptSiphon(forceRender) {""",
r"""    // FALSE-FACT DETECTOR: catches flat-out false claims (e.g. "Russia and China are in NATO") in crossfire
    // questions and in the opponent's speech, and puts the sourced correction first.
    const FF_NON = "(?:russia|russian federation|china|belarus|iran|north korea|kazakhstan|serbia)";
    const FF_SUBJ = FF_NON + "(?:\\s*(?:,|and|&|or)\\s*" + FF_NON + ")*";
    const FF_UKR = "(?:ukraine|georgia|moldova)";
    const FF_NATO = "(?:nato|north atlantic(?: treaty)?(?: organi[sz]ation)?|the alliance)";
    const ffMember = "(?:(?:a|an|both|also|now|still|full|official|actually)\\s+)*(?:(?:in|inside|within|part of|members? of|a member of|allies of|an ally of|(?:full |official )?members? of)\\s+(?:the\\s+)?" + FF_NATO + "|nato\\s+(?:members?|allies|ally|countries|country|states?))";
    const ffBuild = subj => [
      new RegExp("\\b(?:is|are|isn't|isnt|aren't|arent|was|were|wasn't|wasnt)\\s+" + subj + "\\s+" + ffMember + "\\b", "i"),
      new RegExp("\\b" + subj + "\\s+(?:is|are|was|were|being|have been|has been)\\s+(?!not\\b|never\\b)" + ffMember + "\\b", "i"),
      new RegExp("\\b" + subj + "\\s+(?:has |have |had |already |also )*joined\\s+(?:the\\s+)?nato\\b", "i"),
      new RegExp("\\bnato(?:'s)?\\s+(?:members?|allies|ally|countries|country|states?)\\s*(?:,|like|such as|including|e\\.g\\.)?\\s*(?:like\\s+)?" + subj + "\\b", "i"),
      new RegExp("\\b" + subj + "\\s*,?\\s+(?:both\\s+|two\\s+|a\\s+|an\\s+|fellow\\s+)?(?:nato members?|nato allies|nato ally|nato countries|nato states?)\\b", "i"),
      new RegExp("\\bnato\\s+(?:includes?|including|has)\\s+" + subj + "\\b", "i"),
      new RegExp("\\b" + subj + "\\s*,?\\s+(?:who|which|that)\\s+(?:are|is|were|was)\\s+(?!not\\b|never\\b)" + ffMember + "\\b", "i")
    ];
    const FALSE_FACT_RULES = [
      { key: "nonmembers", res: ffBuild(FF_SUBJ), ids: { PRO: "p_pf_m1", CON: "c_pf_m1" }, mustMention: /\bnato\b/i },
      { key: "ukraine", res: ffBuild(FF_UKR), ids: { PRO: "p_pf_m5", CON: "c_pf_m3" }, mustMention: /\bnato\b/i },
      { key: "power", res: [/\b(?:tpnw|treaty|ban|ratif\w*)\b[^.?!]{0,60}\b(?:ban|bans|banned|outlaws?|outlawed|prohibits?|prohibited|ends?|shuts? down|get rid of|eliminates?)\s+(?:all\s+)?(?:civilian\s+|peaceful\s+)?nuclear\s+(?:power|energy|plants?|reactors?|electricity)\b/i, /\b(?:no more|lose|losing|close|closing|shut down)\s+(?:all\s+)?(?:our\s+)?nuclear\s+(?:power|energy|plants?|reactors?)\b[^.?!]{0,40}\b(?:tpnw|treaty|ratif\w*)\b/i], ids: { PRO: "p_pf_m2", CON: null } }
    ];
    function detectFalseFacts(text, side) {
      const out = [];
      const t = String(text || "").replace(/[’‘]/g, "'");
      FALSE_FACT_RULES.forEach(rule => {
        const id = rule.ids[side || state.side];
        if (!id) return;
        for (const re of rule.res) {
          const m = t.match(re);
          if (!m) continue;
          const after = m[0].replace(/^\s*(?:is|are|isn't|isnt|aren't|arent|was|were|wasn't|wasnt)\s+/i, "");
          if (/\b(?:not|never|no longer|neither|nor)\b|n't\b/i.test(after)) continue;
          const pf = (DEBATE_DATA[side || state.side].prefires || []).find(p => p.id === id);
          if (pf) { out.push({ key: rule.key, pf, quote: m[0] }); break; }
        }
      });
      return out;
    }
    function renderFalseFactAlert(text) {
      const inputEl = document.getElementById("opponentTranscriptInput");
      if (!inputEl) return;
      let box = document.getElementById("falseFactAlertBox");
      if (!box) {
        box = document.createElement("div");
        box.id = "falseFactAlertBox";
        box.className = "hidden mt-2 p-3 rounded-xl border-2 border-[#991B1B] bg-[#FEE2E2] text-[#2A2421] space-y-1.5";
        inputEl.insertAdjacentElement("afterend", box);
      }
      const hits = detectFalseFacts(text, state.side);
      if (!hits.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
      box.classList.remove("hidden");
      box.innerHTML = hits.map(h => `
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-[#991B1B]">🚨 False fact: “${escapeHtml(h.quote.trim())}”</div>
        <p class="serif-podium text-sm leading-relaxed">${highlightSpokenCitations(h.pf.coreAnswer)}</p>
        <p class="text-[11px] text-[#6E6259]">Call it out in your next speech or Grand Crossfire. If it came in their Final Focus, it's new and unsourced: use a Last-Speech Shield line.</p>`).join("");
    }

    function runLiveTranscriptSiphon(forceRender) {""")
add("False-fact detector: check the opponent's speech as you type it",
"""      siphonRebuttalsFromText(liveText, loggedText);
      autoSynchronizeAllSpeeches();
      renderSiphonPanel();""",
"""      siphonRebuttalsFromText(liveText, loggedText);
      try { renderFalseFactAlert(liveText + " " + loggedText); } catch (e) {}
      autoSynchronizeAllSpeeches();
      renderSiphonPanel();""")
add("False-fact detector: in crossfire, the correction comes first",
"""      scoredList.sort((a, b) => b.score - a.score || a.priorityRank - b.priorityRank);
      let isSoftMatch = false;""",
"""      scoredList.sort((a, b) => b.score - a.score || a.priorityRank - b.priorityRank);
      try {
        detectFalseFacts(rawQuery, state.side).reverse().forEach(h => {
          const i = scoredList.findIndex(x => x.pf.id === h.pf.id);
          const item = i >= 0 ? scoredList.splice(i, 1)[0] : { pf: h.pf, score: 999, priorityRank: 1 };
          scoredList.unshift(item);
        });
      } catch (e) {}
      let isSoftMatch = false;""")
json.dump(F,open('fixes_myth.json','w'),indent=1)
