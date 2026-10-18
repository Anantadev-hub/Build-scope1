// Shared validation for the demo authentication screens. Rules are stated in
// plain language in the UI; they are local checks only and are not a substitute
// for server-side policy.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkName(value) {
  const v = String(value || '').trim();
  if (!v) return 'Enter the name that should appear on this workspace.';
  if (v.length < 2) return 'Use at least two characters.';
  if (v.length > 60) return 'Keep the name under 60 characters.';
  return null;
}

export function checkEmail(value) {
  const v = String(value || '').trim();
  if (!v) return 'Enter an email address for this demo account.';
  if (!EMAIL_RE.test(v)) return 'That does not look like an email address.';
  return null;
}

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => String(v || '').length >= 8 },
  { key: 'letter', label: 'Contains a letter', test: (v) => /[a-z]/i.test(v || '') },
  { key: 'number', label: 'Contains a number', test: (v) => /\d/.test(v || '') },
];

export function checkPassword(value) {
  const v = String(value || '');
  if (!v) return 'Choose a password for this demo account.';
  const missing = PASSWORD_RULES.filter((r) => !r.test(v));
  if (missing.length) return `Password needs: ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`;
  return null;
}

export function checkConfirm(password, confirm) {
  if (!confirm) return 'Re-enter the same password to confirm it.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

export function passwordStrength(value) {
  const v = String(value || '');
  const met = PASSWORD_RULES.filter((r) => r.test(v)).length;
  if (!v) return { key: 'empty', label: 'Not set', met };
  if (met < PASSWORD_RULES.length) return { key: 'weak', label: 'Too weak', met };
  if (v.length >= 14 && /[^a-z0-9]/i.test(v)) return { key: 'strong', label: 'Stronger (still local only)', met };
  if (v.length >= 10) return { key: 'fair', label: 'Acceptable', met };
  return { key: 'weak', label: 'Weak but allowed', met };
}

export function checkTerms(accepted) {
  return accepted ? null : 'Acknowledge how this demo workspace stores data before continuing.';
}
