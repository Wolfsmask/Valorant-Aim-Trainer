import json
F = json.load(open('fixes_myth.json'))
F = [f for f in F if not f['title'].startswith('Crossfire: prefer the answer')]
find = """      scoredList.sort((a, b) => b.score - a.score || a.priorityRank - b.priorityRank);
      try {
        detectFalseFacts("""
replace = """      scoredList.sort((a, b) => b.score - a.score || a.priorityRank - b.priorityRank);
      try {
        const padQ = " " + rawNormalize(rawQuery) + " ";
        const phraseWords = pf => Math.max(0, ...(pf.phrases || []).map(ph => { const n = rawNormalize(ph); return n && padQ.includes(" " + n + " ") ? n.split(/\\s+/).length : 0; }));
        if (scoredList.length > 1) {
          const topW = phraseWords(scoredList[0].pf);
          let best = -1, bestW = topW;
          scoredList.slice(1, 4).forEach((c, i) => { const w = phraseWords(c.pf); if (w >= 3 && w >= topW + 2 && c.score >= 0.6 * scoredList[0].score && w > bestW) { best = i + 1; bestW = w; } });
          if (best > 0) scoredList.unshift(scoredList.splice(best, 1)[0]);
        }
      } catch (e) {}
      try {
        detectFalseFacts("""
F.append({"title": "Crossfire: prefer the answer whose own phrase matches more of the question (specific beats general)", "find": find, "replace": replace})
json.dump(F, open('fixes_myth.json', 'w'), indent=1)
print(len(F))
