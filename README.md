# PF Debate Apps

Offline apps for **Public Forum** debate. Each one is a single `.html` file: no internet, nothing to install, no account.

| File | Topic | Notes |
|---|---|---|
| **`tpnw.html`** | **Nov/Dec 2026**: *Resolved: European members of NATO should ratify the Treaty on the Prohibition of Nuclear Weapons.* | Gemini's design, kept exactly. Every fact was checked, PRO and CON, and the bugs were fixed. |
| `index.html` | Sept/Oct 2026: *Resolved: The United States federal government should enact a moratorium on hyperscale data center construction.* | Step-by-step round guide (PRO). |

## How to open either app

1. Click the file above, then the **Download raw file** button (⬇).
2. Save it to your laptop, e.g. Desktop or Documents.
3. Double-click it. It opens in your browser. **Chrome or Edge works best**; Safari and Firefox also work.
4. Test it before the tournament with Wi-Fi **off**.

Your edits save automatically in that browser on that computer.

---

## `tpnw.html`: NATO & TPNW (Nov/Dec)

1. **Setup:** pick PRO or CON and whether you speak first or second, then **Launch**.
2. The round goes one step at a time, each with its own timer. Press **Space** to start or pause the clock and **[** / **]** to move between steps.
   - **Constructive:** your case, big and readable. Tap a paragraph when you finish it.
   - **Opponent speeches:** type what they say. The matching rebuttals jump to the top. Press **⌘/Ctrl+Enter** to log a quote with its time.
   - **Crossfire:** type their question to get the best answer instantly. If nothing matches exactly, it shows the **closest answer**, so check that it fits. Your own questions to ask are on the right.
   - **Summary / Grand Crossfire / Final Focus:** an editable script with your dropped and extended arguments ready to insert.
3. **🗂 Source Cards** has the source for every card. If an opponent **calls for a card**, show the link and the citation. The card text is a **summary** unless it's in quotation marks, so cut the exact quote from the source before the tournament.
4. **↺ Reset Round** between rounds. It clears the logged quotes, card statuses and closing edits.

**What changed from the Gemini version:** see [`tpnw-source/FACT-CHANGES.md`](tpnw-source/FACT-CHANGES.md) for every fact that was corrected, with the reason and the source.

If you used the old Gemini file in the same browser, any card you **edited yourself** keeps your version, including any old numbers in it. Click **↺ Reset** on that card to get the corrected text.

---

## `index.html`: Data Center Moratorium (Sept/Oct)

1. **Start a round.** Pick **PRO or CON**, then whether you speak **first or second**. Both are locked for the round.
2. The app walks you through the round in PF order, one step at a time, each with its own timer: your constructive, their speeches (type what they say and your answers appear underneath), crossfire, rebuttal, summary and final focus.
3. Press **Next →** to move on. A **Prep** timer is always at the top.

**Review / edit my case** opens the whole case as a simple doc. **Evidence** shows the source for every number. **What Claude fixed** lists every claim that was corrected.

**Sharing:** ⚙ → **Save & share** → **Save a copy with my edits** downloads a new `.html` file with everything inside.

**Optional offline AI:** ⚙ → **Offline AI** → **Download Qwen2.5 1.5B** (needs internet once, 1.1 GB). After that it runs with no internet.

## ⚠️ Check your tournament's rules

NSDA rules ban getting outside help during a round, and some state associations treat AI-written speeches as plagiarism. Ask your coach before using AI-generated answers in a real round. Using an app as your evidence and flow document is normally fine. Always be able to show the real source for any evidence you read.

## Files

| Path | What it is |
|---|---|
| `tpnw.html` | The Nov/Dec app. |
| `index.html` | The Sept/Oct app. |
| `tpnw-source/` | Builds `tpnw.html` from Gemini's original: fact edits, code fixes, offline fonts and styles. Run `cd tpnw-source && npm install && node build.mjs`. |
| `source/` | Builds `index.html`. Run `cd source && node build.mjs --out=../index.html`. |
