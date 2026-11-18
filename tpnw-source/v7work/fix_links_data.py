import json
D = json.load(open('data7_final.json')); DD = D['DEBATE_DATA']
card = lambda s: next(c for c in DD['SOURCE_CARDS'] if c['short'] == s)
log = []

# 1. verified original links
NEW = {
 "Davis, 19 (RAND)": "https://www.rand.org/pubs/research_reports/RR2781.html",
 "North Atlantic Council, 26": "https://www.nato.int/en/about-us/official-texts-and-resources/official-texts/2026/04/20/north-atlantic-council-statement-on-the-occasion-of-the-11th-review-conference-of-the-treaty-on-the-non-proliferation-of-nuclear-weapons",
 "NSDA PF Ballot": "https://www.speechanddebate.org/wp-content/uploads/Sample-Ballot-Public-Forum-Blank.pdf",
 "Kristensen, 15 (FAS)": "https://fas.org/publication/nuclear-insecurity/",
 "Brennan, 25": "https://www.eurointegration.com.ua/eng/news/2025/03/7/7206625/",
}
for s, u in NEW.items():
    c = card(s); log.append(f"link: {s}\n   was {c['url']}\n   now {u}"); c['url'] = u

# 2. the links above changed publisher, so fix the matching text
c = card("NSDA PF Ballot")
c['citation'] = "National Speech & Debate Association, sample Public Forum ballot (speechanddebate.org)."
c['credential'] = "The National Speech & Debate Association writes the rules and the ballot used at these tournaments."
c.pop('ownRisk', None)
log.append("NSDA ballot: now the NSDA's own ballot, so the 'club copy' warning is gone")

c = card("Kristensen, 15 (FAS)")
c['title'] = "Upgrades At US Nuclear Bases In Europe Acknowledge Security Risk"
c['citation'] = "Hans M. Kristensen, Federation of American Scientists, September 10, 2015."
c['credential'] = "Hans Kristensen directs the Nuclear Information Project at the Federation of American Scientists."
c['verbatim'] = "Summary (not a quote): FAS documented security upgrades at US nuclear bases in Europe, including underground vaults inside protective aircraft shelters at Incirlik."
log.append("Kristensen, 15: now the FAS original, not Military.com's write-up; dropped the WS3 label at Incirlik (FAS names WS3 for Kleine Brogel and Ghedi)")

c = card("Brennan, 25")
c['citation'] = "European Pravda / Ukrainska Pravda, March 7, 2025, reporting a March 2025 John Brennan interview."
c['credential'] = "John Brennan is a former Director of the CIA; this is European Pravda reporting his interview."
c['title'] = "Former CIA Director accuses Trump of blackmailing Ukraine"
log.append("Brennan, 25: dropped the unverified 'Times Radio' attribution (the source credits a different outlet)")

# 3. the same unverified outlet claim elsewhere
c = card("Brennan & Panetta, 25 (Former CIA Directors)")
for k in ('citation', 'verbatim', 'takeaway'):
    if c.get(k):
        c[k] = c[k].replace("Times Radio interview, reported by Kevin Schofield, HuffPost UK, March 6, 2025", "interview, March 2025, reported by HuffPost UK and European Pravda")
        c[k] = c[k].replace("(Times Radio, via HuffPost UK, March 6, 2025)", "(interview, March 2025, via HuffPost UK)")
log.append("CIA card: same 'Times Radio' claim softened")

# 4. a real typo: doubled closing quote mark
c = card("AP, 22 (Nuclear Alert)")
if c['verbatim'].endswith('””'):
    c['verbatim'] = c['verbatim'][:-1]; log.append("AP, 22 (Nuclear Alert): removed a doubled closing quotation mark")

# 5. card title now matches the page the link opens
c = card("AP, 25 (Article 5 Definition)")
c['title'] = "NATO leaders, including President Donald Trump, gather for historic summit with unity on the line"
log.append("AP, 25 (Article 5): title now matches the headline on the page the link opens")

json.dump(D, open('data7_final.json', 'w'), ensure_ascii=False, indent=1)
print("\n".join(log))
