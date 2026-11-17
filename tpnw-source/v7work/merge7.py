import json, re, copy, sys
D = json.load(open('data7.json'))
def resolve(path):
    parts = re.findall(r'[A-Za-z_]+|\[\d+\]', path)
    obj = D; trail = []
    for p in parts[:-1]:
        obj = obj[int(p[1:-1])] if p.startswith('[') else obj[p]
    last = parts[-1]
    return obj, (int(last[1:-1]) if last.startswith('[') else last)
fails = 0
for f in ['out7_PRO.json', 'out7_CON.json']:
    for e in json.load(open(f))['edits']:
        o, k = resolve(e['path'])
        s = o[k]
        if not isinstance(s, str) or s.count(e['find']) != 1:
            print('FAIL', f, e['path'], repr(e['find'][:60]), (s.count(e['find']) if isinstance(s, str) else type(s))); fails += 1; continue
        o[k] = s.replace(e['find'], e['replace'])
print('edit failures', fails)
json.dump(D, open('data7_fixed.json', 'w'), ensure_ascii=False, indent=1)
