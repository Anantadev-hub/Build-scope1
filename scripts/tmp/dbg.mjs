import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:3000/register', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
const info = await p.evaluate(() => ({
  labels: [...document.querySelectorAll('label')].map(l => ({ text: l.textContent, htmlFor: l.htmlFor })),
  inputs: [...document.querySelectorAll('input')].map(i => ({ id: i.id, type: i.type, name: i.name })),
}));
console.log(JSON.stringify(info, null, 1));
console.log('ERRORS:', errs.slice(0,5));
await b.close();
