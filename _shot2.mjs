import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
for (const [w, tag] of [[390, 'phone'], [1280, 'desk']]) {
  for (const dark of [false, true]) {
    const p = await b.newPage({ viewport: { width: w, height: 1000 } });
    p.on('pageerror', e => errs.push(`${tag}/${dark}: ${e.message}`));
    await p.goto('http://localhost:5173/scripts/__floorcheck.html?v=feynman', { waitUntil: 'networkidle' });
    await p.evaluate(d => document.documentElement.classList.toggle('dark', d), dark);
    await p.waitForTimeout(900);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${tag} ${dark ? 'dark' : 'light'}: overflow=${over}px`);
    await p.screenshot({ path: `${OUT}/feyn-${tag}-${dark ? 'dark' : 'light'}.png`, fullPage: true });
    await p.close();
  }
}
await b.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
