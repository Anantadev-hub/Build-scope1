import React, { useMemo, useRef, useState } from 'react';
import { FileText, Download, Printer, Eye, Trash2, ArrowRight, Check } from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  MissingCase, Btn, Card, Confirm, EmptyState, Notice, PageHead } from '../../components/ui';
import { REPORT_SECTIONS } from '../../lib/constants';
import { buildReport } from '../../lib/report';
import { downloadReport } from '../../lib/pdf';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { uid } from '../../lib/id';

function Block({ b }) {
  if (b.type === 'p') return <p>{b.text}</p>;
  if (b.type === 'sub') return <h3>{b.text}</h3>;
  if (b.type === 'list') return <ul>{b.items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
  if (b.type === 'kv') return (
    <table><tbody>{b.rows.map(([k, v], i) => <tr key={i}><th style={{ width: '32%' }}>{k}</th><td>{v}</td></tr>)}</tbody></table>
  );
  if (b.type === 'table') return (
    <table>
      <thead><tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>
        {b.rows.length ? b.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>) : <tr><td colSpan={b.head.length}>Not yet investigated.</td></tr>}
      </tbody>
    </table>
  );
  if (b.type === 'callout') return (
    <div style={{ border: '1px solid var(--amber)', background: '#f7ecd9', padding: '9px 11px', margin: '10px 0' }}>
      <div className="mono xs" style={{ letterSpacing: '.08em', color: '#79531f' }}>{b.title.toUpperCase()}</div>
      <div className="small" style={{ marginTop: 3 }}>{b.text}</div>
    </div>
  );
  return null;
}

function ReportPreview({ report }) {
  const { cover } = report;
  return (
    <article className="report-doc" id="report-preview" aria-label="Report preview">
      <div className="report-cover-rule" />
      <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="mono xs" style={{ letterSpacing: '.12em' }}>BUILDSCOPE AI · BUILDABILITY REPORT</div>
          <h1 style={{ marginTop: 6 }}>{cover.title}</h1>
          <div className="mono xs muted">CASE {cover.caseId} · REPORT v{cover.version} · {cover.date}</div>
        </div>
        <div className="passport-stamp" style={{ transform: 'rotate(-1.6deg)', fontSize: 9 }}>
          BUILDABILITY
          <strong>{cover.outcome}</strong>
        </div>
      </div>

      <div className="report-meta-grid">
        <div><b>Hackathon</b><br />{cover.hackathon || 'Not recorded'}</div>
        <div><b>Team size</b><br />{cover.teamSize || 'Unknown'}</div>
        <div><b>Data status</b><br />{cover.demoData ? 'Contains demo fixtures' : 'No demo fixtures'}</div>
      </div>

      {cover.demoData && (
        <div style={{ border: '1px dashed #c99a58', background: '#f7ecd9', padding: '8px 10px', fontSize: 11, color: '#66491f', marginBottom: 14 }}>
          <b>DEMO FIXTURES PRESENT.</b> Simulated repository, product, or event records are labelled in the body. They are not live search results
          and do not constitute verification.
        </div>
      )}

      <div className="mono xs muted" style={{ marginBottom: 10 }}>CONTENTS</div>
      <ol style={{ columns: 2, fontSize: 10.5, paddingLeft: 16, marginTop: 0 }}>
        {report.sections.map((s) => <li key={s.key}>{s.title}</li>)}
      </ol>

      {report.sections.map((s, i) => (
        <section key={s.key} style={{ marginTop: 18 }}>
          <div className="mono xs muted" style={{ letterSpacing: '.1em' }}>SECTION {String(i + 1).padStart(2, '0')}</div>
          <h2 style={{ borderBottom: '1px solid var(--ink)', marginTop: 2 }}>{s.title}</h2>
          {s.blocks.map((b, j) => <Block key={j} b={b} />)}
        </section>
      ))}

      <div className="mono xs muted" style={{ borderTop: '1px solid var(--line)', marginTop: 22, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>BUILDSCOPE AI · {cover.caseId}</span>
        <span>GENERATED {cover.date.toUpperCase()}</span>
      </div>
      <div className="xs muted" style={{ marginTop: 3 }}>
        Demo fixtures are not verification. Unchecked fields remain unknown. This report reflects saved project state, not a guarantee of success.
      </div>
    </article>
  );
}

export default function Reports() {
  const project = useRouteProject();
  const { state, actions, pushToast } = useApp();
  usePageTitle('Reports');
  const [selected, setSelected] = useState(() => REPORT_SECTIONS.map((s) => s.key));
  const [preview, setPreview] = useState(null);
  const [previewIsDraft, setPreviewIsDraft] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [savedFlash, setSavedFlash] = useState('');
  const previewRef = useRef(null);
  const p = project;

  const orderedSelected = useMemo(
    () => REPORT_SECTIONS.filter((s) => s.always || selected.includes(s.key)).map((s) => s.key),
    [selected],
  );

  if (!p) return <MissingCase />;

  const latest = p.reports[p.reports.length - 1];

  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const make = () => buildReport(p, state, orderedSelected, p.reports.length + 1);

  const handlePreview = () => {
    setPreview(make());
    setPreviewIsDraft(true);
    setPdfError('');
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const handleGenerate = () => {
    const report = make();
    const record = {
      id: uid('rpt'),
      version: report.cover.version,
      generatedAt: report.meta.generatedAt,
      sections: orderedSelected,
      outcome: report.meta.outcome,
      snapshot: report,
    };
    actions.updateProject(p.id, { reports: [...p.reports, record] }, `Buildability Report v${record.version} generated (${report.meta.outcome}).`);
    setPreview(report);
    setPreviewIsDraft(false);
    setPdfError('');
    setSavedFlash(`Report v${record.version} saved locally.`);
    pushToast(`Report v${record.version} generated. A report is not a readiness certificate.`);
    window.setTimeout(() => setSavedFlash(''), 6000);
  };

  const handleDownload = () => {
    if (!preview) return;
    setBusy(true);
    setPdfError('');
    try {
      const name = downloadReport(preview);
      pushToast(`PDF downloaded: ${name}`);
    } catch (err) {
      setPdfError(err?.message || 'PDF generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const openSaved = (record) => {
    setPreview(record.snapshot);
    setPreviewIsDraft(false);
    setPdfError('');
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <div>
      <PageHead
        eyebrow="09 · Dossier export"
        title="Buildability Reports"
        description="Assemble the investigation into a reviewable dossier. The report is generated from saved project data; it never fills gaps with invented findings."
        actions={<>
          <Btn variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print</Btn>
          <Btn variant="primary" onClick={handleGenerate}><FileText size={14} /> Generate report</Btn>
        </>}
      />

      <div className="grid g-1-2 no-print" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card title="Sections" eyebrow="Choose what the dossier contains">
            <div className="stack-sm">
              {REPORT_SECTIONS.map((s) => (
                <label key={s.key} className="check" style={{ opacity: s.always ? 0.85 : 1 }}>
                  <input
                    type="checkbox"
                    checked={s.always || selected.includes(s.key)}
                    disabled={s.always}
                    onChange={() => toggle(s.key)}
                  />
                  <span className="small">{s.label}{s.always && <span className="mono xs muted"> · required</span>}</span>
                </label>
              ))}
            </div>
            <div className="line" />
            <div className="row" style={{ gap: 6 }}>
              <Btn variant="ghost" size="sm" onClick={() => setSelected(REPORT_SECTIONS.map((s) => s.key))}>Select all</Btn>
              <Btn variant="ghost" size="sm" onClick={() => setSelected(REPORT_SECTIONS.filter((s) => s.always).map((s) => s.key))}>Minimum</Btn>
            </div>
          </Card>

          <Card title="Export" eyebrow="Actual PDF, selectable text">
            <p className="small muted">
              The PDF is generated locally with jsPDF from this case&apos;s saved data: cover page, section tables, source URLs, dates,
              page numbers, and a data-status footer. Long tables break across pages.
            </p>
            <div className="row">
              <Btn variant="ghost" onClick={handlePreview}><Eye size={13} /> Preview</Btn>
              <Btn variant="primary" onClick={handleDownload} disabled={!preview || busy}><Download size={13} /> {busy ? 'Building PDF…' : 'Download PDF'}</Btn>
            </div>
            {!preview && <div className="xs muted mt8">Preview or generate a report to enable download.</div>}
            {previewIsDraft && <div className="xs mt8" style={{ color: 'var(--orange)' }}>Preview is not saved. Generate the report to keep this version.</div>}
            {pdfError && (
              <div className="mt12">
                <Notice tone="danger">
                  <b>PDF generation failed.</b> {pdfError}
                  <div className="mt8">The preview is still valid — use <b>Print</b> to produce a print-friendly HTML version instead.</div>
                  <Btn variant="ghost" size="sm" className="mt8" onClick={() => window.print()}><Printer size={12} /> Print preview</Btn>
                </Notice>
              </div>
            )}
            <p className="xs muted mt12 mb0">
              Filename pattern: BuildScope_CASE_project_date.pdf. Nothing is uploaded; the file is created in your browser.
            </p>
          </Card>

          <Card title={`Saved reports (${p.reports.length})`} eyebrow="Local versions">
            {p.reports.length === 0 ? (
              <p className="small muted mb0">No reports yet. Generated versions are stored locally with their section selection and outcome.</p>
            ) : (
              <div className="stack-sm">
                {[...p.reports].reverse().map((r) => (
                  <div key={r.id} className="spread" style={{ alignItems: 'flex-start', gap: 8, borderBottom: '1px dashed var(--line-soft)', paddingBottom: 8 }}>
                    <div>
                      <div className="row" style={{ gap: 5 }}>
                        <span className="mono xs strong">v{r.version}</span>
                        <span className={`badge ${r.outcome === 'READY TO BUILD' ? 'green' : r.outcome === 'READY WITH CONDITIONS' ? 'sage' : r.outcome === 'SCOPE REDUCTION REQUIRED' ? 'amber' : r.outcome === 'BLOCKED — INVESTIGATE FIRST' ? 'red' : 'outline'}`}>{r.outcome}</span>
                      </div>
                      <div className="xs muted">{fmtDateTime(r.generatedAt)} · {r.sections.length} sections</div>
                    </div>
                    <div className="row nowrap" style={{ gap: 2 }}>
                      <Btn variant="quiet" size="xs" onClick={() => openSaved(r)} aria-label={`Preview report v${r.version}`}><Eye size={12} /></Btn>
                      <Btn variant="quiet" size="xs" onClick={() => { try { downloadReport(r.snapshot); pushToast(`PDF downloaded for report v${r.version}.`); } catch (err) { setPdfError(err?.message || 'PDF generation failed.'); } }} aria-label={`Download report v${r.version}`}><Download size={12} /></Btn>
                      <Btn variant="quiet" size="xs" onClick={() => setConfirmDelete(r)} aria-label={`Delete report v${r.version}`}><Trash2 size={12} /></Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div ref={previewRef}>
          <div className="spread mb8">
            <div className="eyebrow">Report preview</div>
            {preview && (
              <div className="row" style={{ gap: 6 }}>
                {previewIsDraft ? <span className="badge amber">UNSAVED PREVIEW</span> : <span className="badge sage">SAVED SNAPSHOT</span>}
                <Btn variant="quiet" size="xs" onClick={() => window.print()}><Printer size={12} /> Print</Btn>
              </div>
            )}
          </div>

          {savedFlash && <div className="mb8"><Notice tone="ok"><Check size={13} style={{ verticalAlign: -2 }} /> {savedFlash}</Notice></div>}

          {preview ? (
            <ReportPreview report={preview} />
          ) : (
            <div className="card">
              <EmptyState icon={FileText} title="No preview generated">
                Choose sections, then preview the dossier or generate a saved version. Both use the current project state; saved reports keep
                their original snapshot so later edits do not rewrite history.
              </EmptyState>
            </div>
          )}

          {latest && !preview && (
            <div className="card mt16 no-print">
              <div className="eyebrow">Last saved</div>
              <div className="spread mt8">
                <div>
                  <div className="strong">Version {latest.version} · {latest.outcome}</div>
                  <div className="xs muted">{fmtDate(latest.generatedAt)} · {latest.sections.length} sections</div>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => openSaved(latest)}>Open <ArrowRight size={12} /></Btn>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt16 no-print">
        <Notice tone="warn">
          <b>A generated report is not a verdict.</b> The passport outcome and every gap remain visible inside the dossier.
          Regenerate after material changes so the evidence and scope stay current.
        </Notice>
      </div>

      <Confirm
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          actions.updateProject(p.id, { reports: p.reports.filter((r) => r.id !== confirmDelete.id) }, `Report v${confirmDelete.version} deleted.`);
          if (preview && preview.cover.version === confirmDelete.version) { setPreview(null); }
          pushToast('Saved report removed from this case.');
        }}
        title={`Delete report v${confirmDelete?.version}?`}
        confirmLabel="Delete report"
        danger
      >
        <p>The saved snapshot will be removed from this browser. The project data and evidence are not affected.</p>
      </Confirm>
    </div>
  );
}
