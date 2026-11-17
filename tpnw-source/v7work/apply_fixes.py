import json, sys
h = open(sys.argv[1]).read()
for fx in sys.argv[3:]:
    for f in json.load(open(fx)):
        n = h.count(f['find'])
        if n != 1:
            print("ANCHOR FAIL", n, f.get('title', '')[:70]); continue
        h = h.replace(f['find'], f['replace'])
open(sys.argv[2], 'w').write(h)
print("applied")
