import json, re
D = json.load(open('data7_fixed.json'))
DD = D['DEBATE_DATA']
P = json.load(open('new_pro_content.json')); C = json.load(open('new_con_content.json'))
def find_id(lst, i): return next(x for x in lst if x['id'] == i)
# 1. CON content edits (by path, but check PRO index points to pro_reb_19)
assert DD['PRO']['rebuttals'][18]['id'] == 'pro_reb_19'
for e in C['edits']:
    parts = re.findall(r'[A-Za-z_]+|\[\d+\]', e['path']); o = D
    for p in parts[:-1]: o = o[int(p[1:-1])] if p.startswith('[') else o[p]
    k = parts[-1]; k = int(k[1:-1]) if k.startswith('[') else k; assert o[k].count(e['find']) == 1, e['path']; o[k] = o[k].replace(e['find'], e['replace'])
for i, v in C['replaceCon'].items(): find_id(DD['CON']['rebuttals'], i).update(v)
for i, v in C['replaceConPrefire'].items(): find_id(DD['CON']['prefires'], i).update(v)
# 2. new items
DD['PRO']['rebuttals'] += P['rebuttals']; DD['PRO']['crossfireTraps'] += P['traps']
DD['PRO']['prefires'] += P['prefires'] + P['mythPrefires'] + C['proPrefires']
DD['CON']['rebuttals'] += C['rebuttals']; DD['CON']['crossfireTraps'] += C['traps']; DD['CON']['prefires'] += C['prefires']
neutral = lambda s: dict(s, text=s['text'].replace("Because we speak first, our opponents get the last word. ", "When our opponents get the last word, ").replace("Because we speak first, our opponents get the last word.", ""))
shields = [neutral(s) for s in P['shieldSnippets']]
D['CLOSING_SNIPPETS']['PRO'] += shields
D['CLOSING_SNIPPETS']['CON'] += C['conSnippets'] + [dict(s) for s in shields]
# 3. cards: add new ones; convert newSources from fact-checks
have = {c['short'] for c in DD['SOURCE_CARDS']}
tagset = lambda s: s.split(' (')[0]
for card in P['sourceCards'] + C['sourceCards']:
    if card['short'] in have: print('dup card', card['short']); continue
    DD['SOURCE_CARDS'].append(card); have.add(card['short'])
havetags = {tagset(s) for s in have}
for f, side in (('out7_PRO.json', 'PRO'), ('out7_CON.json', 'CON')):
    for s in json.load(open(f))['newSources']:
        if s['tag'] in havetags: print('skip existing tag', s['tag']); continue
        DD['SOURCE_CARDS'].append({"short": s['tag'], "side": side, "title": s['title'], "url": s['url'],
            "citation": f"{s.get('authors','')}, {s.get('date','')}.".strip(', '), "takeaway": f"{side}: {s.get('whatItSupports','')}", "verbatim": ""})
        havetags.add(s['tag'])
# 4. checks: ids unique, cardKeys exist
for side in ('PRO', 'CON'):
    for k in ('rebuttals', 'prefires', 'frontlines', 'counterDefenses'):
        ids = [x['id'] for x in DD[side][k]]; assert len(ids) == len(set(ids)), (side, k)
shorts = {c['short'] for c in DD['SOURCE_CARDS']}
for side in ('PRO', 'CON'):
    for b in DD[side]['rebuttals'] + DD[side]['frontlines'] + DD[side].get('counterDefenses', []):
        for ck in b.get('cardKeys', []):
            if ck not in shorts: print('MISSING cardKey', b['id'], ck)
txt = json.dumps(D, ensure_ascii=False)
for bad in ['Brennan and Panetta, 25', 'Option 2 AirDrop']: print(bad, txt.count(bad))
print({s: {k: len(DD[s][k]) for k in ('rebuttals', 'prefires', 'crossfireTraps')} for s in ('PRO', 'CON')}, 'cards', len(DD['SOURCE_CARDS']))
json.dump(D, open('data7_final.json', 'w'), ensure_ascii=False, indent=1)
