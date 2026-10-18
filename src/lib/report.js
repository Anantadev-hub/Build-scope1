// Report model. Blocks are plain JSON so a generated report can be saved as a
// stable snapshot and rendered either as HTML preview or PDF.
import { REPORT_SECTIONS, FEASIBILITY_STATUS, REQUIREMENT_STATUS, CLAIM_STATUS, HACKATHON_VERIFICATION, PROOF_KINDS, TEST_RESULTS } from './constants';
import { traceSummary } from './graph';
import { assuranceSummary, methodMeta } from './assurance';
import { riskPriority } from './models';
import {
  computePassport, coverageOf, evidenceQuality, complianceSummary, scopeHours, isProjectBriefComplete,
  buildMissions, activeMission,
} from './scoring';
import { fmtDate } from './format';
import { EVIDENCE_STATUS } from './constants';
import { LEARNING_RESOURCES } from '../data/demo';

export const COMPARISON_LEVELS = {
  documented: { label: 'Documented', cls: 'green' },
  partial: { label: 'Partially documented', cls: 'amber' },
  'not-found': { label: 'Not found in reviewed material', cls: 'outline' },
  unknown: { label: 'Unknown', cls: 'outline' },
  asserted: { label: 'User assertion', cls: 'outline' },
};

export const COMPARISON_DIMENSIONS = [
  'Target user', 'Problem addressed', 'Core workflow', 'Key features', 'Traceability',
  'Data sources', 'Offline or fallback capability', 'Integration requirements', 'Licensing or access constraints', 'Evidence quality',
];

export function buildReport(project, state, selectedKeys = [], version = 1) {
  const passport = computePassport(project);
  const missions = buildMissions(project);
  const current = activeMission(missions);
  const stageLabel = current.complete
    ? `Complete - ${missions.filter((m) => m.complete).length} of ${missions.length} missions close`
    : `${current.code} ${current.title} (${current.done}/${current.total} tasks)`;
  const coverage = coverageOf(project);
  const quality = evidenceQuality(project);
  const compliance = complianceSummary(project);
  const hours = scopeHours(project);
  const sec = [];

  const wanted = (key) => selectedKeys.includes(key) || REPORT_SECTIONS.find((s) => s.key === key)?.always;
  const push = (key, title, blocks) => {
    if (!wanted(key)) return;
    sec.push({ key, title, blocks });
  };
  const empty = (text) => [{ type: 'p', text }];

  // 01 Executive summary
  const summaryLines = [];
  summaryLines.push(`${project.name} is an investigation for a team of ${project.teamSize || 'unknown size'}${project.hackathonName ? `, prepared for ${project.hackathonName}` : ''}. ${isProjectBriefComplete(project) ? 'The project brief is structured and the investigation has been scoped.' : 'The project brief is incomplete, so this report cannot yet support a build recommendation.'}`);
  if (coverage.count > 0) summaryLines.push(`The landscape register contains ${project.repositories.length} repository lead(s) and ${project.solutions.length} other existing-solution lead(s). Current reading: ${coverage.label.toLowerCase()}.`);
  if (project.evidence.length) summaryLines.push(`Evidence quality is ${quality.label.toLowerCase()} (${quality.note.toLowerCase()}). ${project.evidence.filter((e) => e.demo).length} record(s) are demo fixtures and are excluded from verification.`);
  summaryLines.push(`${passport.reasons[0] || 'No conclusion could be derived.'} Outcome recorded at generation: ${passport.outcome}.`);

  push('summary', 'Executive summary', [
    { type: 'p', text: summaryLines.join(' ') },
    {
      type: 'kv',
      rows: [
        ['Case ID', project.caseId],
        ['Investigation stage', stageLabel],
        ['Existing-solution coverage', coverage.label],
        ['Evidence quality', `${quality.label} — ${quality.note}`],
        ['Feasibility', `${project.feasibility.filter((f) => f.status === 'verified').length} verified item(s), ${project.feasibility.filter((f) => f.status === 'blocked').length} blocked`],
        ['Official requirements', compliance.briefVerified ? `${compliance.status} (${compliance.confirmed} evidenced of ${compliance.total})` : 'OFFICIAL REQUIREMENTS NOT VERIFIED — add the official brief before claiming compliance'],
        ['Recommendation', passport.outcome],
      ],
    },
  ]);

  push('problem', 'Problem and proposed solution', [
    { type: 'sub', text: 'Problem statement' },
    { type: 'p', text: project.problem || 'Not yet written.' },
    { type: 'sub', text: 'Proposed solution' },
    { type: 'p', text: project.solution || 'Not yet written.' },
    { type: 'sub', text: 'Desired outcome' },
    { type: 'p', text: project.desiredOutcome || 'Not yet defined.' },
    { type: 'sub', text: 'Believed differentiation (team hypothesis)' },
    { type: 'p', text: project.believedDifferentiation || 'Not yet stated. A hypothesis is not evidence.' },
  ]);

  push('users', 'Target users and essential workflows', [
    { type: 'kv', rows: [['Primary users', project.targetUsers.join(', ') || 'Not yet defined']] },
    { type: 'sub', text: 'Core features' },
    project.features.length
      ? { type: 'table', head: ['Feature', 'Description', 'Essential'], rows: project.features.map((f) => [f.name, f.description || '—', f.essential ? 'Yes' : 'Optional']) }
      : { type: 'p', text: 'No features defined.' },
  ]);

  push('method', 'Investigation scope and methodology', [
    { type: 'p', text: 'This dossier separates four kinds of material: public-source findings, official requirement text, team assertions, and derived analysis. Demo fixtures are labelled and never count as verification.' },
    { type: 'list', items: [
      `Repository and existing-solution search: ${project.repositories.length + project.solutions.length} record(s) in the register. Live search is not connected; records marked DEMO were not retrieved from a live provider.`,
      `Source verification: ${project.evidence.filter((e) => e.verification === 'verified' && !e.demo).length} independently checked record(s), ${project.evidence.filter((e) => e.verification === 'partial' && !e.demo).length} partial.`,
      `Feature comparison: ${project.comparison?.selectedIds?.length || 0} alternative(s) selected${project.comparison?.confirmedAt ? `, comparison confirmed ${fmtDate(project.comparison.confirmedAt)}` : ', comparison not confirmed'}.`,
      `Feasibility: ${project.feasibility.length} item(s) assessed, ${project.risks.length} risk(s) registered.`,
      `Requirements: ${project.requirements.length} requirement(s) mapped; official brief ${compliance.briefVerified ? 'verified' : 'NOT verified'}.`,
      `Learning: ${project.skillGaps.length} skill gap(s); ${state?.learningProgress?.filter((l) => l.projectId === project.id).length || 0} learning record(s).`,
    ] },
  ]);

  const allAlternatives = [...project.repositories, ...project.solutions];
  push('prior-art', 'Existing solutions and public repository findings', [
    allAlternatives.length ? {
      type: 'table',
      head: ['Name', 'Type', 'Overlap', 'Relevance / match reason', 'Evidence limitations'],
      rows: allAlternatives.map((a) => [
        `${a.name}${a.owner ? ` (${a.owner})` : ''}${a.demo ? ' [DEMO]' : ''}`,
        a.kind ? (a.kind === 'repository' ? 'Repository' : a.kind) : 'Repository',
        a.overlap ? (a.overlap.charAt(0).toUpperCase() + a.overlap.slice(1)) : 'Unknown',
        a.matchReason || 'Not recorded',
        a.limitations || 'Not recorded',
      ]),
    } : { type: 'p', text: 'Not yet investigated. No repository or existing-solution records have been saved.' },
    ...(allAlternatives.some((a) => a.demo) ? [{ type: 'callout', title: 'Demonstration records', text: 'Some records above are simulated fixtures. Metadata such as stars, licences, and dates was not retrieved and is shown as unknown. No similar repository being found would still not prove originality.' }] : []),
  ]);

  const selected = (project.comparison?.selectedIds || []).map((id) => allAlternatives.find((a) => a.id === id)).filter(Boolean);
  const cells = project.comparison?.cells || {};
  push('comparison', 'Feature comparison', [
    selected.length && project.features.length ? {
      type: 'table',
      head: ['Proposed feature / dimension', ...selected.map((s) => s.name)],
      rows: [
        ...project.features.slice(0, 12).map((f) => [f.name, ...selected.map((s) => COMPARISON_LEVELS[cells[`${f.id}:${s.id}`]]?.label || 'Not assessed')]),
        ...COMPARISON_DIMENSIONS.slice(3, 10).map((d) => [d, ...selected.map((s) => COMPARISON_LEVELS[cells[`dim:${d}:${s.id}`]]?.label || 'Not assessed')]),
      ],
    } : { type: 'p', text: 'No comparison has been completed. Select alternatives in the Differentiation workspace first.' },
    ...Object.entries(project.comparison?.notes || {}).filter(([, v]) => v).map(([id, note]) => ({
      type: 'p', text: `Analyst note on ${allAlternatives.find((a) => a.id === id)?.name || 'alternative'}: ${note}`,
    })),
  ]);

  push('differentiation', 'Differentiation claims and supporting evidence', [
    project.claims.length ? {
      type: 'table',
      head: ['Claim', 'Status', 'Linked evidence', 'Confidence', 'Open question', 'Demo proof required'],
      rows: project.claims.map((c) => [
        c.claim,
        CLAIM_STATUS[c.status]?.label || c.status,
        c.evidenceIds.map((id) => project.evidence.find((e) => e.id === id)?.sourceName).filter(Boolean).join('; ') || 'None linked',
        c.confidence,
        c.openQuestions || '—',
        c.demoProof || '—',
      ]),
    } : { type: 'p', text: 'No differentiation claims recorded. Originality is not established.' },
  ]);

  const fsMeta = (s) => FEASIBILITY_STATUS[s]?.label || s;
  push('feasibility', 'Feasibility assessment', [
    project.feasibility.length ? {
      type: 'table',
      head: ['Area', 'What must be true', 'Status', 'Evidence / assumption', 'Fallback'],
      rows: project.feasibility.map((f) => [f.category + (f.criticality === 'Critical' ? ' [critical]' : ''), f.title || f.mustBeTrue, fsMeta(f.status), f.evidence || 'Not recorded', f.fallback || 'None recorded']),
    } : { type: 'p', text: 'Not yet investigated.' },
  ]);

  const constraintItems = project.feasibility.filter((f) => ['Data availability', 'API access', 'Auth & permissions', 'Licensing', 'Dependencies', 'Cost', 'Infrastructure'].includes(f.category));
  push('constraints', 'API, dataset, dependency, access, and licensing constraints', [
    constraintItems.length ? {
      type: 'table',
      head: ['Constraint', 'Status', 'Consequence if unresolved', 'How to verify', 'Fallback'],
      rows: constraintItems.map((f) => [f.title || f.category, fsMeta(f.status), f.consequence || '—', f.howToVerify || '—', f.fallback || 'None recorded']),
    } : { type: 'p', text: 'No data, API, auth, or licensing constraints have been assessed.' },
  ]);

  push('risks', 'Risk register and mitigations', [
    project.risks.length ? {
      type: 'table',
      head: ['Risk', 'Likelihood', 'Impact', 'Priority', 'Mitigation', 'Status'],
      rows: project.risks.map((r) => [r.title, r.likelihood, r.impact, riskPriority(r), r.mitigation || 'None recorded', r.status]),
    } : { type: 'p', text: 'No risks registered.' },
  ]);

  push('requirements', 'Official competition requirements and compliance', [
    ...(!compliance.briefVerified ? [{ type: 'callout', title: 'OFFICIAL REQUIREMENTS NOT VERIFIED', text: 'No official brief source and check date are recorded. Requirement statements below are unconfirmed and must not be presented as official rules.' }] : []),
    project.requirements.length ? {
      type: 'table',
      head: ['Requirement', 'Source', 'Mandatory', 'Implementation status', 'Evidence / acceptance'],
      rows: project.requirements.map((r) => [
        r.text,
        r.source || 'Not recorded',
        r.mandatory ? 'Yes' : 'No',
        REQUIREMENT_STATUS[r.status]?.label || r.status,
        `${r.evidence || 'No evidence'}${r.acceptance ? ` — acceptance: ${r.acceptance}` : ''}`,
      ]),
    } : { type: 'p', text: 'No requirements mapped. Add the official brief before claiming compliance.' },
  ]);

  push('demo', 'Demo acceptance criteria', [
    project.acceptance.length ? {
      type: 'table',
      head: ['Criterion', 'Kind', 'Given / when / then', 'Proof required', 'Evidence status'],
      rows: project.acceptance.map((a) => [a.title, a.kind, `${a.given || '—'} / ${a.when || '—'} / ${a.then || '—'}`, a.proof || 'Not defined', a.evidenceStatus]),
    } : { type: 'p', text: 'No acceptance criteria defined. Without them the demo cannot be evaluated as working software.' },
  ]);

  const trace = traceSummary(project);
  push('traceability', 'Need-to-proof traceability', [
    { type: 'callout', title: 'TEAM-RECORDED TRACEABILITY', text: 'The nodes and links below were entered by the team. BuildScope cannot read the implementation, a repository, or a pipeline, so a complete chain records a documented argument - not an independent verification.' },
    trace.chains.length ? {
      type: 'table',
      head: ['Need', ...PROOF_KINDS.slice(1).map((k) => k.label), 'Test outcome'],
      rows: trace.chains.map((c) => [
        c.need.title || 'Untitled need',
        ...c.stages.slice(1).map((s) => (s.node ? s.node.title : 'NOT RECORDED')),
        c.record ? (TEST_RESULTS[c.record.result]?.label || c.record.result) : 'No test result recorded',
      ]),
    } : { type: 'p', text: 'No traceability has been recorded for this case. No need has been linked to evidence, requirements, implementation, or a test result.' },
    { type: 'p', text: `${trace.nodeCount} node(s) and ${trace.linkCount} link(s) recorded. ${trace.completeChains} of ${trace.counts.need} chain(s) have all five stages recorded, and ${trace.observedChains} chain(s) have an observed test outcome. ${trace.orphans.length} node(s) are not linked to anything.` },
  ]);

  const assurance = assuranceSummary(project);
  push('assurance', 'Assurance and testing record', [
    { type: 'callout', title: 'SELF-REPORTED RESULTS', text: 'Every test below was run and entered by the team. No CI service, webhook, or external test system is connected to this build, and no result here has been independently verified.' },
    project.tests.length ? {
      type: 'table',
      head: ['Test', 'Method', 'Result', 'Criterion', 'Run', 'Observed', 'Provenance'],
      rows: project.tests.map((t) => [
        `${t.title}${t.demo || t.seeded ? ' [DEMO]' : ''}`,
        methodMeta(t.method).label,
        TEST_RESULTS[t.result]?.label || t.result,
        project.acceptance.find((a) => a.id === t.criterionId)?.title || 'Not linked',
        t.ranAt ? `${fmtDate(t.ranAt)}${t.ranBy ? ` by ${t.ranBy}` : ''}` : 'Not recorded',
        t.actual || t.evidenceNote || 'No observation recorded',
        t.provenance === 'external-ci' ? 'External CI' : 'Self-reported by team',
      ]),
    } : { type: 'p', text: 'No test has been recorded. Nothing about the demo has been observed to work, and nothing about it has been observed to fail either.' },
    { type: 'p', text: `${assurance.proven} of ${assurance.criteriaTotal} acceptance criteria have a passing run recorded. ${assurance.counts.failed} record(s) failed, ${assurance.counts.blocked} could not be run, and ${assurance.counts.withoutNote} result(s) carry no observation of what actually happened.` },
    ...(assurance.untouched.length ? [{ type: 'p', text: `Criteria with no recorded outcome: ${assurance.untouched.map((c) => c.criterion.title).join('; ')}.` }] : []),
  ]);

  push('scope', 'Essential versus optional build scope', [
    { type: 'p', text: `Planning assumption, not a promise: ${hours.must}h must-build effort against ${hours.available}h available (${project.timeAvailable}h per person x ${project.teamSize} people). Optional scope adds ${hours.should + hours.could}h.` },
    project.scope.length ? {
      type: 'table',
      head: ['Bucket', 'Feature', 'Estimate (h)', 'Note'],
      rows: project.scope.map((s) => [s.bucket === 'not' ? 'Do not build yet' : `${s.bucket.charAt(0).toUpperCase() + s.bucket.slice(1)} build`, s.name, String(s.hours || 0), s.note || '—']),
    } : { type: 'p', text: 'No build scope defined.' },
    { type: 'p', text: project.scopeConfirmedAt ? `Scope confirmed ${fmtDate(project.scopeConfirmedAt)}.` : 'Scope not yet confirmed.' },
  ]);

  const projectLearning = state?.learningProgress?.filter((l) => l.projectId === project.id) || [];
  push('learning', 'Learning gaps and recommendations', [
    project.skillGaps.length ? {
      type: 'table',
      head: ['Skill gap', 'Why it matters', 'Confidence', 'Project task', 'Evidence of competence', 'Status'],
      rows: project.skillGaps.map((g) => [g.skill, g.why, `${g.confidence}/5`, g.projectTask || '—', g.competenceEvidence || '—', g.resolution === 'resolved' ? 'Evidence recorded' : 'Open']),
    } : { type: 'p', text: 'No skill gaps recorded.' },
    { type: 'p', text: projectLearning.length ? `Learning records: ${projectLearning.map((l) => `${LEARNING_RESOURCES.find((r) => r.id === l.resourceId)?.title || l.resourceId} (${l.status})`).join('; ')}. Completing a resource does not by itself resolve a project gap.` : 'No learning progress recorded. Resource availability and pricing have not been checked.' },
  ]);

  const roadmap = [];
  const must = project.scope.filter((s) => s.bucket === 'must');
  if (must.length) roadmap.push(`Phase 1 — Core workflow: ${must.map((s) => s.name).join(', ')}. Target: the end-to-end demo path works with stored records.`);
  if (project.acceptance.length) roadmap.push(`Phase 2 — Proof: satisfy ${project.acceptance.length} acceptance criteria and record the evidence for each.`);
  if (project.feasibility.some((f) => f.fallback)) roadmap.push('Phase 3 — Resilience: rehearse the documented fallback with external data unavailable.');
  roadmap.push('Phase 4 — Release: regenerate this report and the Buildability Passport after material changes.');
  push('roadmap', 'Proposed implementation roadmap', [
    { type: 'p', text: 'Sequence is a planning aid derived from the confirmed scope and acceptance criteria.' },
    { type: 'list', items: roadmap },
    { type: 'p', text: passport.nextActions.map((n) => `${n.text}: ${n.detail}`).join(' | ') },
  ]);

  push('sources', 'Source register', [
    project.evidence.length ? {
      type: 'table',
      head: ['Source', 'Type', 'Claim supported', 'Checked', 'Status', 'URL'],
      rows: project.evidence.map((e) => [
        e.sourceName || e.title || 'Untitled record',
        e.kind,
        e.claim || 'No claim recorded',
        e.checkedAt ? fmtDate(e.checkedAt) : 'Not checked',
        EVIDENCE_STATUS[e.verification]?.label || e.verification,
        e.demo ? 'DEMO — no live link' : (e.url || 'Not recorded'),
      ]),
    } : { type: 'p', text: 'No sources recorded.' },
  ]);

  const unknowns = [];
  if (!project.briefMeta?.checkedAt) unknowns.push('The official competition brief has not been verified.');
  if (!project.comparison?.confirmedAt) unknowns.push('The existing-solution comparison has not been confirmed.');
  project.evidence.filter((e) => e.verification === 'unverified').forEach((e) => unknowns.push(`Unverified source: ${e.sourceName || e.title}.`));
  project.claims.filter((c) => c.openQuestions).forEach((c) => unknowns.push(`Open question: ${c.openQuestions}`));
  project.requirements.filter((r) => r.questions).forEach((r) => unknowns.push(`Requirement question: ${r.questions}`));
  project.risks.filter((r) => !r.mitigation).forEach((r) => unknowns.push(`Unmitigated risk: ${r.title}.`));
  unknowns.push('Public repositories cannot reveal all private, commercial, unpublished, or undiscovered work.');
  push('limits', 'Assumptions, unknowns, conflicting information, and limitations', [
    { type: 'sub', text: 'Declared limitations' },
    { type: 'p', text: project.limitations || 'None recorded.' },
    { type: 'sub', text: 'Assumptions and unknowns' },
    { type: 'list', items: unknowns },
  ]);

  push('passport', 'Buildability Passport and next actions', [
    { type: 'kv', rows: [
      ['Outcome', passport.outcome],
      ['Checks passed', `${passport.passed} of ${passport.total}`],
      ['Verified evidence', `${passport.verifiedEvidence} record(s)`],
      ['Supported differentiation claims', String(passport.supportedClaims)],
      ['Generated', fmtDate(passport.generatedAt)],
    ] },
    { type: 'sub', text: 'Why this outcome' },
    { type: 'list', items: passport.reasons },
    { type: 'sub', text: 'Passport checks' },
    { type: 'table', head: ['Check', 'Result', 'Detail'], rows: passport.checks.map((c) => [c.label, c.pass ? 'PASS' : 'FAIL', c.detail]) },
    { type: 'sub', text: 'Next actions' },
    { type: 'list', items: passport.nextActions.map((n) => `${n.text} — ${n.detail}`) },
  ]);

  return {
    meta: {
      projectId: project.id,
      title: project.name,
      caseId: project.caseId,
      generatedAt: new Date().toISOString(),
      version,
      outcome: passport.outcome,
      demoData: project.seeded || project.evidence.some((e) => e.demo),
    },
    cover: {
      title: project.name,
      caseId: project.caseId,
      hackathon: project.hackathonName,
      teamSize: project.teamSize,
      date: fmtDate(new Date().toISOString()),
      version,
      outcome: passport.outcome,
      demoData: project.seeded,
    },
    snapshot: {
      rows: [
        ['Sources recorded', `${project.evidence.length} (${project.evidence.filter((e) => e.verification === 'verified' && !e.demo).length} independently checked, ${project.evidence.filter((e) => e.demo).length} demo fixtures)`],
        ['Landscape entries', `${project.repositories.length} repository leads, ${project.solutions.length} other solutions`],
        ['Alternatives compared', `${project.comparison?.selectedIds?.length || 0}${project.comparison?.confirmedAt ? ` (confirmed ${fmtDate(project.comparison.confirmedAt)})` : ' (not confirmed)'}`],
        ['Differentiation claims', `${project.claims.length} recorded, ${project.claims.filter((c) => c.status === 'supported').length} evidence-supported`],
        ['Feasibility checks', `${project.feasibility.length} assessed, ${project.feasibility.filter((f) => f.status === 'verified').length} verified, ${project.feasibility.filter((f) => f.status === 'blocked').length} blocked`],
        ['Risk register', `${project.risks.length} risks, ${project.risks.filter((r) => !r.mitigation.trim()).length} without a mitigation`],
        ['Official requirements', `${project.requirements.length} mapped, ${compliance.confirmed} evidenced`],
        ['Demo acceptance criteria', `${project.acceptance.length} defined, ${project.acceptance.filter((a) => a.evidenceStatus === 'verified').length} verified`],
        ['Traceability', `${trace.nodeCount} node(s), ${trace.linkCount} link(s), ${trace.completeChains} complete chain(s), ${trace.orphans.length} unlinked`],
        ['Test records', `${project.tests.length} recorded (${assurance.counts.passed} passing, ${assurance.counts.failed} failing), 0 externally verified`],
        ['Skill gaps', `${project.skillGaps.length} identified, ${project.skillGaps.filter((g) => g.resolution === 'resolved').length} resolved with evidence`],
      ],
    },
    sections: sec,
  };
}

export function reportFileName(project, date = new Date()) {
  const slug = project.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 48);
  const d = date.toISOString().slice(0, 10);
  return `BuildScope_${project.caseId}_${slug}_${d}.pdf`;
}

export function hackathonVerificationLabel(s) {
  return HACKATHON_VERIFICATION[s]?.label || s;
}

