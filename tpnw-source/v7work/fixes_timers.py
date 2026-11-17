import json
F=[]
def add(t,f,r): F.append({"title":t,"find":f,"replace":r})
add("Timers: each step keeps its own clock; switching steps never stops or resets it",
"""      if (state.clockStepIndex !== state.currentStepIndex) {
        state.clockStepIndex = state.currentStepIndex;
        pauseMainTimer();
        state.mainTimerSec = step.duration;
      }""",
"""      if (state.clockStepIndex !== state.currentStepIndex) {
        stashStepClock(state.clockStepIndex);
        state.clockStepIndex = state.currentStepIndex;
        restoreStepClock(state.currentStepIndex, step.duration);
      }""")
add("Timers: per-step clock helpers + background time-up alert",
"""    let mainTimerEndTimeMs = 0;
    let mainWarned30 = false;
""",
"""    let mainTimerEndTimeMs = 0;
    let mainWarned30 = false;

    // Each step has its own clock. Leaving a step (or the browser tab) never stops or resets it;
    // a running clock keeps counting by the real wall clock. Only the ↺ Reset button resets it.
    function stashStepClock(idx) {
      if (typeof idx !== "number") return;
      if (!state.stepClocks) state.stepClocks = {};
      const running = !!state.mainTimerRunning && mainTimerEndTimeMs > 0;
      state.stepClocks[idx] = { running, endWall: running ? mainTimerEndTimeMs : 0, sec: state.mainTimerSec, warned: mainWarned30 };
      clearInterval(state.mainTimerInterval);
      state.mainTimerRunning = false;
      mainTimerEndTimeMs = 0;
    }
    function restoreStepClock(idx, duration) {
      const c = state.stepClocks && state.stepClocks[idx];
      if (c && c.running) {
        const rem = c.endWall - Date.now();
        if (rem > 0) {
          state.mainTimerSec = Math.ceil(rem / 1000);
          toggleMainTimer();
          mainTimerEndTimeMs = c.endWall;
          mainWarned30 = c.warned;
          return;
        }
        state.mainTimerSec = 0;
      } else {
        state.mainTimerSec = c ? c.sec : duration;
      }
      pauseMainTimer();
    }
    setInterval(() => {
      if (!state.stepClocks) return;
      const now = Date.now();
      Object.keys(state.stepClocks).forEach(k => {
        const c = state.stepClocks[k];
        if (c && c.running && c.endWall <= now && Number(k) !== state.currentStepIndex) {
          c.running = false; c.sec = 0; c.endWall = 0;
          try {
            const st = getRoundSteps()[Number(k)];
            playTimerChime("expiry");
            flashSaveToast(`⏰ Time up: ${st ? st.short : "step " + (Number(k) + 1)}`);
          } catch (e) {}
        }
      });
    }, 1000);
""")
# wall clock instead of performance.now (keeps counting through laptop sleep)
for old in ["mainTimerEndTimeMs = performance.now() + state.mainTimerSec * 1000;",
            "const remainingMs = Math.max(0, mainTimerEndTimeMs - performance.now());\n          const nextSec",
            "const remainingMs = Math.max(0, mainTimerEndTimeMs - performance.now());\n        state.mainTimerSec",
            "t.sec = Math.ceil(Math.max(0, t.endTimeMs - performance.now()) / 1000);",
            "t.endTimeMs = performance.now() + t.sec * 1000;",
            "const remMs = Math.max(0, t.endTimeMs - performance.now());"]:
    add("Timers: count by the real clock (keeps time through tab switches and laptop sleep)", old, old.replace("performance.now()", "Date.now()"))
add("Round reset: clear every step clock and unsaved drafts",
"""      state.editingSpeechBoxIds = {};
      state.composerOpen = { constructive: false, rebuttal: false, summary: false, finalFocus: false };
      state.donePrefires = { PRO: {}, CON: {} };""",
"""      state.editingSpeechBoxIds = {};
      state.composerOpen = { constructive: false, rebuttal: false, summary: false, finalFocus: false };
      state.stepClocks = {};
      state.clockStepIndex = state.currentStepIndex;
      try { clearAllDrafts(); } catch (e) {}
      state.donePrefires = { PRO: {}, CON: {} };""")
# Drafts
add("Drafts: anything typed in a box editor or the custom-box composer is kept when you switch steps or reload",
"""    function flashSaveToast(label) {""",
"""    // DRAFT KEEPER: text typed into a custom-box composer or a box you are editing is saved as you type
    // and put back whenever the screen is redrawn (switching steps, panels or tabs) or the page reloads.
    const PF_DRAFT_KEY = "pf_unsaved_drafts_v1";
    let PF_DRAFTS = {};
    try { PF_DRAFTS = JSON.parse(localStorage.getItem(PF_DRAFT_KEY) || "{}") || {}; } catch (e) { PF_DRAFTS = {}; }
    let pfDraftSaveTimer = null;
    function pfDraftKey(el) {
      if (!el || !el.id) return null;
      if (/^(editBody_|editLabel_)/.test(el.id) || /CustomBoxTextarea$/.test(el.id)) return (state.side || "") + ":" + el.id;
      return null;
    }
    function pfSaveDraftsSoon() {
      clearTimeout(pfDraftSaveTimer);
      pfDraftSaveTimer = setTimeout(() => { try { localStorage.setItem(PF_DRAFT_KEY, JSON.stringify(PF_DRAFTS)); } catch (e) {} }, 250);
    }
    function clearDraftFor(id) {
      delete PF_DRAFTS[(state.side || "") + ":" + id];
      pfSaveDraftsSoon();
    }
    function clearAllDrafts() { PF_DRAFTS = {}; pfSaveDraftsSoon(); }
    function restoreDrafts() {
      document.querySelectorAll("textarea[id], input[id]").forEach(el => {
        const k = pfDraftKey(el);
        if (k && typeof PF_DRAFTS[k] === "string" && el.value !== PF_DRAFTS[k] && document.activeElement !== el) el.value = PF_DRAFTS[k];
      });
    }
    document.addEventListener("input", ev => {
      const k = pfDraftKey(ev.target);
      if (!k) return;
      PF_DRAFTS[k] = ev.target.value;
      pfSaveDraftsSoon();
    }, true);
    let pfDraftRaf = 0;
    try {
      new MutationObserver(() => { if (pfDraftRaf) return; pfDraftRaf = requestAnimationFrame(() => { pfDraftRaf = 0; restoreDrafts(); }); })
        .observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}

    function flashSaveToast(label) {""")
add("Drafts: saving a box clears its draft",
"""      state.editingSpeechBoxIds[itemId] = false;
      autoSynchronizeAllSpeeches();
      persistLiveEdits("✓ Box Saved");""",
"""      state.editingSpeechBoxIds[itemId] = false;
      clearDraftFor("editBody_" + itemId); clearDraftFor("editLabel_" + itemId);
      autoSynchronizeAllSpeeches();
      persistLiveEdits("✓ Box Saved");""")
add("Drafts: resetting a box clears its draft",
"""      state.editingSpeechBoxIds[itemId] = false;
      autoSynchronizeAllSpeeches();
      persistLiveEdits("↺ Box Restored");""",
"""      state.editingSpeechBoxIds[itemId] = false;
      clearDraftFor("editBody_" + itemId); clearDraftFor("editLabel_" + itemId);
      autoSynchronizeAllSpeeches();
      persistLiveEdits("↺ Box Restored");""")
add("Drafts: adding the custom box clears the composer draft",
"""      state.composerOpen[speechType] = false;
      persistLiveEdits("✓ Custom Box Added & Auto-Adjusted");""",
"""      state.composerOpen[speechType] = false;
      clearDraftFor(speechType + "CustomBoxTextarea");
      persistLiveEdits("✓ Custom Box Added & Auto-Adjusted");""")
# Persist custom boxes / edits / order across reloads
add("Saved edits: custom boxes, box edits, box order and team notes now survive a reload",
"""          liveOpponentText: state.liveOpponentText,
          loggedQuotes: state.loggedQuotes
        }));""",
"""          liveOpponentText: state.liveOpponentText,
          loggedQuotes: state.loggedQuotes,
          customSpeechBoxes: state.customSpeechBoxes,
          customBoxEdits: state.customBoxEdits,
          paragraphOrder: state.paragraphOrder,
          teamNotesText: state.teamNotesText
        }));""")
add("Saved edits: load them back on start",
"""        if (Array.isArray(parsedEdits.loggedQuotes)) {
          state.loggedQuotes = parsedEdits.loggedQuotes;
        }""",
"""        if (Array.isArray(parsedEdits.loggedQuotes)) {
          state.loggedQuotes = parsedEdits.loggedQuotes;
        }
        const isObj = o => o && typeof o === "object" && !Array.isArray(o);
        ["PRO", "CON"].forEach(sd => {
          if (isObj(parsedEdits.customSpeechBoxes) && isObj(parsedEdits.customSpeechBoxes[sd]) && state.customSpeechBoxes && state.customSpeechBoxes[sd]) {
            ["constructive", "rebuttal", "summary", "finalFocus"].forEach(k => { const arr = parsedEdits.customSpeechBoxes[sd][k]; if (Array.isArray(arr)) state.customSpeechBoxes[sd][k] = arr.filter(b => b && typeof b.id === "string" && typeof b.text === "string"); });
          }
          if (isObj(parsedEdits.customBoxEdits) && isObj(parsedEdits.customBoxEdits[sd]) && state.customBoxEdits) {
            const clean = {}; Object.keys(parsedEdits.customBoxEdits[sd]).forEach(k => { if (typeof parsedEdits.customBoxEdits[sd][k] === "string") clean[k] = parsedEdits.customBoxEdits[sd][k]; });
            state.customBoxEdits[sd] = clean;
          }
          if (isObj(parsedEdits.paragraphOrder) && isObj(parsedEdits.paragraphOrder[sd]) && state.paragraphOrder && state.paragraphOrder[sd]) {
            ["constructive", "rebuttal", "summary", "finalFocus"].forEach(k => { const arr = parsedEdits.paragraphOrder[sd][k]; if (Array.isArray(arr) && arr.every(x => typeof x === "string")) state.paragraphOrder[sd][k] = arr; });
          }
          if (isObj(parsedEdits.teamNotesText) && typeof parsedEdits.teamNotesText[sd] === "string" && state.teamNotesText) state.teamNotesText[sd] = parsedEdits.teamNotesText[sd];
        });""")
json.dump(F,open('fixes_timers.json','w'),indent=1)
print(len(F))
