import json
F = []
def add(t, f, r): F.append({"title": t, "find": f, "replace": r})

OLD = '''      // 3. Next, fill with the active Conduct / Flow / Preparation Shutdowns ("Attacking What They Did — The 7 Things")
      // If fewer than 3 total arguments are present, automatically pull the top default flow/conduct critiques from the 7-shutdown catalog
      // so Final Focus is ALWAYS attacking what they did in the round + unfinished Summary points, and NEVER duplicates Summary!
      const activeShutdowns = catalog.filter(c => c.active);
      const fallbackShutdowns = catalog.filter(c => !c.active).sort((a, b) => a.priority - b.priority);

      for (const sh of activeShutdowns) {
        if (baseMiddleItems.length >= 3 + customBoxes.length) break;
        baseMiddleItems.push({
          id: `ff_sh_${sh.key}`,
          violationKey: sh.key,
          label: `Conduct/Flow Attack: ${sh.shortLabel}`,
          rawBody: sh.script,
          isCarryover: false,
          isCustom: false
        });
      }

      // Ensure Final Focus has 3 strong arguments attacking their round execution/flow if slots remain
      const defaultFallbacks = [
        catalog.find(c => c.key === "v5_shipsPassing"),
        catalog.find(c => c.key === "v4_ghostExt"),
        catalog.find(c => c.key === "v7_paraphrase"),
        catalog.find(c => c.key === "v3_powerTag")
      ].filter(Boolean);

      for (const fb of defaultFallbacks) {
        if (baseMiddleItems.length >= 3) break;
        if (baseMiddleItems.some(x => x.id === `ff_sh_${fb.key}`)) continue;
        baseMiddleItems.push({
          id: `ff_sh_${fb.key}`,
          violationKey: fb.key,
          label: `Conduct/Flow Attack: ${fb.shortLabel}`,
          rawBody: fb.script,
          isCarryover: false,
          isCustom: false
        });
      }'''

NEW = '''      // 3. Conduct / flow attacks — ONLY the ones actually detected in this round.
      // Never accuse them of something that did not happen: a judge who heard them weigh, or heard
      // them answer the warrant, stops believing everything else you say. The others stay one tap
      // away in the list below, to add by hand if you really heard it.
      const activeShutdowns = catalog.filter(c => c.active);

      for (const sh of activeShutdowns) {
        if (baseMiddleItems.length >= 3 + customBoxes.length) break;
        baseMiddleItems.push({
          id: `ff_sh_${sh.key}`,
          violationKey: sh.key,
          label: `Conduct/Flow Attack: ${sh.shortLabel}`,
          rawBody: sh.script,
          isCarryover: false,
          isCustom: false
        });
      }

      // 4. Still room? Fill it with SUBSTANCE — the strongest point from the Summary — never with
      // an accusation we cannot back up.
      if (baseMiddleItems.length < 2) {
        for (const x of liveSumMiddle) {
          if (baseMiddleItems.length >= 2) break;
          if (baseMiddleItems.some(b => b.sourceSummaryId === x.id || b.id === `ff_sub_${x.id}`)) continue;
          if (x.blockId) usedBlockIds.add(x.blockId);
          baseMiddleItems.push({
            id: `ff_sub_${x.id}`,
            label: `Extend: ${x.label || "our strongest point"}`,
            rawBody: adaptSummaryArgForFinalFocus(x.rawBody),
            isCarryover: false,
            isCustom: false
          });
        }
      }

      // 5. Comparative weighing LEADS the Final Focus. This is the speech where the judge decides
      // whose impact matters more — not where you re-read evidence or complain about their conduct.
      const ffMat = IMPACT_CALCULUS_MATRIX[side] || {};
      const weighBody = `the voting issue is comparative weighing, so compare our impacts directly. ${ffMat.probability || ""} ${ffMat.reversibility || ""}`.replace(/\\s+/g, " ").trim();
      if (weighBody.length > 60) {
        baseMiddleItems.unshift({
          id: "ff_weighing_lead",
          label: "⚖ Weighing — say this first",
          rawBody: weighBody,
          isCarryover: false,
          isCustom: false
        });
      }'''

add("Final Focus: lead with weighing, and never auto-accuse them of something that was not detected", OLD, NEW)

# label undetected conduct attacks honestly in the picker
add("Final Focus picker: mark the attacks that were not detected this round",
'''              >
                ${sh.active ? "✓" : "+"} ${escapeHtml(sh.shortLabel)}''',
'''                title="${sh.active ? "Detected in this round" : "NOT detected — only add this if you actually heard it"}"
              >
                ${sh.active ? "✓" : "+"} ${escapeHtml(sh.shortLabel)}${sh.active ? "" : " (only if it happened)"}''')

json.dump(F, open('fixes_ff.json', 'w'), indent=1)
print(len(F))
