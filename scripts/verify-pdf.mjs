import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const path = process.argv[2] || fs.readdirSync('shots').filter((f) => f.endsWith('.pdf')).map((f) => `shots/${f}`)[0];
const data = new Uint8Array(fs.readFileSync(path));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
let text = '';
for (let i = 1; i <= doc.numPages; i += 1) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map((it) => it.str).join(' ') + '\n';
}
console.log(`FILE: ${path}`);
console.log(`PAGES: ${doc.numPages}`);
console.log(`TEXT LENGTH: ${text.length}`);
const needles = [
  'BUILDSCOPE AI', 'BUILDABILITY REPORT', 'BS-26-001', 'Kabadiwala Connect',
  'Executive summary', 'Existing solutions and public repository findings',
  'Risk register and mitigations', 'Source register', 'Buildability Passport',
  'DEMO', 'Official competition requirements',
  // Modules added in this pass must survive into the exported artefact.
  'Need-to-proof traceability', 'TEAM-RECORDED TRACEABILITY',
  'Assurance and testing record', 'SELF-REPORTED', 'Test outcome',
  'https://', 'PAGE',
];
// Extraction can break a phrase across text items, so compare with whitespace
// collapsed rather than exact spacing.
const flat = text.replace(/\s+/g, ' ').toLowerCase();
needles.forEach((n) => {
  const needle = n.replace(/\s+/g, ' ').toLowerCase();
  console.log(`${flat.includes(needle) ? 'FOUND' : 'MISSING'} — ${n}`);
});
console.log('\n--- first 900 chars ---\n' + text.slice(0, 900).replace(/\s+/g, ' '));
