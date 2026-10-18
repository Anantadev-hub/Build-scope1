import fs from 'node:fs';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

globalThis.DOMMatrix = globalThis.DOMMatrix || DOMMatrix;
globalThis.ImageData = globalThis.ImageData || ImageData;
globalThis.Path2D = globalThis.Path2D || Path2D;

const path = process.argv[2] || fs.readdirSync('shots').filter((f) => f.endsWith('.pdf')).map((f) => `shots/${f}`)[0];
const data = new Uint8Array(fs.readFileSync(path));
const doc = await getDocument({
  data,
  useSystemFonts: false,
  standardFontDataUrl: process.cwd() + '/node_modules/pdfjs-dist/standard_fonts/',
  verbosity: 1,
}).promise;
// Usage: node scripts/render-pdf.mjs <file.pdf> [pages]  e.g. "5,6,7" or "all"
const requested = process.argv[3];
const pages = !requested
  ? [1, 2, 3, doc.numPages]
  : requested === 'all'
    ? Array.from({ length: doc.numPages }, (_, i) => i + 1)
    : requested.split(',').map((n) => Number(n.trim())).filter((n) => n >= 1 && n <= doc.numPages);
console.log(`Rendering ${pages.length} of ${doc.numPages} pages from ${path}`);
for (const n of pages) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1.35 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  fs.writeFileSync(`shots/pdf-page-${n}.png`, canvas.toBuffer('image/png'));
  console.log(`wrote shots/pdf-page-${n}.png (${canvas.width}x${canvas.height})`);
}
