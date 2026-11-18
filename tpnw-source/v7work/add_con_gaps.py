import json
D = json.load(open('data7_final.json')); C = D['DEBATE_DATA']['CON']
NEW = [
 {"id": "c_pf_g1", "chip": "G1. 'Your US Argument Contradicts You'",
  "topicLabel": "Doesn't your own Trump evidence contradict your extended-deterrence impact?",
  "phrases": ["contradict yourself", "double bind", "pick one", "your own case says", "umbrella is already leaking",
              "you said the us wont defend", "if the umbrella is failing", "internal contradiction", "have it both ways"],
  "keywords": ["contradict", "contradiction", "double bind", "pick one", "both ways", "leaking", "inconsistent"],
  "coreAnswer": "That is our case, not a contradiction. We never argued the American umbrella is reliable; we argued it is uncertain, and that is exactly why Europe cannot destroy the one deterrent it does control. Britain and France hold 515 sovereign warheads (van Hooft, 25 at RAND), and TPNW Articles 1 and 4 force them to eliminate every single one. So their world removes Europe's own insurance at the precise moment the American policy is least certain. If the roof is leaking, you do not also rip out the sprinklers.",
  "extraClauses": [],
  "mustContainAny": ["contradict", "contradiction", "double bind", "pick one", "both ways", "leaking", "your own case", "inconsistent"],
  "citation": "van Hooft, 25 (RAND Europe) & TPNW Text, 17"},

 {"id": "c_pf_g2", "chip": "G2. 'Deterrence Didn't Cause the Long Peace'",
  "topicLabel": "Isn't the long peace just correlation? Mueller says deterrence did not cause it.",
  "phrases": ["correlation not causation", "mueller", "atomic obsession", "ward wilson", "long peace",
              "no counterfactual", "unfalsifiable", "you cannot prove deterrence worked", "cant prove the counterfactual"],
  "keywords": ["correlation", "causation", "mueller", "wilson", "counterfactual", "unfalsifiable", "long peace"],
  "coreAnswer": "Nobody can run the experiment twice, and that cuts against them harder than us, because their case is also a counterfactual: that a disarmed Europe stays safe. The difference is we have a real comparison. Russia invaded Georgia in 2008 and Ukraine in 2014 and 2022, none of them covered by Article 5, while no NATO territory covered by Article 5 has been invaded in 77 years. Under that uncertainty you keep the arrangement that has coincided with zero great-power wars instead of running a one-way experiment you cannot reverse.",
  "extraClauses": [],
  "mustContainAny": ["correlation", "causation", "mueller", "wilson", "counterfactual", "unfalsifiable", "long peace", "prove deterrence"],
  "citation": "Historical record: Georgia 2008, Ukraine 2014 and 2022"},

 {"id": "c_pf_g3", "chip": "G3. 'How Many Warheads Is Enough?'",
  "topicLabel": "How many nuclear weapons does Europe actually need? Isn't anything above that surplus?",
  "phrases": ["how many warheads", "how much is enough", "what number", "how many do you need",
              "is that number enough", "anything more is surplus", "where do you draw the line"],
  "keywords": ["how many", "how much", "enough", "number", "surplus", "upper bound"],
  "coreAnswer": "Enough is whatever survives a first strike and can still retaliate, and that number is set by Russia's roughly 4,400 warheads (Kristensen, 26 at FAS), not by us. But look at what is actually on the ballot: the resolution does not ask Britain and France to go from 515 to a smaller number, it asks them to go to zero while Russia keeps 4,400. We would support verified mutual reductions tomorrow. What we will not support is one side disarming alone, and that is the only option this resolution gives you.",
  "extraClauses": [],
  "mustContainAny": ["how many", "how much is enough", "what number", "how many do you need", "surplus", "upper bound", "draw the line"],
  "citation": "Kristensen, 26 (FAS) & van Hooft, 25 (RAND Europe)"},
]
have = {p['id'] for p in C['prefires']}
C['prefires'] += [p for p in NEW if p['id'] not in have]
C['crossfireTraps'] += [
 {"trigger": "They say our Trump evidence contradicts our umbrella impact.", "question": "If you believe the American guarantee is unreliable, why does your plan destroy the 515 British and French warheads Europe actually controls?", "source": "van Hooft, 25 (RAND Europe)"},
 {"trigger": "They say the long peace is just correlation.", "question": "Russia invaded Georgia and Ukraine, neither covered by Article 5, and has invaded no Article 5 territory in 77 years. What explains that difference on your theory?", "source": "Historical record"}
]
json.dump(D, open('data7_final.json', 'w'), ensure_ascii=False, indent=1)
print('CON prefires', len(C['prefires']), '| traps', len(C['crossfireTraps']))
