// Precise, shared vocabularies. Labels are used verbatim in the UI and reports.

export const EVIDENCE_STATUS = {
  verified: { label: 'Verified', cls: 'green', hint: 'Checked against the source record by the team.' },
  partial: { label: 'Partially verified', cls: 'amber', hint: 'Some fields checked; others unresolved.' },
  unverified: { label: 'Unverified', cls: 'outline', hint: 'Recorded but not checked against the source.' },
  demo: { label: 'Demo record', cls: 'demo', hint: 'Simulated fixture. Not evidence.' },
  'user-asserted': { label: 'User assertion', cls: 'outline', hint: 'Entered by the team, not externally checked.' },
};

export const VERIFICATION_OPTIONS = [
  { value: 'unverified', label: 'Unverified — recorded, not checked' },
  { value: 'partial', label: 'Partially verified — some fields checked' },
  { value: 'verified', label: 'Verified — checked against the source' },
  { value: 'user-asserted', label: 'User assertion — team knowledge' },
];

export const FEASIBILITY_CATEGORIES = [
  'Technical', 'Data availability', 'API access', 'Auth & permissions', 'Licensing',
  'Dependencies', 'Infrastructure', 'Privacy & security', 'Time & capacity', 'Cost',
  'Offline fallback', 'Integration', 'Demonstrability',
];

export const FEASIBILITY_STATUS = {
  verified: { label: 'Verified', cls: 'green' },
  partial: { label: 'Partially verified', cls: 'amber' },
  assumed: { label: 'Assumed', cls: 'outline' },
  blocked: { label: 'Blocked', cls: 'red' },
  'not-investigated': { label: 'Not investigated', cls: 'outline' },
  na: { label: 'Not applicable', cls: 'outline' },
};

export const RISK_LIKELIHOOD = ['Low', 'Medium', 'High'];
export const RISK_IMPACT = ['Low', 'Medium', 'High'];
export const RISK_STATUS = ['Open', 'Mitigating', 'Resolved', 'Accepted'];
export const RISK_PRIORITY = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export const CLAIM_STATUS = {
  supported: { label: 'Evidence-supported', cls: 'green', short: 'SUPPORTED' },
  plausible: { label: 'Plausible but unverified', cls: 'amber', short: 'UNVERIFIED' },
  weak: { label: 'Weak or generic', cls: 'orange', short: 'WEAK' },
  contradicted: { label: 'Contradicted by evidence', cls: 'red', short: 'CONTRADICTED' },
  research: { label: 'Needs further research', cls: 'outline', short: 'RESEARCH' },
};

export const CLAIM_TYPES = ['Traceability', 'Workflow', 'Audience', 'Data', 'Cost', 'Offline capability', 'Accessibility', 'Other'];

export const OVERLAP = {
  strong: { label: 'Strong documented overlap', cls: 'red', level: 3 },
  partial: { label: 'Partial overlap', cls: 'amber', level: 2 },
  potential: { label: 'Potential differentiation', cls: 'sage', level: 1 },
  insufficient: { label: 'Insufficient evidence', cls: 'outline', level: 0 },
  research: { label: 'Further research required', cls: 'outline', level: 0 },
};

export const REQUIREMENT_STATUS = {
  'not-started': { label: 'Not started', cls: 'outline' },
  'in-progress': { label: 'In progress', cls: 'amber' },
  implemented: { label: 'Implemented', cls: 'sage' },
  evidence: { label: 'Evidence provided', cls: 'green' },
  blocked: { label: 'Blocked', cls: 'red' },
  unconfirmed: { label: 'Unconfirmed', cls: 'orange' },
};

export const SCOPE_BUCKETS = [
  { key: 'must', label: 'Must build', hint: 'Without this there is no demo.' },
  { key: 'should', label: 'Should build', hint: 'Adds credible value if time allows.' },
  { key: 'could', label: 'Could build', hint: 'Nice, but cut first.' },
  { key: 'not', label: 'Do not build yet', hint: 'Explicitly out of scope.' },
];

export const HACKATHON_STATUS = ['Interested', 'Preparing', 'Applied', 'Selected', 'Not participating'];

export const HACKATHON_VERIFICATION = {
  verified: { label: 'Verified', cls: 'green', hint: 'Key fields checked against an official organiser source.' },
  partial: { label: 'Partially verified', cls: 'amber', hint: 'Some fields confirmed; others unresolved.' },
  unverified: { label: 'Unverified', cls: 'outline', hint: 'Not sufficiently checked.' },
  expired: { label: 'Expired', cls: 'red', hint: 'Registration or event period has passed.' },
};

export const LEARNING_STAGES = [
  { key: 'understand', label: 'Understand', hint: 'Learn the concept and why it matters.' },
  { key: 'practice', label: 'Practice', hint: 'Complete a small exercise.' },
  { key: 'apply', label: 'Apply', hint: 'Implement it in the actual project.' },
];

export const LEARNING_STATUS = ['Planned', 'In progress', 'Completed'];

export const MISSION_DEFS = [
  {
    key: 'recon',
    code: '01',
    title: 'Reconnaissance',
    subtitle: 'Understand the problem, users, and landscape.',
  },
  {
    key: 'edge',
    code: '02',
    title: 'Find Your Edge',
    subtitle: 'Establish evidence-backed differentiation.',
  },
  {
    key: 'stress',
    code: '03',
    title: 'Stress Test',
    subtitle: 'Investigate feasibility, risks, and requirements.',
  },
  {
    key: 'demo',
    code: '04',
    title: 'Prove the Demo',
    subtitle: 'Trace needs to tests and record what actually happened.',
  },
  {
    key: 'release',
    code: '05',
    title: 'Build Release',
    subtitle: 'Finalise scope, evidence, and the Buildability Passport.',
  },
];

export const RANKS = [
  { name: 'Recruit', min: 0, note: 'You have opened a case file. Everything starts with a question.' },
  { name: 'Scout', min: 150, note: 'You survey the landscape before committing to a direction.' },
  { name: 'Analyst', min: 350, note: 'You separate documented facts from assumptions.' },
  { name: 'Engineer', min: 600, note: 'You test dependencies and plan what is actually buildable.' },
  { name: 'Architect', min: 900, note: 'Scope, evidence, and demo are aligned into one plan.' },
  { name: 'Field Commander', min: 1200, note: 'The dossier is complete enough to lead a build with confidence.' },
];

export const ACHIEVEMENT_DEFS = [
  { key: 'first-contact', title: 'First Contact', hint: 'Create or open your first project case.' },
  { key: 'source-verified', title: 'Source Verified', hint: 'Record evidence from a source you actually checked (demo records do not count).' },
  { key: 'beyond-obvious', title: 'Beyond the Obvious', hint: 'Complete a meaningful existing-solution comparison.' },
  { key: 'reality-check', title: 'Reality Check', hint: 'Record a substantive feasibility assessment with at least one verified item.' },
  { key: 'no-hand-waving', title: 'No Hand-Waving', hint: 'Link a differentiation claim to saved evidence.' },
  { key: 'demo-architect', title: 'Demo Architect', hint: 'Define at least three MVP acceptance criteria.' },
  { key: 'risk-hunter', title: 'Risk Hunter', hint: 'Document a high-impact risk together with a mitigation.' },
  { key: 'evidence-complete', title: 'Evidence Complete', hint: 'Maintain three or more checked, non-demo evidence records with claims.' },
  { key: 'buildability-certified', title: 'Buildability Certified', hint: 'Generate a Buildability Passport after required investigation checks.' },
  { key: 'traceable-proof', title: 'Traceable Proof', hint: 'Trace one need all the way to a recorded test result.' },
  { key: 'honest-tester', title: 'Honest Tester', hint: 'Record a test that failed, and keep it in the log. A failure is evidence.' },
];

export const FEATURE_STATUS = ['Planned', 'In progress', 'Built', 'Not started'];

export const SOURCE_KINDS = {
  repository: { label: 'Public repository', icon: 'git' },
  product: { label: 'Commercial product', icon: 'box' },
  paper: { label: 'Research paper', icon: 'file' },
  dataset: { label: 'Public dataset', icon: 'db' },
  api: { label: 'API / developer tool', icon: 'plug' },
  hackathon: { label: 'Hackathon project', icon: 'trophy' },
};

/* ---------------- opportunity-to-proof graph ---------------- */

// The five stages every chain is traced through. The order is the reading order
// of the graph and of the report.
export const PROOF_KINDS = [
  { key: 'need', code: 'N', label: 'Need', hint: 'A user need or opportunity worth proving.', icon: 'target' },
  { key: 'evidence', code: 'E', label: 'Evidence', hint: 'A source that supports the need or the approach.', icon: 'file' },
  { key: 'requirement', code: 'R', label: 'Requirement', hint: 'An official or self-imposed requirement to satisfy.', icon: 'clipboard' },
  { key: 'implementation', code: 'I', label: 'Implementation', hint: 'What was actually built or configured.', icon: 'layers' },
  { key: 'test', code: 'T', label: 'Test result', hint: 'How the implementation was checked, and what was observed.', icon: 'check' },
];

export const PROOF_KIND_MAP = PROOF_KINDS.reduce((acc, k) => { acc[k.key] = k; return acc; }, {});

// Only these methods exist in a frontend-only build. All of them are entered by
// the team, so every record is labelled self-reported.
export const TEST_METHODS = [
  { key: 'manual', label: 'Manual walkthrough', hint: 'A person followed the steps and recorded what happened.' },
  { key: 'demonstration', label: 'Demo run', hint: 'The demo path was run end to end.' },
  { key: 'scripted', label: 'Local script', hint: 'A script in this repository was run and its output noted by hand.' },
  { key: 'inspection', label: 'Inspection / review', hint: 'A person read the implementation or the data.' },
];

export const TEST_RESULTS = {
  'not-run': { label: 'Not run yet', cls: 'outline' },
  passed: { label: 'Passed as expected', cls: 'sage' },
  partial: { label: 'Partly passed', cls: 'amber' },
  failed: { label: 'Failed', cls: 'red' },
  blocked: { label: 'Could not be run', cls: 'orange' },
};

// Where a result came from. 'external-ci' cannot be created in this build.
export const TEST_PROVENANCE = {
  'self-reported': { label: 'Self-reported', cls: 'outline' },
  'external-ci': { label: 'External CI', cls: 'demo' },
};

export const REPORT_SECTIONS = [
  { key: 'summary', label: 'Executive summary', always: true },
  { key: 'problem', label: 'Problem & proposed solution', always: true },
  { key: 'users', label: 'Target users & workflows' },
  { key: 'method', label: 'Scope & methodology' },
  { key: 'prior-art', label: 'Existing solutions & repositories' },
  { key: 'comparison', label: 'Feature comparison' },
  { key: 'differentiation', label: 'Differentiation & evidence' },
  { key: 'feasibility', label: 'Feasibility assessment' },
  { key: 'constraints', label: 'Dependencies, access & licensing' },
  { key: 'risks', label: 'Risk register & mitigations' },
  { key: 'requirements', label: 'Competition requirements' },
  { key: 'demo', label: 'Demo acceptance criteria' },
  { key: 'traceability', label: 'Need-to-proof traceability' },
  { key: 'assurance', label: 'Assurance & testing record' },
  { key: 'scope', label: 'Essential vs optional scope' },
  { key: 'learning', label: 'Learning gaps & recommendations' },
  { key: 'roadmap', label: 'Implementation roadmap' },
  { key: 'sources', label: 'Source register' },
  { key: 'limits', label: 'Assumptions, unknowns & limitations' },
  { key: 'passport', label: 'Buildability Passport & next actions', always: true },
];
