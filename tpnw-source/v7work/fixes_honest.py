import json
F = []
def add(t, f, r): F.append({"title": t, "find": f, "replace": r})

# 1. Only call power-tagging when they actually named a source in the same sentence as the absolute claim.
add("Power-tagging: only fires when they named a source in the same sentence as the absolute word",
'''    function analyzePowerTagging(rawText) {
      const text = String(rawText || "").trim();
      if (!text || text.length < 5) return null;
      const low = text.toLowerCase();
      for (let i = 0; i < POWER_TAG_WORDS.length; i++) {
        const w = POWER_TAG_WORDS[i];
        if (low.includes(w)) {
          return {
            triggerWord: w,
            authorName: detectOpponentAuthorName(text),
            rawSentence: text
          };
        }
      }
      return null;
    }''',
'''    function analyzePowerTagging(rawText) {
      const text = String(rawText || "").trim();
      if (!text || text.length < 5) return null;
      // Power-tagging means overstating what a CARD says. Words like "never" or "always" on their own
      // are just normal debate speech, so this only fires when an absolute word sits in the SAME
      // sentence as a source they actually named. Otherwise we would be accusing them of misusing
      // a card nobody read, which a judge will catch.
      const sentences = (typeof splitIntoSentences === "function" ? splitIntoSentences(text) : [text]);
      for (const sentence of sentences) {
        const low = sentence.toLowerCase();
        const hit = POWER_TAG_WORDS.find(w => low.includes(w));
        if (!hit) continue;
        const author = detectOpponentAuthorName(sentence);
        if (!author) continue;
        return { triggerWord: hit, authorName: author, rawSentence: sentence.trim() };
      }
      return null;
    }''')

# 2. Never invent which card they power-tagged; make it a challenge they can answer.
add("Power-tagging: challenge what they actually said instead of inventing which card it was",
'''      const rawAuthor = customAuthorName || (state.detectedPowerTag ? state.detectedPowerTag.authorName : detectOpponentAuthorName());
      // Extra safeguard: if on PRO, never accuse the opponent of power-tagging our own Pro authors (like Muñoz, 26)!
      const safeAuthor = (state.side === "PRO" && /muñoz|munoz|lewis|sweeney|danylyuk|docherty|sipri/i.test(rawAuthor))
        ? "Chevreuil, 25 and Williams, 24"
        : (state.side === "CON" && /williams|jones|chevreuil|north atlantic/i.test(rawAuthor))
          ? "Lewis, 14 and Sweeney, 20"
          : rawAuthor;''',
'''      const det = state.detectedPowerTag;
      const rawAuthor = customAuthorName || (det ? det.authorName : detectOpponentAuthorName());
      const word = det && det.triggerWord ? det.triggerWord : "";
      // Our own authors are not theirs to power-tag: if what we spotted is one of our cards being
      // discussed, say nothing rather than inventing a different card for them.
      const isOurs = (state.side === "PRO" && /muñoz|munoz|lewis|sweeney|danylyuk|docherty|sipri/i.test(rawAuthor || "")) ||
                     (state.side === "CON" && /williams|jones|chevreuil|north atlantic/i.test(rawAuthor || ""));
      if (!rawAuthor || isOurs) {
        return `Judge, hold them to what their evidence actually says${word ? ` — they said "${word}"` : ""}. Ask them to read the author's own sentence behind that claim. A study that describes a conditional scenario cannot support an absolute one, and you should prefer the side whose tags match its cards.`;
      }
      const safeAuthor = rawAuthor;''')

add("Power-tagging: phrase it as a challenge the judge can check, not a claim about a card we never saw",
'''      return `Judge, compare the evidence rigor between the two teams: our opponents overstated their ${safeAuthor} card as a 100 percent certainty when the underlying study only describes a conditional scenario. Reward our side's disciplined, accurately qualified citations over exaggerated power-tags.`;''',
'''      return `Judge, compare how carefully each side tags its evidence. They used their ${safeAuthor} card to support ${word ? `an absolute claim — they said "${word}"` : "an absolute claim"}. I am asking them to read the line from that card that states it in those terms; if the study only describes a conditional scenario, the tag is doing work the evidence does not. Prefer the side whose tags match its cards.`;''')

# 3. "They never weighed" is only safe if we actually captured their speech.
add("Zero-weighing attack: only claim it when enough of their speech was captured, and phrase it to their face",
'''      state.opponentUsedWeighing = checkOpponentWeighing(combinedText);
      if (state.currentStepIndex >= 3 && wordCount >= 35 && !state.opponentUsedWeighing) {''',
'''      state.opponentUsedWeighing = checkOpponentWeighing(combinedText);
      // Only raise "they did no weighing" when we captured a real chunk of the speech. On a handful of
      // typed fragments we cannot know what they said, and a judge who heard them weigh will not forgive it.
      if (state.currentStepIndex >= 3 && wordCount >= 90 && !state.opponentUsedWeighing) {''')

json.dump(F, open('fixes_honest.json', 'w'), indent=1)
print(len(F))
