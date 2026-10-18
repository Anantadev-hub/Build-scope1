// Entity factories. Every record has a stable ID and timestamps so records can
// reference each other instead of relying on display names.
import { uid, nowIso } from './id';

export function createProject(overrides = {}) {
  const now = nowIso();
  return {
    id: uid('prj'),
    caseId: '',
    name: 'Untitled investigation',
    problem: '',
    solution: '',
    targetUsers: [],
    features: [],
    desiredOutcome: '',
    hackathonName: '',
    officialBrief: '',
    teamSize: 2,
    skills: [],
    stack: [],
    timeAvailable: 24,
    budget: '',
    externalServices: '',
    dataSources: '',
    limitations: '',
    believedDifferentiation: '',
    createdAt: now,
    updatedAt: now,
    briefMeta: { sourceUrl: '', checkedAt: '', checkedBy: '' },
    comparison: { selectedIds: [], notes: {}, confirmedAt: null },
    repositories: [],
    solutions: [],
    evidence: [],
    claims: [],
    feasibility: [],
    risks: [],
    requirements: [],
    acceptance: [],
    skillGaps: [],
    scope: [],
    proofNodes: [],
    proofLinks: [],
    tests: [],
    reports: [],
    passports: [],
    scopeConfirmedAt: null,
    seeded: false,
    ...overrides,
  };
}

export function feature(over = {}) {
  return { id: uid('ftr'), name: '', description: '', essential: true, ...over };
}

export function repositoryFinding(over = {}) {
  return {
    id: uid('repo'),
    name: '',
    owner: '',
    description: '',
    platform: 'GitHub',
    url: '',
    language: '',
    topics: [],
    stars: null,
    forks: null,
    lastUpdated: '',
    licence: '',
    docs: '',
    relevantFeatures: [],
    matchReason: '',
    overlap: '',
    possibleDifferences: '',
    limitations: '',
    retrieval: 'demo',
    checkedAt: '',
    savedAt: nowIso(),
    demo: false,
    ...over,
  };
}

export function existingSolution(over = {}) {
  return {
    id: uid('sol'),
    name: '',
    kind: 'product',
    description: '',
    url: '',
    platform: '',
    features: [],
    matchReason: '',
    overlap: '',
    limitations: '',
    retrieval: 'demo',
    checkedAt: '',
    savedAt: nowIso(),
    demo: false,
    ...over,
  };
}

export function evidenceRecord(over = {}) {
  return {
    id: uid('ev'),
    title: '',
    sourceName: '',
    url: '',
    kind: 'repository',
    claim: '',
    checkedAt: '',
    verification: 'unverified',
    notes: '',
    demo: false,
    seeded: false,
    createdAt: nowIso(),
    ...over,
  };
}

export function differentiationClaim(over = {}) {
  return {
    id: uid('clm'),
    claim: '',
    type: 'Other',
    evidenceIds: [],
    alternativesExamined: '',
    confidence: 'Low',
    openQuestions: '',
    validationAction: '',
    demoProof: '',
    status: 'research',
    notes: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

export function feasibilityCheck(over = {}) {
  return {
    id: uid('fsb'),
    category: 'Technical',
    title: '',
    mustBeTrue: '',
    status: 'not-investigated',
    evidence: '',
    whyItMatters: '',
    consequence: '',
    nextAction: '',
    howToVerify: '',
    fallback: '',
    criticality: 'Important',
    checkedAt: '',
    ...over,
  };
}

export function riskRecord(over = {}) {
  return {
    id: uid('rsk'),
    title: '',
    description: '',
    likelihood: 'Medium',
    impact: 'Medium',
    evidence: '',
    mitigation: '',
    fallback: '',
    owner: '',
    status: 'Open',
    related: '',
    createdAt: nowIso(),
    ...over,
  };
}

export function officialRequirement(over = {}) {
  return {
    id: uid('req'),
    text: '',
    source: '',
    sourceUrl: '',
    mandatory: true,
    mustImplement: '',
    demonstration: '',
    acceptance: '',
    status: 'unconfirmed',
    evidence: '',
    questions: '',
    checkedAt: '',
    ...over,
  };
}

export function acceptanceCriterion(over = {}) {
  return {
    id: uid('acc'),
    title: '',
    kind: 'capability',
    given: '',
    when: '',
    then: '',
    proof: '',
    evidenceStatus: 'not-started',
    ...over,
  };
}

export function skillGap(over = {}) {
  return {
    id: uid('gap'),
    skill: '',
    category: 'Frontend',
    why: '',
    confidence: 2,
    prerequisite: '',
    projectTask: '',
    competenceEvidence: '',
    resolution: 'open',
    evidenceNote: '',
    createdAt: nowIso(),
    ...over,
  };
}

export function scopeItem(over = {}) {
  return { id: uid('scp'), name: '', bucket: 'should', hours: 4, note: '', ...over };
}

/* ---------------- opportunity-to-proof traceability ---------------- */

// A node is one link in a chain: need -> evidence -> requirement ->
// implementation -> test result. It never asserts verification by itself.
export function proofNode(over = {}) {
  return {
    id: uid('pn'),
    kind: 'need',
    title: '',
    detail: '',
    refType: '',
    refId: '',
    recordedBy: '',
    demo: false,
    seeded: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

export function proofLink(over = {}) {
  return {
    id: uid('pl'),
    from: '',
    to: '',
    note: '',
    demo: false,
    seeded: false,
    createdAt: nowIso(),
    ...over,
  };
}

// A test record is what the team observed, by hand or by a local script. It is
// explicitly not an external CI result: only a connected provider can supply
// those, and the UI never lets one be typed in.
export function testRecord(over = {}) {
  return {
    id: uid('tst'),
    title: '',
    criterionId: '',
    requirementId: '',
    proofNodeId: '',
    method: 'manual',
    result: 'not-run',
    ranAt: '',
    ranBy: '',
    environment: '',
    expected: '',
    actual: '',
    steps: '',
    evidenceNote: '',
    evidenceUrl: '',
    provenance: 'self-reported',
    demo: false,
    seeded: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

export function riskPriority(risk) {
  if (risk.status === 'Resolved' || risk.status === 'Accepted') return 'Closed';
  const l = { Low: 1, Medium: 2, High: 3 }[risk.likelihood] || 2;
  const i = { Low: 1, Medium: 2, High: 3 }[risk.impact] || 2;
  const score = l * i;
  if (score >= 7) return 'Critical';
  if (score >= 5) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}
