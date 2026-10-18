// Derived investigation logic. Everything here is computed from saved project
// state - no scores are hard-coded, and demo/simulated records never count as
// verified evidence.
import {
  MISSION_DEFS, RANKS, REQUIREMENT_STATUS, OVERLAP,
} from './constants';
import { riskPriority } from './models';
import { traceSummary } from './graph';

// Traceability the team recorded themselves. Demo fixtures are stripped first, so
// a seeded demo chain can never satisfy a mission task, a passport check, or an
// achievement.
function teamTrace(p) {
  return traceSummary({
    ...p,
    proofNodes: p.proofNodes.filter((n) => !n.demo && !n.seeded),
    tests: p.tests.filter((t) => !t.demo && !t.seeded),
  });
}

export function isProjectBriefComplete(p) {
  return Boolean(
    p.name && p.problem.trim() && p.solution.trim()
    && p.targetUsers.length > 0 && p.features.length > 0,
  );
}

export function buildMissions(p) {
  const comparisonDone = p.comparison?.selectedIds?.length > 0;
  const checkedFeasibility = p.feasibility.filter((f) => f.status !== 'not-investigated' && f.status !== 'na');
  const highRiskOpen = p.risks.filter((r) => ['High', 'Critical'].includes(riskPriority(r)));
  // Demo fixtures never satisfy a mission task: they are not the team's work.
  const recordedTests = p.tests.filter((t) => !t.demo && !t.seeded);
  const trace = teamTrace(p);

  const defs = [
    {
      key: 'recon',
      tasks: [
        { id: 'brief', label: 'Complete the structured project brief', done: isProjectBriefComplete(p) },
        { id: 'users', label: 'Identify at least one specific target user', done: p.targetUsers.length > 0 },
        { id: 'landscape', label: 'Record two relevant repositories or existing solutions', done: p.repositories.length + p.solutions.length >= 2 },
        { id: 'evidence', label: 'Save evidence with the claim it supports', done: p.evidence.some((e) => e.claim.trim()) },
        { id: 'workflow', label: 'Define the core features and workflow', done: p.features.length >= 3 },
      ],
    },
    {
      key: 'edge',
      tasks: [
        { id: 'compare', label: 'Select alternatives in the comparison matrix', done: comparisonDone },
        { id: 'overlap', label: 'Document at least one feature-level overlap', done: p.claims.length > 0 || Object.keys(p.comparison?.notes || {}).length > 0 },
        { id: 'edge', label: 'Record one evidence-supported differentiator', done: p.claims.some((c) => c.status === 'supported') },
        { id: 'questions', label: 'Record unresolved originality questions', done: p.claims.some((c) => c.openQuestions?.trim()) },
      ],
    },
    {
      key: 'stress',
      tasks: [
        { id: 'deps', label: 'Assess at least three feasibility items', done: checkedFeasibility.length >= 3 },
        { id: 'data', label: 'Investigate data, API, or auth constraints', done: p.feasibility.some((f) => ['Data availability', 'API access', 'Auth & permissions', 'Licensing'].includes(f.category) && f.status !== 'not-investigated') },
        { id: 'risks', label: 'Create a risk register with mitigations', done: p.risks.length >= 2 && p.risks.some((r) => r.mitigation.trim()) },
        { id: 'fallback', label: 'Document a demo fallback plan', done: p.feasibility.some((f) => f.fallback.trim()) || p.risks.some((r) => r.fallback.trim()) },
        { id: 'req', label: 'Review the official competition requirements', done: p.requirements.length > 0 },
      ],
    },
    {
      key: 'demo',
      tasks: [
        { id: 'essential', label: 'Select essential (must-build) features', done: p.scope.filter((s) => s.bucket === 'must').length >= 3 },
        { id: 'acceptance', label: 'Define at least three acceptance criteria', done: p.acceptance.length >= 3 },
        { id: 'e2e', label: 'Map the end-to-end demo workflow', done: p.acceptance.some((a) => a.kind === 'workflow') },
        { id: 'skills', label: 'Identify skills the team still needs', done: p.skillGaps.length >= 1 },
        { id: 'validation', label: 'Write how each criterion will be proven', done: p.acceptance.some((a) => a.proof.trim()) },
        { id: 'trace', label: 'Trace a need to a recorded test result', done: trace.observedChains > 0 },
      ],
    },
    {
      key: 'release',
      tasks: [
        { id: 'blockers', label: 'Review unresolved high-priority blockers', done: highRiskOpen.length === 0 || highRiskOpen.every((r) => r.mitigation.trim()) },
        { id: 'scope', label: 'Confirm the final build scope', done: Boolean(p.scopeConfirmedAt) },
        { id: 'report', label: 'Generate a Buildability Report', done: p.reports.length > 0 },
        { id: 'sources', label: 'Review the source register for unchecked records', done: p.evidence.length >= 3 && p.evidence.every((e) => e.claim.trim() && e.verification !== 'unverified') },
        { id: 'passport', label: 'Record the final Buildability Passport', done: p.passports.length > 0 },
        { id: 'assurance', label: 'Record what happened when the demo was run', done: recordedTests.some((t) => t.result !== 'not-run') },
      ],
    },
  ];

  return MISSION_DEFS.map((m, i) => {
    const tasks = defs[i].tasks;
    const done = tasks.filter((t) => t.done).length;
    return {
      ...m,
      tasks,
      done,
      total: tasks.length,
      complete: done === tasks.length,
      index: i + 1,
    };
  });
}

export function activeMission(missions) {
  return missions.find((m) => !m.complete) || missions[missions.length - 1];
}

export function missionProgress(missions) {
  const done = missions.reduce((n, m) => n + m.done, 0);
  const total = missions.reduce((n, m) => n + m.total, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function totalXp(state, projectId) {
  return state.xpEvents
    .filter((e) => e.projectId === projectId)
    .reduce((n, e) => n + e.amount, 0);
}

export function rankFor(xp) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r.min) idx = i; });
  const current = RANKS[idx];
  const next = RANKS[idx + 1] || null;
  const span = next ? next.min - current.min : 1;
  const into = xp - current.min;
  return {
    current,
    next,
    xp,
    toNext: next ? Math.max(0, next.min - xp) : 0,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
  };
}

/* ---------------- XP ---------------- */
// Candidate awards are derived from saved state. The store only appends an
// award once per key, so repeated clicks can never farm XP.
export function xpCandidates(state) {
  const out = [];
  const add = (p, key, amount, reason) => out.push({ projectId: p.id, key, amount, reason });

  state.projects.forEach((p) => {
    if (isProjectBriefComplete(p)) add(p, 'brief:complete', 60, 'Structured project brief completed');

    p.repositories.slice(0, 8).forEach((r) => add(p, `repo:${r.id}`, 12, `Repository lead recorded: ${r.name}`));
    p.solutions.slice(0, 6).forEach((s) => add(p, `solution:${s.id}`, 12, `Existing solution recorded: ${s.name}`));

    p.evidence
      .filter((e) => !e.demo && e.claim.trim())
      .slice(0, 8)
      .forEach((e) => add(p, `evidence:${e.id}`, e.verification === 'verified' ? 30 : 20, e.verification === 'verified'
        ? `Verified source recorded: ${e.sourceName}`
        : `Evidence recorded with claim: ${e.sourceName}`));

    if (p.comparison?.confirmedAt) add(p, 'comparison:complete', 40, 'Existing-solution comparison completed');

    p.claims
      .filter((c) => c.status === 'supported' && c.evidenceIds.length > 0)
      .slice(0, 5)
      .forEach((c) => add(p, `claim:${c.id}`, 35, `Differentiator linked to evidence: ${c.claim.slice(0, 60)}`));

    p.feasibility
      .filter((f) => f.status === 'verified')
      .slice(0, 8)
      .forEach((f) => add(p, `feasibility:${f.id}`, 25, `Feasibility verified: ${f.title || f.category}`));

    p.risks
      .filter((r) => r.mitigation.trim() && ['High', 'Critical'].includes(riskPriority(r)))
      .slice(0, 6)
      .forEach((r) => add(p, `risk:${r.id}`, 20, `Mitigation documented for risk: ${r.title}`));

    p.requirements
      .filter((r) => r.status === 'evidence')
      .slice(0, 8)
      .forEach((r) => add(p, `requirement:${r.id}`, 25, `Requirement evidence provided: ${r.text.slice(0, 50)}`));

    p.acceptance.slice(0, 6).forEach((a) => add(p, `acceptance:${a.id}`, 15, `Acceptance criterion defined: ${a.title}`));

    // Traceability and test records are keyed by record id, so re-clicking can
    // never award the same points twice.
    p.proofNodes
      .filter((n) => !n.demo && !n.seeded)
      .slice(0, 10)
      .forEach((n) => add(p, `proofnode:${n.id}`, 8, `Traceability node recorded: ${n.title || n.kind}`));

    p.tests
      .filter((t) => !t.demo && !t.seeded && t.result !== 'not-run')
      .slice(0, 8)
      .forEach((t) => add(p, `test:${t.id}`, 15, `Test result recorded: ${t.title}`));

    if (p.scopeConfirmedAt) add(p, 'scope:confirmed', 30, 'Build scope confirmed');

    if (p.reports.length > 0) add(p, 'report:first', 40, 'Buildability Report generated');
    if (p.passports.length > 0) add(p, 'passport:first', 60, 'Buildability Passport recorded');
  });

  state.learningProgress
    .filter((l) => l.stages?.apply && l.projectId)
    .slice(0, 8)
    .forEach((l) => add({ id: l.projectId }, `learning:${l.id}`, 20, 'Skill applied to the project'));

  state.hackathonTracking.forEach((t) => {
    if (t.projectId) add({ id: t.projectId }, `hackathon:${t.id}`, 10, 'Hackathon opportunity tracked');
  });

  return out;
}

export function pendingXpAwards(state) {
  const existing = new Set(state.xpEvents.map((e) => `${e.projectId}:${e.key}`));
  return xpCandidates(state).filter((c) => !existing.has(`${c.projectId}:${c.key}`));
}

/* ---------------- achievements ---------------- */
export function achievementCandidates(state) {
  const earned = [];
  const push = (key, projectId) => earned.push({ key, projectId });

  const allEvidence = state.projects.flatMap((p) => p.evidence.map((e) => ({ ...e, projectId: p.id })));
  const checked = allEvidence.filter((e) => !e.demo && !e.seeded && e.verification === 'verified' && e.checkedAt);

  if (state.projects.length > 0) push('first-contact', state.projects[0].id);
  if (state.projects.some((p) => p.comparison?.confirmedAt)) {
    push('beyond-obvious', state.projects.find((p) => p.comparison?.confirmedAt).id);
  }
  if (checked.length > 0) push('source-verified', checked[0].projectId);
  if (state.projects.some((p) => p.feasibility.length >= 3 && p.feasibility.some((f) => f.status === 'verified'))) {
    push('reality-check', state.projects.find((p) => p.feasibility.length >= 3 && p.feasibility.some((f) => f.status === 'verified')).id);
  }
  const noHandWaving = state.projects.find((p) => p.claims.some((c) => c.status === 'supported' && c.evidenceIds.length > 0));
  if (noHandWaving) push('no-hand-waving', noHandWaving.id);
  const demoArchitect = state.projects.find((p) => p.acceptance.length >= 3);
  if (demoArchitect) push('demo-architect', demoArchitect.id);
  const riskHunter = state.projects.find((p) => p.risks.some((r) => r.impact === 'High' && r.mitigation.trim()));
  if (riskHunter) push('risk-hunter', riskHunter.id);
  const evidenceComplete = state.projects.find((p) => p.evidence.filter((e) => !e.demo && !e.seeded && e.claim.trim() && e.verification !== 'unverified').length >= 3);
  if (evidenceComplete) push('evidence-complete', evidenceComplete.id);
  const certified = state.projects.find((p) => p.passports.length > 0);
  if (certified) push('buildability-certified', certified.id);
  // Traceable proof requires a recorded test outcome, never a demo fixture.
  const traced = state.projects.find((p) => teamTrace(p).observedChains > 0);
  if (traced) push('traceable-proof', traced.id);
  const honest = state.projects.find((p) => p.tests.some((t) => !t.demo && !t.seeded && t.result === 'failed'));
  if (honest) push('honest-tester', honest.id);

  return earned;
}

export function pendingAchievements(state) {
  const have = new Set(state.achievements.map((a) => a.key));
  return achievementCandidates(state).filter((a) => !have.has(a.key));
}

/* ---------------- project metrics ---------------- */
export function coverageOf(p) {
  const items = [...p.repositories, ...p.solutions];
  if (items.length === 0) return { key: 'insufficient', label: OVERLAP.insufficient.label, cls: 'outline', count: 0 };
  const strong = items.filter((i) => i.overlap === 'strong').length;
  const partial = items.filter((i) => i.overlap === 'partial').length;
  if (strong > 0) return { key: 'strong', label: OVERLAP.strong.label, cls: 'red', count: strong };
  if (partial > 0) return { key: 'partial', label: OVERLAP.partial.label, cls: 'amber', count: partial };
  if (items.some((i) => i.overlap === 'potential')) return { key: 'potential', label: OVERLAP.potential.label, cls: 'sage', count: items.length };
  return { key: 'insufficient', label: OVERLAP.insufficient.label, cls: 'outline', count: items.length };
}

export function evidenceQuality(p) {
  const real = p.evidence.filter((e) => !e.demo);
  const verified = real.filter((e) => e.verification === 'verified').length;
  const partial = real.filter((e) => e.verification === 'partial').length;
  if (verified >= 3) return { label: 'Strong', cls: 'green', note: `${verified} verified records` };
  if (verified > 0) return { label: 'Partial', cls: 'amber', note: `${verified} verified, ${partial} partial` };
  if (real.length > 0) return { label: 'Unverified', cls: 'outline', note: 'Recorded, not checked' };
  if (p.evidence.some((e) => e.demo)) return { label: 'Demo only', cls: 'demo', note: 'No real sources checked' };
  return { label: 'None', cls: 'outline', note: 'No sources saved' };
}

export function complianceSummary(p) {
  const reqs = p.requirements;
  const confirmed = reqs.filter((r) => r.status === 'evidence').length;
  const implemented = reqs.filter((r) => r.status === 'implemented').length;
  const pending = reqs.filter((r) => ['not-started', 'in-progress'].includes(r.status)).length;
  const blocked = reqs.filter((r) => r.status === 'blocked').length;
  const unconfirmed = reqs.filter((r) => r.status === 'unconfirmed').length;
  const briefVerified = Boolean(p.briefMeta?.checkedAt && p.briefMeta?.sourceUrl);
  return {
    total: reqs.length, confirmed, implemented, pending, blocked, unconfirmed, briefVerified,
    status: !briefVerified ? 'UNVERIFIED' : (blocked > 0 ? 'AT RISK' : (confirmed === reqs.length && reqs.length > 0 ? 'EVIDENCED' : 'IN PROGRESS')),
  };
}

export function highPriorityBlockers(p) {
  // "Blocking" means unresolved AND without a mitigation. A high risk that has
  // been mitigated stays visible on the watchlist but no longer blocks work.
  const highRisks = p.risks.filter((r) => ['High', 'Critical'].includes(riskPriority(r)));
  const riskBlockers = highRisks.filter((r) => !r.mitigation.trim());
  const mitigatedHigh = highRisks.filter((r) => r.mitigation.trim());
  const depBlockers = p.feasibility.filter((f) => f.status === 'blocked');
  return { riskBlockers, mitigatedHigh, depBlockers, count: riskBlockers.length + depBlockers.length };
}

export function scopeHours(p) {
  const must = p.scope.filter((s) => s.bucket === 'must').reduce((n, s) => n + (Number(s.hours) || 0), 0);
  const should = p.scope.filter((s) => s.bucket === 'should').reduce((n, s) => n + (Number(s.hours) || 0), 0);
  const could = p.scope.filter((s) => s.bucket === 'could').reduce((n, s) => n + (Number(s.hours) || 0), 0);
  const available = (Number(p.timeAvailable) || 0) * (Number(p.teamSize) || 1);
  return { must, should, could, available, over: must > available, ratio: available ? Math.round((must / available) * 100) : null };
}

export function nextAction(p, missions) {
  if (!isProjectBriefComplete(p)) {
    return { label: 'Finish the project brief', to: `/projects/${p.id}/edit`, reason: 'The investigation cannot be scoped without a problem, users, and core features.', severity: 'action' };
  }
  if (p.repositories.length + p.solutions.length < 2) {
    return { label: 'Investigate existing solutions', to: `/projects/${p.id}/prior-art`, reason: 'You have almost no landscape evidence yet.', severity: 'action' };
  }
  if (!p.comparison?.confirmedAt) {
    return { label: 'Compare against existing alternatives', to: `/projects/${p.id}/differentiation`, reason: 'Overlap is recorded but not yet analysed side by side.', severity: 'action' };
  }
  const critical = highPriorityBlockers(p);
  if (critical.count > 0) {
    return { label: 'Resolve or mitigate a blocker', to: `/projects/${p.id}/feasibility`, reason: `${critical.count} high-priority blocker${critical.count > 1 ? 's are' : ' is'} unresolved.`, severity: 'blocker' };
  }
  if (!p.claims.some((c) => c.status === 'supported')) {
    return { label: 'Establish a defensible differentiator', to: `/projects/${p.id}/differentiation`, reason: 'No differentiation claim is supported by evidence yet.', severity: 'action' };
  }
  if (!p.briefMeta?.checkedAt) {
    return { label: 'Verify the official competition brief', to: `/projects/${p.id}/requirements`, reason: 'Compliance cannot be claimed against an unchecked brief.', severity: 'warning' };
  }
  if (p.acceptance.length < 3) {
    return { label: 'Define demo acceptance criteria', to: `/projects/${p.id}/feasibility?tab=scope`, reason: 'The demo needs testable proof, not just features.', severity: 'action' };
  }
  if (teamTrace(p).observedChains === 0) {
    return { label: 'Record what happens when the demo runs', to: `/projects/${p.id}/assurance`, reason: 'Acceptance criteria are defined but not one test outcome has been recorded.', severity: 'action' };
  }
  if (p.scope.filter((s) => s.bucket === 'must').length < 3) {
    return { label: 'Choose the must-build scope', to: `/projects/${p.id}/feasibility?tab=scope`, reason: 'The essential demo scope is still undefined.', severity: 'action' };
  }
  if (p.reports.length === 0) {
    return { label: 'Generate the Buildability Report', to: `/projects/${p.id}/reports`, reason: 'Evidence is ready to be assembled into a reviewable dossier.', severity: 'action' };
  }
  if (p.passports.length === 0) {
    return { label: 'Record the Buildability Passport', to: `/projects/${p.id}/passport`, reason: 'Close the investigation with an evidence-based recommendation.', severity: 'action' };
  }
  return { label: 'Review the latest passport', to: `/projects/${p.id}/passport`, reason: 'The dossier is assembled. Re-check it after material changes.', severity: 'info' };
}

/* ---------------- Passport ---------------- */
export function computePassport(p) {
  const verifiedEvidence = p.evidence.filter((e) => !e.demo && !e.seeded && e.verification === 'verified');
  const partialEvidence = p.evidence.filter((e) => !e.demo && !e.seeded && e.verification === 'partial');
  const supportedClaims = p.claims.filter((c) => c.status === 'supported' && c.evidenceIds.length > 0);
  const criticalRisks = p.risks.filter((r) => riskPriority(r) === 'Critical');
  const openBlockers = p.risks.filter((r) => ['High', 'Critical'].includes(riskPriority(r)) && !r.mitigation.trim());
  const blockedDeps = p.feasibility.filter((f) => f.status === 'blocked' && f.criticality === 'Critical');
  const verifiedFeasibility = p.feasibility.filter((f) => f.status === 'verified');
  const hours = scopeHours(p);
  const mandatory = p.requirements.filter((r) => r.mandatory);
  const evidencedReqs = mandatory.filter((r) => r.status === 'evidence');
  const briefVerified = Boolean(p.briefMeta?.checkedAt && p.briefMeta?.sourceUrl);
  const workflowCriterion = p.acceptance.some((a) => a.kind === 'workflow');
  const trace = teamTrace(p);
  const realTests = p.tests.filter((t) => !t.demo && !t.seeded);
  const criteriaWithOutcome = p.acceptance.filter((a) => realTests.some((t) => t.criterionId === a.id && t.result !== 'not-run')).length;

  const checks = [
    { id: 'brief', label: 'Problem, users, and scope defined', pass: isProjectBriefComplete(p), detail: 'A structured project brief is required before any build recommendation.' },
    { id: 'evidence', label: 'At least three independently checked sources', pass: verifiedEvidence.length >= 3, detail: `${verifiedEvidence.length} verified, ${partialEvidence.length} partial. Demo records are excluded.` },
    { id: 'claims', label: 'Differentiation supported by linked evidence', pass: supportedClaims.length >= 1, detail: supportedClaims.length ? `${supportedClaims.length} supported claim(s).` : 'No claim currently meets the evidence bar.' },
    { id: 'feasibility', label: 'Critical dependencies not blocked', pass: blockedDeps.length === 0, detail: blockedDeps.length ? `${blockedDeps.length} critical dependency blocked.` : 'No critical dependency is marked blocked.' },
    { id: 'feasibility-verified', label: 'At least one dependency independently verified', pass: verifiedFeasibility.length >= 1, detail: 'Assumptions alone are not feasibility evidence.' },
    { id: 'risks', label: 'High-impact risks mitigated', pass: openBlockers.length === 0, detail: openBlockers.length ? `${openBlockers.length} high/critical risk(s) without a mitigation.` : 'Every high-impact risk has a mitigation or fallback.' },
    { id: 'brief-official', label: 'Official competition brief verified', pass: briefVerified, detail: briefVerified ? 'Brief source recorded and checked.' : 'No official brief source and check date recorded.' },
    { id: 'requirements', label: 'Mandatory requirements evidenced', pass: mandatory.length > 0 && evidencedReqs.length === mandatory.length, detail: mandatory.length ? `${evidencedReqs.length} of ${mandatory.length} mandatory requirements have evidence.` : 'No official requirements have been mapped.' },
    { id: 'demo', label: 'Demonstrable end-to-end acceptance criteria', pass: p.acceptance.length >= 3 && workflowCriterion, detail: `${p.acceptance.length} criteria defined${workflowCriterion ? ', including an end-to-end workflow.' : '; no end-to-end workflow criterion.'}` },
    { id: 'trace', label: 'At least one need traced to a recorded test result', pass: trace.observedChains > 0, detail: trace.observedChains ? `${trace.observedChains} chain(s) have a recorded outcome (${trace.passed} passing, ${trace.failed} failing, ${trace.notRun} not yet run).` : 'No need has a recorded test result. A plan is not proof.' },
    { id: 'assurance', label: 'Every acceptance criterion has a recorded outcome', pass: p.acceptance.length > 0 && criteriaWithOutcome === p.acceptance.length, detail: p.acceptance.length ? `${criteriaWithOutcome} of ${p.acceptance.length} criteria have a team-recorded outcome. Demo fixtures and unrun criteria do not count.` : 'No acceptance criteria to test against.' },
    { id: 'scope', label: 'Essential scope fits the available time', pass: hours.available > 0 && hours.must <= hours.available, detail: hours.available ? `Must-build estimate ${hours.must}h against ${hours.available}h available.` : 'No time budget recorded.' },
  ];

  const failed = checks.filter((c) => !c.pass);
  let outcome;
  let outcomeKey;
  const reasons = [];
  const nextActions = [];

  if (blockedDeps.length > 0 || openBlockers.some((r) => riskPriority(r) === 'Critical')) {
    outcome = 'BLOCKED — INVESTIGATE FIRST';
    outcomeKey = 'blocked';
    if (blockedDeps.length) reasons.push(`${blockedDeps.length} critical dependency is blocked: ${blockedDeps.map((d) => d.title || d.category).join(', ')}.`);
    if (openBlockers.filter((r) => riskPriority(r) === 'Critical').length) reasons.push('A critical risk has no mitigation or fallback.');
  } else if (verifiedEvidence.length === 0) {
    outcome = 'INSUFFICIENT EVIDENCE';
    outcomeKey = 'insufficient';
    reasons.push('No independently checked source is recorded. Demo and user-asserted records do not count as verification.');
    reasons.push('Originality and feasibility cannot be concluded from unchecked material.');
  } else if (hours.available > 0 && hours.must > hours.available) {
    outcome = 'SCOPE REDUCTION REQUIRED';
    outcomeKey = 'reduce';
    reasons.push(`The must-build scope is estimated at ${hours.must}h against ${hours.available}h available.`);
    reasons.push('Cut or defer features before adding another integration.');
  } else if (failed.length > 0) {
    outcome = 'READY WITH CONDITIONS';
    outcomeKey = 'conditions';
    reasons.push('The core direction is viable, but specific outstanding checks remain.');
    failed.slice(0, 4).forEach((f) => reasons.push(f.detail));
  } else {
    outcome = 'READY TO BUILD';
    outcomeKey = 'ready';
    reasons.push('Essential requirements, evidence, and dependencies are sufficiently addressed for the proposed scope.');
  }

  failed.slice(0, 5).forEach((f) => nextActions.push({ text: f.label, detail: f.detail }));
  if (criticalRisks.length && openBlockers.length) nextActions.push({ text: 'Add mitigations for remaining critical risks', detail: 'A fallback alone does not reduce likelihood; record both.' });
  if (!p.comparison?.confirmedAt) nextActions.push({ text: 'Complete the existing-solution comparison', detail: 'Differentiation claims need a documented comparison baseline.' });
  if (p.learningProgressOpen > 0) nextActions.push({ text: 'Close open skill gaps', detail: 'Learning progress alone does not resolve a project gap.' });
  if (nextActions.length === 0) nextActions.push({ text: 'Begin the build with the confirmed scope', detail: 'Regenerate this passport after any material change.' });

  return {
    outcome,
    outcomeKey,
    checks,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    reasons,
    nextActions,
    verifiedEvidence: verifiedEvidence.length,
    supportedClaims: supportedClaims.length,
    hours,
    generatedAt: new Date().toISOString(),
  };
}

export function requirementStatusMeta(s) {
  return REQUIREMENT_STATUS[s] || REQUIREMENT_STATUS.unconfirmed;
}
