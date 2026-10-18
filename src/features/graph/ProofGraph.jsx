import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network, Plus, Trash2, Link2, Layers, Target, FileText,
  ClipboardCheck, CheckCircle2, ZoomIn, ZoomOut, Unlink, ExternalLink as ExtIcon, Info,
} from 'lucide-react';
import { useApp } from '../../app/store';
import { useRouteProject, usePageTitle } from '../../app/hooks';
import {
  Btn, Card, Confirm, EmptyState, ExternalLink, Kpi, Modal, Notice, PageHead, SegTabs, StatusBadge,
} from '../../components/ui';
import { PROOF_KINDS, PROOF_KIND_MAP, TEST_RESULTS, TEST_METHODS } from '../../lib/constants';
import { proofNode, proofLink, testRecord } from '../../lib/models';
import {
  adjacent, buildChains, createsCycle, kindMeta, nextKind, suggestNext, traceSummary, LAYOUT, layoutGraph,
} from '../../lib/graph';
import { MissingCase } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { nowIso } from '../../lib/id';

const KIND_ICON = { need: Target, evidence: FileText, requirement: ClipboardCheck, implementation: Layers, test: CheckCircle2 };

// Auto-mapping is restricted to records that genuinely exist. Implementation
// nodes are never generated: BuildScope cannot see anyone's code.
export function mappableRecords(project) {
  const out = [];
  project.scope.filter((s) => s.bucket === 'must').forEach((s) => out.push({
    kind: 'need', refType: 'scope', refId: s.id, title: s.name, detail: `Must-build scope item, estimated ${s.hours || 0}h.`,
  }));
  project.features.filter((f) => f.essential).forEach((f) => out.push({
    kind: 'need', refType: 'feature', refId: f.id, title: f.name, detail: f.description || 'Essential feature from the brief.',
  }));
  project.evidence.forEach((e) => out.push({
    kind: 'evidence', refType: 'evidence', refId: e.id, title: e.sourceName || e.title || 'Untitled source',
    detail: `${e.kind} · ${e.verification === 'verified' ? 'marked checked by the team' : 'not independently checked'}${e.demo ? ' · DEMO FIXTURE' : ''}`,
  }));
  project.requirements.forEach((r) => out.push({
    kind: 'requirement', refType: 'requirement', refId: r.id, title: r.text.slice(0, 90), detail: r.source || 'Source not recorded',
  }));
  project.tests.forEach((t) => out.push({
    kind: 'test', refType: 'test', refId: t.id, title: t.title, detail: `${TEST_RESULTS[t.result]?.label || t.result} · recorded by hand`,
  }));
  return out;
}

const REF_ROUTES = {
  evidence: 'prior-art',
  requirement: 'requirements',
  scope: 'feasibility',
  feature: 'edit',
  test: 'assurance',
  claim: 'differentiation',
  criterion: 'feasibility',
};

const ZOOMS = [0.6, 0.8, 1];

export default function ProofGraph() {
  const project = useRouteProject();
  const { actions, pushToast } = useApp();
  const navigate = useNavigate();
  usePageTitle('Opportunity to proof');
  const [view, setView] = useState('diagram');
  const [zoomIdx, setZoomIdx] = useState(2);
  const [selectedId, setSelectedId] = useState(null);
  const [editor, setEditor] = useState(null); // { mode, node }
  const [linker, setLinker] = useState(null); // { from }
  const [mapper, setMapper] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const summary = useMemo(() => (project ? traceSummary(project) : null), [project]);
  const graph = useMemo(() => (project ? layoutGraph(project, ZOOMS[zoomIdx]) : null), [project, zoomIdx]);
  const chains = useMemo(() => (project ? buildChains(project) : []), [project]);

  if (!project) return <MissingCase />;

  const selected = project.proofNodes.find((n) => n.id === selectedId) || null;
  const nodesById = new Map(project.proofNodes.map((n) => [n.id, n]));

  const saveNode = (draft, existing) => {
    if (existing) {
      actions.updateItem('proofNodes', existing.id, draft, `Traceability node updated: ${draft.title}`);
      pushToast('Node updated.');
    } else {
      const node = proofNode(draft);
      actions.addItem('proofNodes', node, `Traceability node recorded: ${node.title}`);
      setSelectedId(node.id);
      pushToast(`${kindMeta(node.kind).label} node recorded.`);
      if (draft.linkFrom) {
        const link = proofLink({ from: draft.linkFrom, to: node.id });
        actions.addItem('proofLinks', link);
      }
    }
    setEditor(null);
  };

  const addLink = (from, to) => {
    if (createsCycle(project, from, to)) {
      pushToast('That link would create a loop. Chains must run need → evidence → requirement → implementation → test.');
      return;
    }
    const existing = project.proofLinks.find((l) => l.from === from && l.to === to);
    if (existing) {
      pushToast('Those nodes are already linked.');
      return;
    }
    actions.addItem('proofLinks', proofLink({ from, to }), `Traceability link added: ${nodesById.get(from)?.title} → ${nodesById.get(to)?.title}`);
    setLinker(null);
  };

  const extend = (node, kind) => {
    const draft = { kind, title: '', detail: '' };
    setEditor({ mode: 'create', node: draft, linkFrom: node.id, fromTitle: node.title });
  };

  const mapRecords = () => {
    const existingRefs = new Set(project.proofNodes.filter((n) => n.refId).map((n) => `${n.kind}:${n.refId}`));
    const candidates = mappableRecords(project).filter((c) => !existingRefs.has(`${c.kind}:${c.refId}`));
    if (!candidates.length) {
      pushToast('Every mappable record already has a node.');
      setMapper(false);
      return;
    }
    const items = candidates.map((c) => proofNode({
      kind: c.kind, title: c.title, detail: c.detail, refType: c.refType, refId: c.refId,
    }));
    actions.addItems('proofNodes', items, `Mapped ${items.length} saved record(s) into the traceability graph`);
    // Links are only created where two saved records explicitly cite each other.
    // Nothing here guesses that two records are related.
    const reqByRef = new Map(items.filter((n) => n.kind === 'requirement').map((n) => [n.refId, n]));
    const links = [];
    project.evidence.forEach((e) => {
      const evNode = items.find((n) => n.kind === 'evidence' && n.refId === e.id);
      const req = project.requirements.find((r) => r.evidence === e.claim);
      const reqNode = req ? reqByRef.get(req.id) : null;
      if (evNode && reqNode) links.push(proofLink({ from: evNode.id, to: reqNode.id, note: 'Linked because the requirement cites the same evidence claim.' }));
    });
    if (links.length) actions.addItems('proofLinks', links, `Added ${links.length} link(s) where records explicitly cite each other`);
    pushToast(`Mapped ${items.length} record(s). Links still need your review.`);
    setMapper(false);
  };

  const seedStarterChain = () => {
    const n1 = proofNode({ kind: 'need', title: project.features[0]?.name || `${project.name} core need`, detail: 'Starter node — describe the need in your own words.' });
    const n2 = proofNode({ kind: 'test', title: 'Nothing tested yet', detail: 'Replace this with a real test record once the implementation exists.' });
    actions.addItems('proofNodes', [n1, n2], 'Starter traceability chain created');
    actions.addItems('proofLinks', [proofLink({ from: n1.id, to: n2.id, note: 'Placeholder link — stages in between still need recording.' })]);
    setSelectedId(n1.id);
    pushToast('Starter chain added. Fill in the stages you actually have.');
  };

  const counts = summary.counts;
  const demoOnlyTests = project.tests.length > 0 && project.tests.every((t) => t.demo || t.seeded);

  return (
    <>
      <PageHead
        eyebrow={`Mission 04 · Prove the demo · ${project.caseId}`}
        title="Opportunity to proof"
        description="Trace each need through evidence, requirement, implementation, and a recorded test result. A chain is only as strong as its weakest recorded stage."
        actions={(
          <div className="row wrap">
            <Btn variant="ghost" onClick={() => setMapper(true)}><ClipboardCheck size={14} aria-hidden="true" /> Map saved records</Btn>
            <Btn variant="primary" onClick={() => setEditor({ mode: 'create', node: { kind: 'need', title: '', detail: '' } })}>
              <Plus size={14} aria-hidden="true" /> Add node
            </Btn>
          </div>
        )}
      />

      <div className="mb16">
        <Notice tone="warn">
          <b>This diagram records your own traceability, not independent verification.</b> Nodes and links are
          typed in by the team, tests are run and reported by hand, and BuildScope cannot read your code, your
          CI, or anyone else’s repository. A complete chain proves you have a documented argument — not that
          the software was externally validated.
        </Notice>
      </div>

      <div className="g4 grid mb16">
        <Kpi label="Needs traced" value={counts.need} sub={`${summary.completeChains} of ${counts.need} complete chains`} />
        <Kpi label="Nodes / links" value={`${summary.nodeCount}/${summary.linkCount}`} sub={`${counts.need}N · ${counts.evidence}E · ${counts.requirement}R · ${counts.implementation}I · ${counts.test}T`} />
        <Kpi
          label="Test results recorded"
          value={summary.observedChains}
          sub={`${summary.passed} passed · ${summary.failed} failed · ${summary.notRun} not run${demoOnlyTests ? ' · all demo fixtures' : ''}`}
        />
        <Kpi label="Unlinked nodes" value={summary.orphans.length} sub={summary.danglingLinks ? `${summary.danglingLinks} broken link(s)` : 'no broken links'} />
      </div>

      {summary.danglingLinks > 0 && (
        <div className="mb16">
          <Notice tone="danger">
            {summary.danglingLinks} link(s) point at a node that no longer exists. Deleting a node should remove
            its links — reload to clear stale references, then re-link the chain.
          </Notice>
        </div>
      )}

      <div className="row between mb12 wrap">
        <SegTabs
          value={view}
          onChange={setView}
          label="Traceability view"
          options={[
            { value: 'diagram', label: 'Diagram' },
            { value: 'chains', label: 'Traceability table', count: chains.length },
            { value: 'nodes', label: 'Node register', count: project.proofNodes.length },
          ]}
        />
        {view === 'diagram' && project.proofNodes.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <Btn variant="ghost" size="sm" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} aria-label="Zoom out">
              <ZoomOut size={13} aria-hidden="true" />
            </Btn>
            <span className="mono xs muted">{Math.round(ZOOMS[zoomIdx] * 100)}%</span>
            <Btn variant="ghost" size="sm" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Zoom in">
              <ZoomIn size={13} aria-hidden="true" />
            </Btn>
          </div>
        )}
      </div>

      {project.proofNodes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Network}
            title="No traceability recorded yet"
            action={(
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <Btn variant="primary" onClick={seedStarterChain}>Add a starter chain</Btn>
                <Btn variant="ghost" onClick={() => setMapper(true)}>Map saved records</Btn>
              </div>
            )}
          >
            A chain runs <b>need → evidence → requirement → implementation → test result</b>. Record only the
            stages you actually have; a missing stage is information, not a gap to hide.
          </EmptyState>
        </Card>
      ) : (
        // The diagram and the wide matrices need the full column width; the
        // selection panel only takes a side column once a node is open.
        <div className={view === 'diagram' || !selected ? 'stack' : 'g-2-1 grid'}>
          <div>
            {view === 'diagram' && (
              <Card
                title="Traceability diagram"
                eyebrow="Derived from saved nodes and links"
                actions={<span className="mono xs muted">{summary.nodeCount} nodes · {summary.linkCount} links</span>}
              >
                <div className="graph-scroll">
                  <div className="graph-canvas" style={{ width: graph.width, height: graph.height + 40 }}>
                    <div className="graph-head" style={{ height: 40 }}>
                      {PROOF_KINDS.map((k, i) => (
                        <div key={k.key} className="graph-col-head" style={{ left: (LAYOUT.padX + i * (LAYOUT.colWidth + LAYOUT.gapX)) * graph.scale, width: LAYOUT.colWidth * graph.scale }}>
                          <span className="mono">{k.code}</span> {k.label}
                          <span className="n">{counts[k.key]}</span>
                        </div>
                      ))}
                    </div>
                    <svg className="graph-edges" width={graph.width} height={graph.height + 40} aria-hidden="true">
                      {graph.edges.map((e) => (
                        <g key={e.id} className={e.backwards ? 'back' : ''}>
                          <path d={e.d} />
                          <circle cx={e.mid.x} cy={e.mid.y} r="2.5" />
                        </g>
                      ))}
                    </svg>
                    {project.proofNodes.map((n) => {
                      const pos = graph.positions.get(n.id);
                      if (!pos) return null;
                      const meta = kindMeta(n.kind);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={`graph-node kind-${n.kind} ${selectedId === n.id ? 'sel' : ''}`}
                          style={{
                            left: pos.x * graph.scale,
                            top: pos.y * graph.scale + 40,
                            width: LAYOUT.nodeWidth * graph.scale,
                            height: LAYOUT.nodeHeight * graph.scale,
                            fontSize: 12 * graph.scale,
                          }}
                          onClick={() => setSelectedId(n.id)}
                          aria-pressed={selectedId === n.id}
                        >
                          <span className="gn-top">
                            <span className="gn-kind mono">{meta.code} · {meta.label.toUpperCase()}</span>
                            {n.demo || n.seeded ? <span className="badge demo">DEMO</span> : null}
                          </span>
                          <span className="gn-title">{n.title || 'Untitled node'}</span>
                          {n.refId && <span className="gn-ref mono">{n.refType || 'record'} · linked</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="mono xs muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  Read left to right. A dashed edge means the link runs backwards through the stages — usually a
                  sign the chain needs re-recording.
                </p>
              </Card>
            )}

            {view === 'chains' && <ChainTable project={project} chains={chains} onExtend={extend} onSelect={setSelectedId} navigate={navigate} />}
            {view === 'nodes' && <NodeRegister project={project} onSelect={setSelectedId} onDelete={setConfirmDelete} />}
          </div>

          <div className={view === 'diagram' ? 'g2 grid' : 'stack'}>
            <NodeDetail
              project={project}
              node={selected}
              nodesById={nodesById}
              navigate={navigate}
              onEdit={(n) => setEditor({ mode: 'edit', node: n })}
              onDelete={(n) => setConfirmDelete(n)}
              onLink={(from) => setLinker({ from })}
              onUnlink={(linkId) => {
                const link = project.proofLinks.find((l) => l.id === linkId);
                actions.removeItem('proofLinks', linkId, `Traceability link removed: ${nodesById.get(link?.from)?.title} → ${nodesById.get(link?.to)?.title}`);
              }}
              onExtend={extend}
              onCreateTest={(node) => {
                const rec = testRecord({ title: `Test for: ${node.title}`, proofNodeId: node.id, ranAt: nowIso() });
                actions.addItem('tests', rec, `Test record started for ${node.title}`);
                pushToast('Test record created in the Assurance tracker.');
                navigate('/projects/' + project.id + '/assurance');
              }}
            />
            <Card title="How to keep this honest" eyebrow="Reading rules">
              <ul className="small muted" style={{ paddingLeft: 16, marginBottom: 0 }}>
                <li>A node is what you recorded. It is not proof until a test result says what happened.</li>
                <li>“Passed” means your own run behaved as expected. Nothing was re-run for you.</li>
                <li>Evidence nodes stay separate from demo fixtures, which are labelled and never counted as proof.</li>
                <li>If a stage is unknown, leave it missing. An empty stage tells the truth; a guessed one does not.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      <NodeEditor
        open={Boolean(editor)}
        editor={editor}
        project={project}
        onClose={() => setEditor(null)}
        onSave={saveNode}
      />

      <MapModal open={mapper} onClose={() => setMapper(false)} project={project} onConfirm={mapRecords} />

      <LinkModal
        open={Boolean(linker)}
        linker={linker}
        project={project}
        onClose={() => setLinker(null)}
        onConfirm={addLink}
      />

      <Confirm
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          actions.removeNode(confirmDelete.id, `Traceability node removed: ${confirmDelete.title}`);
          if (selectedId === confirmDelete.id) setSelectedId(null);
        }}
        title="Delete this node?"
        confirmLabel="Delete node"
        danger
      >
        <p className="small">
          <b>{confirmDelete?.title || 'This node'}</b> and every link connected to it will be removed from this
          project. The record it points at — evidence, requirement, or test — stays untouched.
        </p>
      </Confirm>
    </>
  );
}

function ChainTable({ project, chains, onExtend, onSelect, navigate }) {
  const scrollRef = useRef(null);
  const [scrolls, setScrolls] = useState(false);

  // The hint is only shown when the matrix really overflows; at wide widths all
  // five stages fit and a "scroll" prompt would be noise.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chains.length]);

  if (!chains.length) {
    return (
      <Card>
        <EmptyState icon={Network} title="No need has been recorded yet">
          Traceability starts with a need. Add one to begin mapping proof for it.
        </EmptyState>
      </Card>
    );
  }
  return (
    <Card
      title="Need-to-proof chains"
      eyebrow="One row per recorded need"
      actions={scrolls ? <span className="mono xs muted">Scroll for all five stages →</span> : null}
      flush
    >
      <div className="scroll-x" ref={scrollRef}>
        <table className="table">
          <caption className="sr-only">Traceability chains from need to test result</caption>
          <thead>
            <tr>
              <th scope="col">Need</th>
              {PROOF_KINDS.slice(1).map((k) => <th key={k.key} scope="col">{k.label}</th>)}
              <th scope="col">Test outcome</th>
              <th scope="col">Next gap</th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => {
              const missingKind = c.missing[0] || null;
              return (
                <tr key={c.id}>
                  <td>
                    <button type="button" className="btn link" onClick={() => onSelect(c.need.id)}>{c.need.title || 'Untitled need'}</button>
                    {c.need.demo || c.need.seeded ? <span className="badge demo" style={{ marginLeft: 6 }}>DEMO</span> : null}
                  </td>
                  {c.stages.slice(1).map((s) => (
                    <td key={s.kind}>
                      {s.node ? (
                        <>
                          <button type="button" className="btn link" onClick={() => onSelect(s.node.id)}>{s.node.title || 'Untitled'}</button>
                          {s.ambiguous && <span className="badge outline" style={{ marginLeft: 5 }}>{s.candidates} candidates</span>}
                        </>
                      ) : <span className="muted small">not recorded</span>}
                    </td>
                  ))}
                  <td>
                    {c.record
                      ? <StatusBadge meta={TEST_RESULTS[c.record.result]} />
                      : <span className="muted small">no test result</span>}
                  </td>
                  <td>
                    {missingKind ? (
                      <Btn variant="ghost" size="xs" onClick={() => onExtend(c.stages.filter((s) => s.node).slice(-1)[0]?.node || c.need, missingKind)}>
                        Add {kindMeta(missingKind).label.toLowerCase()}
                      </Btn>
                    ) : <span className="badge sage">All five stages recorded</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ padding: '10px 14px 0', marginBottom: 0 }}>
        A complete row means every stage has a record — not that the outcome is positive. Read the test outcome
        column before treating a chain as proof. Regenerate the report after changing anything here.
      </p>
    </Card>
  );
}

function NodeRegister({ project, onSelect, onDelete }) {
  if (!project.proofNodes.length) return null;
  return (
    <Card title="Node register" eyebrow="Every recorded node" flush>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Title</th>
              <th scope="col">Linked record</th>
              <th scope="col">Links</th>
              <th scope="col">Recorded</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {project.proofNodes.map((n) => {
              const { out, in: inbound } = adjacent(project, n.id);
              const meta = kindMeta(n.kind);
              return (
                <tr key={n.id}>
                  <td><span className="badge outline">{meta.code} · {meta.label}</span></td>
                  <td>
                    <button type="button" className="btn link" onClick={() => onSelect(n.id)}>{n.title || 'Untitled node'}</button>
                    {n.demo || n.seeded ? <span className="badge demo" style={{ marginLeft: 6 }}>DEMO</span> : null}
                  </td>
                  <td className="small muted">{n.refId ? `${n.refType || 'record'} · ${String(n.refId).slice(0, 14)}` : 'not linked'}</td>
                  <td className="small">{out.length} out · {inbound.length} in</td>
                  <td className="small muted">{fmtDate(n.createdAt)}</td>
                  <td>
                    <div className="row nowrap actions-cell" style={{ gap: 4 }}>
                      <Btn variant="quiet" size="xs" onClick={() => onSelect(n.id)}>Open</Btn>
                      <Btn variant="quiet" size="xs" onClick={() => onDelete(n)} aria-label={`Delete ${n.title || 'node'}`}><Trash2 size={12} aria-hidden="true" /></Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NodeDetail({ project, node, nodesById, navigate, onEdit, onDelete, onLink, onUnlink, onExtend, onCreateTest }) {
  if (!node) {
    return (
      <Card title="Node detail" eyebrow="Selection">
        <p className="small muted" style={{ marginBottom: 0 }}>
          Select a node in the diagram or the table to see what it is linked to, and to extend the chain.
        </p>
      </Card>
    );
  }
  const meta = kindMeta(node.kind);
  const { out, in: inbound } = adjacent(project, node.id);
  const forward = suggestNext(project, node);
  const refRoute = node.refId ? REF_ROUTES[node.refType] : null;

  return (
    <Card
      title={meta.label}
      eyebrow={`Node ${meta.code} · ${fmtDate(node.createdAt)}`}
      actions={(
        <div className="row" style={{ gap: 4 }}>
          <Btn variant="quiet" size="xs" onClick={() => onEdit(node)}>Edit</Btn>
          <Btn variant="quiet" size="xs" onClick={() => onDelete(node)} aria-label="Delete node"><Trash2 size={12} aria-hidden="true" /></Btn>
        </div>
      )}
    >
      <h4 style={{ fontSize: 15, marginBottom: 4 }}>{node.title || 'Untitled node'}</h4>
      {node.demo || node.seeded ? <span className="badge demo">DEMO</span> : null}
      {node.detail && <p className="small muted">{node.detail}</p>}

      {node.refId && (
        <div className="evidence-strip mb12">
          <div className="eyebrow plain">Linked project record</div>
          <div className="small">{node.refType || 'record'} <span className="mono xs muted">{String(node.refId).slice(0, 18)}</span></div>
          {refRoute && (
            <button
              type="button"
              className="btn link small"
              onClick={() => navigate(`/projects/${project.id}/${refRoute}${node.refType === 'scope' || node.refType === 'criterion' ? '?tab=scope' : ''}`)}
            >
              Open in {refRoute.replace('-', ' ')} <ExtIcon size={11} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <hr style={{ margin: '14px 0' }} />

      <div className="eyebrow plain">Outgoing ({out.length})</div>
      {out.length === 0 && <p className="small muted">Nothing downstream yet.</p>}
      <ul className="link-list">
        {out.map((id) => (
          <li key={id}>
            <Link2 size={12} aria-hidden="true" />
            <span>{nodesById.get(id)?.title || 'removed node'}</span>
            <button
              type="button"
              className="btn quiet xs"
              aria-label={`Remove link to ${nodesById.get(id)?.title || 'removed node'}`}
              onClick={() => {
                const link = project.proofLinks.find((l) => l.from === node.id && l.to === id);
                if (link) onUnlink(link.id);
              }}
            >
              <Unlink size={11} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="eyebrow plain" style={{ marginTop: 12 }}>Incoming ({inbound.length})</div>
      {inbound.length === 0 && <p className="small muted">Nothing feeds into this node.</p>}
      <ul className="link-list">
        {inbound.map((id) => (
          <li key={id}>
            <Link2 size={12} aria-hidden="true" />
            <span>{nodesById.get(id)?.title || 'removed node'}</span>
            <button
              type="button"
              className="btn quiet xs"
              aria-label={`Remove link from ${nodesById.get(id)?.title || 'removed node'}`}
              onClick={() => {
                const link = project.proofLinks.find((l) => l.from === id && l.to === node.id);
                if (link) onUnlink(link.id);
              }}
            >
              <Unlink size={11} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="row wrap mt12" style={{ gap: 6 }}>
        <Btn variant="ghost" size="sm" onClick={() => onLink(node.id)}><Link2 size={13} aria-hidden="true" /> Link to existing node</Btn>
        {forward && (
          <Btn variant="primary" size="sm" onClick={() => onExtend(node, forward)}>
            <Plus size={13} aria-hidden="true" /> Add {kindMeta(forward).label.toLowerCase()}
          </Btn>
        )}
        {node.kind === 'implementation' && (
          <Btn variant="ghost" size="sm" onClick={() => onCreateTest(node)}>Record a test</Btn>
        )}
      </div>

      {node.kind === 'test' && (
        <p className="mono xs muted" style={{ marginTop: 10, marginBottom: 0 }}>
          <Info size={11} style={{ verticalAlign: -1 }} /> TEST OUTCOMES LIVE IN THE ASSURANCE TRACKER, NOT HERE.
        </p>
      )}
    </Card>
  );
}

function NodeEditor({ open, editor, project, onClose, onSave }) {
  const [draft, setDraft] = useState({ kind: 'need', title: '', detail: '', refType: '', refId: '' });
  const [error, setError] = useState('');

  // Reset the draft whenever a different node is opened for editing.
  React.useEffect(() => {
    if (!open || !editor) return;
    setDraft({
      kind: editor.node?.kind || 'need',
      title: editor.node?.title || '',
      detail: editor.node?.detail || '',
      refType: editor.node?.refType || '',
      refId: editor.node?.refId || '',
    });
    setError('');
  }, [open, editor]);

  if (!open || !editor) return null;
  const existing = editor.mode === 'edit' ? editor.node : null;
  const options = recordOptions(project, draft.kind);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Give the node a title so the chain reads clearly.');
      return;
    }
    if (draft.refId && !draft.refType) {
      setError('Choose which kind of record you are linking to.');
      return;
    }
    onSave({ ...draft, title: draft.title.trim(), linkFrom: editor.linkFrom || '' }, existing);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit traceability node' : `Add ${kindMeta(draft.kind).label.toLowerCase()} node`}
      eyebrow={editor.mode === 'edit' ? `Node ${kindMeta(draft.kind).code}` : editor.fromTitle ? `Linked from: ${editor.fromTitle}` : 'New node'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={submit}>{existing ? 'Save node' : 'Add node'}</Btn></>}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pn-kind">Stage</label>
            <select id="pn-kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {PROOF_KINDS.map((k) => <option key={k.key} value={k.key}>{k.code} · {k.label}</option>)}
            </select>
            <span className="hint">{kindMeta(draft.kind).hint}</span>
          </div>
          <div className="field span2">
            <label htmlFor="pn-title">Title<span className="req" aria-hidden="true">*</span></label>
            <input id="pn-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="One clear statement" />
          </div>
          <div className="field span2">
            <label htmlFor="pn-detail">Detail</label>
            <textarea id="pn-detail" rows={3} value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="What this stage actually is, and what it does not cover." />
          </div>
          <div className="field">
            <label htmlFor="pn-ref-type">Link a saved record</label>
            <select id="pn-ref-type" value={draft.refType} onChange={(e) => setDraft({ ...draft, refType: e.target.value, refId: '' })}>
              <option value="">No record linked</option>
              {RECORD_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pn-ref-id">Record</label>
            <select id="pn-ref-id" value={draft.refId} onChange={(e) => setDraft({ ...draft, refId: e.target.value })} disabled={!draft.refType}>
              <option value="">{draft.refType ? 'Choose a record' : 'Choose a record type first'}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <span className="hint">Linking keeps the node tied to the actual saved record, not a copy of its text.</span>
          </div>
        </div>
        {draft.kind === 'implementation' && (
          <Notice>
            Implementation nodes are typed by hand. BuildScope cannot see your code, so it will never mark one as
            verified.
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}

const RECORD_TYPES = [
  { type: 'evidence', label: 'Evidence source' },
  { type: 'requirement', label: 'Official requirement' },
  { type: 'scope', label: 'Scope item' },
  { type: 'feature', label: 'Brief feature' },
  { type: 'claim', label: 'Differentiation claim' },
  { type: 'criterion', label: 'Acceptance criterion' },
  { type: 'test', label: 'Test record' },
];

function recordOptions(project, type) {
  switch (type) {
    case 'evidence': return project.evidence.map((e) => ({ id: e.id, label: `${e.sourceName || e.title || 'Untitled'}${e.demo ? ' [DEMO]' : ''}` }));
    case 'requirement': return project.requirements.map((r) => ({ id: r.id, label: r.text.slice(0, 70) }));
    case 'scope': return project.scope.map((s) => ({ id: s.id, label: `${s.name} (${s.bucket})` }));
    case 'feature': return project.features.map((f) => ({ id: f.id, label: f.name }));
    case 'claim': return project.claims.map((c) => ({ id: c.id, label: c.claim.slice(0, 70) }));
    case 'criterion': return project.acceptance.map((a) => ({ id: a.id, label: a.title }));
    case 'test': return project.tests.map((t) => ({ id: t.id, label: `${t.title} (${TEST_RESULTS[t.result]?.label || t.result})` }));
    default: return [];
  }
}

function MapModal({ open, onClose, project, onConfirm }) {
  if (!open) return null;
  const candidates = mappableRecords(project);
  const existingRefs = new Set(project.proofNodes.filter((n) => n.refId).map((n) => `${n.kind}:${n.refId}`));
  const fresh = candidates.filter((c) => !existingRefs.has(`${c.kind}:${c.refId}`));
  const grouped = PROOF_KINDS.map((k) => ({ kind: k, items: fresh.filter((c) => c.kind === k.key) })).filter((g) => g.items.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Map saved records into the graph"
      eyebrow="Records already in this case"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={onConfirm} disabled={!fresh.length}>Add {fresh.length} node(s)</Btn></>}
    >
      <p className="small">
        BuildScope copies the title and provenance of records you already saved — it does not invent stages and
        does not create links unless two records explicitly cite each other.
      </p>
      {grouped.length === 0 && <Notice>Every mappable record already has a node in the graph.</Notice>}
      {grouped.map((g) => (
        <div key={g.kind.key} className="mb12">
          <div className="eyebrow plain">{g.kind.code} · {g.kind.label} ({g.items.length})</div>
          <ul className="small muted" style={{ paddingLeft: 16, marginBottom: 0 }}>
            {g.items.slice(0, 6).map((i) => <li key={`${i.kind}-${i.refId}`}>{i.title}{i.detail ? ` — ${i.detail}` : ''}</li>)}
            {g.items.length > 6 && <li>…and {g.items.length - 6} more</li>}
          </ul>
        </div>
      ))}
      <Notice>
        Implementation nodes are never generated here: only you know what was actually built. Add those by hand
        once the code exists.
      </Notice>
    </Modal>
  );
}

function LinkModal({ open, linker, project, onClose, onConfirm }) {
  const [to, setTo] = useState('');
  React.useEffect(() => { if (open) setTo(''); }, [open]);
  if (!open || !linker) return null;
  const from = project.proofNodes.find((n) => n.id === linker.from);
  const options = project.proofNodes.filter((n) => n.id !== linker.from);
  const forward = nextKind(from?.kind);
  const ordered = [...options].sort((a, b) => {
    const rank = (n) => (n.kind === forward ? 0 : 1);
    return rank(a) - rank(b) || String(a.title).localeCompare(String(b.title));
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link to another node"
      eyebrow={`From: ${from?.title || 'node'}`}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={() => to && onConfirm(linker.from, to)} disabled={!to}>Add link</Btn></>}
    >
      <div className="field">
        <label htmlFor="link-target">Target node</label>
        <select id="link-target" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Choose a node</option>
          {ordered.map((n) => (
            <option key={n.id} value={n.id}>
              {kindMeta(n.kind).code} · {n.title || 'Untitled node'}{n.kind === forward ? ' (next stage)' : ''}
            </option>
          ))}
        </select>
        <span className="hint">
          Chains normally run forward: {PROOF_KINDS.map((k) => k.code).join(' → ')}. Linking backwards is allowed but
          flagged in the table.
        </span>
      </div>
    </Modal>
  );
}
