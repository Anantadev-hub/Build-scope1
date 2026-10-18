// Real PDF generation. Text is selectable, tables are paginated by AutoTable,
// and every page carries the case ID, generation date, and data status.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pdfSafe, fmtDate } from './format';

const INK = [36, 37, 34];
const GREEN = [48, 54, 48];
const FIELD = [120, 129, 109];
const SAGE = [224, 228, 217];
const PAPER = [247, 245, 239];
const LINE = [201, 197, 186];
const ORANGE = [232, 107, 67];
const MUTED = [113, 111, 103];

const M = 16;
const W = 210;

export function generateReportPdf(report, options = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const { cover } = report;
  let y = M;

  doc.setProperties({
    title: `BuildScope AI — ${cover.title} (${cover.caseId})`,
    subject: 'Buildability Report — hackathon idea investigation',
    author: 'BuildScope AI',
    keywords: `${cover.caseId}, ${cover.outcome}, buildability, prior art`,
  });

  /* ---------------- cover ---------------- */
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 86, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 86, W, 2.4, 'F');

  doc.setTextColor(200, 208, 190);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('BUILDSCOPE AI  /  BUILDABILITY REPORT  /  INVESTIGATION DOSSIER', M, 18);
  doc.setDrawColor(...FIELD);
  doc.setLineWidth(0.3);
  doc.line(M, 22, W - M, 22);

  doc.setTextColor(247, 245, 239);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  const title = doc.splitTextToSize(pdfSafe(cover.title), W - M * 2 - 4);
  doc.text(title, M, 38);

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 208, 190);
  doc.text(`CASE ${pdfSafe(cover.caseId)}`, M, 50);
  doc.text(`GENERATED ${pdfSafe(cover.date).toUpperCase()}  /  REPORT v${cover.version}`, M, 56);
  if (cover.hackathon) doc.text(doc.splitTextToSize(pdfSafe(cover.hackathon), 120), M, 62);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(247, 245, 239);
  doc.text('BUILDABILITY PASSPORT', M, 74);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(224, 228, 217);
  const outcomeLines = doc.splitTextToSize(pdfSafe(cover.outcome), W - M * 2 - 4);
  doc.text(outcomeLines, M, 79.5);

  y = 100;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  const intro = doc.splitTextToSize(
    pdfSafe('This report assembles the investigation record for the project above. It distinguishes checked sources from demo fixtures, user assertions, and derived analysis. A positive recommendation is only issued when the passport checks pass; missing information is reported as missing.'),
    W - M * 2,
  );
  doc.text(intro, M, y);
  y += intro.length * 4.6 + 6;

  // Meta block
  const metaRows = [
    ['Case ID', cover.caseId],
    ['Investigation date', cover.date],
    ['Team size', String(cover.teamSize || 'Not recorded')],
    ['Data status', cover.demoData ? 'Contains demo fixtures — not live verified' : 'No demo fixtures recorded'],
    ['Report version', `v${cover.version}`],
    ['Recommendation', cover.outcome],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: metaRows.map(([k, v]) => [pdfSafe(k), pdfSafe(v)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 2.6, lineColor: LINE, lineWidth: 0.2, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', fillColor: SAGE }, 1: { cellWidth: W - M * 2 - 42 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  if (cover.demoData) {
    doc.setDrawColor(200, 154, 88);
    doc.setFillColor(247, 236, 217);
    doc.rect(M, y, W - M * 2, 17, 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(111, 74, 18);
    doc.text('DEMO FIXTURES PRESENT', M + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(pdfSafe('Simulated repositories, products, and events are labelled in the body. They are not live search results and do not constitute verification.'), W - M * 2 - 8), M + 4, y + 11);
    y += 24;
  }

  // Cover: how to read the dossier + investigation snapshot so the first page is
  // informative rather than decorative.
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('How to read this report', M, y);
  y += 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 5.5;
  const howTo = [
    'Findings are separated into checked sources, official requirement text, team assertions, and derived analysis.',
    'Demo fixtures are labelled and excluded from every verification check.',
    'Passport checks are printed in full - failing checks are never hidden or averaged away.',
    'Missing information is reported as missing rather than inferred or filled in.',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  howTo.forEach((line) => {
    const wrapped = doc.splitTextToSize(pdfSafe(line), W - M * 2 - 6);
    doc.setFillColor(...FIELD);
    doc.circle(M + 1.4, y - 1.2, 0.7, 'F');
    doc.setTextColor(...INK);
    doc.text(wrapped, M + 5, y);
    y += wrapped.length * 4.4 + 1.2;
  });

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Investigation snapshot', M, y);
  y += 2;
  doc.line(M, y, W - M, y);
  y += 5;
  const snap = report.snapshot || {};
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: (snap.rows || []).map(([k, v]) => [pdfSafe(k), pdfSafe(v)]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 2.2, lineColor: LINE, lineWidth: 0.15, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: [241, 238, 229] }, 1: { cellWidth: W - M * 2 - 60 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  // Contents get their own page top; the body continues on the same page so no
  // page is left half empty.
  doc.addPage();
  y = M + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Contents', M, y);
  y += 2.4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  report.sections.forEach((s, i) => {
    if (y > 268) { doc.addPage(); y = M + 6; }
    doc.setTextColor(...MUTED);
    doc.setFont('courier', 'normal');
    doc.text(String(i + 1).padStart(2, '0'), M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    const label = pdfSafe(s.title);
    const maxLabelWidth = W - M * 2 - 16;
    const shown = doc.getTextWidth(label) > maxLabelWidth
      ? `${label.slice(0, Math.max(8, Math.floor(label.length * (maxLabelWidth / doc.getTextWidth(label))) - 2))}...`
      : label;
    doc.text(shown, M + 9, y);
    const start = M + 9 + doc.getTextWidth(shown) + 3;
    if (W - M - start > 4) {
      doc.setTextColor(...LINE);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(start, y - 1.2, W - M, y - 1.2);
    }
    y += 5.2;
  });

  /* ---------------- body ---------------- */
  y += 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y - 3, W - M, y - 3);
  y += 2;

  const ensure = (needed) => {
    if (y + needed > 279) { doc.addPage(); y = M + 2; }
  };

  const heading = (num, text) => {
    ensure(24);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...FIELD);
    doc.text(String(num).padStart(2, '0'), M, y + 1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.2);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(text), M + 9, y + 1);
    y += 4;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 6.5;
  };

  const paragraph = (text) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(pdfSafe(text), W - M * 2);
    lines.forEach((line) => { ensure(5); doc.text(line, M, y); y += 4.5; });
    y += 2;
  };

  const sub = (text) => {
    ensure(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...GREEN);
    doc.text(pdfSafe(text), M, y);
    y += 5.4;
  };

  const list = (items) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    items.forEach((item) => {
      const lines = doc.splitTextToSize(pdfSafe(item), W - M * 2 - 6);
      ensure(lines.length * 4.4 + 1);
      doc.setFillColor(...FIELD);
      doc.circle(M + 1.4, y - 1.2, 0.7, 'F');
      doc.setTextColor(...INK);
      doc.text(lines, M + 5, y);
      y += lines.length * 4.4 + 0.8;
    });
    y += 2;
  };

  const table = (block) => {
    ensure(16);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [block.head.map((h) => pdfSafe(h))],
      body: block.rows.length ? block.rows.map((r) => r.map((c) => pdfSafe(c))) : [['Not yet investigated']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 1.9, lineColor: LINE, lineWidth: 0.15, textColor: INK, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: SAGE, textColor: GREEN, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [250, 248, 242] },
      didParseCell: (data) => {
        if (data.section === 'body' && String(data.cell.raw).startsWith('DEMO')) {
          data.cell.styles.textColor = [143, 64, 37];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  };

  const kv = (rows) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      body: rows.map(([k, v]) => [pdfSafe(k), pdfSafe(v)]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.2, cellPadding: 2.2, lineColor: LINE, lineWidth: 0.15, overflow: 'linebreak', valign: 'top' },
      columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold', fillColor: [241, 238, 229] }, 1: { cellWidth: W - M * 2 - 44 } },
    });
    y = doc.lastAutoTable.finalY + 6;
  };

  const callout = (title, text) => {
    const lines = doc.splitTextToSize(pdfSafe(text), W - M * 2 - 10);
    const h = 9 + lines.length * 4.2;
    ensure(h + 4);
    doc.setDrawColor(...ORANGE);
    doc.setFillColor(248, 236, 229);
    doc.setLineWidth(0.5);
    doc.rect(M, y, W - M * 2, h, 'FD');
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(143, 64, 37);
    doc.text(pdfSafe(title).toUpperCase(), M + 4, y + 5.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(...INK);
    doc.text(lines, M + 4, y + 10);
    y += h + 6;
  };

  report.sections.forEach((section, idx) => {
    heading(idx + 1, section.title);
    section.blocks.forEach((b) => {
      if (b.type === 'p') paragraph(b.text);
      else if (b.type === 'sub') sub(b.text);
      else if (b.type === 'list') list(b.items);
      else if (b.type === 'table') table(b);
      else if (b.type === 'kv') kv(b.rows);
      else if (b.type === 'callout') callout(b.title, b.text);
    });
    y += 3;
  });

  /* ---------------- footer ---------------- */
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, 286, W - M, 286);
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(`BUILDSCOPE AI  /  ${pdfSafe(cover.caseId)}  /  ${pdfSafe(cover.date)}`, M, 290);
    const label = `PAGE ${i - 1} OF ${pages - 1}`;
    doc.text(label, W - M - doc.getTextWidth(label), 290);
    doc.text('Demo fixtures are not live verification. Unchecked fields remain unknown.', M, 293.4);
  }

  return doc;
}

export function downloadReport(report) {
  const doc = generateReportPdf(report);
  const name = options_filename(report);
  doc.save(name);
  return name;
}

function options_filename(report) {
  const slug = report.cover.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 48);
  return `BuildScope_${report.cover.caseId}_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

export { fmtDate };
