# PF Debate Apps

Offline apps for **Public Forum** debate. Each one is a single `.html` file: no internet, nothing to install, no account.

| File | Topic | Notes |
|---|---|---|
| **`PF.html`** / **`PF.txt`** | **Nov/Dec 2026**: *Resolved: European members of NATO should ratify the Treaty on the Prohibition of Nuclear Weapons.* | **Newest, with a real offline AI** (about 60 MB). Gemini's v7 design, with every fact checked, more prefires and attacks, AI + typo-proof search, a false-fact alarm, timers that never reset, and a Wi-Fi partner link. `PF.txt` is the same file; rename it to `PF.html` to open it. |
| `PF-lite.html` | Same topic | The same app without the AI model (1.5 MB), for slow or old laptops. Search still handles typos. |
| `tpnw.html` | Nov/Dec 2026 (same topic) | Older version, built from Gemini's v3. |
| `index.html` | Sept/Oct 2026: *Resolved: The United States federal government should enact a moratorium on hyperscale data center construction.* | Step-by-step round guide (PRO). |

## What's new in `PF.html`

- **False-fact alarm.** If the opponent's speech says something flatly false (for example, that Russia or China is in NATO), a red box appears under it with the sourced correction. In crossfire, the correction is the first answer. If they say it in the last speech, use a **Last-Speech Shield** line from the closing snippets: it quotes the NSDA ballot rule that bans new arguments in Final Focus.
- **More ammunition, PRO first.**
  - PRO gets 7 special attacks on what Russia, the US, Britain, France and NATO have actually done, plus 18 new prefires and 10 myth-busters.
  - CON gets the US-reliability argument, built on Trump's own words and on former CIA Director Leon Panetta (March 2025): "a very nervous Europe believes that The United States would not stand behind Article Five".
  - Both sides get answers to the other side's version of it.
- **Real offline AI search.** Two neural models are built into the file and run with no internet:
  - **BGE-small** understands the *meaning* of what you type.
  - **MS-MARCO MiniLM** re-reads the top 12 results and re-ranks them.

  Their ranking is merged with the typo-proof keyword search. The AI switches on a few seconds after the page opens; watch for "🧠 Offline AI: ready" in the bottom-right corner. Until then, and on browsers that can't run it, the keyword search works as before.
  - In the **AI search boxes** and **Source Cards**, it re-ranks results about half a second after you stop typing.
  - In **crossfire**, it only answers when the keyword matcher has no answer and the AI is very confident. Those answers are labelled "🧠 AI Match — check it fits".
  - **Tested on 390 searches:**
    - Wording the app had never seen: 38 of 40 found. Keyword search alone found 32.
    - Badly misspelled searches: 230 of 232.
    - Off-topic crossfire questions: all 16 still answered "no prefired answer".
- **Search finds it even if you misspell it.** It handles typos, sound-alike spelling and different wording in every search box: AI search, crossfire, Source Cards and list filters.
- **Timers.** Each step has its own clock. Switching steps or browser tabs never stops or resets a clock; only ↺ resets it.
- **Custom boxes are kept.** Text you're typing into a custom box or box editor stays when you switch steps or reload.
- **Partner link over Wi-Fi.**
  1. Open 📡 **Partner Sync**.
  2. One partner clicks **New Code** and tells the other the code.
  3. Both type the same code and click **Link Laptops**.

  Everything syncs live. It needs Wi-Fi with internet; the offline options are still there.

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
| `PF.html`, `PF.txt` | The Nov/Dec app, newest, with the offline AI. |
| `PF-lite.html` | The same app without the AI model. |
| `tpnw-source/ai/` | Builds the offline AI block appended to `PF.html`: `cd tpnw-source/ai && npm install && npm run build`, then insert `ai_snippet.html` before `</body>` of `PF-lite.html`. The first build downloads the models from Hugging Face. |
| `tpnw.html` | The Nov/Dec app, older v3-based version. |
| `tpnw-source/v7work/` | Builds `PF.html` from Gemini's v7 (`incoming/PF-gemini-v7-upload.html`): `cd tpnw-source/v7work && sh make_base.sh`, then the `node build.mjs …` line it prints. Tests are in `tpnw-source/tests/`. |
| `index.html` | The Sept/Oct app. |
| `tpnw-source/` | Builds `tpnw.html` from Gemini's original (`gemini-original.html`) using the corrected data (`fact-data.json`), code fixes and offline fonts/styles. Run `cd tpnw-source && npm install && node build.mjs`. |
| `source/` | Builds `index.html`. Run `cd source && node build.mjs --out=../index.html`. |
