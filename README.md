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

## How it works (one step at a time)

1. **Start a round.** Pick **PRO or CON**, then whether you speak **first or second**. Your side and order are locked for the round, so you never have to wonder which side you're on.
2. **The app walks you through the round in real PF order,** showing only the current step, each with its own timer:
   - **Your Constructive**: your speech, big and readable. Tap to fix any text.
   - **Their speeches**: a box where you type what they say (shorthand is fine). Your best answers appear right underneath as you type.
   - **Crossfire**: type their question and the best answer pops up instantly, with a question to ask back. Your own questions to ask them are listed next to it.
   - **Your Rebuttal**: the right rebuttal card for each of their contentions, in order.
   - **Your Summary / Final Focus**: built automatically from your notes on what they said. Edit it, then read it.
3. Press **Next →** to move on. A **Prep** timer is always at the top.

Outside of a round, **Review / edit my case** opens your whole case as a simple doc you can edit and search. **Evidence** shows the source for every number, in case they ask to see a card. **What Claude fixed** lists every claim that was corrected in your original doc, and why.

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
