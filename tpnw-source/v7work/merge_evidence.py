import json
D = json.load(open('data7_final.json'))
DD = D['DEBATE_DATA']
NC = json.load(open('new_constructives.json'))
CR = {c['short']: c for c in json.load(open('card_credentials.json'))['credentials']}
EV = json.load(open('evidence_content.json'))

# 1. shortened constructives
for s in ('PRO', 'CON'):
    assert len(NC[s]) == len(DD[s]['constructiveParagraphs']), s
    DD[s]['constructiveParagraphs'] = NC[s]

# 2. credentials + honest warnings about our own weak cards
missing = []
for c in DD['SOURCE_CARDS']:
    cr = CR.get(c['short'])
    if not cr: missing.append(c['short']); continue
    c['credential'] = cr['credential']
    w = cr.get('weakness', {}); risks = []
    if w.get('recency'): risks.append("published before February 2022, so only use it for history, law or physics, never for what Russia is doing now")
    if w.get('expertise'): risks.append("a news outlet: fine for proving what someone said, weak if you use it as analysis")
    f = w.get('funding')
    if f and f not in ('not verified', '', None): risks.append("funding to know about: " + f)
    if cr.get('verified') == 'unverified': risks.append("credential not independently verified")
    note = cr.get('note')
    if risks or note:
        c['ownRisk'] = ("Watch out: " + "; ".join(risks) + "." if risks else "") + ((" " + note) if note else "")
print('cards without credentials:', missing)

# 3. drop the unverifiable name from the CIA card
for short, fx in EV['cardCitationFix'].items():
    for c in DD['SOURCE_CARDS']:
        if c['short'] == short and fx['removeText'] in c['citation']:
            c['citation'] = c['citation'].replace(fx['removeText'], '.').replace('..', '.')
            print('cleaned citation:', short)

# 4. evidence-test prefires + traps for both sides
for side, pre in (('PRO', 'p_pf_'), ('CON', 'c_pf_')):
    have = {p['id'] for p in DD[side]['prefires']}
    for p in EV['prefiresBoth']:
        pid = pre + p['idSuffix']
        if pid in have: continue
        q = {k: v for k, v in p.items() if k != 'idSuffix'}
        q['id'] = pid
        DD[side]['prefires'].append(q)
    DD[side]['crossfireTraps'] += EV['trapsBoth']

json.dump(D, open('data7_final.json', 'w'), ensure_ascii=False, indent=1)
print({s: {k: len(DD[s][k]) for k in ('prefires', 'crossfireTraps')} for s in ('PRO', 'CON')})
print('cards with credential:', sum(1 for c in DD['SOURCE_CARDS'] if c.get('credential')), '/', len(DD['SOURCE_CARDS']))
print('cards with a warning:', sum(1 for c in DD['SOURCE_CARDS'] if c.get('ownRisk')))
