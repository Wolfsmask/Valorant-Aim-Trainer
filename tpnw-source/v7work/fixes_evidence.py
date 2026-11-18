import json
F = []
def add(t, f, r): F.append({"title": t, "find": f, "replace": r})

# ---------- 1. UI: Evidence Check button + drawer, next to the 12 Key Terms drawer ----------
add("Evidence Check: button beside the key-terms button",
'''          <button id="btnToggleQuickGlossary" type="button" onclick="toggleQuickGlossaryDrawer()" class="text-xs font-bold px-2.5 py-1 rounded-lg border border-[#D5CBB8] bg-[#FAF6F0] hover:bg-[#EDE6D8] text-[#3D6B58] transition cursor-pointer shrink-0">
            All 12 Key Terms ▾
          </button>''',
'''          <button id="btnToggleQuickGlossary" type="button" onclick="toggleQuickGlossaryDrawer()" class="text-xs font-bold px-2.5 py-1 rounded-lg border border-[#D5CBB8] bg-[#FAF6F0] hover:bg-[#EDE6D8] text-[#3D6B58] transition cursor-pointer shrink-0">
            All 12 Key Terms ▾
          </button>
          <button id="btnToggleEvidenceTests" type="button" onclick="toggleEvidenceTestsDrawer()" class="text-xs font-bold px-2.5 py-1 rounded-lg border border-[#C86D3B] bg-[#FDF6F2] hover:bg-[#F9EBE4] text-[#C86D3B] transition cursor-pointer shrink-0">
            ⚖ Test Their Evidence ▾
          </button>''')

add("Evidence Check: the drawer itself (4 tests, with the exact line to say)",
'''          <div class="p-2 rounded-lg bg-[#FAF6F0] border border-[#E6DEC8]"><strong class="text-[#C86D3B]">12. Escalation Dominance:</strong> Controlling the upper hand at the next level of war so the other side is forced to back down.</div>
        </div>''',
'''          <div class="p-2 rounded-lg bg-[#FAF6F0] border border-[#E6DEC8]"><strong class="text-[#C86D3B]">12. Escalation Dominance:</strong> Controlling the upper hand at the next level of war so the other side is forced to back down.</div>
        </div>
        <div id="evidenceTestsDrawer" class="hidden pt-3 mt-2.5 border-t border-[#F0EAE0] space-y-2 text-xs">
          <p class="text-[11px] text-[#6E6259]">Four tests every card has to pass. If one of theirs fails, say the line out loud and ask the judge to drop it. Check your own cards against the same four.</p>
          <div id="evidenceTestsList" class="grid grid-cols-1 lg:grid-cols-2 gap-2"></div>
          <p class="text-[11px] text-[#6E6259] italic">Varsity rule: a good debater reads a quote; a varsity debater explains why the person who said it is the most qualified person in the room. Every card in 🗂 Source Cards now opens with the author's credentials.</p>
        </div>''')

# ---------- 2. Data + logic ----------
add("Evidence Check: the four tests, the detector, and the drawer renderer",
'''    function toggleQuickGlossaryDrawer() {''',
r'''    // =========================================================================
    // EVIDENCE CHECK: the four tests every card has to pass, plus a live check of
    // what the opponent reads. Flags are prompts to look, never proof of a violation.
    // =========================================================================
    const EVIDENCE_TESTS = [
      {
        key: "recency", icon: "📅", name: "Date — the recency test",
        check: "Analysis of European security or the Russian threat published before February 2022 is describing a world that ended with the invasion of Ukraine.",
        say: "Judge, their evidence on this point is from before February 2022. It is analysing a Europe that no longer exists — before the invasion of Ukraine rewrote every assumption about Russian intent. Prefer our post-invasion evidence on this question.",
        careful: "Only for present-tense security analysis. Treaty text, legal analysis, physics and historical events do not expire — and neither do ours."
      },
      {
        key: "expertise", icon: "🎓", name: "Qualifications — the expertise test",
        check: "You want subject-matter experts: PhDs in international relations, senior defense analysts, former officials, or dedicated institutes like RUSI, SIPRI, RAND or Chatham House.",
        say: "Judge, their author is a journalist reporting the news, not a defense expert qualified to make a policy prediction. Our evidence on this point comes from a named specialist at a dedicated defense institute. Prefer the qualified source.",
        careful: "A news outlet quoting what a president or minister actually said is fine evidence — that is reporting, not prediction. Use this test on analysis and forecasts."
      },
      {
        key: "funding", icon: "💰", name: "Funding — the independence test",
        check: "Ask who pays for the research, especially when the conclusion is 'buy more of this weapon' or 'this campaign is right'.",
        say: "Judge, before you weigh that card, ask who funds it. Research that recommends exactly what its funders sell is an advertisement, not independent analysis. Weigh our peer-reviewed and independently funded evidence above it.",
        careful: "Cuts both ways: ICAN and PAX campaign for the ban, and we cite them. If they raise it, we concede the advocacy and point to the raw numbers that institutions published about themselves."
      },
      {
        key: "context", icon: "📄", name: "Context — the full-text test",
        check: "A cut card must include the author's actual paragraph, not a summary of it.",
        say: "Judge, that was a paraphrase, not a card. I am calling for the evidence. If they cannot show the author's own paragraph saying that, it is an evidence violation and you should strike it from the flow.",
        careful: "Be ready for it yourself: every quotation mark in our case is the author's exact wording, and everything else is labelled a summary."
      }
    ];

    function renderEvidenceTestsDrawer() {
      const box = document.getElementById("evidenceTestsList");
      if (!box) return;
      box.innerHTML = EVIDENCE_TESTS.map(t => `
        <div class="p-2.5 rounded-lg bg-[#FFFDF9] border border-[#E6DEC8] space-y-1">
          <div class="font-extrabold text-[#C86D3B]">${t.icon} ${escapeHtml(t.name)}</div>
          <div class="text-[#2A2421]">${escapeHtml(t.check)}</div>
          <div class="serif-podium p-2 rounded bg-[#EFF6F3] border border-[#3D6B58]/30 text-[#2A2421]">"${escapeHtml(t.say)}"</div>
          <div class="text-[11px] text-[#6E6259]"><strong>Careful:</strong> ${escapeHtml(t.careful)}</div>
        </div>`).join("");
    }

    function toggleEvidenceTestsDrawer() {
      const drawer = document.getElementById("evidenceTestsDrawer");
      const btn = document.getElementById("btnToggleEvidenceTests");
      if (!drawer) return;
      if (drawer.classList.contains("hidden")) {
        renderEvidenceTestsDrawer();
        drawer.classList.remove("hidden");
        if (btn) btn.textContent = "Hide Evidence Tests ▴";
      } else {
        drawer.classList.add("hidden");
        if (btn) btn.textContent = "⚖ Test Their Evidence ▾";
      }
    }

    // Outlets that report the news (fine for quoting what someone said; weak for analysis)
    const EV_NEWS_OUTLETS = ["new york times", "nyt", "washington post", "wall street journal", "cnn", "fox news", "msnbc", "the guardian", "guardian", "bbc", "newsweek", "daily mail", "vox", "business insider", "huffpost", "buzzfeed", "medium", "substack", "wikipedia", "reddit", "youtube", "tiktok", "a blog", "blog post"];
    // Organizations that campaign for an outcome (ours included)
    const EV_ADVOCACY = ["ican", "pax", "don't bank on the bomb", "dont bank on the bomb", "greenpeace", "ploughshares", "beyond nuclear", "global zero", "nuclear ban monitor", "nuclear weapons ban monitor"];
    const EV_PARAPHRASE = ["basically says", "basically said", "essentially says", "essentially said", "pretty much says", "paraphrasing", "to paraphrase", "experts say", "studies show", "study shows", "science says", "everyone knows", "it's been proven", "its been proven", "it is proven", "proven fact"];

    function detectEvidenceIssues(rawText) {
      const text = String(rawText || "").replace(/[’‘]/g, "'");
      const low = text.toLowerCase();
      const out = [];
      const seen = new Set();
      const push = (key, quote) => {
        const t = EVIDENCE_TESTS.find(x => x.key === key);
        if (!t || seen.has(key)) return;
        seen.add(key);
        out.push({ test: t, quote: String(quote || "").trim().slice(0, 70) });
      };
      // 1. Date: only where the text looks like a CITATION, not a historical event
      const EV_MONTHS = /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;
      const citePatterns = [
        // "Smith, 2019" / "Smith, 19" — the comma is what makes it a citation rather than a date or a treaty name
        /\b([A-Z][a-z]{2,})(?:\s+et al\.?)?,\s*((?:19|20)\d{2}|[0-2]\d)\b/g,
        // "according to Smith 2019"
        /\b(?:according to|per|cites|citing)\s+([A-Z][a-z]{2,})(?:\s+et al\.?)?\s+((?:19|20)\d{2})\b/g,
        // "a 2019 study", "a 2019 RAND report"
        /\b(?:a|the|their|this|another)\s+((?:19|20)\d{2})\s+(?:[A-Za-z.'-]+\s+){0,2}(study|report|paper|poll|survey|article|analysis|review|wargame|book)\b/gi,
        /\b(study|report|paper|poll|survey|article|analysis|review)\s+(?:from|published in|dated)\s+((?:19|20)\d{2})\b/gi
      ];
      for (const re of citePatterns) {
        let m;
        while ((m = re.exec(text)) !== null) {
          if (m[1] && EV_MONTHS.test(m[1])) continue; // "In December, 2021" is a date, not a card
          const nums = m.slice(1).filter(x => /^\d+$/.test(x));
          if (!nums.length) continue;
          let yr = parseInt(nums[0], 10);
          if (yr < 100) yr += 2000;
          if (yr >= 1945 && yr < 2022) { push("recency", m[0]); break; }
        }
        if (seen.has("recency")) break;
      }
      // 2. Qualifications
      for (const o of EV_NEWS_OUTLETS) if (low.includes(o)) { push("expertise", o); break; }
      // 3. Funding
      for (const o of EV_ADVOCACY) if (new RegExp("\\b" + o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(low)) { push("funding", o); break; }
      // 4. Full text: a paraphrase marker with no quotation marks anywhere
      const hasRealQuote = /['"\u2018\u201c][^'"\u2019\u201d]{15,}['"\u2019\u201d]/.test(text);
      if (!hasRealQuote) for (const p of EV_PARAPHRASE) if (low.includes(p)) { push("context", p); break; }
      return out;
    }

    function renderEvidenceIssueAlert(text) {
      const inputEl = document.getElementById("opponentTranscriptInput");
      if (!inputEl) return;
      let box = document.getElementById("evidenceIssueBox");
      if (!box) {
        box = document.createElement("div");
        box.id = "evidenceIssueBox";
        box.className = "hidden mt-2 p-3 rounded-xl border-2 border-[#C86D3B] bg-[#FDF6F2] text-[#2A2421] space-y-2";
        const ff = document.getElementById("falseFactAlertBox");
        if (ff) ff.insertAdjacentElement("afterend", box); else inputEl.insertAdjacentElement("afterend", box);
      }
      const hits = detectEvidenceIssues(text);
      if (!hits.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
      box.classList.remove("hidden");
      box.innerHTML = `<div class="text-[11px] font-extrabold uppercase tracking-wider text-[#C86D3B]">⚖ Check their card (${hits.length})</div>` +
        hits.slice(0, 3).map(h => `
          <div class="space-y-1">
            <div class="text-xs font-bold text-[#2A2421]">${h.test.icon} ${escapeHtml(h.test.name)} — you heard "${escapeHtml(h.quote)}"</div>
            <p class="serif-podium text-sm leading-relaxed bg-[#FFFDF9] p-2 rounded-lg border border-[#E6DEC8]">${escapeHtml(h.test.say)}</p>
            <p class="text-[11px] text-[#6E6259]"><strong>Only if it fits:</strong> ${escapeHtml(h.test.careful)}</p>
          </div>`).join("");
    }

    function toggleQuickGlossaryDrawer() {''')

add("Evidence Check: run it on the opponent's speech as you type",
'''      try { renderFalseFactAlert(liveText + " " + loggedText); } catch (e) {}''',
'''      try { renderFalseFactAlert(liveText + " " + loggedText); } catch (e) {}
      try { renderEvidenceIssueAlert(liveText + " " + loggedText); } catch (e) {}''')

# ---------- 3. Author credentials at the top of every source card ----------
add("Source cards: author credentials at the top (varsity rule)",
'''            <p class="text-xs text-[#6E6259] mb-1.5">${escapeHtml(card.citation)}</p>''',
'''            ${card.credential ? `<p class="text-xs text-[#2A2421] mb-1.5 p-1.5 rounded bg-[#EFF6F3] border border-[#3D6B58]/30"><strong class="text-[#3D6B58]">Why they are qualified:</strong> ${escapeHtml(card.credential)}</p>` : ""}
            <p class="text-xs text-[#6E6259] mb-1.5">${escapeHtml(card.citation)}</p>''')

json.dump(F, open('fixes_evidence.json', 'w'), indent=1)
print(len(F))
