# PF Debate Apps

Offline apps for **Public Forum** debate. Each one is a single `.html` file: no internet, nothing to install, no account.

| File | Topic | Notes |
|---|---|---|
| **`tpnw.html`** | **Nov/Dec 2026**: *Resolved: European members of NATO should ratify the Treaty on the Prohibition of Nuclear Weapons.* | Gemini's v3 design, kept exactly. Every fact on PRO and CON was checked and corrected; it works offline. |
| `index.html` | Sept/Oct 2026: *Resolved: The United States federal government should enact a moratorium on hyperscale data center construction.* | Step-by-step round guide (PRO). |

## How to open either app

1. Click the file above, then the **Download raw file** button (⬇).
2. Save it to your laptop, e.g. Desktop or Documents.
3. Double-click it. It opens in your browser. **Chrome or Edge works best**; Safari and Firefox also work.
4. Test it before the tournament with Wi-Fi **off**.

Your edits save automatically in that browser on that computer.

---

## `tpnw.html`: NATO & TPNW (Nov/Dec)

This is Gemini's latest version (v3), with the same design and features. Only the facts were corrected, plus a few needed fixes.

1. **Setup:** pick PRO or CON and whether you speak first or second, then **Launch**.
2. The round follows all **11 PF steps**, one at a time, each with its own timer: case, crossfires, rebuttals, summaries, grand crossfire and final focus ("voter speech").
   - **Opponent speeches:** type what they say, even in shorthand. The counter that answers their **specific** claim jumps to the top. If a general trigger word pointed at the wrong card, it switches to the right one.
   - **Crossfire:** type their question to get the best answer instantly. If nothing matches exactly, it shows the **closest answer** ("Closest Answer — check it fits").
3. **🗂 Source Cards** has a card for every source the app cites. Words in quotation marks are exact quotes; everything else is a summary. Cut the full card from the link before the tournament.
4. **↺ Reset Round** between rounds.

**What changed from Gemini's version:** see [`tpnw-source/FACT-CHANGES.md`](tpnw-source/FACT-CHANGES.md) for every correction, with the reason and the source.

If you used Gemini's file in the same browser, any card you **edited yourself** keeps your version, including any old numbers in it. Click **↺ Reset** on that card to get the corrected text.

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
| `tpnw-source/` | Builds `tpnw.html` from Gemini's original (`gemini-original.html`) using the corrected data (`fact-data.json`), code fixes and offline fonts/styles. Run `cd tpnw-source && npm install && node build.mjs`. |
| `source/` | Builds `index.html`. Run `cd source && node build.mjs --out=../index.html`. |
