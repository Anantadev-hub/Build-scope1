// Stable-ish local identifiers. No backend, so IDs are generated on the client
// and never derived from display names.
let counter = 0;

export function uid(prefix = 'id') {
  counter = (counter + 1) % 1296;
  const t = Date.now().toString(36).slice(-5);
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${t}${r}${counter.toString(36)}`;
}

export function makeCaseId(seq) {
  const yy = String(new Date().getFullYear()).slice(-2);
  return `BS-${yy}-${String(seq).padStart(3, '0')}`;
}

export function nowIso() {
  return new Date().toISOString();
}
