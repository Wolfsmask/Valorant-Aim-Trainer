# PF Debate Hub — Data Center Moratorium (PRO)

An offline app for **Public Forum** debate on the NSDA Sept/Oct 2026 topic:

> *Resolved: The United States federal government should enact a moratorium on hyperscale data center construction.*

It's one file, **`index.html`**. It needs no internet, nothing to install, and no account.

## How to open it

1. Download **`index.html`**: click it above, then the **Download raw file** button (⬇).
2. Save it to your laptop, e.g. Desktop or Documents.
3. Double-click it. It opens in your browser. **Chrome or Edge works best**, but Safari and Firefox also work.
4. Test it before the tournament with Wi-Fi **off**.

Your edits save automatically in that browser on that computer.

## What it does

- **Your whole case as an editable doc.** Click any text to edit it, or select text for bold, highlight and headings. Sections: Opening, Rebuttal, Counter Rebuttal, Crossfire (we ask), Crossfire Predictions (they ask), Summary, Ending Statement, and Quick Stats.
- **Search every word.** Press `/` to search; every match in the whole case is highlighted. Topic chips (Bills, Water, AI, China, Jobs…) filter cards by subject.
- **⚡ Crossfire helper** (press `X`). Type the other team's question (shorthand and typos are fine) and the best prepared answer appears as you type, reworded to fit the question, with an "ask back" follow-up and the evidence to cite. If there's no prepared answer, it writes a new counter from your own cards in the same style.
- **⌨ Type what they say**, on every section:
  - 🎤 Opening: splits their case into contentions and highlights (purple) which rebuttals, crossfire questions and answers to use this round.
  - 🛡️ Rebuttal and 🔁 Counter: each line you type finds the card that answers it.
  - 🧭 Summary and 🏁 Final Focus: builds your speech from everything they said this round.
- **Timers** for every PF speech, plus prep-time clocks.
- **📚 Evidence Library.** Every number has who, when and a link, so you can show the source when the other team asks for a card.
- **✅ Fact-Check Log.** Every claim Claude corrected in the original doc, what it said before and why it changed.

## Sharing with your partner

⚙ → **Save & share** → **Save a copy with my edits** downloads a new `.html` file with everything inside. Send it by AirDrop, email, Google Drive or USB. Your partner just opens it.

## Optional: offline AI model

The **instant engine** answers questions with no download at all. If you also want an AI to reword answers more smoothly:

1. With internet, open ⚙ → **Offline AI** and click **Download Qwen2.5 1.5B** (1.1 GB). Use the 0.5B one on slower laptops.
2. After that it runs **entirely on your laptop with no internet**.

## ⚠️ Check your tournament's rules

NSDA rules ban getting outside help during a round, and some state associations treat AI-written speeches as plagiarism. Ask your coach before using the AI-generated answers in a real round. Using the app as your evidence and flow document is normally fine.

## Files

| File | What it is |
|---|---|
| `index.html` | **The app.** This is the only file you need. |
| `source/` | The source code that builds `index.html`. You don't need it unless you're changing the app. |

To rebuild from source: `cd source && node build.mjs --out=../index.html` (needs Node.js and npm).
