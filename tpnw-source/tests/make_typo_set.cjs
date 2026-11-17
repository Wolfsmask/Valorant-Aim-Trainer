const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'search_eval.cjs'), 'utf8');
let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
eval(src.slice(src.indexOf('function typo'), src.indexOf('function makeQuery')));
const Q = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const mis = s => s.split(' ').map(w => /^[a-z]{6,}$/i.test(w) && rnd() < 0.6 ? typo(w.toLowerCase(), w.length >= 9 ? 2 : 1) : w).join(' ');
const out = {}; for (const side of Object.keys(Q)) out[side] = Q[side].map(x => Array.isArray(x) ? [mis(x[0]), ...x.slice(1)] : x);
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
