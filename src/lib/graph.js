// Opportunity-to-proof traceability.
//
// A chain runs Need -> Evidence -> Requirement -> Implementation -> Test result.
// Everything here is derived from the saved nodes, links, and test records; no
// stage is ever assumed. A chain is only "complete" when a human recorded a node
// for every stage, and a test result is only "observed" when a test record
// exists. Nothing in this module asserts external verification.
import { PROOF_KINDS } from './constants';
import { nowIso } from './id';

export function kindMeta(kind) {
  return PROOF_KINDS.find((k) => k.key === kind) || PROOF_KINDS[0];
}

export function nextKind(kind) {
  const i = PROOF_KINDS.findIndex((k) => k.key === kind);
  return i >= 0 && i < PROOF_KINDS.length - 1 ? PROOF_KINDS[i + 1].key : null;
}

export function prevKind(kind) {
  const i = PROOF_KINDS.findIndex((k) => k.key === kind);
  return i > 0 ? PROOF_KINDS[i - 1].key : null;
}

export function adjacent(project, id) {
  const out = new Set();
  const inc = new Set();
  project.proofLinks.forEach((l) => {
    if (l.from === id) out.add(l.to);
    if (l.to === id) inc.add(l.from);
  });
  return { out: [...out], in: [...inc] };
}

export function nodeTitle(project, id) {
  const node = project.proofNodes.find((n) => n.id === id);
  return node ? node.title || kindMeta(node.kind).label : 'removed node';
}

// Would adding from -> to create a cycle? Used to keep the diagram readable.
export function createsCycle(project, from, to) {
  if (from === to) return true;
  const adj = new Map();
  project.proofLinks.forEach((l) => {
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push(l.to);
  });
  const seen = new Set([to]);
  const queue = [to];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === from) return true;
    (adj.get(cur) || []).forEach((n) => {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    });
  }
  return false;
}

// A suggested next stage for a node, used by the "extend chain" actions.
export function suggestNext(project, node) {
  const forward = nextKind(node.kind);
  if (!forward) return null;
  const { out } = adjacent(project, node.id);
  if (out.some((id) => project.proofNodes.find((n) => n.id === id)?.kind === forward)) return null;
  return forward;
}

function reachable(project, startId) {
  const byId = new Map(project.proofNodes.map((n) => [n.id, n]));
  const adj = new Map();
  project.proofLinks.forEach((l) => {
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push(l.to);
  });
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    (adj.get(cur) || []).forEach((next) => {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    });
  }
  seen.delete(startId);
  return [...seen].map((id) => byId.get(id)).filter(Boolean);
}

// One chain per 'need' node. `missing` is the list of stages with no node yet,
// and `candidates` counts every reachable node per stage so ambiguity is visible
// instead of being silently resolved.
export function buildChains(project) {
  const needs = project.proofNodes.filter((n) => n.kind === 'need');
  const byId = new Map(project.proofNodes.map((n) => [n.id, n]));
  return needs.map((need) => {
    const reach = reachable(project, need.id);
    const stages = PROOF_KINDS.map((k) => {
      const matches = k.key === 'need' ? [need] : reach.filter((n) => n.kind === k.key);
      return {
        kind: k.key,
        node: matches[0] || null,
        candidates: matches.length,
        ambiguous: matches.length > 1,
      };
    });
    const missing = stages.filter((s) => !s.node).map((s) => s.kind);
    const testStage = stages.find((s) => s.kind === 'test');
    const record = testStage?.node
      ? project.tests.find((t) => t.proofNodeId === testStage.node.id) || null
      : null;
    return {
      id: need.id,
      need,
      stages,
      missing,
      complete: missing.length === 0,
      depth: stages.filter((s) => s.node).length,
      testNode: testStage?.node || null,
      record,
      observed: record ? record.result : null,
    };
  });
}

export function orphanNodes(project) {
  const referenced = new Set();
  project.proofLinks.forEach((l) => { referenced.add(l.from); referenced.add(l.to); });
  return project.proofNodes.filter((n) => !referenced.has(n.id) && n.kind !== 'need');
}

export function traceSummary(project) {
  const chains = buildChains(project);
  const counts = PROOF_KINDS.reduce((acc, k) => {
    acc[k.key] = project.proofNodes.filter((n) => n.kind === k.key).length;
    return acc;
  }, {});
  const tested = chains.filter((c) => c.record);
  return {
    chains,
    counts,
    nodeCount: project.proofNodes.length,
    linkCount: project.proofLinks.length,
    completeChains: chains.filter((c) => c.complete).length,
    orphans: orphanNodes(project),
    danglingLinks: project.proofLinks.filter((l) => !project.proofNodes.some((n) => n.id === l.from) || !project.proofNodes.some((n) => n.id === l.to)).length,
    observedChains: tested.length,
    passed: tested.filter((c) => c.record.result === 'passed').length,
    failed: tested.filter((c) => c.record.result === 'failed').length,
    partial: tested.filter((c) => c.record.result === 'partial').length,
    blocked: tested.filter((c) => c.record.result === 'blocked').length,
    notRun: tested.filter((c) => c.record.result === 'not-run').length,
  };
}

/* ---------------- diagram layout ---------------- */

// Deterministic geometry: five columns, one row per node. The same maths drives
// the edge paths, so nothing depends on measuring the DOM.
// Sized so all five columns fit a 1440px desktop without scrolling; narrower
// viewports scroll inside the card instead of pushing the page sideways.
export const LAYOUT = {
  colWidth: 204,
  nodeWidth: 180,
  nodeHeight: 92,
  gapX: 18,
  gapY: 18,
  padX: 16,
  padY: 44,
  headerHeight: 0,
};

export function layoutGraph(project, scale = 1) {
  const nodes = [...project.proofNodes].sort((a, b) => {
    const ka = PROOF_KINDS.findIndex((k) => k.key === a.kind);
    const kb = PROOF_KINDS.findIndex((k) => k.key === b.kind);
    if (ka !== kb) return ka - kb;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
  const rows = {};
  const positions = new Map();
  let maxRows = 1;
  nodes.forEach((n) => {
    const col = Math.max(0, PROOF_KINDS.findIndex((k) => k.key === n.kind));
    rows[col] = rows[col] || 0;
    const row = rows[col];
    rows[col] += 1;
    maxRows = Math.max(maxRows, row + 1);
    positions.set(n.id, {
      x: LAYOUT.padX + col * (LAYOUT.colWidth + LAYOUT.gapX),
      y: LAYOUT.padY + row * (LAYOUT.nodeHeight + LAYOUT.gapY),
      col,
      row,
    });
  });

  const width = LAYOUT.padX * 2 + PROOF_KINDS.length * LAYOUT.colWidth + (PROOF_KINDS.length - 1) * LAYOUT.gapX;
  const height = LAYOUT.padY * 2 + maxRows * LAYOUT.nodeHeight + (maxRows - 1) * LAYOUT.gapY;

  const edges = project.proofLinks.map((l) => {
    const a = positions.get(l.from);
    const b = positions.get(l.to);
    if (!a || !b) return null;
    const x1 = a.x + LAYOUT.nodeWidth;
    const y1 = a.y + LAYOUT.nodeHeight / 2;
    const x2 = b.x;
    const y2 = b.y + LAYOUT.nodeHeight / 2;
    const bend = Math.max(28, Math.abs(x2 - x1) * 0.45);
    return {
      id: l.id,
      from: l.from,
      to: l.to,
      backwards: x2 <= x1,
      d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
    };
  }).filter(Boolean);

  return { positions, edges, width: width * scale, height: height * scale, rawWidth: width, rawHeight: height, scale };
}

// Hop count along links, used to describe how a node is connected to a need.
export function distanceBetween(project, fromId, toId) {
  if (fromId === toId) return 0;
  const adj = new Map();
  project.proofLinks.forEach((l) => {
    if (!adj.has(l.from)) adj.set(l.from, []);
    adj.get(l.from).push(l.to);
  });
  const seen = new Set([fromId]);
  let frontier = [fromId];
  let hops = 0;
  while (frontier.length) {
    hops += 1;
    const next = [];
    frontier.forEach((cur) => {
      (adj.get(cur) || []).forEach((n) => {
        if (seen.has(n)) return;
        seen.add(n);
        next.push(n);
      });
    });
    if (next.includes(toId)) return hops;
    frontier = next;
  }
  return null;
}

export function stampNode(node, patch = {}) {
  return { ...node, ...patch, updatedAt: nowIso() };
}
