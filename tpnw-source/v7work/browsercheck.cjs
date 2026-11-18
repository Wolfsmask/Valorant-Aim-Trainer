const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => l.split('\t'));
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy, args: ['--ignore-certificate-errors'] });
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  for (const [code, short, url] of rows) {
    const p = await ctx.newPage();
    let status = 'ERR', title = '';
    try {
      const r = await p.goto(url, { timeout: 45000, waitUntil: 'domcontentloaded' });
      status = r ? r.status() : 'no-response';
      title = (await p.title()).replace(/\s+/g, ' ').slice(0, 70);
    } catch (e) { status = 'ERR:' + e.message.slice(0, 40); }
    console.log(`${status}\t${short}\t${title}`);
    await p.close();
  }
  await b.close();
})();
