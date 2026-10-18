// Assurance maths. Every number here comes from test records the team entered by
// hand. Nothing in this module treats a manual record as externally verified, and
// 'external-ci' rows can only arrive through a provider that is not connected.
import { TEST_METHODS, TEST_RESULTS } from './constants';

export function methodMeta(key) {
  return TEST_METHODS.find((m) => m.key === key) || TEST_METHODS[0];
}

export function resultMeta(key) {
  return TEST_RESULTS[key] || TEST_RESULTS['not-run'];
}

export function testCounts(project) {
  const tests = project.tests || [];
  const count = (r) => tests.filter((t) => t.result === r).length;
  return {
    total: tests.length,
    selfReported: tests.filter((t) => t.provenance !== 'external-ci').length,
    external: tests.filter((t) => t.provenance === 'external-ci').length,
    demo: tests.filter((t) => t.demo || t.seeded).length,
    real: tests.filter((t) => !t.demo && !t.seeded).length,
    passed: count('passed'),
    failed: count('failed'),
    partial: count('partial'),
    blocked: count('blocked'),
    notRun: count('not-run'),
    // A recorded result without a note about what was observed is a claim, not a record.
    withoutNote: tests.filter((t) => t.result !== 'not-run' && !String(t.actual || '').trim() && !String(t.evidenceNote || '').trim()).length,
  };
}

function latestOf(tests) {
  if (!tests.length) return null;
  return [...tests].sort((a, b) => new Date(b.ranAt || b.updatedAt || b.createdAt) - new Date(a.ranAt || a.updatedAt || a.createdAt))[0];
}

export function criterionCoverage(project) {
  const tests = project.tests || [];
  return (project.acceptance || []).map((criterion) => {
    const linked = tests.filter((t) => t.criterionId === criterion.id);
    const latest = latestOf(linked);
    return {
      criterion,
      tests: linked,
      latest,
      recorded: Boolean(latest) && latest.result !== 'not-run',
      proven: linked.some((t) => t.result === 'passed'),
      failing: linked.some((t) => t.result === 'failed' || t.result === 'blocked'),
    };
  });
}

export function requirementCoverage(project) {
  const tests = project.tests || [];
  return (project.requirements || []).map((requirement) => {
    const linked = tests.filter((t) => t.requirementId === requirement.id);
    return {
      requirement,
      tests: linked,
      latest: latestOf(linked),
      assured: linked.some((t) => t.result === 'passed'),
      failing: linked.some((t) => t.result === 'failed' || t.result === 'blocked'),
    };
  });
}

// Readiness is about recorded proof only. It never upgrades a requirement's own
// evidence status, which stays under the Requirements workspace.
export function assuranceSummary(project) {
  const coverage = criterionCoverage(project);
  const counts = testCounts(project);
  const touched = coverage.filter((c) => c.recorded).length;
  const proven = coverage.filter((c) => c.proven).length;
  const failing = coverage.filter((c) => c.failing).length;
  const untouched = coverage.filter((c) => !c.recorded);
  const workflow = coverage.filter((c) => c.criterion.kind === 'workflow');
  return {
    counts,
    coverage,
    requirements: requirementCoverage(project),
    criteriaTotal: coverage.length,
    touched,
    proven,
    failing,
    untouched,
    workflowTotal: workflow.length,
    workflowProven: workflow.filter((c) => c.proven).length,
    allCriteriaProven: coverage.length > 0 && proven === coverage.length,
    manualOnly: counts.external === 0,
  };
}

// Rows a future CI integration would have to produce. Documented, not simulated.
export function ciContract(baseUrl = '') {
  return {
    connected: false,
    baseUrl: baseUrl || undefined,
    endpoints: [
      { method: 'GET', path: '/api/ci/runs', returns: '[...{ id, workflow, status, conclusion, headSha, ranAt, url }]' },
      { method: 'GET', path: '/api/ci/runs/:id/artifacts', returns: '[...{ name, url, sizeBytes }]' },
    ],
    provenance: 'external-ci',
    notes: [
      'Results must arrive with the run URL and commit SHA so they can be checked, not typed.',
      'Tokens stay server-side; this client never holds a CI credential.',
      'Until this exists, every record in the tracker is self-reported and labelled as such.',
    ],
  };
}
